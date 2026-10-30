const fs = require('fs');
const vm = require('vm');

let content = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const scriptMatches = content.match(/<script[\s\S]*?<\/script>/gi);
const scriptContent = scriptMatches[1].replace(/<\/?script[^>]*>/gi, '');

let domElements = {};
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

const sandbox = {
  window: {
    location: { href: 'https://22chandulalbanoth-cell.github.io/HUFT-Roster-App/' },
    addEventListener: () => {},
    print: () => {}
  },
  document: {
    addEventListener: (ev, fn) => {
      if (ev === 'DOMContentLoaded') {
        sandbox._domLoaded = fn;
      }
    },
    querySelectorAll: (sel) => {
      return [
        { getAttribute: (a) => (a === 'data-tab' ? 'week' : null), setAttribute: () => {}, classList: { toggle: () => {} } },
        { getAttribute: (a) => (a === 'data-tab' ? 'month' : null), setAttribute: () => {}, classList: { toggle: () => {} } },
        { getAttribute: (a) => (a === 'data-tab' ? 'manage' : null), setAttribute: () => {}, classList: { toggle: () => {} } },
        { getAttribute: (a) => (a === 'data-tab' ? 'supabase' : null), setAttribute: () => {}, classList: { toggle: () => {} } }
      ];
    },
    querySelector: (sel) => {
      const id = sel.replace('#', '').replace('.', '');
      return getOrCreate(id);
    },
    getElementById: (id) => getOrCreate(id),
    createElement: (tag) => ({ tagName: tag, style: {}, setAttribute: () => {}, appendChild: () => {}, getContext: () => ({}) })
  },
  localStorage: { getItem: () => null, setItem: () => {} },
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  Blob: class {},
  URL: { createObjectURL: () => 'blob:123' },
  Image: class {}
};
sandbox.window.document = sandbox.document;
sandbox.window.localStorage = sandbox.localStorage;
sandbox.window.console = sandbox.console;
sandbox.window.setTimeout = sandbox.setTimeout;
sandbox.window.clearTimeout = sandbox.clearTimeout;
sandbox.window.Blob = sandbox.Blob;
sandbox.window.URL = sandbox.URL;
sandbox.window.Image = sandbox.Image;

vm.createContext(sandbox);
vm.runInContext(scriptContent, sandbox);

console.log('DOM Content Loaded registered:', !!sandbox._domLoaded);
sandbox._domLoaded();

setTimeout(async () => {
  const tabs = ['week', 'month', 'overview', 'manage', 'removed', 'wa', 'deployments', 'myrequests', 'approvals', 'notifications', 'request', 'access', 'email', 'cloud', 'supabase'];
  console.log('Testing all tabs:');
  for (const t of tabs) {
    try {
      vm.runInContext("window.switchTab('" + t + "');", sandbox);
      console.log('  Tab [' + t + ']: OK (content length: ' + domElements['content'].innerHTML.length + ')');
    } catch(e) {
      console.error('  Tab [' + t + ']: FAILED', e.message);
    }
  }
}, 500);
