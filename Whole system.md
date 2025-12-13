
+=======================================================================================================================+
|                                                                                                                       |
|                                         🚀 LOVEABLE BACKEND - SYSTEM ARCHITECTURE                                     |
|                         Phase 19: Security Hardening + OAuth + JWT + Full Supabase Auth                               |
|                                                                                                                       |
+=======================================================================================================================+
                                                         |
                                                         v
+-----------------------------------------------------------------------------------------------------------------------+
|   💻  CLIENTS / CONSUMERS                                                                                             |
|                                                                                                                       |
|   [ Web App ]        [ Mobile App ]        [ CLI Tool ]        [ Developer / API Consumer ]                           |
+-----------------------------------------------------------------------------------------------------------------------+
                                                         |
                                                         | HTTP / HTTPS / WebSocket (SSE)
                                                         v
+-----------------------------------------------------------------------------------------------------------------------+
|   🛡️  API GATEWAY (Fastify Server - Port 3000)                                                                        |
|-----------------------------------------------------------------------------------------------------------------------|
|   Middleware Layer:                                                                                                   |
|   [ 🔐 JWT Auth ]  [ Rate Limit ]  [ CORS/Helmet ]  [ CSRF ]  [ Logging ]  [ 🔍 STACK CONSTRAINT INJECTOR ]           |
|                                                                                                                       |
|   Secure Auth Routes (/api/v1/auth/*) - Phase 19:                                                                     |
|   +-- POST /validate-password   (🆕 Check password strength before signup)                                            |
|   +-- POST /secure-signup       (🆕 Register with Argon2id + password validation)                                     |
|   +-- POST /secure-login        (🆕 Login with JWT + security event logging)                                          |
|   +-- POST /secure-refresh      (🆕 Refresh JWT with blacklist check)                                                 |
|   +-- POST /secure-logout       (🆕 Logout with token revocation)                                                     |
|   +-- POST /secure-api-key      (🆕 Generate encrypted API key)                                                       |
|   +-- GET  /secure-oauth/:prov  (🆕 OAuth with CSRF state protection)                                                 |
|   +-- POST /change-password     (🆕 Change password with strength validation)                                         |
|   +-- GET  /security-status     (🆕 Security services health check)                                                   |
|   +-- GET  /csrf-token          (🆕 Get CSRF token for state-changing requests)                                       |
|                                                                                                                       |
|   Legacy Auth Routes (Supabase Direct):                                                                               |
|   +-- POST /signup, /login, /logout, /refresh, GET /me, /providers, /oauth/:provider                                  |
|                                                                                                                       |
|   Core Routes:                                                                                                        |
|   +-- /api/v1/orchestrator /*     (Main Brain)                                                                        |
|   +-- /api/v1/codegen /*          (Code Factory)                                                                      |
|   +-- /api/v1/vector /*           (Semantic Search)                                                                   |
|   +-- /api/v1/learning /*         (AI Feedback)                                                                       |
|   +-- /api/v1/deployments /*      (Netlify/GitHub)                                                                    |
|   +-- /api/v1/preview /*          (Live Sandbox)                                                                      |
|   +-- /health                     (Deep Health Check)                                                                 |
+-----------------------------------------------------------------------------------------------------------------------+
                                                         |
                                                         v
+-----------------------------------------------------------------------------------------------------------------------+
|   🔐  SECURITY HARDENING LAYER (Phase 19 - NEW)                                                                       |
|-----------------------------------------------------------------------------------------------------------------------|
|                                                                                                                       |
|   ┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   |
|   │                                    SECURITY SERVICES                                                          │   |
|   │                                                                                                              │   |
|   │   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐                   │   |
|   │   │ Password Service│    │ Encryption Svc  │    │   JWT Service   │    │ OAuth State Svc │                   │   |
|   │   │    Argon2id     │    │   AES-256-GCM   │    │    HS256/RS256  │    │  CSRF for OAuth │                   │   |
|   │   └────────┬────────┘    └────────┬────────┘    └────────┬────────┘    └────────┬────────┘                   │   |
|   │            │                      │                      │                      │                            │   |
|   │   ┌────────▼────────┐    ┌────────▼────────┐    ┌────────▼────────┐    ┌────────▼────────┐                   │   |
|   │   │ • Hash passwords│    │ • Encrypt tokens│    │ • Generate JWT  │    │ • Generate state│                   │   |
|   │   │ • Verify hashes │    │ • Encrypt secrets│   │ • Verify tokens │    │ • Validate CSRF │                   │   |
|   │   │ • Strength check│    │ • Key derivation│    │ • Token blacklist│   │ • Single-use    │                   │   |
|   │   │ • Rehash check  │    │ • Key rotation  │    │ • Refresh tokens │   │ • 10min expiry  │                   │   |
|   │   └─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘                   │   |
|   │                                                                                                              │   |
|   │   ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐  │   |
|   │   │                                    CSRF PLUGIN + AUTH MIDDLEWARE                                      │  │   |
|   │   │                                                                                                      │  │   |
|   │   │   [ CSRF Token Validation ] → [ JWT/API Key Extract ] → [ Role-Based Access ] → [ User Context ]     │  │   |
|   │   │                                                                                                      │  │   |
|   │   └──────────────────────────────────────────────────────────────────────────────────────────────────────┘  │   |
|   │                                                                                                              │   |
|   └──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   |
|                                                         │                                                             |
|                                                         v                                                             |
|   ┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   |
|   │                                    SUPABASE AUTH (JWT Provider)                                               │   |
|   │                                                                                                              │   |
|   │   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐                   │   |
|   │   │  Email/Password │    │  GitHub OAuth   │    │  Google OAuth   │    │  GitLab OAuth   │                   │   |
|   │   │     Signup      │    │    Provider     │    │    Provider     │    │    Provider     │                   │   |
|   │   └────────┬────────┘    └────────┬────────┘    └────────┬────────┘    └────────┬────────┘                   │   |
|   │            │                      │                      │                      │                            │   |
|   │            └──────────────────────┴──────────────────────┴──────────────────────┘                            │   |
|   │                                              │                                                               │   |
|   │                                              v                                                               │   |
|   │                              ┌───────────────────────────────┐                                               │   |
|   │                              │  JWT Token Generation         │                                               │   |
|   │                              │  • access_token (15m expiry)  │                                               │   |
|   │                              │  • refresh_token (7d expiry)  │                                               │   |
|   │                              └───────────────────────────────┘                                               │   |
|   │                                                                                                              │   |
|   └──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   |
|                                                                                                                       |
+-----------------------------------------------------------------------------------------------------------------------+
                                                         |
                                                         v
+-----------------------------------------------------------------------------------------------------------------------+
|   🧠  CORE INTEGRATED ORCHESTRATOR ("The Brain")                                                                      |
|-----------------------------------------------------------------------------------------------------------------------|
|                                                                                                                       |
|   +--------------------------+        +---------------------------+        +---------------------------+              |
|   |  Thinking Engine         |        |  Context Manager          |        |  MCP Hub (Message Bus)    |              |
|   |  (Analysis & Breakdown)  |<------>|  (History & State)        |<------>|  (Agent Communication)    |              |
|   +--------------------------+        +---------------------------+        +---------------------------+              |
|               |                                     |                                   |                             |
|               v                                     v                                   v                             |
|   +-------------------------------------------------------------+          +--------------------------------------+   |
|   |  MULTI-MODEL PIPELINE (Phase 13 Cost/Quality Optimizer)     |          |  TECH STACK ENFORCER (Phase 14)      |   |
|   |  [ Stage 1: DeepSeek V3 (Analysis/Plan) - Low Cost       ]--|--------->|  [ Presets: api, web, mobile...    ] |   |
|   |  [ Stage 2: GLM-4.6 (Code Generation)   - High Quality   ]  |          |  [ Rules: No Express, Use Fastify  ] |   |
|   +-------------------------------------------------------------+          +--------------------------------------+   |
|                                                         |                                                             |
|                                                         v                                                             |
|   +---------------------------------------------------------------------------------------------------------------+   |
|   |  🏭 ENHANCED CODEGEN ENGINE  (Phase 17 Assembly Line)                                                         |   |
|   |  [ Scaffold Gen ] -> [ Database Gen ] -> [ Route Gen ] -> [ Test Gen ] -> [ Code Validator ] -> [ Post-Proc ] |   |
|   +---------------------------------------------------------------------------------------------------------------+   |
|                                                         |                                        |                    |
|                +----------------------------------------+                                        |                    |
|                |                                                                                 |                    |
|                v                                                                                 v                    |
|   +---------------------------------------+                                  +------------------------------------+   |
|   |  📚 VECTOR & LEARNING (Phase 18)      |                                  |  🔴 LIVE PREVIEW SYSTEM (Phase 16) |   |
|   |  [ Code Embedder ] <-> [ Vector DB ]  |                                  |  [ Sandbox Env ] <-> [ HMR Proxy ] |   |
|   |  [ Pattern Learner ] <-> [ Context ]  |                                  |  [ Collaboration ] <-> [ WS Sync ] |   |
|   +---------------------------------------+                                  +------------------------------------+   |
|                                                                                                                       |
+-----------------------------------------------------------------------------------------------------------------------+
           |                                             |                                               |
           | Delegated Tasks                             | Integrations                                  | Data Persistence
           v                                             v                                               v
+------------------------+                    +------------------------+                      +-------------------------+
|  🤖 AGENT ECOSYSTEM    |                    |  🌍 EXTERNAL SERVICES  |                      |  💾 DATA PERSISTENCE    |
|------------------------|                    |------------------------|                      |-------------------------|
|                        |                    |                        |                      |                         |
|  [ CORE - Person 1 ]   |                    |  [ AI PROVIDERS ]      |                      |  [ SUPABASE (PG) ]      |
|  - Auth Agent          |                    |  - Z.AI (GLM-4.6)      |<-------------------->|  - auth.users (Supabase)|
|  - Security Agent      |                    |  - OpenRouter(DeepSeek)|                      |  - users (App Data)     |
|  - Monitoring Agent    |                    |  - Groq (Llama 3)      |                      |  - cost_records         |
|                        |                    |  - OpenAI (Embeddings) |                      |  - agent_benchmarks     |
|  [ DB/TEST - Person 2 ]|                    |                        |                      |  - code_embeddings      |
|  - Database Agent      |                    |  [ OAUTH PROVIDERS ]   |                      |  - learned_patterns     |
|  - Queue Agent         |                    |  - GitHub OAuth        |                      |  - deployment_history   |
|  - Test Agent          |                    |  - Google OAuth        |                      |  - refresh_tokens  🆕   |
|                        |                    |  - GitLab OAuth        |                      |  - api_keys        🆕   |
|  [ API/INFRA - Person 3|                    |                        |                      |  - encrypted_secrets🆕  |
|  - API Agent           |                    |  [ DEPLOYMENT ]        |                      |  - security_events 🆕   |
|  - CI/CD Agent         |                    |  - Netlify API (Sites) |                      |  - user_mfa        🆕   |
|  - Infra Agent         |                    |  - GitHub API (Repos)  |                      |                         |
|                        |                    |                        |                      |  [ REDIS ]              |
|  [ DEVOPS - Person 4 ] |                    |  [ LIVE PREVIEW ]      |                      |  - BullMQ Job Queues    |
|  - CodeGen Agent       |                    |  - esm.sh (Modules)    |                      |  - Preview Sessions     |
|  - Microservices Agent |                    |  - unpkg / cdn         |                      |  - Session Cache        |
|  - Email Agent         |                    |                        |                      |                         |
+------------------------+                    +------------------------+                      +-------------------------+

+=======================================================================================================================+
|   ⚙️  EXECUTION FLOW V4.0 (With Security Hardening)                                                                  |
+=======================================================================================================================+
|                                                                                                                       |
|   0. AUTH:     User authenticates via OAuth OR Email/Password → Receives JWT Tokens (Supabase + Our JWT).            |
|   1. CSRF:     🆕 Client fetches CSRF token → Includes X-CSRF-Token in state-changing requests.                       |
|   2. INGEST:   User Request + [JWT Token] + [CSRF Token] + [Stack Constraints] injected -> Thinking Engine           |
|   3. VERIFY:   🆕 [Auth Middleware] validates JWT + checks blacklist + verifies roles.                                |
|   4. PLAN:     DeepSeek V3 (Stage 1) analyzes complexity & needed agents. Checks [Vector DB] for similar past plans. |
|   5. PREPARE:  [MCP Hub] alerts relevant Agents. [Context Manager] pulls history & [Learned Patterns].               |
|   6. FACTORY:  [Enhanced CodeGen] spins up. [Scaffold] -> [DB Schema] -> [Routes] -> [Tests] generated in parallel.  |
|   7. GENERATE: GLM-4.6 (Stage 2) writes specific logic code. [Code Validator] checks against [Stack Constraints].    |
|   8. REFINE:   If Validator fails, [Learner] records failure, calls Stage 2 again (Retry/Self-Correction).           |
|   9. OUTPUT:   Success -> File System Write -> Supabase Metadata Log -> Cost Calculated.                             |
|  10. LOG:      🆕 [Security Event Logger] records action type, user, IP, success/failure.                             |
|  11. PREVIEW:  [Live Preview System] hot-loads code -> Generates Sandbox URL -> Pushes to Client via SSE.            |
|  12. DEPLOY:   (Async) [Auto-Deploy Manager] -> Commits to [GitHub] -> Triggers [Netlify] Build.                     |
|                                                                                                                       |
+=======================================================================================================================+

+=======================================================================================================================+
|   🔐  SECURITY FLOW DETAIL (Phase 19)                                                                                |
+=======================================================================================================================+
|                                                                                                                       |
|   PASSWORD HASHING FLOW:                                                                                              |
|   ┌──────────┐    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐                               |
|   │  User    │───>│ Password Service │───>│  Argon2id Hash   │───>│  Store in DB     │                               |
|   │ Input    │    │ • Strength check │    │  65MB memory     │    │  (never plain!)  │                               |
|   └──────────┘    │ • Pattern detect │    │  3 iterations    │    └──────────────────┘                               |
|                   └──────────────────┘    └──────────────────┘                                                        |
|                                                                                                                       |
|   ENCRYPTION FLOW (Tokens/Secrets):                                                                                   |
|   ┌──────────┐    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐                               |
|   │ Sensitive│───>│ Encryption Svc   │───>│  AES-256-GCM     │───>│ Base64 + Store   │                               |
|   │  Data    │    │ • Key derivation │    │  + Auth Tag      │    │  in encrypted_   │                               |
|   └──────────┘    │ • Field-level    │    │  + IV per op     │    │  secrets table   │                               |
|                   └──────────────────┘    └──────────────────┘    └──────────────────┘                               |
|                                                                                                                       |
|   JWT + CSRF FLOW:                                                                                                    |
|   ┌──────────┐    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐                               |
|   │  Login   │───>│ JWT Service      │───>│ access_token     │───>│ Client stores    │                               |
|   │ Request  │    │ • Sign HS256     │    │ refresh_token    │    │ Authorization:   │                               |
|   └──────────┘    │ • Add claims     │    │ CSRF token       │    │ Bearer xxx       │                               |
|                   └──────────────────┘    └──────────────────┘    └──────────────────┘                               |
|                                                                                                                       |
|   OAUTH + STATE FLOW:                                                                                                 |
|   ┌──────────┐    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐       |
|   │  Client  │───>│ GET /oauth/github│───>│ OAuth State Svc  │───>│ GitHub Auth Page │───>│ Validate state   │       |
|   └──────────┘    └──────────────────┘    │ • Generate state │    └──────────────────┘    │ → JWT tokens     │       |
|                                           │ • HMAC sign      │                            └──────────────────┘       |
|                                           │ • Store 10min    │                                                        |
|                                           └──────────────────┘                                                        |
|                                                                                                                       |
+=======================================================================================================================+
