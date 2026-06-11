/** ═══════════════════════════════════════════════════════════════
 *  阿是穴 (Ashi) — 新知识插入 + 情绪调制器 + 阴阳对冲检测
 *  "以痛为腧" —《灵枢·经筋》
 * ═══════════════════════════════════════════════════════════════ */
const { EMOTION_CONSOLIDATION, SHU_LEVELS } = require('./constants');

/**
 * 阿是穴插入 — 新知识归经→选穴→创建→建立表里连接
 * 情绪调制: 七情强度决定初始巩固分
 * 阴阳对冲: 检测同经脉内tags重叠>50%+结论矛盾→DISPUTED
 */
function ashiInsert(kg, entry) {
    // Step 1: 归经 — 找最匹配的经脉
    let bestMeridian = null, bestScore = 0;
    for (const [key, m] of Object.entries(kg.meridians)) {
        let score = 0;
        if (entry.category && m.category.includes(entry.category)) score += 0.5;
        if (entry.five_element && m.element === entry.five_element) score += 0.3;
        if (entry.tags && m.desc)
            score += entry.tags.filter(t => m.desc.toLowerCase().includes(t.toLowerCase())).length * 0.1;
        if (score > bestScore) { bestScore = score; bestMeridian = key; }
    }
    if (!bestMeridian || bestScore < 0.2) {
        if (entry.emotion === 'kong' || entry.tags?.includes('security')) bestMeridian = 'ren';
        else if (entry.emotion === 'xi' || entry.tags?.includes('breakthrough')) bestMeridian = 'du';
        else if (entry.tags?.includes('urgent') || entry.tags?.includes('critical')) bestMeridian = 'chong';
        else bestMeridian = 'dai';
    }

    const meridian = kg.meridians[bestMeridian] || kg.extra[bestMeridian];
    if (!meridian) return null;

    // Step 2: 选穴 — 沿经脉找插入位置
    let insertPos = meridian.points.length;
    if (entry.tags && meridian.points.length > 0) {
        let bestTagScore = 0;
        for (let i = 0; i < meridian.points.length; i++) {
            const p = meridian.points[i];
            if (p.tags) {
                const overlap = entry.tags.filter(t => p.tags.includes(t)).length;
                if (overlap > bestTagScore) { bestTagScore = overlap; insertPos = i + 1; }
            }
        }
    }

    // Step 3: 情绪调制器 — 七情决定初始巩固分
    const emotionConfig = EMOTION_CONSOLIDATION[entry.emotion] || EMOTION_CONSOLIDATION.neutral;
    const baseConsolidation = Math.max(0, emotionConfig.boost);

    // Step 4: 创建穴位
    const id = generatePointId(kg, bestMeridian);
    const newPoint = {
        id,
        description: entry.description || entry.summary || '',
        tags: entry.tags || [],
        keywords: entry.keywords || [],
        category: entry.category || '',
        q: entry.q || 0.5, sigma2: entry.sigma2 || 0.25, n: entry.n || 0,
        status: entry.status || 'HYPOTHESIS',
        consolidation_score: baseConsolidation,
        shu_level: entry.shu_level || 'ying',
        special_type: entry.special_type || null,
        emotion: entry.emotion || null,
        emotion_boost: emotionConfig.boost,
        five_element: entry.five_element || meridian.element || null,
        yinyang: entry.yinyang || meridian.yinyang || null,
        related_points: entry.related_points || [],
        promotes: entry.promotes || [],
        inhibits: entry.inhibits || [],
        hidden: false,
        context: entry.context || {},
        created_at: entry.created_at || new Date().toISOString(),
        last_verified: entry.last_verified || new Date().toISOString(),
        td_error_history: [],
    };

    // Step 5: 阴阳对冲检测 — tags重叠>50% + 结论矛盾 → DISPUTED
    const conflict = detectYinYangConflict(meridian, newPoint);
    if (conflict) {
        newPoint.status = 'DISPUTED';
        newPoint.conflict_with = conflict.conflicting_id;
        newPoint.conflict_reason = conflict.reason;
        newPoint.consolidation_score = Math.max(0, baseConsolidation - 5);
    }

    // Step 6: 插入
    meridian.points.splice(insertPos, 0, newPoint);

    // Step 7: 表里经连接
    establishPairedConnection(kg, bestMeridian, insertPos, newPoint);

    return { point: newPoint, meridian: bestMeridian, meridian_name: meridian.name, position: insertPos, conflict };
}

/** 阴阳对冲检测 — 同经脉tags重叠>50% + 结论方向相反 */
function detectYinYangConflict(meridian, newPoint) {
    if (!newPoint.tags || newPoint.tags.length === 0) return null;
    const now = new Date();
    for (const existing of meridian.points) {
        if (!existing.tags || existing.tags.length === 0) continue;
        const overlap = newPoint.tags.filter(t => existing.tags.includes(t)).length;
        const overlapRatio = overlap / Math.min(newPoint.tags.length, existing.tags.length);
        if (overlapRatio > 0.5) {
            // 检查结论是否相反 (V值方向相反)
            const newV = newPoint.q || 0.5;
            const oldV = existing.q || 0.5;
            const vDiff = Math.abs(newV - oldV);
            // 检查时间差 < 7天
            const daysDiff = (now - new Date(existing.created_at)) / 86400000;
            if (vDiff > 0.4 && daysDiff < 7) {
                return {
                    conflicting_id: existing.id,
                    reason: `tags重叠${Math.round(overlapRatio*100)}% + V值差异${vDiff.toFixed(2)} + 时间差${Math.round(daysDiff)}天`,
                    overlap_ratio: overlapRatio,
                    v_diff: vDiff,
                    days_diff: Math.round(daysDiff),
                };
            }
        }
    }
    return null;
}

function generatePointId(kg, meridianKey) {
    const meridian = kg.meridians[meridianKey] || kg.extra[meridianKey];
    const prefix = meridianKey.substring(0, 3).toUpperCase();
    return `${prefix}${String((meridian?.points?.length || 0) + 1).padStart(3, '0')}`;
}

function establishPairedConnection(kg, meridianKey, position, newPoint) {
    const meridian = kg.meridians[meridianKey];
    if (!meridian?.paired) return;
    const paired = kg.meridians[meridian.paired];
    if (!paired || !paired.points[position]) return;
    const pp = paired.points[position];
    newPoint.related_points = newPoint.related_points || [];
    newPoint.related_points.push({ id: pp.id, relation: 'paired_meridian', position });
    pp.related_points = pp.related_points || [];
    pp.related_points.push({ id: newPoint.id, relation: 'paired_meridian', position });
}

module.exports = { ashiInsert, detectYinYangConflict, generatePointId };