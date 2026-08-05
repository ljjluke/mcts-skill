#!/usr/bin/env node
/**
 * Unified knowledge acquisition layer.
 *
 * Single entry point for all data needs:
 *   1. Check local MMA memory (deqi)
 *   2. If empty → WebSearch
 *   3. Store what's found in MMA with classification
 *   4. Return best available data
 *
 * Classification (brain-like):
 *   CONFIRMED   — user confirmed or cross-verified → use with high confidence
 *   PROVISIONAL — used but not verified → use with caution
 *   HYPOTHESIS  — new, unverified → treat as tentative
 *   DISPUTED    — has contradictory evidence → flag when used
 *   REFUTED     — proven wrong → EXCLUDE from recall
 *   SLEEPING    — unused for 30d
 */
const path = require('path');
const { spawnSync } = require('child_process');
const { childProcessOptions } = require('./runtime-paths');

// 步骤命名单一真源 + 历史别名兼容层(避免新旧名混杂导致召回断链)
const { normalizeStep, categoryFor, matchStepPrefix } = require('./step-names');

// 分词:中英文混合切词(acquire 和 recallStepHistory 共用,提到顶层避免作用域断裂)
function _seg(s){if(!s)return[];var r=[];var buf='';for(var i=0;i<s.length;i++){var c=s[i];if(/[a-zA-Z0-9À-ɏ]/.test(c)){buf+=c}else{if(buf.length>0){r.push(buf);buf=''}if(c.trim()&&!c.match(/[\s,，。、]/))r.push(c)}}if(buf.length>0)r.push(buf);return r}

const MMA_SCRIPT = path.join(__dirname, 'mcts.js');

function acquire(query, options = {}, stepName = '') {
  const { tags = [], limit = 5, allowSearch = true, storeNew = true } = query || {};
  const result = { source: 'none', entries: [] };

  // Phase 1: Check MMA memory with the original tags (deqi handles partial matching internally)
  if (MMA_SCRIPT && tags.length > 0) {
    const mmaResult = spawnSync('node', [MMA_SCRIPT, 'mma', 'deqi', JSON.stringify({ tags, limit })], childProcessOptions({
      timeout: 10000, encoding: 'utf-8',
    }));
    if (mmaResult.status === 0) {
      try {
        const parsed = JSON.parse(mmaResult.stdout);
        if (parsed.count > 0) {
          // Filter out REFUTED entries — they're proven wrong
          const valid = parsed.results.filter(r => r.point?.status !== 'REFUTED' && r.point?.status !== 'DISPUTED');
          if (valid.length > 0) {
            result.source = 'mma';
            // Tag each recalled point with step usage
            if (stepName) {
              for (const v of valid) {
                usedInStep(v.point.id, stepName);
              }
            }
            result.entries = valid.map(r => ({
              id: r.point.id,
              content: r.point.description,
              tags: r.point.tags,
              q: r.point.q,
              confidence: r.deqi_score,
              status: r.point.status,
              source: 'mma',
            }));
          }
        }
      } catch (e) {}
    }
    // 每次召回触发知识保洁，防止垃圾堆积
    try {
      const io = require('./mma/io');
      const kg = io.loadMMA();
      const { knowledgeGroom } = require('./mma/decay');
      const actions = knowledgeGroom(kg);
      if (actions.length > 0) io.saveMMA(kg);
      if (actions.length > 0) result._groomed = actions.length;
    } catch (e) { /* grooming non-blocking */ }
  }

  // Phase 1.5: Semantic relevance re-ranking
  // 在标签匹配基础上，计算查询与每条候选经验的语义重叠度
  if (result.entries.length > 0 && query.tags) {
    const queryText = (Array.isArray(query.tags) ? query.tags.join(' ') : '') + ' ' + (query.query || '');
    const queryWords = _seg(queryText);
    const queryTopics = new Set(queryWords);

    for (const entry of result.entries) {
      // 语义重叠分: 描述词 + 标签词 与查询词的共现比例
      const descWords = (entry.content || '').toLowerCase().split(/\s+/).filter(w => w.length > 1);
      const tagWords = (entry.tags || []).join(' ').toLowerCase().split(/\s+/).filter(w => w.length > 1);
      const allWords = new Set([...descWords, ...tagWords]);

      let overlap = 0;
      for (const qw of queryTopics) {
        // 精确匹配 或 词根包含关系
        for (const aw of allWords) {
          if (aw === qw || aw.includes(qw) || qw.includes(aw)) {
            overlap++;
            break;
          }
        }
      }
      const semanticScore = queryTopics.size > 0 ? overlap / queryTopics.size : 0;

      // 类别匹配加分
      const categoryBonus = query.query && entry.content && entry.content.includes(query.query) ? 0.2 : 0;

      // 综合评分 = deqi置信度 × 0.6 + 语义重叠 × 0.3 + 精确匹配加分
      entry._match_score = (entry.confidence || 0) * 0.6 + semanticScore * 0.3 + categoryBonus;
      entry._semantic_score = Math.round(semanticScore * 100) / 100;
    }

    // 按综合评分重新排序
    result.entries.sort((a, b) => (b._match_score || 0) - (a._match_score || 0));
    result.entries = result.entries.slice(0, limit);
    result._reranked_by_semantic = true;
  }

  // Phase 2: If MMA has results, return them
  if (result.entries.length > 0) return result;

  // Phase 3: Fallback to WebSearch
  if (allowSearch) {
    result.source = 'web';
    result.entries = [{
      content: `[WebSearch needed for: ${tags.join(', ')}]`,
      tags,
      confidence: 0,
      status: 'HYPOTHESIS',
      source: 'web',
      needs_search: true,
    }];
  }

  return result;
}

