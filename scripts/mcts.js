#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════
 *  Ponder 统一CLI入口 (Unified CLI Gateway)
 *  "枢机之发，荣辱之主也" —《易经·系辞》
 * ═══════════════════════════════════════════════════════════════
 *
 *  一个命令入口管理所有子引擎:
 *    node scripts/mcts.js compute  → mcts_compute.js
 *    node scripts/mcts.js guard    → mcts_guard.js
 *    node scripts/mcts.js mma      → meridian_memory.js
 *    node scripts/mcts.js lang     → language_guard.js
 *    node scripts/mcts.js profile  → mma/user_profile.js
 *
 *  压缩恢复: 只需记住一个入口 `node scripts/mcts.js`
 *  用法: node scripts/mcts.js <engine> <command> [args...]
 */

const { spawnSync } = require('child_process');
const path = require('path');
const { childProcessOptions } = require('./runtime-paths');

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
                   'check-final-convergence','re-simulation-decide','identify-domain','check-learning-depth',
                   'five-diagnosis','hexagram-lookup',
                   'root-branch','absence-detect','tension-scan','dong-jing',
                   'mutation-vector','body-use-score','li-shi-split','yan-yi-check',
                   'one-many-check','ti-yong-check',
                   'get-learning-rate','get-reward-signal','get-terminal-value','project-state','mutation-tiebreak','falsification-check','step-gate','random-anchor','simulate','debate',
                   'predict-generate','predict-test','predict-propagate','fast-path-check',
                   'attention-gate'],
    },
    guard: {
        script: 'mcts_guard.js',
        desc: '合规守护 — 反唯一方案/阶段强制/信息优先级/方案多样性/自检/合规审计/约束/模式/玄学占卜增强/Phase详细规则',
        commands: ['decomposition-guard','phase-enforce','info-gap-guard','diversity-challenge',
                   'self-check-guard','compliance-report',
                   'constraint-checklist','engine-mode','phase-15-guard','all-guards',
                   'phase-rules','five-diagnosis-detail','diverge-detail',
                   'simulate-detail','converge-detail',
                   'horizon-scan-guard','simulate-layer-guard','blindspot-coverage-guard',
                   'force-search-guard','solution-count-guard'],
    },
    mma: {
        script: 'meridian_memory.js',
        desc: 'MMA经络记忆引擎 — 得气/阿是穴/补泻/子午流注/四象/八纲辨证/衰减/回放/集群',
        commands: ['deqi','ashi','reinforce','ziwu','status','four-images','diagnose',
                   'decay','replay','session-end','session-context','cluster','observe','load',
                   'audit','interact','capture-divergence',
                   'remember','recall','finalize'],
    },
    lang: {
        script: 'language_guard.js',
        desc: '语言守护 — 自动检测用户语言/验证输出语言',
        commands: ['detect','check'],
    },
    l10n: {
        script: 'l10n.js',
        desc: 'Language adaptation — detect user language, map operations to friendly descriptions',
        commands: [],
    },
    knowledge: {
        script: 'knowledge.js',
        desc: 'Unified data acquisition: MMA memory → WebSearch → store → classify',
        commands: ['status', 'acquire'],
    },
    uncertainty: {
        script: 'uncertainty.js',
        desc: '不确定性连续编码 — 歧义/风险/无知量化评估与路由',
        commands: ['assess', 'decide'],
    },
    template: {
        script: 'mcts_template.js',
        desc: '模板渲染 — Markdown格式化输出(Review Map/Portrait/Recon/MCTS Round/Decision Report等)',
        commands: ['review-map','portrait','recon-report','info-gap','mcts-round',
                   'mcts-final','self-check','decision-report','solution-list',
                   'constraint-list','dong-template','stream-flow','all-rules','hello-test','six-views','bagua-questions',
                   'interview-script','forbidden-check','translate-guide','depth-loop','pipeline-steps','output-format'],
    },
    profile: {
        script: 'mma/user_profile.js',
        desc: '用户画像 — 习惯/性格/沟通偏好 (不混入知识库)',
        commands: ['load','observe','infer','format-adjust','info'],
    },
    tree: {
        script: 'mcts_tree.js',
        desc: 'MCTS真实树结构 — init/select/add-children/simulate/backprop/status/save/load',
        commands: ['init','select','add-children','simulate','backprop','status','save','load','list','round-start'],
    },
};

function usage() {
    console.log("Ponder Unified CLI — node scripts/mcts.js <engine> <command> [args...]");
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
    console.log("  node scripts/mcts.js template review-map --data '<JSON>'");
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

    const result = spawnSync(
        'node',
        [scriptPath, ...restArgs],
        childProcessOptions({ stdio: 'inherit' })
    );

    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
}

main();
