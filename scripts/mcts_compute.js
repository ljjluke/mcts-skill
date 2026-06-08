#!/usr/bin/env node
/**
 * MCTS-TD Compute Engine — Node.js wrapper.
 *
 * Delegates numerical computation to the Python engine (mcts_compute.py)
 * which contains the full implementation (54 functions, 17 modules).
 *
 * If Python is not available, provides clear guidance.
 *
 * Usage: node scripts/mcts_compute.js <command> [args...]
 *
 * This wrapper exists so that:
 *   1. Users with Node.js (any Claude Code user) can run commands
 *   2. The Python engine remains the single source of truth
 *   3. No code duplication between Python and JS
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const SCRIPT_DIR = __dirname;
const PY_ENGINE = path.join(SCRIPT_DIR, 'mcts_compute.py');

// Commands available (matches mcts_compute.py CLI)
const COMMANDS = [
    'ucb', 'rank', 'converge', 'status-transition', 'rough-filter', 'welford',
    'k-bonus', 'classify-blindspot', 'get-activated-perspectives', 'should-write-kg',
    'check-write-safety', 'needs-re-eval', 'check-final-convergence', 'get-fuse-mode',
    'handle-self-check', 're-simulation-decide', 'trigger-check', 'get-lambda',
    'get-status-weight', 'enter-simulation', 'begin-sub-diverge', 'end-sub-diverge',
    'needs-sub-diverge', 'diverge-depth', 'reset-depth', 'synthesize-sim',
    'identify-domain', 'get-dimensions', 'get-recon-paths', 'get-perspectives',
    'check-learning-depth', 'cull', 'coverage-matrix', 'should-ask-user',
];

function findPython() {
    // Try common Python executable names
    const candidates = ['python3', 'python', 'py'];
    for (const cmd of candidates) {
        const result = spawnSync(cmd, ['--version'], {
            stdio: 'pipe',
            timeout: 5000
        });
        if (result.status === 0) {
            return cmd;
        }
    }
    return null;
}

function main() {
    const args = process.argv.slice(2);

    if (args.length < 1 || args[0] === '--help' || args[0] === '-h') {
        console.log('MCTS-TD Compute Engine (Node.js wrapper)');
        console.log('');
        console.log('Usage: node scripts/mcts_compute.js <command> [args...]');
        console.log('');
        console.log('Available commands:');
        COMMANDS.forEach(c => console.log(`  ${c}`));
        console.log('');
        console.log('This wrapper delegates to the Python engine (mcts_compute.py).');
        console.log('Python 3.x is required. Install from https://python.org');
        process.exit(0);
    }

    const cmd = args[0];
    if (!COMMANDS.includes(cmd)) {
        console.error(`Unknown command: ${cmd}`);
        console.error(`Available: ${COMMANDS.join(', ')}`);
        process.exit(1);
    }

    const python = findPython();
    if (!python) {
        console.error('ERROR: Python 3.x is required to run MCTS-TD computations.');
        console.error('Please install Python from https://python.org');
        console.error('');
        console.error('Alternative: Use the pure-JS standalone functions in:');
        console.error('  scripts/mcts_compute.js (JavaScript reference implementation)');
        console.error('  The JS version contains UCB, Welford, convergence, and ranking functions');
        console.error('  that can be imported directly: const mcts = require("./mcts_compute.js")');
        process.exit(1);
    }

    // Forward all arguments to Python engine
    const result = spawnSync(python, [PY_ENGINE, ...args], {
        stdio: 'inherit',
        timeout: 30000,
    });

    process.exit(result.status || 0);
}

main();