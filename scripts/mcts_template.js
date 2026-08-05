#!/usr/bin/env node
/**
 * Ponder Template Engine — Markdown template rendering from structured JSON.
 * Usage: node mcts_template.js <command> --data '<JSON>' [--json]
 * Default output: raw Markdown. --json flag: JSON wrapper.
 */
const { log } = console;
const { parseArgs } = require('./shared');

const TRIGRAMS = { 1: '☰', 2: '☷', 3: '☳', 4: '☴', 5: '☵', 6: '☲', 7: '☶', 8: '☱' };
const FACET_NAMES = { 1: 'Source of Force', 2: 'Foundation Bearer', 3: 'Change/Disruption', 4: 'Penetration', 5: 'Risk/Abyss', 6: 'Visible/Dependent', 7: 'Boundary', 8: 'Convergence' };
const VERDICT_SYMBOLS = { Pass: '✅', pass: '✅', OK: '✅', Risk: '⚠️', risk: '⚠️', WARNING: '⚠️', 'Not passed': '❌', FAIL: '❌', VIOLATION: '❌' };


function parseData(o) {
    if (!o.data) return {};
    try { return JSON.parse(o.data); } catch { return {}; }
}

function emit(o, cmd, data, markdown) {
    if (o.json === true || o.json === 'true') {
        log(JSON.stringify({ template: cmd, markdown, data }, null, 2));
    } else {
        log(markdown);
    }
}

// ===== Templates =====

function renderReviewMap(d) {
    const facets = (d.facets || []).map(f => {
        const tri = TRIGRAMS[f.id] || '?';
        const name = FACET_NAMES[f.id] || f.name || '';
        const concreteName = f.name || '';
        return ` F${f.id} ${tri} ${name} [${concreteName}] — Score: ${f.score}\n    Known: ${f.known || ''} | Blindspots: ${f.blindspots || ''} | Ideas: ${f.ideas || ''}`;
    }).join('\n\n');
    const s = d.summary || {};
    return `【Eight-Facet Review Map】\n Task: ${d.task || ''} | Domain: ${d.domain || ''}\n\n${facets}\n\n Summary: Strong=${(s.strong || []).join(',') || '—'} | Weak=${(s.weak || []).join(',') || '—'} | Tension pairs=${(s.tension_pairs || []).join(',') || '—'}`;
}

function renderPortrait(d) {
    const dims = (d.dimensions || []).map((dim, i) => {
        const markers = { sufficient: '', partial: ' ← ask', severe: ' ← MUST ask' };
        const mark = markers[dim.level] || '';
        const idCap = dim.id.charAt(0).toUpperCase() + dim.id.slice(1);
        return ` ${'①②③④⑤'[i]} ${dim.cjk || idCap} [${dim.score}/10] ${dim.level}${mark} — ${dim.detail || ''}`;
    }).join('\n');
    return `【Requirement Portrait · Wuzhen Integrated Assessment】\n Task: ${d.task || ''}\n${dims}\n\n Questions: ${(d.questions || []).join(' | ') || 'None'}\n Cross-dimension: ${(d.cross_dimension || []).join(' | ') || 'None'}\n Root (Ben): ${d.root || '—'} | Absence: ${(d.absence || []).join(', ') || 'None'} | Tension: ${(d.tension || []).join(', ') || 'None'}`;
}

function renderReconReport(d) {
    const facets = (d.facets || []).map(f => `   F${f.id} [${f.name || ''}]: ${f.findings || ''}`).join('\n');
    const cross = (d.cross_validation || []).map(cv => `   ${cv.pair}: ${cv.finding} → Li 理: ${cv.li || ''} | Shi 事: ${cv.shi || ''}`).join('\n');
    const assumptions = (d.assumptions || []).map(a => `   "Assume ${a.assumption}" ← ${a.confirmed ? 'Confirmed' : 'Unconfirmed'}`).join('\n');
    return `【Reconnaissance Report】\n Task: ${d.task || ''}\n\n Per-Facet Findings:\n${facets}\n\n Cross-Validation:\n${cross || '   None'}\n\n Explicit Assumptions:\n${assumptions || '   None'}`;
}

