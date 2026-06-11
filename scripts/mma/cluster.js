/** ═══════════════════════════════════════════════════════════════
 *  腧穴集群 (Chunking) — 自动发现共现穴位组
 *  "脑为元神之府" —《本草纲目》
 *  当多个穴位经常被同时召回，它们自动形成一个"穴群"(知识组块)
 *  这是大脑Chunking的经络映射
 * ═══════════════════════════════════════════════════════════════ */

const CO_OCCURRENCE_THRESHOLD = 3; // 共现≥3次 → 成组

/**
 * 记录一次共现 — 每次deqi返回的多个穴位互相关联
 * @param {object} kg
 * @param {array} recalledPointIds — 本次召回的所有穴位ID
 */
function recordCoOccurrence(kg, recalledPointIds) {
    if (recalledPointIds.length < 2) return;
    if (!kg.meta.co_occurrence) kg.meta.co_occurrence = {};

    for (let i = 0; i < recalledPointIds.length; i++) {
        for (let j = i + 1; j < recalledPointIds.length; j++) {
            const pair = [recalledPointIds[i], recalledPointIds[j]].sort().join('::');
            kg.meta.co_occurrence[pair] = (kg.meta.co_occurrence[pair] || 0) + 1;
        }
    }
}

/**
 * 腧穴集群检测 — 扫描共现矩阵，找出>=3次共现的穴位组
 * 自动将共现频繁的穴位标记为同一个"穴群"
 * 穴群有一个"原穴"(leader) — 巩固分最高的穴位
 */
function clusterDetect(kg) {
    if (!kg.meta.co_occurrence) return [];
    const clusters = {};
    const pointCluster = {}; // pointId → clusterId

    for (const [pair, count] of Object.entries(kg.meta.co_occurrence)) {
        if (count < CO_OCCURRENCE_THRESHOLD) continue;
        const [a, b] = pair.split('::');

        let clusterId;
        if (pointCluster[a] && pointCluster[b]) {
            // 合并两个集群
            clusterId = pointCluster[a];
            if (pointCluster[b] !== clusterId) {
                const oldId = pointCluster[b];
                for (const [pid, cid] of Object.entries(pointCluster)) {
                    if (cid === oldId) pointCluster[pid] = clusterId;
                }
                clusters[clusterId] = [...new Set([...clusters[clusterId], ...clusters[oldId]])];
                delete clusters[oldId];
            }
        } else if (pointCluster[a]) {
            clusterId = pointCluster[a];
        } else if (pointCluster[b]) {
            clusterId = pointCluster[b];
        } else {
            clusterId = `cluster_${Object.keys(clusters).length + 1}`;
        }

        if (!clusters[clusterId]) clusters[clusterId] = [];
        if (!clusters[clusterId].includes(a)) clusters[clusterId].push(a);
        if (!clusters[clusterId].includes(b)) clusters[clusterId].push(b);
        pointCluster[a] = clusterId;
        pointCluster[b] = clusterId;
    }

    // 为每个集群选原穴(leader) — 巩固分最高的
    const result = [];
    for (const [cid, pointIds] of Object.entries(clusters)) {
        if (pointIds.length < 2) continue;
        let leader = null, bestScore = -1;
        for (const pid of pointIds) {
            const found = findPointById(kg, pid);
            if (found && (found.consolidation_score || 0) > bestScore) {
                bestScore = found.consolidation_score || 0;
                leader = pid;
            }
        }
        result.push({
            cluster_id: cid,
            size: pointIds.length,
            leader,
            members: pointIds,
            element: detectClusterElement(kg, pointIds),
        });

        // 标记穴位
        for (const pid of pointIds) {
            const found = findPointById(kg, pid);
            if (found) {
                found.cluster_id = cid;
                if (pid === leader && !found.special_type) found.special_type = 'yuan';
            }
        }
    }

    kg.meta.clusters = result;
    kg.meta.last_cluster_detect = new Date().toISOString();
    return result;
}

/** 推断集群的五行属性 */
function detectClusterElement(kg, pointIds) {
    const elements = {};
    for (const pid of pointIds) {
        const found = findPointById(kg, pid);
        if (found?.five_element) elements[found.five_element] = (elements[found.five_element] || 0) + 1;
    }
    let best = null, bestCount = 0;
    for (const [el, count] of Object.entries(elements)) {
        if (count > bestCount) { bestCount = count; best = el; }
    }
    return best;
}

function findPointById(kg, pointId) {
    for (const m of Object.values(kg.meridians)) {
        const p = m.points.find(p => p.id === pointId);
        if (p) return p;
    }
    for (const m of Object.values(kg.extra)) {
        const p = m.points.find(p => p.id === pointId);
        if (p) return p;
    }
    return null;
}

module.exports = { recordCoOccurrence, clusterDetect, findPointById };