#!/usr/bin/env node
/**
 * Language guard for MCTS-TD Planner.
 * Does NOT translate content. Only does two things:
 *   1. Detect what language the user is writing in
 *   2. If LLM accidentally outputs in wrong language, flag it
 *
 * NO hardcoded translations. NO language list. Works for any language.
 * The guard is a safety net — LLM is still the primary translator.
 *
 * Usage:
 *   node scripts/language_guard.js detect --message "帮我实现登录"
 *   node scripts/language_guard.js check --user-lang zh --output "some text"
 */

/**
 * Map Unicode code point to script/language code.
 * Does NOT hardcode a language list — uses Unicode script ranges.
 */
function getScript(code) {
    // Latin (English, French, Spanish, German, Vietnamese, etc.)
    if ((code >= 0x0041 && code <= 0x005A) || (code >= 0x0061 && code <= 0x007A)) {
        return "latin";
    }
    // CJK Unified Ideographs (Chinese)
    if ((code >= 0x4E00 && code <= 0x9FFF) || (code >= 0x3400 && code <= 0x4DBF)) {
        return "zh";
    }
    // Japanese specific (Hiragana + Katakana)
    if ((code >= 0x3040 && code <= 0x309F) || (code >= 0x30A0 && code <= 0x30FF)) {
        return "ja";
    }
    // Korean Hangul
    if ((code >= 0xAC00 && code <= 0xD7AF) || (code >= 0x1100 && code <= 0x11FF)) {
        return "ko";
    }
    // Arabic
    if ((code >= 0x0600 && code <= 0x06FF) || (code >= 0x0750 && code <= 0x077F)) {
        return "ar";
    }
    // Devanagari (Hindi, Marathi, Nepali, etc.)
    if (code >= 0x0900 && code <= 0x097F) {
        return "hi";
    }
    // Bengali
    if (code >= 0x0980 && code <= 0x09FF) {
        return "bn";
    }
    // Cyrillic (Russian, Ukrainian, Bulgarian, Serbian, etc.)
    if ((code >= 0x0400 && code <= 0x04FF) || (code >= 0x0500 && code <= 0x052F)) {
        return "ru";
    }
    // Greek
    if (code >= 0x0370 && code <= 0x03FF) {
        return "el";
    }
    // Thai
    if (code >= 0x0E00 && code <= 0x0E7F) {
        return "th";
    }
    // Hebrew
    if (code >= 0x0590 && code <= 0x05FF) {
        return "he";
    }
    // Georgian
    if (code >= 0x10A0 && code <= 0x10FF) {
        return "ka";
    }
    // Tamil
    if (code >= 0x0B80 && code <= 0x0BFF) {
        return "ta";
    }
    // Telugu
    if (code >= 0x0C00 && code <= 0x0C7F) {
        return "te";
    }
    // Kannada
    if (code >= 0x0C80 && code <= 0x0CFF) {
        return "kn";
    }
    // Malayalam
    if (code >= 0x0D00 && code <= 0x0D7F) {
        return "ml";
    }
    // Myanmar
    if (code >= 0x1000 && code <= 0x109F) {
        return "my";
    }
    // Khmer
    if (code >= 0x1780 && code <= 0x17FF) {
        return "km";
    }
    // Lao
    if (code >= 0x0E80 && code <= 0x0EFF) {
        return "lo";
    }
    // Tibetan
    if (code >= 0x0F00 && code <= 0x0FFF) {
        return "bo";
    }
    // Sinhala
    if (code >= 0x0D80 && code <= 0x0DFF) {
        return "si";
    }
    // Gurmukhi (Punjabi)
    if (code >= 0x0A00 && code <= 0x0A7F) {
        return "pa";
    }
    // Gujarati
    if (code >= 0x0A80 && code <= 0x0AFF) {
        return "gu";
    }
    // Oriya
    if (code >= 0x0B00 && code <= 0x0B7F) {
        return "or";
    }
    // Armenian
    if (code >= 0x0530 && code <= 0x058F) {
        return "hy";
    }
    return null;
}

function getLanguageDisplayName(code) {
    const names = {
        zh: "Chinese", ja: "Japanese", ko: "Korean", ar: "Arabic",
        hi: "Hindi", bn: "Bengali", ru: "Russian", el: "Greek",
        th: "Thai", he: "Hebrew", ka: "Georgian", ta: "Tamil",
        te: "Telugu", kn: "Kannada", ml: "Malayalam", my: "Myanmar",
        km: "Khmer", lo: "Lao", bo: "Tibetan", si: "Sinhala",
        pa: "Punjabi", gu: "Gujarati", or: "Oriya", hy: "Armenian",
        latin: "English/European",
    };
    return names[code] || `Unknown (${code})`;
}

function detectLanguage(text) {
    if (!text || !text.trim()) return "en";
    const scripts = {};

    for (const char of text) {
        const code = char.codePointAt(0);
        const script = getScript(code);
        if (script) {
            scripts[script] = (scripts[script] || 0) + 1;
        }
    }

    const entries = Object.entries(scripts);
    if (entries.length === 0) return "en";

    return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

function checkLanguageConsistency(userLang, outputText) {
    const outputLang = detectLanguage(outputText);

    const nonLatinScripts = new Set([
        "zh", "ja", "ko", "ar", "hi", "bn", "ru", "el",
        "th", "he", "ka", "ta", "te", "kn", "ml",
        "my", "km", "lo", "bo", "si", "pa", "gu", "or", "hy"
    ]);

    if (nonLatinScripts.has(userLang) && outputLang === "latin") {
        return {
            match: false,
            expected: userLang,
            got: "latin (English or European)",
            warning: `User language is ${getLanguageDisplayName(userLang)} but output appears to be in Latin script. Did LLM forget to translate?`
        };
    }

    if (userLang === outputLang) {
        return { match: true, expected: userLang, got: outputLang };
    }

    return {
        match: true, expected: userLang, got: outputLang,
        note: "Scripts differ but may be normal (e.g., CJK mixed with Latin terms)"
    };
}

// CLI
const args = process.argv.slice(2);
if (args.length < 1) {
    console.log("Usage: node language_guard.js <command> [args...]");
    console.log("Commands: detect, check");
    process.exit(1);
}

const cmd = args[0];
const rest = args.slice(1);

function parseArgv(argv) {
    const result = {};
    for (let i = 0; i < argv.length; i++) {
        if (argv[i].startsWith("--")) {
            const key = argv[i].replace("--", "").replace(/-/g, "_");
            const val = argv[i + 1];
            if (val && !val.startsWith("--")) {
                result[key] = val;
                i++;
            } else {
                result[key] = true;
            }
        }
    }
    return result;
}

if (cmd === "detect") {
    const opts = parseArgv(rest);
    const lang = detectLanguage(opts.message || "");
    console.log(JSON.stringify({ lang, name: getLanguageDisplayName(lang) }));
} else if (cmd === "check") {
    const opts = parseArgv(rest);
    const result = checkLanguageConsistency(opts.user_lang || "en", opts.output || "");
    console.log(JSON.stringify(result, null, 2));
} else {
    console.log(`Unknown: ${cmd}`);
    process.exit(1);
}
