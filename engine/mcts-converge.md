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

### 执两用中 — Doctrine of the Mean (中庸)

"执其两端，用其中于民" — 不是取平均，而是把握两端找到最优平衡点。

Converge排名不是简单选最高V:
- V_final = 0.5×V_feas + 0.3×V_robust + 0.2×V_persp + Body-Use bonus
- 这是"执两用中"的量化：可行性(正) + 鲁棒性(反) → 综合最优(中)
- 第1名V_feas高但V_robust低 → 偏端，不是"中"
- Self-Check第④问(本末) = 检查是否偏离了"中"

学术支撑: Herbert Simon "Bounded Rationality" (1956) — 最优解不可达时，满意解(中)更实际。

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

**⛔ MANDATORY — answer ALL 5 questions before proceeding.**

① **Find flaws** → "为人谋而不忠乎?": Is any judgment vague? Any assumption unverified? Any risk ignored?
   - 忠=忠于问题本身，不是忠于自己的偏好。检查是否被"我擅长X"带偏了方向
   - Check each solution: does it rely on "probably fine" or "should work"?
   - Check for wishful thinking: "the API will handle it" → really?

② **Reverse thinking**: If 2nd place > 1st place, why? How likely? Does it change selection?
   - Construct a scenario where 2nd place wins. Is it plausible?
   - If yes → ask user about that scenario specifically

③ **Risk assessment** → "与朋友交而不信乎?": Worst outcome of the #1 choice? Can we bear it?
   - 信=方案的承诺是否能兑现。第1名说"可行"——真的可信吗？
   - What's the maximum downside? Probability? Can it be reversed?
   - If irreversible and probability >10% → ⚠️ Risk

④ **Root-Shift Check** (本末): Does 1st place violate the root dimension from 五診?
   - Root dimension = the one that defines the problem's essence
   - If 1st place sacrifices root for branch convenience → conditional pass only

⑤ **動静 Mode Check** → "传不习乎?": Are we biased?
   - 习=实践检验，不是机械套用流程。是否在"走流程"而非"真思考"？
   - Over-analyzing a simple problem (靜→動 bias)? → simplify, decide
   - Under-analyzing a complex problem (動→靜 bias)? → slow down, more sim

```
Self-Check Verdict:
  ✅ Pass — all 5 questions satisfied
  ⚠️ Risk — specific concern, recommend user confirm (use AskUserQuestion)
  ❌ Not passed — re-simulate with adjusted assumptions
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

**⛔ Scan for 3 specific mismatches between user statements and our interpretations:**

① **Literal vs Metaphorical**: User said X literally, but we interpreted as metaphor? Or vice versa?
   - "Make it fast" → 50ms response time? Or "don't make users wait"?
   - "Must be robust" → 99.99% uptime? Or "shouldn't break easily"?

② **Same words, different intent**: User and we use the same term but mean different things.
   - "Simple" → few lines of code? Or easy to understand? Or quick to build?
   - "Secure" → encrypted? Authenticated? Audited?

③ **Unstated expectations**: User didn't say it, but we assumed it (or missed it).
   - Did we assume a specific tech stack without confirmation?
   - Did we ignore an implicit "it should work like [familiar app]"?

**Resolution rules:**
- Same 意 different 言 → merge solutions (false diversity)
- Same 言 different 意 → keep both (fundamental disagreement, need user clarification)
- Gap affects ranking → re-simulate → mark for user confirmation

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
   ☐ post_simulate: [DONE/IDs:.../SKIPPED(why)]
   ☐ pre_converge: [DONE/ALERT(what)]
   ☐ post_execution: [DONE/SKIPPED(why)]
   ☐ session_end: [DONE/N points/SKIPPED(why)]

 Session Points: [list of ashi point IDs created this session]

 Language Guard: `check --user-lang <lang> --output "..."` [PASS/FAIL]
```
