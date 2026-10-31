const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const indexHtmlPath = path.join(rootDir, 'index.html');
const dashboardHtmlPath = path.join(rootDir, 'Dashboard.html');
const dbData = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'roster-data.json'), 'utf8'));

console.log('Reading index.html...');
let html = fs.readFileSync(indexHtmlPath, 'utf8');

// 1. Update DEFAULT_STAFF to use all 63 enriched employees
const oldDefaultStaffRegex = /var DEFAULT_STAFF = \[[\s\S]*?\];\s*async function handleClientCloudCall/;

const newDefaultStaffCode = `var DEFAULT_STAFF = (typeof window !== 'undefined' && window.HUFT_DB && window.HUFT_DB.employees && window.HUFT_DB.employees.length) ?
    window.HUFT_DB.employees : ${JSON.stringify(dbData.employees, null, 2)};

  async function handleClientCloudCall`;

html = html.replace(oldDefaultStaffRegex, newDefaultStaffCode);

// 2. Add Styles for Store Cards & View Toggle
const manageStyles = `
/* --- STORES & STAFF ENTERPRISE DIRECTORY STYLES --- */
.manage-mode-toggle {
  display: inline-flex;
  background: #f1f5f9;
  padding: 4px;
  border-radius: 12px;
  gap: 4px;
  margin-bottom: 18px;
}
.manage-mode-btn {
  border: none;
  background: transparent;
  padding: 8px 18px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 700;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s;
}
.manage-mode-btn.active {
  background: #ffffff;
  color: var(--huft-orange);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
}

.store-directory-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 18px;
  margin-top: 14px;
}
.store-hub-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.05);
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: relative;
  overflow: hidden;
  transition: transform 0.15s, box-shadow 0.15s;
}
.store-hub-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.08);
}
.store-hub-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--huft-orange), #ff9a5a);
}
.store-hub-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.store-hub-name {
  font-size: 17px;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.25;
}
.store-hub-code {
  font-size: 11px;
  font-weight: 800;
  color: var(--huft-orange);
  background: var(--huft-orange-light);
  padding: 3px 8px;
  border-radius: 6px;
  letter-spacing: 0.05em;
}
.store-hub-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  color: #334155;
}
.store-info-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  line-height: 1.35;
}
.store-info-icon {
  width: 16px;
  flex: none;
  color: #64748b;
  margin-top: 1px;
}
.store-services-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.service-chip {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  color: #475569;
}
.store-hub-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
  margin-top: auto;
}
.btn-view-team {
  background: var(--huft-orange-light) !important;
  color: var(--huft-orange) !important;
  border: 1px solid rgba(244, 101, 36, 0.25) !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  padding: 6px 12px !important;
  border-radius: 8px !important;
  cursor: pointer !important;
  transition: all 0.15s !important;
}
.btn-view-team:hover {
  background: var(--huft-orange) !important;
  color: #ffffff !important;
}

.employee-card {
  border-radius: 16px !important;
  padding: 16px !important;
  border: 1px solid #e2e8f0 !important;
  background: #ffffff !important;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04) !important;
  transition: transform 0.15s, box-shadow 0.15s !important;
}
.employee-card:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08) !important;
}
.employee-photo {
  width: 72px !important;
  height: 72px !important;
  border-radius: 16px !important;
  object-fit: cover !important;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08) !important;
  margin: 0 auto 10px !important;
  display: block !important;
}
.avatar.employee-photo {
  display: grid !important;
  place-items: center !important;
  font-weight: 800 !important;
  font-size: 22px !important;
  background: linear-gradient(135deg, var(--huft-orange), #ff9a5a) !important;
  color: #ffffff !important;
}
.employee-designation {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 8px;
}
.emp-contact-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.btn-contact-action {
  flex: 1;
  text-align: center;
  padding: 5px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.btn-contact-action.wa {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}
.btn-contact-action.call {
  background: #f1f5f9;
  color: #334155;
  border: 1px solid #e2e8f0;
}
`;

if (!html.includes('/* --- STORES & STAFF ENTERPRISE DIRECTORY STYLES --- */')) {
  html = html.replace('</style>', `${manageStyles}\n</style>`);
}

