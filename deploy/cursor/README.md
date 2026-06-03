# MCTS-TD 决策引擎 — Cursor 部署说明

## 安装方式

### 方式一：项目级规则（推荐）

将 `rules/decision-engine.mdc` 复制到你的项目目录：

```bash
cp deploy/cursor/rules/decision-engine.mdc .cursor/rules/decision-engine.mdc
```

### 方式二：全局规则

复制到 Cursor 的全局规则目录：

```bash
cp deploy/cursor/rules/decision-engine.mdc ~/.cursor/rules/decision-engine.mdc
```

## 验证

在 Cursor 中输入任意有多个实现方案的任务（如"帮我实现用户登录"），如果 AI 先问你的限制条件、列出多个方案、逐个推演后再执行，说明安装成功。

## 文件说明

```
deploy/cursor/
├── README.md                    # 本说明文件
└── rules/
    └── decision-engine.mdc      # Cursor Rules 格式的决策引擎规则
```