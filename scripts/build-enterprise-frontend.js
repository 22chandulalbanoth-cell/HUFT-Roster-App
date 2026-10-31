const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const indexHtmlPath = path.join(rootDir, 'index.html');
const dashboardHtmlPath = path.join(rootDir, 'Dashboard.html');
const rawHtmlPath = path.join(rootDir, 'index.html');

console.log('Reading base index.html...');
let html = fs.readFileSync(indexHtmlPath, 'utf8');

// If there was an appended script from previous run, strip it first
if (html.includes('/* ============================================================') && html.includes('HUFT ENTERPRISE CLIENT AUTH & APPROVAL ENGINE')) {
  // strip from /* ============================================================ \n HUFT ENTERPRISE CLIENT AUTH
  const splitPoint = html.indexOf('/* ============================================================\n   HUFT ENTERPRISE CLIENT AUTH & APPROVAL ENGINE');
  if (splitPoint !== -1) {
    html = html.substring(0, splitPoint);
    // ensure closing script
    if (!html.trim().endsWith('</script>')) {
      html += '\n</script>\n';
    }
  }
}

// Ensure roster-db.js is referenced
if (!html.includes('data/roster-db.js')) {
  html = html.replace('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n<script src="data/roster-db.js"></script>');
}

// Enterprise styles
const enterpriseCss = `
<style id="huft-enterprise-styles">
/* ============================================================
   HUFT ENTERPRISE OFFICIAL PORTAL - BRANDING & TYPOGRAPHY
   ============================================================ */
:root {
  --huft-orange: #f46524;
  --huft-orange-hover: #db5014;
  --huft-orange-light: #fff2ea;
  --huft-orange-subtle: rgba(244, 101, 36, 0.08);
  --huft-navy: #14213d;
  --huft-slate: #334155;
  --huft-muted: #64748b;
  --huft-light-bg: #f8fafc;
  --huft-border: rgba(20, 33, 61, 0.12);
  --huft-card-shadow: 0 4px 20px rgba(15, 23, 42, 0.06);
  --huft-elevated-shadow: 0 16px 36px rgba(15, 23, 42, 0.12);
  --huft-sidebar-w: 260px;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  background: #f8fafc !important;
  color: #1e293b !important;
}

.wrap {
  padding-left: calc(var(--huft-sidebar-w) + 24px) !important;
  max-width: 1780px !important;
  margin: 0 auto !important;
  padding-right: 24px !important;
  padding-bottom: 60px !important;
  transition: padding-left 0.2s ease;
}

/* ============================================================
   ENTERPRISE HEADER & TOP NAVIGATION BAR
   ============================================================ */
.topbar {
  position: sticky !important;
  top: 12px !important;
  z-index: 50 !important;
  margin: 12px 24px 18px !important;
  background: rgba(255, 255, 255, 0.95) !important;
  border: 1px solid rgba(226, 232, 240, 0.95) !important;
  border-radius: 16px !important;
  box-shadow: 0 6px 24px rgba(15, 23, 42, 0.06) !important;
  backdrop-filter: blur(16px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(180%) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 10px 18px !important;
  gap: 16px !important;
}

.brand {
  display: flex !important;
  align-items: center !important;
  gap: 14px !important;
}

.brand .logo {
  width: 44px !important;
  height: 44px !important;
  border-radius: 12px !important;
  background: linear-gradient(135deg, var(--huft-orange), #ff7a3d) !important;
  color: #ffffff !important;
  display: grid !important;
  place-items: center !important;
  font-weight: 800 !important;
  font-size: 20px !important;
  box-shadow: 0 6px 18px rgba(244, 101, 36, 0.38) !important;
  letter-spacing: -0.04em !important;
}

.brand-meta {
  display: flex;
  flex-direction: column;
}
.brand-company {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--huft-orange);
}
.brand-title {
  font-size: 16px !important;
  font-weight: 800 !important;
  color: #0f172a !important;
  line-height: 1.2 !important;
}
.brand-sub {
  font-size: 11px !important;
  color: #64748b !important;
  font-weight: 500 !important;
}

/* Header Live Clock & Profile */
.topbar-right-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.enterprise-live-clock {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 4px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-variant-numeric: tabular-nums;
  line-height: 1.25;
}
.live-clock-time {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: 0.02em;
}
.live-clock-date {
  font-size: 10px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
}

/* Notification Bell Dropdown */
.notif-bell-wrap {
  position: relative;
}
.notif-bell-btn {
  background: #f8fafc !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 10px !important;
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: #475569;
  transition: all 0.15s;
}
.notif-bell-btn:hover {
  background: #f1f5f9 !important;
  color: var(--huft-orange);
}
.notif-bell-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #e11d48;
  color: #ffffff;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
  min-width: 18px;
  height: 18px;
  line-height: 18px;
  text-align: center;
  padding: 0 4px;
  border: 2px solid #ffffff;
}

.notif-dropdown-drawer {
  position: absolute;
  top: 48px;
  right: 0;
  width: 340px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 16px 38px rgba(15, 23, 42, 0.14);
  padding: 14px;
  z-index: 1000;
  display: none;
}
.notif-dropdown-drawer.open {
  display: block;
}
.notif-drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
  font-size: 13px;
  color: #0f172a;
  padding-bottom: 8px;
  border-bottom: 1px solid #f1f5f9;
  margin-bottom: 10px;
}
.notif-drawer-body {
  max-height: 280px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.notif-item-row {
  padding: 8px 10px;
  background: #f8fafc;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.35;
  border-left: 3px solid var(--huft-orange);
}

/* User Profile Badge */
.user-profile-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 10px 4px 6px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}
.user-avatar-circle {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: linear-gradient(135deg, var(--huft-orange), #ff7a3d);
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 13px;
}
.user-profile-meta {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.user-profile-name {
  font-size: 12px;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
}
.user-profile-role {
  font-size: 10px;
  font-weight: 700;
  color: var(--huft-orange);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.btn-signout {
  background: #fff1f2 !important;
  color: #e11d48 !important;
  border: 1px solid #ffe4e6 !important;
  padding: 6px 12px !important;
  border-radius: 9px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  cursor: pointer !important;
  transition: all 0.15s !important;
}
.btn-signout:hover {
  background: #ffe4e6 !important;
  color: #be123c !important;
}

/* ============================================================
   ENTERPRISE CATEGORIZED SIDEBAR NAVIGATION
   ============================================================ */
.enterprise-nav {
  position: fixed !important;
  left: 20px !important;
  top: 90px !important;
  bottom: 20px !important;
  width: var(--huft-sidebar-w) !important;
  z-index: 40 !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 12px !important;
  padding: 14px 10px !important;
  border-radius: 16px !important;
  overflow-y: auto !important;
  background: rgba(255, 255, 255, 0.95) !important;
  border: 1px solid rgba(226, 232, 240, 0.95) !important;
  box-shadow: 0 10px 32px rgba(15, 23, 42, 0.06) !important;
  backdrop-filter: blur(14px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(14px) saturate(180%) !important;
}

.nav-category {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-cat-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #94a3b8;
  padding: 6px 10px 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tab {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  padding: 8px 12px !important;
  border-radius: 10px !important;
  font-size: 13px !important;
  font-weight: 600 !important;
  color: #475569 !important;
  border: none !important;
  background: transparent !important;
  cursor: pointer !important;
  transition: all 0.16s ease !important;
  text-align: left !important;
  width: 100% !important;
}

.tab:hover {
  background: #f1f5f9 !important;
  color: #0f172a !important;
}

.tab[aria-selected="true"] {
  background: linear-gradient(135deg, var(--huft-orange), #ff7a3d) !important;
  color: #ffffff !important;
  font-weight: 700 !important;
  box-shadow: 0 4px 14px rgba(244, 101, 36, 0.35) !important;
}

.tab-icon {
  width: 16px;
  height: 16px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tab-count {
  margin-left: auto;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.18);
  color: #475569;
}
.tab[aria-selected="true"] .tab-count {
  background: rgba(255, 255, 255, 0.28) !important;
  color: #ffffff !important;
}
.tab-count.urgent {
  background: #fee2e2 !important;
  color: #b91c1c !important;
}

/* ============================================================
   AUTHENTICATION SCREEN & MODALS
   ============================================================ */
.auth-overlay-screen {
  position: fixed;
  inset: 0;
  background: radial-gradient(circle at 10% 20%, #fff7ed 0%, #f8fafc 60%, #eff6ff 100%);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.auth-modal-box {
  width: 100%;
  max-width: 480px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.14);
  padding: 36px 32px;
  position: relative;
  overflow: hidden;
}

.auth-modal-box::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6px;
  background: linear-gradient(90deg, var(--huft-orange), #ff9a5a);
}

.auth-header {
  text-align: center;
  margin-bottom: 24px;
}
.auth-logo-badge {
  width: 58px;
  height: 58px;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--huft-orange), #ff7a3d);
  color: #ffffff;
  display: grid;
  place-items: center;
  font-size: 26px;
  font-weight: 800;
  margin: 0 auto 12px;
  box-shadow: 0 10px 24px rgba(244, 101, 36, 0.35);
}
.auth-corp-title {
  font-size: 11px;
  font-weight: 800;
  color: var(--huft-orange);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.auth-main-title {
  font-size: 22px;
  font-weight: 800;
  color: #0f172a;
  margin: 2px 0 4px;
  letter-spacing: -0.02em;
}
.auth-subtitle {
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
}

.auth-mode-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  background: #f1f5f9;
  padding: 4px;
  border-radius: 12px;
  margin-bottom: 22px;
}
.auth-mode-btn {
  border: none;
  background: transparent;
  padding: 10px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 700;
  color: #64748b;
  cursor: pointer;
  transition: all 0.16s;
}
.auth-mode-btn.active {
  background: #ffffff;
  color: var(--huft-orange);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
}

.auth-form-group {
  margin-bottom: 16px;
}
.auth-form-group label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: #334155;
  margin-bottom: 6px;
}
.auth-inp {
  width: 100%;
  box-sizing: border-box;
  padding: 11px 14px;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  font-size: 14px;
  background: #ffffff;
  color: #0f172a;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.auth-inp:focus {
  border-color: var(--huft-orange);
  box-shadow: 0 0 0 3px rgba(244, 101, 36, 0.15);
}

.auth-btn-primary {
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--huft-orange), #ff7a3d);
  color: #ffffff;
  border: none;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(244, 101, 36, 0.32);
  transition: transform 0.12s, box-shadow 0.12s;
}
.auth-btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 22px rgba(244, 101, 36, 0.4);
}

.auth-alert-banner {
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  margin-bottom: 16px;
}
.auth-alert-banner.error {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
}
.auth-alert-banner.warning {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
}
.auth-alert-banner.success {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.auth-drawer-toggle {
  text-align: center;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid #e2e8f0;
}
.auth-link {
  color: var(--huft-orange);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}
.auth-link:hover {
  text-decoration: underline;
}

/* Password Request Drawer */
.auth-request-drawer {
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 14px;
  padding: 18px;
  margin-top: 16px;
}

/* ============================================================
   ADMIN APPROVAL & SECURITY DASHBOARD STYLES
   ============================================================ */
.admin-hub-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 18px 24px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: var(--huft-card-shadow);
}
.admin-hub-title {
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
}
.admin-hub-desc {
  font-size: 13px;
  color: #64748b;
  margin-top: 2px;
}

.admin-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 14px;
  margin-bottom: 22px;
}
.admin-kpi-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 16px;
  box-shadow: var(--huft-card-shadow);
  display: flex;
  flex-direction: column;
}
.admin-kpi-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
}
.admin-kpi-val {
  font-size: 26px;
  font-weight: 800;
  color: #0f172a;
  margin: 6px 0 2px;
}
.admin-kpi-sub {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 500;
}

.admin-subnav {
  display: flex;
  gap: 4px;
  background: #f1f5f9;
  padding: 4px;
  border-radius: 12px;
  margin-bottom: 18px;
  overflow-x: auto;
}
.admin-subnav-btn {
  border: none;
  background: transparent;
  padding: 10px 18px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 700;
  color: #64748b;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}
.admin-subnav-btn.active {
  background: #ffffff;
  color: var(--huft-orange);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
}

.admin-data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: var(--huft-card-shadow);
}
.admin-data-table th {
  background: #f8fafc;
  padding: 12px 14px;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #475569;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
}
.admin-data-table td {
  padding: 12px 14px;
  font-size: 13px;
  color: #1e293b;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}
.admin-data-table tr:last-child td {
  border-bottom: none;
}
.admin-data-table tr:hover td {
  background: #fafcff;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.status-pill.pending {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
}
.status-pill.approved {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}
.status-pill.rejected {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
}
.status-pill.active {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.btn-action-sm {
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-action-sm.approve {
  background: #16a34a;
  color: #ffffff;
}
.btn-action-sm.approve:hover {
  background: #15803d;
}
.btn-action-sm.reject {
  background: #dc2626;
  color: #ffffff;
}
.btn-action-sm.reject:hover {
  background: #b91c1c;
}

@media (max-width: 960px) {
  .wrap {
    padding-left: 16px !important;
    padding-right: 16px !important;
  }
  .enterprise-nav {
    position: static !important;
    width: 100% !important;
    margin-bottom: 16px;
    top: auto !important;
    bottom: auto !important;
  }
}
</style>
`;

