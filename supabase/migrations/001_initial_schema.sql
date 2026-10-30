-- HUFT Roster: secure Supabase foundation
-- Run in Supabase SQL Editor. Review the bootstrap/admin setup in README first.

create extension if not exists pgcrypto;

create type public.app_role as enum ('super_admin','area_manager','store_manager','employee');
create type public.request_status as enum ('pending','approved','rejected','changes_requested','cancelled');

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role public.app_role not null default 'employee',
  home_store_id uuid references public.stores(id),
  employee_code text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_store_access (
  user_id uuid not null references public.profiles(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  can_view boolean not null default true,
  can_edit boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, store_id)
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text unique,
  full_name text not null,
  role_title text not null,
  phone text,
  email text,
  store_id uuid references public.stores(id),
  joined_on date,
  removed_on date,
  photo_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roster_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  roster_date date not null,
  shift_code text not null default 'Unassigned',
  shift_note text,
  deployment_store_id uuid references public.stores(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id, roster_date)
);
create index roster_entries_date_idx on public.roster_entries(roster_date);
create index roster_entries_employee_date_idx on public.roster_entries(employee_id, roster_date);

create table public.employee_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id),
  requester_id uuid not null references public.profiles(id),
  store_id uuid references public.stores(id),
  request_type text not null,
  request_payload jsonb not null default '{}'::jsonb,
  status public.request_status not null default 'pending',
  reviewer_id uuid references public.profiles(id),
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deployment_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  requester_id uuid not null references public.profiles(id),
  from_store_id uuid references public.stores(id),
  to_store_id uuid not null references public.stores(id),
  start_date date not null,
  end_date date not null,
  shift_code text,
  reason text,
  status public.request_status not null default 'pending',
  reviewer_id uuid references public.profiles(id),
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.punctuality_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  event_date date not null,
  event_type text not null,
  minutes integer,
  notes text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles(id) on delete cascade,
  store_id uuid references public.stores(id),
  title text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  table_name text not null,
  record_id text,
  store_id uuid references public.stores(id),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs(created_at desc);

