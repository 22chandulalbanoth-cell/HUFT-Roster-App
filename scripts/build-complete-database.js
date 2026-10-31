const fs = require('fs');
const path = require('path');

const parsed = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/parsed-raw-sheets.json'), 'utf8'));

function normStore(s) {
  if (!s) return '';
  s = String(s).trim();
  const lower = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (lower.includes('hyderguda')) return 'Hyderguda';
  if (lower.includes('golden')) return 'Golden Mile';
  if (lower.includes('banjara')) return 'Banjara Hills';
  if (lower.includes('nallagan')) return 'Nallagandla';
  if (lower.includes('madhapur')) return 'Madhapur';
  return s;
}

function excelDateToIso(val) {
  if (!val) return '';
  if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) return val;
  const num = parseFloat(val);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const utc_days = Math.floor(num - 25569);
    const date = new Date(utc_days * 86400 * 1000);
    return date.toISOString().slice(0, 10);
  }
  return '';
}

function excelTimestampToIso(val) {
  if (!val) return '';
  if (typeof val === 'string' && val.includes(':')) return val;
  const num = parseFloat(val);
  if (!isNaN(num) && num > 30000) {
    const ms = Math.round((num - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return d.toISOString().replace('T', ' ').slice(0, 19);
  }
  return String(val);
}

// 1. STORES
const stores = [
  { name: 'Hyderguda', active: true, location: 'Hyderguda Main Road', manager: 'Chandu', managerEmail: 'hyderguda@headsupfortails.com' },
  { name: 'Golden Mile', active: true, location: 'Golden Mile Business Park, Kokapet', manager: 'Mayangam', managerEmail: 'golden.mile@headsupfortails.com' },
  { name: 'Banjara Hills', active: true, location: 'Road No. 12, Banjara Hills', manager: 'William', managerEmail: 'banjarahills@headsupfortails.com' },
  { name: 'Nallagandla', active: true, location: 'Aparna Sarovar Grande Road', manager: 'Lokesh', managerEmail: 'nallagandla@headsupfortails.com' },
  { name: 'Madhapur', active: true, location: 'Hitech City Road, Madhapur', manager: 'Kamal Kumar', managerEmail: 'madhapur@headsupfortails.com' }
];

// 2. EMPLOYEES FROM HUFT DIRECTORY
const dirRows = parsed['HUFT Directory'] || [];
const employees = [];
const empLookup = {};

for (let i = 1; i < dirRows.length; i++) {
  const r = dirRows[i];
  if (!r || !r[1]) continue;
  const store = normStore(r[0]) || 'Hyderguda';
  const name = String(r[1]).trim();
  if (!name || name.toLowerCase() === 'employee') continue;
  const role = String(r[2] || 'Retail').trim();
  const phone = String(r[3] || '').trim().replace(/\.0$/, '');
  const activeVal = String(r[4] || '').toLowerCase();
  const active = activeVal === 'false' || activeVal === '0' ? false : true;
  const reportingTo = String(r[5] || store).trim();
  const removedOn = String(r[6] || '').trim();
  const photoId = String(r[7] || '').trim();
  const email = String(r[8] || '').trim();
  const employeeId = String(r[9] || '').trim() || ('EPPL' + (1000 + i));

  const empKey = `${store}|${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  const empObj = {
    id: empKey,
    name,
    store,
    role,
    phone,
    email: email || `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@headsupfortails.com`,
    employeeId,
    active,
    reportsTo: reportingTo,
    removedOn: removedOn || null,
    profilePhotoId: photoId || null
  };
  employees.push(empObj);
  empLookup[empKey] = empObj;
  if (!empLookup[name.toLowerCase()]) empLookup[name.toLowerCase()] = empObj;
}

// Check Roster - Permanent & Roster - Removed
const permRows = parsed['Roster - Permanent'] || [];
for (let i = 1; i < permRows.length; i++) {
  const r = permRows[i];
  if (!r || !r[1]) continue;
  const empId = String(r[0] || '').trim();
  const name = String(r[1] || '').trim();
  const role = String(r[2] || '').trim();
  const store = normStore(r[3] || '');
  const status = String(r[4] || '').trim();
  const key = `${store}|${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  if (!empLookup[key] && !empLookup[name.toLowerCase()]) {
    const empObj = {
      id: key,
      name,
      store: store || 'Hyderguda',
      role: role || 'Retail',
      employeeId: empId,
      active: status.toLowerCase() === 'active',
      reportsTo: store || 'Hyderguda'
    };
    employees.push(empObj);
    empLookup[key] = empObj;
  }
}

console.log(`Master Staff Directory Count: ${employees.length}`);

// 3. SHIFTS
const monthSheets = [
  { sheet: 'Feb26', monthKey: '2026-02', label: 'February 2026' },
  { sheet: 'March26', monthKey: '2026-03', label: 'March 2026' },
  { sheet: 'April26', monthKey: '2026-04', label: 'April 2026' },
  { sheet: 'May26', monthKey: '2026-05', label: 'May 2026' },
  { sheet: 'Jun26', monthKey: '2026-06', label: 'June 2026' },
  { sheet: 'July26', monthKey: '2026-07', label: 'July 2026' },
  { sheet: 'Aug26', monthKey: '2026-08', label: 'August 2026' },
  { sheet: 'Sep26', monthKey: '2026-09', label: 'September 2026' },
  { sheet: 'Oct26', monthKey: '2026-10', label: 'October 2026' },
  { sheet: 'Nov26', monthKey: '2026-11', label: 'November 2026' }
];

const shiftsMap = {};
const allShiftsArray = [];

for (const mInfo of monthSheets) {
  const rows = parsed[mInfo.sheet] || [];
  if (!rows.length) continue;

  let dateRowIdx = -1;
  for (let r = 0; r < Math.min(10, rows.length); r++) {
    if ((rows[r] || []).some(c => c && String(c).toLowerCase().trim() === 'date')) {
      dateRowIdx = r;
      break;
    }
  }
  if (dateRowIdx < 0) continue;

  const dateCols = [];
  const dRow = rows[dateRowIdx];
  for (let c = 2; c < dRow.length; c++) {
    const iso = excelDateToIso(dRow[c]);
    if (iso && iso.startsWith('2026-')) {
      dateCols.push({ col: c, date: iso });
    }
  }

  let currentStore = 'Hyderguda';
  let currentRole = 'Retail';

  for (let r = dateRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const col0 = (row[0] || '').trim();
    const col1 = (row[1] || '').trim();

    if (col0 && normStore(col0)) {
      currentStore = normStore(col0);
    }
    if (col1 && (col1.toLowerCase() === 'retail' || col1.toLowerCase() === 'groomers' || col1.toLowerCase() === 'grooming')) {
      currentRole = col1.toLowerCase().includes('groom') ? 'Grooming' : 'Retail';
      continue;
    }
    if (!col1 || col1.toLowerCase() === 'date' || col1.toLowerCase() === 'day' || col1.toLowerCase() === 'store') continue;
    if (col1.startsWith('👥') || col1.startsWith('❌') || col1.startsWith('📍') || col1.includes('Error:')) continue;

    let empName = col1;
    let empStore = currentStore;
    if (normStore(col0) && col1) {
      empStore = normStore(col0);
      empName = col1;
    }

    let empKey = `${empStore}|${empName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    let empObj = empLookup[empKey] || empLookup[empName.toLowerCase()];
    if (!empObj) {
      empObj = {
        id: empKey,
        name: empName,
        store: empStore,
        role: currentRole,
        active: true
      };
      employees.push(empObj);
      empLookup[empKey] = empObj;
    }

    for (const dCol of dateCols) {
      let shiftVal = (row[dCol.col] || '').trim();
      if (!shiftVal) continue;

      if (shiftVal === 'Mid Shift' || shiftVal === 'Mid Shift ') shiftVal = 'Mid Shift';
      if (shiftVal === 'Compoff' || shiftVal === 'Comp off') shiftVal = 'Comp off';
      if (shiftVal === 'Week off' || shiftVal === 'weakoff' || shiftVal === 'Week Off') shiftVal = 'Week off';
      if (shiftVal === 'SPA Timings' || shiftVal === 'Spa') shiftVal = 'SPA Timings';

      const sKey = `${empObj.id}|${dCol.date}`;
      shiftsMap[sKey] = shiftVal;
      allShiftsArray.push({
        employee_id: empObj.id,
        employee_name: empObj.name,
        employee_code: empObj.employeeId,
        store: empStore,
        date: dCol.date,
        shift: shiftVal
      });
    }
  }
}

console.log(`Total Shifts: ${allShiftsArray.length}`);

// 4. DEPLOYMENT REQUESTS
const depRows = parsed['Deployment Requests'] || [];
const deploymentRequests = [];
for (let i = 1; i < depRows.length; i++) {
  const r = depRows[i];
  if (!r || !r[0] || !r[3]) continue;
  deploymentRequests.push({
    id: String(r[0]).trim(),
    requester: String(r[1] || '').trim(),
    fromStore: normStore(r[2]),
    name: String(r[3]).trim(),
    toStore: normStore(r[4]),
    from: String(r[5] || '').trim(),
    to: String(r[6] || '').trim(),
    shift: String(r[7] || '').trim() || 'Opening',
    status: String(r[8] || 'Pending').trim(),
    createdAt: excelTimestampToIso(r[9]),
    decidedBy: String(r[10] || '').trim(),
    decidedAt: excelTimestampToIso(r[11]),
    notes: String(r[12] || '').trim()
  });
}
console.log(`Deployment Requests: ${deploymentRequests.length}`);

// 5. HUFT AUDIT LOG
const auditRows = parsed['HUFT Audit Log'] || [];
const auditLogs = [];
for (let i = 1; i < auditRows.length; i++) {
  const r = auditRows[i];
  if (!r || !r[0] || !r[2]) continue;
  auditLogs.push({
    timestamp: excelTimestampToIso(r[0]),
    actor: String(r[1] || '').trim(),
    action: String(r[2] || '').trim(),
    entityType: String(r[3] || '').trim(),
    entityId: String(r[4] || '').trim(),
    store: normStore(r[5]),
    previousValue: r[6] ? String(r[6]).trim() : null,
    newValue: r[7] ? String(r[7]).trim() : null,
    result: String(r[8] || 'Success').trim(),
    workflow: String(r[9] || '').trim(),
    correlationId: String(r[10] || '').trim()
  });
}
console.log(`Audit Logs: ${auditLogs.length}`);

// 6. EMAIL TEMPLATES
const tmplRows = parsed['Email Templates'] || [];
const emailTemplates = [];
for (let i = 1; i < tmplRows.length; i++) {
  const r = tmplRows[i];
  if (!r || !r[0]) continue;
  const enabledStr = String(r[1] || '').toLowerCase();
  emailTemplates.push({
    id: String(r[0]).trim(),
    enabled: enabledStr === 'true' || enabledStr === '1',
    subject: String(r[2] || '').trim(),
    message: String(r[3] || '').trim(),
    updatedAt: excelTimestampToIso(r[4]),
    updatedBy: String(r[5] || 'system default').trim(),
    name: String(r[6] || r[0]).trim()
  });
}
console.log(`Email Templates: ${emailTemplates.length}`);

// 7. EMAIL RECIPIENTS
const recipRows = parsed['Email Recipients'] || [];
const emailRecipients = [];
for (let i = 1; i < recipRows.length; i++) {
  const r = recipRows[i];
  if (!r || !r[0] || !r[1]) continue;
  emailRecipients.push({
    store: normStore(r[0]),
    email: String(r[1]).trim(),
    updatedAt: excelTimestampToIso(r[2]),
    updatedBy: String(r[3] || 'system default').trim()
  });
}
console.log(`Email Recipients: ${emailRecipients.length}`);

// 8. EMAIL DELIVERIES
const delivRows = parsed['Email Delivery Log'] || [];
const emailDeliveries = [];
for (let i = 1; i < delivRows.length; i++) {
  const r = delivRows[i];
  if (!r || !r[0]) continue;
  emailDeliveries.push({
    id: String(r[0]).trim(),
    templateId: String(r[1] || '').trim(),
    referenceId: String(r[2] || '').trim(),
    recipient: String(r[3] || '').trim(),
    subject: String(r[4] || '').trim(),
    status: String(r[5] || 'Sent').trim(),
    attempts: parseInt(r[6], 10) || 1,
    updatedAt: excelTimestampToIso(r[7]),
    error: r[8] ? String(r[8]).trim() : null,
    cc: r[9] ? String(r[9]).trim() : null
  });
}
console.log(`Email Deliveries: ${emailDeliveries.length}`);

// 9. ROSTER ACCESS
const accessRows = parsed['Roster Access'] || [];
const rosterAccess = [];
for (let i = 1; i < accessRows.length; i++) {
  const r = accessRows[i];
  if (!r || !r[0]) continue;
  rosterAccess.push({
    email: String(r[0]).trim(),
    store: normStore(r[1]),
    access: String(r[2] || 'Editor').trim(),
    addedOn: excelDateToIso(r[3]) || String(r[3] || '2026-01-01').trim()
  });
}
console.log(`Roster Access Grants: ${rosterAccess.length}`);

// Build complete data object
const completeData = {
  stores,
  employees,
  months: monthSheets.map(m => ({
    key: m.monthKey,
    label: m.label,
    sheet: m.sheet
  })),
  shifts: shiftsMap,
  deployments: deploymentRequests,
  auditLogs,
  emailTemplates,
  emailRecipients,
  emailDeliveries,
  access: rosterAccess,
  stats: {
    totalStores: stores.length,
    totalEmployees: employees.length,
    totalShifts: allShiftsArray.length,
    totalDeployments: deploymentRequests.length,
    totalAuditLogs: auditLogs.length,
    totalTemplates: emailTemplates.length
  }
};

fs.writeFileSync(path.resolve(__dirname, '../data/roster-data.json'), JSON.stringify(completeData, null, 2), 'utf8');
console.log('\nSUCCESS! Generated data/roster-data.json');

// Also generate SQL seed file for Supabase
console.log('Generating supabase/seed.sql...');
const sqlLines = [];

sqlLines.push('-- ========================================================');
sqlLines.push('-- HUFT ROSTER COMPLETE HISTORICAL DATABASE SEED');
sqlLines.push('-- Generated from Excel Workbook Reference');
sqlLines.push('-- ========================================================\n');

// Stores
sqlLines.push('-- 1. Stores');
for (const s of stores) {
  sqlLines.push(`INSERT INTO public.stores (name, code, active, location, manager, manager_email) VALUES ('${s.name.replace(/'/g, "''")}', '${s.name.toUpperCase().replace(/[^A-Z0-9]/g, '-')}', ${s.active}, '${s.location.replace(/'/g, "''")}', '${s.manager.replace(/'/g, "''")}', '${s.managerEmail.replace(/'/g, "''")}') ON CONFLICT (name) DO UPDATE SET active = EXCLUDED.active, location = EXCLUDED.location, manager = EXCLUDED.manager, manager_email = EXCLUDED.manager_email;`);
}
sqlLines.push('');

// Employees
sqlLines.push('-- 2. Employees');
for (const e of employees) {
  const photo = e.profilePhotoId ? `'${e.profilePhotoId}'` : 'NULL';
  const rem = e.removedOn ? `'${e.removedOn}'` : 'NULL';
  sqlLines.push(`INSERT INTO public.employees (id, employee_id, name, store, role, phone, email, active, reports_to, removed_on, profile_photo_id) VALUES ('${e.id.replace(/'/g, "''")}', '${(e.employeeId||'').replace(/'/g, "''")}', '${e.name.replace(/'/g, "''")}', '${e.store.replace(/'/g, "''")}', '${e.role.replace(/'/g, "''")}', '${(e.phone||'').replace(/'/g, "''")}', '${(e.email||'').replace(/'/g, "''")}', ${e.active}, '${(e.reportsTo||'').replace(/'/g, "''")}', ${rem}, ${photo}) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, store = EXCLUDED.store, role = EXCLUDED.role, phone = EXCLUDED.phone, email = EXCLUDED.email, active = EXCLUDED.active, reports_to = EXCLUDED.reports_to, removed_on = EXCLUDED.removed_on, profile_photo_id = EXCLUDED.profile_photo_id;`);
}
sqlLines.push('');

// Deployments
sqlLines.push('-- 3. Deployment Requests');
for (const d of deploymentRequests) {
  const notes = d.notes ? `'${d.notes.replace(/'/g, "''")}'` : 'NULL';
  sqlLines.push(`INSERT INTO public.deployment_requests (id, request_id, employee_id, employee_name, from_store, to_store, from_date, to_date, shift, status, requested_by, decided_by, notes) VALUES ('${d.id}', '${d.id}', '${d.name}', '${d.name.replace(/'/g, "''")}', '${d.fromStore}', '${d.toStore}', '${d.from}', '${d.to}', '${d.shift.replace(/'/g, "''")}', '${d.status}', '${d.requester}', '${d.decidedBy}', ${notes}) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, decided_by = EXCLUDED.decided_by;`);
}
sqlLines.push('');

// Email Templates
sqlLines.push('-- 4. Email Templates');
for (const t of emailTemplates) {
  sqlLines.push(`INSERT INTO public.email_templates (id, name, subject, body, enabled) VALUES ('${t.id}', '${t.name.replace(/'/g, "''")}', '${t.subject.replace(/'/g, "''")}', '${t.message.replace(/'/g, "''")}', ${t.enabled}) ON CONFLICT (id) DO UPDATE SET subject = EXCLUDED.subject, body = EXCLUDED.body, enabled = EXCLUDED.enabled;`);
}
sqlLines.push('');

// Email Recipients
sqlLines.push('-- 5. Email Recipients');
for (const r of emailRecipients) {
  sqlLines.push(`INSERT INTO public.email_recipients (store, email) VALUES ('${r.store}', '${r.email}') ON CONFLICT (store) DO UPDATE SET email = EXCLUDED.email;`);
}
sqlLines.push('');

// Audit Logs
sqlLines.push('-- 6. Audit Logs');
for (const a of auditLogs) {
  const prev = a.previousValue ? `'${a.previousValue.replace(/'/g, "''")}'` : 'NULL';
  const next = a.newValue ? `'${a.newValue.replace(/'/g, "''")}'` : 'NULL';
  sqlLines.push(`INSERT INTO public.audit_logs (timestamp, actor, action, entity_type, entity_id, store, previous_value, new_value, result, workflow, correlation_id) VALUES ('${a.timestamp}', '${a.actor}', '${a.action.replace(/'/g, "''")}', '${a.entityType}', '${a.entityId}', '${a.store}', ${prev}, ${next}, '${a.result}', '${a.workflow}', '${a.correlationId}');`);
}
sqlLines.push('');

// Roster Shifts (in batches)
sqlLines.push('-- 7. Roster Shifts (6,670 entries)');
for (let i = 0; i < allShiftsArray.length; i += 200) {
  const chunk = allShiftsArray.slice(i, i + 200);
  const values = chunk.map(s => `('${s.employee_id.replace(/'/g, "''")}', '${s.employee_name.replace(/'/g, "''")}', '${s.store.replace(/'/g, "''")}', '${s.date}', '${s.shift.replace(/'/g, "''")}')`).join(',\n');
  sqlLines.push(`INSERT INTO public.roster_shifts (employee_id, employee_name, store, date, shift) VALUES\n${values}\nON CONFLICT (employee_id, date) DO UPDATE SET shift = EXCLUDED.shift, store = EXCLUDED.store;`);
}

fs.writeFileSync(path.resolve(__dirname, '../supabase/seed.sql'), sqlLines.join('\n'), 'utf8');
console.log('SUCCESS! Generated supabase/seed.sql');
