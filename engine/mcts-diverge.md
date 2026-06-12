---
name: mcts-diverge
description: MCTS-TD Decision Engine "Step 1" — Diverge Engine. Diverge (Eight-Facet Mirror iterative review + free association) → Converge (extract structured solution list). Core capability: during divergence, no angle is missed; during convergence, clear executable decision options are extracted from chaos.
---

# Step 1: Diverge Engine — Diverge × Converge

> **🔒 COMPRESSION-SAFE RULES (Always apply, even if context is compressed):**
> 1. **OUTPUT LANGUAGE**: User language already detected. Continue using that language.
> 2. **PHASE ORDER**: Review Map → Recon Report → Solution List. Each MUST be output before proceeding.
> 3. **LANGUAGE GUARD**: `node scripts/language_guard.js check --user-lang <lang> --output "..."` verifies output language.
> 4. **NO SKIP**: Do not skip any phase. Do not collapse phases into one summary.
> 5. **⛔ ANTI-SINGLE-SOLUTION**: Before claiming "only one solution", run `node scripts/mcts_guard.js decomposition-guard --claim '<JSON>'`. If BLOCKED, expand facets and list alternatives.
> 6. **⛔ DIVERSITY CHECK**: If <3 solutions generated, run `node scripts/mcts_guard.js diversity-challenge --solutions '<JSON>'`. If BLOCKED, generate more angles.
> 7. **COMPLIANCE**: When in doubt, run `node scripts/mcts_guard.js all-guards` for full checklist.

> ⚠️ **OUTPUT LANGUAGE RULE (HIGHEST PRIORITY)**: All user-facing output MUST be in the user's detected language. If user writes in Chinese → output Chinese. If Japanese → output Japanese. This is NON-NEGOTIABLE. Internal reasoning is English; user sees their language.

> **Diverge Engine = Diverge Phase + Converge Phase. Both are indispensable.**
> Diverge: Using the Eight-Facet Mirror as framework, perform multi-round, multi-angle, cross-associative thinking divergence on user needs, collecting as much information as possible.
> Converge: Extract 2~8 structured, executable, substantially different solutions from the chaos produced by divergence.
>
> **Diverge for completeness, Converge for quality. Only diverge without converge = a pile of ideas that cannot be executed. Only converge without diverge = solutions that are partial and miss key angles.**

---

## Diverge Engine Full Flow

The diverge engine is fundamentally **conversational**. It's not a monologue — it's a back-and-forth with the user. The engine brings the framework (Eight-Facet Mirror, structured thinking); the user brings domain knowledge, preferences, and constraints. **Best results come from active user engagement, not passive acceptance.**

