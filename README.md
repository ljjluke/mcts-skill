<p align="center">
  <img src="https://img.shields.io/badge/version-1.6.1-blue" alt="version">
  <img src="https://img.shields.io/badge/status-stable-green" alt="status">
  <img src="https://img.shields.io/badge/license-MIT-yellow" alt="license">
</p>

<h1 align="center">🧠 MCTS-TD Planner</h1>

<p align="center">
  <b>A Claude Code decision engine.<br>
  Uses the Eight-Facet Mirror — an ancient Chinese Taoist (八卦 Bagua) framework<br>
  for examining every problem from 8 universal perspectives — to generate all possible approaches.<br>
  Then MCTS simulates each one, picks the best, executes once.</b>
</p>

<p align="center">
  <sub>Eight-Facet Mirror (Bagua) → MCTS tree search · TD temporal learning · Human-like memory · Cross-language</sub>
</p>

<br>

> 🌐 中文用户请查看 [README_CN.md](./README_CN.md)
>
> 📺 **Demo & Examples**: [github.com/ljjluke/mcts-skill-demo](https://github.com/ljjluke/mcts-skill-demo) — real-world usage logs showing MCTS-TD in action

---

## ⚡ One Glance

```
Before: You ask → AI guesses → rewrites ×3 → frustrated
After:  You ask → AI simulates all options internally → picks the best → executes once ✅
```

> **Skip 3-5 rewrites per task. Think first, act once.**

| Pillar | What |
|--------|------|
| 🎯 **MCTS Tree Search** | Like AlphaGo — Selection → Expansion → Simulation → Backprop. Multi-round convergence on optimal path. |
| ⚖️ **Temporal Difference (TD)** | Learns from every execution. Gets smarter across sessions. |
| ☯️ **Eight-Facet Mirror** | Inspired by Taoist Bagua (八卦) — 8 universal perspectives ensure no blind spot. |
| 🗣️ **Language Adaptive** | Auto-detects the user's language — any language. English engine internally, user's language on display. |
| 🖥 **Node.js Native** | Zero extra deps. Cross-platform (Win/Mac/Linux). Runs wherever Claude Code runs. |
| 🧠 **Brain-Inspired Memory** | Episodic vs semantic memory · Reconsolidation window · Source monitoring · Elaboration depth |
| 🏥 **Eight-Principle Diagnosis** | Exterior/Interior + Cold/Heat + Deficiency/Excess → Pulse diagnosis → Weight adjustment |
| 🧠 **MMA Meridian Memory** | 12 meridians + 8 vessels + acupoint storage · Sharded storage (single shard loss = 1/16 impact) |
| 🕵️ **Memory Agent Sub-Agent** | Court Historian (records) + Remonstrance Official (alerts). 5 checkpoints, speaks only on conflict. |
| 🛡️ **9 Compliance Guards** | Anti-single-solution / Phase enforcement / Info priority / Diversity / Self-check / MemoryAgent / Compliance audit / Constraints / Engine mode |
| 🎯 **Qi-Zheng Adaptive MCTS** | Dynamic UCB explore-exploit constant (0.5~2.5) + Shi (momentum) maturity |
| ☯️ **Ganzhi + Liuyao + Feixing** | Spacetime encoding (10 stems+12 branches+60 Jiazi) · Hexagram stability · Nine Palaces Flying Stars |
| 📊 **Four Images Maturity** | Old Yang / Young Yin / Young Yang / Old Yin — knowledge health quadrant |
| 🔒 **Storage Safety** | Atomic write + dual copy + auto backup + shard crash recovery + old format migration |
| ✅ **Self-Check + Blindspot Audit** | Questions its own conclusions before executing. Finds what you missed. |
| 🔌 **Unified CLI** | `node scripts/mcts.js <engine> <cmd>` — 5 engines behind one entry point |

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

> **3 rewrites. Problem? Didn't think before acting.**

### With MCTS-TD Planner

```
You: "Add user authentication to my app"
AI: ⚡ Multiple approaches. Let me simulate first.
    → Collects constraints → Generates 3-5 solutions
    → Runs MCTS tree search on each → Picks the best
    → Writes it right the first time. ✅
```

> **One shot. Think first, act second.**

---

## ☯️ The Eight-Facet Mirror

Inspired by Taoist Bagua (八卦), the Eight-Facet Mirror ensures every decision is examined from 8 universal perspectives:

| Facet | Question |
|-------|----------|
| ☰ Source of Force | Where does the driving force come from? |
| ☷ Foundation & Capacity | What is the foundation this rests on? |
| ☳ Change & Disruption | Where might the unexpected happen? |
| ☴ Penetration & Diffusion | How does this actually reach people? |
| ☵ Risk & Abyss | Where is the deepest pit? Worst case? |
| ☲ Visible & Dependent | What's the shiny surface? What holds it up? |
| ☶ Boundary & Limit | What line cannot be crossed? |
| ☱ Convergence & Benefit | How to balance all interests? Win-win? |

> **The abstract framework never changes. The concrete dimensions are determined by the user's needs.**

---

## 🧠 MMA Meridian Memory System

Inspired by the human meridian system from the Yellow Emperor's Inner Canon (《黄帝内经》). Knowledge flows through 12 primary meridians like qi through channels. Each acupoint is a knowledge entry.

| Human ability | MMA Engine |
|--------------|------------|
| See problem → recall experience | Deqi (得气) — context resonates with acupoints, best matches emerge |
| Can't remember → piece together | Propagated Sensation (循经感传) — stimulate one point, sensation travels along meridian |
| Strong emotion → vivid memory | Emotion Modulator — fear +15, anger +10, joy +8 consolidation boost |
| Forget ≠ delete, just can't retrieve | Hidden Acupoint (隐穴) — marks hidden instead of deleting, can be awakened |
| Working memory 7±2 chunks | Triple Burner (三焦气化) — upper 7, middle session, lower historical |
| Sleep consolidates memory | Session End Replay (睡眠回放) — accelerated replay with emotion-weighted boost |
| Expert chunks patterns | Acupoint Clusters (腧穴集群) — co-occurring points auto-form knowledge chunks |
| Old knowledge outdated → correct | State machine — HYPOTHESIS→PROVISIONAL→CONFIRMED→DISPUTED→REFUTED→SLEEPING→ARCHIVED |
| **🆕 Episodic vs Semantic** | Episodic (experience) decays fast 60d / Semantic (knowledge) decays slow 90d |
| **🆕 Memory Reconsolidation** | 30-min unstable window after recall, plasticity ×1.5 during window |
| **🆕 Source Monitoring** | 7 reliability levels (firsthand 1.0→hearsay 0.2), reliable source ×1.1 weight |
| **🆕 Elaboration Depth** | 4 levels (shallow/medium/deep/deepest) → initial consolidation +0~+6 |
| **🆕 Eight-Principle Diagnosis** | Exterior/Interior + Cold/Heat + Deficiency/Excess → Pulse → Weight adjust |
| **🆕 Four Images Maturity** | Old Yang / Young Yin / Young Yang / Old Yin — knowledge health quadrant |
| **🆕 Meridian Sharding** | 16 independent meridian files, single shard loss = 1/16 impact, auto backup restore |

---

## 🔧 Three-Engine Pipeline

```
User intent → Constraint Collection
    │
    ▼
┌──────────────────────────────────┐
│  DIVERGE ENGINE                  │
│  ☯ Eight-Facet Mirror review     │
│  🔍 Six-Path Reconnaissance      │
│  🎡 Perspective Wheel (4~8)      │
│  ✂️  P0~P5 Culling (code-enforced)│
│                                  │
│  → 2~8 structured solutions      │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  SIMULATE ENGINE (MCTS Tree)     │
│  🌲 Selection: UCB + k_bonus     │
│  🌿 Expansion: open branches      │
│  🎲 Simulation: rollout to end   │
│  📈 Backpropagation: Welford σ²  │
│                                  │
│  → n / V / σ² / confidence        │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  CONVERGE ENGINE                 │
│  🏆 CLT-UCB ranking              │
│  🔍 Self-check (flaws + reverse) │
│  🕵️ Blindspot audit              │
│  💾 TD update → knowledge graph  │
│                                  │
│  → Decision report + execute     │
└──────────────────────────────────┘
```

---

## 🚀 Install

```bash
# International (GitHub)
/plugin marketplace add https://github.com/ljjluke/mcts-skill
/plugin install luke

# China (Gitee)
/plugin marketplace add https://gitee.com/luke2438107466/mcts-skill
/plugin install luke
```

## 🔄 Upgrade

```bash
/plugin marketplace update luke
/plugin install luke
/reload-plugins
```

> Old versions are auto-cleaned after upgrade — no manual cleanup needed.

Type any task. When you see the ⚡, it's working.

### ⚡ Memory Safety

Knowledge graph: `~/.claude/data/skills/mcts-td-planner/` — physically separate from skill code. Reset by deleting that directory.

---

## 🌐 Language Adaptation

| User writes | Internal engine | User sees |
|------------|----------------|-----------|
| 中文 "帮我实现登录" | English engine | 中文 "【八面审视地图】..." |
| 日本語 "ログインを実装" | English engine | 日本語 "【八面審視マップ】..." |
| 한국어 "로그인 구현" | English engine | 한국어 "【팔면심사지도】..." |

> **Fixed labels: code-enforced (Node.js). Dynamic content: LLM translates.**

---

## 📊 Architecture

**Algorithm**: MCTS (Upper Confidence Bound + Welford variance) + TD(λ) (Temporal Difference with eligibility traces). MMA (Meridian Memory Algorithm) — 12 meridians + 8 extraordinary vessels with Deqi recall.

```
User Message
    │
    ▼
┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Diverge    │───▶│  Simulate        │───▶│  Converge       │
│  Engine     │    │  Engine          │    │  Engine         │
└─────────────┘    └────────┬─────────┘    └─────────────────┘
                            │                        │
          ┌─────────────────┴────────────────────────┘
          ▼
┌─────────────────────────────────────────────────────────┐
│              🧠 Memory Agent (Silent Observer)            │
│                                                          │
│  ① PRE_ENGINE ─── deqi recall ────→ inject context       │
│  ② DURING_DIVERGE ─ perceive 七情 ─→ emotion timeline    │
│  ③ POST_SIMULATE ── ashi insert ──→ meridian acupoints   │
│  ④ PRE_CONVERGE ── Yin-Yang check → ALERT if conflict    │
│  ⑤ POST_EXECUTION ─ reinforce/drain → TD closed loop     │
│  ⑥ SESSION_END ─── sleep replay ──→ consolidate          │
│                                                          │
│  MMA Engine: 12 Meridians + 8 Extra Vessels               │
│  得气 · 子午流注 · 循经感传 · 补泻 · 阿是穴 · 隐穴        │
└─────────────────────────────────────────────────────────┘

---

<p align="center">
  <b>Don't just do it. Think it through first.</b><br>
  <i>Powered by MCTS × TD Learning × Eight-Facet Philosophy</i>
</p>
