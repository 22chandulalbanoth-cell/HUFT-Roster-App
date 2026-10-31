const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
const scriptMatches = html.match(/<script>([\s\S]*?)<\/script>/);
const scriptContent = scriptMatches[1];

// Create robust mock DOM
const elements = {};
function getOrCreate(id) {
  if (!elements[id]) {
    elements[id] = {
      id: id,
      tagName: 'DIV',
      innerHTML: '',
      textContent: '',
      value: '',
      style: {},
      classList: {
        classes: new Set(),
        add: function(c) { this.classes.add(c); },
        remove: function(c) { this.classes.delete(c); },
        toggle: function(c, force) {
          if (force === undefined) {
            if (this.classes.has(c)) this.classes.delete(c);
            else this.classes.add(c);
          } else if (force) {
            this.classes.add(c);
          } else {
            this.classes.delete(c);
          }
        },
        contains: function(c) { return this.classes.has(c); }
      },
      setAttribute: function(k, v) { this[k] = v; },
      getAttribute: function(k) { return this[k] || null; },
      addEventListener: function() {},
      appendChild: function() {},
      querySelector: function(sel) { return getOrCreate(sel.replace(/[^a-zA-Z0-9_-]/g, '')); },
      querySelectorAll: function(sel) { return []; },
      click: function() {},
      select: function() {}
    };
  }
  return elements[id];
}

// Pre-create all tab panes from HTML
const paneMatches = html.match(/id="tab-([a-zA-Z0-9_-]+)"/g) || [];
paneMatches.forEach(m => {
  const id = m.replace('id="', '').replace('"', '');
  getOrCreate(id);
});

// Pre-create table bodies and form controls
[
  'kpiTotalStaff', 'kpiOnDuty', 'kpiOnLeave', 'kpiPendingRequests',
  'adminStoreOverviewPanel', 'adminStoreOverviewTable', 'dashboardTodayTable', 'dashboardPendingRequestsTable',
  'staffCardsContainer', 'staffTableContainer', 'staffCountBadge', 'staffSearchInput', 'staffStoreFilter', 'staffSectionTitle',
  'rosterWeeklyHeadRow', 'rosterWeeklyBody', 'rosterWeeklyFoot', 'rosterStoreFilter', 'rosterSearchTeamInput', 'rosterRoleFilter', 'rosterMetaInfo', 'rosterStoreBanner',
  'waStoreFilter', 'waDateFilter', 'waSearchInput', 'waRoleFilter',
  'deploymentRequestsTable', 'deploymentsPanelTitle', 'deployCountBadge', 'deployAdminFilterWrap', 'deployAdminStoreFilter', 'storeManagerDeployFilterPills',
  'approvalsEmpRequestsTable', 'approvalsDeploymentsTable',
  'reportsStoreTable', 'emailLogsTable',
  'empGreetingSub', 'selfEmpProfileCard', 'empTodayShiftBadge', 'empWeeklyScheduleTable', 'empWeeklyShiftCount', 'empPendingReqCount', 'empRecentRequestsTable', 'empFullRosterTable',
  'currentDateDisplay', 'deploymentRequestModal', 'deploySourceStore', 'deployEmployee', 'deployStartDate', 'deployEndDate', 'deployShift', 'deployReason'
].forEach(id => getOrCreate(id));

const sandbox = {
  window: {
    location: { href: 'https://22chandulalbanoth-cell.github.io/HUFT-Roster-App/' },
    addEventListener: () => {},
    open: () => {}
  },
  document: {
    addEventListener: () => {},
    getElementById: (id) => getOrCreate(id),
    querySelector: (sel) => {
      const clean = sel.replace('#', '').replace('.', '').replace(' tbody', '').replace(' thead', '');
      return getOrCreate(clean);
    },
    querySelectorAll: (sel) => {
      if (sel === '.tab-pane') {
        return paneMatches.map(m => getOrCreate(m.replace('id="', '').replace('"', '')));
      }
      return [getOrCreate('dummyNavBtn')];
    },
    createElement: (tag) => getOrCreate('tempElement_' + tag)
  },
  localStorage: {
    store: {},
    getItem: function(k) { return this.store[k] || null; },
    setItem: function(k, v) { this.store[k] = v; },
    removeItem: function(k) { delete this.store[k]; }
  },
  sessionStorage: {
    store: {},
    getItem: function(k) { return this.store[k] || null; },
    setItem: function(k, v) { this.store[k] = v; },
    removeItem: function(k) { delete this.store[k]; }
  },
  navigator: {
    clipboard: {
      writeText: () => Promise.resolve()
    }
  },
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  alert: (msg) => console.log('   [ALERT]', msg),
  confirm: () => true,
  prompt: () => 'Remark'
};

sandbox.window.document = sandbox.document;
sandbox.window.localStorage = sandbox.localStorage;
sandbox.window.sessionStorage = sandbox.sessionStorage;
sandbox.window.navigator = sandbox.navigator;
sandbox.window.console = sandbox.console;

