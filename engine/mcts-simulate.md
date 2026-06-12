---
name: mcts-simulate
description: MCTS-TD Decision Engine "Step 2" — Simulate Engine. True MCTS tree search: multi-round iteration, UCB node selection/expansion, backpropagation value update. Each solution's execution path is modeled as a tree, gradually converging to optimal decision through multiple simulations.
---

# Step 2: MCTS Tree Search Simulation (Core Mechanism) — Multi-Layer Scrutable Reasoning

> **🔒 COMPRESSION-SAFE RULES (Always apply, even if context is compressed):**
> 1. **OUTPUT LANGUAGE**: User language already detected. Continue using that language.
> 2. **MCTS PHASES**: Selection → Expansion → Simulation → Backpropagation. Each round visible to user.
> 3. **KNOWLEDGE ACQUISITION (3-SOURCE PROTOCOL)**: When simulation roll-out hits an information gap:
>    ① DIVERGE HANDOFF: Check info passed from diverge engine (8-facet recon, user grill, detail check). Use it first — don't re-ask what's already known.
>    ② MEMORY ENGINE: Query knowledge graph (knowledge_lifecycle.js) → any past similar patterns? User preferences? Success/failure history?
>    ③ WEB SEARCH: Quick web search — industry standard? known pitfalls? deprecated?
>    ④ ASK USER: Only if ①②③ all fail AND the question is about user constraints/preferences/context (not technical trivia).
>    ⑤ ASSUME: Last resort. Mark as assumption, +0.1 variance penalty.
>    **NEVER jump to asking user without exhausting memory and web first. NEVER ask technical questions the user wouldn't know.**
>    **⛔ VERIFY**: Run `node scripts/mcts_guard.js info-gap-guard --log '<JSON>'` to check acquisition order compliance.
> 4. **CONVERGENCE**: Stop when best solution V stable for 3 rounds OR max iterations reached.
> 5. **MULTI-LAYER REASONING (NEW)**: Each solution MUST be simulated at THREE reasoning layers (see §Multi-Layer Simulation). Single-pass simulation is DEPRECATED.

> ⚠️ **OUTPUT LANGUAGE RULE (HIGHEST PRIORITY)**: All user-facing output MUST be in the user's detected language. Internal reasoning is English; user sees their language.

> **One-liner**: Each candidate solution's execution path is modeled as a tree. Through multiple rounds of "Selection→Expansion→Simulation→Backpropagation→Knowledge Update" iteration, gradually converge.

---

## Multi-Layer Simulation (NEW)

Each solution undergoes 3 layers of reasoning during MCTS simulation, not just one pass.

```
Layer 1 — Feasibility
  "Given current conditions, is this solution viable?"
  → Use 8-facet Scorecard F1/F2/F6/F7 as prior
  → Simulate golden path
  → Output: basic feasibility V_feasibility

Layer 2 — Counterfactual
  "If key assumptions fail, what happens?"
  → Run if-then counterfactual for each key assumption
  → Check at least 3 counterfactuals (from Scorecard F3/F5 low scores)
  → Output: robustness V_robustness

Layer 3 — Perspective Cross-Validation
  "从不同的文化视角看这个方案，有什么新发现？"
  → Select 2-3 perspective findings most relevant
  → Re-examine through perspective questions
  → Output: perspective cross-score V_perspective

Final solution scoring:
  V_final = α × V_feasibility + β × V_robustness + γ × V_perspective
  Default weights: alpha=0.5, beta=0.3, gamma=0.2 (adjustable)
```

---## Core Concept

```
Root
 ├── SolutionA-Step1-Success (n=3, V=0.93) ← Referenced K005 experience
 │    ├── Step2-PathA (n=2, V=0.80)
 │    └── Step2-PathB (n=1, V=0.90) ← Later discovered better branch
 └── SolutionA-Step1-Failure (n=1, V=0.00) ← Explored failure path
      └── Fallback Solution (n=1, V=0.60)

Each iteration: Selection(UCB+KBonus) → Expansion → Simulation → Backprop → KnowledgeUpdate
```

