/** IO — 文件读写 loadMMA/saveMMA + 模板合并 */
const fs = require('fs');
const { DATA_DIR, MEMORY_DIR, MMA_FILE, WORKING_MEMORY_FILE, ARCHIVE_DIR,
        TWELVE_MERIDIANS, EIGHT_EXTRA_MERIDIANS } = require('./constants');

function ensureDirs() {
    [DATA_DIR, MEMORY_DIR, ARCHIVE_DIR].forEach(d => {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });
}

function loadMMA() {
    ensureDirs();
    if (!fs.existsSync(MMA_FILE)) return freshKG();
    try {
        const data = JSON.parse(fs.readFileSync(MMA_FILE, 'utf-8'));
        for (const key of Object.keys(TWELVE_MERIDIANS)) {
            if (!data.meridians[key]) data.meridians[key] = structuredClone(TWELVE_MERIDIANS[key]);
            else for (const prop of Object.keys(TWELVE_MERIDIANS[key]))
                if (!(prop in data.meridians[key]) && prop !== 'points') data.meridians[key][prop] = TWELVE_MERIDIANS[key][prop];
        }
        for (const key of Object.keys(EIGHT_EXTRA_MERIDIANS)) {
            if (!data.extra[key]) data.extra[key] = structuredClone(EIGHT_EXTRA_MERIDIANS[key]);
            else for (const prop of Object.keys(EIGHT_EXTRA_MERIDIANS[key]))
                if (!(prop in data.extra[key]) && prop !== 'points') data.extra[key][prop] = EIGHT_EXTRA_MERIDIANS[key][prop];
        }
        return data;
    } catch (e) { return freshKG(); }
}

function freshKG() {
    return {
        meridians: structuredClone(TWELVE_MERIDIANS),
        extra: structuredClone(EIGHT_EXTRA_MERIDIANS),
        meta: { version: "2.0.0", algorithm: "MMA (Meridian Memory Algorithm)",
                created: new Date().toISOString(), total_points: 0 }
    };
}

function saveMMA(kg) {
    ensureDirs();
    kg.meta.total_points = Object.values(kg.meridians).reduce((s,m)=>s+m.points.length,0)
                         + Object.values(kg.extra).reduce((s,m)=>s+m.points.length,0);
    kg.meta.last_saved = new Date().toISOString();
    fs.writeFileSync(MMA_FILE, JSON.stringify(kg, null, 2), 'utf-8');
}

// 三焦工作记忆
function loadWorkingMemory() {
    ensureDirs();
    if (!fs.existsSync(WORKING_MEMORY_FILE)) return { upper:[], middle:[], lower:[], last_meridian:null, last_meridian_ts:null };
    try { return JSON.parse(fs.readFileSync(WORKING_MEMORY_FILE, 'utf-8')); }
    catch(e) { return { upper:[], middle:[], lower:[], last_meridian:null, last_meridian_ts:null }; }
}

function saveWorkingMemory(wm) {
    ensureDirs();
    fs.writeFileSync(WORKING_MEMORY_FILE, JSON.stringify(wm, null, 0), 'utf-8');
}

module.exports = { ensureDirs, loadMMA, saveMMA, freshKG, loadWorkingMemory, saveWorkingMemory };