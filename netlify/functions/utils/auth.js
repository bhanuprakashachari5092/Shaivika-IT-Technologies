/**
 * SHAIVIKA IT TECHNOLOGIES — HARDENED ADMIN AUTHENTICATION UTILITY
 * 
 * Secure Supabase GoTrue Auth verification, session validation,
 * and canonical role-based access control (RBAC) for administrative routes.
 *
 * Security Hardening:
 * - Pure Supabase GoTrue JWT access token validation via /auth/v1/user
 * - Canonical RBAC: user.app_metadata.role === 'admin' (strictly service-role / server managed)
 * - Zero ADMIN_KEY authentication bypass (ADMIN_KEY is fully deprecated & rejected with 401)
 * - Strict HTTP status codes:
 *     * Missing credentials -> 401
 *     * Invalid / expired token -> 401
 *     * Authenticated non-admin user -> 403
 *     * Authenticated admin user -> 200
 * - Password recovery never leaks user existence
 * - Never logs passwords, tokens, or credentials
 * - Zero SUPABASE_SERVICE_ROLE_KEY exposure to client
 */

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL ? process.env.SUPABASE_URL.replace(/\/+$/, '') : null;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || null;
  return { url, serviceKey, isConfigured: Boolean(url && serviceKey) };
}

/**
 * Verify a Supabase Auth access token by calling the GoTrue user endpoint
 */
async function verifySupabaseToken(accessToken) {
  if (!accessToken || typeof accessToken !== 'string' || accessToken.trim() === '') {
    return null;
  }
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
    // Non-fatal, do not log sensitive data
  }
  return null;
}

/**
 * Canonical Administrator Authorization:
 * Verified strictly via Supabase Auth app_metadata.role === 'admin'.
 * Unlike user_metadata, app_metadata is immutable from client-side APIs
 * and can only be set via the Supabase Admin API or Dashboard.
 */
async function isUserAdmin(user) {
  if (!user || typeof user !== 'object') return false;
  const role = user.app_metadata?.role;
  return role === 'admin' || role === 'super_admin';
}

/**
 * Authenticate incoming HTTP request to admin endpoints
 * Canonical verification:
 * - Extract Bearer token from Authorization header
 * - Reject any ADMIN_KEY attempts with 401
 * - Verify user via Supabase GoTrue
 * - Verify admin role via server-managed app_metadata
 *
 * Returns:
 * - { authorized: false, statusCode: 401, reason: 'MISSING_CREDENTIALS' }
 * - { authorized: false, statusCode: 401, reason: 'INVALID_OR_EXPIRED_TOKEN' }
 * - { authorized: false, statusCode: 403, reason: 'NOT_AN_ADMINISTRATOR', user }
 * - { authorized: true, statusCode: 200, user }
 */
async function verifyAdminRequest(headers) {
  const authHeader = (headers && (headers['authorization'] || headers['Authorization'])) || '';

  let token = '';
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  // Missing Bearer token
  if (!token) {
    return { authorized: false, statusCode: 401, reason: 'MISSING_CREDENTIALS' };
  }

  // Pure Supabase Auth token check — ADMIN_KEY legacy bypass completely removed
  const user = await verifySupabaseToken(token);
  if (!user) {
    return { authorized: false, statusCode: 401, reason: 'INVALID_OR_EXPIRED_TOKEN' };
  }

  // Canonical role check via server-managed app_metadata
  const hasAdminRole = await isUserAdmin(user);
  if (!hasAdminRole) {
    return { authorized: false, statusCode: 403, reason: 'NOT_AN_ADMINISTRATOR', user };
  }

  return { authorized: true, statusCode: 200, user };
}

/**
 * Sign in with email and password via Supabase GoTrue Auth
 */
async function loginWithPassword(email, password) {
  const { url, serviceKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !password) {
    return { success: false, error: 'Email and password are required.', statusCode: 400 };
  }

  const endpoint = `${url}/auth/v1/token?grant_type=password`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: cleanEmail,
      password
    })
  });

  const data = await res.json();
  if (!res.ok) {
    return { success: false, error: 'Invalid email or password.', statusCode: 401 };
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
  if (!refreshToken || typeof refreshToken !== 'string' || refreshToken.trim() === '') {
    return { success: false, error: 'Valid refresh token is required.', statusCode: 400 };
  }

  const { url, serviceKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) throw new Error('SUPABASE_NOT_CONFIGURED');

  try {
    const endpoint = `${url}/auth/v1/token?grant_type=refresh_token`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refresh_token: refreshToken.trim() })
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: 'Session expired or refresh token invalid.', statusCode: 401 };
    }

    const adminCheck = await isUserAdmin(data.user);
    if (!adminCheck) {
      return { success: false, error: 'Account is not an authorized administrator.', statusCode: 403 };
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
  } catch (err) {
    return { success: false, error: 'Failed to refresh authentication session.', statusCode: 500 };
  }
}

/**
 * Send password recovery email via Supabase GoTrue
 * Always returns a generic success message to prevent user enumeration attacks.
 */
async function sendPasswordRecovery(email) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Valid administrator email is required.', statusCode: 400 };
  }

  const { url, serviceKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) throw new Error('SUPABASE_NOT_CONFIGURED');

  try {
    const endpoint = `${url}/auth/v1/recover`;
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: cleanEmail })
    });
  } catch (err) {
    // Non-fatal, do not log emails or sensitive parameters
  }

  // Consistent message regardless of whether the account exists
  return {
    success: true,
    statusCode: 200,
    message: 'If an account exists for this email, password recovery instructions have been sent.'
  };
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
