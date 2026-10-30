-- ==============================================================================
-- HUFT Roster — Supabase Cloud Database & Storage Schema
-- ==============================================================================
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- It creates all required PostgreSQL tables, indexes, storage buckets, RLS policies,
-- and seed data for the Hyderabad Heads Up For Tails (HUFT) Roster.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. STORES TABLE
CREATE TABLE IF NOT EXISTS public.stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT true,
    location TEXT DEFAULT '',
    manager TEXT DEFAULT '',
    manager_email TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. EMPLOYEES DIRECTORY TABLE
CREATE TABLE IF NOT EXISTS public.employees (
    id TEXT PRIMARY KEY, -- Formatted as: store|namekey (e.g. "Hyderguda|rahulsharma")
    store TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Retail', -- 'Retail' or 'Grooming'
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    employee_id TEXT DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT true,
    reports_to TEXT DEFAULT '',
    photo_url TEXT DEFAULT '',
    photo_id TEXT DEFAULT '',
    removed_on DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_employees_store ON public.employees(store);
CREATE INDEX IF NOT EXISTS idx_employees_active ON public.employees(active);
CREATE INDEX IF NOT EXISTS idx_employees_email ON public.employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON public.employees(employee_id);

-- 4. ROSTER SHIFTS TABLE
CREATE TABLE IF NOT EXISTS public.roster_shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    date DATE NOT NULL,
    shift TEXT NOT NULL, -- 'Opening', 'Closing', 'Mid Shift', 'SPA Timings', 'Training', 'Week off', 'Comp off', 'Holiday', 'Leave', 'Absent'
    to_store TEXT DEFAULT '', -- If cross-store deployment
    notes TEXT DEFAULT '',
    updated_by TEXT DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_store_employee_date UNIQUE (store, employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_roster_shifts_date ON public.roster_shifts(date);
CREATE INDEX IF NOT EXISTS idx_roster_shifts_store ON public.roster_shifts(store);
CREATE INDEX IF NOT EXISTS idx_roster_shifts_employee ON public.roster_shifts(employee_id);

-- 5. PUNCTUALITY EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.punctuality_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_id TEXT NOT NULL UNIQUE,
    store TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    employee_id TEXT DEFAULT '',
    date DATE NOT NULL,
    incident_type TEXT NOT NULL, -- 'Late reporting' or 'Unapproved leave'
    notice TEXT DEFAULT '', -- 'Informed' or 'Not informed'
    minutes INTEGER DEFAULT 0,
    details TEXT DEFAULT '',
    recorded_by TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_punctuality_store ON public.punctuality_events(store);
CREATE INDEX IF NOT EXISTS idx_punctuality_date ON public.punctuality_events(date);

-- 6. INTER-STORE DEPLOYMENT REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.deployment_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id TEXT NOT NULL UNIQUE,
    requester TEXT NOT NULL,
    from_store TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    to_store TEXT NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    shift TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending', 'Approved', 'Rejected', 'Changes Requested'
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    decided_by TEXT DEFAULT '',
    decided_at TIMESTAMPTZ,
    decision_notes TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_deployment_status ON public.deployment_requests(status);
CREATE INDEX IF NOT EXISTS idx_deployment_to_store ON public.deployment_requests(to_store);

-- 7. EMPLOYEE SELF-SERVICE WORK REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.employee_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL, -- 'Leave request', 'Week-off change', 'Shift change', 'Attendance correction'
    employee_id TEXT DEFAULT '',
    employee_name TEXT NOT NULL,
    store TEXT NOT NULL,
    employee_email TEXT NOT NULL,
    date DATE NOT NULL,
    previous_shift TEXT DEFAULT '',
    requested_shift TEXT DEFAULT '',
    reason TEXT NOT NULL,
    evidence_url TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending', 'Approved', 'Rejected', 'Changes Requested'
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    decided_by TEXT DEFAULT '',
    decided_at TIMESTAMPTZ,
    decision_notes TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_employee_requests_store ON public.employee_requests(store);
CREATE INDEX IF NOT EXISTS idx_employee_requests_status ON public.employee_requests(status);
CREATE INDEX IF NOT EXISTS idx_employee_requests_email ON public.employee_requests(employee_email);

-- 8. ROSTER ACCESS / PERMISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.roster_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    store TEXT DEFAULT '', -- Empty string = Admin across all stores
    access TEXT NOT NULL DEFAULT 'Editor', -- 'Editor' or 'Admin'
    added_on DATE DEFAULT CURRENT_DATE,
    CONSTRAINT uq_access_email_store UNIQUE (email, store)
);

-- 9. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    correlation_id UUID DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT DEFAULT '',
    entity_id TEXT DEFAULT '',
    store TEXT DEFAULT '',
    previous_value TEXT DEFAULT '',
    new_value TEXT DEFAULT '',
    result TEXT NOT NULL DEFAULT 'Success',
    workflow TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.audit_logs(timestamp DESC);

-- 10. CLOUD BACKUPS METADATA TABLE
CREATE TABLE IF NOT EXISTS public.cloud_backups (
    id TEXT PRIMARY KEY,
    snapshot_name TEXT NOT NULL,
    storage_url TEXT NOT NULL,
    size_kb INTEGER DEFAULT 0,
    created_by TEXT NOT NULL,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 11. SUPABASE STORAGE BUCKETS SETUP
-- ==============================================================================
-- Insert the 3 required storage buckets into storage.buckets if they do not exist
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('profiles', 'profiles', true),
    ('backups', 'backups', false),
    ('exports', 'exports', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
-- Allow public access to view profiles & exports
CREATE POLICY "Public Read for Profiles" ON storage.objects
    FOR SELECT USING (bucket_id = 'profiles');

CREATE POLICY "Public Read for Exports" ON storage.objects
    FOR SELECT USING (bucket_id = 'exports');

-- Allow upload to profiles and exports
CREATE POLICY "Allow All Uploads to Profiles" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'profiles');

CREATE POLICY "Allow All Uploads to Exports" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'exports');

CREATE POLICY "Allow All Uploads to Backups" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'backups');

