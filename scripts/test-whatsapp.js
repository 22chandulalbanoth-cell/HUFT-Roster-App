const fs = require('fs');
const path = require('path');

// Let's create the generator functions and test them against window.HUFT_DATA
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/window\.HUFT_DATA\s*=\s*(\{[\s\S]*?\});\s*\n\s*let currentUser/);
const HUFT_DATA = JSON.parse(m[1]);

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

function generateDailyStoreWhatsAppText(storeName, selectedDate) {
  const emps = HUFT_DATA.employees || [];
  const shifts = HUFT_DATA.shifts || {};
  const storeStaff = emps.filter(e => e.store === storeName && e.active);

  const getShift = (emp) => shifts[`${emp.id}|${selectedDate}`] || emp.defaultShift || 'Opening';
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
  const retailLeaves = retailStaff.filter(e => isOff(getShift(e))).map(e => `${e.name} – ${getShift(e)}`);

  const groomDuty = groomersStaff.filter(e => !isOff(getShift(e))).map(e => `${e.name} (${getShift(e)})`);
  const groomLeaves = groomersStaff.filter(e => isOff(getShift(e))).map(e => `${e.name} – ${getShift(e)}`);

  const totalDuty = retailOpen.length + retailClose.length + groomDuty.length;
  const dParts = selectedDate.split('-');
  const dateObj = new Date(parseInt(dParts[0]), parseInt(dParts[1]) - 1, parseInt(dParts[2]));
  const dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'long' });
  const dayNum = String(dateObj.getDate()).padStart(2, '0');
  const monthName = dateObj.toLocaleDateString('en-GB', { month: 'short' });
  const yearNum = dateObj.getFullYear();
  const dFormatted = `${dayNum}-${monthName}-${yearNum} (${dayName})`;

  const openKey = retailOpen.length > 0 ? retailOpen[0] : (retailStaff[0] ? retailStaff[0].name : 'Manager');
  const closeKey = retailClose.length > 0 ? retailClose.join(', ') : (retailStaff[0] ? retailStaff[0].name : 'Manager');

  return `📅 Date: ${dFormatted}\n` +
    `🏪 Store: HUFT ${storeName}\n\n` +
    `👥 Total staff on duty: ${totalDuty}\n\n` +
    `🛒 Retail staff (${retailOpen.length + retailClose.length})\n` +
    `🔓 Opening shift: ${retailOpen.length > 0 ? retailOpen.join(', ') : 'None'}\n` +
    `🔒 Closing shift: ${retailClose.length > 0 ? retailClose.join(', ') : 'None'}\n\n` +
    `⚠️ Leaves & offs (Retail)\n` +
    `${retailLeaves.length > 0 ? retailLeaves.map(l => '• ' + l).join('\n') : '• No leaves & offs'}\n\n` +
    `✂️ Groomers (${groomDuty.length})\n` +
    `🔓 Duty shifts: ${groomDuty.length > 0 ? groomDuty.join(', ') : 'None'}\n\n` +
    `⚠️ Leaves & offs (Groomers)\n` +
    `${groomLeaves.length > 0 ? groomLeaves.map(l => '• ' + l).join('\n') : '• No leaves & offs'}\n\n` +
    `🔑 Key handover\n` +
    `• Opening key: ${openKey}\n` +
    `• Closing key: ${closeKey}\n\n` +
    `🌐 HUFT Roster Portal: https://22chandulalbanoth-cell.github.io/HUFT-Roster-App/`;
}

function generateWeeklyStoreWhatsAppText(storeName, mondayDateStr) {
  const emps = HUFT_DATA.employees || [];
  const shifts = HUFT_DATA.shifts || {};
  const storeStaff = emps.filter(e => e.store === storeName && e.active);

  const parts = mondayDateStr.split('-');
  const weekStart = new Date(parts[0], parts[1] - 1, parts[2]);
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const fmtDate = (d) => `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleDateString('en-GB', { month: 'short' })} ${d.getFullYear()}`;
  const weekRange = `${fmtDate(weekStart)} – ${fmtDate(weekEnd)}`;

  let staffSchedules = storeStaff.map(emp => {
    let daysStr = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const iso = `${y}-${m}-${day}`;
      const shift = shifts[`${emp.id}|${iso}`] || 'Opening';
      daysStr.push(`${dayNames[i]}: ${shift}`);
    }
    return `👤 *${emp.name}* (${emp.role} - ${emp.employeeId})\n` +
      `   ${daysStr.slice(0, 4).join(' | ')}\n` +
      `   ${daysStr.slice(4).join(' | ')}`;
  }).join('\n\n');

  return `🐾 *HUFT ${storeName} Store – Weekly Roster Dispatch*\n` +
    `📅 Week: ${weekRange}\n` +
    `🏪 Store: HUFT ${storeName}\n` +
    `👥 Total Team Members: ${storeStaff.length}\n\n` +
    `📋 *Weekly Schedule by Team Member:*\n\n` +
    `${staffSchedules}\n\n` +
    `⏰ *Standard Shift Timings:*\n` +
    `• Opening: 10:00 AM – 07:00 PM\n` +
    `• Mid Shift: 11:00 AM – 08:00 PM / 12:00 PM – 09:00 PM\n` +
    `• Closing: 01:00 PM – 10:00 PM\n` +
    `• SPA Timings: 11:00 AM – 08:00 PM\n\n` +
    `Please report on time. Shifts are auto-synced on the portal:\n` +
    `🌐 https://22chandulalbanoth-cell.github.io/HUFT-Roster-App/\n` +
    `_Heads Up For Tails · People & Pets. Always Better Together._`;
}

