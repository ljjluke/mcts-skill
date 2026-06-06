#!/usr/bin/env python3
"""
Language Adapter for MCTS-TD Planner

Provides:
  1. User language detection
  2. Fixed label translations (code-enforced)
  3. Output format templates in multiple languages
  4. Language state tracking (prevents "forgetting")

Usage:
  python language_adapter.py detect --message "帮我实现登录"
  python language_adapter.py labels --lang zh
  python language_adapter.py template --phase review_map --lang zh --task "登录功能" --domain "软件工程"
  python language_adapter.py state --set zh
  python language_adapter.py state --check
"""

import sys
import json
import re
from typing import Optional

# ============================================================================
# Language Detection
# ============================================================================

def detect_language(message: str) -> dict:
    """
    Detect user's language from their message.

    Returns:
        {"lang": str, "confidence": float, "method": str}
    """
    if not message:
        return {"lang": "en", "confidence": 1.0, "method": "empty"}

    # CJK character ranges
    ranges = {
        "zh": [  # Chinese
            (0x4E00, 0x9FFF),   # CJK Unified Ideographs
            (0x3400, 0x4DBF),   # CJK Extension A
            (0x20000, 0x2A6DF), # CJK Extension B
            (0x2A700, 0x2B73F), # CJK Extension C
            (0x2B740, 0x2B81F), # CJK Extension D
        ],
        "ja": [  # Japanese
            (0x3040, 0x309F),   # Hiragana
            (0x30A0, 0x30FF),   # Katakana
        ],
        "ko": [  # Korean
            (0xAC00, 0xD7AF),   # Hangul Syllables
            (0x1100, 0x11FF),   # Hangul Jamo
            (0x3130, 0x318F),   # Hangul Compatibility Jamo
        ],
    }

    # Script counts
    counts = {"zh": 0, "ja": 0, "ko": 0, "en": 0, "other": 0}

    for char in message:
        code = ord(char)

        # Check ASCII letters
        if ('a' <= char <= 'z') or ('A' <= char <= 'Z'):
            counts["en"] += 1
            continue

        # Check CJK
        found = False
        for lang, lang_ranges in ranges.items():
            for start, end in lang_ranges:
                if start <= code <= end:
                    counts[lang] += 1
                    found = True
                    break
            if found:
                break

        if not found and not char.isspace() and not char.isdigit():
            counts["other"] += 1

    total = sum(counts.values())
    if total == 0:
        return {"lang": "en", "confidence": 1.0, "method": "no_content"}

    # Determine primary language
    # Priority: CJK > English
    max_lang = max(counts, key=counts.get)
    confidence = counts[max_lang] / total if total > 0 else 0

    # If mostly English with some CJK, still use CJK language
    # (user likely typing in their native language with some English terms)
    cjk_total = counts["zh"] + counts["ja"] + counts["ko"]
    if cjk_total > 0 and counts["en"] > cjk_total:
        # Has CJK but mostly English - check which CJK
        if counts["ja"] > counts["zh"] and counts["ja"] > counts["ko"]:
            max_lang = "ja"
        elif counts["ko"] > counts["zh"] and counts["ko"] > counts["ja"]:
            max_lang = "ko"
        elif counts["zh"] > 0:
            max_lang = "zh"

    return {
        "lang": max_lang,
        "confidence": round(confidence, 2),
        "method": "character_analysis",
        "breakdown": counts
    }


# ============================================================================
# Label Translations (Code-Enforced)
# ============================================================================

