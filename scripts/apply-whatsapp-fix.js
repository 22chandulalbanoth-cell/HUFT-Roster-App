const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const indexPath = path.join(rootDir, 'index.html');
const dashPath = path.join(rootDir, 'Dashboard.html');

let content = fs.readFileSync(indexPath, 'utf8');

// 1. Add "WhatsApp Broadcast" button to Weekly Roster toolbar
const rosterActionsTarget = `<div class="roster-filter-actions">
          <button type="button" class="btn-roster-action primary-export" onclick="exportWeeklyRosterJPG()">
            <span style="font-size: 13px;">🖼️</span> Export JPG
          </button>
          <button type="button" class="btn-roster-action" onclick="printWeeklyRoster()">
            <span style="font-size: 13px;">🖨️</span> Print
          </button>
        </div>`;

const rosterActionsReplacement = `<div class="roster-filter-actions">
          <button type="button" class="btn-roster-action" onclick="openWhatsAppModal('weekly')" style="background:#25D366;border-color:#25D366;color:#ffffff;font-weight:700;">
            <span style="font-size: 13px;">💬</span> WhatsApp Broadcast
          </button>
          <button type="button" class="btn-roster-action primary-export" onclick="exportWeeklyRosterJPG()">
            <span style="font-size: 13px;">🖼️</span> Export JPG
          </button>
          <button type="button" class="btn-roster-action" onclick="printWeeklyRoster()">
            <span style="font-size: 13px;">🖨️</span> Print
          </button>
        </div>`;

// 2. Add "Weekly Broadcast" button to WhatsApp Tab toolbar & update date input
const waToolbarTarget = `<div style="display: flex; align-items: center; gap: 8px; margin-top: auto;">
          <button type="button" class="btn btn-secondary" onclick="exportWeeklyRosterJPG()" style="height: 38px; border-radius: 8px; font-size: 12px; font-weight: 700; background: #fff; border: 1.5px solid #CBD5E1; color: #334155; display: flex; align-items: center; gap: 6px;">
            <span>🖼️</span> <span>Export JPG</span>
          </button>
          <button type="button" class="btn btn-secondary" onclick="window.print()" style="height: 38px; border-radius: 8px; font-size: 12px; font-weight: 700; background: #fff; border: 1.5px solid #CBD5E1; color: #334155; display: flex; align-items: center; gap: 6px;">
            <span>🖨️</span> <span>Print</span>
          </button>
        </div>`;

const waToolbarReplacement = `<div style="display: flex; align-items: center; gap: 8px; margin-top: auto;">
          <button type="button" class="btn btn-secondary" onclick="openWhatsAppModal('weekly')" style="height: 38px; border-radius: 8px; font-size: 12px; font-weight: 700; background: #25D366; border: 1.5px solid #25D366; color: #fff; display: flex; align-items: center; gap: 6px; cursor: pointer;">
            <span>💬</span> <span>Weekly Broadcast</span>
          </button>
          <button type="button" class="btn btn-secondary" onclick="exportWeeklyRosterJPG()" style="height: 38px; border-radius: 8px; font-size: 12px; font-weight: 700; background: #fff; border: 1.5px solid #CBD5E1; color: #334155; display: flex; align-items: center; gap: 6px;">
            <span>🖼️</span> <span>Export JPG</span>
          </button>
          <button type="button" class="btn btn-secondary" onclick="window.print()" style="height: 38px; border-radius: 8px; font-size: 12px; font-weight: 700; background: #fff; border: 1.5px solid #CBD5E1; color: #334155; display: flex; align-items: center; gap: 6px;">
            <span>🖨️</span> <span>Print</span>
          </button>
        </div>`;

const waDateTarget = `<input type="date" id="waDateFilter" class="form-input" style="height: 38px; font-weight: 600; border-radius: 8px; border-color: #E2E8F0; background: #fff;" value="2026-11-01" onchange="renderWhatsAppTab()">`;
const waDateReplacement = `<input type="date" id="waDateFilter" class="form-input" style="height: 38px; font-weight: 600; border-radius: 8px; border-color: #E2E8F0; background: #fff;" value="2026-10-31" onchange="onWhatsAppDateChange(this.value)">`;

// 3. Upgrade WhatsApp Modal
const waModalTarget = `<!-- Modal: WhatsApp Roster Message -->
<div class="modal-overlay" id="whatsappModal">
  <div class="modal-card">
    <div class="modal-header">
      <div class="modal-title">WhatsApp Roster Dispatch</div>
      <button class="close-btn" onclick="closeWhatsAppModal()">&times;</button>
    </div>
    <div style="font-size: 12px; color: var(--brand-muted); margin-bottom: 4px;">
      Formatted store schedule ready to share directly with the store WhatsApp group:
    </div>
    <textarea id="whatsappMessageText" class="form-input" rows="8" readonly style="font-family: var(--font-mono); font-size: 11px;"></textarea>
    <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;">
      <button class="btn btn-secondary" onclick="copyWhatsAppMessage()">📋 Copy Message</button>
      <button class="btn btn-success" onclick="openWhatsAppWeb()">💬 Open WhatsApp</button>
    </div>
  </div>
</div>`;

