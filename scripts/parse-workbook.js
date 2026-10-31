const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '../data/xlsx_extracted/xl');

// 1. Parse shared strings
console.log('Parsing sharedStrings.xml...');
const sstXml = fs.readFileSync(path.join(baseDir, 'sharedStrings.xml'), 'utf8');
const siMatches = sstXml.match(/<si>(.*?)<\/si>/gs) || [];
const sharedStrings = [];
for (const si of siMatches) {
  const tMatches = si.match(/<t[^>]*>(.*?)<\/t>/gs) || [];
  const text = tMatches.map(t => {
    return t.replace(/<t[^>]*>/, '').replace(/<\/t>/, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }).join('');
  sharedStrings.push(text);
}
console.log(`Loaded ${sharedStrings.length} shared strings.`);

// Helper to convert column letters to 0-based index (A -> 0, Z -> 25, AA -> 26, etc.)
function colLetterToIndex(col) {
  let idx = 0;
  for (let i = 0; i < col.length; i++) {
    idx = idx * 26 + (col.charCodeAt(i) - 64);
  }
  return idx - 1;
}

// 2. Parse sheet XML into 2D array
function parseSheet(xmlPath) {
  const xml = fs.readFileSync(xmlPath, 'utf8');
  const rows = [];
  const rowMatches = xml.match(/<row\s+[^>]*>.*?<\/row>/gs) || [];

  for (const rowTag of rowMatches) {
    const rMatch = rowTag.match(/r="(\d+)"/);
    const rowIdx = rMatch ? parseInt(rMatch[1], 10) - 1 : rows.length;
    
    const row = [];
    const cellMatches = rowTag.match(/<c\s+[^>]*\/>|<c\s+[^>]*>[\s\S]*?<\/c>/g) || [];

    for (const cTag of cellMatches) {
      const cellRefMatch = cTag.match(/r="([A-Z]+)(\d+)"/);
      if (!cellRefMatch) continue;
      const colIdx = colLetterToIndex(cellRefMatch[1]);
      const cellTypeMatch = cTag.match(/t="([^"]+)"/);
      const cellType = cellTypeMatch ? cellTypeMatch[1] : '';

      let val = '';
      if (cellType === 's') {
        const vMatch = cTag.match(/<v>(\d+)<\/v>/);
        if (vMatch) {
          const sIdx = parseInt(vMatch[1], 10);
          val = sharedStrings[sIdx] || '';
        }
      } else if (cellType === 'inlineStr') {
        const tMatch = cTag.match(/<t[^>]*>(.*?)<\/t>/);
        val = tMatch ? tMatch[1] : '';
      } else {
        const vMatch = cTag.match(/<v>(.*?)<\/v>/);
        val = vMatch ? vMatch[1] : '';
      }
      row[colIdx] = val;
    }
    rows[rowIdx] = row;
  }
  return rows;
}

// 3. Map sheet names
const sheetsMeta = [
  { name: 'May26', file: 'worksheets/sheet1.xml' },
  { name: 'Roster - Permanent', file: 'worksheets/sheet2.xml' },
  { name: 'Roster - Temporary', file: 'worksheets/sheet3.xml' },
  { name: 'Roster - Removed', file: 'worksheets/sheet4.xml' },
  { name: 'Email Delivery Log', file: 'worksheets/sheet5.xml' },
  { name: 'Email Templates', file: 'worksheets/sheet6.xml' },
  { name: 'Email Recipients', file: 'worksheets/sheet7.xml' },
  { name: 'HUFT Audit Log', file: 'worksheets/sheet8.xml' },
  { name: 'Deployment Requests', file: 'worksheets/sheet9.xml' },
  { name: 'Punctuality Log', file: 'worksheets/sheet10.xml' },
  { name: 'Roster Access', file: 'worksheets/sheet11.xml' },
  { name: 'Stores', file: 'worksheets/sheet12.xml' },
  { name: 'Nov26', file: 'worksheets/sheet13.xml' },
  { name: 'HUFT Directory', file: 'worksheets/sheet14.xml' },
  { name: 'Jun26', file: 'worksheets/sheet15.xml' },
  { name: 'July26', file: 'worksheets/sheet16.xml' },
  { name: 'April26', file: 'worksheets/sheet17.xml' },
  { name: 'WA', file: 'worksheets/sheet18.xml' },
  { name: 'Aug26', file: 'worksheets/sheet19.xml' },
  { name: 'Sep26', file: 'worksheets/sheet20.xml' },
  { name: 'Oct26', file: 'worksheets/sheet21.xml' },
  { name: 'March26', file: 'worksheets/sheet22.xml' },
  { name: 'Feb26', file: 'worksheets/sheet23.xml' }
];

const workbookData = {};
for (const s of sheetsMeta) {
  const filePath = path.join(baseDir, s.file);
  if (fs.existsSync(filePath)) {
    console.log(`Parsing sheet "${s.name}"...`);
    const data = parseSheet(filePath);
    workbookData[s.name] = data;
    console.log(`  -> ${data.length} rows`);
  }
}

fs.writeFileSync(path.resolve(__dirname, '../data/parsed-raw-sheets.json'), JSON.stringify(workbookData, null, 2), 'utf8');
console.log('Saved parsed sheets to data/parsed-raw-sheets.json');
