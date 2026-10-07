/**
 * SHAIVIKA IT TECHNOLOGIES — SUPABASE REST CLIENT & CRM ENGINE
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

  const payload = {
    ...leadRecord,
    priority: leadRecord.priority || 'Normal'
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: getAuthHeaders(serviceKey, {
        'Prefer': 'return=representation'
      }),
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[Supabase REST] Insert error status:', res.status, errText);
      throw new Error(`DATABASE_INSERT_FAILED: ${res.status}`);
    }

    const data = await res.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : payload;
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
 * Fetch leads with server-side pagination, search, status, priority, and follow-up filtering
 */
async function getLeads({
  page = 1,
  limit = 25,
  status = 'all',
  priority = 'all',
  followUp = 'all',
  search = '',
  exportAll = false
}) {
  const { url, serviceKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const queryParams = [
    'select=id,name,email,company,country,phone,contact_method,project_type,budget,launch_date,description,source,status,priority,internal_notes,next_follow_up,last_contacted_at,created_at,updated_at',
    'order=created_at.desc'
  ];

  // Status Filter
  if (status && status !== 'all') {
    queryParams.push(`status=eq.${encodeURIComponent(status)}`);
  }

  // Priority Filter
  if (priority && priority !== 'all') {
    queryParams.push(`priority=eq.${encodeURIComponent(priority)}`);
  }

  // Follow-up Filter
  const today = new Date().toISOString().slice(0, 10);
  if (followUp === 'today') {
    queryParams.push(`next_follow_up=eq.${today}`);
  } else if (followUp === 'overdue') {
    queryParams.push(`next_follow_up=lt.${today}&status=not.in.(Won,Lost)`);
  } else if (followUp === 'upcoming') {
    queryParams.push(`next_follow_up=gt.${today}&status=not.in.(Won,Lost)`);
  }

  // Multi-column text search
  if (search && search.trim()) {
    const q = search.trim();
    const orFilter = `or=(name.ilike.*${encodeURIComponent(q)}*,email.ilike.*${encodeURIComponent(q)}*,company.ilike.*${encodeURIComponent(q)}*,country.ilike.*${encodeURIComponent(q)}*,project_type.ilike.*${encodeURIComponent(q)}*,description.ilike.*${encodeURIComponent(q)}*,internal_notes.ilike.*${encodeURIComponent(q)}*)`;
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
  const contentRange = res.headers.get('content-range');
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
 * Fetch dynamic CRM pipeline metrics and follow-up counts
 */
async function getCrmMetrics() {
  const { url, serviceKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    return {
      total: 0,
      new: 0,
      contacted: 0,
      qualified: 0,
      proposal: 0,
      won: 0,
      lost: 0,
      dueToday: 0,
      overdue: 0,
      upcoming: 0
    };
  }

  const endpoint = `${url}/rest/v1/leads?select=id,status,priority,next_follow_up`;
  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: getAuthHeaders(serviceKey)
    });
    if (!res.ok) return null;

    const rows = await res.json();
    if (!Array.isArray(rows)) return null;

    const today = new Date().toISOString().slice(0, 10);

    const metrics = {
      total: rows.length,
      new: 0,
      contacted: 0,
      qualified: 0,
      proposal: 0,
      won: 0,
      lost: 0,
      dueToday: 0,
      overdue: 0,
      upcoming: 0,
      stages: {
        New: 0,
        Contacted: 0,
        Qualified: 0,
        Proposal: 0,
        Won: 0,
        Lost: 0
      },
      priorities: {
        Low: 0,
        Normal: 0,
        High: 0,
        Urgent: 0
      },
      followUps: {
        dueToday: 0,
        overdue: 0,
        upcoming: 0,
        totalScheduled: 0
      }
    };

    rows.forEach(r => {
      const s = (r.status || 'New').toLowerCase();
      if (s === 'new') { metrics.new++; metrics.stages.New++; }
      else if (s === 'contacted') { metrics.contacted++; metrics.stages.Contacted++; }
      else if (s === 'qualified') { metrics.qualified++; metrics.stages.Qualified++; }
      else if (s === 'proposal') { metrics.proposal++; metrics.stages.Proposal++; }
      else if (s === 'won') { metrics.won++; metrics.stages.Won++; }
      else if (s === 'lost') { metrics.lost++; metrics.stages.Lost++; }

      const p = r.priority || 'Normal';
      if (metrics.priorities[p] !== undefined) {
        metrics.priorities[p]++;
      }

      if (r.next_follow_up) {
        metrics.followUps.totalScheduled++;
        if (s !== 'won' && s !== 'lost') {
          if (r.next_follow_up === today) {
            metrics.dueToday++;
            metrics.followUps.dueToday++;
          } else if (r.next_follow_up < today) {
            metrics.overdue++;
            metrics.followUps.overdue++;
          } else if (r.next_follow_up > today) {
            metrics.upcoming++;
            metrics.followUps.upcoming++;
          }
        }
      }
    });

    return metrics;
  } catch (err) {
    console.warn('[Supabase REST] Metrics calculation warning:', err.message);
    return null;
  }
}

