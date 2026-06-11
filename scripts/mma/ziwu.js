/** 子午流注 — 上下文触发经脉活跃度排序 */
const { EMOTION_MERIDIAN_MAP } = require('./constants');

function ziwuLiuzhu(kg, context = {}) {
    const scores = {};
    const taskType = (context.current_task_type || '').toLowerCase();
    const techStack = (context.tech_stack || '').toLowerCase();
    const emotion = (context.user_emotion || '').toLowerCase();
    const hour = new Date().getHours();

    for (const [key, m] of Object.entries(kg.meridians)) {
        let score = 0.5;
        if (m.ziwu_hour) {
            const [s, e] = m.ziwu_hour;
            if (s <= e) { if (hour >= s && hour < e) score += 0.3; }
            else { if (hour >= s || hour < e) score += 0.3; }
        }
        for (const w of m.category.split('_')) { if (taskType.includes(w)) score += 0.15; }
        if (techStack && m.desc.toLowerCase().includes(techStack)) score += 0.1;
        const mapped = EMOTION_MERIDIAN_MAP[emotion];
        if (mapped === key) score += 0.25;
        scores[key] = Math.min(score, 1.0);
    }
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const result = sorted.slice(0, 6).map(([k]) => k);
    for (const ek of Object.keys(kg.extra)) { if (!result.includes(ek)) result.push(ek); }
    return result;
}

module.exports = { ziwuLiuzhu };