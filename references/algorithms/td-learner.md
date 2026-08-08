---
name: td-learner
description: TDL (Temporal Difference Learning) Engine's core inference rules. Based on knowledge graph + state machine value function management, supports multi-version knowledge coexistence, conflict detection, state transition and rollback mechanism.
---

# TD Learning Engine

> **Path note**: Commands use node $P/scripts/mcts.js (relative). When executing, use node <plugin>/scripts/mcts.js <args> — <plugin> = path from SessionStart [Ponder] Plugin:.

> **🔒 COMPRESSION-SAFE RULES (Always apply, even if context is compressed):****
> 1. **KNOWLEDGE LIFECYCLE**: `HYPOTHESIS`(0.1) → `PROVISIONAL`(0.3) → `CONFIRMED`(1.0) → `DISPUTED`(0.2) → `REFUTED`(0.0). `SLEEPING`(0.15) after 30d unused, ARCHIVED after 90d.
> 2. **GATE BEFORE STORE**: New knowledge MUST pass gate-check (reusability + density + novelty + reliability). Discard if score < 0.4.
> 3. **RECALL HIERARCHY**: ①Associative recall (most relevant first) → ②Fragment completion (fill gaps from memory) → ③External verification (web/user). Don't trust recalled knowledge blindly — verify when uncertain.
> 4. **MEMORY LIFECYCLE**: Recall, step storage, outcome updates, grooming, and finalization are handled by `skills/memory/SKILL.md`, `scripts/knowledge.js`, and `skills/ponder/scripts/orchestrate.js`. Do not call legacy memory checkpoint commands.

## Overview

This engine transforms TD(λ) algorithm's core mechanisms into inference rules. Core capabilities include:
1. **Knowledge Graph Value Management**: Each piece of knowledge stored independently, has lifecycle state
2. **Multi-version Conflict Detection**: Multiple contradictory knowledge for same feature can coexist, weighted voting at query time
3. **State Machine Transitions**: Knowledge goes through hypothesis→verified→confirmed→disputed→refuted, complete lifecycle
4. **Rollback Mechanism**: Overturned knowledge can rollback to previous stable version
5. **Gamma Discounted Value Backpropagation**: Standard TD value update

---

## Core Formula Inference Mapping

### Original Formula

$$TD\_target = r_{t+1} + \gamma V(s_{t+1})$$
$$TD\_error = TD\_target - V(s_t)$$
$$V(s_t) \leftarrow V(s_t) + \alpha \times TD\_error$$

### Inference Mapping


TD_target = Local feedback + γ × Expected value of subsequent steps
TD_error = TD_target - Old expected value of current step
New expected value = Old expected value + α × TD_error


| Formula Symbol | Inference Correspondence | Acquisition Method |
|---------------|-------------------------|---------------------|
| $V(s_t)$ | Success expectation at step t | Knowledge graph query (weighted voting) |
| $r_{t+1}$ | Local feedback | Execution outcome vs expected outcome |
| $V(s_{t+1})$ | Subsequent step expectation | Knowledge graph query |
| $\alpha$ | Learning rate | Set by task type |
| $\gamma$ | Discount factor | Set by task type |

---

## Feedback Collection Rules

### Reward Signal Definition

Feedback collection occurs after each step of task execution:


r_t =
  +1.0  − Full success (all objectives met)
  +0.5  − Partial success (main objective met, minor gaps)
   0.0  − No significant feedback
  -0.3  − Minor defect (small deviation from expected)
  -0.7  − Major failure (core objective not met)
  -1.0  − Catastrophic failure (objective failed with severe consequences)

Code: node $P/scripts/mcts.js compute get-reward-signal --type <type>


### Terminal State Value


V(s_terminal) =
  +1.0  − Goal fully achieved (all objectives satisfied)
  +0.5  − Partial achievement (main goal met, edge cases unhandled)
   0.0  − Neutral (objective met but quality mediocre)
  -0.5  − Collateral damage (achieved A but harmed B)
  -1.0  − Goal failed (need alternative approach)

Code: node $P/scripts/mcts.js compute get-terminal-value --type <type>