```
User Need
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  🗣️ GRILL THE USER — Before any analysis, engage:        │
│                                                         │
│  ① PARAPHRASE: "I understand you want to [X]. Is that    │
│     correct? Are there other aspects I should consider?"  │
│  ② PROBE: "What have you already tried or considered?"   │
│  ③ CONSTRAIN: Ask the 2-3 most critical constraints      │
│     using structured AskUserQuestion (not free text).     │
│     Example: "Any dependency limits?" → [Yes, none /      │
│     Must use Go+gin / No external deps at all]            │
│                                                         │
│  ⚠️ Do NOT skip this. The user knows things you don't.   │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│       🔭 HORIZON SCAN — Before Eight-Facet Mirror       │
│       "跳出井底，先看世界"                               │
│                                                         │
│  Before locking into the 8-facet framework, expand your │
│  view first. Execute ALL of the following:               │
│                                                         │
│  ① WebSearch: "what are the standard approaches for     │
│     [user_task] in the industry"                         │
│     → Find out what exists OUTSIDE your own knowledge   │
│     → 3 search queries minimum                          │
│     → Report: "Existing approaches I found: ..."        │
│                                                         │
│  ② WebSearch: "unconventional methods / alternatives    │
│     for [user_task]"                                     │
│     → Find things you WOULDN'T normally think of         │
│     → Report: "Unconventional ideas: ..."               │
│                                                         │
│  ③ Cross-domain analogy: "What other industries/fields  │
│     solve similar problems?"                             │
│     → If the task is "data crawling", look at            │
│       journalism, intelligence, scientific research      │
│     → Report: "Cross-domain patterns: ..."              │
│                                                         │
│  Output: [Horizon Scan Report]                          │
│  Title: "🔭 地平线扫描 — [task name]"                     │
│  Content: Industry standard approaches + Unconventional │
│           ideas + Cross-domain analogies                │
│                                                         │
│  ⛔ ABSOLUTELY FORBIDDEN:                               │
│  • Skipping WebSearch and relying on internal knowledge │
│  • Starting the Eight-Facet Mirror without horizon scan │
│  • "I already know about this topic" — still search.    │
│    External knowledge > your training data               │
│  • Reporting "0 results" from WebSearch — keep trying   │
│    different search terms                               │
│                                                         │
├─────────────────────────────────────────────────────────┤
│       🗣️ SURPRISE & CONFIRM — Horizon Scan Feedback      │
│       "Show the user what you found that they didn't     │
│        know to ask for"                                   │
│                                                         │
│  AFTER completing Horizon Scan but BEFORE entering       │
│  Eight-Facet Mirror, you MUST present your findings      │
│  to the user and ask them for direction.                 │
│                                                         │
│  Format (in user's language):                            │
│    "🔍 I searched and found some areas you might be      │
│     interested in:                                       │
│      ① [Finding 1] — this could be relevant because...   │
│      ② [Finding 2] — relates to your need in this way... │
│      ③ [Finding 3] — there are unknowns here...          │
│      Which direction should I explore first?"            │
│                                                         │
│  The purpose of this step:                               │
│  • Show the user things they DIDN'T ask about but        │
│    MIGHT find valuable — the "用户自己都不知道" moment   │
│  • Let the user CHOOSE the direction — don't assume      │
│  • Validate that your search is in the right ballpark    │
│                                                         │
│  ⛔ Do NOT skip this step. Do NOT proceed directly to    │
│     Eight-Facet Mirror without presenting findings.      │
│  ⛔ Do NOT just summarize — ask SPECIFIC questions        │
│     about what you discovered that the user didn't ask   │
│     for. The output must be in the user's language.       │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                Diverge Phase (Brainstorming)            │
│                                                         │
│  Now proceed to Eight-Facet Mirror, informed by the     │
│  horizon scan above. Each facet should reference what   │
│  you found during the scan.                             │
│                                                         │
│  Eight-Facet Mirror iterative review: not "go once",    │
│  but "reflect repeatedly"                               │
│    Facet1→Facet8: review each facet                     │
│    Cross-facet association (Facet5 discovery triggers   │
│      Facet2 re-review)                                  │
│    Blindspot completion (if missing info, go query/ask) │
│    Until each facet is thought through clearly           │
│                                                         │
│  🗣️ ENGAGEMENT CHECKPOINT (after blindspot round):       │
│    "Here are the blindspots I found in facets [X,Y,Z].  │
│     Can you tell me more about [specific question]?"    │
│    Don't guess — if you're unsure, ASK.                │
│                                                         │
│  Output: 8 facets' concrete dimensions + self-ratings   │
│          + recon findings + idea fragments              │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  🗣️ DIRECTION CHECK (before converging to solutions):     │
│                                                         │
│  "From the 8 facets, the key tensions I see are:        │
│     [Tension A] vs [Tension B]                          │
│   Which direction feels more important to you?"         │
│                                                         │
│  This is NOT asking the user to pick a solution —       │
│  it's confirming priorities before shaping solutions.   │
│  User may say "both are important" → that's useful too. │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                Converge Phase (Extract Solutions)       │
│                                                         │
│  Extract structured solutions from idea fragments       │
│  produced by divergence:                                │
│    ① Cluster: Which ideas belong to the same direction? │
│    ② Complete: Is key info missing for each direction?  │
│    ③ Cull: Remove infeasible/obviously inferior         │
│            solution directions                          │
│    ④ Crystallize: Write complete solution description   │
│            for each retained direction                  │
│                                                         │
│
│  🗣️ GRILL THE DETAILS (after direction, before culling):  │
│                                                         │
│  Present candidate directions to the user:              │
│  For each direction, ask about SPECIFICS only the user  │
│  can answer: constraints, preferences, resources, risks.│
│  Don't ask technical trivia they wouldn't know.        │
│                                                         │
│  **⛔ QUESTION QUALITY RULE**:                          │
│  • Do NOT ask "选方案A还是方案B" — that is YOUR job to decide  │
│  • Do NOT ask "你是否了解我不能做X" — that is making the user  │
│    accept your self-imposed limitation                    │
│  • DO ask "你有没有相关的数据源/链接可以提供？"               │
│  • DO ask "你是否需要我搜索某个特定领域的公开数据？"          │
│  • DO ask "你要覆盖哪些具体商品品类/国家/时间范围？"         │
│                                                         │
│  After confirming details → move to Final Triaging.     │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│         FINAL TRIAGING → Keep Exactly 3 (for MCTS)       │
│                                                         │
│  All details confirmed. Now narrow to 3 using 3 sources:│
│                                                         │
│  SOURCE 1 — MEMORY (knowledge_lifecycle.js):             │
│    Query: past similar tasks? user preference patterns?  │
│    Which approaches succeeded/failed before?             │
│                                                         │
│  SOURCE 2 — WEB INTELLIGENCE:                            │
│    Quick search: industry standard? known pitfalls?      │
│    Deprecated or bleeding edge?                          │
│                                                         │
│  SOURCE 3 — AI JUDGMENT:                                │
│    Diversity: 3 most DIFFERENT approaches (no variants)  │
│    Coverage: which cover the MOST facets?                │
│    Actionability: which are truly doable right now?       │
│                                                         │
│  ⚠️ Every dropped direction needs a specific reason.     │
│  ⚠️ All 3 kept MUST pass the user's detail check first.  │
│  ⚠️ If <3 viable → go back to user: ''Need more?.''     │
│                                                         │
│  Output: 3 structured solutions                       │
│          (each with complete description and basis)     │
│  Confirm: Show to user, wait for confirmation before    │
│           entering Simulate Engine                      │
└──────────────────────────────────────────────────────────┘
```

