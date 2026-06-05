#!/usr/bin/env python3
"""
MCTS-TD 数值计算引擎
将 MCTS 树搜索中的纯数值计算逻辑从 Markdown 规则中提取为 Python 函数，
减少 LLM 上下文消耗，提高计算准确性和可复现性。

模块:
  1. UCB/CLT-UCB 计算
  2. 反向传播与价值更新 (Welford + Gamma折扣)
  3. 收敛判定
  4. 知识状态机
  5. 评分与策略映射
  6. 粗筛与排名

用法:
  python mcts_compute.py ucb --v 0.8 --n 3 --parent-n 10
  python mcts_compute.py backprop --path-vals "0.9,0.85,0.7" --leaf-v 0.8
  python mcts_compute.py converge --v-history "0.85,0.83,0.84" --n 5 --sigma2 0.03
  python mcts_compute.py status-transition --current HYPOTHESIS --event "verified_positive"
  python mcts_compute.py rank --solutions '[{"name":"A","v":0.84,"n":5,"sigma2":0.03}]'
"""

import math
import json
import sys
from datetime import datetime, timedelta
from typing import Optional


# ============================================================================
# 模块 1: UCB/CLT-UCB 计算
# ============================================================================

def compute_ucb(v: float, n_child: int, n_parent: int, c: float = 1.414,
                k_bonus: float = 0.0) -> float:
    """
    MCTS 标准 UCB 公式（含知识图谱偏置）。

    UCB = V + c * sqrt(ln(N_parent) / n_child) + K_bonus

    Args:
        v: 子节点平均价值
        n_child: 子节点访问次数
        n_parent: 父节点访问次数
        c: 探索常数，默认 sqrt(2) ≈ 1.414
        k_bonus: 知识图谱偏置项

    Returns:
        UCB 值，n_child=0 时返回 inf
    """
    if n_child == 0:
        return float('inf')
    exploration = c * math.sqrt(math.log(n_parent) / n_child)
    return v + exploration + k_bonus


def compute_clt_ucb(v: float, sigma2: float, n_i: int, N: int) -> float:
    """
    CLT-UCB 公式（用于汇总比较阶段）。

    UCB = V + Phi_inv(N) * sqrt(sigma2 / n_i)

    Args:
        v: 方案平均价值
        sigma2: 价值方差
        n_i: 当前方案推演次数
        N: 方案总数

    Returns:
        CLT-UCB 值
    """
    # Phi^{-1}(N) 近似值
    phi_inv_map = {2: 1.5, 3: 1.0, 4: 0.8, 5: 0.7}
    phi_inv = phi_inv_map.get(N, 0.5)
    exploration = phi_inv * math.sqrt(sigma2 / n_i)
    return v + exploration


def select_best_child(children: list[dict], parent_n: int, c: float = 1.414) -> dict:
    """
    从子节点列表中选择 UCB 最大的节点。

    Args:
        children: [{"name": str, "v": float, "n": int, "k_bonus": float}, ...]
        parent_n: 父节点访问次数
        c: 探索常数

    Returns:
        UCB 最大的子节点
    """
    best = None
    best_ucb = -float('inf')
    for child in children:
        ucb = compute_ucb(
            child.get("v", 0.0),
            child.get("n", 0),
            parent_n,
            c,
            child.get("k_bonus", 0.0)
        )
        if ucb > best_ucb:
            best_ucb = ucb
            best = child
    return best


# ============================================================================
# 模块 2: 反向传播与价值更新 (Welford + Gamma折扣)
# ============================================================================

def welford_update(mu: float, m2: float, n: int, x: float) -> tuple[float, float, int, float]:
    """
    Welford 在线方差更新（单步）。

    Args:
        mu: 历史均值
        m2: 历史 M2
        n: 历史计数
        x: 新值

    Returns:
        (mu_new, m2_new, n_new, variance)
    """
    n_new = n + 1
    delta = x - mu
    mu_new = mu + delta / n_new
    delta2 = x - mu_new
    m2_new = m2 + delta * delta2
    variance = m2_new / n_new if n_new > 0 else 0.0
    return mu_new, m2_new, n_new, variance


def welford_batch(values: list[float], gamma: float = 0.9) -> float:
    """
    Welford 批量更新（用于资格迹回溯）。

    从轨迹末尾向前，用 gamma 折扣累加。

    Args:
        values: 轨迹值列表 [x_1, x_2, ..., x_k]
        gamma: 折扣因子

    Returns:
        折扣累加后的最终值
    """
    current = values[-1]
    for i in range(len(values) - 2, -1, -1):
        current = gamma * current + values[i]
    return current


def backpropagate_path(path: list[dict], v_leaf: float) -> list[dict]:
    """
    沿路径反向传播，更新每个节点的统计量。

    Args:
        path: 节点列表 [root, ..., leaf]
        v_leaf: 叶节点模拟结果

    Returns:
        更新后的路径（就地修改）
    """
    for node in reversed(path):
        n = node.get("n", 0)
        w = node.get("w", 0.0)
        m2 = node.get("m2", 0.0)
        v = node.get("v", 0.0)

        n_new = n + 1
        w_new = w + v_leaf
        v_new = w_new / n_new

        # Welford 更新
        if n == 0:
            m2_new = 0.0
            sigma2 = 0.0
        else:
            delta = v_leaf - v
            delta2 = v_leaf - v_new
            m2_new = m2 + delta * delta2
            sigma2 = m2_new / n_new

        node["n"] = n_new
        node["w"] = w_new
        node["v"] = v_new
        node["m2"] = m2_new
        node["sigma2"] = sigma2

    return path


def compute_td_error(v_actual: float, v_predicted: float) -> float:
    """计算 TD 误差。"""
    return v_actual - v_predicted


def gamma_backpropagate(trace: list[float], gamma: float,
                        scores: list[float]) -> list[float]:
    """
    Gamma 折扣反向传播（来自 tetris_mcts backup_trace_obs）。

    Args:
        trace: 轨迹值
        gamma: 折扣因子
        scores: 每个节点的即时分数

    Returns:
        更新后的价值列表
    """
    current_value = trace[-1]
    updated = [0.0] * len(trace)
    updated[-1] = current_value

    for i in range(len(trace) - 2, -1, -1):
        v_corrected = current_value - scores[i]
        discounted = gamma * v_corrected + scores[i]
        updated[i] = discounted
        current_value = discounted

    return updated


# ============================================================================
# 模块 3: 收敛判定
# ============================================================================

def check_value_stability(v_history: list[float], threshold: float = 0.05) -> bool:
    """
    检查最近 3 轮的价值是否稳定。

    Args:
        v_history: 最近几轮的价值列表
        threshold: 变化阈值

    Returns:
        True 如果价值已稳定
    """
    if len(v_history) < 3:
        return False
    recent = v_history[-3:]
    max_change = max(abs(recent[i] - recent[i - 1]) for i in range(1, len(recent)))
    return max_change < threshold


def check_sufficient_exploration(nodes: list[dict], min_n: int = 3) -> bool:
    """
    检查高价值节点是否已被充分探索。

    Args:
        nodes: 节点列表
        min_n: 最小访问次数

    Returns:
        True 如果所有高价值节点 n >= min_n
    """
    high_value_nodes = [n for n in nodes if n.get("v", 0) >= 0.7]
    if not high_value_nodes:
        return True
    return all(n.get("n", 0) >= min_n for n in high_value_nodes)


def check_high_confidence(n: int, sigma2: float, threshold: float = 0.05) -> bool:
    """
    检查节点是否达到高置信度。

    Args:
        n: 访问次数
        sigma2: 方差
        threshold: 方差阈值

    Returns:
        True 如果 n >= 5 且 sigma2 < threshold
    """
    return n >= 5 and sigma2 < threshold


def should_stop_iteration(root_nodes: list[dict], task_type: str,
                          current_round: int,
                          v_history: list[float]) -> tuple[bool, str]:
    """
    综合判断是否应该停止 MCTS 迭代。

    Args:
        root_nodes: Root 下的子节点列表
        task_type: 任务类型 (simple/medium/complex/debug)
        current_round: 当前迭代轮数
        v_history: 最优节点的价值历史

    Returns:
        (should_stop, reason)
    """
    max_iterations = get_max_iterations(task_type)

    if current_round >= max_iterations:
        return True, f"达到硬上限 ({max_iterations} 轮)"

    if not root_nodes:
        return True, "无可用节点"

    best = max(root_nodes, key=lambda n: n.get("v", 0))

    if check_value_stability(v_history):
        return True, "最优方案价值已稳定"

    if check_sufficient_exploration(root_nodes):
        return True, "所有高价值节点已充分探索"

    if check_high_confidence(best.get("n", 0), best.get("sigma2", 1.0)):
        return True, "最优方案达到高置信度"

    return False, "继续迭代"


