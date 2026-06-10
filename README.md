<p align="center">
  <img src="https://img.shields.io/badge/version-1.4.0-blue" alt="version">
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
| 🗣️ **Language Adaptive** | Auto-detects the user's language — any language. English engine internally, user's language on display. Works for writing systems worldwide. |
| 🖥 **Node.js Native** | Zero extra deps. Cross-platform (Win/Mac/Linux). Runs wherever Claude Code runs. |
| 🧠 **Human-like Memory** | Associative recall → fragment completion → external verification. Knowledge graph with state machine. |
| 🔒 **Compression-Safe** | Triple-layer rules (YAML + COMPRESSION-SAFE blocks + code enforcement). Survives long contexts. |
| ✅ **Self-Check + Blindspot Audit** | Questions its own conclusions before executing. Finds what you missed. |

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

## 🧠 Human-like Memory System

| Human ability | Engine simulation |
|--------------|-------------------|
| See problem → recall experience | Associative recall — most relevant surfaces naturally |
| Can't remember → piece it together | Fragment completion — follow clues to reconstruct |
| Still don't know → look it up | External verification — search docs, ask user |
| Old knowledge outdated → correct it | State machine — HYPOTHESIS→CONFIRMED→DISPUTED→REFUTED→Rollback |
| Unused → fades over time | Memory decay — auto-archive after 30 days |
| Mention → suddenly remember | Recall trigger — related cues bring archived knowledge back |

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
/plugin install mcts-td-planner

# China (Gitee)
/plugin marketplace add https://gitee.com/luke2438107466/mcts-skill
/plugin install mcts-td-planner
```

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

**Algorithm**: MCTS (Upper Confidence Bound + Welford variance) + TD(λ) (Temporal Difference with eligibility traces). Knowledge graph with state machine (HYPOTHESIS→PROVISIONAL→CONFIRMED→DISPUTED→REFUTED→Rollback).

```
User Message
    │
    ▼
┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Diverge    │───▶│  Simulate        │───▶│  Converge       │
│  Engine     │    │  Engine          │    │  Engine         │
│             │    │                  │    │                 │
│  Eight-     │    │  MCTS Tree       │    │  CLT-UCB Rank   │
│  Facet Map  │    │  UCB Selection   │    │  Self-Check     │
│  Cross-     │    │  Expansion       │    │  Blindspot      │
│  Associate  │    │  Rollout Sim     │    │  Audit          │
│  P0~P5 Cull │    │  Backpropagation │    │  TD Update      │
└─────────────┘    └────────┬─────────┘    └─────────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │  Knowledge      │
                   │  Graph          │
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

<p align="center">
  <b>Don't just do it. Think it through first.</b><br>
  <i>Powered by MCTS × TD Learning × Eight-Facet Philosophy</i>
</p>
