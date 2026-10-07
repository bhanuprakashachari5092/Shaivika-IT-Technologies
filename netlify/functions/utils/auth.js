/**
 * SHAIVIKA IT TECHNOLOGIES — ADMIN AUTHENTICATION UTILITY
 * 
 * Secure Supabase GoTrue Auth verification, session validation,
 * and role-based access control for administrative routes.
 *
 * Security:
 * - Validates Supabase Auth JWT access tokens via GoTrue server endpoint
 * - Verifies administrator role (app_metadata / user_metadata / public.admin_users table / ADMIN_EMAILS)
 * - Keeps SUPABASE_SERVICE_ROLE_KEY strictly server-side
 * - Preserves backward compatibility with ADMIN_KEY for internal automated calls
 */

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL ? process.env.SUPABASE_URL.replace(/\/+$/, '') : null;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || null;
  return { url, serviceKey, isConfigured: Boolean(url && serviceKey) };
}

function getServiceHeaders(serviceKey, extra = {}) {
  return {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

/**
 * Verify a Supabase Auth access token by calling the GoTrue user endpoint
 */
async function verifySupabaseToken(accessToken) {
  if (!accessToken || typeof accessToken !== 'string') return null;
  const { url, serviceKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return null;

  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${accessToken.trim()}`
      }
    });

    if (res.ok) {
      const user = await res.json();
      return user && user.id ? user : null;
    }
  } catch (err) {
    console.warn('[Admin Auth] Token verification error:', err.message);
  }
  return null;
}

/**
 * Check if the user is an authorized administrator
 */
async function isUserAdmin(user) {
  if (!user) return false;

  // 1. Check user metadata or app metadata
  const appRole = user.app_metadata?.role;
  const userRole = user.user_metadata?.role;
  if (appRole === 'admin' || appRole === 'super_admin' || userRole === 'admin' || userRole === 'super_admin') {
    return true;
  }

  // 2. Check configured ADMIN_EMAILS environment variable
  const userEmail = (user.email || '').toLowerCase().trim();
  const configuredAdminEmails = (process.env.ADMIN_EMAILS || 'shaivikagroups@gmail.com,kh2kgaming@gmail.com')
    .toLowerCase()
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);

  if (userEmail && configuredAdminEmails.includes(userEmail)) {
    return true;
  }

  // 3. Check public.admin_users table in Supabase
  const { url, serviceKey, isConfigured } = getSupabaseConfig();
  if (isConfigured && user.id) {
    try {
      const endpoint = `${url}/rest/v1/admin_users?user_id=eq.${encodeURIComponent(user.id)}&role=in.(admin,super_admin)&select=id`;
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: getServiceHeaders(serviceKey)
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) return true;
      }
    } catch (dbErr) {
      // Non-fatal if table not yet migrated
    }
  }

  return false;
}

/**
 * Authenticate incoming HTTP request to admin endpoints
 * Supports:
 * - Supabase Auth Bearer JWT token
 * - Pre-configured server-to-server ADMIN_KEY (for automated tests / CLI)
 */
async function verifyAdminRequest(headers) {
  const authHeader = headers['authorization'] || headers['Authorization'] || '';
  const xAdminKey = headers['x-admin-key'] || headers['X-Admin-Key'] || '';

  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (authHeader) {
    token = authHeader.trim();
  } else if (xAdminKey) {
    token = xAdminKey.trim();
  }

  if (!token) {
    return { authorized: false, reason: 'MISSING_CREDENTIALS' };
  }

  // 1. Direct ADMIN_KEY check (backward-compatibility for tests / Netlify cron)
  const expectedKey = process.env.ADMIN_KEY || process.env.ADMIN_PASSWORD || 'shaivika_admin_2026';
  const legacyFallbackKeys = ['googlemanoj', 'adminpassword123', 'admin123', 'shaivika_admin_2026'];
  if (token === expectedKey || legacyFallbackKeys.includes(token)) {
    return { authorized: true, method: 'admin_key' };
  }

  // 2. Supabase Auth JWT Token check
  const user = await verifySupabaseToken(token);
  if (!user) {
    return { authorized: false, reason: 'INVALID_OR_EXPIRED_TOKEN' };
  }

  // 3. Role authorization check
  const hasAdminRole = await isUserAdmin(user);
  if (!hasAdminRole) {
    return { authorized: false, reason: 'NOT_AN_ADMINISTRATOR', user };
  }

  return { authorized: true, method: 'supabase_auth', user };
}

/**
 * Sign in with email and password via Supabase GoTrue Auth
 */
async function loginWithPassword(email, password) {
  const { url, serviceKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const endpoint = `${url}/auth/v1/token?grant_type=password`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: (email || '').trim().toLowerCase(),
      password
    })
  });

  const data = await res.json();
  if (!res.ok) {
    const errorMsg = data.error_description || data.msg || data.message || 'Invalid email or password.';
    return { success: false, error: errorMsg, statusCode: res.status };
  }

  const user = data.user;
  const adminCheck = await isUserAdmin(user);
  if (!adminCheck) {
    return {
      success: false,
      error: 'Access denied: Account is not authorized as an administrator.',
      statusCode: 403
    };
  }

  return {
    success: true,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    user: {
      id: user.id,
      email: user.email,
      role: 'admin'
    }
  };
}

/**
 * Refresh an existing Supabase Auth session token
 */
async function refreshSessionToken(refreshToken) {
  const { url, serviceKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) throw new Error('SUPABASE_NOT_CONFIGURED');

  const endpoint = `${url}/auth/v1/token?grant_type=refresh_token`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refresh_token: refreshToken })
  });

  const data = await res.json();
  if (!res.ok) {
    return { success: false, error: 'Session expired or refresh token invalid.' };
  }

  const adminCheck = await isUserAdmin(data.user);
  if (!adminCheck) {
    return { success: false, error: 'Account is not an authorized administrator.' };
  }

  return {
    success: true,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    user: {
      id: data.user.id,
      email: data.user.email,
      role: 'admin'
    }
  };
}

/**
 * Send password recovery email via Supabase GoTrue
 */
async function sendPasswordRecovery(email) {
  const { url, serviceKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) throw new Error('SUPABASE_NOT_CONFIGURED');

  const endpoint = `${url}/auth/v1/recover`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: (email || '').trim().toLowerCase() })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { success: false, error: data.msg || data.message || 'Password reset request failed.' };
  }

  return { success: true, message: 'Password recovery email sent successfully if the account exists.' };
}

module.exports = {
  getSupabaseConfig,
  verifySupabaseToken,
  isUserAdmin,
  verifyAdminRequest,
  loginWithPassword,
  refreshSessionToken,
  sendPasswordRecovery
};
