# MCTS-TD 决策引擎 — OpenCode 部署说明

## 安装方式

### 方式一：项目规则

将 `rules/decision-engine.mdc` 复制到 OpenCode 的项目规则目录：

```bash
cp deploy/opencode/rules/decision-engine.mdc .opencode/rules/decision-engine.mdc
```

### 方式二：自定义指令

将 `rules/decision-engine.mdc` 的内容添加到 OpenCode 的自定义指令中。

## 验证

在 OpenCode 中输入任意有多个实现方案的任务，如果 AI 先问限制条件、列出多个方案、逐个推演后再执行，说明安装成功。

## 文件说明

```
deploy/opencode/
├── README.md
└── rules/
    └── decision-engine.mdc
```