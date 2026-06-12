#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════
 *  MMA Memory Agent Daemon — 跟屁虫子Agent
 *  "左史记言，右史记事" —《礼记》
 *
 *  从 Claude 启动的那一刻就开始运行，全程监控。
 *  一个持续运行的进程，通过 hooks Setup 自动拉起。
 *
 *  工作方式:
 *  1. 作为后台进程运行，通过文件系统中转信息
 *  2. 每次用户对话时，通过 UserPromptSubmit hook 写入信息到
 *     ~/.claude/data/skills/mcts-td-planner/memory/agent_buffer.json
 *  3. 本 daemon 读取 buffer，自动执行 deqi/ashi/reinforce 等操作
 *  4. 结果写入 meridian_kg.json，静默完成
 *
 *  启动方式: node scripts/agent_daemon.js 2>/dev/null &
 *  停止方式: touch ~/.claude/data/skills/mcts-td-planner/memory/agent_daemon.stop
 *
 *  通过 hooks Setup 事件自动启动:
 *    hooks/hooks.json 中 Setup 事件执行本脚本
 * ═══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const os = require('os');

const DATA_DIR = path.join(os.homedir(), '.claude', 'data', 'skills', 'mcts-td-planner');
const MEMORY_DIR = path.join(DATA_DIR, 'memory');
const BUFFER_FILE = path.join(MEMORY_DIR, 'agent_buffer.json');
const STOP_FILE = path.join(MEMORY_DIR, 'agent_daemon.stop');
const SHARDS_DIR = path.join(MEMORY_DIR, 'shards');

// MMA 引擎路径（从插件缓存加载）
let MMA_SCRIPTS_DIR = null;

function findMMAScripts() {
    const candidates = [
        path.join(os.homedir(), '.claude', 'plugins', 'cache', 'mcts-td-planner', 'mcts-td-planner'),
    ];
    // 尝试找到最新的版本
    for (const base of candidates) {
        if (!fs.existsSync(base)) continue;
        const versions = fs.readdirSync(base).filter(d => /^\d+\.\d+\.\d+$/.test(d)).sort();
        if (versions.length > 0) {
            const scriptsDir = path.join(base, versions[versions.length - 1], 'scripts');
            if (fs.existsSync(scriptsDir)) {
                MMA_SCRIPTS_DIR = scriptsDir;
                return scriptsDir;
            }
        }
    }
    return null;
}

function loadMMA() {
    if (!MMA_SCRIPTS_DIR) return null;
    try {
        const io = require(path.join(MMA_SCRIPTS_DIR, 'mma', 'io'));
        return io;
    } catch (e) {
        console.error('[MMA Daemon] Failed to load MMA engine:', e.message);
        return null;
    }
}

// IO 模块缓存
let io = null, deqi = null, ashi = null, reinforce = null, decay = null;

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
        console.error('[MMA Daemon] Module load error:', e.message);
        return false;
    }
}

function ensureDirs() {
    [DATA_DIR, MEMORY_DIR, SHARDS_DIR].forEach(d => {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });
}