/**
 * List all REFUTED entries — for LLM to semantically review before storing new knowledge.
 */
function listRefuted(limit = 20) {
  if (!MMA_SCRIPT) return [];
  const io = require('./mma/io');
  const kg = io.loadMMA();
  const refuted = [];
  for (const [, m] of Object.entries(kg.meridians)) {
    for (const p of m.points) {
      if ((p.status === 'REFUTED' || p.status === 'DISPUTED') && !p.hidden) {
        refuted.push({ id: p.id, description: (p.description || '').substring(0, 100), tags: p.tags, status: p.status });
      }
    }
  }
  return refuted.slice(0, limit);
}

/**
 * Store acquired knowledge into MMA.
 * LLM should semantically review against REFUTED entries before calling this.
 *
 * @param {object} entry
 * @param {string} entry.description
 * @param {string[]} entry.tags
 * @param {string} entry.emotion — optional emotion tag
 * @returns {object|null} stored point info or null
 */
function store(entry) {
  if (!MMA_SCRIPT || !entry?.description) return null;

  // Determine emotion based on confidence
  const emotion = entry.emotion || 'an';

  // 结晶化: 如果有推理上下文,追加到描述中
  const reasoningDesc = entry.description
  const reasoningParts = []
  if (entry._reasoning) {
    const r = entry._reasoning
    if (r.divergence_consensus) reasoningParts.push(r.divergence_consensus)
    if (r.dimension_finding || r.bagua_finding) reasoningParts.push(r.dimension_finding || r.bagua_finding)
    if (r.synthesis_conclusion) reasoningParts.push(r.synthesis_conclusion)
    if (r.verification_verdict) reasoningParts.push('验证:' + r.verification_verdict)
  }
  var desc = reasoningDesc
  if (reasoningParts.length > 0) {
    desc = reasoningDesc + '\n\n---\n[推理] ' + reasoningParts.join(' | ')
  }

  const payload = JSON.stringify({
    description: desc,
    tags: entry.tags || [],
    category: entry.category || 'tools_and_means',
    emotion,
    source: entry.source || 'web_search',
    q: entry.q || 0.5,
  });

  const result = spawnSync('node', [MMA_SCRIPT, 'mma', 'ashi', payload], childProcessOptions({
    timeout: 10000, encoding: 'utf-8',
  }));

  if (result.status === 0) {
    try {
      const parsed = JSON.parse(result.stdout);
      return parsed.point ? { id: parsed.point.id, status: 'HYPOTHESIS' } : null;
    } catch (e) { return null; }
  }
  return null;
}

/**
 * 存储步骤输出 — 每个管道步骤的结果存进MMA，供后续同类问题参考
 *
 * @param {string} stepName — 步骤名(标准八步): shensi|divergence|bagua|plans|converge|simulate|debate|synthesis
 *                  历史旧名(dimension/simulations/verification)/中文名会自动归一化,见 scripts/step-names.js
 * @param {string} questionType — 问题类型: 市场分析|技术选型|...
 * @param {object|string} output — 该步骤的结构化输出
 * @param {object} opts — 可选: tags, user_request
 * @returns {object|null} stored point info
 */
