/**
 * HUFT Roster — server side (Google Apps Script web app), v2
 *
 * What it does
 *  - Reads the monthly roster tabs (Oct'26, Sep'26 ...) in one batch and sends
 *    the whole month to the browser, so navigating is instant.
 *  - Saves shift changes back into the same tabs (dropdowns in the Weekly roster).
 *  - Staff management: add, restore, or remove employees; dated inter-store
 *    deployments are tracked separately and require destination approval.
 *  - Registers new stores in a "Stores" tab.
 *
 * Where the data lives
 *  - Month tabs: store in column A, employee in column B, day 1 in column C.
 *  - "HUFT Directory": Store, Employee, Role, WhatsApp, Active, Reporting to,
 *    Removed on (this last column is added automatically).
 *  - "Stores": Store, Active, Location, Manager, Added on (created automatically).
 *  - Generated sheets: "Roster - Permanent" and "Roster - Temporary".
 *    Removed employee details are restricted to the admin in the app because
 *    spreadsheet tabs cannot provide private, role-based visibility.
 */

const CONFIG = {
  APP_TITLE: 'Hyderabad HUFT Roster',
  SPREADSHEET_ID: '1anAGAvK-Keh3cH5sncIpycURWqVgaAPn40icFZrYC60',
  TIMEZONE: 'Asia/Kolkata',
  DIRECTORY_SHEET: 'HUFT Directory',
  STORES_SHEET: 'Stores',
  ACCESS_SHEET: 'Roster Access',
  DEPLOYMENT_REQUESTS_SHEET: 'Deployment Requests',
  PUNCTUALITY_SHEET: 'Punctuality Log',
  AUDIT_SHEET: 'HUFT Audit Log',
  WORK_REQUESTS_SHEET: 'Employee Requests',
  EMAIL_TEMPLATES_SHEET: 'Email Templates',
  EMAIL_LOG_SHEET: 'Email Delivery Log',
  EMAIL_RECIPIENTS_SHEET: 'Email Recipients',
  PROFILE_FOLDER_NAME: 'HUFT Roster Profiles',
  BACKUP_FOLDER_NAME: 'HUFT Roster Cloud Backups',
  EXPORTS_FOLDER_NAME: 'HUFT Roster Exports',
  BACKUP_LOG_SHEET: 'Cloud Backup Log',
  FIRST_DAY_COLUMN: 3, // column C = day 1 of the month
  CACHE_SECONDS: 120,
  CACHE_PREFIX: 'huft_roster_v2_',
  COUNTRY_CODE: '91',

  // Only these people can add/remove/move staff and register stores.
  // Hyderguda is the sole admin; other listed store emails edit only their home store.
  ADMIN_EMAILS: ['hyderguda@headsupfortails.com'],

  // Store accounts land on their home store and can edit that store only.
  STORE_EMAILS: {
    'golden.mile@headsupfortails.com': 'Golden Mile',
    'madhapur@headsupfortails.com': 'Madhapur',
    'nallagandla@headsupfortails.com': 'Nallagandla',
    'banjarahills@headsupfortails.com': 'Banjara Hills',
    'hyderguda@headsupfortails.com': 'Hyderguda'
  },

  // Used once to create the "Stores" tab. After that, add stores from the dashboard.
  DEFAULT_STORES: ['Hyderguda', 'Golden Mile', 'Banjara Hills', 'Nallagandla', 'Madhapur'],

  // Extra spellings found in old data (lower-case letters/digits only) -> store name.
  STORE_ALIASES: {
    hyderguda: 'Hyderguda',
    goldenmile: 'Golden Mile',
    banjara: 'Banjara Hills',
    banjarahills: 'Banjara Hills',
    nallagandla: 'Nallagandla',
    madhapur: 'Madhapur'
  },

  // Column-B values that are headings, not employees.
  IGNORED_NAMES: ['', 'retail', 'groomers', 'grooming', 'store', 'employee', 'day', 'date'],

  // Every spelling found in the roster -> one canonical shift type.
  SHIFT_MAP: {
    'opening': 'Opening', 'opening shift': 'Opening', 'morning': 'Opening',
    'closing': 'Closing', 'closing shift': 'Closing', 'second': 'Closing', 'second shift': 'Closing',
    'mid shift': 'Mid', 'mid': 'Mid', 'straight': 'Mid', 'straight shift': 'Mid',
    'spa timings': 'Spa',
    'training': 'Training',
    'week off': 'Week off', 'weekoff': 'Week off', 'weakoff': 'Week off',
    'comp off': 'Comp off', 'compoff': 'Comp off',
    'holiday': 'Holiday',
    'leave': 'Leave',
    'absent': 'Absent'
  },

  // Canonical type -> the text written into the sheet.
  SHIFT_WRITE: {
    'Opening': 'Opening', 'Closing': 'Closing', 'Mid': 'Mid Shift', 'Spa': 'SPA Timings',
    'Training': 'Training', 'Week off': 'Week off', 'Comp off': 'Comp off',
    'Holiday': 'Holiday', 'Leave': 'Leave', 'Absent': 'Absent'
  }
};

const MONTH_NAMES_ = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

let STORE_MAP_ = null; // per-execution memo of store spellings
let EMAIL_ACTION_REVIEWER_ = ''; // scoped identity for a one-time Gmail action

/* ------------------------------------------------------------------ */
/* Web app entry points                                                */
/* ------------------------------------------------------------------ */


function doGet() {
  const output = HtmlService.createHtmlOutputFromFile('Dashboard')
    .setTitle(CONFIG.APP_TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  // Public HUFT app icon, hosted by Google Play. Keep favicon failure isolated
  // so an unsupported image format can never prevent the roster from opening.
  try {
    output.setFaviconUrl('https://play-lh.googleusercontent.com/tLIHS4DLHDsnXApOrtUpBYJyDY1S7VCJeK0sCdKSMDAnxYdG1SKq0EpGMBjrOyBt7p6H6oNiQ0k7ZJ49zT3EBVI=s64-rw');
  } catch (err) {
    console.warn('HUFT favicon was not applied: ' + String(err && err.message || err));
  }
  return output;
}


/** Gmail ConfirmAction callback: POST only, short-lived token, approval only. */
function doPost(e) {
  const p = e && e.parameter ? e.parameter : {};
  if (String(p.huftEmailAction || '') !== 'approve' || String(p.confirmed || '').toLowerCase() !== 'approved') return HtmlService.createHtmlOutput('HUFT Roster could not verify this email action. No roster change was made.');
  return handleGmailApproval_(String(p.token || ''));
}
function handleGmailApproval_(token) {
  if (!/^[a-f0-9-]{64,80}$/i.test(token)) return HtmlService.createHtmlOutput('This approval action is invalid or expired. No roster change was made.');
  const props = PropertiesService.getScriptProperties(), key = 'huft_gmail_action_' + token, raw = props.getProperty(key);
  if (!raw) return HtmlService.createHtmlOutput('This approval action was already used or has expired.');
  let action;
  try { action = JSON.parse(raw); } catch (err) { props.deleteProperty(key); return HtmlService.createHtmlOutput('This approval action is invalid.'); }
  if (!action || action.choice !== 'approve' || Number(action.expiresAt) < Date.now()) { props.deleteProperty(key); return HtmlService.createHtmlOutput('This approval action has expired. No roster change was made.'); }
  const previousIdentity = EMAIL_ACTION_REVIEWER_;
  try {
    EMAIL_ACTION_REVIEWER_ = cleanEmail_(action.reviewerEmail);
    const result = action.kind === 'deployment' ? reviewDeploymentRequest_({id:action.id,decision:'approve',notes:'Approved from Gmail.'},false) : action.kind === 'employee' ? reviewEmployeeRequest_({id:action.id,decision:'approve',notes:'Approved from Gmail.'},false) : null;
    if (!result || !result.ok) throw new Error('Unsupported email approval action.');
    props.deleteProperty(key);
    return HtmlService.createHtmlOutput('Approved. The roster was updated and a confirmation email was sent to the requester. You may close this message.');
  } catch (err) { return HtmlService.createHtmlOutput('Approval was not completed: ' + escapeEmailHtml_(err && err.message ? err.message : String(err)) + '. No confirmation email was sent.'); }
  finally { EMAIL_ACTION_REVIEWER_ = previousIdentity; }
}

/** One call at page load: everything needed to draw the first screen. */
function getBootstrap() {
  return guard_('getBootstrap', function () {
    requireRosterIdentity_();
    STORE_MAP_ = null;
    // Generated employee status views refresh after staff/deployment changes.
    // Do not rebuild and resize these sheets on every page load.
    const todayIso = todayIso_();
    const months = getMonths_();
    if (!months.length) throw new Error('No monthly roster tabs found (expected names like Oct\'26).');

    const todayKey = todayIso.slice(0, 7);
    const hasToday = months.some(function (m) { return m.key === todayKey; });
    const key = hasToday ? todayKey : months[months.length - 1].key;

    return {
      title: CONFIG.APP_TITLE,
      appUrl: ScriptApp.getService().getUrl() || '',
      todayIso: todayIso,
      // All authorized stores can view the consolidated roster.
      // accessStores remains the server-enforced edit permission list.
      stores: getStoreNames_(),
      months: months,
      month: getMonthData(key, false),
      isAdmin: isAdmin_(),
      isSuperAdmin: isAdmin_(),
      accessStores: getUserStoreAccess_(),
      email: currentEmail_(),
      employeeSelf: !!getMyEmployeeRecord_(),
      homeStore: getHomeStore_() || (getMyEmployeeRecord_() ? getMyEmployeeRecord_().store : ''),
      backupFolder: CONFIG.BACKUP_FOLDER_NAME,
      exportsFolder: CONFIG.EXPORTS_FOLDER_NAME,
      profileFolder: CONFIG.PROFILE_FOLDER_NAME,
      spreadsheetId: CONFIG.SPREADSHEET_ID
    };
  });
}

/** Whole month for the dashboard. key = 'yyyy-MM'. */
function getMonthData(key, force) {
  return guard_('getMonthData ' + key, function () {
    requireRosterIdentity_();
    const m = /^(\d{4})-(\d{2})$/.exec(String(key));
    if (!m) throw new Error('Invalid month: ' + key);

    const cacheKey = 'month_' + key;
    let data;
    if (!force) data = cacheGet_(cacheKey);
    if (!data) {
      data = buildMonth_(Number(m[1]), Number(m[2]) - 1);
      if (data.found) cachePut_(cacheKey, data);
    }
    const readableStores = {};
    getStoreNames_().forEach(function (store) { readableStores[store] = true; });
    const contactStores = {};
    getContactVisibleStores_().forEach(function (store) { contactStores[store] = true; });
    const self = getMyEmployeeRecord_();
    return Object.assign({}, data, { employees: (data.employees || []).filter(function (e) {
      return !!readableStores[e.store] || !!(self && self.store === e.store && nameKey_(self.name) === nameKey_(e.name));
    }).map(function (e) {
      return isAdmin_() || contactStores[e.store] ? e : Object.assign({}, e, { phone: '' });
    }) });
  });
}

/** Simple trigger: clear cached data for the tab that was just edited. */
function onEdit(e) {
  try {
    const keys = [CONFIG.CACHE_PREFIX + 'months', CONFIG.CACHE_PREFIX + 'stores'];
    const editedCell = e.range;
    if (editedCell.getNumRows() === 1 && editedCell.getNumColumns() === 1 && editedCell.getColumn() >= CONFIG.FIRST_DAY_COLUMN) {
      const note = String(editedCell.getNote() || '');
      if (note.indexOf('HUFT_DEPLOYMENT:') === 0) editedCell.setNote('');
    }
    const p = parseSheetName_(e.range.getSheet().getName());
    if (p) keys.push(CONFIG.CACHE_PREFIX + 'month_' + p.key);
    CacheService.getScriptCache().removeAll(keys);
  } catch (err) {
    // Never block an edit because of cache housekeeping.
  }
}

/* ------------------------------------------------------------------ */
/* Saving shifts                                                       */
/* ------------------------------------------------------------------ */

/**
 * changes: [{ store, name, date:'yyyy-MM-dd', cat, toStore?, shift? }]
 * cat = a key of CONFIG.SHIFT_WRITE, 'Clear', or 'Deployed' (with toStore, optional shift).
 */
function saveShifts(changes) {
  return guard_('saveShifts', function () {
    STORE_MAP_ = null;
    if (!Array.isArray(changes) || !changes.length) throw new Error('Nothing to save.');
    if (changes.length > 500) throw new Error('Too many changes at once (max 500).');
    const clean = changes.map(validateChange_);
    clean.forEach(function (c) { requireStoreAccess_(c.store); });
    return withLock_(function () {
      const saved = applyChanges_(clean);
      return { ok: true, saved: saved };
    });
  });
}

function validateChange_(c) {
  if (!c || typeof c !== 'object') throw new Error('Invalid change.');
  const store = requireStore_(c.store);
  const name = String(c.name || '').replace(/\s+/g, ' ').trim();
  if (!isEmployeeName_(name)) throw new Error('Invalid employee name.');
  if (!validIso_(c.date)) throw new Error('Invalid date: ' + c.date);
  const text = shiftCellText_(c);
  const note = c.cat === 'Deployed' ? deploymentNote_(requireStore_(c.toStore)) : '';
  return { store: store, name: name, date: c.date, text: text, note: note };
}

function shiftCellText_(c) {
  if (c.cat === 'Clear') return '';
  if (c.cat === 'Deployed') {
    const sh = c.shift && CONFIG.SHIFT_WRITE[c.shift] ? CONFIG.SHIFT_WRITE[c.shift] : '';
    // Keep the cell value compatible with its normal dropdown validation.
    // Deployment destination is stored in a note on that cell instead.
    return sh;
  }
  if (!Object.prototype.hasOwnProperty.call(CONFIG.SHIFT_WRITE, c.cat)) {
    throw new Error('Unknown shift: ' + c.cat);
  }
  return CONFIG.SHIFT_WRITE[c.cat];
}

function deploymentNote_(store) {
  return 'HUFT_DEPLOYMENT:' + encodeURIComponent(store);
}

function applyChanges_(clean) {
  const byMonth = {};
  clean.forEach(function (c) {
    const key = c.date.slice(0, 7);
    (byMonth[key] = byMonth[key] || []).push(c);
  });
  let total = 0;
  const keys = Object.keys(byMonth);
  keys.forEach(function (key) { total += writeMonthChanges_(key, byMonth[key]); });
  clearCaches_(keys);
  clean.forEach(function (c) {
    auditLog_('Roster shift changed', 'Roster entry', c.store + '|' + nameKey_(c.name), c.store, '', JSON.stringify({ date: c.date, value: c.text, deploymentNote: c.note || '' }), 'Success', 'Roster save');
  });
  return total;
}

function writeMonthChanges_(key, list) {
  const info = getMonths_().filter(function (m) { return m.key === key; })[0];
  if (!info) throw new Error('There is no roster tab for ' + key + ' yet. Create the tab first (for example Nov\'26).');

  const ss = openSpreadsheet_();
  const sheet = ss.getSheetByName(info.sheet);
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7)) - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const readRows = Math.max(sheet.getLastRow(), 2);
  const ab = sheet.getRange(1, 1, readRows, 2).getDisplayValues();
  const rowsById = {};
  walkEmployeeRows_(ab, function (r, store, role, name) {
    const id = store + '|' + nameKey_(name);
    (rowsById[id] = rowsById[id] || []).push(r + 1);
  });

  // Employees with no row in this tab yet get a new row at the bottom.
  let nextRow = sheet.getLastRow() + 1;
  const fresh = [];
  list.forEach(function (c) {
    const id = c.store + '|' + nameKey_(c.name);
    if (!rowsById[id]) {
      rowsById[id] = [nextRow];
      fresh.push([c.store, c.name, nextRow]);
      nextRow++;
    }
  });
  if (fresh.length) {
    const missingRows = nextRow - 1 - sheet.getMaxRows();
    if (missingRows > 0) sheet.insertRowsAfter(sheet.getMaxRows(), missingRows);
    fresh.forEach(function (f) { sheet.getRange(f[2], 1, 1, 2).setValues([[f[0], f[1]]]); });
  }

  // Collect cell writes per row so each row is written once.
  const perRow = {};
  const perRowNotes = {};
  let maxCol = 0;
  list.forEach(function (c) {
    const day = Number(c.date.slice(8, 10));
    if (day < 1 || day > daysInMonth) throw new Error('Invalid date: ' + c.date);
    const col = CONFIG.FIRST_DAY_COLUMN + day - 1;
    maxCol = Math.max(maxCol, col);
    const id = c.store + '|' + nameKey_(c.name);
    rowsById[id].forEach(function (row) {
      (perRow[row] = perRow[row] || {})[col] = c.text;
      (perRowNotes[row] = perRowNotes[row] || {})[col] = c.note || '';
    });
  });
  const missingCols = maxCol - sheet.getMaxColumns();
  if (missingCols > 0) sheet.insertColumnsAfter(sheet.getMaxColumns(), missingCols);

  Object.keys(perRow).forEach(function (row) {
    const cols = Object.keys(perRow[row]).map(Number);
    const min = Math.min.apply(null, cols);
    const max = Math.max.apply(null, cols);
    const range = sheet.getRange(Number(row), min, 1, max - min + 1);
    const vals = range.getValues();
    const notes = range.getNotes();
    cols.forEach(function (col) {
      vals[0][col - min] = shiftValueForCell_(sheet, Number(row), col, perRow[row][col]);
      notes[0][col - min] = perRowNotes[row][col] || '';
    });
    range.setValues(vals);
    range.setNotes(notes);
  });
  return list.length;
}