const waModalReplacement = `<!-- Modal: WhatsApp Roster Message -->
<div class="modal-overlay" id="whatsappModal">
  <div class="modal-card" style="max-width: 620px; width: 92%;">
    <div class="modal-header">
      <div class="modal-title" id="whatsappModalTitle">WhatsApp Roster Dispatch</div>
      <button class="close-btn" onclick="closeWhatsAppModal()">&times;</button>
    </div>
    <div style="font-size: 12px; color: var(--brand-muted); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;" id="whatsappModalSubtitle">
      <span>Formatted message ready to preview, edit, and dispatch:</span>
      <span id="whatsappRecipientBadge" style="font-size: 11px; font-weight: 700; color: #16A34A; background: #DCFCE7; padding: 2px 10px; border-radius: 99px; border: 1px solid #BBF7D0;">Store Group</span>
    </div>
    <textarea id="whatsappMessageText" class="form-input" rows="12" style="font-family: var(--font-mono); font-size: 12px; line-height: 1.6; resize: vertical; border-radius: 8px; padding: 12px;"></textarea>
    <div style="display: flex; gap: 8px; justify-content: space-between; align-items: center; margin-top: 4px; flex-wrap: wrap;">
      <div style="font-size: 11.5px; color: #64748B;">
        💡 <em>You can edit this message above before copying or sending.</em>
      </div>
      <div style="display: flex; gap: 8px;">
        <button type="button" class="btn btn-secondary" onclick="copyWhatsAppMessage()">📋 Copy Message</button>
        <button type="button" class="btn btn-success" id="whatsappSendBtn" onclick="openWhatsAppWeb()" style="background: #25D366; border-color: #25D366; color: #fff; font-weight: 700; display: flex; align-items: center; gap: 6px;">
          <span>💬</span> <span>Open WhatsApp</span>
        </button>
      </div>
    </div>
  </div>
</div>`;