def get_max_iterations(task_type: str) -> int:
    """获取任务类型的最大迭代轮数。"""
    return {
        "simple": 5,
        "medium": 10,
        "complex": 20,
        "debug": 8
    }.get(task_type, 10)


# ============================================================================
# 模块 4: 知识状态机
# ============================================================================

# 状态权重
STATUS_WEIGHTS = {
    "CONFIRMED": 1.0,
    "PROVISIONAL": 0.3,
    "DISPUTED": 0.2,
    "REFUTED": 0.0,
    "HYPOTHESIS": 0.1,
    "SLEEPING": 0.15,
    "ARCHIVED": 0.0,
}

# 状态转换规则: (当前状态, 事件) -> 新状态
TRANSITIONS = {
    ("HYPOTHESIS", "verified_positive"): "PROVISIONAL",
    ("HYPOTHESIS", "verified_negative"): "REFUTED",
    ("PROVISIONAL", "verified_positive"): "PROVISIONAL",  # 保持，等 n>=3
    ("PROVISIONAL", "contradiction"): "DISPUTED",
    ("PROVISIONAL", "verified_negative"): "REFUTED",
    ("CONFIRMED", "contradiction"): "DISPUTED",
    ("CONFIRMED", "verified_negative"): "DISPUTED",
    ("DISPUTED", "new_evidence_supports"): "CONFIRMED",  # 回滚
    ("DISPUTED", "contradiction"): "REFUTED",
    ("SLEEPING", "recalled"): "PROVISIONAL",
    ("ARCHIVED", "recalled"): "HYPOTHESIS",
}


def get_status_weight(status: str) -> float:
    """获取状态权重。"""
    return STATUS_WEIGHTS.get(status, 0.0)


def check_status_transition(current_status: str, n: int,
                            has_contradiction: bool = False,
                            contradiction_count: int = 0) -> Optional[str]:
    """
    检查知识条目是否需要状态转换。

    Args:
        current_status: 当前状态
        n: 验证次数
        has_contradiction: 是否有矛盾证据
        contradiction_count: 矛盾次数

    Returns:
        新状态，如果不需要转换则返回 None
    """
    # PROVISIONAL -> CONFIRMED: 累计 >= 3 次正面验证
    if current_status == "PROVISIONAL" and n >= 3 and not has_contradiction:
        return "CONFIRMED"

    # PROVISIONAL -> DISPUTED: 出现矛盾
    if current_status == "PROVISIONAL" and has_contradiction:
        return "DISPUTED"

    # CONFIRMED -> DISPUTED: 出现 >= 2 次矛盾
    if current_status == "CONFIRMED" and contradiction_count >= 2:
        return "DISPUTED"

    # DISPUTED -> REFUTED: 累计 >= 3 次矛盾
    if current_status == "DISPUTED" and contradiction_count >= 3:
        return "REFUTED"

    return None


def should_sleep(last_verified: str, days_threshold: int = 30) -> bool:
    """检查知识是否应该进入休眠。"""
    try:
        last = datetime.fromisoformat(last_verified)
        return (datetime.now() - last).days > days_threshold
    except (ValueError, TypeError):
        return False


def should_archive(last_verified: str, consolidation_score: int,
                   days_threshold: int = 60) -> bool:
    """检查知识是否应该归档。"""
    try:
        last = datetime.fromisoformat(last_verified)
        old_enough = (datetime.now() - last).days > days_threshold
        return old_enough and consolidation_score <= 3
    except (ValueError, TypeError):
        return False


def handle_contradiction(existing_entry: dict, new_value: float,
                         new_context: dict) -> dict:
    """
    处理知识矛盾。

    Args:
        existing_entry: 已有知识条目
        new_value: 新经验的价值
        new_context: 新经验的上下文

    Returns:
        矛盾报告
    """
    existing_v = existing_entry.get("q", 0.0)
    diff = abs(new_value - existing_v)

    if diff > 0.5:
        level = "FULL"
    elif diff > 0.2:
        level = "PARTIAL"
    else:
        level = "MINOR"

    return {
        "existing_id": existing_entry.get("id"),
        "existing_v": existing_v,
        "new_v": new_value,
        "diff": diff,
        "level": level,
        "action": {
            "FULL": "existing降一级, new创建HYPOTHESIS",
            "PARTIAL": "existing不改变状态, 记录上下文不匹配",
            "MINOR": "正常更新existing的n和q"
        }.get(level, "unknown")
    }


# ============================================================================
# 模块 7: 知识图谱偏置计算
# ============================================================================

def compute_k_bonus(kg_match: Optional[dict], n_child: int) -> dict:
    """
    计算知识图谱偏置 K_bonus。

    Args:
        kg_match: 知识图谱匹配条目，None 表示无匹配
        n_child: 子节点访问次数

    Returns:
        {"k_bonus": float, "label": str, "reason": str}
    """
    if n_child >= 3:
        return {"k_bonus": 0.0, "label": "样本充足", "reason": "n_child>=3，不再依赖先验"}
    if not kg_match:
        return {"k_bonus": 0.0, "label": "冷启动", "reason": "无知识图谱匹配"}

    status = kg_match.get("status", "")
    n = kg_match.get("n", 0)
    q = kg_match.get("q", 0.0)

    if status == "CONFIRMED" and n >= 5 and q >= 0.8:
        return {"k_bonus": 0.15, "label": "高可信偏置",
                "reason": f"CONFIRMED+n={n}+q={q:.2f}"}
    if status == "PROVISIONAL" and n < 5 and q >= 0.7:
        return {"k_bonus": 0.05, "label": "中可信偏置",
                "reason": f"PROVISIONAL+n={n}+q={q:.2f}"}
    if status in ("DISPUTED", "REFUTED") or q < 0.5:
        return {"k_bonus": -0.10, "label": "失败警告",
                "reason": f"status={status}+q={q:.2f}"}

    return {"k_bonus": 0.0, "label": "无显著偏置", "reason": "不满足偏置条件"}


# ============================================================================
# 模块 8: 发散引擎辅助函数
# ============================================================================

# 六维评分 → 视角映射
DIMENSION_TO_PERSPECTIVE = {
    "技术栈": 1, "架构模式": 2, "业务流程": 3,
    "安全合规": 4, "运维部署": 5, "用户体验": 6,
}

PERSPECTIVE_NAMES = {
    1: "技术选型视角", 2: "架构设计视角", 3: "业务流程视角",
    4: "安全优先视角", 5: "运维优先视角", 6: "用户体验视角",
    7: "性能优先视角", 8: "最小成本视角", 9: "激进创新视角",
    10: "反面视角",
}

PERSPECTIVE_BOUNDS = {"min": 4, "max": 8}

# 盲区分类
BLINDSPOT_RULES = {
    "blank": {"range": (0, 4), "label": "完全空白",
              "action": "必须先补资料，不能跳过"},
    "partial": {"range": (4, 7), "label": "部分空白",
                "action": "可生成方案但标注'待验证'"},
    "covered": {"range": (7, 11), "label": "已覆盖",
                 "action": "直接生成方案"},
}


def classify_blindspot(score: int) -> dict:
    """根据六维评分分类盲区。"""
    for key, rule in BLINDSPOT_RULES.items():
        lo, hi = rule["range"]
        if lo <= score < hi:
            return {"class": key, **rule}
    return {"class": "covered", **BLINDSPOT_RULES["covered"]}


def get_activated_perspectives(dimension_scores: dict[str, int],
                                task_type: str = "normal") -> list[int]:
    """
    根据六维评分和任务类型，返回激活的视角编号列表。

    Args:
        dimension_scores: {"技术栈": 9, "架构模式": 8, ...}
        task_type: normal | performance_sensitive | time_constrained | highly_uncertain

    Returns:
        激活的视角编号列表 (4~8个)
    """
    activated = []

    # 规则1: 评分 >= 7 的维度自动激活
    for dim, score in dimension_scores.items():
        if score >= 7 and dim in DIMENSION_TO_PERSPECTIVE:
            activated.append(DIMENSION_TO_PERSPECTIVE[dim])

    # 规则2: 任务类型补充
    if task_type == "performance_sensitive":
        activated.append(7)
    if task_type == "time_constrained":
        activated.append(8)
    if task_type == "highly_uncertain":
        activated.append(9)

    # 反面视角总是激活
    activated.append(10)

    # 去重保序
    unique = list(dict.fromkeys(activated))

    # 规则3: 数量边界
    if len(unique) < PERSPECTIVE_BOUNDS["min"]:
        # 从高评分维度补足
        sorted_dims = sorted(dimension_scores.items(), key=lambda x: x[1], reverse=True)
        for dim, score in sorted_dims:
            if dim in DIMENSION_TO_PERSPECTIVE:
                p = DIMENSION_TO_PERSPECTIVE[dim]
                if p not in unique:
                    unique.append(p)
                    if len(unique) >= PERSPECTIVE_BOUNDS["min"]:
                        break

    if len(unique) > PERSPECTIVE_BOUNDS["max"]:
        unique = unique[:PERSPECTIVE_BOUNDS["max"]]

    return unique