function renderInfoGap(d) {
    const asked = (d.asked || []).map(qa => `${qa.question} → ${qa.answer || 'pending'}`).join(' | ');
    const scores = Object.entries(d.updated_scores || {}).map(([k, v]) => `${k}=${v}`).join(' | ');
    const gaps = d.complete ? 'None → proceed' : (d.remaining_gaps || []).join(', ');
    return `【Info Gap Round ${d.round || 1}】\n  Asked: ${asked || 'None'}\n  Updated scores: ${scores || 'None'}\n  Remaining gaps: ${gaps}`;
}

function renderMctsRound(d) {
    const sel = d.selection || {};
    const exp = d.expansion || {};
    const sim = d.simulation || {};
    const bp = d.backprop || {};
    const ts = d.tree_state || {};
    const conv = d.convergence || {};
    return `MCTS Round [${d.round}]:\n  ① Selection: ${sel.path || ''} (UCB values: ${sel.ucb_values || ''}, why: ${sel.reason || ''})\n  ② Expansion: ${exp.node || ''} (type: ${exp.type || ''}, potential: ${exp.potential || ''})\n  ③ Simulation: ${sim.rollout_path || ''} → V=${sim.v || ''} (knowledge acquired: ${sim.knowledge_acquired || ''}, assumptions: ${(sim.assumptions || []).join(', ') || 'none'})\n  ④ Backprop: ${bp.node_updates || ''}\n\nTree State: ${ts.summary || ''}\nConvergence: ${conv.check || ''}`;
}

function renderMctsFinal(d) {
    const rank = (d.ranking || []).map(r => `${r.name} n=${r.n} V=${r.v} σ²=${r.sigma2 || ''} Conf=${r.confidence || ''}`).join(' | ');
    return `MCTS Complete — ${d.rounds || 0} rounds, stop reason: ${d.stop_reason || ''}\nRanking: ${rank || 'None'}\nBest path: ${d.best_path || ''} | Main risk: ${d.main_risk || ''}`;
}

function renderSelfCheck(d) {
    const sym = VERDICT_SYMBOLS[d.verdict] || '❓';
    const items = (d.findings || []).map((f, i) => `  ${'①②③④⑤'[i]} ${f.question}: ${f.result} [${f.status}]`).join('\n');
    return `Self-Check Verdict:\n  ${sym} ${d.verdict} — ${(d.message || 'see findings below')}\n${items}`;
}

function renderDecisionReport(d) {
    const rankHeader = ' Rank │ Solution │ V_final │ V_feas │ V_robust │ V_persp │Body-Use│ σ² │ n │ Conf';
    const rankRows = (d.ranking || []).map(r => `   ${r.rank}  │ ${r.solution}│ ${r.v_final}   │ ${r.v_feas}  │ ${r.v_robust}    │ ${r.v_persp}   │ ${r.body_use || ''} │${r.sigma2 || ''}│ ${r.n} │ ${r.conf || ''}`).join('\n');
    const sc = d.self_check || {};
    const ba = d.blindspot_audit || {};
    const yy = d.yan_yi || {};
    const ep = d.execution_plan || {};
    const ku = (d.knowledge_update || []).map(k => `${k.new} [TD error: ${k.td_error}]`).join(', ');
    const checkpoints = (d.memory_checkpoints || []).map(cp => `   ☐ ${cp.name}: ${cp.status}`).join('\n');
    const points = (d.session_points || []).join(', ') || 'None';
    const lg = d.language_guard || {};
    return `【Ponder Decision Report】\n Task: ${d.task || ''} | Date: ${d.date || ''} | Iterations: ${d.iterations || 0} | Solutions: ${d.solutions_count || 0}\n\n Ranking (V_final = 0.5×V_feas + 0.3×V_robust + 0.2×V_persp + Body-Use):\n${rankHeader}\n${rankRows}\n\n Self-Check: ${VERDICT_SYMBOLS[sc.verdict] || '❓'} ${sc.verdict || ''} [${sc.findings || ''}]\n Blindspot Audit: ${VERDICT_SYMBOLS[ba.verdict] || '❓'} ${ba.verdict || ''} [${ba.details || ''}]\n 言意(Yan-Yi) Gap Check: ${VERDICT_SYMBOLS[yy.verdict] || '❓'} ${yy.verdict || ''} [${yy.gaps != null ? yy.gaps + ' gaps' : ''}]\n\n Execution Plan: ${ep.solution || ''} → [${(ep.steps || []).join(', ')}] → [${ep.key_risks || ''}] | [${ep.fallback || ''}]\n\n Knowledge Update: ${ku || 'None'}\n\n Memory Lifecycle Checkpoints:\n${checkpoints || '   None'}\n\n Session Points: ${points}\n\n Language Guard: ${lg.check || ''} [${lg.lang || ''}]`;
}

