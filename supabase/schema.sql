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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    ip_hash TEXT,
    user_agent TEXT,
    legacy_id TEXT,
    CONSTRAINT status_check CHECK (status IN ('New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'))
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
