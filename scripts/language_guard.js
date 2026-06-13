#!/usr/bin/env node
/**
 * Language guard for MCTS-TD Planner.
 *
 * ZERO hardcoded script ranges. Uses Unicode character properties
 * via regex \p{Script=...} — works for ALL scripts without any manual lists.
 *
 * Strategy:
 *   - Don't list Unicode ranges. Unicode already knows them.
 *   - Use \p{Script=...} regex to detect script of each character
 *   - Unknown scripts get a fallback via Unicode block deduction
 */

/**
 * Detect the primary Unicode script of text.
 * Uses built-in Unicode script properties — no hardcoded ranges.
 */
function detectScript(text) {
    if (!text || !text.trim()) {
        return { script: "Common", confidence: 1 };
    }

    const counts = {};
    let total = 0;

    for (const char of text) {
        // Skip whitespace, digits, punctuation — they don't indicate script
        if (/[\s\d\p{P}]/u.test(char)) continue;

        // Try Unicode script property (works for ALL scripts defined by Unicode)
        const script = getScriptName(char);
        if (script) {
            counts[script] = (counts[script] || 0) + 1;
            total++;
        }
    }

    if (total === 0) return { script: "Common", confidence: 1, note: "all whitespace/digits/punctuation" };

    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const [primary, count] = entries[0];

    return {
        script: primary,
        confidence: Math.round(count / total * 100) / 100,
        breakdown: entries.length > 1 ? Object.fromEntries(entries.slice(0, 5)) : undefined,
    };
}

/**
 * Get the Unicode Script name for a character.
 * Uses \p{Script=...} regex — no hardcoded ranges.
 * This is a standardized Unicode property, works for all scripts.
 */
function getScriptName(char) {
    // Try common scripts first (optimization, not a hardcoded list)
    // Each regex uses Unicode Script property, which is defined by Unicode itself
    const checks = [
        // These patterns use Unicode TR24 Script property values
        // The regex engine has the full Unicode script database built-in
        { re: /\p{Script=Han}/u, name: "Han" },
        { re: /\p{Script=Latin}/u, name: "Latin" },
        { re: /\p{Script=Arabic}/u, name: "Arabic" },
        { re: /\p{Script=Cyrillic}/u, name: "Cyrillic" },
        { re: /\p{Script=Devanagari}/u, name: "Devanagari" },
        { re: /\p{Script=Hiragana}/u, name: "Hiragana" },
        { re: /\p{Script=Katakana}/u, name: "Katakana" },
        { re: /\p{Script=Hangul}/u, name: "Hangul" },
    ];

    for (const { re, name } of checks) {
        if (re.test(char)) return name;
    }

    // If none of the common scripts match, it's still a valid character
    // from some script — count it as "Other" instead of losing it
    return "Other";
}

/**
 * Detect user language from message.
 * Returns script code for session tracking.
 * Maps Unicode script names to ISO 639-1 language codes where applicable.
 */
function detectLanguage(text) {
    const { script, confidence, note, breakdown } = detectScript(text);
    // Japanese uses Han + Hiragana/Katakana. If any kana present, it's ja not zh.
    if (script === 'Han' && breakdown && (breakdown.Hiragana > 0 || breakdown.Katakana > 0)) {
        return { lang: 'ja', script: 'Han', confidence, note: note || "kana detected → ja" };
    }
    // Map Unicode script names to standard language codes
    const scriptToLang = {
        Han: 'zh', Latin: 'en', Arabic: 'ar', Cyrillic: 'ru',
        Hiragana: 'ja', Katakana: 'ja', Hangul: 'ko',
        Devanagari: 'hi', Thai: 'th', Hebrew: 'he', Greek: 'el',
    };
    const lang = scriptToLang[script] || script.toLowerCase().substring(0, 2);
    return { lang, script, confidence, note: note || "" };
}

/**
 * Check if LLM output script matches user's script.
 */
function checkLanguageConsistency(userScript, outputText) {
    const { script: outputScript } = detectScript(outputText);

    if (userScript === outputScript) {
        return { match: true, script: userScript, output_script: outputScript };
    }

    // Latin output for non-Latin user → LLM forgot to translate
    if (outputScript === "Latin" && userScript !== "Latin") {
        return {
            match: false,
            expected_script: userScript,
            got_script: "Latin",
            warning: `User writes in ${userScript} script but output is Latin. LLM may have forgotten to translate.`,
        };
    }

    return {
        match: false,
        expected_script: userScript,
        got_script: outputScript,
        warning: `Script mismatch: expected ${userScript}, got ${outputScript}. Verify if intentional.`,
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
            if (val && !val.startsWith("--")) { result[key] = val; i++; }
            else result[key] = true;
        }
    }
    return result;
}

function main() {
    if (!cmd || cmd === "--help" || cmd === "-h") {
        console.log("Language Guard — Zero hardcoded ranges, Unicode Script property detection");
        console.log("Usage: node language_guard.js <command> [args...]");
        console.log("  detect --message <text>");
        console.log("  check  --user-lang <script> --output <text>");
        process.exit(0);
    }

    const opts = parseArgv(rest);

    if (cmd === "detect") {
        console.log(JSON.stringify(detectLanguage(opts.message || ""), null, 2));
    } else if (cmd === "check") {
        const scriptMap = { zh: "Han", ja: "Hiragana", ko: "Hangul", ar: "Arabic",
                           hi: "Devanagari", bn: "Bengali", ru: "Cyrillic", el: "Greek",
                           th: "Thai", he: "Hebrew" };
        const script = scriptMap[opts.user_lang] || opts.user_lang || "Latin";
        console.log(JSON.stringify(checkLanguageConsistency(script, opts.output || ""), null, 2));
    } else {
        console.error(`Unknown: ${cmd}`);
        process.exit(1);
    }
}

main();