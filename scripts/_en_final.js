const path = require('path');
const fs = require('fs');

const cwd = process.cwd();

// ===== Replacements: [file, oldStr, newStr] =====
const replacements = [];

// === SKILL.md ===
const skill = 'SKILL.md';
replacements.push([skill, '八面审视镜', 'Eight-Facet Mirror']);
replacements.push([skill, '侦查报告', 'Reconnaissance Report']);
replacements.push([skill, '收敛方案', 'Solutions']);
replacements.push([skill, '决策报告', 'Decision Report']);
replacements.push([skill, '需求补全', 'Demand Refinement']);
replacements.push([skill, '— "你有具体的XX要求吗？"', '— "Any specific requirements?"']);
replacements.push([skill, '史官(Record Keeper)', 'Historian (Record Keeper)']);
replacements.push([skill, '谏官(Remonstrance)', 'Censor (Remonstrance)']);
replacements.push([skill, '阴阳对冲', 'Yin-Yang conflict']);
replacements.push([skill, '谏官进谏', 'Censor alert']);
replacements.push([skill, '注入上下文', 'inject context']);
replacements.push([skill, '情绪时间线', 'emotion timeline']);
replacements.push([skill, '经脉穴位', 'meridian points']);
replacements.push([skill, '矛盾时谏言', 'conflict alert']);
replacements.push([skill, 'TD闭环', 'TD closed loop']);
replacements.push([skill, '记忆巩固', 'consolidation']);
replacements.push([skill, '八面镜发散 → MCTS 推演', 'Eight-Facet diverge -> MCTS simulate']);
replacements.push([skill, 'TD 时序学习 · 模拟人脑记忆 · 多语言自适应', 'TD learning · Human-like memory · Multi-language']);
replacements.push([skill, 'engine/mcts-constraint.md | engine/mcts-diverge.md | engine/mcts-simulate.md | engine/mcts-converge.md | engine/td-learner.md',
  'engine/mcts-constraint.md | engine/mcts-diverge.md | engine/mcts-simulate.md | engine/mcts-converge.md | engine/td-learner.md']);
replacements.push([skill, 'MCTS数学引擎', 'MCTS compute']);
replacements.push([skill, '合规守护', 'Compliance guard']);
replacements.push([skill, 'MMA经络记忆引擎', 'MMA meridian memory']);
replacements.push([skill, '语言守护', 'Language guard']);
replacements.push([skill, '记忆文件管理(legacy)', 'Memory file manager (legacy)']);
replacements.push([skill, 'Node.js 原生', 'Node.js native']);
replacements.push([skill, '零额外依赖', 'Zero extra deps']);

// === hooks/hooks.json ===
const hooks = 'hooks/hooks.json';
replacements.push([hooks, 'MCTS-TD Memory hooks — 自动记忆管理: 加载→读取→写入→巩固',
  'MCTS-TD Memory hooks — auto memory management: load -> read -> write -> consolidate']);
replacements.push([hooks, 'echo \"[MCTS-TD] Memory Agent 已装载 — 史官记录中\"',
  'echo \"[MCTS-TD] Memory Agent loaded\"']);

// === engine/mcts-diverge.md ===
const diverge = 'engine/mcts-diverge.md';
replacements.push([diverge, '根基承载 — Assess Capability & Fill Gaps', 'Foundation — Assess Capability']);
replacements.push([diverge, '变动突破 — Feedback Unknown Territory', 'Change — Feedback Unknown']);
replacements.push([diverge, '渗透传播 — Knowledge Breadth Scan', 'Penetration — Knowledge Breadth']);
replacements.push([diverge, '风险深渊 — Deep Dive Risk', 'Risk — Deep Dive']);
replacements.push([diverge, '显眼依附 — Track External Dependencies', 'Dependencies — Track External']);
replacements.push([diverge, '边界止步 — Hard Constraint Check', 'Boundary — Hard Constraint']);
replacements.push([diverge, '汇聚共赢 — Conflict Balance & Direction Focus', 'Convergence — Balance & Focus']);
replacements.push([diverge, '禁止: Skip', 'FORBIDDEN: Skip']);
replacements.push([diverge, '禁止: Summarize', 'FORBIDDEN: Summarize']);
replacements.push([diverge, '禁止.', 'FORBIDDEN.']);

// === engine/mcts-simulate.md ===
const sim = 'engine/mcts-simulate.md';
replacements.push([sim, '"从不同的文化视角看这个方案，有什么新发现？"',
  '"From different cultural perspectives, what new insights?"']);

// === engine/mcts-constraint.md ===
const con = 'engine/mcts-constraint.md';
replacements.push([con, '在约束收集完成后、八面镜审视开始之前，插入一层"文化视角切换器"。',
  'After constraint collection, before 8-facet mirror, insert a cultural perspective switcher.']);
