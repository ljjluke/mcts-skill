/** ═══════════════════════════════════════════════════════════════
 *  IO — 经脉分片存储 + 原子写入 + 自动备份 + 旧格式自动迁移
 *  "经脉者，所以决死生，处百病，调虚实，不可不通" —《灵枢·经脉》
 *
 *  存储哲学:
 *    每条经脉 = 一个独立文件 (shards/<meridian_key>.json)
 *    每条奇经 = 一个独立文件 (shards/_extra_<key>.json)
 *    meta.json = 全局元数据
 *
 *  优势:
 *    - 经脉独立运作，一个损坏不影响其他(经络独立)
 *    - deqi只加载活跃经脉(子午流注返回的6条)
 *    - 多智能体并发: 不同经脉无锁竞争
 *    - 原子写入(tmp→rename) + 备份(.bak) + 定期快照
 *
 *  外部接口不变: loadMMA / saveMMA / freshKG
 *  内部自动检测旧格式 meridian_kg.json 并迁移到分片
 * ═══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const { DATA_DIR, MEMORY_DIR, MMA_FILE, MMA_SHARDS_DIR, WORKING_MEMORY_FILE, ARCHIVE_DIR,
        TWELVE_MERIDIANS, EIGHT_EXTRA_MERIDIANS } = require('./constants');

const META_FILE = path.join(MMA_SHARDS_DIR, 'meta.json');
const SNAPSHOT_INTERVAL = 100;

function ensureDirs() {
    [DATA_DIR, MEMORY_DIR, MMA_SHARDS_DIR, ARCHIVE_DIR].forEach(d => {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });
}

// ═══════════════════════════════════════════════════════════════
//  分片文件路径
// ═══════════════════════════════════════════════════════════════

function shardPath(meridianKey) { return path.join(MMA_SHARDS_DIR, `${meridianKey}.json`); }
function shardBakPath(meridianKey) { return path.join(MMA_SHARDS_DIR, `${meridianKey}.bak.json`); }
function shardTmpPath(meridianKey) { return path.join(MMA_SHARDS_DIR, `${meridianKey}.tmp.json`); }

// ═══════════════════════════════════════════════════════════════
//  原子写入一个分片
// ═══════════════════════════════════════════════════════════════

function atomicWriteShard(filePath, bakPath, data) {
    const json = JSON.stringify(data, null, 2);
    const tmpPath = filePath.replace('.json', '.tmp.json');

    // 备份当前有效版本
    if (fs.existsSync(filePath)) {
        try {
            JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            fs.copyFileSync(filePath, bakPath);
        } catch (e) { /* 当前文件损坏，不备份 */ }
    }

    // 写临时文件 → fsync → rename
    fs.writeFileSync(tmpPath, json, 'utf-8');
    try { const fd = fs.openSync(tmpPath, 'r+'); fs.fsyncSync(fd); fs.closeSync(fd); } catch (e) {}
    fs.renameSync(tmpPath, filePath);
}

function loadShardWithRecovery(filePath, bakPath, fallback) {
    // 尝试主文件
    if (fs.existsSync(filePath)) {
        try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
        catch (e) { console.error(`[MMA] 分片损坏: ${path.basename(filePath)} — ${e.message}`); }
    }
    // 尝试备份
    if (fs.existsSync(bakPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(bakPath, 'utf-8'));
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
            console.error(`[MMA] 分片 ${path.basename(filePath)} 已从备份恢复`);
            return data;
        } catch (e) { console.error(`[MMA] 分片备份也损坏: ${path.basename(bakPath)}`); }
    }
    return fallback;
}

// ═══════════════════════════════════════════════════════════════
//  加载 — 从分片目录组装完整KG
// ═══════════════════════════════════════════════════════════════

function loadMMA() {
    ensureDirs();

    // 自动迁移: 如果旧格式 meridian_kg.json 存在且分片目录为空
    if (fs.existsSync(MMA_FILE) && !fs.existsSync(META_FILE)) {
        try {
            const oldData = JSON.parse(fs.readFileSync(MMA_FILE, 'utf-8'));
            if (oldData.meridians && oldData.extra) {
                console.error('[MMA] 检测到旧格式 meridian_kg.json，自动迁移到分片...');
                migrateToShards(oldData);
                // 迁移成功后保留旧文件为备份
                const migratedBak = MMA_FILE.replace('.json', '.migrated.bak.json');
                fs.renameSync(MMA_FILE, migratedBak);
                console.error(`[MMA] 迁移完成，旧文件已备份为 ${path.basename(migratedBak)}`);
            }
        } catch (e) {
            console.error(`[MMA] 旧格式迁移失败: ${e.message}，将使用分片模式冷启动`);
        }
    }

    // 加载元数据
    const meta = loadShardWithRecovery(META_FILE, META_FILE.replace('.json', '.bak.json'), null);

    // 如果没有元数据(全新) → 冷启动
    if (!meta) {
        console.error('[MMA] 分片模式冷启动');
        return freshKG();
    }

    // 组装KG: 加载每条经脉的分片
    const kg = freshKG();
    kg.meta = meta;

    for (const key of Object.keys(TWELVE_MERIDIANS)) {
        const sp = shardPath(key);
        const bp = shardBakPath(key);
        const shard = loadShardWithRecovery(sp, bp, { points: [] });
        kg.meridians[key] = { ...structuredClone(TWELVE_MERIDIANS[key]), points: shard.points || [] };
    }
    for (const key of Object.keys(EIGHT_EXTRA_MERIDIANS)) {
        const sp = shardPath('_extra_' + key);
        const bp = shardBakPath('_extra_' + key);
        const shard = loadShardWithRecovery(sp, bp, { points: [] });
        kg.extra[key] = { ...structuredClone(EIGHT_EXTRA_MERIDIANS[key]), points: shard.points || [] };
    }

    return kg;
}

