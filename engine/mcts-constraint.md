---
name: mcts-constraint
description: MCTS-TD Decision Engine "Step 0" — Requirement Constraint Collection System + Xuanxue/Zhanbu Enhancements. Systematically collect all constraints before solution generation to prevent "finished then realized wrong".
---

# Step 0: Requirement Constraint Collection

> **🔒 COMPRESSION-SAFE RULES (Always apply, even if context is compressed):**
> 1. **OUTPUT LANGUAGE**: User language already detected. Continue using that language.
> 2. **⛔ MUST ASK WHEN UNCLEAR**: If constraints are ambiguous (deps, tech stack, architecture, security, performance), ASK USER before generating solutions. Never assume: "probably ok".
> 3. **⛔ DEMAND REFINEMENT (Demand Refinement) — mandatory before generating any solution**: If the user's request is missing critical information (tech stack, constraints, preferences, boundaries), PAUSE and use AskUserQuestion to refine. NEVER generate solutions on incomplete requirements.
> 4. **HARD vs SOFT**: Hard constraints → eliminate violating solutions. Soft constraints → lower match score.
> 5. **SOURCE TRACKING**: Mark each constraint's origin: user-explicit / code-inferred / knowledge-graph / assumed.
> 6. **⛔ DECOMPOSITION CHECK**: Before concluding constraint collection is done, run `node scripts/mcts_guard.js decomposition-guard` to verify no premature "single solution" judgment.
> 7. **ROOT-BRANCH**: After five-diagnosis, identify the root dimension (ben) — its constraints are "super-hard" (non-negotiable).
> 8. **ABSENCE DETECTION**: For each dimension, check not just what constraints exist but what constraints are MISSING (that should normally be present).
> 9. **RELATIONAL TENSION**: Compute tension between dimension pairs; high-tension pairs drive diverge priority.
> 10. **动静 (MOVEMENT-STILLNESS)**: Before engine engages, determine mode: user needs fast action (动 → simplified engine) or deep analysis (静 → full engine). Signal from user message + decision complexity.

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

## 0.1 Requirement Portrait — 五诊 (Wuzhen) Diagnosis

> "知彼知己，胜乃不殆；知天知地，胜乃可全" — Sunzi Bingfa · Dixing
>
> Constraint collection must go beyond tech. People, organization, culture,
> timing — missing these dimensions leads to technically viable but
> practically unlandable solutions. 五诊 ensures every dimension is scrutinized.

Before the 9-item technical checklist, scan requirements with 五诊 portrait.
**If any dimension has insufficient info, MUST ask the user.**

Code-enforced: `node scripts/mcts_compute.js five-diagnosis --scores '{"tian":8,"di":4,"ren":2,"fa":7,"wu":5}'`

### Five Diagnosis Dimensions

> **DESIGN PRINCIPLE: These 5 dimensions are DOMAIN-AGNOSTIC.**
> They apply to software, medicine, education, driving, cooking — any field.
> The "concrete questions" under each dimension are EXAMPLES — LLM must
> adapt them to the user's specific domain. Never assume "software project".

