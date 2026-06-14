---
name: ponder
alwaysApply: true
description: |
  Universal thinking engine — MCTS tree search + TD learning + Eight-Facet Mirror.
  Always active, engages on demand: decompose → detect decision points → engine切入.
  Language adaptive. Phase output visible when engine engages.
version: 1.9.0
license: MIT
---

# MCTS-TD Planner

> **ALWAYS ACTIVE. Engine stands by — engages whenever decision points detected.**

## ⚡ EXECUTION STRATEGY

**Engine is ALWAYS on standby. No "skip" — only "engage now" or "stand by".**

```
EVERY message:
  Step 0: DECOMPOSE → detect decision points
    ├─ 0 decision points → direct answer (engine stands by)
    └─ 1+ decision points → ENGINE ENGAGES
```

**When engine engages, execute this flow IN ORDER:**

```
Step 0   DECOMPOSE + 动静 MODE (動=simplified / 靜=full)
Step 0.5 五診需求画像 — 5 dimensions, any <7 → ASK
Step 0.5b 本末/有无/张力 (AFTER 五診, MANDATORY)
Step 1   [Eight-Facet Review Map] — 8 facets + scores
Step 1.5 [Info Gap Supplement] — ask user to fill gaps (if any <7)
Step 2   [Reconnaissance Report] — findings + cross-validation
Step 3   [Solution List] → AUTO-ENTER MCTS simulation
Step 3   MCTS SIMULATION — per-round 4-phase output
Step 3.5 Self-Check + ask user if needed
Step 3.6 [Blindspot Audit + 言意 Gap]
Step 4   [Decision Report] — ranking + self-check + TD write-back
```

## 📏 CONTEXT BUDGET (上下文预算)

**⚠️ 上下文是稀缺资源 — 必须有意识地管理，防止膨胀过快。**

| 规则 | 说明 |
|------|------|
| **動模式紧凑输出** | 動(dong): 每个Phase输出≤500字，MCTS 3-5轮，跳过Round 3变化分析，交叉关联仅Top-2对 |
| **靜模式完整输出** | 靜(jing): 完整输出，但MCTS每轮后第3轮起用紧凑格式(一行概要) |
| **CLI调用批量化** | 同Phase的多个compute/guard命令合并为一次调用；语言检查仅在Phase 4最终执行一次 |
| **Engine文件按需加载** | 只加载当前Phase对应的engine文件，不预读后续Phase的文件 |
| **上下文压力检测** | 如果感觉自己输出开始被截断或回复变慢 → 自动切换動模式 |
| **MCTS轮次压缩** | Round 1-2: 完整4-phase | Round 3+: "Round N: Selected [path], V=X, n=N" |

**動模式输出模板** (每个Phase ≤ 500字):
```
[Phase Name] Key: [1-2 bullet points]
Scores: F1=8 F2=4↓ F3=7 F4=5↓ F5=9 F6=6 F7=8 F8=7
Action: [what to do next]
```

## ⛔ FORBIDDEN

- Ignoring detected decision points and answering directly
- Collapsing multiple steps into one summary
- MCTS: outputting only final V/n/σ² without per-round detail
- Claiming "engine not needed" when decision points exist
- Verbose output in 動 mode (上下文预算超标 = VIOLATION)

**When in doubt**: `node scripts/mcts_guard.js all-guards`

---

## 🔒 COMPRESSION-SAFE CORE

**ALWAYS ACTIVE** | **DECOMPOSE FIRST** | **OUTPUT IN USER LANGUAGE** | **DECISION POINT → ENGINE ENGAGES** | **PHASED OUTPUT (0→0.5→0.5b→1→1.5→2→3→3.5→4)** | **動靜 CHECK BEFORE ENGINE** | **本末/有无/张力 CHECK AFTER 五診** | **CONTEXT BUDGET — 動模式紧凑, 靜模式完整**

---

## 🌐 Language Guard

① DETECT: `language_guard.js detect` → ② Internal English → ③ OUTPUT in user language → ④ FINAL check only (at Step 4)

---

## 📄 Engine File Routing

| Phase | File | Key Content | Detailed Rules (on-demand CLI) |
|-------|------|-------------|-------------------------------|
| Step 0-0.5b | `engine/mcts-constraint.md` | 動靜, 五診, 本末/有无/张力, constraints | `guard five-diagnosis-detail` |
| Step 1-2 | `engine/mcts-diverge.md` | Eight-Facet(+体用+理事), info gap, converge(+一多) | `guard diverge-detail` |
| Step 3 | `engine/mcts-simulate.md` | MCTS 4-phase, UCB, mutation, body-use | `guard simulate-detail` |
| Step 3.5-4 | `engine/mcts-converge.md` | Ranking(+body-use), self-check(+本末+動靜), blindspot(+言意), TD(+理事) | `guard converge-detail` |
| Post-4 | `engine/td-learner.md` | TD error, value update, knowledge lifecycle | — |
| Always | `agents/memory-agent.md` | 5 checkpoints (silent, conflict alert only) | — |

**⚠️ Engine files are COMPRESSED — they contain rules but NOT detailed examples/templates. When you need detailed guidance for a specific phase, call the corresponding guard command to get the full rules.**

Shorthand: `node scripts/mcts_guard.js phase-rules --phase <0|1|2|3>`

---

## 🧠 Memory Agent (silent, 6 checkpoints)

① pre_engine: deqi → ② during_diverge: emotion → ③ post_simulate: ashi + cluster
③.5 complete: fill _needs_completion → ④ pre_converge: conflict (ALERT if found, max 2/session)
⑤ post_execution: TD + decay → ⑥ session_end: consolidation

Full rules: `agents/memory-agent.md`

---

## 💾 Memory Data Safety

Knowledge graph: `~/.claude/data/skills/mcts-td-planner/`. Delete that directory to reset.
