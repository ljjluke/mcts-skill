#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════
 *  MCTS-TD 引擎合规守护 (Engine Compliance Guard)
 *  "法者，天下之程式也，万事之仪表也" —《管子·明法解》
 * ═══════════════════════════════════════════════════════════════
 *
 *  MCTS-TD 引擎的执行规则都在 Markdown 文件中，LLM 靠"理解"遵守。
 *  当上下文变长/注意力稀释时，规则可能被跳过。
 *  这个守护提供可编程的检查点，在关键节点发出"必须执行"的信号。
 *
 *  7个守卫命令:
 *    decomposition-guard   — 反"唯一方案"检查
 *    phase-enforce         — 阶段输出强制验证
 *    info-gap-guard        — 信息获取5级优先级检查
 *    diversity-challenge   — 方案多样性强制反问
 *    self-check-guard      — 自检核对清单
 *    memory-agent-guard    — Memory Agent 5检查点验证
 *    compliance-report     — 全流程合规审计报告
 *
 *  Usage: node mcts_guard.js <command> [args...]
 */

const { log } = console;

// ═══════════════════════════════════════════════════════════════
//  守卫1: 反"唯一方案"分解检查
// ═══════════════════════════════════════════════════════════════

/**
 * 当 LLM 声称"只有一个方案"时，强制执行以下检查:
 *   ① 是否真的枚举了所有可能？列出已知的替代方案
 *   ② 是否从8个视角都审视过？如果某视角漏了，可能隐藏另一方案
 *   ③ 是否查了记忆？是否搜索了外部？还是仅凭当前判断？
 *
 * @param {object} claim — { task, claimed_single_solution, reason, facets_checked }
 * @returns {object} 检查结果 + 必须回答的问题清单
 */
function decompositionGuard(claim = {}) {
    const task = claim.task || '';
    const reason = claim.reason || '';
    const facetsChecked = claim.facets_checked || 0;

    const challenges = [];
    const requiredActions = [];

    // 检查1: 是否只检查了<4个维度就说"唯一"?
    if (facetsChecked < 4) {
        challenges.push({
            id: 'insufficient_facets',
            severity: 'BLOCKER',
            message: `仅检查了${facetsChecked}/8个维度就声称"唯一方案"。请完成八面镜审视后再判断。`,
            required: '输出至少4个维度的方案分析后再下结论',
        });
        requiredActions.push('expand_facets');
    }

    // 检查2: 理由是否过于笼统?
    const vagueReasons = ['唯一', '只有', '只能', '必须', 'only', 'must', '显然', '明显', '当然'];
    const hasVagueReason = vagueReasons.some(w => reason.toLowerCase().includes(w.toLowerCase()));
    if (hasVagueReason && reason.length < 50) {
        challenges.push({
            id: 'vague_reasoning',
            severity: 'BLOCKER',
            message: `理由过于笼统: "${reason}"。请列出至少2个被考虑过但放弃的替代方案及其放弃原因。`,
            required: '枚举至少2个替代方案，每个附30字以上说明',
        });
        requiredActions.push('list_alternatives');
    }

    // 检查3: 是否跳过了信息获取?
    if (!claim.memory_checked && !claim.web_searched) {
        challenges.push({
            id: 'no_info_acquisition',
            severity: 'WARNING',
            message: '未经记忆查询或网络搜索就断定"唯一方案"。请先执行信息获取流程。',
            required: '执行至少1条信息获取(查记忆/查网络)',
        });
        requiredActions.push('acquire_info');
    }

    // 检查4: 是否被问到"有没有其他做法"?
    if (!claim.alternatives_enumerated) {
        challenges.push({
            id: 'alternatives_not_listed',
            severity: 'BLOCKER',
            message: '没有列出任何替代方案。请先发散再收敛。',
            required: '明确列出至少2个候选方案(即使其中某些有明显缺陷)',
        });
        requiredActions.push('enumerate_alternatives');
    }

    const blocked = challenges.some(c => c.severity === 'BLOCKER');

    return {
        verdict: blocked ? 'BLOCKED' : 'CAUTION',
        blocked,
        message: blocked
            ? '⚠️ 分解不充分，不能断定"唯一方案"。请完成以下检查后重新判断。'
            : '分解检查通过，但请确认确实已穷尽搜索。',
        challenges,
        required_actions: [...new Set(requiredActions)],
        // 强制输出的清单 — 作为 Phase 1 的前置条件
        mandatory_checklist: [
            '□ 是否从8个视角都审视过此任务？',
            '□ 是否查询了记忆中有无类似任务的经验？',
            '□ 是否搜索了网络获取更多方案思路？',
            '□ 是否列了至少2个候选方案（含其优劣）？',
            '□ 是否能让一个不同意你的人也找到另一个方案？',
        ],
    };
}

