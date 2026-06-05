#!/usr/bin/env python3
"""
L-GCMS 知识生命周期管理系统
融合人脑记忆 + JVM分代 + MCTS状态机 + 信息质量过滤

模块:
  1. 门禁引擎 — 存储前四重过滤
  2. 分层存储 — Working/Short-Term/Long-Term/Archive
  3. 遗忘曲线 — 每层不同衰减速度
  4. 晋升降级 — 记忆强度驱动的层级流转
  5. 情境锚 — 上下文匹配回忆
  6. 错误清理 — 主动识别和清除错误知识
"""

import math
import json
import sys
import re
from datetime import datetime, timedelta
from typing import Optional
from dataclasses import dataclass, field


# ============================================================================
# 模块 1: 门禁引擎 — 存储前四重过滤
# ============================================================================

@dataclass
class GateResult:
    """门禁检查结果"""
    passed: bool           # 是否通过
    score: float           # 综合得分 0.0~1.0
    action: str            # "store" | "observe" | "discard" | "merge"
    merge_target: Optional[str] = None  # 如果合并，目标条目ID
    reasons: list[str] = field(default_factory=list)
    quality_tags: list[str] = field(default_factory=list)


def check_reusability(experience: dict) -> dict:
    """
    ① 可复用性检查 — 这是一次性的还是能反复用的？

    Returns: {"score": 0.0~1.0, "level": str, "reason": str}
    """
    # 一次性标记词
    disposable_patterns = [
        r"临时(方案|绕过|修复|解决)",
        r"这次先",
        r"以后再说",
        r"网络抖动",
        r"偶发",
        r"\.env.*=.*",          # 环境变量配置
        r"改一下.*就行",
        r"暂时",
    ]

    # 可复用标记词
    reusable_patterns = [
        r"通用|模式|原则|最佳实践|标准做法",
        r"算法|公式|机制|架构",
        r"教训|经验|总结",
        r"任何.*都需要|所有.*都应该",
    ]

    text = experience.get("description", "") + " " + " ".join(experience.get("tags", []))

    disposable_score = sum(1 for p in disposable_patterns if re.search(p, text))
    reusable_score = sum(1 for p in reusable_patterns if re.search(p, text))

    # 基础分 + 可复用奖励 - 一次性惩罚
    base = 0.5
    score = base + reusable_score * 0.15 - disposable_score * 0.2
    score = max(0.0, min(1.0, score))

    if score >= 0.7:
        level = "high"
    elif score >= 0.3:
        level = "medium"
    else:
        level = "low"

    return {"score": score, "level": level,
            "reason": f"可复用标记{reusable_score}个, 一次性标记{disposable_score}个"}


def check_information_density(experience: dict) -> dict:
    """
    ② 信息密度检查 — 这条知识里有干货吗？

    Returns: {"score": 0.0~1.0, "level": str, "reason": str}
    """
    desc = experience.get("description", "")
    conditions = experience.get("conditions", "")
    conclusion = experience.get("conclusion", "")
    actionable = experience.get("actionable_steps", [])

    # 四个维度打分
    has_cause_effect = 1.0 if (conditions and conclusion) else 0.3
    has_actionable = 1.0 if actionable else 0.2
    has_conditions = 1.0 if conditions else 0.3
    is_not_vague = 1.0 if len(desc) > 20 else 0.3  # 太短=太笼统

    # 纯过程记录检测（没有结论的流水账）
    process_only = bool(re.search(r"先试了|又试了|还是不对|然后|接着", desc))
    if process_only and not conclusion:
        return {"score": 0.1, "level": "low", "reason": "纯过程记录，无结论"}

    score = (has_cause_effect * 0.35 + has_actionable * 0.25 +
             has_conditions * 0.25 + is_not_vague * 0.15)

    if score >= 0.7:
        level = "high"
    elif score >= 0.4:
        level = "medium"
    else:
        level = "low"

    return {"score": score, "level": level,
            "reason": f"因果:{has_cause_effect:.1f} 可操作:{has_actionable:.1f} "
                      f"条件:{has_conditions:.1f} 非笼统:{is_not_vague:.1f}"}