---

## MCTS Four Phases Detailed

### Phase Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                  MCTS Tree Search — One Iteration               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ① SELECTION                                                   │
│     From Root, use UCB to select optimal child node at each    │
│     layer, until reaching a leaf node                          │
│     UCB(node) = V_node + c × √(ln(N_parent) / n_node)          │
│                                                                 │
│  ② EXPANSION                                                   │
│     At the reached leaf node, expand a new child node          │
│     Child node = next possible direction (success path,        │
│                  failure path, fallback solution, etc.)        │
│                                                                 │
│  ③ SIMULATION                                                  │
│     Quick roll-out from new node to termination                │
│     Get final value V_leaf for this path                       │
│                                                                 │
│  ④ BACKPROPAGATION                                             │
│     Propagate V_leaf backward along path, update each ancestor │
│     node's w, n, V                                              │
│     n_new = n_old + 1                                          │
│     V_new = V_old + (V_leaf - V_old) / n_new                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Tree Node Structure

Each node stores the following information (modeling Go MCTS node state):

```
Node = {
    id: "SolutionA-Step1-Success",
    description: "Extend access token middleware based on gin-jwt",
    parent: "SolutionA-Root",           // Parent node
    children: ["node_id1", ...],        // Child node list
    
    // MCTS Statistics
    n: 0,                               // Visit count
    w: 0.0,                             // Accumulated value (sum of all simulations)
    V: 0.0,                             // Average value = w / n
    σ²: 0.0,                            // Value variance
    
    // Node Attributes
    node_type: "ACTION",                // ACTION | RISK | FALLBACK | TERMINAL
    is_terminal: false,                 // Is termination node (execution complete)
    expansion_potential: "HIGH",        // How many more directions can be expanded
                                        // HIGH | MED | LOW | NONE
}
```

---

## ① SELECTION — UCB-Driven Path Selection (with Knowledge Graph Bias)

### Core Formula

```
UCB = V + c×√(ln(N_parent)/n_child) + K_bonus, c=√2≈1.414, n_child=0→UCB=+∞
Numerical calculation: `node scripts/mcts_compute.js ucb --v <V> --n <n> --parent-n <N> --k-bonus <K>`
```

### Knowledge Graph Bias K_bonus

```
K_bonus: `node scripts/mcts_compute.js k-bonus --status <status> --n <n> --q <q> --n-child <n>`
CONFIRMED+n≥5+q≥0.8→+0.15 | PROVISIONAL+n<5+q≥0.7→+0.05 | DISPUTED/REFUTED/q<0.5→-0.10
Only effective when n_child<3
```

### Special Handling for First Iteration

```
Round 1 iteration (all nodes n=0):
  All child nodes have initial UCB = +∞ (all considered unexplored)
  
  At this point, don't rely on UCB sorting. Use knowledge graph for
  "initial sorting" instead:
  1. Query knowledge graph, check each solution's "recommendation score"
     (weighted average V from historically similar scenarios)
  2. Sort by recommendation score, explore highest-scored solution first
  3. If knowledge graph has no data → Randomly select one solution for
     first round
  
  After first round, UCB drives from second round onward:
    "Knowledge graph helped us choose the first round's direction,
     then let MCTS's own explore-exploit mechanism drive decisions"
```

### Selection Execution Rules

```
Select downward from Root until reaching an "expandable" node:

Step 1: Start from Root
  current = Root

Step 2: While current is not a leaf node and has children:
  ┌─ If current still has unexpanded potential directions:
  │   → Stop Selection, enter Expansion
  ├─ If all current child nodes have been explored:
  │   → Select child node with highest UCB
  │   → current = that child node
  └─ If current is a termination node:
      → Stop Selection (already reached endpoint)

Step 3: When reaching an expandable node:
  → Output selection_path: [Root, Node_a, Node_b, ..., current]
  → Enter Expansion
```

