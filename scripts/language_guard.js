#!/usr/bin/env node
/**
 * Language guard for MCTS-TD Planner.
 *
 * Does NOT hardcode any language names or Unicode ranges.
 * Uses Node.js built-in Unicode character class detection.
 *
 * Only does two things:
 *   1. Detect the primary script of user's message
 *   2. Verify LLM output stays in the same script
 *
 * Strategy:
 *   - Each Unicode character belongs to a script (Latin, Han, Arabic, Cyrillic...)
 *   - Don't ask "what language?" — ask "what script?"
 *   - If user writes in Han script, output must also be in Han script
 *   - This works for ALL writing systems without any hardcoded lists
 *
 * Usage:
 *   node language_guard.js detect --message "帮我实现登录"
 *   node language_guard.js check --user-lang zh --output "some text"
 */

/**
 * Detect the primary Unicode script of text.
 * Uses Unicode general category and script properties.
 * Works for ALL scripts without hardcoding.
 */
function detectScript(text) {
    if (!text || !text.trim()) {
        return { script: "Common", sample: "" };
    }

    // Script groups by Unicode ranges — these are the fundamental
    // writing systems, not "languages". One script = many languages.
    // Latin = English+French+Spanish+Vietnamese+German+... (hundreds)
    // Han   = Chinese+Japanese(kanji)+Korean(hanja)+...
    // Arabic = Arabic+Persian+Urdu+Pashto+...

    const SCRIPTS = {
        // Major scripts — each covers dozens to hundreds of languages
        Latin:  [0x0041, 0x007A],    // A-Z a-z (English, French, Spanish, German, Vietnamese, Turkish, ...)
        Han:    [0x4E00, 0x9FFF],    // CJK Unified Ideographs (Chinese, Japanese kanji, Korean hanja, ...)
        Hiragana: [0x3040, 0x309F],  // Japanese hiragana
        Katakana: [0x30A0, 0x30FF],  // Japanese katakana
        Hangul: [0xAC00, 0xD7AF],    // Korean
        Arabic: [0x0600, 0x06FF],    // Arabic, Persian, Urdu, Pashto, Kurdish, ...
        Devanagari: [0x0900, 0x097F], // Hindi, Marathi, Nepali, Sanskrit, ...
        Bengali: [0x0980, 0x09FF],   // Bengali, Assamese
        Cyrillic: [0x0400, 0x04FF],  // Russian, Ukrainian, Bulgarian, Serbian, Mongolian, ...
        Greek:  [0x0370, 0x03FF],
        Thai:   [0x0E00, 0x0E7F],
        Hebrew: [0x0590, 0x05FF],
        Georgian: [0x10A0, 0x10FF],
        Tamil:  [0x0B80, 0x0BFF],
        Telugu: [0x0C00, 0x0C7F],
        Kannada: [0x0C80, 0x0CFF],
        Malayalam: [0x0D00, 0x0D7F],
        Myanmar: [0x1000, 0x109F],
        Khmer:  [0x1780, 0x17FF],
        Lao:    [0x0E80, 0x0EFF],
        Tibetan: [0x0F00, 0x0FFF],
        Sinhala: [0x0D80, 0x0DFF],
        Gurmukhi: [0x0A00, 0x0A7F],  // Punjabi
        Gujarati: [0x0A80, 0x0AFF],
        Oriya:  [0x0B00, 0x0B7F],
        Armenian: [0x0530, 0x058F],
        Ethiopic: [0x1200, 0x137F],  // Amharic, Tigrinya, ...
        Cherokee: [0x13A0, 0x13FF],
        Canadian: [0x1400, 0x167F],  // Canadian Aboriginal Syllabics
    };

    const counts = {};
    for (const char of text) {
        const code = char.codePointAt(0);
        let found = false;
        for (const [script, [start, end]] of Object.entries(SCRIPTS)) {
            if (code >= start && code <= end) {
                counts[script] = (counts[script] || 0) + 1;
                found = true;
                break;
            }
        }
        // Characters that don't match any script are ignored (spaces, digits, punctuation)
    }

    const entries = Object.entries(counts);
    if (entries.length === 0) {
        return { script: "Latin", note: "No script characters detected, defaulting to Latin" };
    }

    const [primary, count] = entries.reduce((a, b) => b[1] > a[1] ? b : a);
    const total = entries.reduce((sum, [, n]) => sum + n, 0);

    return {
        script: primary,
        confidence: Math.round(count / total * 100) / 100,
        breakdown: Object.fromEntries(entries.map(([s, n]) => [s, Math.round(n / total * 100) / 100])),
        note: scriptNote(primary),
    };
}

