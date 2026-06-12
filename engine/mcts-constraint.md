---
name: mcts-constraint
description: MCTS-TD Decision Engine "Step 0" — Requirement Constraint Collection System + Cultural Perspective Matrix. Systematically collect all constraints before solution generation to prevent "finished then realized wrong".
---

# Step 0: Requirement Constraint Collection + Cultural Perspective Matrix

> **🔒 COMPRESSION-SAFE RULES (Always apply, even if context is compressed):**
> 1. **OUTPUT LANGUAGE**: User language already detected. Continue using that language.
> 2. **⛔ MUST ASK WHEN UNCLEAR**: If constraints are ambiguous (deps, tech stack, architecture, security, performance), ASK USER before generating solutions. Never assume: "probably ok".
> 3. **⛔ DEMAND REFINEMENT (Demand Refinement) — mandatory before generating any solution**: If the user's request is missing critical information (tech stack, constraints, preferences, boundaries), PAUSE and use AskUserQuestion to refine. NEVER generate solutions on incomplete requirements.
> 4. **HARD vs SOFT**: Hard constraints → eliminate violating solutions. Soft constraints → lower match score.
> 5. **SOURCE TRACKING**: Mark each constraint's origin: user-explicit / code-inferred / knowledge-graph / assumed.
> 6. **⛔ DECOMPOSITION CHECK**: Before concluding constraint collection is done, run `node scripts/mcts_guard.js decomposition-guard` to verify no premature "single solution" judgment.
> 7. **STEP 0.5 — 100-Schools Perspective Matrix**: After constraint collection, MUST execute cultural perspective matrix before entering diverge. This is NOT optional.
> 8. **PERSPECTIVE OUTPUT**: All perspectives output simultaneously in a matrix table. Each perspective outputs 2-3 probing QUESTIONS, not assertions/conclusions.
> 9. **PERSPECTIVE SOURCE**: Knowledge must be acquired from memory first; only if memory misses, acquire externally. Sub-agents must check if knowledge source is "memory" to avoid duplicate processing and infinite loops.

> ⚠️ **OUTPUT LANGUAGE RULE (HIGHEST PRIORITY)**: All user-facing output MUST be in the user's detected language. If user writes in Chinese → output Chinese. If Japanese → output Japanese. This is NON-NEGOTIABLE. Internal reasoning is English; user sees their language.

> **One-liner**: Before starting any solution generation, first clarify all "what cannot be done" and "what must be done".
> Constraints are boundary conditions for solution generation — boundaries unclear, solutions unreliable.

---

## Step 0.5: 100-Schools Perspective Matrix ★NEW★

### Core Position

After constraint collection, before 8-facet mirror, insert a cultural perspective switcher.Use 12 Chinese thought paradigms to examine from diverse dimensions，Output blindspot list for 8-facet mirror to carry。

**Matrix does NOT replace nor analyzed by the 8-facet mirror** — it provides lenses for it — Let mirror examine with perspective-derived blindspots。

### Perspective Output Rules

Each perspective output must be probing questions, not assertions/conclusions:

```
✅ CORRECT: Military perspective asks:"Who is surprise force? Host-guest dynamics?"
❌ WRONG: Military perspective asserts:"You should win fast"
```

### 12 Cultural Thought Paradigms

Each paradigm = a way of seeing problems:

| # | Perspective | Core Question | Origin |
|---|------|---------|---------|
| 1 | **Military** | 这是谁和谁的博弈？最优的战略位置在哪？奇正关系如何？主客方谁更有利？ | 孙子/孙膑《孙子兵法》 |
| 2 | **Medical** | 这个系统的症结在哪？气血（资源/信息）怎么流通？表里寒热虚实怎么判断？ | 《黄帝内经》/张仲景 |
| 3 | **Agricultural** | 根本的生存资料是什么？周期性规律是什么？什么才是"根本"而不只是"表面"？ | 氾胜之/贾思勰《齐民要术》 |
| 4 | **Artisan** | 这件事做成需要什么条件？核心工艺/手艺在哪？怎么从0到1？有什么现成工具复用？ | 鲁班/《天工开物》 |
| 5 | **Strategist** | 各方的利益诉求是什么？最大的公约数在哪？合纵还是连横？谁是可以争取的盟友？ | 鬼谷子/苏秦张仪 |
| 6 | **Daoist** | 这件事的反向是什么？不做什么比做什么更重要？强行干预还是顺势而为？ | 老子/庄子 |
| 7 | **Legalist** | 规则是什么？激励和惩罚怎么设置？制度保障在哪？怎么执行才能落地？ | 韩非子/商鞅 |
| 8 | **Confucian** | 这件事的伦理根基是什么？人的价值在哪？秩序和人情如何平衡？ | 孔子/孟子 |
| 9 | **Historical** | 历史上类似的事发展结果如何？这件事处在什么"周期"阶段？兴衰规律的启示？ | 司马迁/《资治通鉴》 |
| 10 | **Yin-Yang** | 哪些力量在对抗？怎么达到平衡？相生相克关系如何？变化趋势是什么？ | 邹衍/阴阳五行 |
| 11 | **Zen** | 放下所有预设再来看，这件事的本质是什么？哪些是概念/标签/执念？ | 慧能/《坛经》 |
| 12 | **Hydraulic** | 资源怎么流动？通路在哪断在哪？堵和疏哪个更有效？疏导的渠道是什么？ | 李冰/潘季驯 |