> UCB numerical calculation: `node scripts/mcts_compute.js ucb --v 0.8 --n 3 --parent-n 10`

---

## ② EXPANSION — Expand New Branch

### Expansion Rules

At the node reached by Selection, expand a new child node (next possible direction).

```
Expansion Direction = Next possible direction from current node:

ACTION node expansion directions:
  1. Success path: "First step succeeded as expected, entering second step"
  2. Partial success: "First step mostly succeeded, but has a small issue
                        needing fix"
  3. Obstacle encountered: "First step hit technical obstacle, need to
                            adjust solution"

RISK node expansion directions:
  1. Risk avoided successfully: "Fallback solution took effect, bypassed risk"
  2. Risk occurred: "Risk actually happened, need to handle consequences"
  3. Risk misjudged: "This risk actually doesn't exist / has minimal impact"

FALLBACK node expansion directions:
  1. Fallback worked: "Switched to fallback solution, continuing execution"
  2. Fallback failed: "Fallback solution also failed, need to rollback"
  3. Abandon current path: "This path doesn't work, go back one level
                            and re-choose"

TERMINAL node:
  → No further expansion (already at endpoint)
```

### Dynamic Adjustment of Expansion Timing

```
Decide expansion depth based on node's expansion_potential:

expansion_potential = HIGH:
  → Expand 2~3 new child nodes (this node has many unexplored directions)

expansion_potential = MED:
  → Expand 1 new child node

expansion_potential = LOW:
  → Expand 1 "quick check" child node (simplified direction verification)

expansion_potential = NONE:
  → This node exhausted all directions, no further expansion
```

---

## ③ SIMULATION — Quick Roll-out to End

### Difference from Old Step1→Step2→Step3

```
Old: Complete 3-step causal chain simulation for entire solution
     (heavy, slow, one-time)
New: Quick roll-out from newly expanded node to end
     (light, fast, repeatable multiple times)

Key Differences:
  - Old one simulation = complete causal chain from root to end
  - New one simulation = quick roll-out from current node to end
  - New multiple simulations complement each other → more accurate value estimate
```

### Simulation Rules

```
Quick roll-out from the new node created by Expansion to endpoint:

Simulation Steps:
  1. Identify current node state: What position? What info is known?
  2. Look one step ahead: From this position, what's most likely to happen next?
     → If this step needs knowledge (technical details, best practices,
                                      user preferences, etc.)
     → Execute "Knowledge Acquisition Priority Decision Tree" (see below)
  3. Continue forward: What about the next step?
  4. Until endpoint: Reach TERMINAL (execution complete/failure determined/
                                        need rollback)

Simulation Depth Control:
  - Simple tasks: 1~2 steps to end
  - Medium tasks: 2~3 steps to end
  - Complex tasks: 3~4 steps to end

### ⚠️ Recursive Divergence Depth Control (Code-enforced, not prompt)

When encountering new decision points during Simulation roll-out
("There are two choices here again"), **must go through code guard check**,
cannot rely on LLM's own judgment.

```
Code Guard Flow (execute each time a sub-decision point is encountered):

  Step 1: Determine decision type
    `node scripts/mcts_compute.js needs-sub-diverge --type <tech_choice|risk|user_preference|uncertainty>`
    → Only tech_choice type triggers sub-divergence,
      other types go through knowledge decision tree or ask user

  Step 2: Check recursion depth
    `node scripts/mcts_compute.js enter-simulation`
    → Returns current depth and allowed operation mode

    depth=0: full mode (top-level, six-dimension map + multi-perspective +
                        complete simulation)
    depth=1: simplified mode (2 quick solutions, 1~2 step simulation)
    depth=2: micro_diverge mode (single-perspective quick solution,
                                 1-step simulation, variance +0.1)
    depth≥3: micro_diverge_risky mode (micro-diverge but marked high risk,
                                       variance +0.15)
    ⚠️ Each layer executes real divergence simulation, just decreasing depth
       and perspectives, no assumptions

  Step 3: If sub-divergence allowed
    `node scripts/mcts_compute.js begin-sub-diverge` → depth+1
    ... Execute simplified divergence (no six-dimension map, 2 perspectives,
        1-step simulation) ...
    `node scripts/mcts_compute.js end-sub-diverge` → depth-1

  Step 4: Synthesize results
    `node scripts/mcts_compute.js synthesize-sim --base-v <V> --sub-results '<JSON>'`
    → Sub-divergence results weight 0.2 (unreliable),
      base simulation weight 0.8

  Safety Valve:
    `export MCTS_MAX_DIVERGE_DEPTH=3` (environment variable hard limit, default 3)
    Exceeding hard limit: Throw RecursionError, force terminate
