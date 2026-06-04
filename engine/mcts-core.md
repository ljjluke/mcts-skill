---
name: mcts-core
description: (已归档) 本文件已被拆分为 4 个独立的引擎文件。请直接使用新文件。
---

# ⚠️ 本文件已拆分

`mcts-core.md` (原 1703 行) 已被拆分为 4 个独立引擎文件，**不要再引用本文件**。

## 新文件索引

| 原章节 | 新文件 |
|--------|--------|
| 第0步：需求约束收集 | [`engine/mcts-constraint.md`](./mcts-constraint.md) |
| 第1步：六维地图+六路侦查+视角轮盘+粗筛 | **[`engine/mcts-diverge.md`](./mcts-diverge.md)** ← 发散引擎，重点升级 |
| 第2步：逐轮独立推演+知识注入+补全箱 | [`engine/mcts-simulate.md`](./mcts-simulate.md) |
| 第3~3.6步：汇总+自检+盲区审计+再推演 | **[`engine/mcts-converge.md`](./mcts-converge.md)** ← 仲裁引擎，新增盲区审计 |
| 学习引擎 | [`engine/td-learner.md`](./td-learner.md) (未变) |

## 变更概要

```
拆分前 (1.3.0):                     拆分后 (1.4.0):
engine/mcts-core.md (1703行)         engine/mcts-constraint.md (约束)
  ├─ 第0步: 约束收集                  engine/mcts-diverge.md (发散)
  ├─ 第1步: 已知检测+资料+方案+粗筛     engine/mcts-simulate.md (推演)
  ├─ 第2步: 逐轮推演+知识+缺口的查     engine/mcts-converge.md (仲裁+自检)
  ├─ 第3步: 汇总比较                  engine/td-learner.md (学习，未变)
  ├─ 第3.5步: 自检+熔断
  ├─ 第3.6步: 盲区审计 (新增)
  └─ 再推演+TD误差
```

## 版本更新说明

**1.3.0 → 1.4.0 的升级内容包括:**
1. 引擎文件从 1 个拆分为 4 个，职责清晰
2. 领域熟悉度检测 → **六维领域地图**（6维评分+盲区识别）
3. 资料收集 → **六路侦查**（6条情报路径+交叉验证）
4. 方案生成 → **视角轮盘**（10种视角+4~8个强制覆盖）
5. 新增 **第3.6步: 领域盲区审计**（检查视角覆盖度）
6. 全局补全箱升级为 **V2：知识缺口 + 视角覆盖追踪**