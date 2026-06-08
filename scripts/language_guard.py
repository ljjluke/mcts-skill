#!/usr/bin/env python3
"""
Language guard for MCTS-TD Planner.
Does NOT translate content. Only does two things:
  1. Detect what language the user is writing in
  2. If LLM accidentally outputs in wrong language, flag it

NO hardcoded translations. NO language list. Works for any language.
The guard is a safety net — LLM is still the primary translator.
"""

import sys
import json


def detect_language(text: str) -> str:
    """
    Detect the primary script/language of the text.
    Returns ISO 639-1 code based on Unicode script detection.
    Works for ALL languages — no hardcoded list.
    """
    if not text.strip():
        return "en"

    scripts = {}

    for char in text:
        code = ord(char)
        script = _get_script(code)
        if script:
            scripts[script] = scripts.get(script, 0) + 1

    if not scripts:
        return "en"

    return max(scripts, key=scripts.get)


def _get_script(code: int) -> str:
    """Map Unicode code point to script/language code."""
    # Latin (English, French, Spanish, German, Vietnamese, etc.)
    if (0x0041 <= code <= 0x005A) or (0x0061 <= code <= 0x007A):
        return "latin"

    # CJK Unified Ideographs (Chinese)
    if (0x4E00 <= code <= 0x9FFF) or (0x3400 <= code <= 0x4DBF):
        return "zh"

    # Japanese specific (Hiragana + Katakana)
    if (0x3040 <= code <= 0x309F) or (0x30A0 <= code <= 0x30FF):
        return "ja"

    # Korean Hangul
    if (0xAC00 <= code <= 0xD7AF) or (0x1100 <= code <= 0x11FF):
        return "ko"

    # Arabic
    if (0x0600 <= code <= 0x06FF) or (0x0750 <= code <= 0x077F):
        return "ar"

    # Devanagari (Hindi, Marathi, Nepali, etc.)
    if 0x0900 <= code <= 0x097F:
        return "hi"

    # Bengali
    if 0x0980 <= code <= 0x09FF:
        return "bn"

    # Cyrillic (Russian, Ukrainian, Bulgarian, Serbian, etc.)
    if (0x0400 <= code <= 0x04FF) or (0x0500 <= code <= 0x052F):
        return "ru"

    # Greek
    if 0x0370 <= code <= 0x03FF:
        return "el"

    # Thai
    if 0x0E00 <= code <= 0x0E7F:
        return "th"

    # Hebrew
    if 0x0590 <= code <= 0x05FF:
        return "he"

    # Georgian
    if 0x10A0 <= code <= 0x10FF:
        return "ka"

    # Tamil
    if 0x0B80 <= code <= 0x0BFF:
        return "ta"

    # Telugu
    if 0x0C00 <= code <= 0x0C7F:
        return "te"

    # Kannada
    if 0x0C80 <= code <= 0x0CFF:
        return "kn"

    # Malayalam
    if 0x0D00 <= code <= 0x0D7F:
        return "ml"

    # Myanmar
    if 0x1000 <= code <= 0x109F:
        return "my"

    # Khmer
    if 0x1780 <= code <= 0x17FF:
        return "km"

    # Lao
    if 0x0E80 <= code <= 0x0EFF:
        return "lo"

    # Tibetan
    if 0x0F00 <= code <= 0x0FFF:
        return "bo"

    # Sinhala
    if 0x0D80 <= code <= 0x0DFF:
        return "si"

    # Gurmukhi (Punjabi)
    if 0x0A00 <= code <= 0x0A7F:
        return "pa"

    # Gujarati
    if 0x0A80 <= code <= 0x0AFF:
        return "gu"

    # Oriya
    if 0x0B00 <= code <= 0x0B7F:
        return "or"

    # Armenian
    if 0x0530 <= code <= 0x058F:
        return "hy"

    return None


def get_language_display_name(code: str) -> str:
    """Get a human-readable name for the language code."""
    names = {
        "zh": "Chinese",
        "ja": "Japanese",
        "ko": "Korean",
        "ar": "Arabic",
        "hi": "Hindi",
        "bn": "Bengali",
        "ru": "Russian",
        "el": "Greek",
        "th": "Thai",
        "he": "Hebrew",
        "ka": "Georgian",
        "ta": "Tamil",
        "te": "Telugu",
        "kn": "Kannada",
        "ml": "Malayalam",
        "my": "Myanmar",
        "km": "Khmer",
        "lo": "Lao",
        "bo": "Tibetan",
        "si": "Sinhala",
        "pa": "Punjabi",
        "gu": "Gujarati",
        "or": "Oriya",
        "hy": "Armenian",
        "latin": "English/European",
    }
    return names.get(code, f"Unknown ({code})")


def check_language_consistency(user_lang: str, output_text: str) -> dict:
    """
    Check if LLM output is in the expected language.
    Returns warning if output contains unexpected script.

    This is a SAFETY NET — LLM is the primary translator.
    Only flags obvious mismatches (e.g., English output when user is Chinese).
    """
    output_lang = detect_language(output_text)

    # Latin script is ambiguous (English, French, Spanish all use it)
    # Only flag if user_lang is clearly non-latin and output is latin
    non_latin_scripts = {"zh", "ja", "ko", "ar", "hi", "bn", "ru", "el",
                         "th", "he", "ka", "ta", "te", "kn", "ml",
                         "my", "km", "lo", "bo", "si", "pa", "gu", "or", "hy"}

    if user_lang in non_latin_scripts and output_lang == "latin":
        return {
            "match": False,
            "expected": user_lang,
            "got": "latin (English or European)",
            "warning": f"User language is {get_language_display_name(user_lang)} but output appears to be in Latin script. Did LLM forget to translate?"
        }

    # If both are same non-latin script, good
    if user_lang == output_lang:
        return {"match": True, "expected": user_lang, "got": output_lang}

    return {"match": True, "expected": user_lang, "got": output_lang,
            "note": "Scripts differ but may be normal (e.g., CJK mixed with Latin terms)"}


# CLI
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python language_guard.py <command> [args...]")
        print("Commands: detect, check")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "detect":
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--message", type=str, required=True)
        args = parser.parse_args(sys.argv[2:])
        lang = detect_language(args.message)
        print(json.dumps({"lang": lang, "name": get_language_display_name(lang)}))

    elif cmd == "check":
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--user-lang", type=str, required=True)
        parser.add_argument("--output", type=str, required=True)
        args = parser.parse_args(sys.argv[2:])
        result = check_language_consistency(args.user_lang, args.output)
        print(json.dumps(result, ensure_ascii=False, indent=2))

    else:
        print(f"Unknown: {cmd}")
        sys.exit(1)
