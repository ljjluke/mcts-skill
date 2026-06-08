#!/usr/bin/env node
/**
 * L-GCMS Knowledge Lifecycle Engine — Node.js wrapper.
 *
 * Delegates to the Python engine (knowledge_lifecycle.py) which contains
 * the full implementation: gate filtering, tiered storage, forgetting curve.
 *
 * Usage: node scripts/knowledge_lifecycle.js <command> [args...]
 */

const { spawnSync } = require('child_process');
const path = require('path');

const SCRIPT_DIR = __dirname;
const PY_ENGINE = path.join(SCRIPT_DIR, 'knowledge_lifecycle.py');

const COMMANDS = [
    'gate-check', 'memory-strength', 'determine-layer', 'minor-gc', 'major-gc',
    'full-maintenance', 'context-match', 'recall-archive', 'detect-errors',
    'compact', 'resonance',
];

function findPython() {
    const candidates = ['python3', 'python', 'py'];
    for (const cmd of candidates) {
        const result = spawnSync(cmd, ['--version'], { stdio: 'pipe', timeout: 5000 });
        if (result.status === 0) return cmd;
    }
    return null;
}

function main() {
    const args = process.argv.slice(2);

    if (args.length < 1 || args[0] === '--help' || args[0] === '-h') {
        console.log('L-GCMS Knowledge Lifecycle Engine (Node.js wrapper)');
        console.log('Usage: node scripts/knowledge_lifecycle.js <command> [args...]');
        console.log('Available commands:');
        COMMANDS.forEach(c => console.log(`  ${c}`));
        console.log('Delegates to Python engine. Python 3.x required.');
        process.exit(0);
    }

    const cmd = args[0];
    if (!COMMANDS.includes(cmd)) {
        console.error(`Unknown: ${cmd}. Available: ${COMMANDS.join(', ')}`);
        process.exit(1);
    }

    const python = findPython();
    if (!python) {
        console.error('ERROR: Python 3.x required. Install from https://python.org');
        process.exit(1);
    }

    const result = spawnSync(python, [PY_ENGINE, ...args], {
        stdio: 'inherit',
        timeout: 30000,
    });
    process.exit(result.status || 0);
}

main();