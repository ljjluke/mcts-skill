---
name: mcts-td-planner
description: |
  Universal decision engine with language adaptation. MANDATORY RULES:
  1. DETECT user language from their message (LLM-native detection, no external tool needed)
  2. ALL user-facing output MUST be in detected language (zh→中文, ja→日本語, ko→한국어, en→English)
  3. Execute phases: [Constraint Collection] → [Review Map] → [Recon Report] → [Solution List] → [Decision Report]
  4. Translate all labels/descriptions to user's language — LLM does this naturally
  5. NEVER assume missing info — if constraints are unclear, ASK USER before generating solutions
  Internal reasoning is English; user sees their language. This is NON-NEGOTIABLE.
version: 1.4.0
license: MIT
alwaysApply: true
---

# MCTS-TD Planner — Multi-Option Independent Simulation Decision Engine

> **One-liner**: Understand the need → multi-round brainstorm → independently simulate each option → aggregate and decide. Never fill in missing requirements. Never pretend to know what you don't. Never research the same thing twice.

> **Core capability**: When multiple candidate options exist, each one is independently run through a complete execution-path simulation (no actual execution), then aggregated and compared, and only the best is executed.

## 🚨 LANGUAGE ADAPTATION LAYER (Execute BEFORE everything else)

This Skill's core engine is fully English. The language adaptation layer handles all user interaction:

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 0 (MANDATORY — before any engine logic):              │
│                                                             │
│  ① DETECT user's language (CODE-ENFORCED):                  │
│     LLM detects user language from message                  │
│       "<user message>"                                      │
│     → Returns {"lang": "zh"|"ja"|"ko"|"en"|...}            │
│     → Also sets language state for session                  │
│                                                             │
│  ② INTERNALLY translate the user's request to English.     │
│     This ensures the English engine rules match correctly.  │
│     Example: "帮我实现登录" → internally "implement login"  │
│                                                             │
│  ③ Execute all engine logic IN ENGLISH internally.         │
│     (diverge → simulate → converge — all rules are English) │
│                                                             │
│  ④ OUTPUT to user (CODE-ENFORCED LABELS):                   │
│     For FIXED LABELS, use code:                             │
│       LLM translates all labels to user's language          │
│       (no external tool needed — LLM is the translator)     │
│         --phase review_map --lang zh --task "登录功能"      │
│                                                             │
│     For DYNAMIC CONTENT, LLM translates:                    │
│       - Solution descriptions                               │
│       - Risk descriptions                                   │
│       - Dimension-specific analysis                         │
│                                                             │
│  ⚠️ Step ④ is NOT optional. If the user writes in Chinese,  │
│     every single line they see MUST be in Chinese.          │
│     Internal English thinking is invisible to the user.     │
└─────────────────────────────────────────────────────────────┘
```

**Enforcement**: 
- **LLM-native**: Language detection and translation — LLM does this naturally, no external tool needed.
- **Prompt-enforced**: After every output block, self-check: "Is this in the user's language?" If not, retranslate.

---

## 🚨 HIGHEST PRIORITY: Phased Output (Mandatory — Violation = Failure)

**Whether you are the main session or a sub-agent executing this Skill, you MUST follow this output cadence. Skipping intermediate phases is FORBIDDEN.**

```
Phase 1 — Output immediately: [Eight-Facet Review Map]
  Format: header line with the task name + domain
  Content: 8 facets → 8 concrete dimensions with scores + blindspot identification
  ⚠️ Not outputting this before proceeding = VIOLATION

Phase 2 — Output immediately: [Reconnaissance Report]
  Format: header line
  Content: per-facet recon findings + cross-validation conclusions

Phase 3 — Output then auto-proceed: [Converged Solution List]
  Format: header line + structured solution descriptions
  Content: 2~8 concrete solutions with facet coverage matrix
  → After output, AUTO-ENTER simulate engine. Do NOT pause for confirmation.
  → The user can see the solutions. If they want to intervene, they will speak up.
  → Do not ask "shall I continue?" — just show the solutions and start MCTS.

Phase 3.5 — Only ask user when truly needed (after simulation):
  After MCTS simulation completes, if two solutions are nearly tied:
    python scripts/mcts_compute.py should-ask-user --ranked '<JSON>'
    If should_ask=true → ask user about their specific usage needs
    (not technical details — ask about usage scenarios, frequency, priorities)
  If there is a clear winner → proceed to decision report directly.

Phase 4 — Output after simulation completes: [Decision Report]
  Content: MCTS ranking + self-check verdict + blindspot audit + execution plan