// 4. Enhanced WhatsApp tab controller and generators section
const waControllersReplacement = `/* ==========================================================================
   WHATSAPP ROSTER DISPATCH & STORE SUMMARIES CONTROLLERS
   ========================================================================== */
let currentWhatsAppTargetPhone = null;

function formatWhatsAppPhone(rawPhone) {
  if (!rawPhone) return '918331919091';
  const digits = String(rawPhone).replace(/[^0-9]/g, '');
  if (digits.length === 10) return '91' + digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.startsWith('0')) return '91' + digits.substring(1);
  return digits;
}

function getShiftTimingDisplay(shift) {
  const s = (shift || '').toLowerCase();
  if (s.includes('close') || s.includes('closing')) return '01:00 PM – 10:00 PM';
  if (s.includes('mid')) return '11:00 AM – 08:00 PM / 12:00 PM – 09:00 PM';
  if (s.includes('spa')) return '11:00 AM – 08:00 PM';
  if (s.includes('open') || s.includes('opening')) return '10:00 AM – 07:00 PM';
  if (s.includes('off') || s.includes('leave')) return 'Scheduled Off / Leave';
  return 'Store Shift';
}

function onWhatsAppDateChange(val) {
  if (val) {
    currentSelectedDate = val;
    updateDateDisplay();
  }
  renderWhatsAppTab();
}

function generateDailyStoreWhatsAppText(storeName, selectedDate) {
  const emps = window.HUFT_DATA.employees || [];
  const shifts = window.HUFT_DATA.shifts || {};
  const storeStaff = emps.filter(e => e.store === storeName && e.active);

  const getShift = (emp) => shifts[\`\${emp.id}|\${selectedDate}\`] || emp.defaultShift || 'Opening';
  const isOff = (s) => (s || '').toLowerCase().includes('off') || (s || '').toLowerCase().includes('leave');

  const retailStaff = storeStaff.filter(e => {
    const r = (e.role || '').toLowerCase();
    const d = (e.designation || '').toLowerCase();
    return !r.includes('groom') && !r.includes('spa') && !d.includes('groom') && !d.includes('stylist');
  });
  const groomersStaff = storeStaff.filter(e => {
    const r = (e.role || '').toLowerCase();
    const d = (e.designation || '').toLowerCase();
    return r.includes('groom') || r.includes('spa') || d.includes('groom') || d.includes('stylist');
  });

  const retailOpen = retailStaff.filter(e => ['Opening', 'Mid Shift'].includes(getShift(e))).map(e => e.name);
  const retailClose = retailStaff.filter(e => getShift(e) === 'Closing').map(e => e.name);
  const retailLeaves = retailStaff.filter(e => isOff(getShift(e))).map(e => \`\${e.name} – \${getShift(e)}\`);

  const groomDuty = groomersStaff.filter(e => !isOff(getShift(e))).map(e => \`\${e.name} (\${getShift(e)})\`);
  const groomLeaves = groomersStaff.filter(e => isOff(getShift(e))).map(e => \`\${e.name} – \${getShift(e)}\`);

  const totalDuty = retailOpen.length + retailClose.length + groomDuty.length;
  const dParts = selectedDate.split('-');
  const dateObj = new Date(parseInt(dParts[0]), parseInt(dParts[1]) - 1, parseInt(dParts[2]));
  const dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'long' });
  const dayNum = String(dateObj.getDate()).padStart(2, '0');
  const monthName = dateObj.toLocaleDateString('en-GB', { month: 'short' });
  const yearNum = dateObj.getFullYear();
  const dFormatted = \`\${dayNum}-\${monthName}-\${yearNum} (\${dayName})\`;

  const openKey = retailOpen.length > 0 ? retailOpen[0] : (retailStaff[0] ? retailStaff[0].name : 'Manager');
  const closeKey = retailClose.length > 0 ? retailClose.join(', ') : (retailStaff[0] ? retailStaff[0].name : 'Manager');

  return \`📅 Date: \${dFormatted}\\n\` +
    \`🏪 Store: HUFT \${storeName}\\n\\n\` +
    \`👥 Total staff on duty: \${totalDuty}\\n\\n\` +
    \`🛒 Retail staff (\${retailOpen.length + retailClose.length})\\n\` +
    \`🔓 Opening shift: \${retailOpen.length > 0 ? retailOpen.join(', ') : 'None'}\\n\` +
    \`🔒 Closing shift: \${retailClose.length > 0 ? retailClose.join(', ') : 'None'}\\n\\n\` +
    \`⚠️ Leaves & offs (Retail)\\n\` +
    \`\${retailLeaves.length > 0 ? retailLeaves.map(l => '• ' + l).join('\\n') : '• No leaves & offs'}\\n\\n\` +
    \`✂️ Groomers (\${groomDuty.length})\\n\` +
    \`🔓 Duty shifts: \${groomDuty.length > 0 ? groomDuty.join(', ') : 'None'}\\n\\n\` +
    \`⚠️ Leaves & offs (Groomers)\\n\` +
    \`\${groomLeaves.length > 0 ? groomLeaves.map(l => '• ' + l).join('\\n') : '• No leaves & offs'}\\n\\n\` +
    \`🔑 Key handover\\n\` +
    \`• Opening key: \${openKey}\\n\` +
    \`• Closing key: \${closeKey}\\n\\n\` +
    \`🌐 HUFT Roster Portal: https://22chandulalbanoth-cell.github.io/HUFT-Roster-App/\`;
}

function generateWeeklyStoreWhatsAppText(storeName, mondayDateStr) {
  const emps = window.HUFT_DATA.employees || [];
  const shifts = window.HUFT_DATA.shifts || {};
  const storeStaff = emps.filter(e => e.store === storeName && e.active);

  const parts = mondayDateStr.split('-');
  const weekStart = new Date(parts[0], parts[1] - 1, parts[2]);
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const fmtDate = (d) => \`\${String(d.getDate()).padStart(2, '0')} \${d.toLocaleDateString('en-GB', { month: 'short' })} \${d.getFullYear()}\`;
  const weekRange = \`\${fmtDate(weekStart)} – \${fmtDate(weekEnd)}\`;

  const staffSchedules = storeStaff.map(emp => {
    let daysStr = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const iso = \`\${y}-\${m}-\${day}\`;
      const shift = shifts[\`\${emp.id}|\${iso}\`] || 'Opening';
      daysStr.push(\`\${dayNames[i]}: \${shift}\`);
    }
    return \`👤 *\${emp.name}* (\${emp.role} - \${emp.employeeId})\\n\` +
      \`   \${daysStr.slice(0, 4).join(' | ')}\\n\` +
      \`   \${daysStr.slice(4).join(' | ')}\`;
  }).join('\\n\\n');

  return \`🐾 *HUFT \${storeName} Store – Weekly Roster Dispatch*\\n\` +
    \`📅 Week: \${weekRange}\\n\` +
    \`🏪 Store: HUFT \${storeName}\\n\` +
    \`👥 Total Team Members: \${storeStaff.length}\\n\\n\` +
    \`📋 *Weekly Schedule by Team Member:*\\n\\n\` +
    \`\${staffSchedules}\\n\\n\` +
    \`⏰ *Standard Shift Timings:*\\n\` +
    \`• Opening: 10:00 AM – 07:00 PM\\n\` +
    \`• Mid Shift: 11:00 AM – 08:00 PM / 12:00 PM – 09:00 PM\\n\` +
    \`• Closing: 01:00 PM – 10:00 PM\\n\` +
    \`• SPA Timings: 11:00 AM – 08:00 PM\\n\\n\` +
    \`Please report on time. Shifts are auto-synced on the portal:\\n\` +
    \`🌐 https://22chandulalbanoth-cell.github.io/HUFT-Roster-App/\\n\` +
    \`_Heads Up For Tails · People & Pets. Always Better Together._\`;
}

function generateIndividualStaffWhatsAppText(emp, dateStr) {
  const shifts = window.HUFT_DATA.shifts || {};
  const shift = shifts[\`\${emp.id}|\${dateStr}\`] || emp.defaultShift || 'Opening';
  const timing = getShiftTimingDisplay(shift);

  const dParts = dateStr.split('-');
  const dateObj = new Date(parseInt(dParts[0]), parseInt(dParts[1]) - 1, parseInt(dParts[2]));
  const formattedDate = \`\${String(dateObj.getDate()).padStart(2, '0')} \${dateObj.toLocaleDateString('en-GB', { month: 'short' })} \${dateObj.getFullYear()} (\${dateObj.toLocaleDateString('en-GB', { weekday: 'long' })})\`;

  return \`🐾 *Heads Up For Tails – Daily Shift Notice*\\n\` +
    \`Hello \${emp.name},\\n\\n\` +
    \`Here are your assigned duty details for *\${formattedDate}*:\\n\\n\` +
    \`🏪 *Store:* HUFT \${emp.store}\\n\` +
    \`⏰ *Shift:* *\${shift}* (\${timing})\\n\` +
    \`👤 *Role:* \${emp.role} · \${emp.designation}\\n\` +
    \`🆔 *Employee ID:* \${emp.employeeId}\\n\\n\` +
    \`Please report on time. Have a wonderful day caring for our pets! 🐶🐱\\n\\n\` +
    \`🌐 Portal: https://22chandulalbanoth-cell.github.io/HUFT-Roster-App/\`;
}

function generateIndividualWeeklyWhatsAppText(emp, mondayDateStr) {
  const shifts = window.HUFT_DATA.shifts || {};
  const parts = mondayDateStr.split('-');
  const weekStart = new Date(parts[0], parts[1] - 1, parts[2]);
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  let scheduleLines = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const iso = \`\${y}-\${m}-\${day}\`;
    const shift = shifts[\`\${emp.id}|\${iso}\`] || 'Opening';
    scheduleLines += \`• *\${dayNames[i]} \${day}/\${m}:* \${shift}\\n\`;
  }

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const fmtDate = (d) => \`\${String(d.getDate()).padStart(2, '0')} \${d.toLocaleDateString('en-GB', { month: 'short' })}\`;

  return \`🐾 *Heads Up For Tails – Weekly Store Schedule*\\n\` +
    \`*Team Member:* \${emp.name} (\${emp.employeeId})\\n\` +
    \`*Role:* \${emp.role} – \${emp.designation}\\n\` +
    \`*Store:* HUFT \${emp.store}\\n\` +
    \`*Week:* \${fmtDate(weekStart)} – \${fmtDate(weekEnd)} \${weekEnd.getFullYear()}\\n\\n\` +
    \`*Your Schedule This Week:*\\n\` +
    \`\${scheduleLines}\\n\` +
    \`Please report on time. For shift swaps, get prior Store Manager approval.\\n\` +
    \`🌐 Portal: https://22chandulalbanoth-cell.github.io/HUFT-Roster-App/\`;
}

function renderWhatsAppTab() {
  const storeSel = document.getElementById('waStoreFilter');
  const dateInput = document.getElementById('waDateFilter');
  const searchInput = document.getElementById('waSearchInput');
  const roleSel = document.getElementById('waRoleFilter');
  if (!storeSel || !dateInput) return;

  const isSuperAdmin = (currentUser && currentUser.role === 'admin');
  const userStore = (currentUser && currentUser.store && currentUser.store !== 'All Stores') ? currentUser.store : 'Hyderguda';

  // Lock store selector for Store Managers
  if (!isSuperAdmin) {
    storeSel.value = userStore;
    storeSel.disabled = true;
    storeSel.style.background = '#F8FAFC';
    storeSel.style.cursor = 'not-allowed';
  } else {
    storeSel.disabled = false;
    storeSel.style.background = '#fff';
    storeSel.style.cursor = 'pointer';
  }

  if (!dateInput.value) {
    dateInput.value = currentSelectedDate || '2026-10-31';
  }

  const selectedStore = storeSel.value || userStore;
  const selectedDate = dateInput.value || currentSelectedDate || '2026-10-31';
  const searchTerm = (searchInput ? searchInput.value : '').toLowerCase().trim();
  const selectedRole = roleSel ? roleSel.value : 'ALL';

  // Format Date for Header (e.g. SUNDAY, 1 NOV 2026)
  const dParts = selectedDate.split('-');
  const dateObj = new Date(parseInt(dParts[0]), parseInt(dParts[1]) - 1, parseInt(dParts[2]));
  const dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase();
  const dayNum = dateObj.getDate();
  const monthName = dateObj.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
  const yearNum = dateObj.getFullYear();
  const formattedHeaderDate = \`\${dayName}, \${dayNum} \${monthName} \${yearNum}\`;

  const headerTitleElem = document.getElementById('waSummaryHeaderTitle');
  if (headerTitleElem) headerTitleElem.textContent = \`STORE SUMMARIES · \${formattedHeaderDate}\`;

  const storeNameElem = document.getElementById('waStoreSummaryName');
  if (storeNameElem) storeNameElem.textContent = selectedStore;

  // Generate and set store briefing text
  const summaryText = generateDailyStoreWhatsAppText(selectedStore, selectedDate);
  const summaryElem = document.getElementById('waSummaryBriefingText');
  if (summaryElem) summaryElem.textContent = summaryText;

  // Render Individual Shift Messages Table
  const tbody = document.getElementById('waIndividualTbody');
  if (!tbody) return;

  const emps = window.HUFT_DATA.employees || [];
  const shifts = window.HUFT_DATA.shifts || {};
  const storeStaff = emps.filter(e => e.store === selectedStore && e.active);

  const getShift = (emp) => shifts[\`\${emp.id}|\${selectedDate}\`] || emp.defaultShift || 'Opening';

  let filteredStaff = storeStaff;
  if (selectedRole === 'Retail') {
    filteredStaff = storeStaff.filter(e => {
      const r = (e.role || '').toLowerCase();
      const d = (e.designation || '').toLowerCase();
      return !r.includes('groom') && !r.includes('spa') && !d.includes('groom') && !d.includes('stylist');
    });
  } else if (selectedRole === 'Groomers') {
    filteredStaff = storeStaff.filter(e => {
      const r = (e.role || '').toLowerCase();
      const d = (e.designation || '').toLowerCase();
      return r.includes('groom') || r.includes('spa') || d.includes('groom') || d.includes('stylist');
    });
  }

  if (searchTerm) {
    filteredStaff = filteredStaff.filter(e => e.name.toLowerCase().includes(searchTerm) || (e.employeeId || '').toLowerCase().includes(searchTerm));
  }

  if (filteredStaff.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:#64748B;">No team members found for this criteria.</td></tr>';
    return;
  }

  tbody.innerHTML = \`
    <tr style="background: #F1F5F9; border-top: 1px solid #E2E8F0; border-bottom: 1px solid #E2E8F0;">
      <td colspan="4" style="padding: 6px 16px; font-weight: 800; font-size: 11px; color: #475569; letter-spacing: 0.8px;">
        \${selectedStore.toUpperCase()}
      </td>
    </tr>
  \` + filteredStaff.map(emp => {
    const shift = getShift(emp);
    const r = (emp.role || '').toLowerCase();
    const d = (emp.designation || '').toLowerCase();
    const isRetail = !r.includes('groom') && !r.includes('spa') && !d.includes('groom') && !d.includes('stylist');
    const roleLabel = isRetail ? 'Retail' : 'Groomers';

    let shiftClass = 's-Opening';
    const sLow = shift.toLowerCase();
    if (sLow.includes('closing') || sLow.includes('close')) shiftClass = 's-Closing';
    else if (sLow.includes('leave')) shiftClass = 's-Leave';
    else if (sLow.includes('off')) shiftClass = 's-CompOff';
    else if (sLow.includes('spa')) shiftClass = 's-SPATimings';
    else if (sLow.includes('mid')) shiftClass = 's-MidShift';

    const initial = emp.name.charAt(0).toUpperCase();
    const avatarHtml = emp.photoUrl
      ? \`<img src="\${emp.photoUrl}" style="width: 32px; height: 32px; border-radius: 99px; object-fit: cover; border: 1.5px solid #E2E8F0;">\`
      : \`<div style="width: 32px; height: 32px; border-radius: 99px; background: #FFEDD5; color: #C2410C; font-weight: 800; font-size: 13px; display: flex; align-items: center; justify-content: center; border: 1px solid #FED7AA;">\${initial}</div>\`;

    return \`
      <tr style="border-bottom: 1px solid #F1F5F9;">
        <td style="padding: 12px 16px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            \${avatarHtml}
            <div>
              <div style="font-weight: 700; color: #0F172A; font-size: 13.5px;">\${emp.name}</div>
              <div style="font-size: 11px; color: #64748B;">\${emp.employeeId} · \${emp.designation || emp.role}</div>
            </div>
          </div>
        </td>
        <td style="text-align: center; font-size: 12px; font-weight: 600; color: #475569;">
          \${roleLabel}
        </td>
        <td style="text-align: center;">
          <span class="shift-select \${shiftClass}">\${shift}</span>
        </td>
        <td style="text-align: right; padding-right: 16px;">
          <div style="display: flex; gap: 6px; justify-content: flex-end; align-items: center;">
            <button type="button" class="btn btn-sm" onclick="editStaffWAShift('\${emp.id}', '\${selectedDate}')" style="padding: 4px 9px; font-size: 11px; font-weight: 700; border-radius: 6px; background: #fff; border: 1px solid #CBD5E1; color: #475569; cursor: pointer;">
              Edit shift
            </button>
            <button type="button" class="btn btn-sm" onclick="openWhatsAppModal('individual', '\${emp.id}', '\${selectedDate}')" style="padding: 4px 9px; font-size: 11px; font-weight: 700; border-radius: 6px; background: #fff; border: 1px solid #CBD5E1; color: #475569; cursor: pointer;">
              Edit message
            </button>
            <button type="button" class="btn btn-sm" onclick="sendIndividualStaffWA('\${emp.id}', '\${selectedDate}')" style="padding: 4px 10px; font-size: 11px; font-weight: 700; border-radius: 6px; background: #25D366; border: 1px solid #25D366; color: #fff; cursor: pointer; display: flex; align-items: center; gap: 4px;">
              <span>💬</span> <span>Send</span>
            </button>
          </div>
        </td>
      </tr>
    \`;
  }).join('');
}

function copyStoreSummaryWA() {
  const summary = document.getElementById('waSummaryBriefingText')?.textContent || '';
  if (!summary) renderWhatsAppTab();
  const finalSummary = document.getElementById('waSummaryBriefingText')?.textContent || '';
  if (!finalSummary) return;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(finalSummary).then(() => {
      showToast('Store summary copied to clipboard! Ready to paste into WhatsApp group.');
    }).catch(() => {
      openWhatsAppModal('daily');
    });
  } else {
    openWhatsAppModal('daily');
  }
}

function sendStoreSummaryWA() {
  openWhatsAppModal('daily');
}

function editStaffWAShift(empId, dateStr) {
  const emp = (window.HUFT_DATA.employees || []).find(e => e.id === empId || e.employeeId === empId);
  if (!emp) return;

  const currentShift = (window.HUFT_DATA.shifts || {})[\`\${emp.id}|\${dateStr}\`] || emp.defaultShift || 'Opening';
  const shiftsList = ['Opening', 'Mid Shift', 'Closing', 'SPA Timings', 'Leave', 'Comp Off', 'Week Off'];

  const newShift = prompt(\`Change shift for \${emp.name} on \${dateStr}:\\nAvailable: \${shiftsList.join(', ')}\`, currentShift);
  if (!newShift) return;

  const matched = shiftsList.find(s => s.toLowerCase() === newShift.toLowerCase().trim());
  if (!matched) {
    alert(\`Invalid shift! Must be one of: \${shiftsList.join(', ')}\`);
    return;
  }

  if (!window.HUFT_DATA.shifts) window.HUFT_DATA.shifts = {};
  window.HUFT_DATA.shifts[\`\${emp.id}|\${dateStr}\`] = matched;

  showToast(\`Updated shift for \${emp.name} to \${matched}!\`);
  renderWhatsAppTab();
  renderWeeklyRoster();
  renderDashboard();
}

function editStaffWAMessage(empId, dateStr) {
  openWhatsAppModal('individual', empId, dateStr);
}

function sendIndividualStaffWA(empId, dateStr) {
  openWhatsAppModal('individual', empId, dateStr);
  openWhatsAppWeb();
}`;

