# Ponder 真实架构（v1.18.65）

> 当前仓库是一个 `luke` Plugin 和九个标准 Skill。执行合同以各 `skills/*/SKILL.md` 为准；CLI 脚本提供守卫、持久化和计算能力，但不是隐藏工作流引擎。

## 1. 顶层模型

```text
one luke Plugin
├─ skills/ponder/       完整十阶段编排
├─ 8 specialist Skills 独立阶段入口
├─ engine/              多 Skill 共享只读方法库
├─ scripts/             共享运行时、计算和 simple MMA
└─ hooks/scripts/       Claude Code 生命周期适配
```

| Skill | 所有权 |
|---|---|
| `ponder` | 完整十阶段顺序、阶段交接、持久守卫、历史/规则注入和收尾 |
| `interview` | 需求画像采集 |
| `explore` | 前提审视与多视角发散 |
| `blindspots` | 八维独立盲点审计 |
| `solutions` | 方案生成、收敛和评分 |
| `simulate` | 幸存方案情景推演 |
| `debate` | 立论、攻击和抗压排名 |
| `synthesis` | 从完整证据形成最终建议 |
| `memory` | 召回、存储和结果反馈 |

专项 Skill 可以独立调用，不读取 Ponder 的 step guard，也不要求前序阶段已经执行。完整 `/luke:ponder` 则复制各阶段完整合同并强制顺序执行。

## 2. 完整十阶段

```text
interview → shensi → divergence → bagua → plans
          → converge → score → simulate → debate → synthesis
```

`score` 与 `simulate` 是不同阶段：前者对每个幸存方案做统一八维评分，后者在评分完成后对每个幸存方案做隔离情景推演。高确定性只能减少重复深挖，不能省略阶段、Subagent 或展示；低确定性要求增加验证、反例和情景覆盖。

## 3. 主线程与 Subagent

主线程负责需要全局一致性的工作：画像刷新、神思、发散共识、盲点聚合、收敛、攻击轮、立场跟踪和综合。

| 阶段 | worker 单位 | 完成屏障 |
|---|---|---|
| 八维盲点 | 每个维度一个 worker，共八个 | 八个结果全部返回并逐项展示后才能聚合 |
| 方案生成 | 每个差异化方向一个 worker | 全部方案返回并展示后才能收敛 |
| 方案评分 | 每个 survivor 一个 worker | 全部 scorecard 返回后才能比较 |
| 情景推演 | 每个 survivor 一个隔离 worker | 全部推演返回并展示后才能汇总 |
| 辩论立论 | 每个 survivor 一个 worker | 全部 opening case 返回并展示后才能攻击和排名 |

任何 worker 失败都必须重试或明确报告；禁止静默遗漏，禁止对 partial results 排名。

## 4. 三层 anti-skip

完整 Ponder 通过三层机制防止跳步：

1. `skills/ponder/SKILL.md` 要求每阶段执行 `before`、存储和 `after`，交互恢复时先读 `status`。
2. `skills/ponder/scripts/step-guard.js` 持久化完成状态，阻断缺失前序、score/simulate 混淆、无效 certainty 和不足 worker 数。
3. `skills/ponder/scripts/orchestrate.js` 在正式存储前再次检查顺序；非法输出、存储失败或指标失败不得推进 guard。`finalize` 和 synthesis 只在十阶段完整后运行。

Guard 状态只写 `PONDER_DATA_DIR`，不写 Plugin 安装目录。

## 5. Prompt 与 engine 所有权

Prompt JSON 跟随 owning Skill：

```text
skills/explore/resources/{shensi,divergence}.json
skills/blindspots/resources/bagua.json
skills/solutions/resources/{plans,converge,score}.json
skills/simulate/resources/simulate.json
skills/debate/resources/debate.json
skills/synthesis/resources/synthesis.json
```

这些资源定义阶段输入、输出 schema、certainty、推理动态和终态画像等合同。完整 Ponder 跨 Skill 读取同一份资源，不保留根级重复副本。

