const fs = require('fs');
const path = require('path');

const db = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/roster-data.json'), 'utf8'));

const jsContent = `/**
 * HUFT Roster Complete Master Database
 * Auto-generated from Excel Reference Workbook
 * Total Staff: ${db.employees.length}
 * Total Historical Shifts: ${Object.keys(db.shifts).length}
 * Total Months: ${db.months.length}
 */
window.HUFT_DB = ${JSON.stringify(db, null, 2)};
`;

fs.writeFileSync(path.resolve(__dirname, '../data/roster-db.js'), jsContent, 'utf8');
console.log('Generated data/roster-db.js (size:', jsContent.length, 'bytes)');
