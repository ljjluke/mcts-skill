#!/usr/bin/env node
/**
 * fix-memory.js - 存量知识数据一次性修复
 *
 * 修复三类历史缺陷（v1.18.71 之前存储的坏数据）：
 *   1. anchors 为空 -> 用 deriveAnchors 兜底补齐（空锚点=召不回的死数据）
 *   2. description 是截断的残缺 JSON -> 在自然边界收口修复
 *   3. philosophy 轨连 2 个锚点都生成不了的条目 -> 降级 step_history
 *
 * 用法: node scripts/fix-memory.js [--dry]
 *   --dry 只报告不落盘
 */
const path = require('path');
const os = require('os');
const io = require('./mma/simple-io');
const { deriveAnchors } = require('./mma/simple-store');

const DRY = process.argv.includes('--dry');

function truncateAtBoundary(str, max) {
  if (str.length <= max) return str;
  const cut = str.substring(0, max);
  const last = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('；'), cut.lastIndexOf('，'), cut.lastIndexOf(','), cut.lastIndexOf(' '));
  return last > max * 0.4 ? cut.substring(0, last) : cut;
}

function fixFile(level) {
  const data = io.loadKnowledge(level);
  const report = { file: level, total: data.points.length, anchors_fixed: 0, desc_fixed: 0, downgraded: 0 };

  for (const p of data.points) {
    // 1. 先修残缺 JSON description（必须在补锚点之前，否则锚点从乱码里切）
    if (p.description && p.description.includes('{') && !/\}\s*$/.test(p.description.trim())) {
      // 从残缺 JSON 里抢救 "name":"xxx" 对（引号可选，兼容被截断未闭合的）
      const names = [];
      const re = /"name"\s*:\s*"([^"]{2,40})"?/g;
      let m;
      while ((m = re.exec(p.description)) && names.length < 5) names.push(m[1]);
      if (names.length >= 1) {
        const prefixMatch = p.description.match(/^\[step:[^\]]+\]/);
        const prefix = prefixMatch ? prefixMatch[0] : '';
        p.description = prefix + ' ' + names.join(' / ') + '（原摘要为截断JSON，已修复为条目列表）';
        p._fixed_desc = true;
        report.desc_fixed++;
      } else {
        const fixed = truncateAtBoundary(p.description, 400);
        if (fixed !== p.description) {
          p.description = fixed;
          p._fixed_desc = true;
          report.desc_fixed++;
        }
      }
    }

    // 2. 补锚点（排除修复标记文字，避免"原摘要"类噪音混入锚点）
    if (!p.anchors || p.anchors.length === 0) {
      const descForAnchors = (p.description || '').replace(/（原摘要为截断JSON[^）]*）/g, '');
      const derived = deriveAnchors({ tags: p.tags, summary: p.summary, description: descForAnchors });
      if (derived.length > 0) {
        p.anchors = derived;
        p._fixed_anchors = true;
        report.anchors_fixed++;
      }
    }

    // 3. philosophy 轨锚点不足 2 个 -> 降级标记（报告，不自动搬文件，避免破坏引用）
    if (level === 'philosophy' && (!p.anchors || p.anchors.length < 2)) {
      p._suggest_downgrade = true;
      report.downgraded++;
    }
  }

  if (!DRY) io.saveKnowledge(level, data);
  return report;
}

console.log(DRY ? '=== DRY 模式（只报告不落盘）===' : '=== 修复存量知识数据 ===');
for (const level of ['philosophy', 'knowledge', 'step_history']) {
  const r = fixFile(level);
  console.log(JSON.stringify(r));
}
console.log(DRY ? '（dry 模式，以上未写入）' : '修复完成。philosophy 中 _suggest_downgrade=true 的条目建议人工降级到 step_history。');
