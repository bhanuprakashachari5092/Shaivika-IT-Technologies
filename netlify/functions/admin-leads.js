/**
 * SHAIVIKA IT TECHNOLOGIES — SECURE ADMIN LEADS & CRM API
 * GET /api/admin/leads  — Paginated leads with search, status, priority, and follow-up filters
 * GET /api/admin/leads?export=csv|json — Export leads (with CRM fields)
 * PATCH /api/admin/leads — Update lead CRM fields (status, priority, notes, follow-up, last contacted)
 *
 * Security:
 * - Admin authorization check (Pure Supabase Auth JWT)
 * - Service-role key stays strictly server-side
 * - Strict 401 (unauthenticated) and 403 (unauthorized non-admin) enforcement
 * - Zero ADMIN_KEY / x-admin-key acceptance
 */

const {
  isSupabaseConfigured,
  getLeads,
  getCrmMetrics,
  updateLeadCrm,
  VALID_STATUSES,
  VALID_PRIORITIES
} = require('./utils/supabase');
const { verifyAdminRequest } = require('./utils/auth');

/**
 * Sanitize lead record for admin display & export (strip internal security fields like ip_hash)
 */
function sanitizeLeadForExport(lead) {
  return {
    id: lead.id,
    created_at: lead.created_at,
    name: lead.name,
    email: lead.email,
    company: lead.company || '',
    country: lead.country || '',
    phone: lead.phone || '',
    contact_method: lead.contact_method || 'Email',
    project_type: lead.project_type || '',
    budget: lead.budget || '',
    launch_date: lead.launch_date || '',
    status: lead.status || 'New',
    priority: lead.priority || 'Normal',
    internal_notes: lead.internal_notes || '',
    next_follow_up: lead.next_follow_up || '',
    last_contacted_at: lead.last_contacted_at || '',
    description: lead.description || '',
    source: lead.source || 'website'
  };
}

/**
 * Convert leads array to CSV format
 */
