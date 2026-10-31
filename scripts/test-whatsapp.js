const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
const scriptMatches = html.match(/<script>([\s\S]*?)<\/script>/);
const scriptContent = scriptMatches[1];

const elements = {};
function getOrCreate(id) {
  if (!elements[id]) {
    elements[id] = {
      id: id, tagName: 'DIV', innerHTML: '', textContent: '', value: '',
      style: {}, classList: { add: ()=>{}, remove: ()=>{}, contains: ()=>true },
      setAttribute: ()=>{}, getAttribute: ()=>null, addEventListener: ()=>{},
      appendChild: ()=>{}, querySelector: (s)=>getOrCreate(s), querySelectorAll: ()=>[]
    };
  }
  return elements[id];
}

const sandbox = {
  window: { location: { href: 'https://22chandulalbanoth-cell.github.io/HUFT-Roster-App/' }, addEventListener: ()=>{}, open: (u)=>{ console.log('  [OPEN URL]', u); } },
  document: { addEventListener: ()=>{}, getElementById: (id)=>getOrCreate(id), querySelector: (s)=>getOrCreate(s), querySelectorAll: ()=>[] },
  localStorage: { getItem: ()=>null, setItem: ()=>{}, removeItem: ()=>{} },
  sessionStorage: { getItem: ()=>null, setItem: ()=>{}, removeItem: ()=>{} },
  navigator: { clipboard: { writeText: (t)=>{ console.log('  [CLIPBOARD]', t.slice(0, 40)); return Promise.resolve(); } } },
  console: console, setTimeout: setTimeout, clearTimeout: clearTimeout, alert: (m)=>console.log('ALERT:', m)
};
sandbox.window.document = sandbox.document;
sandbox.window.navigator = sandbox.navigator;
vm.createContext(sandbox);
vm.runInContext(scriptContent, sandbox);

sandbox.currentUser = { email: 'hyderguda@headsupfortails.com', role: 'store_manager', store: 'Hyderguda', name: 'Chandu (Banoth)' };

console.log('--- 1. WEEKLY WHATSAPP STORE BROADCAST PREVIEW ---');
vm.runInContext("openWhatsAppModal('weekly');", sandbox);
console.log(elements['whatsappMessageText'].value);

console.log('\n--- 2. INDIVIDUAL STAFF DAILY SHIFT PREVIEW (Groomer: Tuireising) ---');
vm.runInContext("openWhatsAppModal('individual', 'Hyderguda|tuireising', '2026-10-31');", sandbox);
console.log(elements['whatsappMessageText'].value);

console.log('\n--- 3. INDIVIDUAL STAFF DAILY SHIFT PREVIEW (Retail: Chandu) ---');
vm.runInContext("openWhatsAppModal('individual', 'Hyderguda|chandu', '2026-10-31');", sandbox);
console.log(elements['whatsappMessageText'].value);

console.log('\n--- 4. INDIVIDUAL STAFF WEEKLY SCHEDULE PREVIEW ---');
vm.runInContext("openWhatsAppModal('individual_weekly', 'Hyderguda|tuireising');", sandbox);
console.log(elements['whatsappMessageText'].value);
