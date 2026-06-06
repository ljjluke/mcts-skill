---
name: mcts-core
description: (Archived) This file has been split into 4 independent engine files. Please use the new files directly.
---

# ⚠️ This File Has Been Split

`mcts-core.md` (originally 1703 lines) has been split into 4 independent engine files. **Do not reference this file anymore**.

## New File Index

| Original Section | New File |
|------------------|----------|
| Step 0: Requirement Constraint Collection | [`engine/mcts-constraint.md`](./mcts-constraint.md) |
| Step 1: Six-Dimension Map + Six-Path Recon + Perspective Wheel + Rough Filter | **[`engine/mcts-diverge.md`](./mcts-diverge.md)** ← Diverge Engine, major upgrade |
| Step 2: Round-by-round Independent Simulation + Knowledge Injection + Completion Box | [`engine/mcts-simulate.md`](./mcts-simulate.md) |
| Step 3~3.6: Aggregate + Self-check + Blindspot Audit + Re-simulation | **[`engine/mcts-converge.md`](./mcts-converge.md)** ← Converge Engine, added blindspot audit |
| Learning Engine | [`engine/td-learner.md`](./td-learner.md) (unchanged) |

## Change Summary

```
Before Split (1.3.0):                  After Split (1.4.0):
engine/mcts-core.md (1703 lines)       engine/mcts-constraint.md (Constraints)
  ├─ Step 0: Constraint Collection      engine/mcts-diverge.md (Diverge)
  ├─ Step 1: Known Detection +          engine/mcts-simulate.md (Simulate)
  │         Resources + Solutions +     engine/mcts-converge.md (Converge +
  │         Rough Filter                           Self-check)
  ├─ Step 2: Round Simulation +         engine/td-learner.md (Learning, unchanged)
  │         Knowledge + Gap Check
  ├─ Step 3: Aggregate Comparison
  ├─ Step 3.5: Self-check + Fuse
  ├─ Step 3.6: Blindspot Audit (new)
  └─ Re-simulation + TD Error
```

## Version Update Notes

**1.3.0 → 1.4.0 upgrade includes:**
1. Engine files split from 1 to 4, clear responsibilities
2. Domain familiarity detection → **Six-Dimension Domain Map** (6-dimension scoring + blindspot identification)
3. Resource collection → **Six-Path Recon** (6 intel paths + cross-validation)
4. Solution generation → **Perspective Wheel** (10 perspectives + 4~8 mandatory coverage)
5. Added **Step 3.6: Domain Blindspot Audit** (check perspective coverage)
6. Global completion box upgraded to **V2: Knowledge Gaps + Perspective Coverage Tracking**