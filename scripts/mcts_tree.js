#!/usr/bin/env node
const { parseArgsSimple } = require('./shared');
/**
 * ═══════════════════════════════════════════════════════════════
 *  MCTS Tree — 真实树数据结构 + CRUD + UCB选择 + 回溯 + 持久化
 *  "其大无外，其小无内" — 从方案到叶子节点的完整搜索树
 * ═══════════════════════════════════════════════════════════════
 *
 *  树结构(扁平map): { nodes: { "ROOT": {...}, "N001": {...} }, ... }
 *  每个节点: { id, desc, parentId, childIds[], n, w, V, σ², nodeType, isTerminal, solutionId, mutation, lastSelected, created }
 *
 *  CLI: node mcts_tree.js <command> [args]
 *    init       --solutions '<json>'         创建根树
 *    select     <node-id>                    选择节点(返回UCB排序的子节点)
 *    add-children <parent-id> --children '<json>'  添加子节点
 *    simulate   <leaf-id> --v <V>            记录模拟结果
 *    backprop   <leaf-id>                    回溯传播到根
 *    status                                   打印树状态(紧凑)
 *    save                                     持久化到存储
 *    load       [session-id]                 从存储加载
 *    round-start                              开始新一轮选择
 * ═══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const COMPUTE = require('./mcts_compute');
const { resolveData } = require('./runtime-paths');

// ── 存储路径 ──
const TREE_DIR = resolveData('memory', 'trees');
function nodeFile(sessionId) { return path.join(TREE_DIR, `${sessionId}.json`); }
function nodeBak(sessionId) { return path.join(TREE_DIR, `${sessionId}.bak.json`); }
function ensureDir() { if (!fs.existsSync(TREE_DIR)) fs.mkdirSync(TREE_DIR, { recursive: true }); }

// ── UID 生成 ──
let _seq = 0;
function nextId() { return 'N' + String(++_seq).padStart(4, '0'); }
function resetSeq() { _seq = 0; }

// ── 新节点工厂 ──
function createNode(description, opts = {}) {
    const now = new Date().toISOString();
    return {
        id: opts.id || nextId(),
        description,
        parentId: opts.parentId || null,
        childIds: [],
        n: 0,
        w: 0,
        V: 0,
        sigma2: 0.25,
        nodeType: opts.nodeType || 'ACTION',
        isTerminal: opts.isTerminal || false,
        expansionPotential: opts.expansionPotential || 'HIGH',
        mutation: opts.mutation || [0, 0, 0, 0, 0],
        solutionId: opts.solutionId || null,
        lastSelected: null,
        created: now,
    };
}

// ── 新树工厂 ──
function createTree(solutions = []) {
    const now = new Date().toISOString();
    const root = createNode('root', { id: 'ROOT', nodeType: 'ACTION', expansionPotential: 'HIGH' });
    const tree = {
        sessionId: now.replace(/[:.]/g, '-').substring(0, 19),
        rootId: 'ROOT',
        currentNodeId: 'ROOT',
        round: 0,
        nodes: { ROOT: root },
        created: now,
        updated: now,
        complete: false,
    };
    for (const sol of (solutions || [])) {
        const nid = nextId();
        const node = createNode(sol.name || sol.description || `Solution ${nid}`, {
            id: nid, parentId: 'ROOT', solutionId: sol.id || sol.name,
            nodeType: 'ACTION',
            mutation: sol.mutation || [0, 0, 0, 0, 0],
        });
        tree.nodes[nid] = node;
        root.childIds.push(nid);
    }
    return tree;
}

// ── UCB 选择 ──
function ucbSelect(tree, nodeId, kBonus = 0) {
    const node = tree.nodes[nodeId];
    if (!node) return null;
    if (node.childIds.length === 0) return node;  // leaf node

    const parentN = node.n || 1;
    const scored = node.childIds.map(cid => {
        const child = tree.nodes[cid];
        if (!child || child.isTerminal) return null;
        const ucb = COMPUTE.computeUcb(child.V || 0, child.n || 1, parentN, 1.414, kBonus);
        return { id: cid, ucb, V: child.V, n: child.n, sigma2: child.sigma2, desc: child.description, nodeType: child.nodeType };
    }).filter(Boolean);

    if (scored.length === 0) return node;
    scored.sort((a, b) => b.ucb - a.ucb);

    // 突变向量平局处理
    const best = scored[0];
    const second = scored[1];
    if (second && Math.abs(best.ucb - second.ucb) < 0.05) {
        const bestMut = (tree.nodes[best.id]?.mutation || []).filter(m => m === 1).length;
        const secMut = (tree.nodes[second.id]?.mutation || []).filter(m => m === 1).length;
        if (secMut > bestMut) {
            [scored[0], scored[1]] = [scored[1], scored[0]];
        }
    }

    const selected = tree.nodes[scored[0].id];
    if (selected) {
        selected.lastSelected = new Date().toISOString();
        tree.currentNodeId = selected.id;
    }
    return { node: selected, ranked: scored };
}

// ── 添加子节点 ──
function addChildren(tree, parentId, childrenData = []) {
    const parent = tree.nodes[parentId];
    if (!parent) return { error: `Parent ${parentId} not found` };
    const added = [];
    for (const cd of childrenData) {
        const n = createNode(cd.description, {
            parentId, nodeType: cd.nodeType || 'ACTION', solutionId: cd.solutionId || parent.solutionId,
            mutation: cd.mutation || [0, 0, 0, 0, 0], expansionPotential: cd.expansionPotential || 'MED',
            isTerminal: cd.isTerminal || false,
        });
        tree.nodes[n.id] = n;
        parent.childIds.push(n.id);
        added.push(n);
    }
    return { added: added.map(a => ({ id: a.id, desc: a.description, type: a.nodeType })) };
}

// ── 模拟结果记录 ──
function recordSimulation(tree, leafId, v, sigma2) {
    const leaf = tree.nodes[leafId];
    if (!leaf) return { error: `Leaf ${leafId} not found` };
    leaf.V = v;
    leaf.sigma2 = sigma2 || 0.25;
    leaf.isTerminal = true;
    leaf.lastSelected = new Date().toISOString();
    return { id: leafId, V: leaf.V, sigma2: leaf.sigma2 };
}

// ── 回溯传播 ──
function backpropagate(tree, leafId) {
    const leaf = tree.nodes[leafId];
    if (!leaf) return { error: `Leaf ${leafId} not found` };

    // 从叶子往上回溯
    const path = [];
    let current = leaf;
    while (current) {
        path.unshift(current.id);
        current = current.parentId ? tree.nodes[current.parentId] : null;
    }

    // 至少根→叶
    if (path.length < 2) return { updated: 0, path };

    const leafV = leaf.V || 0;
    const leafSigma2 = leaf.sigma2 || 0.25;
    const updates = [];

    // 从叶往根传播 (不更新叶子本身, 叶子已经设好了)
    for (let i = path.length - 2; i >= 0; i--) {
        const nid = path[i];
        const node = tree.nodes[nid];
        if (!node) continue;

        const [newV, newM2, newN, newSigma2] = COMPUTE.welfordUpdate(node.V || 0, (node.sigma2 || 0.25) * Math.max(0, (node.n || 0) - 1), node.n || 0, leafV);
        node.V = Math.round(newV * 10000) / 10000;
        node.sigma2 = Math.round(newSigma2 * 10000) / 10000;
        node.n = newN;
        updates.push({ id: nid, V: node.V, n: node.n, sigma2: node.sigma2 });
    }
    tree.round++;
    tree.updated = new Date().toISOString();
    return { updated: updates.length, path, updates };
}

// ── 自动一轮MCTS ──
function autoRound(tree, parentId, childrenData, leafV, leafSigma2) {
    // 1. UCB 选择
    const sel = ucbSelect(tree, parentId);
    if (!sel) return { error: 'Cannot select' };
    const selNode = sel.node || sel;

    // 2. 展开 (如果有子节点数据)
    let added = [];
    if (childrenData && childrenData.length > 0) {
        added = addChildren(tree, selNode.id, childrenData).added;
    } else {
        return { selected: selNode.id, need_expand: true, message: 'Selected node, needs children' };
    }

    // 3. 模拟 (取第一片叶子)
    const leafId = added.length > 0 ? added[0].id : selNode.childIds[0];
    if (!leafId) return { selected: selNode.id, added, need_simulate: true };

    recordSimulation(tree, leafId, leafV, leafSigma2);

    // 4. 回溯
    const bp = backpropagate(tree, leafId);
    return { selected: selNode.id, added, leaf: leafId, V: leafV, backprop: bp };
}

// ── 树状态 (紧凑输出) ──
function treeStatus(tree) {
    const nodes = Object.values(tree.nodes);
    const root = tree.nodes[tree.rootId];
    const leaves = nodes.filter(n => n.childIds.length === 0 && !n.isTerminal);
    const terminals = nodes.filter(n => n.isTerminal);
    const bySolution = {};
    for (const n of nodes) {
        const sid = n.solutionId || '_internal';
        if (!bySolution[sid]) bySolution[sid] = [];
        bySolution[sid].push(n);
    }

    const solutionSummaries = [];
    for (const [sid, snodes] of Object.entries(bySolution)) {
        const best = snodes.reduce((a, b) => (a.n || 0) > (b.n || 0) ? a : b, snodes[0]);
        solutionSummaries.push({
            solutionId: sid,
            nodes: snodes.length,
            best: { id: best.id, V: best.V, n: best.n, sigma2: best.sigma2 },
        });
    }

    return {
        sessionId: tree.sessionId,
        round: tree.round,
        totalNodes: nodes.length,
        leaves: leaves.length,
        terminated: terminals.length,
        depth: treeDepth(tree),
        solutions: solutionSummaries,
        converged: checkConvergence(tree),
        complete: tree.complete,
    };
}

// ── 树深度 ──
function treeDepth(tree) {
    function walk(nid, d) {
        const n = tree.nodes[nid];
        if (!n || n.childIds.length === 0) return d;
        let max = d;
        for (const c of n.childIds) {
            max = Math.max(max, walk(c, d + 1));
        }
        return max;
    }
    return walk(tree.rootId, 1);
}

// ── 收敛检查 ──
function checkConvergence(tree) {
    const root = tree.nodes[tree.rootId];
    if (!root || root.childIds.length < 2) return { converged: false, reason: 'Not enough child solutions' };

    const children = root.childIds.map(cid => tree.nodes[cid]).filter(Boolean);
    const withSim = children.filter(c => c.n > 0 && c.isTerminal).sort((a, b) => (b.V || 0) - (a.V || 0));
    if (withSim.length < 2) return { converged: false, reason: 'Not enough simulated solutions' };

    const first = withSim[0], second = withSim[1];
    const vDiff = (first.V || 0) - (second.V || 0);
    const highVisits = first.n >= 5;
    const lowVar = (first.sigma2 || 1) < 0.1;
    const converged = vDiff > 0.05 && highVisits && lowVar;

    return { converged, vDiff, best: first.id, bestV: first.V, bestN: first.n, bestSigma2: first.sigma2, reason: converged ? 'Converged' : `${vDiff > 0.05 ? '' : 'V gap too small '}${highVisits ? '' : 'need more visits '}${lowVar ? '' : 'variance too high'}` };
}

// ── 持久化 ──
function saveTree(tree) {
    ensureDir();
    const fp = nodeFile(tree.sessionId);
    const bp = nodeBak(tree.sessionId);
    const json = JSON.stringify(tree, null, 2);
    const tmp = fp + '.tmp';
    fs.writeFileSync(tmp, json, 'utf-8');
    try { const fd = fs.openSync(tmp, 'r+'); fs.fsyncSync(fd); fs.closeSync(fd); } catch (e) {}
    if (fs.existsSync(fp)) fs.copyFileSync(fp, bp);
    fs.renameSync(tmp, fp);
    // 自动同步到MMA记忆: 将终态叶子节点存为知识
    try {
        const terminalNodes = Object.values(tree.nodes).filter(n => n.isTerminal && n.V > 0);
        if (terminalNodes.length > 0) {
            const mmaAshi = require('./mma/ashi');
            const io = require('./mma/io');
            const kg = io.loadMMA();
            for (const n of terminalNodes) {
                mmaAshi.ashiInsert(kg, {
                    description: `MCTS: ${n.description} V=${n.V}`,
                    tags: ['mcts_result', n.solutionId || 'unknown'].filter(Boolean),
                    category: 'judgment_and_strategy',
                    source: 'execution_result',
                    q: n.V,
                    sigma2: n.sigma2 || 0.25,
                    n: n.n || 1,
                });
            }
            io.saveMMA(kg);
        }
    } catch (e) { /* MMA sync non-blocking */ }
    return { saved: tree.sessionId, nodes: Object.keys(tree.nodes).length };
}

