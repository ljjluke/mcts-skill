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
        return;
    }

    const cmd = args[0];
    try {
        switch (cmd) {
            case "deqi": {
                const kg = loadMMA(), query = JSON.parse(args[1] || "{}"), ctx = JSON.parse(args[2] || "{}");
                const results = deqi(kg, query, ctx);
                recordCoOccurrence(kg, results.map(r => r.point.id));
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
            case "observe": {
                // Unified observe command for Memory Agent checkpoints
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

main();

/**
 * 一键观察点路由 — Memory Agent 5 checkpoints
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
            recordCoOccurrence(kg, recalled.map(r => r.point.id));
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
        return { phase, error: `Memory Agent observe failed: ${e.message}`, safe: true };
    }
}

module.exports = {
    loadMMA, saveMMA, freshKG,
    deqi, ashiInsert, reinforceReduce,
    ziwuLiuzhu, decayCheck, sessionEnd, experienceReplay,
    recordCoOccurrence, clusterDetect, getStatus,
};