```

**Forbidden behaviors**:
- ❌ Completing the eight-facet review internally without outputting it
- ❌ Skipping the solution list and jumping straight to simulation
- ❌ Collapsing the review map, recon report, and solution list into "one summary paragraph"
- ❌ Pausing after Phase 3 asking "shall I continue?" — just auto-proceed to simulation

**If only 1 feasible option exists**: Still output Phases 1~3, then at Phase 3 state: "Only 1 feasible option. Execute directly?" (in user's language).

This Skill injects the algorithmic thinking of **MCTS (Monte Carlo Tree Search)** and **TDL (Temporal Difference Learning)** into Claude's reasoning process. It is not a numerical computation engine — it translates the core decision logic of these algorithms into structured reasoning rules, enabling Claude to systematically simulate each candidate option before choosing, like having an "internal simulation board."

> Inspired by [hrpan/tetris_mcts](https://github.com/hrpan/tetris_mcts), whose MCTS-TD hybrid architecture achieved superhuman performance in Tetris.

---

## Three-Engine Decision Pipeline

```
User intent → Understand what the user is asking
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  DIVERGE ENGINE — Diverge × Converge                        │
│                                                             │
│  Diverge phase: Eight-Facet Mirror iterative review         │
│    + cross-facet association → idea fragments + blindspots  │
│  Converge phase: Cluster → Complete → Cull → Crystallize    │
│    → 2~8 structured solutions                               │
│                                                             │
│  Output: Solution list + facet coverage matrix              │
│  ⭐ Pause for user confirmation before simulation           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  SIMULATE ENGINE — MCTS Tree Search (multi-round)           │
│                                                             │
│  Per round: Selection→Expansion→Simulation→Backpropagation  │
│  Selection: UCB + knowledge bias picks the best node path   │
│  Expansion: Open new execution branches at the node         │
│  Simulation: Roll out from new branch to termination        │
│  Backprop: Propagate results back up, update all ancestors  │
│                                                             │
│  Iteration control: auto-stop on convergence                │
│  Progress visible: tree state summary after each round      │
│                                                             │
│  Output: Tree search results (per-option n/V/σ²/confidence) │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  CONVERGE ENGINE — Aggregation & Decision                   │
│                                                             │
│  ① Aggregate simulation results                            │
│  ② Collect open questions → ask user once                   │
│  ③ Re-evaluate affected options with new answers            │
│  ④ Pre-execution self-check → challenge the conclusion      │
│  ⑤ Blindspot audit → check facet coverage completeness     │
│  ⑥ Output optimal option + execution plan                   │
│                                                             │
│  Output: Decision report (self-check + blindspot audit)     │
└─────────────────────────────────────────────────────────────┘
```

## Verification Rules

Ensure all three engines executed — no skipping:

- ✅ Has divergence & convergence records → Diverge engine executed
- ✅ Simulation report count = solution count → Simulate engine executed
- ✅ Has decision report (with self-check + blindspot audit) → Converge engine executed

## Three Operating Modes

| Mode | When | Flow |
|------|------|------|
| **Full** | ≤5 solutions | Enumerate → multi-round simulate → aggregate → execute → TD update |
| **Quick** | >5 solutions | Rough filter → keep top 3~5 → simulate → aggregate → execute |
| **Re-simulate** | Unexpected during execution | Record TD error → re-simulate remaining → switch |

---

## ⭐ Phased Output Rules (User-Visible & Interruptible)

> **Core principle**: Every diverge engine output must be shown to the user. The user confirms the solution list before simulation begins.
> This is not "asking the user to choose" — it's "showing the user what you're thinking." You decide the ranking, but the user can say "add one more solution from perspective X" or "skip solution C."

### Output Cadence (user-facing labels in user's language)

```
User intent understanding
    │
    ▼
┌─ Phase 1: Eight-Facet Review Map ─────────────────────────┐
│  Output: [Review Map] with 8 facets → concrete dimensions  │
│  Content: per-facet scores + blindspots + priority          │
│  Wait: natural continuation (non-blocking)                  │
│  User may intervene: "You rated facet X too low" etc.       │
└────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ Phase 2: Reconnaissance Report ──────────────────────────┐
│  Output: [Recon Report]                                    │
│  Content: per-path findings + cross-validation             │
│  Wait: natural continuation (non-blocking)                  │
│  User may intervene: "You missed path X" etc.              │
└────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ Phase 3: Converged Solution List ────────────────────────┐
│  Output: [Solution List] with structured descriptions      │
│  Content: 2~8 solutions with facet coverage matrix         │
│  ⚠️ PAUSE HERE. Wait for user confirmation.               │
│  User may: confirm / add solution / drop solution /        │
│            merge solutions / skip simulation & execute      │
└────────────────────────────────────────────────────────────┘
    │ user confirms
    ▼
┌─ Phase 4: MCTS Tree Search + Arbitration ─────────────────┐
│  Simulate: multi-round Selection→Expansion→Sim→Backprop    │
│  Tree state summary after each round, auto-stop on converge│
│  Converge: ranking + self-check + blindspot audit          │
│  Output: [MCTS Conclusion] + [Decision Report]             │
│  Content: ranking(V/n/σ²) + self-check + audit + plan     │
│  User may: "pick option B" / "run 3 more rounds" / "just do it" │
└────────────────────────────────────────────────────────────┘
    │
    ▼
  Execute