def check_novelty(experience: dict, knowledge_graph: list[dict]) -> dict:
    """
    ③ 新颖性检查 — 图谱里是不是已经有类似的了？

    Returns: {"score": 0.0~1.0, "level": str, "action": str, "match_id": str|None}
    """
    new_tags = set(experience.get("tags", []))
    new_desc = experience.get("description", "")
    new_feature = experience.get("feature_key", "")

    best_similarity = 0.0
    best_match = None

    for entry in knowledge_graph:
        existing_tags = set(entry.get("tags", []))
        existing_feature = entry.get("feature_key", "")

        # 标签重叠度
        tag_overlap = len(new_tags & existing_tags) / max(len(new_tags | existing_tags), 1)

        # 特征键匹配
        feature_match = 1.0 if new_feature and new_feature == existing_feature else 0.0

        # 综合相似度
        similarity = tag_overlap * 0.6 + feature_match * 0.4

        if similarity > best_similarity:
            best_similarity = similarity
            best_match = entry

    novelty_score = 1.0 - best_similarity

    if best_similarity > 0.8:
        return {"score": novelty_score, "level": "duplicate",
                "action": "merge", "match_id": best_match.get("id") if best_match else None,
                "reason": f"高度重复(相似度{best_similarity:.2f})，建议合并到{best_match.get('id', '?')}"}
    elif best_similarity > 0.5:
        return {"score": novelty_score, "level": "partial",
                "action": "create_linked",
                "match_id": best_match.get("id") if best_match else None,
                "reason": f"部分相似(相似度{best_similarity:.2f})，建议新建并关联"}
    else:
        return {"score": novelty_score, "level": "novel",
                "action": "create",
                "match_id": None,
                "reason": "高度新颖，正常新建"}


def check_reliability(experience: dict) -> dict:
    """
    ④ 可靠性检查 — 这个知识来源可信吗？

    Returns: {"score": 0.0~1.0, "level": str, "reason": str}
    """
    source = experience.get("source", "inference")
    verified = experience.get("verified", False)
    cross_validated = experience.get("cross_validated", False)

    # 来源可靠性基础分
    source_scores = {
        "execution_result": 1.0,    # 实际执行验证
        "official_doc": 0.9,        # 官方文档
        "multiple_sources": 0.85,   # 多来源交叉验证
        "user_stated": 0.7,         # 用户明确告知
        "inference": 0.5,           # 纯推理产物
        "analogy": 0.3,             # 类比推理
        "hearsay": 0.1,             # 传闻
    }

    base = source_scores.get(source, 0.4)

    # 验证加分
    if verified:
        base = min(1.0, base + 0.2)
    if cross_validated:
        base = min(1.0, base + 0.1)

    if base >= 0.8:
        level = "expert"
    elif base >= 0.6:
        level = "trusted"
    elif base >= 0.3:
        level = "uncertain"
    else:
        level = "unreliable"

    return {"score": base, "level": level,
            "reason": f"来源:{source}({source_scores.get(source, 0.4):.1f}) "
                      f"验证:{verified} 交叉:{cross_validated}"}