---

## Value Update Rules

### 学不可以已(Xue Bu Ke Yi Yi) — Xunzi's Progressive Accumulation (劝学篇 Quan Xue Pian)

"不积跬步，无以至千里" — TD learning is step-by-step accumulation (Kui-Bu):
- Each TD_error is one kui-bu (half-step), tiny individually but cumulative direction is certain
- α learning rate = step size: large steps for beginners (α=0.5), small steps for experts (α=0.05) — "锲而不舍，金石可镂"
- HYPOTHESIS→PROVISIONAL→CONFIRMED accumulation = kui-bu to a thousand miles

"青取之于蓝而青于蓝" — Knowledge can surpass its source:
- HYPOTHESIS(indigo plant) → PROVISIONAL(extraction) → CONFIRMED(beyond blue) = 青出于蓝(Qing Chu Yu Lan)
- But DISPUTED→REFUTED = some "indigo plants" are themselves flawed, need to re-examine source reliability
- Rollback mechanism = restoring correct knowledge after "indigo" is overturned, preventing error accumulation

Academic support: TD learning is essentially incremental value function approximation — each step adjusts only a small amount (kui-bu), but with correct direction converges to optimum (thousand miles).

### Gamma Discounted Backpropagation

Inference rules ported from tetris_mcts's backup_trace_obs function:

```text
Input: Decision trace [s_0, s_1, ..., s_T], leaf node value V_leaf, 
       leaf node variance σ²_leaf

Traverse backwards from t=T to t=0:
    1. Get node s_t's immediate score score(s_t)
    
    2. Remove immediate score to get pure value
       V_corrected = current_value - score(s_t)
    
    3. Update s_t's value estimate (Welford algorithm)
       if visit(s_t) == 0:
           value(s_t) = V_corrected
           variance(s_t) = σ²_leaf
       else:
           delta = V_corrected - value(s_t)
           value(s_t) += delta / (visit(s_t) + 1)
           delta2 = V_corrected - value(s_t)
           variance(s_t) += (delta × delta2 - variance(s_t)) / (visit(s_t) + 1)
       visit(s_t) += 1
    
    4. Gamma discount then pass to previous node
       current_value = γ × V_corrected + score(s_t)
```


### Learning Rate α Selection

| Historical Data Volume | α | Explanation |
|----------------------|---|-------------|
| 0-5 times | 0.5 | Fast adaptation, quick adjustment with little data |
| 6-20 times | 0.2 | Medium speed |
| 21-100 times | 0.1 | Stable learning |
| >100 times | 0.05 | Fine-tuning, prevent oscillation |

Code: node $P/scripts/mcts.js compute get-learning-rate --n <N>

---

## Welford Variance Inference Rules

Ported from tetris_mcts's Welford online variance algorithm:

```text
Variance Update (single step):
    Input: Historical mean μ_old, historical M2_old, count n, new value x
    
    n_new = n + 1
    delta = x - μ_old
    μ_new = μ_old + delta / n_new
    delta2 = x - μ_new
    M2_new = M2_old + delta × delta2
    
    Variance = M2_new / n_new
    Standard deviation = √(Variance)

Variance Update (batch, for eligibility trace backpropagation):
    Input: Trace [x_1, x_2, ..., x_k], discount factor γ
    
    current_value = x_k
    for i = k-1 to 1:
        discounted = γ × current_value + x_i
        current_value = discounted
```

### Variance Usage Rules


Variance→Confidence mapping:
  node $P/scripts/mcts_compute.js get_confidence_level
  σ²<0.1→High | 0.1~0.3→Medium | ≥0.3→Low


---

## State Projection Deduplication

Ported from tetris_mcts's projection mechanism:


Concept: Two "identical" state features should share knowledge graph query

In Claude Code, state "equality" is determined by state feature vector:
  State = {
      task_type: CORRECTIVE | CONSTRUCTIVE | OPTIMIZING | DIAGNOSTIC | VALIDATING
      domain: TECHNOLOGY | FINANCE | HEALTH | EDUCATION | BUSINESS | LEGAL | GENERAL
      scope: UNIT | MODERATE | EXTENSIVE | COMPREHENSIVE
      risk_level: LOW | MED | HIGH | CRITICAL
      context_size: SMALL | MED | LARGE
      novelty: LOW | MED | HIGH
  }

