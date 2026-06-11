/** 统计诊断 — 经络系统全景视图 */
const { SHU_LEVELS } = require('./constants');

function getStatus(kg) {
    const status = {
        algorithm: 'MMA (Meridian Memory Algorithm)',
        version: kg.meta?.version || '2.0.0',
        total_points: countAll(kg),
        visible_points: countVisible(kg),
        hidden_points: countHidden(kg),
        meridians: {},
        extra: {},
        element_distribution: {},
        shu_level_distribution: {},
        emotion_distribution: {},
        clusters: kg.meta?.clusters?.length || 0,
    };

    for (const [key, m] of Object.entries(kg.meridians)) {
        const visible = m.points.filter(p => !p.hidden);
        status.meridians[key] = {
            name: m.name, category: m.category,
            total: m.points.length, visible: visible.length, hidden: m.points.length - visible.length,
            element: m.element, yinyang: m.yinyang,
            avg_q: visible.length > 0 ? visible.reduce((s,p)=>s+(p.q||0.5),0)/visible.length : 0,
        };
    }
    for (const [key, m] of Object.entries(kg.extra)) {
        status.extra[key] = { name: m.name, role: m.role, points: m.points.length };
    }
    for (const m of Object.values(kg.meridians)) {
        const el = m.element || 'unknown';
        status.element_distribution[el] = (status.element_distribution[el]||0) + m.points.filter(p=>!p.hidden).length;
    }
    for (const m of Object.values(kg.meridians)) {
        for (const p of m.points) {
            if (p.hidden) continue;
            const sl = p.shu_level || 'ying';
            status.shu_level_distribution[sl] = (status.shu_level_distribution[sl]||0) + 1;
        }
    }
    for (const m of Object.values(kg.meridians)) {
        for (const p of m.points) {
            if (p.hidden) continue;
            const em = p.emotion || 'neutral';
            status.emotion_distribution[em] = (status.emotion_distribution[em]||0) + 1;
        }
    }
    return status;
}

function countAll(kg) {
    return Object.values(kg.meridians).reduce((s,m)=>s+m.points.length,0)
         + Object.values(kg.extra).reduce((s,m)=>s+m.points.length,0);
}
function countVisible(kg) {
    return Object.values(kg.meridians).reduce((s,m)=>s+m.points.filter(p=>!p.hidden).length,0)
         + Object.values(kg.extra).reduce((s,m)=>s+m.points.filter(p=>!p.hidden).length,0);
}
function countHidden(kg) {
    return Object.values(kg.meridians).reduce((s,m)=>s+m.points.filter(p=>p.hidden).length,0)
         + Object.values(kg.extra).reduce((s,m)=>s+m.points.filter(p=>p.hidden).length,0);
}

module.exports = { getStatus };