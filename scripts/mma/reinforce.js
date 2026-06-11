/** ═══════════════════════════════════════════════════════════════
 *  补泻手法 (Reinforce/Reduce) — 价值更新 + 五行生克
 *  "盛则泻之，虚则补之" —《灵枢·经脉》
 * ═══════════════════════════════════════════════════════════════ */
const { SHU_LEVELS, FIVE_ELEMENT, SIX_YAO_LIFECYCLE, YAO_TO_SHU } = require('./constants');
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

    // 六爻生命周期状态转换 (Six Yao Lifecycle)
    // 根据n(验证次数)映射到六爻阶段
    const yaoStage = getYaoStage(point.n);
    point.yao_stage = yaoStage;
    // 六爻→五输穴映射
    if (YAO_TO_SHU[yaoStage]) point.shu_level = YAO_TO_SHU[yaoStage];
    
    // 本卦/之卦/变卦 — 三卦判断知识稳定性
    const trigram = computeTrigramStability(point);
    point.ben_gua = trigram.ben;      // 本卦: 当前q值趋势
    point.zhi_gua = trigram.zhi;      // 之卦: TD误差方向
    point.bian_gua = trigram.bian;    // 变卦: σ²突变风险
    
    // 六爻阶段→旧状态映射(兼容)
    const yaoToStatus = { chu1: 'HYPOTHESIS', yao2: 'PROVISIONAL', yao3: 'ACTIVE', yao4: 'MATURE', yao5: 'CONFIRMED', yao6: 'CONFIRMED' };
    point.status = yaoToStatus[yaoStage] || 'HYPOTHESIS';
    
    // 上爻转化: 顶峰→升华(原穴)或衰退(休眠)
    if (yaoStage === 'yao6') {
        if (trigram.zhi === 'ji' && trigram.bian === 'xiao') {
            point.special_type = 'yuan'; // 升华为原穴 — 关键高频召回知识
            point.yao6_direction = 'ascend';
        } else if (trigram.zhi === 'xiong' || trigram.bian === 'da') {
            point.status = 'SLEEPING'; point.slept_at = new Date().toISOString();
            point.yao6_direction = 'descend';
        } else {
            point.yao6_direction = 'stable';
        }
    }
    
    // 衰退检测
    if (trigram.ben === 'xiong' && trigram.zhi === 'xiong') {
        point.status = 'REFUTED'; hidePoint(kg, meridianKey, pointId);
    }
    if (point.status === 'SLEEPING' && tdError > 0.2) {
        point.status = 'PROVISIONAL'; point.awoke_at = new Date().toISOString();
    }

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


/**
 * 六爻生命周期阶段判定 — 根据验证次数n映射
 */
function getYaoStage(n) {
    if (n <= 0) return 'chu1';
    if (n <= 2) return 'yao2';
    if (n <= 9) return 'yao3';
    if (n <= 19) return 'yao4';
    if (n <= 49) return 'yao5';
    return 'yao6';
}

/**
 * 本卦/之卦/变卦 — 三卦判断知识稳定性
 * 本卦(Ben Gua) = 当前价值趋势: q > 0.7 → ji(吉), q < 0.3 → xiong(凶), else → ping(平)
 * 之卦(Zhi Gua) = TD误差方向(最近3次平均): >0.05 → ji(向好), <-0.05 → xiong(向坏), else → ping
 * 变卦(Bian Gua) = σ²突变风险: σ² < 0.1 → xiao(小), σ² > 0.3 → da(大), else → zhong(中)
 */
function computeTrigramStability(point) {
    const q = point.q || 0.5;
    const ben = q > 0.7 ? 'ji' : (q < 0.3 ? 'xiong' : 'ping');
    
    const history = point.td_error_history || [];
    const recent3 = history.slice(-3);
    let zhi = 'ping';
    if (recent3.length >= 2) {
        const avg = recent3.reduce((s, h) => s + (h.td_error || 0), 0) / recent3.length;
        if (avg > 0.05) zhi = 'ji';
        else if (avg < -0.05) zhi = 'xiong';
    }
    
    const sigma2 = point.sigma2 || 0.25;
    const bian = sigma2 < 0.1 ? 'xiao' : (sigma2 > 0.3 ? 'da' : 'zhong');
    
    return { ben, zhi, bian };
}

module.exports = { reinforceReduce, findPoint, hidePoint, updateFiveElementRelations, getYaoStage, computeTrigramStability };