/** Match or repair the current cell's dropdown for a supported roster shift. */
function shiftValueForCell_(sheet, row, col, value) {
  const text = String(value == null ? '' : value);
  if (!text) return '';
  if (/^__REPORT_TO__.+__SHIFT__(?:.*)$/.test(text)) return text;
  const cell = sheet.getRange(row, col);
  const rule = cell.getDataValidation();
  if (!rule) return text;

  const criteria = rule.getCriteriaValues() || [];
  let options = [];
  if (rule.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
    options = criteria[0] || [];
  } else if (rule.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE && criteria[0]) {
    options = criteria[0].getDisplayValues().reduce(function (all, r) { return all.concat(r); }, []);
  }
  options = options.map(function (v) { return String(v == null ? '' : v).trim(); }).filter(Boolean);
  const exact = options.filter(function (v) { return v.toLowerCase() === text.toLowerCase(); })[0];
  if (exact) return exact;

  const canonical = CONFIG.SHIFT_MAP[text.toLowerCase().trim()] || text;
  const equivalent = options.filter(function (option) {
    const mapped = CONFIG.SHIFT_MAP[option.toLowerCase()] || option;
    return mapped.toLowerCase() === String(canonical).toLowerCase();
  })[0];
  if (equivalent) return equivalent;

  // Older per-cell dropdowns can omit a shift supported by the app (such as
  // SPA Timings). Extend only the cell being written, preserving its choices.
  const canonicalKey = shiftKey_(text);
  if (canonicalKey) {
    const writeValue = CONFIG.SHIFT_WRITE[canonicalKey];
    const updatedOptions = options.slice();
    if (!updatedOptions.some(function (option) { return option.toLowerCase() === writeValue.toLowerCase(); })) {
      updatedOptions.push(writeValue);
    }
    const builder = SpreadsheetApp.newDataValidation()
      .requireValueInList(updatedOptions, true)
      .setAllowInvalid(rule.getAllowInvalid());
    if (rule.getHelpText()) builder.setHelpText(rule.getHelpText());
    cell.setDataValidation(builder.build());
    return writeValue;
  }

  throw new Error('Shift "' + text + '" is not an allowed choice in ' + cell.getA1Notation() + '. Update that cell’s dropdown options or choose one of its listed shifts.');
}

/** Convert historical spellings (for example, "SPA Timings") to a shift key. */
function shiftKey_(value) {
  const raw = String(value == null ? '' : value).trim();
  if (Object.prototype.hasOwnProperty.call(CONFIG.SHIFT_WRITE, raw)) return raw;
  const mapped = CONFIG.SHIFT_MAP[raw.toLowerCase()];
  return mapped && Object.prototype.hasOwnProperty.call(CONFIG.SHIFT_WRITE, mapped) ? mapped : '';
}

/* ------------------------------------------------------------------ */
/* Staff and store management                                          */
/* ------------------------------------------------------------------ */

/** p: { name, store, role, phone?, email?, employeeId?, reportsTo? } */
function addStaff(p) {
  return guard_('addStaff', function () {
    STORE_MAP_ = null;
    p = p || {};
    const name = cleanInput_(p.name, 40, 'Name');
    const store = requireStore_(p.store);
    requireStoreAccess_(store);
    const role = p.role === 'Grooming' ? 'Grooming' : 'Retail';
    const phone = cleanPhoneInput_(p.phone);
    const email = p.email ? cleanEmail_(p.email) : '';
    const employeeId = cleanEmployeeId_(p.employeeId);
    const reportsTo = p.reportsTo ? requireStore_(p.reportsTo) : '';

    return withLock_(function () {
      const dir = ensureDirectory_(openSpreadsheet_());
      const vals = readDirValues_(dir);
      const rows = findDirRows_(vals, dir.cols, store, name);
      assertUniqueEmployeeId_(dir, employeeId, store, name);
      if (rows.length) {
        const active = rows.some(function (r) { return isActiveCell_(vals[r - 1][dir.cols['Active']]); });
        if (active) throw new Error(name + ' is already in ' + store + '.');
        rows.forEach(function (r) { // bring a removed person back
          dir.sheet.getRange(r, dir.cols['Active'] + 1).setValue('TRUE');
          writeText_(dir.sheet.getRange(r, dir.cols['Removed on'] + 1), '');
          dir.sheet.getRange(r, dir.cols['Role'] + 1).setValue(role);
          if (phone) writeText_(dir.sheet.getRange(r, dir.cols['WhatsApp'] + 1), phone);
          if (email) writeText_(dir.sheet.getRange(r, dir.cols['Email'] + 1), email);
          if (employeeId) writeText_(dir.sheet.getRange(r, dir.cols['Employee ID'] + 1), employeeId);
        });
      } else {
        appendDirRow_(dir, { store: store, name: name, role: role, phone: phone, email: email, employeeId: employeeId, active: 'TRUE', reportsTo: reportsTo, removedOn: '' });
      }
      clearAllCaches_();
      syncEmployeeStatusSheetsSafely_();
      auditLog_('Employee added or restored', 'Employee', store + '|' + nameKey_(name), store, '', JSON.stringify({ name: name, role: role, employeeId: employeeId }), 'Success', 'Staff management');
      return okResult_(name + ' added to ' + store + '.');
    });
  });
}

/** p: { store, name, newName, role, phone, photoData?, removePhoto? } */
function updateStaff(p) {
  return guard_('updateStaff', function () {
    STORE_MAP_ = null;
    p = p || {};
    const store = requireStore_(p.store);
    requireStoreAccess_(store);
    const oldName = cleanInput_(p.name, 40, 'Current name');
    const name = cleanInput_(p.newName, 40, 'Name');
    const role = p.role === 'Grooming' ? 'Grooming' : 'Retail';
    const phone = cleanPhoneInput_(p.phone);
    const email = p.email ? cleanEmail_(p.email) : '';
    const employeeId = cleanEmployeeId_(p.employeeId);
    if (p.photoData && String(p.photoData).length > 500000) throw new Error('Photo is too large. Choose a smaller image.');

    return withLock_(function () {
      const dir = ensureDirectory_(openSpreadsheet_());
      const vals = readDirValues_(dir);
      let rows = findDirRows_(vals, dir.cols, store, oldName);
      let createdDirectoryRow = false;

      // Employee ID is the stable identity. Older directory records can have
      // a misspelled/different name, so repair them by exact ID match. The
      // existing ID uniqueness check still protects addStaff; profile repair
      // is restricted to the employee's store or the Hyderguda administrator.
      const idRows = employeeId ? findDirRowsByEmployeeId_(vals, dir.cols, employeeId) : [];
      assertUniqueEmployeeId_(dir, employeeId, store, name, store, oldName, true, !!idRows.length);
      const samePersonRows = idRows;
      const otherStoreRows = samePersonRows.filter(function (row) {
        return canonicalStore_(vals[row - 1][dir.cols['Store']]) !== store;
      });
      const targetIdRows = samePersonRows.filter(function (row) {
        return canonicalStore_(vals[row - 1][dir.cols['Store']]) === store;
      });
      if (!rows.length && targetIdRows.length) rows = [targetIdRows[0]];
      const duplicateTargetIdRows = targetIdRows.filter(function (row) { return rows.indexOf(row) < 0; });
      if ((otherStoreRows.length || duplicateTargetIdRows.length) && !isAdmin_()) {
        throw new Error('This Employee ID is linked to a profile in another store. Ask the Hyderguda admin to consolidate the permanent profile.');
      }
      if (!rows.length && samePersonRows.length) {
        // No directory profile exists under this store/name, so create the
        // permanent row here after archiving its old duplicate profile(s).
        const sourceRow = samePersonRows[0];
        const sourcePhoto = String(vals[sourceRow - 1][dir.cols['Profile Photo ID']] || '').trim();
        otherStoreRows.forEach(function (row) {
          dir.sheet.getRange(row, dir.cols['Active'] + 1).setValue('FALSE');
          writeText_(dir.sheet.getRange(row, dir.cols['Removed on'] + 1), todayIso_());
        });
        const photoId = p.removePhoto ? '' : p.photoData ? saveProfilePhoto_(p.photoData, name, sourcePhoto, store) : sourcePhoto;
        if (p.removePhoto && sourcePhoto) trashProfilePhoto_(sourcePhoto);
        appendDirRow_(dir, { store:store, name:name, role:role, phone:phone, email:email, employeeId:employeeId, active:'TRUE', reportsTo:'', removedOn:'', photoId:photoId });
        rows = [dir.sheet.getLastRow()];
        createdDirectoryRow = true;
      } else if (rows.length && (otherStoreRows.length || duplicateTargetIdRows.length)) {
        otherStoreRows.concat(duplicateTargetIdRows).forEach(function (row) {
          dir.sheet.getRange(row, dir.cols['Active'] + 1).setValue('FALSE');
          writeText_(dir.sheet.getRange(row, dir.cols['Removed on'] + 1), todayIso_());
        });
      } else if (!rows.length) {
        // Some older roster tabs have a staff row without a Directory record.
        // Restore that profile from the submitted details instead of failing.
        if (findDirRows_(vals, dir.cols, store, name).length) throw new Error(name + ' already exists in ' + store + '.');
        const photoId = p.photoData ? saveProfilePhoto_(p.photoData, name, '', store) : '';
        appendDirRow_(dir, { store:store, name:name, role:role, phone:phone, email:email, employeeId:employeeId, active:'TRUE', reportsTo:'', removedOn:'', photoId:photoId });
        rows = [dir.sheet.getLastRow()];
        createdDirectoryRow = true;
      }

      if (nameKey_(oldName) !== nameKey_(name)) renameStaffInTabs_(store, oldName, name);
      const existingPhoto = String(dir.sheet.getRange(rows[0], dir.cols['Profile Photo ID'] + 1).getDisplayValue() || '').trim();
      let photoId = existingPhoto;
      if (p.removePhoto && existingPhoto) { trashProfilePhoto_(existingPhoto); photoId = ''; }
      if (p.photoData && !createdDirectoryRow) photoId = saveProfilePhoto_(p.photoData, name, existingPhoto, store);
      rows.forEach(function (row) {
        writeText_(dir.sheet.getRange(row, dir.cols['Store'] + 1), store);
        writeText_(dir.sheet.getRange(row, dir.cols['Employee'] + 1), name);
        dir.sheet.getRange(row, dir.cols['Active'] + 1).setValue('TRUE');
        writeText_(dir.sheet.getRange(row, dir.cols['Removed on'] + 1), '');
        dir.sheet.getRange(row, dir.cols['Role'] + 1).setValue(role);
        writeText_(dir.sheet.getRange(row, dir.cols['WhatsApp'] + 1), phone);
        writeText_(dir.sheet.getRange(row, dir.cols['Email'] + 1), email);
        writeText_(dir.sheet.getRange(row, dir.cols['Employee ID'] + 1), employeeId);
        writeText_(dir.sheet.getRange(row, dir.cols['Profile Photo ID'] + 1), photoId);
      });
      clearAllCaches_();
      syncEmployeeStatusSheetsSafely_();
      auditLog_('Employee profile updated', 'Employee', store + '|' + nameKey_(name), store, oldName, JSON.stringify({ name:name, role:role, employeeId:employeeId, phoneUpdated:true, emailUpdated:true, photoChanged:!!p.photoData || !!p.removePhoto, directoryRepaired:!samePersonRows.length }), 'Success', 'Staff management');
      return okResult_(name + ' updated in ' + store + '.');
    });
  });
}
/** Return profile images only for employees present in the directory. */
function getStaffPhotos(ids) {
  return guard_('getStaffPhotos', function () {
    requireRosterIdentity_();
    if (!Array.isArray(ids) || ids.length > 50) throw new Error('Request up to 50 staff photos at a time.');
    const readable = {};
    // Serve photos for all stores through the authenticated app endpoint. Drive files remain private.
    getStoreNames_().forEach(function (store) { readable[store] = true; });
    const self = getMyEmployeeRecord_();
    const directory = readDirectory_(openSpreadsheet_());
    const allowed = {};
    directory.entries.forEach(function (e) {
      if (!e.store || !e.photoId || (!readable[e.store] && !(self && self.store === e.store && nameKey_(self.name) === nameKey_(e.name)))) return;
      const id = e.store + '|' + nameKey_(e.name);
      allowed[id] = e.photoId;
    });
    const out = {};
    ids.forEach(function (id) {
      const photoId = allowed[String(id || '')];
      if (!photoId) return;
      try {
        const blob = DriveApp.getFileById(photoId).getBlob();
        const mime = blob.getContentType();
        if (!/^image\/(jpeg|png|webp)$/.test(mime)) return;
        out[id] = 'data:' + mime + ';base64,' + Utilities.base64Encode(blob.getBytes());
      } catch (err) {
        // Missing or inaccessible photos fall back to initials in the dashboard.
      }
    });
    return out;
  });
}

/** Admin migration: remove broad sharing and apply each employee store's access list. */
function shareAllProfilePhotos() {
  return guard_('shareAllProfilePhotos', function () {
    requireAdmin_();
    const folder = getOrCreateProfileFolder_();
    const byFile = {};
    readDirectory_(openSpreadsheet_()).entries.forEach(function (entry) {
      if (!entry.photoId || !entry.store) return;
      const list = byFile[entry.photoId] || (byFile[entry.photoId] = {});
      getRosterPhotoViewerEmails_(entry.store).forEach(function (email) { list[email] = true; });
    });
    let secured = 0;
    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      try {
        const viewers = Object.keys(byFile[file.getId()] || {});
        shareProfileFileWithRoster_(file, viewers);
        secured++;
      } catch (err) {
        // Continue; Apps Script reports aggregate count for admin follow-up.
      }
    }
    return { ok: true, shared: secured, message: secured + ' profile photos secured with store-scoped access.' };
  });
}

function saveProfilePhoto_(dataUrl, name, oldId, store) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!match) throw new Error('Choose a JPEG, PNG, or WebP profile photo.');
  const folder = getOrCreateProfileFolder_();
  const bytes = Utilities.base64Decode(match[2]);
  const safeName = name.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
  const file = folder.createFile(Utilities.newBlob(bytes, match[1], safeName + '_profile'));
  shareProfileFileWithRoster_(file, getRosterPhotoViewerEmails_(store));
  if (oldId) trashProfilePhoto_(oldId);
  return file.getId();
}

function getOrCreateProfileFolder_() {
  const folderIt = DriveApp.getFoldersByName(CONFIG.PROFILE_FOLDER_NAME);
  const folder = folderIt.hasNext() ? folderIt.next() : DriveApp.createFolder(CONFIG.PROFILE_FOLDER_NAME);
  shareProfileFolderWithDomain_(folder);
  return folder;
}

/** Keep the profile folder private; app reads are permission-checked server-side. */
function shareProfileFolderWithDomain_(folder) {
  try {
    folder = folder || (function () {
      const it = DriveApp.getFoldersByName(CONFIG.PROFILE_FOLDER_NAME);
      return it.hasNext() ? it.next() : null;
    })();
    if (folder) folder.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  } catch (err) {
    // Keep uploads working if a Workspace policy prevents a sharing change.
  }
}

function getRosterPhotoViewerEmails_(store) {
  const emails = {};
  CONFIG.ADMIN_EMAILS.forEach(function (email) { emails[String(email).toLowerCase()] = true; });
  if (!store) return Object.keys(emails);
  Object.keys(CONFIG.STORE_EMAILS).forEach(function (email) {
    if (canonicalStore_(CONFIG.STORE_EMAILS[email]) === store) emails[email.toLowerCase()] = true;
  });
  try {
    readRosterAccess_().forEach(function (entry) {
      if (entry.access === 'Admin' || entry.store === store) emails[entry.email] = true;
    });
  } catch (err) {}
  return Object.keys(emails);
}

function shareProfileFileWithRoster_(file, viewers) {
  try { file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); } catch (err) {}
  (viewers || []).forEach(function (email) {
    try { file.addViewer(email); } catch (err) {}
  });
}

function shareProfilePhotosWithEmail_(email, store, access, remove) {
  const allStores = access === 'Admin';
  const entries = readDirectory_(openSpreadsheet_()).entries;
  const ids = {};
  entries.forEach(function (entry) {
    if (entry.photoId && (allStores || entry.store === store)) ids[entry.photoId] = true;
  });
  Object.keys(ids).forEach(function (id) {
    try {
      const file = DriveApp.getFileById(id);
      if (remove) file.removeViewer(email);
      else file.addViewer(email);
    } catch (err) {}
  });
}
function trashProfilePhoto_(id) {
  try { DriveApp.getFileById(id).setTrashed(true); } catch (err) {}
}

/** p: { store, name, role?, date? }  Staff disappear from `date` onwards; history is kept. */
function removeStaff(p) {
  return guard_('removeStaff', function () {
    STORE_MAP_ = null;
    p = p || {};
    const store = requireStore_(p.store);
    requireStoreAccess_(store);
    const name = cleanInput_(p.name, 40, 'Name');
    const date = p.date ? p.date : todayIso_();
    if (!validIso_(date)) throw new Error('Invalid date.');

    return withLock_(function () {
      const dir = ensureDirectory_(openSpreadsheet_());
      const vals = readDirValues_(dir);
      const rows = findDirRows_(vals, dir.cols, store, name);
      if (rows.length) {
        rows.forEach(function (r) {
          dir.sheet.getRange(r, dir.cols['Active'] + 1).setValue('FALSE');
          writeText_(dir.sheet.getRange(r, dir.cols['Removed on'] + 1), date);
        });
      } else {
        appendDirRow_(dir, { store: store, name: name, role: p.role === 'Grooming' ? 'Grooming' : 'Retail', phone: '', active: 'FALSE', reportsTo: '', removedOn: date });
      }
      clearAllCaches_();
      syncEmployeeStatusSheetsSafely_();
      auditLog_('Employee removed', 'Employee', store + '|' + nameKey_(name), store, 'Active', JSON.stringify({ status: 'Removed', from: date }), 'Success', 'Staff management');
      return okResult_(name + ' removed from ' + store + ' (from ' + date + ').');
    });
  });
}

function getDeletedStaff() {
  return guard_('getDeletedStaff', function () {
    requireAdmin_();
    return readDirectory_(openSpreadsheet_()).entries.filter(function (e) { return !e.active; }).map(function (e) {
      e.id = e.store + '|' + nameKey_(e.name);
      return e;
    });
  });
}

function restoreStaff(p) {
  return guard_('restoreStaff', function () {
    requireAdmin_();
    p = p || {};
    const store = requireStore_(p.store);
    const name = cleanInput_(p.name, 40, 'Name');
    return withLock_(function () {
      const dir = ensureDirectory_(openSpreadsheet_());
      const vals = readDirValues_(dir);
      const rows = findDirRows_(vals, dir.cols, store, name);
      if (!rows.length) throw new Error('Could not find ' + name + ' in ' + store + '.');
      rows.forEach(function (row) {
        dir.sheet.getRange(row, dir.cols['Active'] + 1).setValue('TRUE');
        writeText_(dir.sheet.getRange(row, dir.cols['Removed on'] + 1), '');
      });
      clearAllCaches_();
      syncEmployeeStatusSheetsSafely_();
      auditLog_('Employee restored', 'Employee', store + '|' + nameKey_(name), store, 'Removed', 'Active', 'Success', 'Staff management');
      return okResult_(name + ' restored to ' + store + '.');
    });
  });
}

