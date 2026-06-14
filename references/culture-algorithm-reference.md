---
name: culture-algorithm-reference
description: 文化概念→算法映射学术参考 — 中国古典文化如何对应MCTS-TD算法组件，每项映射有论文支撑
metadata:
  type: reference
---

# 文化-算法映射学术参考

## 映射总表

| 文化概念 | 算法映射 | Engine文件 | 学术支撑 |
|---------|---------|-----------|---------|
| 八卦阴阳→二进制 | mutation vector 5-bit编码 | mcts-simulate | Leibniz on Binary (2022) |
| 五行生克→正负反馈 | reinforce(生)/drain(克) | mcts-simulate | Wu Xing Math Reasoning (2021) |
| 经络→知识图谱 | MMA 12经脉+穴位=节点 | memory-agent | Meridian GCN (2020) |
| 孙子兵法→OODA→MCTS | 四阶段决策循环 | mcts-simulate | Boyd OODA, Deciphering Sun Tzu (2015) |
| 阴阳辩证→不确定性推理 | TD误差正负方向 | td-learner | QAQI Quantum Intelligence (2014) |
| 藏象→功能模块化 | 12经脉=12知识类别 | memory-agent | Modern Bioinformatics meets TCM (2013) |
| 诸子百家→多视角分析 | 8 facet sub-lenses | mcts-diverge | Simon Bounded Rationality (1956) |
| 奇正相生→探索/利用 | UCB的V(正)+c√(奇) | mcts-simulate | Boyd, Sun Tzu虚实篇 |
| 中庸→折中收敛 | V_final多维度加权 | mcts-converge | Simon Satisficing (1956) |
| 曾子三省→自检 | self-check 5问 | mcts-converge | Simon Bounded Rationality (1956) — 反思性判断 |
| 名家白马→概念辨析 | 言意gap detection | mcts-converge | — |
| 荀子劝学→渐进积累 | TD α学习率递减 | td-learner | TD Learning convergence theory — 增量逼近最优 |
| 体用→真伪多样性 | same-体different-用=MERGE | mcts-diverge | — |
| 理事→跨域/同域知识 | Li(cross-domain) Shi(same-domain) | mcts-diverge | — |
| 本末→硬/软约束 | root dimension=super-hard | mcts-constraint | — |

---

## 论文详情

### 1. Leibniz on Binary
- **年份**: 2022
- **DOI**: https://doi.org/10.7551/mitpress/14123.001.0001
- **核心观点**: 莱布尼茨1703年确认二进制与邵雍六十四卦图的形式对应。阴阳爻=0/1。
- **项目映射**: mutation vector的5-bit [天,地,人,法,物] 0=stable/1=volatile，就是阴阳二值化的应用

### 2. Leibniz to Sloane (unpublished letter)
- **年份**: 1981
- **DOI**: https://doi.org/10.1080/00033798100200141
- **核心观点**: 莱布尼茨收到白晋(F. Bouvet)的六十四卦图后确认二进制与易经的形式对应
- **项目映射**: 同上，补充历史链条：邵雍→白晋→莱布尼茨→现代二进制

### 3. The Yijing and Philosophy: From Leibniz to Derrida
- **年份**: 2011
- **DOI**: https://doi.org/10.1111/j.1540-6253.2011.01661.x
- **核心观点**: 从莱布尼茨到德里达，易经对西方哲学/逻辑学的持续影响
- **项目映射**: 易经不是"古代迷信"，而是持续影响现代逻辑的思维框架

### 4. Mathematical Reasoning of Treatment Principle Based on Yin Yang Wu Xing Theory
- **年份**: 2021
- **DOI**: https://doi.org/10.4236/cm.2021.123007
- **核心观点**: 五行生克制化可用数学推理表达，甲子+八宫可量化
- **项目映射**: reinforce=生(正向增益), drain=克(负向衰减), 五行cycle=有向图正/负边

### 5. Mathematical Reasoning of Philosophical Intervening Principle (Yin Yang Wu Xing)
- **年份**: 2021
- **DOI**: https://doi.org/10.4236/ojpp.2021.114037
- **核心观点**: 基于阴阳五行的哲学干预原则数学推理，证明其逻辑自洽
- **项目映射**: 五行不是"迷信"，是有数学证明的逻辑系统

### 6. Researches on Mathematical Relationship of Five Elements and Fibonacci Sequence Modulo 5
- **年份**: 2015
- **DOI**: https://doi.org/10.1155/2015.189357
- **核心观点**: 五行循环与Fibonacci数列模5存在数学关系，五行生克序列与黄金分割相关
- **项目映射**: 五行不是任意排列，而是有深层数学结构的循环系统

### 7. Predicting Meridians and TCM Using Graph Convolutional Neural Network
- **年份**: 2020
- **DOI**: https://doi.org/10.3390/ijerph17030740
- **核心观点**: 用GCN预测中药-经脉关联，经脉=图网络的节点
- **项目映射**: MMA的12经脉=知识图谱节点，穴位=知识条目，得气=语义检索，与GCN同构

