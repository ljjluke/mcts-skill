#!/usr/bin/env node
/**
 * e2e 测试 — 三文件架构 + Summary-First Two-Tier
 *
 * 用法: node tests/test-domain-e2e.js
 * 退出码: 0=全通过, 1=有失败
 *
 * 覆盖:
 *  1. philosophy 正常存储（含 summary + anchors）
 *  2. domain_expert 正常存储（含 summary + anchors）
 *  3. step_history 存储隔离
 *  4. rejected 拒绝
 *  5. 锚点词粗筛去重候选
 *  6. reinforceExisting 强化已有知识
 *  7. 领域感知召回（锚点词匹配）
 *  8. recallByTags 跳过 step_history
 *  9. getFullContent 取原文
 */
const os = require('os');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponder-summary-test-'));
process.env.PONDER_DATA_DIR = tmp;

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.error(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
}

const io = require(path.join(ROOT, 'scripts/mma/simple-io'));
const store = require(path.join(ROOT, 'scripts/mma/simple-store'));
const recall = require(path.join(ROOT, 'scripts/mma/simple-recall'));
const { getKnowledgeLevel, needsAbstraction } = require(path.join(ROOT, 'scripts/mma/domain-detector'));

// ═══ 1. 分类器（格式马桶） ═══
console.log('\n--- 1. 格式马桶 ---');
check('分类: 哲学', getKnowledgeLevel('目标函数冲突是系统性失败的常见根因') === 'philosophy');
check('分类: 格式信号→rejected', getKnowledgeLevel('510300沪深300ETF成交量突破均线') === 'rejected');
check('分类: 叙事→rejected', getKnowledgeLevel('我们先尝试了用缓存优化') === 'rejected');
check('分类: 无负面信号→philosophy', getKnowledgeLevel('止损策略在震荡市中胜率约40%') === 'philosophy');

// ═══ 2. 存储 philosophy（含 summary + anchors） ═══
console.log('\n--- 2. 存储 philosophy ---');
const r1 = store.store({
  description: '目标函数冲突是系统性失败的常见根因',
  summary: '当多个目标之间存在不可调和的冲突时，系统会因无法同时满足所有目标而失败',
  anchors: ['多目标冲突', '不可通约性', '系统性失败', '根因分析', '帕累托最优'],
  tags: ['决策', '原则'],
});
check('存储哲学: 正常', r1 && r1.status === 'HYPOTHESIS');
const d1 = io.loadKnowledge('philosophy');
const p1 = d1.points.find(p => p.id === r1.id);
check('存储哲学: knowledge_level=philosophy', p1 && p1.knowledge_level === 'philosophy');
check('存储哲学: summary 已存', p1 && p1.summary && p1.summary.length > 0);
check('存储哲学: anchors 已存', p1 && p1.anchors && p1.anchors.length >= 3);

// ═══ 3. 存储 domain_expert（含 summary + anchors） ═══
console.log('\n--- 3. 存储 domain_expert ---');
const r2 = store.store({
  description: '止损在-3%范围内震荡市胜率约40%趋势市约60%',
  summary: '止损策略的有效性与市场环境高度相关，震荡市表现差于趋势市',
  anchors: ['止损阈值', '胜率', '震荡市', '趋势市', '市场环境'],
  tags: ['策略', '概率'],
  knowledge_level: 'domain_expert',
  domain: 'A',
});
check('存储领域: 正常', r2 && r2.status === 'HYPOTHESIS');
const d2 = io.loadKnowledge('knowledge');
const p2 = d2.points.find(p => p.id === r2.id);
check('存储领域: knowledge_level=domain_expert', p2 && p2.knowledge_level === 'domain_expert');
check('存储领域: domain 透传', p2 && p2.domain === 'A');
check('存储领域: summary 已存', p2 && p2.summary && p2.summary.length > 0);
check('存储领域: anchors 已存', p2 && p2.anchors && p2.anchors.length >= 3);

// ═══ 4. 存储 step_history ═══
console.log('\n--- 4. 存储 step_history ---');
const r3 = store.store({
  description: '[step:bagua] 核心管线健康',
  tags: ['step_history', 'step_bagua'],
  knowledge_level: 'step_history',
});
check('存储步骤: 正常', r3 && r3.status === 'HYPOTHESIS');
const d3 = io.loadKnowledge('step_history');
const p3 = d3.points.find(p => p.id === r3.id);
check('存储步骤: knowledge_level=step_history', p3 && p3.knowledge_level === 'step_history');

// ═══ 5. 存储 rejected ═══
console.log('\n--- 5. 存储 rejected ---');
const r4 = store.store({
  description: '今天天气不错适合出去走走',
  tags: ['其他'],
});
check('存储拒绝: SKIPPED_NO_SIGNAL', r4 && r4.status === 'SKIPPED_NO_SIGNAL');