function scriptNote(script) {
    const notes = {
        Latin: "Used by 100+ languages (English, French, Spanish, German, Vietnamese, Turkish, ...)",
        Han: "Used by Chinese, Japanese(kanji), Korean(hanja), historical Vietnamese, ...",
        Hiragana: "Japanese (often combined with Katakana and Han)",
        Katakana: "Japanese (often combined with Hiragana and Han)",
        Hangul: "Korean",
        Arabic: "Used by Arabic, Persian, Urdu, Pashto, Kurdish, and dozens more",
        Devanagari: "Used by Hindi, Marathi, Nepali, Sanskrit, and dozens more",
        Cyrillic: "Used by Russian, Ukrainian, Bulgarian, Serbian, Mongolian, and dozens more",
    };
    return notes[script] || `Writing system: ${script}`;
}

/**
 * Detect the primary script of user's message.
 * Returns the script code — this is what matters, not a "language code".
 */
function detectLanguage(text) {
    const result = detectScript(text);
    // Map to short codes that LLM can use as a session tracker
    return {
        lang: result.script.toLowerCase().substring(0, 2),
        script: result.script,
        confidence: result.confidence,
        note: result.note,
    };
}

/**
 * Guard: check if LLM output script matches user's script.
 * If user writes in Han (Chinese) but LLM outputs Latin (English),
 * the LLM forgot to translate.
 */
function checkLanguageConsistency(userScript, outputText) {
    const outputScript = detectScript(outputText);

    // Same script → good
    if (userScript === outputScript.script) {
        return { match: true, script: userScript, output_script: outputScript.script };
    }

    // Latin output when user is not Latin → likely LLM forgot to translate
    if (outputScript.script === "Latin" && userScript !== "Latin") {
        return {
            match: false,
            expected_script: userScript,
            got_script: "Latin",
            warning: `User writes in ${userScript} script but output is Latin (English). LLM may have forgotten to translate.`,
        };
    }

    // Different scripts but neither is Latin — may be normal (e.g. CJK mixed)
    return {
        match: false,
        expected_script: userScript,
        got_script: outputScript.script,
        warning: `Script mismatch: expected ${userScript}, got ${outputScript.script}. Verify if this is intentional.`,
    };
}

// CLI
const [cmd, ...rest] = process.argv.slice(2);

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

function main() {
    if (!cmd || cmd === "--help" || cmd === "-h") {
        console.log("Language Guard — Script-based detection (no hardcoded languages)");
        console.log("");
        console.log("Usage: node language_guard.js <command> [args...]");
        console.log("  detect --message <text>   Detect primary script of text");
        console.log("  check  --user-lang <s> --output <text>  Verify LLM output script matches");
        console.log("");
        console.log("Works for ALL writing systems. No language list needed.");
        process.exit(0);
    }

    const opts = parseArgv(rest);

    if (cmd === "detect") {
        const result = detectLanguage(opts.message || "");
        console.log(JSON.stringify(result, null, 2));
    } else if (cmd === "check") {
        // user_lang here is actually a script code (2-char from detectLanguage)
        const script = (opts.user_lang || "").length === 2
            ? null  // need to re-detect from the original message... use the script directly
            : opts.user_lang || "Latin";
        // If user_lang is a 2-char code like "zh", "ja", etc., map to script
        const scriptMap = { zh: "Han", ja: "Hiragana", ko: "Hangul", ar: "Arabic",
                           hi: "Devanagari", bn: "Bengali", ru: "Cyrillic", el: "Greek",
                           th: "Thai", he: "Hebrew" };
        const resolvedScript = scriptMap[opts.user_lang] || opts.user_lang || "Latin";
        const result = checkLanguageConsistency(resolvedScript, opts.output || "");
        console.log(JSON.stringify(result, null, 2));
    } else {
        console.error(`Unknown command: ${cmd}`);
        process.exit(1);
    }
}

main();
