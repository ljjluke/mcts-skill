---
name: debate
description: "Adversarially test surviving solutions and rank their resilience. Use after all survivor simulations are complete and the user needs attacks, rebuttals, counterfactual checks, and a pressure-tested ranking."
argument-hint: "<survivors, scores, simulations, and working stance>"
---

# Adversarial solution debate

Read `${CLAUDE_PLUGIN_ROOT}/skills/debate/resources/debate.json`, `${CLAUDE_PLUGIN_ROOT}/engine/debate.md`, and `${CLAUDE_PLUGIN_ROOT}/engine/counterfactual-thinking.md`.

## Opening-case worker contract

Launch one isolated general-purpose Subagent for every survivor. Give it its assigned solution, competing solution summaries, complete scorecard, scenario results, requirements profile, and working stance.

Each worker must:

- advocate exactly one solution and state its strongest concrete advantage;
- exhaust all independent arguments that genuinely support it, grounding each argument in solution details, evidence, scores, and simulation outcomes;
- explain each argument in at least 3–5 sentences rather than splitting one argument into several labels;
- identify the most vulnerable point of every competing solution;
- use natural debate language and mark strong arguments with ✅;
- use the user's domain language and return natural language without JSON, commands, internal paths, or framework terminology.

## Orchestration barrier

1. Require complete scores and scenario simulations for every survivor.
2. Start all opening-case Subagents in parallel.
3. Wait for all opening cases and display every one before beginning attacks. Retry or explicitly report failures; never rank a solution whose required case is missing.
4. Only after the barrier, conduct the main-thread attack round: test assumptions, causal chains, feasibility, hidden costs, downside containment, and responses to simulated scenarios.
5. Apply bidirectional counterfactual checks and distinguish controllable from uncontrollable causes.
6. Produce and display a resilience ranking table with a concise assessment for every survivor.
7. For high-stake decisions, state whether the working preference changed, exactly which attack caused the change, or why it remained stable.

Return every opening case, attack and response, `debate_summary`, complete `ranked` results, counterfactual findings, and any stance shift. Do not synthesize the final recommendation.

## Output files

Return results in the conversation unless the user explicitly requests a file. If a file is requested, write it beneath the calling project's working directory at a user-specified project-relative path. Never write generated output into `${CLAUDE_PLUGIN_ROOT}` or any Skill installation directory.
