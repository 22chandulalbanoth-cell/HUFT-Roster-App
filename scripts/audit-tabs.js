const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scriptIdx = html.indexOf('<script>');
const scriptContent = html.slice(scriptIdx);
const htmlContent = html.slice(0, scriptIdx);

// Find all event handlers in HTML
const regex = /on(?:click|submit|change|input)="([a-zA-Z0-9_]+)\s*\(/g;
let m;
const called = new Set();
while ((m = regex.exec(htmlContent)) !== null) {
  called.add(m[1]);
}

console.log('Total HTML event functions detected:', called.size);

const missing = [];
for (const f of called) {
  const hasFn = scriptContent.includes('function ' + f) || 
                scriptContent.includes(f + ' =') || 
                scriptContent.includes(f + '=') || 
                scriptContent.includes('window.' + f);
  if (!hasFn) {
    missing.push(f);
  }
}

console.log('\nMISSING FUNCTIONS IN SCRIPT:');
missing.forEach(fn => console.log('  ❌', fn));

// Check tab panes vs switchTab
console.log('\n--- TAB PANES DEFINED IN HTML ---');
const paneMatches = html.match(/id="tab-([a-zA-Z0-9_-]+)"/g) || [];
const paneIds = paneMatches.map(m => m.replace('id="tab-', '').replace('"', ''));
paneIds.forEach(id => console.log('  Tab Pane:', id));

console.log('\n--- SWITCHTAB HANDLERS IN SCRIPT ---');
paneIds.forEach(id => {
  const handled = scriptContent.includes(`tabId === '${id}'`) || 
                  scriptContent.includes(`tabId === "${id}"`) ||
                  scriptContent.includes(`'tab-${id}'`);
  console.log('  Tab [' + id + ']:', handled ? '✅ Handled' : '⚠️ No custom render call (only pane active toggled)');
});
