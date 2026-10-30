// Run locally only: SUPABASE_SERVICE_ROLE_KEY must never be committed or placed in public/.
// npm install @supabase/supabase-js
// SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-workbook.mjs
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your local terminal environment.');
const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const data=JSON.parse(fs.readFileSync(new URL('../import-data.json',import.meta.url),'utf8'));
const fail=(r,label)=>{if(r.error)throw new Error(label+': '+r.error.message);return r.data;};
const storeIds={};
for(const name of data.stores){const r=await supabase.from('stores').upsert({name,code:name.toUpperCase().replace(/[^A-Z0-9]+/g,'-'),is_active:data.store_meta?.[name]?.is_active??true},{onConflict:'name'}).select('id,name').single();const row=fail(r,'Store '+name);storeIds[name]=row.id;}
const employeeIds={};
for(const e of data.employees){const payload={employee_code:e.employee_code||null,full_name:e.full_name,role_title:e.role_title,phone:e.phone,email:e.email,store_id:storeIds[e.store],removed_on:e.removed_on,is_active:e.is_active,reports_to:e.reports_to||null};let q;if(e.employee_code){q=await supabase.from('employees').upsert(payload,{onConflict:'employee_code'}).select('id,full_name,store_id').single();}else{const f=await supabase.from('employees').select('id').eq('full_name',e.full_name).eq('store_id',storeIds[e.store]).maybeSingle();fail(f,'Find employee');if(f.data){q=await supabase.from('employees').update(payload).eq('id',f.data.id).select('id,full_name,store_id').single();}else q=await supabase.from('employees').insert(payload).select('id,full_name,store_id').single();}const row=fail(q,'Employee '+e.full_name);employeeIds[e.store+'|'+e.full_name.toLowerCase()]=row.id;}
const batch=500;let count=0;for(let i=0;i<data.roster_entries.length;i+=batch){const rows=data.roster_entries.slice(i,i+batch).map(x=>({employee_id:employeeIds[x.store+'|'+x.employee_name.toLowerCase()],roster_date:x.roster_date,shift_code:x.shift_code,deployment_store_id:x.deployment_store?storeIds[x.deployment_store]:null})).filter(x=>x.employee_id);const r=await supabase.from('roster_entries').upsert(rows,{onConflict:'employee_id,roster_date'});fail(r,'Roster batch '+i);count+=rows.length;}
console.log(JSON.stringify({stores:Object.keys(storeIds).length,employees:data.employees.length,rosterEntries:count,months:data.months},null,2));