// ═══════════════════════════════════════════════════════════════
//  守卫2: 阶段输出强制验证
// ═══════════════════════════════════════════════════════════════

const REQUIRED_PHASES = [
    { phase: 0, name: 'Constraint Collection', required: true, check: 'Has constraint list been output?' },
    { phase: 1, name: 'Eight-Facet Review Map', required: true, check: 'Has eight-facet map with scores been output?' },
    { phase: 2, name: 'Reconnaissance Report', required: true, check: 'Has recon report been output?' },
    { phase: 3, name: 'Converged Solution List', required: true, check: 'Has solution list with coverage matrix been output?' },
    { phase: 3.5, name: 'User Ask (if tied)', required: false, check: 'If top2 are close (deltaV<0.04), was user asked?' },
    { phase: 4, name: 'Decision Report', required: true, check: 'Has decision report with self-check + blindspot audit been output?' },
];

function phaseEnforce(completedPhases = []) {
    const report = {
        total_phases: REQUIRED_PHASES.length,
        completed: completedPhases.length,
        missing: [],
        violations: [],
        verdict: 'PASS',
    };

    for (const p of REQUIRED_PHASES) {
        if (p.required && !completedPhases.includes(p.phase)) {
            report.missing.push({ phase: p.phase, name: p.name, check: p.check });
            report.violations.push(`Phase ${p.phase} (${p.name}) was required but NOT completed`);
        }
    }

    if (report.missing.length > 0) {
        report.verdict = 'VIOLATION';
        report.message = `缺失${report.missing.length}个必须阶段: ${report.missing.map(m => m.name).join(', ')}`;
    } else {
        report.message = '所有必须阶段已完成';
    }

    return report;
}

// ═══════════════════════════════════════════════════════════════
//  守卫3: 信息获取5级优先级检查
// ═══════════════════════════════════════════════════════════════

const INFO_PRIORITY_ORDER = [
    { level: 1, name: 'memory_graph', label: '查询知识图谱+当前会话记忆' },
    { level: 2, name: 'self_learn', label: '自查项目代码/技术文档/网络搜索' },
    { level: 3, name: 'diverge_handoff', label: 'Diverge阶段已收集的信息' },
    { level: 4, name: 'ask_user', label: '询问用户(仅限约束/偏好/业务规则)' },
    { level: 5, name: 'assume', label: '标记假设+方差惩罚' },
];

function infoGapGuard(acquisitionLog = []) {
    const usedLevels = acquisitionLog.map(a => a.level);
    const skippedLevels = [];

    // 检查是否跳过了低级优先级的获取
    for (const p of INFO_PRIORITY_ORDER) {
        if (!usedLevels.includes(p.level)) {
            // 如果直接跳到4(ask_user)而没用1,2,3
            if (usedLevels.includes(4) && p.level < 4) {
                skippedLevels.push({
                    ...p,
                    severity: 'WARNING',
                    reason: `跳过了优先级${p.level}(${p.label})直接询问用户`,
                });
            }
            // 如果用了5(assume)而没用1,2
            if (usedLevels.includes(5) && p.level <= 2) {
                skippedLevels.push({
                    ...p,
                    severity: 'BLOCKER',
                    reason: `跳过了优先级${p.level}(${p.label})直接做了假设`,
                });
            }
        }
    }

    return {
        acquisition_path: acquisitionLog,
        skipped_priorities: skippedLevels,
        verdict: skippedLevels.some(s => s.severity === 'BLOCKER') ? 'VIOLATION' : 'OK',
        message: skippedLevels.length > 0
            ? `信息获取可能跳过了${skippedLevels.length}个更优先的步骤`
            : '信息获取优先级正确',
        priority_order: INFO_PRIORITY_ORDER.map(p => p.label),
    };
}

