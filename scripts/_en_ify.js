#!/usr/bin/env node
const fs = require('fs');

const replaces = {};

// === mcts-constraint.md ===
replaces['engine/mcts-constraint.md'] = [
  ['文化视角矩阵增强', 'Cultural Perspective Matrix'],
  ['文化视角矩阵', 'Cultural Perspective Matrix'],
  ['百家视角矩阵增强', '100-Schools Perspective Matrix'],
  ['百家视角矩阵', '100-Schools Perspective Matrix'],
  ['百家视角', '100-Schools Perspective'],
  ['需求补全', 'Demand Refinement'],
  ['核心定位', 'Core Position'],
  ['视角输出规则', 'Perspective Output Rules'],
  ['追问/问题', 'probing questions'],
  ['不是断言/结论', 'not assertions/conclusions'],
  ['✅ 正确：', '✅ CORRECT: '],
  ['❌ 错误：', '❌ WRONG: '],
  ['十二文化思想范式', '12 Cultural Thought Paradigms'],
  ['每个范式对应一种"看问题的方式"：', 'Each paradigm = a way of seeing problems:'],
  ['核心追问', 'Core Question'],
  ['思想源流', 'Origin'],
  ['五行视角选择器', '5-Element Perspective Selector'],
  ['不是随机选择', 'Not random selection'],
  ['通过五行生克关系，确保每次视角组合具有结构性', 'Through 5-element relations, ensures structural diversity'],
  ['问题五行归类', 'Problem 5-element classification'],
  ['生我者 → 看"上游/资源从哪来"', 'Generating me -> upstream/resources'],
  ['我生者 → 看"产出/影响去到哪"', 'I generate -> output/impact destination'],
  ['克我者 → 看"制约/风险在哪"', 'Controlling me -> constraints/risks'],
  ['我克者 → 看"我能控制什么"', 'I control -> what I can control'],
  ['同我者 → 看"同类怎么做"', 'Same element -> how peers do it'],
  ['每个维度匹配1-2个具体文化视角', 'Each dimension matches 1-2 specific perspectives'],
  ['视角矩阵输出格式', 'Perspective Matrix Output Format'],
  ['所有视角同时输出，不分先后、不分页，用户一眼扫过', 'All perspectives output simultaneously in a matrix'],
  ['视角矩阵与八面镜的配合', 'Integration with Eight-Facet Mirror'],
  ['关键：八面镜不分析每个视角。八面镜分析的是问题本身', 'KEY: 8-Facet Mirror analyzes the problem, not the perspectives'],
  ['视角知识获取规则（防死循环）', 'Perspective Knowledge Rules (anti-deadlock)'],
  ['防重复：写回前检查memory是否已有相同key', 'Anti-duplicate: check memory for same key before writing back'],
  ['● 视角发现→盲点清单', 'Perspective findings -> Blindspot list'],
  ['都不涉及自身知识库，', 'none involve direct knowledge base queries,'],
];

