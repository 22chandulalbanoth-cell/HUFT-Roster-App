/**
 * HUFT Roster — Supabase Cloud Database & Storage Connector for Google Apps Script
 *
 * Provides bidirectional cloud synchronization between Google Workspace / Sheets
 * and Supabase PostgreSQL Database & Cloud Storage Buckets (profiles, backups, exports).
 */

const SUPABASE_DEFAULTS = {
  BUCKET_PROFILES: 'profiles',
  BUCKET_BACKUPS: 'backups',
  BUCKET_EXPORTS: 'exports'
};

/** Get Supabase credentials stored securely in Script Properties. */
function getSupabaseConfig_() {
  const props = PropertiesService.getScriptProperties();
  const url = String(props.getProperty('SUPABASE_URL') || 'https://sumoyszqxxuarwzpzsgw.supabase.co').trim().replace(/\/$/, '');
  const key = String(props.getProperty('SUPABASE_KEY') || '').trim();
  return { url: url, key: key, isConfigured: !!(url && key) };
}

/** Admin saves Supabase Project URL and Anon/Service Key. */
function saveSupabaseConfig(p) {
  return guard_('saveSupabaseConfig', function () {
    requireAdmin_();
    p = p || {};
    const url = String(p.url || '').trim().replace(/\/$/, '');
    const key = String(p.key || '').trim();
    if (!url || !/^https:\/\/[a-z0-9_-]+\.supabase\.co$/i.test(url)) {
      throw new Error('Enter a valid Supabase project URL (e.g. https://xyzcompany.supabase.co).');
    }
    if (!key || key.length < 20) {
      throw new Error('Enter a valid Supabase anon or service role API key.');
    }

    // Test connection with Supabase REST API
    const testRes = supabaseFetch_(url, key, '/rest/v1/stores?select=count', 'GET');
    if (!testRes.ok) {
      throw new Error('Could not connect to Supabase: ' + testRes.status + ' ' + testRes.body);
    }

    const props = PropertiesService.getScriptProperties();
    props.setProperty('SUPABASE_URL', url);
    props.setProperty('SUPABASE_KEY', key);

    auditLog_('Supabase cloud connection configured', 'Cloud Integration', url, 'All', '', 'Connected', 'Success', 'Supabase Cloud');

    return {
      ok: true,
      message: 'Successfully connected to Supabase Cloud Database!',
      url: url,
      isConfigured: true
    };
  });
}

/** Test Supabase connectivity and verify tables. */
function testSupabaseConnection() {
  return guard_('testSupabaseConnection', function () {
    const config = getSupabaseConfig_();
    if (!config.isConfigured) {
      return { ok: false, isConfigured: false, message: 'Supabase is not configured yet. Enter your project URL and key.' };
    }

    const res = supabaseFetch_(config.url, config.key, '/rest/v1/stores?select=*&limit=5', 'GET');
    if (!res.ok) {
      return { ok: false, isConfigured: true, message: 'Connection failed: ' + res.status + ' ' + res.body };
    }

    let stores = [];
    try { stores = JSON.parse(res.body); } catch (e) {}

    return {
      ok: true,
      isConfigured: true,
      url: config.url,
      message: 'Connected to Supabase PostgreSQL. Found ' + stores.length + ' store records.',
      stores: stores
    };
  });
}

/** Low-level HTTP fetch helper for Supabase REST and Storage APIs. */
function supabaseFetch_(url, key, endpoint, method, payload, headers) {
  const targetUrl = url + endpoint;
  const options = {
    method: method || 'GET',
    muteHttpExceptions: true,
    headers: Object.assign({
      'apikey': key,
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json'
    }, headers || {})
  };

  if (payload) {
    options.payload = typeof payload === 'string' ? payload : JSON.stringify(payload);
  }

  try {
    const resp = UrlFetchApp.fetch(targetUrl, options);
    const code = resp.getResponseCode();
    const body = resp.getContentText();
    return { ok: code >= 200 && code < 300, status: code, body: body };
  } catch (err) {
    return { ok: false, status: 0, body: String(err && err.message ? err.message : err) };
  }
}

/** Uploads profile photo binary to Supabase Storage bucket `profiles`. */
function uploadPhotoToSupabaseStorage(dataUrl, fileName) {
  const config = getSupabaseConfig_();
  if (!config.isConfigured) throw new Error('Supabase is not configured.');

  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!match) throw new Error('Choose a JPEG, PNG, or WebP image.');

  const mime = match[1];
  const bytes = Utilities.base64Decode(match[2]);
  const safeName = (fileName || 'profile').replace(/[^a-z0-9_.-]+/gi, '_');
  const path = '/storage/v1/object/' + SUPABASE_DEFAULTS.BUCKET_PROFILES + '/' + safeName;

  const res = supabaseFetch_(config.url, config.key, path, 'POST', bytes, {
    'Content-Type': mime,
    'x-upsert': 'true'
  });

  if (!res.ok) {
    throw new Error('Supabase storage upload failed: ' + res.status + ' ' + res.body);
  }

  // Return public CDN URL
  const publicUrl = config.url + '/storage/v1/object/public/' + SUPABASE_DEFAULTS.BUCKET_PROFILES + '/' + safeName;
  return publicUrl;
}

