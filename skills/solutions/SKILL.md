---
name: solutions
description: "Generate diverse solutions, converge on viable survivors, and score them across eight dimensions. Use after requirements, exploration, and blind-spot findings are available."
argument-hint: "<profile, key finding, and decision stake>"
---

# Solution generation, convergence, and scoring

Use `${CLAUDE_PLUGIN_ROOT}/skills/solutions/resources/plans.json`, `${CLAUDE_PLUGIN_ROOT}/skills/solutions/resources/converge.json`, and `${CLAUDE_PLUGIN_ROOT}/skills/solutions/resources/score.json`. Scenario simulation belongs to the separate `simulate` Skill.

## Solution worker contract

For every genuinely distinct direction, launch one isolated general-purpose Subagent. Give it the problem, profile, constraints, `key_finding`, stake, successful end state when present, and already assigned directions so it cannot duplicate them.

Each solution worker must:

- generate exactly one materially distinct solution and explain its derivation, operation, evidence, conditions, and positive and negative effects in detail;
- use a descriptive name, mark its distinctive advantage with ⭐ and risks with ⚠️;
- label every unverified dependency as `假设:` rather than presenting feasibility as fact;
- align to the supplied successful end state and reverse path, or explicitly justify why that end state is flawed;
- for high-stake decisions, state a concrete condition under which the solution fails, then revise or bound the solution to absorb that challenge;
- use the user's domain language and return natural language without JSON, commands, internal paths, or framework terminology.

Start all solution workers in parallel. Wait for every worker to return and display every proposal before convergence. Do not stop at an arbitrary convenient count.

## Converge

Read the convergence prompt and engines. Retain at least three survivors when the candidate set permits it. Eliminate only options that violate hard constraints, are infeasible, impose unbearable costs, or are dominated. Explain every elimination. For high-stake decisions, state a working preference, its reasons, and what evidence would change it.

## Scoring worker contract

After convergence, launch one isolated general-purpose Subagent for every survivor. Give each worker the same profile, constraints, weights, and all eight scoring dimensions from `score.json`, but only its assigned solution.

Each scoring worker must provide evidence and an individual score for every dimension, plus a justified total. Start all scoring workers in parallel, wait for every one to return, and display all scorecards before comparing totals. Never rank partial results. For high-stake decisions, examine why the leader scored highest, how the ranking changes if those causes fail, and whether the scoring priors or weights are appropriate.

Return all proposals, eliminations, survivors, working stance, complete scorecards, assumptions, and ranking. Preserve the current profile and `stake`. Do not run scenario simulation or debate.

## Output files

Return results in the conversation unless the user explicitly requests a file. If a file is requested, write it beneath the calling project's working directory at a user-specified project-relative path. Never write generated output into `${CLAUDE_PLUGIN_ROOT}` or any Skill installation directory.