def gate_check(experience: dict, knowledge_graph: list[dict]) -> GateResult:
    """
    门禁综合判定 — 四重检查 + 综合评分

    Args:
        experience: {"description": str, "tags": list, "source": str,
                      "conditions": str, "conclusion": str,
                      "actionable_steps": list, "verified": bool,
                      "cross_validated": bool, "feature_key": str}
        knowledge_graph: 当前知识图谱

    Returns:
        GateResult
    """
    reasons = []
    quality_tags = []

    # 四重检查
    reusability = check_reusability(experience)
    density = check_information_density(experience)
    novelty = check_novelty(experience, knowledge_graph)
    reliability = check_reliability(experience)

    reasons.extend([f"可复用性:{reusability['level']}({reusability['score']:.2f})",
                    f"信息密度:{density['level']}({density['score']:.2f})",
                    f"新颖性:{novelty['level']}({novelty['score']:.2f})",
                    f"可靠性:{reliability['level']}({reliability['score']:.2f})"])

    # 新颖性判定为"合并"时，跳过其他检查
    if novelty["action"] == "merge":
        return GateResult(
            passed=True, score=1.0, action="merge",
            merge_target=novelty["match_id"],
            reasons=reasons + [f"新颖性检查判定合并到{novelty['match_id']}"],
            quality_tags=["merge_candidate"]
        )

    # 综合得分
    composite = (reusability["score"] * 0.25 + density["score"] * 0.35 +
                 novelty["score"] * 0.15 + reliability["score"] * 0.25)

    # 低分标记
    if reusability["score"] < 0.3:
        quality_tags.append("low_reusability")
    if density["score"] < 0.4:
        quality_tags.append("low_density")
    if reliability["score"] < 0.3:
        quality_tags.append("unreliable_source")

    if composite >= 0.6:
        return GateResult(passed=True, score=composite, action="store",
                          reasons=reasons, quality_tags=quality_tags)
    elif composite >= 0.4:
        quality_tags.append("probation")
        return GateResult(passed=True, score=composite, action="observe",
                          reasons=reasons + [f"门禁得分{composite:.2f}，暂存观察(15天验证窗口)"],
                          quality_tags=quality_tags)
    else:
        return GateResult(passed=False, score=composite, action="discard",
                          reasons=reasons + [f"门禁得分{composite:.2f}<0.4，丢弃"],
                          quality_tags=quality_tags)


# ============================================================================
# CLI 入口
# ============================================================================

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python knowledge_lifecycle.py <command> [args...]")
        print("命令: gate-check")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "gate-check":
        # python knowledge_lifecycle.py gate-check --experience '<JSON>' --kg '<JSON>'
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--experience", type=str, required=True)
        parser.add_argument("--kg", type=str, default="[]")
        args = parser.parse_args(sys.argv[2:])
        exp = json.loads(args.experience)
        kg = json.loads(args.kg)
        result = gate_check(exp, kg)
        print(json.dumps({
            "passed": result.passed,
            "score": result.score,
            "action": result.action,
            "merge_target": result.merge_target,
            "reasons": result.reasons,
            "quality_tags": result.quality_tags,
        }, ensure_ascii=False, indent=2))

    else:
        print(f"未知命令: {cmd}")
        sys.exit(1)


# ============================================================================
# 模块 2: 分层存储引擎
# ============================================================================

# 记忆强度计算参数
STRENGTH_PARAMS = {
    "consolidation_base_per_verify": 5,
    "consolidation_penalty_contradiction": -10,
    "gc_root_bonus": 2,
    "recency_bonus": {"1d": 10, "7d": 5, "30d": 1},
    "daily_decay": -0.1,
}

LAYER_PARAMS = {
    "working": {"max_capacity": None, "decay_per_day": 15},
    "short_term": {"max_capacity": 50, "decay_per_day": 3,
                   "promote_min_n": 10, "promote_max_sigma2": 0.05,
                   "probation_window_days": 15, "min_verifications_for_upgrade": 1},
    "long_term": {"max_capacity": 100, "decay_per_day": 0.5,
                  "demote_strength_threshold": 3, "demote_recall_days": 60},
    "archive": {"max_capacity": None, "decay_per_day": 0.0,
                "recall_threshold": 0.7, "deep_archive_days": 365},
}


