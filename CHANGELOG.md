# Changelog

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