const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/parsed-raw-sheets.json'), 'utf8'));

const monthSheets = ['Feb26', 'March26', 'April26', 'May26', 'Jun26', 'July26', 'Aug26', 'Sep26', 'Oct26', 'Nov26'];

function excelDateToIso(val) {
  if (!val) return '';
  if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) return val;
  const num = parseFloat(val);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const utc_days = Math.floor(num - 25569);
    const date = new Date(utc_days * 86400 * 1000);
    return date.toISOString().slice(0, 10);
  }
  return String(val);
}

for (const m of monthSheets) {
  const sheet = data[m];
  if (!sheet) {
    console.log(`Month ${m} not found`);
    continue;
  }
  console.log(`\n=== Month Sheet: ${m} (${sheet.length} rows) ===`);
  // find the Date row
  let dateRowIdx = -1;
  for (let r = 0; r < Math.min(10, sheet.length); r++) {
    const row = sheet[r] || [];
    if (row.some(c => c && String(c).toLowerCase().includes('date'))) {
      dateRowIdx = r;
      break;
    }
  }
  console.log(`Date row index: ${dateRowIdx}`);
  if (dateRowIdx >= 0) {
    const dates = sheet[dateRowIdx].slice(2, 35).map(excelDateToIso);
    console.log(`Dates range: ${dates[0]} to ${dates[dates.length - 1]} (total cols: ${dates.filter(Boolean).length})`);
  }
  // List first 5 non-empty employee rows
  let empCount = 0;
  for (let r = dateRowIdx + 1; r < sheet.length; r++) {
    const row = sheet[r] || [];
    const col0 = (row[0] || '').trim();
    const col1 = (row[1] || '').trim();
    if (col1 && !col1.toLowerCase().includes('retail') && !col1.toLowerCase().includes('groomer') && !col1.toLowerCase().includes('date')) {
      empCount++;
      if (empCount <= 3) {
        console.log(`  Row ${r}: store="${col0 || '(from section)'}", emp="${col1}", sample shift: col2="${row[2]}"`);
      }
    }
  }
  console.log(`Total employee rows identified: ${empCount}`);
}
