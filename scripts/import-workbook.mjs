// Run locally only: SUPABASE_SERVICE_ROLE_KEY must never be committed or placed in public/.
// npm install @supabase/supabase-js
// SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-workbook.mjs
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.SUPABASE_URL || 'https://sumoyszqxxuarwzpzsgw.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.log('NOTICE: SUPABASE_SERVICE_ROLE_KEY not supplied. Skipping direct Supabase push.');
  console.log('To import into Supabase Cloud:');
  console.log('SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/import-workbook.mjs');
  process.exit(0);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/roster-data.json'), 'utf8'));

console.log('Importing stores...');
for (const s of data.stores) {
  const { error } = await supabase.from('stores').upsert({
    name: s.name,
    code: s.name.toUpperCase().replace(/[^A-Z0-9]+/g, '-'),
    active: s.active,
    location: s.location,
    manager: s.manager,
    manager_email: s.managerEmail
  }, { onConflict: 'name' });
  if (error) console.error('Store error:', s.name, error.message);
}

console.log('Importing employees...');
for (const e of data.employees) {
  const { error } = await supabase.from('employees').upsert({
    id: e.id,
    employee_id: e.employeeId || null,
    name: e.name,
    store: e.store,
    role: e.role,
    phone: e.phone || null,
    email: e.email || null,
    active: e.active !== false,
    reports_to: e.reportsTo || null,
    removed_on: e.removedOn || null,
    profile_photo_id: e.profilePhotoId || null
  }, { onConflict: 'id' });
  if (error) console.error('Employee error:', e.name, error.message);
}

console.log('Importing email templates...');
for (const t of (data.emailTemplates || [])) {
  const { error } = await supabase.from('email_templates').upsert({
    id: t.id,
    name: t.name,
    subject: t.subject,
    body: t.message,
    enabled: t.enabled
  }, { onConflict: 'id' });
  if (error) console.error('Template error:', t.id, error.message);
}

console.log('Importing email recipients...');
for (const r of (data.emailRecipients || [])) {
  const { error } = await supabase.from('email_recipients').upsert({
    store: r.store,
    email: r.email
  }, { onConflict: 'store' });
  if (error) console.error('Recipient error:', r.store, error.message);
}

console.log('Importing deployments...');
for (const d of (data.deployments || [])) {
  const { error } = await supabase.from('deployment_requests').upsert({
    id: d.id,
    request_id: d.id,
    employee_id: d.name,
    employee_name: d.name,
    from_store: d.fromStore,
    to_store: d.toStore,
    from_date: d.from,
    to_date: d.to,
    shift: d.shift,
    status: d.status,
    requested_by: d.requester,
    decided_by: d.decidedBy,
    notes: d.notes || null
  }, { onConflict: 'id' });
  if (error) console.error('Deployment error:', d.id, error.message);
}

console.log('Importing shifts (in batches)...');
const shiftEntries = Object.keys(data.shifts || {}).map(sKey => {
  const parts = sKey.split('|');
  const empId = parts[0];
  const date = parts[1];
  const shift = data.shifts[sKey];
  const emp = data.employees.find(x => x.id === empId || x.employeeId === empId);
  return {
    employee_id: empId,
    employee_name: emp ? emp.name : empId,
    store: emp ? emp.store : 'Hyderguda',
    date: date,
    shift: shift
  };
});

const batchSize = 250;
let importedCount = 0;
for (let i = 0; i < shiftEntries.length; i += batchSize) {
  const batch = shiftEntries.slice(i, i + batchSize);
  const { error } = await supabase.from('roster_shifts').upsert(batch, { onConflict: 'employee_id,date' });
  if (error) {
    console.error(`Batch ${i} error:`, error.message);
  } else {
    importedCount += batch.length;
  }
}

console.log(`Import complete! Imported ${importedCount} of ${shiftEntries.length} shifts.`);