# ============================================================================
# 模块 9: 知识写入控制
# ============================================================================

def should_write_to_knowledge_graph(v_leaf: float, round_num: int,
                                     is_final: bool = False) -> dict:
    """
    判断是否应该将本轮经验写入知识图谱。

    Returns:
        {"should_write": bool, "reason": str}
    """
    if is_final:
        return {"should_write": True, "reason": "最终收敛后强制写入"}
    if v_leaf >= 0.8:
        return {"should_write": True, "reason": f"高价值经验(V={v_leaf:.2f}≥0.8)"}
    if v_leaf <= 0.3:
        return {"should_write": True, "reason": f"失败经验(V={v_leaf:.2f}≤0.3)，记住避免重复"}
    if round_num % 5 == 0:
        return {"should_write": True, "reason": f"第{round_num}轮批量写入"}
    return {"should_write": False, "reason": "普通经验(V在0.3~0.8)，不写入"}


def check_write_safety(existing: Optional[dict], new_q: float,
                        diff_context: bool = False) -> dict:
    """
    写入前安全检查。

    Returns:
        {"safe": bool, "issues": list[dict]}
    """
    issues = []
    if existing and abs(new_q - existing.get("q", 0)) > 0.5:
        issues.append({
            "type": "contradiction",
            "action": "创建独立HYPOTHESIS（不覆盖已有条目）",
            "existing_q": existing["q"],
            "new_q": new_q
        })
    if diff_context:
        issues.append({
            "type": "context_specific",
            "action": "标注specific_context=true，召回时降权"
        })
    return {"safe": len(issues) == 0, "issues": issues}


# ============================================================================
# 模块 10: 仲裁引擎辅助函数
# ============================================================================

def needs_re_evaluation(ranked: list[dict],
                         v_threshold: float = 0.03) -> dict:
    """
    检查第1名是否需要追加迭代。

    Returns:
        {"needs_re_eval": bool, "reason": str}
    """
    if len(ranked) < 2:
        return {"needs_re_eval": False, "reason": "只有一个方案"}
    first, second = ranked[0], ranked[1]
    v_diff = first.get("v", 0) - second.get("v", 0)
    if v_diff < v_threshold and first.get("n", 0) < second.get("n", 0):
        return {
            "needs_re_eval": True,
            "reason": f"V领先{v_diff:.3f}<{v_threshold}且n更少({first['n']}<{second['n']})，追加2轮"
        }
    return {"needs_re_eval": False, "reason": "区分度足够或探索充分"}


def check_final_convergence(root_total_n: int, solution_count: int,
                             top_solution: dict) -> dict:
    """
    最终收敛判定（仲裁排序前）。

    Returns:
        {"converged": bool, "reason": str}
    """
    if root_total_n < solution_count * 4:
        return {"converged": False,
                "reason": f"总访问次数不足(需>{solution_count * 4}, 当前{root_total_n})"}
    if top_solution.get("n", 0) < 5:
        return {"converged": False,
                "reason": f"最优方案访问次数不足(需≥5, 当前{top_solution['n']})"}
    if top_solution.get("sigma2", 1.0) >= 0.10:
        return {"converged": False,
                "reason": f"最优方案方差过大({top_solution['sigma2']:.2f}≥0.10)"}
    return {"converged": True, "reason": "所有条件满足"}


# 熔断机制
ACCURACY_WINDOW = 10


def compute_accuracy(recent_errors: list[float],
                     error_threshold: float = 0.3) -> float:
    """计算推演准确率（最近10次中|误差|<threshold的比例）。"""
    if not recent_errors:
        return 1.0
    window = recent_errors[-ACCURACY_WINDOW:]
    accurate = sum(1 for e in window if abs(e) < error_threshold)
    return accurate / len(window)


def get_fuse_mode(accuracy: float, consecutive_bad: int = 0) -> dict:
    """获取熔断模式。"""
    if consecutive_bad >= 3:
        return {"mode": "suggest_manual", "action": "建议用户手动决策"}
    if accuracy < 0.50:
        return {"mode": "pause_ask_user", "action": "暂停推演，直接问用户"}
    if accuracy < 0.70:
        return {"mode": "simplified", "action": "降级为简化推演（2步）"}
    return {"mode": "normal", "action": "正常推演"}


def should_recover_mode(recent_5_accuracy: float) -> bool:
    """检查是否应恢复完整推演模式。"""
    return recent_5_accuracy > 0.80


# 自检结论处理
SELF_CHECK_ACTIONS = {
    "通过": {"action": "执行", "require_user": False},
    "有风险": {"action": "输出报告→用户确认→执行", "require_user": True},
    "未通过": {"action": "回推演引擎重新推演", "require_user": False, "max_retries": 2},
}


def handle_self_check_result(conclusion: str, retry_count: int = 0) -> dict:
    """处理自检结论。"""
    action = SELF_CHECK_ACTIONS.get(conclusion, SELF_CHECK_ACTIONS["通过"])
    if conclusion == "未通过" and retry_count >= 2:
        return {"action": "suggest_manual", "reason": "连续2次自检未通过"}
    return action


# 再推演决策
def re_simulation_decision(ranked: list[dict],
                            second_has_simulation: bool,
                            all_affected: bool) -> dict:
    """再推演模式的决策逻辑。"""
    if all_affected:
        return {"action": "back_to_diverge",
                "reason": "所有方案都受影响，回到发散引擎重新生成方案"}
    if second_has_simulation:
        return {"action": "compare_and_switch",
                "reason": "第2名已有完整推演报告，直接比较后切换"}
    else:
        return {"action": "quick_simulate_second",
                "reason": "第2名只有粗筛结果，执行快速推演(2步)"}


# ============================================================================
# 模块 11: TD 更新编排
# ============================================================================

def td_update_workflow(optimal_path_nodes: list[dict],
                        v_actual: float,
                        knowledge_graph: list[dict]) -> dict:
    """
    执行完整的 TD 更新流程。

    Args:
        optimal_path_nodes: 最优路径上的节点列表
        v_actual: 实际执行结果价值
        knowledge_graph: 当前知识图谱

    Returns:
        {"updates": list, "knowledge_graph": list}
    """
    updates = []
    for node in optimal_path_nodes:
        v_predicted = node.get("v", 0.0)
        td_error = compute_td_error(v_actual, v_predicted)

        # 查找知识图谱匹配（简化：按描述关键词匹配）
        match = None
        node_desc = node.get("description", "")
        for entry in knowledge_graph:
            entry_tags = entry.get("tags", [])
            if any(tag in node_desc for tag in entry_tags):
                match = entry
                break

        if match:
            n_old = match.get("n", 0)
            q_old = match.get("q", 0.0)
            m2_old = match.get("m2", 0.0)
            q_new, m2_new, n_new, sigma2_new = welford_update(
                q_old, m2_old, n_old, v_actual)
            match["n"] = n_new
            match["q"] = q_new
            match["m2"] = m2_new
            match["sigma2"] = sigma2_new

            if abs(td_error) > 0.3:
                new_status = check_status_transition(
                    match.get("status", "PROVISIONAL"), n_new)
                if new_status:
                    match["status"] = new_status

            updates.append({
                "type": "update", "id": match.get("id"),
                "td_error": td_error, "new_q": q_new
            })
        elif abs(td_error) > 0.2:
            new_id = f"K{len(knowledge_graph) + 1}"
            new_entry = {
                "id": new_id, "q": v_actual, "sigma2": 0.25, "n": 1,
                "status": "HYPOTHESIS",
                "tags": [node_desc[:20]] if node_desc else [],
                "m2": 0.0,
            }
            knowledge_graph.append(new_entry)
            updates.append({
                "type": "create", "id": new_id, "td_error": td_error
            })

    return {"updates": updates, "knowledge_graph": knowledge_graph}


# ============================================================================
# 模块 12: 触发检查与 λ 选择
# ============================================================================

TRIGGER_KEYWORDS = {
    "action_verbs": ["做", "实现", "开发", "写", "改", "优化", "重构", "设计",
                     "添加", "新增", "构建", "搭建", "修复", "改进", "部署", "配置"],
    "decision_questions": ["怎么", "如何", "用什么", "选哪个", "哪种", "哪个好",
                          "方案", "架构", "技术选型"],
    "analysis_verbs": ["分析", "评估", "比较", "审查", "对比"],
    "continue_keywords": ["继续", "可以", "推演吧", "推演", "go ahead", "yes", "确认"],
}

EXCLUDE_KEYWORDS = {
    "greetings": ["你好", "嗨", "hello", "hi", "hey"],
    "info_query": ["什么意思", "是什么", "怎么用", "如何用", "这段代码"],
}


