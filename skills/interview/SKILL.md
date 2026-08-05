---
name: interview
description: "Build a decision-ready requirements profile before analysis. Use when the user's goal, constraints, stakeholders, environment, resources, or domain-specific unknowns are still unclear."
argument-hint: "<goal or problem to clarify>"
---

# Requirements interview

Turn the request into a decision-ready profile. Do not generate or rank solutions.

1. Start from the user's original request and any facts already provided. Never ask for information already known.
2. Use `AskUserQuestion` one question at a time, with concrete options. Cover all five dimensions:
   - **天**: timing, external environment, trends, deadlines, and uncertainty.
   - **地**: context, market or operating environment, boundaries, and dependencies.
   - **人**: stakeholders, users, capabilities, incentives, and decision authority.
   - **法**: rules, success criteria, process, compliance, and acceptable trade-offs.
   - **物**: budget, data, tools, assets, capacity, and other resources.
3. Within each dimension, continue until another question would add no materially new information. Do not stop after one question by default.
4. Summarize facts, constraints, preferences, assumptions, tensions, and unresolved unknowns.
5. Perform a domain-sensitive ignorance check using `${CLAUDE_PLUGIN_ROOT}/engine/socratic-ignorance.md`. Identify only professional unknowns that could materially change the decision and that the five general dimensions would not expose.
6. Research public facts with available research tools first. Ask the user only for facts that cannot reasonably be found, explaining in one sentence why each is important.
7. Classify the decision stake using `${CLAUDE_PLUGIN_ROOT}/engine/mcts-constraint.md`: any high-stake condition, uncertainty about stake, or explicit user seriousness means `high`.

Return a natural-language profile containing the five dimensions, domain-specific additions, decision stake, assumptions, and remaining unknowns. Do not expose internal paths or commands in user-facing output.
