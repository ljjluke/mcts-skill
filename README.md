<p align="center">
  <img src="https://img.shields.io/badge/版本-1.3.0-blue" alt="版本">
  <img src="https://img.shields.io/badge/状态-稳定-green" alt="状态">
  <img src="https://img.shields.io/badge/许可-MIT-yellow" alt="许可">
</p>

<h1 align="center">🧠 MCTS-TD Planner</h1>

<p align="center">
  <b>通用决策引擎 — 像下棋一样，先在脑子里推演所有可能，再走那步最好的</b>
</p>

<p align="center">
  <b>不绑定任何平台，Claude Code / Cursor / OpenCode / Trae / CodeX 都能用</b>
</p>

<br>

---

## 🎯 它解决什么问题

### 你肯定遇到过这种事

```
你说: "帮我实现用户登录"
AI: 好 → 咔咔咔写完了
你: "呃...我们公司规定不能用外部依赖"
AI: 哦 → 删了重写
你: "还有...我们只能用MySQL"
AI: 好 → 又删了重写
```

**一次对话，三次返工。** 问题出在哪？不是 AI 不行，是**它没先问清楚就动手了。**

### 装了它之后

```
你说: "帮我实现用户登录"
AI: ⚡ 这事有好几种做法，我先问清楚你的情况
    → "有什么限制条件吗？"
你: "不能引入外部依赖，只能用 MySQL"
AI: → 那 OAuth2 排除，JWT 和 Session 二选一
    → 推演两种方案的结果
    → 选最合适你的那个
    → 一次性写好 ✅
```

**一次过，不返工。** 区别就在于：**先想清楚，再动手。**

---

## ✨ 亮点

### 像高手下棋一样做决策

| 高手下棋 | 你做决策 |
|---------|---------|
| 不走一步看一步 | 不想到一个方案就直接干 |
| 脑内推演所有可能走法 | 脑内推演所有可行方案 |
| 选最优那步再落子 | 选最合适的那个再执行 |
| 输了的棋复盘总结 | 做完的事总结经验，下次更准 |

### 它的核心能力

| 能力 | 说人话 |
|------|--------|
| **问清楚再动手** | 信息不全就问你，不自己瞎猜 |
| **多方案推演** | 每个方案在脑子里走一遍，不实际执行 |
| **经验越用越准** | 做过类似的事会自动参考，还会总结 |
| **适合的才是最好的** | 不盲目选评分最高的，选最适合你当前情况的 |
| **记忆不会丢** | 经验自动记住，更新 skill 也不丢失 |
| **不绑定平台** | Claude Code、Cursor、OpenCode、Trae、CodeX 都能用 |

---

## 🚀 安装

### Claude Code（推荐）

```bash
# 方式一：从插件市场安装（需要联网）
/plugin marketplace add ljjluke/mcts-skill

# 方式二：本地安装（已克隆仓库）
/plugin install .
```

装好后输入任意任务，看到 ⚡ 标志说明生效。

### 通用安装（任意平台）

```bash
# 克隆仓库
git clone https://github.com/ljjluke/mcts-skill.git
cd mcts-skill

# 一键安装（自动检测当前平台，复制文件到正确位置）
bash scripts/install.sh
```

### 各平台手动安装

各平台的安装文件内联了 `engine/`、`policies/`、`agents/` 的**全部规则**，与 Claude Code 版本功能对等，不是阉割版。

| 平台 | 安装方式 | 内容说明 |
|------|---------|---------|
| **Cursor** | `cp deploy/cursor/rules/decision-engine.mdc .cursor/rules/decision-engine.mdc` | 三引擎+知识图谱+记忆管理+熔断机制 完整版 |
| **OpenCode** | `cp deploy/opencode/rules/decision-engine.mdc .opencode/rules/decision-engine.mdc` | 同上 |
| **Trae** | 将 `deploy/trae/instructions.md` 的内容添加到 Trae 的项目规则中 | 同上 |
| **CodeX** | 将 `deploy/codex/instructions.md` 的内容添加到 CodeX 的 Agent 系统提示中 | 同上 |

> 各平台详细部署说明：[deploy/](./deploy/)

### ⚡ 记忆数据安全

本 Skill 的知识图谱存储在 `~/.claude/data/skills/mcts-td-planner/` 目录，与 skill 代码文件物理隔离。

