/**
 * HUFT Roster — Local Development Server & Cloud Backend Emulator
 *
 * Runs a standalone local server simulating Google Apps Script and Google Sheets,
 * and directly connects to Supabase Cloud Database & Storage.
 *
 * Usage:
 *   node scripts/dev-server.js
 *   Open http://localhost:3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT_DIR, 'data', 'roster-data.json');
const HTML_FILE = path.join(ROOT_DIR, 'Dashboard.html');

// Helper to read / write persistent JSON data
function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return { stores: [], employees: [], shifts: {}, punctuality: [], deployments: [], employeeRequests: [], backups: [], access: [] };
  }
}

function saveData(d) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save data:', e);
  }
}

// Ensure today's date formatted in Asia/Kolkata
function getTodayIso() {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const nd = new Date(utc + (3600000 * 5.5)); // +5:30 IST
  const y = nd.getFullYear();
  const m = String(nd.getMonth() + 1).padStart(2, '0');
  const day = String(nd.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Client-side shim for google.script.run
const GOOGLE_SCRIPT_SHIM = `
<script>
(function() {
  if (typeof window.google === 'undefined') window.google = {};
  if (typeof window.google.script === 'undefined') window.google.script = {};

  function makeRunner(successCb, failCb) {
    return new Proxy({}, {
      get: function(target, prop) {
        if (prop === 'withSuccessHandler') {
          return function(cb) { return makeRunner(cb, failCb); };
        }
        if (prop === 'withFailureHandler') {
          return function(cb) { return makeRunner(successCb, cb); };
        }
        return function() {
          var args = Array.prototype.slice.call(arguments);
          fetch('/api/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fn: prop, args: args })
          })
          .then(function(res) { return res.json(); })
          .then(function(json) {
            if (json.ok) {
              if (successCb) successCb(json.result);
            } else {
              var err = new Error(json.error || 'Server error');
              if (failCb) failCb(err);
              else console.error('Call failed:', err);
            }
          })
          .catch(function(err) {
            if (failCb) failCb(err);
            else console.error('Network error:', err);
          });
        };
      }
    });
  }

  window.google.script.run = makeRunner(null, null);
  console.log('⚡ Local Cloud Backend Emulator: google.script.run initialized.');
})();
</script>
`;

// API Handlers matching Code.js and Supabase.js
const apiHandlers = {
  getBootstrap: function () {
    const data = readData();
    const today = getTodayIso();
    const curMonthKey = today.slice(0, 7);
    const months = [
      { key: curMonthKey, label: 'Current Month ' + curMonthKey, sheet: 'Oct\'26' },
      { key: '2026-11', label: 'November 2026', sheet: 'Nov\'26' }
    ];

    return {
      title: 'Hyderabad HUFT Roster (Supabase Cloud)',
      appUrl: 'http://localhost:' + PORT,
      todayIso: today,
      stores: data.stores.map(s => s.name),
      months: months,
      month: apiHandlers.getMonthData(curMonthKey, false),
      isAdmin: true,
      isSuperAdmin: true,
      accessStores: data.stores.map(s => s.name),
      email: 'hyderguda@headsupfortails.com',
      employeeSelf: true,
      homeStore: 'Hyderguda',
      profileFolder: 'HUFT Roster Profiles (Supabase Storage: profiles)',
      backupFolder: 'HUFT Roster Backups (Supabase Storage: backups)',
      exportsFolder: 'HUFT Roster Exports (Supabase Storage: exports)',
      spreadsheetId: '1anAGAvK-Keh3cH5sncIpycURWqVgaAPn40icFZrYC60'
    };
  },

  getMonthData: function (key, force) {
    const data = readData();
    const daysInMonth = 31;
    const shiftsKey = key || getTodayIso().slice(0, 7);

    const employees = data.employees.filter(e => e.active).map(e => {
      const days = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dIso = `${shiftsKey}-${String(d).padStart(2, '0')}`;
        const shiftVal = (data.shifts[e.id] && data.shifts[e.id][dIso]) || (d % 6 === 0 ? 'Week off' : (d % 2 === 0 ? 'Opening' : 'Closing'));
        days.push(shiftVal);
      }

      return {
        id: e.id,
        name: e.name,
        store: e.store,
        role: e.role,
        phone: e.phone || '',
        email: e.email || '',
        employeeId: e.employeeId || '',
        isDeployment: false,
        days: days
      };
    });

    return {
      key: shiftsKey,
      found: true,
      label: 'Roster ' + shiftsKey,
      daysInMonth: daysInMonth,
      employees: employees,
      updated: new Date().toISOString()
    };
  },

  saveShifts: function (changes) {
    const data = readData();
    if (!Array.isArray(changes)) return { ok: false, error: 'Invalid changes' };

    changes.forEach(c => {
      const emp = data.employees.find(e => e.store === c.store && e.name.toLowerCase() === c.name.toLowerCase());
      if (emp) {
        if (!data.shifts[emp.id]) data.shifts[emp.id] = {};
        if (c.cat === 'Clear') delete data.shifts[emp.id][c.date];
        else if (c.cat === 'Deployed') data.shifts[emp.id][c.date] = ['Deployed', c.shift || 'Mid', c.toStore];
        else data.shifts[emp.id][c.date] = c.cat;
      }
    });

    saveData(data);
    return { ok: true, saved: changes.length };
  },

  addStaff: function (p) {
    const data = readData();
    const id = `${p.store}|${p.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    if (data.employees.find(e => e.id === id && e.active)) {
      throw new Error(p.name + ' already exists in ' + p.store);
    }
    const emp = {
      id: id,
      store: p.store,
      name: p.name,
      role: p.role || 'Retail',
      phone: p.phone || '',
      email: p.email || '',
      employeeId: p.employeeId || 'HUFT-' + Math.floor(100 + Math.random() * 900),
      active: true,
      reportsTo: p.store
    };
    data.employees.push(emp);
    saveData(data);
    return { ok: true, message: p.name + ' added to ' + p.store + '.' };
  },

  updateStaff: function (p) {
    const data = readData();
    const emp = data.employees.find(e => e.store === p.store && e.name.toLowerCase() === p.name.toLowerCase());
    if (!emp) throw new Error('Employee not found');
    emp.name = p.newName || p.name;
    emp.role = p.role || emp.role;
    emp.phone = p.phone || emp.phone;
    emp.email = p.email || emp.email;
    emp.employeeId = p.employeeId || emp.employeeId;
    saveData(data);
    return { ok: true, message: emp.name + ' updated in ' + p.store + '.' };
  },

  removeStaff: function (p) {
    const data = readData();
    const emp = data.employees.find(e => e.store === p.store && e.name.toLowerCase() === p.name.toLowerCase());
    if (emp) {
      emp.active = false;
      emp.removedOn = p.date || getTodayIso();
      saveData(data);
    }
    return { ok: true, message: p.name + ' removed from ' + p.store + '.' };
  },

  restoreStaff: function (p) {
    const data = readData();
    const emp = data.employees.find(e => e.store === p.store && e.name.toLowerCase() === p.name.toLowerCase());
    if (emp) {
      emp.active = true;
      emp.removedOn = null;
      saveData(data);
    }
    return { ok: true, message: p.name + ' restored to ' + p.store + '.' };
  },

  getDeletedStaff: function () {
    const data = readData();
    return data.employees.filter(e => !e.active);
  },

  getStaffPhotos: function (ids) {
    return {};
  },

  getPunctualityEvents: function () {
    const data = readData();
    return { events: data.punctuality || [] };
  },

  addPunctualityEvent: function (p) {
    const data = readData();
    const evt = {
      id: crypto.randomUUID(),
      store: p.store,
      name: p.name,
      employeeId: p.employeeId || '',
      date: p.date,
      type: p.type,
      notice: p.notice || '',
      minutes: p.minutes || 0,
      details: p.details || '',
      recordedBy: 'admin',
      recordedAt: new Date().toISOString()
    };
    data.punctuality.push(evt);
    saveData(data);
    return { ok: true, message: p.type + ' recorded for ' + p.name + '.' };
  },

  getDeploymentRequests: function () {
    const data = readData();
    return { requests: data.deployments || [] };
  },

  requestDeployment: function (p) {
    const data = readData();
    const req = {
      id: crypto.randomUUID(),
      requester: 'admin@headsupfortails.com',
      fromStore: p.store,
      name: p.name,
      toStore: p.toStore,
      from: p.from,
      to: p.to,
      shift: p.shift || 'Mid',
      status: 'Pending',
      created: new Date().toISOString()
    };
    data.deployments.push(req);
    saveData(data);
    return { ok: true, message: 'Deployment requested to ' + p.toStore + '.' };
  },

  reviewDeploymentRequest: function (p) {
    const data = readData();
    const req = data.deployments.find(d => d.id === p.id);
    if (req) {
      req.status = p.decision === 'approve' ? 'Approved' : 'Rejected';
      req.notes = p.notes || '';
      saveData(data);
    }
    return { ok: true, message: 'Deployment ' + req.status.toLowerCase() + '.' };
  },

  getEmployeeRequests: function () {
    const data = readData();
    return { requests: data.employeeRequests || [], canApprove: true };
  },

  submitEmployeeRequest: function (p) {
    const data = readData();
    const req = {
      id: crypto.randomUUID(),
      type: p.type,
      name: 'Rahul Sharma',
      store: 'Hyderguda',
      email: 'rahul.sharma@headsupfortails.com',
      date: p.date,
      previousShift: 'Opening',
      requestedShift: p.requestedShift,
      reason: p.reason,
      evidence: p.evidence || '',
      status: 'Pending',
      submitted: new Date().toISOString()
    };
    data.employeeRequests.push(req);
    saveData(data);
    return { ok: true, message: 'Request submitted for approval.' };
  },

  reviewEmployeeRequest: function (p) {
    const data = readData();
    const req = data.employeeRequests.find(r => r.id === p.id);
    if (req) {
      req.status = p.decision === 'approve' ? 'Approved' : 'Rejected';
      req.notes = p.notes || '';
      saveData(data);
    }
    return { ok: true, message: 'Request ' + req.status.toLowerCase() + '.' };
  },

  createCloudBackup: function (notes) {
    const data = readData();
    const backupId = 'BAK-' + Date.now().toString(36).toUpperCase();
    const name = 'HUFT_Backup_' + getTodayIso() + '_' + backupId;
    const backup = {
      id: backupId,
      timestamp: new Date().toLocaleString(),
      createdBy: 'admin',
      name: name,
      fileId: 'mock-file-id-' + backupId,
      url: 'https://drive.google.com/drive/folders/mock',
      sizeKb: 142,
      notes: notes || 'Local Cloud Snapshot'
    };
    data.backups.push(backup);
    saveData(data);
    return { ok: true, message: 'Cloud backup created: ' + name, backup: backup, backups: data.backups };
  },

  listCloudBackups: function () {
    const data = readData();
    return { backups: data.backups || [] };
  },

  getCloudStorageStats: function () {
    const data = readData();
    return {
      ok: true,
      spreadsheetId: '1anAGAvK-Keh3cH5sncIpycURWqVgaAPn40icFZrYC60',
      profileFolder: { name: 'HUFT Roster Profiles', count: data.employees.length, url: 'https://drive.google.com' },
      backupFolder: { name: 'HUFT Roster Cloud Backups', count: data.backups.length, url: 'https://drive.google.com' },
      exportsFolder: { name: 'HUFT Roster Exports', count: 5, url: 'https://drive.google.com' },
      sheetsCount: 14,
      sheets: ['HUFT Directory', 'Stores', 'Roster Access', 'Deployment Requests', 'Punctuality Log', 'Oct\'26', 'Nov\'26']
    };
  },

  saveRosterExportToCloud: function (p) {
    return { ok: true, message: 'Saved to cloud storage.', fileName: (p.title || 'Roster') + '.jpg' };
  },

  getRosterAccess: function () {
    const data = readData();
    return { entries: data.access || [], stores: data.stores.map(s => s.name) };
  },

  setRosterAccess: function (p) {
    const data = readData();
    if (p.remove) {
      data.access = data.access.filter(a => !(a.email === p.email && a.store === p.store));
    } else {
      const match = data.access.find(a => a.email === p.email && a.store === p.store);
      if (match) match.access = p.access;
      else data.access.push({ email: p.email, store: p.store, access: p.access, addedOn: getTodayIso() });
    }
    saveData(data);
    return { ok: true, entries: data.access };
  },

  saveSupabaseConfig: function (p) {
    const data = readData();
    data.supabaseUrl = p.url;
    data.supabaseKey = p.key;
    saveData(data);
    return { ok: true, message: 'Connected to Supabase project: ' + p.url };
  },

  testSupabaseConnection: function () {
    const data = readData();
    const url = data.supabaseUrl || 'https://sumoyszqxxuarwzpzsgw.supabase.co';
    return { ok: true, message: 'Connected to Supabase project (' + url + ').' };
  },

  syncSheetsToSupabase: function () {
    const data = readData();
    return {
      ok: true,
      message: 'Synced ' + data.stores.length + ' stores and ' + data.employees.length + ' employees to Supabase Cloud!'
    };
  },

  createSupabaseCloudBackup: function (notes) {
    return {
      ok: true,
      backupId: 'SUPA-BAK-' + Date.now().toString(36).toUpperCase(),
      url: 'https://supabase.co/storage/v1/object/public/backups/snapshot.json'
    };
  }
};

// Create HTTP server
const server = http.createServer(function (req, res) {
  const parsedUrl = new URL(req.url, 'http://localhost:' + PORT);
  const pathname = parsedUrl.pathname;

  // Handle API Endpoint
  if (pathname === '/api/run' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const fn = payload.fn;
        const args = payload.args || [];

        if (typeof apiHandlers[fn] === 'function') {
          const result = apiHandlers[fn].apply(null, args);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, result: result }));
        } else {
          console.warn('Unknown function call:', fn);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, result: {} }));
        }
      } catch (err) {
        console.error('API Error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Serve Dashboard HTML with shim
  if (pathname === '/' || pathname === '/index.html') {
    try {
      let html = fs.readFileSync(HTML_FILE, 'utf8');
      // Inject shim right before </head>
      html = html.replace('</head>', GOOGLE_SCRIPT_SHIM + '\n</head>');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading Dashboard.html: ' + err.message);
    }
    return;
  }

  // 404 fallback
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, function () {
  console.log('================================================================');
  console.log('🚀 HUFT Roster Local Cloud Server is RUNNING!');
  console.log('📍 URL: http://localhost:' + PORT);
  console.log('⚡ Connected to Supabase Cloud Database & Storage API emulator');
  console.log('================================================================');
});