function loadTree(sessionId) {
    ensureDir();
    if (!sessionId) {
        const files = fs.readdirSync(TREE_DIR).filter(f => f.endsWith('.json') && !f.includes('.bak') && !f.includes('.tmp'));
        files.sort().reverse();
        if (files.length === 0) return null;
        sessionId = files[0].replace(/\.json$/, '');
    }
    const fp = nodeFile(sessionId);
    const bp = nodeBak(sessionId);
    try {
        if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf-8'));
        if (fs.existsSync(bp)) {
            const data = JSON.parse(fs.readFileSync(bp, 'utf-8'));
            fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
            return data;
        }
    } catch (e) {
        return { error: `Failed to load tree ${sessionId}: ${e.message}` };
    }
    return null;
}

function listTrees() {
    ensureDir();
    return fs.readdirSync(TREE_DIR).filter(f => f.endsWith('.json') && !f.includes('.bak') && !f.includes('.tmp')).map(f => {
        const p = path.join(TREE_DIR, f);
        const stat = fs.statSync(p);
        return { sessionId: f.replace(/\.json$/, ''), size: stat.size, modified: stat.mtime };
    }).sort((a, b) => b.modified - a.modified);
}

// ═══════════════════════════════════════════════════════════════
//  CLI
// ═══════════════════════════════════════════════════════════════
function output(data) { console.log(JSON.stringify(data, null, 2)); }