def quick_trigger_check(user_message: str) -> dict:
    """快速触发检查（启发式，需 LLM 最终确认）。"""
    msg = user_message
    for kw in TRIGGER_KEYWORDS["action_verbs"]:
        if kw in msg:
            return {"likely_trigger": True, "reason": f"包含动作词'{kw}'"}
    for kw in TRIGGER_KEYWORDS["decision_questions"]:
        if kw in msg:
            return {"likely_trigger": True, "reason": f"包含决策疑问'{kw}'"}
    for kw in TRIGGER_KEYWORDS["analysis_verbs"]:
        if kw in msg:
            return {"likely_trigger": True, "reason": f"包含分析词'{kw}'"}
    for kw in EXCLUDE_KEYWORDS["greetings"] + EXCLUDE_KEYWORDS["info_query"]:
        if kw in msg:
            return {"likely_trigger": False, "reason": f"匹配排除词'{kw}'"}
    return {"likely_trigger": False, "reason": "无明显触发信号"}


def get_lambda_by_trace_length(steps: int) -> float:
    """根据序列长度获取推荐 λ 值。"""
    if steps <= 3:
        return 0.0
    elif steps <= 8:
        return 0.5
    else:
        return 0.8


def get_status_weight_full(status: str, consolidation_score: int = 0) -> float:
    """获取状态的完整查询权重（含 SLEEPING 减半）。"""
    base = STATUS_WEIGHTS.get(status, 0.0)
    if status == "SLEEPING":
        return base * 0.5
    return base


# ============================================================================
# 模块 13: 递归深度守卫（防止 MCTS Simulation 无限嵌套发散）
# ============================================================================

import threading
import os

# 最大递归发散深度
MAX_RECURSIVE_DIVERGE_DEPTH = 2

# 线程局部存储——每个子 agent 线程独立计数，互不干扰
_recursive_depth_local = threading.local()


def _get_depth():
    """获取当前线程的递归深度。"""
    if not hasattr(_recursive_depth_local, 'depth'):
        _recursive_depth_local.depth = 0
    return _recursive_depth_local.depth


def _set_depth(new_depth: int):
    """设置当前线程的递归深度。"""
    # 安全阀：绝对不能超过环境变量配置的硬上限
    hard_limit = int(os.environ.get("MCTS_MAX_DIVERGE_DEPTH", "3"))
    if new_depth > hard_limit:
        raise RecursionError(
            f"递归发散深度 {new_depth} 超过硬上限 {hard_limit}，"
            f"可能发生了无限递归。已强制终止。"
        )
    _recursive_depth_local.depth = new_depth


def enter_simulation() -> dict:
    """
    Simulation 开始前调用，返回当前递归状态。
    调用方必须检查返回的 allowed 字段。

    Returns:
        {"depth": int, "allowed": bool, "mode": str,
         "variance_penalty": float, "message": str}
    """
    depth = _get_depth()

    if depth == 0:
        result = {
            "depth": 0,
            "allowed": True,
            "mode": "full",
            "variance_penalty": 0.0,
            "message": "顶层MCTS: 可以完整发散和推演"
        }
    elif depth == 1:
        result = {
            "depth": 1,
            "allowed": True,
            "mode": "simplified",
            "variance_penalty": 0.0,
            "message": "Level 1子决策: 只做简化发散(2个快速方案，1步推演)，不写知识图谱"
        }
    elif depth == 2:
        result = {
            "depth": 2,
            "allowed": True,
            "mode": "micro_diverge",
            "variance_penalty": 0.0,
            "message": "Level 2微发散: 单视角快速方案，1步推演到底，方差+0.1（深度惩罚）"
        }
    else:
        # depth >= 3: 微发散但标记高风险
        result = {
            "depth": depth,
            "allowed": True,
            "mode": "micro_diverge_risky",
            "assume": False,
            "variance_penalty": 0.15,
            "message": f"深度{depth}≥3，仍执行微发散但标记高风险，方差+0.15"
        }

    return result


def begin_sub_diverge() -> dict:
    """
    子发散开始前调用，递归深度+1。
    必须在 enter_simulation() 检查通过后调用。

    Returns:
        {"depth": int, "entered": bool, "error": str|None}
    """
    current = _get_depth()
    new_depth = current + 1

    try:
        _set_depth(new_depth)
        return {"depth": new_depth, "entered": True, "error": None}
    except RecursionError as e:
        return {"depth": current, "entered": False, "error": str(e)}


def end_sub_diverge():
    """子发散结束后调用，递归深度-1。"""
    current = _get_depth()
    if current > 0:
        _set_depth(current - 1)


def reset_recursive_depth():
    """重置递归深度（整个 MCTS 搜索结束后调用）。"""
    _recursive_depth_local.depth = 0


def needs_sub_diverge(decision_type: str, current_depth: int = None) -> dict:
    """
    判断当前决策点是否需要启动子发散。

    Args:
        decision_type: "tech_choice" | "risk" | "user_preference" | "uncertainty"
        current_depth: 当前递归深度，None 则自动获取

    Returns:
        {"needs_diverge": bool, "action": str, "reason": str}
    """
    if current_depth is None:
        current_depth = _get_depth()

    # 只有明确的技术选型才触发子发散
    if decision_type == "tech_choice":
        if current_depth < MAX_RECURSIVE_DIVERGE_DEPTH:
            return {
                "needs_diverge": True,
                "action": "begin_sub_diverge",
                "reason": f"技术选型点，深度{current_depth}<{MAX_RECURSIVE_DIVERGE_DEPTH}，启动子发散"
            }
        else:
            return {
                "needs_diverge": False,
                "action": "assume",
                "reason": f"技术选型点但深度已达{current_depth}，不做发散直接假设"
            }

    # 风险/不确定点 → 不启动子发散，用知识决策树
    if decision_type in ("risk", "uncertainty"):
        return {
            "needs_diverge": False,
            "action": "knowledge_tree",
            "reason": f"风险/不确定点(类型:{decision_type})，用知识获取决策树，不发散"
        }

    # 用户偏好/约束点 → 不启动子发散，记录待确认
    if decision_type == "user_preference":
        return {
            "needs_diverge": False,
            "action": "defer_to_user",
            "reason": "用户偏好/约束点，记录问题待确认，不发散"
        }

    return {
        "needs_diverge": False,
        "action": "unknown",
        "reason": f"未知决策类型: {decision_type}"
    }


def get_diverge_depth_report() -> dict:
    """获取当前递归深度报告（用于推演日志）。"""
    depth = _get_depth()
    status = enter_simulation()
    return {
        "depth": depth,
        "max_depth": MAX_RECURSIVE_DIVERGE_DEPTH,
        "status": status["mode"],
    }


# ============================================================================
# 模块 14: 模拟结果合成
# ============================================================================

def synthesize_simulation_result(base_v_leaf: float,
                                  sub_diverge_results: list[dict]) -> float:
    """
    将子发散结果合成为最终的 V_leaf。

    子发散结果只修正 base_v_leaf，不独立作为新方案。

    Args:
        base_v_leaf: 基础模拟的 V 值
        sub_diverge_results: 子发散结果列表 [{"v": float, "weight": float}, ...]

    Returns:
        合成后的最终 V_leaf
    """
    if not sub_diverge_results:
        return base_v_leaf

    # 子发散结果加权修正（权重低，因为子发散深度浅、不可靠）
    total_weight = 0.0
    weighted_sum = 0.0

    for r in sub_diverge_results:
        w = r.get("weight", 0.2)  # 默认权重 0.2（子发散不可靠）
        v = r.get("v", base_v_leaf)
        weighted_sum += v * w
        total_weight += w

    if total_weight == 0:
        return base_v_leaf

    # 基础推演占主导，子发散只做小幅修正
    sub_avg = weighted_sum / total_weight
    # 基础推演权重 0.8，子发散权重 0.2
    final_v = base_v_leaf * 0.8 + sub_avg * 0.2

    return round(final_v, 3)


# ============================================================================
# 模块 5: 评分与策略映射
# ============================================================================

# 奖励信号映射
REWARD_SIGNALS = {
    "compile_test_pass": 1.0,
    "compile_pass_warnings": 0.5,
    "no_feedback": 0.0,
    "compile_warnings_lint_errors": -0.3,
    "test_failure": -0.7,
    "compile_failure_new_bug": -1.0,
}

# 终止状态价值
TERMINAL_VALUES = {
    "complete_success": 1.0,
    "partial_success": 0.5,
    "neutral": 0.0,
    "side_effects": -0.5,
    "failure": -1.0,
}

# 价值评分标准
VALUE_RUBRIC = {
    1.0: "方案完美，无副作用，一次成功",
    0.9: "方案优秀，可能有小调整，但总体顺利",
    0.8: "方案良好，预期有1-2处小波折",
    0.7: "方案可行，有一定风险但可控",
    0.6: "方案勉强可行，需要谨慎执行",
    0.5: "中性，可行可不行，需进一步信息",
    0.4: "方案有较大不确定性，可能有隐藏问题",
    0.3: "方案风险高，不推荐",
    0.2: "方案很可能失败",
    0.1: "方案基本不可行",
    0.0: "方案完全不可行",
}