function processBuffer() {
    if (!fs.existsSync(BUFFER_FILE)) return;

    let buffer;
    try {
        buffer = JSON.parse(fs.readFileSync(BUFFER_FILE, 'utf-8'));
    } catch (e) { return; }

    if (!buffer || buffer.length === 0) return;

    const kg = io.loadMMA();
    if (!kg) return;

    const processed = [];

    for (const entry of buffer) {
        try {
            switch (entry.type) {
                case 'deqi': {
                    // 自动得气召回
                    const results = deqi.deqi(kg, entry.query || {}, entry.context || {});
                    processed.push({ type: 'deqi', count: results.length, top: results.slice(0, 3).map(r => r.point?.id) });
                    break;
                }
                case 'ashi': {
                    // 自动阿是穴插入（记录知识）
                    const result = ashi.ashiInsert(kg, entry.data || {});
                    if (result && !result.rejected) {
                        processed.push({ type: 'ashi', point_id: result.point?.id, meridian: result.meridian });
                    } else if (result && result.rejected) {
                        // 被质量门拒绝，静默忽略
                    }
                    break;
                }
                case 'reinforce': {
                    // 自动补泻更新
                    const r = reinforce.reinforceReduce(kg, entry.point_id, entry.td_error || 0, entry.experience || {});
                    if (r) processed.push({ type: 'reinforce', point_id: entry.point_id, technique: r.technique });
                    break;
                }
                case 'session_end': {
                    // 会话结束鞏固
                    decay.decayCheck(kg);
                    processed.push({ type: 'session_end' });
                    break;
                }
            }
        } catch (e) {
            processed.push({ type: entry.type, error: e.message });
        }
    }

    // 保存知识图谱
    io.saveMMA(kg);

    // 写入处理结果
    const resultFile = path.join(MEMORY_DIR, 'agent_result.json');
    fs.writeFileSync(resultFile, JSON.stringify({
        processed_at: new Date().toISOString(),
        processed: processed.length,
        details: processed,
    }, null, 2));

    // 清空 buffer（只保留最后处理时间标记）
    fs.writeFileSync(BUFFER_FILE, JSON.stringify({ last_processed: new Date().toISOString(), pending: [] }));
}

// 写入信息到 buffer（供 UserPromptSubmit hook 调用）
function writeToBuffer(type, data) {
    ensureDirs();
    let buffer = { last_processed: null, pending: [] };
    if (fs.existsSync(BUFFER_FILE)) {
        try { buffer = JSON.parse(fs.readFileSync(BUFFER_FILE, 'utf-8')); } catch (e) {}
    }
    buffer.pending.push({
        type,
        data,
        timestamp: new Date().toISOString(),
    });
    fs.writeFileSync(BUFFER_FILE, JSON.stringify(buffer, null, 2));
}

// === CLI: 支持直接调用写入 ===
if (require.main === module) {
    const args = process.argv.slice(2);
    const cmd = args[0];

    if (cmd === 'start') {
        // 启动守护进程
        console.log('[MMA Daemon] Starting...');
        ensureDirs();

        if (!findMMAScripts()) {
            console.error('[MMA Daemon] Cannot find MMA engine scripts');
            process.exit(1);
        }

        if (!loadModules()) {
            console.error('[MMA Daemon] Cannot load MMA modules');
            process.exit(1);
        }

        // 移除可能残留的 stop 文件
        if (fs.existsSync(STOP_FILE)) fs.unlinkSync(STOP_FILE);

        let lastCheck = null;

        const loop = () => {
            // 检查停止信号
            if (fs.existsSync(STOP_FILE)) {
                console.log('[MMA Daemon] Stop signal received, exiting');
                process.exit(0);
            }

            try {
                processBuffer();
            } catch (e) {
                // 静默错误，不要崩溃
            }

            setTimeout(loop, 2000); // 每 2 秒检查一次
        };

        loop();
    } else if (cmd === 'write') {
        // 写入 buffer（由 hooks 调用）
        const type = args[1];
        let data = {};
        try { data = JSON.parse(args[2] || '{}'); } catch (e) {}
        writeToBuffer(type, data);
        console.log('OK');
    } else if (cmd === 'stop') {
        // 发送停止信号
        fs.writeFileSync(STOP_FILE, new Date().toISOString());
        console.log('Stop signal sent');
    } else if (cmd === 'status') {
        // 查看 daemon 状态
        const running = !fs.existsSync(STOP_FILE);
        console.log(JSON.stringify({
            running,
            scripts_dir: MMA_SCRIPTS_DIR,
            buffer_exists: fs.existsSync(BUFFER_FILE),
            memory_dir: MEMORY_DIR,
        }, null, 2));
    } else {
        console.log('MMA Memory Agent Daemon');
        console.log('Usage:');
        console.log('  node agent_daemon.js start       — 启动守护进程');
        console.log('  node agent_daemon.js write <type> [json]  — 写入buffer');
        console.log('  node agent_daemon.js stop        — 停止');
        console.log('  node agent_daemon.js status      — 状态');
    }
}

module.exports = { writeToBuffer };
