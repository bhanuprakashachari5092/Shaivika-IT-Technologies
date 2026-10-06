# SHAIVIKA IT TECHNOLOGIES — LEADS DATABASE & API ARCHITECTURE

Production lead persistence for `shaivikaittechnologies.in` using Supabase PostgreSQL, Netlify Serverless Functions, and zero client-exposed secrets.

---

## 1. Architecture Overview

```
Client Contact Form (index.html, contact.html)
        ↓
POST /api/leads
        ↓
Netlify Serverless Function (netlify/functions/leads.js)
        ├── HTTP Method Check (405 on non-POST)
        ├── Anti-Spam Honeypot Validation (website_hp_check)
        ├── Client IP Rate Limiting (sliding 10m window)
        ├── Field Validation & String Sanitization
        ├── Email Normalization (lowercase, trimmed)
        └── Duplicate Detection (10-minute recent window)
        ↓
Supabase PostgreSQL (via Service Role over PostgREST)
        ├── Row Level Security (RLS) Active
        ├── Table: public.leads
        └── Check Constraint on Status
        ↓
Lead UUID Returned to Netlify Function
        ↓
Post-Insert Email Notification (Resend / SMTP)
        ├── Database insert occurs BEFORE email dispatch
        └── Non-blocking: Email failure does not drop or fail the lead
        ↓
Safe Client Response (JSON)
        └── { "success": true, "message": "...", "leadId": "..." }

Admin Lead Dashboard (admin/index.html)
        ↓
GET /api/admin/leads / PATCH /api/admin/leads (netlify/functions/admin-leads.js)
        ├── Admin Header Authentication (Bearer <ADMIN_KEY>)
        ├── Server-side Pagination (25–50 leads/page)
        ├── Status Filter & Full-Text Search
        └── Safe CSV / JSON Export (strips internal hashes)
```

---

## 2. Supabase Schema

The SQL schema is located in `supabase/schema.sql`.

```sql
-- Create leads table
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT,
    country TEXT,
    phone TEXT,
    contact_method TEXT DEFAULT 'Email',
    project_type TEXT NOT NULL,
    budget TEXT,
    launch_date DATE,
    description TEXT NOT NULL,
    source TEXT DEFAULT 'website',
    status TEXT DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    ip_hash TEXT,
    user_agent TEXT,
    legacy_id TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_company ON public.leads(company);
CREATE INDEX IF NOT EXISTS idx_leads_legacy_id ON public.leads(legacy_id);

-- Row Level Security (RLS)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Revoke direct anonymous and authenticated access
REVOKE ALL ON public.leads FROM anon;
REVOKE ALL ON public.leads FROM authenticated;

-- Grant access to service_role (Netlify serverless functions only)
GRANT ALL ON public.leads TO service_role;
```

---

## 3. Environment Variables

Configure these variables in your **Netlify Site Settings > Environment Variables**:

| Variable | Required | Description | Example (Placeholder Only) |
|---|---|---|---|
| `SUPABASE_URL` | **Yes** | Your Supabase project URL | `https://xyzprojectid.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Supabase Secret Service-Role Key | `eyJhbGciOi...` |
| `ADMIN_KEY` | Recommended | Secret token to authenticate Admin API | `shaivika_admin_secure_key_2026` |
| `RESEND_API_KEY` | Optional | Resend API key for admin email alerts | `re_1234567890abcdef...` |
| `EMAIL_FROM` | Optional | Verified sender email for alerts | `inquiries@shaivikaittechnologies.in` |
| `IP_SALT` | Optional | HMAC salt for anonymized IP hashing | `shaivika_leads_salt_2026` |

> **IMPORTANT**: Never commit real keys to Git or expose `SUPABASE_SERVICE_ROLE_KEY` in frontend files.

---

## 4. Local Development Setup

1. Copy `.env.example` to `.env` (locally only, `.env` is ignored in Git):
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   ADMIN_KEY=your-admin-key
   RESEND_API_KEY=
   ```
2. Run local Netlify dev server with serverless functions:
   ```bash
   npx netlify dev
   ```
   Or run the static preview server:
   ```bash
   npx serve -l 8888 .
   ```
3. Run the automated test suite:
   ```bash
   node scratch/test_leads_suite.cjs
   ```

---