// ═══════════════════════════════════════════════════════════════
//  守卫4: 方案多样性强制反问
// ═══════════════════════════════════════════════════════════════

const DIVERSITY_ANGLES = [
    { angle: '保守方案', prompt: '最稳妥、风险最低的做法是什么？' },
    { angle: '激进方案', prompt: '如果不管风险，最快最直接的做法是什么？' },
    { angle: '折中方案', prompt: '平衡风险和速度的做法是什么？' },
    { angle: '创新方案', prompt: '有没有非传统的、出人意料的做法？' },
    { angle: '不做的方案', prompt: '如果不做这个需求，有没有替代的满足方式？' },
    { angle: '反面方案', prompt: '和你的直觉完全相反的做法是什么？' },
];

function diversityChallenge(solutions = []) {
    const count = solutions.length;
    const coveredAngles = new Set(solutions.map(s => s.angle || 'unknown'));

    const missingAngles = DIVERSITY_ANGLES.filter(a => !coveredAngles.has(a.angle));

    const report = {
        solution_count: count,
        covered_angles: [...coveredAngles],
        missing_angles: missingAngles.map(a => ({ angle: a.angle, prompt: a.prompt })),
    };

    if (count < 2) {
        report.verdict = 'BLOCKED';
        report.message = `仅有${count}个方案。最少需要2个有实质差异的方案。`;
        report.required = DIVERSITY_ANGLES.slice(0, 4 - count).map(a => a.prompt);
    } else if (count < 3) {
        report.verdict = 'WARNING';
        report.message = `仅有${count}个方案。建议至少3个以备MCTS比较。`;
        report.suggested = missingAngles.slice(0, 2).map(a => a.prompt);
    } else {
        report.verdict = 'OK';
        report.message = `已生成${count}个方案，覆盖${coveredAngles.size}个角度`;
    }

    return report;
}

// ═══════════════════════════════════════════════════════════════
//  守卫5: 自检核对清单
// ═══════════════════════════════════════════════════════════════

function selfCheckGuard() {
    return {
        mandatory_checklist: [
            {
                id: 'flaw_find',
                action: '找漏洞',
                questions: [
                    '模拟中是否有模糊判断？如果有，具体是什么？',
                    '是否依赖了未验证的假设？列出所有假设。',
                    '是否有被忽略的风险？列出前3个。',
                ],
            },
            {
                id: 'reverse_think',
                action: '反向思考',
                questions: [
                    '如果第2名方案实际比第1名更好，可能是什么原因？',
                    '这个原因成立的可能性有多高？(高/中/低)',
                    '如果成立，是否需要改变选择？',
                ],
            },
            {
                id: 'risk_assess',
                action: '风险评估',
                questions: [
                    '选择第1名方案的最坏结果是什么？',
                    '影响级别？(轻微/中等/严重)',
                    '能否承受？(能/不能)',
                ],
            },
        ],
        verdict_guidance: {
            pass: '✅ 通过 — 模拟可靠，可以执行',
            risk: '⚠️ 有风险 — 建议用户确认后执行',
            fail: '❌ 不通过 — 重新模拟或切换方案',
        },
    };
}

// ═══════════════════════════════════════════════════════════════
//  守卫6: Memory Agent 5检查点验证
// ═══════════════════════════════════════════════════════════════

