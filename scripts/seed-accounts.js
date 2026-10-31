const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataFile = path.resolve(__dirname, '../data/roster-data.json');
const db = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return { hash, salt };
}

function generateSecurePassword(storeCode) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let pass = 'Huft#' + storeCode + '!';
  const bytes = crypto.randomBytes(4);
  for (let i = 0; i < 4; i++) {
    pass += chars[bytes[i] % chars.length];
  }
  return pass;
}

// 1. Admin Account (HUFT@123)
const adminAuth = hashPassword('HUFT@123');
db.adminAccount = {
  email: 'admin@headsupfortails.com',
  name: 'HUFT System Administrator',
  role: 'admin',
  passwordHash: adminAuth.hash,
  salt: adminAuth.salt,
  status: 'Active',
  createdAt: '2026-10-25 10:00:00',
  lastLogin: null
};

// 2. Store Accounts
const initialStoreCredentials = [];
const storeCodes = {
  'Hyderguda': 'HYD',
  'Golden Mile': 'GLD',
  'Banjara Hills': 'BNJ',
  'Nallagandla': 'NAL',
  'Madhapur': 'MAD'
};

db.storeAccounts = db.stores.map((s, idx) => {
  const code = storeCodes[s.name] || 'STR';
  const initialPlainPass = generateSecurePassword(code);
  const auth = hashPassword(initialPlainPass);
  
  initialStoreCredentials.push({
    storeName: s.name,
    email: s.managerEmail,
    initialPassword: initialPlainPass
  });

  return {
    storeId: `STORE-${code}-${String(idx + 1).padStart(2, '0')}`,
    storeName: s.name,
    email: s.managerEmail,
    role: 'store',
    passwordHash: auth.hash,
    salt: auth.salt,
    status: 'Active',
    mustChangePassword: true,
    createdAt: '2026-10-25 10:00:00',
    lastLogin: null,
    lastLoginIp: null,
    failedAttempts: 0
  };
});

// 3. Password Requests Queue
db.passwordRequests = db.passwordRequests || [
  {
    requestId: 'REQ-PASS-20261025-01',
    storeName: 'Golden Mile',
    email: 'golden.mile@headsupfortails.com',
    type: 'Initial Activation',
    status: 'APPROVED',
    requestedAt: '2026-10-25 11:30:00',
    reviewedBy: 'admin@headsupfortails.com',
    reviewedAt: '2026-10-25 11:35:00',
    decisionNotes: 'Official store account approved and credentials dispatched.',
    deliveredEmail: true
  }
];

// 4. Security Logs
db.securityLogs = db.securityLogs || [
  {
    id: 'SEC-' + crypto.randomUUID().slice(0, 8),
    timestamp: '2026-10-25 10:00:00',
    actor: 'admin@headsupfortails.com',
    role: 'admin',
    action: 'SYSTEM_INITIALIZATION',
    store: 'All stores',
    ip: '127.0.0.1',
    userAgent: 'HUFT Enterprise Security Service',
    status: 'SUCCESS',
    details: 'Master enterprise portal security subsystem initialized with PBKDF2 hashing.'
  }
];

// Save to roster-data.json
fs.writeFileSync(dataFile, JSON.stringify(db, null, 2), 'utf8');

// Also update data/roster-db.js (omit sensitive hashes from client script for defense-in-depth, but keep account directory for metadata)
const clientSafeDb = JSON.parse(JSON.stringify(db));
// Strip password hashes from client bundle
delete clientSafeDb.adminAccount.passwordHash;
delete clientSafeDb.adminAccount.salt;
clientSafeDb.storeAccounts = clientSafeDb.storeAccounts.map(sa => {
  const c = { ...sa };
  delete c.passwordHash;
  delete c.salt;
  return c;
});

const jsContent = `/**
 * HUFT Roster Complete Master Database & Enterprise Portal Store Registry
 * Auto-generated from Excel Reference Workbook
 */
window.HUFT_DB = ${JSON.stringify(clientSafeDb, null, 2)};
`;

fs.writeFileSync(path.resolve(__dirname, '../data/roster-db.js'), jsContent, 'utf8');

console.log('=== HUFT Enterprise Accounts Seeded Successfully ===');
console.log('Admin Account: admin@headsupfortails.com (Password: HUFT@123)');
console.log('\nGenerated Initial Store Credentials:');
initialStoreCredentials.forEach(sc => {
  console.log(` - Store: ${sc.storeName} | Email: ${sc.email} | Initial Password: ${sc.initialPassword}`);
});

fs.writeFileSync(path.resolve(__dirname, '../data/initial-credentials.json'), JSON.stringify(initialStoreCredentials, null, 2), 'utf8');