def get_reward_signal(result: str) -> float:
    """获取奖励信号值。"""
    return REWARD_SIGNALS.get(result, 0.0)


def get_terminal_value(result: str) -> float:
    """获取终止状态价值。"""
    return TERMINAL_VALUES.get(result, 0.0)


def get_learning_rate(history_count: int) -> float:
    """根据历史数据量获取学习率。"""
    if history_count <= 5:
        return 0.5
    elif history_count <= 20:
        return 0.2
    elif history_count <= 100:
        return 0.1
    else:
        return 0.05


def get_confidence_level(sigma2: float) -> str:
    """根据方差获取信心水平。"""
    if sigma2 < 0.1:
        return "高"
    elif sigma2 < 0.3:
        return "中"
    else:
        return "低"


def compute_eligibility_trace(step: int, total_steps: int,
                              lambda_: float = 0.5) -> float:
    """
    计算资格迹。

    Args:
        step: 当前步骤索引 (0-based)
        total_steps: 总步骤数
        lambda_: 衰减因子

    Returns:
        资格迹值
    """
    return lambda_ ** (total_steps - step - 1)


# ============================================================================
# 模块 6: 粗筛与排名
# ============================================================================

def rough_filter(solutions: list[dict], max_keep: int = 5) -> list[dict]:
    """
    粗筛：对方案做快速直觉评估，保留 top-N。

    Args:
        solutions: 方案列表，每个方案需有 feasibility, cost_benefit, risk
        max_keep: 最多保留数量

    Returns:
        粗筛后的方案列表
    """
    scored = []
    for s in solutions:
        feasibility = s.get("feasibility", 0.5)
        cost_benefit = s.get("cost_benefit", 0.5)
        risk = s.get("risk", 0.5)
        score = feasibility * 0.5 + cost_benefit * 0.3 + (1 - risk) * 0.2
        scored.append({**s, "rough_score": score})

    scored.sort(key=lambda x: x["rough_score"], reverse=True)
    return scored[:max_keep]


def rank_by_converged_v(solutions: list[dict]) -> list[dict]:
    """
    基于收敛后的 V 值排序（多轮 MCTS 迭代后使用）。

    排序规则:
      1. 按 V 降序
      2. V 差距 < 0.05 时，比较 n（访问次数）
      3. n 也接近时，比较 sigma2（方差）

    Args:
        solutions: [{"name": str, "v": float, "n": int, "sigma2": float}, ...]

    Returns:
        排序后的方案列表
    """
    def sort_key(s):
        return (s.get("v", 0), s.get("n", 0), -s.get("sigma2", 1.0))

    return sorted(solutions, key=sort_key, reverse=True)


def handle_close_ranking(ranked: list[dict], threshold: float = 0.05) -> dict:
    """
    处理排名接近的情况。

    Args:
        ranked: 已排序的方案列表
        threshold: 差距阈值

    Returns:
        {"recommendation": str, "close_pair": bool, "reason": str}
    """
    if len(ranked) < 2:
        return {"recommendation": ranked[0]["name"] if ranked else "none",
                "close_pair": False, "reason": "只有一个方案"}

    first, second = ranked[0], ranked[1]
    v_diff = first.get("v", 0) - second.get("v", 0)

    if v_diff < threshold:
        # 差距太小，进一步比较
        if second.get("n", 0) > first.get("n", 0):
            return {
                "recommendation": "需要追加迭代",
                "close_pair": True,
                "reason": f"第1名({first['name']})和第2名({second['name']})差距{v_diff:.3f}<{threshold}，且第2名探索更充分"
            }
        elif second.get("sigma2", 1.0) < first.get("sigma2", 1.0):
            return {
                "recommendation": "建议用户决策",
                "close_pair": True,
                "reason": f"第1名({first['name']})和第2名({second['name']})差距{v_diff:.3f}<{threshold}，第2名方差更小"
            }

    return {
        "recommendation": first["name"],
        "close_pair": False,
        "reason": f"第1名({first['name']})领先{v_diff:.3f}，区分度足够"
    }