## 5. Production Setup

1. In your **Supabase Dashboard**:
   - Navigate to **SQL Editor**.
   - Paste and run the contents of `supabase/schema.sql`.
   - Verify table `leads` exists with RLS enabled.
2. In your **Netlify Dashboard**:
   - Go to **Site Configuration** > **Environment variables**.
   - Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
   - Add `ADMIN_KEY`.
   - (Optional) Add `RESEND_API_KEY`.
3. Deploy the site or trigger a new build via GitHub.

---

## 6. Migration Procedure (from `data/leads.json`)

To migrate any existing records from historical JSON storage to Supabase PostgreSQL:

1. **Step 1: Test with Dry-Run** (No database writes):
   ```bash
   node scripts/migrate-leads-to-supabase.cjs --dry-run
   ```
2. **Step 2: Execute Migration**:
   ```bash
   # Provide your Supabase credentials in the terminal session
   $env:SUPABASE_URL="https://your-project.supabase.co"
   $env:SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
   node scripts/migrate-leads-to-supabase.cjs --confirm
   ```

**Idempotency & Safety**:
- Checks `legacy_id` on each record before insertion.
- Safely skips existing leads if run multiple times.
- Preserves original `created_at` timestamp and lead status.
- Source file `data/leads.backup.json` remains untouched as a cold backup.

---

## 7. Admin API Endpoints

All admin endpoints require an authorization header:
- Header: `Authorization: Bearer <ADMIN_KEY>` or `x-admin-key: <ADMIN_KEY>`

### `GET /api/admin/leads`
Query Parameters:
- `page` (number, default: 1)
- `limit` (number, 1–50, default: 25)
- `status` (`all` | `New` | `Contacted` | `Qualified` | `Proposal` | `Won` | `Lost`)
- `search` (text query across name, email, company, description)
- `export` (`csv` | `json`)

Response format:
```json
{
  "success": true,
  "leads": [...],
  "total": 42,
  "page": 1,
  "limit": 25,
  "totalPages": 2
}
```

### `PATCH /api/admin/leads`
Request payload:
```json
{
  "id": "e3e83b4c-982c-47bc-9b37-175549007f15",
  "status": "Contacted"
}
```

Response format:
```json
{
  "success": true,
  "message": "Lead status updated to Contacted",
  "lead": { ... }
}
```

---

## 8. Security Model

1. **Zero Frontend Secret Exposure**:
   - Frontend React/HTML never communicates directly with Supabase via PostgREST.
   - `SUPABASE_SERVICE_ROLE_KEY` is ONLY loaded inside serverless Node.js functions.
2. **Row Level Security (RLS)**:
   - Public role `anon` has zero read/write permissions on the `leads` table.
   - Only the server's `service_role` key can read, insert, and update records.
3. **Spam & Abuse Protection**:
   - Invisible honeypot field (`website_hp_check`).
   - Rate limiting per client IP address.
   - Duplicate prevention within a 10-minute submission window.
4. **Data Sanitization**:
   - HTML stripping on text fields to prevent stored XSS.
   - RFC 5322 regex validation on emails.
   - Normalized lowercase emails.

---

## 9. Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| `503 Service Unavailable` on `/api/leads` | Supabase environment variables missing in Netlify | Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Netlify dashboard. |
| `401 Unauthorized` on Admin API | Incorrect or missing admin authorization header | Verify `ADMIN_KEY` in Netlify environment variables matches login token. |
| `429 Too Many Requests` | Submitting more than 5 requests in 10 minutes | Wait 10 minutes or test from another network IP. |
| Leads marked as duplicate | Same email submitted within 10 minutes | Submissions within 10 minutes return success with `{ duplicate: true }`. Distinct inquiries after 10m create new leads. |

---

## 10. Deployment Checklist

- [x] Supabase `leads` table schema created (`supabase/schema.sql`).
- [x] RLS enabled and verified on Supabase table.
- [x] Environment variables configured on Netlify (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_KEY`).
- [x] Zero references to `data/leads.json` as authoritative store.
- [x] Browser `localStorage` removed as lead database.
- [x] Form submission endpoint (`POST /api/leads`) tested.
- [x] Admin dashboard pagination and status updates verified.
- [x] CSV and JSON export working via server API.
- [x] No secrets tracked in Git repository.
