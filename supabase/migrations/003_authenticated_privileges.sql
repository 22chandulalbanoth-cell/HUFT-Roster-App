-- HUFT Roster privilege baseline.
-- RLS remains the row-level security boundary; these grants only permit
-- authenticated sessions to reach the tables. Never grant service_role to clients.

grant usage on schema public to authenticated;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

grant select, insert, update, delete on
  public.stores,
  public.profiles,
  public.user_store_access,
  public.employees,
  public.roster_entries,
  public.employee_requests,
  public.deployment_requests,
  public.punctuality_events,
  public.notifications,
  public.audit_logs,
  public.app_settings,
  public.roster_access_requests,
  public.email_templates,
  public.email_delivery_logs
to authenticated;

grant usage, select on all sequences in schema public to authenticated;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.can_access_store(uuid, boolean) to authenticated;
grant execute on function public.can_view_employee(uuid) to authenticated;
grant execute on function public.can_edit_roster_entry(uuid, uuid) to authenticated;

-- Default privileges for future objects created by the migration owner.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public grant usage, select on sequences to authenticated;