| 场景 | 记忆数据 | 说明 |
|------|---------|------|
| skill 初次安装 | ✅ 模板自动复制到 data 目录 | 首次安装时初始化空的知识图谱 |
| skill 更新/重装 | ✅ **数据保留** | data 目录不会被覆盖 |
| 卸载后重装 | ✅ **数据保留** | 除非手动删除 data 目录 |
| 升级版本（如 1.3→1.4） | ✅ **数据保留** | 升级不影响已有知识条目 |

> 想清空记忆重新积累知识，手动删除 `~/.claude/data/skills/mcts-td-planner/` 目录即可。

---

## 🔧 三引擎决策流程

本引擎由三个独立引擎组成，**每个引擎有可验证的产出，不可跳过**：

```
用户需求理解 → 先听懂用户说了什么
       │
       ▼
┌───────────────────────────────┐
│  发散引擎（头脑风暴，可多轮）    │
│                               │
│  发散 → 缺信息? → 问用户       │
│  → 获得新信息 → 再来一轮发散    │
│  → 收敛 → 输出方案清单         │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│  推演引擎（子 agent 独立推演）  │
│                               │
│  子A ⟳ 子B ⟳ 子C（互不知对方） │
│  独立推演 → 记录问题 → 继续     │
│  ★ 问用户不阻塞其他子agent     │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│  仲裁引擎（汇总与决策）         │
│                               │
│  汇总结果+问题 → 统一问用户    │
│  → 重新评估 → 自检 → 决策     │
└───────────────────────────────┘
```

### 验证规则

```
✅ 有发散和收敛记录 → 发散引擎已执行
✅ 推演报告数 = 方案数 → 推演引擎已执行
✅ 有决策报告（含自检）→ 仲裁引擎已执行
```

### 执行流程

```
第1步: 汇总比较 — V_final = 技术评分×0.6 + 项目匹配度×0.4
第2步: 推演自检 — 自我质疑，防止推演错了还执行
第3步: 执行 — 只做选中的那个
第4步: 总结 — 经验记下来，下次用得上
```

---

## 🧠 模拟人脑的哪些能力

| 人脑能力 | 引擎模拟 |
|---------|---------|
| 看到问题想到相关经验 | 联想回忆 — 最相关的知识自动浮现 |
| 记不清了努力回想 | 碎片补全 — 顺着已有线索拼凑完整 |
| 想不起来去查资料 | 外部求证 — 查文档/问用户 |
| 经验可能过时了 | 纠偏机制 — 发现矛盾就标记，不强化错误 |
| 旧知识和新知识打架 | 状态机 — 假设/验证/确认/争议/证伪/回滚 |
| 很久不用的事慢慢忘了 | 记忆衰减 — 不用的知识自动归档 |
| 被人一提又想起来了 | 回忆触发 — 相关线索出现时从归档中找回 |

---

## 📁 项目结构

```
mcts-td-planner/
├── SKILL.md                ← 核心 Skill 定义（Claude Code 入口）
├── plugin.json             ← 插件市场元数据
├── marketplace.json        ← 插件市场清单
│
├── engine/                 ← 引擎核心规则
│   ├── mcts-core.md          推演引擎（MCTS 推演+自检+熔断）
│   └── td-learner.md         学习引擎 + 知识图谱（TDL 价值管理）
│
├── policies/               ← 决策策略
│   ├── code-task-policy.md   代码任务推演格式与策略
│   └── task-policy.md        通用推演格式与策略
│
├── agents/                 ← Agent 定义
│   └── mcts-decider.md       决策子 Agent 行为指令
│
├── references/             ← 参考资料
│   └── algorithm-reference.md 算法原理与设计决策
│
├── memory/                 ← 跨会话记忆持久化
│   ├── mcts-td-value-archive.md  活跃知识图谱
│   └── archive/                长期归档（自动管理）
│
├── scripts/                ← 辅助脚本
│   ├── install.sh            一键安装脚本
│   └── manage_memory.py      记忆管理（归档/回忆/清理）
│
├── deploy/                 ← 各平台部署配置
│   ├── cursor/                Cursor
│   ├── opencode/              OpenCode
│   ├── trae/                  Trae
│   └── codex/                 CodeX
│
├── .claude-plugin/         ← 插件元数据
│   ├── plugin.json
│   └── marketplace.json
│
├── CHANGELOG.md
└── README.md
```

---

<p align="center">
  <b>别急着动手，先想清楚。</b><br>
  <i>— MCTS-TD Planner</i>
</p>