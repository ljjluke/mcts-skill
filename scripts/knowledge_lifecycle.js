#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════
 *  MCTS-TD Memory Agent — Three-Stage Knowledge Lifecycle
 *  "上善若水 · 为道日损 · 无为之用"
 * ═══════════════════════════════════════════════════════════════
 *
 *  Stage 1: PERCEIVE (上善若水) — Absorb like water, without effort
 *    Auto-detect signals from conversation flow. No explicit "remember this" needed.
 *    Five signal types: preference, repetition, emotion, contradiction, silent-consensus.
 *
 *  Stage 2: REFINE (为道日损) — The Dao of memory is subtraction
 *    Knowledge is not a warehouse, it's a refinery.
 *    Associate → Induce → Detect conflicts → Abstract → Forget.
 *    Periodic self-reflection: "Is what I know still true?"
 *
 *  Stage 3: RECALL (无为之用) — The use of not-forcing
 *    Memory surfaces naturally when context matches. Not actively queried.
 *    Context-triggered → Associative chain → Verify old knowledge → Emotional priority.
 *
 *  Usage: node knowledge_lifecycle.js <command> [args...]
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { log } = console;

// ===== Paths =====
const DATA_DIR = path.join(os.homedir(), '.claude', 'data', 'skills', 'mcts-td-planner');
const MEMORY_DIR = path.join(DATA_DIR, 'memory');
const ACTIVE_FILE = path.join(MEMORY_DIR, 'mcts-td-value-archive.md');
const ARCHIVE_DIR = path.join(MEMORY_DIR, 'archive');

function ensureDirs() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
    if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
}