def compute_memory_strength(entry: dict, current_time: datetime = None) -> float:
    """计算知识条目的当前记忆强度。"""
    if current_time is None:
        current_time = datetime.now()

    consolidation = entry.get("consolidation_score", 0)

    recall_bonus = 0.0
    last_recall_str = entry.get("last_recall")
    if last_recall_str:
        try:
            days_since = (current_time - datetime.fromisoformat(last_recall_str)).days
            if days_since <= 1: recall_bonus = 10
            elif days_since <= 7: recall_bonus = 5
            elif days_since <= 30: recall_bonus = 1
        except (ValueError, TypeError):
            pass

    created_str = entry.get("created_at") or entry.get("last_verified")
    days_existed = 0
    if created_str:
        try:
            days_existed = max(0, (current_time - datetime.fromisoformat(created_str)).days)
        except (ValueError, TypeError):
            pass

    layer = entry.get("layer", "short_term")
    layer_dpd = LAYER_PARAMS.get(layer, {}).get("decay_per_day", 3)
    decay = STRENGTH_PARAMS["daily_decay"] * days_existed
    layer_decay = layer_dpd * days_existed

    strength = consolidation + recall_bonus + decay + (-layer_decay * 0.1)
    return max(0.0, strength)


def get_memory_clarity(strength: float) -> dict:
    """记忆清晰度判定。"""
    if strength >= 40:
        return {"clarity": "清晰", "can_recall": True, "needs_completion": False, "needs_verification": False}
    elif strength >= 20:
        return {"clarity": "活跃", "can_recall": True, "needs_completion": False, "needs_verification": False}
    elif strength >= 10:
        return {"clarity": "模糊", "can_recall": True, "needs_completion": True, "needs_verification": False}
    elif strength >= 5:
        return {"clarity": "残缺", "can_recall": True, "needs_completion": True, "needs_verification": True}
    else:
        return {"clarity": "濒临遗忘", "can_recall": False, "needs_completion": True, "needs_verification": True}


def determine_layer(entry: dict) -> str:
    """根据条目状态和统计量决定当前所在层。"""
    status = entry.get("status", "HYPOTHESIS")
    n = entry.get("n", 0)
    sigma2 = entry.get("sigma2", 1.0)
    strength = compute_memory_strength(entry)

    if status == "ARCHIVED":
        return "archive"
    if status == "SLEEPING":
        return "archive"

    promote = LAYER_PARAMS["short_term"]
    if (n >= promote["promote_min_n"] and sigma2 < promote["promote_max_sigma2"] and status == "CONFIRMED"):
        return "long_term"
    if entry.get("is_gc_root_referenced", False):
        return "working"
    if strength < 5 and entry.get("days_since_last_recall", 999) > 30:
        return "archive"

    return "short_term"


def minor_gc(short_term_entries: list[dict], current_time: datetime = None) -> tuple[list[dict], list[dict]]:
    """Minor GC — 短期记忆回收（每次任务后）。"""
    if current_time is None:
        current_time = datetime.now()

    surviving, collected = [], []

    for entry in short_term_entries:
        strength = compute_memory_strength(entry, current_time)
        status = entry.get("status", "")

        # "待观察"知识快速通道
        if "probation" in entry.get("quality_tags", []):
            days_existed = 0
            cs = entry.get("created_at")
            if cs:
                try:
                    days_existed = (current_time - datetime.fromisoformat(cs)).days
                except (ValueError, TypeError):
                    pass

            verifications = entry.get("n", 0)
            window = LAYER_PARAMS["short_term"]["probation_window_days"]
            min_v = LAYER_PARAMS["short_term"]["min_verifications_for_upgrade"]

            if days_existed <= window and verifications >= min_v:
                entry["quality_tags"] = [t for t in entry.get("quality_tags", []) if t != "probation"]
                entry["status"] = "PROVISIONAL"
                surviving.append(entry)
                continue
            elif days_existed > window and verifications == 0:
                collected.append(entry)
                continue
            elif days_existed > 30 and verifications == 0:
                collected.append(entry)
                continue

        if strength < 5:
            collected.append(entry)
            continue
        if status == "REFUTED":
            collected.append(entry)
            continue

        surviving.append(entry)

    return surviving, collected


