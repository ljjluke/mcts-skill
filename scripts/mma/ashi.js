/** ═══════════════════════════════════════════════════════════════
 *  阿是穴 (Ashi) — 新知识插入 + 情绪调制器 + 阴阳对冲检测
 *  情景/语义记忆分类 + 源监控权重 + 精细加工深度
 *  "以痛为腧" —《灵枢·经筋》
 *  "方以类聚，物以群分" —《周易·系辞》
 * ═══════════════════════════════════════════════════════════════ */
const { EMOTION_CONSOLIDATION, SHU_LEVELS, SOURCE_RELIABILITY } = require('./constants');

/**
 * 阿是穴插入 — 新知识归经→选穴→创建→建立表里连接
 * 情绪调制: 七情强度决定初始巩固分
 * 阴阳对冲: 检测同经脉内tags重叠>50%+结论矛盾→DISPUTED
 * 质量门: 拒绝无意义噪音
 * 完整性标记: 标记缺失维度供补全
 */
function ashiInsert(kg, entry) {
    // Step 0: 质量门 — 拒绝真正的噪音
    const qualityCheck = assessQuality(entry);
    if (qualityCheck.verdict === 'REJECT') {
        return { rejected: true, reason: qualityCheck.reason };
    }

    // 完整性分析 — 标记缺失维度
    const completeness = assessCompleteness(entry);
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

    // 源监控: 确定来源可靠性权重
    const source = entry.source || 'unknown';
    const srcConfig = SOURCE_RELIABILITY[source] || SOURCE_RELIABILITY.unknown;

    // 情景vs语义: 有task_type+context → 情景记忆; 纯category+tags → 语义记忆
    const memoryType = (entry.task_type || entry.context?.task_type) ? 'episodic' : 'semantic';

    // 精细加工深度: 根据已有信息量判断
    const elaborationLevel = computeElaborationLevel(entry);

    const newPoint = {
        id,
        description: entry.description || entry.summary || '',
        tags: entry.tags || [],
        keywords: entry.keywords || [],
        category: entry.category || '',
        q: entry.q || 0.5, sigma2: entry.sigma2 || 0.25, n: entry.n || 0,
        status: entry.status || 'HYPOTHESIS',
        consolidation_score: baseConsolidation + elaborationLevel.consolidation_bonus,
        shu_level: entry.shu_level || 'ying',
        special_type: entry.special_type || null,
        emotion: entry.emotion || null,
        emotion_boost: emotionConfig.boost,
        five_element: entry.five_element || meridian.element || null,
        yinyang: entry.yinyang || meridian.yinyang || null,
        // 仿脑新增字段
        memory_type: memoryType,               // episodic | semantic
        source: source,                         // execution_result | user_stated | inference | ...
        source_reliability: srcConfig.weight,   // 0.2 ~ 1.0
        source_label: srcConfig.label,          // 亲历 | 告知 | 推理 | ...
        elaboration_level: elaborationLevel.level, // shallow | medium | deep | deepest
        task_type: entry.task_type || null,     // 情景记忆的上下文
        context_snapshot: entry.context || {},   // 编码时的上下文快照
        reconsolidation_window: null,           // 再巩固窗口(方案13)
        // 完整性: 记录了哪些维度缺失
        _missing_dimensions: completeness.missing,
        _completion_suggestions: completeness.suggestions,
        _needs_completion: completeness.missing.length > 0,
        related_points: entry.related_points || [],
        promotes: entry.promotes || [],
        inhibits: entry.inhibits || [],
        hidden: false,
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
            // 检查时间差 < 7天 — 防御性解析，无效日期跳过
            const existingDate = new Date(existing.created_at);
            if (isNaN(existingDate.getTime())) continue;
            const daysDiff = (now - existingDate) / 86400000;
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

module.exports = { ashiInsert, detectYinYangConflict, generatePointId, computeElaborationLevel, assessQuality, assessCompleteness };


/**
 * ═══════════════════════════════════════════════════════════════
 *  质量门 — 精确区分"有用"和"噪音"
 *  "知之为知之，不知为不知" —《论语》
 *
 *  原则: 宁可放行可疑信息（后面有衰减和补泻清理），
 *        不可误杀真正有用的经验（哪怕只有一句话）。
 *
 *  真正噪音的判断标准（同时满足才拒绝）:
 *  1. 描述长度 < 10 字（纯空/几乎无内容）
 *  AND 2. 无 tags（无结构化信息）
 *  AND 3. 无 emotion（无主观体验）
 *  AND 4. 无 source 或 source=unknown（无来源）
 *
 *  只要有一个维度有信息 → 放行
 * ═══════════════════════════════════════════════════════════════
 */
function assessQuality(entry) {
    const desc = (entry.description || entry.summary || '').trim();
    const tags = entry.tags || [];
    const keywords = entry.keywords || [];
    const source = entry.source || 'unknown';
    const emotion = entry.emotion || null;
    const category = entry.category || '';

    // 检测点: 是否有任何实质性信息
    const hasContent = desc.length >= 10 || tags.length > 0 || keywords.length > 0;
    const hasContext = category || emotion || (source !== 'unknown' && source !== 'hearsay');
    const hasSource = source !== 'unknown';

    // 完全空: 没有任何信息
    if (!desc && tags.length === 0 && !source && !emotion && !category) {
        return { verdict: 'REJECT', score: 0, reason: '完全空内容' };
    }

    // 真正的噪音: 内容极短 + 无标签 + 无情绪 + 无来源
    if (desc.length < 10 && tags.length === 0 && !emotion && source === 'unknown') {
        return { verdict: 'REJECT', score: 0.1, reason: '无实质内容: 无描述/无标签/无情绪/无来源' };
    }

    // 极短描述但有关键结构化信息 → 放行
    if (!hasContent && !hasContext && !hasSource) {
        return { verdict: 'REJECT', score: 0.15, reason: '信息量极低' };
    }

    // 其他情况 → 全部放行
    let qualityScore = 0.5;
    if (desc.length >= 30) qualityScore += 0.15;
    if (tags.length >= 2) qualityScore += 0.1;
    if (keywords.length > 0) qualityScore += 0.05;
    if (emotion && emotion !== 'neutral') qualityScore += 0.1;
    if (source !== 'unknown') qualityScore += 0.1;
    if (category) qualityScore += 0.05;

    return { verdict: 'PASS', score: Math.min(1, qualityScore), reason: '含有效信息' };
}

/**
 * ═══════════════════════════════════════════════════════════════
 *  完整性检测 — 标记缺失维度
 *  "方以类聚，物以群分" —《周易》
 *
 *  一个完整的知识条目应该包含:
 *    核心层: description(描述) + tags(标签) + source(来源)
 *    上下文层: category(分类) + context(上下文快照)
 *    体验层: emotion(情绪) + keywords(关键词)
 *
 *  不拒绝，只标记。缺失的维度可以在后续被补全。
 * ═══════════════════════════════════════════════════════════════
 */
function assessCompleteness(entry) {
    const desc = (entry.description || entry.summary || '').trim();
    const tags = entry.tags || [];
    const source = entry.source || 'unknown';
    const category = entry.category || '';
    const emotion = entry.emotion || '';
    const contextKeys = entry.context ? Object.keys(entry.context) : [];

    const missing = [];
    const suggestions = [];

    // 核心层
    if (desc.length < 20) {
        missing.push('description');
        suggestions.push('补充详细描述，说明做了什么、为什么这样做、结果如何');
    }
    if (tags.length === 0) {
        missing.push('tags');
        suggestions.push('添加2~3个标签，帮助知识被找到');
    }
    if (source === 'unknown') {
        missing.push('source');
        suggestions.push('标明信息来源: 亲历/告知/文档/推理');
    }

    // 上下文层
    if (!category) {
        missing.push('category');
        suggestions.push('归入一个分类');
    }
    if (contextKeys.length === 0) {
        missing.push('context');
        suggestions.push('附加上下文快照(任务类型/技术栈等)');
    }

    // 体验层: 这不是必填的，但缺失会减信息量
    if (!emotion) {
        missing.push('emotion(可选)');
    }
    if (tags.length < 2) {
        missing.push('more_tags(推荐)');
    }

    return {
        missing,
        suggestions: suggestions.slice(0, 3), // 最多3条建议
        completeness_score: Math.round((1 - missing.length / 8) * 100) / 100,
    };
}


/**
 * 精细加工深度评估 — "格物致知"的层次
 * 浅加工: 只记录了结论 → +0
 * 中加工: 有原因/关联 → +2
 * 深加工: 有反思/教训 → +4
 * 最深加工: 产生新见解/被引用 → +6
 */
function computeElaborationLevel(entry) {
    let score = 0;
    let level = 'shallow';

    // 有描述(>30字) → 至少中加工
    if ((entry.description || entry.summary || '').length > 30) score += 1;
    // 有tags+keywords → 有结构化的元信息
    if ((entry.tags || []).length > 1 && (entry.keywords || []).length > 0) score += 1;
    // 有context → 关联了具体场景
    if (entry.context && Object.keys(entry.context).length > 1) score += 1;
    // 有related_points → 做了知识关联
    if ((entry.related_points || []).length > 0) score += 1;
    // 有emotion → 有主观体验
    if (entry.emotion) score += 1;
    // td_error_history已有 → 有反思
    if ((entry.n || 0) >= 3) score += 1;

    if (score >= 5) level = 'deepest';
    else if (score >= 3) level = 'deep';
    else if (score >= 2) level = 'medium';
    else level = 'shallow';

    const bonusMap = { shallow: 0, medium: 2, deep: 4, deepest: 6 };
    return { level, score, consolidation_bonus: bonusMap[level] };
}