function main() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.log('MCTS Tree — Real data structure for MCTS search');
        console.log('  init      --solutions <JSON>    Create root tree');
        console.log('  select    <node-id>             UCB-select child');
        console.log('  add-children <parent> --children <JSON>');
        console.log('  simulate  <leaf-id> --v <V>     Record result');
        console.log('  backprop  <leaf-id>             Propagate up');
        console.log('  status                         Tree state');
        console.log('  save                           Persist');
        console.log('  load      [session-id]          Load');
        console.log('  list                           List sessions');
        return;
    }
    const cmd = args[0];
    const o = parseArgsSimple(args.slice(1));

    try {
        switch (cmd) {
        case 'init': {
            const solutions = JSON.parse(o.solutions || '[]');
            resetSeq();
            const tree = createTree(solutions);
            output({ sessionId: tree.sessionId, rootId: tree.rootId, solutions: solutions.length, hint: 'save → persist, select ROOT → begin' });
            // 自动保存
            saveTree(tree);
            break;
        }
        case 'select': {
            const sid = o.session;
            const tree = loadTree(sid);
            if (!tree || tree.error) { output({ error: 'No tree loaded. Use load first or pass --session' }); break; }
            const nodeId = args[1] || tree.currentNodeId || tree.rootId;
            result(tree, nodeId, o);
            break;
        }
        case 'add-children': {
            const tree = loadTree(o.session);
            if (!tree) { output({ error: 'No tree loaded' }); break; }
            const parentId = args[1] || tree.currentNodeId;
            const children = JSON.parse(o.children || '[]');
            const r = addChildren(tree, parentId, children);
            saveTree(tree);
            output({ ...r, hint: 'save persisted' });
            break;
        }
        case 'simulate': {
            const tree = loadTree(o.session);
            if (!tree) { output({ error: 'No tree loaded' }); break; }
            const leafId = args[1] || 'NONE';
            const v = parseFloat(o.v || '0.5');
            const sigma2 = parseFloat(o.sigma2 || '0.25');
            const r = recordSimulation(tree, leafId, v, sigma2);
            saveTree(tree);
            output(r);
            break;
        }
        case 'backprop': {
            const tree = loadTree(o.session);
            if (!tree) { output({ error: 'No tree loaded' }); break; }
            const leafId = args[1] || 'NONE';
            const r = backpropagate(tree, leafId);
            saveTree(tree);
            output(r);
            break;
        }
        case 'status': {
            const tree = loadTree(o.session);
            if (!tree || tree.error) { output({ error: 'No tree loaded' }); break; }
            output(treeStatus(tree));
            break;
        }
        case 'save': {
            const tree = loadTree(o.session);
            if (!tree) { output({ error: 'No tree loaded' }); break; }
            const r = saveTree(tree);
            output(r);
            break;
        }
        case 'load': {
            const sid = args[1] || null;
            const tree = loadTree(sid);
            if (!tree) { output({ error: 'No tree found' }); break; }
            // 恢复序列计数器
            const maxId = Object.keys(tree.nodes).filter(k => k.startsWith('N')).map(k => parseInt(k.slice(1))).reduce((a, b) => Math.max(a, b), 0);
            _seq = maxId;
            output({ sessionId: tree.sessionId, nodes: Object.keys(tree.nodes).length, round: tree.round, loaded: true });
            break;
        }
        case 'list': {
            output({ trees: listTrees() });
            break;
        }
        case 'round-start': {
            const tree = loadTree(o.session);
            if (!tree) { output({ error: 'No tree loaded' }); break; }
            const parentId = args[1] || tree.currentNodeId || tree.rootId;
            const sel = ucbSelect(tree, parentId);
            if (!sel) { output({ error: 'Cannot select' }); break; }
            saveTree(tree);
            if (sel.node) {
                output({ selected: sel.node.id, round: tree.round, ranked: sel.ranked, hint: 'Use add-children to expand, then simulate + backprop' });
            } else {
                output({ selected: sel.id, ranked: [], hint: 'Leaf node — simulate and backprop' });
            }
            break;
        }
        default:
            console.log(`Unknown: ${cmd}`);
        }
    } catch (e) { console.log(`Error: ${e.message}`); }
}

// select 子函数
function result(tree, nodeId, o) {
    const kBonus = parseFloat(o.kbonus || '0');
    const sel = ucbSelect(tree, nodeId, kBonus);
    if (!sel) { output({ error: `Node ${nodeId} not found` }); return; }
    if (sel.node) {
        saveTree(tree);
        output({ selected: sel.node.id, desc: sel.node.description, ranked: sel.ranked });
    } else {
        output({ selected: sel.id, desc: sel.description, ranked: [], leaf: true });
    }
}

if (require.main === module) main();
module.exports = {
    createTree, createNode, ucbSelect, addChildren, recordSimulation, backpropagate,
    treeStatus, checkConvergence, saveTree, loadTree, listTrees, autoRound,
};
