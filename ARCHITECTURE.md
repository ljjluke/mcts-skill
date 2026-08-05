# Ponder 真实架构方案（2026-06-23）

> 基于 `skills/ponder/SKILL.md` + 实际代码分析。
> 无 Workflow、无管道编排器、无 Agent 调度层。
> 主线程 LLM 是唯一编排者，子 agent 只做"内容生产"。

---

## 一、核心原则

1. **`skills/ponder/SKILL.md` 是完整流程的唯一编排者** — 步骤顺序、数据传递全部写在其中；其他技能提供边界清晰的专项入口
2. **每个步骤 = 一个独立子逻辑** — 读 prompt → 执行 → 评分 → 展示
3. **产物相互独立 → 子 agent 并行** — 八卦镜/方案/推演/辩论
4. **需要全局连贯 → 主线程** — 神思/发散/收敛/综合
5. **评分是每步后的固定子逻辑** — 算法分 × 0.35 + LLM 分 × 0.65
6. **CLI 脚本是工具** — LLM 按需调用，不构成编排层

---

## 二、步骤分类矩阵

| 步骤 | 产出结构 | 各单元独立性 | 执行方式 |
|------|---------|------------|---------|
| 采访 | 单次对话流 | — | ❌ 主线程 |
| 神思 | 1 个反直觉发现 | — | ❌ 主线程 |
| 发散 | 6 视角 + 1 共识 | 视角间交叉印证 | ❌ 主线程 |
| **八卦镜** | **8 维度 × 各评分+子视角** | **各维度独立** | **✅ 子 agent 并行** |
| **方案** | **5-8 个方案** | **各方案独立** | **✅ 子 agent 并行** |
| 收敛 | 3-5 幸存方案 | 需要全局比较淘汰 | ❌ 主线程 |
| **推演** | **每个幸存方案 × 多个有意义场景** | **各方案隔离** | **✅ 通用 Subagent 并行** |
| **辩论** | **多方案 × 各立场+反驳** | **每立场独立** | **✅ 子 agent 并行** |
| 综合 | 单一结论 | 整合全局 | ❌ 主线程 |

### 判断标准

**子 agent = 每项独立，互不依赖，天然可并行**
- 八卦镜的 F1 不需要知道 F2 的评分结果
- 方案 A 不需要知道方案 B 的具体内容
- 推演时方案 A 的模拟结果不影响方案 B
- 辩论中方案 A 的立场不需要跟方案 B 商量

**主线程 = 需要全局连贯性或交叉印证**
- 发散：6 个视角需要融合成一个共识
- 收敛：必须同时看所有方案才能比较淘汰
- 综合：需要整合所有步骤的产出

---

## 三、整体流程