### 5-Element Perspective Selector

Not random selection，而是Through 5-element relations, ensures structural diversity：

```
① Problem 5-element classification：
   木 = 生长/创造/创新（新产品、创意方案、新业务）
   火 = 扩张/转化/能量（市场扩张、组织变革、产能提升）
   土 = 稳定/承载/存储（系统架构、数据治理、合规风控）
   金 = 收敛/切割/精炼（成本控制、流程优化、精简团队）
   水 = 流动/沟通/适应（团队协作、客户关系、谈判、供应链）

② 生克关系展开生成5个维度：
   Generating me -> upstream/resources
   I generate -> output/impact destination
   Controlling me -> constraints/risks
   I control -> what I can control
   Same element -> how peers do it

③ Each dimension matches 1-2 specific perspectives：
   ├── 木（创造）匹配：工匠视角 + 纵横家视角
   ├── 火（扩张）匹配：兵家视角 + 医家视角
   ├── 土（稳定）匹配：农家视角 + 儒家视角 + 水利家视角
   ├── 金（收敛）匹配：道家视角 + 史家视角 + 法家视角
   └── 水（流动）匹配：禅家视角 + 阴阳家视角 + 纵横家视角
```

### Perspective Matrix Output Format

All perspectives output simultaneously in a matrix：

```
┌─────────────────────────────────────────────────────────────┐
│  【Cultural Perspective Matrix】                                           │
│                                                             │
│  ╔═══════════════════════════════════════════════════════╗  │
│  ║ 木 · 创造/生长                                        ║  │
│  ║   ├ 工匠视角：做成这件事的核心工艺/条件是什么？        ║  │
│  ║   │            有无现成工具可以复用？                   ║  │
│  ║   └ 纵横家视角：各方的利益诉求交点在哪？                ║  │
│  ╠═══════════════════════════════════════════════════════╣  │
│  ║ 火 · 扩张/转化                                        ║  │
│  ║   ├ 兵家视角：当前态势主客关系？奇兵在哪？              ║  │
│  ║   └ 医家视角：系统的症结在表还是在里？通还是不足？      ║  │
│  ╠═══════════════════════════════════════════════════════╣  │
│  ║ 土 · 稳定/承载                                        ║  │
│  ║   ├ 农家视角：根本的资源周期是什么？什么才是根本？      ║  │
│  ║   ├ 儒家视角：这件事的伦理根基在哪？人的价值如何？      ║  │
│  ║   └ 水利家视角：资源的通路在哪？堵还是疏？              ║  │
│  ╠═══════════════════════════════════════════════════════╣  │
│  ║ 金 · 收敛/精炼                                        ║  │
│  ║   ├ 道家视角：不做什么比做什么更重要？反向是什么？      ║  │
│  ║   ├ 法家视角：激励和惩罚机制怎么设置才能落地？          ║  │
│  ║   └ 史家视角：历史上类似情况怎么发展的？周期阶段？      ║  │
│  ╠═══════════════════════════════════════════════════════╣  │
│  ║ 水 · 流动/适应                                        ║  │
│  ║   ├ 禅家视角：放下预设，这件事的本质是什么？            ║  │
│  ║   └ 阴阳家视角：哪些力量在对抗？平衡点在哪？            ║  │
│  ╚═══════════════════════════════════════════════════════╝  │
│                                                             │
│  视角发现→盲点清单：[从上述视角中合并的关键盲点]            │
└─────────────────────────────────────────────────────────────┘
```

### Integration with Eight-Facet Mirror

```
视角矩阵（Step 0.5）
    ↓ 产出：盲点清单 = "从这些视角发现了一些之前没想过的问题"
    ↓
八面镜审视（Step 1）
    ↓ 带着盲点清单，用八面镜的8个维度重新审视问题
    ↓ 交叉关联：视角发现 ↔ Facet发现
    ↓ 产出：每个Facet的评分 + 修正后的发现
    ↓
发散引擎→收敛→MCTS模拟→决策（正常流程）
```

**关键：八面镜不分析每个视角**。八面镜分析的是问题本身，只是多了一副从视角矩阵借来的眼镜。视角矩阵的作用是给八面镜的盲点检测层输入。

### Perspective Knowledge Rules (anti-deadlock)

```
子agent/主流程获取视角知识时，必须遵守：

① 记忆系统查询（mcts-td-value-archive.md + 技能记忆）
   命中 → 直接使用，标记 source:memory → 不再触发再次查询
   未命中 → 继续

② 当前会话上下文（对话已有信息）
   命中 → 使用，标记 source:context
   未命中 → 继续

③ 外部获取（WebSearch / WebFetch）
   获取到 → 经gate-check过滤后写入记忆，标记 source:external
   未获取到 → 标注【暂无公开数据】

子agent判断规则：
   if source == "memory":
       直接使用，不触发再次查询，不写入重复记录
   if source == "external" or source == "context":
       正常处理，处理后经gate-check写回记忆

Anti-duplicate: check memory for same key before writing back，有则比较timestamp保留最新的
```

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