// Find start and end of WhatsApp section in content
const startTag = `/* ==========================================================================\n   WHATSAPP ROSTER DISPATCH & STORE SUMMARIES CONTROLLERS\n   ========================================================================== */`;
const endTag = `/* ==========================================================================\n   1. AUTHENTICATION & LOGIN (Admin, Store Manager & Employee)\n   ========================================================================== */`;

// Replace normalizations
content = content.replace(/\r\n/g, '\n');

// 1. Roster toolbar
if (content.includes(rosterActionsTarget.replace(/\r\n/g, '\n'))) {
  content = content.replace(rosterActionsTarget.replace(/\r\n/g, '\n'), rosterActionsReplacement.replace(/\r\n/g, '\n'));
  console.log('✅ Replaced roster toolbar');
} else {
  console.log('⚠️ Could not match rosterActionsTarget');
}

// 2. WhatsApp toolbar
if (content.includes(waToolbarTarget.replace(/\r\n/g, '\n'))) {
  content = content.replace(waToolbarTarget.replace(/\r\n/g, '\n'), waToolbarReplacement.replace(/\r\n/g, '\n'));
  console.log('✅ Replaced wa toolbar');
} else {
  console.log('⚠️ Could not match waToolbarTarget');
}

// 2b. WhatsApp date input
if (content.includes(waDateTarget.replace(/\r\n/g, '\n'))) {
  content = content.replace(waDateTarget.replace(/\r\n/g, '\n'), waDateReplacement.replace(/\r\n/g, '\n'));
  console.log('✅ Replaced wa date input');
} else {
  console.log('⚠️ Could not match waDateTarget');
}

