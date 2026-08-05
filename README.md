<p align="center">
  <img src="https://img.shields.io/badge/version-1.18.52-blue?style=flat-square" alt="version">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="license">
  <img src="https://img.shields.io/badge/status-active-success?style=flat-square" alt="status">
</p>

<h1 align="center">🧠 Ponder</h1>

<p align="center">
  <b>LLMs answer. Ponder thinks. Then answers.</b><br>
  <i>Code-structured reasoning · Gets smarter with every use · Domain-agnostic</i>
</p>

<p align="center">
  <a href="README_CN.md">🇨🇳 中文</a>
  &nbsp;·&nbsp;
  <code>/luke:ponder &lt;your question&gt;</code>
</p>

<br>

---

## ✨ Every time you ask an AI, you take a gamble.

Will it nail it this time? Miss something obvious? Give you the same confident-sounding surface take it gave last time — and was wrong?

**That's not a model problem. It's a process problem.**

LLMs answer the moment you ask. Ponder doesn't. Its complete entry runs a ten-stage process: interview → premise examination → perspective expansion → blind-spot audit → solution generation → convergence → scoring → simulation → debate → synthesis. Each stage has its own thinking framework, independent evaluators, and code-enforced quality gates.

The result isn't faster answers. It's **answers you can trust**.

And every answer makes the next one better — because every run stores structured knowledge. The system remembers what worked, what didn't, and what you corrected.

---

### One glance tells the story

```
You ask a question
         ↓
┌──────────────────────────────────────────────────┐
│           Interview (5-dimension profile)         │
├──────────────────────────────────────────────────┤
│    Frame-breaking  —→  6-perspective scan        │
│         ↓                    ↓                    │
│    8-dim blindspot   →  5-10 solutions           │
│         ↓                    ↓                    │
│    8-dim scoring     →  Simulation + debate      │
│         ↓                    ↓                    │
│           User confirmation → Final               │
└──────────────────────────────────────────────────┘
         ↓
Every phase verified, every result accumulated. Next time is sharper.
```

<br>

### See the difference

![Ponder demo](assets/ponder-demo-en.gif)

*Direct LLM answer vs the same question through Ponder's complete ten-stage process.*

```
You ask → Requirement refinement → Frame-breaking → Multi-perspective scan
       → Blindspot discovery → Solution generation → 8-dimension scoring
       → Simulation → Debate under fire → User confirmation → Final output

Every step feeds back into memory. Every run makes the next one sharper.
```

### What makes it different

| Capability | Why It Matters |
|---|---|
| 🎯 **Requirement Refinement** | The first phase isn't analysis — it's making sure you're solving the right problem. Iterative, option-based questioning until the picture is clear. |
| 🌪️ **Frame-breaking** | Not "think harder." A structured 5-step cognitive process (empty the mind → focus → wander → image → connect) to force genuinely unexpected insights. |
| 👁️ **Blindspot Discovery** | 8 dimensions × independent agents systematically scan for what you didn't know you were missing. Surfaces the hidden assumptions before they become blindspots in your decision. |
| 📊 **8-Dimension Scoring** | Every proposed solution is scored across 8 orthogonal dimensions (feasibility, resilience, risk, penetration...) by independent agents. No single-point rating. |
| ⚔️ **Debate Under Fire** | Solutions don't just get compared — they get attacked. Each solution faces combined criticism from all others. The winner is the one that survives, not the one that sounds best. |
| 🧠 **Persistent Memory** | Every analysis is stored as structured knowledge. Future runs automatically recall top-3 most relevant past experiences per phase. The system gets smarter with use. |
| 🔄 **Self-Learning** | Weight registry adjusts coefficients based on real outcomes. Knowledge grooming decays unused data, promotes valuable patterns, sleeps low-quality entries. |
| 🎯 **User Confirmation** | The system doesn't push conclusions. It presents recommendations, surfaces remaining blindspots and assumptions, and asks you to confirm before finalizing. |

---

## 🏗 Architecture at a Glance

```
┌──────────────────────────────────────────────────────────────────┐
│             FULL ORCHESTRATOR (skills/ponder/SKILL.md)             │
│  The complete skill orchestrates ten stages; specialist skills      │
│  expose individual capabilities. No workflow engine is required.    │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─ Requirement Refinement ──────────────────────────────────┐   │
│  │  AskUserQuestion (one at a time) → Tian/Di/Ren/Fa/Wu      │   │
│  └───────────────────────────────────────────────────────────┘   │
│                              │                                    │
│                              ▼                                    │
│  ┌─ Analysis Sequence ───────────────────────────────────────┐   │
│  │                                                           │   │
│  │  神思 Frame-breaking      → 主线程，反直觉发现             │   │
│  │  发散 6-Perspective Scan  → 主线程，多角度审视             │   │
│  │  八卦镜 Blindspot Hunt    → 8 agents × 1 dimension        │   │
│  │  方案 Solution Generation → N agents × 1 plan             │   │
│  │  方案评分 8-D Scoring     → N agents × 8 dimensions       │   │
│  │  收敛 Convergence         → 主线程，依据评分淘汰           │   │
│  │  Simulation               → N isolated Subagents            │   │
│  │  辩论 Debate/Attack       → 立论 + 围攻 + 抗压排名         │   │
│  │  用户确认 User Confirm    → LLM推荐 + 检查遗留盲点         │   │
│  │  综合 Final Conclusion    → 完整结论+风险+建议             │   │
│  │                                                           │   │
│  │  Each phase: load top-3 history → read prompt JSON        │   │
│  │              → read engine doc → execute → display → store│   │
│  └───────────────────────────────────────────────────────────┘   │
│                              │                                    │
│                              ▼                                    │
│  ┌─ MMA MEMORY (Meridian Memory Algorithm) ──────────────────┐   │
│  │  12 primary meridians × knowledge points                  │   │
│  │  Semantic matching (CJK/EN) · Natural language storage    │   │
│  │  Knowledge grooming: decay/promote/sleep/archival         │   │
│  │  Emotional modulation · Reconsolidation window(30min)     │   │
│  │  WAL + shard locking + atomic writes                     │   │
│  └───────────────────────────────────────────────────────────┘   │
│                              │                                    │
│                              ▼                                    │
│  ┌─ UTILITY SCRIPTS (called when needed) ───────────────────┐   │
│  │  orchestrate.js  — store output, query history, finalize │   │
│  │  mcts_compute.js — math engine (UCB, hexagrams, gates)   │   │
│  │  mcts_guard.js   — compliance checkers                    │   │
│  │  clarity-check.js — quality scoring (currently disabled)  │   │
│  │  evolve.js       — offline evolution analysis            │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 💡 The Core Insight

**Most bad decisions come from blindspots, not bad reasoning.**

Ponder doesn't just think harder — it thinks **from different positions**. Each phase changes the observer's vantage point:

- **神思** changes your mental state (empty → focused → wandering)
- **发散** changes your scale (cosmic → microscopic → time-compressed → time-expanded)
- **八卦镜** changes your dimension (force → foundation → risk → boundary → balance)
- **方案评分** changes your criteria (feasibility → resilience → penetration → value)
- **辩论** changes your loyalty (defend → attack → survive)

By the end, you've seen the problem from 20+ distinct vantage points. The blindspots that survive that many angles are few.

---

## 🔄 How Memory Works

```
Each step executes → orchestrate.js step saves output to MMA
  (natural language, not JSON — semantic matching ready)

