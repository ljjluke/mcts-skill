/** ═══════════════════════════════════════════════════════════════
 *  得气 (Deqi) — 知识召回 + 经气预热 + 三焦工作记忆 + 循经感传
 *  "刺之要，气至而有效" —《灵枢·九针十二原》
 * ═══════════════════════════════════════════════════════════════ */
const { SHU_LEVELS, SPECIAL_POINT_TYPES } = require('./constants');
const { ziwuLiuzhu } = require('./ziwu');
const { loadWorkingMemory, saveWorkingMemory } = require('./io');

const UPPER_BURNER_LIMIT = 7; // 上焦容量 = 认知负荷7±2

/**
 * 得气 — 不是"搜索"，而是让上下文"共振"出最相关的记忆。
 * 召回流程: 三焦工作记忆 → 子午流注经脉 → 得气计分 → 循经感传扩散
 */
function deqi(kg, query, context = {}) {
    const wm = loadWorkingMemory();
    const results = [];

    // ── 第0层: 三焦气化工作记忆 ──
    const upperHits = searchUpperBurner(wm, query);
    if (upperHits.length > 0) results.push(...upperHits);

    // ── 第1层: 子午流注 → 活跃经脉 ──
    const activeMeridians = ziwuLiuzhu(kg, context);

    // ── 经气预热: 上次召回的经脉权重+0.15 ──
    const primedMeridian = getPrimedMeridian(wm);

    // ── 第2层: 沿经脉遍历穴位 ──
    for (const mKey of activeMeridians) {
        const meridian = kg.meridians[mKey] || kg.extra[mKey];
        if (!meridian) continue;
        const primingBonus = (mKey === primedMeridian) ? 0.15 : 0;

        for (let i = 0; i < meridian.points.length; i++) {
            const point = meridian.points[i];
            if (point.hidden) continue; // 隐穴不出现在常规召回
            const score = computeDeqiScore(point, query, meridian, i) + primingBonus;
            if (score > 0.1) {
                results.push({
                    point, meridian: mKey, meridian_name: meridian.name,
                    position: i, deqi_score: Math.min(score, 1.0),
                    source: mKey === primedMeridian ? 'primed' : 'ziwu',
                });
            }
        }
    }

    // ── 第3层: 循经感传扩散 ──
    propagateSensation(results, kg, 0.3);

    // ── 排序 ──
    results.sort((a, b) => b.deqi_score - a.deqi_score);
    const top = results.slice(0, query.limit || 10);

    // ── 更新三焦工作记忆 ──
    updateWorkingMemory(wm, top);
    saveWorkingMemory(wm);

    return top;
}

/** 上焦检查 — 最近用过的知识直接浮现 */
function searchUpperBurner(wm, query) {
    const hits = [];
    for (const entry of wm.upper) {
        let score = 0;
        if (query.tags && entry.point.tags)
            score = entry.point.tags.filter(t => query.tags.includes(t)).length / Math.max(query.tags.length, 1) * 0.6;
        if (query.category && entry.point.category === query.category) score += 0.3;
        if (score > 0.3) hits.push({ ...entry, deqi_score: Math.min(score + 0.2, 1.0), source: 'upper_burner' });
    }
    return hits;
}

/** 经气预热 — 上次召回的经脉如果还在5分钟内 */
function getPrimedMeridian(wm) {
    if (!wm.last_meridian || !wm.last_meridian_ts) return null;
    const elapsed = (Date.now() - wm.last_meridian_ts) / 1000;
    if (elapsed > 300) return null; // 5分钟半衰
    return wm.last_meridian;
}