```
用户输入
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│ Step 1: 采访（主线程）                                    │
│ AskUserQuestion 一次一问，覆盖 天/地/人/法/本质            │
│ 产出: userRequest + userProfile                           │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Step 2: 神思（主线程 → 读 shensi.json）                   │
│ ① agent("虚静→神凝→神游→意象→言意", schema)               │
│ ② clarity-check.js + LLM 评分                             │
│ ③ 展示反直觉发现                                           │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Step 3: 发散（主线程 → 读 divergence.json）                │
│ ① agent("6视角审视", schema)                               │
│ ② clarity-check.js + LLM 评分                             │
│ ③ 展示 6 视角洞察 + 共识                                   │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Step 4: 八卦镜（子 agent 并行 → 读 bagua.json 获取 schema） │
│                                                          │
│  F1 ☰ 乾·驱动力  ←─ agent() ←── 子视角①兵家              │
│  F2 ☷ 坤·基础    ←─ agent()     子视角②纵横家             │
│  F3 ☳ 震·变化    ←─ agent() ←── 子视角①农家              │
│  F4 ☴ 巽·渗透    ←─ agent()     子视角②水利家             │
│  F5 ☵ 坎·风险    ←─ agent() ←── 子视角①医家              │
│  F6 ☲ 离·依附    ←─ agent()     子视角②阴阳家             │
│  F7 ☶ 艮·边界    ←─ agent() ←── 子视角①工匠              │
│  F8 ☱ 兑·汇聚    ←─ agent()     子视角②禅家...            │
│                                                          │
│  每个维度独立评分（0-10），互不等待                         │
│  主线程收集 8 个结果 → 整合展示                            │
│  → clarity-check.js + LLM 评分                            │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Step 5: 方案（子 agent 并行 → 读 plans.json 获取 schema）  │
│                                                          │
│  方案 A  ←─ agent("生成一个方案方向：...")                  │
│  方案 B  ←─ agent("生成另一个方案方向：...")                │
│  方案 C  ←─ agent("生成第三个方案方向：...")                │
│  方案 D  ←─ agent("生成第四个方案方向：...")                │
│  方案 E  ←─ agent("生成第五个方案方向：...")                │
│  （可设 5-8 个, 各 agent 无交叉）                         │
│                                                          │
│  主线程收集所有方案 → 去重/合并相似 → 展示                  │
│  → clarity-check.js + LLM 评分                            │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Step 6: 收敛（主线程 → 读 converge.json）                  │
│ ① agent("淘汰弱方案,保留3-5最优", schema)                  │
│    ↑ 这里是主线程，因为它需要同时看所有方案进行全局比较       │
│ ② clarity-check.js + LLM 评分                             │
│ ③ 展示幸存方案列表                                         │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Step 7: 推演（子 agent 并行）                              │
│                                                          │
│  survivorA  ←─ agent("十天干模拟方案A")                    │
│  survivorB  ←─ agent("十天干模拟方案B")                    │
│  survivorC  ←─ agent("十天干模拟方案C")                    │
│                                                          │
│  每个方案独立 agent，使用十天干框架：                       │
│    阳干(×1.0): 甲木/丙火/戊土/庚金/壬水                   │
│    阴干(×0.8): 乙木/丁火/己土/辛金/癸水                   │
│  V = Σ(achievement × weight) / Σ(weight)                 │
│                                                          │
│  主线程收集所有模拟结果 → clarity-check.js + LLM 评分      │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Step 8: 辩论（子 agent 并行 → 读 debate.json 获取 schema） │
│                                                          │
│  方案A立场  ←─ agent("站在方案A角度立论+反驳B/C")          │
│  方案B立场  ←─ agent("站在方案B角度立论+反驳A/C")          │
│  方案C立场  ←─ agent("站在方案C角度立论+反驳A/B")          │
│                                                          │
│  主线程收集所有立场 → 整合排名 → 展示                      │
│  → clarity-check.js + LLM 评分                            │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Step 9: 综合（主线程 → 读 synthesis.json）                 │
│ ① agent("结论+风险+待确认", schema)                        │
│    ↑ 主线程，需要整合前三步（推演+辩论）的所有输出           │
│ ② clarity-check.js + LLM 评分                             │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Step 10: 呈现                                             │
│ 逐项展示每步推理链和结论（自然语言）                        │
└─────────────────────────────────────────────────────────┘
```

---

## 四、每步的固定模式

```
┌──────────────────────────────────────────────────┐
│ ① 构建该步骤的 prompt                              │
│    - 主线程步骤: 读 resources/prompts/<name>.json → 参数替换  │
│    - 子 agent 步骤: 动态构造每个子 agent 的 prompt  │
├──────────────────────────────────────────────────┤
│ ② 执行                                            │
│    - 主线程: agent(prompt, schema)                │
│    - 子 agent: for each item → agent(prompt)      │
│      schema 保证结构化输出                          │
├──────────────────────────────────────────────────┤
│ ③ 清晰度评分（双重验证）                            │
│    a) node clarity-check.js <outputJSON>          │
│       → algoScore（算法分）                        │
│    b) agent("评估[步骤名]产出质量...")              │
│       → llmScore + is_clear + questions            │
│    c) finalScore = algo×0.35 + llm×0.65           │
│    d) ≥0.55 → 下一步                              │
│       <0.55 → AskUserQuestion 追问 → 重试          │
├──────────────────────────────────────────────────┤
│ ④ 展示产出（自然语言）                              │
└──────────────────────────────────────────────────┘
```

### 清晰度检查 detail

```javascript
// clarity-check.js（独立 CLI，不受 LLM 影响）
algoScore = fuzzyScore × 0.3 + densityScore × 0.4 + fieldScore × 0.3
// fuzzyScore: 模糊词比率（可能/大概/perhaps...）
// densityScore: 信息密度（字数/60）
// fieldScore: 字段填充率

// LLM 评分 schema:
{ is_clear: boolean, clarity_score: number(0-1), user_questions: string[] }

// 综合
finalScore = algoScore × 0.35 + llmScore × 0.65
if (finalScore < 0.55) {
  逐个 AskUserQuestion(user_questions) → 收集回答 → 重试该步
}
```

---