Query Rules:
  Use complete feature vector as query key, find all matching knowledge
  entries in knowledge graph.
  Exact match → Return all matching entries (may be multiple)
  Partial match → Return closest entry + mark "partial match"
  No match → Return empty (cold start)

Code: node $P/scripts/mcts.js compute project-state --state_vector '<JSON>'


---

## Eligibility Trace Inference Rules

Ported from TD(λ) algorithm:

### Concept

Eligibility trace solves "credit assignment" problem — when final feedback is received, **which steps should be responsible for this result?**


Simulation scenario:
  Step 1: Chose Solution A        ← Is this the key decision?
  Step 2: Executed action X          ← Or here?
  Step 3: Execution failed           ← Or here?
  
  Eligibility trace λ = 0.8 means:
    Step 1 gets 20% of credit
    Step 2 gets 80% of credit
    Step 3 gets 100% of credit


### Rules


Eligibility trace decay: Step t's eligibility = λ^(T-t)
Recommended λ: node $P/scripts/mcts_compute.js get-lambda --steps <N>
→ 1-3 steps: 0.0 | 4-8 steps: 0.5 | 9+ steps: 0.8


---

## Experience Replay and Online Learning

Ported from tetris_mcts's store_nodes and train_nodes:

### Experience Collection


After each search completes, collect following experiences:
  - state: Current state feature vector
  - value: Value estimate from search
  - variance: Variance estimate from search
  - weight: Visit count (confidence weight)

Storage Conditions:
  - Visit count >= min_visits_to_store (default=10)
  - Non-terminal state (terminal state V=0, no learning value)


### Experience Replay


When enough experience collected (N >= threshold):
  1. Aggregate all experiences
  2. Sort by weight, keep Top-K
  3. Update knowledge graph using weighted average
  4. Persist memory to file

Threshold Design:
  min_experiences = 20  (Minimum 20 experiences before replay)
  max_experiences = 500 (Maximum 500 retained, discard old data if exceeded)


---

## ⚠️ Value Function Management (Knowledge Graph + State Machine)

This is this engine's core upgrade — from "one row per feature aggregate statistics" to "each knowledge piece independently managed" knowledge graph mode.

### Fundamental Problem

Old mode (aggregate statistics) cannot handle scenarios:


Old mode: {CORRECTIVE, INTERFACE, LOW} → q=0.85, n=30, σ²=0.05

Problem 1: If this 0.85 was data under methodology/toolset v1, after methodology/toolset
           upgrades to v2, actual value drops to 0.3
           → Old mode can only average, result 0.575, neither version accurate

Problem 2: If this 0.85 knowledge itself is wrong (initial data bias)
           → Larger n, more "credible" the error, cannot correct

Problem 3: If later verified new knowledge 0.30 is also wrong, old
           knowledge 0.85 was actually correct
           → Old value already overwritten, cannot rollback


### New Mode: Knowledge Entry + State Machine

Each piece of knowledge is an independent entry with its own lifecycle:


Knowledge Entry = {
    id: "K001",                    // Unique identifier
    feature_key: "CORRECTIVE|INTERFACE|LOW", // State feature
    value: 0.85,                   // Value estimate
    variance: 0.05,                // Variance
    n: 30,                         // Verification count
    status: "CONFIRMED",           // Current status (see state machine)
    context: {                     // Context where knowledge holds
        methodology_version: "v1.0",
        project_phase: "early",
        constraints: "no special constraints"
    },
    created: "2026-05-01",
    last_verified: "2026-06-01",
    source: "Experience accumulation (30 tasks)",
    conflict_log: []               // Conflict records
}


### Knowledge State Machine

