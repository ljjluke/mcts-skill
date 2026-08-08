---
name: simulate
description: "Stress-test every surviving solution across changing scenarios. Use after convergence and scoring when the user needs to understand robustness, failure paths, and condition-dependent outcomes."
argument-hint: "<survivors, scorecards, and requirements profile>"
---

# Scenario simulation

Read `${CLAUDE_PLUGIN_ROOT}/skills/simulate/resources/simulate.json` and `${CLAUDE_PLUGIN_ROOT}/engine/mcts-simulate.md`. Solution scoring uses `${CLAUDE_PLUGIN_ROOT}/skills/solutions/resources/score.json`.

## Subagent worker contract

Launch one isolated general-purpose Subagent for every survivor. Give it only its assigned solution, description, assumptions, user constraints, scorecard, and the scenarios it must explore; it must not see another solution's simulation while producing its own.

Each simulation worker must:

- explore optimistic, realistic, pessimistic, and adversarial conditions, then continue varying assumptions whenever a change creates a materially different path;
- stop only when another condition change would not produce a new decision-relevant evolution, never after an arbitrary scenario count;
- develop each path causally until it stabilizes or reaches an outcome, grounding every transition in concrete input facts;
- explain each meaningful transition in 3–5 sentences without mechanical step labels;
- identify turning points with 💡, risks with ⚠️, overall robustness, the most fragile assumption, failure paths, early warning signals, and the key bottleneck;
- use the user's domain language and return natural language without MCTS symbols, JSON, commands, internal paths, or framework terminology.

## Orchestration barrier

1. Require the complete survivor set and scorecards. Never simulate only the current leader when multiple survivors exist.
2. Start all survivor Subagents in parallel.
3. Wait for every simulation to return. Retry or explicitly report a failed simulation; never silently omit a survivor.
4. Display every solution's simulation before producing cross-solution findings.
5. Only then summarize robustness, trigger conditions, failure paths, reversibility, warning signals, and observations that should alter the ranking or working stance.

The LLM Subagent simulations are authoritative. `${CLAUDE_PLUGIN_ROOT}/scripts/mcts_compute.js simulate` is a random placeholder and must not be used as evidence for real decisions.

## Output files

Return results in the conversation unless the user explicitly requests a file. If a file is requested, write it beneath the calling project's working directory at a user-specified project-relative path. Never write generated output into `${CLAUDE_PLUGIN_ROOT}` or any Skill installation directory.
