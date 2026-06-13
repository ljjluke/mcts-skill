---
name: mcts-diverge
description: MCTS-TD Decision Engine "Step 1" — Diverge Engine. Diverge (Eight-Facet Mirror iterative review + free association) → Converge (extract structured solution list). Core capability: during divergence, no angle is missed; during convergence, clear executable decision options are extracted from chaos.
---

# Step 1: Diverge Engine — Diverge × Converge

> **🔒 COMPRESSION-SAFE RULES (Always apply, even if context is compressed):**
> 1. **OUTPUT LANGUAGE**: User language already detected. Continue using that language.
> 2. **PHASE ORDER**: Review Map → Recon Report → Solution List. Each MUST be output before proceeding.
> 3. **LANGUAGE GUARD**: `node scripts/language_guard.js check --user-lang <lang> --output "..."` verifies output language.
>    **⛔ MUST call after each major output block** (Review Map, Recon Report, Solution List). Not optional.
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
┌──────────────────────────────────────────────────────────────────────────┐
│  ☰ Qian F1: Source of Force — External Scan x3                                   │
│  "天行健，君子以自强不息"                                                  │
│                                                                          │
│  Action (search externally, not self-question):                                      │
│  ① WebSearch: "[task] industry standard approaches"                     │
│  ② WebSearch: "[task] unconventional / alternative"                     │
│  ③ WebSearch: "[task] cross-domain analogy"                             │
│  → Output: Industry + Unconventional + Cross-domain                               │
│  → ⛔ FORBIDDEN: skip search, internal knowledge only                                           │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  ☷ 坤 F2: Foundation — Assess Capability                                  │
│  "地势坤，君子以厚德载物"                                                  │
│                                                                          │
│  Action:                                                                   │
│  ① Assess self/KG capability for this task                           │
│  ② Find gaps -> search to fill (not guess)                                       │
│  ③ If score <=3 -> MUST WebSearch + ask user                                │
│  Output: Capability match + areas to supplement                                      │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  ☳ 震 F3: Change — Feedback Unknown                                     │
│  "帝出乎震，万物出乎震" — New things emerge from disruption                                │
│                                                                          │
│  Action:                                                                   │
│  ① Present F1 external findings to user                                │
│  ② Tell user: I found directions you may not have noticed...                      │
│  ③ Ask user: Which direction should I explore first?                                             │
│  → ⛔ FORBIDDEN: Skip to subsequent analysis                                     │
│  → ⛔ FORBIDDEN: Summarize without asking questions                                                │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  ☴ 巽 F4: Penetration — Knowledge Breadth                                         │
│  "随风巽，君子以申命行事" — Wind penetrates every gap                                    │
│                                                                          │
│  Action:                                                                   │
│  ① Query memory (MMA deqi) + search                                        │
│  ② What other related domains/technologies/solutions can penetrate in?                            │
│  ③ Search each candidate for known pitfalls + best practices                             │
│  Output: Knowledge breadth map + risks per candidate                                    │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  ☵ 坎 F5: Risk — Deep Dive                                             │
│  "习坎，重险也。水流而不盈" — Water knows every low point                            │
│                                                                          │
│  Action:                                                                   │
│  ① Search known pitfalls and failure cases                                               │
│  ② Worst case for each candidate?                                       │
│  ③ No risks found? Search not deep enough                                    │
│  Output: Risk list + mitigation plans                                              │
│  → ⛔ "This solution has no risks" = you did not search carefully enough                                     │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  ☲ 离 F6: Dependencies — Track External                                         │
│  "明两作，大人以继明照于四方"                                            │
│                                                                          │
│  Action:                                                                   │
│  ① Search each candidate dependency tech/platform status                                    │
│  ② Check for deprecation, EOL, major bugs?                        │
│  ③ If dependency unclear -> search to confirm                                         │
│  Output: Dependency health check report                                           │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  ☶ 艮 F7: Boundary — Hard Constraint                                           │
│  "艮其背，不获其身" — Know when to stop                                    │
│                                                                          │
│  Action:                                                                   │
│  ① Check each item in constraint-checklist                                         │
│     → node scripts/mcts_guard.js constraint-checklist                             │
│  ② Hard violated -> eliminate                                               │
│  ③ Soft not met -> downgrade                                              │
│  Output: Constraint satisfaction matrix                                                     │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  ☱ 兑 F8: Convergence — Balance & Focus                                  │
│  "丽泽兑，君子以朋友讲习" — Two lakes connected to flow                              │
│                                                                          │
│  Action:                                                                   │
│  ① Synthesize F1-F7 findings, list conflicts                                   │
│  ② User wants vs user may not know but beneficial                                   │
│  ③ Decisions needing user -> present clearly                                        │
│  Output: Conflict list + pending user decisions                                │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  🔍 PHASE 1.5: INFO GAP SUPPLEMENT (MANDATORY — cannot skip)           │
│                                                                          │
│  After diverging, BEFORE converging — fill information gaps by asking    │
│  the user. This is a FIRST-CLASS PHASE, not a sub-step.                 │
│                                                                          │
│  ⚠️ WHY THIS PHASE EXISTS:                                              │
│  Phase 0 (constraint collection) asks about BOUNDARIES.                  │
│  Phase 1 (diverge) REVEALS what you didn't know to ask about.           │
│  Without this phase, those newly-discovered gaps would silently          │
│  become assumptions — which is exactly what MCTS exists to prevent.      │
│                                                                          │
│  Step 1: SCAN all 8 facets for info gaps:                               │
│    - Which facets scored ≤5? What specifically is missing?               │
│    - Which facets have blindspots that self-search couldn't fill?        │
│    - Which assumptions are unconfirmed?                                  │
│                                                                          │
│  Step 2: PRIORITIZE gaps (ask only what YOU cannot resolve):            │
│    ① Memory/web/code already searched → skip, don't re-ask             │
│    ② Can self-confirm from project code → skip, do it yourself          │
│    ③ Only truly user-knowable info → ASK (max 3-5 questions)           │
│                                                                          │
│  Step 3: ASK the user (use AskUserQuestion, NOT free text):            │
│    ⚠️ Question quality rules:                                           │
│    • DO ask about: constraints, preferences, domain knowledge,          │
│      resource availability, priority trade-offs                         │
│    • Do NOT ask: "which solution do you prefer?" (YOUR job)             │
│    • Do NOT ask: questions answerable by reading code/docs              │
│    • Do NOT ask: vague "any requirements?" (be specific about gap)      │
│                                                                          │
│  Step 4: INTEGRATE answers into facet scores and blindspots             │
│    - Update relevant facet scores with new info                         │
│    - Mark resolved blindspots as [confirmed by user]                    │
│    - If answers invalidate earlier assumptions → re-diverge those facets│
│                                                                          │
│  Output: [Info Gap Supplement Report]                                    │
│    - Gaps found: X (self-resolved: Y, asked user: Z)                    │
│    - User answers received: [list]                                       │
│    - Updated facet scores: [before → after]                             │
│    - Remaining assumptions (still unconfirmed): [list]                   │
│                                                                          │
│  ⛔ SKIP CONDITION: Only skip if ALL 8 facets score ≥7                  │
│     (meaning no significant gaps remain). If ANY facet <7,              │
│     this phase is MANDATORY.                                            │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  🗣️ DIRECTION CHECK (before converging to solutions):                     │
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
│  🗣️ DIRECTION CONFIRM (after direction, before culling): │
│                                                         │
│  Briefly confirm each candidate direction with user.    │
│  ⚠️ MAJOR info-gap questions were already handled in    │
│     Phase 1.5. Here you only confirm direction-level    │
│     specifics that emerged during clustering.           │
│  • Do NOT re-ask questions already answered in 1.5     │
│  • Do NOT ask "选方案A还是方案B" — that is YOUR job     │
│  • Only ask: "Direction X assumes [Y], correct?"       │
│                                                         │
│  After confirming directions → move to Final Triaging.  │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│         FINAL TRIAGING → Keep 5~8 (for MCTS Simulation)       │
│                                                              │
│  All details confirmed. Now narrow to keep 5~8 solutions:    │
│  ⚠️ "Keep exactly 3" is DEPRECATED — insufficient for        │
│     multi-perspective scrutable reasoning.                   │
│  ⚠️ Upper limit raised from 3 to 8 to allow richer           │
│     cross-validation during simulation.                      │
│                                                              │
│  SOURCE 1 — MEMORY (meridian_memory.js deqi):             │
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
│  ⚠️ Every dropped direction needs a specific reason.      │
│  ⚠️ All kept solutions MUST pass the user's detail        │
│     check first.                                          │
│  ⛔ CODE-ENFORCED: `node scripts/mcts_guard.js solution-count-guard --state '{viable_count:N,total_before_cull:M}`
     <5 viable = notify user; >8 viable = force tighten; <2 = return to diverge.

  ⚠️ If <5 viable → keep all viable, go to user:          │
