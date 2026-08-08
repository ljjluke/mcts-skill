/**
 * simple-store.js — 按知识层级分轨存储
 *
 * 三个文件独立存储：
 *   philosophy.json   — getKnowledgeLevel 返回 'philosophy' → 存入
 *   knowledge.json     — knowledge_level='domain_expert' → 存入
 *   step_history.json  — knowledge_level='step_history' → 存入
 *
 * 存储前 LLM 必须通过 checkDuplicate 检查语义重复。
 * 代码层用 anchors 做粗筛候选，LLM 精判。
 */
const io = require('./simple-io');
const { getKnowledgeLevel } = require('./domain-detector');

/**
 * 根据 knowledge_level 路由到对应文件和 ID 前缀
 */
function _route(level) {
  switch (level) {
    case 'philosophy':   return { file: 'philosophy',   prefix: 'PH' };
    case 'domain_expert': return { file: 'knowledge',    prefix: 'KN' };
    case 'step_history':  return { file: 'step_history', prefix: 'SH' };
    default:              return { file: 'knowledge',    prefix: 'KN' };
  }
}

/**
 * 锚点词粗筛：在指定 level 文件内找候选
 */
function getDedupCandidates(data, newAnchors, knowledgeLevel, domain, maxCandidates = 10) {
  if (!data || !data.points || data.points.length === 0) return [];
  if (!newAnchors || newAnchors.length === 0) return [];

  const newAnchorSet = new Set(newAnchors.map(a => a.toLowerCase()));
  const candidates = [];

  for (const p of data.points) {
    if (p.hidden || p.status === 'ARCHIVED' || p.status === 'REFUTED') continue;

    // domain_expert 时还要匹配 domain
    if (knowledgeLevel === 'domain_expert' && domain && p.domain !== domain) continue;

    const pAnchors = p.anchors || [];
    if (pAnchors.length === 0) continue;

    let matchCount = 0;
    for (const a of pAnchors) {
      if (newAnchorSet.has(a.toLowerCase())) matchCount++;
    }

    if (matchCount > 0) {
      candidates.push({
        id: p.id,
        summary: p.summary || p.description || '',
        description: p.description || '',
        anchors: pAnchors,
        tags: p.tags || [],
        q: p.q || 0.5,
        n: p.n || 0,
        status: p.status,
        knowledge_level: p.knowledge_level || knowledgeLevel,
        _match_count: matchCount,
        _weight: matchCount * 0.5 + (p.q || 0.5) * 0.3 + Math.min((p.n || 0) / 10, 1) * 0.2,
      });
    }
  }

  candidates.sort((a, b) => b._weight - a._weight);
  return candidates.slice(0, maxCandidates);
}

/**
 * 强化已有知识（去重命中时调用）
 */
function reinforceExisting(data, existingId, newTags) {
  const found = io.findById(data, existingId);
  if (!found || !found.point) return false;

  found.point.q = Math.min(1.0, (found.point.q || 0.5) + 0.05);
  found.point.n = (found.point.n || 0) + 1;
  found.point.last_verified = new Date().toISOString();

  const existingTags = new Set(found.point.tags || []);
  (newTags || []).filter(t => t && !existingTags.has(t)).forEach(t => found.point.tags.push(t));

  return true;
}

/**
 * 存储一个知识点（LLM 确认无重复后调用）
 *
 * @param {object} data - 对应文件的数据（loadKnowledge 返回的）
 * @param {object} entry - 知识条目
 * @returns {object|null} {id, status, file}
 */
function storePoint(data, entry) {
  if (!entry || !entry.description) return null;

  const raw = entry.description.trim();
  if (raw.length < 5) return null;

  // ═══ 知识层级 ═══
  const level = entry.knowledge_level || getKnowledgeLevel(raw);

  if (level === 'rejected') {
    return { id: null, status: 'SKIPPED_NO_SIGNAL', reason: '无信息量' };
  }

  // 路由
  const route = _route(level);
  const domainTag = (level === 'domain_expert') ? (entry.domain || null) : null;

  const seq = io.nextPointId(data);
  const id = route.prefix + String(seq).padStart(4, '0');
  const now = new Date().toISOString();

  const tags = (entry.tags || []).filter(t => t && t.length < 80);
  const summary = (entry.summary || '').substring(0, 200);
  const anchors = (entry.anchors || []).filter(a => a && a.length < 50).slice(0, 10);

  const point = {
    id,
    description: raw.substring(0, 500),
    summary: summary || raw.substring(0, 100),
    tags,
    anchors,
    category: entry.category || 'general',
    status: 'HYPOTHESIS',
    epistemic_status: entry.epistemic_status || 'deduced',
    q: entry.q || 0.5,
    n: 0,
    sigma2: 0.25,
    consolidation_score: 0,
    created_at: now,
    last_verified: now,
    source: entry.source || 'unknown',
    knowledge_level: level,
    domain: domainTag,
  };

  if (entry.original_example) {
    point.original_example = String(entry.original_example).substring(0, 500);
  }

  data.points.push(point);
  return { id, status: 'HYPOTHESIS', file: route.file };
}

/**
 * 存储并持久化
 */
function store(entry) {
  if (!entry || !entry.description) return null;
  const level = entry.knowledge_level || getKnowledgeLevel(entry.description.trim());
  const route = _route(level);
  if (level === 'rejected') return { id: null, status: 'SKIPPED_NO_SIGNAL' };

  const data = io.loadKnowledge(route.file);
  const result = storePoint(data, entry);
  if (result && result.id) io.saveKnowledge(route.file, data);
  return result;
}

module.exports = { storePoint, store, getDedupCandidates, reinforceExisting };