# ============================================================================
# CLI 入口
# ============================================================================

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python mcts_compute.py <command> [args...]")
        print("命令: ucb, backprop, converge, status-transition, rank, rough-filter")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "ucb":
        # python mcts_compute.py ucb --v 0.8 --n 3 --parent-n 10 --c 1.414 --k-bonus 0.05
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--v", type=float, required=True)
        parser.add_argument("--n", type=int, required=True)
        parser.add_argument("--parent-n", type=int, required=True)
        parser.add_argument("--c", type=float, default=1.414)
        parser.add_argument("--k-bonus", type=float, default=0.0)
        args = parser.parse_args(sys.argv[2:])
        result = compute_ucb(args.v, args.n, args.parent_n, args.c, args.k_bonus)
        print(json.dumps({"ucb": result}))

    elif cmd == "rank":
        # python mcts_compute.py rank --solutions '[{"name":"A","v":0.84,"n":5,"sigma2":0.03}]'
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--solutions", type=str, required=True)
        args = parser.parse_args(sys.argv[2:])
        solutions = json.loads(args.solutions)
        ranked = rank_by_converged_v(solutions)
        close = handle_close_ranking(ranked)
        print(json.dumps({"ranked": ranked, "close_analysis": close}, ensure_ascii=False))

    elif cmd == "converge":
        # python mcts_compute.py converge --v-history "0.85,0.83,0.84" --n 5 --sigma2 0.03
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--v-history", type=str, required=True)
        parser.add_argument("--n", type=int, required=True)
        parser.add_argument("--sigma2", type=float, required=True)
        args = parser.parse_args(sys.argv[2:])
        v_history = [float(x) for x in args.v_history.split(",")]
        stable = check_value_stability(v_history)
        confident = check_high_confidence(args.n, args.sigma2)
        print(json.dumps({
            "value_stable": stable,
            "high_confidence": confident,
            "should_stop": stable or confident
        }))

    elif cmd == "status-transition":
        # python mcts_compute.py status-transition --current PROVISIONAL --n 3
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--current", type=str, required=True)
        parser.add_argument("--n", type=int, default=0)
        parser.add_argument("--has-contradiction", action="store_true")
        parser.add_argument("--contradiction-count", type=int, default=0)
        args = parser.parse_args(sys.argv[2:])
        new_status = check_status_transition(
            args.current, args.n,
            args.has_contradiction, args.contradiction_count
        )
        weight = get_status_weight(args.current)
        print(json.dumps({
            "current": args.current,
            "new_status": new_status,
            "current_weight": weight
        }))

    elif cmd == "rough-filter":
        # python mcts_compute.py rough-filter --solutions '[{"name":"A","feasibility":0.9,"cost_benefit":0.8,"risk":0.2}]'
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--solutions", type=str, required=True)
        parser.add_argument("--max-keep", type=int, default=5)
        args = parser.parse_args(sys.argv[2:])
        solutions = json.loads(args.solutions)
        filtered = rough_filter(solutions, args.max_keep)
        print(json.dumps({"filtered": filtered}, ensure_ascii=False))

    elif cmd == "welford":
        # python mcts_compute.py welford --mu 0.8 --m2 0.05 --n 3 --x 0.85
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--mu", type=float, required=True)
        parser.add_argument("--m2", type=float, required=True)
        parser.add_argument("--n", type=int, required=True)
        parser.add_argument("--x", type=float, required=True)
        args = parser.parse_args(sys.argv[2:])
        mu_new, m2_new, n_new, var = welford_update(args.mu, args.m2, args.n, args.x)
        print(json.dumps({
            "mu_new": mu_new,
            "m2_new": m2_new,
            "n_new": n_new,
            "variance": var
        }))

    elif cmd == "k-bonus":
        # python mcts_compute.py k-bonus --status CONFIRMED --n 5 --q 0.85 --n-child 1
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--status", type=str, default="")
        parser.add_argument("--n", type=int, default=0)
        parser.add_argument("--q", type=float, default=0.0)
        parser.add_argument("--n-child", type=int, default=0)
        args = parser.parse_args(sys.argv[2:])
        kg_match = {"status": args.status, "n": args.n, "q": args.q} if args.status else None
        result = compute_k_bonus(kg_match, args.n_child)
        print(json.dumps(result, ensure_ascii=False))

    elif cmd == "classify-blindspot":
        # python mcts_compute.py classify-blindspot --score 4
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--score", type=int, required=True)
        args = parser.parse_args(sys.argv[2:])
        result = classify_blindspot(args.score)
        print(json.dumps(result, ensure_ascii=False))

    elif cmd == "get-activated-perspectives":
        # python mcts_compute.py get-activated-perspectives --scores '{"技术栈":9,"架构模式":8}' --task-type normal
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--scores", type=str, required=True)
        parser.add_argument("--task-type", type=str, default="normal")
        args = parser.parse_args(sys.argv[2:])
        scores = json.loads(args.scores)
        result = get_activated_perspectives(scores, args.task_type)
        print(json.dumps({"activated_perspectives": result,
                          "count": len(result)}, ensure_ascii=False))

    elif cmd == "should-write-kg":
        # python mcts_compute.py should-write-kg --v-leaf 0.85 --round 3
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--v-leaf", type=float, required=True)
        parser.add_argument("--round", type=int, required=True)
        parser.add_argument("--is-final", action="store_true")
        args = parser.parse_args(sys.argv[2:])
        result = should_write_to_knowledge_graph(args.v_leaf, args.round, args.is_final)
        print(json.dumps(result, ensure_ascii=False))

    elif cmd == "check-write-safety":
        # python mcts_compute.py check-write-safety --existing-q 0.85 --new-q 0.30
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--existing-q", type=float, default=None)
        parser.add_argument("--new-q", type=float, required=True)
        parser.add_argument("--diff-context", action="store_true")
        args = parser.parse_args(sys.argv[2:])
        existing = {"q": args.existing_q} if args.existing_q is not None else None
        result = check_write_safety(existing, args.new_q, args.diff_context)
        print(json.dumps(result, ensure_ascii=False))

    elif cmd == "needs-re-eval":
        # python mcts_compute.py needs-re-eval --ranked '[{"name":"A","v":0.84,"n":5},{"name":"B","v":0.83,"n":8}]'
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--ranked", type=str, required=True)
        args = parser.parse_args(sys.argv[2:])
        ranked = json.loads(args.ranked)
        result = needs_re_evaluation(ranked)
        print(json.dumps(result, ensure_ascii=False))

    elif cmd == "check-final-convergence":
        # python mcts_compute.py check-final-convergence --root-total-n 20 --solution-count 4 --top-v 0.84 --top-n 5 --top-sigma2 0.03
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--root-total-n", type=int, required=True)
        parser.add_argument("--solution-count", type=int, required=True)
        parser.add_argument("--top-v", type=float, required=True)
        parser.add_argument("--top-n", type=int, required=True)
        parser.add_argument("--top-sigma2", type=float, required=True)
        args = parser.parse_args(sys.argv[2:])
        top = {"v": args.top_v, "n": args.top_n, "sigma2": args.top_sigma2}
        result = check_final_convergence(args.root_total_n, args.solution_count, top)
        print(json.dumps(result, ensure_ascii=False))

    elif cmd == "get-fuse-mode":
        # python mcts_compute.py get-fuse-mode --accuracy 0.65 --consecutive-bad 1
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--accuracy", type=float, required=True)
        parser.add_argument("--consecutive-bad", type=int, default=0)
        args = parser.parse_args(sys.argv[2:])
        result = get_fuse_mode(args.accuracy, args.consecutive_bad)
        print(json.dumps(result, ensure_ascii=False))

    elif cmd == "handle-self-check":
        # python mcts_compute.py handle-self-check --conclusion 有风险 --retry-count 0
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--conclusion", type=str, required=True)
        parser.add_argument("--retry-count", type=int, default=0)
        args = parser.parse_args(sys.argv[2:])
        result = handle_self_check_result(args.conclusion, args.retry_count)
        print(json.dumps(result, ensure_ascii=False))

    elif cmd == "re-simulation-decide":
        # python mcts_compute.py re-simulation-decide --second-has-sim --all-affected
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--second-has-sim", action="store_true")
        parser.add_argument("--all-affected", action="store_true")
        args = parser.parse_args(sys.argv[2:])
        result = re_simulation_decision([], args.second_has_sim, args.all_affected)
        print(json.dumps(result, ensure_ascii=False))

    elif cmd == "trigger-check":
        # python mcts_compute.py trigger-check --message "帮我实现一个登录功能"
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--message", type=str, required=True)
        args = parser.parse_args(sys.argv[2:])
        result = quick_trigger_check(args.message)
        print(json.dumps(result, ensure_ascii=False))

    elif cmd == "get-lambda":
        # python mcts_compute.py get-lambda --steps 5
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--steps", type=int, required=True)
        args = parser.parse_args(sys.argv[2:])
        result = get_lambda_by_trace_length(args.steps)
        print(json.dumps({"lambda": result}))

    elif cmd == "get-status-weight":
        # python mcts_compute.py get-status-weight --status SLEEPING
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--status", type=str, required=True)
        args = parser.parse_args(sys.argv[2:])
        result = get_status_weight_full(args.status)
        print(json.dumps({"status": args.status, "weight": result}))

    elif cmd == "enter-simulation":
        # python mcts_compute.py enter-simulation
        result = enter_simulation()
        print(json.dumps(result, ensure_ascii=False))

    elif cmd == "begin-sub-diverge":
        # python mcts_compute.py begin-sub-diverge
        result = begin_sub_diverge()
        print(json.dumps(result, ensure_ascii=False))

    elif cmd == "end-sub-diverge":
        # python mcts_compute.py end-sub-diverge
        end_sub_diverge()
        print(json.dumps({"depth": _get_depth(), "message": "子发散结束，深度-1"}))

    elif cmd == "needs-sub-diverge":
        # python mcts_compute.py needs-sub-diverge --type tech_choice
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--type", type=str, required=True,
                           help="tech_choice|risk|user_preference|uncertainty")
        args = parser.parse_args(sys.argv[2:])
        result = needs_sub_diverge(args.type)
        print(json.dumps(result, ensure_ascii=False))

    elif cmd == "diverge-depth":
        # python mcts_compute.py diverge-depth
        result = get_diverge_depth_report()
        print(json.dumps(result, ensure_ascii=False))

    elif cmd == "reset-depth":
        # python mcts_compute.py reset-depth
        reset_recursive_depth()
        print(json.dumps({"depth": 0, "message": "递归深度已重置"}))

    elif cmd == "synthesize-sim":
        # python mcts_compute.py synthesize-sim --base-v 0.8 --sub-results '[{"v":0.7,"weight":0.2}]'
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--base-v", type=float, required=True)
        parser.add_argument("--sub-results", type=str, default="[]")
        args = parser.parse_args(sys.argv[2:])
        sub = json.loads(args.sub_results)
        result = synthesize_simulation_result(args.base_v, sub)
        print(json.dumps({"final_v_leaf": result}))

    elif cmd == "identify-domain":
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--message", type=str, required=True)
        parser.add_argument("--task", type=str, default="")
        args = parser.parse_args(sys.argv[2:])
        result = identify_domain(args.message, args.task)
        print(json.dumps(result, ensure_ascii=False))

    elif cmd == "get-dimensions":
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--domain", type=str, required=True)
        args = parser.parse_args(sys.argv[2:])
        result = get_dimensions(args.domain)
        print(json.dumps(result, ensure_ascii=False))

    elif cmd == "get-recon-paths":
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--domain", type=str, required=True)
        args = parser.parse_args(sys.argv[2:])
        result = get_recon_paths(args.domain)
        print(json.dumps(result, ensure_ascii=False))

    elif cmd == "get-perspectives":
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--domain", type=str, required=True)
        args = parser.parse_args(sys.argv[2:])
        result = get_perspective_map(args.domain)
        print(json.dumps(result, ensure_ascii=False))

    elif cmd == "check-learning-depth":
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--domain", type=str, required=True)
        parser.add_argument("--complexity", type=str, default="medium")
        parser.add_argument("--scores", type=str, required=True)
        parser.add_argument("--coverage", type=str, required=True)
        args = parser.parse_args(sys.argv[2:])
        scores = json.loads(args.scores)
        coverage = json.loads(args.coverage)
        result = enforce_learning_gate(args.domain, args.complexity, scores, coverage)
        print(json.dumps(result, ensure_ascii=False))

    else:
        print(f"未知命令: {cmd}")
        print("可用命令: ucb, converge, status-transition, rank, rough-filter, welford, "
              "k-bonus, classify-blindspot, get-activated-perspectives, should-write-kg, "
              "check-write-safety, needs-re-eval, check-final-convergence, get-fuse-mode, "
              "handle-self-check, re-simulation-decide, trigger-check, get-lambda, get-status-weight, "
              "enter-simulation, begin-sub-diverge, end-sub-diverge, needs-sub-diverge, "
              "diverge-depth, reset-depth, synthesize-sim, identify-domain, get-dimensions, "
              "get-recon-paths, get-perspectives, check-learning-depth")
        sys.exit(1)


# ============================================================================
# 模块 15: 领域自适应 — 维度/侦查/视角的领域模板
# ============================================================================

