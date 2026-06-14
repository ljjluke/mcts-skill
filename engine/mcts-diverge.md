---
name: mcts-diverge
description: MCTS-TD Step 1 — Diverge Engine. Eight-Facet Mirror review + Cross-association → Cluster/Complete/Cull/Crystallize → 2~8 solutions.
---

# Step 1: Diverge Engine — Diverge × Converge

> **🔒 COMPRESSION-SAFE RULES:**
> 1. OUTPUT in user language | 2. Phase order: Review Map → Info Gap → Recon → Solution List
> 3. Language guard after each major output | 4. NO SKIP / NO COLLAPSE
> 5. ANTI-SINGLE: `decomposition-guard` before "only one solution"
> 6. DIVERSITY: if <3 solutions → `diversity-challenge`
> 7. Compliance: `all-guards` when in doubt

**Diverge = completeness. Converge = quality. Both indispensable.**

---

## 1.1 Eight-Facet Mirror — Abstract Decision Review

8 facets, each with: concrete dimension name + score 0-10 + known info + blindspots + ideas.

| Facet | Trigram | Question |
|-------|---------|----------|
| F1 Source of Force | ☰ Qian | Where does the driving force come from? |
| F2 Foundation | ☷ Kun | What is the foundation this rests on? |
| F3 Change/Disruption | ☳ Zhen | Where might unexpected changes occur? |
| F4 Penetration | ☴ Xun | How to make effect penetrate and spread? |
| F5 Risk/Abyss | ☵ Kan | Where is the deepest pit? Worst case? |
| F6 Visible/Dependent | ☲ Li | What's the surface? What depends underneath? |
| F7 Boundary | ☶ Gen | What lines must never be crossed? |
| F8 Convergence | ☱ Dui | How to balance all interests? |

### 1.2 Facets + Cultural Sub-Lenses + 体用 Decomposition

Each facet has **体**(substance: what it IS universally) + **用**(function: what it MANIFESTS AS in this case) + embedded sub-lenses:

| Facet | 体(substance) | Sub-lenses |
|-------|---------------|------------|
| F1 | EXTERNAL IMPETUS | 兵家(strategic advantage), 縱横家(interest alignment) |
| F2 | BASE CAPACITY | 農家(fundamental resources), 水利家(resource flow) |
| F3 | UNCERTAINTY | 醫家(diagnosis: surface vs root), 陰陽家(opposing forces) |
| F4 | PROPAGATION | 工匠(core tools/methods), 禪家(strip assumptions) |
| F5 | VULNERABILITY | 史家(historical precedent), 道家(reverse risk of over-intervention) |
| F6 | DEPENDENCY STRUCTURE | 工匠(what makes visible), 儒家(human values) |
| F7 | CONSTRAINT BOUNDARY | 法家(rules/enforcement), 道家(knowing when to stop) |
| F8 | STAKEHOLDER EQUILIBRIUM | 儒家(ethical foundation), 縱横家(alliances) |

**Usage**: Sub-lenses are INTERNAL — interrogate own assumptions. Do NOT re-ask 五診 answers.
**体用 in Converge**: same-体 different-用 → MERGE (false diversity). Different-体 same-用 → KEEP.
**体用 in MCTS**: same-体 branches → merge nodes (prevent tree bloat).

Code: `node scripts/mcts_compute.js ti-yong-check`

---

## 1.3 Divergence: Iterative Review + Cross-Association + Changing-Condition

**Round 1**: F1→F8, each facet: determine dimension, apply sub-lenses, self-rate 0-10, identify blindspots.

**Round 2**: Cross-association between key pairs:
- Top-2 highest facets → strength pair
- Top-2 lowest → blindspot pair
- Score divergence >4 → tension pair
- HOTSPOT pairs from tension scan (0.1b) → priority
- For each pair: "How does Facet A interact with Facet B?"
- Code: `hexagram-lookup --upper <A> --lower <B>`

⭐ **理事(Li-Shi) Separation** — per cross-association:
- 理(Li): universal pattern this interaction reveals
- 事(Shi): concrete manifestation in THIS case
- Why: Li transfers cross-domain; Shi is immediately actionable. Both needed.