const MEMORY_AGENT_CHECKPOINTS = [
    { id: 1, phase: 'pre_engine',      action: '得气召回 — 注入上下文',                          script: "node scripts/meridian_memory.js observe --phase pre_engine" },
    { id: 2, phase: 'during_diverge',   action: '感知七情 — 情绪时间线',                          script: "node scripts/meridian_memory.js observe --phase during_diverge" },
    { id: 3, phase: 'post_simulate',    action: '阿是穴插入 — 经脉穴位',                          script: "node scripts/meridian_memory.js observe --phase post_simulate" },
    { id: 4, phase: 'pre_converge',     action: '阴阳对冲检测 — 矛盾时谏言',                       script: "node scripts/meridian_memory.js observe --phase pre_converge" },
    { id: 5, phase: 'post_execution',   action: '补泻更新 — TD闭环 + 衰减检查',                   script: "node scripts/meridian_memory.js observe --phase post_execution" },
    { id: 6, phase: 'session_end',      action: '睡眠回放 — 记忆巩固',                           script: "node scripts/meridian_memory.js observe --phase session_end" },
];

function memoryAgentGuard(executedCheckpoints = []) {
    const missing = MEMORY_AGENT_CHECKPOINTS.filter(
        cp => !executedCheckpoints.includes(cp.id) && cp.id <= 5 // session_end is optional until end
    );

    return {
        total_checkpoints: MEMORY_AGENT_CHECKPOINTS.length,
        executed: executedCheckpoints.length,
        missing: missing.map(m => ({ id: m.id, phase: m.phase, action: m.action, script: m.script })),
        verdict: missing.length > 0 ? 'INCOMPLETE' : 'COMPLETE',
        message: missing.length > 0
            ? `${missing.length}个Memory Agent检查点未执行: ${missing.map(m => m.phase).join(', ')}`
            : 'Memory Agent全部检查点已执行',
    };
}

// ═══════════════════════════════════════════════════════════════
//  守卫7: 约束检查清单
// ═══════════════════════════════════════════════════════════════

const CONSTRAINT_CHECKLIST = [
    { id: 'tech_stack',     category: 'hard', question: '技术栈是否明确？(语言/框架/数据库/中间件)', auto_detect: true },
    { id: 'dependencies',   category: 'hard', question: '能否引入新的第三方依赖？有无版本/许可证限制？', auto_detect: false },
    { id: 'architecture',   category: 'hard', question: '有无架构硬性约束？(微服务/单体/特定设计模式)', auto_detect: true },
    { id: 'compliance',     category: 'hard', question: '有无合规/政策限制？(数据不出境/审计日志/等保)', auto_detect: false },
    { id: 'performance',    category: 'soft', question: '有无性能要求？(响应时间/吞吐量/并发量)', auto_detect: false },
    { id: 'security',       category: 'hard', question: '有无安全要求？(加密标准/认证方式/OWASP)', auto_detect: true },
    { id: 'time_budget',    category: 'soft', question: '有无时间/成本限制？(截止日期/预算上限)', auto_detect: false },
    { id: 'backward_compat',category: 'hard', question: '是否需要向后兼容？(现有API/数据结构不变)', auto_detect: true },
    { id: 'user_preference',category: 'soft', question: '用户有无明确的偏好/倾向？(语言/风格/工具)', auto_detect: false },
];

function constraintChecklist(state = {}) {
    const checked = state.checked || [];
    const confirmed = state.confirmed || {};
    const missing = [];

    for (const item of CONSTRAINT_CHECKLIST) {
        if (!checked.includes(item.id)) {
            missing.push({
                ...item,
                status: 'unchecked',
                guidance: item.auto_detect
                    ? '可以从项目代码中推断，检查 package.json/go.mod/配置文件'
                    : '必须询问用户，不能假设',
            });
        } else if (confirmed[item.id] === undefined) {
            missing.push({
                ...item,
                status: 'checked_but_unconfirmed',
                guidance: '已检查但未确认，请标记为 confirmed/not_applicable/unknown',
            });
        }
    }

    const hardMissing = missing.filter(m => m.category === 'hard');
    const softMissing = missing.filter(m => m.category === 'soft');

    return {
        total_items: CONSTRAINT_CHECKLIST.length,
        checked_count: checked.length,
        missing_count: missing.length,
        hard_constraints_missing: hardMissing.length,
        soft_constraints_missing: softMissing.length,
        verdict: hardMissing.length > 0 ? 'INCOMPLETE' : (softMissing.length > 0 ? 'CAUTION' : 'COMPLETE'),
        message: hardMissing.length > 0
            ? `⚠️ ${hardMissing.length}个硬约束未检查: ${hardMissing.map(m => m.id).join(', ')}`
            : (softMissing.length > 0
                ? `💡 ${softMissing.length}个软约束未检查，建议确认`
                : '✅ 所有约束已检查'),
        missing_items: missing,
        checklist: CONSTRAINT_CHECKLIST,
    };
}

