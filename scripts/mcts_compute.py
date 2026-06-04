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

    else:
        print(f"未知命令: {cmd}")
        print("可用命令: ucb, backprop, converge, status-transition, rank, rough-filter, welford")
        sys.exit(1)
