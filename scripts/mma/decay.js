/** ═══════════════════════════════════════════════════════════════
 *  记忆衰减 + 隐穴唤醒 + 睡眠回放
 *  "夜卧则血归于肝" —《素问·五脏生成》
 *  睡眠时海马体以20倍速回放白天经历，筛选重要记忆巩固到皮层
 * ═══════════════════════════════════════════════════════════════ */
const { EMOTION_CONSOLIDATION } = require('./constants');
const { hidePoint } = require('./reinforce');
const { findPointById, markDirty } = require('./io');
const { isInStatusSet } = require('./state_machine');

/**
 * 记忆衰减检查 — 久不使用则"气虚"，自动降级或隐穴
 *  情景记忆(episodic): >60天 → 隐穴 (具体经历忘得快)
 *  语义记忆(semantic): >90天 → 隐穴 (事实知识忘得慢)
 *   >30天 + CONFIRMED → SLEEPING
 *   ≤7天 + SLEEPING → 唤醒
 */
function decayCheck(kg) {
    const now = new Date();
    const decayed = [];
    for (const [key, m] of Object.entries(kg.meridians)) {
        for (let i = m.points.length - 1; i >= 0; i--) {
            const p = m.points[i];
            if (p.hidden) continue;
            const lastVerified = new Date(p.last_verified || p.created_at);
            const daysSince = (now - lastVerified) / 86400000;

            // 情景记忆衰减更快
            const hideThreshold = p.memory_type === 'episodic' ? 60 : 90;
            const baseConsolidation = p.consolidation_score || 0;
            // 源不可靠的知识衰减更快（传闻比亲历忘得快）
            const sourceDecayFactor = (p.source_reliability && p.source_reliability < 0.5) ? 0.7 : 1.0;
            const effectiveDays = daysSince / sourceDecayFactor;

            if (effectiveDays > hideThreshold && baseConsolidation <= 3 && !isInStatusSet(p.status, 'reliable')) {
                hidePoint(kg, key, p.id);
                markDirty(kg, key);
                decayed.push({ point_id: p.id, meridian: key, action: 'hide',
                    days: Math.round(daysSince), memory_type: p.memory_type, source: p.source });
            } else if (daysSince > 30 && isInStatusSet(p.status, 'decayable') && p.status !== 'SLEEPING') {
                p.status = 'SLEEPING'; p.slept_at = now.toISOString();
                markDirty(kg, key);
                decayed.push({ point_id: p.id, meridian: key, action: 'sleep', days: Math.round(daysSince) });
            } else if (daysSince <= 7 && p.status === 'SLEEPING') {
                p.status = 'PROVISIONAL'; p.awoke_at = now.toISOString();
                markDirty(kg, key);
                decayed.push({ point_id: p.id, meridian: key, action: 'awaken', days: Math.round(daysSince) });
            }
        }
    }
    return decayed;
}

/**
 * 睡眠回放 (Memory Consolidation)
 * 会话结束时触发，模拟海马体快速回放
 * 以高倍速回放本会话的知识交互，情绪强度高的巩固加强
 *
 * @param {object} kg
 * @param {array} sessionPoints — 本会话涉及的所有穴位ID列表
 * @param {array} sessionEmotions — 本会话的情感时间线
 */
function sessionEnd(kg, sessionPoints = [], sessionEmotions = []) {
    const now = new Date();
    const results = [];

    // 1. 回放本会话的每个知识交互
    for (const pointId of sessionPoints) {
        const found = findPointById(kg, pointId);
        if (!found) continue;
        const { point } = found;

        // 2. 情绪加权: 找到该知识关联的情绪，决定巩固力度
        const relatedEmotions = sessionEmotions.filter(e =>
            e.context && e.context.includes(pointId.substring(0, 6))
        );
        let emotionBoost = 0;
        for (const em of relatedEmotions) {
            const config = EMOTION_CONSOLIDATION[em.qiqing] || EMOTION_CONSOLIDATION.neutral;
            emotionBoost += config.boost;
        }

        // 3. 巩固分更新: 情绪越强，巩固越多
        const baseBoost = 2; // base replay boost
        const totalBoost = baseBoost + Math.min(emotionBoost, 15);
        point.consolidation_score = (point.consolidation_score || 0) + totalBoost;
        point.last_replayed = now.toISOString();

        // 4. 状态提升: 巩固分达标 → 升级
        if (point.status === 'HYPOTHESIS' && point.consolidation_score >= 5) point.status = 'PROVISIONAL';
        if (point.status === 'PROVISIONAL' && point.consolidation_score >= 20 && point.n >= 3) point.status = 'CONFIRMED';

        results.push({ point_id: pointId, boost: totalBoost, new_score: point.consolidation_score, status: point.status });
    }

    // 5. 清理: 衰减检查
    const decayed = decayCheck(kg);

    return { replayed: results.length, decayed: decayed.length, details: results };
}

/**
 * 温故知新 — 定期回顾旧知识
 * "温故而知新，可以为师矣" —《论语》
 */
function experienceReplay(kg, limit = 10) {
    const candidates = [];
    for (const [key, m] of Object.entries(kg.meridians)) {
        for (const p of m.points) {
            if (p.hidden) continue;
            const daysSince = (Date.now() - new Date(p.last_verified || p.created_at)) / 86400000;
            if (daysSince > 7 && daysSince < 30 && p.status === 'CONFIRMED') {
                candidates.push({
                    point_id: p.id, meridian: key, meridian_name: m.name,
                    days_since_verified: Math.round(daysSince),
                    replay_priority: (p.q||0.5) * (1 - daysSince/30) + (p.consolidation_score||0)/100,
                });
            }
        }
    }
    candidates.sort((a, b) => b.replay_priority - a.replay_priority);
    return candidates.slice(0, limit);
}

module.exports = { decayCheck, sessionEnd, experienceReplay };