// ═══════════════════════════════════════════════════════════════
//  守卫8: 引擎模式判定
// ═══════════════════════════════════════════════════════════════

/**
 * 引擎模式判定 — 根据任务特征自动推荐模式
 * Full: ≤5个方案，完整MCTS
 * Quick: >5个方案，粗筛→保留3~5→模拟
 * Re-simulate: 执行中遇到意外
 */
function engineMode(taskProfile = {}) {
    const { solution_count, task_complexity, is_retry, context_available } = taskProfile;

    let mode, reason, maxIterations, cValue;

    if (is_retry) {
        mode = 're-simulate';
        reason = '执行中遇到意外，需要重新模拟';
        maxIterations = 5;
        cValue = 1.0;
    } else if (solution_count > 5) {
        mode = 'quick';
        reason = `方案数(${solution_count})>5，使用快速模式: 粗筛→保留top 3~5→模拟`;
        maxIterations = 5;
        cValue = 1.0;
    } else if (task_complexity === 'high' || (solution_count >= 3 && solution_count <= 5)) {
        mode = 'full';
        reason = `方案数(${solution_count})适中，使用完整MCTS`;
        maxIterations = task_complexity === 'high' ? 20 : 10;
        cValue = 1.414;
    } else if (solution_count === 1) {
        mode = 'direct';
        reason = '仅1个可行方案，跳过MCTS直接执行（但仍需输出Phases 1~3）';
        maxIterations = 0;
        cValue = 0;
    } else {
        mode = 'full';
        reason = '默认完整模式';
        maxIterations = 10;
        cValue = 1.414;
    }

    return {
        mode,
        reason,
        config: {
            max_iterations: maxIterations,
            default_c: cValue,
            requires_simulation: mode !== 'direct',
            requires_diverge: true,
        },
        // 模式切换规则
        mode_switch_rules: {
            'full->quick': '如果模拟中发现方案数实际>5，可切换为quick',
            'full->re-simulate': '如果执行中遇到意外，记录TD error后切换',
            'quick->full': '如果粗筛后方案≤3且复杂度高，可切换为full',
        },
    };
}

// ═══════════════════════════════════════════════════════════════
//  守卫9: 全流程合规审计
// ═══════════════════════════════════════════════════════════════

function complianceReport(state = {}) {
    const { completed_phases = [], acquisition_log = [], solutions = [],
            memory_checkpoints = [], self_check_done = false, blindspot_audit_done = false } = state;

    const phaseReport = phaseEnforce(completed_phases);
    const decomposition = decompositionGuard(state.decomposition_claim || {});
    const infoGap = infoGapGuard(acquisition_log);
    const diversity = diversityChallenge(solutions);
    const memoryAgent = memoryAgentGuard(memory_checkpoints);

    const score = calculateComplianceScore(phaseReport, decomposition, infoGap, diversity, memoryAgent,
        self_check_done, blindspot_audit_done);

    return {
        timestamp: new Date().toISOString(),
        overall_score: score,
        grade: score >= 90 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'F',
        phase_compliance: phaseReport,
        decomposition_guard: decomposition,
        info_gap_guard: infoGap,
        diversity_challenge: diversity,
        memory_agent_guard: memoryAgent,
        self_check: { done: self_check_done, required: true },
        blindspot_audit: { done: blindspot_audit_done, required: true },
        recommendation: score < 70
            ? '⚠️ 检测到多个合规违规。请在继续前修复缺失的步骤。'
            : '✅ 引擎合规良好',
    };
}