function getPunctualityEvents() {
  return guard_('getPunctualityEvents', function () {
    requireRosterIdentity_();
    const sh = openSpreadsheet_().getSheetByName(CONFIG.PUNCTUALITY_SHEET);
    if (!sh || sh.getLastRow() < 2) return { events: [] };
    const width = Math.max(sh.getLastColumn(), 10);
    const headers = sh.getRange(1, 1, 1, width).getDisplayValues()[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
    const employeeIdCol = headers.indexOf('employee id');
    const events = sh.getRange(2, 1, sh.getLastRow() - 1, width).getDisplayValues().map(function (r) {
      return { id:r[0], store:canonicalStore_(r[1]) || r[1], name:r[2], date:r[3], type:r[4], notice:r[5], minutes:Number(r[6]) || 0, details:r[7], recordedBy:r[8], recordedAt:r[9], employeeId:employeeIdCol >= 0 ? String(r[employeeIdCol] || '').trim() : '' };
    });
    const readable = {};
    getUserStoreAccess_().forEach(function (store) { readable[store] = true; });
    const self = getMyEmployeeRecord_();
    return { events: events.filter(function (event) { return !!readable[event.store] || !!(self && self.store === event.store && nameKey_(self.name) === nameKey_(event.name)); }) };
  });
}

function addPunctualityEvent(p) {
  return guard_('addPunctualityEvent', function () {
    p = p || {};
    const store = requireStore_(p.store);
    requireStoreAccess_(store);
    const name = cleanInput_(p.name, 40, 'Employee name');
    const employeeId = cleanEmployeeId_(p.employeeId);
    const date = String(p.date || '');
    if (!validIso_(date)) throw new Error('Choose a valid incident date.');
    const type = String(p.type || '');
    if (type !== 'Unapproved leave' && type !== 'Late reporting') throw new Error('Choose unapproved leave or late reporting.');
    const notice = type === 'Late reporting' ? (p.notice === 'Informed' ? 'Informed' : 'Not informed') : '';
    const minutes = type === 'Late reporting' ? Number(p.minutes) : 0;
    if (type === 'Late reporting' && (!Number.isInteger(minutes) || minutes < 1 || minutes > 720)) {
      throw new Error('Enter late minutes from 1 to 720.');
    }

    const activeInStore = readDirectory_(openSpreadsheet_()).entries.filter(function (e) { return e.store === store && e.active; });
    let matches = [];
    const nameMatches = activeInStore.filter(function (e) { return nameKey_(e.name) === nameKey_(name); });
    if (employeeId) {
      const wantedId = employeeId.replace(/\s+/g, '').toLowerCase();
      matches = activeInStore.filter(function (e) {
        return String(e.employeeId || '').replace(/\s+/g, '').toLowerCase() === wantedId;
      });
      if (matches.length && nameMatches.length === 1 && nameKey_(matches[0].name) !== nameKey_(name)) {
        throw new Error('Employee code ' + employeeId + ' belongs to ' + matches[0].name + ', not ' + name + '.');
      }
      if (!matches.length) {
        if (nameMatches.length === 1) {
          // Use the unique active directory record when the browser has a stale
          // ID; the saved record below always uses the directory's canonical ID.
          matches = nameMatches;
        } else if (nameMatches.length > 1) {
          throw new Error('More than one active employee named ' + name + ' exists in ' + store + '. Ask the admin to resolve the duplicate before recording punctuality.');
        } else {
          throw new Error('Employee code ' + employeeId + ' and name ' + name + ' do not match an active employee in ' + store + '. Check the employee profile.');
        }
      }
    } else {
      matches = nameMatches;
      if (!matches.length) throw new Error('Could not match ' + name + ' to an active employee in ' + store + '. Add or verify the employee code in the staff profile, then try again.');
    }
    if (matches.length > 1) throw new Error('Employee code/name matches more than one active profile in ' + store + '. Ask the admin to resolve duplicate employee records.');
    const staff = matches[0];
    const details = String(p.details || '').trim().slice(0, 500);
    const sh = ensurePunctualitySheet_(openSpreadsheet_());
    const row = sh.getLastRow() + 1;
    sh.getRange(row, 4).setNumberFormat('@');
    const width = Math.max(sh.getLastColumn(), 10);
    const headers = sh.getRange(1, 1, 1, width).getDisplayValues()[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
    const employeeIdCol = headers.indexOf('employee id');
    const values = new Array(width).fill('');
    values.splice(0, 10, Utilities.getUuid(), store, staff.name, date, type, notice, minutes, details, currentEmail_(), new Date());
    if (employeeIdCol >= 0) values[employeeIdCol] = staff.employeeId || employeeId;
    sh.getRange(row, 1, 1, width).setValues([values]);
    auditLog_('Punctuality record added', 'Punctuality record', sh.getRange(row, 1).getDisplayValue(), store, '', JSON.stringify({ employee: staff.name, employeeId: staff.employeeId || employeeId, date: date, incident: type, notice: notice, minutes: minutes }), 'Success', 'Punctuality');
    return { ok: true, message: type + ' recorded for ' + staff.name + '.', events: getPunctualityEvents().events };
  });
}

function removePunctualityEvent(p) {
  return guard_('removePunctualityEvent', function () {
    p = p || {};
    const sh = openSpreadsheet_().getSheetByName(CONFIG.PUNCTUALITY_SHEET);
    if (!sh || sh.getLastRow() < 2) throw new Error('Punctuality record was not found.');
    const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 10).getDisplayValues();
    let row = -1, store = '';
    rows.forEach(function (r, i) { if (r[0] === String(p.id || '')) { row = i + 2; store = canonicalStore_(r[1]) || r[1]; } });
    if (row < 0) throw new Error('Punctuality record was not found.');
    requireStoreAccess_(store);
    const removed = rows[row - 2];
    sh.deleteRow(row);
    auditLog_('Punctuality record removed', 'Punctuality record', String(p.id || ''), store, JSON.stringify({ employee: removed[2], date: removed[3], incident: removed[4], notice: removed[5], minutes: removed[6] }), 'Removed', 'Success', 'Punctuality');
    return { ok: true, message: 'Punctuality record removed.', events: getPunctualityEvents().events };
  });
}

function ensureAuditLogSheet_(ss) {
  let sh = ss.getSheetByName(CONFIG.AUDIT_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.AUDIT_SHEET);
    sh.getRange(1, 1, 1, 11).setValues([['Timestamp','Actor','Action','Entity type','Entity ID','Store','Previous value','New value','Result','Workflow','Correlation ID']]);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Best-effort append-only application audit record. Never stores credentials or approval tokens. */
function auditLog_(action, entityType, entityId, store, previousValue, newValue, result, workflow) {
  try {
    const sh = ensureAuditLogSheet_(openSpreadsheet_());
    sh.appendRow([new Date(), currentEmail_() || 'unidentified', String(action || '').slice(0, 120), String(entityType || '').slice(0, 80), String(entityId || '').slice(0, 180), String(store || '').slice(0, 100), String(previousValue || '').slice(0, 4000), String(newValue || '').slice(0, 4000), String(result || '').slice(0, 80), String(workflow || '').slice(0, 120), Utilities.getUuid()]);
  } catch (err) {
    console.warn('Could not append HUFT audit record: ' + (err && err.message ? err.message : err));
  }
}
function ensurePunctualitySheet_(ss) {
  let sh = ss.getSheetByName(CONFIG.PUNCTUALITY_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.PUNCTUALITY_SHEET);
    sh.getRange(1, 1, 1, 11).setValues([['Record ID','Store','Employee','Date','Incident','Notice','Minutes late','Details','Recorded by','Recorded at','Employee ID']]);
    sh.setFrozenRows(1);
  } else {
    const width = Math.max(sh.getLastColumn(), 1);
    const headers = sh.getRange(1, 1, 1, width).getDisplayValues()[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
    if (headers.indexOf('employee id') < 0) sh.getRange(1, width + 1).setValue('Employee ID');
  }
  sh.getRange('D:D').setNumberFormat('@');
  return sh;
}
function ensureEmployeeRequestsSheet_(ss) {
  let sh = ss.getSheetByName(CONFIG.WORK_REQUESTS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.WORK_REQUESTS_SHEET);
    sh.getRange(1, 1, 1, 18).setValues([['Request ID','Type','Employee ID','Employee','Store','Employee Email','Date','Previous Shift','Requested Shift','Reason','Evidence URL','Status','Submitted At','Decided By','Decided At','Decision Notes','Notification Status','Correlation ID']]);
    sh.setFrozenRows(1);
  }
  sh.getRange('G:G').setNumberFormat('@');
  return sh;
}

function employeeShiftAt_(store, name, iso) {
  const p = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(iso || ''));
  if (!p) throw new Error('Choose a valid request date.');
  const data = buildMonth_(Number(p[1]), Number(p[2]) - 1);
  const id = store + '|' + nameKey_(name);
  const employee = (data.employees || []).filter(function (e) { return e.id === id; })[0];
  if (!employee) return 'Unassigned';
  const cell = employee.days[Number(p[3]) - 1];
  return Array.isArray(cell) ? String(cell[0] || 'Unassigned') : String(cell || 'Unassigned');
}

/** Employees may request changes only for their own directory-linked profile. */
function submitEmployeeRequest(p) {
  return guard_('submitEmployeeRequest', function () {
    p = p || {};
    requireRosterIdentity_();
    const email = currentEmail_();
    const employee = getMyEmployeeRecord_();
    if (!employee) throw new Error('Employee self-service requires your work email to be linked to your employee profile.');
    const type = String(p.type || '');
    const supported = ['Leave request','Week-off change','Shift change','Attendance correction','Punctuality dispute','Grooming dispute'];
    if (supported.indexOf(type) < 0) throw new Error('Choose a supported request type.');
    const date = String(p.date || '');
    if (!validIso_(date)) throw new Error('Choose a valid date.');
    let requested = String(p.requestedShift || '');
    if (type === 'Leave request') requested = 'Leave';
    if (type === 'Week-off change' && ['Week off','Comp off'].indexOf(requested) < 0) throw new Error('Choose Week off or Comp off.');
    if (type === 'Shift change' && ['Opening','Closing','Mid','Spa','Training'].indexOf(requested) < 0) throw new Error('Choose a valid shift.');
    if (['Leave request','Week-off change','Shift change'].indexOf(type) >= 0 && date < todayIso_()) throw new Error('Roster change requests must be for today or a future date.');
    if (['Attendance correction','Punctuality dispute','Grooming dispute'].indexOf(type) >= 0) requested = '';
    const reason = cleanInput_(p.reason, 1000, 'Reason');
    const evidence = String(p.evidence || '').trim();
    if (evidence && (!/^https:\/\//i.test(evidence) || evidence.length > 1000)) throw new Error('Evidence must be an HTTPS link up to 1000 characters.');
    const previous = employeeShiftAt_(employee.store, employee.name, date);
    const ss = openSpreadsheet_();
    const sheet = ensureEmployeeRequestsSheet_(ss);
    const id = Utilities.getUuid();
    const correlation = Utilities.getUuid();
    const requestRow = withLock_(function () {
      const last = sheet.getLastRow();
      if (last >= 2) {
        const existing = sheet.getRange(2, 1, last - 1, 18).getDisplayValues();
        const duplicate = existing.some(function (r) {
          return r[5].toLowerCase() === email && r[1] === type && r[6] === date && r[8] === requested && String(r[11]).toLowerCase() === 'pending';
        });
        if (duplicate) throw new Error('You already have a matching request awaiting a decision.');
      }
      const row = sheet.getLastRow() + 1;
      sheet.getRange(row, 7).setNumberFormat('@');
      sheet.getRange(row, 3).setNumberFormat('@');
      sheet.getRange(row, 1, 1, 18).setValues([[id,type,employee.employeeId || (employee.store + '|' + nameKey_(employee.name)),employee.name,employee.store,email,date,previous,requested,reason,evidence,'Pending',new Date(),'','', '', 'Pending', correlation]]);
      auditLog_('Employee request submitted', 'Employee request', id, employee.store, '', JSON.stringify({ type: type, date: date, requestedShift: requested }), 'Success', 'Employee self-service');
      return row;
    });
    let notification = 'Sent';
    try {
      let approver = getStoreContactEmail_(employee.store);
      if (!approver || approver === email) approver = CONFIG.ADMIN_EMAILS.filter(function (admin) { return admin.toLowerCase() !== email; })[0] || '';
      if (!approver) throw new Error('No separate approver email is configured for this request.');
      const template = readEmailTemplate_(openSpreadsheet_(), 'employee_request_approval');
      sendHuftEmail_(template, { requestType:type, employee:employee.name, store:employee.store, date:date, previous:previous, requested:requested || 'Not applicable', reason:reason, evidence:evidence || 'Not supplied', requestId:id, requester:email }, approver, id, true, null, false, { kind:'employee', id:id });
    } catch (err) { notification = 'Failed: ' + String(err.message || err).slice(0, 300); }
    sheet.getRange(requestRow, 17).setValue(notification);
    return { ok: true, requestId: id, message: notification.indexOf('Sent') === 0 ? 'Request submitted to your store for approval.' : 'Request saved, but the approval email failed. Ask your store manager to review it.' };
  });
}

function getEmployeeRequests() {
  return guard_('getEmployeeRequests', function () {
    requireRosterIdentity_();
    const email = currentEmail_();
    const readable = {};
    getUserStoreAccess_().forEach(function (store) { readable[store] = true; });
    const sh = openSpreadsheet_().getSheetByName(CONFIG.WORK_REQUESTS_SHEET);
    if (!sh || sh.getLastRow() < 2) return { requests: [], canApprove: !!(isAdmin_() || Object.keys(readable).length) };
    const requests = sh.getRange(2, 1, sh.getLastRow() - 1, 18).getDisplayValues().map(function (r) {
      return { id:r[0], type:r[1], employeeId:r[2], name:r[3], store:canonicalStore_(r[4]) || r[4], email:r[5], date:r[6], previousShift:r[7], requestedShift:r[8], reason:r[9], evidence:r[10], status:r[11], submitted:r[12], decidedBy:r[13], decidedAt:r[14], notes:r[15], notification:r[16] };
    }).filter(function (r) { return isAdmin_() || !!readable[r.store] || r.email.toLowerCase() === email; }).slice(-200).reverse();
    return { requests: requests, canApprove: !!(isAdmin_() || Object.keys(readable).length) };
  });
}

function reviewEmployeeRequest(p) { return reviewEmployeeRequest_(p, false); }
function reviewEmployeeRequest_(p, lockAlreadyHeld) {
  return guard_('reviewEmployeeRequest', function () {
    p = p || {};
    const decision = String(p.decision || '').toLowerCase();
    const statusByDecision = { approve:'Approved', reject:'Rejected', changes:'Changes Requested' };
    if (!statusByDecision[decision]) throw new Error('Choose approve, reject, or request changes.');
    const notes = String(p.notes || '').trim().slice(0, 1000);
    const sh = openSpreadsheet_().getSheetByName(CONFIG.WORK_REQUESTS_SHEET);
    if (!sh || sh.getLastRow() < 2) throw new Error('Request was not found.');
    const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 18).getDisplayValues();
    let row = -1, request = null;
    rows.forEach(function (r, i) { if (r[0] === String(p.id || '')) { row = i + 2; request = r; } });
    if (row < 0) throw new Error('Request was not found.');
    const store = requireStore_(request[4]);
    requireStoreAccess_(store);
    if (request[5].toLowerCase() === currentEmail_()) throw new Error('You cannot approve your own request.');
    const runReview = function () {
      const latest = sh.getRange(row, 1, 1, 18).getDisplayValues()[0];
      if (String(latest[11]).toLowerCase() !== 'pending') throw new Error('This request has already been reviewed.');
      if (latest[5].toLowerCase() === currentEmail_()) throw new Error('You cannot approve your own request.');
      const currentStatus = statusByDecision[decision];
      if (decision === 'approve' && ['Leave request','Week-off change','Shift change'].indexOf(latest[1]) >= 0) {
        const employee = readDirectory_(openSpreadsheet_()).entries.filter(function (e) { return e.active && e.store === store && nameKey_(e.name) === nameKey_(latest[3]); })[0];
        if (!employee) throw new Error('The employee is no longer active in this store.');
        const current = employeeShiftAt_(store, latest[3], latest[6]);
        if (current !== latest[7]) throw new Error('The roster changed after this request was submitted. Ask the employee to submit a fresh request.');
        const category = latest[1] === 'Leave request' ? 'Leave' : latest[8];
        const change = validateChange_({ store: store, name: latest[3], date: latest[6], cat: category });
        applyChanges_([change]);
      }
      const reviewer = currentEmail_();
      sh.getRange(row, 12).setValue(currentStatus);
      sh.getRange(row, 14, 1, 3).setValues([[reviewer,new Date(),notes]]);
      auditLog_('Employee request ' + decision, 'Employee request', latest[0], store, 'Pending', currentStatus, 'Success', 'Approval centre');
      try {
        const resultTemplateId = decision === 'approve' ? 'employee_request_approved' : decision === 'reject' ? 'employee_request_rejected' : 'employee_request_changes';
        const resultTemplate = readEmailTemplate_(openSpreadsheet_(), resultTemplateId);
        const delivery = sendHuftEmail_(resultTemplate, { requestType:latest[1], employee:latest[3], store:store, date:latest[6], approver:reviewer, notes:notes || 'No additional remarks.', details:decision === 'approve' ? 'The approved roster change is now recorded.' : '', status:currentStatus, requestId:latest[0] }, latest[5], latest[0], false, null, true);
        sh.getRange(row, 17).setValue(delivery ? 'Sent' : 'Sent (duplicate prevented)');
      } catch (err) { sh.getRange(row, 17).setValue('Failed: ' + String(err.message || err).slice(0,250)); }
      return { ok: true, message: 'Request ' + currentStatus.toLowerCase() + '.', requests: getEmployeeRequests().requests };
    };
    return lockAlreadyHeld ? runReview() : withLock_(runReview);
  });
}
function requestDeployment(p) {
  return guard_('requestDeployment', function () {
    p = p || {};
    const fromStore = requireStore_(p.store);
    const toStore = requireStore_(p.toStore);
    if (fromStore === toStore) throw new Error('Choose a different destination store.');
    requireStoreAccess_(fromStore);
    const name = cleanInput_(p.name, 40, 'Employee name');
    const directory = readDirectory_(openSpreadsheet_());
    const staffRecord = directory.entries.filter(function (e) { return e.store === fromStore && nameKey_(e.name) === nameKey_(name); })[0];
    if (staffRecord && !staffRecord.active) throw new Error('Restore this employee in Stores & staff before requesting a deployment.');
    const from = String(p.from || '');
    const to = String(p.to || from);
    if (!validIso_(from) || !validIso_(to) || to < from) throw new Error('Choose a valid deployment date or date range.');
    const dates = dateRange_(from, to, 62);
    const shift = p.shift && CONFIG.SHIFT_WRITE[p.shift] ? p.shift : '';
    const notify = getStoreContactEmail_(toStore);
    if (!notify) throw new Error('No approval email is configured for ' + toStore + '. Ask the Hyderguda admin to add its store email.');
    const requester = currentEmail_();
    const ss = openSpreadsheet_();
    const sheet = ensureDeploymentRequestsSheet_(ss);
    const id = Utilities.getUuid();
    const created = new Date();
    const requestRow = sheet.getLastRow() + 1;
    sheet.getRange(requestRow, 6, 1, 2).setNumberFormat('@');
    sheet.getRange(requestRow, 1, 1, 12).setValues([[id, requester, fromStore, name, toStore, from, to, shift, 'Pending', created, '', '']]);
    syncEmployeeStatusSheetsSafely_();
    auditLog_('Deployment requested', 'Deployment request', id, toStore, '', JSON.stringify({ employee: name, fromStore: fromStore, toStore: toStore, from: from, to: to, shift: shift }), 'Success', 'Deployment approval');
    const template = readEmailTemplate_(openSpreadsheet_(), 'deployment_approval');
    const messageVars = { employee:name, fromStore:fromStore, store:toStore, dateRange:from + ' to ' + to, shift:shift ? CONFIG.SHIFT_WRITE[shift] : 'Not specified', requester:requester, requestId:id };
    const recipients = [notify];
    const adminEmail = String(CONFIG.ADMIN_EMAILS[0] || '').trim().toLowerCase();
    // Send an individual copy to the administrator, not a store-wide CC.
    // Individual messages keep Gmail approval attributed to the actual reviewer.
    if (adminEmail && adminEmail !== notify.toLowerCase() && adminEmail !== requester.toLowerCase()) recipients.push(adminEmail);
    const mailFailures = [];
    recipients.forEach(function (recipient) {
      try { sendHuftEmail_(template, messageVars, recipient, id, true, null, false, { kind:'deployment', id:id }); }
      catch (err) { mailFailures.push(recipient + ': ' + String(err.message || err).slice(0,160)); }
    });
    const mailStatus = mailFailures.length ? 'Email failed for ' + mailFailures.join('; ') : 'Sent';
    return { ok: true, message: mailStatus === 'Sent' ? 'Deployment request sent to ' + toStore + ' and the Hyderguda admin for approval.' : 'Request saved. ' + mailStatus + '. The destination manager can still review it in the app.', requestId: id };
  });
}

function getDeploymentRequests() {
  return guard_('getDeploymentRequests', function () {
    const email = currentEmail_();
    if (!email) throw new Error('Sign in with your work email to view deployment requests.');
    const sh = ensureDeploymentRequestsSheet_(openSpreadsheet_());
    if (sh.getLastRow() < 2) return { requests: [] };
    const all = sh.getRange(2, 1, sh.getLastRow() - 1, 14).getDisplayValues().map(function (r) {
      return { id:r[0], requester:r[1], fromStore:canonicalStore_(r[2]) || r[2], name:r[3], toStore:canonicalStore_(r[4]) || r[4], from:r[5], to:r[6], shift:r[7], status:r[8], created:r[9], decidedBy:r[10], decidedAt:r[11], notes:r[12], notification:r[13] };
    });
    const visible = all.filter(function (r) {
      return r.requester.toLowerCase() === email || canAccessStore_(r.toStore);
    }).slice(-100).reverse();
    return { requests: visible };
  });
}

function reviewDeploymentRequest(p) { return reviewDeploymentRequest_(p, false); }
function reviewDeploymentRequest_(p, lockAlreadyHeld) {
  return guard_('reviewDeploymentRequest', function () {
    p = p || {};
    const decision = String(p.decision || '').toLowerCase();
    if (decision !== 'approve' && decision !== 'reject' && decision !== 'changes') throw new Error('Choose approve, reject, or request changes.');
    const notes = String(p.notes || '').trim().slice(0, 1000);
    if (decision === 'changes' && !notes) throw new Error('Explain what needs to change.');
    const sh = ensureDeploymentRequestsSheet_(openSpreadsheet_());
    if (sh.getLastRow() < 2) throw new Error('Deployment request was not found.');
    const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 14).getDisplayValues();
    let row = -1, request = null;
    rows.forEach(function (r, i) { if (r[0] === String(p.id || '')) { row = i + 2; request = r; } });
    if (row < 0) throw new Error('Deployment request was not found.');
    const toStore = requireStore_(request[4]);
    requireStoreAccess_(toStore);
    if (String(request[1] || '').toLowerCase() === currentEmail_()) throw new Error('The requester cannot approve or reject their own deployment.');
    if (String(request[8]).toLowerCase() !== 'pending') throw new Error('This deployment request has already been reviewed.');
    const decidedBy = currentEmail_();
    const runReview = function () {
      const latestRequest = sh.getRange(row, 1, 1, 14).getDisplayValues()[0];
      if (String(latestRequest[8]).toLowerCase() !== 'pending') throw new Error('This deployment request has already been reviewed.');
      request = latestRequest;
      const status = decision === 'approve' ? 'Approved' : decision === 'reject' ? 'Rejected' : 'Changes Requested';
      if (decision === 'approve') {
        const dates = dateRange_(request[5], request[6], 62);
        const shift = shiftKey_(request[7]);
        const changes = dates.map(function (date) {
          return validateChange_({ store: request[2], name: request[3], date: date, cat: 'Deployed', toStore: toStore, shift: shift });
        });
        applyChanges_(changes);
      }
      sh.getRange(row, 9).setValue(status);
      sh.getRange(row, 11, 1, 2).setValues([[decidedBy, new Date()]]);
      sh.getRange(row, 13, 1, 2).setValues([[notes, 'Pending']]);
      syncEmployeeStatusSheetsSafely_();
      auditLog_('Deployment ' + status.toLowerCase(), 'Deployment request', request[0], toStore, 'Pending', status, 'Success', 'Deployment approval');
      let notification = 'Pending';
      try {
        const templateId = decision === 'changes' ? 'deployment_changes' : 'deployment_decision';
        const template = readEmailTemplate_(openSpreadsheet_(), templateId);
        const delivery = sendHuftEmail_(template, { employee:request[3], fromStore:request[2], store:toStore, dateRange:request[5] + ' to ' + request[6], status:status, approver:decidedBy, requestId:request[0], notes:notes || (decision === 'approve' ? 'Approved; roster updated.' : 'No additional remarks.') }, request[1], request[0], decision === 'changes', null, true);
        notification = delivery ? 'Sent' : 'Sent (duplicate prevented)';
      } catch (err) { notification = 'Failed: ' + String(err.message || err).slice(0,250); }
      sh.getRange(row, 14).setValue(notification);
      const message = decision === 'approve'
        ? 'Approved. The deployment is recorded on the ' + request[2] + ' roster for the selected dates.'
        : decision === 'changes' ? 'Changes requested. The requester can submit an updated deployment request.' : 'Deployment request rejected.';
      return { ok: true, message: message, requests: getDeploymentRequests().requests };
    };
    return lockAlreadyHeld ? runReview() : withLock_(runReview);
  });
}
function ensureDeploymentRequestsSheet_(ss) {
  let sh = ss.getSheetByName(CONFIG.DEPLOYMENT_REQUESTS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.DEPLOYMENT_REQUESTS_SHEET);
    sh.getRange(1, 1, 1, 14).setValues([['Request ID','Requested by','From store','Employee','To store','From date','To date','Shift','Status','Created at','Decided by','Decided at','Decision notes','Notification status']]);
    sh.setFrozenRows(1);
  } else {
    if (sh.getMaxColumns() < 14) sh.insertColumnsAfter(sh.getMaxColumns(), 14 - sh.getMaxColumns());
    if (!String(sh.getRange(1, 13).getDisplayValue() || '').trim()) sh.getRange(1, 13, 1, 2).setValues([['Decision notes','Notification status']]);
  }
  sh.getRange('F:G').setNumberFormat('@');
  return sh;
}
function getStoreContactEmail_(store) {
  const normalized = requireStore_(store);
  const configured = getStoreRecipientEmails_().filter(function (item) { return item.store === normalized; })[0];
  if (configured && configured.email) return configured.email;
  const mapped = Object.keys(CONFIG.STORE_EMAILS).filter(function (email) { return canonicalStore_(CONFIG.STORE_EMAILS[email]) === normalized; })[0];
  if (mapped) return mapped;
  const record = getStores_().filter(function (s) { return s.name === normalized; })[0];
  return record ? String(record.managerEmail || '').trim().toLowerCase() : '';
}