Each knowledge entry undergoes following state transitions in its lifecycle:


                        ┌─────────────────────┐
                        │   HYPOTHESIS        │  ← Initial state: new knowledge,
                        │   (Hypothesis)       │    not yet verified
                        │   Weight: 0.1 (low   │
                        │   weight participation│
                        │   for exploration    │
                        │   guidance)          │
                        └──────────┬──────────┘
                                   │ First reference with positive feedback
                                   ▼
                        ┌─────────────────────┐
                  ┌─────│   PROVISIONAL       │──────┐
                  │     │   (Pending          │      │
                  │     │   Verification)     │      │
                  │     │   Weight: 0.3       │      │
                  │     └──────────┬──────────┘      │
                  │                │                  │
                  │   Accumulated  │  Contradictory  │ Counterexample
                  │   ≥3 positive  │  evidence       │ appears
                  │   verifications │  appears        │
                  ▼                ▼                  ▼
          ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
          │  CONFIRMED   │ │  DISPUTED    │ │  REFUTED     │
          │  (Confirmed) │ │  (Disputed)  │ │  (Refuted)   │
          │  Weight: 1.0 │ │  Weight: 0.2 │ │  Weight: 0.0 │
          └──────┬───────┘ └──────┬───────┘ └──────────────┘
                 │                │
                 │ Counterexample │ New evidence
                 │ appears        │ supports
                 ▼                ▼
          ┌──────────────┐ ┌──────────────┐
          │  DISPUTED    │ │  CONFIRMED   │  ← Rollback
          │  (Disputed)  │ │  (Confirmed) │
          └──────────────┘ └──────────────┘

                    ▼ [Unused for >30 days]
          ┌─────────────────────┐
          │   SLEEPING          │  ← Sleeping: unused >30 days, weight halved
          │   (Sleeping)        │
          │   Weight: 0.3×0.5   │
          └──────────┬──────────┘
                     │ Triggered by recall again
                     ▼
          ┌─────────────────────┐
          │   PROVISIONAL       │  ← Return to pending verification state
          │   Weight: 0.3       │    (needs re-verification)
          └─────────────────────┘

                    ▼ [Unused for >90 days]
          ┌─────────────────────┐
          │   ARCHIVED          │  ← Archived: doesn't participate in
          │   (Archived)         │    routine recall
          │   Weight: Not       │
          │   participating     │
          │   in queries        │
          └──────────┬──────────┘
                     │
                     │ Triggered by associative recall
                     ▼
          ┌─────────────────────┐
          │   HYPOTHESIS        │  ← Recalled, needs re-verification
          │   Weight: 0.1 (low  │
          │   weight            │
          │   participation     │
          │   for exploration   │
          │   guidance)         │
          └─────────────────────┘


### State Transition Rules

State transitions calculated by code engine:
node $P/scripts/mcts_compute.js check_status_transition
Weight query: node $P/scripts/mcts_compute.js get-status-weight --status <status>

Core rules:
  HYPOTHESIS→(verified 1 time)→PROVISIONAL/REFUTED |
  PROVISIONAL→(n≥3)→CONFIRMED |
  CONFIRMED→(contradiction≥2)→DISPUTED |
  DISPUTED→(contradiction≥3)→REFUTED |
  Rollback: DISPUTED→(new evidence supports)→CONFIRMED |
  ARCHIVED→(recall triggered)→HYPOTHESIS

### Weight System

Each status's knowledge entry receives different weight at query time:

| Status | Weight | Meaning |
|--------|--------|---------|
| CONFIRMED | 1.0 | Trusted knowledge, fully participates in value calculation |
| PROVISIONAL | 0.3 | Pending verification, low weight participation |
| DISPUTED | 0.2 | Controversial knowledge, retained but not trusted |
| REFUTED | 0.0 | Refuted knowledge, doesn't participate in queries (trace only) |
| HYPOTHESIS | 0.1 | New knowledge, low weight participation in recall (for exploration) |
| SLEEPING | 0.15 | Sleeping knowledge, unused >30 days, weight halved |
| ARCHIVED | — | Archived knowledge, doesn't participate in routine recall |

### ⚠️ Knowledge Recall Algorithm (Core)

