#!/usr/bin/env node
/**
 * orchestrate.js — 增量式步骤存储 + 流程收尾
 *
 * 不在流程开始前加载任何东西，各步骤独立查询自己的历史。
 * 这个脚本只做两件事:
 *   存一步产出到MMA + 记指标  |  流程结束后的保洁+学习
 *
 * 用法:
 *   node skills/ponder/scripts/orchestrate.js step <步骤名> <问题类型> '<步骤输出JSON>'
 *     存一步产出到MMA + 记录该步指标
 *
 *   node skills/ponder/scripts/orchestrate.js finalize <问题类型> <问题描述>
 *     知识保洁 + 权重学习 + 进化分析
 *
 *   node skills/ponder/scripts/orchestrate.js rules <步骤名> <问题类型>
 *     查本步命中的自适应进化规则（供管线起跑前注入prompt参考）
 */
const fs = require('fs');
const path = require('path');
const { dataRoot, initializeDataFile, resolvePlugin } = require('../../../scripts/runtime-paths');

const DATA_DIR = dataRoot;
const META_FILE = initializeDataFile(
  'pipeline-meta.json',
  resolvePlugin('skills', 'ponder', 'resources', 'pipeline-meta.json')
);

// 延迟加载
var _WeightRegistry = null;
function getWeightRegistry() {
  if (!_WeightRegistry) {
    var wr = require('./weights');
    _WeightRegistry = new wr.WeightRegistry();
  }
  return _WeightRegistry;
}

// ── History: 查步骤历史（top 3） ──
function queryHistory(stepName, questionType) {
  var result = { entries: [] };
  try {
    var knowledge = require('../../../scripts/knowledge');
    var hist = knowledge.recallStepHistory(stepName, questionType, { query: '', limit: 20 });
    if (hist && hist.length > 0) {
      result.entries = hist.slice(0, 3).map(function(h) { return { content: (h.content || '').substring(0, 200), q: h.q, status: h.status }; });
      result.count = hist.length;
    }
  } catch(e) { result.error = e.message; }
  console.log(JSON.stringify(result));
}

// ── Rules: 查本步命中的自适应进化规则（薄包装 evolve.getMatchingRules） ──
function queryRules(stepName, questionType) {
  var result = { matched: [] };
  try {
    var evolve = require('./evolve');
    var rules = evolve.getMatchingRules(questionType, stepName);
    if (rules && rules.length > 0) {
      result.matched = rules.map(function(r) {
        return {
          id: r.id,
          step: r.condition && r.condition.step,
          action: r.action && r.action.type,
          description: r.action && r.action.description,
          details: r.action && r.action.details
        };
      });
      result.count = rules.length;
    }
  } catch(e) { result.error = e.message; }
  console.log(JSON.stringify(result));
}

// ── Step: 存一步产出 + 记一步指标 ──
function storeStep(stepName, questionType, stepOutputJson, userRequest) {
  var output;
  // 宽松解析:先试直接 parse,失败则尝试从自然语言中抠出 JSON 块,再失败则降级存原始文本不崩
  function extractJson(str) {
    if (!str || typeof str !== 'string') return null;
    try { return JSON.parse(str); } catch(e) {}
    // 尝试 ```json ... ``` 代码块
    var m = str.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) { try { return JSON.parse(m[1]); } catch(e) {} }
    // 尝试第一个 { 到最后一个 } 之间
    var s = str.indexOf('{'), e2 = str.lastIndexOf('}');
    if (s !== -1 && e2 > s) { try { return JSON.parse(str.slice(s, e2+1)); } catch(e) {} }
    return null;
  }
  output = extractJson(stepOutputJson);
  if (!output) {
    // 降级:不崩,存原始文本,记 warning,指标用空对象
    console.error('⚠️ 步骤输出非合法JSON,降级存原始文本(step=' + stepName + ')');
    output = { _fallback_raw: true, _raw_text: String(stepOutputJson).slice(0, 2000) };
  }

  var result = { stored: false, metric_recorded: false };

  // 1. 存步骤产出到MMA
  try {
    var knowledge = require('../../../scripts/knowledge');
    knowledge.storeStepOutput(stepName, questionType, stepOutputJson, {
      tags: [questionType],
      user_request: userRequest || '',
    });
    result.stored = true;
  } catch(e) { console.error('存储步骤产出失败:', e.message); }

  // 2. 记指标
  try {
    var metrics = require('./pipeline-metrics');
    var record = metrics.collectStep(stepName, output, {
      question_type: questionType,
      user_request: userRequest || '',
    });
    metrics.appendStepMetric(record);
    result.metric_recorded = true;
    result.is_clear = record.is_clear;
    result.questions = record.questions_count;
  } catch(e) { console.error('记录指标失败:', e.message); }

  console.log(JSON.stringify(result));
}

