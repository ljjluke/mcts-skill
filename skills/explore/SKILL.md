---
name: explore
description: "Challenge a problem's framing and explore it from multiple perspectives. Use when a requirements profile exists but the premises, overlooked interpretations, or range of viable viewpoints need deeper examination."
argument-hint: "<problem plus requirements profile>"
---

# Frame and perspective exploration

Require a sufficiently complete requirements profile. If essential facts are missing, gather them before analysis rather than inventing them.

Execute these two phases strictly in sequence:

1. **Premise examination**
   - Read `${CLAUDE_PLUGIN_ROOT}/skills/explore/resources/shensi.json` and its referenced engine documents.
   - Produce the mandatory `stake` judgment first. Treat unclear stake as high.
   - Examine hidden premises, counterintuitive implications, and whether the question itself embeds an unverified frame.
   - For high-stake decisions, examine loss attitudes and dissolve the framing when warranted.
   - Ask the user only when an observation concerns their real circumstances or preferences; do not ask them to confirm purely analytical insights.
2. **Perspective expansion**
   - Only after premise examination is complete, read `${CLAUDE_PLUGIN_ROOT}/skills/explore/resources/divergence.json` and its referenced engines.
   - Feed the premise findings and refreshed profile into the perspective analysis.
   - Cover all required perspectives and continue until no materially distinct perspective remains.
   - For high-stake decisions, make opposing perspectives challenge each other and retain only conclusions that survive the challenge.

Present the reasoning and findings in natural language. Return the refreshed profile, `stake`, premise findings, perspectives, tensions, and surviving consensus so another skill can consume them. Never expose commands, JSON, internal paths, or pipeline labels to the user.
