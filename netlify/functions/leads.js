/**
 * SHAIVIKA IT TECHNOLOGIES — SECURE LEAD SUBMISSION ENDPOINT
 * POST /api/leads -> netlify/functions/leads.js
 *
 * Architecture:
 * Client Form -> POST /api/leads -> Validation -> Honeypot -> Rate Limiting -> Duplicate Prevention -> Supabase PostgreSQL -> Lead ID -> Email Notification
 *
 * Implements:
 * - Method restriction (POST only, 405 Method Not Allowed)
 * - Anti-spam honeypot detection
 * - Client IP rate limiting
 * - Server-side validation & sanitization
 * - Normalization of email (lowercase, trimmed)
 * - Server-controlled metadata (source='website', status='New')
 * - Duplicate prevention (10-minute recent window by normalized email)
 * - Supabase PostgreSQL persistence via Service Role (RLS secured)
 * - Email notification dispatched AFTER successful database insert
 * - Zero database secrets or stack traces exposed
 */

const { isSupabaseConfigured, insertLead, checkDuplicateLead, hashIp } = require('./utils/supabase');
const { sendLeadNotification } = require('./utils/email');

// Simple in-memory sliding window rate limiter
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 5;

function isRateLimited(ip) {
  if (!ip || ip === 'unknown') return false;
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

// Memory cleanup
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
    .replace(/[<>]/g, '') // Strip HTML tags to prevent XSS
    .trim()
    .slice(0, maxLength);
}

function parseLaunchDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  // Valid ISO date YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return trimmed;
  }
  return null;
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8'
  };

  // CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  // Method restriction
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

  // Payload size guard (50 KB max)
  if (event.body && event.body.length > 50 * 1024) {
    return {
      statusCode: 413,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Payload too large.'
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
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Spam validation failed.'
      })
    };
  }

  // 2. Server-side Validation & Sanitization
  const name = sanitizeString(body.name || body.fullName, 100);
  const rawEmail = sanitizeString(body.email, 150);
  const email = rawEmail.toLowerCase(); // Normalized to lowercase
  const company = sanitizeString(body.company, 100);
  const country = sanitizeString(body.country, 100);
  const phone = sanitizeString(body.phone, 40);
  const contactMethod = sanitizeString(body.contactMethod || body.contact_method || 'Email', 50);
  const projectType = sanitizeString(body.projectType || body.project_type, 100);
  const budget = sanitizeString(body.budget, 100);
  const rawLaunchDate = sanitizeString(body.launchDate || body.launch_date, 60);
  const launchDate = parseLaunchDate(rawLaunchDate);
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

  // Validate Email Format
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

  // 3. Duplicate Prevention (Check recent submission within 10 minutes)
  try {
    const existingDuplicate = await checkDuplicateLead(email, 10);
    if (existingDuplicate) {
      console.info(`[Leads API] Duplicate lead submission detected for ${email} (existing: ${existingDuplicate.id}). Returning user-friendly confirmation.`);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Thank you. Your project request has been received.',
          leadId: existingDuplicate.id,
          duplicate: true
        })
      };
    }
  } catch (dupErr) {
    console.warn('[Leads API] Duplicate check check failed non-critically:', dupErr.message);
  }

  // 4. Prepare Record for Supabase PostgreSQL
  // Append raw launch date text to description if not in strict YYYY-MM-DD format
  let finalDescription = description;
  if (rawLaunchDate && !launchDate) {
    finalDescription += `\n[Target Timeline: ${rawLaunchDate}]`;
  }

  const leadRecord = {
    name,
    email,
    company: company || null,
    country,
    phone: phone || null,
    contact_method: contactMethod || 'Email',
    project_type: projectType,
    budget,
    launch_date: launchDate,
    description: finalDescription,
    source: 'website',
    status: 'New',
    priority: 'Normal',
    ip_hash: hashIp(clientIp),
    user_agent: (event.headers['user-agent'] || '').substring(0, 200) || null
  };

  let savedLead;

  // 5. Supabase Insertion
  if (isSupabaseConfigured()) {
    try {
      savedLead = await insertLead(leadRecord);
    } catch (dbErr) {
      console.error('[Leads API] Supabase persistence error:', dbErr.message);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          message: "We couldn't submit your request right now. Please try again."
        })
      };
    }
  } else {
    // When Supabase environment variables are missing (e.g. unconfigured local staging):
    console.warn('[Leads API] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set in environment.');
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Lead service configuration is currently being updated. Please contact shaivikagroups@gmail.com directly.'
      })
    };
  }

  // 6. Professional Email Notification (Dispatched AFTER Database Insertion)
  // If email fails, the lead remains safely in Supabase.
  await sendLeadNotification(savedLead);

  // 7. Return Safe Response (Never exposes internal database information)
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: 'Thank you. Your project request has been received.',
      leadId: savedLead.id
    })
  };
};
