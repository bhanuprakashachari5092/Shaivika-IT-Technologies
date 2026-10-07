-- ============================================================================
-- SHAIVIKA IT TECHNOLOGIES — SUPABASE POSTGRESQL LEADS DATABASE SCHEMA
-- Website: shaivikaittechnologies.in
-- ============================================================================

-- 1. Ensure cryptographic UUID generation is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create the production 'leads' table
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT,
    country TEXT,
    phone TEXT,
    contact_method TEXT DEFAULT 'Email',
    project_type TEXT,
    budget TEXT,
    launch_date DATE,
    description TEXT,
    source TEXT DEFAULT 'website',
    status TEXT DEFAULT 'New',
    priority TEXT DEFAULT 'Normal',
    internal_notes TEXT,
    next_follow_up DATE,
    last_contacted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    ip_hash TEXT,
    user_agent TEXT,
    legacy_id TEXT,
    CONSTRAINT status_check CHECK (status IN ('New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost')),
    CONSTRAINT priority_check CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent'))
);

-- 3. Add High-Performance B-Tree Indexes
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_company ON public.leads(company);
CREATE INDEX IF NOT EXISTS idx_leads_legacy_id ON public.leads(legacy_id) WHERE legacy_id IS NOT NULL;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- 5. Revoke direct anon / public permissions
-- Under default RLS, with no permissive policies granted to anon/public roles,
-- public clients cannot read, update, or delete any leads.
-- The Netlify serverless functions connect using the SUPABASE_SERVICE_ROLE_KEY,
-- which automatically bypasses RLS on the server side.
REVOKE ALL ON public.leads FROM anon;
REVOKE ALL ON public.leads FROM authenticated;

-- Allow only service_role to manage the table
GRANT ALL ON public.leads TO service_role;

-- 6. Trigger for automatic updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leads_updated_at ON public.leads;
CREATE TRIGGER trg_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Comment for table documentation
COMMENT ON TABLE public.leads IS 'Production lead generation and project inquiry records for SHAIVIKA IT TECHNOLOGIES';

-- ============================================================================
-- 7. Administrator Authorization Table (public.admin_users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT admin_role_check CHECK (role IN ('admin', 'super_admin'))
);

CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users(email);

-- Enable Row Level Security (RLS) on admin_users
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Revoke all direct anonymous and authenticated access from clients
REVOKE ALL ON public.admin_users FROM anon;
REVOKE ALL ON public.admin_users FROM authenticated;

-- Allow only service_role to manage admin_users
GRANT ALL ON public.admin_users TO service_role;

COMMENT ON TABLE public.admin_users IS 'Authorized administrators with permission to access the leads dashboard';

-- ============================================================================
-- 8. STEP 4 CRM Upgrade Migration (public.leads)
-- ============================================================================
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Normal';

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS internal_notes TEXT;

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS next_follow_up DATE;

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;

-- Add validation check constraint for priority
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'leads_priority_check'
    ) THEN
        ALTER TABLE public.leads
        ADD CONSTRAINT leads_priority_check CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent'));
    END IF;
END $$;

-- Ensure existing leads receive priority = 'Normal'
UPDATE public.leads SET priority = 'Normal' WHERE priority IS NULL;

-- High-performance indexes for CRM pipeline queries
CREATE INDEX IF NOT EXISTS idx_leads_priority ON public.leads(priority);
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON public.leads(next_follow_up);
CREATE INDEX IF NOT EXISTS idx_leads_last_contacted_at ON public.leads(last_contacted_at);

