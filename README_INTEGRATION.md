# HUFT Roster — Supabase integration build (Core)

This package connects the existing roster UI to Supabase for the core roster workflows. The original Google Apps Script backend and Google Sheet are not modified.

## Integrated
- The roster UI remains in public/index.html; its Apps Script call bridge uses HUFTApi.
- Supabase email/password login and core roster reads/edits, employee management, requests, access assignment, punctuality, and store creation.
- Workbook data is imported locally by the script in scripts/import-workbook.mjs.

## Not yet migrated
- Email template administration, sending/retry, Gmail one-click approvals, photo upload/admin sharing, punctuality deletion, full access invitations, and some request/deployment notification edge cases.
- Keep the existing Apps Script deployment available for these workflows and during validation.

## Supabase setup
1. Keep public sign-up disabled in Authentication → Providers; create or invite authorized users individually.
2. If the schema is not present, run migrations 001_initial_schema.sql, 002_huft_integration.sql, then 003_api_grants_and_profile_access.sql in that order. If 001 and 002 were already applied, run 003 only. The third migration grants only app-used privileges, preserves RLS, and limits profile administration to super admins.
3. Create the first admin in Authentication → Users. Use that user's Auth UUID and exact email to create a profile in SQL Editor with: insert into public.profiles (id, full_name, email, role, is_active) values ('AUTH-UUID', 'HUFT Admin', 'ADMIN-EMAIL', 'super_admin', true); Replace both placeholders with actual values. Do not create another profile if one already exists.
4. Assign staff in the app's access screen. The access workflow records role, home store, and store-level view/edit permission.
5. The browser configuration in public/js/huft-config.js contains the supplied project URL and publishable key. It must never contain a secret/service-role key.
6. Host the public folder over HTTPS. Keep the existing Apps Script deployment available during validation.

## Local workbook import
The private import-data.json contains employee information and is deliberately excluded from GitHub. Keep it beside package.json in your local checkout or set HUFT_IMPORT_DATA_PATH. Never upload it to GitHub or a public host.

1. Apply migrations 001–003 and create the first super-admin profile before importing.
2. Place the private import-data.json beside package.json.
3. Run npm install, then run scripts/import.ps1 from a local PowerShell terminal. It prompts for the secret/service-role key with hidden input, sets it only for the import process, and clears it afterward. The key must not go in browser code, GitHub, chat, or a committed file.
4. The importer checks the target project and key type, validates all employee/store references before writing, and verifies saved roster batch counts. It can be rerun after a partial failure because it upserts records; it does not delete existing records.
5. Review access_seed_review manually. Auth users must already exist; workbook email addresses are not auto-granted access.
6. Review the terminal summary and compare month totals and sample shifts with the source workbook.

Expected source counts are 5 stores, 74 employees, and 6,660 roster entries for February–November 2026. These are source counts, not confirmation that an import has run.

## Data notes
- The import creates a new database copy; it does not write to the original Google Sheet.
- Monthly rows become one database row per employee/date. Blank shifts are not imported.
- Cross-store cells map to deployment_store_id; review historical values before treating them as approved deployment records.
- Do not import WA, Sheet4, generated views, or email/audit logs as roster shifts.
- Google Drive photo IDs are not copied into Supabase Storage.

## Production validation
- Test sign-in with a super admin, store manager, and employee account.
- Verify store managers cannot read or edit other stores, including through direct API calls. RLS is the security boundary.
- Compare monthly totals and sample shifts against the workbook; test shift edits, clears, month-end weeks, removed staff, and deployment periods.
- Configure backups and test restore. Keep Apps Script available until validation is complete.

## Current status
This is a core integration build, not a production cutover. The browser configuration is populated with the project URL and publishable key. The private workbook import file remains local. Applying migrations, importing data, creating authorized Auth users, validating RLS, and deploying the site still require access in the user's Supabase/hosting account.