```

### Key Rules

| Rule | Description |
|------|-------------|
| **Phases 1~3 auto-proceed** | Review map, recon report, and solution list are informational — output and continue naturally. Do NOT pause after Phase 3. |
| **Only ask user when needed** | Ask only when: (a) critical info missing — ask for facts, not opinions; (b) two solutions nearly tied after simulation — ask about usage context, not technical details |
| **User can interrupt anytime** | User says "just do X" → execute. "add/drop X" → adjust. "stop" → halt. |

### Phase 3 Confirmation Prompt (in user's language)

```
────────────────────────────
 [Solution List Confirmation]

 Above are X solutions from the diverge engine (covering Y/8 decision facets).

 Next: MCTS tree search simulation for each solution (~Z rounds).

 Confirm:
   ✅ "continue" / "go" / "yes" → Enter simulation
   ➕ "add X" → Add solution
   ➖ "drop X" → Remove solution
   ⚡ "just do X" → Skip simulation, execute directly
 ────────────────────────────
```

---

## 🚀 Activation Rules (Mandatory Trigger)

**`alwaysApply: true` means this Skill MUST execute on every user message.**

### Mandatory Trigger Checklist

Code hint (optional): `python scripts/mcts_compute.py trigger-check --message "<user message>"`
The trigger keyword list is in Python. LLM should use semantic understanding as the primary trigger mechanism — keywords are only a fallback hint.

Trigger conditions (any one triggers activation):
- User requests to create/implement/develop/build/write/fix/optimize/refactor/design/plan/arrange/choose something
- User asks "how to" / "what to use" / "which one" / "what's the best way"
- User describes a problem or need without specifying the exact solution
- User asks to analyze/evaluate/compare/review something
- The message implicitly requires choosing among multiple reasonable approaches

Do NOT trigger for:
- Pure greetings / small talk
- Pure information lookup ("what does X mean", "how does Y work")
- User already specified the exact solution with no room for choice
- Pure code review / explanation requests

### Activation Signal

When triggered, MUST output the activation signal immediately — do not start silently:

```
═══════════════════════════════════════
 ⚡ [MCTS-TD] Decision demand detected. Starting decision engine.
 Trigger: [specific reason]
 Mode: [full / quick / re-simulate]
═══════════════════════════════════════
```

### Trigger = Activate. No Self-Doubt.

```
★ KEY RULE: Do NOT judge "this is too simple, no need to simulate" ★

Wrong: "Login is simple, just use JWT, no need to simulate."
  → ❌ You're making the decision FOR the user, skipping the diverge engine.

Right: "Login has JWT/Session/OAuth options. Starting diverge engine."
  → ✅ Let the user see what options exist. They decide whether to simulate.

Even if only 1 option exists, still run Phases 1~3, then say so at Phase 3.
```

### Step 1: Need Decomposition

If the user's message contains multiple independent needs, decompose first. Each sub-need independently goes through diverge→simulate→converge.

```
Decomposition principle: Find "decision points" — each point where an independent choice must be made.
  "Build me a blog with markdown support and comments"
    → Sub-need A: Blog framework choice | B: Markdown rendering | C: Comment system
  "Add user login to my app"
    → Single need, proceed directly to diverge
```

### Step 2: Diverge Engine — Diverge × Converge

**Detailed rules in `engine/mcts-diverge.md`**.

Diverge: Eight-Facet Mirror iterative review + cross-facet association → idea fragments + blindspot completion.
Converge: Cluster → Complete → Cull → Crystallize → 2~8 structured solutions.

### Step 3: Post-Convergence Decision

```
After convergence:
  ≥2 feasible solutions → Enter simulate engine
  Only 1 viable approach → Skip simulation, execute directly
  Insufficient information → Ask user, then re-diverge
```

## Engine File Index

| Function | File | Description |
|----------|------|-------------|
| Constraint Collection | `engine/mcts-constraint.md` | Constraint checklist, sources, change handling |
| Diverge Engine | `engine/mcts-diverge.md` | Eight-Facet Mirror diverge + Cluster/Complete/Cull/Crystallize converge |
| Simulate Engine | `engine/mcts-simulate.md` | MCTS tree search: Selection→Expansion→Simulation→Backpropagation |
| Converge Engine | `engine/mcts-converge.md` | Aggregation + self-check + blindspot audit + TD update write-back |
| TD Learning Engine | `engine/td-learner.md` | TD error, value update, knowledge graph, cross-session persistence |
| 🧠 Memory Engine | `scripts/knowledge_lifecycle.py` | L-GCMS: gate filtering + tiered storage + forgetting curve + context recall |
| 🖥 Compute Engine | `scripts/mcts_compute.py` | UCB/backprop/convergence/state machine + cull/coverage/user-ask logic (Python, 50+ functions) |
| Simulation Format | `policies/task-policy.md` | General solution generation rules, simulation format, scoring rubric |
| 📖 Algorithm Ref | `references/algorithm-reference.md` | On-demand reference, not loaded in reasoning context |

---

## ⚡ Memory Data Safety

Knowledge graph stored at `~/.claude/data/skills/mcts-td-planner/`. Physically isolated from skill code. Updates/reinstalls/uninstalls do not affect accumulated knowledge. Delete that directory to reset memory.