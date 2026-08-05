/** ═══════════════════════════════════════════════════════════════
 *  八纲辨证知识诊断 (Eight-Principle Diagnosis)
 *  "善诊者，察色按脉，先别阴阳" —《素问·阴阳应象大论》
 * ═══════════════════════════════════════════════════════════════
 *
 *  四对纲领 (Four Pairs of Principles):
 *    → 阴阳 (Yin-Yang): 知识整体倾向 — 已有阴阳对冲
 *    → 表里 (Exterior-Interior): 表象 vs 深层规律
 *    → 寒热 (Cold-Heat): 沉寂 vs 活跃
 *    → 虚实 (Deficiency-Excess): 不可靠 vs 可靠
 *
 *  用途: 得气召回时用八纲辨证调整每条知识的deqi_score权重
 *        在记忆生命周期的pre_converge检查点作为诊断增强
 */

const now = () => new Date();

/**
 * 八纲辨证 — 对单条知识进行全面诊断
 * @param {object} point — 穴位(知识条目)
 * @param {object} meridian — 所属经脉
 * @param {object} context — 当前上下文(可选)
 * @returns {object} 八纲诊断结果 + 权重调整系数
 */
function diagnose(point, meridian, context = {}) {
    const n = point.n || 0;
    const q = point.q || 0.5;
    const sigma2 = point.sigma2 || 0.25;
    const consolidation = point.consolidation_score || 0;
    const lastVerified = new Date(point.last_verified || point.created_at);
    const daysSince = (now() - lastVerified) / 86400000;
    const status = point.status || 'HYPOTHESIS';
    const emotion = point.emotion || 'neutral';
    const source = point.source || 'inference';

    // ── 阴阳 (Yin-Yang) — 已有体系，此处做方向判定 ──
    const yinYang = {
        direction: q >= 0.5 ? 'yang' : 'yin',
        confidence: sigma2 < 0.1 ? 'firm' : (sigma2 < 0.3 ? 'moderate' : 'uncertain'),
        // 阳=正向有价值, 阴=价值偏低或不确定
        weight_adj: (q >= 0.5 ? 1.0 : 0.7) * (sigma2 < 0.3 ? 1.0 : 0.85),
    };

    // ── 表里 (Exterior-Interior) — 表象 vs 深层规律 ──
    // 表: 单次使用/低巩固分/高variance → 可能只是表面有效
    // 里: 多次验证/高巩固分/低variance → 深层可靠规律
    let exteriorInterior, eiWeightAdj;
    if (n >= 5 && consolidation >= 15 && sigma2 < 0.15) {
        exteriorInterior = 'li';
        eiWeightAdj = 1.0;
    } else if (n >= 2 && consolidation >= 5 && sigma2 < 0.3) {
        exteriorInterior = 'ban_biao_ban_li';
        eiWeightAdj = 0.85;
    } else if (n === 1 && consolidation < 10) {
        exteriorInterior = 'biao';
        eiWeightAdj = 0.6;
    } else {
        exteriorInterior = 'biao';
        eiWeightAdj = 0.7;
    }

    // ── 寒热 (Cold-Heat) — 沉寂 vs 活跃 ──
    // 寒: 久未使用, 无情绪标记, 趋向SLEEPING
    // 热: 频繁使用, 有强情绪, 高度活跃
    let coldHeat, chWeightAdj;
    const strongEmotions = ['kong', 'jing', 'nu', 'xi'];
    const isHotEmotion = strongEmotions.includes(emotion);
    if (daysSince <= 7 && (isHotEmotion || status === 'CONFIRMED')) {
        coldHeat = 'heat';
        chWeightAdj = 1.15;
    } else if (daysSince <= 7) {
        coldHeat = 'warm';
        chWeightAdj = 1.05;
    } else if (daysSince <= 30 && status !== 'SLEEPING') {
        coldHeat = 'cool';
        chWeightAdj = 0.9;
    } else if (daysSince <= 60) {
        coldHeat = 'cold';
        chWeightAdj = 0.7;
    } else {
        coldHeat = 'extreme_cold';
        chWeightAdj = 0.5;
    }

    // ── 虚实 (Deficiency-Excess) — 证据强度 ──
    // 虚: 低n, 高sigma2, 来源不可靠 → 应降低权重
    // 实: 高n, 低sigma2, 来源可靠 → 应提高权重
    let deficiencyExcess, deWeightAdj;
    const sourceReliability = {
        execution_result: 1.0, official_doc: 0.95, multiple_sources: 0.9,
        user_stated: 0.85, inference: 0.6, analogy: 0.5, hearsay: 0.3,
    };
    const srcRel = sourceReliability[source] || 0.5;

    if (n >= 5 && sigma2 < 0.1 && srcRel >= 0.8) {
        deficiencyExcess = 'excess';
        deWeightAdj = 1.1;
    } else if (n >= 3 && sigma2 < 0.2 && srcRel >= 0.6) {
        deficiencyExcess = 'moderate_excess';
        deWeightAdj = 1.0;
    } else if (n >= 1 && sigma2 < 0.4) {
        deficiencyExcess = 'mild_deficiency';
        deWeightAdj = 0.85;
    } else if (n === 0 || sigma2 >= 0.4) {
        deficiencyExcess = 'deficiency';
        deWeightAdj = 0.65;
    } else {
        deficiencyExcess = 'severe_deficiency';
        deWeightAdj = 0.5;
    }

    // ── 综合权重调整 ──
    const compositeWeight = yinYang.weight_adj * eiWeightAdj * chWeightAdj * deWeightAdj;
    // 限制范围: 0.4 ~ 1.3
    const clampedWeight = Math.max(0.4, Math.min(1.3, compositeWeight));

    // ── 脉象判定 (Pulse Diagnosis) ──
    const pulse = determinePulse(yinYang, exteriorInterior, coldHeat, deficiencyExcess, sigma2, n);

    return {
        point_id: point.id,
        yin_yang: yinYang,
        exterior_interior: { type: exteriorInterior, weight_adj: eiWeightAdj },
        cold_heat: { type: coldHeat, weight_adj: chWeightAdj },
        deficiency_excess: { type: deficiencyExcess, weight_adj: deWeightAdj },
        composite_weight: Math.round(clampedWeight * 100) / 100,
        pulse,
        days_since_verified: Math.round(daysSince),
        recommendation: getRecommendation(exteriorInterior, coldHeat, deficiencyExcess, clampedWeight),
    };
}