Next similar question → node skills/ponder/scripts/orchestrate.js history <phase> <type>
  → returns top-3 most relevant historical matches
  → injected into phase prompt as reference

Old data decays → unused knowledge sleeps → low quality archived
  → frequently used auto-promotes to CONFIRMED status
```

---

## 🚀 Quick Start

```bash
# Install
/plugin marketplace add https://github.com/ljjluke/ponder-skill
/plugin install luke

# Use — any domain
/luke:ponder Analyze the current market situation
/luke:ponder Help me plan my Python learning path
/luke:ponder 帮我分析这个项目的技术选型
/luke:ponder Evaluate which marketing strategy to pursue
/luke:ponder Help me decide between treatment options for a patient
# Specialist skills — invoke only the capability you need
/luke:interview Clarify the requirements for this project
/luke:explore Challenge the framing of this decision
/luke:blindspots Audit these findings for overlooked risks
/luke:solutions Generate, converge, and score viable options
/luke:simulate Stress-test these surviving options
/luke:debate Pressure-test and rank these options
/luke:synthesis Turn this completed debate into a recommendation
/luke:memory Recall relevant lessons from prior decisions
```

### Custom Data Directory

```bash
# Linux / macOS
export PONDER_DATA_DIR=/mnt/nas/my-knowledge
PONDER_DATA_DIR=/mnt/nas/my-knowledge claude

# Windows (PowerShell)
$env:PONDER_DATA_DIR = "D:\my-knowledge"
claude
```

Default: `~/.claude/data/skills/ponder/`. `PONDER_DATA_DIR` must remain outside the installed Plugin directory. The Plugin root is read-only at runtime; requested files are written to the calling project, while memory, metrics, learned weights, and evolution state are written only to this data directory.

---

## 📁 Project Structure

```
ponder-skill/
├── .claude-plugin/                  # Plugin and marketplace manifests
├── skills/                          # Nine independently discoverable Skills
│   ├── ponder/
│   │   ├── SKILL.md                 # Complete ten-stage orchestrator
│   │   ├── scripts/                 # Ponder-only persistence and evolution
│   │   └── resources/               # Immutable metadata/rule seeds
│   ├── interview/ … synthesis/      # Specialist reasoning Skills
│   └── memory/SKILL.md              # Recall, record, and outcomes
├── engine/                          # Shared read-only reasoning frameworks
├── resources/prompts/               # Shared prompt templates and schemas
├── scripts/                         # Shared runtime, guards, math, and MMA
│   ├── runtime-paths.js             # Plugin/project/data path authority
│   ├── knowledge.js                 # Durable knowledge interface
│   └── mma/                         # Knowledge storage implementation
├── hooks/
│   ├── hooks.json                   # Session lifecycle registration
│   └── scripts/                     # Hook-only implementations
├── references/                      # Algorithm and framework references
└── assets/                          # Documentation media
```

---

## 🧘 Design Philosophy

| Principle | Meaning |
|-----------|---------|
| **Visible orchestration** | `skills/ponder/SKILL.md` is the complete orchestrator; specialist skills expose bounded phases. What you read is what executes. |
| **Isolate only when necessary** | Sub-agents only for truly parallel, independent work (dimensions, plans, simulations). Everything else runs in the main thread. |
| **Code structure, not code enforcement** | Prompts guide, schemas constrain, agents specialize. No workflow engine, no pipeline runner. |
| **Domain-agnostic by design** | All dimensions, frameworks, and prompts use domain-neutral language. No assumptions about software, finance, or any vertical. |
| **Memory as a first-class citizen** | Every output persists. Every run enriches the next. Knowledge has a lifecycle: born as HYPOTHESIS, matures to CONFIRMED, decays to SLEEPING, or dies as REFUTED. |
| **Output fit for human consumption** | No JSON, no bash commands, no framework jargon in user-facing output. Tables where appropriate, narrative where better. |

---

<p align="center">
  <sub>Cognitive framework for Claude Code · Built with ❤️ · Not a prompt, a brain</sub>
</p>