def major_gc(long_term_entries: list[dict], gc_roots: set[str],
             current_time: datetime = None) -> tuple[list[dict], list[dict]]:
    """Major GC — 长期记忆回收（每50次任务后）。"""
    if current_time is None:
        current_time = datetime.now()

    surviving, archived = [], []

    for entry in long_term_entries:
        eid = entry.get("id", "")
        strength = compute_memory_strength(entry, current_time)

        if eid in gc_roots:
            surviving.append(entry)
            continue
        if entry.get("referenced_by", []):
            surviving.append(entry)
            continue

        last_recall_str = entry.get("last_recall")
        days_since = 999
        if last_recall_str:
            try:
                days_since = (current_time - datetime.fromisoformat(last_recall_str)).days
            except (ValueError, TypeError):
                pass

        threshold = LAYER_PARAMS["long_term"]["demote_strength_threshold"]
        recall_days = LAYER_PARAMS["long_term"]["demote_recall_days"]
        if strength < threshold and days_since > recall_days:
            entry["status"] = "ARCHIVED"
            entry["layer"] = "archive"
            archived.append(entry)
            continue

        surviving.append(entry)

    return surviving, archived


# ============================================================================
# 模块 3: 记忆追踪与自动维护
# ============================================================================

# GC Roots 追踪窗口
GC_ROOTS_WINDOW = 20  # 最近N次任务


def track_gc_roots(recent_task_ids: list[str], knowledge_graph: list[dict]) -> set[str]:
    """
    追踪 GC Roots — 最近N次任务中引用的知识条目。

    被 GC Roots 引用的知识不会被回收。
    """
    roots = set()
    for entry in knowledge_graph:
        recalled_in = entry.get("recalled_in_tasks", [])
        # 检查最近 N 次任务中是否有引用
        recent_recalls = set(recalled_in) & set(recent_task_ids)
        if recent_recalls:
            roots.add(entry.get("id", ""))
            entry["is_gc_root_referenced"] = True
        else:
            entry["is_gc_root_referenced"] = False
    return roots


def build_context_anchor(experience: dict) -> dict:
    """
    构建情境锚 — 记录知识产生时的上下文，用于后续情境匹配回忆。

    Returns:
        {"task_type": str, "tech_stack": str, "project_phase": str, "keywords": list}
    """
    return {
        "task_type": experience.get("task_type", ""),
        "tech_stack": experience.get("tech_stack", ""),
        "project_phase": experience.get("project_phase", ""),
        "keywords": experience.get("tags", [])[:5],
    }


def compute_context_match(current_context: dict, anchor: dict) -> float:
    """
    计算当前情境与存储情境的匹配度（情境锚回忆）。

    Returns: 0.0~1.0
    """
    if not anchor:
        return 0.0

    score = 0.0
    weight = 0.0

    # 任务类型匹配
    if current_context.get("task_type") and anchor.get("task_type"):
        weight += 0.3
        if current_context["task_type"] == anchor["task_type"]:
            score += 0.3

    # 技术栈匹配
    if current_context.get("tech_stack") and anchor.get("tech_stack"):
        weight += 0.35
        overlap = len(set(current_context["tech_stack"].split("+")) &
                      set(anchor["tech_stack"].split("+")))
        total = max(len(set(anchor["tech_stack"].split("+"))), 1)
        score += 0.35 * (overlap / total)

    # 关键词匹配
    if current_context.get("keywords") and anchor.get("keywords"):
        weight += 0.35
        ck = set(current_context["keywords"])
        ak = set(anchor["keywords"])
        overlap = len(ck & ak)
        total = max(len(ak), 1)
        score += 0.35 * (overlap / total)

    if weight == 0:
        return 0.0
    return score / weight


