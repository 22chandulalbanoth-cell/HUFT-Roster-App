# HUFT Roster — Supabase integration build (Core)

This package integrates your supplied roster HTML with Supabase for the core roster operations and includes a workbook import package. The original Google Apps Script backend and Google Sheet are not modified.

## What is integrated in this build
- Original roster UI retained as `public/index.html`; its Apps Script `call()` bridge is redirected to `HUFTApi`.
- Supabase email/password login in `public/login.html`.
- Bootstrap, monthly roster reads, shift saves/clears, employee add/edit/remove/restore, removed staff list, punctuality events, employee request create/list/review, deployment request create/list/review, access request submission, access list/update, profile photo signed-URL lookup and store creation.
- Workbook import data built from the uploaded `Weekoff Roster Hyderabad (1).xlsx`.

## Not yet migrated (do not switch off Apps Script for these)
- Email template administration, sending, retry and Gmail one-click approvals.
- Profile photo upload and admin photo-sharing workflow.
- Removing punctuality events.
- Full access request review/invitation workflow and complete access administration.
- Some edge cases in deployment/request approval notifications and employee self-service validation.

The UI will show an explicit “not migrated” error if one of those actions is used. This is intentional; it avoids pretending the feature is ready. Keep the current Apps Script deployment as fallback until phase 2 is completed and tested.

## Setup

This repository's roster database uses the Supabase project configured in `public/js/huft-config.js`. That file contains only the project's URL and publishable browser key. Never add a secret/service-role key to the repository or `public/`.

1. In Supabase Authentication → Providers, enable Email and keep public sign-up disabled. Create or invite authorized users individually.
2. If the schema is not present yet, run migrations `001_initial_schema.sql`, `002_huft_integration.sql`, then `003_api_grants_and_profile_access.sql` in SQL Editor, in that order. If 001 and 002 were already applied, run 003 only. The third migration grants only the privileges used by the roster app, preserves RLS, and limits profile administration to super admins.
3. Create the first admin in Authentication → Users. Use that user's Auth UUID and exact email to create the profile in SQL Editor:
   ```sql
   insert into public.profiles (id, full_name, email, role, is_active)
   values ('AUTH-UUID', 'HUFT Admin', 'ADMIN-EMAIL', 'super_admin', true);
   ```
   Replace both placeholders with that user's actual values. Do not create another profile if one already exists.
4. Assign staff in the app's access screen. The updated access workflow records the user's role, home store, and store-level view/edit permission. Keep public sign-up disabled.
5. Host the `public` folder over HTTPS. The existing roster UI and Apps Script fallback are retained; do not cut over the team until the validation steps below pass.

## Import the workbook data (local terminal only)

The private `import-data.json` file contains employee information. It is deliberately excluded from GitHub. Keep it beside `package.json` in your local project checkout, or set `HUFT_IMPORT_DATA_PATH` to its local path. Never upload it to GitHub or a public hosting folder.

1. First ensure migrations 001–003 have been applied and the first super-admin profile exists.
2. From the project folder in a local PowerShell terminal, run:
   ```powershell
   $env:SUPABASE_URL = "https://sumoyszqxxuarwzpzsgw.supabase.co"
   $env:SUPABASE_SERVICE_ROLE_KEY = Read-Host "Paste the Supabase Secret key (input is visible)"
   ```
   Enter the secret/service-role key only in that local terminal prompt. It is not sent to this chat. Do not put it in the browser, GitHub, or any committed file.
3. Place the private `import-data.json` beside `package.json`, then run `npm install` and `npm run import`. The importer rejects publishable/anon keys, checks the target project, validates every employee/store reference before writing, and verifies each saved roster batch. It can be rerun after a partial failure because it upserts records; it does not delete existing records.
4. Review the terminal summary. Expected source counts are 5 stores, 74 employees, and 6,660 roster entries for February–November 2026; those are source-data counts, not confirmation that an import has run.
5. Review `access_seed_review` manually. Auth users must already exist; do not auto-grant access from workbook email addresses.

## Important data notes

- The workbook is imported as a new database copy and does not write to the original Google Sheet.
- Employee master rows come from `Roster - Permanent`, enriched with phone/email/reporting details from `HUFT Directory`, and augmented where monthly sheets contain additional staff.
- Monthly rows are converted from date-across-columns to one database row per employee/date. Blank shift cells are not imported.
- Cells matching another store are mapped to `deployment_store_id`; review historical cross-store cells before treating them as approved deployment records.
- Do not import `WA`, `Sheet4`, generated views, or email/audit logs as roster shifts.
- Existing Google Drive photo IDs are not copied to Supabase Storage; photo migration is separate.

## Validation before production

- Test sign-in with one super admin, one store manager, and one employee.
- Verify store managers cannot read or edit other stores, including via direct API calls. RLS remains the security boundary.
- Compare monthly totals and sample shifts against the source workbook; test shift edits, clears, month-end weeks, removed staff, and deployments.
- Configure backups and test restore. Keep the existing Apps Script deployment available during validation.
- Email templates, email sending/retry, Gmail one-click approvals, profile-photo upload/admin sharing, punctuality deletion, complete access invitations, and some request/deployment notification edge cases remain unmigrated. Keep Apps Script available for these flows.

## Current status

The repository is a core integration build, not a production cutover. The browser configuration is populated with the project URL and publishable key. The private workbook import data remains local. Applying database migrations, importing the workbook, creating authorized Auth users, validating the RLS boundaries, and deploying the site require access in the user's Supabase/hosting account.
