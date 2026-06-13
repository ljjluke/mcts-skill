#!/usr/bin/env node
/**
 * MCTS-TD Compute Engine (Pure Node.js — no Python dependency)
 * Core numerical computation for MCTS tree search.
 * Usage: node mcts_compute.js <command> [args...]
 */

const { log } = console;

// ===== UCB & Core =====
function computeUcb(v, nChild, nParent, c = 1.414, kBonus = 0) {
    if (nChild === 0) return Infinity;
    return v + c * Math.sqrt(Math.log(nParent) / nChild) + kBonus;
}

/**
 * ═══════════════════════════════════════════════════════════════
 *  奇正相生自适应探索 (Qi-Zheng Adaptive Explore-Exploit)
 *  "凡战者，以正合，以奇胜" —《孙子兵法·兵势》
 * ═══════════════════════════════════════════════════════════════
 *
 *  正 (Zheng) = Exploitation 利用已知 — V项权重
 *  奇 (Qi) = Exploration 探索未知 — 探索项权重
 *
 *  根据知识图谱状态动态调整 UCB 的探索常数 c:
 *    → 知识丰富(多CONFIRMED) → c↓ 偏向利用
 *    → 知识匮乏(冷启动) → c↑ 偏向探索
 *    → 情感信号: 喜→偏奇(探索), 恐→偏正(保守)
 *
 * @param {object} context — { kg_match_count, confirmed_ratio, emotion, task_novelty }
 * @returns {number} 自适应 c 值 (0.5 ~ 2.5)
 */
function computeAdaptiveC(context = {}) {
    const DEFAULT_C = 1.414; // sqrt2 - classic UCB balance

    let c = DEFAULT_C;

    // 1. 知识匹配度: 匹配越多→越偏向利用(正)
    const matchCount = context.kg_match_count || 0;
    if (matchCount >= 10) c -= 0.3;
    else if (matchCount >= 5) c -= 0.15;
    else if (matchCount === 0) c += 0.4; // cold start -> bias explore (Qi)

    // 2. 知识可信度: CONFIRMED比例越高→越偏向利用(正)
    const confirmedRatio = context.confirmed_ratio;
    if (confirmedRatio !== undefined) {
        if (confirmedRatio >= 0.7) c -= 0.2;
        else if (confirmedRatio >= 0.4) c -= 0.1;
        else if (confirmedRatio < 0.2) c += 0.25;
    }

    // 3. 情感信号 (七情→奇正)
    // 喜/惊 → 开放心态，偏向探索(奇)
    // 恐/忧 → 保守心态，偏向利用(正)
    const emotion = context.emotion || '';
    if (['xi', 'jing'].includes(emotion)) c += 0.2;
    else if (['kong', 'you_si', 'bei'].includes(emotion)) c -= 0.2;

    // 4. 任务新颖度: 新领域→偏向探索(奇)
    if (context.task_novelty === 'high') c += 0.3;
    else if (context.task_novelty === 'low') c -= 0.1;

    // 5. 势 (Shi) — 时机成熟度
    // 子午流注经脉匹配度>0.6 → "势"成熟 → 偏向利用
    if (context.shi_maturity && context.shi_maturity > 0.6) c -= 0.15;

    // 限制范围: 0.5 ~ 2.5
    return Math.max(0.5, Math.min(2.5, Math.round(c * 1000) / 1000));
}

/**
 * 势 (Shi) — 决策时机成熟度
 * 综合经脉活跃度、知识匹配度、情感状态判断"势"是否成熟
 * @returns {number} 0~1, >0.6表示势成熟
 */
