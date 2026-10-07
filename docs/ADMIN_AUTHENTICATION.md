# SHAIVIKA IT TECHNOLOGIES — HARDENED ADMIN AUTHENTICATION ARCHITECTURE

Enterprise administrator authentication and canonical role-based access control (RBAC) for `shaivikaittechnologies.in` using Supabase Auth (GoTrue), serverless Netlify Functions, and hardened session management.

---

## 1. System Architecture

```
Browser (/admin)
    ├── Unauthenticated Visitor -> Shows Clean Admin Login Form
    │   ├── Email & Password Input
    │   ├── "Forgot password?" Generic Recovery (No User Enumeration)
    │   └── Zero UI flash of protected Lead Dashboard
    │
    └── Authentication Flow
            ↓
    POST /api/admin/auth (netlify/functions/admin-auth.js)
            ├── Validates credentials via Supabase GoTrue Auth
            ├── Canonical RBAC: Verifies user.app_metadata.role === 'admin'
            └── Returns: { token: JWT, refreshToken, expiresIn, user }
            ↓
    Client Session Established
            ├── Unified single storage key: localStorage.shaivika_admin_session
            ├── No duplicate storage across multiple storage APIs
            ├── Automatic session restore on page reload
            ├── Refresh token rotation when access token expires
            └── Seamless Logout (clears tokens and session)
            ↓
    Protected Dashboard Opens (/admin)
            ↓
    API Requests: GET / PATCH /api/admin/leads (netlify/functions/admin-leads.js)
            ├── Authorization: Bearer <JWT>
            ├── Netlify Function verifies token with Supabase GoTrue
            ├── Netlify Function enforces canonical administrator authorization
            └── Queries Supabase PostgreSQL (via server-side service-role key)
```

---

## 2. Security Hardening Guarantees

| Security Requirement | Implementation |
|---|---|
| **Zero Service-Role Key Exposure** | `SUPABASE_SERVICE_ROLE_KEY` is strictly server-side in Netlify Functions. Never bundled in frontend HTML/JS. |
| **Password Storage** | Passwords are never stored locally or encrypted manually. Delegated exclusively to Supabase Auth's bcrypt/Argon2. |
| **Canonical Role Authorization** | Canonical RBAC enforced via `app_metadata.role === 'admin'`. Client-editable `user_metadata` is untrusted. |
| **ADMIN_KEY Legacy Removal** | `ADMIN_KEY` bypass is completely removed and rejected with `401 Unauthorized`. |
| **Token Storage** | Unified single storage under `localStorage.shaivika_admin_session`. Zero duplication. |
| **Generic Password Recovery** | Prevents user enumeration by returning a generic response regardless of whether an email exists. |
| **Direct Navigation Protection** | Opening `/admin` directly without valid credentials never renders the dashboard or fetches leads. |
| **Session Expiration** | Expired tokens trigger silent refresh; if refresh fails, user is returned to the login screen with an alert. |
| **Zero Secrets in Frontend** | No service-role key, no legacy passwords, and no hardcoded tokens exist in client files or `dist/`. |

---

## 3. How to Create an Administrator Account in Supabase

Production administrators must be created via the official Supabase Dashboard:

### Step 1: Open Supabase Project
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Select your project: **`SHAIVIKA IT TECHNOLOGIES`**.

### Step 2: Create the User
1. In the left navigation, click **Authentication** -> **Users**.
2. Click **Add User** -> **Create User**.
3. Enter:
   - **User Email**: `shaivikagroups@gmail.com` (or company owner's email)
   - **User Password**: Choose a strong password (minimum 12 characters)
   - Check **Auto Confirm User?** -> **Yes** (to enable immediate sign-in).
4. Click **Create User**.

### Step 3: Assign Canonical Admin Role
1. In **Authentication** -> **Users**, click on the newly created user.
2. In the **App Metadata** editor (or via Supabase SQL Admin), set:
   ```json
   {
     "role": "admin"
   }
   ```
   *Note: `app_metadata` is strictly server-controlled and cannot be altered by client users.*

---

## 4. API Reference

### `POST /api/admin/auth`
Authentication operations: login, refresh, recover, and logout.

#### Action: `login`
**Request:**
```json
POST /api/admin/auth
Content-Type: application/json

{
  "action": "login",
  "email": "shaivikagroups@gmail.com",
  "password": "YourStrongPassword!"
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "message": "Authentication successful.",
  "token": "eyJhbGciOi...",
  "refreshToken": "...",
  "expiresIn": 3600,
  "user": {
    "id": "uuid",
    "email": "shaivikagroups@gmail.com",
    "role": "admin"
  }
}
```

#### Action: `refresh`
**Request:**
```json
POST /api/admin/auth
Content-Type: application/json

{
  "action": "refresh",
  "refreshToken": "..."
}
```

#### Action: `recover` (Forgot Password)
**Request:**
```json
POST /api/admin/auth
Content-Type: application/json

{
  "action": "recover",
  "email": "shaivikagroups@gmail.com"
}
```
**Response (200 OK - Always generic):**
```json
{
  "success": true,
  "message": "If an account exists for this email, password recovery instructions have been sent."
}
```

---

### `GET /api/admin/auth`
Validates currently active session token.

**Request:**
```http
GET /api/admin/auth
Authorization: Bearer <TOKEN>
```
**Status Codes:**
- `401 Unauthorized`: Token missing, invalid, expired, or legacy ADMIN_KEY attempt
- `403 Forbidden`: Authenticated user does not possess `admin` role in `app_metadata`
- `200 OK`: Valid administrator session

---

### `GET /api/admin/leads` (Protected)
Retrieves paginated leads list. Requires admin authorization.

**Request:**
```http
GET /api/admin/leads?page=1&limit=25&status=all
Authorization: Bearer <TOKEN>
```

**Status Codes:**
- `401 Unauthorized`: Missing or invalid Bearer token
- `403 Forbidden`: Non-admin user account
- `200 OK`: Paginated leads list or CSV/JSON export

---

## 5. Environment Variables Configuration

In Netlify Dashboard under **Site Settings -> Environment variables**:

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase Project REST URL (`https://<project-ref>.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Secret Key (Server-side only) |
| `ADMIN_KEY` | *(Deprecated)* No longer used for runtime authentication bypass |

---

## 6. Verification Test Suites

Run both automated test suites locally:

```bash
# 1. 20-Point Public Lead Pipeline Integration Tests
node scratch/test_leads_suite.cjs

# 2. 14-Point Hardened Security Audit Test Suite
node scratch/test_admin_security_hardened.cjs
```