## 五、各步骤的 Prompt 与执行方式

| 步骤 | 文件 | prompt | schema | 执行 |
|------|------|--------|--------|------|
| 神思 | `shensi.json` | "虚静→神凝→神游→意象→言意" | `{counter_intuitive, insight}` | 主线程 |
| 发散 | `divergence.json` | "6视角，洞察+数据来源+假设" | `{perspectives[6], consensus}` | 主线程 |
| **八卦镜** | **`bagua.json`** | **"8维度评分"** | **`{dimensions[8]}`** | **子 agent×8** |
| **方案** | **`plans.json`** | **"生成一个方案方向"** | **`{name, rationale, condition}`** | **子 agent×5-8** |
| 收敛 | `converge.json` | "淘汰弱方案保留3-5" | `{survivors[3]}` | 主线程 |
| **推演** | **无 JSON** | **"十天干模拟方案X"** | **`{phases[], V, risk}`** | **子 agent×幸存数** |
| **辩论** | **`debate.json`** | **"站在方案X角度立论+反驳"** | **`{pros[], cons[]}`** | **子 agent×方案数** |
| 综合 | `synthesis.json` | "结论+风险+待确认" | `{conclusion, reasoning, risk}` | 主线程 |

### 子 agent 步骤的 prompt 构造逻辑

```
八卦镜 (Step 4):
  for i in 1..8:
    agent("你是[F{i}对应子视角]的专家。
           从[子视角]角度审视问题: {userRequest}
           输出: {dimension_score, evidence, uncertainty, sub_lens_insight}")

方案 (Step 5):
  for i in 1..N:
    agent("生成一个方案方向（与已有方案不同）。
           当前已有方向: [前面已生成的方向]
           输出: {name, rationale, condition}")

推演 (Step 7):
  for each survivor:
    agent("模拟方案: {survivor.name}。
           十天干框架: 甲木/乙木/丙火/丁火/戊土/己土/庚金/辛金/壬水/癸水
           输出每阶段达成度 + V值")
    schema: { phases: [{element, achievement, process}], V, risk }

辩论 (Step 8):
  for each survivor:
    agent("你是方案 {survivor.name} 的辩护者。
           你的任务: 立论(为什么你的方案好) + 反驳(指出其他方案的漏洞)
           其他方案: [其他方案的名称/摘要]
           输出: {pros: string[], cons: string[]}")
```

---

## 六、数据流：步骤间的输入输出

```
采访 → userRequest + userProfile
  │
  ▼
神思 → { counter_intuitive, insight }
  │
  ▼
发散 → { perspectives: [{name, insight, data_source, assumption}], consensus }
  │                          ↓ 传给八卦镜
  ▼
八卦镜 → { dimensions: [{name, score, evidence, uncertainty}], key_finding }
  │
  ▼
方案 → { plans: [{name, rationale, condition}] }
  │
  ▼
收敛 → { survivors: [{name, score, reason}] }
  │
  ▼
推演 → [{ name, phases: [{element, achievement, process}], V, risk }]
  │
  ▼
辩论 → { ranked: [{rank, name, pros, cons}], synthesis }
  │
  ▼
综合 → { conclusion, reasoning, risk, pending_user_questions }
```

---

## 七、CLI 脚本定位（工具，不是编排层）

```
scripts/mcts.js         → 统一入口，LLM 按需调用
scripts/mcts_compute.js → 数学工具（UCB/评分/收敛检测/注意力门控）
scripts/mcts_guard.js   → 合规守卫（可选安全检查点）
skills/ponder/scripts/orchestrate.js  → 步骤存储、历史和流程收尾工具
skills/ponder/scripts/evolve.js       → 离线分析工具
scripts/knowledge.js    → 知识获取工具
skills/ponder/scripts/weights.js      → 权重学习工具
scripts/clarity-check.js→ 清晰度评分 CLI（每步强制调用）
scripts/mma/*           → MMA 记忆引擎（存储/召回/衰减/审计）

目录所有权：`engine/` 与当前 prompt 资源是多 Skill 共享的只读资源；`skills/ponder/scripts/` 只承载完整 ponder 独享实现；`hooks/scripts/` 仅服务生命周期。Plugin 根目录只读，工程产物写调用工程，持久状态只写经 `scripts/runtime-paths.js` 校验的 `PONDER_DATA_DIR`。
```

使用时机：