// 3. WhatsApp modal
if (content.includes(waModalTarget.replace(/\r\n/g, '\n'))) {
  content = content.replace(waModalTarget.replace(/\r\n/g, '\n'), waModalReplacement.replace(/\r\n/g, '\n'));
  console.log('✅ Replaced wa modal');
} else {
  console.log('⚠️ Could not match waModalTarget');
}

// 4. WhatsApp controllers section
const sIdx = content.indexOf(startTag);
const eIdx = content.indexOf(endTag);
if (sIdx !== -1 && eIdx !== -1) {
  content = content.substring(0, sIdx) + waControllersReplacement.replace(/\r\n/g, '\n') + '\n\n\n' + content.substring(eIdx);
  console.log('✅ Replaced wa controllers section');
} else {
  console.log('⚠️ Could not find wa controllers bounds:', sIdx, eIdx);
}

// 5. Update switchTab
content = content.replace(
  `  if (tabId === 'staff') renderStaffProfiles();\n  if (tabId === 'roster') renderWeeklyRoster();\n  if (tabId === 'dashboard') renderDashboard();\n  if (tabId === 'request-staff') renderDeploymentsTable();`,
  `  if (tabId === 'wa') tabId = 'whatsapp';\n  if (tabId === 'staff') renderStaffProfiles();\n  if (tabId === 'roster') renderWeeklyRoster();\n  if (tabId === 'dashboard') renderDashboard();\n  if (tabId === 'whatsapp') renderWhatsAppTab();\n  if (tabId === 'request-staff') renderDeploymentsTable();`
);
console.log('✅ Updated switchTab');