/** One-click sync from Google Sheets into Supabase Cloud Database. */
function syncSheetsToSupabase() {
  return guard_('syncSheetsToSupabase', function () {
    requireAdmin_();
    const config = getSupabaseConfig_();
    if (!config.isConfigured) throw new Error('Connect Supabase first before running synchronization.');

    const ss = openSpreadsheet_();
    let staffCount = 0;
    let storesCount = 0;
    let shiftsCount = 0;

    // 1. Sync Stores
    const stores = getStores_();
    if (stores.length) {
      const storePayload = stores.map(function (s) {
        return {
          name: s.name,
          active: s.active,
          location: s.location || '',
          manager: s.manager || '',
          manager_email: s.managerEmail || ''
        };
      });
      const sRes = supabaseFetch_(config.url, config.key, '/rest/v1/stores', 'POST', storePayload, {
        'Prefer': 'resolution=merge-duplicates'
      });
      if (sRes.ok) storesCount = stores.length;
    }

    // 2. Sync Directory Employees
    const dir = readDirectory_(ss);
    if (dir.entries.length) {
      const empPayload = dir.entries.map(function (e) {
        return {
          id: e.store + '|' + nameKey_(e.name),
          store: e.store,
          name: e.name,
          role: e.role || 'Retail',
          phone: e.phone || '',
          email: e.email || '',
          employee_id: e.employeeId || '',
          active: e.active,
          reports_to: e.reportsTo || '',
          removed_on: e.removedOn || null
        };
      });
      const eRes = supabaseFetch_(config.url, config.key, '/rest/v1/employees', 'POST', empPayload, {
        'Prefer': 'resolution=merge-duplicates'
      });
      if (eRes.ok) staffCount = dir.entries.length;
    }

    // 3. Sync Current Month Roster Shifts
    const today = todayIso_();
    const currentMonthKey = today.slice(0, 7);
    const mData = buildMonth_(Number(currentMonthKey.slice(0, 4)), Number(currentMonthKey.slice(5, 7)) - 1);
    if (mData && mData.employees && mData.employees.length) {
      const shiftRows = [];
      mData.employees.forEach(function (emp) {
        for (let d = 1; d <= mData.daysInMonth; d++) {
          const dIso = currentMonthKey + '-' + pad2_(d);
          const cell = emp.days[d - 1];
          const cat = Array.isArray(cell) ? cell[0] : (cell || 'Unassigned');
          if (cat && cat !== 'Unassigned') {
            shiftRows.push({
              store: emp.store,
              employee_id: emp.id,
              employee_name: emp.name,
              date: dIso,
              shift: Array.isArray(cell) ? (cell[1] || cell[0]) : cat,
              to_store: Array.isArray(cell) ? (cell[2] || '') : '',
              updated_by: currentEmail_()
            });
          }
        }
      });

      if (shiftRows.length) {
        // Chunk inserts by 200
        for (let i = 0; i < shiftRows.length; i += 200) {
          const chunk = shiftRows.slice(i, i + 200);
          supabaseFetch_(config.url, config.key, '/rest/v1/roster_shifts', 'POST', chunk, {
            'Prefer': 'resolution=merge-duplicates'
          });
        }
        shiftsCount = shiftRows.length;
      }
    }

    auditLog_('Full sync from Google Sheets to Supabase', 'Cloud Sync', 'Supabase', 'All', '', JSON.stringify({ stores: storesCount, staff: staffCount, shifts: shiftsCount }), 'Success', 'Supabase Cloud');

    return {
      ok: true,
      message: 'Sync completed! Transferred ' + storesCount + ' stores, ' + staffCount + ' staff profiles, and ' + shiftsCount + ' daily shifts to Supabase Cloud.',
      stats: { stores: storesCount, staff: staffCount, shifts: shiftsCount }
    };
  });
}

/** Takes a full JSON snapshot of all roster tables and uploads to Supabase `backups` bucket. */
function createSupabaseCloudBackup(notes) {
  return guard_('createSupabaseCloudBackup', function () {
    requireAdmin_();
    const config = getSupabaseConfig_();
    if (!config.isConfigured) throw new Error('Supabase is not configured.');

    const ss = openSpreadsheet_();
    const timeStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd_HH-mm-ss');
    const backupId = 'SUPA-BAK-' + Utilities.getUuid().slice(0, 8).toUpperCase();
    const backupName = 'HUFT_Backup_' + timeStr + '.json';

    const snapshot = {
      backupId: backupId,
      timestamp: new Date().toISOString(),
      stores: getStores_(),
      directory: readDirectory_(ss).entries,
      access: readRosterAccess_(),
      notes: notes || 'Manual Supabase cloud backup'
    };

    const jsonStr = JSON.stringify(snapshot, null, 2);
    const sizeKb = Math.round(jsonStr.length / 1024) || 1;
    const path = '/storage/v1/object/' + SUPABASE_DEFAULTS.BUCKET_BACKUPS + '/' + backupName;

    const res = supabaseFetch_(config.url, config.key, path, 'POST', jsonStr, {
      'Content-Type': 'application/json'
    });

    if (!res.ok) throw new Error('Supabase backup upload failed: ' + res.status + ' ' + res.body);

    const storageUrl = config.url + '/storage/v1/object/' + SUPABASE_DEFAULTS.BUCKET_BACKUPS + '/' + backupName;

    // Register in Supabase cloud_backups table
    supabaseFetch_(config.url, config.key, '/rest/v1/cloud_backups', 'POST', {
      id: backupId,
      snapshot_name: backupName,
      storage_url: storageUrl,
      size_kb: sizeKb,
      created_by: currentEmail_(),
      notes: notes || 'Manual backup'
    });

    auditLog_('Supabase cloud backup created', 'Cloud Storage Backup', backupId, 'All', '', JSON.stringify({ name: backupName, sizeKb: sizeKb }), 'Success', 'Supabase Cloud');

    return {
      ok: true,
      message: 'Cloud backup snapshot saved to Supabase Storage: ' + backupName,
      backupId: backupId,
      sizeKb: sizeKb,
      url: storageUrl
    };
  });
}