Code: `node scripts/mcts_compute.js li-shi-split --facets '<JSON>'`

**Round 3**: Changing-condition analysis — for key pairs: which factors STABLE vs CHANGING? If changing shifts → second-order effects? Max 2-3 unstable factors per pair.

**Round 4**: Blindspot completion — for facets <7: ① knowledge graph ② search ③ ask user. If any ≤3 → MUST WebSearch. Code: `force-search-guard`

**Round 5**: Self-check — any facet without ideas? Idea rejected too early? Unstated assumptions? Do ideas from all 8 facets form a complete picture?

---

## Phase 1.5: Info Gap Supplement (MANDATORY)

After diverge, BEFORE converge — fill info gaps discovered during divergence.
Phase 0 asks BOUNDARIES. Phase 1 REVEALS what you didn't know to ask about.
Without this phase, newly-discovered gaps become assumptions — exactly what MCTS prevents.

1. **SCAN**: facets with score ≤5, unresolved blindspots, unconfirmed assumptions
2. **PRIORITIZE**: memory/code already searched → skip. Self-confirm from project code → do it yourself. Only truly user-knowable → ASK (max 3-5)
3. **ASK**: Use AskUserQuestion, NOT free text.
   - DO ask: constraints, preferences, domain knowledge, resource availability, priority trade-offs
   - Do NOT ask: "which solution do you prefer?" (YOUR job) | questions answerable by reading code/docs | vague "any requirements?"
4. **INTEGRATE**: update facet scores, mark resolved blindspots. If answers invalidate earlier assumptions → re-diverge those facets

⛔ Skip only if ALL 8 facets ≥7.

---

## Direction Check (before converging)

"From 8 facets, the key tensions are: [A] vs [B]. Which feels more important?"
NOT asking user to pick a solution — confirming priorities before shaping solutions.
User may say "both are important" → that's useful too.

---

## Step 2: Reconnaissance Report — Output Format

```
【Reconnaissance Report】
 Task: [xxx]

 Per-Facet Findings:
   F1 [dimension]: [key findings from WebSearch + memory + user input]
   F2 [dimension]: [key findings]
   ...
   F8 [dimension]: [key findings]

 Cross-Validation:
   F3↔F5: [interaction finding] → 理: [universal] | 事: [specific]
   F1↔F7: [interaction finding] → 理: [universal] | 事: [specific]

 Explicit Assumptions:
   "Assume [X]" ← [Confirmed? / Unconfirmed]
```

---

## Phase Two: Converge (Extract Solutions)

**① Cluster**: Group idea fragments into directions. Same direction = internal consistency; different directions = substantial difference.

⭐ **一多(One-Many) Coherence**: Each cluster: 1 core identity (一) + 2-4 mechanisms (多). Too loose → re-split. Too tight (false diversity) → merge.
⭐ **体用 False Diversity Elimination**: same-体 different-用 → MERGE. Different-体 same-用 → KEEP.
Code: `one-many-check`, `ti-yong-check`

**② Complete**: Missing info for a direction? Complete from diverge output or shelve.

**③ Cull**: P0~P4 criteria (Boundary→Foundation→Force→Risk→Compare). P5: min 2 remain. >8 → tighten to 8.
Code: `node scripts/mcts_compute.js cull --criteria`

**④ Crystallize**: Write complete solution with Eight-Facet Scrutable Scorecard (8 facets scored 1-10). Composite <4 → eliminate. 4-6 → keep but mark. >6 → normal.

---

## Converge Output Format

```
【Solution List (After Convergence)】
 Solution A: [Name] | Approach: [...] | Basis: [FacetX+Y] | Complexity: S/M/L
 Solution B: ...

 Eliminated: [Direction X: reason] [Direction Y: reason]

 Coverage Matrix: F1-F8 × solutions (✓/-)
```

---

## Helper Tools

- Domain hint: `identify-domain` | Facet loading: `get-dimensions`
- Blindspot classification: `classify-blindspot --score <0-10>`
- Learning depth: `check-learning-depth`