│     "Only X viable solutions found, need more?"           │
│  ⚠️ If >8 viable → tighten to 8 using P4 compare cull    │
│                                                          │
│  Output: 5~8 structured solutions                        │
│          (each with complete description and basis)      │
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

### 1.2 Eight-Facet Mirror + Embedded Cultural Sub-Lenses + 体用 Decomposition

> The 8 facets are domain-agnostic abstract questions. But each facet can be
> examined more deeply through cultural thought paradigms (诸子百家).
> These sub-lenses are NOT separate steps — they are EMBEDDED into each facet
> as additional probing angles. This eliminates the redundant Step 0.5 matrix.
>
> **NEW: 体用 (Ti-Yong) Decomposition** — Source: Wei-Jin Xuanxue.
> Each facet now distinguishes its **体** (substance: what it IS universally)
> from its **用** (function: what it MANIFESTS AS in this specific domain).
> This prevents conflating the abstract question with its domain-specific form.

```
═══════════════════════════════════════════════════════════════
         Eight-Facet Decision Mirror with Cultural Sub-Lenses
         + 体用 Decomposition (Xuanxue·体用)
═══════════════════════════════════════════════════════════════

Facet1: Source of Force (☰ 乾 Qian)
  Ask: "Where does the driving force for this come from?"
  体(substance): EXTERNAL IMPETUS — what pushes this forward?
  用(function): varies — tech stack / team experience / creative style / ...
  Sub-lenses: 兵家(Military) — who has strategic advantage?
              纵横家(Strategist) — whose interests align?

Facet2: Foundation & Capacity (☷ 坤 Kun)
  Ask: "What is the foundation this rests on?"
  体(substance): BASE CAPACITY — what supports this?
  用(function): varies — budget / architecture / infrastructure / ...
  Sub-lenses: 农家(Agricultural) — what are the fundamental resources & cycles?
              水利家(Hydraulic) — where do resources flow? where blocked?

Facet3: Change & Disruption (☳ 震 Zhen)
  Ask: "Where might unexpected changes occur?"
  体(substance): UNCERTAINTY — what is inherently unstable?
  用(function): varies — requirement changes / market shifts / sudden risks / ...
  Sub-lenses: 医家(Medical) — what is the system's diagnosis: surface or root?
              阴阳家(Yin-Yang) — which opposing forces? balance point?

Facet4: Penetration & Diffusion (☴ 巽 Xun)
  Ask: "How to make the effect truly penetrate and spread?"
  体(substance): PROPAGATION MECHANISM — how does impact travel?
  用(function): varies — user experience / distribution / teaching / ...
  Sub-lenses: 工匠(Artisan) — what are the core tools/methods to replicate?
              禅家(Zen) — strip assumptions, what is the real mechanism?

Facet5: Risk & Abyss (☵ 坎 Kan)
  Ask: "Where is the deepest pit? What's the worst case?"
  体(substance): VULNERABILITY — where is the system exposed?
  用(function): varies — security flaws / compliance risk / creative block / ...
  Sub-lenses: 史家(Historical) — what happened before in similar situations?
              道家(Daoist) — what is the reverse risk of over-intervention?

Facet6: Visible & Dependent (☲ 离 Li)
  Ask: "What is the surface? What does it depend on underneath?"
  体(substance): DEPENDENCY STRUCTURE — surface vs foundation
  用(function): varies — core features vs infra / highlight vs evidence / ...
  Sub-lenses: 工匠(Artisan) — what makes this visible/usable?
              儒家(Confucian) — does surface serve human values?

Facet7: Boundary & Limit (☶ 艮 Gen)
  Ask: "What lines must never be crossed?"
  体(substance): CONSTRAINT BOUNDARY — what is non-negotiable?
  用(function): varies — laws / ethics / resource limits / physical limits / ...
  Sub-lenses: 法家(Legalist) — what rules enforce compliance? incentives?
              道家(Daoist) — what should we NOT do? knowing when to stop?

Facet8: Convergence & Mutual Benefit (☱ 兑 Dui)
  Ask: "How to balance all interests?"
  体(substance): STAKEHOLDER EQUILIBRIUM — whose interests must align?
  用(function): varies — users & team / creators & audience / ...
  Sub-lenses: 儒家(Confucian) — ethical foundation? human value?
              纵横家(Strategist) — who can be allied? common ground?
═══════════════════════════════════════════════════════════════

USAGE:
  1. Sub-lenses are INTERNAL — the agent interrogates its own assumptions.
     Do NOT re-ask the user questions already answered in 五诊 (Step 0.5).
  2. 体用 decomposition prevents conflating universal facet questions with
     domain-specific manifestations. When framing each facet, state BOTH:
     体: [what this facet IS universally]
     用: [what it MANIFESTS AS in this specific case]
  3. 体用 in Converge: two solutions sharing the same 体 but different 用
     → MERGE (false diversity). Same 用 but different 体 → KEEP (genuinely different).
  4. 体用 in MCTS: same-体 branches → merge nodes (prevent tree bloat).
```