def try_recall_from_archive(current_context: dict, archived_entries: list[dict],
                            threshold: float = 0.7) -> list[dict]:
    """
    尝试从归档中回忆知识。

    情境匹配度 > 阈值 → 触发回忆 → 将该条目从归档中拉回。

    Returns:
        触发回忆的条目列表（已标记为待重新验证）
    """
    recalled = []
    for entry in archived_entries:
        anchor = entry.get("context_anchor", {})
        match = compute_context_match(current_context, anchor)
        if match > threshold:
            entry["status"] = "PROVISIONAL"
            entry["layer"] = "short_term"
            entry["recall_triggered_by"] = f"context_match_{match:.2f}"
            entry["last_recall"] = datetime.now().isoformat()
            entry["consolidation_score"] = entry.get("consolidation_score", 0) + 3
            recalled.append(entry)
    return recalled


def build_resonance_connections(new_entry: dict, knowledge_graph: list[dict],
                                similarity_threshold: float = 0.5) -> list[str]:
    """
    建立回响连接 — 新知识激活旧记忆。

    新知识和已有知识之间建立双向关联。

    Returns:
        被激活的旧知识ID列表
    """
    new_tags = set(new_entry.get("tags", []))
    new_feature = new_entry.get("feature_key", "")
    activated = []

    for entry in knowledge_graph:
        if entry.get("id") == new_entry.get("id"):
            continue

        existing_tags = set(entry.get("tags", []))
        existing_feature = entry.get("feature_key", "")

        tag_overlap = len(new_tags & existing_tags) / max(len(new_tags | existing_tags), 1)
        feature_match = 1.0 if new_feature and new_feature == existing_feature else 0.0
        similarity = tag_overlap * 0.6 + feature_match * 0.4

        if similarity > similarity_threshold:
            # 双向连接
            refs = new_entry.get("resonance_refs", [])
            if entry["id"] not in refs:
                refs.append(entry["id"])
            new_entry["resonance_refs"] = refs

            refs2 = entry.get("resonance_refs", [])
            if new_entry["id"] not in refs2:
                refs2.append(new_entry["id"])
            entry["resonance_refs"] = refs2

            # 旧知识被激活 — 巩固分 +3
            entry["consolidation_score"] = entry.get("consolidation_score", 0) + 3
            entry["last_recall"] = datetime.now().isoformat()
            activated.append(entry["id"])

    return activated


def compact_long_term_memory(entry: dict) -> dict:
    """
    记忆压实 — 长期记忆中知识被多次回忆后自动简化。

    核心部分（反复出现的）保留，细节部分压缩到 details 字段。
    """
    recall_count = entry.get("recall_count", 0)
    if recall_count < 5:
        return entry  # 回忆次数太少，不压实

    # 提取核心（每次回忆中都出现的稳定部分）
    description = entry.get("description", "")
    conditions = entry.get("conditions", "")
    conclusion = entry.get("conclusion", "")

    # 核心 = 条件 + 结论（最稳定的部分）
    core = f"{conditions} → {conclusion}" if conditions and conclusion else description

    # 细节 = 原始描述中不在核心里的部分
    details = entry.get("details", "")
    if not details and len(description) > len(core):
        details = description

    entry["core"] = core
    entry["details"] = details
    entry["compacted"] = True
    entry["compacted_at"] = datetime.now().isoformat()

    return entry


