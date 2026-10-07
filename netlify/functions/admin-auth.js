/**
 * SHAIVIKA IT TECHNOLOGIES — ADMIN AUTHENTICATION API
 * POST /api/admin/auth (login, refresh, recover, logout)
 * GET /api/admin/auth (verify session)
 *
 * Implements:
 * - Supabase GoTrue email & password authentication
 * - Role-based administrator authorization checks
 * - Token verification & session refreshing
 * - Self-service password recovery dispatch
 * - Zero service-role key exposure to client
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key',
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
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          message: 'Session invalid or expired. Please sign in.',
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
        user: authResult.user || { role: 'admin' },
        method: authResult.method
      })
    };
  }

  // POST: Login, Refresh, Recover
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

    // 1. Password Recovery Action
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
        statusCode: recoverResult.success ? 200 : 400,
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
        statusCode: refreshResult.success ? 200 : 401,
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
      console.error('[Admin Auth API] Login error:', err.message);
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