```
┌─────────────────────────────────────────────────────────────────────┐
│  五诊 (Wuzhen) Requirement Portrait — "望闻问切" + "五事七计"        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ① 天 (Tian) · Timing & Context                                    │
│     "天者，阴阳、寒暑、时制也" — Sunzi Bingfa                       │
│                                                                     │
│     ABSTRACT: When is this happening? What's the temporal context?  │
│     Generic probes (adapt to ANY domain):                           │
│     - What stage is this? (starting / growing / mature / scaling)   │
│     - Time pressure: hard deadline or flexible?                     │
│     - External environment: stable / changing / turbulent?          │
│     - Window of opportunity: is there one? closing soon?            │
│                                                                     │
│     Domain examples:                                                │
│     · Software: sprint deadline? tech stack maturity?               │
│     · Medicine: acute/chronic? treatment window? comorbidity stage? │
│     · Education: semester start/mid/end? student readiness?         │
│     · Driving: weather? road conditions? time of day?               │
│     ⚠️ If not asked → solution may miss window or mismatch pace    │
│                                                                     │
│  ② 地 (Di) · Resources & Constraints                               │
│     "地者，远近、险易、广狭、死生也" — Sunzi Bingfa                  │
│                                                                     │
│     ABSTRACT: What do you have to work with? What are the limits?   │
│     Generic probes:                                                 │
│     - People: who's involved? how many? skill/experience level?     │
│     - Budget/money: any financial limits?                           │
│     - Physical/material: what's available? can acquire more?        │
│     - Dependencies: any locked-in choices? external constraints?    │
│                                                                     │
│     Domain examples:                                                │
│     · Software: team size? infra? can add dependencies?             │
│     · Medicine: available drugs? equipment? hospital capacity?      │
│     · Education: class size? materials? classroom setup?            │
│     · Driving: vehicle condition? fuel? route alternatives?         │
│     ⚠️ If not asked → solution may exceed actual execution capacity│
│                                                                     │
│  ③ 人 (Ren) · People & Culture                                     │
│     "上下同欲者胜" — Sunzi Bingfa                                   │
│     "人和不如地利，地利不如天时" — Mengzi                            │
│                                                                     │
│     ABSTRACT: Who is affected? What do they want? Will they accept? │
│     Generic probes:                                                 │
│     - Who is impacted by this decision? (directly & indirectly)     │
│     - What do they want/need? What habits/preferences?              │
│     - Who benefits? Who might resist? Who has final say?            │
│     - Who will live with the outcome long-term?                     │
│                                                                     │
│     Domain examples:                                                │
│     · Software: end users? stakeholders? team culture?              │
│     · Medicine: patient preferences? family? care team dynamics?    │
│     · Education: student learning styles? parent expectations?      │
│     · Driving: passengers? other drivers? traffic culture?          │
│     ⚠️ If not asked → optimal on paper but rejected in practice    │
│                                                                     │
│  ④ 法 (Fa) · Rules & Governance                                    │
│     "法者，曲制、官道、主用也" — Sunzi Bingfa                        │
│                                                                     │
│     ABSTRACT: What rules must be followed? What's forbidden?        │
│     Generic probes:                                                 │
│     - What regulations/standards apply? (formal or informal)        │
│     - What is explicitly forbidden?                                 │
│     - What process must be followed? (approval, review, etc.)       │
│     - What constraints come from the structure/framework?           │
│                                                                     │
│     Domain examples:                                                │
│     · Software: compliance? CI/CD? architecture constraints?        │
│     · Medicine: clinical guidelines? consent? licensing?             │
│     · Education: curriculum standards? school policy? accreditation? │
│     · Driving: traffic laws? company fleet policy? insurance?       │
│     ⚠️ If not asked → solution may violate hard constraints        │
│                                                                     │
│  ⑤ 物 (Wu) · Essence & Purpose                                     │
│     "大道至简" — Laozi                                              │
│     "知止而后有定，定而后能静" — Daxue                               │
│                                                                     │
│     ABSTRACT: What is this REALLY about? What matters most?         │
│     Generic probes:                                                 │
│     - Core purpose: what is the real goal (strip the packaging)?    │
│     - Success criteria: how to judge "done"?                        │
│     - Deal-breakers: what is absolutely unacceptable?               │
│     - Priority: if only one thing can be done, what?                │
│     - Expected impact: what change after completion?                │
│                                                                     │
│     Domain examples:                                                │
│     · Software: what problem does this feature actually solve?      │
│     · Medicine: what's the treatment goal? palliative vs curative?  │
│     · Education: what should students actually learn?               │
│     · Driving: what's the real destination? shortest vs safest?     │
│     ⚠️ If not asked → solution may miss the real target            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Follow-up Question Strategy

```
When executing 五诊 portrait, follow these rules:

① Scan 5 dimensions, mark info sufficiency per dimension:
   sufficient (≥7) → record, no follow-up
   partial (4-6) → ask 1-2 key questions
   severe (≤3) → MUST ask, provide guided options (AskUserQuestion)

② Follow-up principles:
   - Don't re-ask what user already answered
   - Don't ask what can be inferred from available info (check yourself)
   - Only ask what "only the user would know"
   - Max 3-5 questions per round
   - ADAPT questions to user's domain — never assume software

