/**
 * SHAIVIKA IT TECHNOLOGIES — SECURE ADMIN PROPOSALS & QUOTATIONS API
 *
 * Endpoints:
 * GET /api/admin/proposals             — Fetch all proposals (or filter by lead_id, status)
 * GET /api/admin/proposals?id=UUID      — Fetch single proposal with linked lead data
 * GET /api/admin/proposals?id=UUID&format=pdf — Download / stream print-ready commercial PDF
 * POST /api/admin/proposals            — Create new proposal (server-generated number, updates lead status)
 * POST /api/admin/proposals?action=send — Email proposal to client with attached PDF via Gmail SMTP
 * PATCH /api/admin/proposals           — Update proposal fields (pricing, scope, terms, validity)
 *
 * Security:
 * - Admin authorization check (Pure Supabase Auth JWT, role === 'admin')
 * - Zero ADMIN_KEY acceptance
 * - Input validation (lead_id, amount, currency, valid_until, strings)
 * - Safe error handling (never exposes internal tokens, passwords, or stack traces)
 */

const {
  isSupabaseConfigured,
  createProposal,
  getProposals,
  getProposalById,
  updateProposal,
  VALID_CURRENCIES,
  VALID_PROPOSAL_STATUSES
} = require('./utils/supabase');
const { verifyAdminRequest } = require('./utils/auth');
const { generateProposalPdfBuffer } = require('./utils/pdf');
const { sendProposalEmail } = require('./utils/email');