function loadKG() {
    ensureDirs();
    if (!fs.existsSync(ACTIVE_FILE)) return [];
    try {
        const raw = fs.readFileSync(ACTIVE_FILE, 'utf-8');
        // Parse markdown table entries
        const entries = [];
        const lines = raw.split('\n');
        let inTable = false;
        for (const line of lines) {
            if (line.startsWith('| ID |')) { inTable = true; continue; }
            if (line.startsWith('|---')) continue;
            if (inTable && line.startsWith('| K')) {
                const cols = line.split('|').map(c => c.trim()).filter(Boolean);
                if (cols.length >= 10) {
                    entries.push({
                        id: cols[0],
                        feature_key: cols[1],
                        q: parseFloat(cols[2]) || 0,
                        sigma2: parseFloat(cols[3]) || 0.25,
                        n: parseInt(cols[4]) || 0,
                        status: cols[5] || 'HYPOTHESIS',
                        tags: (cols[6] || '').replace(/[\[\]"]/g, '').split(',').map(t => t.trim()).filter(Boolean),
                        context_json: cols[7] || '{}',
                        consolidation_score: parseInt(cols[8]) || 0,
                        created_at: cols[9] || new Date().toISOString(),
                        last_verified: cols[10] || cols[9] || new Date().toISOString(),
                    });
                }
            }
        }
        return entries;
    } catch (e) { return []; }
}

function saveKG(entries) {
    ensureDirs();
    const header = [
        '---',
        'name: mcts-td-value-archive',
        'description: MCTS-TD Memory Agent knowledge graph (auto-managed by knowledge_lifecycle.js)',
        'metadata:',
        '  type: reference',
        '---',
        '',
        '# MCTS-TD Value Function Archive',
        '',
        '## Knowledge Entry Table',
        '',
        '| ID | Feature | q | σ² | n | Status | tags | Context | Consolidation | Created | Last Verified |',
        '|----|---------|---|----|----|--------|------|---------|---------------|---------|---------------|',
    ];
    for (const e of entries) {
        const tags = e.tags && e.tags.length > 0 ? `["${e.tags.join('","')}"]` : '';
        header.push(`| ${e.id} | ${e.feature_key || ''} | ${e.q?.toFixed(2) || '0.00'} | ${e.sigma2?.toFixed(2) || '0.25'} | ${e.n || 0} | ${e.status || 'HYPOTHESIS'} | ${tags} | ${e.context_json || '{}'} | ${e.consolidation_score || 0} | ${e.created_at || ''} | ${e.last_verified || ''} |`);
    }
    header.push('');
    fs.writeFileSync(ACTIVE_FILE, header.join('\n'), 'utf-8');
}

// ═══════════════════════════════════════════════════════════════
//  STAGE 1: PERCEIVE (上善若水 + 听之以气 + 察言观色 + 揣摩)
// ═══════════════════════════════════════════════════════════════

function perceiveSignals(conversationHistory) {
    /**
     * "上善若水" — Like water, absorb without demanding.
     * "听之以气" — Listen with qi, not with ears. Feel the rhythm, tone, what's unsaid.
     * "察言观色" — Observe what the user settles on. What they return to. What they avoid.
     * "揣摩" — Gauge real intent through feedback loops (accept/modify/reject).
     *
     * Five perception dimensions, each with weighted sub-signals:
     *
     *   DIMENSION 1: 言语信号 (What is said)
     *     - Frequency: repeated topics → concern depth
     *     - Emphasis: strong modifiers ("must"/"绝对不能") → priority weight
     *     - Vagueness: hedging ("maybe"/"差不多") → uncertainty zone
     *
     *   DIMENSION 2: 情感信号 (How it is said)
     *     - Excitement: superlatives, exclamation, emoji density → satisfaction surge
     *     - Frustration: negation chains, brevity, repetition of failures → pain point
     *     - Relief: "终于/finally" pattern → bottleneck identified
     *     - Indifference: minimal response, topic shift → low priority signal
     *
     *   DIMENSION 3: 行为信号 (What the user does)
     *     - Accept rate: how often user accepts vs modifies suggestions
     *     - Override: user explicitly overrides AI choice → strong preference
     *     - Return: user comes back to same topic across sessions → core concern
     *     - Abandon: topic dropped mid-discussion → lost interest or resolved
     *
     *   DIMENSION 4: 沉默信号 (What is NOT said)
     *     - Skip: user skips a question → area they don't care about
     *     - Avoid: topic mentioned by AI but user changes subject → sensitive area
     *     - Assume: user doesn't question an AI assumption → it was correct
     *     - Quiet accept: user says "继续/go on" without modification → trust signal
     *
     *   DIMENSION 5: 节奏信号 (The rhythm of interaction)
     *     - Pace: rapid replies → engaged; long pauses → thinking or disengaged
     *     - Depth: short answers → surface level; long elaborations → deep engagement
     *     - Escalation: user asks increasingly detailed follow-ups → growing trust
     *     - De-escalation: user simplifies requests → fatigue or clarity found
     */
    const signals = [];
    const messages = Array.isArray(conversationHistory) ? conversationHistory : [];
    if (messages.length === 0) return signals;

    // Helper
    const textOf = (msg) => typeof msg === 'string' ? msg : (msg.content || msg.message || msg.role || '');
    const roleOf = (msg) => msg.role || (typeof msg === 'string' ? 'user' : 'user');
    const userMsgs = messages.filter(m => roleOf(m) === 'user');
    const aiMsgs = messages.filter(m => roleOf(m) === 'assistant');
    const allText = userMsgs.map(textOf).join('\n');

    // ═══════════════════════════════════════════════════════════
    //  DIMENSION 1: 言语信号 (What is said)
    // ═══════════════════════════════════════════════════════════

    // 1a. Frequency: topic → depth of concern
    const wordFreq = {};
    for (const msg of userMsgs) {
        const words = textOf(msg).toLowerCase().split(/\s+/).filter(w => w.length > 3);
        for (const w of [...new Set(words)]) wordFreq[w] = (wordFreq[w] || 0) + 1;
    }
    for (const [word, count] of Object.entries(wordFreq)) {
        if (count >= 3) {
            signals.push({ dimension: "speech", type: "FREQUENT_TOPIC", content: word, strength: Math.min(count * 0.15, 0.6),
                note: `"${word}" appeared ${count} times across messages — deepening concern.` });
        }
    }

    // 1b. Emphasis: strong language → priority
    const emphasisPatterns = [
        { re: /(?:必须|一定要|绝对不能|must|absolutely|cannot|no\s+way|critical|关键|核心)/gi, weight: 0.7 },
        { re: /(?:重要|priority|important|urgent|紧急|尽快)/gi, weight: 0.5 },
        { re: /(?:最好|should|prefer|倾向|偏好)/gi, weight: 0.3 },
    ];
    for (const { re, weight } of emphasisPatterns) {
        const matches = allText.match(re);
        if (matches && matches.length >= 2) {
            const content = [...new Set(matches)].slice(0, 3).join(', ');
            signals.push({ dimension: "speech", type: "EMPHASIS", content, strength: Math.min(weight + matches.length * 0.05, 0.9),
                note: `Strong language pattern detected: "${content}" (${matches.length} occurrences).` });
        }
    }

    // 1c. Vagueness: hedging → uncertainty zone (where user needs help)
    const vaguePattern = /(?:maybe|perhaps|差不多|大概|可能|不太确定|not\s+sure|kind\s+of|sort\s+of|好像|似乎)/gi;
    const vagueMatches = allText.match(vaguePattern);
    if (vagueMatches && vagueMatches.length >= 2) {
        const contexts = [];
        const vagueRe = /(?:maybe|perhaps|差不多|大概|可能|不太确定|not\s+sure|kind\s+of|sort\s+of|好像|似乎)/gi;
        let m;
        while ((m = vagueRe.exec(allText)) !== null) {
            const start = Math.max(0, m.index - 30);
            const end = Math.min(allText.length, m.index + 30);
            contexts.push(allText.substring(start, end).replace(/\n/g, ' '));
        }
        signals.push({ dimension: "speech", type: "UNCERTAINTY_ZONE", content: contexts.slice(0, 3).join(' | '),
            strength: Math.min(vagueMatches.length * 0.1, 0.5),
            note: `User expressed uncertainty ${vagueMatches.length} times — potential knowledge gaps or decision points.` });
    }

    // ═══════════════════════════════════════════════════════════
    //  DIMENSION 2: 情感信号 (How it is said)
    // ═══════════════════════════════════════════════════════════

    // 2a. Excitement → satisfaction markers
    const excitementRe = /(?:太好了|太棒了|完美|非常好|excellent|perfect|amazing|great|awesome|love\s+it|终于|finally|解决了|works|work\s+perfectly)/gi;
    const excitementMatches = allText.match(excitementRe);
    if (excitementMatches && excitementMatches.length > 0) {
        const unique = [...new Set(excitementMatches)];
        signals.push({ dimension: "emotion", type: "EXCITEMENT", content: unique.join(', '),
            strength: Math.min(unique.length * 0.2, 0.8),
            note: `User expressed excitement/satisfaction (${unique.join(', ')}). Marking as positive reinforcement.` });
    }

    // 2b. Frustration → pain points
    const frustrationRe = /(?:不行|不对|太差了|太糟糕|完全不|don'?t\s+work|doesn'?t\s+work|not\s+working|wrong|broken|error|bug|issue|problem|还是不行|又报错|又错了)/gi;
    const frustrationMatches = allText.match(frustrationRe);
    if (frustrationMatches && frustrationMatches.length >= 2) {
        const unique = [...new Set(frustrationMatches)];
        // Find what they're frustrated ABOUT
        const aboutRe = /(?:不行|不对|don'?t\s+work|not\s+working|wrong|broken|error|还是不行).{0,50}/gi;
        const aboutMatches = allText.match(aboutRe)?.slice(0, 3) || [];
        signals.push({ dimension: "emotion", type: "FRUSTRATION", content: aboutMatches.join(' | '),
            strength: Math.min(unique.length * 0.2, 0.8),
            note: `User expressed frustration ${unique.length} times. Pain point area: ${aboutMatches[0] || 'unspecified'}.` });
    }

    // 2c. Relief → bottleneck identified
    const reliefRe = /(?:终于|finally|总算|at\s+last|这才对|原来如此|原来是这样|明白了|懂了|got\s+it|i\s+see|makes\s+sense|有道理)/gi;
    const reliefMatches = allText.match(reliefRe);
    if (reliefMatches && reliefMatches.length > 0) {
        signals.push({ dimension: "emotion", type: "RELIEF", content: [...new Set(reliefMatches)].join(', '),
            strength: Math.min(reliefMatches.length * 0.15, 0.6),
            note: `User expressed relief/understanding — a bottleneck was likely resolved.` });
    }

    // 2d. Indifference → low priority or disengagement
    const indifferencePatterns = {
        minimal_replies: userMsgs.filter(m => textOf(m).length < 5).length,
        rapid_topic_shift: detectTopicShifts(userMsgs),
    };
    if (indifferencePatterns.minimal_replies >= 3) {
        signals.push({ dimension: "emotion", type: "INDIFFERENCE", content: `${indifferencePatterns.minimal_replies} minimal replies`,
            strength: 0.3, note: "User giving very short responses — may be disengaged or topic is low priority." });
    }
    if (indifferencePatterns.rapid_topic_shift >= 2) {
        signals.push({ dimension: "emotion", type: "TOPIC_SHIFT", content: `${indifferencePatterns.rapid_topic_shift} rapid shifts`,
            strength: 0.4, note: "User rapidly changing topics — may be exploring or unsatisfied with current direction." });
    }

    // ═══════════════════════════════════════════════════════════
    //  DIMENSION 3: 行为信号 (What the user does)
    // ═══════════════════════════════════════════════════════════

    // 3a. Override: user explicitly rejects AI suggestion
    const overrideRe = /(?:不要|不用|别|don'?t|no\s+(?!problem|worries|rush)|换个|改成|换成|用.*代替|instead|rather|actually)/gi;
    const overrideMatches = allText.match(overrideRe);
    if (overrideMatches && overrideMatches.length >= 2) {
        signals.push({ dimension: "behavior", type: "OVERRIDE", content: `${overrideMatches.length} overrides`,
            strength: Math.min(overrideMatches.length * 0.15, 0.7),
            note: `User explicitly overrode suggestions ${overrideMatches.length} times — strong preference signals.` });
    }

    // 3b. Return: user comes back to same topic
    if (messages.length >= 4) {
        const firstHalf = userMsgs.slice(0, Math.floor(userMsgs.length / 2)).map(textOf).join(' ');
        const secondHalf = userMsgs.slice(Math.floor(userMsgs.length / 2)).map(textOf).join(' ');
        const firstWords = new Set(firstHalf.toLowerCase().split(/\s+/).filter(w => w.length > 4));
        const secondWords = new Set(secondHalf.toLowerCase().split(/\s+/).filter(w => w.length > 4));
        const persistent = [...firstWords].filter(w => secondWords.has(w));
        if (persistent.length >= 3) {
            signals.push({ dimension: "behavior", type: "PERSISTENT_TOPIC", content: persistent.slice(0, 5).join(', '),
                strength: Math.min(persistent.length * 0.1, 0.7),
                note: `Topics persisting across the conversation: ${persistent.slice(0, 5).join(', ')} — core concerns.` });
        }
    }

    // 3c. Accept rate: how often user accepts vs modifies
    const acceptRe = /(?:好的|ok|yes|对|可以|行|go\s+ahead|继续|good|great|thanks|谢谢|正是|没错|就是这样)/gi;
    const acceptCount = (allText.match(acceptRe) || []).length;
    if (acceptCount >= 3 && overrideMatches && overrideMatches.length < acceptCount) {
        signals.push({ dimension: "behavior", type: "HIGH_ACCEPTANCE", content: `${acceptCount} acceptances vs ${overrideMatches?.length || 0} overrides`,
            strength: 0.5, note: "User accepts suggestions at a high rate — trust building." });
    }

    // ═══════════════════════════════════════════════════════════
    //  DIMENSION 4: 沉默信号 (What is NOT said)
    // ═══════════════════════════════════════════════════════════

    // 4a. Skip: AI asked N questions, user only answered M (< N) → skipped topics are low-priority
    const aiQuestions = aiMsgs.filter(m => (textOf(m).match(/\?/g) || []).length >= 2).length;
    const userResponses = userMsgs.length;
    if (aiQuestions >= 2 && userResponses < aiQuestions * 2) {
        signals.push({ dimension: "silence", type: "SELECTIVE_RESPONSE",
            content: `${aiQuestions} questions asked, ${userResponses} responses given`,
            strength: 0.35, note: "User selectively responding — skipped questions indicate lower priority areas." });
    }

    // 4b. Quiet accept: user says "继续" or equivalent → trust without verification
    const quietAcceptRe = /(?:继续|go\s+on|next|下一个|然后|接着|proceed|keep\s+going)/gi;
    const quietAccepts = (allText.match(quietAcceptRe) || []).length;
    if (quietAccepts >= 2 && acceptCount >= 3) {
        signals.push({ dimension: "silence", type: "QUIET_TRUST", content: `${quietAccepts} quiet continuations`,
            strength: 0.45, note: "User accepts and continues without modification — quiet trust signal." });
    }

    // 4c. Assumption confirmed: AI made an assumption, user didn't question it
    const assumptionRe = /(?:assume|假设|如果|assuming|should\s+be|probably|likely|一般|通常)/gi;
    const assumptionCount = (aiMsgs.map(textOf).join(' ').match(assumptionRe) || []).length;
    if (assumptionCount >= 2 && overrideMatches && overrideMatches.length <= 1) {
        signals.push({ dimension: "silence", type: "UNQUESTIONED_ASSUMPTIONS",
            content: `${assumptionCount} assumptions made, ${overrideMatches?.length || 0} challenged`,
            strength: 0.4, note: "User did not challenge AI assumptions — they were likely correct." });
    }

    // ═══════════════════════════════════════════════════════════
    //  DIMENSION 5: 节奏信号 (The rhythm)
    // ═══════════════════════════════════════════════════════════

    // 5a. Depth: are user's messages getting longer or shorter?
    const userMsgLengths = userMsgs.map(m => textOf(m).length);
    if (userMsgLengths.length >= 3) {
        const first3 = userMsgLengths.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
        const last3 = userMsgLengths.slice(-3).reduce((a, b) => a + b, 0) / 3;
        if (last3 > first3 * 2) {
            signals.push({ dimension: "rhythm", type: "DEEPENING", content: `msg length ${Math.round(first3)} → ${Math.round(last3)}`,
                strength: 0.5, note: "User messages are getting longer — deepening engagement." });
        } else if (last3 < first3 * 0.5) {
            signals.push({ dimension: "rhythm", type: "SHORTENING", content: `msg length ${Math.round(first3)} → ${Math.round(last3)}`,
                strength: 0.4, note: "User messages are getting shorter — may be fatigued or found clarity." });
        }
    }

    // 5b. Escalation: increasingly specific follow-ups
    const specificityRe = /(?:具体|详细|detail|specifically|exactly|precisely|怎么|how|which|哪个|什么|what|为什么|why)/gi;
    const firstHalfSpecific = userMsgs.slice(0, Math.floor(userMsgs.length / 2)).map(textOf).join(' ').match(specificityRe)?.length || 0;
    const secondHalfSpecific = userMsgs.slice(Math.floor(userMsgs.length / 2)).map(textOf).join(' ').match(specificityRe)?.length || 0;
    if (secondHalfSpecific > firstHalfSpecific * 1.5) {
        signals.push({ dimension: "rhythm", type: "ESCALATING_DEPTH",
            content: `specificity ${firstHalfSpecific} → ${secondHalfSpecific}`,
            strength: 0.55, note: "User asking increasingly specific questions — growing trust and engagement." });
    }

    return signals;
}

function detectTopicShifts(userMsgs) {
    let shifts = 0;
    const keywords = [];
    for (let i = 1; i < userMsgs.length; i++) {
        const prev = new Set(textOf(userMsgs[i - 1]).toLowerCase().split(/\s+/).filter(w => w.length > 4));
        const curr = new Set(textOf(userMsgs[i]).toLowerCase().split(/\s+/).filter(w => w.length > 4));
        const overlap = [...prev].filter(w => curr.has(w)).length;
        const total = Math.max(prev.size, curr.size, 1);
        if (overlap / total < 0.2) shifts++;
    }
    return shifts;
}

function textOf(msg) { return typeof msg === 'string' ? msg : (msg.content || msg.message || msg.role || ''); }
function roleOf(msg) { return msg.role || (typeof msg === 'string' ? 'user' : 'user'); }

// ═══════════════════════════════════════════════════════════════
//  STAGE 2: REFINE (为道日损) — Associate, Induce, Abstract, Forget
// ═══════════════════════════════════════════════════════════════

function refineKnowledge(entries) {
    /**
     * "为学日益，为道日损" — Learning adds, the Dao subtracts.
     * Knowledge is not a warehouse. It's a refinery.
     *
     * Operations:
     *   ① ASSOCIATE: find the 2 most related entries for each entry
     *   ② INDUCE: if ≥3 entries share the same pattern, create a higher-level abstraction
     *   ③ DETECT_CONFLICTS: find CONFIRMED entries that contradict each other
     *   ④ ABSTRACT: extract core principles from clusters
     *   ⑤ FORGET: mark entries with strength < 5 and no GC root for natural death
     */
    const report = {
        associations: 0,
        inductions: [],
        conflicts: [],
        abstractions: [],
        natural_deaths: 0,
    };

    // ① ASSOCIATE: build a similarity graph
    for (let i = 0; i < entries.length; i++) {
        const a = entries[i];
        const related = [];
        for (let j = 0; j < entries.length; j++) {
            if (i === j) continue;
            const b = entries[j];
            const aTags = new Set(a.tags || []);
            const bTags = new Set(b.tags || []);
            const overlap = [...aTags].filter(t => bTags.has(t)).length;
            const total = aTags.size + bTags.size - overlap || 1;
            if (overlap / total > 0.4) related.push(b.id);
        }
        if (related.length > 0) {
            a.related_to = related.slice(0, 3);
            report.associations++;
        }
    }

    // ② INDUCE: find clusters of ≥3 entries with shared pattern
    const byFeature = {};
    for (const e of entries) {
        const fk = e.feature_key || '';
        if (!byFeature[fk]) byFeature[fk] = [];
        byFeature[fk].push(e);
    }
    for (const [fk, cluster] of Object.entries(byFeature)) {
        if (cluster.length >= 3) {
            const avgQ = cluster.reduce((s, e) => s + (e.q || 0), 0) / cluster.length;
            const avgN = cluster.reduce((s, e) => s + (e.n || 0), 0) / cluster.length;
            report.inductions.push({
                feature: fk,
                cluster_size: cluster.length,
                avg_q: Math.round(avgQ * 100) / 100,
                avg_n: Math.round(avgN),
                note: `${cluster.length} entries share feature "${fk}" — consider abstracting into a higher-level principle.`,
            });
        }
    }

    // ③ DETECT_CONFLICTS
    for (const [fk, cluster] of Object.entries(byFeature)) {
        const confirmed = cluster.filter(e => e.status === 'CONFIRMED');
        if (confirmed.length >= 2) {
            const values = confirmed.map(e => e.q || 0);
            if (Math.max(...values) - Math.min(...values) > 0.5) {
                report.conflicts.push({
                    feature: fk,
                    entries: confirmed.map(e => e.id),
                    value_range: `${Math.min(...values).toFixed(2)} ~ ${Math.max(...values).toFixed(2)}`,
                    note: `CONFIRMED entries for "${fk}" have conflicting values. Marking as DISPUTED.`,
                });
                for (const e of confirmed) {
                    e.status = 'DISPUTED';
                    e.dispute_reason = `Internal conflict: value range > 0.5 for feature "${fk}"`;
                }
            }
        }
    }

    // ④ ABSTRACT: extract core principles from high-n clusters
    for (const ind of report.inductions) {
        if (ind.avg_n >= 5 && ind.avg_q >= 0.7) {
            report.abstractions.push({
                principle: `Pattern "${ind.feature}" is highly reliable (n=${Math.round(ind.avg_n)}, q=${ind.avg_q})`,
                action: "Consider promoting to a core principle in the knowledge graph.",
            });
        }
    }

    // ⑤ FORGET: natural death for entries with strength < 5 and no GC root
    for (const e of entries) {
        const strength = computeMemoryStrength(e);
        if (strength < 5 && !e.is_gc_root_referenced && !(e.emotional_tags && e.emotional_tags.length > 0)) {
            e._natural_death = true;
            report.natural_deaths++;
        }
    }

    return { entries, report };
}

// ═══════════════════════════════════════════════════════════════
//  STAGE 3: RECALL (无为之用) — Context-triggered natural recall
// ═══════════════════════════════════════════════════════════════

function recallKnowledge(entries, currentContext, topN = 5) {
    /**
     * "无为之用" — Memory doesn't actively jump out.
     * It surfaces naturally when the context matches.
     *
     * Recall chain:
     *   ① CONTEXT-TRIGGERED: match current context against stored anchors
     *   ② ASSOCIATIVE CHAIN: one recalled entry pulls its related entries
     *   ③ VERIFY: old CONFIRMED entries (>90 days) get a verification flag
     *   ④ EMOTIONAL PRIORITY: emotionally tagged entries surface first
     */
    const scored = [];

    for (const e of entries) {
        const anchor = e.context_anchor || {};
        const match = computeContextMatch(currentContext, anchor);

        // Emotional bonus
        const emotionalBonus = (e.emotional_tags && e.emotional_tags.length > 0) ? 0.15 : 0;

        // Recency bonus
        let recencyBonus = 0;
        if (e.last_recall) {
            const days = (new Date() - new Date(e.last_recall)) / 86400000;
            if (days <= 1) recencyBonus = 0.1;
            else if (days <= 7) recencyBonus = 0.05;
        }

        // Verification flag for old knowledge
        const needsVerification = e.status === 'CONFIRMED' && e.last_verified &&
            (new Date() - new Date(e.last_verified)) / 86400000 > 90;

        const score = match + emotionalBonus + recencyBonus;

        if (score > 0.3) {
            scored.push({
                ...e,
                recall_score: Math.round(score * 100) / 100,
                needs_verification: needsVerification,
                recall_reason: emotionalBonus > 0 ? 'emotional' : match > 0.5 ? 'context_match' : 'recency',
            });
        }
    }

    // Sort by score descending, take top N
    scored.sort((a, b) => b.recall_score - a.recall_score);
    const top = scored.slice(0, topN);

    // ② ASSOCIATIVE CHAIN: pull related entries
    const recalledIds = new Set(top.map(e => e.id));
    for (const e of top) {
        if (e.related_to) {
            for (const rid of e.related_to) {
                if (!recalledIds.has(rid)) {
                    const related = entries.find(x => x.id === rid);
                    if (related) {
                        related.recall_score = (e.recall_score || 0) * 0.7;
                        related.recall_reason = `associative: linked to ${e.id}`;
                        top.push(related);
                        recalledIds.add(rid);
                    }
                }
            }
        }
    }

    // Mark recalled entries
    for (const e of top) {
        e.last_recall = new Date().toISOString();
        e.consolidation_score = (e.consolidation_score || 0) + 1;
        e.recalled_in_tasks = [...(e.recalled_in_tasks || []), `recall_${Date.now()}`];
    }

    return {
        recalled: top,
        verification_needed: top.filter(e => e.needs_verification).map(e => e.id),
        associative_chain_depth: top.length - Math.min(topN, scored.length),
    };
}

// ═══════════════════════════════════════════════════════════════
//  Core Functions (retained from original)
// ═══════════════════════════════════════════════════════════════

function computeMemoryStrength(entry, currentTime = null) {
    const now = currentTime ? new Date(currentTime) : new Date();
    const consolidation = entry.consolidation_score || 0;
    let recallBonus = 0;
    if (entry.last_recall) {
        const days = (now - new Date(entry.last_recall)) / 86400000;
        if (days <= 1) recallBonus = 10;
        else if (days <= 7) recallBonus = 5;
        else if (days <= 30) recallBonus = 1;
    }
    return Math.max(0, consolidation + recallBonus);
}

function getMemoryClarity(strength) {
    if (strength >= 40) return { clarity: "crisp" };
    if (strength >= 20) return { clarity: "active" };
    if (strength >= 10) return { clarity: "fuzzy" };
    if (strength >= 5) return { clarity: "fragmented" };
    return { clarity: "near_forgotten" };
}

function computeContextMatch(current, anchor) {
    if (!anchor || !current) return 0;
    let score = 0, weight = 0;
    if (current.task_type && anchor.task_type) {
        weight += 0.3;
        if (current.task_type === anchor.task_type) score += 0.3;
    }
    if (current.tech_stack && anchor.tech_stack) {
        weight += 0.35;
        const cur = current.tech_stack.split("+");
        const anc = anchor.tech_stack.split("+");
        const overlap = cur.filter(c => anc.includes(c)).length;
        score += 0.35 * (overlap / Math.max(anc.length, 1));
    }
    if (current.keywords && anchor.keywords) {
        weight += 0.35;
        const overlap = current.keywords.filter(k => anchor.keywords.includes(k)).length;
        score += 0.35 * (overlap / Math.max(anchor.keywords.length, 1));
    }
    return weight === 0 ? 0 : score / weight;
}

// ===== Gate Engine =====
function checkReusability(exp) {
    const text = (exp.description || "") + " " + (exp.tags || []).join(" ");
    const disposable = ["临时", "绕过", "偶发", "网络抖动", "temporary", "workaround", "once"];
    const reusable = ["通用", "模式", "原则", "最佳实践", "算法", "架构", "pattern", "principle", "generic", "reusable"];
    let score = 0.5;
    for (const p of disposable) if (text.includes(p)) score -= 0.2;
    for (const p of reusable) if (text.includes(p)) score += 0.15;
    return { score: Math.max(0, Math.min(1, score)), level: score >= 0.7 ? "high" : score >= 0.3 ? "medium" : "low" };
}

function checkInformationDensity(exp) {
    const hasCause = !!(exp.conditions && exp.conclusion);
    const hasAction = !!(exp.actionable_steps && exp.actionable_steps.length > 0);
    const notVague = (exp.description || "").length > 20;
    const score = (hasCause ? 0.35 : 0.1) + (hasAction ? 0.25 : 0.05) + (notVague ? 0.15 : 0.05) + 0.25;
    return { score: Math.max(0, Math.min(1, score)), level: score >= 0.7 ? "high" : score >= 0.4 ? "medium" : "low" };
}

function checkNovelty(exp, kg) {
    const newTags = new Set(exp.tags || []);
    let best = 0;
    for (const entry of (kg || [])) {
        const existTags = new Set(entry.tags || []);
        const overlap = [...newTags].filter(t => existTags.has(t)).length;
        const total = newTags.size + existTags.size - overlap || 1;
        best = Math.max(best, overlap / total);
    }
    const novelty = 1 - best;
    if (best > 0.8) return { score: novelty, action: "merge", reason: `highly similar (${best.toFixed(2)})` };
    if (best > 0.5) return { score: novelty, action: "create_linked", reason: `partially similar (${best.toFixed(2)})` };
    return { score: novelty, action: "create", reason: "novel" };
}

function checkReliability(exp) {
    const scores = { execution_result: 1.0, official_doc: 0.9, multiple_sources: 0.85, user_stated: 0.7, inference: 0.5, analogy: 0.3, hearsay: 0.1 };
    const base = scores[exp.source || "inference"] || 0.4;
    let score = base + (exp.verified ? 0.2 : 0) + (exp.cross_validated ? 0.1 : 0);
    return { score: Math.min(1, score), level: score >= 0.8 ? "expert" : score >= 0.6 ? "trusted" : "uncertain" };
}

function gateCheck(exp, kg) {
    const reusability = checkReusability(exp);
    const density = checkInformationDensity(exp);
    const novelty = checkNovelty(exp, kg);
    const reliability = checkReliability(exp);
    if (novelty.action === "merge") return { passed: true, score: 1.0, action: "merge", reasons: [novelty.reason] };
    const composite = reusability.score * 0.25 + density.score * 0.35 + novelty.score * 0.15 + reliability.score * 0.25;
    if (composite >= 0.6) return { passed: true, score: composite, action: "store" };
    if (composite >= 0.4) return { passed: true, score: composite, action: "observe" };
    return { passed: false, score: composite, action: "discard" };
}

// ===== Emotional Tagging =====
function tagEmotionalKnowledge(experience, vPredicted = null, vActual = null) {
    const tags = [];
    let forceKeep = false;
    if (vPredicted !== null && vActual !== null) {
        const delta = vActual - vPredicted;
        if (delta >= 0.3) { tags.push("SURPRISE_SUCCESS"); forceKeep = true; }
        else if (delta <= -0.3) { tags.push("HARSH_LESSON"); forceKeep = true; }
    }
    if (experience.contradicted_knowledge_id) { tags.push("AWAKENING"); forceKeep = true; }
    return {
        emotional_tags: tags,
        force_keep: forceKeep,
        consolidation_bonus: tags.length > 0 ? 15 : 0,
        reason: tags.length > 0 ? `Emotionally marked: ${tags.join(", ")}` : "No emotional significance",
    };
}

function gateCheckWithEmotion(exp, kg, vPredicted = null, vActual = null) {
    const gate = gateCheck(exp, kg);
    const emotion = tagEmotionalKnowledge(exp, vPredicted, vActual);
    if (emotion.force_keep && gate.action === "discard") {
        return { ...gate, passed: true, action: "observe", emotional_tags: emotion.emotional_tags, consolidation_bonus: emotion.consolidation_bonus, note: "EMOTION OVERRIDE: stored despite low gate score." };
    }
    return { ...gate, emotional_tags: emotion.emotional_tags, consolidation_bonus: emotion.consolidation_bonus };
}

// ===== Natural Selection =====
function naturalSelection(entries, recentTaskIds) {
    const report = { total: entries.length, thriving: 0, active: 0, fading: 0, near_forgotten: 0, emotion_protected: 0, natural_death: 0 };
    const gcRoots = new Set();
    for (const e of entries) {
        if ((e.recalled_in_tasks || []).some(t => recentTaskIds.includes(t))) { gcRoots.add(e.id); e.is_gc_root_referenced = true; }
        else e.is_gc_root_referenced = false;
        const strength = computeMemoryStrength(e);
        if (strength >= 40) report.thriving++;
        else if (strength >= 20) report.active++;
        else if (strength >= 5) report.fading++;
        else report.near_forgotten++;
        if (e.emotional_tags && e.emotional_tags.length > 0) report.emotion_protected++;
        if (strength < 5 && !e.emotional_tags?.length && !e.is_gc_root_referenced) report.natural_death++;
    }
    return { report, gc_roots: [...gcRoots] };
}

// ===== Full Lifecycle =====
function fullLifecycle(kg, recentTaskIds, currentCtx = null, conversationHistory = null) {
    const report = { perceive: null, refine: null, recall: null, natural_selection: null };

    // Stage 1: Perceive
    if (conversationHistory) {
        report.perceive = perceiveSignals(conversationHistory);
    }

    // Stage 2: Refine
    const refined = refineKnowledge(kg);
    report.refine = refined.report;

    // Stage 3: Recall
    if (currentCtx) {
        report.recall = recallKnowledge(kg, currentCtx);
    }

    // Natural selection
    report.natural_selection = naturalSelection(kg, recentTaskIds);

    return report;
}

// ===== File Management =====
function getStatus() {
    ensureDirs();
    const active = fs.existsSync(ACTIVE_FILE) ? fs.statSync(ACTIVE_FILE).size : 0;
    const archives = fs.existsSync(ARCHIVE_DIR) ? fs.readdirSync(ARCHIVE_DIR).filter(f => f.endsWith('.md')) : [];
    return { active_file: ACTIVE_FILE, active_size_bytes: active, archive_dir: ARCHIVE_DIR, archive_files: archives.length, archives };
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
    if (args.length < 1) {
        log("MCTS-TD Memory Agent — Three-Stage Knowledge Lifecycle");
        log("  上善若水(Perceive) · 为道日损(Refine) · 无为之用(Recall)");
        log("Usage: node knowledge_lifecycle.js <command> [args...]");
        log("Commands: perceive, refine, recall, full-lifecycle, gate-check, gate-check-emotion,");
        log("          memory-strength, natural-selection, status, load-kg, save-kg");
        process.exit(0);
    }
    const cmd = args[0];
    const o = parseArgs(args.slice(1));
    try {
        switch (cmd) {
            // Stage 1: Perceive
            case "perceive": output(perceiveSignals(JSON.parse(o.history || "[]"))); break;

            // Stage 2: Refine
            case "refine": output(refineKnowledge(JSON.parse(o.entries || "[]"))); break;

            // Stage 3: Recall
            case "recall": output(recallKnowledge(JSON.parse(o.entries || "[]"), JSON.parse(o.context || "{}"), parseInt(o.top_n || 5))); break;

            // Full lifecycle
            case "full-lifecycle": output(fullLifecycle(
                JSON.parse(o.kg || "[]"),
                JSON.parse(o.recent_tasks || "[]"),
                o.context ? JSON.parse(o.context) : null,
                o.history ? JSON.parse(o.history) : null
            )); break;

            // Gate
            case "gate-check": output(gateCheck(JSON.parse(o.experience || "{}"), JSON.parse(o.kg || "[]"))); break;
            case "gate-check-emotion": output(gateCheckWithEmotion(
                JSON.parse(o.experience || "{}"), JSON.parse(o.kg || "[]"),
                o.v_predicted !== undefined ? parseFloat(o.v_predicted) : null,
                o.v_actual !== undefined ? parseFloat(o.v_actual) : null
            )); break;

            // Memory
            case "memory-strength": { const s = computeMemoryStrength(JSON.parse(o.entry || "{}")); output({ strength: s, ...getMemoryClarity(s) }); break; }
            case "natural-selection": output(naturalSelection(JSON.parse(o.entries || "[]"), JSON.parse(o.recent_tasks || "[]"))); break;

            // File management
            case "status": output(getStatus()); break;
            case "load-kg": output(loadKG()); break;
            case "save-kg": saveKG(JSON.parse(o.entries || "[]")); output({ saved: true, count: JSON.parse(o.entries || "[]").length }); break;

            default: log(`Unknown: ${cmd}`); process.exit(1);
        }
    } catch (e) { log(`Error: ${e.message}`); process.exit(1); }
}

main();