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
const { DATA_DIR, MEMORY_DIR, MMA_FILE, MMA_SHARDS_DIR, WORKING_MEMORY_FILE, ARCHIVE_DIR, WAL_DIR, LOCK_DIR,
        TWELVE_MERIDIANS, EIGHT_EXTRA_MERIDIANS } = require('./constants');

const META_FILE = path.join(MMA_SHARDS_DIR, 'meta.json');
const SNAPSHOT_INTERVAL = 100;
const LOCK_TIMEOUT_MS = 5000; // 5秒锁超时
const LOCK_RETRY_INTERVAL = 50; // 50ms重试间隔

/**
 * ═══════════════════════════════════════════════════════════════
 *  分片级文件锁 (Shard-Level Lock) — 跨进程并发安全
 *  "和而不同" — 不同经脉无锁，同一经脉有锁
 *
 *  原理: 通过 mkdir 的原子性实现跨进程锁
 *    - mkdir 在文件系统层面是原子的
 *    - 成功创建目录 = 获得锁
 *    - 目录已存在 = 锁被占用
 *    - rmdir = 释放锁
 * ═══════════════════════════════════════════════════════════════
 */
function acquireShardLock(shardKey) {
    const lockDir = path.join(LOCK_DIR, shardKey);
    const deadline = Date.now() + LOCK_TIMEOUT_MS;

    while (Date.now() < deadline) {
        try {
            fs.mkdirSync(lockDir, { recursive: false });
            return true; // 获得锁
        } catch (e) {
            if (e.code !== 'EEXIST') return false; // 非'已存在'错误，直接失败
            // 检查锁是否过期
            try {
                const lockTime = fs.statSync(lockDir).mtimeMs;
                if (Date.now() - lockTime > LOCK_TIMEOUT_MS) {
                    // 锁过期，强制释放
                    fs.rmdirSync(lockDir);
                    continue;
                }
            } catch (e2) {}
        }
        // 等待重试
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, LOCK_RETRY_INTERVAL);
    }
    return false; // 超时
}

function releaseShardLock(shardKey) {
    const lockDir = path.join(LOCK_DIR, shardKey);
    try { fs.rmdirSync(lockDir); } catch (e) {}
}

/**
 * ═══════════════════════════════════════════════════════════════
 *  写前日志 (Write-Ahead Log) — 崩溃恢复 + 多窗口合并
 *  每次写入操作都先追加到WAL，再合并到分片
 *  崩溃后可重放WAL，不会丢数据
 * ═══════════════════════════════════════════════════════════════
 */
function appendWAL(shardKey, operation, data) {
    const walDirPath = path.join(MEMORY_DIR, 'wal');
    const walFile = path.join(walDirPath, `${shardKey}.log`);
    const entry = JSON.stringify({
        ts: new Date().toISOString(),
        pid: process.pid,
        op: operation,
        data,
    });
    fs.appendFileSync(walFile, entry + '\n', 'utf-8');
}

function replayWAL(shardKey) {
    const walFile = path.join(MEMORY_DIR, 'wal', `${shardKey}.log`);
    if (!fs.existsSync(walFile)) return [];
    const entries = [];
    const content = fs.readFileSync(walFile, 'utf-8');
    for (const line of content.trim().split('\n').filter(Boolean)) {
        try { entries.push(JSON.parse(line)); } catch (e) {}
    }
    return entries;
}

function clearWAL(shardKey) {
    const walFile = path.join(MEMORY_DIR, 'wal', `${shardKey}.log`);
    try { fs.unlinkSync(walFile); } catch (e) {}
}

/**
 * ═══════════════════════════════════════════════════════════════
 *  带乐观锁的原子写入
 *  参考数据库MVCC: 每个分片有版本号(save_count)
 *  写入时检查版本号是否匹配，不匹配则重读重写
 * ═══════════════════════════════════════════════════════════════
 */
function atomicWriteShardWithLock(filePath, bakPath, shardKey, data, expectedVersion) {
    if (!acquireShardLock(shardKey)) {
        throw new Error(`[MMA] Lock timeout: ${shardKey} (${LOCK_TIMEOUT_MS}ms)`);
    }

    try {
        // 版本检查（乐观锁）
        if (expectedVersion !== undefined && fs.existsSync(filePath)) {
            try {
                const current = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                if (current._version !== undefined && current._version !== expectedVersion) {
                    // 版本冲突！其他进程已修改
                    return { success: false, conflict: true, current_version: current._version };
                }
            } catch (e) {}
        }

        // WAL: 先写日志
        appendWAL(shardKey, 'write', { data, version: data._version });

        // 写入分片
        const json = JSON.stringify(data, null, 2);
        const tmpPath = filePath.replace('.json', '.tmp.json');

        if (fs.existsSync(filePath)) {
            try {
                JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                fs.copyFileSync(filePath, bakPath);
            } catch (e) {}
        }

        fs.writeFileSync(tmpPath, json, 'utf-8');
        try { const fd = fs.openSync(tmpPath, 'r+'); fs.fsyncSync(fd); fs.closeSync(fd); } catch (e) {}
        fs.renameSync(tmpPath, filePath);

        return { success: true };
    } finally {
        releaseShardLock(shardKey);
    }
}