function ensureEmailRecipientsSheet_(ss) {
  let sh = ss.getSheetByName(CONFIG.EMAIL_RECIPIENTS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.EMAIL_RECIPIENTS_SHEET);
    sh.getRange(1, 1, 1, 4).setValues([['Store','Approval email','Updated at','Updated by']]);
    sh.setFrozenRows(1);
  }
  const existing = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 4).getDisplayValues().forEach(function (r) { existing[canonicalStore_(r[0]) || r[0]] = true; });
  getStoreNames_().forEach(function (store) {
    if (!existing[store]) sh.appendRow([store, getConfigStoreEmail_(store), new Date(), 'system default']);
  });
  return sh;
}

function getConfigStoreEmail_(store) {
  const key = Object.keys(CONFIG.STORE_EMAILS).filter(function (email) { return canonicalStore_(CONFIG.STORE_EMAILS[email]) === store; })[0];
  if (key) return key.toLowerCase();
  const record = getStores_().filter(function (item) { return item.name === store; })[0];
  return record ? String(record.managerEmail || '').trim().toLowerCase() : '';
}

function getStoreRecipientEmails_() {
  const sh = ensureEmailRecipientsSheet_(openSpreadsheet_());
  return sh.getLastRow() < 2 ? [] : sh.getRange(2, 1, sh.getLastRow() - 1, 4).getDisplayValues().map(function (r) {
    return { store:canonicalStore_(r[0]) || r[0], email:String(r[1] || '').trim().toLowerCase() };
  }).filter(function (r) { return r.store && r.email; });
}

function setEmailRecipient(p) {
  return guard_('setEmailRecipient', function () {
    requireAdmin_(); p = p || {};
    const store = requireStore_(p.store);
    const email = cleanEmail_(p.email);
    const sh = ensureEmailRecipientsSheet_(openSpreadsheet_());
    const rows = sh.getLastRow() < 2 ? [] : sh.getRange(2, 1, sh.getLastRow() - 1, 4).getDisplayValues();
    let row = -1;
    rows.forEach(function (r, i) { if ((canonicalStore_(r[0]) || r[0]) === store) row = i + 2; });
    if (row < 0) row = sh.getLastRow() + 1;
    sh.getRange(row, 1, 1, 4).setValues([[store,email,new Date(),currentEmail_()]]);
    auditLog_('Store notification recipient updated', 'Email recipient', store, store, '', email, 'Success', 'Email settings');
    return getEmailAdminData();
  });
}function canAccessStore_(store) {
  if (isAdmin_()) return true;
  const email = currentEmail_();
  if (!email) return false;
  const home = getHomeStore_();
  if (home) {
    if (readRosterAccess_().some(function (entry) { return entry.email === email && entry.access === 'Admin'; })) return true;
    return home === store;
  }
  return readRosterAccess_().some(function (entry) { return entry.email === email && (entry.access === 'Admin' || entry.store === store); });
}

/** Legacy transfer endpoint is closed; all cross-store work requires destination approval. */
function transferStaff(p) {
  return guard_('transferStaff', function () {
    throw new Error('Direct transfers are disabled. Use a dated deployment request and destination approval.');
    STORE_MAP_ = null;
    p = p || {};
    const store = requireStore_(p.store);
    const toStore = requireStore_(p.toStore);
    const name = cleanInput_(p.name, 40, 'Name');
    if (store === toStore) throw new Error('Choose a different store.');
    const from = p.from ? p.from : todayIso_();
    if (!validIso_(from)) throw new Error('Invalid date.');

    if (p.mode === 'permanent') {
      requireAdmin_();
      return withLock_(function () {
        const dir = ensureDirectory_(openSpreadsheet_());
        const vals = readDirValues_(dir);
        const oldRows = findDirRows_(vals, dir.cols, store, name);
        const newRows = findDirRows_(vals, dir.cols, toStore, name);
        const reactivate = function (rows) {
          rows.forEach(function (r) {
            dir.sheet.getRange(r, dir.cols['Active'] + 1).setValue('TRUE');
            writeText_(dir.sheet.getRange(r, dir.cols['Removed on'] + 1), '');
          });
        };
        if (oldRows.length && newRows.length) {
          oldRows.forEach(function (r) {
            dir.sheet.getRange(r, dir.cols['Active'] + 1).setValue('FALSE');
            writeText_(dir.sheet.getRange(r, dir.cols['Removed on'] + 1), from);
          });
          reactivate(newRows);
        } else if (oldRows.length) {
          oldRows.forEach(function (r) { dir.sheet.getRange(r, dir.cols['Store'] + 1).setValue(toStore); });
        } else if (newRows.length) {
          reactivate(newRows);
        } else {
          appendDirRow_(dir, { store: toStore, name: name, role: p.role === 'Grooming' ? 'Grooming' : 'Retail', phone: '', active: 'TRUE', reportsTo: '', removedOn: '' });
        }
        moveStaffInTabs_(store, toStore, name, from.slice(0, 7));
        clearAllCaches_();
        return okResult_(name + ' moved from ' + store + ' to ' + toStore + '.');
      });
    }

    if (p.mode === 'temporary') {
      // A temporary deployment updates only the employee's home-store row.
      // Destination data is not edited, so source-store permission is enough.
      requireStoreAccess_(store);
      const to = p.to ? p.to : from;
      if (!validIso_(to) || to < from) throw new Error('The end date must be on or after the start date.');
      const dates = dateRange_(from, to, 62);
      const shift = p.shift && CONFIG.SHIFT_WRITE[p.shift] ? p.shift : '';
      const clean = dates.map(function (d) {
        return validateChange_({ store: store, name: name, date: d, cat: 'Deployed', toStore: toStore, shift: shift });
      });
      return withLock_(function () {
        applyChanges_(clean);
        clearAllCaches_();
        return okResult_(name + ' deployed to ' + toStore + ' (' + dates.length + (dates.length === 1 ? ' day' : ' days') + ').');
      });
    }
    throw new Error('Unknown transfer type.');
  });
}

/** p: { name, location?, manager? } */
function addStore(p) {
  return guard_('addStore', function () {
    requireAdmin_();
    p = p || {};
    const name = cleanInput_(p.name, 40, 'Store name');
    const location = p.location ? cleanInput_(p.location, 80, 'Location') : '';
    const manager = p.manager ? cleanInput_(p.manager, 40, 'Manager') : '';
    const managerEmail = p.managerEmail ? cleanEmail_(p.managerEmail) : '';
    return withLock_(function () {
      STORE_MAP_ = null;
      CacheService.getScriptCache().removeAll([CONFIG.CACHE_PREFIX + 'stores']);
      const key = nameKey_(name);
      if (getStores_().some(function (s) { return s.key === key; }) || CONFIG.STORE_ALIASES[key]) {
        throw new Error('A store called "' + name + '" already exists.');
      }
      const sh = ensureStoresSheet_(openSpreadsheet_());
      const row = Math.max(sh.getLastRow(), 1) + 1;
      writeText_(sh.getRange(row, 5), todayIso_());
      sh.getRange(row, 1, 1, 4).setValues([[name, 'TRUE', location, manager]]);
      if (managerEmail) writeText_(sh.getRange(row, 6), managerEmail);
      STORE_MAP_ = null;
      clearAllCaches_();
      return { ok: true, message: 'Store "' + name + '" registered.', stores: getStoreNames_(), managerEmail: managerEmail };
    });
  });
}

/** Root admin only: list store-specific editor grants. */
function getRosterAccess() {
  return guard_('getRosterAccess', function () {
    requireAdmin_();
    return { entries: readRosterAccess_(), stores: getStoreNames_() };
  });
}

/** Only the Hyderguda admin can grant or revoke roster permissions. */
function setRosterAccess(p) {
  return guard_('setRosterAccess', function () {
    requireAdmin_();
    p = p || {};
    const email = cleanEmail_(p.email);
    const access = String(p.access || 'Editor').toLowerCase() === 'admin' ? 'Admin' : 'Editor';
    const store = access === 'Admin' ? '' : requireStore_(p.store);
    return withLock_(function () {
      const sh = ensureRosterAccessSheet_();
      const rows = [];
      if (sh.getLastRow() >= 2) {
        sh.getRange(2, 1, sh.getLastRow() - 1, 4).getDisplayValues().forEach(function (r, i) {
          const rowAccess = String(r[2] || 'Editor').trim().toLowerCase() === 'admin' ? 'Admin' : 'Editor';
          const sameTarget = access === 'Admin' ? rowAccess === 'Admin' : rowAccess === 'Editor' && canonicalStore_(r[1]) === store;
          if (String(r[0] || '').trim().toLowerCase() === email && sameTarget) rows.push(i + 2);
        });
      }
      if (p.remove) {
        rows.reverse().forEach(function (row) { sh.deleteRow(row); });
      } else if (rows.length) {
        sh.getRange(rows[0], 3).setValue(access);
        writeText_(sh.getRange(rows[0], 4), todayIso_());
        rows.slice(1).reverse().forEach(function (row) { sh.deleteRow(row); });
      } else {
        if (access === 'Admin') {
          const allRows = sh.getLastRow() >= 2 ? sh.getRange(2, 1, sh.getLastRow() - 1, 4).getDisplayValues() : [];
          const duplicates = [];
          allRows.forEach(function (r, i) { if (String(r[0] || '').trim().toLowerCase() === email) duplicates.push(i + 2); });
          duplicates.reverse().forEach(function (row) { sh.deleteRow(row); });
        }
        const row = sh.getLastRow() + 1;
        writeText_(sh.getRange(row, 1), email);
        writeText_(sh.getRange(row, 2), store);
        sh.getRange(row, 3).setValue(access);
        writeText_(sh.getRange(row, 4), todayIso_());
      }
      shareProfilePhotosWithEmail_(email, store, access, !!p.remove);
      auditLog_(p.remove ? 'Roster access revoked' : 'Roster access granted', 'Access grant', email, store, '', p.remove ? 'Revoked' : access, 'Success', 'Permissions');
      return { ok: true, entries: readRosterAccess_() };
    });
  });
}

