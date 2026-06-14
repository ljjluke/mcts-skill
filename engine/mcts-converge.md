---
name: mcts-converge
description: MCTS-TD Step 3~3.6 — Converge Engine. CLT-UCB ranking + self-check + blindspot audit + TD write-back.
---

# Step 3~3.6: Converge Engine

> **🔒 COMPRESSION-SAFE RULES:**
> 1. OUTPUT in user language | 2. Phases: Aggregate → Self-Check → Blindspot → Decision Report
> 3. Rank ALL solutions (not just top 3) with n/V/σ²/confidence + multi-layer breakdown
> 4. SELF-CHECK mandatory: `self-check-guard` | 5. COMPLIANCE: `compliance-report` before decision

---

## Step 3: Aggregate Comparison

### Multi-Layer Ranking

```
Rank │ Solution │ V_final │ V_feas │ V_robust │ V_persp │ σ² │ n │ Conf
─────┼──────────┼─────────┼────────┼──────────┼─────────┼────┼───┼──────
  1  │ [...]    │ [...]   │ [...]  │ [...]    │ [...]   │ .. │ . │ HIGH
```

V_final = 0.5×V_feas + 0.3×V_robust + 0.2×V_persp + Body-Use bonus
Code: `rank --solutions '<JSON>'`

### Convergence

`check-final-convergence`: Root n≥solutions×4, 1st n≥5, σ²<0.10, V gap >0.05
Not converged → +3 rounds (max 2×), still not → mark "not fully converged"

### Display + Confirm

Before self-check, **display MCTS conclusion to user** with ranking + best path + main risk + confidence.

---

## Step 3.5: Self-Check (Critical Error Prevention)

① **Find flaws**: vague judgment? unverified assumption? ignored risk?
② **Reverse thinking**: if 2nd place > 1st place, why? Likelihood? Does it change selection?
③ **Risk assessment**: worst outcome? Can we bear it?
④ **Root-Shift Check** (本末): 1st place violates root dimension? → conditional pass
⑤ **動静 Mode Check**: Over-analyzing (靜→動 bias)? Under-analyzing (動→靜 bias)?

```
Self-Check Conclusion:
  ✅ Pass | ⚠️ Risk (recommend user confirm) | ❌ Not passed (re-simulate)
```

Code: `handle-self-check --conclusion <Pass/Risk/NotPassed>`

**Circuit breaker**: `get-fuse-mode --accuracy <float> --consecutive-bad <int>`
<70% → simplified | <50% → ask user | 3× <50% → suggest manual

---

## Step 3.6: Blindspot Audit + 言意 Gap

### Cultural Sub-Lens Coverage

1. Extract blindspots from diverge phase's sub-lenses
2. Check each against ranked solutions → covered/missed
3. 3+ missed → WARNING → return to converge | 1-2 → annotate in report

### 言意 (Word-Meaning) Gap Detection

Scan for mismatches between user statements and our interpretations:

- User statement taken LITERALLY when METAPHORICAL? ("fast" = 50ms or "don't drag"?)
- User concern interpreted METAPHORICAL when LITERAL? ("Must support IE" = really IE?)
- Same 意 different 言 → merge (false diversity). Same 言 different 意 → keep (fundamental disagreement)

When gap detected → annotate in report → if affects ranking → re-simulate → mark for user confirmation.

Code: `yan-yi-check --statements '<JSON>' --interpretations '<JSON>'`

### Blindspot Audit Framework

1. List perspectives of all solutions
2. Compare with Eight-Facet + Sub-Lens coverage → find missing dimensions
3. For each blindspot: need supplement? (based on feature complexity / user-facing vs backend)
4. Decision: all covered → pass | 1st place biased → supplement | 1st covers well → annotate

---

## Re-simulate Mode

`re-simulation-decide`: 2nd place has sim → compare | no sim → quick 2-step | all affected → return to Diverge
Update: failure → knowledge graph, new constraints → list, success → full trace

---

## TD Write-back (MANDATORY)

**Without TD update, skill CANNOT learn.**

1. Calculate V_actual, TD_error = V_actual - V_predicted
2. Traverse optimal path → match knowledge graph → update/create HYPOTHESIS
3. Check status transitions, sleep, archive

### 理事 (Li-Shi) Dual-Layer Write-back

- **理(Li·Principle)**: universal pattern → tag `layer:principle`, cross-domain reusable, CONFIRMED after 3+ validations
- **事(Shi·Phenomenon)**: concrete case → tag `layer:phenomenon`, same-domain reference

Code: `li-shi-split --insight '<JSON>'`

---

## Decision Report Format

```
【MCTS-TD Decision Report】
 Task: [...] | Date: [...] | Iterations: [N] | Solutions: [5-8]

 Ranking (V_final = 0.5×V_feas + 0.3×V_robust + 0.2×V_persp + Body-Use):
 Rank │ Solution │ V_final │ V_feas │ V_robust │ V_persp │Body-Use│ σ² │ n │ Conf

 Self-Check: ✅/⚠️/❌ [findings]
 Blindspot Audit: ✅/⚠️/❌ [sub-lens coverage]
 言意 Gap Check: ✅/⚠️ [specific gaps]

 Execution Plan: [solution] → [steps] → [key risks] | [fallback]
 Phase 3.5: `should-ask-user --ranked '<JSON>'`

 Knowledge Update: [new knowledge] [TD error: V_predicted → V_actual]

 Memory Agent Checkpoints:
   ☐ pre_engine: [DONE/SKIPPED(why)]
   ☐ during_diverge: [DONE/SKIPPED(why)]
   ☐ post_simulate: [DONE/SKIPPED(why)]
   ☐ pre_converge: [DONE/ALERT(what)]
   ☐ post_execution: [DONE/SKIPPED(why)]

 Language Guard: `check --user-lang <lang> --output "..."` [PASS/FAIL]
```