/**
 * 脉象判定 — 综合八纲给出"脉象"
 * 浮脉: 表面有效但深层不可靠
 * 沉脉: 深层可靠但需要深入挖掘
 * 数脉: 知识热点，高频召回
 * 迟脉: 知识冷门，低频使用
 * 滑脉: 知识流畅可靠
 * 涩脉: 知识不确定/矛盾
 */
function determinePulse(yinYang, ei, ch, de, sigma2, n) {
    if (de === 'excess' && ch === 'heat') return 'hua';      // Hua pulse - excess+heat = smooth reliable
    if (de === 'excess' && ch === 'cold') return 'chen';     // Chen pulse - excess+cold = deep need dig
    if (ei === 'biao' && de.includes('deficiency')) return 'fu';  // Fu pulse - exterior+deficient = surface only
    if (ch.includes('cold') && de.includes('deficiency')) return 'chi'; // Chi pulse - cold+deficient = low frequency
    if (ch === 'heat' && sigma2 > 0.3) return 'shu';         // 数脉 — 热+高不确定性=热点但不稳定
    if (sigma2 > 0.3) return 'se';                           // 涩脉 — 高方差=不确定/矛盾
    if (n >= 3 && sigma2 < 0.15) return 'hua';               // 滑脉 — 多样本低方差
    return 'ping';                                            // 平脉 — 正常
}

const PULSE_LABELS = {
    fu: { name: '浮脉', desc: '表面有效但深层不可靠 — 可能只是偶然成功' },
    chen: { name: '沉脉', desc: '深层可靠但需要深入挖掘 — 冷门但扎实的知识' },
    shu: { name: '数脉', desc: '知识热点，高频但不确定 — 需要更多验证' },
    chi: { name: '迟脉', desc: '知识冷门，低频使用 — 可能需要隐穴' },
    hua: { name: '滑脉', desc: '知识流畅可靠 — 可以放心使用' },
    se: { name: '涩脉', desc: '知识不确定/矛盾 — 需要额外验证' },
    ping: { name: '平脉', desc: '脉象平和 — 知识状态正常' },
};

function getRecommendation(ei, ch, de, weight) {
    if (weight >= 1.0) return 'recommend';
    if (weight >= 0.7) return 'cautious_use';
    if (weight >= 0.5) return 'verify_first';
    return 'deprioritize';
}

/**
 * 批量八纲辨证 — 对所有召回的知识进行诊断
 * @param {object} kg
 * @param {array} results — deqi召回结果
 * @param {object} context — 当前上下文
 * @returns {object} 诊断报告
 */
function batchDiagnose(kg, results, context = {}) {
    const diagnoses = [];
    let totalWeightAdj = 0;

    for (const r of results) {
        const meridian = kg.meridians[r.meridian] || kg.extra[r.meridian];
        const diag = diagnose(r.point, meridian, context);
        diagnoses.push(diag);
        totalWeightAdj += diag.composite_weight;
    }

    const avgWeight = diagnoses.length > 0 ? totalWeightAdj / diagnoses.length : 1.0;

    // 统计脉象分布
    const pulseDist = {};
    for (const d of diagnoses) {
        pulseDist[d.pulse] = (pulseDist[d.pulse] || 0) + 1;
    }

    return {
        diagnosis_count: diagnoses.length,
        average_weight_adjustment: Math.round(avgWeight * 100) / 100,
        pulse_distribution: pulseDist,
        by_recommendation: {
            recommend: diagnoses.filter(d => d.recommendation === 'recommend').length,
            cautious_use: diagnoses.filter(d => d.recommendation === 'cautious_use').length,
            verify_first: diagnoses.filter(d => d.recommendation === 'verify_first').length,
            deprioritize: diagnoses.filter(d => d.recommendation === 'deprioritize').length,
        },
        details: diagnoses,
    };
}

/**
 * 在得气计分中应用八纲权重
 * @returns {number} 权重调整系数
 */
function getDiagnosisWeight(point, meridian, context = {}) {
    const diag = diagnose(point, meridian, context);
    return diag.composite_weight;
}

module.exports = { diagnose, batchDiagnose, getDiagnosisWeight, PULSE_LABELS };