function convertLeadsToCsv(leads) {
  const headers = [
    'ID', 'Date', 'Name', 'Email', 'Company', 'Country', 'Phone',
    'Contact Method', 'Project Type', 'Budget', 'Launch Date', 'Status',
    'Priority', 'Next Follow-up', 'Last Contacted', 'Internal Notes', 'Description'
  ];
  const rows = leads.map(l => [
    l.id || '',
    l.created_at || '',
    `"${(l.name || '').replace(/"/g, '""')}"`,
    `"${(l.email || '').replace(/"/g, '""')}"`,
    `"${(l.company || '').replace(/"/g, '""')}"`,
    `"${(l.country || '').replace(/"/g, '""')}"`,
    `"${(l.phone || '').replace(/"/g, '""')}"`,
    `"${(l.contact_method || '').replace(/"/g, '""')}"`,
    `"${(l.project_type || '').replace(/"/g, '""')}"`,
    `"${(l.budget || '').replace(/"/g, '""')}"`,
    `"${(l.launch_date || '').replace(/"/g, '""')}"`,
    `"${(l.status || 'New').replace(/"/g, '""')}"`,
    `"${(l.priority || 'Normal').replace(/"/g, '""')}"`,
    `"${(l.next_follow_up || '').replace(/"/g, '""')}"`,
    `"${(l.last_contacted_at || '').replace(/"/g, '""')}"`,
    `"${(l.internal_notes || '').replace(/"/g, '""')}"`,
    `"${(l.description || '').replace(/"/g, '""')}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

exports.handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8'
  };

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ''
    };
  }

  // Method check
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'PATCH') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        message: 'Method Not Allowed. Supported methods: GET, PATCH.'
      })
    };
  }

  // Security Check: Authenticate Admin (Pure Supabase Auth JWT)
  const authResult = await verifyAdminRequest(event.headers);
  if (!authResult.authorized) {
    return {
      statusCode: authResult.statusCode || 401,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        message: authResult.statusCode === 403
          ? 'Forbidden: Account is not authorized as an administrator.'
          : 'Unauthorized. Valid administrator credentials required.',
        reason: authResult.reason
      })
    };
  }

  // Supabase Configuration Check
  if (!isSupabaseConfigured()) {
    return {
      statusCode: 503,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        message: 'Supabase database is not configured. Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
      })
    };
  }

  const query = event.queryStringParameters || {};

  // GET: Fetch Leads, Export, or CRM Summary
  if (event.httpMethod === 'GET') {
    try {
      const exportType = (query.export || '').toLowerCase();
      const status = query.status || 'all';
      const priority = query.priority || 'all';
      const followUp = query.followUp || query.follow_up || 'all';
      const search = query.search || '';
      const page = parseInt(query.page, 10) || 1;
      const limit = Math.min(Math.max(parseInt(query.limit, 10) || 25, 1), 50);

      // Handle Exports
      if (exportType === 'csv' || exportType === 'json') {
        const result = await getLeads({ exportAll: true, status, priority, followUp, search });
        const safeLeads = (result.leads || []).map(sanitizeLeadForExport);

        if (exportType === 'csv') {
          const csvContent = convertLeadsToCsv(safeLeads);
          return {
            statusCode: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': `attachment; filename="shaivika_leads_${new Date().toISOString().slice(0, 10)}.csv"`
            },
            body: csvContent
          };
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            total: safeLeads.length,
            leads: safeLeads
          })
        };
      }

      // Handle Paginated Leads List + Dynamic CRM Metrics
      const [leadsResult, summary] = await Promise.all([
        getLeads({ page, limit, status, priority, followUp, search, exportAll: false }),
        getCrmMetrics()
      ]);

      const safeLeads = (leadsResult.leads || []).map(sanitizeLeadForExport);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          leads: safeLeads,
          total: leadsResult.total,
          page: leadsResult.page,
          limit: leadsResult.limit,
          totalPages: leadsResult.totalPages,
          summary: summary || {
            total: leadsResult.total,
            new: 0,
            contacted: 0,
            qualified: 0,
            proposal: 0,
            won: 0,
            lost: 0,
            dueToday: 0,
            overdue: 0,
            upcoming: 0
          }
        })
      };
    } catch (err) {
      console.error('[Admin Leads API] Error fetching leads:', err.message);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          message: 'Failed to retrieve leads from database.'
        })
      };
    }
  }

  // PATCH: Update Lead CRM Fields
  if (event.httpMethod === 'PATCH') {
    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch (err) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          message: 'Invalid JSON request payload.'
        })
      };
    }

    // Extract ID from path e.g. /api/admin/leads/123 or query or body
    let leadId = body.id || query.id;
    if (!leadId && event.path) {
      const parts = event.path.split('/');
      const last = parts[parts.length - 1];
      if (last && last !== 'leads' && last !== 'admin-leads') {
        leadId = last;
      }
    }

    if (!leadId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          message: 'Lead ID is required.'
        })
      };
    }

    // Validate safe fields only
    const updates = {};

    // 1. Status validation
    if (body.status !== undefined) {
      const s = String(body.status).trim();
      const matchedStatus = VALID_STATUSES.find(v => v.toLowerCase() === s.toLowerCase());
      if (!matchedStatus) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: `Invalid status. Allowed values: ${VALID_STATUSES.join(', ')}`
          })
        };
      }
      updates.status = matchedStatus;
    }

    // 2. Priority validation
    if (body.priority !== undefined) {
      const p = String(body.priority).trim();
      const matchedPriority = VALID_PRIORITIES.find(v => v.toLowerCase() === p.toLowerCase());
      if (!matchedPriority) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: `Invalid priority. Allowed values: ${VALID_PRIORITIES.join(', ')}`
          })
        };
      }
      updates.priority = matchedPriority;
    }

    // 3. Internal notes validation
    if (body.internal_notes !== undefined || body.internalNotes !== undefined) {
      const rawNotes = body.internal_notes !== undefined ? body.internal_notes : body.internalNotes;
      if (typeof rawNotes !== 'string' && rawNotes !== null) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ success: false, message: 'Internal notes must be a string or null.' })
        };
      }
      const notes = rawNotes ? String(rawNotes).trim() : '';
      if (notes.length > 5000) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ success: false, message: 'Internal notes cannot exceed 5000 characters.' })
        };
      }
      updates.internal_notes = notes;
    }

    // 4. Next follow-up validation
    if (body.next_follow_up !== undefined || body.nextFollowUp !== undefined) {
      const rawFollowUp = body.next_follow_up !== undefined ? body.next_follow_up : body.nextFollowUp;
      if (rawFollowUp === null || rawFollowUp === '') {
        updates.next_follow_up = null;
      } else {
        const dateStr = String(rawFollowUp).trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, message: 'Next follow-up date must be in YYYY-MM-DD format.' })
          };
        }
        updates.next_follow_up = dateStr;
      }
    }

    // 5. Last contacted update
    if (body.last_contacted_at !== undefined || body.lastContactedAt !== undefined) {
      const rawContacted = body.last_contacted_at !== undefined ? body.last_contacted_at : body.lastContactedAt;
      updates.last_contacted_at = rawContacted;
    }

    // Reject attempts to modify protected immutable fields
    if (body.email !== undefined || body.created_at !== undefined || body.source !== undefined) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          message: 'Modification of core client lead identity fields (email, created_at, source) is disallowed.'
        })
      };
    }

    if (Object.keys(updates).length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          message: 'No valid CRM fields provided for update.'
        })
      };
    }

    try {
      const updated = await updateLeadCrm(leadId, updates);
      if (!updated) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'Lead not found or update failed.'
          })
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Lead CRM details updated successfully.',
          lead: sanitizeLeadForExport(updated)
        })
      };
    } catch (err) {
      console.error('[Admin Leads API] Error updating CRM fields:', err.message);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          message: 'Failed to update lead CRM details in database.'
        })
      };
    }
  }
};