// ═══════════════════════════════════════════════════════════════
//  保存 — 只写入有变更的经脉分片
// ═══════════════════════════════════════════════════════════════

function saveMMA(kg) {
    ensureDirs();

    // 更新元数据
    kg.meta.total_points = Object.values(kg.meridians).reduce((s,m)=>s+m.points.length,0)
                         + Object.values(kg.extra).reduce((s,m)=>s+m.points.length,0);
    kg.meta.last_saved = new Date().toISOString();
    kg.meta.save_count = (kg.meta.save_count || 0) + 1;
    kg.meta.storage_mode = 'sharded';

    // 保存元数据
    atomicWriteShard(META_FILE, META_FILE.replace('.json', '.bak.json'), kg.meta);

    // 保存每条经脉(只保存points数组，模板结构在加载时合并)
    for (const key of Object.keys(TWELVE_MERIDIANS)) {
        const m = kg.meridians[key];
        if (m && m.points) {
            atomicWriteShard(shardPath(key), shardBakPath(key), { points: m.points });
        }
    }
    for (const key of Object.keys(EIGHT_EXTRA_MERIDIANS)) {
        const m = kg.extra[key];
        if (m && m.points) {
            atomicWriteShard(shardPath('_extra_' + key), shardBakPath('_extra_' + key), { points: m.points });
        }
    }

    // 定期快照
    if (kg.meta.save_count % SNAPSHOT_INTERVAL === 0) {
        takeSnapshot(kg);
    }
}

function takeSnapshot(kg) {
    const snapshotFile = path.join(ARCHIVE_DIR,
        `snapshot_${new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)}.json`);
    // 快照保存完整KG(方便恢复)
    const full = {
        meridians: {},
        extra: {},
        meta: kg.meta,
    };
    for (const key of Object.keys(kg.meridians)) {
        full.meridians[key] = { points: kg.meridians[key].points };
    }
    for (const key of Object.keys(kg.extra)) {
        full.extra[key] = { points: kg.extra[key].points };
    }
    fs.writeFileSync(snapshotFile, JSON.stringify(full, null, 2), 'utf-8');

    // 只保留最近5个快照
    const snapshots = fs.readdirSync(ARCHIVE_DIR)
        .filter(f => f.startsWith('snapshot_'))
        .sort().reverse();
    for (const old of snapshots.slice(5)) {
        fs.unlinkSync(path.join(ARCHIVE_DIR, old));
    }
}

// ═══════════════════════════════════════════════════════════════
//  旧格式 → 分片迁移
// ═══════════════════════════════════════════════════════════════

function migrateToShards(oldData) {
    ensureDirs();

    // 迁移元数据
    const meta = oldData.meta || { version: "2.0.0", algorithm: "MMA (Meridian Memory Algorithm)",
        created: new Date().toISOString(), total_points: 0, save_count: 0 };
    meta.storage_mode = 'sharded';
    meta.migrated_at = new Date().toISOString();
    atomicWriteShard(META_FILE, META_FILE.replace('.json', '.bak.json'), meta);

    // 迁移每条经脉
    for (const key of Object.keys(TWELVE_MERIDIANS)) {
        const m = oldData.meridians?.[key];
        atomicWriteShard(shardPath(key), shardBakPath(key),
            { points: m?.points || [] });
    }
    for (const key of Object.keys(EIGHT_EXTRA_MERIDIANS)) {
        const m = oldData.extra?.[key];
        atomicWriteShard(shardPath('_extra_' + key), shardBakPath('_extra_' + key),
            { points: m?.points || [] });
    }
}

// ═══════════════════════════════════════════════════════════════
//  冷启动
// ═══════════════════════════════════════════════════════════════

function freshKG() {
    return {
        meridians: structuredClone(TWELVE_MERIDIANS),
        extra: structuredClone(EIGHT_EXTRA_MERIDIANS),
        meta: { version: "2.0.0", algorithm: "MMA (Meridian Memory Algorithm)",
                storage_mode: 'sharded',
                created: new Date().toISOString(), total_points: 0, save_count: 0 }
    };
}

// ═══════════════════════════════════════════════════════════════
//  三焦工作记忆 (不变)
// ═══════════════════════════════════════════════════════════════

function loadWorkingMemory() {
    ensureDirs();
    if (!fs.existsSync(WORKING_MEMORY_FILE)) return { upper:[], middle:[], lower:[], last_meridian:null, last_meridian_ts:null };
    try { return JSON.parse(fs.readFileSync(WORKING_MEMORY_FILE, 'utf-8')); }
    catch(e) { return { upper:[], middle:[], lower:[], last_meridian:null, last_meridian_ts:null }; }
}

function saveWorkingMemory(wm) {
    ensureDirs();
    const tmpFile = WORKING_MEMORY_FILE.replace('.json', '.tmp.json');
    fs.writeFileSync(tmpFile, JSON.stringify(wm, null, 0), 'utf-8');
    fs.renameSync(tmpFile, WORKING_MEMORY_FILE);
}

// ═══════════════════════════════════════════════════════════════
//  通用穴位查找 (不变)
// ═══════════════════════════════════════════════════════════════

function findPointById(kg, pointId) {
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

module.exports = { ensureDirs, loadMMA, saveMMA, freshKG, loadWorkingMemory, saveWorkingMemory, findPointById };