// ═══ 6. 锚点词粗筛去重候选 ═══
console.log('\n--- 6. 锚点词粗筛 ---');
const dataPhilosophy = io.loadKnowledge('philosophy');
const candidates = store.getDedupCandidates(
  dataPhilosophy,
  ['多目标冲突', '不可通约', '系统性', '根本原因'],
  'philosophy',
  null,
  10
);
check('锚点粗筛: 找到候选', candidates.length >= 1);
check('锚点粗筛: 候选含 PH0001', candidates.some(c => c.id === r1.id));

// 不匹配的锚点词 → 无候选
const noMatch = store.getDedupCandidates(
  dataPhilosophy,
  ['完全不相关的词', '另一个概念'],
  'philosophy',
  null,
  10
);
check('锚点粗筛: 无匹配→空', noMatch.length === 0);

// ═══ 7. reinforceExisting 强化已有 ═══
console.log('\n--- 7. reinforceExisting ---');
const oldQ = p1.q;
const oldN = p1.n;
store.reinforceExisting(dataPhilosophy, r1.id, ['博弈', '新标签']);
io.saveKnowledge('philosophy', dataPhilosophy);
const d7 = io.loadKnowledge('philosophy');
const p7 = d7.points.find(p => p.id === r1.id);
check('强化: q 增加', p7 && p7.q > oldQ);
check('强化: n 增加', p7 && p7.n > oldN);
check('强化: 新标签合并', p7 && p7.tags.includes('新标签'));

// ═══ 8. 召回不包含 step_history ═══
console.log('\n--- 8. 召回隔离 ---');
const resAll = recall.recallByTags(['决策', '策略', 'step_bagua'], {
  limit: 20,
  anchors: ['多目标冲突', '止损'],
});
const hasStep = resAll.some(c => c._knowledge_level === 'step_history');
check('recallByTags: step_history 不参与', !hasStep);
check('recallByTags: 有结果', resAll.length >= 1);

// ═══ 9. 召回返回 summary ═══
console.log('\n--- 9. 召回返回 summary ---');
const resWithSummary = recall.recallByTags(['策略'], {
  limit: 5,
  anchors: ['止损阈值', '胜率'],
});
check('召回: 返回 summary', resWithSummary.length > 0 && resWithSummary[0].summary.length > 0);
check('召回: 返回 anchors', resWithSummary.length > 0 && Array.isArray(resWithSummary[0].anchors));

// ═══ 10. getFullContent 取原文 ═══
console.log('\n--- 10. getFullContent ---');
const full = recall.getFullContent(r1.id);
check('getFullContent: 取到原文', full && full.content && full.content.length > 0);
check('getFullContent: 含 summary', full && full.summary && full.summary.length > 0);
check('getFullContent: 含 anchors', full && Array.isArray(full.anchors) && full.anchors.length > 0);

// ═══ 11. step_history 召回正常 ═══
console.log('\n--- 11. step_history 召回 ---');
const resStep = recall.recallStepHistory('bagua', '', { limit: 10 });
const hasStepInStep = resStep.some(c => c._knowledge_level === 'step_history');
check('recallStepHistory: 含 step_history', hasStepInStep);

// ═══ 12. 领域分轨召回 ═══
console.log('\n--- 12. 领域分轨 ---');
const resSame = recall.recallByTags(['策略'], {
  limit: 10,
  domain: 'A',
  anchors: ['止损', '胜率'],
});
check('召回(领域A查询): 有结果', resSame.length > 0);
const domainNormal = resSame.some(c => c._knowledge_level === 'domain_expert' && c._domain === 'A' && !c._domain_downgraded);
check('召回(领域A查询): 领域A专业不被降权', domainNormal);

const resCross = recall.recallByTags(['策略'], {
  limit: 10,
  domain: 'B',
  anchors: ['止损', '胜率'],
});
const domainDown = resCross.some(c => c._knowledge_level === 'domain_expert' && c._domain === 'A' && c._domain_downgraded);
check('召回(领域B查询): 领域A专业被降权', domainDown);

// 全量哲学召回
console.log('\n--- 13. 全量哲学召回 ---');
const resPhil = recall.recallAllPhilosophy();
check('recallAllPhilosophy: 有结果', resPhil.length >= 1);
check('recallAllPhilosophy: 含哲学条目', resPhil.some(c => c.id === r1.id));

// 清理
fs.rmSync(tmp, { recursive: true, force: true });

console.log(fail === 0 ? `\n✅ e2e 全部通过 (${pass}/${pass+fail})` : `\n❌ e2e 失败 (${fail})`);
process.exit(fail === 0 ? 0 : 1);