exports.handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8'
  };

  // 1. CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ''
    };
  }

  // 2. Supported HTTP Methods
  if (!['GET', 'POST', 'PATCH'].includes(event.httpMethod)) {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, message: 'Method Not Allowed' })
    };
  }

  // 3. Admin Authorization Check (RBAC: app_metadata.role === 'admin')
  const authResult = await verifyAdminRequest(event.headers);
  if (!authResult.authorized) {
    return {
      statusCode: authResult.statusCode,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        message: authResult.statusCode === 403
          ? 'Access forbidden: Administrator privileges required.'
          : 'Authentication required. Please provide a valid admin token.'
      })
    };
  }

  // 4. Supabase Configuration Check
  if (!isSupabaseConfigured()) {
    return {
      statusCode: 503,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        message: 'Database service is currently unavailable.'
      })
    };
  }

  const queryParams = event.queryStringParameters || {};

  // ==========================================================================
  // GET: Read Proposals or Stream PDF
  // ==========================================================================
  if (event.httpMethod === 'GET') {
    try {
      const { id, lead_id, status, format, base64 } = queryParams;

      // Single Proposal Fetch
      if (id) {
        const proposal = await getProposalById(id);
        if (!proposal) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, message: 'Proposal not found' })
          };
        }

        // Generate & Return PDF
        if (format === 'pdf') {
          const pdfBuffer = await generateProposalPdfBuffer(proposal, proposal.lead);

          if (base64 === 'true') {
            return {
              statusCode: 200,
              headers: corsHeaders,
              body: JSON.stringify({
                success: true,
                filename: `Proposal-${proposal.proposal_number}.pdf`,
                pdfBase64: pdfBuffer.toString('base64')
              })
            };
          }

          return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/pdf',
              'Content-Disposition': `inline; filename="Proposal-${proposal.proposal_number}.pdf"`,
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            },
            isBase64Encoded: true,
            body: pdfBuffer.toString('base64')
          };
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ success: true, proposal })
        };
      }

      // Filtered / List Proposals Fetch
      const proposals = await getProposals({ lead_id, status });
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, proposals, count: proposals.length })
      };
    } catch (err) {
      console.error('[Admin Proposals API] GET error:', err.message);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, message: 'Failed to retrieve proposal data.' })
      };
    }
  }

  // Parse Body for POST / PATCH
  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, message: 'Invalid JSON request payload.' })
      };
    }
  }

  // ==========================================================================
  // POST: Create Proposal or Send via Gmail SMTP
  // ==========================================================================
  if (event.httpMethod === 'POST') {
    const isSendAction = queryParams.action === 'send' || body.action === 'send';

    // A. Send Proposal via Gmail SMTP with PDF Attachment
    if (isSendAction) {
      const proposalId = body.id || body.proposal_id || queryParams.id;
      if (!proposalId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ success: false, message: 'Proposal ID is required to send proposal.' })
        };
      }

      try {
        const proposal = await getProposalById(proposalId);
        if (!proposal) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, message: 'Proposal not found.' })
          };
        }

        const lead = proposal.lead || {};
        if (!lead.email) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, message: 'Client email is missing on lead record.' })
          };
        }

        // Generate Print-Ready PDF
        const pdfBuffer = await generateProposalPdfBuffer(proposal, lead);

        // Send via Gmail SMTP
        const sendResult = await sendProposalEmail(proposal, lead, pdfBuffer);

        if (!sendResult.success) {
          return {
            statusCode: 502,
            headers: corsHeaders,
            body: JSON.stringify({
              success: false,
              message: sendResult.message || 'Failed to dispatch proposal via Gmail SMTP. Proposal remains Draft.',
              error: sendResult.error
            })
          };
        }

        // Advance Proposal Status to 'Sent' and record sent_at
        const updatedProposal = await updateProposal(proposal.id, {
          status: 'Sent',
          sent_at: new Date().toISOString()
        });

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            message: `Proposal ${proposal.proposal_number} sent successfully to ${lead.email}.`,
            proposal: updatedProposal
          })
        };
      } catch (err) {
        console.error('[Admin Proposals API] Send proposal error:', err.message);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: 'An internal error occurred while dispatching the proposal.'
          })
        };
      }
    }

    // B. Create New Proposal
    try {
      if (!body.lead_id) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ success: false, message: 'lead_id is required to create a proposal.' })
        };
      }
      if (!body.title || typeof body.title !== 'string' || body.title.trim().length < 3) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ success: false, message: 'Proposal title must be at least 3 characters.' })
        };
      }

      const amountNum = Number(body.amount);
      if (isNaN(amountNum) || amountNum < 0) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ success: false, message: 'Total price amount must be a positive number.' })
        };
      }

      const currency = (body.currency || 'INR').toUpperCase();
      if (!VALID_CURRENCIES.includes(currency)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: `Currency must be one of: ${VALID_CURRENCIES.join(', ')}`
          })
        };
      }

      const newProposal = await createProposal(body);
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Proposal created successfully.',
          proposal: newProposal
        })
      };
    } catch (err) {
      console.error('[Admin Proposals API] Create proposal error:', err.message);
      const isValidation = err.message.startsWith('VALIDATION_ERROR:');
      return {
        statusCode: isValidation ? 400 : 500,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          message: isValidation ? err.message.replace('VALIDATION_ERROR: ', '') : 'Failed to create proposal.'
        })
      };
    }
  }

  // ==========================================================================
  // PATCH: Update Proposal
  // ==========================================================================
  if (event.httpMethod === 'PATCH') {
    const proposalId = body.id || queryParams.id;
    if (!proposalId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, message: 'Proposal ID is required for update.' })
      };
    }

    try {
      if (body.amount !== undefined) {
        const amt = Number(body.amount);
        if (isNaN(amt) || amt < 0) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, message: 'Amount must be a non-negative number.' })
          };
        }
      }

      if (body.currency !== undefined) {
        const cur = String(body.currency).toUpperCase();
        if (!VALID_CURRENCIES.includes(cur)) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, message: `Invalid currency: ${cur}` })
          };
        }
      }

      if (body.status !== undefined) {
        if (!VALID_PROPOSAL_STATUSES.includes(body.status)) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, message: `Invalid status: ${body.status}` })
          };
        }
      }

      const updated = await updateProposal(proposalId, body);
      if (!updated) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ success: false, message: 'Proposal not found.' })
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Proposal updated successfully.',
          proposal: updated
        })
      };
    } catch (err) {
      console.error('[Admin Proposals API] Update proposal error:', err.message);
      const isValidation = err.message.startsWith('VALIDATION_ERROR:');
      return {
        statusCode: isValidation ? 400 : 500,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          message: isValidation ? err.message.replace('VALIDATION_ERROR: ', '') : 'Failed to update proposal.'
        })
      };
    }
  }

  return {
    statusCode: 405,
    headers: corsHeaders,
    body: JSON.stringify({ success: false, message: 'Method Not Allowed' })
  };
};