### 8. A Review of Knowledge Graph in Traditional Chinese Medicine
- **年份**: 2024
- **DOI**: https://doi.org/10.32604/cmc.2024.055671
- **核心观点**: 中医知识图谱综述——构建方法、应用场景、未来前景
- **项目映射**: MMA的经脉知识图谱与TCM知识图谱学术方向一致

### 9. Can a Holistic View Facilitate Intelligent TCM?
- **年份**: 2023
- **DOI**: https://doi.org/10.1109/tcss.2023.3252879
- **核心观点**: 中医整体观如何促进智能化——多维度关联而非孤立分析
- **项目映射**: 八卦镜8维度=整体观，不是只看单维度；MMA多经脉关联=整体诊断

### 10. AI empowering Traditional Chinese Medicine?
- **年份**: 2024
- **DOI**: https://doi.org/10.1039/d4sc04107k
- **核心观点**: AI赋能中医的最新进展，含知识表示、推理、诊断
- **项目映射**: 本项目正是"AI+中医思维"的一个实例

### 11. Modern Bioinformatics meets Traditional Chinese Medicine
- **年份**: 2013
- **DOI**: https://doi.org/10.1093/bib/bbt063
- **核心观点**: 生物信息学与中医结合，藏象=功能模块，经脉=通路
- **项目映射**: 12经脉的category映射(肺=tools,心=core decision,脾=structure...)=藏象功能模块化

### 12. Deciphering Sun Tzu: How to Read The Art of War
- **年份**: 2015
- **作者**: Derek M. Yuen
- **核心观点**: 孙子兵法的决策模型解读——OODA循环的东方源头
- **项目映射**: OODA(观-察-谋-行) = MCTS(Selection-Expansion-Simulation-Backprop)

### 13. A New Conception of War: John Boyd & Maneuver Warfare
- **年份**: 2018
- **DOI**: https://doi.org/10.56686/9780997317497
- **核心观点**: Boyd的OODA循环直接受孙子兵法影响，快速决策循环=制胜关键
- **项目映射**: MCTS的per-round iteration=OODA循环，收敛速度=决策速度优势

### 14. Causality Is Logically Definable — Equilibrium-Based Computing Paradigm
- **年份**: 2014
- **DOI**: https://doi.org/10.4236/jqis.2014.44021
- **核心观点**: 基于阴阳平衡的量子智能计算范式——阴阳=互补态，平衡=最优
- **项目映射**: TD误差的正负=阴阳消长，V值收敛=阴阳平衡

### 15. Understanding TCM from a Systems Theory Perspective
- **年份**: 2013
- **核心观点**: 从系统论视角理解中医——五行=反馈回路，经络=信息通道
- **项目映射**: 五行生克=正/负反馈，经络得气=信息检索，藏象=子系统

---

## 跨领域类比思维法（用于发散引擎）

以下方法论来自上述学术研究，指导"跳出框架"的发散思维：

### 兵家类比法（孙子·虚实篇）
**适用**: F1 Source of Force
**问题**: "如果这是战场，谁是敌？谁是友？什么是制高点？什么是虚实？"
**跳出方式**: 把技术决策视为军事战略——看似坚固的(实)可能薄弱，看似薄弱的(虚)可能有机可乘

### 農家类比法（因地制宜）
**适用**: F2 Foundation
**问题**: "这块'地'的土壤是什么？适合种什么？什么季节播种？"
**跳出方式**: 不假设所有项目都是同一块地——不同项目有不同的"土壤"(团队/技术栈/资源)

### 醫家类比法（治未病）
**适用**: F3 Change/Disruption
**问题**: "哪里有'未病'——还没出症状但已有病根？治未病vs治已病哪个更划算？"
**跳出方式**: 不要只看已经出问题的，要找"还没出问题但即将出问题"的地方

### 工匠类比法（庖丁解牛）
**适用**: F4 Penetration
**问题**: "牛的关节在哪里？刀从哪个缝隙切入？如何做到'游刃有余'？"
**跳出方式**: 不要硬推，找自然的缝隙/切入点——阻力最小的路径

### 史家类比法（以史为鉴）
**适用**: F5 Risk/Abyss
**问题**: "历史上类似决策的结果是什么？哪个朝代犯了类似错误？为什么？"
**跳出方式**: 用历史类比代替抽象风险评估——具体案例比概率数字更有洞察力

### 儒家类比法（正名）
**适用**: F6 Visible/Dependent
**问题**: "名实是否一致？表面说的和实际做的是同一件事吗？'正名'意味着什么？"
**跳出方式**: 检查每个术语/概念的真实含义——很多问题源于"名不正"

### 道家类比法（知止不殆）
**适用**: F7 Boundary
**问题**: "哪里是'止'的边界？过了边界会怎样？不做比做更好吗？"
**跳出方式**: 不是所有边界都要突破——有些边界是保护性的，知止=智慧

### 縱橫家类比法（合纵连横）
**适用**: F8 Convergence
**问题**: "谁是合纵对象(联合弱者抗强者)？谁是连横对象(依附强者)？利益能否重新分配？"
**跳出方式**: 利益不是零和——重新分配可能创造win-win
