const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '../data/xlsx_extracted/xl');
const wbXml = fs.readFileSync(path.join(baseDir, 'workbook.xml'), 'utf8');

// match sheet tags
const sheetMatches = wbXml.match(/<sheet\s+[^>]+>/g) || [];
const sheets = [];
for (const tag of sheetMatches) {
  const nameMatch = tag.match(/name="([^"]+)"/);
  const sheetIdMatch = tag.match(/sheetId="([^"]+)"/);
  const rIdMatch = tag.match(/r:id="([^"]+)"/);
  sheets.push({
    name: nameMatch ? nameMatch[1] : '',
    sheetId: sheetIdMatch ? sheetIdMatch[1] : '',
    rId: rIdMatch ? rIdMatch[1] : ''
  });
}

console.log('Sheets found:');
sheets.forEach(s => console.log(`  - ${s.name} (id: ${s.sheetId}, rId: ${s.rId})`));

// Read sheet relationships
const relsXml = fs.readFileSync(path.join(baseDir, '_rels/workbook.xml.rels'), 'utf8');
const relMatches = relsXml.match(/<Relationship\s+[^>]+>/g) || [];
const rels = {};
for (const tag of relMatches) {
  const idMatch = tag.match(/Id="([^"]+)"/);
  const targetMatch = tag.match(/Target="([^"]+)"/);
  if (idMatch && targetMatch) {
    rels[idMatch[1]] = targetMatch[1];
  }
}

sheets.forEach(s => {
  s.target = rels[s.rId];
  console.log(`Sheet "${s.name}" -> ${s.target}`);
});
