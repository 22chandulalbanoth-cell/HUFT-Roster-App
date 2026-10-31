const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scriptMatches = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatches) {
  console.error('No inline script found in index.html');
  process.exit(1);
}
const scriptContent = scriptMatches[1];

const dbJsContent = fs.readFileSync(path.join(__dirname, '..', 'data', 'roster-db.js'), 'utf8');

// Mock DOM
const domElements = {};
function getOrCreate(id) {
  if (!domElements[id]) {
    domElements[id] = {
      id: id,
      innerHTML: '',
      textContent: '',
      value: '',
      style: {},
      classList: {
        add: () => {},
        remove: () => {},
        toggle: () => {},
        contains: () => false
      },
      setAttribute: () => {},
      getAttribute: () => null,
      addEventListener: () => {},
      appendChild: () => {}
    };
  }
  return domElements[id];
}

const domListeners = [];
const sandbox = {
  window: {
    location: { href: 'https://22chandulalbanoth-cell.github.io/HUFT-Roster-App/' },
    addEventListener: () => {},
    print: () => {}
  },
  document: {
    addEventListener: (ev, fn) => {
      if (ev === 'DOMContentLoaded') {
        domListeners.push(fn);
      }
    },
    querySelectorAll: (sel) => {
      return [
        { getAttribute: (a) => (a === 'data-tab' ? 'week' : null), setAttribute: () => {}, classList: { toggle: () => {} } },
        { getAttribute: (a) => (a === 'data-tab' ? 'month' : null), setAttribute: () => {}, classList: { toggle: () => {} } },
        { getAttribute: (a) => (a === 'data-tab' ? 'manage' : null), setAttribute: () => {}, classList: { toggle: () => {} } },
        { getAttribute: (a) => (a === 'data-tab' ? 'supabase' : null), setAttribute: () => {}, classList: { toggle: () => {} } },
        { getAttribute: (a) => (a === 'data-tab' ? 'adminApproval' : null), setAttribute: () => {}, classList: { toggle: () => {} } }
      ];
    },
    querySelector: (sel) => {
      const id = sel.replace('#', '').replace('.', '');
      return getOrCreate(id);
    },
    getElementById: (id) => getOrCreate(id)
  },
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  },
  sessionStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  },
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: () => {},
  clearInterval: () => {},
  Blob: class {},
  URL: { createObjectURL: () => 'blob:123' },
  Image: class {}
};
sandbox.window.document = sandbox.document;
sandbox.window.localStorage = sandbox.localStorage;
sandbox.window.sessionStorage = sandbox.sessionStorage;
sandbox.window.console = sandbox.console;
sandbox.window.setTimeout = sandbox.setTimeout;
sandbox.window.clearTimeout = sandbox.clearTimeout;
sandbox.window.Blob = sandbox.Blob;
sandbox.window.URL = sandbox.URL;
sandbox.window.Image = sandbox.Image;

vm.createContext(sandbox);

// Load DB
vm.runInContext(dbJsContent, sandbox);
console.log('Database loaded in sandbox:', Object.keys(sandbox.window.HUFT_DB || {}));

// Run application script
vm.runInContext(scriptContent, sandbox);

console.log('DOM Content Loaded listeners registered:', domListeners.length);
domListeners.forEach(fn => fn());

setTimeout(async () => {
  const tabs = [
    'week', 'month', 'overview', 'manage', 'removed', 'wa', 
    'deployments', 'myrequests', 'approvals', 'notifications', 
    'request', 'access', 'email', 'cloud', 'supabase', 'adminApproval'
  ];
  console.log('\n--- TESTING ALL TABS RENDERING ---');
  let passCount = 0;
  for (const t of tabs) {
    try {
      vm.runInContext("window.switchTab('" + t + "');", sandbox);
      const len = (domElements['content'] && domElements['content'].innerHTML) ? domElements['content'].innerHTML.length : 0;
      console.log('  Tab [' + t + ']: ✅ OK (content length: ' + len + ')');
      passCount++;
    } catch(e) {
      console.error('  Tab [' + t + ']: ❌ FAILED', e.message);
    }
  }

  console.log('\nTesting Admin Approval Subtabs:');
  const subtabs = ['requests', 'stores', 'security', 'settings'];
  for (const s of subtabs) {
    try {
      vm.runInContext("window.switchAdminSubTab('" + s + "');", sandbox);
      const len = domElements['content'].innerHTML.length;
      console.log('  Admin Subtab [' + s + ']: ✅ OK (content length: ' + len + ')');
      passCount++;
    } catch(e) {
      console.error('  Admin Subtab [' + s + ']: ❌ FAILED', e.message);
    }
  }

  console.log('\n======================================');
  console.log('🎉 TOTAL PASSING VIEWS: ' + passCount + ' / ' + (tabs.length + subtabs.length));
  console.log('======================================\n');
}, 500);
