#!/usr/bin/env node
/** Unified CLI gateway for the live Ponder engines. */
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const { childProcessOptions } = require('./runtime-paths');

const ENGINES = {
  compute: { script: 'mcts_compute.js', desc: 'MCTS computation and decision engine' },
  l10n: { script: 'l10n.js', desc: 'Language adaptation' },
  knowledge: { script: 'knowledge.js', desc: 'Knowledge acquisition and storage' },
  profile: { script: 'mma/user_profile.js', desc: 'User profile management' },
};

function usage() {
  console.log('Ponder CLI — node scripts/mcts.js <engine> <command> [args...]');
  console.log('');
  for (const [name, config] of Object.entries(ENGINES)) {
    console.log(`  ${name.padEnd(10)} — ${config.desc}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    usage();
    return;
  }

  const engine = args[0];
  const config = ENGINES[engine];
  if (!config) {
    console.error(`Unknown engine: ${engine}`);
    console.error(`Available engines: ${Object.keys(ENGINES).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, config.script), ...args.slice(1)],
    childProcessOptions({ stdio: 'inherit' })
  );
  if (result.error) {
    console.error(`Failed to run ${engine}: ${result.error.message}`);
    process.exitCode = 1;
  } else if (result.status !== 0) {
    process.exitCode = result.status === null ? 1 : result.status;
  }
}

main();
