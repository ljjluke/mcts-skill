#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════
 *  MMA — Meridian Memory Algorithm (经络记忆算法)
 *  "刺之要，气至而有效" —《灵枢·九针十二原》
 * ═══════════════════════════════════════════════════════════════
 *
 *  Inspired by the human meridian system from the Yellow Emperor's
 *  Inner Canon (《黄帝内经》). Knowledge flows through 12 primary
 *  meridians like qi through channels.
 *
 *  认知科学优化 (7 modules):
 *    🧠 情绪调制器    — 七情强度决定记忆初始巩固分
 *    🧠 三焦工作记忆  — 上焦7(刚用过) / 中焦(本会话) / 下焦(历史)
 *    🧠 隐穴机制      — 遗忘≠删除，标记hidden可被唤醒
 *    🧠 经气预热      — 上次召回的经脉有启动效应(+0.15)
 *    🧠 阴阳对冲      — 同经脉tags重叠>50%+结论矛盾→DISPUTED
 *    🧠 睡眠回放      — 会话结束时加速回放+情绪筛选巩固
 *    🧠 腧穴集群      — 共现≥3次自动形成知识组块(chunking)
 *
 *  Usage: node meridian_memory.js <command> [args...]
 */

const { log } = console;
const {
    loadMMA, saveMMA, freshKG,
    loadWorkingMemory, saveWorkingMemory
} = require('./mma/io');
const { deqi } = require('./mma/deqi');
const { ashiInsert } = require('./mma/ashi');
const { reinforceReduce } = require('./mma/reinforce');
const { ziwuLiuzhu } = require('./mma/ziwu');
const { decayCheck, sessionEnd, experienceReplay } = require('./mma/decay');
const { recordCoOccurrence, clusterDetect } = require('./mma/cluster');
const { getStatus, computeFourImages } = require('./mma/status');
const { batchDiagnose } = require('./mma/diagnosis');
const { fullAudit } = require('./mma/audit');

function output(obj) { log(JSON.stringify(obj, null, 2)); }