> Human brain's way of recalling knowledge is not "multi-path parallel lookup + score sorting",
> but: **See problem → Most relevant memory automatically surfaces (possibly incomplete)
> → Follow associations to complete fragments → If still not enough, look up external info**

This engine simulates this human brain process with three stages:
**Associative Recall → Fragment Completion → External Verification**.

#### Recall Process Overview


Query Request: {Current task description, Current context}

          ┌─────────────────────────────────┐
          │  Step 1: Associative Recall      │
          │  Not "lookup", but "remember"    │
          │  → Most relevant few knowledge   │
          │    pieces automatically surface  │
          │  → Surfaced knowledge may be     │
          │    incomplete                    │
          └──────────────┬──────────────────┘
                         ▼
          ┌─────────────────────────────────┐
          │  Step 2: Fragment Completion    │
          │  If recalled knowledge          │
          │  incomplete:                     │
          │  → Follow existing fragments to  │
          │    associate outward            │
          │  → Link to other related        │
          │    knowledge                    │
          │  → Piece together more complete  │
          │    picture                      │
          └──────────────┬──────────────────┘
                         ▼
          ┌─────────────────────────────────┐
          │  Step 3: External Verification  │
          │  If still incomplete after       │
          │  fragment completion:            │
          │  → Know "what's missing"        │
          │  → Look up resources/ask user   │
          │    to complete                  │
          └─────────────────────────────────┘


---

#### Step 1: Associative Recall

Not "query with feature vector", but simulating human brain's "see problem, recall relevant experience".


Association Methods:

① Direct Association (strongest memories surface first)
   "I've encountered similar problem before"
   → Condition: Feature partial match (task_type + domain match)
   → Surfaces: All CONFIRMED status entries under that feature
   → Characteristic: What surfaces is "most frequently used", not all

② Pattern Association (see problem pattern, recall corresponding solution)
   "I've seen this problem pattern, though different domain"
   → Condition: tags overlap, or keywords in problem description match
   → Surfaces: Matching knowledge entries (regardless of status)
   → Characteristic: What surfaces is "same problem pattern", regardless of domain

③ Context Association (current context triggers related memory)
   "This project uses established methods, I remember handling similar issue in
    previous project before"
   → Condition: Current context matches methodology and environment
   → Surfaces: Entries with same or similar methodology/toolset
   → Characteristic: What surfaces is "experience from same environment"

Association Output:
  Not a list sorted by score, but "a few pieces of knowledge surfacing in mind".
  Each knowledge piece may be complete or incomplete (remember the gist, details fuzzy).
  
  Output Format:
    "Recalled K005: Encountered similar issue when fixing patient intake validation
     validation before...
     → Remember using quality checkpoint system, but specific syntax unclear"
    "Recalled K001: Previous project had similar structural failure...
     → Remember it was structural context, but different methodology,
       uncertain if applicable"


##### Association Surfacing Rules


Not "query all knowledge then sort", but "most relevant naturally surfaces".

Surfacing Priority:
  1. High usage frequency (high consolidation score)
     → "Frequently recalled memories most easily surface again"
  
  2. Recently used (recent last verification time)
     → "Just used things still in mind"
  
  3. High match with current scenario
     → "Same problem scenario most easily triggers recall"
  
  4. Memorable (many status changes)
     → "Knowledge that was disputed/rolled back is more memorable"

Surfacing Count: Generally 2~4 entries, >5 truncated to top-3, 0→external verification


---

#### Step 2: Fragment Completion

Recalled knowledge is often incomplete. Need to follow existing fragments to associate outward, complete the picture.


Types of Incompleteness:

① Value Fuzzy: "Remember last time this worked well, but not sure exactly
                how well"
   → Complete: Check that entry's q value (precise value)
   → If q value also old → Mark "needs re-verification"

② Context Fuzzy: "Remember it was in a previous project, but not sure if
                   same methodology"
   → Complete: Check that entry's context field
   → If context incomplete → Mark "context missing"

③ Solution Fuzzy: "Remember using some validation method, but forgot
                    specific syntax"
   → Complete: Check that entry's description or linked decision sequence
   → If still none → Mark "solution missing, need to look up resources"