function storeStepOutput(stepName, questionType, output, opts = {}) {
  if (!MMA_SCRIPT || !stepName || !questionType) return null;
  // 归一化到标准八步名(单一真源),旧名/中文名写入前统一为标准名
  stepName = normalizeStep(stepName) || stepName;
  // 从输出中提取自然语言文本,而非存JSON(保证语义匹配能命中)
  var summary = ''
  if (typeof output === 'string') {
    summary = output.substring(0, 300)
  } else if (typeof output === 'object') {
    // 尝试提取关键文本字段(按优先级)
    var textFields = ['consensus', 'key_finding', 'synthesis', 'conclusion', 'reasoning', 'detail', 'description', 'insight', 'evidence']
    for (var i = 0; i < textFields.length; i++) {
      if (output[textFields[i]] && typeof output[textFields[i]] === 'string' && output[textFields[i]].length > 20) {
        summary = output[textFields[i]].substring(0, 300)
        break
      }
    }
    // 无长文本字段 → 取JSON前150字(仍可标签匹配)
    if (!summary) summary = JSON.stringify(output).substring(0, 150)
  }
  var entryDesc = '[step:' + stepName + '] ' + questionType + ': ' + summary
  if (entryDesc.length > 400) entryDesc = entryDesc.substring(0, 400)
  const entry = {
    description: entryDesc,
    tags: ['step_history', 'step_' + stepName, questionType, ...(opts.tags || [])],
    category: categoryFor(stepName),
    emotion: 'xi',
    q: 0.7,
    source: 'step_history',
  };
  const result = store(entry);
  if (result && opts.user_request) {
    // 额外打上用户请求的标签
    try {
      const io = require('./mma/io');
      const kg = io.loadMMA();
      const point = io.findPointById(kg, result.id);
      if (point) {
        point.point.tags = point.point.tags || [];
        if (!point.point.tags.includes('step_history:' + stepName)) {
          point.point.tags.push('step_history:' + stepName);
          io.saveMMA(kg);
        }
      }
    } catch (e) {}
  }
  return result;
}

/**
 * 召回历史步骤输出 — 为当前步骤找到最相关的历史输出
 *
 * 先用标签匹配候选，再用语义重叠度重新排名
 *
 * @param {string} stepName — 步骤名
 * @param {string} questionType — 当前问题类型
 * @param {object} opts — 可选: tags, limit(default 8), query
 * @returns {Array} 排序后的历史条目
 */
