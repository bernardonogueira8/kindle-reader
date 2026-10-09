const fs = require('fs');
const old = fs.readFileSync('scratch/old_SettingTab.js', 'utf8');

// Find all method names inside the class
const classBody = old.slice(old.indexOf('{') + 1, old.lastIndexOf('}'));

const lines = old.split('\n');
console.log('Total lines in old_SettingTab.js:', lines.length);

const methodDefs = [];
lines.forEach((l, i) => {
  const m = l.match(/^\s*([A-Za-z0-9_]+)\s*\([^)]*\)\s*\{/);
  if (m) {
    methodDefs.push({ line: i + 1, name: m[1], text: l.trim() });
  }
});

console.log('Method definitions in old_SettingTab.js:');
methodDefs.forEach(m => console.log(`L${m.line}: ${m.text}`));
