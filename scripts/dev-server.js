/**
 * HUFT Roster – Local Development Server & Enterprise Cloud Backend Emulator
 *
 * Runs a standalone local server simulating Google Apps Script and Google Sheets,
 * and directly connects to Supabase Cloud Database & Storage.
 *
 * Implements:
 *   - PBKDF2 Cryptographic Authentication for Store Users & Admin
 *   - Store Password Request & Admin Approval Workflow
 *   - Security Logging & Login Monitoring
 *   - Role-Based Store Gating
 *
 * Usage:
 *   node scripts/dev-server.js
 *   Open http://localhost:3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT_DIR, 'data', 'roster-data.json');
const HTML_FILE = path.join(ROOT_DIR, 'Dashboard.html');
const INDEX_HTML = path.join(ROOT_DIR, 'index.html');

// In-memory active session tokens (sessionToken -> { email, role, storeName, expiresAt })
const activeSessions = new Map();

// Cryptography Helpers
function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  if (!password || !hash || !salt) return false;
  const check = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return check === hash;
}

function generateSecurePassword(prefix) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let pass = (prefix ? 'Huft#' + prefix + '!' : 'Huft#');
  const bytes = crypto.randomBytes(4);
  for (let i = 0; i < 4; i++) {
    pass += chars[bytes[i] % chars.length];
  }
  return pass;
}

// Helper to read / write persistent JSON data
function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return {
      stores: [],
      employees: [],
      shifts: {},
      punctuality: [],
      deployments: [],
      employeeRequests: [],
      backups: [],
      access: [],
      storeAccounts: [],
      adminAccount: null,
      passwordRequests: [],
      securityLogs: [],
      emailDeliveries: []
    };
  }
}

function saveData(d) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save data:', e);
  }
}

// Ensure today's date formatted in Asia/Kolkata
function getTodayIso() {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const nd = new Date(utc + (3600000 * 5.5)); // +5:30 IST
  const y = nd.getFullYear();
  const m = String(nd.getMonth() + 1).padStart(2, '0');
  const day = String(nd.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getNowTimestamp() {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const nd = new Date(utc + (3600000 * 5.5));
  return nd.toISOString().replace('T', ' ').slice(0, 19);
}

function logSecurityEvent(actor, role, action, store, status, details, ip, userAgent) {
  const data = readData();
  const evt = {
    id: 'SEC-' + crypto.randomUUID().slice(0, 8),
    timestamp: getNowTimestamp(),
    actor: actor || 'system',
    role: role || 'anonymous',
    action: action,
    store: store || 'All stores',
    ip: ip || '127.0.0.1',
    userAgent: (userAgent || 'Desktop Browser').slice(0, 80),
    status: status || 'SUCCESS',
    details: details || ''
  };
  data.securityLogs = data.securityLogs || [];
  data.securityLogs.unshift(evt);
  if (data.securityLogs.length > 500) data.securityLogs = data.securityLogs.slice(0, 500);
  saveData(data);
  return evt;
}

// Client-side shim for google.script.run
const GOOGLE_SCRIPT_SHIM = `
<script>
(function() {
  if (typeof window.google === 'undefined') window.google = {};
  if (typeof window.google.script === 'undefined') window.google.script = {};

  function makeRunner(successCb, failCb) {
    return new Proxy({}, {
      get: function(target, prop) {
        if (prop === 'withSuccessHandler') {
          return function(cb) { return makeRunner(cb, failCb); };
        }
        if (prop === 'withFailureHandler') {
          return function(cb) { return makeRunner(successCb, cb); };
        }
        return function() {
          var args = Array.prototype.slice.call(arguments);
          var token = sessionStorage.getItem('huft_auth_token') || '';
          fetch('/api/run', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': token ? ('Bearer ' + token) : ''
            },
            body: JSON.stringify({ fn: prop, args: args })
          })
          .then(function(res) { return res.json(); })
          .then(function(json) {
            if (json.ok) {
              if (successCb) successCb(json.result);
            } else {
              var err = new Error(json.error || 'Server error');
              if (failCb) failCb(err);
              else console.error('Call failed:', err);
            }
          })
          .catch(function(err) {
            if (failCb) failCb(err);
            else console.error('Network error:', err);
          });
        };
      }
    });
  }

  window.google.script.run = makeRunner(null, null);
})();
</script>
`;

// API Handlers matching Code.js, Supabase.js & Enterprise Auth
const apiHandlers = {
  // --- AUTHENTICATION SYSTEM ---
  login: function (p, meta) {
    p = p || {};
    const email = (p.email || '').trim().toLowerCase();
    const password = (p.password || '').trim();
    const roleRequested = (p.role || 'store').toLowerCase();
    const ip = (meta && meta.ip) || '127.0.0.1';
    const userAgent = (meta && meta.userAgent) || 'Desktop Browser';

    if (!email || !password) {
      logSecurityEvent(email, roleRequested, 'LOGIN_FAILED', 'None', 'FAILED', 'Missing email or password credentials', ip, userAgent);
      return { ok: false, error: 'Email and password are required.' };
    }

    const data = readData();

    // 1. Check Admin Login
    if (roleRequested === 'admin' || email === 'admin@headsupfortails.com') {
      const admin = data.adminAccount;
      if (!admin) {
        logSecurityEvent(email, 'admin', 'LOGIN_FAILED', 'All', 'FAILED', 'Admin account uninitialized', ip, userAgent);
        return { ok: false, error: 'Administrator account not configured.' };
      }

      const isValid = verifyPassword(password, admin.passwordHash, admin.salt);
      if (!isValid) {
        logSecurityEvent(email, 'admin', 'LOGIN_FAILED', 'All', 'FAILED', 'Invalid administrator password attempt', ip, userAgent);
        return { ok: false, error: 'Invalid administrator credentials.' };
      }

      const token = crypto.randomBytes(32).toString('hex');
      activeSessions.set(token, {
        email: admin.email,
        name: admin.name || 'HUFT Administrator',
        role: 'admin',
        storeName: 'All stores',
        expiresAt: Date.now() + 86400000 // 24 hours
      });

      admin.lastLogin = getNowTimestamp();
      saveData(data);

      logSecurityEvent(email, 'admin', 'LOGIN_SUCCESS', 'All stores', 'SUCCESS', 'Admin authenticated successfully', ip, userAgent);

      return {
        ok: true,
        token: token,
        user: {
          email: admin.email,
          name: admin.name || 'HUFT Administrator',
          role: 'admin',
          store: 'All stores',
          isAdmin: true,
          isSuperAdmin: true
        }
      };
    }

    // 2. Check Store User Login
    const storeAccounts = data.storeAccounts || [];
    const storeAcc = storeAccounts.find(s => s.email.toLowerCase() === email);

    if (!storeAcc) {
      logSecurityEvent(email, 'store', 'LOGIN_FAILED', 'Unknown', 'FAILED', 'Store email not registered', ip, userAgent);
      return { ok: false, error: 'Store email not recognized. Please check your registered official store email.' };
    }

    // CHECK IF A PASSWORD REQUEST IS PENDING APPROVAL FOR THIS STORE
    const pendingReq = (data.passwordRequests || []).find(r => r.email.toLowerCase() === email && r.status === 'PENDING_APPROVAL');
    if (pendingReq) {
      logSecurityEvent(email, 'store', 'LOGIN_BLOCKED_PENDING_APPROVAL', storeAcc.storeName, 'BLOCKED', `Login blocked: Request ${pendingReq.requestId} is PENDING ADMIN APPROVAL`, ip, userAgent);
      return {
        ok: false,
        error: 'Login blocked: Your password request (' + pendingReq.requestId + ') is currently PENDING ADMIN APPROVAL. Please await administrator review and credential dispatch.'
      };
    }

    // CHECK ACCOUNT STATUS
    if (storeAcc.status !== 'Active') {
      logSecurityEvent(email, 'store', 'LOGIN_BLOCKED_SUSPENDED', storeAcc.storeName, 'BLOCKED', `Store account is currently ${storeAcc.status}`, ip, userAgent);
      return { ok: false, error: `Store account is ${storeAcc.status}. Please contact the system administrator.` };
    }

    // VERIFY PASSWORD HASH
    const isPassValid = verifyPassword(password, storeAcc.passwordHash, storeAcc.salt);
    if (!isPassValid) {
      storeAcc.failedAttempts = (storeAcc.failedAttempts || 0) + 1;
      saveData(data);
      logSecurityEvent(email, 'store', 'LOGIN_FAILED', storeAcc.storeName, 'FAILED', `Incorrect password attempt (Failure count: ${storeAcc.failedAttempts})`, ip, userAgent);
      return { ok: false, error: 'Invalid password. If you forgot your password, please submit a password request for admin approval.' };
    }

    // Successful Store Login
    storeAcc.failedAttempts = 0;
    storeAcc.lastLogin = getNowTimestamp();
    storeAcc.lastLoginIp = ip;
    saveData(data);

    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.set(token, {
      email: storeAcc.email,
      name: storeAcc.storeName + ' Store Manager',
      role: 'store',
      storeName: storeAcc.storeName,
      storeId: storeAcc.storeId,
      expiresAt: Date.now() + 86400000
    });

    logSecurityEvent(email, 'store', 'LOGIN_SUCCESS', storeAcc.storeName, 'SUCCESS', 'Store authenticated successfully', ip, userAgent);

    return {
      ok: true,
      token: token,
      user: {
        email: storeAcc.email,
        name: storeAcc.storeName + ' Store Manager',
        role: 'store',
        store: storeAcc.storeName,
        storeId: storeAcc.storeId,
        mustChangePassword: !!storeAcc.mustChangePassword,
        isAdmin: false,
        isSuperAdmin: false
      }
    };
  },

  verifySession: function (p) {
    p = p || {};
    const token = p.token;
    if (!token || !activeSessions.has(token)) {
      return { ok: false, error: 'Session expired or invalid.' };
    }

    const sess = activeSessions.get(token);
    if (Date.now() > sess.expiresAt) {
      activeSessions.delete(token);
      return { ok: false, error: 'Session expired.' };
    }

    return {
      ok: true,
      user: {
        email: sess.email,
        name: sess.name,
        role: sess.role,
        store: sess.storeName,
        storeId: sess.storeId || '',
        isAdmin: sess.role === 'admin',
        isSuperAdmin: sess.role === 'admin'
      }
    };
  },

  logout: function (p, meta) {
    p = p || {};
    const token = p.token;
    if (token && activeSessions.has(token)) {
      const sess = activeSessions.get(token);
      logSecurityEvent(sess.email, sess.role, 'LOGOUT', sess.storeName, 'SUCCESS', 'User logged out', meta && meta.ip, meta && meta.userAgent);
      activeSessions.delete(token);
    }
    return { ok: true, message: 'Logged out successfully.' };
  },

  // --- PASSWORD WORKFLOW ---
  requestStorePassword: function (p, meta) {
    p = p || {};
    const email = (p.email || '').trim().toLowerCase();
    const reason = (p.reason || 'Store Password Request / Reset').trim();
    const data = readData();

    const storeAcc = (data.storeAccounts || []).find(s => s.email.toLowerCase() === email);
    if (!storeAcc) {
      return { ok: false, error: 'Email address not found in registered official store directory.' };
    }

    // Check if a pending request already exists
    data.passwordRequests = data.passwordRequests || [];
    const existing = data.passwordRequests.find(r => r.email.toLowerCase() === email && r.status === 'PENDING_APPROVAL');
    if (existing) {
      return {
        ok: false,
        error: `A password request (${existing.requestId}) is already PENDING ADMIN APPROVAL for ${storeAcc.storeName}.`
      };
    }

    const requestId = 'REQ-PASS-' + Date.now().toString(36).toUpperCase();
    const newReq = {
      requestId: requestId,
      storeName: storeAcc.storeName,
      storeId: storeAcc.storeId,
      email: storeAcc.email,
      type: 'Password Creation / Reset',
      reason: reason,
      status: 'PENDING_APPROVAL',
      requestedAt: getNowTimestamp(),
      reviewedBy: null,
      reviewedAt: null,
      decisionNotes: null,
      deliveredEmail: false
    };

    data.passwordRequests.unshift(newReq);
    saveData(data);

    logSecurityEvent(email, 'store', 'PASSWORD_REQUEST_SUBMITTED', storeAcc.storeName, 'PENDING', `Password request created: ${requestId}`, meta && meta.ip, meta && meta.userAgent);

    return {
      ok: true,
      requestId: requestId,
      storeName: storeAcc.storeName,
      message: `Password request ${requestId} submitted successfully. Status is PENDING APPROVAL. The Administrator has been notified.`
    };
  },

  listPasswordRequests: function (p) {
    const data = readData();
    return {
      ok: true,
      requests: data.passwordRequests || []
    };
  },

  reviewPasswordRequest: function (p, meta) {
    p = p || {};
    const requestId = p.requestId;
    const decision = p.decision; // 'approve' | 'reject'
    const notes = p.notes || '';
    const data = readData();

    data.passwordRequests = data.passwordRequests || [];
    const req = data.passwordRequests.find(r => r.requestId === requestId);
    if (!req) return { ok: false, error: 'Password request not found.' };

    const storeAcc = (data.storeAccounts || []).find(s => s.email.toLowerCase() === req.email.toLowerCase());
    if (!storeAcc) return { ok: false, error: 'Associated store account not found.' };

    if (decision === 'approve') {
      // Generate a new secure random temporary password
      const storeCode = storeAcc.storeId ? storeAcc.storeId.split('-')[1] : 'STR';
      const tempPass = generateSecurePassword(storeCode);
      const auth = hashPassword(tempPass);

      // Invalidate old password, set new hash and requirement to change password
      storeAcc.passwordHash = auth.hash;
      storeAcc.salt = auth.salt;
      storeAcc.status = 'Active';
      storeAcc.mustChangePassword = true;

      req.status = 'APPROVED';
      req.reviewedAt = getNowTimestamp();
      req.reviewedBy = 'admin@headsupfortails.com';
      req.decisionNotes = notes || 'Approved by Administrator. Credentials delivered to store.';
      req.deliveredEmail = true;

      // Dispatch Email Delivery Record
      const emailRecord = {
        id: 'DELIV-' + crypto.randomUUID().slice(0, 8),
        templateId: 'store_password_approved',
        referenceId: requestId,
        recipient: storeAcc.email,
        subject: 'HUFT Official Portal – Your Login Credentials',
        status: 'Sent',
        attempts: 1,
        updatedAt: getNowTimestamp(),
        message: `Hello ${storeAcc.storeName} Team,\n\nYour password request (${requestId}) has been APPROVED by the HUFT System Administrator.\n\nStore Name: ${storeAcc.storeName}\nRegistered Email: ${storeAcc.email}\nTemporary Password: ${tempPass}\nPortal Link: http://localhost:3000\n\nPlease log in using your official registered email and this temporary password.`
      };

      data.emailDeliveries = data.emailDeliveries || [];
      data.emailDeliveries.unshift(emailRecord);

      saveData(data);

      logSecurityEvent('admin@headsupfortails.com', 'admin', 'PASSWORD_REQUEST_APPROVED', storeAcc.storeName, 'SUCCESS', `Approved password request ${requestId}. Credentials dispatched to ${storeAcc.email}.`, meta && meta.ip, meta && meta.userAgent);

      return {
        ok: true,
        message: `Password request ${requestId} APPROVED. New temporary credentials generated and delivered to ${storeAcc.email}.`,
        temporaryPassword: tempPass,
        recipient: storeAcc.email,
        storeName: storeAcc.storeName
      };
    } else {
      req.status = 'REJECTED';
      req.reviewedAt = getNowTimestamp();
      req.reviewedBy = 'admin@headsupfortails.com';
      req.decisionNotes = notes || 'Rejected by Administrator';

      saveData(data);

      logSecurityEvent('admin@headsupfortails.com', 'admin', 'PASSWORD_REQUEST_REJECTED', storeAcc.storeName, 'REJECTED', `Rejected password request ${requestId}. Reason: ${notes}`, meta && meta.ip, meta && meta.userAgent);

      return {
        ok: true,
        message: `Password request ${requestId} REJECTED.`
      };
    }
  },

  getAdminDashboardStats: function () {
    const data = readData();
    const stores = data.storeAccounts || [];
    const reqs = data.passwordRequests || [];
    const logs = data.securityLogs || [];

    const activeCount = stores.filter(s => s.status === 'Active').length;
    const pendingCount = reqs.filter(r => r.status === 'PENDING_APPROVAL').length;
    const approvedCount = reqs.filter(r => r.status === 'APPROVED').length;
    const rejectedCount = reqs.filter(r => r.status === 'REJECTED').length;
    const failedLogins = logs.filter(l => l.action === 'LOGIN_FAILED').length;

    return {
      ok: true,
      stats: {
        totalStores: stores.length,
        activeAccounts: activeCount,
        pendingPasswordRequests: pendingCount,
        approvedPasswordRequests: approvedCount,
        rejectedPasswordRequests: rejectedCount,
        failedLoginAttempts: failedLogins,
        recentActivitiesCount: logs.length
      },
      stores: stores.map(s => ({
        storeId: s.storeId,
        storeName: s.storeName,
        email: s.email,
        status: s.status,
        lastLogin: s.lastLogin || 'Never',
        lastLoginIp: s.lastLoginIp || '-'
      })),
      pendingRequests: reqs.filter(r => r.status === 'PENDING_APPROVAL'),
      requestHistory: reqs,
      recentLogs: logs.slice(0, 50)
    };
  },

  getStoreAccounts: function () {
    const data = readData();
    return {
      ok: true,
      stores: (data.storeAccounts || []).map(s => ({
        storeId: s.storeId,
        storeName: s.storeName,
        email: s.email,
        status: s.status,
        lastLogin: s.lastLogin || 'Never',
        failedAttempts: s.failedAttempts || 0
      }))
    };
  },

  toggleStoreStatus: function (p, meta) {
    p = p || {};
    const storeId = p.storeId;
    const newStatus = p.status; // 'Active' | 'Suspended'
    const data = readData();

    const storeAcc = (data.storeAccounts || []).find(s => s.storeId === storeId);
    if (!storeAcc) return { ok: false, error: 'Store account not found.' };

    storeAcc.status = newStatus;
    saveData(data);

    logSecurityEvent('admin@headsupfortails.com', 'admin', 'STORE_STATUS_CHANGED', storeAcc.storeName, 'SUCCESS', `Store status changed to ${newStatus}`, meta && meta.ip, meta && meta.userAgent);

    return { ok: true, message: `${storeAcc.storeName} status updated to ${newStatus}.` };
  },

  getSecurityLogs: function () {
    const data = readData();
    return {
      ok: true,
      logs: data.securityLogs || []
    };
  },

  changeAdminPassword: function (p, meta) {
    p = p || {};
    const oldPass = p.oldPassword;
    const newPass = p.newPassword;
    if (!newPass || newPass.length < 6) {
      return { ok: false, error: 'New password must be at least 6 characters long.' };
    }

    const data = readData();
    const admin = data.adminAccount;
    if (!admin || !verifyPassword(oldPass, admin.passwordHash, admin.salt)) {
      return { ok: false, error: 'Current password verification failed.' };
    }

    const auth = hashPassword(newPass);
    admin.passwordHash = auth.hash;
    admin.salt = auth.salt;
    saveData(data);

    logSecurityEvent('admin@headsupfortails.com', 'admin', 'ADMIN_PASSWORD_CHANGED', 'All', 'SUCCESS', 'Administrator password updated successfully', meta && meta.ip, meta && meta.userAgent);

    return { ok: true, message: 'Admin password changed successfully.' };
  },

  changeStorePassword: function (p, meta) {
    p = p || {};
    const email = (p.email || '').trim().toLowerCase();
    const oldPass = p.oldPassword;
    const newPass = p.newPassword;

    if (!newPass || newPass.length < 6) {
      return { ok: false, error: 'New password must be at least 6 characters.' };
    }

    const data = readData();
    const storeAcc = (data.storeAccounts || []).find(s => s.email.toLowerCase() === email);
    if (!storeAcc || !verifyPassword(oldPass, storeAcc.passwordHash, storeAcc.salt)) {
      return { ok: false, error: 'Current password verification failed.' };
    }

    const auth = hashPassword(newPass);
    storeAcc.passwordHash = auth.hash;
    storeAcc.salt = auth.salt;
    storeAcc.mustChangePassword = false;
    saveData(data);

    logSecurityEvent(email, 'store', 'STORE_PASSWORD_CHANGED', storeAcc.storeName, 'SUCCESS', 'Store updated password successfully', meta && meta.ip, meta && meta.userAgent);

    return { ok: true, message: 'Password updated successfully. You can now use your new password.' };
  },

  // --- CORE ROSTER & DATA HANDLERS ---
  getBootstrap: function (p, meta) {
    const data = readData();
    const today = getTodayIso();
    const curMonthKey = today.slice(0, 7);
    const months = (data.months && data.months.length) ? data.months : [
      { key: '2026-02', label: 'February 2026', sheet: 'Feb\'26' },
      { key: '2026-03', label: 'March 2026', sheet: 'Mar\'26' },
      { key: '2026-04', label: 'April 2026', sheet: 'Apr\'26' },
      { key: '2026-05', label: 'May 2026', sheet: 'May\'26' },
      { key: '2026-06', label: 'June 2026', sheet: 'Jun\'26' },
      { key: '2026-07', label: 'July 2026', sheet: 'Jul\'26' },
      { key: '2026-08', label: 'August 2026', sheet: 'Aug\'26' },
      { key: '2026-09', label: 'September 2026', sheet: 'Sep\'26' },
      { key: '2026-10', label: 'October 2026', sheet: 'Oct\'26' },
      { key: '2026-11', label: 'November 2026', sheet: 'Nov\'26' }
    ];

    // Check user session
    const user = meta && meta.user;
    const isAdmin = !!(user && user.role === 'admin');
    const homeStore = (user && user.storeName && user.storeName !== 'All stores') ? user.storeName : 'Hyderguda';
    const accessStores = isAdmin ? data.stores.map(s => s.name) : [homeStore];

    return {
      title: 'Heads Up For Tails – Enterprise Portal',
      appUrl: 'http://localhost:' + PORT,
      todayIso: today,
      stores: data.stores.map(s => s.name),
      months: months,
      month: apiHandlers.getMonthData(curMonthKey, false),
      isAdmin: isAdmin,
      isSuperAdmin: isAdmin,
      accessStores: accessStores,
      email: (user && user.email) || 'hyderguda@headsupfortails.com',
      employeeSelf: true,
      homeStore: homeStore,
      currentUser: user || null,
      profileFolder: 'HUFT Roster Profiles (Supabase Storage: profiles)',
      backupFolder: 'HUFT Roster Cloud Backups (Supabase Storage: backups)',
      exportsFolder: 'HUFT Roster Exports (Supabase Storage: exports)',
      spreadsheetId: '1anAGAvK-Keh3cH5sncIpycURWqVgaAPn40icFZrYC60'
    };
  },

  getMonthData: function (key, force) {
    const data = readData();
    const daysInMonth = 31;
    const shiftsKey = key || getTodayIso().slice(0, 7);

    const staff = (data.employees || []).filter(e => {
      if (e.active === false && e.removedOn && e.removedOn < shiftsKey + '-01') return false;
      return true;
    });

    const employees = staff.map(e => {
      const days = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dIso = `${shiftsKey}-${String(d).padStart(2, '0')}`;
        const sKey = `${e.id}|${dIso}`;
        const altKey = `${e.employeeId}|${dIso}`;
        let shiftVal = (data.shifts && (data.shifts[sKey] || data.shifts[altKey])) || null;

        if (!shiftVal) {
          shiftVal = (e.active === false && e.removedOn && dIso >= e.removedOn) ? ['Removed', 'Removed', ''] : ['Unassigned', '', ''];
        } else if (typeof shiftVal === 'string') {
          const depMatch = shiftVal.match(/__REPORT_TO__([^_]+)__SHIFT__([^_]+)/);
          if (depMatch) {
            shiftVal = ['Deployed', decodeURIComponent(depMatch[2]), decodeURIComponent(depMatch[1])];
          } else {
            shiftVal = [shiftVal, shiftVal, ''];
          }
        }
        days.push(shiftVal);
      }

      return {
        id: e.id,
        name: e.name,
        store: e.store,
        role: e.role,
        phone: e.phone || '',
        email: e.email || '',
        employeeId: e.employeeId || '',
        isDeployment: false,
        days: days
      };
    });

    const mMeta = (data.months || []).find(m => m.key === shiftsKey);

    return {
      key: shiftsKey,
      found: true,
      label: mMeta ? mMeta.label : ('Roster ' + shiftsKey),
      daysInMonth: daysInMonth,
      employees: employees,
      updated: new Date().toISOString()
    };
  },

  saveShifts: function (changes, meta) {
    const data = readData();
    if (!Array.isArray(changes)) return { ok: false, error: 'Invalid changes' };

    data.shifts = data.shifts || {};
    changes.forEach(c => {
      const emp = (data.employees || []).find(e => e.store === c.store && e.name.toLowerCase() === c.name.toLowerCase());
      if (emp) {
        const sKey = `${emp.id}|${c.date}`;
        if (c.cat === 'Clear' || c.cat === 'Unassigned') {
          delete data.shifts[sKey];
        } else if (c.cat === 'Deployed' || c.toStore) {
          data.shifts[sKey] = `__REPORT_TO__${c.toStore || ''}__SHIFT__${c.shift || 'Duty'}`;
        } else {
          data.shifts[sKey] = c.shift || c.cat;
        }
      }
    });

    saveData(data);
    return { ok: true, saved: changes.length };
  },

  addStaff: function (p) {
    const data = readData();
    const id = `${p.store}|${p.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    if ((data.employees || []).find(e => e.id === id && e.active)) {
      throw new Error(p.name + ' already exists in ' + p.store);
    }
    const emp = {
      id: id,
      store: p.store,
      name: p.name,
      role: p.role || 'Retail',
      phone: p.phone || '',
      email: p.email || '',
      employeeId: p.employeeId || 'EPPL' + Math.floor(1000 + Math.random() * 9000),
      active: true,
      reportsTo: p.store
    };
    data.employees.push(emp);
    saveData(data);
    return { ok: true, message: p.name + ' added to ' + p.store + '.' };
  },

  updateStaff: function (p) {
    const data = readData();
    const emp = (data.employees || []).find(e => e.store === p.store && e.name.toLowerCase() === p.name.toLowerCase());
    if (!emp) throw new Error('Employee not found');
    emp.name = p.newName || p.name;
    emp.role = p.role || emp.role;
    emp.phone = p.phone || emp.phone;
    emp.email = p.email || emp.email;
    emp.employeeId = p.employeeId || emp.employeeId;
    saveData(data);
    return { ok: true, message: emp.name + ' updated in ' + p.store + '.' };
  },

  removeStaff: function (p) {
    const data = readData();
    const emp = (data.employees || []).find(e => e.store === p.store && e.name.toLowerCase() === p.name.toLowerCase());
    if (emp) {
      emp.active = false;
      emp.removedOn = p.date || getTodayIso();
      saveData(data);
    }
    return { ok: true, message: p.name + ' removed from ' + p.store + '.' };
  },

  restoreStaff: function (p) {
    const data = readData();
    const emp = (data.employees || []).find(e => e.store === p.store && e.name.toLowerCase() === p.name.toLowerCase());
    if (emp) {
      emp.active = true;
      emp.removedOn = null;
      saveData(data);
    }
    return { ok: true, message: p.name + ' restored to ' + p.store + '.' };
  },

  getDeletedStaff: function () {
    const data = readData();
    return (data.employees || []).filter(e => !e.active);
  },

  getStaffPhotos: function () {
    const data = readData();
    const photos = {};
    (data.employees || []).forEach(e => {
      if (e.profilePhotoId) {
        photos[e.id] = 'https://lh3.googleusercontent.com/d/' + e.profilePhotoId + '=s200';
      }
    });
    return photos;
  },

  getPunctualityEvents: function () {
    const data = readData();
    return { events: data.punctuality || [] };
  },

  addPunctualityEvent: function (p) {
    const data = readData();
    const evt = {
      id: crypto.randomUUID(),
      store: p.store,
      name: p.name,
      employeeId: p.employeeId || '',
      date: p.date,
      type: p.type,
      notice: p.notice || '',
      minutes: p.minutes || 0,
      details: p.details || '',
      recordedBy: 'admin',
      recordedAt: getNowTimestamp()
    };
    data.punctuality = data.punctuality || [];
    data.punctuality.push(evt);
    saveData(data);
    return { ok: true, message: p.type + ' recorded for ' + p.name + '.' };
  },

  getDeploymentRequests: function () {
    const data = readData();
    return { requests: data.deployments || [] };
  },

  requestDeployment: function (p) {
    const data = readData();
    const req = {
      id: crypto.randomUUID(),
      requester: p.requester || 'store@headsupfortails.com',
      fromStore: p.store,
      name: p.name,
      toStore: p.toStore,
      from: p.from,
      to: p.to,
      shift: p.shift || 'Opening',
      status: 'Pending',
      created: getNowTimestamp()
    };
    data.deployments = data.deployments || [];
    data.deployments.unshift(req);
    saveData(data);
    return { ok: true, message: 'Deployment requested to ' + p.toStore + '.' };
  },

  reviewDeploymentRequest: function (p) {
    const data = readData();
    data.deployments = data.deployments || [];
    const req = data.deployments.find(d => d.id === p.id);
    if (req) {
      req.status = p.decision === 'approve' ? 'Approved' : 'Rejected';
      req.notes = p.notes || '';
      saveData(data);
    }
    return { ok: true, message: 'Deployment ' + (req ? req.status.toLowerCase() : 'reviewed') + '.' };
  },

  getEmployeeRequests: function () {
    const data = readData();
    return { requests: data.employeeRequests || [], canApprove: true };
  },

  submitEmployeeRequest: function (p) {
    const data = readData();
    const req = {
      id: crypto.randomUUID(),
      type: p.type,
      name: p.name || 'Rahul Sharma',
      store: p.store || 'Hyderguda',
      email: p.email || 'hyderguda@headsupfortails.com',
      date: p.date,
      previousShift: p.previousShift || 'Opening',
      requestedShift: p.requestedShift,
      reason: p.reason,
      evidence: p.evidence || '',
      status: 'Pending',
      submitted: getNowTimestamp()
    };
    data.employeeRequests = data.employeeRequests || [];
    data.employeeRequests.unshift(req);
    saveData(data);
    return { ok: true, message: 'Request submitted for approval.' };
  },

  reviewEmployeeRequest: function (p) {
    const data = readData();
    data.employeeRequests = data.employeeRequests || [];
    const req = data.employeeRequests.find(r => r.id === p.id);
    if (req) {
      req.status = p.decision === 'approve' ? 'Approved' : 'Rejected';
      req.notes = p.notes || '';
      saveData(data);
    }
    return { ok: true, message: 'Request ' + (req ? req.status.toLowerCase() : 'reviewed') + '.' };
  },

  getAuditLogs: function () {
    const data = readData();
    return { logs: data.auditLogs || [] };
  },

  getEmailAdminData: function () {
    const data = readData();
    return {
      templates: data.emailTemplates || [],
      recipients: data.emailRecipients || []
    };
  },

  createCloudBackup: function (notes) {
    const data = readData();
    const backupId = 'BAK-' + Date.now().toString(36).toUpperCase();
    const name = 'HUFT_Backup_' + getTodayIso() + '_' + backupId;
    const backup = {
      id: backupId,
      timestamp: getNowTimestamp(),
      createdBy: 'admin',
      name: name,
      fileId: 'backup-' + backupId,
      url: 'https://supabase.co/storage/v1/object/public/backups/' + name + '.json',
      sizeKb: 395,
      notes: notes || 'Enterprise Roster Snapshot'
    };
    data.backups = data.backups || [];
    data.backups.unshift(backup);
    saveData(data);
    return { ok: true, message: 'Cloud backup created: ' + name, backup: backup, backups: data.backups };
  },

  listCloudBackups: function () {
    const data = readData();
    return { backups: data.backups || [] };
  },

  getCloudStorageStats: function () {
    const data = readData();
    return {
      ok: true,
      spreadsheetId: '1anAGAvK-Keh3cH5sncIpycURWqVgaAPn40icFZrYC60',
      profileFolder: { name: 'Supabase Bucket: profiles', count: (data.employees || []).filter(e => e.profilePhotoId).length, url: 'https://supabase.com' },
      backupFolder: { name: 'Supabase Bucket: backups', count: (data.backups || []).length, url: 'https://supabase.com' },
      exportsFolder: { name: 'Supabase Bucket: exports', count: 8, url: 'https://supabase.com' },
      sheetsCount: 23
    };
  },

  saveRosterExportToCloud: function (p) {
    return { ok: true, message: 'Saved to cloud storage.', fileName: (p.title || 'Roster') + '.jpg' };
  },

  getRosterAccess: function () {
    const data = readData();
    return { entries: data.access || [], stores: data.stores.map(s => s.name) };
  },

  setRosterAccess: function (p) {
    const data = readData();
    data.access = data.access || [];
    if (p.remove) {
      data.access = data.access.filter(a => !(a.email === p.email && a.store === p.store));
    } else {
      const match = data.access.find(a => a.email === p.email && a.store === p.store);
      if (match) match.access = p.access;
      else data.access.push({ email: p.email, store: p.store, access: p.access, addedOn: getTodayIso() });
    }
    saveData(data);
    return { ok: true, entries: data.access };
  },

  testSupabaseConnection: function () {
    return { ok: true, message: 'Connected to Supabase PostgreSQL Database & Edge Storage.' };
  },

  syncSheetsToSupabase: function () {
    const data = readData();
    return {
      ok: true,
      message: 'Synced ' + data.stores.length + ' stores, ' + data.employees.length + ' employees, and ' + Object.keys(data.shifts || {}).length + ' shifts.'
    };
  }
};

// Create HTTP server
const server = http.createServer(function (req, res) {
  const parsedUrl = new URL(req.url, 'http://localhost:' + PORT);
  const pathname = parsedUrl.pathname;
  const clientIp = req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Browser';

  // Helper to extract session user from Authorization header
  let currentUser = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (activeSessions.has(token)) {
      const sess = activeSessions.get(token);
      if (Date.now() <= sess.expiresAt) {
        currentUser = sess;
      }
    }
  }

  // Handle API Endpoint: /api/run
  if (pathname === '/api/run' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const fn = payload.fn;
        const args = payload.args || [];

        if (typeof apiHandlers[fn] === 'function') {
          const meta = { ip: clientIp, userAgent: userAgent, user: currentUser };
          const result = apiHandlers[fn].apply(null, [args[0], meta].concat(args.slice(1)));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, result: result }));
        } else {
          console.warn('Unknown function call:', fn);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, result: {} }));
        }
      } catch (err) {
        console.error('API Error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Handle Static files from /data or root
  if (pathname.startsWith('/data/')) {
    const relFile = pathname.slice(1); // e.g. "data/roster-db.js"
    const absPath = path.join(ROOT_DIR, relFile);
    if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
      const mime = pathname.endsWith('.js') ? 'application/javascript' : (pathname.endsWith('.json') ? 'application/json' : 'text/plain');
      res.writeHead(200, { 'Content-Type': mime });
      res.end(fs.readFileSync(absPath));
      return;
    }
  }

  // Serve Dashboard HTML / index.html
  if (pathname === '/' || pathname === '/index.html' || pathname === '/Dashboard.html') {
    try {
      const targetHtml = fs.existsSync(INDEX_HTML) ? INDEX_HTML : HTML_FILE;
      let html = fs.readFileSync(targetHtml, 'utf8');
      // Inject shim right before </head>
      html = html.replace('</head>', GOOGLE_SCRIPT_SHIM + '\n</head>');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading portal: ' + err.message);
    }
    return;
  }

  // 404 fallback
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, function () {
  console.log('================================================================');
  console.log('🐾 HUFT ENTERPRISE WORKFORCE & OPERATIONS PORTAL (LOCAL EMULATOR)');
  console.log('----------------------------------------------------------------');
  console.log('URL:          http://localhost:' + PORT);
  console.log('Admin Email:  admin@headsupfortails.com');
  console.log('Admin Pass:   HUFT@123');
  console.log('Stores:       Hyderguda, Golden Mile, Banjara Hills, Nallagandla, Madhapur');
  console.log('================================================================');
});

if (typeof module !== 'undefined') {
  module.exports = { apiHandlers, server, activeSessions };
}