function renderSolutionList(d) {
    const sols = (d.solutions || []).map((s, i) => ` Solution ${String.fromCharCode(65 + i)}: ${s.name} | Approach: ${s.approach || ''} | Basis: ${s.basis || ''} | Complexity: ${s.complexity || ''}`).join('\n');
    const elim = (d.eliminated || []).map(e => ` ${e.direction}: ${e.reason}`).join('\n');
    const cm = d.coverage_matrix || {};
    const headers = cm.headers || [];
    const rows = (cm.rows || []).map(r => `   ${r.name}: ${(r.coverage || []).map(c => c === 'check' ? '✓' : '-').join(' ')}`).join('\n');
    return `【Solution List (After Convergence)】\n${sols}\n\n Eliminated:\n${elim || ' None'}\n\n Coverage Matrix: ${headers.join(' ')}\n${rows || ' None'}`;
}

function renderConstraintList(d) {
    const items = (d.constraints || []).map(c => {
        const mark = c.type === 'Hard' ? (c.met ? '[✓]' : '[✗]') : '[ ]';
        return ` ${c.type}: ${mark} ${c.description} (${c.source || ''})`;
    }).join('\n');
    const src = Object.entries(d.sources || {}).map(([k, v]) => `${k}=${v}`).join(', ');
    return `【Requirement Constraint List】\n Task: ${d.task || ''}\n${items}\n Sources: ${src || 'None'}`;
}

function renderDongTemplate(d) {
    const scores = d.scores || {};
    const scoreStr = Object.entries(scores).map(([k, v]) => `${k}=${v}${v < 7 ? '↓' : ''}`).join(' ');
    const keyPts = (d.key_points || []).join('; ');
    return `[${d.phase_name || 'Phase'}] Key: ${keyPts}\nScores: ${scoreStr}\nAction: ${d.action || ''}`;
}

// ===== Output format rules (moved from SKILL.md to reduce prompt length) =====
function outputSpec() { return `
每步输出规则:
  五診: 你对各维度的判断 + 需要追问的部分 | 3-8行
  心斋: 你注意到什么矛盾/用户的真实卡点 | 3-5行
  六视: 从哪个角度发现了什么反直觉的东西 | 3-6行
  八卦镜: 哪个维度最异常 + 跨维度的冲突 | 5-10行
  齐物: 如果有视角冲突就写, 没有就不写 | 0-3行
  梦蝶: 如果翻转发现意外结论就写 | 0-3行
  MCTS: 方案对比推理(不带数字) + 推荐 + 风险 | 3-8行
  自检: 找到的风险/漏洞 | 0-3行

铁律:
  1. 不要出现用户看不懂的术语: V值/σ²/权重/UCB/置信度 → 后台用不展示
  2. 不要出现"我做了X分析"前缀 → 直接写结论
  3. 不要出现步骤编号 → 用户不关心
  4. 要详细, 每步至少3行, 让用户感觉认真分析了
  5. 要让用户能用自己经验验证推理路径
`.trim(); }

