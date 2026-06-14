---
name: mcts-constraint
description: MCTS-TD Step 0 — Constraint Collection + Xuanxue/Zhanbu Enhancements
---

# Step 0: Requirement Constraint Collection

> **🔒 COMPRESSION-SAFE RULES:**
> 1. OUTPUT in user's language | 2. MUST ASK when unclear | 3. DEMAND REFINEMENT before solutions
> 4. HARD vs SOFT constraints | 5. SOURCE TRACKING per constraint | 6. DECOMPOSITION CHECK before "single solution"
> 7. ROOT-BRANCH after 五診 | 8. ABSENCE DETECTION per dimension | 9. RELATIONAL TENSION → diverge priority
> 10. 动静 MODE before engine

---

## 0.1 五診 (Wuzhen) Requirement Portrait

5 dimensions, each scored 0-10. Any <7 → ASK user.

| Dim | Name | Abstract Probe | Generic Questions |
|-----|------|---------------|-------------------|
| 天 | Timing | When? Temporal context? | Stage? Deadline? Environment stability? Window closing? |
| 地 | Resources | What to work with? Limits? | People/budget/materials available? Locked-in deps? |
| 人 | People | Who affected? Acceptance? | Impacted stakeholders? Resistance? Final say? |
| 法 | Rules | What rules? Forbidden? | Regulations? Process? Structural constraints? |
| 物 | Essence | What is this REALLY about? | Core purpose? Success criteria? Deal-breakers? |

⚠️ Adapt questions to user's domain — never assume "software project".

Code: `node scripts/mcts_compute.js five-diagnosis --scores '<JSON>'`

### Follow-up Strategy

- sufficient (≥7) → record, no follow-up
- partial (4-6) → ask 1-2 key questions
- severe (≤3) → MUST ask with guided options (AskUserQuestion)
- Max 3-5 questions per round. Only ask what "only the user would know".

Cross-dimension validation (5 pairs from tension scan):
  天↔人: window vs readiness | 地↔法: resources vs governance | 物↔天: goal vs timing
  人↔物: stakeholders vs purpose | 物↔法: goal vs rules
  → Contradiction → ask user | |diff|≥4 → HOTSPOT for diverge

### Portrait Output Format

```
【Requirement Portrait · 五診合参】
 Task: [xxx]
 ① 天(Tian) [7/10] sufficient — Stage: ... | Time: ... | Env: ...
 ② 地(Di)   [4/10] partial ← ask — [what's missing]
 ③ 人(Ren)  [3/10] severe ← MUST ask — [what's missing]
 ④ 法(Fa)   [8/10] sufficient — [known constraints]
 ⑤ 物(Wu)   [5/10] partial ← ask — [what's missing]

 Questions: [Q1] [Q2] [Q3]
 Cross-dimension: [findings]
 Root (Ben): [dimension] | Absence: [alerts] | Tension: [hotspots]
```

---

## 0.1b Xuanxue Enhancements (AFTER 五診, MANDATORY)

### 本末 (Root-Branch)

After 五診 scores, identify root dimension (ben) — its constraints are super-hard.
Adjacent dimension violation → HARD. Peripheral → SOFT.

Code: `node scripts/mcts_compute.js root-branch --scores '<JSON>'`

### 有无 (Absence Detection)

For each dimension, check what constraints are ABSENT that should normally be present.
Abnormal absence → mark blindspot → Info Gap phase asks about it.

Code: `node scripts/mcts_compute.js absence-detect --domain '<str>' --constraints '<JSON>'`

### Relational Tension (六壬 Method)

Compute tension for key dimension pairs: 天↔地, 人↔物, 法↔地, 天↔人, 物↔法
Tension = |score_A - score_B|. ≥4: HOTSPOT → diverge priority. ≤1: STABLE.

Code: `node scripts/mcts_compute.js tension-scan --scores '<JSON>'`

### 动静 (Movement-Stillness) — Engine Mode

Before engine engages, determine mode:
- Urgency markers ("紧急/ASAP") → **動(Dong)**: simplified engine, 3-5 MCTS rounds, skip Round 3
- Depth markers ("重要/慎重/全面") → **靜(Jing)**: full engine, 8-10 rounds
- No signal → judge from complexity: 1 viable option → 動, 3+ with uncertainty → 靜

Mode switch: if 動 mode reveals hidden complexity → upgrade to 靜.

Code: `node scripts/mcts_compute.js dong-jing --message '<msg>' --decision-count <N>`

---

## 0.2 Technical Constraint Checklist

Code: `node scripts/mcts_guard.js constraint-checklist` (9 items: tech_stack, dependencies, architecture, compliance, performance, security, time_budget, backward_compat, user_preference)

Items with auto_detect=true → check from code. auto_detect=false → MUST ask user.

## 0.3 Constraint Sources (by priority)

1. User explicit → Hard Constraint
2. Code inferred → Fact Constraint
3. Industry common knowledge → Inferred (confirm with user)
4. Knowledge graph → Experience (reference, confirm)

## 0.4 Handling Missing Constraints

- Can self-confirm from code → do it, record as Fact
- Cannot self-confirm → Pause → Ask user
- User answered but incomplete → Follow-up until clear
- ⛔ "Cannot fabricate" ≠ "output empty". Correct: search public data → output with uncertainty annotation

## 0.5 Low Facet Scores

Any facet ≤3 → WebSearch + ask user. Do NOT skip or output empty template.

## 0.6 Constraint Impact

Hard constraint violated → eliminate solution. Soft → lower match score M.

## 0.7 Constraint Changes During Simulation

1. Add new constraint. 2. Evaluate existing solutions. 3. All violate hard → return to Diverge.

---

## Constraint Output Format

```
【Requirement Constraint List】
 Task: [xxx]
 Hard: [✓/✗] constraint (source)
 Soft: [ ] constraint (source, unconfirmed)
 Sources: User=N, Code=N, Inferred=N
```
