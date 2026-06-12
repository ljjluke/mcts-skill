const fs = require('fs');
const p = require('os').homedir() + '/.claude/plugins/installed_plugins.json';
const d = JSON.parse(fs.readFileSync(p, 'utf-8'));
const m = d.plugins['mcts-td-planner@mcts-td-planner'];
if (m && m[0]) {
    // 改成 user scope，移除 projectPath，让 Claude Code 注册为 skill
    m[0].scope = 'user';
    delete m[0].projectPath;
}
fs.writeFileSync(p, JSON.stringify(d, null, 2));
console.log('Changed scope to user');
console.log(JSON.stringify(m[0], null, 2));
