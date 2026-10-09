const fs = require('fs');
const old = fs.readFileSync('scratch/old_SettingTab.js', 'utf8');
const cur = fs.readFileSync('src/ui/SettingsTab.ts', 'utf8');

// Load i18n
const i18nRaw = fs.readFileSync('src/utils/i18n.ts', 'utf8');
const enMatches = i18nRaw.matchAll(/"([^"]+)":\s*"([^"]+)"/g);
const ruToEn = new Map();
for (const m of enMatches) {
  ruToEn.set(m[1], m[2]);
}

function extractSettings(text) {
  const list = [];
  const re = /setName\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    let raw = m[1].trim();
    // if raw is __ertr("something")
    const ertrM = raw.match(/__ertr\(\s*"(.*?)"/);
    if (ertrM) {
      const s = ertrM[1].replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
      list.push(ruToEn.get(s) || s);
    } else {
      list.push(raw);
    }
  }
  return list;
}

const oldList = extractSettings(old);
const curList = extractSettings(cur);

console.log('OLD count:', oldList.length);
console.log('CUR count:', curList.length);

console.log('\n--- Settings in OLD: ---');
oldList.forEach((s, i) => console.log(`${i+1}. ${s}`));

console.log('\n--- Settings in CUR: ---');
curList.forEach((s, i) => console.log(`${i+1}. ${s}`));

console.log('\n--- In OLD but NOT in CUR: ---');
const curSet = new Set(curList);
oldList.forEach(s => {
  if (!curSet.has(s)) console.log('MISSING: ' + s);
});