// 6. Update applyUserSession
content = content.replace(
  `    renderDeploymentsTable();\n    renderApprovalsHub();\n    if (isSuperAdmin) {`,
  `    renderDeploymentsTable();\n    renderApprovalsHub();\n    renderWhatsAppTab();\n    if (isSuperAdmin) {`
);
console.log('✅ Updated applyUserSession');

// 7. Update navigateDate & handleAdminStoreSwitch
content = content.replace(
  `  renderDashboard();\n  renderWeeklyRoster();\n}\n\nfunction navigateRosterWeek(direction) {`,
  `  renderDashboard();\n  renderWeeklyRoster();\n  renderWhatsAppTab();\n}\n\nfunction navigateRosterWeek(direction) {`
);
console.log('✅ Updated navigateDate');

content = content.replace(
  `  if (staffFilter) staffFilter.value = currentUser.store;\n  renderDashboard();\n  renderWeeklyRoster();\n  renderStaffProfiles();\n}`,
  `  if (staffFilter) staffFilter.value = currentUser.store;\n  const waStore = document.getElementById('waStoreFilter');\n  if (waStore) waStore.value = currentUser.store;\n  const rosterStore = document.getElementById('rosterStoreFilter');\n  if (rosterStore) rosterStore.value = currentUser.store;\n  renderDashboard();\n  renderWeeklyRoster();\n  renderStaffProfiles();\n  renderWhatsAppTab();\n}`
);
console.log('✅ Updated handleAdminStoreSwitch');

