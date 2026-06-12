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

```
After receiving task, immediately execute following constraint detection,
cannot skip:

┌──────────────────────────────────────────────────────────────────┐
│  Constraint Detection Checklist                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  □ Tech Stack Constraints:                                       │
│    Is the tech stack involved in task already in current project?│
│    What language, framework, database, middleware is project     │
│    using?                                                        │
│    Any version restrictions? (e.g., only Java 8, not 17)         │
│                                                                  │
│  □ Dependency Constraints:                                       │
│    Can new third-party dependencies be introduced?               │
│    ("Cannot introduce external dependencies")                    │
│    If yes, any version or license restrictions?                  │
│                                                                  │
│  □ Architecture Constraints:                                     │
│    Any hard architecture design rules? (must be microservices,   │
│    must be monolithic)                                           │
│    Any design patterns that cannot be used or must be used?      │
│                                                                  │
│  □ Policy/Compliance Constraints:                                │
│    Any company or industry policy restrictions?                  │
│    (Data cannot leave region, must have audit logs, etc.)        │
│                                                                  │
│  □ Performance Constraints:                                      │
│    Any performance requirements?                                 │
│    (Response time, throughput, concurrency)                      │
│                                                                  │
│  □ Security Constraints:                                         │
│    Any security requirements?                                    │
│    (Encryption standards, auth methods, OWASP compliance, etc.)  │
│                                                                  │
│  □ Time/Cost Constraints:                                        │
│    Any deadline or budget limits?                                │
│                                                                  │
│  □ Implicit Constraints:                                         │
│    Constraints user didn't explicitly say but can infer from     │
│    project context?                                              │
│    (e.g., Project uses MySQL → Cannot use MongoDB)               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
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