function antiGuessRules() { return `
反猜测规则:
  用户没说过的不能假装知道: 拿不准的要问, 不能编
  方案推荐必须有依据, 依据来自用户自己说过的话
  ❌ "项目处于早期阶段" → 用户没说过
  ✅ "你说项目时间还宽裕, 但具体阶段我没太确定"

内部来源标注(不展示给用户):
  ✅ verified = 直接来自用户或代码
  ⚠️ inferred = 从已有信息推导
  ❓ speculative = 无证据, 不能用于决策
`.trim(); }

function interviewScript() { return `
3-step user interview (MANDATORY):
  ① PARAPHRASE: "You said [restate], correct? Anything to add?"
  ② PROBE: "What have you tried before? What approaches did you consider?"
  ③ CONSTRAIN: AskUserQuestion with options, 2-3 critical constraints
  Do NOT score before user answers.
`.trim(); }

function forbiddenCheck() { return `
FORBIDDEN:
  - Skip any step (even if task looks simple)
  - Skip assumption-exposure (fake divergence)
  - Surface-level perspective shifts (must BECOME each view)
  - Perfunctory facets (each needs substance)
  - Execute without reading engine files (MUST LOAD)
  - MCTS: final numbers only (user sees narrative, backend runs full)
  - Limit solutions during divergence (unlimited until converge)
  - Output cultural terms without translation
  - Merge steps (backend runs each independently)
  When in doubt: node scripts/mcts_guard.js all-guards
`.trim(); }

function translateGuide() { return `
Translation rule: internal uses concept names, output translates to user domain language.
  心斋→assumption-exposure | 逍遥游→free-wandering | 齐物→equalize
  梦蝶→premise-flip | 八卦镜→multi-perspective
  Full table: engine/mcts-diverge.md
`.trim(); }

function streamFlow() { return `
Streaming output order:
  Banner → immediate
  Divergence engine → key findings immediate
  Convergence engine → survivors when ready
  Simulation engine → 8-dimension scoring of survivors
  No waiting, user sees analysis building.
`.trim(); }

function helloTest() { return `
Test case — user says "hello":
  Step 1(decompose): "You said hello — testing me? Ready to start? Formal or casual?"
  Step 2(diverge): 6-scale analysis of what "hello" implies
  Step 3(examine): 8-perspective on hidden expectations
  Step 4(converge): cull weak responses, keep best
  Step 5(simulate): ≥2 response types, 3 scenarios each

  Even "hello" goes through full flow. No exceptions.
`.trim(); }

function depthLoop() { return `
深度循环: 任何步骤不清晰→不能跳过, 必须重做到清晰为止。
原因分析: 缺数据(搜索重做) / 缺方向(问用户重做) / 不够深(缩小范围挖)
没有轮数上限, 不清就一直挖。
用户可见: 触发时输出"不清晰→深度循环中+原因"。
`.trim(); }

function pipelineSteps() { return `
执行步骤(每步完成调step-gate解锁下一步):
1. 采访: 覆盖天时地利人和法物, 清晰→0问题也行, 不清→追问到清
2. 神思(子agent破框): 虚静→神凝→神游→意象→言意, 至少1个反直觉发现
3. 发散(六视): 至少4个不同视角, 一视一发现
4. 发散(八卦镜): 8维交叉
5. 收敛: 基于八卦镜评分淘汰弱方案, 只保留最优的3-5个
5. 推演: 每方案单独展开完整推理链
6. 评分: 表格展示, 至少3维度评分
7. 辩论: 各方案立场交锋
8. 综合: 推荐+理由(引用用户原话)+风险
`.trim(); }