// 3. Upgrade viewManage to display both Stores Directory and Staff Directory
const oldViewManageRegex = /function viewManage\(md\) \{[\s\S]*?function viewRemoved\(\)/;

const newViewManageCode = `function viewManage(md) {
    if (!md || !md.found) return '<div class="panel glass empty">Loading directory...</div>';
    var emps = filtered(md, state.date, 'manage');
    var db = (typeof window !== 'undefined' && window.HUFT_DB) ? window.HUFT_DB : {};
    var allStores = db.stores || [];
    var activeMode = state.manageViewMode || 'stores'; // 'stores' or 'staff'

    var canEditAny = state.isAdmin || state.accessStores.length > 0;
    var addBtn = canEditAny ? '<button class="btn primary" id="btnAddStaff">+ Add Employee</button>' : '';
    var addStoreBtn = state.isAdmin ? '<button class="btn" id="btnAddStore">+ Register Store</button>' : '';

    var html = '<div class="panel glass staff-store-panel">';
    html += '<div class="panel-head"><div><h2>Stores &amp; Staff Directory</h2><div class="sub">Official operational registry for 5 Hyderabad stores and 63 permanent workforce personnel.</div></div>';
    html += '<div class="controls">' + addBtn + addStoreBtn + '</div></div>';

    // Sub Navigation Toggle: Stores vs Staff
    html += '<div class="manage-mode-toggle">';
    html += '  <button class="manage-mode-btn ' + (activeMode === 'stores' ? 'active' : '') + '" onclick="state.manageViewMode=\\'stores\\'; renderView();">🏬 Hyderabad Stores (' + allStores.length + ')</button>';
    html += '  <button class="manage-mode-btn ' + (activeMode === 'staff' ? 'active' : '') + '" onclick="state.manageViewMode=\\'staff\\'; renderView();">👥 Staff Directory (' + emps.length + ')</button>';
    html += '</div>';

    // 1. STORES DIRECTORY VIEW
    if (activeMode === 'stores') {
      html += '<div class="store-directory-grid">';
      allStores.forEach(function(s) {
        var cleanPh = s.phone ? s.phone.replace(/[^0-9]/g, '') : '';
        html += '<div class="store-hub-card">';
        html += '  <div class="store-hub-head">';
        html += '    <div>';
        html += '      <div class="store-hub-name">' + esc(s.officialName || s.name) + '</div>';
        html += '      <span style="font-size:12px;color:#64748b">Managed by <strong>' + esc(s.manager || 'Store Manager') + '</strong></span>';
        html += '    </div>';
        html += '    <span class="store-hub-code">' + esc(s.code || s.name.toUpperCase().substring(0, 3)) + '</span>';
        html += '  </div>';

        html += '  <div class="store-hub-info">';
        html += '    <div class="store-info-row"><span class="store-info-icon">📍</span> <span>' + esc(s.address || s.location) + '</span></div>';
        if (s.landmark) html += '    <div class="store-info-row" style="font-size:11px;color:#64748b"><span class="store-info-icon">📌</span> <span>Landmark: ' + esc(s.landmark) + '</span></div>';
        html += '    <div class="store-info-row"><span class="store-info-icon">🕒</span> <span>' + esc(s.operatingHours || '10:00 AM – 09:30 PM (All 7 Days)') + '</span></div>';
        html += '    <div class="store-info-row"><span class="store-info-icon">📞</span> <span><strong>' + esc(s.phoneFormatted || s.phone || 'N/A') + '</strong></span></div>';
        html += '    <div class="store-info-row"><span class="store-info-icon">✉️</span> <span>' + esc(s.managerEmail || (s.name.toLowerCase().replace(/\\s+/g, '') + '@headsupfortails.com')) + '</span></div>';
        
        if (s.services && s.services.length) {
          html += '    <div style="margin-top:6px"><span style="font-size:11px;font-weight:700;color:#64748b">Services:</span><div class="store-services-list">';
          s.services.forEach(function(svc) {
            html += '      <span class="service-chip">' + esc(svc) + '</span>';
          });
          html += '    </div></div>';
        }
        html += '  </div>';

        html += '  <div class="store-hub-footer">';
        html += '    <span style="font-size:12px;font-weight:700;color:#16a34a">● Active Store</span>';
        html += '    <button class="btn-view-team" onclick="state.store=\\'' + esc(s.name) + '\\'; state.manageViewMode=\\'staff\\'; var sel=document.getElementById(\\'storeSel\\'); if(sel) sel.value=\\'' + esc(s.name) + '\\'; renderView();">View Store Team (' + (s.activeStaffCount || 'Team') + ') →</button>';
        html += '  </div>';
        html += '</div>';
      });
      html += '</div>';
    }

    // 2. STAFF DIRECTORY VIEW
    else {
      // Store filter chips
      html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;align-items:center">';
      html += '  <span style="font-size:12px;font-weight:700;color:#64748b;margin-right:4px">Filter Store:</span>';
      var storeList = ['All', 'Hyderguda', 'Golden Mile', 'Banjara Hills', 'Nallagandla', 'Madhapur'];
      storeList.forEach(function(st) {
        var isSel = (state.store === st);
        html += '  <button class="btn sm" style="' + (isSel ? 'background:var(--huft-orange);color:#fff;font-weight:700' : 'background:#fff;border:1px solid #e2e8f0;color:#475569') + '" onclick="state.store=\\'' + st + '\\'; var sel=document.getElementById(\\'storeSel\\'); if(sel) sel.value=\\'' + st + '\\'; renderView();">' + st + '</button>';
      });
      html += '</div>';

      var cards = emps.map(function (e) {
        var photoSrc = e.photoUrl || state.photos[e.id];
        var avatarHtml = photoSrc ? '<img src="' + photoSrc + '" class="employee-photo" alt="' + esc(e.name) + '" onerror="this.outerHTML=\\'<div class=\\\\\\"avatar employee-photo\\\\\\" style=\\\\\\"--h:' + hue(e.name) + '\\\\\\">' + initials(e.name) + '</div>\\'">' :
          '<div class="avatar employee-photo" style="--h:' + hue(e.name) + '">' + initials(e.name) + '</div>';
        
        var canEditThis = canEditStoreClient(e.store);
        var actions = '<div class="employee-actions">' +
          (canEditThis ? '<button class="btn sm btn-edit-staff" data-id="' + esc(e.id) + '">✏️ Edit</button>' : '') +
          (canEditThis ? '<button class="btn sm btn-punc-staff" data-id="' + esc(e.id) + '" data-store="' + esc(e.store) + '" data-name="' + esc(e.name) + '" data-empid="' + esc(e.employeeId) + '">⏱ Punctuality</button>' : '') +
          (canEditThis ? '<button class="btn sm danger btn-remove-staff" data-id="' + esc(e.id) + '" data-store="' + esc(e.store) + '" data-name="' + esc(e.name) + '">✕ Remove</button>' : '') +
          '</div>';

        var cleanPh = e.phone ? cleanPhone(e.phone) : '';
        var displayPh = e.phoneFormatted || (cleanPh ? '+' + cleanPh : '—');

        return '<div class="employee-card">' +
          avatarHtml +
          '<h3 style="margin:0 0 2px;font-size:15px;color:#0f172a">' + esc(e.name) + '</h3>' +
          '<div class="employee-designation">' + esc(e.designation || roleTitle(e.role)) + '</div>' +
          '<span class="employee-role" style="background:#f1f5f9;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;color:var(--huft-orange)">' + esc(roleTitle(e.role)) + ' · ' + esc(e.store) + '</span>' +
          '<div class="employee-details" style="margin-top:10px">' +
          '<div class="employee-detail"><span>Emp ID:</span><strong>' + esc(e.employeeId || '—') + '</strong></div>' +
          '<div class="employee-detail"><span>Phone:</span><strong>' + (cleanPh ? '<a href="tel:' + cleanPh + '">' + esc(displayPh) + '</a>' : '—') + '</strong></div>' +
          '<div class="employee-detail"><span>Email:</span><strong>' + esc(e.email || '—') + '</strong></div>' +
          '</div>' +
          (cleanPh ? '<div class="emp-contact-actions"><a href="https://wa.me/' + cleanPh + '" target="_blank" class="btn-contact-action wa">💬 WhatsApp</a><a href="tel:' + cleanPh + '" class="btn-contact-action call">📞 Call</a></div>' : '') +
          actions +
          '</div>';
      }).join('');

      html += '<div class="employee-grid">' + (cards || '<div class="empty">No staff found matching filters.</div>') + '</div>';
    }

    html += '</div>';
    return html;
  }

  /* ---------- removed employees ---------- */
  function viewRemoved()`;

html = html.replace(oldViewManageRegex, newViewManageCode);

// Write to index.html and Dashboard.html
console.log('Writing updated index.html...');
fs.writeFileSync(indexHtmlPath, html, 'utf8');

console.log('Writing updated Dashboard.html...');
fs.writeFileSync(dashboardHtmlPath, html, 'utf8');

console.log('✅ Staff and store details UI patch completed successfully!');
