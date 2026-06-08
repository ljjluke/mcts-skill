---
name: algorithm-reference
description: MCTS-TD hybrid algorithm reference — formulas, tetris_mcts design decisions, and correspondence mapping
metadata:
  type: reference
---

# 算法参考文档

## 项目来源

本 Skill 的核心算法设计借鉴自 [hrpan/tetris_mcts](https://github.com/hrpan/tetris_mcts) 项目，该项目将 MCTS + 神经网络 + TD 学习应用到俄罗斯方块游戏中，取得了超越人类水平的成绩。

### 借鉴的核心创新

| 创新点 | 原项目实现 | 本Skill适配 |
|--------|----------|------------|
| CLT-UCB选择 | `policy_clt` 函数 | `engine/mcts-converge.md` 中的CLT-UCB选择规则 |
| Welford方差 | `backup_trace_obs` 中的方差更新 | `engine/td-learner.md` 中的Welford方差推理 |
| Gamma折扣TD | `backup_trace_obs` 的折扣循环 | `engine/td-learner.md` 中的折扣反向传播 |
| 状态投影去重 | `projection` 机制 + `obs_arrays` | `engine/td-learner.md` 中的状态投影规则 |
| 经验回放 | `store_nodes` + `train_nodes` | `engine/td-learner.md` 中的经验回放规则 |

---

## MCTS 算法参考

### 经典 UCB1 公式

$$UCB1 = \frac{w_i}{n_i} + c \sqrt{\frac{\ln N}{n_i}}$$

- $w_i$: 节点 $i$ 的累计收益
- $n_i$: 节点 $i$ 的访问次数
- $N$: 父节点的总访问次数
- $c$: 探索常数（通常 $\sqrt{2}$）

### CLT-UCB 公式（本Skill使用）

$$UCB(a_i) = \bar{V}_i + \Phi^{-1}\left(1 - \frac{1}{N}\right) \times \sqrt{\frac{\sigma_i^2}{n_i}}$$

- $\bar{V}_i$: 平均价值
- $\Phi^{-1}$: 正态分布分位数的逆函数
- $\sigma_i^2$: 价值方差
- $n_i$: 访问次数
- $N$: 总访问次数

**为什么用CLT-UCB替代经典UCB1？**

| 维度 | 经典UCB1 | CLT-UCB |
|------|---------|---------|
| 奖励假设 | 奖励在[0,1] | 无界奖励 |
| 探索项 | 固定常数c | 方差驱动，自适应 |
| 适用场景 | 二人博弈 | 单玩家、无界奖励 |
| 不确定性表达 | 隐式 | 显式（通过方差） |

### MCTS 四阶段

```
1. Selection (选择):
   从根节点开始，使用树策略（如UCB1/CLT-UCB）选择最优子节点
   直到到达叶节点

2. Expansion (扩展):
   如果叶节点不是终止状态，为其创建子节点
   子节点数量 = 可用动作数

3. Simulation (模拟/Playout):
   从叶节点开始，使用默认策略执行模拟直到终止
   在AlphaGo中，模拟被NN替代

4. Backpropagation (反向传播):
   将模拟结果沿选择路径反向传播
   更新路径上所有节点的统计信息
```

---

## TDL 算法参考

### TD(0) 核心公式

$$V(s_t) \leftarrow V(s_t) + \alpha [r_{t+1} + \gamma V(s_{t+1}) - V(s_t)]$$

其中：
- $TD\_target = r_{t+1} + \gamma V(s_{t+1})$（自举目标）
- $\delta_t = r_{t+1} + \gamma V(s_{t+1}) - V(s_t)$（TD误差）

### TD(λ) 与资格迹

$$e_t(s) = \gamma \lambda e_{t-1}(s) + \mathbf{1}_{S_t = s}$$
$$\Delta V(s) = \alpha \delta_t e_t(s)$$

### SARSA vs Q-Learning

| 算法 | 类型 | 更新目标 |
|------|------|---------|
| SARSA | On-policy | $r + \gamma Q(s', a')$ |
| Q-Learning | Off-policy | $r + \gamma \max_a Q(s, a)$ |

### Welford 在线方差算法

```
初始化: n = 0, μ = 0, M2 = 0

对每个新值 x:
    n += 1
    delta = x - μ
    μ += delta / n
    delta2 = x - μ
    M2 += delta * delta2

方差 = M2 / n
标准差 = √(方差)
```

**优点**：单遍计算、数值稳定、O(1)空间复杂度

---

## tetris_mcts 项目文件结构

```
tetris_mcts/
├── agents/
│   ├── agent.py            # 基类Agent + TreeAgent（数组管理、节点分配）
│   ├── agent_mcts.py       # 早期MCTS实现（经典UCB1）
│   ├── core.py             # 核心选择/回溯函数（纯Python + Numba JIT）
│   ├── core_distributional.py # 分布式价值分布
│   ├── core_projection.py  # 投影去重核心
│   ├── policy.py           # 策略函数（clt, gauss, max, greedy, random）
│   ├── special.py          # 特殊数学函数（分位数计算）
│   ├── helper.py           # 辅助函数
│   ├── ValueSim.py         # 核心MCTS-TD混合Agent（本Skill主要参考）
│   ├── ValueSim2.py        # ValueSim变体
│   ├── ValueSimLP.py       # ValueSim改进版（LP = Learned Policy）
│   ├── ValueSimBayes.py    # 贝叶斯UCB变体
│   ├── ValueSimC.py        # C++核心变体
│   ├── HybridSim.py        # 混合模拟（有限深度Rollout）
│   ├── FiniteSim.py        # 有限深度模拟
│   ├── DQN.py              # 纯DQN实现（对比基线）
│   ├── Random.py           # 随机Agent（对比基线）
│   ├── FullSim.py          # 全模拟Agent（对比基线）
│   ├── DistValueSimOnline.py # 分布式价值在线学习
│   └── cppmodule/
│       ├── core.cpp        # C++ pybind11绑定
│       ├── core.h          # C++核心实现（select/backup/policy）
│       ├── special.h       # C++分位数计算
│       └── agent.cpp       # C++ Agent绑定
├── model/
│   ├── model.py            # 神经网络模型定义
│   └── model_vv.py         # 价值+方差双输出模型
├── util/
│   ├── gui.py              # GUI显示
│   └── Data.py             # 数据保存
├── play.py                 # 训练入口
└── requirements.txt        # 依赖
```

### 关键文件对应关系

| tetris_mcts 文件 | 功能 | 对应本Skill |
|-----------------|------|------------|
| ValueSim.py | MCTS+TD+NN混合Agent | SKILL.md + 引擎文件 |
| agent.py TreeAgent | 数组管理、节点分配 | 决策树推理内存 |
| core.py select_trace | 选择路径 | engine/mcts-converge.md CLT-UCB排序 |
| core.py backup_trace | 价值回溯 | engine/td-learner.md 价值更新 |
| policy.py | 策略函数 | policies/code-task-policy.md |
| model_vv.py | 价值+方差NN | Claude的内隐知识 |
| core.h (C++) | 高性能select/backup | 推理规则（无数值计算） |

---

## 设计决策记录

### 决策1：为什么用CLT-UCB而非经典UCB1？

**背景**：经典UCB1假设奖励在[0,1]之间。在Claude Code场景中，方案的成功价值是无界的（从-1到+1，甚至更广）。

**选择**：CLT-UCB，使用方差驱动探索。

**理由**：
- 方差反映了方案结果的不确定性
- 高方差方案值得更多探索（获取信息）
- 低方差方案可以按价值排序（利用已知）

### 决策2：为什么用推理规则而非实际代码？

**背景**：Claude Code Skill只能通过文本指令影响Claude的行为。

**选择**：将算法公式转化为推理规则。

**理由**：
- 不需要额外的运行时依赖
- 可读性强，用户可以理解和修改
- 与Claude Code的现有框架完全兼容
- Claude的内隐知识可以替代NN的价值评估

### 决策3：为什么保留状态投影去重？

**背景**：不同代码任务可能有相同的状态特征。

**选择**：使用六维状态特征向量进行去重。

**理由**：
- 减少重复学习
- 加速价值函数收敛
- 与tetris_mcts的projection机制对应

### 决策4：跨会话记忆如何工作？

**背景**：Claude Code的会话是隔离的。

**选择**：使用记忆文件系统持久化。

**理由**：
- 文件持久化在项目目录下
- 每次任务完成后更新价值函数表
- 新会话加载时读取历史数据

---

## 延伸阅读

1. [Reinforcement Learning: An Introduction](https://mitpress.mit.edu/books/reinforcement-learning-second-edition) - Sutton & Barto（强化学习圣经）
2. [A Survey of Monte Carlo Tree Search Methods](https://ieeexplore.ieee.org/document/6145622) - MCTS综述
3. [Mastering the game of Go without human knowledge](https://www.nature.com/articles/nature24270) - AlphaGo Zero论文
4. [hrpan/tetris_mcts](https://github.com/hrpan/tetris_mcts) - 本Skill借鉴的项目
5. [Bandit Algorithm](http://banditalgs.com/) - 赌徒算法参考
6. [The Game of Tetris in Machine Learning](https://arxiv.org/abs/1905.01652) - 俄罗斯方块ML历史