| 工具 | 何时调用 | 是否强制 |
|------|---------|---------|
| `clarity-check.js` | 每步结束后 | ✅ 强制 |
| `orchestrate.js before` | 第一步前 | ❌ 可选（加载历史记忆） |
| `orchestrate.js after` | 最后一步后 | ❌ 可选（存储结果+触发自进化） |
| `mcts_compute.js *` | 需要数学运算时 | ❌ 可选 |
| `mcts_guard.js *` | 需要合规检查时 | ❌ 可选 |
| `mcts.js mma deqi` | 需要召回记忆时 | ❌ 可选 |
| `mcts.js mma ashi` | 需要存知识时 | ❌ 可选 |

---

## 八、代码与 SKILL.md 的对应关系

```
SKILL.md 定义                       →  代码文件
─────────────────────────────────────────────────
Step 1: 采访                         →  纯 LLM（无代码文件）
Step 2: 神思（读 shensi.json）        →  resources/prompts/shensi.json
Step 3: 发散（读 divergence.json）    →  resources/prompts/divergence.json
Step 4: 八卦镜（子 agent × 8）        →  resources/prompts/bagua.json（schema）
Step 5: 方案（子 agent × 5-8）        →  resources/prompts/plans.json（schema）
Step 6: 收敛（读 converge.json）      →  resources/prompts/converge.json
Step 7: 推演（子 agent × 幸存数）      →  无 JSON（动态构造 prompt）
Step 8: 辩论（子 agent × 方案数）      →  resources/prompts/debate.json（schema）
Step 9: 综合（读 synthesis.json）     →  resources/prompts/synthesis.json
Step 10: 呈现                         →  纯 LLM（无代码文件）
每步后清晰度检查                      →  scripts/clarity-check.js
或chestrate before/after              →  skills/ponder/scripts/orchestrate.js
自进化分析                            →  skills/ponder/scripts/evolve.js
```

---

## 九、不在此方案中的内容（辅助/可选组件）

| 组件 | 作用 | 是否必需 |
|------|------|---------|
| `weights.js` | 自动权重学习 | ❌ 可选 |
| `evolve.js` | 离线进化分析 | ❌ 可选 |
| `skills/ponder/resources/pipeline-meta.json` | 不可变初始种子；运行态副本位于 `PONDER_DATA_DIR` | ❌ 可选 |
| `MMA 记忆引擎` | 知识存储/召回 | ⚠️ 可选（但会丢失记忆积累） |
| `mcts_guard.js` | 合规守卫 | ❌ 可选 |
| `user_profile.js` | 用户画像 | ❌ 可选 |
| `hooks/hooks.json` | 会话生命周期 | ❌ 可选 |
| `adapters/cursor/` | Cursor IDE 适配 | ❌ 可选 |

---

## 十、关键设计决策

### 10.1 主线程 vs 子 agent 的判断标准

```
产物相互独立, 互不依赖 → 子 agent 并行
  八卦镜: F1 不需要等 F2
  方案: 方案A 不需要等 方案B
  推演: 模拟A 不影响 模拟B
  辩论: 立场A 不需要跟 立场B 商量

需要全局连贯或交叉印证 → 主线程
  发散: 6视角 → 融合成一个共识
  收敛: 同时看所有方案 → 比较淘汰
  综合: 整合所有步骤产出 → 单一结论
```

### 10.2 为什么不用 Workflow

- SKILL.md 的顺序执行天然适合 LLM 单线程
- 子 agent 只做"内容生产"，不做"决策调度"
- 步骤间的数据传递通过 main thread 的变量完成，不需要跨 Agent 通信

### 10.3 清晰度检查为什么是双重

- **算法分**：检测模糊词、信息密度、空字段——LLM 无法操纵
- **LLM 分**：语义级质量评估
- **0.35/0.65 权重**：防止任何一方独自决定是否通过

---

## 十一、总结

```
Ponder = skills/ponder/SKILL.md（编排） + resources/prompts/*.json（共享 schema） + engine/*.md（共享只读框架） + scripts/*.js（共享运行时） + skills/ponder/scripts/*.js（独享实现）
          ↑                     ↑                        ↑
        纯文本指令             结构化输出约束             CLI 工具
        LLM 执行               agent() 调用             按需调用

执行模型:
  主线程（LLM 自己）: 神思 → 发散 → 收敛 → 综合 → 呈现
  子 agent（Agent 工具）: 八卦镜(8维度) || 方案(5-8个) || 推演(N方案) || 辩论(N立场)
  每步后: clarity-check.js + LLM 双重评分
```
