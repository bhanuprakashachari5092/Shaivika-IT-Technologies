/**
 * SHAIVIKA IT TECHNOLOGIES — SUPABASE REST CLIENT
 * Lightweight, zero-dependency PostgreSQL interface via Supabase PostgREST.
 *
 * Uses Node.js native fetch for high performance, zero external dependencies,
 * and zero cold-start delay in Netlify serverless functions.
 */

const crypto = require('crypto');

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL ? process.env.SUPABASE_URL.replace(/\/+$/, '') : null;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || null;
  return { url, serviceKey, isConfigured: Boolean(url && serviceKey) };
}

function getAuthHeaders(serviceKey, extraHeaders = {}) {
  return {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    ...extraHeaders
  };
}

/**
 * Hash IP address with salt for privacy-preserving duplicate tracking
 */
function hashIp(ip) {
  if (!ip || ip === 'unknown') return null;
  const salt = process.env.IP_SALT || 'shaivika_leads_salt_2026';
  return crypto.createHmac('sha256', salt).update(ip).digest('hex').substring(0, 32);
}

/**
 * Check if Supabase credentials are configured in the environment
 */
function isSupabaseConfigured() {
  const { isConfigured } = getSupabaseConfig();
  return isConfigured;
}

/**
 * Insert a lead into Supabase PostgreSQL
 */
async function insertLead(leadRecord) {
  const { url, serviceKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const endpoint = `${url}/rest/v1/leads`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: getAuthHeaders(serviceKey, {
        'Prefer': 'return=representation'
      }),
      body: JSON.stringify(leadRecord),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[Supabase REST] Insert error status:', res.status, errText);
      throw new Error(`DATABASE_INSERT_FAILED: ${res.status}`);
    }

    const data = await res.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : leadRecord;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('DATABASE_TIMEOUT');
    }
    throw err;
  }
}

/**
 * Check for recent duplicate submission from the same email in the given window
 */
async function checkDuplicateLead(normalizedEmail, windowMinutes = 10) {
  const { url, serviceKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return null;

  const sinceTime = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const endpoint = `${url}/rest/v1/leads?email=eq.${encodeURIComponent(normalizedEmail)}&created_at=gte.${encodeURIComponent(sinceTime)}&select=id,email,created_at&limit=1`;

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: getAuthHeaders(serviceKey)
    });
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        return rows[0];
      }
    }
  } catch (err) {
    console.warn('[Supabase REST] Duplicate check warning:', err.message);
  }
  return null;
}

/**
 * Fetch leads with server-side pagination, search, and status filtering
 */
async function getLeads({ page = 1, limit = 25, status = 'all', search = '', exportAll = false }) {
  const { url, serviceKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const queryParams = [
    'select=id,name,email,company,country,phone,contact_method,project_type,budget,launch_date,description,source,status,created_at,updated_at',
    'order=created_at.desc'
  ];

  if (status && status !== 'all') {
    queryParams.push(`status=eq.${encodeURIComponent(status)}`);
  }

  if (search && search.trim()) {
    const q = search.trim();
    // PostgREST full OR condition across multiple columns
    const orFilter = `or=(name.ilike.*${encodeURIComponent(q)}*,email.ilike.*${encodeURIComponent(q)}*,company.ilike.*${encodeURIComponent(q)}*,country.ilike.*${encodeURIComponent(q)}*,project_type.ilike.*${encodeURIComponent(q)}*,description.ilike.*${encodeURIComponent(q)}*)`;
    queryParams.push(orFilter);
  }

  if (!exportAll) {
    const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);
    const offset = (safePage - 1) * safeLimit;
    queryParams.push(`limit=${safeLimit}`);
    queryParams.push(`offset=${offset}`);
  }

  const endpoint = `${url}/rest/v1/leads?${queryParams.join('&')}`;
  const res = await fetch(endpoint, {
    method: 'GET',
    headers: getAuthHeaders(serviceKey, {
      'Prefer': 'count=exact'
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[Supabase REST] Select error:', res.status, errText);
    throw new Error(`DATABASE_SELECT_FAILED: ${res.status}`);
  }

  const leads = await res.json();
  const contentRange = res.headers.get('content-range'); // e.g. "0-24/150" or "*/0"
  let total = Array.isArray(leads) ? leads.length : 0;
  if (contentRange && contentRange.includes('/')) {
    const parsed = parseInt(contentRange.split('/')[1], 10);
    if (!isNaN(parsed)) total = parsed;
  }

  const safeLimit = Number(limit) || 25;
  const safePage = Number(page) || 1;

  return {
    leads: Array.isArray(leads) ? leads : [],
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit) || 1
  };
}

/**
 * Update lead status in Supabase PostgreSQL
 */
async function updateLeadStatus(id, newStatus) {
  const { url, serviceKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const validStatuses = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];
  const formattedStatus = validStatuses.find(s => s.toLowerCase() === (newStatus || '').toLowerCase());
  if (!formattedStatus) {
    throw new Error('INVALID_STATUS');
  }

  const endpoint = `${url}/rest/v1/leads?id=eq.${encodeURIComponent(id)}`;
  const res = await fetch(endpoint, {
    method: 'PATCH',
    headers: getAuthHeaders(serviceKey, {
      'Prefer': 'return=representation'
    }),
    body: JSON.stringify({
      status: formattedStatus,
      updated_at: new Date().toISOString()
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[Supabase REST] Update error:', res.status, errText);
    throw new Error(`DATABASE_UPDATE_FAILED: ${res.status}`);
  }

  const updatedRows = await res.json();
  return Array.isArray(updatedRows) && updatedRows.length > 0 ? updatedRows[0] : null;
}

module.exports = {
  isSupabaseConfigured,
  insertLead,
  checkDuplicateLead,
  getLeads,
  updateLeadStatus,
  hashIp
};
