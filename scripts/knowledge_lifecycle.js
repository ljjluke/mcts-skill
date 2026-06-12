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
    } catch (e) {
        log(`[WARN] loadKG: failed to parse ${ACTIVE_FILE}: ${e.message}`);
        return [];
    }
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
     * "听之以气" — Listen with qi, not ears.
     * "察言观色" — Observe what the user settles on. What they return to. What they avoid.
     * "揣摩" — Gauge real intent through feedback loops.
     *
     * IMPORTANT: This function does NOT judge emotion. It structures the conversation
     * context so the LLM can make emotional judgments. The LLM is the "mind" that feels.
     * This code is the "ears" that prepare what the mind needs to hear.
     *
     * Five perception dimensions, each producing structured OBSERVATIONS (not judgments):
     *
     *   DIMENSION 1: 言语纹理 (The texture of speech)
     *     — What topics recur? What words are emphasized? Where is the user vague?
     *
     *   DIMENSION 2: 情感线索 (Emotional clues — NOT judgments, just clues)
     *     — What emotional markers appear? Where? What was the context?
     *
     *   DIMENSION 3: 行为轨迹 (Behavioral trace)
     *     — Accept/override patterns? Topics that persist across messages?
     *
     *   DIMENSION 4: 留白之处 (The spaces between words)
     *     — What was asked but not answered? What was assumed and not challenged?
     *
     *   DIMENSION 5: 互动节律 (The rhythm of exchange)
     *     — Is the user going deeper or staying surface? Speeding up or slowing down?
     */
    const observations = {
        speech_texture: { recurring_topics: [], emphasis_markers: [], vague_zones: [] },
        emotional_clues: { seven_emotions: [], emotional_flow: { dominant: null, transitions: [], yin_yang_ratio: "" } },
        behavioral_trace: { overrides: [], persistent_topics: [], acceptance_pattern: "" },
        silence_spaces: { unanswered: [], unchallenged_assumptions: [], quiet_continuations: 0 },
        interaction_rhythm: { depth_trend: "", specificity_trend: "" },
        raw_stats: { message_count: 0, user_message_count: 0, avg_length: 0, total_chars: 0 },
    };

    const messages = Array.isArray(conversationHistory) ? conversationHistory : [];
    if (messages.length === 0) return observations;

    const userMsgs = messages.filter(m => (m.role || 'user') === 'user');
    const aiMsgs = messages.filter(m => m.role === 'assistant');
    const allUserText = userMsgs.map(m => typeof m === 'string' ? m : (m.content || m.message || '')).join('\n');
    const allAiText = aiMsgs.map(m => typeof m === 'string' ? m : (m.content || m.message || '')).join('\n');

    observations.raw_stats.message_count = messages.length;
    observations.raw_stats.user_message_count = userMsgs.length;
    observations.raw_stats.total_chars = allUserText.length;
    observations.raw_stats.avg_length = userMsgs.length > 0 ? Math.round(allUserText.length / userMsgs.length) : 0;

    // ═══════════════════════════════════════════════════════════
    //  DIMENSION 1: 言语纹理 — Structure, don't judge
    // ═══════════════════════════════════════════════════════════

    // 1a. Recurring topics (with context)
    const wordFreq = {};
    for (const msg of userMsgs) {
        const text = typeof msg === 'string' ? msg : (msg.content || msg.message || '');
        const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        for (const w of [...new Set(words)]) wordFreq[w] = (wordFreq[w] || 0) + 1;
    }
    for (const [word, count] of Object.entries(wordFreq)) {
        if (count >= 3) {
            // Find context snippets where this word appears
            const contexts = [];
            for (const msg of userMsgs) {
                const text = typeof msg === 'string' ? msg : (msg.content || msg.message || '');
                if (text.toLowerCase().includes(word)) contexts.push(text.substring(0, 100));
            }
            observations.speech_texture.recurring_topics.push({ word, count, contexts: contexts.slice(0, 3) });
        }
    }

    // 1b. Emphasis markers — words that signal the user is making a point strongly
    const emphasisRe = /(?:必须|一定要|绝对不能|must|absolutely|cannot|no\s+way|critical|关键|核心|重要|priority|important|urgent|紧急|尽快|最好|should|prefer|倾向|偏好)/gi;
    const emphasisMatches = [...new Set(allUserText.match(emphasisRe) || [])];
    if (emphasisMatches.length > 0) {
        // For each marker, capture 60 chars of surrounding context
        for (const marker of emphasisMatches.slice(0, 5)) {
            const idx = allUserText.toLowerCase().indexOf(marker.toLowerCase());
            if (idx >= 0) {
                const ctx = allUserText.substring(Math.max(0, idx - 30), Math.min(allUserText.length, idx + 30));
                observations.speech_texture.emphasis_markers.push({ marker, context: ctx.replace(/\n/g, ' ') });
            }
        }
    }

    // 1c. Vague zones — where the user is uncertain
    const vagueRe = /(?:maybe|perhaps|差不多|大概|可能|不太确定|not\s+sure|kind\s+of|sort\s+of|好像|似乎|不太清楚|不知道|不确定)/gi;
    const vagueMatches = [...new Set(allUserText.match(vagueRe) || [])];
    for (const marker of vagueMatches.slice(0, 5)) {
        const idx = allUserText.toLowerCase().indexOf(marker.toLowerCase());
        if (idx >= 0) {
            observations.speech_texture.vague_zones.push({
                marker,
                context: allUserText.substring(Math.max(0, idx - 40), Math.min(allUserText.length, idx + 40)).replace(/\n/g, ' ')
            });
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  DIMENSION 2: 情感线索 — Collect clues, don't judge
    // ═══════════════════════════════════════════════════════════

    // === Emotional framework based on Chinese traditional thought ===
    // 七情 (Seven Emotions) mapped to patterns — each is a dynamic force, not a static label
    // 阴阳: 喜/乐 = 阳(outward, expansive), 怒/悲/恐 = 阴(inward, contracting)
    // Five phases (五行): 喜(fire/heart), 怒(wood/liver), 忧(earth/spleen), 悲(metal/lung), 恐(water/kidney)
    // Key insight: emotions transform (怒→喜, 恐→安). The question is not "what emotion?"
    //              but "where is the emotional energy flowing?"
    const emotionalMarkerSets = {
        // === 阳 (Yang) — Outward, expansive, rising energy ===
        xi_jie_yue: {  // 喜 (Joy) + 乐 (Delight) → 火/心 (Fire/Heart)
            re: /(?:太好了|太棒了|完美|非常好|excellent|perfect|amazing|great|awesome|love\s+it|正是我想要的|exactly|对.*就.*这样|没错|真棒|厉害了|nice|wonderful|brilliant|beautiful)/gi,
            qiqing: "xi", wuxing: "huo", yinyang: "yang",
            direction: "rising-expanding", ripples: ["trust_building", "positive_reinforcement", "engagement_peak"]
        },
        jing: {  // 惊 (Shock/Awe) — sudden arousal, can flip to joy or fear
            re: /(?:哇|天哪|omg|wow|what|真的吗|really|seriously|unbelievable|incredible|居然|竟然)/gi,
            qiqing: "jing", wuxing: "huo", yinyang: "yang",
            direction: "sudden-spike", ripples: ["surprise_opportunity", "re-evaluation_trigger"]
        },

        // === 阴 (Yin) — Inward, contracting, sinking energy ===
        nu: {  // 怒 (Anger/Frustration) → 木/肝 (Wood/Liver)
            re: /(?:不行|不对|完全不|don'?t\s+work|doesn'?t\s+work|not\s+working|wrong|broken|error|bug|issue|problem|还是不行|又报错|又错了|搞不定|烦|头疼|frustrating|annoying|ugh|dammit)/gi,
            qiqing: "nu", wuxing: "mu", yinyang: "yin",
            direction: "contracting-blocking", ripples: ["pain_point", "boundary_signal", "urgent_need"]
        },
        you_si: {  // 忧 (Worry) + 思 (Overthinking/Pensiveness) → 土/脾 (Earth/Spleen)
            re: /(?:担心|怕|万一|会不会|如果|safety|security|risk|能不能|行不行|可以吗|靠谱|可靠|会不会.*问题|担心.*风险)/gi,
            qiqing: "you_si", wuxing: "tu", yinyang: "yin",
            direction: "circling-weighing", ripples: ["risk_awareness", "need_reassurance", "contemplation_zone"]
        },
        bei: {  // 悲 (Sorrow/Disappointment) → 金/肺 (Metal/Lung)
            re: /(?:太差了|太糟糕|terrible|awful|horrible|disaster|失败了|不理想|不太好|不是.*想要的|失望|disappointed|可惜|遗憾|sadly|unfortunately)/gi,
            qiqing: "bei", wuxing: "jin", yinyang: "yin",
            direction: "sinking-releasing", ripples: ["disengagement_risk", "expectation_gap", "letting_go"]
        },
        kong: {  // 恐 (Fear/Anxiety) → 水/肾 (Water/Kidney)
            re: /(?:完了|坏了|别.*错了|别搞.*了|千万|绝对.*不能|must\s+not|cannot|critical|fatal|irreversible|破坏|毁|丢.*数据|lose.*data|break.*everything)/gi,
            qiqing: "kong", wuxing: "shui", yinyang: "yin",
            direction: "deep-freezing", ripples: ["high_stakes", "irreversible_concern", "protection_mode"]
        },

        // === 转化的桥梁 (Bridge states — where one emotion transforms into another) ===
        an: {  // 安 (Peace/Relief) → 从怒/恐/悲转化而来
            re: /(?:终于|finally|总算|at\s+last|这才对|原来如此|原来是这样|明白了|懂了|got\s+it|i\s+see|makes\s+sense|有道理|原来|怪不得|还好|幸好|thankfully|luckily|phew|解决了|works\s+perfectly|终于好了)/gi,
            qiqing: "an", wuxing: "tu", yinyang: "yang",
            direction: "transforming-releasing", ripples: ["bottleneck_resolved", "trust_rebuilt", "relief_after_tension"],
            note: "Relief is not an emotion on its own — it's the TRANSITION from yin→yang, the release of accumulated tension."
        },
    };

    // Build the Seven-Emotions map with context and flow
    const emotionTimeline = [];  // ordered by position in conversation
    for (const [key, config] of Object.entries(emotionalMarkerSets)) {
        if (key === 'an') continue; // handle separately — it's a transition state
        const matches = [...new Set(allUserText.match(config.re) || [])];
        for (const marker of matches.slice(0, 5)) {
            const idx = allUserText.toLowerCase().indexOf(marker.toLowerCase());
            if (idx >= 0) {
                const ctx = allUserText.substring(Math.max(0, idx - 60), Math.min(allUserText.length, idx + 60)).replace(/\n/g, ' ');
                observations.emotional_clues.seven_emotions.push({
                    qiqing: config.qiqing,
                    wuxing: config.wuxing,
                    yinyang: config.yinyang,
                    direction: config.direction,
                    marker,
                    context: ctx,
                    position: idx, // for ordering
                });
                emotionTimeline.push({ key: config.qiqing, idx, marker, yinyang: config.yinyang });
            }
        }
    }

    // Detect relief transitions (安) separately — they mark emotion-to-emotion shifts
    const anConfig = emotionalMarkerSets.an;
    const anMatches = [...new Set(allUserText.match(anConfig.re) || [])];
    let reliefCount = 0;
    for (const marker of anMatches.slice(0, 5)) {
        const idx = allUserText.toLowerCase().indexOf(marker.toLowerCase());
        if (idx >= 0) {
            // Find what emotion preceded this relief
            const prev = emotionTimeline.filter(e => e.idx < idx).slice(-1);
            const prevEmotion = prev.length > 0 ? prev[0].key : 'unknown';
            const ctx = allUserText.substring(Math.max(0, idx - 60), Math.min(allUserText.length, idx + 60)).replace(/\n/g, ' ');
            observations.emotional_clues.seven_emotions.push({
                qiqing: 'an',
                wuxing: 'tu',
                yinyang: 'yang',
                direction: 'transforming-releasing',
                marker,
                context: ctx,
                position: idx,
                transition_from: prevEmotion,
                note: `Relief from ${prevEmotion} — the release of accumulated tension (怒→喜, 恐→安).`,
            });
            reliefCount++;
        }
    }

    // === Emotional flow analysis ===
    // Sort by position
    emotionTimeline.sort((a, b) => a.idx - b.idx);

    // Detect transitions (one emotion → another)
    const transitions = [];
    for (let i = 1; i < emotionTimeline.length; i++) {
        if (emotionTimeline[i].key !== emotionTimeline[i-1].key) {
            transitions.push({
                from: emotionTimeline[i-1].key,
                to: emotionTimeline[i].key,
                from_yinyang: emotionTimeline[i-1].yinyang,
                to_yinyang: emotionTimeline[i].yinyang,
                is_yin_yang_shift: emotionTimeline[i-1].yinyang !== emotionTimeline[i].yinyang,
            });
        }
    }

    // Compute dominant emotion and yin-yang ratio
    const emotionCounts = {};
    for (const e of emotionTimeline) { emotionCounts[e.key] = (emotionCounts[e.key] || 0) + 1; }
    const dominant = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0];
    const yangCount = emotionTimeline.filter(e => e.yinyang === 'yang').length;
    const yinCount = emotionTimeline.filter(e => e.yinyang === 'yin').length;
    const yangRatio = emotionTimeline.length > 0 ? Math.round(yangCount / emotionTimeline.length * 100) : 50;

    // Flow interpretation based on Chinese thought
    let flowInterpretation = '';
    if (yangRatio >= 70) {
        flowInterpretation = '阳气主导 (Yang-dominant): 情感向外舒展，用户处于积极扩张状态。善守此势，顺势而为。';
    } else if (yangRatio <= 30) {
        flowInterpretation = '阴气主导 (Yin-dominant): 情感向内收敛，用户可能正在承受压力或深度思考。以静制动，不可强求。';
    } else if (transitions.some(t => t.is_yin_yang_shift)) {
        flowInterpretation = '阴阳转化 (Yin-Yang transformation): 情感正在流动，用户在阴(收缩)和阳(舒展)之间转换。这是关键的心理转折点。';
    } else {
        flowInterpretation = '阴阳平衡 (Yin-Yang balance): 情感稳定，用户处于理性且投入的状态。';
    }

    observations.emotional_clues.emotional_flow = {
        dominant: dominant ? { emotion: dominant[0], count: dominant[1] } : null,
        transitions: transitions.slice(0, 5),
        yin_yang_ratio: `${yangRatio}% yang / ${100 - yangRatio}% yin`,
        interpretation: flowInterpretation,
        relief_count: reliefCount,
    };
    observations.emotional_clues.seven_emotions.sort((a, b) => a.position - b.position);

    // ═══════════════════════════════════════════════════════════
    //  DIMENSION 3: 行为轨迹 — What the user actually does
    // ═══════════════════════════════════════════════════════════

    // 3a. AI suggestions that user modified or rejected
    for (let i = 0; i < userMsgs.length; i++) {
        const text = typeof userMsgs[i] === 'string' ? userMsgs[i] : (userMsgs[i].content || userMsgs[i].message || '');
        const overrideRe = /(?:不要|不用|别|don'?t|no\s+(?!problem|worries|rush)|换个|改成|换成|用.*代替|instead|rather|actually|应该是|不是.*是)/gi;
        if (overrideRe.test(text)) {
            const prevAiMsg = i > 0 ? (typeof aiMsgs[Math.min(i - 1, aiMsgs.length - 1)] === 'string' ? aiMsgs[Math.min(i - 1, aiMsgs.length - 1)] : (aiMsgs[Math.min(i - 1, aiMsgs.length - 1)]?.content || '')) : '';
            observations.behavioral_trace.overrides.push({
                user_said: text.substring(0, 120),
                after_ai_suggested: prevAiMsg.substring(0, 120),
            });
        }
    }

    // 3b. Topics persisting across the conversation
    if (userMsgs.length >= 4) {
        const mid = Math.floor(userMsgs.length / 2);
        const firstHalf = userMsgs.slice(0, mid).map(m => typeof m === 'string' ? m : (m.content || m.message || '')).join(' ');
        const secondHalf = userMsgs.slice(mid).map(m => typeof m === 'string' ? m : (m.content || m.message || '')).join(' ');
        const firstWords = new Set(firstHalf.toLowerCase().split(/\s+/).filter(w => w.length > 4));
        const secondWords = new Set(secondHalf.toLowerCase().split(/\s+/).filter(w => w.length > 4));
        observations.behavioral_trace.persistent_topics = [...firstWords].filter(w => secondWords.has(w)).slice(0, 8);
    }

    // 3c. Acceptance pattern
    const acceptRe = /(?:好的|ok|yes|对|可以|行|go\s+ahead|继续|good|great|thanks|谢谢|正是|没错|就是这样|perfect|exactly)/gi;
    const acceptCount = (allUserText.match(acceptRe) || []).length;
    const overrideCount = observations.behavioral_trace.overrides.length;
    if (acceptCount > 0 || overrideCount > 0) {
        observations.behavioral_trace.acceptance_pattern = `${acceptCount} acceptances, ${overrideCount} overrides`;
    }

    // ═══════════════════════════════════════════════════════════
    //  DIMENSION 4: 留白之处 — What is NOT said
    // ═══════════════════════════════════════════════════════════

    // 4a. AI asked questions → user didn't answer some = low priority
    for (const aiMsg of aiMsgs) {
        const text = typeof aiMsg === 'string' ? aiMsg : (aiMsg.content || aiMsg.message || '');
        const questions = text.match(/[^。.!！?？\n]*\?/g) || [];
        for (const q of questions) {
            const qClean = q.trim();
            if (qClean.length > 10) {
                const answered = userMsgs.some(m => {
                    const ut = typeof m === 'string' ? m : (m.content || m.message || '');
                    return ut.length > 0;
                });
                if (!answered && observations.silence_spaces.unanswered.length < 5) {
                    observations.silence_spaces.unanswered.push(qClean.substring(0, 100));
                }
            }
        }
    }

    // 4b. Quiet continuations — user says "继续/go on/下一步"
    const quietRe = /(?:继续|go\s+on|next|下一个|然后|接着|proceed|keep\s+going|继续吧)/gi;
    observations.silence_spaces.quiet_continuations = (allUserText.match(quietRe) || []).length;

    // 4c. AI assumptions that went unchallenged
    const assumptionRe = /(?:assume|假设|如果|assuming|should\s+be|probably|likely|一般|通常|应该|可能)/gi;
    const aiAssumptions = (allAiText.match(assumptionRe) || []).length;
    if (aiAssumptions >= 2 && overrideCount <= 1) {
        observations.silence_spaces.unchallenged_assumptions = [
            `${aiAssumptions} assumptions made by AI, ${overrideCount} challenged by user — most were likely correct.`
        ];
    }

    // ═══════════════════════════════════════════════════════════
    //  DIMENSION 5: 互动节律 — The rhythm of exchange
    // ═══════════════════════════════════════════════════════════

    const userMsgLengths = userMsgs.map(m => typeof m === 'string' ? m.length : ((m.content || m.message || '').length));
    if (userMsgLengths.length >= 3) {
        const first3Avg = userMsgLengths.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
        const last3Avg = userMsgLengths.slice(-3).reduce((a, b) => a + b, 0) / 3;
        if (last3Avg > first3Avg * 2) {
            observations.interaction_rhythm.depth_trend = `deepening: avg msg length ${Math.round(first3Avg)} → ${Math.round(last3Avg)} chars`;
        } else if (last3Avg < first3Avg * 0.5) {
            observations.interaction_rhythm.depth_trend = `shortening: avg msg length ${Math.round(first3Avg)} → ${Math.round(last3Avg)} chars`;
        }
    }

    const specificityRe = /(?:具体|详细|detail|specifically|exactly|precisely|怎么|how|which|哪个|什么|what|为什么|why)/gi;
    const mid = Math.floor(userMsgs.length / 2);
    const firstHalfSpec = (userMsgs.slice(0, mid).map(m => typeof m === 'string' ? m : (m.content || m.message || '')).join(' ').match(specificityRe) || []).length;
    const secondHalfSpec = (userMsgs.slice(mid).map(m => typeof m === 'string' ? m : (m.content || m.message || '')).join(' ').match(specificityRe) || []).length;
    if (secondHalfSpec > firstHalfSpec * 1.5) {
        observations.interaction_rhythm.specificity_trend = `increasing: ${firstHalfSpec} → ${secondHalfSpec} specific question markers`;
    } else if (firstHalfSpec > secondHalfSpec * 1.5) {
        observations.interaction_rhythm.specificity_trend = `decreasing: ${firstHalfSpec} → ${secondHalfSpec} specific question markers`;
    }

    return observations;
}

/**
 * LLM PROMPT TEMPLATE — Feel the emotional energy, don't just label it.
 *
 * "Based on the conversation observations below, feel the user's emotional flow:
 *
 *  七情图谱 (Seven Emotions Map):
 *   - Which emotions appeared, in what order?
 *   - What was the dominant emotion? Was it yin(contracting) or yang(expanding)?
 *   - Were there transitions? (怒→安 anger transformed to relief? 恐→喜 fear to joy?)
 *   - Where is the emotional energy flowing — inward (withdrawal, protection) or outward (trust, expansion)?
 *
 *  阴阳流动 (Yin-Yang Flow):
 *   - Is the user in a yin state (contracting: cautious, protective, inward)?
 *     → Don't push. Move gently. Earn trust.
 *   - Or yang state (expanding: excited, trusting, outward)?
 *     → Ride the momentum. Deepen engagement. Build on the energy.
 *   - Is it transitioning? (yin→yang or yang→yin)
 *     → This is the MOST critical moment. How you respond determines the direction.
 *
 *  五行涟漪 (Five Phases Ripples):
 *   - 喜(fire/heart) → user is happy, engaged. Build on this.
 *   - 怒(wood/liver) → user is frustrated. This is a PAIN POINT. Record it. Address it.
 *   - 忧/思(earth/spleen) → user is worried/overthinking. They need reassurance.
 *   - 悲(metal/lung) → user is disappointed. Risk of disengagement.
 *   - 恐(water/kidney) → user is anxious about high stakes. Protection mode.
 *
 *  What should the memory agent store from this interaction?
 *  - If 怒(anger) appeared: store the PAIN POINT and its context
 *  - If 喜(joy) dominated: store what WORKED (positive reinforcement)
 *  - If 安(relief) appeared after 怒: store the BOTTLENECK that was resolved
 *  - If yin→yang transition: store the TURNING POINT
 *
 *  Observations: {{observations}}
 */

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
        log("  Perceive(上善若水) · Refine(为道日损) · Recall(无为之用)");
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