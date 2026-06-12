---
name: mcts-converge
description: MCTS-TD Decision Engine "Step 3~3.6" — Converge Engine. Aggregate comparison (CLT-UCB ranking) + simulation result self-check + domain blindspot audit + re-simulation + TD error recording.
---

# Step 3~3.6: Converge Engine — Aggregate × Self-Check × Blindspot Audit

> **🔒 COMPRESSION-SAFE RULES (Always apply, even if context is compressed):**
> 1. **OUTPUT LANGUAGE**: User language already detected. Continue using that language.
> 2. **CONVERGE PHASES**: Aggregate → Self-Check → Blindspot Audit → Decision Report.
> 3. **FINAL OUTPUT**: In user's detected language. `node scripts/language_guard.js check` verifies consistency.
> 4. **RANKING**: Rank solutions by V (value), show ALL solutions (not just top 3) with n, σ², confidence, and multi-layer breakdown (V_feasibility, V_robustness, V_perspective).
> 5. **MULTI-SOLUTION HANDLING**: With 5-8 solutions, ranking uses CLT-UCB. Solutions with σ² > 0.25 are shown with "high variance" warning.
> 5. **⛔ SELF-CHECK MANDATORY**: Before executing, run `node scripts/mcts_guard.js self-check-guard` and answer ALL 9 questions in the checklist. Do NOT skip.
> 6. **⛔ COMPLIANCE**: Before final decision, run `node scripts/mcts_guard.js compliance-report --state '<JSON>'` to audit the full pipeline.

> ⚠️ **OUTPUT LANGUAGE RULE (HIGHEST PRIORITY)**: All user-facing output MUST be in the user's detected language. Internal reasoning is English; user sees their language.

> **One-liner**: After all solutions are simulated, first rank to select best, then self-question simulation results, finally check perspective coverage completeness, then execute.
> Converge Engine is the final quality gate — prevents "simulated right direction but got it wrong".

---

## Converge Engine Full Flow

```
Aggregate Comparison (CLT-UCB Ranking)
    ↓ Select 1st place
Simulation Result Self-Check (find flaws + reverse thinking + risk assessment)
    ↓ Check "Did we simulate correctly?"
Domain Blindspot Audit (check perspective coverage)
    ↓ Check "Did we miss key dimensions?"
Decision Conclusion (Pass → Execute / Alert → Supplement solution /
                    Fail → Re-simulate)
```

---

## Step 3: Aggregate Comparison (Based on Multi-round MCTS Iteration Results)

> Simulate Engine has completed multi-round MCTS tree search. Each solution
> underwent n independent simulations. Value estimate has stabilized.
> Converge Engine now ranks based on these **multi-round iteration convergence
> results**.

### Input: Tree Search Results from Simulate Engine

```
Each solution output from Simulate Engine:
  SolutionA: n=5, V=0.84, σ²=0.03, Confidence=High
             Best Path: Step1-Success → Step2-PathA → Step3-Complete
             Main Risk: Step1-Failure (n=2, V=0.30, low probability but
                                      high impact)
  
  SolutionB: n=4, V=0.76, σ²=0.08, Confidence=Medium
             Best Path: Step1-Success → Step2-AvoidRisk → Step3-Complete
             Main Risk: Step2 risk avoidance failed (n=1, V=0.52)
  
  SolutionC: n=3, V=0.62, σ²=0.15, Confidence=Low
             Best Path: Step1-Success → Step2-DirectExecute
             Main Risk: High variance (high uncertainty)
```

### Summary Table

```
Columns: Solution | n | V | σ² | Confidence | Best Path / Main Risk
n=simulation count, V=average value, σ²=variance,
Confidence=High(n≥5,σ²<0.05)/Medium/Low
```

### ⭐ Multi-Layer Ranking Display (NEW)

```
Solution Ranking (5 solutions):

Rank │ Solution    │ V_final │ V_feas  │ V_robust│ V_persp │ σ²    │ n  │ Conf
─────┼─────────────┼─────────┼─────────┼─────────┼─────────┼───────┼────┼──────
  1  │ SolutionC   │ 0.85    │ 0.91    │ 0.82    │ 0.78    │ 0.03  │ 8  │ HIGH
  2  │ SolutionA   │ 0.80    │ 0.88    │ 0.75    │ 0.72    │ 0.05  │ 6  │ HIGH
  3  │ SolutionE   │ 0.72    │ 0.85    │ 0.60    │ 0.65    │ 0.09  │ 5  │ MED
  4  │ SolutionB   │ 0.65    │ 0.70    │ 0.62    │ 0.58    │ 0.15  │ 4  │ LOW
  5  │ SolutionD   │ 0.51    │ 0.80    │ 0.30    │ 0.25    │ 0.22  │ 3  │ LOW

→ V_final = 0.5×V_feas + 0.3×V_robust + 0.2×V_persp
→ SolutionC leads on all three layers. SolutionD has high V_feas but
  low V_robust and V_persp — fragile under counterfactual.
```

