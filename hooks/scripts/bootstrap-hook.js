#!/usr/bin/env node
/**
 * bootstrap-hook.js — hooks.json 的统一入口。
 *
 * SessionStart / Setup / SessionEnd 钩子都从这里进，避免在 hooks.json 里
 * 维护多份又长又难调试的 node -e 字符串。
 *
 * 用法:
 *   node bootstrap-hook.js session-start   # 会话启动：加载记忆 + 启动 monitor + 检查 agent-reach(不装包)
 *   node bootstrap-hook.js setup           # 插件安装/升级：检查 agent-reach 并尝试安装
 *   node bootstrap-hook.js session-end     # 会话结束：衰减记忆 + 清理 monitor
 *
 * 任何异常都静默吞掉，绝不抛出阻塞会话。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');
const { pluginRoot, childProcessOptions } = require('../../scripts/runtime-paths');

function childOptions(extra = {}) {
  return childProcessOptions(extra);
}

function findPluginDir() {
  return pluginRoot;
}

// —— agent-reach 检查/注册/安装（委托给 ensure-agent-reach.js）——
function ensureAgentReach(pluginDir, tryInstall) {
  const script = path.join(pluginDir, 'hooks', 'scripts', 'ensure-agent-reach.js');
  if (!fs.existsSync(script)) return;
  const args = tryInstall ? [script, '--try-install'] : [script];
  try {
    spawnSync('node', args, childOptions({ stdio: 'inherit', timeout: tryInstall ? 180000 : 20000 }));
  } catch (e) { /* 静默 */ }
}

// —— SessionStart ——
function sessionStart() {
  const pluginDir = findPluginDir();
  if (!pluginDir) {
    // 插件目录还没就绪（极少见），仍检查一下 agent-reach 软链
    ensureAgentReach(HOME, false);
    return;
  }
  const latest = path.basename(pluginDir);
  console.log('[Cognitive Core] 🧠 Ready v' + latest);
  console.log('[PONDER] Plugin: ' + pluginDir.replace(/\\/g, '/').replace(/^([A-Za-z]):\//, '/$1/'));

  // 加载记忆
  try {
    const io = require(path.join(pluginDir, 'scripts', 'mma', 'io'));
    const kg = io.loadMMA();
    if (kg.meta.total_points > 0) {
      console.log('[Cognitive Core] 📚 Lessons loaded: ' + kg.meta.total_points + ' points');
    } else {
      console.log('[Cognitive Core] 🌱 First start (cold)');
    }
  } catch (e) { /* 记忆系统异常不影响启动 */ }

  // 启动 monitor（后台常驻，必须 detached + unref，否则父进程 event loop 不退出导致钩子超时）
  try {
    const mon = path.join(pluginDir, 'hooks', 'scripts', 'memory-monitor.js');
    if (fs.existsSync(mon)) {
      const child = spawn('node', [mon, '--plugin-root', pluginDir], childOptions({ stdio: 'ignore', detached: true }));
      child.unref();
      console.log('[Cognitive Core] 🧠 Memory system ready');
    }
  } catch (e) {}

  // 检查 agent-reach（不装包，只补软链）
  ensureAgentReach(pluginDir, false);
}

// —— Setup（插件安装/升级时）——
function setup() {
  console.log('[Cognitive Core] 🧠 Ready');
  const pluginDir = findPluginDir();
  // 安装/升级时主动尝试装 agent-reach
  ensureAgentReach(pluginDir, true);
}

// —— SessionEnd ——
function sessionEnd() {
  const pluginDir = findPluginDir();
  if (!pluginDir) return;
  try {
    const mma = path.join(pluginDir, 'scripts', 'mcts.js');
    if (fs.existsSync(mma)) {
      spawnSync('node', [mma, 'mma', 'decay'], childOptions({ timeout: 8000 }));
      spawnSync('node', [mma, 'mma', 'finalize', JSON.stringify({ points: [], emotions: [] })], childOptions({ timeout: 8000 }));
    }
  } catch (e) {}
  // 清理 monitor 进程
  try {
    const pidf = path.join(os.tmpdir(), 'ponder-monitor.pid');
    if (fs.existsSync(pidf)) {
      process.kill(Number(fs.readFileSync(pidf, 'utf-8')));
    }
  } catch (e) {}
}

// —— 入口 ——
const cmd = process.argv[2];
try {
  if (cmd === 'session-start') sessionStart();
  else if (cmd === 'setup') setup();
  else if (cmd === 'session-end') sessionEnd();
} catch (e) { /* 兜底：任何未捕获异常都吞掉 */ }