---

## Phase One: Diverge (Eight-Facet Mirror Iterative Review)

### 1.1 Eight-Facet Mirror — Abstract Decision Review Framework

> The Eight-Facet Mirror is an **abstract class** — it defines 8 facets that any decision should review.
> It does not specify "what each facet is called", only defines "what questions to ask".

```
═══════════════════════════════════════════════════════════════
         Eight-Facet Decision Mirror
         
         Abstract Questions (never change)              Concrete (determined by user need)
═══════════════════════════════════════════════════════════════

Facet1: Source of Force
  Ask: "Where does the driving force for this come from?"
  Concretizes to: [determined by need — tech stack/team/experience/creative style/...]

Facet2: Foundation & Capacity
  Ask: "What is the foundation this rests on?"
  Concretizes to: [determined by need — budget/architecture/infrastructure/knowledge reserve/...]

Facet3: Change & Disruption
  Ask: "Where might unexpected changes occur?"
  Concretizes to: [determined by need — requirement changes/market shifts/sudden risks/trend turns/...]

Facet4: Penetration & Diffusion
  Ask: "How to make the effect truly penetrate and spread?"
  Concretizes to: [determined by need — user experience/distribution channels/teaching methods/influence/...]

Facet5: Risk & Abyss
  Ask: "Where is the deepest pit? What's the worst case? How to avoid it?"
  Concretizes to: [determined by need — security vulnerabilities/compliance risks/creative blocks/cognitive traps/...]

Facet6: Visible & Dependent
  Ask: "What is the most eye-catching surface? What does it depend on underneath?"
  Concretizes to: [determined by need — core features/highlight designs/key evidence/main products/...]

Facet7: Boundary & Limit
  Ask: "What lines must never be crossed? Where should we stop?"
  Concretizes to: [determined by need — laws/ethics/resource limits/physical limits/...]

Facet8: Convergence & Mutual Benefit
  Ask: "How to balance all interests? Is there a solution everyone can accept?"
  Concretizes to: [determined by need — stakeholders/users & team/creators & audience/...]
═══════════════════════════════════════════════════════════════
```

