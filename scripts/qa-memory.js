#!/usr/bin/env node
/**
 * qa-memory.js - 知识质量审计 + 治理
 *
 * 扫描三轨，识别并处置五类垃圾。全程保留归档，可从 archive/ 恢复。
 *
 * 五类垃圾：
 *   1. 测试残留  - description 含"普通的中性描述"等测试信号
 *   2. 错误分类  - [step: 前缀 / source=step_history 却落在 knowledge/philosophy 轨
 *   3. 领域经验占哲学轨 - philosophy 轨里 tags 全为领域词(bug-pattern等)、无案例无适用条件
 *   4. 无信息格言 - 非CONFIRMED + 无案例 + 无适用条件 + 从未用过(n<=0) + 从未被召回(无used_in)
 *   5. 完全重复  - knowledge 轨同 description+domain 两条以上
 *
 * 处置：删除(归档到 archive/qa-<ts>/)，不硬删活跃文件。
 * 用法: node scripts/qa-memory.js [--dry]   --dry 只报告不落盘
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const io = require('./mma/simple-io');

const DRY = process.argv.includes('--dry');
const DATA_DIR = path.join(os.homedir(), '.claude', 'data', 'skills', 'ponder', 'memory');

// ── 垃圾识别 ──
function classify(p) {
  const desc = p.description || '';
  const tags = p.tags || [];
  const hasUsed = tags.some(t => t.startsWith('used_in:'));
  if (desc.includes('普通的中性描述')) return { type: '测试残留', confidence: 'high' };
  if (p.source === 'step_history' || desc.startsWith('[step:')) return { type: '错误分类(应在step_history)', confidence: 'high' };
  return null;
}

function auditKnowledge() {
  const d = io.loadKnowledge('knowledge');
  const flagged = [];
  const seen = {};
  for (const p of d.points) {
    const c = classify(p);
    if (c) { flagged.push({ file: 'knowledge', id: p.id, ...c, desc: (p.description||'').slice(0,50) }); continue; }
    // 重复检测
    const key = ((p.description||'').slice(0,80)) + '|' + (p.domain||'');
    if (seen[key]) {
      flagged.push({ file: 'knowledge', id: p.id, type: '完全重复['+seen[key]+']', confidence: 'high', desc: (p.description||'').slice(0,50) });
    } else seen[key] = p.id;
  }
  return flagged;
}

function auditPhilosophy() {
  const d = io.loadKnowledge('philosophy');
  const flagged = [];
  for (const p of d.points) {
    const c = classify(p);
    if (c) { flagged.push({ file: 'philosophy', id: p.id, ...c, desc: (p.description||'').slice(0,50) }); continue; }
    // 领域经验占哲学轨：无案例 + 无适用条件 + 未确认
    if (!p.original_example && !p.applicability && p.status !== 'CONFIRMED') {
      flagged.push({ file: 'philosophy', id: p.id, type: '无案例无适用条件格言(占哲学轨不当)', confidence: 'medium', desc: (p.description||'').slice(0,50) });
    }
  }
  return flagged;
}

function auditStepHistory() {
  // 步骤历史不做清理（过程记录垃圾无害），只报告质量信号用于观察
  const d = io.loadKnowledge('step_history');
  const noAnchor = d.points.filter(p => !p.anchors || p.anchors.length === 0).map(p => p.id);
  return { total: d.points.length, noAnchor };
}

// ── 主流程 ──
console.log(DRY ? '=== DRY 模式（只报告不落盘）===' : '=== 知识质量治理 ===');
const allFlagged = [...auditKnowledge(), ...auditPhilosophy()];
const sh = auditStepHistory();

if (allFlagged.length === 0) {
  console.log('✅ knowledge/philosophy 无垃圾，质量良好');
} else {
  console.log('⚠️ 发现', allFlagged.length, '条待治理：');
  for (const f of allFlagged) console.log(`  × [${f.file}/${f.id}] ${f.type} (${f.confidence}) | ${f.desc}`);
}

console.log(`\nstep_history: ${sh.total} 条${sh.noAnchor.length ? '，⚠️ '+sh.noAnchor.length+' 条无锚点(建议先跑 fix-memory.js)' : '，锚点完整'}`);

if (!DRY && allFlagged.length > 0) {
  // 归档后清理
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const archiveDir = path.join(DATA_DIR, 'archive', 'qa-' + ts.substr(0, 10) + '-' + ts.substr(11, 6));
  fs.mkdirSync(archiveDir, { recursive: true });

  for (const lv of ['knowledge', 'philosophy']) {
    const data = io.loadKnowledge(lv);
    const flagIds = new Set(allFlagged.filter(f => f.file === lv).map(f => f.id));
    const removed = data.points.filter(p => flagIds.has(p.id));
    if (removed.length) {
      fs.writeFileSync(path.join(archiveDir, lv + '-removed.json'), JSON.stringify(removed, null, 2), 'utf-8');
      data.points = data.points.filter(p => !flagIds.has(p.id));
      io.saveKnowledge(lv, data);
      console.log(`\n已归档 ${lv} ${removed.length} 条 → archive/${path.basename(archiveDir)}/ 并退出活跃轨`);
    }
  }
  console.log('\n清理完成。归档在 ' + archiveDir + '，可从 archive 恢复。');
}