// ── Finalize: 所有步骤完成后保洁+学习 ──
function finalize(questionType, userRequest) {
  var result = {
    grooming_done: false,
    weights_learned: false,
    evolve_analyzed: false,
  };

  // 1. 知识保洁
  try {
    var io = require('../../../scripts/mma/io');
    var kg = io.loadMMA();
    var decay = require('../../../scripts/mma/decay');
    var actions = decay.knowledgeGroom(kg);
    if (actions && actions.length > 0) io.saveMMA(kg);
    result.grooming_done = true;
    result.groomed = (actions || []).length;
  } catch(e) { console.error('知识保洁失败:', e.message); }

  // 2. 进化分析 (先跑分析, 结果驱动后续权重学习)
  var evolve = null;
  var analysis = null;
  try {
    evolve = require('./evolve');
    var runs = evolve.loadRuns();
    if (runs.length >= 3) {
      analysis = evolve.analyze(runs);
      result.evolve_analyzed = analysis.total_runs > 0;
    }
  } catch(e) { console.error('进化分析失败:', e.message); }

  // 3. 权重学习 (从进化分析结果驱动, 替代占位 learn)
  try {
    var registry = getWeightRegistry();
    if (analysis && evolve && typeof evolve.integrateWeightsFromAnalysis === 'function') {
      var weightLogs = evolve.integrateWeightsFromAnalysis(analysis);
      result.weights_learned = weightLogs.length > 0;
      result.weight_logs = weightLogs;
    } else {
      // 数据不足时回退到冷启动占位学习
      if (registry.weights._total_learns === undefined || registry.weights._total_learns === 0) {
        registry.learn('uncertainty_ambiguity', 0.02);
        result.weights_learned = true;
      }
    }
  } catch(e) { console.error('权重学习失败:', e.message); }

  // 4. pipeline-meta 版本递增
  try {
    if (fs.existsSync(META_FILE)) {
      var meta = JSON.parse(fs.readFileSync(META_FILE, 'utf-8'));
      if (meta.evolution) {
        meta.evolution.generation = (meta.evolution.generation || 0) + 1;
        meta.topology = meta.topology || {};
        meta.topology.mutation_count = (meta.topology.mutation_count || 0) + 1;
        meta.free_energy = meta.free_energy || { current: 0, history: [], threshold: 0.4 };
        fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
        result.meta_updated = true;
      }
    }
  } catch(e) { console.error('meta更新失败:', e.message); }

  console.log(JSON.stringify(result));
}

function main() {
  var args = process.argv.slice(2);
  var cmd = args[0];

  if (cmd === 'history') {
    queryHistory(args[1] || '', args[2] || '');
  } else if (cmd === 'rules') {
    queryRules(args[1] || '', args[2] || '');
  } else if (cmd === 'step') {
    storeStep(args[1] || '', args[2] || '', args[3] || '{}', args[4] || '');
  } else if (cmd === 'finalize') {
    finalize(args[1] || '', args[2] || '');
  } else {
    console.log('用法:');
    console.log('  node skills/ponder/scripts/orchestrate.js history <步骤名> <问题类型>          — 查top3历史');
    console.log('  node skills/ponder/scripts/orchestrate.js rules <步骤名> <问题类型>            — 查本步命中的进化规则');
    console.log('  node skills/ponder/scripts/orchestrate.js step <步骤名> <问题类型> \'<JSON>\'   — 存一步产出+记指标');
    console.log('  node skills/ponder/scripts/orchestrate.js finalize <问题类型> <问题描述>        — 保洁+学习');
  }
}

if (require.main === module) main();
module.exports = { storeStep, finalize, queryRules };