replacements.push([con, '用中国文化思想体系的12个范式，从不同维度审视问题', 'Use 12 Chinese thought paradigms to examine from diverse dimensions']);
replacements.push([con, '产出盲点清单，供八面镜携带使用', 'Output blindspot list for 8-facet mirror']);
replacements.push([con, '**Matrix does NOT replace nor analyzed by the 8-facet mirror**。视角矩阵是给八面镜的"眼镜"——',
  '**Matrix does NOT replace nor analyzed by the 8-facet mirror** — it provides lenses for it — ']);
replacements.push([con, '让八面镜带着这些视角发现的盲点去审视问题', 'Let mirror examine with perspective-derived blindspots']);
replacements.push([con, '每个视角的输出必须是**probing questions**，not assertions/conclusions：',
  'Each perspective output must be probing questions, not assertions/conclusions:']);
replacements.push([con, '✅ CORRECT: Military perspective asks: "当前态势中谁是奇兵？主客方关系如何？"',
  'CORRECT: Military: "Who is the surprise? Host-guest dynamics?"']);
replacements.push([con, '❌ WRONG: Military perspective asserts: "你应该速胜"',
  'WRONG: Military: "You should win fast"']);
replacements.push([con, '视角', 'Perspective']);
replacements.push([con, '| # | Perspective | Core Question | Origin |', '| # | Perspective | Core Question | Origin |']);

// 12 perspectives table
const perspectives = [
  ['兵家', 'Military'],
  ['医家', 'Medical'],
  ['农家', 'Agricultural'],
  ['工匠', 'Artisan'],
  ['纵横家', 'Strategist'],
  ['道家', 'Daoist'],
  ['法家', 'Legalist'],
  ['儒家', 'Confucian'],
  ['史家', 'Historical'],
  ['阴阳家', 'Yin-Yang'],
  ['禅家', 'Zen'],
  ['水利家', 'Hydraulic'],
];
for (const [cn, en] of perspectives) {
  replacements.push([con, `**${cn}**`, `**${en}**`]);
}

// === SKILL.md Engine File Index ===
replacements.push([skill, '7引擎守卫: 反唯一方案/阶段强制/信息获取优先级/方案多样性/自检/Memory Agent/合规审计',
  '7 guards: anti-single/phase-enforce/info-priority/diversity/self-check/memory-agent/compliance']);
replacements.push([skill, '9引擎合规守护', '9 Compliance Guards']);
replacements.push([skill, '统一CLI入口', 'Unified CLI']);
replacements.push([skill, 'MMS经络记忆', 'MMA Meridian Memory']);
replacements.push([skill, '得气/子午流注/循经感传/补泻/阿是穴', 'Deqi/Ziwu/Propagation/Reinforce/Ashi']);

// === CHANGELOG.md === (keep culture, translate descriptions)
const changelog = 'CHANGELOG.md';
replacements.push([changelog, '记忆引擎仿脑化 (Brain-Inspired Memory)', 'Brain-Inspired Memory Engine']);
replacements.push([changelog, '情景记忆 vs 语义记忆', 'Episodic vs Semantic Memory']);
replacements.push([changelog, '记忆再巩固 (Reconsolidation)', 'Memory Reconsolidation']);
replacements.push([changelog, '7级来源可靠性(亲历1.0→传闻0.2)。', '7-level source reliability (firsthand 1.0 -> hearsay 0.2).']);
replacements.push([changelog, '源监控 (Source Monitoring)', 'Source Monitoring']);
replacements.push([changelog, '精细加工深度', 'Elaboration Depth']);
replacements.push([changelog, '4级评估(浅/中/深/最深)→影响初始巩固分(+0~+6)。', '4 levels (shallow/medium/deep/deepest) -> consolidation +0~+6.']);
replacements.push([changelog, '9引擎合规守卫: 反唯一方案/阶段强制/信息获取优先级/方案多样性/自检/MemoryAgent/合规审计/约束检查/引擎模式',
  '9 Compliance Guards: anti-single/phase-enforce/info-priority/diversity/self-check/memory-agent/compliance/constraint/engine-mode']);
replacements.push([changelog, '统一CLI入口，一命令管理5子引擎(compute/guard/mma/lang/memory)',
  'Unified CLI, one command for 5 engines (compute/guard/mma/lang/memory)']);
replacements.push([changelog, '八纲辨证知识诊断: 表里寒热虚实→脉象(浮沉数迟缓滑涩平)→权重调整',
  'Eight-Principle Diagnosis: Biao-Li-Han-Re-Xu-Shi -> Pulse -> Weight adjust']);
replacements.push([changelog, '源代码全部英文化', 'Source code fully English-ified']);

// Apply all
let count = 0;
for (const [f, o, n] of replacements) {
  const fp = path.join(cwd, f);
  if (!fs.existsSync(fp)) continue;
  let content = fs.readFileSync(fp, 'utf-8');
  if (content.includes(o)) {
    content = content.replace(o, n);
    fs.writeFileSync(fp, content);
    count++;
  }
}
console.log(`Applied ${count} replacements`);