```

### Recursive Depth State Query

Anytime you can query current state:
  `node scripts/mcts_compute.js diverge-depth`
  → Returns {"depth":1,"max_depth":2,"status":"simplified","can_diverge":true}

Reset after entire MCTS search ends:
  `node scripts/mcts_compute.js reset-depth`

Simulation Output:
  V_leaf = Final value of simulation path (0.0 ~ 1.0)
  + Brief reason
  + Knowledge acquisition record: [what knowledge used, from which source]

Simulation doesn't modify tree structure:
  - Intermediate nodes on simulation path are not added to tree
    (unless subsequent Expansion creates them)
  - Only backpropagation updates existing nodes' statistics
```

### ⭐ Knowledge Acquisition Priority Decision Tree (Simulation Core Rule)

During roll-out, each step forward, if **discovering need for certain knowledge to continue**, acquire by following priority:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Knowledge Acquisition Priority Decision Tree (must execute in order,       │
│                                                cannot skip)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Roll-out reaches a step, discovers need for knowledge X                    │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────┐                                        │
│  │ ① Already in memory?            │  ← Query knowledge graph (td-learner)  │
│  │   Query: Knowledge graph +      │                                        │
│  │          current session memory │                                        │
│  └──────────┬──────────────────────┘                                        │
│             │                                                               │
│     ┌───────┴───────┐                                                       │
│     │ Yes           │ No                                                    │
│     ▼               ▼                                                       │
│  ┌──────────────┐ ┌──────────────────────────────────────┐                   │
│  │ Evaluate     │ │ ② Can it be self-learned?            │                   │
│  │ credibility: │ │   Technical details/API usage/best   │                   │
│  │ HIGH → use   │ │   practices                          │                   │
│  │   directly   │ │   → Check project code/tech docs/    │                   │
│  │ MED  → use   │ │     WebSearch                        │                   │
│  │   but mark   │ │   Can self-learn → acquire and       │                   │
│  │   "pending   │ │     continue roll-out                │                   │
│  │   verification│ │   Mark: "self-learned: [source]"    │                   │
│  │ LOW  → use   │ └────────────────┬─────────────────────┘                   │
│  │   with lower │                  │                                         │
│  │   weight     │          ┌───────┴───────┐                                 │
│  └──────────────┘          │ Can           │ Cannot                          │
│                            ▼               ▼                                 │
│                        Continue      ┌──────────────────────────────┐         │
│                        roll-out      │ ③ Is it requirement/         │         │
│                                      │    preference uncertainty?   │         │
│                                      │   "What does user want?"     │         │
│                                      │   "What are constraints?"    │         │
│                                      │   "What trade-offs accepted?"│         │
│                                      └──────────────┬───────────────┘         │
│                                                    │                         │
│                                            ┌───────┴───────┐                 │
│                                            │ Yes           │ No              │
│                                            ▼               ▼                 │
│                                     ┌──────────────┐ ┌──────────────┐        │
│                                     │ Pause        │ │ ④ Mark as    │        │
│                                     │ roll-out     │ │ assumption    │        │
│                                     │ Record       │ │ Continue      │        │
│                                     │ question     │ │ roll-out      │        │
│                                     │ Collect and  │ │ After roll-out│        │
│                                     │ ask user     │ │ annotate:     │        │
│                                     │ Don't block  │ │ "Assume:XXX"  │        │
│                                     │ other        │ │ Variance +0.1 │        │
│                                     │ solutions'   │ └──────────────┘        │
│                                     │ roll-out     │                         │
│                                     └──────────────┘                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Specific Rules for Each Priority

