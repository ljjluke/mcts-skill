#!/usr/bin/env node
/** Unified non-blocking Setup / SessionStart / SessionEnd hook entrypoint. */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { pluginRoot, childProcessOptions } = require('../../scripts/runtime-paths');

function childOptions(extra = {}) {
  return childProcessOptions(extra);
}

function reportError(action, error) {
  console.error(`[Cognitive Core] ${action} failed: ${error.message}`);
}

// Keep agent-reach registration/installation delegated to its dedicated script.
function ensureAgentReach(pluginDir, tryInstall) {
  const script = path.join(pluginDir, 'hooks', 'scripts', 'ensure-agent-reach.js');
  if (!fs.existsSync(script)) return;
  const args = tryInstall ? [script, '--try-install'] : [script];
  try {
    const result = spawnSync('node', args, childOptions({
      stdio: 'inherit',
      timeout: tryInstall ? 180000 : 20000,
    }));
    if (result.error) reportError('agent-reach check', result.error);
    else if (result.status !== 0) console.error(`[Cognitive Core] agent-reach check exited with status ${result.status}`);
  } catch (error) {
    reportError('agent-reach check', error);
  }
}

function initializeMemory() {
  const { migrate } = require('../../scripts/mma/migrate-to-simple');
  const io = require('../../scripts/mma/simple-io');
  const migration = migrate();
  const stores = io.loadAll();
  const counts = Object.fromEntries(
    Object.entries(stores).map(([name, data]) => [name, Array.isArray(data.points) ? data.points.length : 0])
  );
  return { migration, counts, total: Object.values(counts).reduce((sum, count) => sum + count, 0) };
}

function printMemoryStatus(state) {
  const { philosophy, knowledge, step_history: stepHistory } = state.counts;
  console.log(`[Cognitive Core] Memory: ${state.total} points (philosophy ${philosophy}, knowledge ${knowledge}, step history ${stepHistory})`);
  if (state.migration.migrated > 0) {
    console.log(`[Cognitive Core] Migrated ${state.migration.migrated} legacy points`);
  }
}

function setup() {
  try {
    printMemoryStatus(initializeMemory());
    console.log('[Cognitive Core] Ready');
  } catch (error) {
    reportError('memory setup', error);
  }
  ensureAgentReach(pluginRoot, true);
}

function sessionStart() {
  console.log('[PONDER] Plugin: ' + pluginRoot.replaceAll(path.sep, '/').replace(/^([A-Za-z]):\//, '/$1/'));
  try {
    printMemoryStatus(initializeMemory());
    console.log('[Cognitive Core] Ready');
  } catch (error) {
    reportError('memory startup', error);
  }
  ensureAgentReach(pluginRoot, false);
}

function sessionEnd() {
  try {
    const { groomAll } = require('../../scripts/mma/simple-lifecycle');
    const result = groomAll();
    const actionCount = Object.values(result).reduce(
      (sum, actions) => sum + (Array.isArray(actions) ? actions.length : 0),
      0
    );
    console.log(`[Cognitive Core] Memory groomed: ${actionCount} actions`);
  } catch (error) {
    reportError('memory grooming', error);
  }
}

const commands = {
  setup,
  'session-start': sessionStart,
  'session-end': sessionEnd,
};

const command = commands[process.argv[2]];
if (!command) {
  console.error(`Unknown hook command: ${process.argv[2] || '(missing)'}`);
  process.exitCode = 1;
} else {
  try {
    command();
  } catch (error) {
    reportError('hook', error);
  }
}
