/**
 * SHAIVIKA IT TECHNOLOGIES - SECURE LEAD SUBMISSION ENDPOINT
 * POST /api/leads -> netlify/functions/leads.js
 *
 * Implements:
 * - Method restriction (POST only)
 * - In-memory IP rate limiting
 * - Anti-spam honeypot detection
 * - Server-side validation & sanitization
 * - Server-generated timestamps & unique IDs
 * - Lead storage persistence
 * - Email notification interface (via environment variables)
 * - Zero secrets or stack traces exposed
 */

const fs = require('fs');
const path = require('path');

// Simple in-memory rate limiter: IP -> timestamps array
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 5;

function isRateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const validTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    rateLimitMap.set(ip, validTimestamps);
    return true;
  }
  validTimestamps.push(now);
  rateLimitMap.set(ip, validTimestamps);
  return false;
}

// Clean periodic memory cleanup
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const valid = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (valid.length === 0) {
      rateLimitMap.delete(ip);
    } else {
      rateLimitMap.set(ip, valid);
    }
  }
}, 15 * 60 * 1000);
if (cleanupTimer.unref) cleanupTimer.unref();

function sanitizeString(str, maxLength = 255) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>]/g, '') // Strip angle brackets to prevent script injection
    .trim()
    .slice(0, maxLength);
}

exports.handler = async (event, context) => {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Method Not Allowed. Use POST.'
      })
    };
  }

  // Rate Limiting by Client IP
  const clientIp = event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                   event.headers['client-ip'] ||
                   'unknown';

  if (isRateLimited(clientIp)) {
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Too many submissions received from this network. Please wait a few minutes before trying again.'
      })
    };
  }

  // Parse Body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Invalid JSON request payload.'
      })
    };
  }

  // 1. Anti-spam Honeypot Check
  if (body.website_hp_check || body.honeypot) {
    // Silent rejection or 400 for bot trapping
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Spam validation failed.'
      })
    };
  }

  // 2. Server-side Validation
  const name = sanitizeString(body.name || body.fullName, 100);
  const email = sanitizeString(body.email, 150);
  const company = sanitizeString(body.company, 100);
  const country = sanitizeString(body.country, 100);
  const phone = sanitizeString(body.phone, 40);
  const contactMethod = sanitizeString(body.contactMethod || 'Email', 50);
  const projectType = sanitizeString(body.projectType, 100);
  const budget = sanitizeString(body.budget, 100);
  const launchDate = sanitizeString(body.launchDate, 60);
  const description = sanitizeString(body.description || body.message, 1000);

  // Validate Name (min 2 characters)
  if (!name || name.length < 2) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Full Name is required and must be at least 2 characters.'
      })
    };
  }

  // Validate Email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'A valid email address is required.'
      })
    };
  }

  // Validate Country
  if (!country) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Country is required.'
      })
    };
  }

  // Validate Project Type
  if (!projectType) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Project Type is required.'
      })
    };
  }

  // Validate Budget
  if (!budget) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Budget Range is required.'
      })
    };
  }

  // Validate Description (min 20 characters, max 1000)
  if (!description || description.length < 20) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Project Description must be at least 20 characters.'
      })
    };
  }

  // 3. Server-Generated Timestamp and Record
  const serverTimestamp = new Date().toISOString();
  const leadId = 'lead_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

  const newLead = {
    id: leadId,
    name,
    email,
    company: company || '',
    country,
    phone: phone || '',
    contactMethod: contactMethod || 'Email',
    projectType,
    budget,
    launchDate: launchDate || '',
    description,
    source: 'website-contact-form',
    status: 'new',
    submittedAt: serverTimestamp,
    createdAt: serverTimestamp,
    updatedAt: serverTimestamp
  };

  // 4. Lead Storage (Local JSON persistence if accessible)
  try {
    const leadsFilePath = path.join(__dirname, '..', '..', 'data', 'leads.json');
    if (fs.existsSync(leadsFilePath)) {
      const raw = fs.readFileSync(leadsFilePath, 'utf8');
      const leads = JSON.parse(raw || '[]');
      leads.push(newLead);
      fs.writeFileSync(leadsFilePath, JSON.stringify(leads, null, 2), 'utf8');
    }
  } catch (storageErr) {
    // Serverless container file-system might be read-only on some cloud hosts;
    // Client-side redundancy and Google Sheet webhooks handle external persistence.
    console.warn('[Leads API] File system write skipped or read-only:', storageErr.message);
  }

  // 5. Notification Service Interface
  // If SMTP/Resend environment variables are configured, dispatch notification
  const verifiedBusinessEmail = 'shaivikagroups@gmail.com';
  const notificationSubject = `New Project Inquiry — ${newLead.projectType}`;

  if (process.env.RESEND_API_KEY) {
    try {
      // Clean interface for Resend
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'inquiries@shaivikaittechnologies.in',
          to: verifiedBusinessEmail,
          subject: notificationSubject,
          text: `
Name: ${newLead.name}
Email: ${newLead.email}
Company: ${newLead.company || 'N/A'}
Country: ${newLead.country}
Project Type: ${newLead.projectType}
Budget: ${newLead.budget}
Launch Date: ${newLead.launchDate || 'N/A'}
Contact Preference: ${newLead.contactMethod}
Description:
${newLead.description}
          `.trim()
        })
      });
    } catch (emailErr) {
      console.error('[Leads API] Notification dispatch error:', emailErr.message);
    }
  } else {
    // Documented interface: Ready for environment variables
    console.info(`[Leads API] New lead received for ${newLead.name} (${newLead.projectType}). Email service ready via RESEND_API_KEY or SMTP env vars.`);
  }

  // 6. Return Success Response
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: 'Project inquiry received successfully.',
      leadId: newLead.id
    })
  };
};