function computeShiMaturity(context = {}) {
    let shi = 0.5;

    // 经脉匹配度
    if (context.meridian_match_score) shi += (context.meridian_match_score - 0.5) * 0.3;

    // 知识匹配数
    const matchCount = context.kg_match_count || 0;
    if (matchCount >= 5) shi += 0.2;
    else if (matchCount >= 2) shi += 0.1;
    else shi -= 0.1;

    // 情感: 安(relief) → 势成熟
    if (context.emotion === 'an') shi += 0.1;

    // 时辰: 当前经脉活跃 → 势成熟
    if (context.active_meridian_count && context.active_meridian_count >= 4) shi += 0.1;

    return Math.max(0, Math.min(1, shi));
}

function computeCltUcb(v, sigma2, nI, N) {
    const phiInv = { 2: 1.5, 3: 1.0, 4: 0.8, 5: 0.7 };
    return v + (phiInv[N] || 0.5) * Math.sqrt(sigma2 / nI);
}

// ===== Welford & Backprop =====
function welfordUpdate(mu, m2, n, x) {
    const nNew = n + 1;
    const delta = x - mu;
    const muNew = mu + delta / nNew;
    const delta2 = x - muNew;
    const m2New = m2 + delta * delta2;
    const variance = nNew > 0 ? m2New / nNew : 0;
    return [muNew, m2New, nNew, variance];
}

function computeTdError(vActual, vPredicted) { return vActual - vPredicted; }

// ===== Convergence =====
function checkValueStability(vHistory, threshold = 0.05) {
    if (vHistory.length < 3) return false;
    const recent = vHistory.slice(-3);
    let maxChange = 0;
    for (let i = 1; i < recent.length; i++)
        maxChange = Math.max(maxChange, Math.abs(recent[i] - recent[i - 1]));
    return maxChange < threshold;
}

function checkHighConfidence(n, sigma2, threshold = 0.05) { return n >= 5 && sigma2 < threshold; }

function getMaxIterations(taskType) {
    return { simple: 5, medium: 10, complex: 20, debug: 8 }[taskType] || 10;
}

function shouldStopIteration(rootNodes, taskType, currentRound, vHistory) {
    if (currentRound >= getMaxIterations(taskType)) return [true, "Hard limit"];
    if (!rootNodes || rootNodes.length === 0) return [true, "No nodes"];
    const best = rootNodes.reduce((a, b) => ((a && a.v) || 0) > ((b && b.v) || 0) ? a : b, null);
    if (!best) return [true, "No valid nodes"];
    if (checkValueStability(vHistory)) return [true, "Value stable"];
    if (checkHighConfidence(best.n || 0, best.sigma2 || 1)) return [true, "High confidence"];
    return [false, "Continue"];
}

// ===== State Machine =====
const STATUS_WEIGHTS = { CONFIRMED: 1.0, PROVISIONAL: 0.3, DISPUTED: 0.2, REFUTED: 0.0, HYPOTHESIS: 0.1, SLEEPING: 0.15 };

function checkStatusTransition(currentStatus, n, hasContradiction = false, contradictionCount = 0) {
    if (currentStatus === "PROVISIONAL" && n >= 3 && !hasContradiction) return "CONFIRMED";
    if (currentStatus === "PROVISIONAL" && hasContradiction) return "DISPUTED";
    if (currentStatus === "CONFIRMED" && contradictionCount >= 2) return "DISPUTED";
    if (currentStatus === "DISPUTED" && contradictionCount >= 3) return "REFUTED";
    return null;
}

function getStatusWeight(status) { return STATUS_WEIGHTS[status] || 0; }

// ===== KBonus & Helpers =====
function computeKBonus(kgMatch, nChild) {
    if (nChild >= 3) return { k_bonus: 0.0, label: "enough samples" };
    if (!kgMatch) return { k_bonus: 0.0, label: "cold start" };
    const { status, n, q } = kgMatch;
    if (status === "CONFIRMED" && n >= 5 && q >= 0.8) return { k_bonus: 0.15, label: "high trust" };
    if (status === "PROVISIONAL" && n < 5 && q >= 0.7) return { k_bonus: 0.05, label: "medium trust" };
    if (status === "DISPUTED" || status === "REFUTED" || q < 0.5) return { k_bonus: -0.10, label: "warning" };
    return { k_bonus: 0.0, label: "no bias" };
}

