/** ═══════════════════════════════════════════════════════════════
 *  统一六爻状态机 (Unified Six-Yao State Machine)
 *  "易有太极，是生两仪，两仪生四象，四象生八卦" —《周易·系辞》
 *
 *  单一真相源: 六爻阶段 → 语义状态名
 *  所有模块通过本模块查询状态，不再各自硬编码映射
 *
 *  六爻 → 语义映射:
 *    chu1 (初爻)  → HYPOTHESIS  — 未经验证
 *    yao2 (二爻)  → PROVISIONAL — 初步验证
 *    yao3 (三爻)  → ACTIVE      — 多次验证，稳定使用
 *    yao4 (四爻)  → MATURE      — 跨经脉投影，成熟知识
 *    yao5 (五爻)  → CONFIRMED   — 高巩固分，可靠
 *    yao6 (上爻)  → TRANSITIONAL — 顶峰转化(升华或衰退)
 *
 *  附加状态(非六爻阶段，由特定事件触发):
 *    DISPUTED — 阴阳对冲突
 *    SLEEPING — 久未使用
 *    REFUTED  — 被推翻
 *    ARCHIVED — 归档
 * ═══════════════════════════════════════════════════════════════ */

const { SIX_YAO_LIFECYCLE, YAO_TO_SHU } = require('./constants');

// 六爻阶段 → 语义状态 (单一映射)
const YAO_TO_STATUS = {
    chu1: 'HYPOTHESIS',
    yao2: 'PROVISIONAL',
    yao3: 'ACTIVE',
    yao4: 'MATURE',
    yao5: 'CONFIRMED',
    yao6: 'TRANSITIONAL',
};

// 语义状态 → 权重 (查询时使用)
const STATUS_WEIGHTS = {
    HYPOTHESIS:     0.1,
    PROVISIONAL:    0.3,
    ACTIVE:         0.6,
    MATURE:         0.8,
    CONFIRMED:      1.0,
    TRANSITIONAL:   0.5,
    DISPUTED:       0.2,
    SLEEPING:       0.15,
    REFUTED:        0.0,
    ARCHIVED:       0,
};

// 状态分类集合 — 替代分散在各模块的 has/collection 检查
const STATUS_SETS = {
    // 可靠状态: 高权重，衰减中降级较慢
    reliable: new Set(['ACTIVE', 'MATURE', 'CONFIRMED']),
    // 不可靠状态: 低权重
    unreliable: new Set(['HYPOTHESIS', 'PROVISIONAL', 'DISPUTED']),
    // 已失效状态: 不参与常规召回
    inactive: new Set(['REFUTED', 'ARCHIVED', 'SLEEPING']),
    // 可召回状态: 常规 deqi 可返回
    recallable: new Set(['HYPOTHESIS', 'PROVISIONAL', 'ACTIVE', 'MATURE', 'CONFIRMED', 'TRANSITIONAL', 'DISPUTED']),
    // 可衰减降级: 超时后可进入 SLEEPING
    decayable: new Set(['ACTIVE', 'MATURE', 'CONFIRMED']),
    // 可唤醒: SLEEPING → PROVISIONAL
    awakenable: new Set(['SLEEPING']),
    // 可隐藏: 巩固分低 + 长期不用
    hideable: new Set(['HYPOTHESIS', 'PROVISIONAL', 'DISPUTED', 'TRANSITIONAL']),
};

/**
 * 根据验证次数 n 判定六爻阶段
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
 * 六爻阶段 → 语义状态名
 */
function yaoToStatus(yaoStage) {
    return YAO_TO_STATUS[yaoStage] || 'HYPOTHESIS';
}

/**
 * 验证次数 n → 语义状态名（便捷方法）
 */
function nToStatus(n) {
    return yaoToStatus(getYaoStage(n));
}

/**
 * 获取状态的查询权重
 */
function getStatusWeight(status) {
    return STATUS_WEIGHTS[status] !== undefined ? STATUS_WEIGHTS[status] : 0.1;
}

/**
 * 状态是否属于指定集合
 */
function isInStatusSet(status, setName) {
    const set = STATUS_SETS[setName];
    return set ? set.has(status) : false;
}

/**
 * 获取六爻阶段的五输穴等级
 */
function yaoToShuLevel(yaoStage) {
    return YAO_TO_SHU[yaoStage] || 'jing';
}

module.exports = {
    YAO_TO_STATUS,
    STATUS_WEIGHTS,
    STATUS_SETS,
    getYaoStage,
    yaoToStatus,
    nToStatus,
    getStatusWeight,
    isInStatusSet,
    yaoToShuLevel,
};