def detect_and_clean_errors(knowledge_graph: list[dict]) -> list[dict]:
    """
    错误知识主动识别 — 检测图谱内部的矛盾并清理。

    检测:
      1. 同一特征键下两条 CONFIRMED 知识价值矛盾
      2. 被多次证伪但仍未 REFUTED 的知识
      3. 长期未被引用且门禁分低的 HYPOTHESIS

    Returns:
        被标记为需要清理的条目列表
    """
    to_clean = []

    # 按特征键分组
    by_feature = {}
    for entry in knowledge_graph:
        fk = entry.get("feature_key", "")
        if fk not in by_feature:
            by_feature[fk] = []
        by_feature[fk].append(entry)

    # 检测同特征键下的矛盾
    for fk, entries in by_feature.items():
        confirmed = [e for e in entries if e.get("status") == "CONFIRMED"]
        if len(confirmed) >= 2:
            values = [e.get("q", 0.0) for e in confirmed]
            if max(values) - min(values) > 0.5:
                # 价值矛盾 → 全部标记为 DISPUTED
                for e in confirmed:
                    e["status"] = "DISPUTED"
                    e["dispute_reason"] = f"内部矛盾: 与同特征键下其他CONFIRMED知识价值差>0.5"
                    to_clean.append(e)

    # 检测应该被证伪但未更新状态的
    for entry in knowledge_graph:
        if entry.get("status") == "REFUTED":
            continue
        contradiction_count = entry.get("contradiction_count", 0)
        if contradiction_count >= 3:
            entry["status"] = "REFUTED"
            to_clean.append(entry)

    return to_clean


def full_lifecycle_maintenance(knowledge_graph: list[dict],
                                recent_task_ids: list[str],
                                current_context: dict = None) -> dict:
    """
    完整生命周期维护 — 一次调用完成所有维护操作。

    执行顺序:
      1. GC Roots 追踪
      2. 分层重判
      3. Minor GC (短期)
      4. Major GC (长期)
      5. 归档回忆尝试
      6. 错误检测
      7. 长期记忆压实

    Returns:
        维护报告
    """
    report = {"gc_roots_count": 0, "minor_gc_collected": 0, "major_gc_archived": 0,
              "recalled_from_archive": 0, "errors_detected": 0, "compacted": 0}

    # 1. GC Roots
    gc_roots = track_gc_roots(recent_task_ids, knowledge_graph)
    report["gc_roots_count"] = len(gc_roots)

    # 2. 分层
    short_term, long_term, archive = [], [], []
    for entry in knowledge_graph:
        layer = determine_layer(entry)
        entry["layer"] = layer
        if layer == "short_term" or layer == "working":
            short_term.append(entry)
        elif layer == "long_term":
            long_term.append(entry)
        else:
            archive.append(entry)

    # 3. Minor GC
    surviving_st, collected_st = minor_gc(short_term)
    report["minor_gc_collected"] = len(collected_st)

    # 4. Major GC
    surviving_lt, archived_lt = major_gc(long_term, gc_roots)
    report["major_gc_archived"] = len(archived_lt)

    # 5. 归档回忆
    if current_context:
        recalled = try_recall_from_archive(current_context, archive)
        report["recalled_from_archive"] = len(recalled)

    # 6. 错误检测
    errors = detect_and_clean_errors(surviving_st + surviving_lt)
    report["errors_detected"] = len(errors)

    # 7. 长期记忆压实
    for entry in surviving_lt:
        if entry.get("recall_count", 0) >= 5 and not entry.get("compacted"):
            compact_long_term_memory(entry)
            report["compacted"] += 1

    return report