function outputFormat() { return `
输出要求:
- 友好: 框架术语翻译为用户语言, 出现在【】标题中
- 完整: 每步推理链不省略, 不合并
- 对比数据用表格
- 方案命名用描述性名称(快速/稳妥/分期)
- 每步调用 profile observe 记偏好
- 结束时 mma remember 存记忆 + mma finalize 巩固
`.trim(); }

function sixViews() { return `
6 divergence scales (each MUST produce ≥1 insight):
  System level: Where is the real boundary?
  Micro level: What details does macro miss?
  Time-compressed: If only 1 day, priority?
  Time-expanded: What stays, what changes long-term?
  Flow: Without intervention, where does it go?
  Selfless: Remove personal stake, system optimum?
`.trim(); }

function baguaQuestions() { return `
8 perspectives (each MUST have substance):
  Source of force | Foundation | Change | Penetration
  Risk | Hidden dependencies | Boundary | Balance

  Output: 1-2 most abnormal + cross-perspective conflicts.
`.trim(); }

function allRules() { return [
  outputSpec(), antiGuessRules(), interviewScript(),
  forbiddenCheck(), translateGuide(), streamFlow()
].join('\n---\n'); }

// ===== CLI =====
function main() {
    const args = process.argv.slice(2);
    const cmd = args[0];
    const o = parseArgs(args.slice(1));
    const d = parseData(o);

    try {
        let md = '';
        switch (cmd) {
            case "review-map": md = renderReviewMap(d); break;
            case "portrait": md = renderPortrait(d); break;
            case "recon-report": md = renderReconReport(d); break;
            case "info-gap": md = renderInfoGap(d); break;
            case "mcts-round": md = renderMctsRound(d); break;
            case "mcts-final": md = renderMctsFinal(d); break;
            case "self-check": md = renderSelfCheck(d); break;
            case "decision-report": md = renderDecisionReport(d); break;
            case "solution-list": md = renderSolutionList(d); break;
            case "constraint-list": md = renderConstraintList(d); break;
            case "dong-template": md = renderDongTemplate(d); break;
            case "output-spec": md = outputSpec(); break;
            case "anti-guessing": md = antiGuessRules(); break;
            case "interview-script": md = interviewScript(); break;
            case "forbidden-check": md = forbiddenCheck(); break;
            case "translate-guide": md = translateGuide(); break;
            case "stream-flow": md = streamFlow(); break;
            case "all-rules": md = allRules(); break;
            case "hello-test": md = helloTest(); break;
            case "six-views": md = sixViews(); break;
            case "bagua-questions": md = baguaQuestions(); break;
            case "depth-loop": md = depthLoop(); break;
            case "pipeline-steps": md = pipelineSteps(); break;
            case "output-format": md = outputFormat(); break;
            default:
                log(`Ponder Template Engine\nUsage: node mcts_template.js <command> --data '<JSON>' [--json]\n\nCommands:\n  review-map      Eight-Facet Review Map\n  portrait        Wuzhen Requirement Portrait\n  recon-report    Reconnaissance Report\n  info-gap        Info Gap Round Report\n  mcts-round      MCTS Per-Round Output\n  mcts-final      MCTS Final Summary\n  self-check      Self-Check Verdict\n  decision-report Full Decision Report\n  solution-list   Solution List\n  constraint-list Constraint List\n  dong-template   Dong Mode Compact Output\n  output-spec     Per-step output format rules\n  anti-guessing   Anti-guessing rules\n  interview-script 3-step user interview template\n  forbidden-check  Forbidden rules checklist\n  translate-guide  Concept translation guide\n\nFlags:\n  --data '<JSON>' Input data (required)\n  --json           Output as JSON wrapper instead of raw Markdown`);
                process.exit(0);
        }
        emit(o, cmd, d, md);
    } catch (e) {
        log(`Error: ${e.message}`);
        process.exit(1);
    }
}

if (require.main === module) main();