### 1.2 Divergence Method: Iterative Review + Cross-Association

```
Divergence is not "Facet1→Facet2→Facet3...→Facet8, done after one pass".
Divergence is "reflect repeatedly" — each reflection may discover something new.

Divergence Process (multi-round iteration, until each facet is thought through):

  Round 1: Initial exploration of each facet
    Facet1→Facet2→Facet3→...→Facet8, for each facet:
      - Based on user need, determine what concrete dimension this facet corresponds to
      - Self-rate (0-10): How much do I know about this dimension?
      - Blindspot identification: What info is missing?
      - Record initial ideas: From this facet's perspective, what feasible directions exist?
  
  Round 2: Cross-association
    Re-examine associations between facets:
      - Does Facet5's finding affect Facet2's judgment? If Facet5 discovered high-risk pits,
        should Facet2 adjust "what foundation to use"?
      - Are all stakeholder demands from Facet8 covered in Facet1~7?
      - Are Facet3's change factors already considered in Facet5's risks?
      - Is Facet4's penetration strategy limited by Facet7's boundaries?
    
    Cross-association triggers re-review:
      FacetA's discovery → triggers FacetB re-thinking → FacetB correction → triggers FacetC re-thinking
      → until all cross-associations are processed, no more new corrections

  Round 3: Blindspot completion
    For facets with rating <7, execute knowledge acquisition (by priority):
      ① Check if knowledge graph has relevant experience
      ② Check external resources/search
      ③ Ask user (info that truly cannot be self-acquired)
    After completion, re-self-rate until all blindspots are marked "completed" or "user confirmed skip"
    
    **⛔ FORCE-SEARCH (if any facet scores ≤3)**:
    If any facet gets a rating ≤3, this means you KNOW VERY LITTLE about that dimension.
    You MUST execute WebSearch before proceeding. Do NOT continue to solutions without first
    acquiring external information about the low-scoring facets.
    
    Examples of what this prevents:
      - "I can't do that" instead of "Let me search how"
      - Scoring a facet low and continuing without acquiring info
      - Relying entirely on internal knowledge when external info is needed
      - Outputting "templates" or "empty tables" as solutions
      - Claiming capability limits without verifying what's actually possible
    
    After search, re-rate the facet. If still ≤3, you may proceed but ALL output
    from that facet must cite its information source or be marked 【待核实】.
    
    **NEVER produce a "template" or "empty table" as a solution when you could have searched for real data.**
    
    **⛔ ADDITIONAL RULE: If ALL facets score ≤3 in the "can I do this" dimension,**
    **you MUST ask the user for specific data sources / API endpoints / reference links**
    **before proceeding. Do NOT decide "this is impossible" on behalf of the user.**
    
    **⛔ "用户自己选的方案" is NOT a valid reason to skip delivering real value.**
    **If you offered the user a choice between "empty template" and "real data with search",**
    **and they chose the template, that is YOUR fault for not offering the right choices.**

  Round 4: Divergence-convergence self-check
    Ask yourself:
      - Is any facet completely without ideas? → Go back to that facet for more divergence
      - Was any idea rejected too early? → Re-evaluate
      - Are there "assumptions everyone knows but nobody stated"? → List explicitly
      - Do ideas from all 8 facets form a complete picture?
```