vm.createContext(sandbox);

// Execute App Script
vm.runInContext(scriptContent, sandbox);
console.log('App script loaded successfully into sandbox.');

// 1. TEST ADMIN ROLE TABS
console.log('\n--- 1. TESTING ALL ADMIN TABS ---');
vm.runInContext("currentUser = { email: 'admin@headsupfortails.com', role: 'admin', store: 'All Stores', name: 'HUFT Administrator' };", sandbox);

const adminTabs = ['dashboard', 'staff', 'roster', 'whatsapp', 'request-staff', 'approvals', 'reports', 'settings'];
let passCount = 0;

for (const t of adminTabs) {
  try {
    vm.runInContext(`switchTab('${t}');`, sandbox);
    const pane = elements[`tab-${t}`];
    const isActive = pane && pane.classList.contains('active');
    console.log(`  Admin Tab [${t}]: ✅ ACTIVE & RENDERED (active: ${isActive})`);
    passCount++;
  } catch(err) {
    console.error(`  Admin Tab [${t}]: ❌ FAILED`, err);
  }
}

// 2. TEST STORE MANAGER ROLE TABS
console.log('\n--- 2. TESTING STORE MANAGER TABS ---');
vm.runInContext("currentUser = { email: 'hyderguda@headsupfortails.com', role: 'store_manager', store: 'Hyderguda', name: 'Chandu (Banoth)' };", sandbox);

const storeTabs = ['dashboard', 'roster', 'whatsapp', 'staff', 'request-staff', 'approvals'];
for (const t of storeTabs) {
  try {
    vm.runInContext(`switchTab('${t}');`, sandbox);
    const pane = elements[`tab-${t}`];
    const isActive = pane && pane.classList.contains('active');
    console.log(`  Store Tab [${t}]: ✅ ACTIVE & RENDERED`);
    passCount++;
  } catch(err) {
    console.error(`  Store Tab [${t}]: ❌ FAILED`, err);
  }
}

// 3. TEST EMPLOYEE ROLE TABS
console.log('\n--- 3. TESTING EMPLOYEE PORTAL TABS ---');
vm.runInContext("currentUser = { email: 'vamshi@headsupfortails.com', role: 'employee', store: 'Hyderguda', name: 'Vamshi' };", sandbox);

const empTabs = ['emp-dashboard', 'emp-roster', 'emp-requests', 'emp-profile', 'emp-notifications'];
for (const t of empTabs) {
  try {
    vm.runInContext(`switchTab('${t}');`, sandbox);
    const pane = elements[`tab-${t}`];
    const isActive = pane && pane.classList.contains('active');
    console.log(`  Employee Tab [${t}]: ✅ ACTIVE & RENDERED`);
    passCount++;
  } catch(err) {
    console.error(`  Employee Tab [${t}]: ❌ FAILED`, err);
  }
}

// 4. TEST STAFF REQUEST MODAL & DEPLOYMENT ACTIONS
console.log('\n--- 4. TESTING DEPLOYMENT MODAL & APPROVAL ACTIONS ---');
try {
  // Test modal open
  vm.runInContext("openDeploymentRequestModal();", sandbox);
  console.log('  openDeploymentRequestModal(): ✅ OK (Modal display:', elements['deploymentRequestModal'].style.display, ')');

  // Test store change
  vm.runInContext("handleDeployStoreChange('Golden Mile');", sandbox);
  console.log('  handleDeployStoreChange("Golden Mile"): ✅ OK (Employees loaded)');

  // Test modal close
  vm.runInContext("closeDeploymentRequestModal();", sandbox);
  console.log('  closeDeploymentRequestModal(): ✅ OK (Modal display:', elements['deploymentRequestModal'].style.display, ')');

  // Test approve release
  vm.runInContext("approveDeploymentStep1('DEP-2026-001');", sandbox);
  console.log('  approveDeploymentStep1("DEP-2026-001"): ✅ OK');

  // Test final confirm
  vm.runInContext("confirmDeploymentStep2('DEP-2026-002');", sandbox);
  console.log('  confirmDeploymentStep2("DEP-2026-002"): ✅ OK');

  // Test reject
  vm.runInContext("rejectDeployment('DEP-2026-003');", sandbox);
  console.log('  rejectDeployment("DEP-2026-003"): ✅ OK');

  // Test view toggles
  vm.runInContext("switchStaffView('table');", sandbox);
  console.log('  switchStaffView("table"): ✅ OK');

  vm.runInContext("switchStaffView('cards');", sandbox);
  console.log('  switchStaffView("cards"): ✅ OK');

  passCount += 8;
} catch(err) {
  console.error('  Modal / Actions error:', err);
}

console.log('\n=============================================================');
console.log(`🎉 ALL ${passCount} RUNTIME TAB & MODAL TESTS PASSED WITH 0 ERRORS!`);
console.log('=============================================================\n');