// 8. Update sendIndividualWhatsAppRoster
const oldWaRoster = `function sendIndividualWhatsAppRoster(empId) {
  const emp = (window.HUFT_DATA.employees || []).find(e => e.id === empId || e.employeeId === empId);
  if (!emp) return;

  const parts = currentRosterMonday.split('-');
  const weekStart = new Date(parts[0], parts[1] - 1, parts[2]);
  const days = [];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  let scheduleLines = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const iso = \`\${y}-\${m}-\${day}\`;
    const shift = (window.HUFT_DATA.shifts || {})[\`\${emp.id}|\${iso}\`] || 'Opening';
    scheduleLines += \`• *\${dayNames[i]} \${day}/\${m}:* \${shift}
\`;
  }

  const phone = (emp.phone || '918331919091').replace(/[^0-9]/g, '');
  const cleanPhone = phone.startsWith('91') ? phone : '91' + phone;

  const msg = \`*Store Operations - Weekly Store Roster*
\` +
    \`*Team Member:* \${emp.name} (\${emp.employeeId})
\` +
    \`*Role:* \${emp.role} - \${emp.designation}
\` +
    \`*Store:* HUFT \${emp.store}

\` +
    \`*Your Schedule This Week:*
\${scheduleLines}
\` +
    \`Please report on time. For shift swaps, get prior Store Manager approval.
\` +
    \`Portal: https://22chandulalbanoth-cell.github.io/HUFT-Roster-App/\`;

  window.open(\`https://wa.me/\${cleanPhone}?text=\${encodeURIComponent(msg)}\`, '_blank');
}`;

const newWaRoster = `function sendIndividualWhatsAppRoster(empId) {
  openWhatsAppModal('individual_weekly', empId);
  openWhatsAppWeb();
}`;

if (content.includes(oldWaRoster)) {
  content = content.replace(oldWaRoster, newWaRoster);
  console.log('✅ Updated sendIndividualWhatsAppRoster');
} else {
  console.log('⚠️ Could not match oldWaRoster');
}

// 9. Update modal functions at bottom
const oldBottomModal = `function openWhatsAppModal() {
  const storeName = currentUser.store === 'All Stores' ? 'Hyderguda' : currentUser.store;
  const msg = \`*HUFT \${storeName} Store – Weekly Roster*\\n\` +
    \`📅 Week: 02 Nov 2026 – 08 Nov 2026\\n\` +
    \`Store: \${storeName} Store\\n\\n\` +
    \`Opening Staff: 6 Team Members\\n\` +
    \`Mid Shift: 3 Team Members\\n\` +
    \`Closing Staff: 4 Team Members\\n\\n\` +
    \`Please check your shifts on the HUFT Portal and plan your commute accordingly.\\n\` +
    \`Portal: https://22chandulalbanoth-cell.github.io/HUFT-Roster-App/\\n\` +
    \`People & Pets. Always Better Together.\`;

  document.getElementById('whatsappMessageText').value = msg;
  document.getElementById('whatsappModal').classList.add('open');
}

function closeWhatsAppModal() {
  document.getElementById('whatsappModal').classList.remove('open');
}

function copyWhatsAppMessage() {
  const txt = document.getElementById('whatsappMessageText');
  txt.select();
  navigator.clipboard.writeText(txt.value);
  showToast('WhatsApp message copied to clipboard!');
}

function openWhatsAppWeb() {
  const txt = encodeURIComponent(document.getElementById('whatsappMessageText').value);
  window.open(\`https://api.whatsapp.com/send?text=\${txt}\`, '_blank');
}`;