```
① Memory First (Query knowledge graph + current session)

  Query Scope:
    - Active entries in knowledge graph (CONFIRMED/PROVISIONAL/HYPOTHESIS)
    - Info already obtained in current session (previously asked user,
      previously queried)
    - Already completed entries in global completion box (G001, G002, ...)

  Credibility Evaluation:
    CONFIRMED + n≥5 + σ²<0.05: HIGH → Use directly, don't question
    PROVISIONAL + n<5: MED → Use but mark "pending verification"
    HYPOTHESIS + n=1: LOW → Use but declare "new knowledge, reference only"
    DISPUTED/REFUTED: Don't use

  If in memory but low credibility:
    → Still use (reduce variance), but also annotate in simulation report
    → After simulation completes, if knowledge verified accurate →
        consolidation score +1

② Self-learn First (Check code/docs/search)

  Self-learnable content:
    - Technical details: "What are this API's parameters?" → Check code/docs
    - Best practices: "What's the standard approach for this scenario?"
                       → Search tech docs
    - Framework features: "Does this framework support XX?" → Check official docs
    - Error messages: "What does this error mean?" → Search

  Non-self-learnable content:
    - User preferences: "Does user want simple or complete?" → Must ask user
    - Constraints: "Can new dependencies be introduced?" → Must ask user
    - Business rules: "What are this field's validation rules?" → Must ask user

  Self-learning Requirements:
    - At least 2 independent sources cross-validated
    - If 2 sources conflict → Mark "controversial technical point",
                               lower confidence
    - If only 1 source → Mark "single source, use cautiously"
    - If cannot find → Downgrade to ③ or ④

③ Ask User (requirement/preference/constraint uncertain)

  Trigger conditions (ask if any is satisfied):
    - Involves user preference ("Which do you prefer?")
    - Involves project constraint ("Can XX be used?")
    - Involves business rule ("What is this field's format?")
    - Self-learn path fails (cannot find resources)

  Question Rules:
    - Maximum 2 questions at a time
    - Record questions, don't block other solutions' roll-out
    - Collect into Simulate Engine's "pending questions" list
    - Display to user uniformly when simulation ends

④ Make Assumption (last resort)

  Trigger conditions:
    - Not a requirement/preference/constraint question (doesn't need user)
    - Self-learn also fails (tech too new/docs incomplete/internal implementation)
    - But roll-out must continue (can't get stuck here)

  Assumption Rules:
    - Must annotate "Assumption: XXX"
    - Variance +0.1 (because this is uncertain)
    - List all assumptions in simulation report
    - Focus on checking these assumptions during pre-execution self-check
```

---

## ④ BACKPROPAGATION — Value Backpropagation

### Core Formula

```
Backpropagation: `node scripts/mcts_compute.js` backpropagate_path
Each ancestor node: n+=1, w+=V_leaf, V=w/n, Welford online update σ²
```

### Backpropagation Effect

```
After one simulation:

Simulated: SolutionA → Step1-Success → Step2-PathB (previously unexplored)
Simulation result: V_leaf = 0.85

Backpropagation:
  SolutionA-Step2-PathB: n=1, V=0.85 ← New node, initial value
  SolutionA-Step1-Success: n: 3→4, V: 0.93→0.91 ← Pulled down slightly
  SolutionA-Root: n: 4→5, V: 0.82→0.83 ← Slightly increased

Next round Selection:
  SolutionA-Step2-PathB's UCB is high (n=1, V=0.85) → May be selected again
                                              for verification
  SolutionA-Step1-Success's V pulled down → UCB decreased → Other child nodes
                                            get more exploration opportunities
```

---

## ⑤ KNOWLEDGE UPDATE — Experience Write-back to Knowledge Graph