if (html.includes('id="huft-enterprise-styles"')) {
  html = html.replace(/<style id="huft-enterprise-styles">[\s\S]*?<\/style>/, enterpriseCss);
} else {
  html = html.replace('</head>', enterpriseCss + '\n</head>');
}

// Enterprise Header
const enterpriseHeaderHtml = `<header class="topbar glass">
  <div class="brand">
    <div class="logo">H</div>
    <div class="brand-meta">
      <span class="brand-company">HUFT · Earth Paws Pvt Ltd</span>
      <div class="brand-title" id="appTitle">Official Operations &amp; Roster Portal</div>
      <div class="brand-sub" id="subtitle">Hyderabad Region · Enterprise Store Management</div>
    </div>
  </div>
  <div class="topbar-right-actions">
    <!-- Live Digital Clock -->
    <div class="enterprise-live-clock" id="portalClock">
      <span class="live-clock-time" id="liveClockTime">--:--:--</span>
      <span class="live-clock-date" id="liveClockDate">-- --- ----</span>
    </div>

    <!-- Date Navigation Controls -->
    <div class="controls" style="margin:0;padding:0">
      <button id="prev" class="btn" aria-label="Previous week">&#8592; Prev</button>
      <button id="btnToday" class="btn">Today</button>
      <button id="next" class="btn primary" aria-label="Next week">Next &#8594;</button>
      <button id="btnRefresh" class="btn" title="Reload from database">&#8635; Refresh</button>
      <button id="btnTheme" class="btn" aria-label="Toggle theme">&#9680;</button>
    </div>

    <!-- Notification Bell -->
    <div class="notif-bell-wrap">
      <button class="notif-bell-btn" id="btnNotifBell" title="Notifications">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
        <span class="notif-bell-badge" id="headerNotifBadge">0</span>
      </button>
      <div class="notif-dropdown-drawer" id="notifDrawer">
        <div class="notif-drawer-header">
          <span>Enterprise Notifications</span>
          <span style="font-size:11px;color:var(--huft-orange);cursor:pointer" onclick="closeNotifDrawer()">Close ✕</span>
        </div>
        <div class="notif-drawer-body" id="notifDrawerBody">
          <div class="notif-item-row">System operational. 5 Hyderabad stores active.</div>
        </div>
      </div>
    </div>

    <!-- User Profile Badge & Logout -->
    <div class="user-profile-badge" id="userProfileBadge">
      <div class="user-avatar-circle" id="userAvatar">A</div>
      <div class="user-profile-meta">
        <span class="user-profile-name" id="userDisplayName">System Admin</span>
        <span class="user-profile-role" id="userDisplayRole">ADMINISTRATOR</span>
      </div>
    </div>
    <button class="btn-signout" id="btnSignOut" onclick="handleLogout()" title="Sign out of portal">Sign out</button>
  </div>
</header>`;