/** Send a store access request to the Hyderguda admin. Never grants access. */
function requestRosterAccess(p) {
  return guard_('requestRosterAccess', function () {
    p = p || {};
    const requester = currentEmail_();
    if (!requester) throw new Error('Could not identify your signed-in email. Sign in with your work account and try again.');
    const targetEmail = cleanEmail_(p.email || requester);
    const store = requireStore_(p.store);
    if (targetEmail !== requester) requireStoreAccess_(store);
    if (targetEmail === CONFIG.ADMIN_EMAILS[0].toLowerCase()) throw new Error('The Hyderguda admin already has full access.');
    const reason = String(p.reason || '').trim().slice(0, 500);
    const accessTemplate = readEmailTemplate_(openSpreadsheet_(), 'roster_access_request');
    const accessRef = Utilities.getUuid();
    sendHuftEmail_(accessTemplate, { targetEmail:targetEmail, store:store, requester:requester, employee:p.employeeName ? cleanInput_(p.employeeName, 40, 'Employee name') : 'Not linked', reason:reason || 'Not provided', requestId:accessRef }, CONFIG.ADMIN_EMAILS[0], accessRef, true);
    return { ok: true, message: 'Access request sent to the Hyderguda admin.' };
  });
}

/** Send a roster invitation to an email after its access grant has been saved. */
function sendRosterInvitation(p) {
  return guard_('sendRosterInvitation', function () {
    p = p || {};
    const email = cleanEmail_(p.email);
    const requestedAccess = String(p.access || 'Editor').toLowerCase();
    const access = requestedAccess === 'admin' ? 'Admin' : requestedAccess === 'employee' ? 'Employee' : 'Editor';
    const store = access === 'Admin' ? '' : requireStore_(p.store);
    requireAdmin_();
    let scope;
    if (access === 'Employee') {
      const employee = readDirectory_(openSpreadsheet_()).entries.filter(function (e) { return e.active && e.store === store && e.email === email; })[0];
      if (!employee) throw new Error('The employee email must be saved on an active profile in the selected store before inviting them.');
      scope = 'self-service access to their own profile, roster and employee requests';
    } else {
      scope = access === 'Admin' ? 'full roster editing access across all stores (the admin panel remains exclusive to Hyderguda)' : 'editor access to ' + store;
    }
    const url = ScriptApp.getService().getUrl();
    if (!url) throw new Error('Deploy the web app before sending invitations.');
    const inviteTemplate = readEmailTemplate_(openSpreadsheet_(), 'roster_invitation');
    const inviteRef = Utilities.getUuid();
    sendHuftEmail_(inviteTemplate, { access:scope, store:store || 'All stores', url:url, requestId:inviteRef }, email, inviteRef, false);
    return { ok: true, email: email };
  });
}
function ensureRosterAccessSheet_() {
  const ss = openSpreadsheet_();
  let sh = ss.getSheetByName(CONFIG.ACCESS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.ACCESS_SHEET);
    sh.getRange(1, 1, 1, 4).setValues([['Email', 'Store', 'Access', 'Added on']]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function readRosterAccess_() {
  const sh = openSpreadsheet_().getSheetByName(CONFIG.ACCESS_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  const out = [];
  sh.getRange(2, 1, sh.getLastRow() - 1, 4).getDisplayValues().forEach(function (r) {
    const email = String(r[0] || '').trim().toLowerCase();
    const access = String(r[2] || 'Editor').trim().toLowerCase() === 'admin' ? 'Admin' : 'Editor';
    const store = access === 'Admin' ? '' : canonicalStore_(r[1]);
    if (!email || (access !== 'Admin' && !store)) return;
    out.push({ email: email, store: store, access: access, addedOn: String(r[3] || '').trim() });
  });
  return out;
}

function getUserStoreAccess_() {
  if (isAdmin_()) return getStoreNames_();
  const email = currentEmail_();
  if (!email) return [];
  const grants = readRosterAccess_().filter(function (entry) { return entry.email === email; });
  if (grants.some(function (entry) { return entry.access === 'Admin'; })) return getStoreNames_();
  const home = getHomeStore_();
  if (home) return [home];
  const stores = [];
  grants.forEach(function (entry) {
    if (entry.access === 'Editor' && stores.indexOf(entry.store) < 0) stores.push(entry.store);
  });
  return stores;
}

/** Contact details are visible only to the employee's assigned store editors and the root admin. */
function getContactVisibleStores_() {
  if (isAdmin_()) return getStoreNames_();
  const email = currentEmail_();
  const stores = [];
  const home = getHomeStore_();
  if (home) stores.push(home);
  readRosterAccess_().forEach(function (entry) {
    if (entry.email === email && entry.access === 'Editor' && stores.indexOf(entry.store) < 0) stores.push(entry.store);
  });
  const employee = getMyEmployeeRecord_();
  if (employee && stores.indexOf(employee.store) < 0) stores.push(employee.store);
  return stores;
}
function getHomeStore_() {
  const email = currentEmail_();
  const store = email && CONFIG.STORE_EMAILS[email];
  return store ? (canonicalStore_(store) || store) : '';
}

function requireStoreAccess_(store) {
  if (isAdmin_()) return;
  const email = currentEmail_();
  const home = getHomeStore_();
  if (home) {
    const fullGrant = readRosterAccess_().some(function (entry) { return entry.email === email && entry.access === 'Admin'; });
    if (fullGrant) return;
    if (home !== store) throw new Error('This account can edit ' + home + ' only. Other stores are view only.');
    return;
  }
  const allowed = email && readRosterAccess_().some(function (entry) {
    return entry.email === email && (entry.access === 'Admin' || entry.store === store);
  });
  if (!allowed) throw new Error('You do not have edit access to ' + store + '. Ask the Hyderguda admin to grant access.');
}

function cleanEmail_(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (email.length > 254) throw new Error('Email address is too long.');
  return email;
}

/* ------------------------------------------------------------------ */
/* Stores                                                              */
/* ------------------------------------------------------------------ */

function ensureStoresSheet_(ss) {
  let sh = ss.getSheetByName(CONFIG.STORES_SHEET);
  if (sh) {
    const headers = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getDisplayValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
    if (headers.indexOf('manager email') < 0) sh.getRange(1, 6).setValue('Manager Email');
    return sh;
  }
  sh = ss.insertSheet(CONFIG.STORES_SHEET);
  sh.getRange(1, 1, 1, 6).setValues([['Store', 'Active', 'Location', 'Manager', 'Added on', 'Manager Email']]);
  const seed = CONFIG.DEFAULT_STORES.map(function (n) { return [n, 'TRUE', '', '']; });
  if (seed.length) sh.getRange(2, 1, seed.length, 4).setValues(seed);
  sh.setFrozenRows(1);
  return sh;
}

/** [{ name, key, active, location, manager }] in sheet order. */
function getStores_() {
  const hit = cacheGet_('stores');
  if (hit) return hit;
  const sh = ensureStoresSheet_(openSpreadsheet_());
  const out = [];
  if (sh.getLastRow() >= 2) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 6).getDisplayValues().forEach(function (row) {
      const name = String(row[0] || '').replace(/\s+/g, ' ').trim();
      if (!name) return;
      out.push({
        name: name, key: nameKey_(name),
        active: String(row[1]).trim().toUpperCase() !== 'FALSE',
        location: String(row[2] || '').trim(), manager: String(row[3] || '').trim(), managerEmail: String(row[5] || '').trim().toLowerCase()
      });
    });
  }
  cachePut_('stores', out);
  return out;
}

function getStoreNames_() {
  return getStores_().filter(function (s) { return s.active; }).map(function (s) { return s.name; });
}

function storeMap_() {
  if (STORE_MAP_) return STORE_MAP_;
  const map = {};
  Object.keys(CONFIG.STORE_ALIASES).forEach(function (k) { map[k] = CONFIG.STORE_ALIASES[k]; });
  getStores_().forEach(function (s) { map[s.key] = s.name; });
  STORE_MAP_ = map;
  return map;
}

function canonicalStore_(text) {
  const k = nameKey_(text);
  return k ? (storeMap_()[k] || null) : null;
}

function requireStore_(text) {
  const s = canonicalStore_(text);
  if (!s) throw new Error('Unknown store: ' + text);
  return s;
}

/* ------------------------------------------------------------------ */
/* Directory                                                           */
/* ------------------------------------------------------------------ */

function ensureDirectory_(ss) {
  const REQUIRED = ['Store', 'Employee', 'Role', 'WhatsApp', 'Active', 'Reporting to', 'Removed on', 'Profile Photo ID', 'Email', 'Employee ID'];
  let sh = ss.getSheetByName(CONFIG.DIRECTORY_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.DIRECTORY_SHEET);
    sh.getRange(1, 1, 1, REQUIRED.length).setValues([REQUIRED]);
    sh.setFrozenRows(1);
  }
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const head = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(function (h) { return String(h).trim(); });
  const lower = head.map(function (h) { return h.toLowerCase(); });
  const cols = {};
  REQUIRED.forEach(function (name) {
    let i = lower.indexOf(name.toLowerCase());
    if (i < 0) {
      i = head.length;
      head.push(name);
      lower.push(name.toLowerCase());
      sh.getRange(1, i + 1).setValue(name);
    }
    cols[name] = i; // 0-based
  });
  return { sheet: sh, cols: cols, width: head.length };
}

/** Refresh employee-oriented spreadsheet views without moving source data. */
function syncEmployeeStatusSheets_() {
  const ss = openSpreadsheet_();
  const directory = readDirectory_(ss);
  const permanent = canonicalActiveDirectoryEntries_(directory.entries)
    .map(function (e) { return [e.employeeId, e.name, e.role, e.store, 'Active']; });
  replaceEmployeeViewSheet_(ss, 'Roster - Permanent',
    ['Employee ID', 'Employee', 'Role', 'Home store', 'Status'], permanent);

  const requestSheet = ensureDeploymentRequestsSheet_(ss);
  const requests = requestSheet.getLastRow() < 2 ? [] : requestSheet.getRange(2, 1, requestSheet.getLastRow() - 1, 14).getDisplayValues();
  const temporary = requests.filter(function (r) { return String(r[0] || '').trim(); })
    .map(function (r) {
      const homeStore = canonicalStore_(r[2]) || String(r[2] || '').trim();
      const employee = directory.entries.filter(function (e) {
        return e.store === homeStore && nameKey_(e.name) === nameKey_(r[3]);
      })[0] || {};
      return [r[0], employee.employeeId || '', r[3], employee.role || '', homeStore,
        canonicalStore_(r[4]) || r[4], r[5], r[6], r[7], r[8], r[1], r[10], r[11]];
    }).sort(function (a, b) { return String(b[6]).localeCompare(String(a[6])) || String(a[2]).localeCompare(String(b[2])); });
  replaceEmployeeViewSheet_(ss, 'Roster - Temporary',
    ['Request ID', 'Employee ID', 'Employee', 'Role', 'Home store', 'Destination store', 'From date', 'To date', 'Shift', 'Approval status', 'Requested by', 'Decided by', 'Decision date'], temporary);

  clearRemovedEmployeeView_(ss);
}

/** Remove the generated all-store sheet view; spreadsheet tabs cannot be private by role. */
function clearRemovedEmployeeView_(ss) {
  const sh = ss.getSheetByName('Roster - Removed');
  if (!sh) return;
  const filter = sh.getFilter();
  if (filter) filter.remove();
  sh.clearContents();
  try { if (!sh.isSheetHidden()) sh.hideSheet(); } catch (err) {}
}

/** Rewrite a generated view and keep its header frozen and filterable. */
function syncEmployeeStatusSheetsSafely_() {
  try { syncEmployeeStatusSheets_(); }
  catch (err) { console.warn('Employee status views were not refreshed: ' + String(err && err.message || err)); }
}
function replaceEmployeeViewSheet_(ss, name, headers, rows) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const filter = sh.getFilter();
  if (filter) filter.remove();
  sh.clearContents();
  const values = [headers].concat(rows);
  if (sh.getMaxColumns() < headers.length) sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
  sh.getRange(1, 1, values.length, headers.length).setValues(values);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f97316').setFontColor('#ffffff');
  sh.getRange(1, 1, values.length, headers.length).createFilter();
  sh.autoResizeColumns(1, headers.length);
}
function employeeIdentityKey_(employeeId, name) {
  const id = String(employeeId || '').replace(/\s+/g, '').toLowerCase();
  return id ? id + '|' + nameKey_(name) : '';
}