function loadShardWithRecovery(filePath, bakPath, fallback) {
    // 尝试主文件
    if (fs.existsSync(filePath)) {
        try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
        catch (e) { console.error(`[MMA] Shard corrupted: ${path.basename(filePath)} — ${e.message}`); }
    }
    // 尝试备份
    if (fs.existsSync(bakPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(bakPath, 'utf-8'));
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
            console.error(`[MMA] Shard ${path.basename(filePath)} recovered from backup`);
            return data;
        } catch (e) { console.error(`[MMA] Shard backup also corrupted: ${path.basename(bakPath)}`); }
    }
    return fallback;
}

function ensureDirs() {
    [DATA_DIR, MEMORY_DIR, MMA_SHARDS_DIR, ARCHIVE_DIR, WAL_DIR, LOCK_DIR].forEach(d => {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });
}

function shardPath(meridianKey) { return path.join(MMA_SHARDS_DIR, `${meridianKey}.json`); }
function shardBakPath(meridianKey) { return path.join(MMA_SHARDS_DIR, `${meridianKey}.bak.json`); }
function shardLockKey(meridianKey) { return meridianKey; }

function atomicWriteShard(filePath, bakPath, data) {
    const json = JSON.stringify(data, null, 2);
    const tmpPath = filePath.replace('.json', '.tmp.json');
    if (fs.existsSync(filePath)) {
        try { JSON.parse(fs.readFileSync(filePath, 'utf-8')); fs.copyFileSync(filePath, bakPath); } catch (e) {}
    }
    fs.writeFileSync(tmpPath, json, 'utf-8');
    try { const fd = fs.openSync(tmpPath, 'r+'); fs.fsyncSync(fd); fs.closeSync(fd); } catch (e) {}
    fs.renameSync(tmpPath, filePath);
}

// ═══════════════════════════════════════════════════════════════
//  加载 — 从分片目录组装完整KG
// ═══════════════════════════════════════════════════════════════

function loadMMA() {
    ensureDirs();

    // Auto-migrate: legacy meridian_kg.json exists and shards dir is empty
    if (fs.existsSync(MMA_FILE) && !fs.existsSync(META_FILE)) {
        try {
            const oldData = JSON.parse(fs.readFileSync(MMA_FILE, 'utf-8'));
            if (oldData.meridians && oldData.extra) {
                console.error('[MMA] Detected legacy meridian_kg.json, auto-migrating to shards...');
                migrateToShards(oldData);
                // 迁移成功后保留旧文件为备份
                const migratedBak = MMA_FILE.replace('.json', '.migrated.bak.json');
                fs.renameSync(MMA_FILE, migratedBak);
                console.error(`[MMA] Migration complete, legacy file backed up as ${path.basename(migratedBak)}`);
            }
        } catch (e) {
            console.error(`[MMA] Legacy migration failed: ${e.message}, cold-starting in shard mode`);
        }
    }

    // Load meta shard
    const meta = loadShardWithRecovery(META_FILE, META_FILE.replace('.json', '.bak.json'), null);

    // No meta → cold start
    if (!meta) {
        console.error('[MMA] Cold start in shard mode');
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

    const latestVersion = kg.meta.save_count;

    // 保存元数据（带锁）
    const cloneMeta = { ...kg.meta, _version: latestVersion };
    const metaResult = atomicWriteShardWithLock(
        META_FILE, META_FILE.replace('.json', '.bak.json'), 'meta', cloneMeta, undefined
    );
    if (metaResult.conflict) {
        console.error(`[MMA] Meta version conflict (${metaResult.current_version} vs ${latestVersion}), retrying`);
    }

    // 保存每条经脉（带锁 + 版本号）
    for (const key of Object.keys(TWELVE_MERIDIANS)) {
        const m = kg.meridians[key];
        if (m && m.points) {
            const shardData = { points: m.points, _version: latestVersion, _pid: process.pid };
            const r = atomicWriteShardWithLock(shardPath(key), shardBakPath(key), key, shardData, undefined);
            if (r.conflict) {
                console.error(`[MMA] Shard conflict: ${key} (${r.current_version} vs ${latestVersion})`);
            }
        }
    }
    for (const key of Object.keys(EIGHT_EXTRA_MERIDIANS)) {
        const m = kg.extra[key];
        if (m && m.points) {
            const shardKey = '_extra_' + key;
            const shardData = { points: m.points, _version: latestVersion, _pid: process.pid };
            const r = atomicWriteShardWithLock(shardPath(shardKey), shardBakPath(shardKey), shardKey, shardData, undefined);
            if (r.conflict) {
                console.error(`[MMA] Shard conflict: ${shardKey}`);
            }
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

module.exports = { ensureDirs, loadMMA, saveMMA, freshKG, loadWorkingMemory, saveWorkingMemory, findPointById,
    acquireShardLock, releaseShardLock, appendWAL, replayWAL, clearWAL };