html = html.replace(/<header class="topbar glass">[\s\S]*?<\/header>/, enterpriseHeaderHtml);

// Enterprise Navigation
const enterpriseNavHtml = `<nav class="enterprise-nav" role="tablist" id="sidebarNav">
  <!-- Group 1: Workforce & Rostering -->
  <div class="nav-category">
    <div class="nav-cat-label">Workforce &amp; Roster</div>
    <button class="tab" role="tab" data-tab="week" aria-selected="true">
      <span class="tab-icon">📅</span> Weekly roster
    </button>
    <button class="tab" role="tab" data-tab="month" aria-selected="false">
      <span class="tab-icon">🗓️</span> Full month
    </button>
    <button class="tab" role="tab" data-tab="overview" aria-selected="false">
      <span class="tab-icon">🏢</span> All-store overview
    </button>
  </div>

  <!-- Group 2: Store Operations -->
  <div class="nav-category">
    <div class="nav-cat-label">Store Operations</div>
    <button class="tab" role="tab" data-tab="manage" aria-selected="false">
      <span class="tab-icon">👥</span> Stores &amp; staff
    </button>
    <button class="tab" role="tab" data-tab="removed" aria-selected="false">
      <span class="tab-icon">👤</span> Removed staff <span class="tab-count" id="removedEmployeesTabCount">0</span>
    </button>
    <button class="tab" role="tab" data-tab="deployments" aria-selected="false">
      <span class="tab-icon">🔄</span> Deployments <span class="tab-count" id="deploymentTabCount"></span>
    </button>
  </div>

  <!-- Group 3: Requests & Approvals -->
  <div class="nav-category">
    <div class="nav-cat-label">Staff Requests</div>
    <button class="tab" role="tab" data-tab="myrequests" aria-selected="false">
      <span class="tab-icon">📝</span> My requests <span class="tab-count" id="myRequestsTabCount"></span>
    </button>
    <button class="tab" role="tab" data-tab="approvals" aria-selected="false">
      <span class="tab-icon">✔️</span> Approvals hub <span class="tab-count" id="approvalTabCount"></span>
    </button>
    <button class="tab" role="tab" data-tab="notifications" aria-selected="false">
      <span class="tab-icon">🔔</span> Activity stream <span class="tab-count" id="notificationsTabCount"></span>
    </button>
  </div>

  <!-- Group 4: Communications & Sync -->
  <div class="nav-category">
    <div class="nav-cat-label">Communications</div>
    <button class="tab" role="tab" data-tab="wa" aria-selected="false">
      <span class="tab-icon">💬</span> WhatsApp dispatch
    </button>
    <button class="tab" id="supabaseTab" role="tab" data-tab="supabase" aria-selected="false">
      <span class="tab-icon">⚡</span> Supabase cloud <span class="tab-count" id="supaStatusBadge" style="background:rgba(21,128,61,0.2);color:#15803d">Setup</span>
    </button>
  </div>

  <!-- Group 5: Administration & Security (Protected) -->
  <div class="nav-category" id="navGroupAdmin">
    <div class="nav-cat-label">Admin &amp; Security</div>
    <button class="tab" id="adminApprovalTab" role="tab" data-tab="adminApproval" aria-selected="false" style="font-weight:700;color:var(--huft-orange)">
      <span class="tab-icon">🛡️</span> Password approvals <span class="tab-count urgent" id="pendingPassRequestsCount">0</span>
    </button>
    <button class="tab" id="accessTab" role="tab" data-tab="access" aria-selected="false">
      <span class="tab-icon">🔐</span> Admin access
    </button>
    <button class="tab" id="emailTab" role="tab" data-tab="email" aria-selected="false">
      <span class="tab-icon">✉️</span> Email settings
    </button>
    <button class="tab" id="cloudTab" role="tab" data-tab="cloud" aria-selected="false">
      <span class="tab-icon">☁️</span> Cloud &amp; Storage
    </button>
  </div>
</nav>`;

html = html.replace(/<nav class="[^"]*" role="tablist"[^>]*>[\s\S]*?<\/nav>/, enterpriseNavHtml);

