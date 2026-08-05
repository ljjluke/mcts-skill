---
name: memory
description: "Recall, record, and update Ponder's durable decision knowledge. Use when prior lessons may help a decision, when a confirmed insight should be retained, or when an earlier recommendation's outcome is known."
argument-hint: "<recall, record, or outcome request>"
---

# Ponder knowledge memory

Use the current knowledge interface in `${CLAUDE_PLUGIN_ROOT}/scripts/knowledge.js` and the simple MMA storage under `${CLAUDE_PLUGIN_ROOT}/scripts/mma/`. Do not use the removed legacy `mcts.js mma` or meridian commands.

Supported work:

- **Recall:** retrieve relevant confirmed knowledge, prior errors, preferences, and linked traces for the present topic. Prefer the most relevant and recent evidence, and distinguish hypotheses from confirmed knowledge.
- **Record:** retain a non-obvious, reusable insight with its context, source, confidence, status, original example, step-history tags, and links where applicable.
- **Outcome:** when the user reports what happened, mark the relevant hypothesis or recommendation confirmed or refuted and retain the evidence.
- **Lifecycle:** preserve existing IDs, status transitions, archive behavior, backups, and format version. Do not rewrite or bulk-migrate history during routine use.

Respect `PONDER_DATA_DIR`; otherwise use the existing default `~/.claude/data/skills/ponder/`. Never store credentials, secrets, raw authentication data, or sensitive information unnecessary for future reasoning. Do not claim a record was stored unless the operation succeeded.

Memory is supporting evidence, not authority. Surface relevant lessons in natural language, preserve uncertainty and provenance, and never use memory as a reason to skip current requirements gathering or analysis. Keep commands, storage paths, and raw JSON out of user-facing output unless the user explicitly asks for technical diagnostics.
