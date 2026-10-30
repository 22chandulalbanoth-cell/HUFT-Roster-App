// Run locally only. Never commit or place a Supabase secret key in public/.
// Required local variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_URL = 'https://sumoyszqxxuarwzpzsgw.supabase.co';
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in this terminal session.');
}
if (new URL(url).origin !== PROJECT_URL) {
  throw new Error('SUPABASE_URL must point to the HUFT Roster Supabase project configured for this importer.');
}
if (key.startsWith('sb_publishable_') || key.startsWith('sb_anon_')) {
  throw new Error('A publishable/anon key cannot import data. Use the project secret/service-role key locally.');
}
if (key.startsWith('eyJ')) {
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
    if (payload.role !== 'service_role') throw new Error();
  } catch {
    throw new Error('The supplied legacy JWT is not a service-role key.');
  }
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dataPath = process.env.HUFT_IMPORT_DATA_PATH
  ? path.resolve(process.env.HUFT_IMPORT_DATA_PATH)
  : path.resolve(scriptDir, '../import-data.json');
if (!fs.existsSync(dataPath)) {
  throw new Error('Import data file not found. Copy the private import-data.json beside package.json or set HUFT_IMPORT_DATA_PATH.');
}

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const requiredArrays = ['stores', 'employees', 'roster_entries'];
for (const field of requiredArrays) {
  if (!Array.isArray(data[field])) throw new Error(`Import data field "${field}" must be an array.`);
}
if (data.stores.length === 0 || data.employees.length === 0) {
  throw new Error('Import data must include at least one store and one employee.');
}

const storeNames = new Set(data.stores);
if (storeNames.size !== data.stores.length || data.stores.some(name => typeof name !== 'string' || !name.trim())) {
  throw new Error('Import data contains a blank or duplicate store name.');
}
const employeeKey = (store, name) => `${store}| ${String(name).normalize('NFC').trim().toLocaleLowerCase('en')}`;
const employeeKeys = new Set();
for (const [index, employee] of data.employees.entries()) {
  if (!employee.full_name || !storeNames.has(employee.store)) {
    throw new Error(`Employee row ${index + 1} has no name or refers to an unknown store.`);
  }
  const keyForEmployee = employeeKey(employee.store, employee.full_name);
  if (employeeKeys.has(keyForEmployee)) {
    throw new Error(`Employee rows contain duplicate names within a store (row ${index + 1}); roster rows cannot identify them safely.`);
  }
  employeeKeys.add(keyForEmployee);
}
const cleanedRoster = new Map();
const conflictingRosterKeys = new Set();
for (const [index, entry] of data.roster_entries.entries()) {
  if (!entry.employee_name || !storeNames.has(entry.store)
      || !employeeKeys.has(employeeKey(entry.store, entry.employee_name))) {
    throw new Error(`Roster row ${index + 1} refers to an unknown employee or store. No data was written.`);
  }
  const date = new Date(`${entry.roster_date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.roster_date)
      || !Number.isFinite(date.valueOf())
      || date.toISOString().slice(0, 10) !== entry.roster_date) {
    throw new Error(`Roster row ${index + 1} has an invalid date. No data was written.`);
  }
  if (typeof entry.shift_code !== 'string' || !entry.shift_code.trim()
      || entry.shift_code.trim().length > 32 || /[\r\n]/.test(entry.shift_code)
      || /__REPORT_TO__|appointments:|tomorrow date not found|^❌ error:/i.test(entry.shift_code)) {
    throw new Error(`Roster row ${index + 1} has a suspicious shift value. Correct the private import data before writing. No data was written.`);
  }
  if (entry.deployment_store && !storeNames.has(entry.deployment_store)) {
    throw new Error(`Roster row ${index + 1} refers to an unknown deployment store. No data was written.`);
  }
  entry.shift_code = entry.shift_code.trim();
  const rosterKey = `${employeeKey(entry.store, entry.employee_name)}|${entry.roster_date}`;
  const prior = cleanedRoster.get(rosterKey);
  if (prior && (prior.shift_code !== entry.shift_code
      || (prior.deployment_store || null) !== (entry.deployment_store || null))) {
    conflictingRosterKeys.add(rosterKey);
  } else if (!prior) {
    cleanedRoster.set(rosterKey, entry);
  }
}
if (conflictingRosterKeys.size) {
  throw new Error(`Found ${conflictingRosterKeys.size} conflicting employee/date groups. Resolve them against the source workbook before importing. No data was written.`);
}
data.roster_entries = [...cleanedRoster.values()];
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const fail = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
};

const storeIds = {};
for (const name of data.stores) {
  const result = await supabase.from('stores')
    .upsert({
      name,
      code: name.toUpperCase().replace(/[^A-Z0-9]+/g, '-'),
      is_active: data.store_meta?.[name]?.is_active ?? true
    }, { onConflict: 'name' })
    .select('id')
    .single();
  storeIds[name] = fail(result, 'Store upsert').id;
}

const employeeIds = {};
for (const [index, employee] of data.employees.entries()) {
  const payload = {
    employee_code: employee.employee_code || null,
    full_name: employee.full_name,
    role_title: employee.role_title || 'Retail',
    phone: employee.phone || null,
    email: employee.email || null,
    store_id: storeIds[employee.store],
    removed_on: employee.removed_on || null,
    is_active: employee.is_active ?? true,
    reports_to: employee.reports_to || null
  };
  let result;
  if (employee.employee_code) {
    result = await supabase.from('employees')
      .upsert(payload, { onConflict: 'employee_code' })
      .select('id')
      .single();
  } else {
    const existing = await supabase.from('employees')
      .select('id')
      .eq('full_name', employee.full_name)
      .eq('store_id', storeIds[employee.store])
      .maybeSingle();
    fail(existing, `Find employee row ${index + 1}`);
    result = existing.data
      ? await supabase.from('employees').update(payload).eq('id', existing.data.id).select('id').single()
      : await supabase.from('employees').insert(payload).select('id').single();
  }
  employeeIds[employeeKey(employee.store, employee.full_name)] =
    fail(result, `Save employee row ${index + 1}`).id;
}

let rosterCount = 0;
const batchSize = 500;
for (let start = 0; start < data.roster_entries.length; start += batchSize) {
  const rows = data.roster_entries.slice(start, start + batchSize).map(entry => ({
    employee_id: employeeIds[employeeKey(entry.store, entry.employee_name)],
    roster_date: entry.roster_date,
    shift_code: entry.shift_code,
    deployment_store_id: entry.deployment_store ? storeIds[entry.deployment_store] : null
  }));
  const result = await supabase.from('roster_entries')
    .upsert(rows, { onConflict: 'employee_id,roster_date' })
    .select('id');
  rosterCount += fail(result, `Save roster batch starting at row ${start + 1}`).length;
}

console.log(JSON.stringify({
  stores: Object.keys(storeIds).length,
  employees: Object.keys(employeeIds).length,
  rosterEntries: rosterCount,
  months: data.months || []
}, null, 2));