LABELS = {
    "en": {
        # Phase labels
        "review_map": "Eight-Facet Review Map",
        "recon_report": "Reconnaissance Report",
        "solution_list": "Converged Solution List",
        "decision_report": "MCTS-TD Decision Report",
        "mcts_conclusion": "MCTS Tree Search Conclusion",

        # Confirmation prompts
        "confirm": "Confirm",
        "continue": "Continue",
        "add_solution": "Add solution",
        "remove_solution": "Remove solution",
        "just_do": "Skip simulation, execute directly",

        # Eight Facets
        "F1": "Source of Force",
        "F2": "Foundation & Capacity",
        "F3": "Change & Disruption",
        "F4": "Penetration & Diffusion",
        "F5": "Risk & Abyss",
        "F6": "Visible & Dependent",
        "F7": "Boundary & Limit",
        "F8": "Convergence & Mutual Benefit",

        # Common terms
        "solution": "Solution",
        "risk": "Risk",
        "confidence": "Confidence",
        "high": "High",
        "medium": "Medium",
        "low": "Low",
        "recommended": "Recommended",
        "best_path": "Best Path",
        "main_risk": "Main Risk",

        # Self-check
        "self_check": "Simulation Result Self-Check",
        "find_flaws": "Find Flaws",
        "reverse_thinking": "Reverse Thinking",
        "risk_assessment": "Risk Assessment",
        "passed": "Passed",
        "has_risk": "Has Risk",
        "not_passed": "Not Passed",

        # Blindspot audit
        "blindspot_audit": "Domain Blindspot Audit",
        "coverage_matrix": "Eight-Facet Coverage Matrix",
        "uncovered": "Uncovered",
        "covered": "Covered",
    },
    "zh": {
        # Phase labels
        "review_map": "八面审视地图",
        "recon_report": "侦查报告",
        "solution_list": "收敛方案列表",
        "decision_report": "MCTS-TD 决策报告",
        "mcts_conclusion": "MCTS 树搜索结论",

        # Confirmation prompts
        "confirm": "确认",
        "continue": "继续",
        "add_solution": "添加方案",
        "remove_solution": "移除方案",
        "just_do": "跳过推演，直接执行",

        # Eight Facets
        "F1": "力量之源",
        "F2": "根基承载",
        "F3": "变动突破",
        "F4": "渗透传播",
        "F5": "风险深渊",
        "F6": "显眼依附",
        "F7": "边界止步",
        "F8": "汇聚共赢",

        # Common terms
        "solution": "方案",
        "risk": "风险",
        "confidence": "信心",
        "high": "高",
        "medium": "中",
        "low": "低",
        "recommended": "推荐",
        "best_path": "最佳路径",
        "main_risk": "主要风险",

        # Self-check
        "self_check": "推演结果自检",
        "find_flaws": "找漏洞",
        "reverse_thinking": "反向思考",
        "risk_assessment": "风险评估",
        "passed": "通过",
        "has_risk": "有风险",
        "not_passed": "未通过",

        # Blindspot audit
        "blindspot_audit": "领域盲区审计",
        "coverage_matrix": "八面覆盖矩阵",
        "uncovered": "未覆盖",
        "covered": "已覆盖",
    },
    "ja": {
        # Phase labels
        "review_map": "八面審視マップ",
        "recon_report": "偵察レポート",
        "solution_list": "収束ソリューションリスト",
        "decision_report": "MCTS-TD 決定レポート",
        "mcts_conclusion": "MCTS ツリー検索結論",

        # Confirmation prompts
        "confirm": "確認",
        "continue": "続行",
        "add_solution": "ソリューション追加",
        "remove_solution": "ソリューション削除",
        "just_do": "シミュレーション省略、直接実行",

        # Eight Facets
        "F1": "力の源",
        "F2": "基盤と容量",
        "F3": "変化と破壊",
        "F4": "浸透と拡散",
        "F5": "リスクと深淵",
        "F6": "可視と依存",
        "F7": "境界と限界",
        "F8": "収束と相互利益",

        # Common terms
        "solution": "ソリューション",
        "risk": "リスク",
        "confidence": "信頼度",
        "high": "高",
        "medium": "中",
        "low": "低",
        "recommended": "推奨",
        "best_path": "最適パス",
        "main_risk": "主なリスク",

        # Self-check
        "self_check": "シミュレーション結果自己チェック",
        "find_flaws": "欠陥を見つける",
        "reverse_thinking": "逆転の発想",
        "risk_assessment": "リスク評価",
        "passed": "合格",
        "has_risk": "リスクあり",
        "not_passed": "不合格",

        # Blindspot audit
        "blindspot_audit": "ドメイン盲点監査",
        "coverage_matrix": "八面カバレッジマトリックス",
        "uncovered": "未カバー",
        "covered": "カバー済み",
    },
    "ko": {
        # Phase labels
        "review_map": "팔면심사지도",
        "recon_report": "정찰 보고서",
        "solution_list": "수렴 솔루션 목록",
        "decision_report": "MCTS-TD 결정 보고서",
        "mcts_conclusion": "MCTS 트리 검색 결론",

        # Confirmation prompts
        "confirm": "확인",
        "continue": "계속",
        "add_solution": "솔루션 추가",
        "remove_solution": "솔루션 제거",
        "just_do": "시뮬레이션 건너뛰고 직접 실행",

        # Eight Facets
        "F1": "힘의 원천",
        "F2": "기반과 용량",
        "F3": "변화와 파괴",
        "F4": "침투와 확산",
        "F5": "위험과 심연",
        "F6": "가시적 의존",
        "F7": "경계와 한계",
        "F8": "수렴과 상호이익",

        # Common terms
        "solution": "솔루션",
        "risk": "위험",
        "confidence": "신뢰도",
        "high": "높음",
        "medium": "중간",
        "low": "낮음",
        "recommended": "추천",
        "best_path": "최적 경로",
        "main_risk": "주요 위험",

        # Self-check
        "self_check": "시뮬레이션 결과 자체 점검",
        "find_flaws": "결함 찾기",
        "reverse_thinking": "역발상",
        "risk_assessment": "위험 평가",
        "passed": "통과",
        "has_risk": "위험 있음",
        "not_passed": "통과 못함",

        # Blindspot audit
        "blindspot_audit": "도메인 맹점 감사",
        "coverage_matrix": "팔면 커버리지 매트릭스",
        "uncovered": "미커버",
        "covered": "커버됨",
    },
}


