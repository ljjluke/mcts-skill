---
name: mcts-td-value-archive
description: MCTS-TD Engine knowledge graph value function archive (knowledge entries + state machine + multi-path recall). Supports multi-version coexistence, conflict detection, state transition, rollback and memory decay.
metadata:
  type: reference
---

# MCTS-TD Value Function Archive

> Knowledge graph mode, each knowledge piece independently managed.
> Recall method: Multi-path recall (exact match / main dimension match / domain match / tag match / association spread).
> Scoring method: Path weight × Status weight × Time decay × Context match × Usage frequency.

## Knowledge Entry Table

| ID | Feature | q | σ² | n | Status | tags | Context | Consolidation | Created | Last Verified |
|----|---------|---|----|----|--------|------|---------|---------------|---------|---------------|
| — | — | — | — | — | — | — | — | — | — | — |

## Knowledge Change Log

| Date | Entry | Operation | Reason |
|------|------|-----------|--------|
| — | — | — | — |

## Current Active Knowledge Summary

```
CONFIRMED:   (none)
PROVISIONAL: (none)
DISPUTED:    (none)
REFUTED:     (none)
HYPOTHESIS:  (none)
SLEEPING:    (none)
ARCHIVED:    (none)
```

---

## Usage Instructions

### Status Description

| Status | Weight | Meaning |
|--------|--------|---------|
| CONFIRMED | 1.0 | Trusted knowledge, ≥3 verifications passed |
| PROVISIONAL | 0.3 | Pending verification, only 1-2 verifications |
| DISPUTED | 0.2 | Has contradictory evidence, retained but low weight |
| REFUTED | 0.0 | Refuted, does not participate in recall |
| HYPOTHESIS | — | New knowledge, does not participate in queries (not yet verified) |
| SLEEPING | 0.3× | Unused >30 days, weight halved |
| ARCHIVED | — | Unused >90 days, does not participate in routine recall |

### Recall Method

Associative recall + Fragment completion:
1. **Associative Recall**: Most relevant knowledge naturally surfaces (direct association / pattern association / context association)
2. **Fragment Completion**: If recalled knowledge is incomplete, follow fragments to associate or use related knowledge to complete
3. **External Verification**: If still incomplete after completion, look up resources or ask user

### Update Method

After execution completes, update knowledge graph based on actual results:
1. Execute multi-path recall, find matching knowledge entries
2. If found → Update matching entry's n, q, σ², status, consolidation score
3. If not found → Create new HYPOTHESIS entry (with tags)
4. Record changes to knowledge change log