function recallStepHistory(stepName, questionType, opts = {}) {
  // 归一化:即便查旧名/中文名,也能召回到用标准名或别名存的历史数据
  var normStep = normalizeStep(stepName) || stepName;
  stepName = normStep;
  const limit = opts.limit || 20;
  const searchTags = new Set(['step_history', 'step_' + stepName, questionType, ...(opts.tags || [])]);
  // 同时把别名也纳入标签候选(历史数据可能用旧名打 tag)
  const { allStepNamesFor } = require('./step-names');
  allStepNamesFor(stepName).forEach(function(n) { searchTags.add('step_' + n); });
  const candidates = [];

  // 直接加载MMA全量搜索（不经过deqi的时间激活限制）
  try {
    const io = require('./mma/io');
    const kg = io.loadMMA();
    const allMeridians = [...Object.entries(kg.meridians), ...Object.entries(kg.extra).map(([k, m]) => ['_extra_' + k, m])];

    for (const [, m] of allMeridians) {
      if (!m || !m.points) continue;
      for (const p of m.points) {
        if (p.hidden) continue;
        if (!p.tags || !p.tags.some(t => searchTags.has(t))) continue;
        // 扩展前缀匹配:命中 stepName 的任一别名前缀都算(防历史旧名存的数据召不回)
        if (!p.description || !matchStepPrefix(p.description, stepName)) continue;

        // 计算语义重叠度
        const queryWords = _seg(opts.query || questionType || '');
        const descWords = (p.description || '').toLowerCase().split(/\s+/).filter(w => w.length > 1);
        let overlap = 0;
        for (const qw of queryWords) {
          if (descWords.some(dw => dw === qw || dw.includes(qw) || qw.includes(dw))) overlap++;
        }
        const semanticScore = queryWords.length > 0 ? overlap / queryWords.length : 0;
        const matchScore = semanticScore * 0.4 + (p.q || 0.5) * 0.3 + (p.n || 0) * 0.1;

        candidates.push({
          id: p.id,
          content: p.description,
          tags: p.tags,
          q: p.q,
          status: p.status,
          source: 'mma',
          _semantic_score: Math.round(semanticScore * 100) / 100,
          _match_score: Math.round(matchScore * 1000) / 1000,
        });
      }
    }
  } catch (e) { /* fallback: 降级到acquire */ }

  // 降级: 如果直接搜索失败，用acquire走deqi
  if (candidates.length === 0) {
    const result = acquire({
      tags: Array.from(searchTags),
      limit: limit * 2,
      query: opts.query || questionType || '',
    });
    if (result.entries && result.entries.length > 0) {
      for (const e of result.entries) {
        if (e.content && matchStepPrefix(e.content, stepName)) candidates.push(e);
      }
    }
  }

  // 过滤低相关候选(语义分=0且仅有类型标签匹配 → 不相关)
  var relevant = candidates.filter(function(c) { return (c._semantic_score || 0) > 0 || c.tags.some(function(t) { return t === questionType }) })
  if (relevant.length === 0 && candidates.length > 0) {
    // 语义分=0但仍有标签匹配 → 降级返回最多3条(聊胜于无)
    relevant = candidates.slice(0, 3)
  }
  relevant.sort((a, b) => (b._match_score || 0) - (a._match_score || 0));
  return relevant.slice(0, limit);
}

/**
 * 召回错误警告 — 在所有 LLM 思考之前，先告诉它过去犯过的错
 *
 * 数据来源:
 *   1. REFUTED 知识点 — 用户明确说不对
 *   2. 验证发现 — verification issues
 *   3. 用户修正记录 — corrections
 *
 * @param {string} questionType — 当前问题类型
 * @param {string} stepName — 当前步骤名(可选，特定步骤的错误)
 * @param {object} opts — 可选: limit
 * @returns {Array} 错误警告列表 [{ type, summary, detail, severity }]
 */
function recallErrors(questionType, stepName, opts = {}) {
  const limit = opts.limit || 5;
  const errors = [];

  // 1. REFUTED 知识点 — 用户明确说不对
  try {
    const io = require('./mma/io');
    const kg = io.loadMMA();
    for (const [, m] of Object.entries(kg.meridians)) {
      for (const p of m.points) {
        if (p.status === 'REFUTED' && !p.hidden) {
          const tags = p.tags || [];
          const typeMatch = !questionType || tags.some(t => questionType.includes(t));
          if (typeMatch) {
            errors.push({ type: 'refuted', summary: '用户驳斥: ' + (p.description || '').substring(0, 80), detail: (p.description || '').substring(0, 200), severity: 'high', tags: tags.slice(0, 5) });
          }
        }
      }
    }
    for (const [, m] of Object.entries(kg.extra)) {
      for (const p of m.points) {
        if (p.status === 'REFUTED' && !p.hidden) {
          const tags = p.tags || [];
          const typeMatch = !questionType || tags.some(t => questionType.includes(t));
          if (typeMatch) {
            errors.push({ type: 'refuted', summary: '用户驳斥: ' + (p.description || '').substring(0, 80), detail: (p.description || '').substring(0, 200), severity: 'high', tags: tags.slice(0, 5) });
          }
        }
      }
    }
  } catch (e) {}

  // 2. 保洁降权记录已由 MMA 状态和标签覆盖。

  errors.sort(function(a, b) {
    if (a.severity === 'high' && b.severity !== 'high') return -1
    if (a.severity !== 'high' && b.severity === 'high') return 1
    return 0
  });
  return errors.slice(0, limit);
}

/**
 * Record outcome — update knowledge classification based on real-world result.
 *
 * When user confirms → REINFORCE (move toward CONFIRMED)
 * When user corrects/refutes → DISPUTED or REFUTED
 *
 * @param {string} pointId
 * @param {'confirmed'|'refuted'|'corrected'} outcome
 * @param {string} detail — user's correction detail
 */