### MCTS Ranking Rules

```
Ranking rule: `node scripts/mcts_compute.js rank --solutions '<JSON>'`
Sort by V descending. When V diff <0.05, compare n and σ².
needs_re_evaluation checks if additional iterations needed.
Output recommended solution + best path + main risk + confidence level.
```

### Convergence Determination

```
Convergence check: `node scripts/mcts_compute.js check-final-convergence`
Conditions: Root total n≥solution_count×4 | 1st place n≥5 |
            1st place σ²<0.10 | V gap >0.05
Not converged → Add 3 rounds (max 2 times) |
Still not converged → Mark "not fully converged"
```

---

## ASK_USER_CONFIRMATION — Display Search Results and Ask

Before entering self-check and blindspot audit, **first display MCTS tree search conclusion to user**:

```
═══════════════════════════════════════
 【MCTS Tree Search Conclusion】 (8 iterations)

 SolutionA — V=0.84, n=5, σ²=0.03 ⭐Recommended
   Best Path: gin-jwt extension → access+refresh token → Redis blacklist
   Main Risk: Step1 compatibility issue (low probability, fallback available)
   Confidence: High

 SolutionB — V=0.76, n=4, σ²=0.08
   Best Path: Self-implement JWT → memory blacklist → simple refresh
   Main Risk: Self-implemented JWT security needs verification
   Confidence: Medium

 SolutionC — V=0.62, n=3, σ²=0.15
   Best Path: Introduce Keycloak → OAuth2 config → integration
   Main Risk: External dependency may violate project constraints
   Confidence: Low (high variance, uncertain)

 **Recommend SolutionA**. After confirmation, enter self-check and blindspot
 audit.
═══════════════════════════════════════
```

**If only 1 solution**: Still display search results, don't skip, wait for user confirmation.

---

## Step 3.5: Simulation Result Self-Check (Critical Error Prevention)

Before executing selected solution, **must self-question simulation results once**. This is the last defense against "simulated wrong but still executing wrong".

### Why Self-Check is Needed

```
Simulation process itself can have errors:
  - Claude missed some key factor during reasoning
  - Simulation relied on an incorrect assumption
  - Some solution's risk was underestimated
  - Historical data in value function may be outdated

Execute without self-check → Wrong without knowing → Wrong value absorbed
                              by TD learning
  → Future simulations increasingly inaccurate → Vicious cycle
```

### Self-Check Steps

```
After "select 1st place as execution solution", before executing, do three
things:

① Find flaws:
  "Where might this simulation be wrong?"
  → Check if simulation had vague judgments
  → Check if relied on unverified assumptions
  → Check if any ignored risks
  
② Reverse thinking:
  "If 2nd place is actually better than 1st place, what might be the reason?"
  → Force self to look from another angle
  → Find 1st place's blindspots
  
③ Risk assessment:
  "If chose wrong, what's the worst outcome? Can we bear it?"
  → If can bear → Execute
  → If cannot bear → Enter "re-simulate" mode, or suggest user manual confirm
```

### Self-Check Report Format

```
═══════════════════════════════════════
  Simulation Result Self-Check
═══════════════════════════════════════

  ① Find flaws:
    □ Did simulation have vague judgments? → [Yes/No]
      If yes: [Specific explanation]
    □ Did it rely on unverified assumptions? → [Yes/No]
      If yes: [Specific explanation]
    □ Were there ignored risks? → [Yes/No]
      If yes: [Specific explanation]

  ② Reverse thinking:
    If 2nd place [SolutionB] is actually better than 1st place [SolutionA],
    possible reasons:
    - [Reason1]
    - [Reason2]
    Likelihood these reasons are valid: [High/Medium/Low]
    If valid, does it change selection? → [Yes/No]

  ③ Risk assessment:
    Worst outcome of choosing 1st place [SolutionA]: [Description]
    Worst outcome impact level: [Minor/Moderate/Severe]
    Can we bear it? → [Can/Cannot]

  Self-Check Conclusion:
    ✅ Pass — Simulation reliable, can execute
    ⚠️ Has risk — Recommend user confirm before executing
    ❌ Not passed — Re-simulate or switch solution
```