After each Backpropagation completes, **optionally** write this round's experience to knowledge graph. This is the key to MCTS-TD hybrid algorithm: tree search handles short-term decisions, knowledge graph handles long-term memory.

### Pre-write Gate

Before writing, pass L-GCMS gate:
`node scripts/knowledge_lifecycle.js gate-check --experience '<JSON>' --kg '<JSON>'`
Four filters: Reusability + Information Density + Novelty + Reliability
  → store/observe/discard/merge
Gate score <0.4→discard | 0.4~0.59→temporary observe (15-day verification window)
               | ≥0.6→normal storage

### Write Timing

Write condition: `node scripts/mcts_compute.js should-write-kg --v-leaf <V> --round <N>`
V≥0.8 | V≤0.3 | Round%5==0 | After final convergence → Write to knowledge graph

Write safety check: `node scripts/mcts_compute.js check-write-safety`

### Memory Lifecycle Maintenance

Auto-execute after each task:
`node scripts/knowledge_lifecycle.js full-maintenance --kg '<JSON>' --recent-tasks '<JSON>' --context '<JSON>'`
→ GC Roots tracking → Tier re-judgment → Minor/Major GC → Archive recall →
  Error detection → Memory compaction

## Iteration Control

### Iteration Count

```
Iteration is not infinite, jointly determined by:

Hard limit: `node scripts/mcts_compute.js` get_max_iterations
  → simple=5,medium=10,complex=20,debug=8

Convergence: `node scripts/mcts_compute.js should_stop_iteration`
  ① V change <0.05 in last 3 rounds
  ② High-value nodes n≥3
  ③ Best n≥5 and σ²<0.05
  ④ User actively stops

Time Budget:
  Each iteration ~10~30 seconds (depends on node depth)
  Simple tasks total time <2 minutes
  Complex tasks total time <5 minutes
```

### Iteration Progress Display

After each iteration, output current tree state summary:

```
═══════════════════════════════════════
 MCTS Tree Search — Round 3 Iteration Complete
═══════════════════════════════════════

 This Round:
   Selection: SolutionB → Step1-Success → Step2-RiskPoint
   Expansion: Expanded "Risk Occurred" branch
   Simulation: After risk occurred, fallback activated, final V=0.45
   Backpropagation: Updated 3 nodes

 Current Tree State:
  Root (N=12)
  ├── SolutionA (n=5, V=0.84, σ²=0.03) ← Currently best
  │    ├── Step1-Success (n=3, V=0.91)
  │    └── Step1-Failure (n=2, V=0.30)  
  ├── SolutionB (n=4, V=0.76, σ²=0.08)
  │    ├── Step1-Success (n=2, V=0.82)
  │    └── Step1-Failure (n=2, V=0.52)
  └── SolutionC (n=3, V=0.62, σ²=0.15)

 Convergence Check:
  SolutionA V last 3 rounds: 0.85→0.83→0.84 (change <0.05)
  → ✅ SolutionA V estimate stabilized
═══════════════════════════════════════
```

### Final Output at Convergence

```
After iteration stops, output complete tree search results to Converge Engine:

═══════════════════════════════════════
 MCTS Tree Search Complete
═══════════════════════════════════════

 Total Iterations: 8 rounds
 Stop Reason: Best solution value estimate stabilized (SolutionA)

 Final Solution Ranking (by n-weighted V):
  SolutionA: n=5, V=0.84, σ²=0.03, Confidence=High
  SolutionB: n=4, V=0.76, σ²=0.08, Confidence=Medium
  SolutionC: n=3, V=0.62, σ²=0.15, Confidence=Low

 Inter-solution Comparison:
  SolutionA significantly better than SolutionB (+0.08, lower σ²):
    → SolutionA is optimal solution

 Search Results:
  SolutionA's best path: Step1-Success → Step2-PathA → Step3-Complete
  SolutionA's main risk: Step1-Failure (low probability but high impact,
                                      fallback available)
═══════════════════════════════════════
```

---