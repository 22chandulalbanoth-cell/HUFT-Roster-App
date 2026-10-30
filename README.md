# 🐾 HUFT-Roster-App — Supabase Cloud & Google Workspace

HUFT Multi-Store Roster Management System. Enterprise workforce roster, inter-store deployment management, punctuality tracking, and automated reporting system built for **Heads Up For Tails (HUFT)** Hyderabad stores.

Powered by a dual-cloud architecture: **Supabase** (PostgreSQL Database, Realtime WebSockets, and Cloud Storage) paired with **Google Workspace** (Google Apps Script, Google Sheets, and Google Drive).

---

## ⚡ Quick Start (Local Development)

### 1. Set as Active Workspace
To work with this codebase in Antigravity, set this folder as your active workspace:
```
C:\Users\Arun\.gemini\antigravity\scratch\huft-roster
```

### 2. Start the Local Server
```bash
node scripts/dev-server.js
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🚀 Supabase Cloud Database & Storage Setup

### Step 1: Create a Project in Supabase
1. Go to [https://supabase.com](https://supabase.com) and create or open your project (`https://sumoyszqxxuarwzpzsgw.supabase.co`).
2. In the left navigation, open **SQL Editor** -> **New Query**.
3. Open `supabase/schema.sql` from this folder, copy its full contents, paste into Supabase SQL Editor, and click **Run**.
4. This instantly creates:
   - **9 PostgreSQL Tables**: `stores`, `employees`, `roster_shifts`, `punctuality_events`, `deployment_requests`, `employee_requests`, `roster_access`, `audit_logs`, `cloud_backups`.
   - **3 Cloud Storage Buckets**:
     - `profiles`: Public CDN avatar photos for staff
     - `backups`: Private encrypted database snapshots
     - `exports`: High-res weekly roster JPGs and reports
   - **Realtime WebSockets** on `roster_shifts`, `employees`, and requests.

### Step 2: Connect the App to Supabase
1. In your Supabase Dashboard, go to **Project Settings** -> **API**.
2. Copy your **Project URL** (`https://sumoyszqxxuarwzpzsgw.supabase.co`) and **anon public key**.
3. In the HUFT Roster app, click the **⚡ Supabase Cloud** tab in the sidebar.
4. Paste your URL and Key, then click **⚡ Connect & Save Credentials**.
5. Click **🚀 Sync Google Sheets ➔ Supabase** to transfer all store records, staff directory profiles, and daily shifts into Supabase PostgreSQL!

---

## 📂 Project Structure

```
huft-roster/
├── Code.js                 # Google Apps Script server-side controller & business logic
├── Supabase.js             # Supabase REST & Storage cloud connector for Apps Script
├── Dashboard.html          # High-performance glassmorphism single-page application
├── appsscript.json         # Google Apps Script manifest with domain OAuth scopes
├── package.json            # Node.js configuration & scripts
├── .env.example            # Environment variables template
├── supabase/
│   ├── schema.sql          # Complete PostgreSQL schema, RLS policies & storage setup
│   └── migrations/         # Individual SQL migrations
├── public/                 # Public client bundles
├── data/
│   └── roster-data.json    # Local database for offline preview and testing
└── scripts/
    ├── dev-server.js       # Local cloud emulator & preview server
    └── import-workbook.mjs # Legacy workbook migration tool
```

---

## 🌐 Google Apps Script Deployment

1. Open your Google Spreadsheet:
   `https://docs.google.com/spreadsheets/d/1anAGAvK-Keh3cH5sncIpycURWqVgaAPn40icFZrYC60/edit`
2. Go to **Extensions** -> **Apps Script**.
3. Add the files:
   - `Code.js` -> paste into `Code.gs`
   - `Supabase.js` -> paste into a new script file `Supabase.gs`
   - `Dashboard.html` -> paste into `Dashboard.html`
   - `appsscript.json` -> replace Project Settings manifest
4. Click **Deploy** -> **New Deployment**:
   - Type: **Web app**
   - Execute as: **User accessing the web app**
   - Who has access: **Anyone within Heads Up For Tails**
5. Click **Deploy** and copy your Web App URL.

---

## 🛡️ Cloud Storage & Security

- **Profiles Storage (`profiles`)**: Employee photos are saved as binary objects in Supabase Storage with edge CDN caching.
- **Backups Storage (`backups`)**: Point-in-time full database JSON snapshots and emergency recovery points.
- **Exports Storage (`exports`)**: Weekly roster SVG-to-JPG graphics automatically saved to the cloud for download and sharing.
- **Realtime Sync**: When any store manager updates a shift or approves a request, all active browser sessions update instantaneously via WebSocket subscriptions.
