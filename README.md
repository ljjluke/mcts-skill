<p align="center">
  <img src="https://img.shields.io/badge/version-1.4.0-blue" alt="version">
  <img src="https://img.shields.io/badge/status-stable-green" alt="status">
  <img src="https://img.shields.io/badge/license-MIT-yellow" alt="license">
</p>

<h1 align="center">🧠 MCTS-TD Planner</h1>

<p align="center">
  <b>Think like a chess grandmaster — simulate every move in your head, then play the best one.</b><br>
  <sub>A Claude Code skill that brings MCTS (Monte Carlo Tree Search) + TD (Temporal Difference) learning to your decision-making workflow.</sub>
</p>

<br>

> 🌐 中文用户请查看 [README_CN.md](./README_CN.md)

---

## 🎯 What It Solves

### You've been here before

```
You: "Add user authentication to my app"
AI: OK → writes code immediately
You: "Uh, we can't use external dependencies..."
AI: Oh → deletes and rewrites
You: "Also, we're on MySQL only"
AI: OK → deletes and rewrites again
```

**Three rewrites in one conversation.** The problem? **It didn't ask before acting.**

### With MCTS-TD Planner

```
You: "Add user authentication to my app"
AI: ⚡ There are multiple ways to do this. Let me think first.
    → "Any constraints I should know?"
You: "No external deps. MySQL only."
AI: → OAuth2 is out. JWT vs Session are the options.
    → Simulates both approaches in my head.
    → Picks the one that fits your context best.
    → Writes it right the first time. ✅
```

**One shot, no rework.** The difference? **Think first, act second.**

---

## ✨ Why It's Different

### It thinks like a chess player

| Grandmaster at chess | You making decisions |
|---------------------|---------------------|
| Doesn't move impulsively | Doesn't jump at the first idea |
| Simulates every possible line in their head | Simulates every viable approach mentally |
| Picks the best move before touching a piece | Picks the best solution before writing code |
| Reviews lost games to improve | Learns from outcomes, gets better over time |

### Core capabilities

| Capability | What it means |
|-----------|--------------|
| **Ask before assuming** | Gathers constraints upfront — no guessing what you need |
| **Multi-branch simulation** | Runs each candidate solution through a full mental execution path |
| **Gets smarter with experience** | Cross-session knowledge graph — references past successes and failures |
| **Context-aware ranking** | Technical score is not enough — ranks by project fit, not just raw merit |
| **Persistent memory** | Knowledge survives skill updates and reinstalls |

---

## 🚀 Install

In Claude Code:

```bash
/plugin marketplace add ljjluke/mcts-skill
```

Type any task. When you see the ⚡ badge, it's working.

### ⚡ Memory Safety

The knowledge graph lives at `~/.claude/data/skills/mcts-td-planner/` — physically separate from skill code. Updates, reinstalls, and upgrades all preserve your accumulated knowledge. To reset, delete that directory.

---

## 🔧 The Three-Engine Pipeline

Every decision goes through three independent engines. Each produces a verifiable output — no skipping.

```
User intent → Understand what you're asking
       │
       ▼
┌──────────────────────────────────┐
│  DIVERGE ENGINE (brainstorm)      │
│                                   │
│  ① Six-Dimension Map: rate 0-10   │
│     on tech/arch/biz/security/    │
│     ops/ux → identify blindspots  │
│  ② Six-Path Recon: project code   │
│     + docs + competitors + user   │
│     perspective + failure cases   │
│  ③ Perspective Wheel: 4~8 of 10   │
│     perspectives, 1 solution each │
│  ④ Rough filter if >8 solutions   │
│                                   │
│  ⚠️ Output: Solution list          │
│  ⭐ Pauses for your confirmation  │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  SIMULATE ENGINE (MCTS tree)      │
│                                   │
│  Multi-round iteration:           │
│  ① Selection: UCB + knowledge     │
│     bias picks the best node path │
│  ② Expansion: open new branches   │
│  ③ Simulation: rollout to the end │
│     (with recursive depth guard   │
│      and knowledge acquisition    │
│      priority tree)               │
│  ④ Backpropagation: update all    │
│     ancestor nodes with results   │
│  ⑤ Knowledge Update: write back   │
│     to the knowledge graph         │
│                                   │
│  Stops when converged (V stable,  │
│  enough n, low σ²)                │
│                                   │
│  ⚠️ Output: Tree search results    │
│     (per-solution n/V/σ²/confidence)│
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  CONVERGE ENGINE (arbitration)    │
│                                   │
│  ① Rank by converged V            │
│  ② Self-check: find blindspots   │
│     → reverse thinking            │
│     → risk assessment             │
│  ③ Blindspot audit: perspective   │
│     coverage vs six-dim map       │
│  ④ Re-simulation if needed        │
│  ⑤ Output: decision report        │
│     (ranking + self-check +        │
│      blindspot audit + TD update) │
└──────────────────────────────────┘
```

### Verification

```
✅ Has divergence & convergence records → Diverge engine executed
✅ Simulation count = solution count    → Simulate engine executed
✅ Has decision report with self-check  → Converge engine executed
```

---

