/** ═══════════════════════════════════════════════════════════════
 *  补泻手法 (Reinforce/Reduce) — 价值更新 + 五行生克
 *  "盛则泻之，虚则补之" —《灵枢·经脉》
 * ═══════════════════════════════════════════════════════════════ */
const { SHU_LEVELS, FIVE_ELEMENT } = require('./constants');
const { ARCHIVE_DIR } = require('./constants');
const fs = require('fs');

/**
 * 补泻更新 — 基于TD误差调整穴位属性和五输穴等级
 * tdError > 0.15 → 补(tonify): 价值低估了，加强
 * tdError < -0.15 → 泻(drain): 价值高估了，降低
 */
function reinforceReduce(kg, pointId, tdError, experience = {}) {
    const found = findPoint(kg, pointId);
    if (!found) return null;

    const { point, meridianKey } = found;
    const oldQ = point.q || 0.5, oldN = point.n || 0, oldSigma2 = point.sigma2 || 0.25;
    const newN = oldN + 1;
    const x = experience.v_actual !== undefined ? experience.v_actual : oldQ + tdError;
    const delta = x - oldQ;
    const newQ = oldQ + delta / newN;
    const delta2 = x - newQ;
    const oldM2 = oldSigma2 * Math.max(0, oldN - 1);
    const newM2 = oldM2 + delta * delta2;
    const newSigma2 = newN > 1 ? newM2 / (newN - 1) : 0.25;

    let technique = 'even_reinforcing_reducing', consolidationDelta = 1;
    if (tdError > 0.15) { technique = 'tonify'; consolidationDelta = 5; }
    else if (tdError < -0.15) { technique = 'drain'; consolidationDelta = -3; }

    point.q = Math.max(0, Math.min(1, newQ));
    point.sigma2 = Math.max(0.01, Math.min(1, newSigma2));
    point.n = newN;
    point.consolidation_score = Math.max(0, (point.consolidation_score || 0) + consolidationDelta);
    point.last_verified = new Date().toISOString();
    point.td_error_history = point.td_error_history || [];
    point.td_error_history.push({ td_error: tdError, technique, v_predicted: oldQ, v_actual: x, timestamp: new Date().toISOString() });
    if (point.td_error_history.length > 20) point.td_error_history = point.td_error_history.slice(-20);

    // 五输穴升级/降级
    updateShuLevel(point, technique, newQ);

    // 状态转换
    if (technique === 'tonify' && point.n >= 3 && point.status === 'PROVISIONAL') point.status = 'CONFIRMED';
    if (point.consolidation_score <= 0 && point.status !== 'REFUTED' && point.n >= 5) {
        point.status = 'REFUTED'; hidePoint(kg, meridianKey, pointId);
    }
    if (point.status === 'SLEEPING') { point.status = 'PROVISIONAL'; point.awoke_at = new Date().toISOString(); }

    // 五行生克关系更新
    updateFiveElementRelations(kg, meridianKey, point, technique);

    return { point, meridian: meridianKey, technique, delta, newQ, newSigma2 };
}

function findPoint(kg, pointId) {
    for (const [key, m] of Object.entries(kg.meridians)) {
        const idx = m.points.findIndex(p => p.id === pointId);
        if (idx >= 0) return { point: m.points[idx], meridianKey: key, meridian: m, index: idx };
    }
    for (const [key, m] of Object.entries(kg.extra)) {
        const idx = m.points.findIndex(p => p.id === pointId);
        if (idx >= 0) return { point: m.points[idx], meridianKey: key, meridian: m, index: idx };
    }
    return null;
}

function updateShuLevel(point, technique, newQ) {
    if (!point.shu_level) return;
    const levels = Object.keys(SHU_LEVELS);
    const idx = levels.indexOf(point.shu_level);
    if (technique === 'tonify' && point.n >= 10 && newQ > 0.7 && idx < levels.length - 1) {
        point.shu_level = levels[idx + 1];
        point.shu_promoted_at = new Date().toISOString();
    } else if (technique === 'drain' && point.n >= 5 && newQ < 0.3 && idx > 0) {
        point.shu_level = levels[idx - 1];
    }
}

function updateFiveElementRelations(kg, meridianKey, point, technique) {
    const meridian = kg.meridians[meridianKey];
    if (!meridian?.element) return;
    if (technique === 'tonify') {
        const childElement = FIVE_ELEMENT.generating[meridian.element];
        if (childElement) {
            for (const [key, childM] of Object.entries(kg.meridians)) {
                if (childM.element === childElement) {
                    point.affects_child = point.affects_child || [];
                    point.affects_child.push({ meridian: key, effect: 'nourish', timestamp: new Date().toISOString() });
                }
            }
        }
    }
    if (technique === 'drain') {
        const controlledElement = FIVE_ELEMENT.controlling[meridian.element];
        if (controlledElement) {
            point.releases_control = point.releases_control || [];
            point.releases_control.push({ element: controlledElement, effect: 'release_control', timestamp: new Date().toISOString() });
        }
    }
}

/** 隐穴 — 不删除，只标记hidden，常规召回查不到 */
function hidePoint(kg, meridianKey, pointId) {
    const found = findPoint(kg, pointId);
    if (!found) return;
    found.point.hidden = true;
    found.point.hidden_at = new Date().toISOString();
    // 移至归档文件备份
    const archiveFile = require('path').join(ARCHIVE_DIR, `hidden_points_${new Date().toISOString().slice(0, 7)}.json`);
    let archive = [];
    try { if (fs.existsSync(archiveFile)) archive = JSON.parse(fs.readFileSync(archiveFile, 'utf-8')); } catch(e){}
    archive.push(found.point);
    fs.writeFileSync(archiveFile, JSON.stringify(archive, null, 2), 'utf-8');
}

module.exports = { reinforceReduce, findPoint, hidePoint, updateFiveElementRelations };