// === mcts-diverge.md ===
replaces['engine/mcts-diverge.md'] = [
  ['外察', 'External Scan'],
  ['不是问自己，是去外面找答案', 'Not self-questioning -- search externally'],
  ['行业方案 + 非常规思路 + 跨领域类比', 'Industry + Unconventional + Cross-domain'],
  ['禁止: 不搜索、只靠内隐知识', 'FORBIDDEN: Skip search, internal only'],
  ['评估能力 & 补全缺失', 'Assess Capability & Fill Gaps'],
  ['评估自己/knowledge graph 对要解决的事的能力', 'Assess self/KG capability for this task'],
  ['缺什么 → 搜索填补 (不是自己猜)', 'Find gaps -> search to fill (not guess)'],
  ['如果评分 ≤3 → 必须 WebSearch + 追问用户', 'If score <=3 -> MUST WebSearch + ask user'],
  ['能力匹配度 + 需要补充的领域', 'Capability match + areas to supplement'],
  ['回馈用户未知领域', 'Feedback Unknown Territory'],
  ['新东西从不安中来', 'New things emerge from disruption'],
  ['把 F1 搜索到的"外界新发现"呈现给用户', 'Present F1 external findings to user'],
  ['告诉用户 "我发现了一些你可能没注意到的方向..."', 'Tell user: I found directions you may not have noticed...'],
  ['问用户 "你想先走哪条路？"', 'Ask user: Which direction should I explore first?'],
  ['跳过这一步直接进后续分析', 'Skip to subsequent analysis'],
  ['只总结不提问题', 'Summarize without asking questions'],
  ['知识广度扫描', 'Knowledge Breadth Scan'],
  ['风无孔不入', 'Wind penetrates every gap'],
  ['查询记忆(MMA 得气召回) + 搜索', 'Query memory (MMA deqi) + search'],
  ['搜索每个潜在方案的"已知陷阱"和"最佳实践"', 'Search each candidate for known pitfalls + best practices'],
  ['知识广度图 + 各方案的已知风险', 'Knowledge breadth map + risks per candidate'],
  ['深入探底', 'Deep Dive Risk'],
  ['水知道所有低洼处', 'Water knows every low point'],
  ['搜索已知的坑和失败案例', 'Search known pitfalls and failure cases'],
  ['每个候选方案的最坏情况是什么？', 'Worst case for each candidate?'],
  ['如果没找到任何风险点 → 搜索还不够深', 'No risks found? Search not deep enough'],
  ['风险清单 + 规避方案', 'Risk list + mitigation plans'],
  ['追踪外部依赖', 'Track External Dependencies'],
  ['搜索每个方案的依赖技术/平台的现状', 'Search each candidate dependency tech/platform status'],
  ['这些外部依赖有无版本变更、停止维护、重大 bug？', 'Check for deprecation, EOL, major bugs?'],
  ['如果依赖信息不明确 → 搜索确认', 'If dependency unclear -> search to confirm'],
  ['外部依赖健康度检查报告', 'Dependency health check report'],
  ['硬约束检核', 'Hard Constraint Check'],
  ['知道什么时候该停', 'Know when to stop'],
  ['逐项检查 constraint-checklist', 'Check each item in constraint-checklist'],
  ['硬约束违反 → 直接淘汰', 'Hard violated -> eliminate'],
  ['软约束不满足 → 标记降级', 'Soft not met -> downgrade'],
  ['约束满足矩阵', 'Constraint satisfaction matrix'],
  ['矛盾平衡 & 方向聚焦', 'Conflict Balance & Direction Focus'],
  ['两泽相连才能流通', 'Two lakes connected to flow'],
  ['综合 F1~F7 的所有发现，整理出矛盾点', 'Synthesize F1-F7 findings, list conflicts'],
  ['用户要的 vs 用户可能不知道但有益的', 'User wants vs user may not know but beneficial'],
  ['需要用户决策的方向 → 清晰呈现', 'Decisions needing user -> present clearly'],
  ['矛盾点清单 + 等待用户确认的决策点', 'Conflict list + pending user decisions'],
  ['产出: 行业方案 + 非常规思路 + 跨领域类比', 'Output: Industry + Unconventional + Cross-domain'],
];

// === mcts-simulate.md ===
replaces['engine/mcts-simulate.md'] = [
  ['多层可推敲推理', 'Multi-Layer Scrutable Reasoning'],
  ['可行性推敲 (Feasibility)', 'Feasibility'],
  ['"考虑当前已知条件，这个方案走得通吗"', 'Given current conditions, is this viable?'],
  ['使用八面镜Scorecard中F1/F2/F6/F7的评估结果作为先验', 'Use 8-facet Scorecard F1/F2/F6/F7 as prior'],
  ['模拟标准路径（golden path）', 'Simulate golden path'],
];

// === mcts-converge.md ===
replaces['engine/mcts-converge.md'] = [
  ['百家视角发现', '100-Schools Perspective findings'],
  ['提取Step 0.5视角矩阵产出的所有盲点', 'Extract all blindspots from Step 0.5'],
  ['逐一检查每个盲点在当前方案排名中是否被覆盖', 'Check each blindspot against ranked solutions'],
  ['被覆盖 ✅', 'Covered ✅'],
  ['未被覆盖 ❌', 'Not covered ❌'],
  ['盲点遗漏', 'Blindspot missed'],
];

// Apply all replaces
let total = 0;
for (const [file, pairs] of Object.entries(replaces)) {
  let content = fs.readFileSync(file, 'utf-8');
  for (const [oldStr, newStr] of pairs) {
    const before = content;
    content = content.split(oldStr).join(newStr);
    const count = (before.length - content.length) / oldStr.length;
    if (count > 0) total += count;
  }
  fs.writeFileSync(file, content, 'utf-8');
  console.log(`${file} done`);
}
console.log(`Total replacements: ${total}`);
