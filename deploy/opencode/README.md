# OpenCode 部署 — MCTS-TD Planner

将以下规则添加到 OpenCode 的配置中：

## 方式一: opencode.mdc

在项目根目录创建或编辑 `.opencode/rules/decision-engine.mdc`：

```yaml
---
description: MCTS-TD 通用决策引擎 — 先想清楚再做
globs: []
---
```

然后将 `rules/RULES.md` 的内容追加到该文件中。

## 方式二: 系统提示

将 `rules/RULES.md` 的内容直接添加到 OpenCode 的系统提示中。

## 方式三: 自定义指令

在 OpenCode 的自定义指令中添加:

```
当收到任务时，先检查是否有多种可行方案。如果有，按以下流程执行:
第0步: 收集需求约束，信息不全就问用户
第1步: 查资料理解领域，有依据地列出候选方案
第2步: 对每个方案独立进行3步因果链推演
第3步: 汇总比较，选最优方案再执行
第5步: 总结经验并记录下来
```