### 1.3 Diverge Phase Output

```
Diverge phase does not produce "solutions", it produces "idea fragments":

  ┌─────────────────────────────────────────────────────┐
  │  Diverge Phase Output: Eight-Facet Review Map       │
  ├─────────────────────────────────────────────────────┤
  │                                                     │
  │  Facet1 [Concrete Dimension Name] Score X/10        │
  │    Known: [...known info]                           │
  │    Blindspot: [...missing info]                     │
  │    Ideas: [...feasible directions, inspirations,    │
  │            concerns]                                │
  │    Recon: [...queried resources, confirmed facts]   │
  │                                                     │
  │  Facet2 [Concrete Dimension Name] ...               │
  │  ...                                                │
  │  Facet8 [Concrete Dimension Name] ...               │
  │                                                     │
  │  Cross-Association Records:                         │
  │    Facet5→Facet2: [Facet5 found dependency risk,    │
  │                    Facet2 needs to consider         │
  │                    redundancy]                      │
  │    Facet8→Facet4: [Stakeholder A prefers channel B, │
  │                    affects Facet4's spread          │
  │                    strategy]                        │
  │    Facet3+Facet5→: [Change factor X also affects    │
  │                     risk Y, need joint consideration]│
  │                                                     │
  │  Explicit Assumption List:                          │
  │    "Assume user uses Chrome browser" ← Confirmed?   │
  │    "Assume budget is sufficient" ← Unconfirmed,     │
  │                                    need to mark     │
  └─────────────────────────────────────────────────────┘
```

---

## Phase Two: Converge (Extract Solutions)

### 2.1 Core Task of Converge

```
Divergence produced many idea fragments — each facet has multiple directions,
inspirations, concerns, assumptions.
Converge's task is to extract 2~8 "executable solutions" from these fragments.

Converge ≠ Cut ideas. Converge = Cluster → Complete → Cull → Crystallize.
```

### 2.2 Converge Four Steps

```
① Cluster: Which ideas belong to the same direction?

  Scan all idea fragments from diverge phase, find "directions":
    Direction A: Facet1's idea X + Facet2's idea Y + Facet4's idea Z
                   → They're all talking about the same thing
    Direction B: Facet1's idea W + Facet5's idea V
                   → Another independent direction
    Direction N: ...

  Clustering Principles:
    - Ideas in the same direction have internal consistency
      (all solving the same core problem)
    - Different directions have substantial difference
      (choosing A means not choosing B, or A and B have significantly
       different cost/effect)
    - If two directions only differ in "parameters" not "strategy"
      → Merge

② Complete: Is key info missing for each direction?

  For each direction, check:
    - Is info from all 8 facets considered? Is any facet blank for this direction?
    - Can missing parts be completed from diverge output? Or need extra recon?
    - If cannot complete → This direction is temporarily shelved,
                            not entering final solution list

③ Cull: Remove infeasible or obviously inferior directions based on clear criteria

  Culling uses P0~P4 priority criteria (defined in `node scripts/mcts_compute.js cull` — --criteria flag).
  Standard priority order:
    P0: Boundary (violates hard constraints) → Eliminate
    P1: Foundation (exceeds resources) → Eliminate or downgrade
    P2: Force (capability mismatch) → Eliminate or supplement
    P3: Risk (unbearable worst case) → Eliminate or mark high-risk
    P4: Compare (clearly inferior to another) → Eliminate or merge

  After P0~P4, P5-Minimum Retention applies: at least 2 directions must remain.
│    After P0~P4 execution, if remaining directions < 2:             │
│      → Return to diverge phase, re-diverge based on reasons        │
│         for elimination                                             │
│      → "All directions eliminated means divergence was             │
│         insufficient, need more directions"                         │
│    If remaining directions > 8:                                     │
│      → Tighten to 8 using P4 compare culling                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

Culling execution output:

```
Culling Result:
  Original direction count: X
  P0 Boundary cull: -A (Direction 1 violates hard constraint)
  P1 Foundation cull: -B (Direction 2 exceeds resource range)
  P2 Force cull: -C (Direction 3 core capability mismatch)
  P3 Risk cull: -D (Direction 4 has unbearable risk)
  P4 Compare cull: -E (Direction 5 dominated by Direction 6,
                       Direction 7+8 merged)
  Retained direction count: N (2~8)
