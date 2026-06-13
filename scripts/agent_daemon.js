#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════
 *  MMA Memory Agent Daemon — 全程跟随后台进程
 *  "左史记言，右史记事" —《礼记》
 *
 *  零配置、零端口、零依赖。通过 hooks Setup 自动启动。
 *  通过文件系统 buffer 与主进程通信，不消耗任何端口。
 *
 *  质量控制:
 *  1. 指纹去重 — 相同 description 不重复写入
 *  2. LRU 缓存 — 已处理的知识不重复处理
 *  3. 质量门 — ashi.js 内置的 quality gate 过滤噪音
 *  4. 召回控制 — deqi 只对有实际上下文的请求响应
 * ═══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const DATA_DIR = path.join(os.homedir(), '.claude', 'data', 'skills', 'mcts-td-planner');
const MEMORY_DIR = path.join(DATA_DIR, 'memory');
const BUFFER_FILE = path.join(MEMORY_DIR, 'agent_buffer.json');
const STOP_FILE = path.join(MEMORY_DIR, 'agent_daemon.stop');
const CACHE_FILE = path.join(MEMORY_DIR, 'agent_cache.json');

const POLL_INTERVAL = 2000; // 2秒轮询
const CACHE_MAX = 1000; // LRU缓存上限
const BATCH_MAX = 20; // 单次处理上限

let MMA_SCRIPTS_DIR = null;
let io = null, deqi = null, ashi = null, reinforce = null, decay = null;
let kg = null; // 内存中的知识图谱缓存
let kgVersion = 0;
let fingerprintCache = []; // LRU指纹缓存

// ═══════════════════════════════════════════════════════════════
//  初始化
// ═══════════════════════════════════════════════════════════════

function findMMAScripts() {
    const cacheBase = path.join(os.homedir(), '.claude', 'plugins', 'cache');
    const candidates = ['luke', 'mcts', 'mcts-td-planner'];
    for (const name of candidates) {
        const base = path.join(cacheBase, name, name);
        if (!fs.existsSync(base)) continue;
        const versions = fs.readdirSync(base).filter(d => /^\d+\.\d+\.\d+$/.test(d)).sort();
        for (const v of versions.reverse()) {
            const d = path.join(base, v, 'scripts');
            if (fs.existsSync(d)) return d;
        }
    }
    return null;
}

function loadModules() {
    if (!MMA_SCRIPTS_DIR) return false;
    try {
        io = require(path.join(MMA_SCRIPTS_DIR, 'mma', 'io'));
        deqi = require(path.join(MMA_SCRIPTS_DIR, 'mma', 'deqi'));
        ashi = require(path.join(MMA_SCRIPTS_DIR, 'mma', 'ashi'));
        reinforce = require(path.join(MMA_SCRIPTS_DIR, 'mma', 'reinforce'));
        decay = require(path.join(MMA_SCRIPTS_DIR, 'mma', 'decay'));
        return true;
    } catch (e) {
        console.error('[MMA Daemon] Load error:', e.message);
        return false;
    }
}

function init() {
    MMA_SCRIPTS_DIR = findMMAScripts();
    if (!MMA_SCRIPTS_DIR) return false;
    return loadModules();
}

// ═══════════════════════════════════════════════════════════════
//  LRU 指纹缓存 — 防重复
// ═══════════════════════════════════════════════════════════════

function computeFingerprint(entry) {
    const content = entry.description || entry.data?.description || JSON.stringify(entry);
    return crypto.createHash('md5').update(content.substring(0, 200)).digest('hex');
}

function isDuplicate(fp) {
    return fingerprintCache.includes(fp);
}

function addFingerprint(fp) {
    fingerprintCache.unshift(fp);
    if (fingerprintCache.length > CACHE_MAX) fingerprintCache.pop();
}

function loadFingerprintCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            fingerprintCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
            if (!Array.isArray(fingerprintCache)) fingerprintCache = [];
        }
    } catch (e) { fingerprintCache = []; }
}

