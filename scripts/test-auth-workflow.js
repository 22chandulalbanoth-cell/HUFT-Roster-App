const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { apiHandlers, server } = require('./dev-server.js');

console.log('\n======================================================');
console.log('🧪 RUNNING COMPREHENSIVE ENTERPRISE AUTHENTICATION TESTS');
console.log('======================================================\n');

// Load credentials
const initialCreds = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/initial-credentials.json'), 'utf8'));
const hydCreds = initialCreds.find(c => c.storeName === 'Hyderguda');
const gldCreds = initialCreds.find(c => c.storeName === 'Golden Mile');

const meta = { ip: '127.0.0.1', userAgent: 'Automated Enterprise Test Runner' };

// Test 1: Admin Login with HUFT@123
console.log('Test 1: Admin Login with HUFT@123');
const res1 = apiHandlers.login({ email: 'admin@headsupfortails.com', password: 'HUFT@123', role: 'admin' }, meta);
console.log('  Result:', res1.ok ? '✅ SUCCESS' : '❌ FAILED', res1.user ? res1.user.name : res1.error);
assert(res1.ok, 'Admin login must succeed');
const adminToken = res1.token;

// Test 2: Admin Login with Wrong Password
console.log('\nTest 2: Admin Login with Wrong Password (Security Check)');
const res2 = apiHandlers.login({ email: 'admin@headsupfortails.com', password: 'WrongPassword!@#', role: 'admin' }, meta);
console.log('  Result:', !res2.ok ? '✅ REJECTED AS EXPECTED:' : '❌ FAILED', res2.error);
assert(!res2.ok, 'Wrong password must be rejected');

// Test 3: Store 1 (Hyderguda) Login with registered email & initial password
console.log('\nTest 3: Store 1 (Hyderguda) Login with registered email & initial password');
const res3 = apiHandlers.login({ email: hydCreds.email, password: hydCreds.initialPassword, role: 'store' }, meta);
console.log('  Result:', res3.ok ? '✅ SUCCESS' : '❌ FAILED', res3.user ? res3.user.name : res3.error);
assert(res3.ok, 'Hyderguda login must succeed');

// Test 4: Store 2 (Golden Mile) Submits Password Creation / Reset Request
console.log('\nTest 4: Store 2 (Golden Mile) Submits Password Creation / Reset Request');
const res4 = apiHandlers.requestStorePassword({ email: gldCreds.email, reason: 'Official Manager Password Reset' }, meta);
console.log('  Result:', res4.ok ? '✅ SUBMITTED:' : '❌ FAILED', res4.message);
assert(res4.ok, 'Password request must be submitted');
const gldRequestId = res4.requestId;

// Test 5: VERIFY STORE CANNOT LOGIN WHILE REQUEST IS PENDING APPROVAL
console.log('\nTest 5: VERIFY STORE CANNOT LOGIN WHILE REQUEST IS PENDING APPROVAL');
const res5 = apiHandlers.login({ email: gldCreds.email, password: gldCreds.initialPassword, role: 'store' }, meta);
console.log('  Result:', !res5.ok ? '✅ LOGIN BLOCKED AS REQUIRED:' : '❌ FAILED (Store was allowed to login!)', res5.error);
assert(!res5.ok, 'Store MUST NOT be able to login with pending request');
assert(res5.error.includes('PENDING ADMIN APPROVAL'), 'Error message must specify pending approval');

// Test 6: Admin Views Pending Requests in Admin Approval Dashboard
console.log('\nTest 6: Admin Views Pending Requests in Admin Approval Dashboard');
const res6 = apiHandlers.listPasswordRequests({}, meta);
const pending = res6.requests.filter(r => r.status === 'PENDING_APPROVAL');
console.log('  Pending Requests Count:', pending.length);
console.log('  Found Golden Mile Request:', pending.some(r => r.requestId === gldRequestId) ? '✅ YES' : '❌ NO');
assert(pending.some(r => r.requestId === gldRequestId), 'Admin must see Golden Mile pending request');

// Test 7: Admin Approves Store 2 Password Request
console.log('\nTest 7: Admin Approves Store 2 Password Request');
const res7 = apiHandlers.reviewPasswordRequest({ requestId: gldRequestId, decision: 'approve', notes: 'Approved for Golden Mile Store Manager' }, meta);
console.log('  Result:', res7.ok ? '✅ APPROVED:' : '❌ FAILED', res7.message);
assert(res7.ok, 'Admin approval must succeed');
const newTempPassword = res7.temporaryPassword;
console.log('  Generated Temporary Password:', newTempPassword);

// Test 8: Store 2 Attempts Old Password After Approval
console.log('\nTest 8: Store 2 Attempts Old Password After Approval');
const res8 = apiHandlers.login({ email: gldCreds.email, password: gldCreds.initialPassword, role: 'store' }, meta);
console.log('  Result:', !res8.ok ? '✅ OLD PASSWORD REJECTED:' : '❌ FAILED', res8.error);
assert(!res8.ok, 'Old password must be invalidated');

// Test 9: Store 2 Logs in With Newly Approved Temporary Password
console.log('\nTest 9: Store 2 Logs in With Newly Approved Temporary Password');
const res9 = apiHandlers.login({ email: gldCreds.email, password: newTempPassword, role: 'store' }, meta);
console.log('  Result:', res9.ok ? '✅ LOGIN SUCCESSFUL:' : '❌ FAILED', res9.user ? res9.user.name : res9.error);
assert(res9.ok, 'Store 2 must login successfully with new approved password');

// Test 10: Security Log Audit Inspection
console.log('\nTest 10: Security Log Audit Inspection');
const res10 = apiHandlers.getSecurityLogs({}, meta);
console.log('  Total Security Events Tracked:', res10.logs.length);
console.log('  Recent Event:', res10.logs[0].action, 'by', res10.logs[0].actor, '-', res10.logs[0].details);

console.log('\n======================================================');
console.log('🎉 ALL 10 TESTS PASSED! AUTH & APPROVAL WORKFLOW 100% VERIFIED');
console.log('======================================================\n');

// Clean up server socket
server.close();
process.exit(0);