function calculateComplianceScore(phase, decomp, infoGap, diversity, memoryAgent, selfCheck, blindspot) {
    let score = 100;
    if (phase.verdict === 'VIOLATION') score -= 20;
    if (decomp.blocked) score -= 25;
    if (infoGap.verdict === 'VIOLATION') score -= 15;
    if (diversity.verdict === 'BLOCKED') score -= 25;
    else if (diversity.verdict === 'WARNING') score -= 10;
    if (memoryAgent.verdict === 'INCOMPLETE') score -= 10;
    if (!selfCheck) score -= 10;
    if (!blindspot) score -= 10;
    return Math.max(0, score);
}

// ═══════════════════════════════════════════════════════════════
//  CLI
// ═══════════════════════════════════════════════════════════════

function parseArgs(args) {
    const r = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith("--")) {
            const k = args[i].replace(/^--/, "").replace(/-/g, "_");
            const v = args[i + 1];
            if (v && !v.startsWith("--")) { r[k] = v; i++; }
            else r[k] = true;
        }
    }
    return r;
}

function output(data) { log(JSON.stringify(data, null, 2)); }

function main() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        log("MCTS-TD Engine Compliance Guard (引擎合规守护)");
        log("  法者，天下之程式也 — Guanzi");
        log("");
        log("Usage: node mcts_guard.js <command> [args...]");
        log("  decomposition-guard  — Anti single-solution check");
        log("  phase-enforce        — Phase output compliance");
        log("  info-gap-guard       — Info acquisition priority check");
        log("  diversity-challenge  — Solution diversity check");
        log("  self-check-guard     — Self-check list");
        log("  memory-agent-guard   — Memory Agent checkpoints verify");
        log("  compliance-report    — Full pipeline compliance audit");
        log("  constraint-checklist — Constraint checklist");
        log("  engine-mode          — Engine mode selection");
        log("  all-guards           — Output all guard checklists");
        process.exit(0);
    }

    const cmd = args[0];
    const o = parseArgs(args.slice(1));

    try {
        switch (cmd) {
            case "decomposition-guard":
                output(decompositionGuard(JSON.parse(o.claim || "{}")));
                break;
            case "phase-enforce":
                output(phaseEnforce(JSON.parse(o.completed || "[]")));
                break;
            case "info-gap-guard":
                output(infoGapGuard(JSON.parse(o.log || "[]")));
                break;
            case "diversity-challenge":
                output(diversityChallenge(JSON.parse(o.solutions || "[]")));
                break;
            case "self-check-guard":
                output(selfCheckGuard());
                break;
            case "memory-agent-guard":
                output(memoryAgentGuard(JSON.parse(o.executed || "[]")));
                break;
            case "compliance-report":
                output(complianceReport(JSON.parse(o.state || "{}")));
                break;
            case "constraint-checklist":
                output(constraintChecklist(JSON.parse(o.state || "{}")));
                break;
            case "engine-mode":
                output(engineMode(JSON.parse(o.profile || "{}")));
                break;
            case "all-guards":
                output({
                    decomposition: decompositionGuard({}),
                    phases: REQUIRED_PHASES,
                    info_priority: INFO_PRIORITY_ORDER,
                    diversity_angles: DIVERSITY_ANGLES,
                    self_check: selfCheckGuard(),
                    memory_agent_checkpoints: MEMORY_AGENT_CHECKPOINTS,
                });
                break;
            default:
                log(`Unknown: ${cmd}`);
                process.exit(1);
        }
    } catch (e) {
        log(`Error: ${e.message}`);
        process.exit(1);
    }
}

main();

module.exports = {
    decompositionGuard, phaseEnforce, infoGapGuard,
    diversityChallenge, selfCheckGuard, memoryAgentGuard, complianceReport,
    constraintChecklist, engineMode,
    REQUIRED_PHASES, INFO_PRIORITY_ORDER, DIVERSITY_ANGLES, MEMORY_AGENT_CHECKPOINTS,
    CONSTRAINT_CHECKLIST,
};
