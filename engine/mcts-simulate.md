---
name: mcts-simulate
description: MCTS-TD Step 2 — MCTS Tree Search. Multi-round iteration: Selection→Expansion→Simulation→Backpropagation + Knowledge Update.
---

# Step 2: MCTS Tree Search Simulation

> **🔒 COMPRESSION-SAFE RULES:**
> 1. OUTPUT in user language | 2. 4 phases per round visible to user
> 3. Knowledge acquisition: ① Diverge handoff ② Memory ③ Web ④ Ask user ⑤ Assume (+0.1)
>    ⛔ NEVER jump to ④⑤ without exhausting ①②③. Verify: `info-gap-guard`
> 4. Stop when V stable 3 rounds OR max iterations | 5. Multi-layer reasoning mandatory
> 6. MUTATION VECTOR: 5-bit mask per node, volatile dimensions → higher exploration
> 7. BODY-USE COMPATIBILITY: final ranking gets 体用生克 bonus

---

## Multi-Layer Simulation

Each solution simulated at 3 layers:

| Layer | Question | Prior From | Output |
|-------|----------|-----------|--------|
| Feasibility | "Is this viable given conditions?" | F1/F2/F6/F7 | V_feasibility |
| Counterfactual | "If key assumptions fail?" | F3/F5 low scores | V_robustness |
| Perspective | "From different cultural lenses?" | 2-3 sub-lens findings | V_perspective |

**V_final = 0.5×V_feas + 0.3×V_robust + 0.2×V_persp**

Verify: `simulate-layer-guard --state '{solutions:[...]}'`

---

## Tree Node Structure

```
Node = { id, description, parent, children,
  n, w, V, σ²,                          // MCTS stats
  node_type: ACTION|RISK|FALLBACK|TERMINAL,
  is_terminal, expansion_potential: HIGH|MED|LOW|NONE,
  mutation: [0,0,0,0,0]                  // 5-bit: [天,地,人,法,物] 0=stable 1=volatile
}
```

---

## ① SELECTION — UCB + Knowledge Bias

**UCB = V + c×√(ln(N_parent)/n_child) + K_bonus**, c=√2
Code: `ucb --v <V> --n <n> --parent-n <N> --k-bonus <K>`

**K_bonus**: `k-bonus --status <s> --n <n> --q <q>`
CONFIRMED+n≥5+q≥0.8 → +0.15 | PROVISIONAL+n<5+q≥0.7 → +0.05 | DISPUTED/q<0.5 → -0.10

**Round 1 special**: all n=0 → use knowledge graph recommendation score for initial sort.

**Mutation Vector influence**: if UCB_a - UCB_b < 0.05 AND mutation_a > mutation_b → select node_a.
Code: `mutation-vector --nodes '<JSON>'`

---

## ② EXPANSION

At reached node, expand new child based on node_type:
- ACTION: success path / partial success / obstacle
- RISK: avoided / occurred / misjudged
- FALLBACK: worked / failed / abandon path
- TERMINAL: no expansion

expansion_potential → HIGH: 2-3 children | MED: 1 | LOW: 1 quick-check | NONE: stop

---

## ③ SIMULATION — Quick Roll-out

Quick roll-out from new node to termination. Depth: simple 1-2 steps, medium 2-3, complex 3-4.

**Knowledge Acquisition Priority** (execute in order, cannot skip):
1. **Memory**: query knowledge graph + current session → evaluate credibility (HIGH→use, MED→use+mark, LOW→use+lower weight)
2. **Self-learn**: check code/docs/WebSearch → need 2 sources cross-validated
3. **Ask user**: requirement/preference/constraint uncertainty → max 2 questions, collect for batch
4. **Assume**: last resort → annotate "Assume: XXX", variance +0.1

### Recursive Divergence Depth Control

Sub-decision during roll-out → code guard check:

| Depth | Mode | Scope |
|-------|------|-------|
| 0 | full | 6-dim map + multi-perspective + complete sim |
| 1 | simplified | 2 solutions, 1-2 step sim |
| 2 | micro_diverge | 1 perspective, 1-step, variance +0.1 |
| ≥3 | micro_diverge_risky | micro but high-risk, variance +0.15 |

Commands: `enter-simulation`, `begin-sub-diverge`, `end-sub-diverge`, `synthesize-sim`, `reset-depth`
Hard limit: MCTS_MAX_DIVERGE_DEPTH=3

---

## ④ BACKPROPAGATION

Each ancestor: n+=1, w+=V_leaf, V=w/n, Welford online σ²

---

## ⑤ KNOWLEDGE UPDATE

Pre-write gate: `meridian_memory.js ashi` (gate-check built-in)
Score <0.4 → discard | 0.4-0.59 → observe (15-day verify) | ≥0.6 → store

Write when: V≥0.8 | V≤0.3 | Round%5==0 | After convergence
Safety: `check-write-safety`
Session-end: `session-end` (decay + cluster + reinforce)

---

## Iteration Control

| Complexity | Max Iterations |
|-----------|---------------|
| simple | 5 |
| medium | 10 |
| complex | 20 |
| debug | 8 |

**Convergence**: V change <0.05 in last 3 rounds AND high-value n≥3 AND best n≥5 σ²<0.05

### Per-Round Output Format

```
MCTS Round [N]:
  ① Selection: [path] (UCB values, why this path)
  ② Expansion: [new node] (type, potential)
  ③ Simulation: [roll-out path → V=X] (knowledge acquired, assumptions)
  ④ Backprop: [node updates]

Tree State: [summary of all solutions n/V/σ²]
Convergence: [check result]
```

⛔ FORBIDDEN: outputting only final V/n/σ² without per-round detail | collapsing rounds

### Final Output

```
MCTS Complete — [N] rounds, stop reason: [why]
Ranking: SolutionA n=5 V=0.84 σ²=0.03 Conf=High | SolutionB ...
Best path: [...] | Main risk: [...]
```