function recordOutcome(pointId, outcome, detail = '') {
  if (!MMA_SCRIPT || !pointId) return;

  if (outcome === 'confirmed') {
    // Reinforce: move toward CONFIRMED
    spawnSync('node', [MMA_SCRIPT, 'mma', 'reinforce', pointId, '0.15',
      JSON.stringify({ source: 'user_confirmation' })], childProcessOptions({ timeout: 5000 }));
  } else if (outcome === 'refuted' || outcome === 'corrected') {
    // Store correction as new knowledge
    const correctionEntry = {
      description: `[CORRECTION] ${detail || 'User refuted previous knowledge'}`,
      tags: ['correction', 'refuted'],
      emotion: 'jing',
      q: 0.9,
      source: 'user_correction',
    };
    const storeResult = store(correctionEntry);
    if (storeResult) {
      // Schedule original point for review: reinforce with strong negative + force_refuted
      spawnSync('node', [MMA_SCRIPT, 'mma', 'reinforce', pointId, '-0.5',
        JSON.stringify({ force_refuted: true, source: 'user_correction', reason: detail.substring(0, 200) })], childProcessOptions({ timeout: 5000 }));
    }
  }
}

/**
 * Classify all existing MMA knowledge — generate summary.
 */
function classify(kg) {
  const summary = { confirmed: [], refuted: [], uncertain: [], unused: [] };
  for (const [, m] of Object.entries(kg.meridians)) {
    for (const p of m.points) {
      if (p.hidden) continue;
      if (p.status === 'CONFIRMED' && p.consolidation_score >= 3) {
        summary.confirmed.push({ id: p.id, desc: (p.description || '').substring(0, 60), q: p.q });
      } else if (p.status === 'REFUTED' || p.status === 'DISPUTED') {
        summary.refuted.push({ id: p.id, desc: (p.description || '').substring(0, 60) });
      } else if (p.status === 'SLEEPING' || p.status === 'ARCHIVED') {
        summary.unused.push({ id: p.id, desc: (p.description || '').substring(0, 60) });
      } else {
        summary.uncertain.push({ id: p.id, desc: (p.description || '').substring(0, 60), status: p.status, q: p.q });
      }
    }
  }
  return summary;
}

/**
 * Link two knowledge points (traceability anchor).
 * Records that conclusion `fromId` was based on data `toId`.
 * Stored as a related_point with relation type.
 */
function link(fromId, toId, relation = 'based_on') {
  if (!MMA_SCRIPT || !fromId || !toId) return;
  const io = require('./mma/io');
  const kg = io.loadMMA();
  const from = io.findPointById(kg, fromId);
  const to = io.findPointById(kg, toId);
  if (!from || !to) return;
  from.point.related_points = from.point.related_points || [];
  if (!from.point.related_points.some(r => r.id === toId && r.relation === relation)) {
    from.point.related_points.push({ id: toId, relation, at: new Date().toISOString() });
    io.saveMMA(kg);
  }
}

/**
 * Mark that a conclusion was verified/refuted by the user.
 * Propagates verdict to all linked knowledge points.
 */
function tagVerdict(pointId, verdict = 'confirmed', detail = '') {
  if (!MMA_SCRIPT || !pointId) return;
  const io = require('./mma/io');
  const kg = io.loadMMA();
  const point = io.findPointById(kg, pointId);
  if (!point) return;

  const p = point.point;
  // Store verdict as a special tag
  p.tags = p.tags || [];
  const verdictTag = 'verdict:' + verdict;
  if (!p.tags.includes(verdictTag)) p.tags.push(verdictTag);
  if (detail && !p.tags.includes('correction:' + detail.substring(0, 20))) {
    p.tags.push('correction:' + detail.substring(0, 20).replace(/\s+/g, '_'));
  }

  if (verdict === 'refuted' || verdict === 'corrected') {
    // Propagate to all linked points: mark them as DISPUTED
    const related = p.related_points || [];
    for (const r of related) {
      const linked = io.findPointById(kg, r.id);
      if (linked && linked.point.status === 'CONFIRMED') {
        linked.point.status = 'DISPUTED';
        linked.point.tags = linked.point.tags || [];
        if (!linked.point.tags.includes('disputed_by:' + pointId)) {
          linked.point.tags.push('disputed_by:' + pointId);
        }
      }
    }
  } else if (verdict === 'confirmed') {
    // Reinforce all linked points
    const related = p.related_points || [];
    for (const r of related) {
      spawnSync('node', [MMA_SCRIPT, 'mma', 'reinforce', r.id, '0.1',
        JSON.stringify({ source: 'user_confirmation_chain' })], childProcessOptions({ timeout: 3000 }));
    }
  }

  // Record the verdict as MMA knowledge
  const verdictEntry = {
    description: `[${verdict}] ${detail || pointId}`,
    tags: ['verdict', verdict, 'anchor'],
    emotion: verdict === 'confirmed' ? 'xi' : 'jing',
    q: verdict === 'confirmed' ? 0.9 : 1.0,
    source: 'user_' + verdict,
  };
  store(verdictEntry);
  io.saveMMA(kg);
}

