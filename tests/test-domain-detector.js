#!/usr/bin/env node
/**
 * domain-detector 回归测试 — 代码层只做格式马桶
 *
 * 用法: node tests/test-domain-detector.js
 * 退出码: 0=全通过, 1=有失败
 *
 * 覆盖:
 *  1. getKnowledgeLevel 拒绝叙事/代码格式/闲聊/太短/步骤前缀
 *  2. needsAbstraction 只检测硬格式信号（代码/金额/URL等）
 *  3. 现有真实知识库数据不因本检测而误标
 *
 * 设计原则: 代码层不做语义判断（不靠关键词做领域分类），语义交给 LLM。
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { getKnowledgeLevel, needsAbstraction } = require(path.join(ROOT, 'scripts/mma/domain-detector'));

const CASES = [
  // ═══ getKnowledgeLevel — 代码层格式检测 ═══

  // 拒绝：格式负面信号
  ['我们先尝试了用缓存优化命中率', 'rejected', 'level'], // 叙事句式
  ['[step:shensi] 核心管线健康', 'rejected', 'level'], // 步骤前缀
  ['今天天气不错', 'rejected', 'level'], // 太短/闲聊
  ['510300沪深300ETF成交量突破均线', 'rejected', 'level'], // 股票代码格式

  // 通过：LLM 层判断
  ['目标函数冲突是系统性失败的常见根因', 'philosophy', 'level'],
  ['止损策略在震荡市中胜率约40%', 'philosophy', 'level'], // 代码层不拒绝，LLM 层会归为 domain_expert
  ['通过akshare拉取行情并存储到本地', 'philosophy', 'level'], // 没有负面格式信号，通过格式层

  // ═══ needsAbstraction — 格式硬信号检测 ═══

  // 命中：硬格式信号
  ['510300沪深300ETF成交量突破均线', true], // 股票代码
  ['预算100万元人民币用于基础设施升级', true], // 金额格式
  ['参考文档 https://example.com/migration-guide', true], // URL
  ['510050沪深300指数，占总仓位30%', true], // 代码+百分比

  // 不命中：无硬格式信号（纯文字描述，语义判断留给 LLM）
  ['目标函数冲突导致系统性失败', false],
  ['通过akshare拉取行情并存储到本地', false], // 平台名不是硬格式，LLM 判断
  ['该方案需要至少2核CPU 4GB内存的实例', false], // 硬件规格不是硬格式，LLM 判断
  ['优化后qps从1200提升到4500', false], // qps 是通用指标

  // 回归：现有知识不误标
  ['目标函数冲突导致系统性失败', false],
  ['核心管线健康,死引用清理不彻底', false],
  ['李小龙哲学11命题查证:框架已全部落地', false],
];

let pass = 0, fail = 0;
const failed = [];
for (const entry of CASES) {
  const [input, expected, mode] = entry;
  const got = mode === 'level' ? getKnowledgeLevel(input) : needsAbstraction(input);
  if (got === expected) {
    pass++;
  } else {
    fail++;
    failed.push({ input, got, expected, mode });
  }
}

if (fail === 0) {
  console.log(`✅ domain-detector 回归测试全部通过 (${pass}/${CASES.length})`);
  process.exit(0);
} else {
  console.error(`❌ domain-detector 回归测试 ${fail} 失败:`);
  for (const { input, got, expected } of failed) {
    console.error(`  - ${JSON.stringify(String(input).slice(0, 50))}) = ${got}, 期望 ${expected}`);
  }
  process.exit(1);
}
