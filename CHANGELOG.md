# Changelog

## 1.6.1 (2026-06-14)

### Fixed
- `marketplace.json`: 移除 `$schema` 字段 — Linux Claude Code 严格 JSON schema 验证报错
- `hooks/hooks.json`: start-up 消息英文化
- `SKILL.md`: 引擎激活规则 + 分解示例全面英文化
- 全项目中非文化中文清理（SKILL.md/CHANGELOG/engine/*.md 等）
- 经脉分片原子写入完善 — SessionEnd hooks 自动保存记忆

### Added
- `hooks/hooks.json`: SessionEnd hooks 自动巩固记忆

### Changed
- `SKILL.md` → `SKILL_DEV.md`: 重命名以避免本地项目与插件缓存重复注册
- 中英文 README 全面更新，反映 v1.6.x 全部新功能
- Version bumped 1.6.0 → 1.6.1 across all files

## 1.6.0 (2026-06-12)

### Major — Brain-Inspired Memory Engine
- **Episodic vs Semantic Memory**: acupoints add `memory_type` 字段(episodic/semantic)。Episodic decays fast (60d), semantic slow (90d)。Encoding specificity: episodic task_type match -> deqi score x1.15
- **Memory Reconsolidation**: deqi recall opens 30-min reconsolidation window，window TD update plasticity x1.5, consolidation +3。The neural basis of "review the old, know the new"
- **Source Monitoring**: 7-level source reliability (firsthand 1.0 -> hearsay 0.2).`source` 字段激活，得气计分时可靠源×1.1、不可靠源×0.7
- **Elaboration Depth**: 4 levels (shallow/medium/deep/deepest) -> consolidation +0~+6."格物致知"的层次映射

### Added
- `scripts/mcts_guard.js` — 9 Compliance Guards: anti-single/phase-enforce/info-priority/diversity/self-check/memory-agent/compliance/constraint/engine-mode
- `scripts/mcts.js` — Unified CLI, one command for 5 engines (compute/guard/mma/lang/memory)
- `scripts/mma/diagnosis.js` — Eight-Principle Diagnosis: Biao-Li-Han-Re-Xu-Shi -> Pulse -> Weight adjust
- `scripts/mcts_guard.js constraint-checklist` — 9 constraint checks (6 hard 3 soft), auto_detect vs ask-user
- `scripts/mcts_guard.js engine-mode` — 4模式自动判定(full/quick/re-simulate/direct)
- `scripts/mma/constants.js` — Ganzhi encoding (10 stems + 12 branches + 60 Jiazi + precise algorithm + 12 XiaoXi)
- `scripts/mma/constants.js` — `SOURCE_RELIABILITY` 7-level source reliability weights

### Changed
- SKILL.md: COMPRESSION-SAFE block expanded to 30-line executable framework
- SKILL.md: Added Compliance Guard and Unified CLI entry
- 5 engine/*.md + 2 agents/*.md: guard call points added
- `ashi.js`: 新增 memory_type/source/elaboration_level/context_snapshot/reconsolidation_window 字段
- `decay.js`: 情景记忆60d衰减+源不可靠加速衰减；兼容六爻新状态(ACTIVE/MATURE)
- `deqi.js`: deqi scoring: source monitoring + encoding specificity + reconsolidation; middle burner 72h auto-demote
- `reinforce.js`: LiuYao lifecycle + Ben/Zhi/Bian trigrams; reconsolidation plasticity x1.5
- `ziwu.js`: Jiugong Feixing 4-level + Ganzhi meridian enhancement; fixed hour branch bug
- `status.js`: added computeFourImages maturity diagnosis
- `io.js`: added findPointById, removed duplicates from reinforce.js/cluster.js
- `mcts_compute.js`: Qi-Zheng adaptive UCB (0.5~2.5) + Shi maturity; cull/coverage-matrix implemented
- `language_guard.js`: fixed lang truncation (ha->zh); added scriptToLang map
- `knowledge_lifecycle.js`: loadKG parse failure logging added
- `meridian_memory.js`: added four-images/diagnose commands
- Version bumped 1.5.0 → 1.6.0 across all files

### Fixed
- decay.js 不兼容六爻新状态(ACTIVE/MATURE)→知识永不衰减
- language_guard.js lang="ha" vs check 期望"zh"不一致
- deqi.js searchUpperBurner 缺少 entry.point 空值保护
- ashi.js detectYinYangConflict 时间解析可能 NaN
- mcts_compute.js shouldStopIteration 空 rootNodes 崩溃
- deqi.js 中焦工作记忆无限增长
- constants.js 重复导出 KNOWLEDGE_DIMENSIONS
- deqi.js getNextHexagram 与 constants.js 重复定义
- reinforce.js 双重 require constants
- status.js 引入未使用的 TWELVE_XIAOXI
- reinforce.js/cluster.js 各有一个 findPoint 重复代码

## 1.5.0 (2026-06-10)

### Major
- **MMA Meridian Memory Algorithm**: 12 meridians + 8 extraordinary vessels acupoint-based knowledge storage. Deqi recall, Ziwu Liuzhu context triggering, Propagated Sensation spreading activation. Inspired by Yellow Emperor's Inner Canon (《黄帝内经》).
- **Memory Agent (Sub-Agent)**: Silent observer running 5 auto-checkpoints alongside the decision engine. Court Historian dual role (records speech + records deeds) + Remonstrance Official (alerts on contradictions). `agents/memory-agent.md`
- **7 Cognitive Optimizations**: Emotion Modulator (七情→consolidation boost), Triple Burner Working Memory (三焦气化 7±2 chunks), Hidden Acupoint (隐穴 not delete), Meridian Priming (经气预热 +0.15), Yin-Yang Conflict Detection (阴阳对冲→DISPUTED), Sleep Replay (睡眠回放 consolidation), Acupoint Clusters (腧穴集群 auto-chunking)

### Added
- `scripts/meridian_memory.js` — MMA engine CLI with `observe` unified command for all 5 checkpoints
- `scripts/mma/` — Modular architecture: constants, io, ziwu, deqi, ashi, reinforce, decay, cluster, status (9 modules)
- `agents/memory-agent.md` — Memory Agent behavior definition (English, matching core engine language)
- UPGRADE section in README.md and README_CN.md

### Changed
- SKILL.md: MEMORY PROTOCOL upgraded to MEMORY AGENT LIFECYCLE with 5 observation checkpoints
- SKILL.md: Engine File Index updated with Memory Agent and MMA Engine entries
- README.md & README_CN.md: Human-like Memory section → MMA Meridian Memory System
- README.md & README_CN.md: Architecture diagram now includes Memory Agent layer
- Version bumped 1.4.0 → 1.5.0 across all files

### Removed
- `policies/code-task-policy.md` — merged into task-policy.md
- `deploy/` directory — removed all other-platform deployment references
- `scripts/install.sh` — install only via `/plugin marketplace add`

## 1.4.0 (2026-06-08)

### Major
- **Eight-Facet Mirror (Bagua)**: Universal decision framework replacing hardcoded 6-dimension tech-only map. All domains supported via `\p{Script=...}` Unicode detection.
- **Language Adaptation Layer**: LLM-native language detection + `language_guard.js` safety net. Any language, no hardcoded lists.
- **Diverge × Converge**: Diverge phase (brainstorming with 4 engagement checkpoints) → Converge phase (cluster→complete→cull→crystallize → exactly 3 solutions).
- **Full Node.js**: All scripts rewritten from Python to pure JavaScript. Zero environment dependencies.

### Changes
- `engine/mcts-diverge.md`: Eight-Facet Mirror replaces 6-dimension tech map. Conversational grill-the-user flow.
- `engine/mcts-simulate.md`: 5-level knowledge acquisition protocol (Diverge Handoff → Memory → Web → Ask → Assume).
- `engine/mcts-converge.md`: Ranking by converged V + self-check + blindspot audit + TD update.
- `engine/td-learner.md`: COMPRESSION-SAFE RULES added.
- `scripts/mcts_compute.js`: 16 CLI commands, pure JS.
- `scripts/knowledge_lifecycle.js`: L-GCMS gate filtering + tiered storage + forgetting curve.
- `scripts/language_guard.js`: Unicode Script property detection, no hardcoded ranges.
- `agents/mcts-decider.md`: Rewritten with phased output + constraint collection + 5-level triage.
- Deleted: `rules/RULES.md`, `engine/mcts-core.md`, all `.py` files.

---

## 1.3.0 (2026-06-04)

### Fixes
- memory/.gitignore path error
- manage_memory.py data loss path
- Knowledge state machine inconsistency (SLEEPING/ARCHIVED transitions)
- UCB formula hardcoded denominator (√(σ²/1) → √(σ²/n_i))
- Merged duplicate code-task-policy.md into task-policy.md
- CHANGELOG version sync

### Changes
- policies/task-policy.md: Added n_i explanation in UCB formula

---

## 1.1.1 (2026-06-03)

### Added
- Simulation result self-check (Step 3.5): pre-execution vulnerability finding + reverse thinking + risk assessment
- Skip mechanism: user can stop simulation at any stage
- Fuse mechanism: accuracy tracking, auto-degrade below 70%

### Optimized
- Trigger detection: from "specific types only" to "detect multiple approaches in any task"
- Removed duplicate trigger rules chapter

### Changed
- Knowledge recall algorithm rewrite: "multi-path parallel recall" → "associative recall + fragment completion + external verification"
- Memory tiered storage: active (current consciousness) + archive (long-term memory)

---

## 1.1.0 (2026-06-03)

### Added
- agents/openai.yaml
- agents/mcts-decider.md
- Plugin marketplace support (.claude-plugin/plugin.json + marketplace.json)
- Project restructured to plugin format

### Optimized
- README rewritten for general audience
- Removed third-party project references

---

## 1.0.0 (2026-06-03)

### Initial Release
- MCTS-TD Planner Skill core framework
- Multi-solution independent simulation decision engine
- Knowledge graph value function management
- Cross-session continuous learning