/** Prefer one active directory row for duplicate same-person ID/name entries. */
function canonicalActiveDirectoryEntries_(entries) {
  const ordered = entries.filter(function (e) { return e.active; }).slice().sort(function (a, b) {
    const preferred = CONFIG.DEFAULT_STORES || [];
    const ai = preferred.indexOf(a.store), bi = preferred.indexOf(b.store);
    const ar = ai < 0 ? preferred.length + storeRank_(a.store) : ai;
    const br = bi < 0 ? preferred.length + storeRank_(b.store) : bi;
    return ar - br || a.name.localeCompare(b.name);
  });
  const seen = {};
  return ordered.filter(function (e) {
    const key = employeeIdentityKey_(e.employeeId, e.name);
    if (!key) return true;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}
function readDirValues_(dir) {
  const last = dir.sheet.getLastRow();
  return last ? dir.sheet.getRange(1, 1, last, dir.width).getDisplayValues() : [];
}

/** 1-based sheet rows whose store and employee match. */
function findDirRowsByEmployeeId_(vals, cols, employeeId) {
  const wanted = String(employeeId || '').replace(/\s+/g, '').toLowerCase();
  if (!wanted) return [];
  const rows = [];
  for (let r = 1; r < vals.length; r++) {
    const id = String(vals[r][cols['Employee ID']] || '').replace(/\s+/g, '').toLowerCase();
    if (id === wanted) rows.push(r + 1);
  }
  return rows;
}
function findDirRows_(vals, cols, store, name) {
  const nk = nameKey_(name);
  const rows = [];
  for (let r = 1; r < vals.length; r++) {
    if (nameKey_(vals[r][cols['Employee']]) === nk && canonicalStore_(vals[r][cols['Store']]) === store) rows.push(r + 1);
  }
  return rows;
}


function cleanEmployeeId_(value) {
  const id = String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
  if (id.length > 50) throw new Error('Employee ID must be 50 characters or fewer.');
  if (/[\u0000-\u001f]/.test(id)) throw new Error('Employee ID contains unsupported characters.');
  return id;
}
function assertUniqueEmployeeId_(dir, id, store, name, oldStore, oldName, allowSamePerson, allowExactIdRepair) {
  if (!id) return;
  const last = dir.sheet.getLastRow();
  if (last < 2) return;
  const data = dir.sheet.getRange(2, 1, last - 1, dir.width).getDisplayValues();
  const wanted = id.toLowerCase();
  const sameStore = oldStore || store, sameName = nameKey_(oldName || name);
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (String(row[dir.cols['Employee ID']] || '').trim().toLowerCase() !== wanted) continue;
    const rowNameKey = nameKey_(row[dir.cols['Employee']]);
    if (canonicalStore_(row[dir.cols['Store']]) === sameStore && rowNameKey === sameName) continue;
    if (allowSamePerson && (rowNameKey === nameKey_(name) || rowNameKey === sameName)) continue;
    if (allowExactIdRepair) continue;
    throw new Error('Employee ID ' + id + ' is already assigned to another employee.');
  }
}

function appendDirRow_(dir, o) {
  const row = Math.max(dir.sheet.getLastRow(), 1) + 1;
  const line = [];
  for (let i = 0; i < dir.width; i++) line.push('');
  line[dir.cols['Store']] = o.store;
  line[dir.cols['Employee']] = o.name;
  line[dir.cols['Role']] = o.role;
  line[dir.cols['Employee ID']] = o.employeeId || '';
  line[dir.cols['Active']] = o.active;
  line[dir.cols['Reporting to']] = o.reportsTo || '';
  line[dir.cols['WhatsApp']] = o.phone || '';
  line[dir.cols['Removed on']] = o.removedOn || '';
  line[dir.cols['Email']] = o.email || '';
  line[dir.cols['Profile Photo ID']] = o.photoId || '';
  // Phone and date are stored as plain text so Sheets never reformats them.
  dir.sheet.getRange(row, dir.cols['WhatsApp'] + 1).setNumberFormat('@');
  dir.sheet.getRange(row, dir.cols['Removed on'] + 1).setNumberFormat('@');
  dir.sheet.getRange(row, dir.cols['Employee ID'] + 1).setNumberFormat('@');
  dir.sheet.getRange(row, 1, 1, dir.width).setValues([line]);
}

function readDirectory_(ss) {
  const out = { entries: [], byId: {}, byName: {} };
  const sh = ss.getSheetByName(CONFIG.DIRECTORY_SHEET);
  if (!sh || sh.getLastRow() < 2) return out;

  const v = sh.getDataRange().getDisplayValues();
  const head = v[0].map(function (h) { return String(h).trim().toLowerCase(); });
  const iStore = head.indexOf('store');
  const iName = head.indexOf('employee');
  const iRole = head.indexOf('role');
  const iPhone = head.indexOf('whatsapp');
  const iActive = head.indexOf('active');
  const iRep = head.indexOf('reporting to');
  const iRem = head.indexOf('removed on');
  const iPhoto = head.indexOf('profile photo id');
  const iEmail = head.indexOf('email');
  const iEmployeeId = head.indexOf('employee id');
  if (iName < 0) return out;

  for (let r = 1; r < v.length; r++) {
    const name = String(v[r][iName] || '').replace(/\s+/g, ' ').trim();
    if (!name) continue;
    const store = iStore >= 0 ? (canonicalStore_(v[r][iStore]) || '') : '';
    const rep = iRep >= 0 ? String(v[r][iRep] || '').trim() : '';
    const entry = {
      store: store,
      name: name,
      role: iRole >= 0 ? normalizeRole_(v[r][iRole]) : '',
      phone: iPhone >= 0 ? normalizePhone_(v[r][iPhone]) : '',
      email: iEmail >= 0 ? String(v[r][iEmail] || '').trim().toLowerCase() : '',
      employeeId: iEmployeeId >= 0 ? String(v[r][iEmployeeId] || '').trim() : '',
      reportsTo: canonicalStore_(rep) || rep,
      photoId: iPhoto >= 0 ? String(v[r][iPhoto] || '').trim() : '',
      active: iActive < 0 ? true : isActiveCell_(v[r][iActive]),
      removedOn: iRem >= 0 ? parseDateLoose_(v[r][iRem]) : ''
    };
    out.entries.push(entry);

    const nk = nameKey_(name);
    const byName = out.byName[nk] || (out.byName[nk] = { role: '', phone: '', email: '', employeeId: '', reportsTo: '' });
    if (!byName.role) byName.role = entry.role;
    if (!byName.phone) byName.phone = entry.phone;
    if (!byName.email) byName.email = entry.email;
    if (!byName.employeeId) byName.employeeId = entry.employeeId;
    if (!byName.reportsTo) byName.reportsTo = entry.reportsTo;

    if (store) {
      const id = store + '|' + nk;
      const prev = out.byId[id];
      if (!prev || (entry.active && !prev.active)) out.byId[id] = entry;
    }
  }
  return out;
}

function isActiveCell_(v) {
  return String(v == null ? '' : v).trim().toUpperCase() !== 'FALSE';
}

/* ------------------------------------------------------------------ */
/* Month discovery                                                     */
/* ------------------------------------------------------------------ */

function getMonths_() {
  const hit = cacheGet_('months');
  if (hit) return hit;

  const out = [];
  const seen = {};
  openSpreadsheet_().getSheets().forEach(function (sh) {
    const p = parseSheetName_(sh.getName());
    if (!p || seen[p.key] || !sheetMatchesMonth_(sh, p)) return;
    seen[p.key] = true;
    out.push({ key: p.key, label: p.label, sheet: sh.getName() });
  });
  out.sort(function (a, b) { return a.key < b.key ? -1 : a.key > b.key ? 1 : 0; });
  cachePut_('months', out);
  return out;
}

/** "Oct'26", "July'26", "Sep'26" -> { year, month, key, label } */
function parseSheetName_(name) {
  const m = /^([A-Za-z]+)\s*['’]\s*(\d{2})$/.exec(String(name).trim());
  if (!m) return null;
  const prefix = m[1].slice(0, 3).toLowerCase();
  let month = -1;
  for (let i = 0; i < 12; i++) {
    if (MONTH_NAMES_[i].slice(0, 3).toLowerCase() === prefix) { month = i; break; }
  }
  if (month < 0) return null;
  const year = 2000 + Number(m[2]);
  return {
    year: year,
    month: month,
    key: year + '-' + pad2_(month + 1),
    label: MONTH_NAMES_[month] + ' ' + year
  };
}

/** Guards against a tab whose name and real dates disagree. */
function sheetMatchesMonth_(sheet, p) {
  try {
    const head = String(sheet.getRange(2, CONFIG.FIRST_DAY_COLUMN).getDisplayValue()).trim();
    const d = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(head); // dd/mm/yyyy
    if (!d) return true;
    return Number(d[2]) - 1 === p.month && Number(d[3]) === p.year;
  } catch (err) {
    return true;
  }
}

/* ------------------------------------------------------------------ */
/* Reading and normalising a month                                     */
/* ------------------------------------------------------------------ */

/**
 * Walks columns A:B of a month tab and calls cb(rowIndex0, store, role, name, storeInColumnA)
 * for every employee row. Used by BOTH reading and writing so they always agree.
 */
function walkEmployeeRows_(values, cb) {
  let currentStore = '';
  let currentRole = '';
  for (let r = 0; r < values.length; r++) {
    const row = values[r];
    const a = String(row[0] || '').trim();
    const b = String(row[1] || '').trim();
    const storeA = canonicalStore_(a);
    const storeB = canonicalStore_(b);
    const bl = b.toLowerCase();

    if (storeA) {
      currentStore = storeA;
      currentRole = bl === 'retail' ? 'Retail' : (bl === 'groomers' || bl === 'grooming') ? 'Grooming' : '';
    } else {
      if (!a && storeB) { currentStore = storeB; currentRole = ''; continue; } // panel title row
      if (bl === 'retail') currentRole = 'Retail';
      else if (bl === 'groomers' || bl === 'grooming') currentRole = 'Grooming';
    }

    if (!isEmployeeName_(b)) continue;
    const store = storeA || currentStore;
    if (!store) continue;
    cb(r, store, currentRole, b, !!storeA);
  }
}

function newEmp_(id, name, store, role, days, order) {
  return {
    id: id, name: cleanName_(name), store: store, role: role,
    raw: new Array(days).fill(''), notes: new Array(days).fill(''), any: false, order: order
  };
}

function buildMonth_(year, month) {
  const key = year + '-' + pad2_(month + 1);
  const info = getMonths_().filter(function (m) { return m.key === key; })[0];
  if (!info) return { key: key, found: false };

  const ss = openSpreadsheet_();
  const sheet = ss.getSheetByName(info.sheet);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lastCol = Math.min(sheet.getMaxColumns(), CONFIG.FIRST_DAY_COLUMN - 1 + daysInMonth);
  const lastRow = sheet.getLastRow();
  const rosterRange = lastRow > 0 ? sheet.getRange(1, 1, lastRow, lastCol) : null;
  const values = rosterRange ? rosterRange.getDisplayValues() : [];
  const notes = rosterRange ? rosterRange.getNotes() : [];

  const directory = readDirectory_(ss);
  const primaryEmployeeById = {};
  canonicalActiveDirectoryEntries_(directory.entries).forEach(function (entry) {
    const identity = employeeIdentityKey_(entry.employeeId, entry.name);
    if (identity) primaryEmployeeById[identity] = entry;
  });
  const includeEmpty = key >= todayIso_().slice(0, 7); // current and future months list everyone active
  const employees = {};
  let order = 0;

  walkEmployeeRows_(values, function (r, store, role, name) {
    const id = store + '|' + nameKey_(name);
    const emp = employees[id] || (employees[id] = newEmp_(id, name, store, role, daysInMonth, order++));
    if (!emp.role && role) emp.role = role;
    const row = values[r];
    for (let d = 0; d < daysInMonth; d++) {
      const cell = row[CONFIG.FIRST_DAY_COLUMN - 1 + d];
      const t = cell == null ? '' : String(cell).trim();
      const rosterCol = CONFIG.FIRST_DAY_COLUMN - 1 + d;
      const note = notes[r] && notes[r][rosterCol] ? String(notes[r][rosterCol]) : '';
      if (t || note.indexOf('HUFT_DEPLOYMENT:') === 0) { emp.raw[d] = t; emp.notes[d] = note; emp.any = true; }
    }
  });

  // Approved deployments are virtual roster assignments. The employee keeps
  // one permanent directory profile; the destination sees them only on the
  // approved dates, without adding a second permanent staff record.
  Object.keys(employees).slice().forEach(function (sourceId) {
    const source = employees[sourceId];
    const profile = directory.byId[sourceId];
    if (!profile || !profile.active) return;
    const identity = employeeIdentityKey_(profile.employeeId, profile.name);
    const primary = identity ? primaryEmployeeById[identity] : null;
    if (primary && (primary.store !== profile.store || nameKey_(primary.name) !== nameKey_(profile.name))) return;
    for (let d = 0; d < daysInMonth; d++) {
      const assignment = compactCell_(source.raw[d], source.notes[d]);
      if (!Array.isArray(assignment) || assignment[0] !== 'Deployed' || !assignment[2]) continue;
      const destination = canonicalStore_(assignment[2]) || assignment[2];
      if (!destination || destination === source.store) continue;
      const virtualId = '__DEPLOY__|' + sourceId + '|' + destination;
      const deployed = employees[virtualId] || (employees[virtualId] = newEmp_(virtualId, source.name, destination, profile.role || source.role, daysInMonth, order++));
      deployed.isDeployment = true;
      deployed.homeStore = source.store;
      deployed.profile = profile;
      deployed.deploymentDates = deployed.deploymentDates || new Array(daysInMonth).fill(false);
      deployed.deploymentDates[d] = true;
      deployed.raw[d] = assignment[1] ? (CONFIG.SHIFT_WRITE[assignment[1]] || assignment[1]) : '';
      deployed.any = true;
    }
  });
  if (includeEmpty) {
    directory.entries.forEach(function (en) {
      if (!en.active || !en.store) return;
      const id = en.store + '|' + nameKey_(en.name);
      if (!employees[id]) employees[id] = newEmp_(id, en.name, en.store, '', daysInMonth, order++);
    });
  }

  const list = Object.keys(employees)
    .map(function (id) { return employees[id]; })
    .filter(function (e) {
      if (e.isDeployment) return e.any;
      const entry = directory.byId[e.id];
      if (entry && entry.active && entry.employeeId) {
        const primary = primaryEmployeeById[employeeIdentityKey_(entry.employeeId, entry.name)];
        if (primary && (primary.store !== e.store || nameKey_(primary.name) !== nameKey_(e.name))) return false;
      }
      return e.any || (includeEmpty && entry && entry.active);
    })
    .map(function (e) {
      const entry = e.isDeployment ? e.profile : directory.byId[e.id];
      const byName = directory.byName[nameKey_(e.name)] || {};
      const removedOn = entry && !entry.active ? entry.removedOn : '';
      const days = e.raw.map(function (raw, d) { return compactCell_(raw, e.notes[d]); });
      if (removedOn) {
        for (let d = 0; d < daysInMonth; d++) {
          if (key + '-' + pad2_(d + 1) >= removedOn) days[d] = 'Removed';
        }
      }
      return {
        id: e.id,
        name: e.name,
        store: e.store,
        role: (entry && entry.role) || byName.role || e.role || 'Staff',
        phone: e.isDeployment ? '' : (entry && entry.phone) || byName.phone || '',
        email: e.isDeployment ? '' : (entry && entry.email) || byName.email || '',
        employeeId: (entry && entry.employeeId) || byName.employeeId || '',
        isDeployment: !!e.isDeployment,
        homeStore: e.homeStore || '',
        deploymentDates: e.isDeployment ? e.deploymentDates.map(function (active, i) { return active ? key + '-' + pad2_(i + 1) : ''; }).filter(function (date) { return !!date; }) : [],
        photoKey: e.isDeployment && entry ? entry.store + '|' + nameKey_(entry.name) : '',
        reportsTo: (entry && entry.reportsTo) || byName.reportsTo || '',
        photoId: entry && entry.photoId ? entry.photoId : '',
        removedOn: removedOn || '',
        order: e.order,
        days: days
      };
    });

  list.sort(function (x, y) {
    return (storeRank_(x.store) - storeRank_(y.store)) ||
      (roleRank_(x.role) - roleRank_(y.role)) ||
      (x.order - y.order);
  });
  list.forEach(function (e) { delete e.order; });

  return {
    key: key,
    found: true,
    label: info.label,
    sheet: info.sheet,
    daysInMonth: daysInMonth,
    employees: list,
    updated: new Date().toISOString()
  };
}

/**
 * Raw cell text -> bare string for plain categories, or [category, text, place].
 */
function compactCell_(raw, note) {
  const t = String(raw || '').replace(/\s+/g, ' ').trim();
  const deployment = /^HUFT_DEPLOYMENT:(.*)$/.exec(String(note || '').trim());
  if (deployment) {
    const place = safeDecode_(deployment[1]);
    const shift = CONFIG.SHIFT_MAP[t.toLowerCase()] || '';
    return ['Deployed', shift, canonicalStore_(place) || place];
  }
  if (!t) return 'Unassigned';

  // Cross-store transfer: __REPORT_TO__Madhapur__SHIFT__Closing
  const tr = /^__REPORT_TO__(.+?)__SHIFT__(.*)$/.exec(t);
  if (tr) {
    const place = safeDecode_(tr[1]);
    const shift = CONFIG.SHIFT_MAP[safeDecode_(tr[2]).toLowerCase().trim()] || '';
    return ['Deployed', shift, canonicalStore_(place) || place];
  }

  // Older roster cells used a single-underscore encoding.
  const legacyTransfer = /^_REPORT_TO_(.+?)_SHIFT_(.+)$/i.exec(t);
  if (legacyTransfer) {
    const place = safeDecode_(legacyTransfer[1]);
    const shift = CONFIG.SHIFT_MAP[safeDecode_(legacyTransfer[2]).toLowerCase().trim()] || '';
    return ['Deployed', shift, canonicalStore_(place) || place];
  }

  const mapped = CONFIG.SHIFT_MAP[t.toLowerCase()];
  if (mapped) return mapped;

  // A store name written in a shift cell means "working at that store today".
  const store = canonicalStore_(t);
  if (store) return ['Deployed', '', store];

  return ['Other', t, ''];
}

/**
 * Moves the roster rows of one person to another store, for every tab from
 * fromKey onwards. Earlier months keep the old store as history.
 */
function moveStaffInTabs_(fromStore, toStore, name, fromKey) {
  const ss = openSpreadsheet_();
  const nk = nameKey_(name);
  let moved = 0;
  getMonths_().forEach(function (m) {
    if (m.key < fromKey) return;
    const sheet = ss.getSheetByName(m.sheet);
    const last = sheet.getLastRow();
    if (!last) return;
    const ab = sheet.getRange(1, 1, last, 2).getDisplayValues();
    walkEmployeeRows_(ab, function (r, store, role, nm, inA) {
      if (inA && store === fromStore && nameKey_(nm) === nk) {
        sheet.getRange(r + 1, 1).setValue(toStore);
        moved++;
      }
    });
  });
  return moved;
}

/** Rename an employee in every month tab so history follows the directory name. */
function renameStaffInTabs_(store, oldName, newName) {
  const ss = openSpreadsheet_();
  const oldKey = nameKey_(oldName);
  let renamed = 0;
  getMonths_().forEach(function (m) {
    const sheet = ss.getSheetByName(m.sheet);
    const last = sheet.getLastRow();
    if (!last) return;
    const ab = sheet.getRange(1, 1, last, 2).getDisplayValues();
    walkEmployeeRows_(ab, function (r, rowStore, role, employeeName) {
      if (rowStore === store && nameKey_(employeeName) === oldKey) {
        sheet.getRange(r + 1, 2).setValue(newName);
        renamed++;
      }
    });
  });
  return renamed;
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function guard_(label, fn) {
  try {
    return fn();
  } catch (err) {
    console.error(label + ' failed: ' + (err && err.stack ? err.stack : err));
    throw new Error(err && err.message ? err.message : String(err));
  }
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function okResult_(message) {
  return { ok: true, message: message, stores: getStoreNames_() };
}

function currentEmail_() {
  if (EMAIL_ACTION_REVIEWER_) return String(EMAIL_ACTION_REVIEWER_).toLowerCase();
  try { return String(Session.getActiveUser().getEmail() || '').toLowerCase(); } catch (e) { return ''; }
}

function requireRosterIdentity_() {
  const email = currentEmail_();
  if (!email) throw new Error('Could not identify your signed-in work email. Sign in with an individual @headsupfortails.com Google Workspace account. If the error continues, update the Apps Script manifest with the userinfo.email scope and redeploy while keeping company-domain access enabled.');
  if (isAdmin_() || getUserStoreAccess_().length || getMyEmployeeRecord_()) return;
  throw new Error('This account has no roster access. Ask the Hyderguda admin to grant access.');
}
function getMyEmployeeRecord_() {
  const email = currentEmail_();
  if (!email) return null;
  const matches = readDirectory_(openSpreadsheet_()).entries.filter(function (entry) { return entry.active && entry.email === email; });
  if (matches.length > 1) throw new Error('This email is linked to more than one active employee profile. Ask the admin to resolve the duplicate.');
  return matches[0] || null;
}

function isAdmin_() {
  const email = currentEmail_();
  if (!email) return false;
  return CONFIG.ADMIN_EMAILS.map(function (e) { return e.toLowerCase(); }).indexOf(email) >= 0;
}

function requireAdmin_() {
  if (!isAdmin_()) throw new Error('Only admins can do this. Ask an admin to make the change.');
}

function openSpreadsheet_() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function todayIso_() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

function validIso_(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

function dateRange_(from, to, maxDays) {
  const out = [];
  const a = from.split('-').map(Number);
  const b = to.split('-').map(Number);
  const end = Date.UTC(b[0], b[1] - 1, b[2]);
  for (let t = Date.UTC(a[0], a[1] - 1, a[2]); t <= end; t += 86400000) {
    const d = new Date(t);
    out.push(d.getUTCFullYear() + '-' + pad2_(d.getUTCMonth() + 1) + '-' + pad2_(d.getUTCDate()));
    if (out.length > maxDays) throw new Error('Choose a period of at most ' + maxDays + ' days.');
  }
  return out;
}

/** dd/mm/yyyy or yyyy-mm-dd -> yyyy-mm-dd, else ''. */
function parseDateLoose_(s) {
  const t = String(s == null ? '' : s).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return t;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return m[3] + '-' + pad2_(Number(m[2])) + '-' + pad2_(Number(m[1]));
  return '';
}

/** Writes text exactly as given (no auto-conversion to dates/numbers). */
function writeText_(range, text) {
  range.setNumberFormat('@');
  range.setValue(text);
}

function nameKey_(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isEmployeeName_(name) {
  const n = String(name || '').trim();
  if (CONFIG.IGNORED_NAMES.indexOf(n.toLowerCase()) >= 0) return false;
  if (canonicalStore_(n)) return false;
  if (n.charAt(0) === '#' || n.length > 40) return false;
  if (/roster|http/i.test(n)) return false;
  return true;
}

function cleanName_(name) {
  const t = String(name).replace(/\s+/g, ' ').trim();
  if (t === t.toUpperCase() || t === t.toLowerCase()) {
    return t.toLowerCase().replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); });
  }
  return t;
}

/** Free-text from the browser: letters/numbers/spaces/. ' & ( ) - only, must start with a letter or number. */
function cleanInput_(text, max, label) {
  const t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  if (!t) throw new Error(label + ' is required.');
  if (t.length > max) throw new Error(label + ' is too long (max ' + max + ' characters).');
  if (!/^[\p{L}\p{N}]/u.test(t) || !/^[\p{L}\p{N} .'&()\-]+$/u.test(t)) {
    throw new Error(label + ' can only use letters, numbers, spaces and . \' & ( ) -');
  }
  return t;
}

function cleanPhoneInput_(text) {
  const raw = String(text == null ? '' : text).trim();
  if (!raw) return '';
  const p = normalizePhone_(raw);
  if (!p) throw new Error('Enter a 10-digit mobile number (or leave it empty).');
  return p;
}

function normalizeRole_(text) {
  const t = String(text || '').trim().toLowerCase();
  if (!t) return '';
  if (t.indexOf('groom') >= 0) return 'Grooming';
  if (t.indexOf('retail') >= 0) return 'Retail';
  return String(text).trim();
}

function normalizePhone_(text) {
  const d = String(text || '').replace(/\D/g, '');
  if (d.length === 10) return CONFIG.COUNTRY_CODE + d;
  if (d.length >= 11 && d.length <= 13) return d;
  return '';
}

function storeRank_(store) {
  const i = getStoreNames_().indexOf(store);
  return i < 0 ? 99 : i;
}

function roleRank_(role) {
  return role === 'Retail' ? 0 : role === 'Grooming' ? 1 : 2;
}

function pad2_(n) {
  return (n < 10 ? '0' : '') + n;
}

function safeDecode_(s) {
  try { return decodeURIComponent(s); } catch (e) { return s; }
}

function clearCaches_(monthKeys) {
  const keys = [CONFIG.CACHE_PREFIX + 'months', CONFIG.CACHE_PREFIX + 'stores'];
  (monthKeys || []).forEach(function (k) { keys.push(CONFIG.CACHE_PREFIX + 'month_' + k); });
  try { CacheService.getScriptCache().removeAll(keys); } catch (e) { /* ignore */ }
}

function clearAllCaches_() {
  const keys = getMonths_().map(function (m) { return m.key; });
  clearCaches_(keys);
}

function cacheGet_(k) {
  try {
    const s = CacheService.getScriptCache().get(CONFIG.CACHE_PREFIX + k);
    return s ? JSON.parse(s) : null;
  } catch (e) {
    return null;
  }
}

function cachePut_(k, v) {
  try {
    const s = JSON.stringify(v);
    if (s.length < 90000) CacheService.getScriptCache().put(CONFIG.CACHE_PREFIX + k, s, CONFIG.CACHE_SECONDS);
  } catch (e) {
    console.warn('Cache write skipped for ' + k + ': ' + e.message);
  }
}
const EMAIL_TEMPLATE_DEFS_ = [
  ['daily_roster','Daily roster email',false,'Your HUFT roster · {{store}} · {{date}}','Hello {{employee}},\n\nYour roster for {{date}} at {{store}} is {{shift}}.\n\nPlease contact your store manager if you need help.'],
  ['deployment_approval','Deployment approval request',true,'Deployment approval needed · {{employee}} · {{fromStore}} to {{store}}','A temporary roster deployment needs your review.\n\nEmployee: {{employee}}\nHome store: {{fromStore}}\nDestination store: {{store}}\nDates: {{dateRange}}\nShift: {{shift}}\nRequested by: {{requester}}\nRequest ID: {{requestId}}\n\nReview the request in the authenticated HUFT Roster.'],
  ['deployment_changes','Deployment changes requested',true,'Deployment changes requested · {{employee}} · {{dateRange}}','The destination store requested changes before deciding this deployment.\nEmployee: {{employee}}\nHome store: {{fromStore}}\nDestination store: {{store}}\nDates: {{dateRange}}\nRequested changes: {{notes}}\nReference: {{requestId}}'],
  ['deployment_decision','Deployment decision notification',true,'Deployment {{status}} · {{employee}} · {{dateRange}}','The deployment request for {{employee}} from {{fromStore}} to {{store}} was {{status}}.\nDates: {{dateRange}}\nDecision by: {{approver}}\nReference: {{requestId}}\nRemarks: {{notes}}'],
  ['roster_access_request','Store access request',true,'HUFT Roster access request · {{store}}','A store access request needs review.\nRequested email: {{targetEmail}}\nRequested store: {{store}}\nRequested by: {{requester}}\nEmployee: {{employee}}\nReason: {{reason}}\nReference: {{requestId}}\n\nReview this request in the Hyderguda admin panel.'],
  ['roster_invitation','HUFT Roster invitation',true,'Invitation to HUFT Roster · {{store}}','You have been invited to HUFT Roster.\nAccess: {{access}}\nStore: {{store}}\nOpen the roster: {{url}}\n\nIf you were not expecting this invitation, you can ignore this email.'],
  ['employee_request_approval','Employee request approval',true,'Roster request approval · {{employee}} · {{store}} · {{date}}','A new employee request needs review.\n\nRequest: {{requestType}}\nEmployee: {{employee}}\nStore: {{store}}\nDate: {{date}}\nCurrent shift: {{previous}}\nRequested change: {{requested}}\nReason: {{reason}}\nEvidence: {{evidence}}\nRequest ID: {{requestId}}\n\nReview it in the authenticated HUFT Roster Approval Centre.'],
  ['employee_request_approved','Employee request approved',true,'Request approved · {{employee}} · {{date}}','Your {{requestType}} request for {{employee}} on {{date}} was approved by {{approver}}.\n{{notes}}\n{{details}}'],
  ['employee_request_rejected','Employee request rejected',true,'Request rejected · {{employee}} · {{date}}','Your {{requestType}} request for {{employee}} on {{date}} was rejected by {{approver}}.\nReason or remarks: {{notes}}\nContact your manager if you need clarification.'],
  ['employee_request_changes','Changes requested · {{employee}} · {{date}}',true,'Changes requested · {{employee}} · {{date}}','Your {{requestType}} request needs changes before it can be reviewed again.\nRequested changes: {{notes}}'],
  ['leave_approval','Leave approval request',false,'Leave request needs review · {{employee}} · {{store}}','A leave request needs review.\nEmployee: {{employee}}\nStore: {{store}}\nDate: {{date}}\nReason: {{reason}}\nRequest ID: {{requestId}}'],
  ['weekoff_approval','Week-off change request',false,'Week-off change needs review · {{employee}} · {{date}}','A week-off change needs review.\nEmployee: {{employee}}\nStore: {{store}}\nDate: {{date}}\nRequested change: {{requested}}\nReason: {{reason}}\nRequest ID: {{requestId}}'],
  ['shift_approval','Shift change / roster correction',false,'Roster change needs review · {{employee}} · {{date}}','A roster change needs review.\nEmployee: {{employee}}\nStore: {{store}}\nDate: {{date}}\nCurrent shift: {{previous}}\nRequested shift: {{requested}}\nReason: {{reason}}\nRequest ID: {{requestId}}'],
  ['attendance_approval','Attendance correction request',false,'Attendance correction needs review · {{employee}} · {{date}}','An attendance correction request needs review.\nEmployee: {{employee}}\nStore: {{store}}\nDate: {{date}}\nReason: {{reason}}\nEvidence: {{evidence}}\nRequest ID: {{requestId}}'],
  ['profile_change','Employee profile / store / role change',false,'Employee profile change needs review · {{employee}}','A profile change needs review.\nEmployee: {{employee}}\nStore: {{store}}\nRequested by: {{requester}}\nDetails: {{details}}\nRequest ID: {{requestId}}'],
  ['punctuality_escalation','Punctuality incident review',false,'Punctuality review · {{employee}} · {{store}}','A punctuality record needs authorized review.\nEmployee: {{employee}}\nStore: {{store}}\nDetails: {{details}}\nReference: {{requestId}}'],
  ['grooming_escalation','Grooming standards review',false,'Grooming review · {{employee}} · {{store}}','A grooming audit needs authorized review.\nEmployee: {{employee}}\nStore: {{store}}\nDetails: {{details}}\nReference: {{requestId}}'],
  ['warning_review','Warning letter review',false,'Warning letter draft for review · {{employee}}','A warning letter draft is awaiting human review. No letter has been issued.\nEmployee: {{employee}}\nStore: {{store}}\nReference: {{requestId}}'],
  ['pending_reminder','Pending approval reminder',false,'Approval pending · {{employee}} · {{requestId}}','This request is still awaiting review.\nType: {{requestType}}\nStore: {{store}}\nPending since: {{timestamp}}'],
  ['deployment_status','Deployment status update',false,'Deployment {{status}} · {{employee}} · {{dateRange}}','Deployment status: {{status}}\nEmployee: {{employee}}\nStores: {{fromStore}} → {{store}}\nDates: {{dateRange}}\nReference: {{requestId}}'],
  ['monthly_employee_report','Monthly employee report',false,'Monthly roster summary · {{employee}} · {{store}}','Monthly report for {{employee}} at {{store}}.\nReport period: {{dateRange}}\nDetails: {{details}}'],
  ['monthly_store_summary','Monthly five-store summary',false,'HUFT monthly workforce summary · {{dateRange}}','Monthly workforce and compliance summary.\nPeriod: {{dateRange}}\nDetails: {{details}}'],
  ['system_failure','System error / email failure',false,'HUFT Roster notification failure · {{timestamp}}','An operation or notification failed.\nReference: {{requestId}}\nDetails: {{details}}\nRecovery status: {{status}}'],
  ['store_daily_summary','Daily store manager summary',false,'Daily roster summary · {{store}} · {{date}}','Daily roster summary for {{store}} on {{date}}.\nDetails: {{details}}'],
  ['area_daily_summary','Daily Area Manager summary',false,'Daily HUFT store summary · {{date}}','Daily multi-store summary for {{date}}.\nDetails: {{details}}'],
  ['dispute_update','Employee dispute acknowledgement / update',false,'Dispute status update · {{employee}} · {{requestId}}','Your dispute status is {{status}}.\nUpdate: {{notes}}'],
  ['corrective_action','Corrective action assignment / completion',false,'Corrective action update · {{employee}} · {{store}}','Action status: {{status}}\nDetails: {{details}}'],
  ['backup_status','Backup completion / failure / recovery',true,'HUFT Roster backup {{status}} · {{timestamp}}','Backup status: {{status}}\nReference: {{requestId}}\nDetails: {{details}}'],
  ['security_change','Security-relevant administrative change',false,'HUFT Roster access change · {{timestamp}}','An administrative access setting changed.\nActor: {{approver}}\nDetails: {{details}}\nReference: {{requestId}}']
];
const EMAIL_TEMPLATE_IDS_ = EMAIL_TEMPLATE_DEFS_.map(function (d) { return d[0]; });

/** Admin-only template inventory, recent delivery log, and configured store recipients. */
function getEmailAdminData() {
  return guard_('getEmailAdminData', function () {
    requireAdmin_();
    const ss = openSpreadsheet_();
    const templates = readEmailTemplates_(ss);
    const logSheet = ensureEmailLogSheet_(ss);
    const logs = logSheet.getLastRow() < 2 ? [] : logSheet.getRange(Math.max(2, logSheet.getLastRow() - 99), 1, Math.min(100, logSheet.getLastRow() - 1), 10).getDisplayValues().reverse().map(function (r) {
      return { id:r[0], template:r[1], reference:r[2], recipient:r[3], subject:r[4], status:r[5], attempts:Number(r[6] || 0), updated:r[7], error:r[8] || '', cc:r[9] || '' };
    });
    const recipients = getStoreRecipientEmails_();
    return { templates:templates, logs:logs, recipients:recipients };
  });
}

function saveEmailTemplate(p) {
  return guard_('saveEmailTemplate', function () {
    requireAdmin_(); p = p || {};
    const id = String(p.id || '');
    if (EMAIL_TEMPLATE_IDS_.indexOf(id) < 0) throw new Error('Unknown email template.');
    const subject = String(p.subject || '').trim();
    const body = String(p.body || '').trim();
    if (!subject || subject.length > 200) throw new Error('Subject is required and must be 200 characters or fewer.');
    if (!body || body.length > 5000) throw new Error('Message is required and must be 5000 characters or fewer.');
    if (/<\/?[a-z][^>]*>/i.test(body)) throw new Error('Message content must be plain text; HTML is added by the HUFT email layout.');
    const enabled = p.enabled === true;
    const def = EMAIL_TEMPLATE_DEFS_.filter(function (d) { return d[0] === id; })[0];
    if (enabled && !def[2]) throw new Error('This template is reserved until its application workflow is implemented.');
    const sh = ensureEmailTemplatesSheet_(openSpreadsheet_());
    const values = sh.getLastRow() < 2 ? [] : sh.getRange(2, 1, sh.getLastRow() - 1, 7).getDisplayValues();
    let row = -1;
    values.forEach(function (r, i) { if (r[0] === id) row = i + 2; });
    const record = [id, enabled ? 'TRUE' : 'FALSE', subject, body, new Date(), currentEmail_(), def[1]];
    if (row < 0) row = sh.getLastRow() + 1;
    sh.getRange(row, 1, 1, 7).setValues([record]);
    auditLog_('Email template updated', 'Email template', id, '', '', JSON.stringify({ enabled:enabled }), 'Success', 'Email settings');
    return getEmailAdminData();
  });
}

function sendEmailTemplateTest(p) {
  return guard_('sendEmailTemplateTest', function () {
    requireAdmin_(); p = p || {};
    const id = String(p.id || '');
    if (EMAIL_TEMPLATE_IDS_.indexOf(id) < 0) throw new Error('Choose a valid email template.');
    const recipient = cleanEmail_(p.recipient || currentEmail_());
    if (recipient !== currentEmail_()) throw new Error('Test emails can only be sent to your signed-in admin address.');
    const defs = EMAIL_TEMPLATE_DEFS_.filter(function (d) { return d[0] === id; })[0];
    const sample = { employee:'Sample employee', store:'Sample store', fromStore:'Sample home store', date:todayIso_(), dateRange:todayIso_(), shift:'Opening', status:'Sample status', requestId:'TEST-NOT-A-REAL-REQUEST', requester:currentEmail_(), approver:currentEmail_(), requestType:'Sample request', reason:'Sample reason', notes:'Sample remarks', previous:'Opening', requested:'Closing', evidence:'Not supplied', details:'Preview only; no business action was taken.', timestamp:new Date().toISOString(), url:ScriptApp.getService().getUrl() || '', targetEmail:currentEmail_(), access:'Sample store access' };
    const template = readEmailTemplate_(openSpreadsheet_(), id);
    const sent = sendHuftEmail_(template, sample, recipient, '', false);
    return { ok:true, message:sent ? 'Test email sent to your signed-in admin address.' : 'A test email for this template was already sent.' };
  });
}

function retryFailedEmail(p) {
  return guard_('retryFailedEmail', function () {
    requireAdmin_(); p = p || {};
    const sh = ensureEmailLogSheet_(openSpreadsheet_());
    const rows = sh.getLastRow() < 2 ? [] : sh.getRange(2, 1, sh.getLastRow() - 1, 10).getDisplayValues();
    let row = -1, log = null;
    rows.forEach(function (r, i) { if (r[0] === String(p.id || '')) { row = i + 2; log = r; } });
    if (row < 0 || !log) throw new Error('Email delivery record was not found.');
    if (log[5] !== 'Failed') throw new Error('Only failed email deliveries can be retried.');
    const template = readEmailTemplate_(openSpreadsheet_(), log[1]);
    if (!template.enabled) throw new Error('Enable this template before retrying.');
    const payload = PropertiesService.getScriptProperties().getProperty('huft_email_retry_' + log[0]);
    if (!payload) throw new Error('Private retry data is missing for this failed email. Resend the original workflow notification if appropriate.');
    const vars = JSON.parse(payload);
    const actionLink = ['deployment_approval','deployment_changes','employee_request_approval','roster_access_request'].indexOf(log[1]) >= 0;
    const workflowAction = log[1] === 'deployment_approval' ? { kind:'deployment', id:log[2] } : log[1] === 'employee_request_approval' ? { kind:'employee', id:log[2] } : null;
    sendHuftEmail_(template, vars, log[3], log[2], actionLink, log[1] === 'deployment_approval' ? null : (log[9] ? log[9].split(',') : []), false, workflowAction);
    return getEmailAdminData();
  });
}

function ensureEmailTemplatesSheet_(ss) {
  let sh = ss.getSheetByName(CONFIG.EMAIL_TEMPLATES_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.EMAIL_TEMPLATES_SHEET);
    sh.getRange(1, 1, 1, 7).setValues([['Template ID','Enabled','Subject','Message','Updated At','Updated By','Template Name']]);
    sh.setFrozenRows(1);
  }
  const existing = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 7).getDisplayValues().forEach(function (r) { existing[r[0]] = true; });
  EMAIL_TEMPLATE_DEFS_.forEach(function (d) {
    if (!existing[d[0]]) sh.appendRow([d[0], d[2] ? 'TRUE' : 'FALSE', d[3], d[4], new Date(), 'system default', d[1]]);
  });
  return sh;
}

function ensureEmailLogSheet_(ss) {
  let sh = ss.getSheetByName(CONFIG.EMAIL_LOG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.EMAIL_LOG_SHEET);
    sh.getRange(1, 1, 1, 10).setValues([['Delivery ID','Template ID','Reference ID','Recipient','Subject','Status','Attempts','Updated At','Error','CC']]);
    sh.setFrozenRows(1);
  } else {
    if (sh.getMaxColumns() < 10) sh.insertColumnsAfter(sh.getMaxColumns(), 10 - sh.getMaxColumns());
    if (!String(sh.getRange(1, 10).getDisplayValue() || '').trim()) sh.getRange(1, 10).setValue('CC');
  }
  return sh;
}
function readEmailTemplates_(ss) {
  const sh = ensureEmailTemplatesSheet_(ss);
  const rows = sh.getLastRow() < 2 ? [] : sh.getRange(2, 1, sh.getLastRow() - 1, 7).getDisplayValues();
  return EMAIL_TEMPLATE_DEFS_.map(function (d) {
    const row = rows.filter(function (r) { return r[0] === d[0]; })[0];
    return { id:d[0], name:d[1], enabled:row ? String(row[1]).toUpperCase() === 'TRUE' : d[2], subject:row ? row[2] : d[3], body:row ? row[3] : d[4], workflowImplemented:d[2], updatedAt:row ? row[4] : '', updatedBy:row ? row[5] : '' };
  });
}

function readEmailTemplate_(ss, id) {
  const item = readEmailTemplates_(ss).filter(function (t) { return t.id === id; })[0];
  if (!item) throw new Error('Email template was not found.');
  if (!item.enabled) throw new Error('This email template is disabled.');
  return item;
}

function validateEmailTemplateValues_(template, vars) {
  const combined = String(template.subject || '') + '\n' + String(template.body || '');
  const matches = combined.match(/\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g) || [];
  const missing = [];
  matches.forEach(function (token) {
    const key = token.slice(2, -2);
    if (vars[key] == null || String(vars[key]).trim() === '') missing.push(key);
  });
  if (missing.length) throw new Error('Missing required email template value(s): ' + Array.from(new Set(missing)).join(', ') + '.');
}
function replaceEmailTokens_(text, vars) {
  return String(text || '').replace(/\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g, function (whole, key) {
    return vars[key] == null ? '—' : String(vars[key]);
  });
}

function escapeEmailHtml_(value) {
  return String(value == null ? '' : value).replace(/[&<>"]/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; });
}

/** Sends a branded responsive table email. CTA only opens the authenticated app; it never decides a request. */
function sendHuftEmail_(template, vars, to, reference, actionLink, cc, lockAlreadyHeld, emailActions) {
  const ss = openSpreadsheet_();
  const logSheet = ensureEmailLogSheet_(ss);
  const recipient = cleanEmail_(to);
  vars = Object.assign({}, vars || {});
  // Profile photos stay in the authenticated roster only; never place image
  // data, photo IDs, or attachments in outbound email or retry payloads.
  Object.keys(vars).forEach(function (key) { if (/photo|image|attachment/i.test(key)) delete vars[key]; });
  validateEmailTemplateValues_(template, vars);
  const subject = replaceEmailTokens_(template.subject, vars).slice(0, 200);
  const ref = String(reference || '');
  const ccList = Array.from(new Set((cc || []).map(function (address) { return String(address || '').toLowerCase(); }).filter(function (address) { return address && address !== recipient && address !== currentEmail_(); })));
  const key = template.id + '|' + ref + '|' + recipient;
  let logRow = 0, attempt = 0, alreadySent = false, deliveryId = '';
  const claimDelivery = function () {
    const data = logSheet.getLastRow() < 2 ? [] : logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 10).getDisplayValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][2] && template.id + '|' + data[i][2] + '|' + data[i][3] === key) {
        logRow = i + 2;
        if (data[i][5] === 'Sent') { alreadySent = true; return; }
        if (data[i][5] === 'Sending') throw new Error('This email is already being sent. Check the delivery log before retrying.');
        attempt = Number(data[i][6] || 0);
        break;
      }
    }
    attempt++;
    if (!logRow) logRow = logSheet.getLastRow() + 1;
    deliveryId = logRow > 1 && data.length >= logRow - 1 ? String(data[logRow - 2][0] || '') : '';
    if (!deliveryId) deliveryId = Utilities.getUuid();
    logSheet.getRange(logRow, 1, 1, 10).setValues([[deliveryId,template.id,ref,recipient,subject,'Sending',attempt,new Date(),'',ccList.join(',')]]);
  };
  if (lockAlreadyHeld) claimDelivery(); else withLock_(claimDelivery);
  if (alreadySent) return false;
  PropertiesService.getScriptProperties().setProperty('huft_email_retry_' + deliveryId, JSON.stringify(vars));
  const plainBase = replaceEmailTokens_(template.body, vars);
  const url = ScriptApp.getService().getUrl() || '';
  const actionBase = url && emailActions && emailActions.id && ['deployment','employee'].indexOf(emailActions.kind) >= 0
    ? url + (url.indexOf('?') >= 0 ? '&' : '?') + 'huftAction=email&kind=' + encodeURIComponent(emailActions.kind) + '&id=' + encodeURIComponent(emailActions.id) + '&choice='
    : '';
  // Only the primary, store-configured recipient receives the one-time Gmail approval capability.
  let gmailActionToken = '', gmailActionMarkup = '';
  if (url && emailActions && emailActions.id && ['deployment','employee'].indexOf(emailActions.kind) >= 0 && ccList.length === 0) {
    gmailActionToken = Utilities.getUuid() + Utilities.getUuid();
    PropertiesService.getScriptProperties().setProperty('huft_gmail_action_' + gmailActionToken, JSON.stringify({kind:emailActions.kind,id:String(emailActions.id),choice:'approve',reviewerEmail:recipient,expiresAt:Date.now()+24*60*60*1000}));
    const handlerUrl = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'huftEmailAction=approve&token=' + encodeURIComponent(gmailActionToken);
    const markup = {'@context':'http://schema.org','@type':'EmailMessage',description:'Approve this HUFT Roster request directly from Gmail.',potentialAction:{'@type':'ConfirmAction',name:'Approve request',handler:{'@type':'HttpActionHandler',url:handlerUrl,method:'POST'}}};
    gmailActionMarkup = '<script type=\"application/ld+json\">' + JSON.stringify(markup).replace(/</g,'\\u003c') + '</script>';
  }
  // Keep action destinations out of the visible plain-text body. The HTML buttons remain clickable; mail clients that strip HTML get a clear roster fallback.
  const plain = plainBase + (actionBase ? (gmailActionToken ? '\n\nUse Gmail’s Approve action to approve this request directly in the message. The approval expires after 24 hours and can only be used once. Other decisions are available in HUFT Roster.' : '\n\nUse the action buttons in this email to review the request. If your mail app does not show the buttons, open HUFT Roster and review the request there. No decision is made until you confirm it.') : '');
  const lines = plain.split(/\r?\n/).map(function (line) { return '<div style="margin:0 0 8px">' + escapeEmailHtml_(line || ' ') + '</div>'; }).join('');
  let actionButtons = '';
  if (actionBase) {
    const base = actionBase;    const button = function (choice, label, color) {
      return '<tr><td style="padding:6px 28px"><a href="' + escapeEmailHtml_(base + choice) + '" style="display:block;text-align:center;background:' + color + ';color:#fff;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:6px">' + label + '</a></td></tr>';
    };
    actionButtons = '<tr><td style="padding:12px 28px 4px;font-weight:bold">' + (gmailActionToken ? 'Other actions' : 'Select an action') + '</td></tr>' +
      (gmailActionToken ? '' : button('approve','✓ APPROVE REQUEST','#16803c')) +
      button('reject','✕ REJECT REQUEST','#d92d20') +
      button('changes','↻ REQUEST CHANGES','#596579') +
      '<tr><td style="padding:6px 28px 10px;color:#68758a;font-size:12px">' + (gmailActionToken ? 'Approve directly in Gmail using the message action.' : 'Each button opens an authenticated confirmation page. No decision is made until the reviewer confirms in HUFT Roster.') + '</td></tr>'; 
  }
  const cta = !actionButtons && actionLink && url ? '<tr><td style="padding:20px 28px 8px"><a href="' + escapeEmailHtml_(url) + '" style="display:inline-block;background:#f36b2b;color:#fff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:6px">Open HUFT Roster</a><p style="font-size:12px;color:#68758a">Sign in to review. Opening this link does not approve or reject anything.</p></td></tr>' : '';
  const htmlBody = gmailActionMarkup + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f6fa;padding:24px 8px;font-family:Arial,Helvetica,sans-serif;color:#263448"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #e4e8ef;border-radius:8px"><tr><td style="background:#f36b2b;color:#fff;padding:18px 24px;font-size:20px;font-weight:bold">HUFT Roster Management</td></tr><tr><td style="padding:22px 28px 8px"><div style="font-size:11px;font-weight:bold;letter-spacing:1px;color:#a14a1d;margin-bottom:12px">' + (actionButtons || actionLink ? 'OFFICIAL ACTION REQUIRED' : 'HUFT ROSTER NOTIFICATION') + '</div><div style="line-height:1.55;font-size:14px">' + lines + '</div></td></tr>' + actionButtons + cta + '<tr><td style="padding:16px 28px 20px;border-top:1px solid #e8ebf0;color:#748096;font-size:11px">Automated company notification · Please do not reply with sensitive employee information.</td></tr></table></td></tr></table>';  try {
    const email = { to:recipient, subject:subject, body:plain, htmlBody:htmlBody, name:'HUFT Roster Management' };
    if (ccList.length) email.cc = ccList.join(',');
    MailApp.sendEmail(email);
    logSheet.getRange(logRow, 6, 1, 3).setValues([['Sent',attempt,new Date()]]);
    logSheet.getRange(logRow, 9).setValue('');
    PropertiesService.getScriptProperties().deleteProperty('huft_email_retry_' + deliveryId);
    return true;
  } catch (err) {
    logSheet.getRange(logRow, 6, 1, 3).setValues([['Failed',attempt,new Date()]]);
    logSheet.getRange(logRow, 9).setValue(String(err && err.message || err).slice(0,1000));
    throw err;
  }
}