④ Result Fuzzy: "Remember it was solved, but were there side effects?"
   → Complete: Check that entry's side effect records or linked
               contradiction reports
   → If no records → Mark "result incomplete"


##### Fragment Completion Methods


Method 1: Follow fragments to associate (no need to look up external resources)

  "Remember it was patient intake validation process issue..."
  → Follow "patient intake" association: "intake uses quality checkpoints"
  → Follow "parameter validation" association: "quality checkpoint system has primary and
                                            secondary checkpoint"
  → Piece together: "Should use secondary checkpoint, but specific
                     invocation syntax uncertain"

  Completion Result:
  - Core info: Known (quality checkpoint validation)
  - Detail info: Incomplete (checkpoint syntax)
  - Incompleteness level: Partial (doesn't affect simulation, annotate
                              "checkpoint to confirm" during simulation)


Method 2: Related knowledge completion (check other entries in knowledge graph)

  "K005 is about patient intake validation process..."
  → Check knowledge graph for other entries with tags containing "patient intake"
    or "quality checkpoint"
  → Find K008 is also patient intake project, and contains specific procedure examples
  → Use K008 to complete K005's details

  Completion Result:
  - Core info: Known
  - Detail info: Completed from K008
  - Incompleteness level: Complete


##### Three States After Completion


Post-completion Assessment:

  Complete: All key info available → Can use directly for simulation
    "Remembered, also completed, can use directly"
  
  Partially Incomplete: Core info present, details fuzzy → Annotate
                        "pending confirmation" during simulation
    "Roughly know how to do, but specific procedure unclear,
     annotate during simulation"
  
  Severely Incomplete: Core info missing → Enter Step 3 external verification
    "Only remember something happened, but no clue how solved"


---

#### Step 3: External Verification

If still incomplete after fragment completion, or knowledge itself may be outdated, need to look up external resources.


Trigger Conditions:
  ① Still "severely incomplete" after fragment completion
  ② Knowledge is CONFIRMED but last verification >30 days (may be outdated)
  ③ Knowledge context clearly mismatched with current context (methodology/toolset changed)
  ④ Contradictions between recalled knowledge pieces

Verification Methods (from lowest to highest cost):

  Method 1: Use Claude's built-in knowledge
    "I remember the quality checkpoint system has validators, but specific rules uncertain...
     But my training data has the relevant reference, can confirm directly"
    → Cost: Low (no tool call needed)
    → Applicable: Common technical point detail confirmation

  Method 2: Check project code
    "Not sure which version of the process this project uses...
     Just check the configuration file"
    → Cost: Medium (need to read file)
    → Applicable: Technical details related to current project

  Method 3: Search external resources
    "I haven't touched this new technology, need to check docs"
    → Cost: High (need web search)
    → Applicable: New knowledge/unfamiliar domains


##### Knowledge Update After Verification


External verification is not just "complete current gap", but also write
verification result back to knowledge graph:

  ① If confirmed certain detail → Update to corresponding knowledge entry's
                                   description
  ② If discovered knowledge outdated → Mark contradiction, trigger correction
                                      mechanism
  ③ If learned new knowledge → Create new HYPOTHESIS entry
  ④ If confirmed knowledge still valid → Update last_verified time

This way, next recall will have more complete, more accurate knowledge.


---

#### Core Difference from Old Approach


Old Approach (Multi-path Parallel Recall):
  Input → 5 paths query simultaneously → Score sort → Top-5 → Use directly
  Problem: Complex, rigid, recalled knowledge treated as truth

New Approach (Associative Recall + Fragment Completion):
  Input → Most relevant naturally surfaces → Follow fragments to complete →
  If incomplete, look up → Confirm before use
  Advantage: Simple, flexible, knows "memory may not be correct"


### Simulation Contradiction Report

When Simulate Engine discovers certain knowledge inaccurate, generate contradiction report:


────────────────────────────────────────
  Value Function Contradiction Report