```

④ Crystallize: Write complete solution description for each retained direction

  Not "Facet1 says X, Facet2 says Y" fragments, but a complete solution:
    Solution Name: [Short identifier]
    Core Approach: [One-sentence description of how this solution works]
    Main Basis: [Which findings from diverge phase is this solution based on?
                 From which facets?]
    Constraint Check: [Which constraints satisfied? Which violated?
                       Which uncertain?]
    Key Risks: [Main risks extracted from Risk & Abyss facet]
    Expected Complexity: [Small/Medium/Large]
    Difference from Other Solutions: [What's essentially different from
                                       Solution B/C?]
```

### 2.3 Converge Output

```
Converge Phase Output: Structured Solution List

  ┌─────────────────────────────────────────────────────┐
  │  Solution List (After Convergence)                  │
  ├─────────────────────────────────────────────────────┤
  │                                                     │
  │  Solution A: [Name]                                 │
  │    Approach: [...]  Basis: [FacetX+Y+Z]             │
  │    Complexity: Small                                │
  │                                                     │
  │  Solution B: [Name]                                 │
  │    Approach: [...]  Basis: [FacetW+V]               │
  │    Complexity: Medium                               │
  │                                                     │
  │  Solution C: [Name]                                 │
  │    Approach: [...]  Basis: [FacetU+T]               │
  │    Complexity: Large                                │
  │                                                     │
  │  ... (2~8 solutions)                                │
  │                                                     │
  │  Eliminated Directions (for reference):             │
  │    Direction X: Eliminated for violating hard       │
  │                  constraint                         │
  │    Direction Y: Merged with Solution A due to       │
  │                  high overlap                       │
  │                                                     │
  │  Eight-Facet Coverage Matrix:                       │
  │         F1  F2  F3  F4  F5  F6  F7  F8              │
  │    A    ✓   ✓   -   ✓   -   ✓   -   -              │
  │    B    -   ✓   ✓   -   ✓   -   ✓   ✓              │
  │    C    ✓   -   -   ✓   -   ✓   ✓   -              │
  │    → F4 and F5 covered by all solutions ← core      │
  │       facets                                        │
  │    → F3 only covered by B ← may need more solutions │
  └─────────────────────────────────────────────────────┘
```

### 2.4 Convergence Complete → User Confirmation

```
────────────────────────
 【Solution List Confirmation】

 Diverge Phase: Eight-Facet review + cross-association,
                X idea fragments
 Converge Phase: Clustered into Y directions →
                 Eliminated Z → Retained N solutions
 Eight-Facet Coverage: N solutions cover M/8 decision facets

 Next: MCTS tree search simulation for each solution.

 Confirm:
   ✅ "continue" → Enter Simulate Engine
   ➕ "add a XX solution" → Supplement solution
   ➖ "remove solution X" → Remove
   ⚡ "just do solution X" → Skip simulation, execute directly
 ────────────────────────────
```

---

## Helper Tools

```
Domain Hint (optional):
  `node scripts/mcts_compute.js identify-domain`
  → Only as reference signal, LLM makes final judgment

Eight-Facet Mirror Loading:
  `node scripts/mcts_compute.js get-dimensions`
  → Always returns 8 abstract facets + optional domain template reference

Blindspot Classification:
  `node scripts/mcts_compute.js classify-blindspot --score <0-10>`

Learning Depth Gate:
  `node scripts/mcts_compute.js check-learning-depth`
  → Check after diverge phase completes, if not passed,
     return to recon completion
```