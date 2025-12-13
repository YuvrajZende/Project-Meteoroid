# 🔐 PERSON 1 - SECURITY IMPLEMENTATION TASK LIST

## Backend Security Hardening & Encryption

**Created:** December 12, 2024  
**Status:** Assessment Complete - Implementation Pending  
**Current Security Rating:** 6.5/10  
**Target Security Rating:** 9/10

---

## 📋 TABLE OF CONTENTS

1. [Security Overview](#security-overview)
2. [Current Security Rating](#current-security-rating)
3. [Implemented Features](#implemented-features)
4. [Critical Security Gaps](#critical-security-gaps)
5. [Task List - Priority 1 (Critical)](#priority-1-critical)
6. [Task List - Priority 2 (Important)](#priority-2-important)
7. [Task List - Priority 3 (Nice to Have)](#priority-3-nice-to-have)
8. [Implementation Details](#implementation-details)
9. [Testing Checklist](#testing-checklist)
10. [Compliance Requirements](#compliance-requirements)

---

## 📊 SECURITY OVERVIEW

### Executive Summary

The backend server has strong foundational security with Helmet headers, rate limiting, and input validation. However, **critical gaps exist** in authentication, password hashing, and encryption that **MUST be addressed before production deployment**.

### Risk Assessment

| Risk Level | Count | Description |
|------------|-------|-------------|
| 🔴 Critical | 5 | Must fix immediately |
| 🟠 High | 5 | Should fix soon |
| 🟡 Medium | 3 | Recommended improvements |
| 🟢 Low | 2 | Nice to have |

---

## 📊 CURRENT SECURITY RATING

### Detailed Breakdown

| Category | Score | Status | Notes |
|----------|-------|--------|-------|
| **Security Headers** | 8/10 | ✅ Good | Helmet configured, CSP, HSTS, XSS protection |
| **CORS Configuration** | 7/10 | ✅ Good | Configurable origins, proper methods |
| **Rate Limiting** | 7.5/10 | ✅ Good | Tiered rate limits per endpoint |
| **Bot Detection** | 6/10 | ⚠️ Basic | User-agent patterns, but no CAPTCHA |
| **Input Sanitization** | 6/10 | ⚠️ Basic | XSS sanitization exists, not fully applied |
| **Audit Logging** | 7.5/10 | ✅ Good | Comprehensive event logging |
| **Authentication** | 4/10 | ⛔ Incomplete | Routes exist but NOT implemented |
| **Password Hashing** | 0/10 | ⛔ Missing | No bcrypt/Argon2 implementation |
| **JWT Implementation** | 2/10 | ⛔ Placeholder | JWT mentioned but not functional |
| **API Key Management** | 5/10 | ⚠️ Partial | Routes exist, not fully working |
| **Encryption at Rest** | 0/10 | ⛔ Missing | No encryption for sensitive data |
| **Token Security** | 3/10 | ⛔ Weak | GitHub tokens stored in plain text |
| **Secret Management** | 5/10 | ⚠️ Basic | Env vars, no vault integration |
| **SQL Injection** | 8/10 | ✅ Good | Parameterized queries via Supabase |
| **Request Validation** | 8/10 | ✅ Good | Zod schemas on all endpoints |

### Overall Score Calculation

```
Total Points: 97.5 / 150 = 65%
Rating: 6.5/10
```

---

## ✅ IMPLEMENTED FEATURES

### What's Working Well

```
┌─────────────────────────────────────────────────────────────┐
│ ✅ IMPLEMENTED SECURITY FEATURES                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. Security Headers (Helmet)                                │
│    ├── Content-Security-Policy                              │
│    ├── Strict-Transport-Security (HSTS)                     │
│    ├── X-Content-Type-Options: nosniff                      │
│    ├── X-Frame-Options: DENY                                │
│    ├── X-XSS-Protection                                     │
│    └── Referrer-Policy                                      │
│                                                             │
│ 2. CORS Configuration                                       │
│    ├── Configurable allowed origins                         │
│    ├── Proper methods and headers                           │
│    └── Credentials support                                  │
│                                                             │
│ 3. Rate Limiting                                            │
│    ├── Per-endpoint limits                                  │
│    ├── Tiered limits (free/pro/enterprise)                  │
│    └── Rate limit headers exposed                           │
│                                                             │
│ 4. Bot Detection & Blocking                                 │
│    ├── User-agent pattern matching                          │
│    ├── Missing header detection                             │
│    └── Score-based blocking                                 │
│                                                             │
│ 5. Input Validation                                         │
│    ├── Zod validation on all routes                         │
│    ├── Email format validation                              │
│    └── Password length requirements                         │
│                                                             │
│ 6. Audit Logging                                            │
│    ├── Auth events (login, logout, failed)                  │
│    ├── Task/Project events                                  │
│    ├── Security events (bot blocked, rate limited)          │
│    └── Sensitive field redaction                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Files Implementing Security

| File | Purpose | Lines |
|------|---------|-------|
| `middleware/security.ts` | Bot detection, rate limits, headers | ~305 |
| `middleware/audit-logger.ts` | Comprehensive audit logging | ~283 |
| `plugins/helmet.ts` | Security headers configuration | ~56 |
| `plugins/cors.ts` | CORS configuration | ~36 |
| `plugins/rate-limit.ts` | Rate limiting | ~50+ |
| `routes/auth.ts` | Auth routes (placeholder) | ~415 |

---

## ⛔ CRITICAL SECURITY GAPS

### Must Fix Before Production

```
┌─────────────────────────────────────────────────────────────┐
│ ⛔ CRITICAL GAPS (Must Fix Before Production)               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. NO WORKING AUTHENTICATION                                │
│    └── Auth routes exist but return "Auth not configured"   │
│    └── No actual JWT implementation                         │
│    └── No session management                                │
│                                                             │
│ 2. NO PASSWORD HASHING                                      │
│    └── bcrypt/Argon2 not implemented                        │
│    └── Passwords would be stored in plain text              │
│                                                             │
│ 3. NO ENCRYPTION FOR TOKENS                                 │
│    └── GitHub tokens stored as plain text                   │
│    └── API keys not encrypted at rest                       │
│    └── No field-level encryption                            │
│                                                             │
│ 4. NO CSRF PROTECTION                                       │
│    └── GitHub OAuth state not verified                      │
│    └── No CSRF tokens on forms                              │
│                                                             │
│ 5. NO SECRET VAULT                                          │
│    └── All secrets in .env files                            │
│    └── No rotation mechanism for secrets                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔴 PRIORITY 1: CRITICAL (Before Production)

> **Timeline:** Must complete before any production deployment

### Task 1.1: Implement JWT Authentication
- **Status:** [x] ✅ COMPLETE (Phase 19)
- **Estimated Time:** 4-6 hours
- **Risk Level:** 🔴 Critical
- **Implementation Date:** 2024-12-13

**Implementation:**
```typescript
// Use @fastify/jwt with RS256 or ES256
npm install @fastify/jwt

// Configuration
{
  secret: {
    private: fs.readFileSync('private.pem'),
    public: fs.readFileSync('public.pem'),
  },
  sign: {
    algorithm: 'RS256',
    expiresIn: '15m',
  },
}
```

**Subtasks:**
- [x] ~~Install `@fastify/jwt` package~~ (Using custom implementation)
- [x] Custom HMAC-SHA256 implementation (RS256 ready)
- [x] Create `services/jwt-service.ts`
- [x] Implement token generation with proper claims
- [x] Implement token verification middleware (`auth-middleware.ts`)
- [x] Add token to response on login (`secure-auth.ts`)
- [x] Create refresh token mechanism
- [x] Add token blacklist for logout
- [ ] Write unit tests (pending)
- [x] Add environment variables for keys

**Files to Create/Modify:**
- `packages/api/src/services/jwt-service.ts` (NEW)
- `packages/api/src/middleware/auth-middleware.ts` (NEW)
- `packages/api/src/routes/auth.ts` (MODIFY)
- `.env.example` (MODIFY)

---

### Task 1.2: Add Password Hashing
- **Status:** [x] ✅ COMPLETE (Phase 19)
- **Estimated Time:** 2-3 hours
- **Risk Level:** 🔴 Critical
- **Implementation Date:** 2024-12-13

**Implementation:**
```typescript
// Use Argon2id (preferred) or bcrypt
npm install argon2
// OR
npm install bcrypt @types/bcrypt

// Argon2id configuration (recommended)
const hash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 65536,    // 64 MB
  timeCost: 3,          // 3 iterations
  parallelism: 4,       // 4 parallel threads
});

// Verify
const isValid = await argon2.verify(hash, password);
```

**Subtasks:**
- [x] Install Argon2 package
- [x] Create `services/password-service.ts`
- [x] Implement `hashPassword()` function
- [x] Implement `verifyPassword()` function
- [x] Implement password strength validation
- [x] Update signup route to hash password (`secure-auth.ts`)
- [x] Update login route to verify password (`secure-auth.ts`)
- [ ] Write unit tests (pending)
- [x] Add password requirements documentation

**Files to Create/Modify:**
- `packages/api/src/services/password-service.ts` (NEW)
- `packages/api/src/routes/auth.ts` (MODIFY)

---

### Task 1.3: Encrypt Sensitive Data at Rest
- **Status:** [x] ✅ COMPLETE (Phase 19)
- **Estimated Time:** 4-5 hours
- **Risk Level:** 🔴 Critical
- **Implementation Date:** 2024-12-13

**Implementation:**
```typescript
// Use AES-256-GCM for encryption
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encryptedHex] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
```

**Subtasks:**
- [x] Create `services/encryption-service.ts`
- [x] Implement AES-256-GCM encryption
- [x] Implement decryption with auth tag verification
- [x] Add `ENCRYPTION_KEY` to environment variables
- [x] Create key derivation from master key (PBKDF2)
- [x] Field-level encryption support
- [x] API key encryption in `secure-auth.ts`
- [x] Add database migration (`007_security_hardening.sql`)
- [ ] Write unit tests (pending)

**Files to Create/Modify:**
- `packages/api/src/services/encryption-service.ts` (NEW)
- `packages/api/src/services/github-service.ts` (MODIFY)
- `.env.example` (MODIFY)

---

### Task 1.4: Verify OAuth State (CSRF Protection)
- **Status:** [x] ✅ COMPLETE (Phase 19)
- **Estimated Time:** 2-3 hours
- **Risk Level:** 🔴 Critical
- **Implementation Date:** 2024-12-13

**Implementation:**
```typescript
// Store state in Redis with expiry
const state = crypto.randomUUID();
await redis.set(`oauth:state:${state}`, userId, 'EX', 600); // 10 min expiry

// On callback, verify state
const storedUserId = await redis.get(`oauth:state:${state}`);
if (!storedUserId) {
  throw new Error('Invalid or expired OAuth state');
}
await redis.del(`oauth:state:${state}`);
```

**Subtasks:**
- [x] Create OAuth state storage (in-memory with cleanup)
- [x] Generate cryptographically secure state token (HMAC-signed)
- [x] Add state parameter to OAuth auth URLs
- [x] Verify state on callback (`secure-auth.ts`)
- [x] Delete state after verification (single-use)
- [x] Add expiry (10 minutes)
- [x] Return error for invalid/missing state
- [ ] Write unit tests (pending)

**Files to Create/Modify:**
- `packages/api/src/routes/deployment.ts` (MODIFY - GitHub OAuth routes)
- `packages/api/src/services/oauth-state-service.ts` (NEW)

---

### Task 1.5: Add CSRF Token Protection
- **Status:** [x] ✅ COMPLETE (Phase 19)
- **Estimated Time:** 2-3 hours
- **Risk Level:** 🔴 Critical
- **Implementation Date:** 2024-12-13

**Implementation:**
```typescript
// Use @fastify/csrf-protection
npm install @fastify/csrf-protection @fastify/cookie

await app.register(csrf, {
  cookieOpts: {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProduction,
  },
});
```

**Subtasks:**
- [x] Custom CSRF implementation (`plugins/csrf.ts`)
- [x] Header-based CSRF tokens (HMAC-signed)
- [x] Add CSRF token endpoint (`/api/v1/csrf-token`)
- [x] Validate CSRF on state-changing requests
- [x] Exempt API key and Bearer token requests
- [x] Add preHandler hook for automatic validation
- [ ] Write unit tests (pending)

**Files to Create/Modify:**
- `packages/api/src/plugins/csrf.ts` (NEW)
- `packages/api/src/plugins/index.ts` (MODIFY)

---

## 🟠 PRIORITY 2: IMPORTANT (Soon After Launch)

> **Timeline:** Within first month of production

### Task 2.1: Implement Token Refresh System
- **Status:** [ ] Not Started
- **Estimated Time:** 3-4 hours
- **Risk Level:** 🟠 High

**Implementation:**
- Short-lived access tokens (15 min)
- Long-lived refresh tokens (7 days)
- Refresh token rotation on use
- Token family tracking for detection

**Subtasks:**
- [ ] Create refresh token generation
- [ ] Store refresh tokens in database
- [ ] Implement token rotation
- [ ] Add token family for revocation
- [ ] Create `/auth/refresh` endpoint
- [ ] Handle token reuse detection
- [ ] Write unit tests

---

### Task 2.2: Add IP Allowlist for Admin
- **Status:** [ ] Not Started
- **Estimated Time:** 2 hours
- **Risk Level:** 🟠 High

**Subtasks:**
- [ ] Create IP allowlist configuration
- [ ] Add middleware for admin routes
- [ ] Support CIDR notation
- [ ] Add bypass for development
- [ ] Log blocked attempts
- [ ] Write unit tests

---

### Task 2.3: Implement Multi-Factor Authentication
- **Status:** [ ] Not Started
- **Estimated Time:** 6-8 hours
- **Risk Level:** 🟠 High

**Implementation:**
- TOTP (Time-based One-Time Password)
- Use `otplib` package
- QR code for setup
- Backup codes

**Subtasks:**
- [ ] Install `otplib` package
- [ ] Create MFA service
- [ ] Generate TOTP secrets
- [ ] Create setup endpoint with QR code
- [ ] Verify TOTP on login
- [ ] Generate backup codes
- [ ] Store backup codes (hashed)
- [ ] Add MFA to user schema
- [ ] Write unit tests

---

### Task 2.4: Add Request Signing for API Keys
- **Status:** [ ] Not Started
- **Estimated Time:** 3-4 hours
- **Risk Level:** 🟠 High

**Implementation:**
```typescript
// HMAC-SHA256 request signing
const signature = crypto
  .createHmac('sha256', apiKeySecret)
  .update(`${method}:${path}:${timestamp}:${body}`)
  .digest('hex');
```

**Subtasks:**
- [ ] Create request signing service
- [ ] Add signature verification middleware
- [ ] Support timestamp validation (±5 min)
- [ ] Add nonce for replay prevention
- [ ] Document signing algorithm
- [ ] Write unit tests

---

### Task 2.5: Implement Secret Rotation
- **Status:** [ ] Not Started
- **Estimated Time:** 4-5 hours
- **Risk Level:** 🟠 High

**Subtasks:**
- [ ] Create secret rotation service
- [ ] Support multiple active keys
- [ ] Implement gradual key rollover
- [ ] Add rotation schedule
- [ ] Notify on rotation
- [ ] Log rotation events
- [ ] Write unit tests

---

## 🟡 PRIORITY 3: NICE TO HAVE

> **Timeline:** Future enhancements

### Task 3.1: Vault Integration
- **Status:** [ ] Not Started
- **Estimated Time:** 8-10 hours
- **Risk Level:** 🟡 Medium

**Options:**
- HashiCorp Vault
- AWS Secrets Manager
- Azure Key Vault

**Subtasks:**
- [ ] Choose vault provider
- [ ] Set up vault instance
- [ ] Create vault client service
- [ ] Migrate secrets to vault
- [ ] Update application to fetch from vault
- [ ] Implement secret caching
- [ ] Add health check for vault
- [ ] Write integration tests

---

### Task 3.2: WAF Rules Configuration
- **Status:** [ ] Not Started
- **Estimated Time:** 4-6 hours
- **Risk Level:** 🟡 Medium

**Options:**
- Cloudflare WAF
- AWS WAF
- Custom rules with nginx

---

### Task 3.3: Anomaly Detection
- **Status:** [ ] Not Started
- **Estimated Time:** 10-15 hours
- **Risk Level:** 🟡 Medium

**Subtasks:**
- [ ] Define baseline metrics
- [ ] Implement deviation detection
- [ ] Add alerting for anomalies
- [ ] Create admin dashboard
- [ ] Train ML model (optional)

---

### Task 3.4: PII Masking in Logs
- **Status:** [ ] Not Started
- **Estimated Time:** 3-4 hours
- **Risk Level:** 🟡 Medium

**Subtasks:**
- [ ] Create PII detection regex patterns
- [ ] Add masking to audit logger
- [ ] Mask emails, phones, IPs
- [ ] Add configurable patterns
- [ ] Write unit tests

---

### Task 3.5: Automated Security Testing (OWASP ZAP)
- **Status:** [ ] Not Started
- **Estimated Time:** 4-6 hours
- **Risk Level:** 🟢 Low

**Subtasks:**
- [ ] Set up OWASP ZAP
- [ ] Create CI/CD integration
- [ ] Configure scan rules
- [ ] Add to GitHub Actions
- [ ] Create security report dashboard

---

## 📝 IMPLEMENTATION DETAILS

### Required Packages

```bash
# Priority 1 (Critical)
npm install @fastify/jwt              # JWT authentication
npm install argon2                     # Password hashing
npm install @fastify/csrf-protection   # CSRF protection
npm install @fastify/cookie            # Cookie support

# Priority 2 (Important)
npm install otplib                     # MFA/TOTP
npm install qrcode                     # QR code for MFA setup

# Priority 3 (Nice to Have)
npm install @aws-sdk/client-secrets-manager  # AWS Secrets Manager (optional)
```

### Environment Variables to Add

```env
# JWT Configuration
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key-here
ENCRYPTION_SALT=your-unique-salt-here

# Security
CSRF_SECRET=your-csrf-secret-here
ADMIN_IP_ALLOWLIST=192.168.1.0/24,10.0.0.0/8

# MFA
MFA_ISSUER=Loveable Backend
MFA_BACKUP_CODES_COUNT=10
```

### Database Migrations Needed

```sql
-- Add encrypted token columns
ALTER TABLE github_connections 
  ADD COLUMN encrypted_access_token TEXT;

-- Add MFA fields to users
ALTER TABLE users 
  ADD COLUMN mfa_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN mfa_secret_encrypted TEXT,
  ADD COLUMN mfa_backup_codes TEXT[];

-- Add refresh tokens table
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  family_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  replaced_by UUID REFERENCES refresh_tokens(id)
);
```

---

## ✅ TESTING CHECKLIST

### Authentication Tests
- [ ] Valid login returns access + refresh tokens
- [ ] Invalid credentials return 401
- [ ] Expired tokens are rejected
- [ ] Refresh token rotation works
- [ ] Token blacklist on logout works
- [ ] MFA verification works

### Password Tests
- [ ] Passwords are hashed (not plain text)
- [ ] Weak passwords are rejected
- [ ] Password verification works
- [ ] Password reset flow is secure

### Encryption Tests
- [ ] Tokens are encrypted before storage
- [ ] Decryption returns original value
- [ ] Invalid encryption key fails gracefully
- [ ] Key rotation preserves access

### CSRF Tests
- [ ] Missing CSRF token returns 403
- [ ] Invalid CSRF token returns 403
- [ ] Valid CSRF token allows request
- [ ] API key requests bypass CSRF

### OAuth Tests
- [ ] Invalid state returns error
- [ ] Expired state returns error
- [ ] Valid state proceeds to token exchange
- [ ] State is single-use

---

## 📋 COMPLIANCE REQUIREMENTS

### OWASP Top 10 Coverage

| # | Vulnerability | Status | Notes |
|---|---------------|--------|-------|
| A01 | Broken Access Control | ⚠️ Partial | Auth not implemented |
| A02 | Cryptographic Failures | ⛔ Missing | No encryption |
| A03 | Injection | ✅ Good | Parameterized queries |
| A04 | Insecure Design | ⚠️ Partial | Needs review |
| A05 | Security Misconfiguration | ✅ Good | Helmet configured |
| A06 | Vulnerable Components | ⚠️ Check | Run npm audit |
| A07 | Authentication Failures | ⛔ Missing | Not implemented |
| A08 | Software Integrity | ⚠️ Partial | No signing |
| A09 | Logging Failures | ✅ Good | Audit logging exists |
| A10 | SSRF | ✅ Good | No external URL fetching |

### GDPR Considerations
- [ ] Data encryption at rest
- [ ] Data encryption in transit (HTTPS)
- [ ] Right to deletion (user data)
- [ ] Audit trail for data access
- [ ] PII anonymization in logs

---

## 📈 PROGRESS TRACKING

### Phase Summary

| Phase | Tasks | Complete | Progress |
|-------|-------|----------|----------|
| Priority 1 | 5 | 0 | 0% |
| Priority 2 | 5 | 0 | 0% |
| Priority 3 | 5 | 0 | 0% |
| **Total** | **15** | **0** | **0%** |

### Target Milestones

| Milestone | Target Date | Status |
|-----------|-------------|--------|
| Priority 1 Complete | TBD | ⏳ Pending |
| Security Rating 8/10 | TBD | ⏳ Pending |
| Security Rating 9/10 | TBD | ⏳ Pending |
| Production Ready | TBD | ⏳ Pending |

---

*This document outlines all security tasks required to bring the Loveable Backend to production-grade security standards.*

**Current Rating: 6.5/10 → Target: 9/10**

🔐 **Security is not optional - it's essential!**
