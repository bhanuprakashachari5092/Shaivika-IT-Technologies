/**
 * SHAIVIKA IT TECHNOLOGIES — HARDENED ADMIN AUTHENTICATION API
 * POST /api/admin/auth (login, refresh, recover, logout)
 * GET /api/admin/auth (verify session)
 *
 * Security:
 * - Supabase GoTrue email & password authentication
 * - Canonical role-based administrator authorization checks (app_metadata.role === 'admin')
 * - Zero ADMIN_KEY bypass allowed
 * - Strict 401 (unauthenticated) and 403 (unauthorized) handling
 * - Zero service-role key exposure to client
 * - Generic password recovery messaging (prevents user enumeration)
 */

const {
  loginWithPassword,
  refreshSessionToken,
  sendPasswordRecovery,
  verifyAdminRequest
} = require('./utils/auth');

exports.handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  // GET: Verify existing session
  if (event.httpMethod === 'GET') {
    const authResult = await verifyAdminRequest(event.headers);
    if (!authResult.authorized) {
      return {
        statusCode: authResult.statusCode || 401,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          message: authResult.statusCode === 403
            ? 'Access denied: Account is not authorized as an administrator.'
            : 'Session invalid or expired. Please sign in.',
          reason: authResult.reason
        })
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        authenticated: true,
        user: authResult.user
      })
    };
  }

  // POST: Login, Refresh, Recover, Logout
  if (event.httpMethod === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, message: 'Invalid JSON request payload.' })
      };
    }

    const action = (body.action || '').toLowerCase().trim();
    const path = (event.path || '').toLowerCase();

    // 1. Password Recovery Action (Prevents user enumeration)
    if (action === 'recover' || path.endsWith('/recover')) {
      if (!body.email) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ success: false, message: 'Administrator email is required.' })
        };
      }
      const recoverResult = await sendPasswordRecovery(body.email);
      return {
        statusCode: recoverResult.statusCode || 200,
        headers: corsHeaders,
        body: JSON.stringify(recoverResult)
      };
    }

    // 2. Token Refresh Action
    if (action === 'refresh' || path.endsWith('/refresh')) {
      if (!body.refreshToken) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ success: false, message: 'Refresh token is required.' })
        };
      }
      const refreshResult = await refreshSessionToken(body.refreshToken);
      return {
        statusCode: refreshResult.statusCode || (refreshResult.success ? 200 : 401),
        headers: corsHeaders,
        body: JSON.stringify(refreshResult)
      };
    }

    // 3. Logout Action
    if (action === 'logout' || path.endsWith('/logout')) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, message: 'Logged out successfully.' })
      };
    }

    // 4. Default: Sign-in / Login Action
    const email = body.email || body.username;
    const password = body.password;

    if (!email || !password) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, message: 'Email and password are required.' })
      };
    }

    try {
      const loginResult = await loginWithPassword(email, password);
      if (!loginResult.success) {
        return {
          statusCode: loginResult.statusCode || 401,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            message: loginResult.error || 'Authentication failed.'
          })
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Authentication successful.',
          token: loginResult.accessToken,
          refreshToken: loginResult.refreshToken,
          expiresIn: loginResult.expiresIn,
          user: loginResult.user
        })
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          message: 'Authentication service temporarily unavailable. Please try again.'
        })
      };
    }
  }

  return {
    statusCode: 405,
    headers: corsHeaders,
    body: JSON.stringify({ success: false, message: 'Method Not Allowed. Supported methods: GET, POST.' })
  };
};
