---
name: blindspots
description: "Audit a framed decision for blind spots across eight independent dimensions. Use when premise and perspective exploration is complete and the user needs evidence-backed omissions before generating solutions."
argument-hint: "<exploration findings and requirements profile>"
---

# Eight-dimension blind-spot audit

Require the exploration consensus and current requirements profile. Read `${CLAUDE_PLUGIN_ROOT}/skills/blindspots/resources/bagua.json` and `${CLAUDE_PLUGIN_ROOT}/engine/bagua.md`.

## Subagent worker contract

Launch one isolated general-purpose Subagent for each of the eight dimensions defined by the prompt. Every worker receives only its assigned dimension, the original request, current profile, and exploration consensus; it must not see other dimensions' findings.

Each worker must:

- continue finding materially distinct blind spots until another finding would repeat an existing angle;
- never stop at an arbitrary count or repeat one finding with different wording;
- explain each blind spot in at least 2–3 sentences: what is overlooked, why it matters, and how it could change the decision;
- use credible, current sources where research is relevant;
- use the user's domain language, marking insights with 💡 and risks with ⚠️;
- return natural language, never JSON, commands, internal paths, or framework terminology.

## Orchestration barrier

1. Start all eight dimension Subagents in parallel.
2. Wait for all eight to return. Retry a failed or missing dimension or explicitly report it; never silently omit it or continue with fewer than eight completed dimensions.
3. Display every worker's findings before aggregation.
4. Produce a blind-spot table and a single `key_finding` that captures the omission most likely to change the decision.
5. Refresh the requirements profile only for newly discovered facts, constraints, preferences, or tensions. Ask the user only about their own circumstances, not for confirmation of analytical observations.

Return all eight dimension results, evidence, the refreshed profile, and `key_finding`. Do not generate solutions.

## Output files

Return results in the conversation unless the user explicitly requests a file. If a file is requested, write it beneath the calling project's working directory, using the user-specified project-relative path. Never write generated output into `${CLAUDE_PLUGIN_ROOT}` or any Skill installation directory.