CREATE POLICY "Allow Read Backups" ON storage.objects
    FOR SELECT USING (bucket_id = 'backups');

-- ==============================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.punctuality_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_backups ENABLE ROW LEVEL SECURITY;

-- Allow anon/service roles full read/write for web app client
CREATE POLICY "Enable read access for all users" ON public.stores FOR SELECT USING (true);
CREATE POLICY "Enable write access for all users" ON public.stores FOR ALL USING (true);

CREATE POLICY "Enable read access for employees" ON public.employees FOR SELECT USING (true);
CREATE POLICY "Enable write access for employees" ON public.employees FOR ALL USING (true);

CREATE POLICY "Enable read access for roster_shifts" ON public.roster_shifts FOR SELECT USING (true);
CREATE POLICY "Enable write access for roster_shifts" ON public.roster_shifts FOR ALL USING (true);

CREATE POLICY "Enable read access for punctuality_events" ON public.punctuality_events FOR SELECT USING (true);
CREATE POLICY "Enable write access for punctuality_events" ON public.punctuality_events FOR ALL USING (true);

CREATE POLICY "Enable read access for deployment_requests" ON public.deployment_requests FOR SELECT USING (true);
CREATE POLICY "Enable write access for deployment_requests" ON public.deployment_requests FOR ALL USING (true);

CREATE POLICY "Enable read access for employee_requests" ON public.employee_requests FOR SELECT USING (true);
CREATE POLICY "Enable write access for employee_requests" ON public.employee_requests FOR ALL USING (true);

CREATE POLICY "Enable read access for roster_access" ON public.roster_access FOR SELECT USING (true);
CREATE POLICY "Enable write access for roster_access" ON public.roster_access FOR ALL USING (true);

CREATE POLICY "Enable read access for audit_logs" ON public.audit_logs FOR SELECT USING (true);
CREATE POLICY "Enable write access for audit_logs" ON public.audit_logs FOR ALL USING (true);

CREATE POLICY "Enable read access for cloud_backups" ON public.cloud_backups FOR SELECT USING (true);
CREATE POLICY "Enable write access for cloud_backups" ON public.cloud_backups FOR ALL USING (true);

-- Enable Supabase Realtime for instant multi-user synchronization
ALTER PUBLICATION supabase_realtime ADD TABLE public.roster_shifts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.employees;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deployment_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_requests;

-- ==============================================================================
-- 13. SEED DEFAULT DATA
-- ==============================================================================
INSERT INTO public.stores (name, active, location, manager)
VALUES 
    ('Hyderguda', true, 'Hyderguda Main Road', 'Store Manager'),
    ('Golden Mile', true, 'Golden Mile Business Park, Kokapet', 'Store Manager'),
    ('Banjara Hills', true, 'Road No. 12, Banjara Hills', 'Store Manager'),
    ('Nallagandla', true, 'Aparna Sarovar Grande Road', 'Store Manager'),
    ('Madhapur', true, 'Hitech City Road, Madhapur', 'Store Manager')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.roster_access (email, store, access)
VALUES 
    ('hyderguda@headsupfortails.com', '', 'Admin')
ON CONFLICT (email, store) DO NOTHING;