### Handling When Self-Check Not Passed

```
Self-check conclusion handling:
  `node scripts/mcts_compute.js handle-self-check --conclusion <Pass/Risk/NotPassed>`
```

### Circuit Breaker Mechanism

```
Circuit breaker: `node scripts/mcts_compute.js get-fuse-mode --accuracy <float> --consecutive-bad <int>`
Accuracy = proportion of last 10 times where |error|<0.3
<70% → simplified | <50% → ask user | Consecutive 3 times <50% → suggest manual
```

---

## Step 3.6: Domain Blindspot Audit (Perspective Coverage Check)

> **Core Design**: After simulation ends, before execution, final check — did our brainstorming truly cover all key domains?
> This step is the last defense against "solution scored high but fundamental direction was wrong".

### Why Blindspot Audit is Needed

```
Self-check (Step 3.5) examines "Did solution simulate correctly" — vertical
depth check.
Blindspot audit (Step 3.6) examines "What perspectives did we miss" —
horizontal breadth check.

The two are orthogonal:
  Self-check: "Did SolutionA's simulation have flaws?" ← Vertical depth
  Blindspot audit: "Did we completely miss security perspective?" ←
                    Horizontal breadth

If only self-check without blindspot audit:
  → SolutionA simulated perfectly, but SolutionA itself is pure tech perspective
  → What user truly needs is security perspective's SolutionB
  → Executed SolutionA then realize "Oh, should have considered security"
  → Waste!
```

### NEW: Cultural Perspective Cross-Validation

After the standard blindspot audit, **AND** after comparing with Step 0.5's cultural perspective matrix findings:

```
Step: Compare simulation outputs against Step 0.5 100-Schools Perspective findings

  1. Extract all blindspots from Step 0.5
  2. Check each blindspot against ranked solutions：
     - Covered -> mark covered, note which solution
     - Not covered -> mark blindspot missed

  ③ Generate perspective coverage table:
     ┌──────────────────┬──────────┬──────────┬──────────┬──────┐
     │ Perspective blindspot          │ SolutionA│ SolutionB│ SolutionC│ ...  │
     ├──────────────────┼──────────┼──────────┼──────────┼──────┤
     │ Military:Qi-Zheng      │    ✓     │    -     │    ✓     │      │
     │ Medical:Biao-Li      │    -     │    ✓     │    ✓     │      │
     │ Daoist:inaction      │    ✗     │    ✗     │    ✗     │<- missed │
     │ Historical:cycle phase      │    ✓     │    -     │    -     │      │
     └──────────────────┴──────────┴──────────┴──────────┴──────┘

  4. Missed blindspot handling:
     If 3+Perspective blindspots not covered by any solution
       -> WARNING: coverage gap → Return to converge, generate solutions
     If 1-2Perspective blindspots not covered
       -> NOTE: annotate uncovered blindspots in decision report
     If none missed
       -> Full coverage, proceed to final decision
```

### Blindspot Audit Framework

```
═════════════════════════════════════════════════════════════════════
  Domain Blindspot Audit
═════════════════════════════════════════════════════════════════════

Step 1: List perspectives of all generated solutions
  ┌───────┬────────────────────┬─────────────────────────────┐
  │Solution│ Main Perspective    │ Six-Dimension Coverage      │
  ├───────┼────────────────────┼─────────────────────────────┤
  │ A      │ ①Tech Selection     │ Tech stack, Architecture    │
  │ B      │ ④Security First     │ Security compliance,        │
  │        │                     │ Tech stack                  │
  │ C      │ ⑤Ops First          │ Ops deployment, Architecture│
  │ D      │ ⑩Reverse Perspective │ (Anti-pattern, not direct   │
  │        │                     │  coverage)                  │
  └───────┴────────────────────┴─────────────────────────────┘

Step 2: Compare with Six-Dimension Domain Map, identify missing dimensions
  Six-Dimension Map:
    [√] Tech stack     — Covered (SolutionA, SolutionB)
    [√] Architecture   — Covered (SolutionA, SolutionC)
    [×] Business flow  — Not covered! ← Blindspot
    [√] Security       — Covered (SolutionB)
    [√] Ops deployment — Covered (SolutionC)
    [×] User experience — Not covered! ← Blindspot

  Blindspot dimensions: Business flow, User experience

Step 3: For each blindspot, determine if solution supplementation needed

  Blindspot 1: Business flow
    → Need business flow perspective solution? → [Yes/No]
    → Judgment basis:
      If feature involves complex entity transitions, state machines,
      multi-step flows → Yes
      If just simple CRUD operation → No
    → Conclusion: [Need supplement / Not needed, doesn't affect decision quality]

  Blindspot 2: User experience
    → Need user experience perspective solution? → [Yes/No]
    → Judgment basis:
      If user-facing feature → Yes
      If pure backend/infrastructure → No
    → Conclusion: [Need supplement / Not needed, doesn't affect decision quality]

Step 4: Blindspot Supplement Decision

  Case 1: All blindspots don't need supplement
    → ✅ Perspective coverage complete, enter execution phase
    → Format: "All key dimensions covered, blindspot audit passed"

  Case 2: Some blindspots need supplement, and current 1st place has obvious
          perspective bias
    → ⚠️ Blindspot audit alert, need supplement solution
    → Return to perspective wheel, generate new solution for blindspot
    → New solution generated, append simulation

  Case 3: Some blindspots need supplement, but 1st place already covers well
    → 💡 Blindspot audit hint, but don't force supplement
    → Annotate in final output: "Note: SolutionA doesn't cover XX perspective,
                                 can append if needed"
    → User sees hint, decides whether to supplement
```

