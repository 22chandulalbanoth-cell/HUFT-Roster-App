-- HUFT Roster API grants and profile access correction.
-- Apply after 001_initial_schema.sql and 002_huft_integration.sql.
-- Row Level Security remains enabled. These grants are limited to app-used tables;
-- policies continue to decide which rows each authenticated user can access.

revoke all on table
  public.stores,
  public.profiles,
  public.user_store_access,
  public.employees,
  public.roster_entries,
  public.employee_requests,
  public.deployment_requests,
  public.punctuality_events,
  public.roster_access_requests
from anon, authenticated;

grant select, insert on public.stores to authenticated;

grant select on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant update (role, home_store_id) on public.profiles to authenticated;

grant select, insert, update, delete on public.user_store_access to authenticated;
grant select, insert, update on public.employees to authenticated;
grant select, insert, update, delete on public.roster_entries to authenticated;
grant select, insert, update on public.employee_requests to authenticated;
grant select, insert, update on public.deployment_requests to authenticated;
grant select, insert on public.punctuality_events to authenticated;
grant select, insert, update on public.roster_access_requests to authenticated;

-- Profile administration is reserved for super admins. Users can still read their
-- own profile, which the login and app bootstrap need.
drop policy if exists "users read own profile or admins read profiles" on public.profiles;
drop policy if exists "users update own basic profile" on public.profiles;
create policy "users read own profile or super admins read profiles"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.current_app_role() = 'super_admin');

create policy "super admins update profiles"
on public.profiles for update to authenticated
using (public.current_app_role() = 'super_admin')
with check (public.current_app_role() = 'super_admin');

-- RLS calls these SECURITY DEFINER helpers. Grant only the helpers used by
-- the policies instead of granting execution on every function in public.
revoke execute on function public.current_app_role() from public, anon;
revoke execute on function public.can_access_store(uuid, boolean) from public, anon;
revoke execute on function public.can_view_employee(uuid) from public, anon;
revoke execute on function public.can_edit_roster_entry(uuid, uuid) from public, anon;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.can_access_store(uuid, boolean) to authenticated;
grant execute on function public.can_view_employee(uuid) to authenticated;
grant execute on function public.can_edit_roster_entry(uuid, uuid) to authenticated;