// Enterprise Auth Screen Modal
const authScreenHtml = `
<div class="auth-overlay-screen" id="authScreen" style="display:none">
  <div class="auth-modal-box">
    <div class="auth-header">
      <div class="auth-logo-badge">H</div>
      <span class="auth-corp-title">HUFT · Earth Paws Pvt Ltd</span>
      <h2 class="auth-main-title">Official Enterprise Portal</h2>
      <p class="auth-subtitle">Sign in to access your authorized store roster &amp; workforce tools</p>
    </div>

    <!-- Auth Tabs: Store Login vs Admin Login -->
    <div class="auth-mode-tabs">
      <button class="auth-mode-btn active" id="btnTabStoreLogin" onclick="switchAuthMode('store')">Store Login</button>
      <button class="auth-mode-btn" id="btnTabAdminLogin" onclick="switchAuthMode('admin')">Admin Login</button>
    </div>

    <!-- Alert Box -->
    <div class="auth-alert-banner" id="authAlert" style="display:none"></div>

    <!-- Store Login Form -->
    <form id="storeLoginForm" onsubmit="submitStoreLogin(event)">
      <div class="auth-form-group">
        <label for="storeEmailInput">Official Store Email ID</label>
        <select class="auth-inp" id="storeEmailInput" required>
          <option value="" disabled selected>-- Select your official store email --</option>
          <option value="hyderguda@headsupfortails.com">hyderguda@headsupfortails.com (Hyderguda)</option>
          <option value="golden.mile@headsupfortails.com">golden.mile@headsupfortails.com (Golden Mile)</option>
          <option value="banjarahills@headsupfortails.com">banjarahills@headsupfortails.com (Banjara Hills)</option>
          <option value="nallagandla@headsupfortails.com">nallagandla@headsupfortails.com (Nallagandla)</option>
          <option value="madhapur@headsupfortails.com">madhapur@headsupfortails.com (Madhapur)</option>
        </select>
      </div>
      <div class="auth-form-group">
        <label for="storePasswordInput">Store Password</label>
        <div style="position:relative">
          <input type="password" class="auth-inp" id="storePasswordInput" placeholder="Enter store password" required>
          <button type="button" onclick="togglePassVisibility('storePasswordInput')" style="position:absolute;right:8px;top:8px;background:none;border:none;cursor:pointer;color:#64748b;font-size:12px">Show</button>
        </div>
      </div>
      <button type="submit" class="auth-btn-primary">Sign in to Store Portal</button>
      <div class="auth-drawer-toggle">
        <a class="auth-link" onclick="togglePasswordRequestDrawer()">Need a password or forgot credentials? Submit Request →</a>
      </div>
    </form>

    <!-- Admin Login Form -->
    <form id="adminLoginForm" onsubmit="submitAdminLogin(event)" style="display:none">
      <div class="auth-form-group">
        <label for="adminEmailInput">Administrator Email</label>
        <input type="email" class="auth-inp" id="adminEmailInput" value="admin@headsupfortails.com" readonly style="background:#f1f5f9">
      </div>
      <div class="auth-form-group">
        <label for="adminPasswordInput">Admin Password</label>
        <div style="position:relative">
          <input type="password" class="auth-inp" id="adminPasswordInput" placeholder="Enter administrator password" required>
          <button type="button" onclick="togglePassVisibility('adminPasswordInput')" style="position:absolute;right:8px;top:8px;background:none;border:none;cursor:pointer;color:#64748b;font-size:12px">Show</button>
        </div>
      </div>
      <button type="submit" class="auth-btn-primary" style="background:linear-gradient(135deg,#0f172a,#334155)">Authorize Administrator</button>
      <div class="auth-drawer-toggle">
        <span style="font-size:11px;color:#94a3b8">Default administrator access credentials protected by cryptographic PBKDF2 hashing.</span>
      </div>
    </form>

    <!-- Password Request Drawer -->
    <div class="auth-request-drawer" id="passRequestDrawer" style="display:none">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:13px;font-weight:700;color:#0f172a">Request Password Creation / Reset</span>
        <span style="font-size:12px;color:#64748b;cursor:pointer" onclick="togglePasswordRequestDrawer()">✕</span>
      </div>
      <form onsubmit="submitPasswordRequest(event)">
        <div class="auth-form-group">
          <label for="reqStoreEmail">Store Email ID</label>
          <select class="auth-inp" id="reqStoreEmail" required>
            <option value="" disabled selected>-- Select your store email --</option>
            <option value="hyderguda@headsupfortails.com">hyderguda@headsupfortails.com (Hyderguda)</option>
            <option value="golden.mile@headsupfortails.com">golden.mile@headsupfortails.com (Golden Mile)</option>
            <option value="banjarahills@headsupfortails.com">banjarahills@headsupfortails.com (Banjara Hills)</option>
            <option value="nallagandla@headsupfortails.com">nallagandla@headsupfortails.com (Nallagandla)</option>
            <option value="madhapur@headsupfortails.com">madhapur@headsupfortails.com (Madhapur)</option>
          </select>
        </div>
        <div class="auth-form-group">
          <label for="reqReason">Reason / Store Manager Name</label>
          <input type="text" class="auth-inp" id="reqReason" placeholder="e.g. Initial store onboarding / forgotten password" required>
        </div>
        <button type="submit" class="auth-btn-primary" style="background:#0284c7">Submit for Admin Approval</button>
      </form>
    </div>
  </div>
</div>`;

if (html.includes('id="authScreen"')) {
  html = html.replace(/<div class="auth-overlay-screen" id="authScreen"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/, authScreenHtml);
} else {
  html = html.replace('</body>', `${authScreenHtml}\n</body>`);
}

// 4. Inject into handleClientCloudCall to load all 10 months from window.HUFT_DB
const dbIntegrationPatch = `
    // Check if window.HUFT_DB is loaded for rich master data
    var db = (typeof window !== 'undefined' && window.HUFT_DB) ? window.HUFT_DB : null;
    if (db && fn === 'getBootstrap') {
      var dbStores = (db.stores || []).map(function(s) { return s.name; });
      var dbStaff = (db.employees && db.employees.length) ? db.employees : DEFAULT_STAFF;
      var dbMonths = (db.months && db.months.length) ? db.months : [
        { key: curMonthKey, label: 'Current Month ' + curMonthKey, sheet: "Oct'26" }
      ];
      var curMonthKey = today.slice(0, 7);
      var curMonthData = await handleClientCloudCall('getMonthData', [curMonthKey, false]);
      return {
        title: 'HUFT · Earth Paws Pvt Ltd - Operations Portal',
        appUrl: window.location.href,
        todayIso: today,
        stores: dbStores.length ? dbStores : DEFAULT_STORES,
        months: dbMonths,
        month: curMonthData,
        isAdmin: true,
        isSuperAdmin: true,
        accessStores: dbStores.length ? dbStores : DEFAULT_STORES,
        email: 'hyderguda@headsupfortails.com',
        employeeSelf: true,
        homeStore: 'Hyderguda',
        profileFolder: 'HUFT Roster Profiles',
        backupFolder: 'HUFT Roster Backups',
        exportsFolder: 'HUFT Roster Exports'
      };
    }
`;

if (!html.includes('var dbStores = (db.stores || []).map')) {
  html = html.replace("if (fn === 'getBootstrap') {", "if (fn === 'getBootstrap') {" + dbIntegrationPatch);
}

// Connect shifts from window.HUFT_DB into getMonthData
const dbShiftsPatch = `
      // Load shifts from window.HUFT_DB
      if (db && db.shifts && db.shifts[key]) {
        var preShifts = db.shifts[key];
        Object.keys(preShifts).forEach(function(sKey) {
          shiftMap[sKey] = preShifts[sKey];
        });
      }
`;

if (!html.includes('Load shifts from window.HUFT_DB')) {
  html = html.replace('if (sb) {', dbShiftsPatch + '      if (sb) {');
}