def get_label(key: str, lang: str) -> str:
    """Get translated label for given key and language."""
    lang_labels = LABELS.get(lang, LABELS["en"])
    return lang_labels.get(key, LABELS["en"].get(key, key))


def get_all_labels(lang: str) -> dict:
    """Get all labels for a language."""
    return LABELS.get(lang, LABELS["en"])


# ============================================================================
# Output Templates (Code-Enforced)
# ============================================================================

def format_phase_header(phase: str, lang: str, **kwargs) -> str:
    """
    Generate localized phase header.

    Args:
        phase: "review_map" | "recon_report" | "solution_list" | "decision_report"
        lang: Language code
        **kwargs: Additional context (task_name, domain, etc.)
    """
    labels = LABELS.get(lang, LABELS["en"])
    phase_label = labels.get(phase, phase)

    if phase == "review_map":
        task = kwargs.get("task", "")
        domain = kwargs.get("domain", "")
        return f"═══════════════════════════════════════\n 【{phase_label}】{task} · {domain}\n═══════════════════════════════════════"

    elif phase == "solution_list":
        return f"────────────────────────────\n 【{phase_label}】\n"

    elif phase == "decision_report":
        task = kwargs.get("task", "")
        date = kwargs.get("date", "")
        iterations = kwargs.get("iterations", "")
        return f"═══════════════════════════════════════\n 【{phase_label}】{task} · {date} · {iterations} iterations\n═══════════════════════════════════════"

    else:
        return f"═══════════════════════════════════════\n 【{phase_label}】\n═══════════════════════════════════════"


def format_solution_confirmation(num_solutions: int, facets_covered: int, lang: str) -> str:
    """Generate localized solution list confirmation prompt."""
    labels = LABELS.get(lang, LABELS["en"])

    templates = {
        "en": f"""────────────────────────────
 【{labels['solution_list']} Confirmation】

 Above are {num_solutions} solutions from the diverge engine (covering {facets_covered}/8 decision facets).

 Next: MCTS tree search simulation for each solution.

 {labels['confirm']}:
   ✅ "{labels['continue']}" → Enter simulation
   ➕ "{labels['add_solution']}" → Add solution
   ➖ "{labels['remove_solution']}" → Remove solution
   ⚡ "{labels['just_do']}" → Skip simulation, execute directly
 ────────────────────────────""",
        "zh": f"""────────────────────────────
 【{labels['solution_list']}确认】

 发散引擎生成了 {num_solutions} 个方案（覆盖 {facets_covered}/8 个决策面）。

 接下来：对每个方案进行 MCTS 树搜索推演。

 {labels['confirm']}:
   ✅ "{labels['continue']}" → 进入推演引擎
   ➕ "{labels['add_solution']}" → 补充方案
   ➖ "{labels['remove_solution']}" → 移除
   ⚡ "{labels['just_do']}" → 跳过推演，直接执行
 ────────────────────────────""",
        "ja": f"""────────────────────────────
 【{labels['solution_list']}確認】

 ダイバージェンスエンジンから{num_solutions}件のソリューション（{facets_covered}/8決定面をカバー）。

 次へ：各ソリューションのMCTSツリー検索シミュレーション。

 {labels['confirm']}:
   ✅ "{labels['continue']}" → シミュレーション開始
   ➕ "{labels['add_solution']}" → ソリューション追加
   ➖ "{labels['remove_solution']}" → ソリューション削除
   ⚡ "{labels['just_do']}" → シミュレーション省略、直接実行
 ────────────────────────────""",
        "ko": f"""────────────────────────────
 【{labels['solution_list']} 확인】

 발산 엔진에서 {num_solutions}개 솔루션 생성 ({facets_covered}/8 결정면 커버).

 다음: 각 솔루션에 대한 MCTS 트리 검색 시뮬레이션.

 {labels['confirm']}:
   ✅ "{labels['continue']}" → 시뮬레이션 시작
   ➕ "{labels['add_solution']}" → 솔루션 추가
   ➖ "{labels['remove_solution']}" → 솔루션 제거
   ⚡ "{labels['just_do']}" → 시뮬레이션 건너뛰고 직접 실행
 ────────────────────────────""",
    }

    return templates.get(lang, templates["en"])