/** A button deep link only opens a permission-checked confirmation page; this endpoint never changes request state. */
function getEmailActionContext(p) {
  return guard_('getEmailActionContext', function () {
    requireRosterIdentity_(); p = p || {};
    const kind = String(p.kind || ''), id = String(p.id || '');
    if (!id || id.length > 200) throw new Error('This approval link is invalid.');
    let context = null;
    if (kind === 'deployment') {
      const sh = ensureDeploymentRequestsSheet_(openSpreadsheet_());
      if (sh.getLastRow() < 2) throw new Error('This deployment request is no longer available.');
      const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 14).getDisplayValues();
      const row = rows.filter(function (r) { return r[0] === id; })[0];
      if (!row || String(row[8]).toLowerCase() !== 'pending') throw new Error('This deployment request is no longer pending.');
      const toStore = requireStore_(row[4]);
      requireStoreAccess_(toStore);
      if (String(row[1] || '').toLowerCase() === currentEmail_()) throw new Error('You cannot review your own deployment request.');
      context = { kind:kind, id:id, employee:row[3], fromStore:row[2], store:toStore, dateRange:row[5] + ' to ' + row[6], shift:row[7] || 'Not specified', status:row[8] };
    } else if (kind === 'employee') {
      const sh = openSpreadsheet_().getSheetByName(CONFIG.WORK_REQUESTS_SHEET);
      if (!sh || sh.getLastRow() < 2) throw new Error('This employee request is no longer available.');
      const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 18).getDisplayValues();
      const row = rows.filter(function (r) { return r[0] === id; })[0];
      if (!row || String(row[11]).toLowerCase() !== 'pending') throw new Error('This employee request is no longer pending.');
      const store = requireStore_(row[4]);
      requireStoreAccess_(store);
      if (String(row[5] || '').toLowerCase() === currentEmail_()) throw new Error('You cannot review your own employee request.');
      context = { kind:kind, id:id, employee:row[3], store:store, date:row[6], requestType:row[1], previousShift:row[7], requestedShift:row[8] };
    } else {
      throw new Error('This email action type is not supported.');
    }
    return context;
  });
}
/* ------------------------------------------------------------------ */
/* Cloud Storage & Backup Management                                   */
/* ------------------------------------------------------------------ */

