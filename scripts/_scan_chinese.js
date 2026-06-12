#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function findChinese(fp) {
    const content = fs.readFileSync(fp, 'utf-8');
    const lines = content.split('\n');
    const results = [];
    for (let i = 0; i < lines.length; i++) {
        if (/[一-鿿]/.test(lines[i])) {
            const t = lines[i].trim().substring(0, 140);
            let cat = 'code';
            if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) cat = 'comment';
            else if (t.includes('console.') || t.includes('log(')) cat = 'log';
            else if (t.includes('"name"') || t.includes("'name'") || t.includes('desc:') || t.includes('label:') || t.includes('question:')) cat = 'culture';
            results.push({ line: i + 1, category: cat, text: t });
        }
    }
    return results;
}

function walk(dir) {
    const all = [];
    for (const f of fs.readdirSync(dir)) {
        const fp = path.join(dir, f);
        if (f.endsWith('.js')) {
            const ch = findChinese(fp);
            if (ch.length > 0) all.push({ file: fp.replace(/\\/g, '/'), lines: ch });
        } else if (fs.statSync(fp).isDirectory() && f !== 'node_modules' && f !== '.git') {
            all.push(...walk(fp));
        }
    }
    return all;
}

const all = walk('scripts');

// Summary stats
let culture = 0, comment = 0, code = 0, log = 0;
for (const f of all) {
    for (const l of f.lines) {
        if (l.category === 'culture') culture++;
        else if (l.category === 'comment') comment++;
        else if (l.category === 'log') log++;
        else code++;
    }
}

console.log('=== 中文分布统计 ===');
console.log('文化数据(可保留): ' + culture);
console.log('注释: ' + comment);
console.log('代码字符串: ' + code);
console.log('日志/输出(需改): ' + log);
console.log('总计: ' + (culture + comment + code + log));
console.log('');

// Per-file
console.log('=== 按文件 (culture/comment/code/log) ===');
for (const f of all.sort((a, b) => b.lines.length - a.lines.length)) {
    let cu = 0, co = 0, cd = 0, lg = 0;
    for (const l of f.lines) {
        if (l.category === 'culture') cu++;
        else if (l.category === 'comment') co++;
        else if (l.category === 'log') lg++;
        else cd++;
    }
    const short = f.file.replace('scripts/', '').replace('mma/', '');
    console.log(short.substring(0, 32).padEnd(34) + 'cu:' + String(cu).padStart(2) + ' co:' + String(co).padStart(2) + ' cd:' + String(cd).padStart(2) + ' lg:' + String(lg).padStart(2) + ' =' + String(f.lines.length).padStart(3));
}

// Detail: log lines only (these need English fix)
console.log('');
console.log('=== 日志/输出中的中文 (需改为英文) ===');
for (const f of all) {
    const logLines = f.lines.filter(l => l.category === 'log');
    if (logLines.length === 0) continue;
    console.log('--- ' + f.file.replace('scripts/', '') + ' ---');
    for (const l of logLines) {
        console.log('  L' + l.line + ': ' + l.text);
    }
}
