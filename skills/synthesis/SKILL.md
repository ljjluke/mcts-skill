---
name: synthesis
description: "Turn a completed adversarial debate into a guarded final recommendation. Use when debate_summary and ranked results exist and the user needs a conclusion, risks, fallback, and epistemic limits."
argument-hint: "<debate summary, ranking, profile, and stake>"
---

# Guarded synthesis

Require complete `debate_summary` and `ranked` inputs. If any surviving solution is absent from the debate, stop and complete the missing debate rather than inventing a final ranking.

1. Read `${CLAUDE_PLUGIN_ROOT}/skills/synthesis/resources/synthesis.json` and its referenced engines, including synthesis, error patterns, otherness, preference structure, and multidisciplinary audit.
2. Produce a recommendation, core reasoning, risks and mitigations, fallback conditions, and any remaining decision the user must personally make.
3. For high-stake decisions, also provide:
   - challenges to the conclusion and the shared premises on which the options rely;
   - a fallibility statement grounded in the final stance, including the most likely way it fails and the fallback;
   - any irreducible viewpoint or affected group that the synthesis cannot absorb;
   - the stance pedigree from convergence through debate to conclusion;
   - the time-horizon and motivational preferences implicit in the recommendation.
4. Validate the structured draft with `${CLAUDE_PLUGIN_ROOT}/scripts/synthesis_guard.js`. The fallibility, self-challenge, and otherness targets must remain mutually distinct, and all required otherness fields must be complete. Repair violations before presenting the conclusion.
5. Ask the user with `AskUserQuestion` only when a core direction still requires their choice. Otherwise present the conclusion directly.

Write naturally and lead with the recommendation. Do not expose guard commands, JSON, file paths, internal phase names, or pipeline operations.