# CLI 入口
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python knowledge_lifecycle.py <command> [args...]")
        print("命令: gate-check, memory-strength, determine-layer, minor-gc, major-gc,"
              " full-maintenance, context-match, recall-archive, detect-errors, compact")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "gate-check":
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--experience", type=str, required=True)
        parser.add_argument("--kg", type=str, default="[]")
        args = parser.parse_args(sys.argv[2:])
        exp = json.loads(args.experience)
        kg = json.loads(args.kg)
        result = gate_check(exp, kg)
        print(json.dumps({"passed": result.passed, "score": result.score,
                          "action": result.action, "merge_target": result.merge_target,
                          "reasons": result.reasons, "quality_tags": result.quality_tags},
                         ensure_ascii=False, indent=2))

    elif cmd == "memory-strength":
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--entry", type=str, required=True)
        args = parser.parse_args(sys.argv[2:])
        entry = json.loads(args.entry)
        strength = compute_memory_strength(entry)
        clarity = get_memory_clarity(strength)
        print(json.dumps({"strength": strength, **clarity}, ensure_ascii=False))

    elif cmd == "determine-layer":
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--entry", type=str, required=True)
        args = parser.parse_args(sys.argv[2:])
        entry = json.loads(args.entry)
        layer = determine_layer(entry)
        print(json.dumps({"layer": layer}))

    elif cmd == "minor-gc":
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--entries", type=str, required=True)
        args = parser.parse_args(sys.argv[2:])
        entries = json.loads(args.entries)
        surviving, collected = minor_gc(entries)
        print(json.dumps({"surviving_count": len(surviving), "collected_count": len(collected),
                          "collected_ids": [e.get("id") for e in collected]}, ensure_ascii=False))

    elif cmd == "major-gc":
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--entries", type=str, required=True)
        parser.add_argument("--gc-roots", type=str, default="[]")
        args = parser.parse_args(sys.argv[2:])
        entries = json.loads(args.entries)
        gc_roots = set(json.loads(args.gc_roots))
        surviving, archived = major_gc(entries, gc_roots)
        print(json.dumps({"surviving_count": len(surviving), "archived_count": len(archived),
                          "archived_ids": [e.get("id") for e in archived]}, ensure_ascii=False))

    elif cmd == "full-maintenance":
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--kg", type=str, required=True)
        parser.add_argument("--recent-tasks", type=str, default="[]")
        parser.add_argument("--context", type=str, default="{}")
        args = parser.parse_args(sys.argv[2:])
        kg = json.loads(args.kg)
        recent = json.loads(args.recent_tasks)
        ctx = json.loads(args.context) if args.context != "{}" else None
        report = full_lifecycle_maintenance(kg, recent, ctx)
        print(json.dumps(report, ensure_ascii=False))

    elif cmd == "context-match":
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--current", type=str, required=True)
        parser.add_argument("--anchor", type=str, required=True)
        args = parser.parse_args(sys.argv[2:])
        current = json.loads(args.current)
        anchor = json.loads(args.anchor)
        match = compute_context_match(current, anchor)
        print(json.dumps({"match_score": match, "would_recall": match > 0.7}))

    elif cmd == "recall-archive":
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--context", type=str, required=True)
        parser.add_argument("--archive", type=str, required=True)
        args = parser.parse_args(sys.argv[2:])
        ctx = json.loads(args.context)
        archive = json.loads(args.archive)
        recalled = try_recall_from_archive(ctx, archive)
        print(json.dumps({"recalled_count": len(recalled),
                          "recalled_ids": [e.get("id") for e in recalled]}, ensure_ascii=False))

    elif cmd == "detect-errors":
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--kg", type=str, required=True)
        args = parser.parse_args(sys.argv[2:])
        kg = json.loads(args.kg)
        errors = detect_and_clean_errors(kg)
        print(json.dumps({"errors_detected": len(errors),
                          "error_ids": [e.get("id") for e in errors]}, ensure_ascii=False))

    elif cmd == "compact":
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--entry", type=str, required=True)
        args = parser.parse_args(sys.argv[2:])
        entry = json.loads(args.entry)
        result = compact_long_term_memory(entry)
        print(json.dumps({"compacted": result.get("compacted", False),
                          "core": result.get("core", "")}, ensure_ascii=False))

    elif cmd == "resonance":
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--new-entry", type=str, required=True)
        parser.add_argument("--kg", type=str, required=True)
        args = parser.parse_args(sys.argv[2:])
        new_entry = json.loads(args.new_entry)
        kg = json.loads(args.kg)
        activated = build_resonance_connections(new_entry, kg)
        print(json.dumps({"activated_count": len(activated),
                          "activated_ids": activated}, ensure_ascii=False))

    else:
        print(f"未知命令: {cmd}")
        print("可用命令: gate-check, memory-strength, determine-layer, minor-gc, major-gc")
        sys.exit(1)