function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        log("MMA — Meridian Memory Algorithm (经络记忆算法)");
        log("  Deqi · Ziwu Liuzhu · Propagated Sensation · Reinforce/Reduce · Ashi");
        log("  Emotion Modulation · Triple Burner Working Memory · Hidden Acupoint · Priming · Yin-Yang Conflict · Sleep Replay · Acupoint Clusters");
        log("");
        log("Usage: node meridian_memory.js <command> [args]");
        log("  deqi      <query_json> [context_json]  — Deqi recall");
        log("  ashi      <entry_json>                  — Ashi acupoint insert");
        log("  reinforce <point_id> <td_error> [exp_json] — Tonify/Drain update");
        log("  ziwu      [context_json]               — Ziwu Liuzhu");
        log("  status                                  — System status");
        log("  four-images                             — Four Images diagnosis");
        log("  diagnose  <query_json> [context_json]   — Eight-Principle diagnosis");
        log("  decay                                   — Decay check");
        log("  replay    [limit]                       — Experience replay");
        log("  session-end <session_json>              — Session end consolidation");
        log("  cluster                                 — Acupoint cluster detection");
        log("  observe   --phase <name> [--data json]   — Observe point route");
        log("  load                                    — Load KG");
        log("  audit     [context_tags_json]            — Full knowledge audit (completeness/contradiction/staleness/five-element)");
        log("  interact                                — Run five-element propagation across all knowledge");
        log("  capture-divergence <insights_json>       — Store divergence insights as knowledge points");
        return;
    }

    const cmd = args[0];
    try {
        switch (cmd) {
            case "deqi": {
                const kg = loadMMA(), query = JSON.parse(args[1] || "{}"), ctx = JSON.parse(args[2] || "{}");
                const results = deqi(kg, query, ctx);
                // 只记录原始召回来源的共现，排除 propagated/paired/hexagram_evolution
                const directIds = results
                    .filter(r => !r.propagated_from && !r.evolved_from && r.source !== 'propagation' && r.source !== 'paired' && r.source !== 'hexagram_evolution')
                    .map(r => r.point.id);
                recordCoOccurrence(kg, directIds);
                saveMMA(kg);
                output({ count: results.length, results });
                break;
            }
            case "ashi": {
                const kg = loadMMA(), entry = JSON.parse(args[1] || "{}");
                const result = ashiInsert(kg, entry);
                saveMMA(kg); output(result); break;
            }
            case "reinforce": {
                const kg = loadMMA();
                const result = reinforceReduce(kg, args[1], parseFloat(args[2]), JSON.parse(args[3] || "{}"));
                saveMMA(kg); output(result); break;
            }
            case "ziwu": {
                const kg = loadMMA();
                output(ziwuLiuzhu(kg, JSON.parse(args[1] || "{}"))); break;
            }
            case "status": {
                output(getStatus(loadMMA())); break;
            }
            case "four-images": {
                output(computeFourImages(loadMMA())); break;
            }
            case "diagnose": {
                const kg = loadMMA(), query = JSON.parse(args[1] || "{}"), ctx = JSON.parse(args[2] || "{}");
                const recalled = deqi(kg, query, ctx);
                const diag = batchDiagnose(kg, recalled, ctx);
                output(diag); break;
            }
            case "decay": {
                const kg = loadMMA();
                const result = decayCheck(kg);
                saveMMA(kg); output(result); break;
            }
            case "replay": {
                output(experienceReplay(loadMMA(), parseInt(args[1]) || 10)); break;
            }
            case "session-end": {
                const kg = loadMMA(), session = JSON.parse(args[1] || "{}");
                const result = sessionEnd(kg, session.points || [], session.emotions || []);
                saveMMA(kg); output(result); break;
            }
            case "cluster": {
                const kg = loadMMA();
                const result = clusterDetect(kg);
                saveMMA(kg); output(result); break;
            }
            case "load": {
                output(loadMMA()); break;
            }
            case "audit": {
                const kg = loadMMA();
                const ctxTags = JSON.parse(args[1] || "[]");
                const report = fullAudit(kg, Array.isArray(ctxTags) ? ctxTags : []);
                saveMMA(kg); output(report); break;
            }
            case "interact": {
                // 手动触发五行生克传播 + 跨知识关系维护
                const kg = loadMMA();
                const { linkRelatedKnowledge } = require('./mma/reinforce');
                let totalActions = 0;
                for (const [key, m] of Object.entries(kg.meridians)) {
                    for (const p of m.points) {
                        if (p.hidden) continue;
                        linkRelatedKnowledge(kg, key, p);
                        totalActions++;
                    }
                }
                saveMMA(kg);
                output({ status: 'interaction_complete', points_processed: totalActions });
                break;
            }
            case "capture-divergence": {
                // 发散阶段洞察 → 存储为语义知识
                const kg = loadMMA();
                const insights = JSON.parse(args[1] || "[]");
                if (!Array.isArray(insights)) {
                    output({ error: 'insights must be a JSON array' }); break;
                }
                const stored = [];
                for (const ins of insights) {
                    if (!ins.description) continue;
                    const entry = {
                        description: ins.description,
                        tags: ins.tags || ['divergence', ins.phase || 'unknown'],
                        category: 'tools_and_means',
                        emotion: ins.emotion || 'neutral',
                        source: ins.source || 'divergence_insight',
                        q: ins.q || 0.6,
                        memory_type: 'semantic',
                        v_insight: ins.value || 0.6,
                        divergence_phase: ins.phase || 'general',
                        related_facet: ins.facet || null,
                    };
                    const result = require('./mma/ashi').ashiInsert(kg, entry);
                    if (result && !result.rejected) {
                        stored.push({ id: result.point.id, desc: ins.description.substring(0, 40) });
                    }
                }
                if (stored.length > 0) {
                    const { clusterDetect } = require('./mma/cluster');
                    clusterDetect(kg);
                    saveMMA(kg);
                }
                output({ stored: stored.length, points: stored });
                break;
            }
            // ─── Smart Commands (auto-layer, original commands preserved) ───
            case "remember": {
                // 自动判断场景: 存知识/记习惯/存洞察/收尾
                const data = JSON.parse(args[1] || "{}");
                const kg = loadMMA();
                let result = {};
                if (data.tags && data.description && !data.behavior) {
                    // 存知识 (ashi)
                    result = ashiInsert(kg, data);
                    saveMMA(kg);
                } else if (data.behavior) {
                    // 记习惯 (profile observe)
                    const up = require('./mma/user_profile');
                    const profile = up.loadProfile('default');
                    const r = up.observeBehavior(profile, data.behavior);
                    up.saveProfile(profile);
                    result = r;
                } else if (data.phase && data.description) {
                    // 存发散洞察 (capture-divergence)
                    const entries = Array.isArray(data) ? data : [data];
                    const stored = [];
                    for (const ins of entries) {
                        if (!ins.description) continue;
                        const entry = { description: ins.description, tags: ins.tags || ['divergence', ins.phase], category: 'tools_and_means', emotion: ins.emotion || 'neutral', source: ins.source || 'divergence_insight', q: ins.q || 0.6, memory_type: 'semantic' };
                        const r2 = ashiInsert(kg, entry);
                        if (r2 && !r2.rejected) stored.push({ id: r2.point?.id, desc: ins.description.substring(0, 40) });
                    }
                    if (stored.length > 0) { clusterDetect(kg); saveMMA(kg); }
                    result = { stored: stored.length, points: stored };
                }
                output(result);
                break;
            }
            case "recall": {
                // 智能召回: 上下文+情绪+经脉一次搞定
                const query = JSON.parse(args[1] || "{}");
                const ctx = JSON.parse(args[2] || "{}");
                const kg = loadMMA();
                if (ctx.task_type || ctx.domain || ctx.emotion) query.context = ctx;
                const results = deqi(kg, query, ctx);
                const top = results.slice(0, query.limit || 5);
                const insights = top.map(r => ({
                    id: r.point.id, description: r.point.description?.substring(0, 80), score: Math.round(r.deqi_score * 100) / 100, source: r.source, context_match: r.context_match || false, emotion_match: r.emotion_match || false, meridian: r.meridian_name, tags: r.point.tags,
                }));
                output({ count: insights.length, results: insights });
                break;
            }
            case "finalize": {
                // 一键收尾: session-end + profile infer + MMA save
                const session = JSON.parse(args[1] || "{}");
                const kg = loadMMA();
                const sessionResult = sessionEnd(kg, session.points || [], session.emotions || []);
                const up = require('./mma/user_profile');
                const profile = up.loadProfile('default');
                if (session.points?.length > 0) { up.logInteraction(profile, 'session', `Processed ${session.points.length} points`); }
                // 自动推断人格
                if (Object.values(profile.observations || {}).some(v => v >= 2)) {
                    try { up.inferWuxingType(profile, JSON.parse(session.signals || "{}") || {}); } catch(e) {}
                }
                up.saveProfile(profile);
                clusterDetect(kg);
                saveMMA(kg);
                const pInfo = up.getFormatAdjustments(profile);
                output({ session: { replayed: sessionResult.replayed, cycles: sessionResult.cycles }, profile: { style: profile.preferences.output_style, type: profile.personality.wuxing_type }, adjustments: pInfo.adjustments || pInfo });
                break;
            }
            case "observe": {
                // Unified observe command for memory lifecycle checkpoints
                const phase = args[args.indexOf('--phase') + 1] || null;
                const dataIdx = args.indexOf('--data');
                const data = dataIdx >= 0 ? JSON.parse(args[dataIdx + 1] || "{}") : {};
                const result = observeRoute(phase, data);
                output(result); break;
            }
            default:
                log(`Unknown: ${cmd}`); process.exit(1);
        }
    } catch (e) {
        log(`Error: ${e.message}`); process.exit(1);
    }
}

