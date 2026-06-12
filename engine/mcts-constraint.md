---
name: mcts-constraint
description: MCTS-TD Decision Engine "Step 0" — Requirement Constraint Collection System. Systematically collect all constraints before solution generation to prevent "finished then realized wrong".
---

# Step 0: Requirement Constraint Collection

> **🔒 COMPRESSION-SAFE RULES (Always apply, even if context is compressed):**
> 1. **OUTPUT LANGUAGE**: User language already detected. Continue using that language.
> 2. **⛔ MUST ASK WHEN UNCLEAR**: If constraints are ambiguous (deps, tech stack, architecture, security, performance), ASK USER before generating solutions. Never assume: "probably ok".
> 3. **⛔ DEMAND REFINEMENT (需求补全) — mandatory before generating any solution**: If the user's request is missing critical information (tech stack, constraints, preferences, boundaries), PAUSE and use AskUserQuestion to refine. NEVER generate solutions on incomplete requirements.
> 4. **HARD vs SOFT**: Hard constraints → eliminate violating solutions. Soft constraints → lower match score.
> 5. **SOURCE TRACKING**: Mark each constraint's origin: user-explicit / code-inferred / knowledge-graph / assumed.
> 6. **⛔ DECOMPOSITION CHECK**: Before concluding constraint collection is done, run `node scripts/mcts_guard.js decomposition-guard` to verify no premature "single solution" judgment.

> ⚠️ **OUTPUT LANGUAGE RULE (HIGHEST PRIORITY)**: All user-facing output MUST be in the user's detected language. If user writes in Chinese → output Chinese. If Japanese → output Japanese. This is NON-NEGOTIABLE. Internal reasoning is English; user sees their language.

> **One-liner**: Before starting any solution generation, first clarify all "what cannot be done" and "what must be done".
> Constraints are boundary conditions for solution generation — boundaries unclear, solutions unreliable.

---

## Why Separate Constraint Collection is Needed

```
In real projects, many "did it wrong" are not because solution was bad,
but because constraints weren't clarified before starting:

  Example 1: "Help me refactor the login module"
    Didn't collect constraints → Chose OAuth2 solution → Project rule
      "Cannot introduce external dependencies"
    → All wasted
  
  Example 2: "Optimize this API's performance"
    Didn't collect constraints → Did caching solution → User says
      "Data must be real-time"
    → Caching solution all wasted

Constraint Collection = First step to doing right thing
```

---

## 0.1 Constraint Detection Checklist

Run `node scripts/mcts_guard.js constraint-checklist` to see the full checklist (9 items:
tech_stack, dependencies, architecture, compliance, performance, security,
time_budget, backward_compat, user_preference).

```
After receiving task, immediately execute the checklist above.
Each item must be checked before proceeding.
Items with auto_detect=true can be checked from project code.
Items with auto_detect=false MUST be asked to the user — never assume.
```

---

## 0.2 Constraint Sources

```
Constraint info obtained from following channels (by priority):

1. User explicitly stated → Record directly
   "User said: Cannot introduce external dependencies"
   → Mark as "Hard Constraint", cannot break

2. Project code inferred → Discovered by reading code
   "Project uses gin framework, no other auth middleware"
   → Mark as "Fact Constraint", determined by code facts

3. Industry/Technical common knowledge → Reasoned from technical knowledge
   "If project is financial system, audit logs may be implicit need"
   → Mark as "Inferred Constraint", need to confirm with user

4. Similar tasks in knowledge graph → Inferred from historical experience
   "Similar project (K003) also had same policy restriction"
   → Mark as "Experience Constraint", can reference but need confirmation
```

---

## 0.3 Handling Missing Constraints