function generateIndividualStaffWhatsAppText(emp, dateStr) {
  const shifts = HUFT_DATA.shifts || {};
  const shift = shifts[`${emp.id}|${dateStr}`] || emp.defaultShift || 'Opening';
  const timing = getShiftTimingDisplay(shift);

  const dParts = dateStr.split('-');
  const dateObj = new Date(parseInt(dParts[0]), parseInt(dParts[1]) - 1, parseInt(dParts[2]));
  const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')} ${dateObj.toLocaleDateString('en-GB', { month: 'short' })} ${dateObj.getFullYear()} (${dateObj.toLocaleDateString('en-GB', { weekday: 'long' })})`;

  return `🐾 *Heads Up For Tails – Daily Shift Notice*\n` +
    `Hello ${emp.name},\n\n` +
    `Here are your assigned duty details for *${formattedDate}*:\n\n` +
    `🏪 *Store:* HUFT ${emp.store}\n` +
    `⏰ *Shift:* *${shift}* (${timing})\n` +
    `👤 *Role:* ${emp.role} · ${emp.designation}\n` +
    `🆔 *Employee ID:* ${emp.employeeId}\n\n` +
    `Please report on time. Have a wonderful day caring for our pets! 🐶🐱\n\n` +
    `🌐 Portal: https://22chandulalbanoth-cell.github.io/HUFT-Roster-App/`;
}

function generateIndividualWeeklyWhatsAppText(emp, mondayDateStr) {
  const shifts = HUFT_DATA.shifts || {};
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
    const iso = `${y}-${m}-${day}`;
    const shift = shifts[`${emp.id}|${iso}`] || 'Opening';
    scheduleLines += `• *${dayNames[i]} ${day}/${m}:* ${shift}\n`;
  }

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const fmtDate = (d) => `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleDateString('en-GB', { month: 'short' })}`;

  return `🐾 *Heads Up For Tails – Weekly Store Schedule*\n` +
    `*Team Member:* ${emp.name} (${emp.employeeId})\n` +
    `*Role:* ${emp.role} – ${emp.designation}\n` +
    `*Store:* HUFT ${emp.store}\n` +
    `*Week:* ${fmtDate(weekStart)} – ${fmtDate(weekEnd)} ${weekEnd.getFullYear()}\n\n` +
    `*Your Schedule This Week:*\n` +
    `${scheduleLines}\n` +
    `Please report on time. For shift swaps, get prior Store Manager approval.\n` +
    `🌐 Portal: https://22chandulalbanoth-cell.github.io/HUFT-Roster-App/`;
}

console.log('--- 1. TEST DAILY STORE WHATSAPP TEXT ---');
const daily = generateDailyStoreWhatsAppText('Hyderguda', '2026-10-31');
console.log(daily);

console.log('\n--- 2. TEST WEEKLY STORE WHATSAPP TEXT ---');
const weekly = generateWeeklyStoreWhatsAppText('Hyderguda', '2026-10-26');
console.log(weekly.slice(0, 500) + '...');

console.log('\n--- 3. TEST INDIVIDUAL STAFF DAILY TEXT ---');
const emp = HUFT_DATA.employees.find(e => e.name === 'Tuireising');
const indDaily = generateIndividualStaffWhatsAppText(emp, '2026-10-31');
console.log(indDaily);

console.log('\n--- 4. TEST INDIVIDUAL STAFF WEEKLY TEXT ---');
const indWeekly = generateIndividualWeeklyWhatsAppText(emp, '2026-10-26');
console.log(indWeekly);

console.log('\nPhone formatting test:');
console.log('Tuireising phone:', emp.phone, '=>', formatWhatsAppPhone(emp.phone));
const sai = HUFT_DATA.employees.find(e => e.name === 'Sai');
console.log('Sai phone:', sai.phone, '=>', formatWhatsAppPhone(sai.phone));
