#!/usr/bin/env node
/**
 * ensure-agent-reach.js — 检查 agent-reach 是否可用，没有就装，装好就注册到 Claude Code skills。
 *
 * 由 hooks/hooks.json 的 Setup（安装/升级时）和 SessionStart（每次启动）共同调用。
 * 设计原则：
 *   - 已装且已注册 → 立即退出（0 开销，每次启动不拖累）
 *   - 已装但软链缺失 → 补软链（毫秒级）
 *   - 没装 → 尝试 pip3/pip/pipx 安装（首次较慢，后续跳过）
 *   - 任何失败都静默退出，绝不抛异常阻塞会话启动
 *
 * 用法: node ensure-agent-reach.js [--try-install]
 *   不带参数：只检查+注册软链，不主动装包（SessionStart 用，避免每次启动都跑 pip）
 *   --try-install：检查到没装时主动尝试安装（Setup 用，安装/升级时一次性装好）
 */
'use strict';
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TRY_INSTALL = process.argv.includes('--try-install');
const HOME = os.homedir();
const CLAUDE_SKILLS = path.join(HOME, '.claude', 'skills');
const AGENT_SKILL_DIR = path.join(HOME, '.agents', 'skills', 'agent-reach');
const LINK_PATH = path.join(CLAUDE_SKILLS, 'agent-reach');

function hasAgentReach() {
  // 用 which/env 检测，比 command -v 更可控；严格超时防止 PATH 里有慢挂载点卡死
  const checker = process.platform === 'win32' ? 'where' : 'which';
  try {
    const r = spawnSync(checker, ['agent-reach'], { stdio: 'ignore', timeout: 5000, shell: process.platform === 'win32' });
    return r.status === 0;
  } catch (e) {
    return false;
  }
}

function linkValid() {
  try {
    return fs.existsSync(LINK_PATH) && fs.existsSync(path.join(LINK_PATH, 'SKILL.md'));
  } catch (e) {
    return false;
  }
}

function registerLink() {
  try {
    fs.mkdirSync(CLAUDE_SKILLS, { recursive: true });
  } catch (e) {}
  // 软链断了或不存在才建
  if (fs.existsSync(LINK_PATH)) return false;
  if (!fs.existsSync(AGENT_SKILL_DIR)) return false;
  try {
    fs.symlinkSync(AGENT_SKILL_DIR, LINK_PATH, 'dir');
    return true;
  } catch (e) {
    return false;
  }
}

function installAgentReach() {
  // 让 agent-reach 自己把 skill 装到 ~/.agents/skills/agent-reach
  try {
    spawnSync('agent-reach', ['skill', '--install'], { stdio: 'ignore', timeout: 15000 });
  } catch (e) {}

  const candidates = [
    ['pip3', ['install', '--break-system-packages', 'agent-reach', '-q']],
    ['pip', ['install', 'agent-reach', '-q']],
    ['pipx', ['install', 'agent-reach', '-q']],
  ];
  for (const [bin, args] of candidates) {
    try {
      const r = spawnSync(bin, args, { stdio: 'ignore', timeout: 120000, shell: process.platform === 'win32' });
      if (r.status === 0 && hasAgentReach()) return true;
    } catch (e) {
      // 超时或不存在，试下一个
    }
  }
  return false;
}

// —— 主流程 ——
// 1. 已装
if (hasAgentReach()) {
  // 确保 skill 文件存在（agent-reach skill --install 幂等，缺才补）
  if (!fs.existsSync(AGENT_SKILL_DIR)) {
    try { spawnSync('agent-reach', ['skill', '--install'], { stdio: 'ignore', timeout: 15000 }); } catch (e) {}
  }
  // 注册软链
  if (linkValid()) {
    // 一切就绪，静默退出
    process.exit(0);
  }
  if (registerLink()) {
    console.log('[Agent-Reach] ✅ Registered to Claude Code skills');
  }
  process.exit(0);
}

// 2. 没装
if (!TRY_INSTALL) {
  // SessionStart 路径：不主动装包，留待 Setup；但记一笔让用户知道
  process.exit(0);
}

// 3. Setup 路径：尝试安装
console.log('[Agent-Reach] ⏳ Installing...');
const ok = installAgentReach();
if (ok) {
  console.log('[Agent-Reach] ✅ Installed');
  if (registerLink()) {
    console.log('[Agent-Reach] ✅ Registered to Claude Code skills');
  }
} else {
  console.log('[Agent-Reach] ⚠️ Install failed — skill still works, web search uses built-in');
}