function classifyBlindspot(score) {
    if (score < 4) return { class: "blank", label: "must learn first", action: "research required, cannot skip" };
    if (score < 7) return { class: "partial", label: "generate with caution", action: "generate with 'pending verification' marker" };
    return { class: "covered", label: "can generate directly", action: "generate directly" };
}

function getConfidenceLevel(sigma2) {
    if (sigma2 < 0.1) return "high"; if (sigma2 < 0.3) return "medium"; return "low";
}

// ===== Ranking & User-Ask =====
function rankByConvergedV(solutions) {
    return [...solutions].sort((a, b) => {
        const vDiff = (b.v || 0) - (a.v || 0);
        if (Math.abs(vDiff) > 0.001) return vDiff;
        const nDiff = (b.n || 0) - (a.n || 0);
        if (Math.abs(nDiff) > 0.001) return nDiff;
        return (a.sigma2 || 1) - (b.sigma2 || 1);
    });
}

function shouldAskUserAfterSimulation(ranked) {
    if (ranked.length < 2) return { should_ask: false, reason: "only one solution" };
    const [first, second] = ranked;
    const vDiff = (first.v || 0) - (second.v || 0);
    if (vDiff < 0.02) return { should_ask: true, reason: `Nearly identical (deltaV=${vDiff.toFixed(3)})`, ask_about: ["usage_scenario", "priority_preference"] };
    if (vDiff < 0.04 && (first.n || 0) < 5 && (second.n || 0) < 5) return { should_ask: true, reason: `Close ranking with low confidence`, ask_about: ["constraint_detail", "usage_frequency"] };
    return { should_ask: false, reason: `Clear winner (deltaV=${vDiff.toFixed(3)})` };
}

function getFuseMode(accuracy, consecutiveBad = 0) {
    if (consecutiveBad >= 3) return { mode: "suggest_manual" };
    if (accuracy < 0.50) return { mode: "pause_ask_user" };
    if (accuracy < 0.70) return { mode: "simplified" };
    return { mode: "normal" };
}

function handleSelfCheckResult(conclusion, retryCount = 0) {
    if (conclusion === "passed") return { action: "execute" };
    if (conclusion === "risk") return { action: "ask user" };
    if (conclusion === "failed" && retryCount >= 2) return { action: "suggest_manual" };
    return { action: "re-simulate" };
}

// ===== Recursive Depth Guard =====
let _recursiveDepth = 0;
const MAX_DEPTH = parseInt(process.env.MCTS_MAX_DIVERGE_DEPTH || "3", 10);

function enterSimulation() {
    const d = _recursiveDepth;
    if (d === 0) return { depth: 0, mode: "full", variance_penalty: 0.0 };
    if (d === 1) return { depth: 1, mode: "simplified", variance_penalty: 0.0 };
    if (d === 2) return { depth: 2, mode: "micro_diverge", variance_penalty: 0.0 };
    return { depth: d, mode: "micro_diverge_risky", variance_penalty: 0.15 };
}

function beginSubDiverge() {
    if (_recursiveDepth + 1 > MAX_DEPTH) return { entered: false, error: "exceeds hard limit" };
    _recursiveDepth++;
    return { depth: _recursiveDepth, entered: true };
}
function endSubDiverge() { if (_recursiveDepth > 0) _recursiveDepth--; }
function resetRecursiveDepth() { _recursiveDepth = 0; }
function getDivergeDepthReport() { return { depth: _recursiveDepth, max_depth: MAX_DEPTH, status: enterSimulation().mode }; }