### Blindspot Audit Output Format

Output format (core fields):
  【Domain Blindspot Audit】Solution perspective summary table +
  Six-dimension coverage matrix + Blindspot assessment + Supplement decision

---

## Handling Unexpected Issues During Execution

```
If encountering unforeseen issues during execution:
  1. Record unexpected: What was assumption during simulation? What's actual?
  2. Assess impact: Does this unexpected make current solution infeasible?
     → If infeasible: Trigger "re-simulate" mode
     → If still feasible: Continue execute, but adjust simulation score
  3. Re-simulate: Return to Simulate Engine, simulate 2nd place solution
                  (if not done before)
  4. Switch execution: If 2nd place is better, switch to it
```

## Complete Re-simulate Mode Rules

```
Re-simulate decision: `node scripts/mcts_compute.js re-simulation-decide`
Core: 2nd place has simulation → Direct comparison |
       2nd place no simulation → Quick simulate (2 steps) |
       All affected → Return to Diverge Engine
Knowledge update: Failure reason → knowledge graph, New constraints →
                  constraint list, Success → complete decision trace
```

---

## TD Error Recording (During Execution)

```
Each time encountering unexpected:
  TD_error = Actual result - Simulated expectation
  This error is recorded, used in final TD update phase
```

## TD Update and Knowledge Write-back (After Execution)

> This is where "TD" in MCTS-TD materializes — after execution completes,
> compare actual results with simulation, update knowledge graph.

### Complete Write-back Flow

```
TD update orchestrated by `node scripts/mcts_compute.js` td_update_workflow:
1. Calculate V_actual, TD_error = V_actual - V_predicted
2. Traverse optimal path nodes → Match knowledge graph → Update or create
   HYPOTHESIS
3. Check status transitions, sleep, archive
4. Record decision sequence patterns (success/failure paths)

Write path: ~/.claude/data/skills/mcts-td-planner/memory/mcts-td-value-archive.md
```

---

## Decision Conclusion Output Format

Decision report format (core fields):

```
════════════════════════════════════════════════════════
 【MCTS-TD Decision Report】
 Task: [Task description]
 Date: [Date]  |  Total iterations: [N]  |  Solutions evaluated: [5~8]
════════════════════════════════════════════════════════

 Solution Ranking (V_final = 0.5×V_feas + 0.3×V_robust + 0.2×V_persp)

 Rank │ Solution    │ V_final │ V_feas│ V_robust│ V_persp│ σ²  │ n │ Conf
 ─────┼─────────────┼─────────┼───────┼─────────┼────────┼─────┼───┼─────
  1   │ [name]      │ [val]   │ [...] │ [...]   │ [...]  │ σ²  │ n │ HIGH
  2   │ [name]      │ [val]   │ [...] │ [...]   │ [...]  │ σ²  │ n │ MED
  ...

 Self-Check Conclusion:
   ✅ Pass / ⚠️ Has risk / ❌ Not passed
   [Specific findings from self-check]

 Perspective Blindspot Audit:
   ✅ / ⚠️ / ❌ [Conclusion]
   [View matrix showing cultural perspective coverage]
   [Uncovered blindspots, if any]

 Execution Plan:
   [Optimal solution] → [Step 1] → [Step 2] → ... → [Step N]
   [Key risks to watch] | [Fallback plan]

 Knowledge Update Summary:
   [New knowledge written to graph]
   [TD error recorded: V_predicted → V_actual]
────────────────────────────────────────────────────────
```