function saveFingerprintCache() {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(fingerprintCache.slice(0, CACHE_MAX)));
    } catch (e) {}
}

// ═══════════════════════════════════════════════════════════════
//  缓存加载KG（避免频繁读文件）
// ═══════════════════════════════════════════════════════════════

function ensureKG() {
    const metaFile = path.join(MEMORY_DIR, 'shards', 'meta.json');
    let currentVer = 0;
    try {
        if (fs.existsSync(metaFile)) {
            currentVer = JSON.parse(fs.readFileSync(metaFile, 'utf-8')).save_count || 0;
        }
    } catch (e) {}
    if (!kg || currentVer !== kgVersion) {
        kg = io.loadMMA();
        kgVersion = currentVer;
    }
    return kg;
}

// ═══════════════════════════════════════════════════════════════
//  Buffer 处理核心
// ═══════════════════════════════════════════════════════════════

function processBuffer() {
    if (!fs.existsSync(BUFFER_FILE)) return;

    let buffer;
    try { buffer = JSON.parse(fs.readFileSync(BUFFER_FILE, 'utf-8')); }
    catch (e) { return; }

    const pending = buffer.pending || [];
    if (pending.length === 0) return;

    const kg = ensureKG();
    if (!kg) return;

    // 合并同类操作: 多个 deqi 只执行最新一次
    const merged = new Map();
    for (const entry of pending) {
        merged.set(entry.type + '_last', entry);
        if (entry.type === 'ashi') {
            const fp = computeFingerprint(entry);
            if (!isDuplicate(fp)) {
                if (!merged.has('ashi_items')) merged.set('ashi_items', []);
                merged.get('ashi_items').push(entry);
                addFingerprint(fp);
            }
        }
    }

    const results = [];

    // 1. deqi — 只执行最新一次
    const lastDeqi = merged.get('deqi_last');
    if (lastDeqi) {
        try {
            const ctx = lastDeqi.data?.context || {};
            // 只在有任务类型或标签时才召回，避免空召回
            if (ctx.current_task_type || ctx.tags) {
                const query = { tags: ctx.tags || [], category: ctx.category || '', limit: 5 };
                const res = deqi.deqi(kg, query, ctx);
                results.push({ type: 'deqi', count: res.length });
            }
        } catch (e) {}
    }

    // 2. ashi — 写入新知识（已去重）+ 教学相长
    const ashiItems = merged.get('ashi_items') || [];
    let insertedCount = 0;
    const insertedPoints = [];
    for (const entry of ashiItems.slice(0, BATCH_MAX)) {
        try {
            const data = entry.data || {};
            // 质量门: ashiInsert 内部已有 assessQuality
            const result = ashi.ashiInsert(kg, data);
            if (result && !result.rejected) {
                insertedCount++;
                insertedPoints.push(result);
            }
        } catch (e) {}
    }
    if (insertedCount > 0) results.push({ type: 'ashi', count: insertedCount });

    // 教学相长: 新知识关联旧知识（温故知新）
    for (const ins of insertedPoints) {
        try {
            const newPoint = ins.point;
            const newTags = newPoint.tags || [];
            if (newTags.length === 0) continue;

            // 用新知识的 tags 做一次召回
            const teachQuery = { tags: newTags, category: newPoint.category || '', limit: 10 };
            const related = deqi.deqi(kg, teachQuery, {});

            for (const rel of related) {
                if (!rel.point || rel.point.id === newPoint.id) continue;

                // 计算关联度: tags 重叠率
                const relTags = rel.point.tags || [];
                const overlap = newTags.filter(t => relTags.includes(t)).length;
                const similarity = overlap / Math.max(newTags.length, 1);

                if (similarity >= 0.8) {
                    // 高度关联 → 阴阳对冲检测 (切磋琢磨)
                    const newV = newPoint.q || 0.5;
                    const oldV = rel.point.q || 0.5;
                    if (Math.abs(newV - oldV) > 0.4) {
                        // 观点相反 → DISPUTED
                        rel.point.status = 'DISPUTED';
                        rel.point.conflict_with = newPoint.id;
                        rel.point.conflict_reason = `切磋琢磨: tags重叠${Math.round(similarity*100)}%, V差${Math.abs(newV-oldV).toFixed(2)}`;
                    } else {
                        // 观点一致 → 建立关联
                        newPoint.related_points = newPoint.related_points || [];
                        if (!newPoint.related_points.find(r => r.id === rel.point.id)) {
                            newPoint.related_points.push({ id: rel.point.id, relation: 'teaching_learning', similarity });
                        }
                        rel.point.related_points = rel.point.related_points || [];
                        if (!rel.point.related_points.find(r => r.id === newPoint.id)) {
                            rel.point.related_points.push({ id: newPoint.id, relation: 'teaching_learning', similarity });
                        }
                    }
                } else if (similarity >= 0.6) {
                    // 中等关联 → 建立轻度关联
                    newPoint.related_points = newPoint.related_points || [];
                    if (!newPoint.related_points.find(r => r.id === rel.point.id)) {
                        newPoint.related_points.push({ id: rel.point.id, relation: 'related', similarity });
                    }
                }
            }
            results.push({ type: 'teaching', point_id: newPoint.id, connected: related.length });
        } catch (e) {}
    }

    // 3. session_end
    if (merged.has('session_end_last')) {
        try {
            decay.decayCheck(kg);
            results.push({ type: 'session_end' });
        } catch (e) {}
    }

    // 批量保存
    if (results.length > 0) {
        io.saveMMA(kg);
        saveFingerprintCache();
    }

    // 清理 buffer — 只保留运行标记
    fs.writeFileSync(BUFFER_FILE, JSON.stringify({
        last_processed: new Date().toISOString(),
        daemon_pid: process.pid,
        pending: [],
    }));
}