DOMAIN_KEYWORDS = {
    "software_engineering": {"keywords": ["代码","编程","API","数据库","框架","部署","编译","测试","重构","架构","微服务","前端","后端","中间件","缓存","git","docker","k8s","linux","react","vue","spring","算法","实现","开发","写","改","优化","debug","bug","接口","模块"], "label": "软件工程"},
    "music": {"keywords": ["音乐","编曲","作曲","和弦","旋律","节奏","调性","和声","配器","混音","音色","乐器","演唱","演奏","录音","歌曲","乐章","音符","音阶","钢琴","吉他","鼓","交响","流行","爵士","古典","电子乐"], "label": "音乐创作"},
    "education": {"keywords": ["教学","课程","备课","课堂","学生","学习","知识点","考试","作业","教案","教材","课件","讲授","评估","年级","学科","教学法","班主任","复习","预习","测验"], "label": "教育教学"},
    "law": {"keywords": ["法律","合同","诉讼","法规","条款","判例","律师","法院","仲裁","知识产权","公司法","劳动法","税法","合规","尽职调查","起诉","应诉","辩护","法条","司法解释","合同审查"], "label": "法律"},
    "design": {"keywords": ["设计","UI","UX","界面","配色","排版","字体","图标","原型","用户研究","交互","视觉","品牌","logo","海报","插画","动效","figma","美感","风格","色彩","布局"], "label": "设计创意"},
    "business": {"keywords": ["商业","营销","市场","销售","客户","竞品","定价","战略","财务","预算","投资","融资","运营","增长","产品经理","roadmap","OKR","KPI","ROI","转化率","留存","营收"], "label": "商业决策"},
    "writing": {"keywords": ["写作","文章","文案","小说","剧本","诗歌","散文","报道","采访","编辑","出版","翻译","标题","结构","修辞","文风","读者","公众号"], "label": "写作内容"},
    "daily_life": {"keywords": ["旅行","旅游","做饭","菜谱","健身","锻炼","装修","买房","买车","搬家","婚礼","育儿","养宠","理财","保险","就医","挂号","签证","留学","购物","穿搭"], "label": "日常生活"},
    "general": {"keywords": [], "label": "通用决策"},
}

DOMAIN_DIMENSIONS = {
    "software_engineering": [
        {"id":1,"name":"技术栈","desc":"涉及哪些技术/框架/库?版本限制?","detect":["任务涉及哪些技术?","项目已有技术栈?","版本/兼容性限制?"]},
        {"id":2,"name":"架构模式","desc":"用什么架构?模块怎么划分?","detect":["常见架构?","当前架构?","改动在架构哪一层?"]},
        {"id":3,"name":"业务逻辑","desc":"核心流程?实体和状态?","detect":["核心流程?","涉及数据实体?","异常/边界?"]},
        {"id":4,"name":"安全合规","desc":"安全风险?合规要求?","detect":["安全风险?","合规要求?","最佳实践?"]},
        {"id":5,"name":"部署运维","desc":"怎么上线?怎么监控?","detect":["部署方式?","监控/日志?","故障恢复?"]},
        {"id":6,"name":"用户体验","desc":"用户怎么用?关心什么?","detect":["用户使用方式?","核心价值?","替代方案?"]},
    ],
    "music": [
        {"id":1,"name":"风格流派","desc":"什么风格?参考作品?","detect":["目标风格?","参考作品?","风格融合?"]},
        {"id":2,"name":"调性和声","desc":"用什么调?和声进行?","detect":["调性?","和声进行?","转调?"]},
        {"id":3,"name":"配器编排","desc":"什么乐器?怎么搭配?","detect":["乐器选择?","声部安排?","音色搭配?"]},
        {"id":4,"name":"情感表达","desc":"什么情绪?强弱安排?","detect":["情感目标?","力度变化?","速度处理?"]},
        {"id":5,"name":"演奏难度","desc":"谁演奏?难度合适?","detect":["演奏者水平?","技术难点?","可行性?"]},
        {"id":6,"name":"听众接受","desc":"听众是谁?喜欢什么?","detect":["目标听众?","审美偏好?","接受度?"]},
    ],
    "education": [
        {"id":1,"name":"课标对齐","desc":"符合课程标准?","detect":["对应课标?","考试要求?","知识点覆盖?"]},
        {"id":2,"name":"学生认知","desc":"学生水平?认知难点?","detect":["已有基础?","认知难点?","个体差异?"]},
        {"id":3,"name":"教学方法","desc":"什么教学法?课堂组织?","detect":["教学法?","课堂结构?","互动设计?"]},
        {"id":4,"name":"教学资源","desc":"需要什么材料?","detect":["教材教辅?","多媒体?","实验条件?"]},
        {"id":5,"name":"评测方式","desc":"怎么检验学会?","detect":["形成性/终结性?","题型设计?","反馈机制?"]},
        {"id":6,"name":"趣味吸引","desc":"怎么让学生感兴趣?","detect":["引入设计?","趣味元素?","注意力节奏?"]},
    ],
    "law": [
        {"id":1,"name":"适用法条","desc":"哪部法律?哪个条款?","detect":["适用法律?","具体条款?","司法解释?"]},
        {"id":2,"name":"判例参考","desc":"类似判例?法院倾向?","detect":["类似判例?","法院态度?","地区差异?"]},
        {"id":3,"name":"风险敞口","desc":"最大风险?概率?","detect":["主要风险?","发生概率?","损失规模?"]},
        {"id":4,"name":"文书格式","desc":"格式要求?提交流程?","detect":["文书格式?","提交机构?","时限?"]},
        {"id":5,"name":"时效管理","desc":"时效限制?关键节点?","detect":["诉讼时效?","关键日期?","紧急程度?"]},
        {"id":6,"name":"客户预期","desc":"客户目标/底线?","detect":["客户目标?","接受底线?","沟通策略?"]},
    ],
    "design": [
        {"id":1,"name":"风格定位","desc":"什么设计风格?","detect":["风格方向?","参考案例?","品牌调性?"]},
        {"id":2,"name":"视觉层次","desc":"信息层级?视觉重点?","detect":["信息优先级?","视觉焦点?","阅读路径?"]},
        {"id":3,"name":"配色排版","desc":"色彩方案?字体?","detect":["色彩选择?","字体方案?","间距留白?"]},
        {"id":4,"name":"交互体验","desc":"用户操作?流程顺畅?","detect":["用户路径?","操作步骤?","反馈机制?"]},
        {"id":5,"name":"技术约束","desc":"实现限制?性能?","detect":["平台限制?","性能指标?","兼容性?"]},
        {"id":6,"name":"用户偏好","desc":"用户喜欢/讨厌?","detect":["用户画像?","审美偏好?","使用习惯?"]},
    ],
    "business": [
        {"id":1,"name":"市场机会","desc":"市场规模?竞争?","detect":["市场大小?","增长趋势?","主要竞品?"]},
        {"id":2,"name":"商业模式","desc":"怎么赚钱?成本?","detect":["收入来源?","成本结构?","盈利模型?"]},
        {"id":3,"name":"执行路径","desc":"怎么落地?资源?","detect":["执行步骤?","资源需求?","里程碑?"]},
        {"id":4,"name":"风险评估","desc":"有什么风险?","detect":["主要风险?","发生概率?","应对?"]},
        {"id":5,"name":"数据驱动","desc":"用什么指标衡量?","detect":["KPI?","数据来源?","追踪工具?"]},
        {"id":6,"name":"利益相关方","desc":"谁受影响?谁决策?","detect":["利益方?","决策者?","阻力?"]},
    ],
    "writing": [
        {"id":1,"name":"读者定位","desc":"写给谁?关心什么?","detect":["目标读者?","阅读场景?","读者期待?"]},
        {"id":2,"name":"结构框架","desc":"怎么组织?起承转合?","detect":["开头设计?","主体结构?","结尾策略?"]},
        {"id":3,"name":"文风修辞","desc":"语言风格?修辞?","detect":["语言风格?","修辞手法?","句式节奏?"]},
        {"id":4,"name":"事实准确","desc":"数据/引文核实?","detect":["事实来源?","数据准确?","引用规范?"]},
        {"id":5,"name":"传播渠道","desc":"什么平台?格式?","detect":["发布平台?","格式要求?","推荐机制?"]},
        {"id":6,"name":"影响力","desc":"想达到什么效果?","detect":["目标效果?","传播指标?","行动号召?"]},
    ],
    "daily_life": [
        {"id":1,"name":"成本预算","desc":"花多少钱?预算弹性?","detect":["预算范围?","弹性空间?","隐性成本?"]},
        {"id":2,"name":"时间安排","desc":"什么时候做?紧迫?","detect":["时间约束?","优先级?","可并行?"]},
        {"id":3,"name":"质量效果","desc":"做到什么程度?","detect":["质量标准?","验收方式?","最低标准?"]},
        {"id":4,"name":"便利可行","desc":"操作方便?有门槛?","detect":["操作难度?","前置条件?","替代方案?"]},
        {"id":5,"name":"他人影响","desc":"家人/朋友怎么看?","detect":["相关人?","态度?","需协调?"]},
        {"id":6,"name":"长期价值","desc":"一时还是长期?","detect":["短期vs长期?","可持续?","后悔风险?"]},
    ],
    "general": [
        {"id":1,"name":"资源条件","desc":"可用资源?约束?","detect":["可用?","限制?","必须满足?"]},
        {"id":2,"name":"目标结果","desc":"想要什么?成功标准?","detect":["目标?","怎么算成功?","优先级?"]},
        {"id":3,"name":"可选路径","desc":"不同做法?代价?","detect":["可选方案?","代价?","收益?"]},
        {"id":4,"name":"风险未知","desc":"哪里可能出错?","detect":["不确定因素?","最坏结果?","能承受?"]},
        {"id":5,"name":"时效紧迫","desc":"时间限制?依赖?","detect":["时间要求?","前置依赖?","可延迟?"]},
        {"id":6,"name":"人的因素","desc":"谁参与?利益/偏好?","detect":["利益方?","偏好?","冲突可能?"]},
    ],
}

