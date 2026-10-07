/**
 * SHAIVIKA IT TECHNOLOGIES — LEAD EMAIL NOTIFICATION UTILITY
 * 
 * Automates professional HTML email alerts to SHAIVIKA IT TECHNOLOGIES admin
 * whenever a new lead is stored in Supabase PostgreSQL.
 *
 * Implements:
 * - HTML escaping for all user inputs (anti-XSS / anti-injection)
 * - Safe fallback handling when RESEND_API_KEY is not configured
 * - Database-first guarantee: email failures never fail lead persistence
 * - Zero secrets or internal infrastructure tokens in email or logs
 * - Dynamic subject line: "New Project Inquiry — {{company/name}}"
 * - Direct CTA to Admin CRM via ADMIN_DASHBOARD_URL
 */

/**
 * Escapes characters for safe HTML injection
 * @param {string|null|undefined} str 
 * @returns {string}
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generates email subject line:
 * "New Project Inquiry — {{company/name}}"
 * @param {object} lead 
 * @returns {string}
 */
function generateLeadSubject(lead) {
  const company = (lead.company || '').trim();
  const name = (lead.name || '').trim();
  const target = company || name || 'New Client';
  return `New Project Inquiry — ${target}`;
}

/**
 * Formats a clean date string for display
 * @param {string|Date} dateVal 
 * @returns {string}
 */
function formatDisplayDate(dateVal) {
  try {
    const d = dateVal ? new Date(dateVal) : new Date();
    if (isNaN(d.getTime())) return new Date().toUTCString();
    return d.toUTCString();
  } catch {
    return new Date().toUTCString();
  }
}

/**
 * Builds the HTML and plain-text email content for a new lead
 * @param {object} lead - The stored lead record
 * @returns {{ subject: string, html: string, text: string }}
 */