## 🧠 How It Mimics Human Memory

| Human ability | Engine simulation |
|--------------|-------------------|
| See a problem → recall related experience | Associative recall — most relevant knowledge surfaces naturally |
| Can't quite remember → try to piece it together | Fragment completion — follow clues to reconstruct the full picture |
| Still can't remember → look it up | External verification — search docs, check code, ask user |
| Realize old knowledge may be outdated | Correction mechanism — flag contradictions, don't reinforce errors |
| Old and new knowledge conflict | State machine — hypothesis→verify→confirm→dispute→refute→rollback |
| Unused knowledge fades over time | Memory decay — auto-archive unused entries after 30 days |
| Someone mentions it → suddenly remember | Recall trigger — related cues bring archived knowledge back |

---

## 📁 Project Structure

```
mcts-td-planner/
├── SKILL.md                ← Entry point (Claude Code skill definition)
├── .claude-plugin/         ← Plugin marketplace metadata
│
├── engine/                 ← Core engine rules
│   ├── mcts-constraint.md    Constraint collection (Step 0)
│   ├── mcts-diverge.md       Diverge engine (Step 1: 6D map + recon + perspective wheel)
│   ├── mcts-simulate.md      Simulate engine (Step 2: MCTS tree search)
│   ├── mcts-converge.md      Converge engine (Step 3~3.6: ranking + self-check + blindspot audit)
│   └── td-learner.md         TD learning engine + knowledge graph state machine
│
├── scripts/                ← Computational engines (Python)
│   ├── mcts_compute.py       UCB/backprop/convergence/state machine/ranking (42 functions, 19 CLI)
│   └── manage_memory.py      Knowledge graph archive/recall/cleanup
│
├── policies/               ← Decision policies
│   └── task-policy.md        General simulation format and scoring rubric
│
├── agents/                 ← Agent definitions
│   └── mcts-decider.md       Decision sub-agent behavior instructions
│
├── references/             ← Reference (on-demand, not loaded in context)
│   └── algorithm-reference.md  Algorithm principles and design decisions
│
├── memory/                 ← Cross-session persistent knowledge
│   ├── mcts-td-value-archive.md  Active knowledge graph
│   └── archive/                  Long-term archive (auto-managed)
│
├── CHANGELOG.md
├── README.md
└── README_CN.md
```

---

## 📊 Architecture

```
User Message
    │
    ▼
┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Diverge    │───▶│  Simulate        │───▶│  Converge       │
│  Engine     │    │  Engine          │    │  Engine         │
│             │    │                  │    │                 │
│  6D Map     │    │  MCTS Tree       │    │  Ranking        │
│  6 Recon    │    │  Selection(UCB)  │    │  Self-check     │
│  10 Views   │    │  Expansion       │    │  Blindspot      │
│  Solutions  │    │  Simulation      │    │  Re-sim         │
│             │    │  Backprop        │    │  TD Update      │
└─────────────┘    └────────┬─────────┘    └─────────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │  Knowledge      │
                   │  Graph          │
                   │  (td-learner)   │
                   │                 │
                   │  State Machine  │
                   │  HYPOTHESIS→    │
                   │  PROVISIONAL→   │
                   │  CONFIRMED→     │
                   │  DISPUTED→      │
                   │  REFUTED→       │
                   │  SLEEPING→      │
                   │  ARCHIVED       │
                   └─────────────────┘
```

---

## 🖥 Compute Engine

Pure numerical logic extracted from Markdown into Python (`scripts/mcts_compute.py`):

| Module | Functions | CLI Commands |
|--------|----------|-------------|
| UCB/CLT-UCB | `compute_ucb`, `compute_clt_ucb`, `select_best_child` | `ucb` |
| Backpropagation | `welford_update`, `backpropagate_path`, `gamma_backpropagate` | `welford` |
| Convergence | `check_value_stability`, `should_stop_iteration`, `check_final_convergence` | `converge`, `check-final-convergence` |
| State Machine | `check_status_transition`, `get_status_weight_full`, `handle_contradiction` | `status-transition`, `get-status-weight` |
| Scoring | `get_reward_signal`, `get_learning_rate`, `get_confidence_level` | — |
| Ranking | `rough_filter`, `rank_by_converged_v`, `handle_close_ranking` | `rank`, `rough-filter`, `needs-re-eval` |
| Knowledge Bias | `compute_k_bonus`, `should_write_to_knowledge_graph`, `check_write_safety` | `k-bonus`, `should-write-kg`, `check-write-safety` |
| Diverge Helpers | `classify_blindspot`, `get_activated_perspectives` | `classify-blindspot`, `get-activated-perspectives` |
| Recursion Guard | `enter_simulation`, `begin_sub_diverge`, `needs_sub_diverge` | `enter-simulation`, `begin-sub-diverge`, `needs-sub-diverge` |
| TD Update | `td_update_workflow`, `synthesize_simulation_result` | `synthesize-sim` |
| Trigger | `quick_trigger_check` | `trigger-check`, `get-lambda` |

---

<p align="center">
  <b>Don't just do it. Think it through first.</b><br>
  <i>— MCTS-TD Planner</i>
</p>