DOMAIN_RECON_PATHS = {
    "software_engineering": [
        {"id":1,"name":"项目代码","required":True,"question":"项目现有代码怎么处理的?"},
        {"id":2,"name":"技术文档","required":True,"question":"行业标准做法?"},
        {"id":3,"name":"竞品方案","required":False,"question":"其他项目怎么解决的?"},
        {"id":4,"name":"用户视角","required":False,"question":"用户关心什么?"},
        {"id":5,"name":"失败案例","required":False,"question":"常见坑和失败模式?"},
        {"id":6,"name":"技术趋势","required":False,"question":"技术发展方向?"},
    ],
    "general": [
        {"id":1,"name":"既有经验","required":True,"question":"以前类似的事怎么处理的?"},
        {"id":2,"name":"权威参考","required":True,"question":"有没有权威指南/标准做法?"},
        {"id":3,"name":"他人做法","required":False,"question":"别人遇到这个怎么解决的?"},
        {"id":4,"name":"受影响者视角","required":False,"question":"受影响的人关心什么?"},
        {"id":5,"name":"失败教训","required":False,"question":"常见坑和失败模式?"},
        {"id":6,"name":"趋势变化","required":False,"question":"环境在变?现在做的以后适用吗?"},
    ],
}

DOMAIN_PERSPECTIVES = {
    "software_engineering": {1:"技术选型",2:"架构设计",3:"业务逻辑",4:"安全优先",5:"运维优先",6:"用户体验",7:"性能优先",8:"最小成本",9:"激进创新",10:"反面视角"},
    "general": {1:"资源最优",2:"顶层设计",3:"流程步骤",4:"风险控制",5:"执行可行",6:"人本体验",7:"效率速度",8:"最小投入",9:"理想方案",10:"反面视角"},
}

def identify_domain(user_message: str, task_description: str = "") -> dict:
    text = user_message + " " + task_description
    scores = {}
    for domain, config in DOMAIN_KEYWORDS.items():
        if domain == "general": continue
        matched = [kw for kw in config["keywords"] if kw in text]
        if matched: scores[domain] = len(matched)
    if scores:
        best = max(scores, key=scores.get)
        return {"domain":best,"label":DOMAIN_KEYWORDS[best]["label"],
                "confidence":min(1.0,scores[best]/5),"mode":"template"}
    # 没有匹配到写死模板 → 标记为 dynamic，由 LLM 自己生成维度
    return {"domain":"dynamic","label":"动态识别(未匹配到预设领域)",
            "confidence":0.0,"mode":"dynamic",
            "instruction":"LLM需从任务语义中自动提取6个关键维度，参考general模板结构"}


def get_dimensions(domain: str) -> list[dict]:
    """获取领域维度。domain='dynamic'时返回空，由LLM自己生成。"""
    return DOMAIN_DIMENSIONS.get(domain, [])


def get_recon_paths(domain: str) -> list[dict]:
    """获取侦查路径。domain='dynamic'时返回通用模板作为参考。"""
    return DOMAIN_RECON_PATHS.get(domain, DOMAIN_RECON_PATHS["general"])


def get_perspective_map(domain: str) -> dict:
    """获取视角映射。domain='dynamic'时返回通用模板作为参考。"""
    return DOMAIN_PERSPECTIVES.get(domain, DOMAIN_PERSPECTIVES["general"])


def has_domain_template(domain: str) -> bool:
    """检查该领域是否有预设模板。"""
    return domain in DOMAIN_DIMENSIONS and domain != "general" and domain != "dynamic"


# ============================================================================
# 模块 16: 学习深度门禁 — 学够了才能下结论
# ============================================================================

LEARNING_DEPTH_THRESHOLDS = {
    "none": {"min_dimensions_covered": 0, "min_recon_paths": 0, "min_sources": 0,
             "description": "不需要学习（已完全熟悉，可直接发散）"},
    "light": {"min_dimensions_covered": 3, "min_recon_paths": 2, "min_sources": 1,
              "description": "轻度学习（简单任务，快速了解即可）"},
    "standard": {"min_dimensions_covered": 4, "min_recon_paths": 3, "min_sources": 2,
                 "description": "标准学习（中等任务，需充分了解）"},
    "deep": {"min_dimensions_covered": 5, "min_recon_paths": 4, "min_sources": 3,
             "description": "深度学习（复杂任务，需系统研究）"},
}

def determine_required_learning_depth(domain: str, task_complexity: str,
                                       dimension_scores: dict[str, int]) -> str:
    """
    决定需要多深的学习深度。

    判断依据:
      ① 领域熟悉度: 六维评分中 < 7 的维度多 → 需要更深学习
      ② 任务复杂度: simple/medium/complex
      ③ 领域类型: 高专业度领域（法律/医学）→ 默认更深

    Returns: "none" | "light" | "standard" | "deep"
    """
    # 高专业度领域 → 至少 standard
    high_stakes_domains = {"law", "software_engineering"}

    # 盲区维度数
    blindspot_count = sum(1 for s in dimension_scores.values() if s < 7)

    if blindspot_count <= 0 and task_complexity == "simple":
        return "none"
    elif blindspot_count <= 1:
        base = "light"
    elif blindspot_count <= 3:
        base = "standard"
    else:
        base = "deep"

    # 高专业度领域强制提升一级
    if domain in high_stakes_domains and base in ("none", "light"):
        base = "standard"

    return base


def check_learning_depth(required_depth: str, actual_coverage: dict) -> dict:
    """
    检查学习深度是否达标。

    Args:
        required_depth: "none"|"light"|"standard"|"deep"
        actual_coverage: {"dimensions_covered": int, "recon_paths_completed": int,
                          "sources_cross_validated": int, "blindspots_remaining": list}

    Returns:
        {"passed": bool, "gaps": list, "must_fix": list, "suggestions": list}
    """
    threshold = LEARNING_DEPTH_THRESHOLDS[required_depth]
    gaps = []
    must_fix = []
    suggestions = []

    dims = actual_coverage.get("dimensions_covered", 0)
    if dims < threshold["min_dimensions_covered"]:
        gap = f"维度覆盖不足: {dims}/{threshold['min_dimensions_covered']}"
        must_fix.append(gap)

    paths = actual_coverage.get("recon_paths_completed", 0)
    if paths < threshold["min_recon_paths"]:
        gap = f"侦查路径不足: {paths}/{threshold['min_recon_paths']}"
        must_fix.append(gap)

    sources = actual_coverage.get("sources_cross_validated", 0)
    if sources < threshold["min_sources"]:
        gap = f"来源交叉验证不足: {sources}/{threshold['min_sources']}"
        suggestions.append(gap)

    blindspots = actual_coverage.get("blindspots_remaining", [])
    if blindspots and required_depth in ("standard", "deep"):
        must_fix.append(f"仍有盲区维度未补全: {blindspots}")

    passed = len(must_fix) == 0

    return {
        "passed": passed,
        "required_depth": required_depth,
        "gaps": gaps,
        "must_fix": must_fix,
        "suggestions": suggestions,
        "verdict": "✅ 学习深度达标，可以进入方案生成" if passed
                   else f"⛔ 学习深度不达标({required_depth}级)，必须先补全以下缺口再进入方案生成",
    }


def enforce_learning_gate(domain: str, task_complexity: str,
                           dimension_scores: dict[str, int],
                           actual_coverage: dict) -> dict:
    """
    学习深度强制执行——学不够就堵住，不让进入方案生成。

    这是防止"草草扫一眼就下结论"的关键门禁。

    Returns:
        如果 passed=True, 可以进入方案生成
        如果 passed=False, 必须回到侦查阶段补全缺口
    """
    required = determine_required_learning_depth(domain, task_complexity, dimension_scores)
    result = check_learning_depth(required, actual_coverage)
    result["required_depth"] = required
    result["required_thresholds"] = LEARNING_DEPTH_THRESHOLDS[required]
    return result