`engine/*.md` 是多个 Skill 共享的只读方法库。算法或开发审计文档位于 `references/`，不伪装成运行时 engine。

## 6. 运行时路径边界

`scripts/runtime-paths.js` 是路径单一权威：

- `pluginRoot`：安装后的 Plugin，只读资源根。
- `projectRoot`：调用工程，来自 `PONDER_PROJECT_DIR` 或调用时 cwd。
- `dataRoot`：持久状态根，来自 `PONDER_DATA_DIR`，默认 `~/.claude/data/skills/ponder/`。

用户明确要求生成的文件只能写调用工程中的安全相对路径。记忆、metrics、weights、evolution、guard 和 runtime metadata 只能写 dataRoot。Containment 校验防止 Plugin 内写入、`..`、符号链接和 Windows junction 逃逸；child process 继承相同 project/data env。Bundled seed 只读，首次初始化或 schema 补全只修改 dataRoot 副本。

## 7. Simple MMA

当前生产记忆由三个独立文件组成：

```text
PONDER_DATA_DIR/memory/
├─ philosophy.json
├─ knowledge.json
└─ step_history.json
```

- `simple-io.js`：三库加载与原子写入。
- `simple-store.js`：按 philosophy/domain expert/step history 路由存储。
- `simple-recall.js`：anchor、tag、keyword 多路召回。
- `simple-lifecycle.js`：outcome、状态升级、衰减和保洁。
- `domain-detector.js`：领域残留兜底。
- `migrate-to-simple.js`：幂等读取旧 shards/working memory，保留旧数据并迁入三库。

存储链先提炼领域无关知识，再把具体案例放入 `original_example`。跨领域召回降低领域专用条目权重，同领域查询仍可使用。用户后续的 confirmed/refuted/corrected 反馈通过 `point_id` 更新知识生命周期。

## 8. Ponder 独享运行时

`skills/ponder/scripts/` 只承载完整流程专用实现：

- `step-guard.js`：十阶段持久守卫。
- `orchestrate.js`：历史、规则、步骤存储、指标和收尾。
- `pipeline-metrics.js`：阶段 metrics。
- `weights.js`：学习权重。
- `evolve.js`：运行分析和自适应规则。

Bundled seeds 位于 `skills/ponder/resources/`，mutable runtime copy 位于 dataRoot。共享 CLI gateway `scripts/mcts.js` 只分派 `compute`、`l10n`、`knowledge`、`profile`，不是编排层。

## 9. Hooks

`hooks/hooks.json` 把 Setup、SessionStart 和 SessionEnd 统一交给 `hooks/scripts/bootstrap-hook.js`：

- Setup / SessionStart：幂等运行 simple MMA migration，读取三库状态，并检查 agent-reach。
- SessionEnd：运行 simple lifecycle 保洁。

Hook 不启动 transcript monitor，不管理 PID，也不通过已删除的 `mcts.js mma` gateway 写入。异常不能阻塞 Claude Code 会话，但也不能假报存储成功。

## 10. 验证不变量

1. 恰好九个 `skills/*/SKILL.md`，且 `/luke:ponder` 保持完整入口。
2. 十阶段名称和 score/simulate 分离在 Skill、guard、metrics、metadata 中一致。
3. 五组并行 worker 均有完整 fan-out/fan-in 和逐项展示屏障。
4. Specialist Skills 不依赖 Ponder guard。
5. 所有 prompt/engine/reference 路径存在，JSON 可解析。
6. Simple MMA migration、store、recall、outcome 和 domain tests 通过。
7. Hook 和 gateway 只调用现存模块。
8. 只读 Plugin smoke 后文件哈希不变；所有 mutable state 只出现在 dataRoot。
9. Windows junction、symlink、绝对工程输出和 traversal 负测通过。
10. Plugin manifest、README、Ponder banner 和 metadata version 一致。