const newBottomModal = `function openWhatsAppModal(type = 'weekly', empId = null, dateStr = null) {
  const modal = document.getElementById('whatsappModal');
  const titleElem = document.getElementById('whatsappModalTitle') || document.querySelector('#whatsappModal .modal-title');
  const badgeElem = document.getElementById('whatsappRecipientBadge');
  const txtElem = document.getElementById('whatsappMessageText');
  if (!modal || !txtElem) return;

  const storeFilterSel = document.getElementById('rosterStoreFilter') || document.getElementById('waStoreFilter');
  const targetStore = (currentUser && currentUser.store && currentUser.store !== 'All Stores')
    ? currentUser.store
    : ((storeFilterSel && storeFilterSel.value !== 'ALL') ? storeFilterSel.value : 'Hyderguda');

  const selectedDate = dateStr || currentSelectedDate || '2026-10-31';
  let message = '';
  currentWhatsAppTargetPhone = null;

  if (type === 'daily') {
    if (titleElem) titleElem.textContent = \`Daily WhatsApp Briefing – HUFT \${targetStore}\`;
    if (badgeElem) badgeElem.textContent = \`Store Group (\${targetStore})\`;
    const briefing = document.getElementById('waSummaryBriefingText');
    if (briefing && briefing.textContent) {
      message = briefing.textContent;
    } else {
      message = generateDailyStoreWhatsAppText(targetStore, selectedDate);
    }
  } else if (type === 'individual' && empId) {
    const emp = (window.HUFT_DATA.employees || []).find(e => e.id === empId || e.employeeId === empId);
    if (!emp) return;
    currentWhatsAppTargetPhone = formatWhatsAppPhone(emp.phone);
    if (titleElem) titleElem.textContent = \`WhatsApp Shift Notice – \${emp.name}\`;
    if (badgeElem) badgeElem.textContent = \`\${emp.name} (+\${currentWhatsAppTargetPhone})\`;
    message = generateIndividualStaffWhatsAppText(emp, selectedDate);
  } else if (type === 'individual_weekly' && empId) {
    const emp = (window.HUFT_DATA.employees || []).find(e => e.id === empId || e.employeeId === empId);
    if (!emp) return;
    currentWhatsAppTargetPhone = formatWhatsAppPhone(emp.phone);
    if (titleElem) titleElem.textContent = \`Weekly Roster Notice – \${emp.name}\`;
    if (badgeElem) badgeElem.textContent = \`\${emp.name} (+\${currentWhatsAppTargetPhone})\`;
    message = generateIndividualWeeklyWhatsAppText(emp, currentRosterMonday);
  } else {
    if (titleElem) titleElem.textContent = \`Weekly WhatsApp Broadcast – HUFT \${targetStore}\`;
    if (badgeElem) badgeElem.textContent = \`Store Group Broadcast (\${targetStore})\`;
    message = generateWeeklyStoreWhatsAppText(targetStore, currentRosterMonday);
  }

  txtElem.value = message;
  modal.classList.add('open');
}

function closeWhatsAppModal() {
  const m = document.getElementById('whatsappModal');
  if (m) m.classList.remove('open');
}

function copyWhatsAppMessage() {
  const txtElem = document.getElementById('whatsappMessageText');
  if (!txtElem || !txtElem.value) return;
  txtElem.select();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txtElem.value).then(() => {
      showToast('WhatsApp message copied to clipboard!');
    }).catch(() => {
      document.execCommand('copy');
      showToast('WhatsApp message copied to clipboard!');
    });
  } else {
    document.execCommand('copy');
    showToast('WhatsApp message copied to clipboard!');
  }
}

function openWhatsAppWeb() {
  const txt = (document.getElementById('whatsappMessageText')?.value || '').trim();
  if (!txt) {
    alert('Please enter or generate a message first!');
    return;
  }
  const encoded = encodeURIComponent(txt);
  let targetUrl = '';
  if (currentWhatsAppTargetPhone) {
    targetUrl = \`https://api.whatsapp.com/send?phone=\${currentWhatsAppTargetPhone}&text=\${encoded}\`;
  } else {
    targetUrl = \`https://api.whatsapp.com/send?text=\${encoded}\`;
  }
  window.open(targetUrl, '_blank');
  showToast('Opening WhatsApp...');
}`;

if (content.includes(oldBottomModal)) {
  content = content.replace(oldBottomModal, newBottomModal);
  console.log('✅ Updated bottom modal functions');
} else {
  console.log('⚠️ Could not match oldBottomModal');
}

// Write back to index.html and Dashboard.html
fs.writeFileSync(indexPath, content, 'utf8');
fs.writeFileSync(dashPath, content, 'utf8');
console.log('🎉 Successfully synchronized index.html and Dashboard.html!');
