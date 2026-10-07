# SHAIVIKA IT TECHNOLOGIES — SECURE ADMIN AUTHENTICATION ARCHITECTURE

Enterprise administrator authentication and role-based access control for `shaivikaittechnologies.in` using Supabase Auth (GoTrue), serverless Netlify Functions, and hardened session management.

---

## 1. System Architecture

```
Browser (/admin)
    ├── Unauthenticated Visitor -> Shows Clean Admin Login Form
    │   ├── Email & Password Input
    │   ├── "Forgot password?" Self-service Recovery
    │   └── Zero UI flash of protected Lead Dashboard
    │
    └── Authentication Flow
            ↓
    POST /api/admin/auth (netlify/functions/admin-auth.js)
            ├── Validates request payload
            ├── Authenticates via Supabase GoTrue Auth
            ├── Verifies Administrator Role (metadata / public.admin_users / ADMIN_EMAILS)
            └── Returns: { token: JWT, refreshToken, expiresIn, user }
            ↓
    Client Session Established
            ├── Tokens saved in sessionStorage + localStorage
            ├── Automatic session restore on page reload
            ├── Refresh token rotation when access token expires
            └── Seamless Logout (revokes token & clears storage)
            ↓
    Protected Dashboard Opens (/admin)
            ↓
    API Requests: GET / PATCH /api/admin/leads (netlify/functions/admin-leads.js)
            ├── Authorization: Bearer <JWT>
            ├── Netlify Function verifies token with Supabase GoTrue
            ├── Netlify Function verifies administrator authorization
            └── Queries Supabase PostgreSQL (via server-side service-role key)
```

---

## 2. Security Guarantees

| Security Requirement | Implementation |
|---|---|
| **Zero Service-Role Key Exposure** | `SUPABASE_SERVICE_ROLE_KEY` is strictly server-side in Netlify Functions. Never bundled in frontend HTML/JS. |
| **Password Storage** | Passwords are never stored locally or encrypted manually. Delegated exclusively to Supabase Auth's bcrypt/Argon2. |
| **Role-Based Authorization** | Authentication alone is not enough. Accounts must have `role: admin` or be in `public.admin_users` to access dashboard/leads. |
| **Direct Navigation Protection** | Opening `/admin` directly without valid credentials never renders the dashboard or fetches leads. |
| **Session Expiration** | Expired tokens trigger silent refresh; if refresh fails, user is returned to the login screen with an alert. |
| **Legacy Compatibility** | Internal server calls & automated migration test suites continue to support `ADMIN_KEY` header for backward-compatibility. |

---

## 3. How to Create an Administrator Account in Supabase

Production administrators must be created via the official Supabase Dashboard to ensure full owner control:

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

### Step 3: Assign Admin Role

You can assign admin permissions using either of the following standard methods:

#### Method A: User Metadata (Recommended - Easiest)
1. In **Authentication** -> **Users**, click on the newly created user.
2. In the **User Metadata** (JSON) editor, add:
   ```json
   {
     "role": "admin"
   }
   ```
3. Click **Save**.

#### Method B: `public.admin_users` Table (Database Driven)
1. Go to **SQL Editor** in Supabase Dashboard.
2. Run the following query using the user's UUID from the Users tab:
   ```sql
   INSERT INTO public.admin_users (user_id, email, role)
   VALUES ('<USER-UUID-HERE>', 'shaivikagroups@gmail.com', 'admin')
   ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
   ```

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

---

### `GET /api/admin/auth`
Validates currently active session token.

**Request:**
```http
GET /api/admin/auth
Authorization: Bearer <TOKEN>
```
**Response (200 OK):**
```json
{
  "success": true,
  "authenticated": true,
  "user": { ... },
  "method": "supabase_auth"
}
```

---

### `GET /api/admin/leads` (Protected)
Retrieves paginated leads list. Requires admin authorization.

**Request:**
```http
GET /api/admin/leads?page=1&limit=25&status=all
Authorization: Bearer <TOKEN>
```

**Response (401 Unauthorized if token missing or invalid):**
```json
{
  "success": false,
  "message": "Unauthorized. Valid administrator credentials required.",
  "reason": "MISSING_CREDENTIALS"
}
```

---

## 5. Environment Variables Configuration

In Netlify Dashboard under **Site Settings -> Environment variables**:

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase Project REST URL (`https://<project-ref>.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Secret Key (Server-side only) |
| `ADMIN_EMAILS` | Comma-separated authorized admin emails (`shaivikagroups@gmail.com,...`) |
| `ADMIN_KEY` | Server-to-server key for backward compatibility & automated cron scripts |

---

## 6. Verification Test Suite

Run the automated test suite locally to verify full security compliance:

```bash
# 1. Verify all 20 public lead pipeline integration tests
node scratch/test_leads_suite.cjs

# 2. Verify admin authentication, session checks, and Supabase JWT authorization
node -e "require('./netlify/functions/admin-auth')"
```