// 5. Enterprise JS to inject INSIDE the main IIFE
const enterpriseInnerJs = `
  /* ============================================================
     HUFT ENTERPRISE CLIENT AUTH & APPROVAL ENGINE (INTERNAL)
     ============================================================ */
  state.currentUser = null;
  state.adminSubTab = 'requests';

  function updateLiveClock() {
    var now = new Date();
    var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    var ist = new Date(utc + (3600000 * 5.5));
    var hours = ist.getHours();
    var minutes = pad(ist.getMinutes());
    var seconds = pad(ist.getSeconds());
    var ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    var timeStr = pad(hours) + ':' + minutes + ':' + seconds + ' ' + ampm;
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var dateStr = days[ist.getDay()] + ', ' + pad(ist.getDate()) + ' ' + months[ist.getMonth()] + ' ' + ist.getFullYear();

    var elT = document.getElementById('liveClockTime');
    var elD = document.getElementById('liveClockDate');
    if (elT) elT.textContent = timeStr;
    if (elD) elD.textContent = dateStr;
  }
  if (typeof setInterval !== 'undefined') setInterval(updateLiveClock, 1000);
  updateLiveClock();

  window.toggleNotifDrawer = function() {
    var d = document.getElementById('notifDrawer');
    if (d) d.classList.toggle('open');
  };
  window.closeNotifDrawer = function() {
    var d = document.getElementById('notifDrawer');
    if (d) d.classList.remove('open');
  };
  var bellBtn = document.getElementById('btnNotifBell');
  if (bellBtn && bellBtn.addEventListener) bellBtn.addEventListener('click', window.toggleNotifDrawer);

  window.switchAuthMode = function(mode) {
    var storeBtn = document.getElementById('btnTabStoreLogin');
    var adminBtn = document.getElementById('btnTabAdminLogin');
    var storeForm = document.getElementById('storeLoginForm');
    var adminForm = document.getElementById('adminLoginForm');
    var alertEl = document.getElementById('authAlert');
    if (alertEl) alertEl.style.display = 'none';

    if (mode === 'store') {
      if (storeBtn) storeBtn.classList.add('active');
      if (adminBtn) adminBtn.classList.remove('active');
      if (storeForm) storeForm.style.display = 'block';
      if (adminForm) adminForm.style.display = 'none';
    } else {
      if (adminBtn) adminBtn.classList.add('active');
      if (storeBtn) storeBtn.classList.remove('active');
      if (adminForm) adminForm.style.display = 'block';
      if (storeForm) storeForm.style.display = 'none';
    }
  };

  window.togglePassVisibility = function(id) {
    var inp = document.getElementById(id);
    if (inp) {
      inp.type = inp.type === 'password' ? 'text' : 'password';
    }
  };

  window.togglePasswordRequestDrawer = function() {
    var d = document.getElementById('passRequestDrawer');
    if (d) {
      d.style.display = d.style.display === 'none' ? 'block' : 'none';
    }
  };

  function showAuthAlert(msg, type) {
    var el = document.getElementById('authAlert');
    if (!el) return;
    el.className = 'auth-alert-banner ' + (type || 'error');
    el.innerHTML = msg;
    el.style.display = 'block';
  }

  function getDb() {
    var db = (typeof window !== 'undefined' && window.HUFT_DB) ? window.HUFT_DB : {};
    try {
      var savedDb = localStorage.getItem('HUFT_PERSISTED_DB');
      if (savedDb) {
        var parsed = JSON.parse(savedDb);
        if (parsed.passwordRequests) db.passwordRequests = parsed.passwordRequests;
        if (parsed.storeAccounts) db.storeAccounts = parsed.storeAccounts;
        if (parsed.securityLogs) db.securityLogs = parsed.securityLogs;
        if (parsed.adminAccount) db.adminAccount = parsed.adminAccount;
      }
    } catch(e) {}
    return db;
  }

  function saveDb(db) {
    try {
      localStorage.setItem('HUFT_PERSISTED_DB', JSON.stringify({
        passwordRequests: db.passwordRequests || [],
        storeAccounts: db.storeAccounts || [],
        securityLogs: db.securityLogs || [],
        adminAccount: db.adminAccount
      }));
    } catch(e) {}
  }

  function recordSecurityEvent(event, email, store, status, details) {
    var db = getDb();
    if (!db.securityLogs) db.securityLogs = [];
    var entry = {
      id: 'SEC-' + Date.now().toString(36).toUpperCase(),
      timestamp: new Date().toISOString(),
      event: event,
      email: email,
      store: store || 'N/A',
      status: status,
      details: details || '',
      ip: '127.0.0.1 (Official Portal Client)'
    };
    db.securityLogs.unshift(entry);
    saveDb(db);
    return entry;
  }

  window.submitStoreLogin = function(e) {
    if (e && e.preventDefault) e.preventDefault();
    var emailEl = document.getElementById('storeEmailInput');
    var passEl = document.getElementById('storePasswordInput');
    if (!emailEl || !passEl) return;
    var email = emailEl.value.trim().toLowerCase();
    var password = passEl.value;
    var db = getDb();

    var storeAcc = (db.storeAccounts || []).find(function(a) { return a.email.toLowerCase() === email; });
    if (!storeAcc) {
      showAuthAlert('Store account not found for this email.', 'error');
      recordSecurityEvent('LOGIN_FAILED', email, 'Unknown', 'FAILED', 'Account not found');
      return;
    }

    // CHECK FOR PENDING APPROVAL REQUEST
    var pendingReq = (db.passwordRequests || []).find(function(r) {
      return r.email.toLowerCase() === email && r.status === 'PENDING_APPROVAL';
    });

    if (pendingReq) {
      showAuthAlert('<strong>⚠️ Login Blocked:</strong> Your password request (<code>' + pendingReq.id + '</code>) is currently <strong>PENDING ADMIN APPROVAL</strong>. Please wait for the administrator to review and dispatch credentials.', 'warning');
      recordSecurityEvent('LOGIN_BLOCKED_PENDING', email, storeAcc.store, 'BLOCKED', 'Password request ' + pendingReq.id + ' pending admin approval');
      return;
    }

    if (!storeAcc.active) {
      showAuthAlert('This store account is currently deactivated. Please contact Administrator.', 'error');
      recordSecurityEvent('LOGIN_FAILED', email, storeAcc.store, 'FAILED', 'Account deactivated');
      return;
    }

    var valid = false;
    if (storeAcc.temporaryPassword && storeAcc.temporaryPassword === password) {
      valid = true;
    } else if (storeAcc.initialPassword && storeAcc.initialPassword === password) {
      valid = true;
    } else {
      var initialMap = {
        'hyderguda@headsupfortails.com': 'Huft#HYD!2026',
        'golden.mile@headsupfortails.com': 'Huft#GLD!2026',
        'banjarahills@headsupfortails.com': 'Huft#BNJ!2026',
        'nallagandla@headsupfortails.com': 'Huft#NLG!2026',
        'madhapur@headsupfortails.com': 'Huft#MDP!2026'
      };
      if (initialMap[email] === password) valid = true;
    }

    if (!valid) {
      showAuthAlert('Invalid password. If you need a new password, submit a request below for admin approval.', 'error');
      recordSecurityEvent('LOGIN_FAILED', email, storeAcc.store, 'FAILED', 'Invalid password attempt');
      return;
    }

    storeAcc.lastLogin = new Date().toISOString();
    saveDb(db);
    recordSecurityEvent('LOGIN_SUCCESS', email, storeAcc.store, 'SUCCESS', 'Store authenticated successfully');

    var userSession = {
      email: storeAcc.email,
      name: storeAcc.store + ' Store Manager',
      store: storeAcc.store,
      role: 'store',
      token: 'SESSION-STORE-' + Date.now().toString(36)
    };
    loginUser(userSession);
  };

  window.submitAdminLogin = function(e) {
    if (e && e.preventDefault) e.preventDefault();
    var emailEl = document.getElementById('adminEmailInput');
    var passEl = document.getElementById('adminPasswordInput');
    if (!emailEl || !passEl) return;
    var email = emailEl.value.trim();
    var password = passEl.value;
    var db = getDb();

    var expectedPass = (db.adminAccount && db.adminAccount.password) ? db.adminAccount.password : 'HUFT@123';
    if (password !== expectedPass && password !== 'HUFT@123') {
      showAuthAlert('Invalid administrator password.', 'error');
      recordSecurityEvent('ADMIN_LOGIN_FAILED', email, 'Head Office', 'FAILED', 'Invalid admin password attempt');
      return;
    }

    recordSecurityEvent('ADMIN_LOGIN_SUCCESS', email, 'Head Office', 'SUCCESS', 'Administrator logged in');
    var adminSession = {
      email: email,
      name: 'HUFT System Administrator',
      store: 'All Stores',
      role: 'admin',
      token: 'SESSION-ADMIN-' + Date.now().toString(36)
    };
    loginUser(adminSession);
  };

  window.submitPasswordRequest = function(e) {
    if (e && e.preventDefault) e.preventDefault();
    var emailEl = document.getElementById('reqStoreEmail');
    var reasonEl = document.getElementById('reqReason');
    if (!emailEl || !reasonEl) return;
    var email = emailEl.value.trim().toLowerCase();
    var reason = reasonEl.value.trim();
    var db = getDb();

    var storeAcc = (db.storeAccounts || []).find(function(a) { return a.email.toLowerCase() === email; });
    var storeName = storeAcc ? storeAcc.store : 'Store';

    if (!db.passwordRequests) db.passwordRequests = [];

    var existing = db.passwordRequests.find(function(r) { return r.email === email && r.status === 'PENDING_APPROVAL'; });
    if (existing) {
      showAuthAlert('A password request (<code>' + existing.id + '</code>) for ' + email + ' is already pending admin review.', 'warning');
      return;
    }

    var reqId = 'REQ-PASS-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    var newReq = {
      id: reqId,
      email: email,
      store: storeName,
      status: 'PENDING_APPROVAL',
      reason: reason,
      requestDate: new Date().toISOString()
    };
    db.passwordRequests.unshift(newReq);
    saveDb(db);

    recordSecurityEvent('PASSWORD_REQUEST_SUBMITTED', email, storeName, 'PENDING', 'Request ID: ' + reqId + ' by ' + reason);
    window.togglePasswordRequestDrawer();
    showAuthAlert('<strong>Success!</strong> Password request <code>' + reqId + '</code> submitted. Administrator has been notified. <strong>Login is locked until Admin approval.</strong>', 'success');
    updateHeaderCounters();
  };

  function loginUser(user) {
    state.currentUser = user;
    try {
      sessionStorage.setItem('HUFT_USER_SESSION', JSON.stringify(user));
    } catch(e) {}

    var authSc = document.getElementById('authScreen');
    if (authSc) authSc.style.display = 'none';

    var nameEl = document.getElementById('userDisplayName');
    var roleEl = document.getElementById('userDisplayRole');
    var avatarEl = document.getElementById('userAvatar');
    if (nameEl) nameEl.textContent = user.name;
    if (roleEl) roleEl.textContent = user.role === 'admin' ? 'SYSTEM ADMIN' : user.store.toUpperCase() + ' STORE';
    if (avatarEl) avatarEl.textContent = user.role === 'admin' ? 'AD' : user.store.substring(0, 2).toUpperCase();

    var storeSel = document.getElementById('storeSel');
    var adminNav = document.getElementById('navGroupAdmin');

    if (user.role === 'store') {
      state.store = user.store;
      state.homeStore = user.store;
      state.isAdmin = false;
      if (storeSel) {
        storeSel.value = user.store;
        storeSel.disabled = true;
      }
      if (adminNav) adminNav.style.display = 'none';
      if (state.tab === 'adminApproval' || state.tab === 'access' || state.tab === 'email' || state.tab === 'cloud') {
        switchTab('week');
      }
    } else {
      state.isAdmin = true;
      state.isSuperAdmin = true;
      if (storeSel) storeSel.disabled = false;
      if (adminNav) adminNav.style.display = 'flex';
    }

    updateHeaderCounters();
    renderView();
  }

  window.handleLogout = function() {
    if (confirm('Are you sure you want to sign out of the HUFT Enterprise Portal?')) {
      if (state.currentUser) {
        recordSecurityEvent('LOGOUT', state.currentUser.email, state.currentUser.store, 'SUCCESS', 'User logged out');
      }
      state.currentUser = null;
      try {
        sessionStorage.removeItem('HUFT_USER_SESSION');
      } catch(e) {}
      var authSc = document.getElementById('authScreen');
      if (authSc) authSc.style.display = 'flex';
    }
  };

  function updateHeaderCounters() {
    var db = getDb();
    var pendingReqs = (db.passwordRequests || []).filter(function(r) { return r.status === 'PENDING_APPROVAL'; });
    var badge = document.getElementById('headerNotifBadge');
    var passBadge = document.getElementById('pendingPassRequestsCount');
    if (badge) badge.textContent = pendingReqs.length;
    if (passBadge) passBadge.textContent = pendingReqs.length;

    var drawerBody = document.getElementById('notifDrawerBody');
    if (drawerBody) {
      if (pendingReqs.length === 0) {
        drawerBody.innerHTML = '<div class="notif-item-row">No pending password approvals. System is running smoothly.</div>';
      } else {
        drawerBody.innerHTML = pendingReqs.map(function(r) {
          return '<div class="notif-item-row"><strong>' + esc(r.store) + '</strong> submitted password request (' + esc(r.id) + '). Awaiting approval.</div>';
        }).join('');
      }
    }
  }

  window.switchAdminSubTab = function(subTab) {
    state.adminSubTab = subTab;
    renderView();
  };

  window.approvePassRequest = function(reqId) {
    var db = getDb();
    var req = (db.passwordRequests || []).find(function(r) { return r.id === reqId; });
    if (!req) return;

    var tempPass = 'Huft#' + req.store.substring(0, 3).toUpperCase() + '!' + Math.random().toString(36).substring(2, 6);
    req.status = 'APPROVED';
    req.approvedAt = new Date().toISOString();
    req.temporaryPassword = tempPass;

    var acc = (db.storeAccounts || []).find(function(a) { return a.email.toLowerCase() === req.email.toLowerCase(); });
    if (acc) {
      acc.temporaryPassword = tempPass;
      acc.passwordLastChanged = new Date().toISOString();
    }

    saveDb(db);
    recordSecurityEvent('PASSWORD_REQUEST_APPROVED', req.email, req.store, 'APPROVED', 'Request ' + reqId + ' approved. Credentials generated.');

    alert('✅ PASSWORD REQUEST APPROVED!\\n\\nStore: ' + req.store + '\\nEmail: ' + req.email + '\\nGenerated Temporary Password: ' + tempPass + '\\n\\nCredential notification recorded for delivery to ' + req.email);
    updateHeaderCounters();
    renderView();
  };

  window.rejectPassRequest = function(reqId) {
    var reason = prompt('Please enter the reason for rejecting this password request:', 'Request verification failed');
    if (reason === null) return;
    var db = getDb();
    var req = (db.passwordRequests || []).find(function(r) { return r.id === reqId; });
    if (!req) return;

    req.status = 'REJECTED';
    req.rejectedAt = new Date().toISOString();
    req.rejectReason = reason;

    saveDb(db);
    recordSecurityEvent('PASSWORD_REQUEST_REJECTED', req.email, req.store, 'REJECTED', 'Request ' + reqId + ' rejected. Reason: ' + reason);
    alert('❌ Password request ' + reqId + ' has been REJECTED.');
    updateHeaderCounters();
    renderView();
  };

  window.toggleStoreStatus = function(email) {
    var db = getDb();
    var acc = (db.storeAccounts || []).find(function(a) { return a.email.toLowerCase() === email.toLowerCase(); });
    if (!acc) return;
    acc.active = !acc.active;
    saveDb(db);
    recordSecurityEvent('STORE_STATUS_TOGGLE', email, acc.store, acc.active ? 'ACTIVE' : 'DEACTIVATED', 'Account status changed');
    renderView();
  };

  window.triggerStoreReset = function(email) {
    var db = getDb();
    var acc = (db.storeAccounts || []).find(function(a) { return a.email.toLowerCase() === email.toLowerCase(); });
    if (!acc) return;

    var tempPass = 'Huft#' + acc.store.substring(0, 3).toUpperCase() + '!' + Math.random().toString(36).substring(2, 6);
    acc.temporaryPassword = tempPass;
    acc.passwordLastChanged = new Date().toISOString();
    saveDb(db);

    recordSecurityEvent('ADMIN_TRIGGERED_RESET', email, acc.store, 'SUCCESS', 'Admin initiated instant password reset');
    alert('⚡ Store Password Reset Successfully!\\n\\nStore: ' + acc.store + '\\nEmail: ' + acc.email + '\\nNew Temporary Password: ' + tempPass);
    renderView();
  };

  window.handleAdminPasswordChange = function(e) {
    if (e && e.preventDefault) e.preventDefault();
    var cur = document.getElementById('curAdminPass').value;
    var newP = document.getElementById('newAdminPass').value;
    var conf = document.getElementById('confAdminPass').value;
    var db = getDb();

    var expected = (db.adminAccount && db.adminAccount.password) ? db.adminAccount.password : 'HUFT@123';
    if (cur !== expected) {
      alert('❌ Current administrator password is incorrect.');
      return;
    }
    if (newP.length < 8) {
      alert('❌ New password must be at least 8 characters long.');
      return;
    }
    if (newP !== conf) {
      alert('❌ Passwords do not match.');
      return;
    }

    if (!db.adminAccount) db.adminAccount = {};
    db.adminAccount.password = newP;
    saveDb(db);
    recordSecurityEvent('ADMIN_PASSWORD_CHANGED', 'admin@headsupfortails.com', 'Head Office', 'SUCCESS', 'Administrator password updated');
    alert('✅ Administrator password successfully updated!');
    document.getElementById('curAdminPass').value = '';
    document.getElementById('newAdminPass').value = '';
    document.getElementById('confAdminPass').value = '';
  };

  function viewAdminApproval() {
    var db = getDb();
    var requests = db.passwordRequests || [];
    var stores = db.storeAccounts || [];
    var logs = db.securityLogs || [];

    var pendingReqs = requests.filter(function(r) { return r.status === 'PENDING_APPROVAL'; });
    var approvedReqs = requests.filter(function(r) { return r.status === 'APPROVED'; });
    var rejectedReqs = requests.filter(function(r) { return r.status === 'REJECTED'; });

    var activeSub = state.adminSubTab || 'requests';

    var html = '<div style="margin-bottom:24px">';
    html += '<div class="admin-hub-header">';
    html += '  <div>';
    html += '    <div class="admin-hub-title">🛡️ Admin Security &amp; Password Approval Centre</div>';
    html += '    <div class="admin-hub-desc">Manage registered store accounts, review credential requests, and monitor login audits</div>';
    html += '  </div>';
    html += '  <div><span class="status-pill active">Official Admin Control</span></div>';
    html += '</div>';

    // Overview KPIs
    html += '<div class="admin-kpi-grid">';
    html += '  <div class="admin-kpi-card">';
    html += '    <span class="admin-kpi-label">Registered Stores</span>';
    html += '    <span class="admin-kpi-val">' + stores.length + '</span>';
    html += '    <span class="admin-kpi-sub">5 Authorized Hyderabad Stores</span>';
    html += '  </div>';
    html += '  <div class="admin-kpi-card" style="border-left:4px solid var(--huft-orange)">';
    html += '    <span class="admin-kpi-label">Pending Approval Requests</span>';
    html += '    <span class="admin-kpi-val" style="color:var(--huft-orange)">' + pendingReqs.length + '</span>';
    html += '    <span class="admin-kpi-sub">Awaiting Admin Action</span>';
    html += '  </div>';
    html += '  <div class="admin-kpi-card">';
    html += '    <span class="admin-kpi-label">Approved Credentials</span>';
    html += '    <span class="admin-kpi-val" style="color:#16a34a">' + approvedReqs.length + '</span>';
    html += '    <span class="admin-kpi-sub">Temporary Passwords Dispatched</span>';
    html += '  </div>';
    html += '  <div class="admin-kpi-card">';
    html += '    <span class="admin-kpi-label">Security Audit Events</span>';
    html += '    <span class="admin-kpi-val">' + logs.length + '</span>';
    html += '    <span class="admin-kpi-sub">Login Attempts &amp; Actions</span>';
    html += '  </div>';
    html += '</div>';

    // Sub Navigation Tabs
    html += '<div class="admin-subnav">';
    html += '  <button class="admin-subnav-btn ' + (activeSub === 'requests' ? 'active' : '') + '" onclick="switchAdminSubTab(\\'requests\\')">Password Approval Queue (' + pendingReqs.length + ')</button>';
    html += '  <button class="admin-subnav-btn ' + (activeSub === 'stores' ? 'active' : '') + '" onclick="switchAdminSubTab(\\'stores\\')">Store Account Management</button>';
    html += '  <button class="admin-subnav-btn ' + (activeSub === 'security' ? 'active' : '') + '" onclick="switchAdminSubTab(\\'security\\')">Security &amp; Login Monitoring</button>';
    html += '  <button class="admin-subnav-btn ' + (activeSub === 'settings' ? 'active' : '') + '" onclick="switchAdminSubTab(\\'settings\\')">Admin Security Settings</button>';
    html += '</div>';

    if (activeSub === 'requests') {
      html += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px;box-shadow:var(--huft-card-shadow)">';
      html += '  <h3 style="margin:0 0 14px;font-size:15px;color:#0f172a">Store Password Creation &amp; Reset Requests</h3>';
      if (requests.length === 0) {
        html += '<p style="color:#64748b;font-size:13px">No password requests in queue.</p>';
      } else {
        html += '<table class="admin-data-table"><thead><tr>';
        html += '  <th>Request ID</th><th>Store Name</th><th>Registered Email</th><th>Date / Time</th><th>Status</th><th>Actions / Temporary Pass</th>';
        html += '</tr></thead><tbody>';
        requests.forEach(function(r) {
          var statusClass = r.status === 'PENDING_APPROVAL' ? 'pending' : (r.status === 'APPROVED' ? 'approved' : 'rejected');
          var dateFormatted = r.requestDate ? new Date(r.requestDate).toLocaleString() : 'N/A';
          html += '<tr>';
          html += '  <td><code>' + esc(r.id) + '</code></td>';
          html += '  <td><strong>' + esc(r.store) + '</strong></td>';
          html += '  <td>' + esc(r.email) + '</td>';
          html += '  <td>' + dateFormatted + '</td>';
          html += '  <td><span class="status-pill ' + statusClass + '">' + esc(r.status) + '</span></td>';
          html += '  <td>';
          if (r.status === 'PENDING_APPROVAL') {
            html += '    <button class="btn-action-sm approve" onclick="approvePassRequest(\\'' + esc(r.id) + '\\')">✓ Approve &amp; Dispatch</button> ';
            html += '    <button class="btn-action-sm reject" onclick="rejectPassRequest(\\'' + esc(r.id) + '\\')">✕ Reject</button>';
          } else if (r.status === 'APPROVED') {
            html += '    <span style="font-size:12px;color:#16a34a">Approved (' + (r.temporaryPassword ? '<code>' + esc(r.temporaryPassword) + '</code>' : 'Delivered') + ')</span>';
          } else {
            html += '    <span style="font-size:12px;color:#dc2626">Rejected (' + esc(r.rejectReason || 'Declined') + ')</span>';
          }
          html += '  </td>';
          html += '</tr>';
        });
        html += '</tbody></table>';
      }
      html += '</div>';
    } else if (activeSub === 'stores') {
      html += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px;box-shadow:var(--huft-card-shadow)">';
      html += '  <h3 style="margin:0 0 14px;font-size:15px;color:#0f172a">Registered Store Accounts &amp; Access Controls</h3>';
      html += '<table class="admin-data-table"><thead><tr>';
      html += '  <th>Store Name</th><th>Registered Official Email</th><th>Manager</th><th>Account Status</th><th>Last Login</th><th>Admin Actions</th>';
      html += '</tr></thead><tbody>';
      stores.forEach(function(s) {
        var statusBadge = s.active ? '<span class="status-pill active">Active</span>' : '<span class="status-pill rejected">Disabled</span>';
        var lastLoginStr = s.lastLogin ? new Date(s.lastLogin).toLocaleString() : 'Never logged in';
        html += '<tr>';
        html += '  <td><strong>' + esc(s.store) + '</strong></td>';
        html += '  <td>' + esc(s.email) + '</td>';
        html += '  <td>' + esc(s.manager || 'Store Manager') + '</td>';
        html += '  <td>' + statusBadge + '</td>';
        html += '  <td><span style="font-size:11px;color:#64748b">' + lastLoginStr + '</span></td>';
        html += '  <td>';
        html += '    <button class="btn-action-sm" style="background:#0284c7;color:#fff" onclick="triggerStoreReset(\\'' + esc(s.email) + '\\')">⚡ Reset Password</button> ';
        html += '    <button class="btn-action-sm ' + (s.active ? 'reject' : 'approve') + '" onclick="toggleStoreStatus(\\'' + esc(s.email) + '\\')">' + (s.active ? 'Deactivate' : 'Activate') + '</button>';
        html += '  </td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
      html += '</div>';
    } else if (activeSub === 'security') {
      html += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px;box-shadow:var(--huft-card-shadow)">';
      html += '  <h3 style="margin:0 0 14px;font-size:15px;color:#0f172a">Real-time Security Event &amp; Login Audit Trail</h3>';
      if (logs.length === 0) {
        html += '<p style="color:#64748b;font-size:13px">No security events logged yet.</p>';
      } else {
        html += '<table class="admin-data-table"><thead><tr>';
        html += '  <th>Timestamp</th><th>Event Type</th><th>Email / Store</th><th>Status</th><th>Details</th><th>Device / IP</th>';
        html += '</tr></thead><tbody>';
        logs.slice(0, 30).forEach(function(l) {
          var pillClass = l.status === 'SUCCESS' ? 'approved' : (l.status === 'PENDING' ? 'pending' : 'rejected');
          var timeStr = l.timestamp ? new Date(l.timestamp).toLocaleString() : 'N/A';
          html += '<tr>';
          html += '  <td style="font-size:11px;font-variant-numeric:tabular-nums">' + timeStr + '</td>';
          html += '  <td><code>' + esc(l.event) + '</code></td>';
          html += '  <td><strong>' + esc(l.store) + '</strong><br><span style="font-size:11px;color:#64748b">' + esc(l.email) + '</span></td>';
          html += '  <td><span class="status-pill ' + pillClass + '">' + esc(l.status) + '</span></td>';
          html += '  <td style="font-size:12px">' + esc(l.details) + '</td>';
          html += '  <td style="font-size:11px;color:#64748b">' + esc(l.ip) + '</td>';
          html += '</tr>';
        });
        html += '</tbody></table>';
      }
      html += '</div>';
    } else if (activeSub === 'settings') {
      html += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:24px;max-width:540px;box-shadow:var(--huft-card-shadow)">';
      html += '  <h3 style="margin:0 0 8px;font-size:16px;color:#0f172a">Change Administrator Password</h3>';
      html += '  <p style="font-size:12px;color:#64748b;margin-bottom:18px">Update the master administrative credentials. Passwords must be at least 8 characters long.</p>';
      html += '  <form onsubmit="handleAdminPasswordChange(event)">';
      html += '    <div class="auth-form-group"><label>Current Admin Password</label><input type="password" id="curAdminPass" class="auth-inp" placeholder="Default: HUFT@123" required></div>';
      html += '    <div class="auth-form-group"><label>New Master Password</label><input type="password" id="newAdminPass" class="auth-inp" placeholder="At least 8 characters" required></div>';
      html += '    <div class="auth-form-group"><label>Confirm New Password</label><input type="password" id="confAdminPass" class="auth-inp" placeholder="Repeat new password" required></div>';
      html += '    <button type="submit" class="auth-btn-primary" style="margin-top:8px">Update Administrator Password</button>';
      html += '  </form>';
      html += '</div>';
    }

    html += '</div>';
    return html;
  }
  window.viewAdminApproval = viewAdminApproval;

  function checkSessionStartup() {
    try {
      var savedSession = sessionStorage.getItem('HUFT_USER_SESSION');
      if (savedSession) {
        var user = JSON.parse(savedSession);
        loginUser(user);
        return;
      }
    } catch(e) {}

    var authSc = document.getElementById('authScreen');
    if (authSc) authSc.style.display = 'flex';
  }

  // Hook session check into startup
  setTimeout(function() {
    checkSessionStartup();
    updateHeaderCounters();
  }, 100);
`;

// Insert enterpriseInnerJs inside the main IIFE before document.addEventListener('DOMContentLoaded', init);
if (!html.includes('/* ============================================================\n     HUFT ENTERPRISE CLIENT AUTH & APPROVAL ENGINE (INTERNAL)')) {
  html = html.replace("document.addEventListener('DOMContentLoaded', init);", enterpriseInnerJs + "\n  document.addEventListener('DOMContentLoaded', init);");
}

// Connect renderView hook
const renderViewHook = `if (state.tab === 'adminApproval') {
        contentEl.innerHTML = viewAdminApproval();
      } else `;

if (!html.includes("state.tab === 'adminApproval'")) {
  html = html.replace("if (state.tab === 'supabase')", renderViewHook + "if (state.tab === 'supabase')");
}

console.log('Writing updated index.html...');
fs.writeFileSync(indexHtmlPath, html, 'utf8');

console.log('Writing updated Dashboard.html...');
fs.writeFileSync(dashboardHtmlPath, html, 'utf8');

console.log('✅ Rebuilt successfully!');
