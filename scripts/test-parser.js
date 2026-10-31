const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/parsed-raw-sheets.json'), 'utf8'));

// Helper to normalize store names
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

// 1. STORES
const storeMap = {
  'Hyderguda': { name: 'Hyderguda', active: true, location: 'Hyderguda Main Road', manager: 'Chandu', managerEmail: 'hyderguda@headsupfortails.com' },
  'Golden Mile': { name: 'Golden Mile', active: true, location: 'Golden Mile Business Park, Kokapet', manager: 'Mayangam', managerEmail: 'golden.mile@headsupfortails.com' },
  'Banjara Hills': { name: 'Banjara Hills', active: true, location: 'Road No. 12, Banjara Hills', manager: 'William', managerEmail: 'banjarahills@headsupfortails.com' },
  'Nallagandla': { name: 'Nallagandla', active: true, location: 'Aparna Sarovar Grande Road', manager: 'Lokesh', managerEmail: 'nallagandla@headsupfortails.com' },
  'Madhapur': { name: 'Madhapur', active: true, location: 'Hitech City Road, Madhapur', manager: 'Kamal Kumar', managerEmail: 'madhapur@headsupfortails.com' }
};

// 2. HUFT DIRECTORY EMPLOYEES
const dirRows = data['HUFT Directory'] || [];
const header = (dirRows[0] || []).map(h => (h || '').trim());
console.log('HUFT Directory Header:', header);

const employees = [];
const empLookup = {};

for (let i = 1; i < dirRows.length; i++) {
  const r = dirRows[i];
  if (!r || !r[1]) continue;
  const store = normStore(r[0]) || 'Hyderguda';
  const name = String(r[1]).trim();
  if (!name || name.toLowerCase() === 'employee') continue;
  const role = String(r[2] || 'Retail').trim();
  const phone = String(r[3] || '').trim();
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
    phone: phone.replace(/\.0$/, ''),
    email,
    employeeId,
    active,
    reportsTo: reportingTo,
    removedOn: removedOn || null,
    profilePhotoId: photoId || null
  };
  employees.push(empObj);
  empLookup[empKey] = empObj;
  // Also lookup by just name
  if (!empLookup[name.toLowerCase()]) empLookup[name.toLowerCase()] = empObj;
}

console.log(`Loaded ${employees.length} employees from HUFT Directory.`);

// Check employees in Permanent, Removed, Temporary
const permRows = data['Roster - Permanent'] || [];
console.log(`Roster - Permanent rows: ${permRows.length}`);

const remRows = data['Roster - Removed'] || [];
console.log(`Roster - Removed rows: ${remRows.length}`);

// 3. PARSE SHIFTS ACROSS MONTHS
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

const allShifts = [];
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

const shiftsByMonth = {};

for (const mInfo of monthSheets) {
  const rows = data[mInfo.sheet] || [];
  if (!rows.length) continue;

  // find date row
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
  let sheetShiftCount = 0;

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

    // Check if col0 is an employee (like in Nov26 where col0 is store and col1 is emp)
    let empName = col1;
    let empStore = currentStore;
    if (normStore(col0) && col1) {
      empStore = normStore(col0);
      empName = col1;
    }

    // Try finding employee
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

      // Clean up common shift text
      if (shiftVal === 'Mid Shift' || shiftVal === 'Mid Shift ') shiftVal = 'Mid Shift';
      if (shiftVal === 'Compoff' || shiftVal === 'Comp off') shiftVal = 'Comp off';
      if (shiftVal === 'Week off' || shiftVal === 'weakoff' || shiftVal === 'Week Off') shiftVal = 'Week off';
      if (shiftVal === 'SPA Timings' || shiftVal === 'Spa') shiftVal = 'SPA Timings';

      allShifts.push({
        employee_id: empObj.employeeId || empObj.id,
        employee_name: empObj.name,
        store: empStore,
        date: dCol.date,
        shift: shiftVal
      });
      sheetShiftCount++;
    }
  }
  shiftsByMonth[mInfo.monthKey] = sheetShiftCount;
  console.log(`Month ${mInfo.sheet} (${mInfo.monthKey}): ${dateCols.length} dates, ${sheetShiftCount} shifts parsed.`);
}

console.log(`\nTotal shifts across entire year: ${allShifts.length}`);