/** 更新三焦: 新召回→上焦, 上焦溢出→中焦 */
function updateWorkingMemory(wm, topResults) {
    const now = new Date().toISOString();
    // 上焦: 本回合召回结果
    for (const r of topResults.slice(0, UPPER_BURNER_LIMIT)) {
        const entry = { point_id: r.point.id, point: r.point, meridian: r.meridian, recalled_at: now };
        const idx = wm.upper.findIndex(e => e.point_id === r.point.id);
        if (idx >= 0) wm.upper.splice(idx, 1);
        wm.upper.unshift(entry);
    }
    // 上焦溢出→中焦 (旧条目)
    while (wm.upper.length > UPPER_BURNER_LIMIT) {
        const overflow = wm.upper.pop();
        const midIdx = wm.middle.findIndex(e => e.point_id === overflow.point_id);
        if (midIdx >= 0) wm.middle.splice(midIdx, 1);
        wm.middle.unshift(overflow);
    }
    // 下焦清理: 超过24小时 → 移出
    wm.lower = wm.lower.filter(e => (Date.now() - new Date(e.recalled_at)) / 3600000 < 24);
    // 记录最后活跃经脉
    if (topResults.length > 0) {
        wm.last_meridian = topResults[0].meridian;
        wm.last_meridian_ts = Date.now();
    }
}

function computeDeqiScore(point, query, meridian, position) {
    let score = 0;
    if (query.category && meridian.category === query.category) score += 0.4;
    if (query.tags && query.tags.length > 0 && point.tags)
        score += (point.tags.filter(t => query.tags.includes(t)).length / Math.max(query.tags.length, 1)) * 0.3;
    if (query.context_words && query.context_words.length > 0 && point.description) {
        const pt = [point.id, point.description, point.emotion||'', (point.tags||[]).join(' '), (point.keywords||[]).join(' ')].join(' ').toLowerCase();
        const m = query.context_words.filter(w => pt.includes(w.toLowerCase())).length;
        score += (m / query.context_words.length) * 0.2;
    }
    if (point.shu_level && SHU_LEVELS[point.shu_level]) score += SHU_LEVELS[point.shu_level].weight * 0.05;
    if (point.special_type && SPECIAL_POINT_TYPES[point.special_type]) score += (SPECIAL_POINT_TYPES[point.special_type].boost - 1) * 0.1;
    score += (point.q || 0.5) * 0.05;
    score += Math.min((point.consolidation_score || 0) / 100, 0.05);
    return score;
}

/** 循经感传 — 高分穴位沿经脉前后扩散 + 表里经传导 */
function propagateSensation(results, kg, threshold = 0.3) {
    const existingIds = new Set(results.map(r => r.point.id));
    const toAdd = [];
    for (const r of results) {
        if (r.deqi_score < threshold) continue;
        const meridian = kg.meridians[r.meridian] || kg.extra[r.meridian];
        if (!meridian) continue;
        // 前后各2穴位扩散
        for (let d = -2; d <= 2; d++) {
            if (d === 0) continue;
            const pos = r.position + d;
            if (pos >= 0 && pos < meridian.points.length) {
                const np = meridian.points[pos];
                if (!existingIds.has(np.id) && !np.hidden) {
                    const s = r.deqi_score * (1 - Math.abs(d) * 0.25);
                    if (s > 0.1) { toAdd.push({ point: np, meridian: r.meridian, meridian_name: r.meridian_name, position: pos, deqi_score: s, propagated_from: r.point.id, source: 'propagation' }); existingIds.add(np.id); }
                }
            }
        }
        // 表里经传导
        if (kg.meridians[r.meridian] && kg.meridians[r.meridian].paired) {
            const paired = kg.meridians[kg.meridians[r.meridian].paired];
            if (paired && r.position < paired.points.length && paired.points[r.position] && !paired.points[r.position].hidden) {
                const pp = paired.points[r.position];
                if (!existingIds.has(pp.id)) { toAdd.push({ point: pp, meridian: kg.meridians[r.meridian].paired, meridian_name: paired.name, position: r.position, deqi_score: r.deqi_score * 0.5, propagated_from: r.point.id, source: 'paired' }); existingIds.add(pp.id); }
            }
        }
    }
    results.push(...toAdd);
}

module.exports = { deqi, computeDeqiScore, propagateSensation, updateWorkingMemory };