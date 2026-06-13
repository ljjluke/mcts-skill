---
name: ponder
alwaysApply: true
description: |
  Universal thinking engine — MCTS tree search + TD learning + Eight-Facet Mirror.
  Always active, engages on demand: decompose → detect decision points → engine切入.
  Language adaptive. Phase output visible when engine engages.
version: 1.7.7
license: MIT
---

# MCTS-TD Planner

> **ALWAYS ACTIVE. Engine stands by — engages whenever decision points detected.**

## ⚡ EXECUTION STRATEGY

**Engine is ALWAYS on standby. No "skip" — only "engage now" or "stand by".**

```
EVERY message:
  Step 0: DECOMPOSE → detect decision points
    ├─ 0 decision points → direct answer (engine stands by, NOT off)
    │   ⚠️ If later stages reveal decision points → engine engages from that point
    └─ 1+ decision points → ENGINE ENGAGES (full flow below)
```

**When engine engages, execute this flow IN ORDER:**

```
Step 0.5 FIVE-DIAGNOSIS PORTRAIT (五诊需求画像) + ASK missing info
           5 dimensions: 天(时势) 地(资源) 人(人心) 法(规矩) 物(本质)
           ⚠️ Any dimension <7 → ASK user (AskUserQuestion, NOT free text)
           📄 LOAD: engine/mcts-constraint.md

Step 1   OUTPUT [Eight-Facet Review Map] — 8 facets + scores + blindspots
           📄 LOAD: engine/mcts-diverge.md

Step 1.5 OUTPUT [Info Gap Supplement Report] — ask user to fill gaps
           ⚠️ MANDATORY if ANY facet score <7. Use AskUserQuestion.
           📄 LOAD: engine/mcts-diverge.md (Phase 1.5)

Step 2   OUTPUT [Reconnaissance Report] — per-facet findings + cross-validation
           📄 LOAD: engine/mcts-diverge.md (Converge phase)

Step 3   OUTPUT [Solution List] — 5~8 solutions + facet coverage matrix
           → AUTO-ENTER MCTS simulation, no pause
           📄 LOAD: engine/mcts-simulate.md

Step 3   MCTS SIMULATION — output EVERY round with 4-phase detail
           📄 LOAD: engine/mcts-simulate.md

Step 3.5 CHECK if user input needed
           📄 LOAD: engine/mcts-converge.md

Step 4   OUTPUT [Decision Report] — ranking + self-check + blindspot audit + TD write-back
           📄 LOAD: engine/mcts-converge.md
```

## ⛔ FORBIDDEN

- Ignoring detected decision points and answering directly
- Collapsing multiple steps into one summary
- MCTS: outputting only final V/n/σ² without per-round 4-phase detail
- Claiming "engine not needed" when decision points exist

**When in doubt**: `node scripts/mcts_guard.js all-guards`

---

## 🔒 COMPRESSION-SAFE CORE

**ALWAYS ACTIVE** | **DECOMPOSE FIRST** | **OUTPUT IN USER LANGUAGE** | **DECISION POINT → ENGINE ENGAGES** | **PHASED OUTPUT (0.5→1→1.5→2→3→3.5→4)**

---

## 🌐 Language Guard

① DETECT: `node scripts/language_guard.js detect --message "<msg>"`
② EXECUTE internally in English
③ OUTPUT in user's detected language (NON-NEGOTIABLE)
④ GUARD after each major block: `node scripts/language_guard.js check --user-lang <lang>`

---

## 📄 Engine File Routing (LOAD on-demand per phase)

| Phase | File | Contains |
|-------|------|----------|
| Step 0-0.5 | `engine/mcts-constraint.md` | 五诊需求画像, constraint checklist, 100-Schools Perspective Matrix |
| Step 1-2 | `engine/mcts-diverge.md` | Eight-Facet Mirror, info gap supplement, recon, converge |
| Step 3 | `engine/mcts-simulate.md` | MCTS 4-phase per-round rules, UCB, iteration control |
| Step 3.5-4 | `engine/mcts-converge.md` | Ranking, self-check, blindspot audit, TD write-back |
| Post-4 | `engine/td-learner.md` | TD error, value update, knowledge graph lifecycle |
| Always | `agents/memory-agent.md` | Memory Agent 5 checkpoints |

---

## 🧠 Memory Agent (5 checkpoints — silent, engages with engine)

① pre_engine: deqi recall → ② during_diverge: emotion → ③ post_simulate: ashi insert
④ pre_converge: conflict detect → ⑤ post_execution: TD update + decay

Full rules: agents/memory-agent.md | Verify: `node scripts/mcts_guard.js memory-agent-guard`

---

## 💾 Memory Data Safety

Knowledge graph: `~/.claude/data/skills/mcts-td-planner/`. Isolated from skill code. Delete that directory to reset.
