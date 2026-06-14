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

## 0. GRILL THE USER (MANDATORY — Before Step 1.1)

**⛔ This step is NOT optional. Every engine engagement MUST start with 3-step user interview.**

```
① PARAPHRASE: "我理解你要 [X]。对吗？还有其他方面需要考虑的吗？"
② PROBE: "你之前试过或考虑过什么方案？"
③ CONSTRAIN: Ask 2-3 most critical constraints via AskUserQuestion (NOT free text)
   Example: "有依赖限制吗？" → [有，没有限制 / 必须用Go+gin / 完全不用外部依赖]
```

**⚠️ Do NOT skip this. The user knows things you do not.**
**⚠️ Minimum 2 AskUserQuestion calls before proceeding to Step 1.1.**
**⚠️ If user's answer reveals new angles → PARAPHRASE again (can loop 2-3 times).**

---

## 1.1 Eight-Facet Mirror — Abstract Decision Review

**⛔ MUST output the full map visibly. Not outputting = VIOLATION.**

8 facets, each with: concrete dimension name + score 0-10 + known info + blindspots + ideas.

**Output format (MANDATORY — show to user):**
```
【Eight-Facet Review Map】
 Task: [xxx] | Domain: [xxx]

 F1 ☰ 力量之源 [dimension name] — Score: [0-10]
    Known: [...] | Blindspots: [...] | Ideas: [...]

 F2 ☷ 根基承载 [dimension name] — Score: [0-10]
    Known: [...] | Blindspots: [...] | Ideas: [...]

 ... (F3-F8 same format)

 Summary: Strong=[F?F?] | Weak=[F?F?] | Tension pairs=[F?↔F?]
```

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

**5 rounds of divergent thinking — each round MUST be visible to user.**

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

### Per-Facet Action Sequences (execute during Round 1)

Each facet has 3 search actions — ② expands scope, ③ uses cultural analogy to jump out of conventional thinking:

| Facet | ① Standard | ② Expansion | ③ Cultural Analogy (跳出框架) |
|-------|-----------|-------------|-------------------------------|
| F1 Source | industry standard | unconventional approaches | **兵法类比**(孙子·势篇: 造势vs借势 — force是造出来的还是借来的?) |
| F2 Foundation | best practices | resource constraints | **農耕类比**(農家: 因地制宜 — 这块"地"适合种什么?) |
| F3 Change | risk factors | historical precedents | **醫道类比**(醫家: 治未病 — 哪里还没出症状但已有病根?) |
| F4 Penetration | adoption strategies | diffusion barriers | **巧匠类比**(庖丁解牛: 找关节缝隙，不硬推) |
| F5 Risk | worst cases | failure modes | **史鉴类比**(以史为鉴: 类似决策的历史结局) |
| F6 Visible | surface dependencies | hidden coupling | **儒法类比**(正名: 名实是否一致?) |
| F7 Boundary | compliance requirements | hard limits | **道法类比**(知止不殆: 哪些边界是保护性的?) |
| F8 Convergence | stakeholder needs | win-win scenarios | **縱橫类比**(合纵连横: 利益能否重新分配?) |

⛔ FORBIDDEN: skip ③ cultural analogy step, rely on conventional thinking only.
📚 Full analogy methodology: `references/culture-algorithm-reference.md`

### 诸子百家 Sub-Lenses (apply during Round 1, INTERNAL use)

Each facet's sub-lenses interrogate your OWN assumptions with **analogy-based reasoning** (类比推演):

| Facet | Sub-lens 1 + 推演 | Sub-lens 2 + 推演 |
|-------|-------------------|-------------------|
| F1 | **兵家**(strategic advantage): "谁是敌？谁是友？什么是制高点？看似坚固的是否真是实？" | **縱横家**(interest alignment): "各方利益能否对齐？谁能被拉拢？谁不可动摇？" |
| F2 | **農家**(fundamental resources): "土壤(团队)适合种什么？有灌溉(资金)吗？季节(时机)对吗？" | **水利家**(resource flow): "资源流向哪里？有堵点吗？上游下游关系？" |
| F3 | **醫家**(surface vs root): "这是症状还是病因？治标还是治本？有没有'未病'？" | **陰陽家**(opposing forces): "对立面是谁？消长趋势？物极必反的转折点？" |
| F4 | **工匠**(core tools): "核心工具够用吗？有没有更简单的做法？庖丁解牛的缝隙在哪？" | **禪家**(strip assumptions): "去掉所有装饰后剩下什么？'无'中是否藏着可能？" |
| F5 | **史家**(historical precedent): "历史上谁犯过类似错误？结局如何？教训是什么？" | **道家**(reverse risk of over-intervention): "不做比做更好吗？干预是否制造新风险？" |
| F6 | **工匠**(what makes visible): "什么让表面看起来好？支撑它的隐藏结构是什么？" | **儒家**(human values): "谁被忽略了？人的需求是否被技术遮蔽？" |
| F7 | **法家**(rules/enforcement): "规则是否过时？谁来执行？违规的代价？" | **道家**(knowing when to stop): "哪里是不该越的线？知止=保护还是限制？" |
| F8 | **儒家**(ethical foundation): "各方利益的道德底线？谁的利益被牺牲？" | **縱横家**(alliances): "利益能否重新分配？谁是天然盟友？" |

📚 Full methodology + academic basis: `references/culture-algorithm-reference.md`

---

## Phase 1.5: Info Gap Supplement (MANDATORY — Multi-Round)

After diverge, BEFORE converge — fill info gaps discovered during divergence.
Phase 0 asks BOUNDARIES. Phase 1 REVEALS what you didn't know to ask about.
Without this phase, newly-discovered gaps become assumptions — exactly what MCTS prevents.

**⛔ This is the MOST INTERACTIVE phase. Typical session: 2-3 rounds of questions.**

1. **SCAN**: facets with score ≤5, unresolved blindspots, unconfirmed assumptions
2. **PRIORITIZE**: memory/code already searched → skip. Self-confirm from project code → do it yourself. Only truly user-knowable → ASK (max 3-5 per round)
3. **ASK**: Use AskUserQuestion, NOT free text.
   - DO ask: constraints, preferences, domain knowledge, resource availability, priority trade-offs
   - Do NOT ask: "which solution do you prefer?" (YOUR job) | questions answerable by reading code/docs | vague "any requirements?"
4. **INTEGRATE**: update facet scores, mark resolved blindspots. If answers invalidate earlier assumptions → re-diverge those facets
5. **LOOP**: After user answers, re-scan. New gaps? → ask again (max 3 rounds total)

**⛔ Minimum 1 AskUserQuestion call. Typical: 2-3 calls. Skip only if ALL 8 facets ≥7.**

**Output format after each round:**
```
【Info Gap Round N】
  Asked: [Q1] → [A1] | [Q2] → [A2]
  Updated scores: F2=4→6 | F5=3→5
  Remaining gaps: [list] / None → proceed
```

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
