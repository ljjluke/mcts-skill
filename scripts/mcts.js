#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════
 *  MCTS-TD 统一CLI入口 (Unified CLI Gateway)
 *  "枢机之发，荣辱之主也" —《易经·系辞》
 * ═══════════════════════════════════════════════════════════════
 *
 *  一个命令入口管理所有子引擎:
 *    node scripts/mcts.js compute  → mcts_compute.js
 *    node scripts/mcts.js guard    → mcts_guard.js
 *    node scripts/mcts.js mma      → meridian_memory.js
 *    node scripts/mcts.js lang     → language_guard.js
 *    node scripts/mcts.js memory   → manage_memory.js
 *    node scripts/mcts.js lifecycle → knowledge_lifecycle.js (legacy)
 *
 *  压缩恢复: 只需记住一个入口 `node scripts/mcts.js`
 *  用法: node scripts/mcts.js <engine> <command> [args...]
 */

const { spawnSync } = require('child_process');
const path = require('path');

const ENGINES = {
    compute: {
        script: 'mcts_compute.js',
        desc: 'MCTS数学引擎 — UCB/rank/converge/state/cull/coverage',
        commands: ['ucb','rank','converge','status-transition','k-bonus','classify-blindspot',
                   'get-fuse-mode','handle-self-check','get-lambda','get-status-weight',
                   'trigger-check','get-dimensions','enter-simulation','begin-sub-diverge',
                   'end-sub-diverge','reset-depth','diverge-depth','should-ask-user',
                   'cull','coverage-matrix','adaptive-c','shi-maturity','info-gap-scan',
                   'needs-sub-diverge','synthesize-sim','should-write-kg','check-write-safety',
                   'check-final-convergence','re-simulation-decide','identify-domain','check-learning-depth'],
    },
    guard: {
        script: 'mcts_guard.js',
        desc: '合规守护 — 反唯一方案/阶段强制/信息优先级/方案多样性/自检/MemoryAgent/合规审计/约束/模式',
        commands: ['decomposition-guard','phase-enforce','info-gap-guard','diversity-challenge',
                   'self-check-guard','memory-agent-guard','compliance-report',
                   'constraint-checklist','engine-mode','phase-15-guard','all-guards'],
    },
    mma: {
        script: 'meridian_memory.js',
        desc: 'MMA经络记忆引擎 — 得气/阿是穴/补泻/子午流注/四象/八纲辨证/衰减/回放/集群',
        commands: ['deqi','ashi','reinforce','ziwu','status','four-images','diagnose',
                   'decay','replay','session-end','cluster','observe','load'],
    },
    lang: {
        script: 'language_guard.js',
        desc: '语言守护 — 自动检测用户语言/验证输出语言',
        commands: ['detect','check'],
    },
    memory: {
        script: 'manage_memory.js',
        desc: '记忆文件管理(legacy) — 状态/归档/清理',
        commands: ['status','archive','cleanup'],
    },
};

function usage() {
    console.log("MCTS-TD Unified CLI — node scripts/mcts.js <engine> <command> [args...]");
    console.log("");
    for (const [name, cfg] of Object.entries(ENGINES)) {
        console.log(`  ${name.padEnd(10)} — ${cfg.desc}`);
    }
    console.log("");
    console.log("Examples:");
    console.log("  node scripts/mcts.js compute ucb --v 0.8 --n 3 --parent-n 10");
    console.log("  node scripts/mcts.js guard decomposition-guard --claim '{\"task\":\"login\"}'");
    console.log("  node scripts/mcts.js mma deqi '{\"category\":\"debug\"}'");
    console.log("  node scripts/mcts.js lang detect --message 'Hello'");
    console.log("");
    console.log("Tip: Forget which sub-commands? Just type the engine name:");
    console.log("  node scripts/mcts.js mma      → lists all MMA commands");
}

function main() {
    const args = process.argv.slice(2);
    if (args.length < 1) { usage(); process.exit(0); }

    const engine = args[0];
    if (engine === '--help' || engine === '-h') { usage(); process.exit(0); }

    const cfg = ENGINES[engine];
    if (!cfg) {
        console.error(`Unknown engine: ${engine}`);
        console.error(`Available: ${Object.keys(ENGINES).join(', ')}`);
        process.exit(1);
    }

    const scriptPath = path.join(__dirname, cfg.script);
    const restArgs = args.slice(1);

    const result = spawnSync('node', [scriptPath, ...restArgs], {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..'),
    });

    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
}

main();
