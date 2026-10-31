const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/parsed-raw-sheets.json'), 'utf8'));

console.log('Stores Sheet:');
console.log(data['Stores'].slice(0, 7));

console.log('\nHUFT Directory Sheet (first 5 rows):');
console.log(data['HUFT Directory'].slice(0, 5));

console.log('\nDeployment Requests (first 6 rows):');
console.log(data['Deployment Requests'].slice(0, 6));

console.log('\nEmail Recipients:');
console.log(data['Email Recipients']);

console.log('\nRoster Access:');
console.log(data['Roster Access']);

console.log('\nSample Month Oct26 (first 6 rows):');
console.log(data['Oct26'].slice(0, 6).map(r => r ? r.slice(0, 10) : []));