// ═══════════════════════════════════════════════════════════════
//  Daemon 主循环
// ═══════════════════════════════════════════════════════════════

function start() {
    if (!init()) {
        console.error('[MMA Daemon] Init failed');
        process.exit(1);
    }
    io.ensureDirs();
    loadFingerprintCache();
    if (fs.existsSync(STOP_FILE)) fs.unlinkSync(STOP_FILE);

    const loop = () => {
        if (fs.existsSync(STOP_FILE)) { process.exit(0); }
        try { processBuffer(); } catch (e) {}
        setTimeout(loop, POLL_INTERVAL);
    };
    loop();
}

// ═══════════════════════════════════════════════════════════════
//  CLI / 公开接口
// ═══════════════════════════════════════════════════════════════

function writeToBuffer(type, data) {
    const memDir = MEMORY_DIR;
    if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true });
    let buf = { pending: [] };
    if (fs.existsSync(BUFFER_FILE)) {
        try { buf = JSON.parse(fs.readFileSync(BUFFER_FILE, 'utf-8')); } catch (e) {}
    }
    buf.pending = buf.pending || [];
    buf.pending.push({ type, data, ts: Date.now() });
    if (buf.pending.length > 200) buf.pending = buf.pending.slice(-200);
    fs.writeFileSync(BUFFER_FILE, JSON.stringify(buf));
}

if (require.main === module) {
    const cmd = process.argv[2];
    if (cmd === 'start') { start(); }
    else if (cmd === 'write') {
        const type = process.argv[3] || 'ashi';
        let data = {};
        try { data = JSON.parse(process.argv[4] || '{}'); } catch (e) {}
        writeToBuffer(type, data);
        console.log('OK');
    }
    else if (cmd === 'stop') {
        fs.writeFileSync(STOP_FILE, new Date().toISOString());
        console.log('Stopped');
    }
    else {
        console.log('MMA Agent Daemon — node agent_daemon.js [start|write|stop]');
    }
}

module.exports = { writeToBuffer };