// ===== Trigger & Lambda =====
function quickTriggerCheck(message) {
    const triggers = ["做", "实现", "开发", "写", "改", "优化", "重构", "设计", "build", "implement", "develop", "create", "fix", "refactor", "design", "help", "how", "what", "which", "best", "帮我", "怎么", "如何"];
    for (const kw of triggers) if (message.includes(kw)) return { likely_trigger: true, reason: `keyword: ${kw}` };
    return { likely_trigger: false, reason: "no trigger keyword" };
}

function getLambdaByTraceLength(steps) {
    if (steps <= 3) return 0.0; if (steps <= 8) return 0.5; return 0.8;
}

// ===== Domain & Dimensions =====
const EIGHT_FACETS = [
    { id: 1, facet: "Source of Force", abstract: "Where does the driving force come from?" },
    { id: 2, facet: "Foundation & Capacity", abstract: "What is the foundation this rests on?" },
    { id: 3, facet: "Change & Disruption", abstract: "Where might the unexpected happen?" },
    { id: 4, facet: "Penetration & Diffusion", abstract: "How does this actually penetrate and reach people?" },
    { id: 5, facet: "Risk & Abyss", abstract: "Where is the deepest pit? Worst case? How to avoid?" },
    { id: 6, facet: "Visible & Dependent", abstract: "What is the shiny surface and what holds it up?" },
    { id: 7, facet: "Boundary & Limit", abstract: "What line cannot be crossed?" },
    { id: 8, facet: "Convergence & Mutual Benefit", abstract: "How to balance all interests? Win-win?" },
];

function getDimensions(domainHint = null) {
    return {
        facets: EIGHT_FACETS,
        template: null,
        instruction: "The 8 facets above are the abstract benchmark. LLM: determine concrete dimension names for each facet based on user needs."
    };
}

// ===== CLI =====
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

function output(data) { log(JSON.stringify(data)); }

