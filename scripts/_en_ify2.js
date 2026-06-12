const fs = require('fs');
const path = require('path');

const rules = [];

// Each rule: [file, oldString, newString]
// mcts-simulate.md
rules.push(['engine/mcts-simulate.md', '"考虑当前已知条件，这个方案走得通吗？', '"Given current conditions, is this solution viable?']);
rules.push(['engine/mcts-simulate.md', '产出：基本可行性 V_feasibility', 'Output: basic feasibility V_feasibility']);
rules.push(['engine/mcts-simulate.md', '反事实推敲 (Counterfactual)', 'Counterfactual']);
rules.push(['engine/mcts-simulate.md', '"如果关键假设不成立，这个方案会怎样？', '"If key assumptions fail, what happens?']);
rules.push(['engine/mcts-simulate.md', '对每个关键假设做一次"如果...那么..."的反事实推理', 'Run if-then counterfactual for each key assumption']);
rules.push(['engine/mcts-simulate.md', '至少检查3个反事实条件（来自Scorecard中F3/F5的低分项）', 'Check at least 3 counterfactuals (from Scorecard F3/F5 low scores)']);
rules.push(['engine/mcts-simulate.md', '产出：鲁棒性 V_robustness', 'Output: robustness V_robustness']);
rules.push(['engine/mcts-simulate.md', '视角矩阵交叉推敲 (Perspective Cross-Validation)', 'Perspective Cross-Validation']);
rules.push(['engine/mcts-simulate.md', '产出：视角覆盖度 V_perspective', 'Output: perspective coverage V_perspective']);

// mcts-converge.md
rules.push(['engine/mcts-converge.md', 'Covered -> mark covered, record which solution', 'Covered -> mark covered, record which solution']);
rules.push(['engine/mcts-converge.md', 'Not covered -> mark blindspot missed', 'Not covered -> mark blindspot missed']);
rules.push(['engine/mcts-converge.md', '生成视角覆盖对照表：', 'Generate perspective coverage table:']);
rules.push(['engine/mcts-converge.md', '盲点审计结论', 'Blindspot audit conclusion']);

// mcts-constraint.md
rules.push(['engine/mcts-constraint.md', '兵家视角追问：', 'Military perspective asks:']);
rules.push(['engine/mcts-constraint.md', '兵家视角认为：', 'Military perspective asserts:']);

let totalChanges = 0;
for (const [file, oldStr, newStr] of rules) {
  const fp = path.join(process.cwd(), file);
  let content = fs.readFileSync(fp, 'utf-8');
  if (content.includes(oldStr)) {
    content = content.replace(oldStr, newStr);
    fs.writeFileSync(fp, content);
    totalChanges++;
    console.log(file + ': replaced 1');
  }
}
console.log('Total changes: ' + totalChanges);