const VALID_STATUSES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];
const VALID_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];

/**
 * Update CRM fields on a lead in Supabase PostgreSQL
 */
async function updateLeadCrm(id, updates = {}) {
  const { url, serviceKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const payload = {
    updated_at: new Date().toISOString()
  };

  // Status validation
  if (updates.status !== undefined) {
    const matched = VALID_STATUSES.find(s => s.toLowerCase() === String(updates.status).trim().toLowerCase());
    if (!matched) throw new Error('INVALID_STATUS');
    payload.status = matched;

    // Auto-update last_contacted_at when transitioning to Contacted/Qualified/Proposal/Won/Lost
    if (['Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'].includes(matched) && !updates.last_contacted_at) {
      payload.last_contacted_at = new Date().toISOString();
    }
  }

  // Priority validation
  if (updates.priority !== undefined) {
    const matched = VALID_PRIORITIES.find(p => p.toLowerCase() === String(updates.priority).trim().toLowerCase());
    if (!matched) throw new Error('INVALID_PRIORITY');
    payload.priority = matched;
  }

  // Internal Notes validation
  if (updates.internal_notes !== undefined) {
    if (typeof updates.internal_notes !== 'string' && updates.internal_notes !== null) {
      throw new Error('INVALID_INTERNAL_NOTES');
    }
    const cleanNotes = updates.internal_notes ? String(updates.internal_notes).trim() : '';
    if (cleanNotes.length > 5000) {
      throw new Error('NOTES_TOO_LONG');
    }
    payload.internal_notes = cleanNotes;
  }

  // Next Follow-up validation (YYYY-MM-DD or null)
  if (updates.next_follow_up !== undefined) {
    if (updates.next_follow_up === null || updates.next_follow_up === '') {
      payload.next_follow_up = null;
    } else {
      const dateStr = String(updates.next_follow_up).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        throw new Error('INVALID_FOLLOW_UP_DATE');
      }
      payload.next_follow_up = dateStr;
    }
  }

  // Explicit last_contacted_at update
  if (updates.last_contacted_at !== undefined) {
    if (updates.last_contacted_at === true || updates.last_contacted_at === 'now') {
      payload.last_contacted_at = new Date().toISOString();
    } else if (updates.last_contacted_at === null || updates.last_contacted_at === '') {
      payload.last_contacted_at = null;
    } else {
      payload.last_contacted_at = new Date(updates.last_contacted_at).toISOString();
    }
  }

  const endpoint = `${url}/rest/v1/leads?id=eq.${encodeURIComponent(id)}`;
  const res = await fetch(endpoint, {
    method: 'PATCH',
    headers: getAuthHeaders(serviceKey, {
      'Prefer': 'return=representation'
    }),
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[Supabase REST] Update error:', res.status, errText);
    throw new Error(`DATABASE_UPDATE_FAILED: ${res.status}`);
  }

  const updatedRows = await res.json();
  return Array.isArray(updatedRows) && updatedRows.length > 0 ? updatedRows[0] : null;
}

/**
 * Backward compatibility wrapper for updating lead status
 */
async function updateLeadStatus(id, newStatus) {
  return updateLeadCrm(id, { status: newStatus });
}

module.exports = {
  isSupabaseConfigured,
  insertLead,
  checkDuplicateLead,
  getLeads,
  getCrmMetrics,
  updateLeadCrm,
  updateLeadStatus,
  hashIp,
  VALID_STATUSES,
  VALID_PRIORITIES
};
