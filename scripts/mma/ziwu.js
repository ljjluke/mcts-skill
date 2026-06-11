/** 子午流注 — 上下文触发经脉活跃度 + 九宫飞星四级叠加 */
const { EMOTION_MERIDIAN_MAP, LUOSHU_GRID, YEAR_STAR_BASE, MONTH_STAR_OFFSET } = require('./constants');

/**
 * 九宫飞星 — 计算某年某月某日某时的飞星落到哪个宫
 * 四级叠加: 年飞星 + 月飞星 + 日飞星 + 时飞星
 * 返回每条经脉的综合活跃权重
 */
function ziwuLiuzhu(kg, context = {}) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    const hour = now.getHours();
    
    const taskType = (context.current_task_type || '').toLowerCase();
    const techStack = (context.tech_stack || '').toLowerCase();
    const emotion = (context.user_emotion || '').toLowerCase();
    
    // === 1. 九宫飞星四级叠加 ===
    const meridianScores = {};
    
    // 年飞星: 计算今年中心星
    const yearStar = computeYearStar(year);
    // 月飞星: 在年飞星基础上叠加
    const monthStar = computeMonthStar(year, month);
    // 日飞星: 简化版 — 冬至后顺飞
    const dayStar = computeDayStar(year, month, now.getDate());
    // 时飞星: 子午卯酉日不同起始
    const hourStar = computeHourStar(now.getDate(), hour);
    
    // 四级飞星叠加到各宫位权重
    const starWeights = [yearStar, monthStar, dayStar, hourStar];
    
    for (const [pos, grid] of Object.entries(LUOSHU_GRID)) {
        let weight = 0;
        for (const star of starWeights) {
            if (star === parseInt(pos)) weight += 0.25; // 飞星落到此宫
            // 相邻宫也有微弱影响
            const adjacents = getAdjacentPositions(parseInt(pos));
            if (adjacents.includes(star)) weight += 0.1;
        }
        // 分配权重到该宫位的经脉
        for (const mkey of grid.meridians) {
            meridianScores[mkey] = (meridianScores[mkey] || 0) + weight;
        }
    }
    
    // === 2. 子午流注时辰映射(保留原有逻辑) ===
    for (const [key, m] of Object.entries(kg.meridians)) {
        if (m.ziwu_hour) {
            const [s, e] = m.ziwu_hour;
            if (s <= e) { if (hour >= s && hour < e) meridianScores[key] = (meridianScores[key] || 0) + 0.3; }
            else { if (hour >= s || hour < e) meridianScores[key] = (meridianScores[key] || 0) + 0.3; }
        }
    }
    
    // === 3. 任务类型 + 技术栈 + 情感(保留) ===
    for (const [key, m] of Object.entries(kg.meridians)) {
        for (const w of m.category.split('_')) { if (taskType.includes(w)) meridianScores[key] = (meridianScores[key] || 0) + 0.15; }
        if (techStack && m.desc.toLowerCase().includes(techStack)) meridianScores[key] = (meridianScores[key] || 0) + 0.1;
        if (EMOTION_MERIDIAN_MAP[emotion] === key) meridianScores[key] = (meridianScores[key] || 0) + 0.25;
    }
    
    // === 4. 归一化 + 排序 ===
    const sorted = Object.entries(meridianScores)
        .filter(([k]) => kg.meridians[k])
        .sort((a, b) => b[1] - a[1]);
    
    const result = sorted.slice(0, 6).map(([k]) => k);
    for (const ek of Object.keys(kg.extra)) { if (!result.includes(ek)) result.push(ek); }
    return result;
}

/** 年飞星: 2024年起每年逆飞一位(9→8→7→...→1) */
function computeYearStar(year) {
    const base = YEAR_STAR_BASE[year];
    if (base) return base;
    // 2024=3, 每年-1, 到1后跳9
    const diff = year - 2024;
    let star = 3 - diff;
    while (star < 1) star += 9;
    while (star > 9) star -= 9;
    return star;
}

/** 月飞星: 根据年地支选择起始月星 */
function computeMonthStar(year, month) {
    const dz = year % 12; // 年地支索引: 0=子,1=丑,...
    let pattern;
    if ([0, 6].includes(dz)) pattern = 'zi_wu_mao_you';       // 子午卯酉
    else if ([1, 4, 7, 10].includes(dz)) pattern = 'chen_xu_chou_wei'; // 辰戌丑未
    else pattern = 'yin_shen_si_hai';                          // 寅申巳亥
    return MONTH_STAR_OFFSET[pattern][month - 1];
}

/** 日飞星: 简化 — 冬至后顺飞，夏至后逆飞 */
function computeDayStar(year, month, day) {
    const dayOfYear = Math.floor((new Date(year, month - 1, day) - new Date(year, 0, 0)) / 86400000);
    let star = (dayOfYear % 9) + 1;
    // 夏至后逆飞
    const summerSolstice = Math.floor((new Date(year, 5, 21) - new Date(year, 0, 0)) / 86400000);
    if (dayOfYear > summerSolstice) star = 10 - star; // 逆飞: 1→9, 9→1
    return star;
}

/** 时飞星: 子午卯酉日起1, 辰戌丑未日起4, 寅申巳亥日起7 */
function computeHourStar(day, hour) {
    const dz = day % 12; // 日地支
    let base;
    if ([0, 6].includes(dz)) base = 1;       // 子午卯酉日
    else if ([1, 4, 7, 10].includes(dz)) base = 4; // 辰戌丑未日
    else base = 7;                              // 寅申巳亥日
    const shichen = Math.floor(hour / 2); // 时辰 0-11
    let star = base + shichen;
    while (star > 9) star -= 9;
    return star;
}

/** 九宫相邻宫位 */
function getAdjacentPositions(pos) {
    const neighbors = {
        1: [6, 8], 2: [7, 9, 3], 3: [8, 4], 4: [3, 9, 5],
        5: [2, 4, 6, 8], 6: [1, 5, 7], 7: [2, 6, 8],
        8: [1, 3, 5, 7, 9], 9: [2, 4, 8]
    };
    return neighbors[pos] || [];
}

module.exports = { ziwuLiuzhu };