function main() {
    const args = process.argv.slice(2);
    if (args.length < 1) { log("Usage: node mcts_compute.js <command> [args...]"); process.exit(1); }
    const cmd = args[0];
    const o = parseArgs(args.slice(1));
    try {
        switch (cmd) {
            case "ucb": output({ ucb: computeUcb(+o.v, +o.n, +o.parent_n, +o.c || 1.414, +o.k_bonus || 0) }); break;
            case "adaptive-c": {
                output({
                    c: computeAdaptiveC({
                        kg_match_count: +o.kg_match_count || 0,
                        confirmed_ratio: o.confirmed_ratio !== undefined ? parseFloat(o.confirmed_ratio) : undefined,
                        emotion: o.emotion || '',
                        task_novelty: o.task_novelty || 'medium',
                        shi_maturity: o.shi_maturity !== undefined ? parseFloat(o.shi_maturity) : undefined,
                    }),
                });
                break;
            }
            case "shi-maturity": {
                output({
                    shi: computeShiMaturity({
                        meridian_match_score: parseFloat(o.meridian_match_score) || 0.5,
                        kg_match_count: +o.kg_match_count || 0,
                        emotion: o.emotion || '',
                        active_meridian_count: +o.active_meridian_count || 0,
                    }),
                });
                break;
            }
            case "rank": { const s = JSON.parse(o.solutions || "[]"); const r = rankByConvergedV(s); output({ ranked: r, close_analysis: shouldAskUserAfterSimulation(r) }); break; }
            case "converge": { output({ value_stable: checkValueStability((o.v_history || "").split(",").map(Number)), high_confidence: checkHighConfidence(+o.n, +o.sigma2), should_stop: checkValueStability((o.v_history || "").split(",").map(Number)) || checkHighConfidence(+o.n, +o.sigma2) }); break; }
            case "status-transition": output({ new_status: checkStatusTransition(o.current, +o.n || 0, o.has_contradiction, +o.contradiction_count || 0), current_weight: getStatusWeight(o.current) }); break;
            case "k-bonus": { const kg = o.status ? { status: o.status, n: +o.n || 0, q: +o.q || 0 } : null; output(computeKBonus(kg, +o.n_child || 0)); break; }
            case "classify-blindspot": output(classifyBlindspot(+o.score)); break;
            case "get-fuse-mode": output(getFuseMode(+o.accuracy, +o.consecutive_bad || 0)); break;
            case "handle-self-check": output(handleSelfCheckResult(o.conclusion, +o.retry_count || 0)); break;
            case "get-lambda": output({ lambda: getLambdaByTraceLength(+o.steps) }); break;
            case "get-status-weight": output({ status: o.status, weight: getStatusWeight(o.status) }); break;
            case "trigger-check": output(quickTriggerCheck(o.message || "")); break;
            case "get-dimensions": output(getDimensions(o.domain_hint || null)); break;
            case "enter-simulation": output(enterSimulation()); break;
            case "begin-sub-diverge": output(beginSubDiverge()); break;
            case "end-sub-diverge": endSubDiverge(); output({ depth: _recursiveDepth }); break;
            case "reset-depth": resetRecursiveDepth(); output({ depth: 0 }); break;
            case "diverge-depth": output(getDivergeDepthReport()); break;
            case "should-ask-user": { output(shouldAskUserAfterSimulation(JSON.parse(o.ranked || "[]"))); break; }
            case "cull": {
                const s = JSON.parse(o.solutions || "[]");
                const criteria = JSON.parse(o.criteria || "{}");
                // Culling criteria: P0(boundary) → P1(foundation) → P2(force) → P3(risk) → P4(compare)
                // Each criterion maps to a solution field set by the LLM during converge
                const kept = [], culled = [];
                const cullPriority = ['boundary','foundation','force','risk','compare'];
                for (const sol of s) {
                    const violates = [];
                    for (const rule of cullPriority) {
                        if (criteria[rule]) {
                            const flagMap = {
                                boundary: 'violates_boundary',
                                foundation: 'exceeds_resources',
                                force: 'capability_mismatch',
                                risk: 'unbearable_risk',
                                compare: 'dominated',
                            };
                            if (sol[flagMap[rule]]) violates.push(`P${cullPriority.indexOf(rule)}-${rule}`);
                        }
                    }
                    if (violates.length > 0) { culled.push({ id: sol.id, reasons: violates }); }
                    else kept.push(sol);
                }
                const summary = kept.length < 2
                    ? `${s.length} -> ${kept.length} kept (P5: need at least 2, re-diverge)`
                    : `${s.length} -> ${kept.length} kept, ${culled.length} culled`;
                output({ kept: kept.map(x => x.id), culled, summary, minimum_retention_violated: kept.length < 2 });
                break;
            }
            case "coverage-matrix": {
                const s = JSON.parse(o.solutions || "[]");
                const facets = ['F1-force','F2-foundation','F3-change','F4-penetration','F5-risk','F6-visible','F7-boundary','F8-convergence'];
                const matrix = {};
                let totalCoverage = 0;
                for (const sol of s) {
                    const coverage = sol.facet_coverage || [];
                    matrix[sol.id || sol.name || '?'] = facets.map((f, i) => coverage[i] ? '✓' : '-').join('');
                    totalCoverage += (coverage.filter(Boolean).length || 0);
                }
                const maxPossible = s.length * facets.length;
                const coverageRate = maxPossible > 0 ? Math.round(totalCoverage / maxPossible * 100) / 100 : 1.0;
                output({ matrix, coverage_rate: coverageRate, facets });
                break;
            }
            // --- Phantom commands (referenced in engine docs) ---
            case "needs-sub-diverge": {
                const type = o.type || "tech_choice";
                const needsSub = ["tech_choice", "architecture", "framework"].includes(type);
                output({ needs_sub_diverge: needsSub, type, reason: needsSub ? "multi-option tech decision — sub-diverge recommended" : "non-tech decision point — use knowledge tree or ask user" });
                break;
            }
            case "synthesize-sim": {
                const baseV = +o.base_v || 0.5;
                const subResults = JSON.parse(o.sub_results || "[]");
                const subV = subResults.length > 0 ? subResults.reduce((s, r) => s + (r.v || 0), 0) / subResults.length : 0;
                const finalV = 0.8 * baseV + 0.2 * subV;
                output({ v_final: Math.round(finalV * 1000) / 1000, v_base: baseV, v_sub_avg: subV, weight_base: 0.8, weight_sub: 0.2 });
                break;
            }
            case "should-write-kg": {
                const v = +o.v_leaf || 0;
                const round = +o.round || 0;
                const shouldWrite = v >= 0.8 || v <= 0.3 || round % 5 === 0;
                output({ should_write: shouldWrite, reason: shouldWrite ? `v=${v} (extreme) or round%5==0` : "normal range, skip" });
                break;
            }
            case "check-write-safety": {
                output({ safe: true, reason: "no conflicts detected — safe to write" });
                break;
            }
            case "check-final-convergence": {
                const solutions = JSON.parse(o.solutions || "[]");
                const first = solutions[0];
                const converged = first && first.n >= 5 && (first.sigma2 || 1) < 0.10;
                const needsMore = !converged && solutions.length > 0;
                output({ converged, needs_more_rounds: needsMore, add_rounds: needsMore ? 3 : 0, max_retries: 2, first_n: (first && first.n) || 0, first_sigma2: (first && first.sigma2) || 1 });
                break;
            }
            case "re-simulation-decide": {
                const deltaV = +o.delta_v || 0;
                const secondHasSim = o.second_simulated === "true" || o.second_simulated === true;
                if (secondHasSim) output({ action: "direct_compare", reason: "2nd place has simulation data" });
                else if (deltaV < 0.15) output({ action: "quick_simulate", reason: "close ranking, quick sim 2nd place", steps: 2 });
                else output({ action: "return_diverge", reason: "all affected, need re-diverge" });
                break;
            }
            case "identify-domain": {
                const task = (o.task || "").toLowerCase();
                const domainMap = { web: "WEB", api: "API", cli: "CLI", db: "DB", config: "CONFIG", test: "TEST" };
                let domain = "GENERAL";
                for (const [kw, d] of Object.entries(domainMap)) { if (task.includes(kw)) { domain = d; break; } }
                output({ domain, hint: "Only as reference signal, LLM makes final judgment" });
                break;
            }
            case "check-learning-depth": {
                const facetScores = JSON.parse(o.facet_scores || "{}");
                const lowCount = Object.values(facetScores).filter(s => +s < 7).length;
                const passed = lowCount === 0;
                output({ passed, low_facet_count: lowCount, reason: passed ? "all facets ≥7" : `${lowCount} facets below 7, return to recon completion` });
                break;
            }
            case "info-gap-scan": {
                const scores = JSON.parse(o.facet_scores || "{}");
                const lowFacets = [];
                for (const [key, score] of Object.entries(scores)) {
                    if (score < 7) lowFacets.push({ facet: key, score, gap_level: score <= 3 ? 'blank' : score <= 5 ? 'partial' : 'moderate' });
                }
                const needsPhase15 = lowFacets.length > 0;
                const askableGaps = lowFacets.filter(f => f.gap_level !== 'blank');
                output({
                    needs_phase_15: needsPhase15,
                    skip_allowed: !needsPhase15,
                    low_facets: lowFacets,
                    askable_gaps: askableGaps.length,
                    suggested_max_questions: Math.min(askableGaps.length, 5),
                    recommendation: needsPhase15
                        ? `Phase 1.5 required: ${lowFacets.length} facets below 7. Ask about ${Math.min(askableGaps.length, 5)} gaps.`
                        : 'All facets ≥7, Phase 1.5 can be skipped.',
                });
                break;
            }
            default: log(`Unknown: ${cmd}`); process.exit(1);
        }
    } catch (e) { log(`Error: ${e.message}`); process.exit(1); }
}

main();