────────────────────────────────────────
  Conflicting Knowledge: K001 (CORRECTIVE|INTERFACE|LOW, q=0.90, CONFIRMED)
  Contradiction Location: Step 2 of simulating Solution A
  Contradiction Content:
    - K001's context: Tech stack v1, no migration needed
    - Current discovery: Tech stack v2 needs extra migration step
    - Impact: K001's value not applicable to current context
  Contradiction Level: PARTIAL (partial contradiction, reason is
                             context change)
  Handling Suggestion:
    - Don't reference K001 in current simulation
    - If methodology/toolset v2 knowledge entry exists: Reference it
    - If not: Create new HYPOTHESIS entry K004
────────────────────────────────────────


### Contradiction Level and State Transition

| Level | Trigger Condition | Operation on Knowledge Entry |
|-------|-------------------|------------------------------|
| FULL | Historical prediction direction completely opposite from actual | Entry status downgrades one level: CONFIRMED→DISPUTED, PROVISIONAL→REFUTED |
| PARTIAL | Path different but direction same (context change) | Don't change status, add one "context mismatch" record |
| MINOR | Value slightly high/low but direction same | Normal update of n and q |

### Rollback Mechanism

When discovering overturned knowledge was actually correct:


Rollback Trigger Condition:
  Some DISPUTED or REFUTED knowledge, subsequent verification discovers
  it was actually correct

Rollback Process:
  1. Locate target entry: By id or feature_key + timestamp
  
  2. Check rollback feasibility:
     - If "CONFIRMED snapshot" exists for that entry → Can directly restore
     - If no snapshot but detailed history records → Rebuild CONFIRMED entry
     - If neither → Create new HYPOTHESIS, use remembered value
  
  3. Execute rollback:
     - Change target entry's status back to CONFIRMED
     - Mark the entry that caused it to be overturned as DISPUTED
       (or REFUTED if sufficient evidence)
     - Record rollback reason to knowledge change log

  4. After rollback:
     - Restored entry inherits original n and q
     - Variance σ² increases by 0.05 (mark it experienced a fluctuation)
     - When querying during simulation, rolled back entries output
       "rolled back" marker

Rollback Example:
  K001 (CORRECTIVE|INTERFACE|LOW, q=0.90, CONFIRMED, methodology/toolset v1)
    → Tech stack upgrades to v2, new knowledge K002 (q=0.30, PROVISIONAL)
      appears
    → K001 marked as DISPUTED
    → Later verified K002 was sporadic issue, K001 still applies under
      methodology/toolset v2
    → Rollback: K001 restored to CONFIRMED, K002 marked as REFUTED
    → Knowledge change log records this complete back-and-forth


### Knowledge Change Log

Each knowledge entry's status change is recorded, forming complete historical trace:


Knowledge Change Log:
  # K001 Lifecycle
  2026-05-01: K001 created (CORRECTIVE|INTERFACE|LOW, q=0.90, HYPOTHESIS)
  2026-05-10: K001 → PROVISIONAL (1st verification successful)
  2026-05-20: K001 → CONFIRMED (3rd verification successful, n=3)
  2026-06-01: K001 → DISPUTED (contradicts K002, methodology/toolset v1 vs v2)
  2026-06-05: K001 → CONFIRMED (rollback, K002 refuted)
  
  # K002 Lifecycle
  2026-06-01: K002 created (CORRECTIVE|INTERFACE|LOW, q=0.30, HYPOTHESIS)
  2026-06-02: K002 → PROVISIONAL (1st verification)
  2026-06-05: K002 → REFUTED (verified as sporadic issue, K001 restored)

  # Current Active Knowledge Summary
  CONFIRMED: K001(q=0.90, methodology/toolset v1), K003(q=0.80, general)
  PROVISIONAL: None
  DISPUTED: None
  REFUTED: K002(q=0.30, methodology/toolset v2, refuted)
  HYPOTHESIS: None


### Value Function Storage Format

Memory file stores complete knowledge graph. **Knowledge divided into "active" and "archived" parts, simulating human brain's "current consciousness" and "long-term memory".**

#### Storage and Management

Archive/recall/cleanup operations:
node $P/scripts/knowledge.js status
Storage path: ~/.claude/data/skills/ponder/memory/
(physically isolated from skill code)