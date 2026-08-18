#!/usr/bin/env node
/**
 * Single source of truth for version number.
 * Usage: node scripts/update-version.js <new_version>
 *   e.g. node scripts/update-version.js 1.14.2
 *
 * Updates: version.json, SKILL.md, plugin.json, marketplace.json, pipeline-meta.json, README badges
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VERSION_FILE = path.join(ROOT, 'version.json');

const FILES = [
  { path: 'SKILL.md', pattern: /^(version:\s*)\d+\.\d+\.\d+/m },
  { path: 'SKILL.md', pattern: /Ponder v\d+\.\d+\.\d+/, description: 'header version' },
  { path: 'SKILL.md', pattern: /╚.+v\d+\.\d+\.\d+/, description: 'banner version' },
  { path: '.claude-plugin/plugin.json', pattern: /"version":\s*"\d+\.\d+\.\d+"/ },
  { path: '.claude-plugin/marketplace.json', pattern: /"version":\s*"\d+\.\d+\.\d+"/g },
  { path: 'pipeline-meta.json', pattern: /"version":\s*"\d+\.\d+\.\d+"/ },
  { path: 'README.md', pattern: /badge\/version-\d+\.\d+\.\d+-blue/ },
  { path: 'README_CN.md', pattern: /badge\/版本-\d+\.\d+\.\d+-blue/ },
];

function getCurrentVersion() {
  return JSON.parse(fs.readFileSync(VERSION_FILE, 'utf-8')).version;
}

function updateAllFiles(newVersion) {
  let updated = 0;
  for (const f of FILES) {
    const fp = path.join(ROOT, f.path);
    if (!fs.existsSync(fp)) continue;
    let content = fs.readFileSync(fp, 'utf-8');
    const replacement = typeof f.pattern === 'function' ? f.pattern(content, newVersion) : content.replace(f.pattern, (match) => {
      if (f.path.endsWith('.md')) {
        // README badges: badge/version-X.X.X-blue
        return match.replace(/\d+\.\d+\.\d+/, newVersion);
      }
      // JSON files: "version": "X.X.X"
      return match.replace(/\d+\.\d+\.\d+/, newVersion);
    });
    if (replacement !== content) {
      fs.writeFileSync(fp, replacement, 'utf-8');
      console.log(`✅ ${f.path}`);
      updated++;
    }
  }
  // Update version.json itself
  fs.writeFileSync(VERSION_FILE, JSON.stringify({ version: newVersion }) + '\n', 'utf-8');
  console.log(`✅ version.json`);
  console.log(`\n📦 ${getCurrentVersion()} → ${newVersion} (${updated + 1} files)`);
}

function main() {
  const newVersion = process.argv[2];
  if (!newVersion || !/^\d+\.\d+\.\d+$/.test(newVersion)) {
    console.log(`Current version: ${getCurrentVersion()}`);
    console.log(`Usage: node scripts/update-version.js <semver>`);
    console.log(`   e.g. node scripts/update-version.js 1.14.2`);
    process.exit(1);
  }
  updateAllFiles(newVersion);
}

if (require.main === module) main();
