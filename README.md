# MCTS-TD Planner

> **通用决策引擎** — 模拟人脑"先想清楚再做"的推演式决策机制

## 亮点摘要

### 像AlphaGo下围棋一样推演决策

AlphaGo 下棋时不是只走一步看一步，而是在脑子里同时推演多个走法：

```
当前棋局
  ├── 走A位 → 对方可能走B位 → 我再走C位 → 评估形势...
  ├── 走D位 → 对方可能走E位 → 我再走F位 → 评估形势...
  └── 走G位 → 对方可能走H位 → 评估形势...
  
比较三个分支的结果 → 选最好的那步走
```

人脑做复杂决策时也是这样：

```
问题: "项目需要实现用户认证"
  ├── 方案A(OAuth2) → 需要外部依赖 → 但政策禁止 → 排除
  ├── 方案B(gin-jwt) → 框架原生支持 → 零依赖 → 推演...
  └── 方案C(自实现JWT) → 灵活但工作量大 → 推演...

比较三个方案 → 选最适合当前项目的
```

**本 Skill 正是把这个"多分支推演再比较"的机制，变成了 Claude Code 可执行的决策流程。**

### 核心能力

| 能力 | 人脑类比 | 本 Skill 实现 |
|------|---------|--------------|
| **多方案并行推演** | 脑子里同时推演几个方案 | 分轮独立推演，每轮聚焦一个方案 |
| **信息不全时暂停** | "等一下，我先查查这个" | 缺口检测 → 问用户或查资料 → 再继续 |
| **结合历史经验** | "上次这么做成功了" | 知识图谱召回 → 按可信度加权 |
| **方案不一定适合项目** | "方案好不代表适合我" | 项目匹配度 M 修正最终评分 |
| **从错误中学习** | 经历越多判断越准 | TD更新 → 知识图谱持久化 |
| **新旧知识冲突** | "旧经验可能过时了" | 知识状态机(假设/验证/确认/争议/证伪/回滚) |

### 解决的根本问题

```
❌ 传统做法:
  "帮我实现用户认证"
  → 直接选最常见方案(OAuth2) → 实现完了
  → "不能引入外部依赖啊！"
  → 重来...

✅ 本Skill的做法:
  "帮我实现用户认证"
  → 检测到"这个任务有多种实现方式" → 启动决策引擎
  → 约束收集: "能引入外部依赖吗？"
  → "不能" → OAuth2被排除 → 生成gin-jwt和自实现JWT
  → 逐一推演 → 选gin-jwt → 一次性成功
```

---

## 项目结构

```
mcts-td-planner/
├── SKILL.md                          # 主入口 — 自动启动检测 + 决策流程定义
├── engine/
│   ├── mcts-core.md                  # MCTS 推演引擎 — 逐方案深度推演规则
│   └── td-learner.md                 # TD 学习引擎 — 知识图谱 + 状态机管理
├── policies/
│   ├── task-policy.md                # 通用决策策略 — 推演格式/评分标准/汇总规则
│   └── code-task-policy.md           # 代码场景策略（兼容引用）
├── references/
│   └── algorithm-reference.md        # 算法原理与设计决策文档
└── memory/
    └── mcts-td-value-archive.md      # 跨会话知识图谱存储
```

---

## 算法原理

本 Skill 融合了两个核心算法：

### MCTS（蒙特卡洛树搜索）

传统 MCTS 的四阶段（Selection → Expansion → Simulation → Backpropagation）被改造为适合 Claude Code 的推理流程：

| 传统MCTS阶段 | 本Skill对应 | 关键区别 |
|------------|------------|---------|
| Selection | 选择下一个要推演的方案 | CLT-UCB公式替代随机选择 |
| Expansion | 方案生成（基于约束和资料） | 不是随机展开，是有依据的 |
| Simulation | 3步因果链推演 | 不是随机模拟，是结构化推理 |
| Backpropagation | Gamma折扣反向传播 | 用Welford方差更新 |

核心创新：使用 **基于中心极限定理的UCB变体（CLT-UCB）** 替代经典UCB1，通过方差驱动探索，更适合无界奖励场景。

### TDL（时序差分学习）

用于跨会话的价值函数学习和优化：

```
TD误差 = 实际结果 - 推演预期
价值函数 += 学习率 × TD误差
```

配合**知识图谱+状态机**管理每条知识：

```
HYPOTHESIS(假设) → PROVISIONAL(待验证) → CONFIRMED(已确认)
                                         → DISPUTED(争议) → REFUTED(证伪)
                                                          → CONFIRMED(回滚)
```

每条知识独立管理状态，支持多版本共存、冲突检测、回滚。

---

## 决策流程

```
第0步: 约束收集 → 问清楚再动手，不假设
第1步: 方案生成 → 查资料理解领域，有依据地列方案
第2步: 分轮推演 → 每个方案独立推演3步因果链
第3步: 汇总比较 → V_final = V×0.6 + M×0.4, CLT-UCB排序
第4步: 执行 → 只执行最优方案
第5步: 学习 → TD更新知识图谱，下次更准
```

### 关键机制

- **自动启动检测**：`alwaysApply: true`，每次对话自动加载，但只在需要时启动决策流程
- **缺口检测**：推演中遇到信息不全，暂停→问用户/查资料→再继续，禁止脑补
- **全局补全箱**：跨方案共享已补全的知识，避免重复查资料
- **项目匹配度**：好方案不一定适合当前项目，用匹配度M修正评分
- **多路召回**：精确匹配/主维度匹配/标签匹配/关联扩散，五条路径同时召回

---

## 触发条件

不依赖用户说"选哪个"或"不确定"，而是分析**任务本身的性质**：

```
Type A: 执行类任务 — 检测是否有多个可行的实现方式
Type B: 决策类任务 — 直接触发
Type C: 信息类任务 — 不触发
Type D: 排查类任务 — 触发简化推演
```

---

## 安装方法

### 方式一：通过插件市场安装（推荐）

```bash
# 在 Claude Code 中执行：
/plugin marketplace add ljjluke/mcts-skill
```

### 方式二：手动配置

在 `~/.claude/settings.json` 中添加：

```json
{
  "extraKnownMarketplaces": {
    "mcts-td-planner": {
      "source": {
        "source": "github",
        "repo": "ljjluke/mcts-skill"
      }
    }
  }
}
```

### 验证安装

```bash
# 安装后，在 Claude Code 中查看已安装的插件：
/plugin list
```

然后输入任意有多个实现方案的任务（如"帮我实现用户认证"），如果看到以下输出说明安装成功：

```
⚡ [MCTS-TD] 检测到决策需求，启动决策引擎
触发原因: 该任务有多种可行的实现方式
```

---

## 参考

- [hrpan/tetris_mcts](https://github.com/hrpan/tetris_mcts) — 本项目受其 MCTS+TD 混合架构启发
- [Reinforcement Learning: An Introduction](http://incompleteideas.net/book/the-book.html) — Sutton & Barto
- [A Survey of Monte Carlo Tree Search Methods](https://ieeexplore.ieee.org/document/6145622)
- [Mastering the game of Go without human knowledge](https://www.nature.com/articles/nature24270) — AlphaGo Zero