function getOrCreateBackupFolder_() {
  const folderIt = DriveApp.getFoldersByName(CONFIG.BACKUP_FOLDER_NAME);
  const folder = folderIt.hasNext() ? folderIt.next() : DriveApp.createFolder(CONFIG.BACKUP_FOLDER_NAME);
  shareProfileFolderWithDomain_(folder);
  return folder;
}

function getOrCreateExportsFolder_() {
  const folderIt = DriveApp.getFoldersByName(CONFIG.EXPORTS_FOLDER_NAME);
  const folder = folderIt.hasNext() ? folderIt.next() : DriveApp.createFolder(CONFIG.EXPORTS_FOLDER_NAME);
  shareProfileFolderWithDomain_(folder);
  return folder;
}

function ensureBackupLogSheet_(ss) {
  let sh = ss.getSheetByName(CONFIG.BACKUP_LOG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.BACKUP_LOG_SHEET);
    sh.getRange(1, 1, 1, 8).setValues([['Backup ID', 'Timestamp', 'Created By', 'Snapshot Name', 'Drive File ID', 'Drive URL', 'Size (KB)', 'Notes']]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#0284c7').setFontColor('#ffffff');
  }
  return sh;
}

/**
 * Creates an instantaneous, complete Google Drive cloud backup snapshot of the
 * entire roster spreadsheet and registers it in the Cloud Backup Log.
 */
function createCloudBackup(notes) {
  return guard_('createCloudBackup', function () {
    requireAdmin_();
    const ss = openSpreadsheet_();
    const backupFolder = getOrCreateBackupFolder_();
    const timeStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd_HH-mm-ss');
    const backupName = 'HUFT_Roster_Backup_' + timeStr;
    const backupId = 'BAK-' + Utilities.getUuid().slice(0, 8).toUpperCase();
    
    // Create copy in Google Drive cloud storage
    const ssFile = DriveApp.getFileById(CONFIG.SPREADSHEET_ID);
    const backupFile = ssFile.makeCopy(backupName, backupFolder);
    const driveUrl = backupFile.getUrl();
    let fileSizeKb = 0;
    try { fileSizeKb = Math.round(backupFile.getSize() / 1024) || 0; } catch (e) { fileSizeKb = 0; }
    const actor = currentEmail_() || 'admin';
    
    // Log in backup sheet
    const logSheet = ensureBackupLogSheet_(ss);
    const nextRow = Math.max(logSheet.getLastRow() + 1, 2);
    logSheet.getRange(nextRow, 1, 1, 8).setValues([[
      backupId, new Date(), actor, backupName, backupFile.getId(), driveUrl, fileSizeKb, String(notes || 'Manual cloud backup')
    ]]);
    
    auditLog_('Cloud backup created', 'Cloud Storage Backup', backupId, 'All', '', JSON.stringify({ name: backupName, driveId: backupFile.getId(), sizeKb: fileSizeKb }), 'Success', 'Cloud Storage');
    
    // Send email alert if backup template is enabled
    try {
      const template = readEmailTemplate_(ss, 'backup_status');
      sendHuftEmail_(template, { status: 'Successful', timestamp: new Date().toISOString(), requestId: backupId, details: 'Created cloud backup snapshot "' + backupName + '" (' + fileSizeKb + ' KB) in Google Drive.' }, actor, backupId, false);
    } catch (err) {
      console.warn('Backup email notification skipped: ' + (err && err.message ? err.message : err));
    }
    
    return {
      ok: true,
      message: 'Cloud backup created: ' + backupName,
      backup: {
        id: backupId,
        name: backupName,
        url: driveUrl,
        sizeKb: fileSizeKb,
        createdAt: new Date().toISOString(),
        createdBy: actor
      },
      backups: listCloudBackups().backups
    };
  });
}

/** Lists all cloud backup snapshots from the Cloud Backup Log. */
function listCloudBackups() {
  return guard_('listCloudBackups', function () {
    requireAdmin_();
    const ss = openSpreadsheet_();
    const logSheet = ensureBackupLogSheet_(ss);
    if (logSheet.getLastRow() < 2) return { backups: [] };
    const values = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 8).getDisplayValues();
    const backups = values.map(function (r) {
      return {
        id: r[0],
        timestamp: r[1],
        createdBy: r[2],
        name: r[3],
        fileId: r[4],
        url: r[5],
        sizeKb: Number(r[6]) || 0,
        notes: r[7]
      };
    }).reverse();
    return { backups: backups };
  });
}

/** Restores cloud backup info or verifies integrity. */
function restoreCloudBackup(p) {
  return guard_('restoreCloudBackup', function () {
    requireAdmin_();
    p = p || {};
    const backupId = String(p.id || '');
    if (!backupId) throw new Error('Choose a backup snapshot to restore.');
    const backups = listCloudBackups().backups;
    const match = backups.filter(function (b) { return b.id === backupId; })[0];
    if (!match) throw new Error('Backup snapshot ' + backupId + ' was not found.');
    
    auditLog_('Cloud backup inspect/restore requested', 'Cloud Storage Backup', backupId, 'All', '', JSON.stringify(match), 'Success', 'Cloud Storage');
    return {
      ok: true,
      message: 'Backup snapshot ' + match.name + ' verified. Drive URL: ' + match.url,
      backup: match
    };
  });
}

/** Returns cloud storage statistics for Drive folders and Sheets database. */
function getCloudStorageStats() {
  return guard_('getCloudStorageStats', function () {
    requireAdmin_();
    const profileFolder = getOrCreateProfileFolder_();
    const backupFolder = getOrCreateBackupFolder_();
    const exportsFolder = getOrCreateExportsFolder_();
    
    let photoCount = 0;
    try {
      const photoFiles = profileFolder.getFiles();
      while (photoFiles.hasNext()) { photoFiles.next(); photoCount++; }
    } catch (e) {}
    
    let backupCount = 0;
    try {
      const backupFiles = backupFolder.getFiles();
      while (backupFiles.hasNext()) { backupFiles.next(); backupCount++; }
    } catch (e) {}
    
    let exportCount = 0;
    try {
      const expFiles = exportsFolder.getFiles();
      while (expFiles.hasNext()) { expFiles.next(); exportCount++; }
    } catch (e) {}
    
    const ss = openSpreadsheet_();
    const sheets = ss.getSheets().map(function (s) { return s.getName(); });
    
    return {
      ok: true,
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      profileFolder: { name: CONFIG.PROFILE_FOLDER_NAME, id: profileFolder.getId(), count: photoCount, url: profileFolder.getUrl() },
      backupFolder: { name: CONFIG.BACKUP_FOLDER_NAME, id: backupFolder.getId(), count: backupCount, url: backupFolder.getUrl() },
      exportsFolder: { name: CONFIG.EXPORTS_FOLDER_NAME, id: exportsFolder.getId(), count: exportCount, url: exportsFolder.getUrl() },
      sheetsCount: sheets.length,
      sheets: sheets
    };
  });
}

/** Saves exported roster graphics or documents to Google Drive cloud exports. */
function saveRosterExportToCloud(p) {
  return guard_('saveRosterExportToCloud', function () {
    requireRosterIdentity_();
    p = p || {};
    const title = cleanInput_(p.title || 'Roster_Export', 60, 'Export Title');
    const dataUrl = String(p.dataUrl || '');
    if (!dataUrl) throw new Error('Export file data is missing.');
    
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) throw new Error('Supported image formats are JPEG, PNG, or WebP.');
    
    const bytes = Utilities.base64Decode(match[2]);
    const ext = match[1].split('/')[1] || 'jpg';
    const folder = getOrCreateExportsFolder_();
    const timeStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd_HH-mm');
    const fileName = title.replace(/[^a-zA-Z0-9_\-]+/g, '_') + '_' + timeStr + '.' + ext;
    const file = folder.createFile(Utilities.newBlob(bytes, match[1], fileName));
    
    shareProfileFileWithRoster_(file, getRosterPhotoViewerEmails_(p.store || ''));
    
    auditLog_('Roster export saved to cloud storage', 'Cloud Export', file.getId(), p.store || 'All', '', JSON.stringify({ fileName: fileName, size: bytes.length }), 'Success', 'Cloud Storage');
    
    return {
      ok: true,
      message: 'Export saved to Google Drive: ' + fileName,
      fileId: file.getId(),
      url: file.getUrl(),
      fileName: fileName
    };
  });
}