```
When discovering constraint info is incomplete:

case Can self-confirm (from project code/technical knowledge):
  → Self-confirm, record as "Fact Constraint"
  case "Project uses gin framework" → Read go.mod → Confirm → Record
  case "MySQL version" → Read config → Confirm → Record

case Cannot self-confirm (must ask user):
  → Pause → Ask user → Get answer → Continue
  case "Can external dependencies be introduced" → Must ask user,
    cannot assume "probably ok"
  case "Any performance requirements" → Ask user,
    cannot assume "handle normally"

case User answered but info incomplete:
  → Follow-up question, until constraint is clear
  → "You said cannot introduce external dependencies — does that mean
     cannot introduce new third-party libs, or includes existing
     dependency upgrades too?"

case User's "restriction" is being misinterpreted as "I shouldn't do anything":
  ⛔ "不能编造" ≠ "只能输出空模板"。正确做法: 搜索公开数据 → 输出真实数据行 → 不确定性标注【来源待核实】
  ⛔ "没有实时爬虫能力" ≠ "不能输出任何数据"。正确做法: 搜索已有公开数据集 → 引用可验证的公开信息
  ⛔ "我是AI" ≠ "我什么都不能做"。正确做法: 搜索 → 查找API → 整理已有公开数据 → 给用户可用的数据
```

## 0.4 Dealing with Low Facet Scores in the Eight-Facet Mirror

```
When any facet in the Eight-Facet Mirror scores ≤3 (meaning "I know very little about this"):

1. This is NOT a reason to skip that dimension or output an empty template
2. The correct response is:
   a) WebSearch for external information about the low-scoring dimension
   b) ASK THE USER about the specific gap — "你是否有相关的数据源或API链接？"
   c) ONLY after search + user confirmation, re-rate the facet
3. ⛔ Do NOT justify "I can't do X" as a facet score without first trying to DO something about it
4. ⛔ Do NOT use "用户自己选的方案" as an excuse to skip delivering real value
```

---

## 0.4 Constraint Impact on Solutions

```
Collected constraints directly affect solution generation:

Hard Constraints (cannot break):
  "Cannot introduce external dependencies"
    → Exclude all solutions requiring new dependencies
  "Only Java 8 allowed"
    → Exclude solutions using Java 17 features
  
  Effect: Pruning, reduce invalid solution generation

Soft Constraints (optional, but affects match score):
  "Prefer MySQL, but PostgreSQL also ok"
  "Performance not critical, but don't be too slow"
  
  Effect: Affects Project Match Score M calculation
  If solution violates soft constraint → Match score M decreases
  If solution satisfies soft constraint → Match score M increases
```

---

## 0.5 Handling Constraint Changes

```
If discovering new constraint during simulation (didn't know before):

1. Add new constraint to constraint list
2. Evaluate existing solutions against new constraint:
   → Violates hard constraint → Solution directly eliminated
   → Violates soft constraint → Recalculate project match score M
3. If all solutions violate hard constraints → Return to Diverge Engine
   to regenerate solutions
4. Update global completion box: Record new constraint discovery

Example:
  During SolutionC simulation discovered "Company policy cannot introduce
  external dependencies"
  → SolutionC (OAuth2) violates hard constraint → Eliminated
  → SolutionA (gin-jwt) and SolutionB (self-implement JWT) unaffected →
    Continue
```

---

## Constraint Output Format

Before Diverge Engine executes, need to output constraint list:

```
────────────────────────────
 【Requirement Constraint List】
 Task: [Implement user login feature]

 Hard Constraints:
   [✓] Cannot introduce external dependencies (User explicitly stated)
   [✓] Only Go standard library + gin framework allowed (Project code
       inferred)
   [✓] Password must use bcrypt encryption (Security requirement)

 Soft Constraints:
   [ ] Prefer OAuth2 extension support (Inferred, unconfirmed)
   [ ] Performance not critical (User said "just needs to run")
   [✓] Need to be compatible with existing user table structure (Code
       inferred)

 Constraint Sources:
   User explicit: 2 items
   Code inferred: 2 items
   Inferred pending confirmation: 1 item
 ────────────────────────────
```