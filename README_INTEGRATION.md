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
1. Create a Supabase project.
2. In SQL Editor run `supabase/migrations/001_initial_schema.sql` from the previous starter package, then run `supabase/migrations/002_huft_integration.sql` from this package.
3. In Authentication → Providers enable Email. Keep public sign-up disabled; create/invite authorised users individually.
4. In Authentication → Users create your first admin user. Copy its UUID. In SQL Editor add a profile: `insert into public.profiles(id,full_name,email,role,is_active) values ('AUTH-UUID','HUFT Admin','hyderguda@headsupfortails.com','super_admin',true);`
5. Add store manager profiles and `user_store_access` rows. Use `super_admin` only for the authorised admin. Roles are `super_admin`, `area_manager`, `store_manager`, `employee`.
6. Edit `public/js/huft-config.js`: set the project URL and publishable/anon key. Never use service_role in the browser.
7. Host the `public` folder on HTTPS (Cloudflare Pages or Vercel). Open `login.html`.

## Import the workbook data (run locally, not in browser)
1. First ensure SQL migrations are applied.
2. In a private local terminal set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as environment variables. Do not put the service key in GitHub, HTML, chat or a `.env` committed to Git.
3. Run `npm install`, then `npm run import`. The importer upserts stores, employees and monthly roster entries from `import-data.json`.
4. The import data covers the monthly tabs present in the uploaded workbook and the Permanent Roster master. Review the generated report and spot-check month totals before using the app.
5. The workbook's `Roster Access` tab is retained in `import-data.json` as `access_seed_review` for manual review; it is not auto-granted because Supabase Auth users must exist first. After import, add each user’s `user_store_access` rows. A store manager needs `can_view=true, can_edit=true` only for their own store.

## Important data notes
- The workbook is imported as a new database copy; it does not write back to or alter the Google Sheet.
- Employee master rows are sourced from `Roster - Permanent`, enriched with phone/email/reporting details from `HUFT Directory`, and augmented where monthly sheets contain additional staff. Existing Google Drive photo IDs are not copied into Supabase Storage; photos need a separate secure migration.
- Monthly rows are converted from the workbook's date-across-columns layout to one database row per employee/date.
- Blank shift cells are not imported; the UI renders them as `Unassigned`.
- Cells whose value matches another store are mapped to `deployment_store_id`; review historical cross-store cells before treating them as formal approved deployment records.
- Do not import `WA`, `Sheet4`, generated views or email/audit logs as roster shifts.

## Validation before production
- Test with one super admin, one store manager and one employee account.
- Verify store managers cannot read or edit other stores. Test with actual user accounts; RLS is the security boundary.
- Compare February–November 2026 monthly roster values against the original workbook.
- Test shift edits, clears, month-end weeks, removed staff and deployment periods.
- Configure backups and test restore. Keep the old Apps Script URL available during validation.

## Current status
This is a **core integration build**, not a completed production cutover. No Supabase project URL/key or user passwords were supplied, so the package is configured with placeholders.