### 1.3 Divergence Method: Iterative Review + Cross-Association + Changing-Condition Analysis

```
Divergence is not "Facet1→Facet2→...→Facet8, done after one pass".
Divergence is "reflect repeatedly" — each round goes deeper.

Divergence Process (4 rounds):

  Round 1: Individual facet exploration
    Facet1→Facet2→...→Facet8, for each facet:
      - Determine concrete dimension based on user need
      - Apply cultural sub-lenses for deeper probing
      - Self-rate (0-10): How much do I know?
      - Identify blindspots + record initial ideas

  Round 2: Cross-association between facets
    Not all 8×8=64 pairs matter. Select key pairs based on Round 1 scores:
      - Top 2 highest-scored facets → their intersection (strength pair)
      - Top 2 lowest-scored facets → their intersection (blindspot pair)
      - Any pair where scores diverge by >4 → tension pair
      - HOTSPOT pairs from constraint tension scan (0.1b) → priority
    For each selected pair, ask:
      "How does Facet A interact with Facet B? What dynamic emerges?"
    Code-enforced: `node scripts/mcts_compute.js hexagram-lookup --upper <A> --lower <B>`
    Cross-association triggers re-review where new insights emerge.

    ⭐ 理事 (Li-Shi) Separation — Source: Xuanxue·理事:
      For EACH cross-association, separate the interaction into two layers:
        理(Li·Principle): the universal pattern this interaction reveals
        事(Shi·Phenomenon): the concrete manifestation in THIS case
      Example:
        Facet3(Change) ∩ Facet5(Risk):
          理: "Change introduces uncertainty; uncertainty is the substance of risk"
          事: "API change may introduce security vulnerability"
      Why: Li-level insights transfer across domains; Shi-level is immediately
      actionable. Both are needed, but conflating them causes over-generalization
      (treating a specific risk as universal) or over-contextualization
      (missing the pattern that could warn about future risks).
      Code-enforced: `node scripts/mcts_compute.js li-shi-split --facets '<JSON>'`

  Round 3: Changing-condition analysis (second-order thinking)
    For each key interaction pair from Round 2:
      - Which factors are STABLE vs CHANGING?
      - If a changing factor shifts, what second-order effects emerge?
      - This prevents "plan works now but breaks when X changes"
    Position layers for analysis:
      Top:    Long-term / ultimate outcome
      Mid:    Execution / operational layer
      Bottom: Foundation / starting condition
    Max 2-3 unstable factors per pair. If >3 → reduce scope first.

  Round 4: Blindspot completion
    For facets with rating <7, execute knowledge acquisition (by priority):
      ① Check if knowledge graph has relevant experience
      ② Check external resources/search
      ③ Ask user (info that truly cannot be self-acquired)
    After completion, re-self-rate until all blindspots are marked "completed" or "user confirmed skip"
    
    ⛔ FORCE-SEARCH (if any facet scores ≤3):
    You MUST execute WebSearch before proceeding.
    NEVER produce "templates" or "empty tables" as solutions.
    Code-enforced: `node scripts/mcts_guard.js force-search-guard`

  Round 5: Divergence-convergence self-check
    Ask yourself:
      - Is any facet completely without ideas? → Go back
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

  ⭐ 一多 (One-Many) Coherence Check — Source: Xuanxue·一多:
    After clustering, validate each cluster's coherence:
      - Each cluster MUST have: 1 core identity (一) + 2-4 concrete mechanisms (多)
      - Too loose (all "多", no "一"): ideas share a keyword but are actually
        different directions → flag "incoherent" → re-split
      - Too tight (all "一", no "多"): same idea restated N ways → flag
        "false diversity" → merge with nearest genuine cluster
    This prevents the #1 Converge failure: 5 "different" solutions that
    collapse to 2-3 actual approaches when you strip the rewording.

  ⭐ 体用 (Ti-Yong) False Diversity Elimination — Source: Xuanxue·体用:
    After clustering, for each pair of solutions, check:
      - Same 体(substance), different 用(function) → MERGE (they are the same
        fundamental approach with different implementations)
      - Different 体, same 用 → KEEP but FLAG (fundamentally different approaches
        that happen to achieve similar results — important distinction to preserve)
    Code-enforced: `node scripts/mcts_compute.js one-many-check --solutions '<JSON>'`

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

  Not "Facet1 says X, Facet2 says Y" fragments, but a complete solution.
  ⚠️ EACH solution MUST also include an Eight-Facet Scrutable Scorecard:

    Solution Name: [Short identifier]
    Core Approach: [One-sentence description]
    Main Basis: [Which findings from diverge phase? From which facets?]
    Constraint Check: [Which constraints satisfied/violated/uncertain?]
    Key Risks: [Main risks extracted from Risk & Abyss facet]
    Expected Complexity: [Small/Medium/Large]
    Difference from Others: [What's essentially different from other solutions?]

    ┌─────────────────────────────────────────────────────┐
    │  Eight-Facet Scrutable Scorecard                    │
    ├───────┬──────────────────────────┬──────┬───────────┤
    │ Facet │ Question                 │Score │ Evidence  │
    ├───────┼──────────────────────────┼──────┼───────────┤
    │  F1   │Is driving force reliable?？           │ 1-10 │ [Basis]    │
    │  F2   │Are foundation conditions met?？          │ 1-10 │ [Basis]    │
    │  F3   │Still valid if conditions change?？        │ 1-10 │ [Basis]    │
    │  F4   │Can effect truly land?？        │ 1-10 │ [Basis]    │
    │  F5   │Can worst case be tolerated?？        │ 1-10 │ [Basis]    │
    │  F6   │Are outputs and dependencies clear?？│ 1-10 │ [Basis]    │
    │  F7   │Does it cross red lines?？            │ 1-10 │ [Basis]    │
    │  F8   │Can all interests be balanced?？        │ 1-10 │ [Basis]    │
    ├───────┴──────────────────────────┼──────┼───────────┤
    │ Comprehensive Scrutability Score                │ Avg  │ [Assessment]    │
    └──────────────────────────────────────┴───────────────┘

  Score Guide:
    8-10: Strong (clear basis)
    5-7:  Medium (some basis but insufficient)
    1-4:  Weak (insufficient basis or clear issues)
    0:    Cannot assess

  Composite score < 4 → eliminate directly (cannot be scrutinized)
  Composite score 4-6 → keep but mark "needs attention"
  Composite score > 6 → normal entry to MCTS simulation
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