create table public.app_settings (
  setting_key text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

-- Helper functions used by RLS. Security-definer functions avoid recursive profile policies.
create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active = true
$$;

create or replace function public.can_access_store(target_store uuid, require_edit boolean default false)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    public.current_app_role() = 'super_admin'
    or (
      public.current_app_role() = 'area_manager'
      and exists (select 1 from public.user_store_access a where a.user_id = auth.uid()
                  and a.store_id = target_store and a.can_view
                  and (not require_edit or a.can_edit))
    )
    or (
      public.current_app_role() = 'store_manager'
      and exists (select 1 from public.user_store_access a where a.user_id = auth.uid()
                  and a.store_id = target_store and a.can_view
                  and (not require_edit or a.can_edit))
    )
    or (
      public.current_app_role() = 'employee'
      and exists (select 1 from public.profiles p where p.id = auth.uid()
                  and p.home_store_id = target_store)
      and not require_edit
    )
$$;

alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.user_store_access enable row level security;
alter table public.employees enable row level security;
alter table public.roster_entries enable row level security;
alter table public.employee_requests enable row level security;
alter table public.deployment_requests enable row level security;
alter table public.punctuality_events enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.app_settings enable row level security;

create policy "stores visible to authenticated users" on public.stores
for select to authenticated using (
  public.current_app_role() = 'super_admin'
  or exists (select 1 from public.user_store_access a where a.user_id=auth.uid() and a.store_id=id and a.can_view)
  or exists (select 1 from public.profiles p where p.id=auth.uid() and p.home_store_id=id)
);
create policy "super admins manage stores" on public.stores
for all to authenticated using (public.current_app_role()='super_admin')
with check (public.current_app_role()='super_admin');

create policy "users read own profile or admins read profiles" on public.profiles
for select to authenticated using (
  id=auth.uid() or public.current_app_role() in ('super_admin','area_manager')
);
create policy "users update own basic profile" on public.profiles
for update to authenticated using (id=auth.uid())
with check (id=auth.uid() and role = (select p.role from public.profiles p where p.id=auth.uid()));

create policy "access rows visible to self or super admin" on public.user_store_access
for select to authenticated using (user_id=auth.uid() or public.current_app_role()='super_admin');
create policy "super admins manage access" on public.user_store_access
for all to authenticated using (public.current_app_role()='super_admin')
with check (public.current_app_role()='super_admin');

create policy "employees view within permitted stores" on public.employees
for select to authenticated using (public.can_access_store(store_id,false));
create policy "authorized managers manage employees" on public.employees
for all to authenticated using (public.can_access_store(store_id,true))
with check (public.can_access_store(store_id,true));

create policy "roster visible within permitted stores" on public.roster_entries
for select to authenticated using (
  exists (select 1 from public.employees e where e.id=employee_id and public.can_access_store(e.store_id,false))
);
create policy "authorized managers edit roster" on public.roster_entries
for insert to authenticated with check (
  exists (select 1 from public.employees e where e.id=employee_id and public.can_access_store(e.store_id,true))
);
create policy "authorized managers update roster" on public.roster_entries
for update to authenticated using (
  exists (select 1 from public.employees e where e.id=employee_id and public.can_access_store(e.store_id,true))
) with check (
  exists (select 1 from public.employees e where e.id=employee_id and public.can_access_store(e.store_id,true))
);
create policy "authorized managers delete roster" on public.roster_entries
for delete to authenticated using (
  exists (select 1 from public.employees e where e.id=employee_id and public.can_access_store(e.store_id,true))
);

create policy "requesters and managers read employee requests" on public.employee_requests
for select to authenticated using (
  requester_id=auth.uid() or public.can_access_store(store_id,true) or public.current_app_role()='super_admin'
);
create policy "users create own employee requests" on public.employee_requests
for insert to authenticated with check (requester_id=auth.uid());
create policy "managers review employee requests" on public.employee_requests
for update to authenticated using (public.can_access_store(store_id,true) or public.current_app_role()='super_admin')
with check (public.can_access_store(store_id,true) or public.current_app_role()='super_admin');

create policy "deployment requests visible to requester or managers" on public.deployment_requests
for select to authenticated using (
 requester_id=auth.uid() or public.can_access_store(from_store_id,true) or public.can_access_store(to_store_id,true)
 or public.current_app_role()='super_admin'
);
create policy "users create deployment requests" on public.deployment_requests
for insert to authenticated with check (requester_id=auth.uid());
create policy "managers review deployment requests" on public.deployment_requests
for update to authenticated using (
 public.can_access_store(from_store_id,true) or public.can_access_store(to_store_id,true)
 or public.current_app_role()='super_admin'
) with check (
 public.can_access_store(from_store_id,true) or public.can_access_store(to_store_id,true)
 or public.current_app_role()='super_admin'
);

create policy "punctuality view in permitted stores" on public.punctuality_events
for select to authenticated using (
 exists (select 1 from public.employees e where e.id=employee_id and public.can_access_store(e.store_id,false))
);
create policy "managers record punctuality" on public.punctuality_events
for insert to authenticated with check (
 exists (select 1 from public.employees e where e.id=employee_id and public.can_access_store(e.store_id,true))
);

create policy "users read own notifications" on public.notifications
for select to authenticated using (
 recipient_id=auth.uid() or (store_id is not null and public.can_access_store(store_id,false))
);
create policy "users mark own notifications read" on public.notifications
for update to authenticated using (recipient_id=auth.uid())
with check (recipient_id=auth.uid());

create policy "super admins inspect audit logs" on public.audit_logs
for select to authenticated using (public.current_app_role()='super_admin');
create policy "authenticated users create audit logs" on public.audit_logs
for insert to authenticated with check (actor_id=auth.uid());

create policy "settings visible to super admins" on public.app_settings
for select to authenticated using (public.current_app_role()='super_admin');
create policy "super admins manage settings" on public.app_settings
for all to authenticated using (public.current_app_role()='super_admin')
with check (public.current_app_role()='super_admin');

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

do $$
declare t text;
begin
  foreach t in array array['stores','profiles','employees','roster_entries','employee_requests','deployment_requests','app_settings']
  loop
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',t,t);
  end loop;
end $$;