③ Good vs bad follow-up examples:
   ✅ "Who's most affected by this decision? What do they want?"
   ✅ "Any deadline? Hard or flexible?"
   ✅ "What's the real goal here? What does success look like?"
   ❌ "Who maintains the system?" (assumes software — what if user is a doctor?)
   ❌ "What's your tech stack?" (domain-specific — should infer or ask generically)
   ✅ "Any deadline? Hard or flexible?"
   ✅ "What are end users accustomed to? Can they handle big changes?"
   ❌ "What's your tech stack?" (should read package.json/go.mod yourself)
   ❌ "Any requirements?" (too vague, user doesn't know where to start)

④ Cross-dimension validation (5 pairs from tension scan):
   Tian (timing) ↔ Ren (people): does window match team readiness?
   Di (resources) ↔ Fa (rules): are resources sufficient for governance standards?
   Wu (essence) ↔ Tian (timing): is core goal achievable within current timing?
   Ren (people) ↔ Wu (essence): do stakeholder needs align with core purpose?
   Wu (essence) ↔ Fa (rules): does regulation block the core goal?
   → Cross-dimension contradiction found → ask user to clarify
   → High-contrast pair (|score_diff|≥4) → mark as TENSION HOTSPOT for diverge
```

### Portrait Output Format

```
────────────────────────────
 【Requirement Portrait · 五诊合参】
 Task: [xxx]

 ① 天 (Tian) · Timing  [7/10] sufficient
   - Stage: 1→10 growth
   - Time: 2 weeks, flexible
   - Environment: team steady phase

 ② 地 (Di) · Resources  [4/10] partial ← ask
   - Team: ? (needs asking)
   - Budget: ? (needs asking)
   - Known: existing K8s cluster available

 ③ 人 (Ren) · People  [3/10] severe ← MUST ask
   - End users: ? (needs asking)
   - Maintainers: ? (needs asking)
   - Stakeholders: ? (needs asking)

 ④ 法 (Fa) · Rules  [8/10] sufficient
   - Compliance: GDPR applies
   - Tech stack: Go 1.21 + gin (code-inferred)
   - Architecture: microservices

 ⑤ 物 (Wu) · Essence  [5/10] partial ← ask
   - Core purpose: improve API response speed
   - Success criteria: ? (needs asking)
   - Deal-breakers: ? (needs asking)

 Questions to ask (3):
   Q1: Who maintains this? Team size and skill level?
   Q2: Who are end users? How much change can they accept?
   Q3: Success criteria? What P99 latency counts as "success"?

 Cross-dimension findings:
   Tian↔Ren: 2-week deadline but only 1 person → may need scope reduction

 Root (Ben): 物(Wu) — core goal drives all other dimensions
 Absence alerts:
   人(Ren): no opposition stated — suspicious? → ask
   物(Wu): no success criteria — critical gap → ask
 Tension hotspots:
   天↔地: |7-4|=3 NORMAL, 人↔物: |3-5|=2 NORMAL, 法↔地: |8-4|=4 HOTSPOT
 ────────────────────────────
```

---

## 0.1b Xuanxue Enhancements — 本末·有无·张力

> Three structural rules embedded AFTER five-diagnosis, BEFORE constraint checklist.
> Source: Wei-Jin Xuanxue (玄学) + Zhanbu (占卜·六壬).
> Design principle: domain-agnostic, zero new steps, all are CHECKs on existing output.

### 本末 (Root-Branch) — Root Dimension Identification

After five-diagnosis scores are collected, identify which dimension is the **root** (ben)
that other dimensions depend on. 物(Wu·Essence) finds "what is the core"; 本末 finds
"which dimension sustains the others."

```
Rule:
  After 五诊 output, add:

  Root (Ben): [which dimension other dimensions depend on]
  Dependency map:
    物(Wu) ←root→ [primary dependency — usually 天 or 物 itself]
    天(Tian) ←supports→ 物(Wu)
    地(Di) ←enables→ 人(Ren), 法(Fa)
    法(Fa) ←guards→ 物(Wu)

  Constraint severity by root distance:
    Root dimension constraint violated → SUPER-HARD (non-negotiable)
    Adjacent dimension constraint violated → HARD (need replacement)
    Peripheral dimension constraint violated → SOFT (downgrade only)

Code-enforced: `node scripts/mcts_compute.js root-branch --scores '<JSON>'`
```

### 有无 (Absence Detection) — Missing Constraint Scan

For each five-diagnosis dimension, check not just "what constraints exist" but
"what constraints are ABSENT that should normally be present." The absence of a
constraint is itself critical information — it defines the free space, and unusual
absences often signal overlooked requirements.

```
Rule:
  After listing constraints per dimension, add:

  Absence Scan:
    天(Tian): missing=[what time constraints are NOT specified? unusual?]
    地(Di):   missing=[what resource limits are NOT stated? budget? headcount?]
    人(Ren):  missing=[who is NOT represented? no opposition = suspicious?]
    法(Fa):   missing=[what governance is NOT mentioned? audit? compliance?]
    物(Wu):   missing=[what success criteria are NOT defined? deal-breakers?]

  "Abnormal absence" = a constraint that normally exists in this domain
  but was not mentioned → mark as blindspot → Info Gap phase asks about it.

  Example:
    A medical decision with no consent constraints mentioned → abnormal absence
    A software project with no budget mentioned → abnormal absence
    A driving decision with no safety rules mentioned → abnormal absence

Code-enforced: `node scripts/mcts_compute.js absence-detect --domain '<str>' --constraints '<JSON>'`
```

### Relational Tension — Dimension-Pair Friction (六壬 Method)

After five-diagnosis, compute tension between key dimension pairs.
High tension = those pairs need MORE exploration in diverge phase.
Low tension = routine handling.

```
Rule:
  Compute tension for these 3 key pairs (from 六壬 四课 relational method):

    天↔地: timing pressure vs resource sufficiency → tension = |tian_score - di_score|
    人↔物: stakeholder needs vs core purpose → tension = |ren_score - wu_score|
    法↔地: governance requirements vs resource limits → tension = |fa_score - di_score|

  Also check:
    天↔人: timing vs people readiness
    物↔法: core goal vs rules (does regulation block the goal?)

  Tension ≥4: HOTSPOT → diverge engine prioritizes this intersection
  Tension 2-3: NORMAL → standard treatment
  Tension ≤1: STABLE → quick pass

Code-enforced: `node scripts/mcts_compute.js tension-scan --scores '<JSON>'`
```

### 动静 (Movement-Stillness) — Engine Mode Meta-Control

Source: Xuanxue·动静. "Stillness is not the opposite of movement —
stillness is the root of movement." Before the engine engages, determine
whether the user needs fast action (动) or deep analysis (静).

```
Rule:
  During Step 0 DECOMPOSE, after detecting decision points, determine mode:

  Signal detection:
    - User message contains urgency markers: "紧急/马上/尽快/ASAP/now/quick"
      → 动(Dong) mode → simplified engine
    - User message contains depth markers: "重要/慎重/全面/长期/careful/important"
      → 静(Jing) mode → full engine
    - No explicit signal → judge from decision complexity:
      Only 1 viable option after decompose → 动 mode (quick confirm & execute)
      3+ viable options with high uncertainty → 静 mode (deep analysis)

  Mode effects:
    静 (Full): all phases, 8-10 MCTS iterations, complete cross-association
    动 (Simplified): all phases but compressed — 3-5 MCTS iterations,
      skip Round 3 (changing-condition analysis), reduce cross-association
      to top-2 pairs only, simplified self-check

  Mode switch: if during 动 mode execution, unexpected complexity emerges
    (e.g. a solution reveals hidden dependencies), upgrade to 静 mode.

  Self-check addition (Phase 3.5): "Have we been in deep analysis so long
    that a simpler action would have been more effective?" (静→动 bias check)
    "Have we acted so quickly that we missed structural considerations?"
    (动→静 bias check)

Code-enforced: `node scripts/mcts_compute.js dong-jing --message '<str>' --decision-count <N>`
```

---

## 0.2 Technical Constraint Checklist

Run `node scripts/mcts_guard.js constraint-checklist` to see the full checklist (9 items:
tech_stack, dependencies, architecture, compliance, performance, security,
time_budget, backward_compat, user_preference).

```
After five-diagnosis portrait, supplement with technical checklist.
Items with auto_detect=true can be checked from project code.
Items with auto_detect=false MUST be asked to the user — never assume.
Technical constraints are a SUBSET of 五诊画像 — not a replacement.
```

---

## 0.3 Constraint Sources

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

## 0.4 Handling Missing Constraints

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
  ⛔ "Cannot fabricate" ≠ "output empty template only". Correct: search public data → output real data rows → annotate uncertainty [source pending verification]
  ⛔ "No live web scraping capability" ≠ "cannot output any data". Correct: search existing public datasets → cite verifiable public info
  ⛔ "I am an AI" ≠ "I cannot do anything". Correct: search → find APIs → organize existing public data → give usable data to user
```

## 0.5 Dealing with Low Facet Scores in the Eight-Facet Mirror

```
When any facet in the Eight-Facet Mirror scores ≤3 (meaning "I know very little about this"):

1. This is NOT a reason to skip that dimension or output an empty template
2. The correct response is:
   a) WebSearch for external information about the low-scoring dimension
   b) ASK THE USER about the specific gap — "Do you have relevant data sources or API links?"
   c) ONLY after search + user confirmation, re-rate the facet
3. ⛔ Do NOT justify "I can't do X" as a facet score without first trying to DO something about it
4. ⛔ Do NOT use "用户自己选的方案" as an excuse to skip delivering real value
```

---

## 0.6 Constraint Impact on Solutions

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

## 0.7 Handling Constraint Changes

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