/**
 * Record that a knowledge point was used in a specific pipeline step.
 */
function usedInStep(pointId, stepName) {
  if (!MMA_SCRIPT || !pointId || !stepName) return;
  const io = require('./mma/io');
  const kg = io.loadMMA();
  const point = io.findPointById(kg, pointId);
  if (!point) return;
  point.point.tags = point.point.tags || [];
  const useTag = 'used_in:' + stepName;
  if (!point.point.tags.includes(useTag)) {
    point.point.tags.push(useTag);
    io.saveMMA(kg);
  }
}

/**
 * Trace a conclusion back to its source knowledge.
 * Returns: { conclusion_id, based_on: [{ id, description, tags, status }], step_usage: [] }
 */
function trace(pointId) {
  if (!MMA_SCRIPT || !pointId) return null;
  const io = require('./mma/io');
  const kg = io.loadMMA();
  const point = io.findPointById(kg, pointId);
  if (!point) return null;

  const p = point.point;
  const related = (p.related_points || []).filter(r => r.relation === 'based_on');
  const basedOn = related.map(r => {
    const rp = io.findPointById(kg, r.id);
    return rp ? { id: rp.point.id, description: (rp.point.description || '').substring(0, 80), tags: rp.point.tags, status: rp.point.status } : { id: r.id, status: 'not_found' };
  });

  const stepUsage = (p.tags || []).filter(t => t.startsWith('used_in:')).map(t => t.replace('used_in:', ''));

  return {
    conclusion_id: pointId,
    description: (p.description || '').substring(0, 100),
    verdict: (p.tags || []).filter(t => t.startsWith('verdict:')).map(t => t.replace('verdict:', '')),
    based_on: basedOn,
    step_usage: stepUsage,
    status: p.status,
    q: p.q,
  };
}

module.exports = { acquire, store, recordOutcome, classify, link, tagVerdict, usedInStep, trace, listRefuted, storeStepOutput, recallStepHistory, recallErrors };

if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === 'status') {
    const io = require('./mma/io');
    const kg = io.loadMMA();
    const summary = classify(kg);
    console.log('=== 知识分类 ===');
    console.log(`✅ 已验证正确 (CONFIRMED): ${summary.confirmed.length}`);
    summary.confirmed.forEach(k => console.log(`   ${k.id}: ${k.desc}`));
    console.log(`\n❌ 已知错误 (REFUTED/DISPUTED): ${summary.refuted.length}`);
    summary.refuted.forEach(k => console.log(`   ${k.id}: ${k.desc}`));
    console.log(`\n❓ 未验证 (HYPOTHESIS/PROVISIONAL): ${summary.uncertain.length}`);
    summary.uncertain.forEach(k => console.log(`   ${k.id} [${k.status}] q=${k.q}: ${k.desc}`));
    console.log(`\n💤 休眠 (SLEEPING/ARCHIVED): ${summary.unused.length}`);
  } else if (cmd === 'refuted') {
    const list = listRefuted();
    console.log(JSON.stringify(list, null, 2));
  } else if (cmd === 'acquire') {
    const queryOpts = JSON.parse(process.argv[3] || '{}');
    const tags = queryOpts.tags || queryOpts || [];
    const result = acquire({ tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? [tags] : []), limit: queryOpts.limit || 5 });
    // 输出 entries 数组 (兼容 findExistingLesson 的 Array.isArray 检查)
    console.log(JSON.stringify(result.entries || [], null, 2));
  } else {
    console.log('Usage: node scripts/knowledge.js <status|acquire|refuted>');
  }
}