# ============================================================================
# Language State Tracking (Prevents "Forgetting")
# ============================================================================

# Global state (in-memory, per session)
_current_lang: str = "en"

def set_language(lang: str) -> dict:
    """Set current language for the session."""
    global _current_lang
    _current_lang = lang
    return {"lang": lang, "status": "set"}

def get_language() -> str:
    """Get current language."""
    return _current_lang

def check_language(expected_lang: str = None) -> dict:
    """
    Check if current language matches expected.
    Used to enforce language consistency across outputs.
    """
    current = _current_lang
    if expected_lang and current != expected_lang:
        return {
            "match": False,
            "current": current,
            "expected": expected_lang,
            "warning": f"Language mismatch! Current: {current}, Expected: {expected_lang}"
        }
    return {"match": True, "current": current}


# ============================================================================
# CLI Interface
# ============================================================================

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python language_adapter.py <command> [args...]")
        print("Commands: detect, labels, template, state")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "detect":
        # python language_adapter.py detect --message "帮我实现登录"
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--message", type=str, required=True)
        args = parser.parse_args(sys.argv[2:])
        result = detect_language(args.message)
        # Also set the language
        set_language(result["lang"])
        print(json.dumps(result, ensure_ascii=False, indent=2))

    elif cmd == "labels":
        # python language_adapter.py labels --lang zh
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--lang", type=str, default="en")
        args = parser.parse_args(sys.argv[2:])
        result = get_all_labels(args.lang)
        print(json.dumps(result, ensure_ascii=False, indent=2))

    elif cmd == "template":
        # python language_adapter.py template --phase review_map --lang zh --task "登录功能" --domain "软件工程"
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--phase", type=str, required=True)
        parser.add_argument("--lang", type=str, default="en")
        parser.add_argument("--task", type=str, default="")
        parser.add_argument("--domain", type=str, default="")
        parser.add_argument("--num-solutions", type=int, default=0)
        parser.add_argument("--facets-covered", type=int, default=0)
        args = parser.parse_args(sys.argv[2:])

        if args.phase == "solution_list" and args.num_solutions > 0:
            result = format_solution_confirmation(args.num_solutions, args.facets_covered, args.lang)
        else:
            result = format_phase_header(args.phase, args.lang, task=args.task, domain=args.domain)
        print(result)

    elif cmd == "state":
        # python language_adapter.py state --set zh
        # python language_adapter.py state --check
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--set", type=str, default=None, dest="set_lang")
        parser.add_argument("--check", action="store_true")
        parser.add_argument("--expected", type=str, default=None)
        args = parser.parse_args(sys.argv[2:])

        if args.set_lang:
            result = set_language(args.set_lang)
        elif args.check:
            result = check_language(args.expected)
        else:
            result = {"current": get_language()}
        print(json.dumps(result, ensure_ascii=False, indent=2))

    else:
        print(f"Unknown command: {cmd}")
        print("Available: detect, labels, template, state")
        sys.exit(1)