if (require.main === module) main();

/**
 * 一键观察点路由 — memory lifecycle checkpoints
 * Routes to correct MMA operation based on phase name
 */
function observeRoute(phase, data) {
    try {
        const kg = loadMMA();
        let result;
        switch (phase) {
        case 'pre_engine': {
            // ① Recall relevant memories, note V_predicted
            const query = data.query || { limit: 5 };
            const ctx = data.context || {};
            const recalled = deqi(kg, query, ctx);
            const directIds = recalled
                .filter(r => !r.propagated_from && !r.evolved_from && r.source !== 'propagation' && r.source !== 'paired' && r.source !== 'hexagram_evolution')
                .map(r => r.point.id);
            recordCoOccurrence(kg, directIds);
            result = {
                phase: 'pre_engine',
                recalled: recalled.length,
                top_v_predicted: recalled.slice(0, 3).map(r => ({
                    point_id: r.point.id,
                    v_predicted: r.point.q || 0.5,
                    sigma2: r.point.sigma2 || 0.25,
                    meridian: r.meridian_name,
                })),
                cold_start: recalled.length === 0,
            };
            break;
        }
        case 'during_diverge': {
            // ② Perceive emotions, build timeline
            const emotion = data.emotion || 'neutral';
            const meridian = data.meridian || null;
            result = {
                phase: 'during_diverge',
                emotion_detected: emotion,
                meridian_matched: meridian,
                emotion_boost: (require('./mma/constants').EMOTION_CONSOLIDATION[emotion] || { boost: 2 }).boost,
                recorded: true,
            };
            break;
        }
        case 'post_simulate': {
            // ③ Record new knowledge as Ashi points
            const entries = data.entries || [data];
            const inserted = [];
            for (const entry of entries) {
                if (entry.description) {
                    const r = ashiInsert(kg, entry);
                    if (r) inserted.push({ point_id: r.point.id, meridian: r.meridian_name, conflict: r.conflict });
                }
            }
            // Also run cluster detect
            const clusters = clusterDetect(kg);
            result = {
                phase: 'post_simulate',
                inserted: inserted.length,
                points: inserted,
                new_clusters: clusters.length,
            };
            break;
        }
        case 'pre_converge': {
            // ④ Detect Yin-Yang conflicts
            const conflicts = [];
            for (const [key, m] of Object.entries(kg.meridians)) {
                for (const p of m.points) {
                    if (p.status === 'DISPUTED' && !p.hidden) {
                        conflicts.push({
                            point_id: p.id,
                            description: p.description,
                            conflict_with: p.conflict_with,
                            reason: p.conflict_reason,
                            meridian: m.name,
                        });
                    }
                }
            }
            result = {
                phase: 'pre_converge',
                conflicts_found: conflicts.length,
                should_alert: conflicts.length > 0,
                conflicts,
            };
            break;
        }
        case 'post_execution': {
            // ⑤ TD closed loop + decay + session consolidation
            const updates = [];
            if (data.td_updates) {
                for (const upd of data.td_updates) {
                    const r = reinforceReduce(kg, upd.point_id, upd.td_error, upd.experience || {});
                    if (r) updates.push({ point_id: upd.point_id, technique: r.technique, new_q: r.newQ });
                }
            }
            const decayed = decayCheck(kg);
            if (data.session_points && data.session_points.length > 0) {
                const sessionResult = sessionEnd(kg, data.session_points, data.session_emotions || []);
                result = {
                    phase: 'post_execution',
                    td_updates: updates.length,
                    techniques: updates,
                    decayed: decayed.length,
                    session_replayed: sessionResult.replayed,
                };
            } else {
                result = {
                    phase: 'post_execution',
                    td_updates: updates.length,
                    techniques: updates,
                    decayed: decayed.length,
                };
            }
            break;
        }
        case 'session_end': {
            const sessionResult = sessionEnd(kg, data.points || [], data.emotions || []);
            decayCheck(kg);
            clusterDetect(kg);
            result = {
                phase: 'session_end',
                replayed: sessionResult.replayed,
                decayed: sessionResult.decayed,
                status: getStatus(kg),
            };
            break;
        }
        default:
            result = { error: `Unknown phase: ${phase}`, valid: ['pre_engine', 'during_diverge', 'post_simulate', 'pre_converge', 'post_execution', 'session_end'] };
    }
    saveMMA(kg);
    return result;
    } catch (e) {
        return { phase, error: `Memory lifecycle observation failed: ${e.message}`, safe: true };
    }
}

module.exports = {
    loadMMA, saveMMA, freshKG,
    deqi, ashiInsert, reinforceReduce,
    ziwuLiuzhu, decayCheck, sessionEnd, experienceReplay,
    recordCoOccurrence, clusterDetect, getStatus,
};
