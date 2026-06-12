const fs=require("fs");
let c=fs.readFileSync("engine/mcts-converge.md","utf-8");
c=c.replace(/Covered.+mark covered, record which solution/);
console.log("test");