function buildLeadNotificationEmail(lead) {
  const subject = generateLeadSubject(lead);
  const adminUrl = process.env.ADMIN_DASHBOARD_URL || 'https://shaivikaittechnologies.in/admin';

  // Sanitized / Escaped values
  const name = escapeHtml(lead.name || 'Anonymous');
  const company = escapeHtml(lead.company || 'Not Specified');
  const country = escapeHtml(lead.country || 'Not Specified');
  const email = escapeHtml(lead.email || '');
  const phone = escapeHtml(lead.phone || 'Not Provided');
  const contactMethod = escapeHtml(lead.contact_method || 'Email');
  const projectType = escapeHtml(lead.project_type || 'General Inquiry');
  const budget = escapeHtml(lead.budget || 'TBD');
  const launchDate = escapeHtml(lead.launch_date || 'Flexible');
  const description = escapeHtml(lead.description || 'No description provided.');
  const leadId = escapeHtml(lead.id || 'N/A');
  const status = escapeHtml(lead.status || 'New');
  const priority = escapeHtml(lead.priority || 'Normal');
  const createdDate = formatDisplayDate(lead.created_at);

  const phoneLink = lead.phone
    ? `<a href="https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}" style="color:#10B981; font-weight:600; text-decoration:none;">${phone} ↗</a>`
    : `<span style="color:#94A3B8;">Not Provided</span>`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0B0F19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F3F4F6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0B0F19; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 620px; background-color: #111827; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%); padding: 32px 28px; border-bottom: 1px solid rgba(0, 229, 255, 0.2);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <div style="font-size: 0.8rem; font-weight: 800; letter-spacing: 2px; color: #00E5FF; text-transform: uppercase; margin-bottom: 6px;">
                      SHAIVIKA IT TECHNOLOGIES
                    </div>
                    <h1 style="margin: 0; font-size: 1.5rem; font-weight: 700; color: #FFFFFF; line-height: 1.3;">
                      NEW PROJECT INQUIRY
                    </h1>
                    <div style="font-size: 0.85rem; color: #94A3B8; margin-top: 6px;">
                      Direct website submission via contact portal
                    </div>
                  </td>
                  <td align="right" valign="top">
                    <span style="display: inline-block; padding: 6px 12px; background: rgba(0, 229, 255, 0.12); border: 1px solid rgba(0, 229, 255, 0.3); border-radius: 20px; font-size: 0.75rem; font-weight: 700; color: #00E5FF; text-transform: uppercase;">
                      ⚡ ${priority}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 28px;">
              
              <!-- Client Information Section -->
              <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; color: #38BDF8; font-weight: 700;">
                  👤 Client Information
                </h3>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #1F2937; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.06); padding: 12px;">
                  <tr>
                    <td style="padding: 8px 12px; width: 50%; vertical-align: top;">
                      <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; font-weight: 600;">Full Name</div>
                      <div style="font-size: 0.95rem; font-weight: 700; color: #FFFFFF; margin-top: 2px;">${name}</div>
                    </td>
                    <td style="padding: 8px 12px; width: 50%; vertical-align: top;">
                      <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; font-weight: 600;">Company</div>
                      <div style="font-size: 0.92rem; color: #F3F4F6; margin-top: 2px;">${company}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 12px; vertical-align: top; border-top: 1px solid rgba(255, 255, 255, 0.05);">
                      <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; font-weight: 600;">Work Email</div>
                      <div style="font-size: 0.92rem; margin-top: 2px;">
                        <a href="mailto:${email}" style="color: #00E5FF; text-decoration: none; font-weight: 600;">${email}</a>
                      </div>
                    </td>
                    <td style="padding: 8px 12px; vertical-align: top; border-top: 1px solid rgba(255, 255, 255, 0.05);">
                      <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; font-weight: 600;">Phone / WhatsApp</div>
                      <div style="font-size: 0.92rem; margin-top: 2px;">${phoneLink}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 12px; vertical-align: top; border-top: 1px solid rgba(255, 255, 255, 0.05);">
                      <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; font-weight: 600;">Country</div>
                      <div style="font-size: 0.92rem; color: #F3F4F6; margin-top: 2px;">${country}</div>
                    </td>
                    <td style="padding: 8px 12px; vertical-align: top; border-top: 1px solid rgba(255, 255, 255, 0.05);">
                      <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; font-weight: 600;">Preferred Contact</div>
                      <div style="font-size: 0.92rem; color: #F3F4F6; margin-top: 2px;">${contactMethod}</div>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Project Information Section -->
              <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; color: #A855F7; font-weight: 700;">
                  🚀 Project Information
                </h3>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #1F2937; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.06); padding: 12px;">
                  <tr>
                    <td style="padding: 8px 12px; width: 33%; vertical-align: top;">
                      <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; font-weight: 600;">Project Type</div>
                      <div style="font-size: 0.92rem; font-weight: 600; color: #F3F4F6; margin-top: 2px;">${projectType}</div>
                    </td>
                    <td style="padding: 8px 12px; width: 33%; vertical-align: top;">
                      <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; font-weight: 600;">Budget Range</div>
                      <div style="font-size: 0.92rem; font-weight: 700; color: #10B981; margin-top: 2px;">${budget}</div>
                    </td>
                    <td style="padding: 8px 12px; width: 33%; vertical-align: top;">
                      <div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; font-weight: 600;">Launch Timeline</div>
                      <div style="font-size: 0.92rem; color: #F3F4F6; margin-top: 2px;">${launchDate}</div>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Project Description -->
              <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; color: #F59E0B; font-weight: 700;">
                  📝 Project Requirements
                </h3>
                <div style="background: #0F172A; border-left: 4px solid #00E5FF; padding: 16px; border-radius: 8px; color: #E5E7EB; font-size: 0.9rem; line-height: 1.65; white-space: pre-wrap;">${description}</div>
              </div>

              <!-- CRM Snapshot -->
              <div style="background: rgba(15, 23, 42, 0.7); border: 1px dashed rgba(255, 255, 255, 0.15); border-radius: 10px; padding: 14px; margin-bottom: 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="font-size: 0.78rem; color: #94A3B8;">
                      <strong>Status:</strong> <span style="color: #38BDF8;">${status}</span> &nbsp;|&nbsp;
                      <strong>Priority:</strong> <span style="color: #F97316;">${priority}</span> &nbsp;|&nbsp;
                      <strong>Created:</strong> ${createdDate}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top: 6px; font-size: 0.72rem; color: #64748B;">
                      <strong>Lead ID:</strong> <code style="font-family: monospace; color: #94A3B8; background: #1E293B; padding: 2px 6px; border-radius: 4px;">${leadId}</code>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Call To Action -->
              <div style="text-align: center; margin-bottom: 8px;">
                <a href="${adminUrl}" style="background: linear-gradient(135deg, #2563EB 0%, #00E5FF 100%); color: #FFFFFF; font-size: 0.95rem; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 10px; display: inline-block; box-shadow: 0 6px 20px rgba(0, 229, 255, 0.35);">
                  Open Admin CRM &rarr;
                </a>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0B0F19; padding: 20px 28px; border-top: 1px solid rgba(255, 255, 255, 0.08); text-align: center; font-size: 0.75rem; color: #64748B; line-height: 1.5;">
              This is an automated administrative notification dispatched by <strong>SHAIVIKA IT TECHNOLOGIES</strong>.<br>
              &copy; ${new Date().getFullYear()} SHAIVIKA IT TECHNOLOGIES. All rights reserved.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
==================================================
SHAIVIKA IT TECHNOLOGIES — NEW PROJECT INQUIRY
==================================================

Client Information:
• Name: ${lead.name || 'Anonymous'}
• Company: ${lead.company || 'Not Specified'}
• Country: ${lead.country || 'Not Specified'}
• Email: ${lead.email || ''}
• Phone: ${lead.phone || 'Not Provided'}
• Preferred Contact: ${lead.contact_method || 'Email'}

Project Information:
• Project Type: ${lead.project_type || 'General'}
• Budget Range: ${lead.budget || 'TBD'}
• Target Launch: ${lead.launch_date || 'Flexible'}

Project Requirements:
${lead.description || 'No description provided.'}

CRM Information:
• Status: ${lead.status || 'New'}
• Priority: ${lead.priority || 'Normal'}
• Lead ID: ${lead.id || 'N/A'}
• Submitted At: ${createdDate}

Open Admin CRM: ${adminUrl}
==================================================
  `.trim();

  return { subject, html, text };
}

/**
 * Sends the lead notification to the admin via Resend API
 * @param {object} lead - The stored lead record
 * @returns {Promise<{ success: boolean, message?: string, error?: string }>}
 */
async function sendLeadNotification(lead) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.info(`[Leads API] Lead ${lead.id} stored in Supabase. Email notification skipped (RESEND_API_KEY not configured).`);
    return { success: false, message: 'RESEND_API_KEY_NOT_CONFIGURED' };
  }

  const toEmail = process.env.LEAD_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL || 'shaivikagroups@gmail.com';
  const fromEmail = process.env.LEAD_FROM_EMAIL || process.env.EMAIL_FROM || 'SHAIVIKA IT TECHNOLOGIES <onboarding@resend.dev>';

  const { subject, html, text } = buildLeadNotificationEmail(lead);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: toEmail,
        subject,
        html,
        text
      })
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const errMsg = errBody.message || `Resend HTTP error ${res.status}`;
      console.error(`[Leads API] Lead ${lead.id} saved successfully; email notification failed: ${errMsg}`);
      return { success: false, error: errMsg };
    }

    console.info(`[Leads API] Lead notification sent successfully for lead ${lead.id}`);
    return { success: true };
  } catch (err) {
    console.error('[Leads API] Email dispatch failed (Lead stored safely in Supabase):', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  escapeHtml,
  generateLeadSubject,
  buildLeadNotificationEmail,
  sendLeadNotification
};
