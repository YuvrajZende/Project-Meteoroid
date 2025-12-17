
+=======================================================================================================================+
|                                                                                                                       |
|                                         🚀 LOVEABLE BACKEND - SYSTEM ARCHITECTURE                                     |
|       Phase 22: AI Intent Analysis + Vector Learning System (Fast AI Embeddings - No OpenAI Required!)               |
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
|   [ 🔐 Supabase Auth ]  [ Rate Limit ]  [ CORS/Helmet ]  [ IP Block ]  [ Logging ]  [ 🔍 CONSTRAINT INJECTOR ]       |
|                                                                                                                       |
|   Auth Routes (/api/v1/auth/*) - Supabase Powered:                                                                    |
|   +-- POST /signup             (Supabase Bcrypt hashing)                                                              |
|   +-- POST /login              (Supabase JWT generation)                                                              |
|   +-- POST /logout             (Supabase session invalidation)                                                        |
|   +-- POST /refresh            (Supabase token rotation)                                                              |
|   +-- GET  /me                 (Get current user)                                                                     |
|   +-- GET  /oauth/:provider    (Supabase PKCE OAuth - GitHub, Google, GitLab)                                         |
|                                                                                                                       |
|   MFA Routes (/api/v1/auth/mfa/*) - Optional Premium Feature:                                                         |
|   +-- POST /mfa/setup          (TOTP with QR code + backup codes)                                                     |
|   +-- POST /mfa/verify         (Verify TOTP or backup code)                                                           |
|   +-- GET  /mfa/status         (Check MFA status)                                                                     |
|                                                                                                                       |
|   Core Routes:                                                                                                        |
|   +-- /api/v1/orchestrator /*     (Main Brain)                                                                        |
|   +-- /api/v1/codegen /*          (Code Factory)                                                                      |
|   +-- /api/v1/vector /*           (Semantic Search)                                                                   |
|   +-- /api/v1/learning /*         (AI Feedback)                                                                       |
|   +-- /api/v1/deployments /*      (Netlify/GitHub)                                                                    |
|   +-- /api/v1/preview /*          (Live Sandbox)                                                                      |
|   +-- /api/v1/connections /*      (🆕 Service Connection Management)                                                  |
|   +-- /api/v1/services /*         (🆕 Service Registry & Discovery)                                                   |
|   +-- /health                     (Deep Health Check)                                                                 |
+-----------------------------------------------------------------------------------------------------------------------+
                                                         |
                                                         v
+-----------------------------------------------------------------------------------------------------------------------+
|   🔐  SIMPLIFIED SECURITY (Supabase-First - Phase 19 Revised)                                                         |
|-----------------------------------------------------------------------------------------------------------------------|
|                                                                                                                       |
|   ┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   |
|   │                          SUPABASE HANDLES (No Custom Code Needed)                                            │   |
|   │                                                                                                              │   |
|   │   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐                   │   |
|   │   │  Password Hash  │    │  JWT Generation │    │  OAuth PKCE     │    │  DB Encryption  │                   │   |
|   │   │    (Bcrypt)     │    │   (auto rotate) │    │  (CSRF protect) │    │   (AES-256)     │                   │   |
|   │   └─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘                   │   |
|   │                                                                                                              │   |
|   └──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   |
|                                                         │                                                             |
|   ┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   |
|   │                          WHAT WE KEEP (Essential Protection)                                                 │   |
|   │                                                                                                              │   |
|   │   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐                   │   |
|   │   │  Rate Limiting  │    │   IP Blocking   │    │ Security Events │    │  MFA (Optional) │                   │   |
|   │   │ @fastify/limit  │    │  Auto-ban IPs   │    │   Audit Trail   │    │  TOTP + Backup  │                   │   |
|   │   └─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘                   │   |
|   │                                                                                                              │   |
|   └──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   |
|                                                         │                                                             |
|   ❌ REMOVED (Over-Engineered): Password Service, JWT Service, Encryption Service, OAuth State,                      |
|      Request Signing, Secret Rotation, Vault Service → All handled by Supabase!                                      |
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
|  - Infra Agent         |                    |  - GitHub API (Repos)  |                      |  - ip_blocklist    🆕   |
|                        |                    |                        |                      |                         |
|  [ DEVOPS - Person 4 ] |                    |  [ LIVE PREVIEW ]      |                      |  🆕 [ SERVICE SYSTEM ]  |
|  - CodeGen Agent       |                    |  - esm.sh (Modules)    |                      |  - user_service_        |
|  - Microservices Agent |                    |  - unpkg / cdn         |                      |    connections     🆕   |
|  - Email Agent         |                    |                        |                      |  - service_usage_  🆕   |
|                        |                    |  🆕 [ SERVICE INTEG.]   |                     |   logs                  |
|                        |                    |  - Service Registry    |                      |                         |
|                        |                    |  - 100+ Services:      |                      |  [ REDIS ]              |
|                        |                    |    • Supabase/MongoDB  |                      |  - BullMQ Job Queues    |
|                        |                    |    • Auth0/Clerk       |                      |  - Preview Sessions     |
|                        |                    |    • Sentry/Grafana    |                      |  - Session Cache        |
|                        |                    |    • GitHub/GitLab CI  |                      |  - IP Block Cache  🆕   |
|                        |                    |    • Docker/K8s        |                      |  - Connection Cache🆕   |
+------------------------+                    +------------------------+                      +-------------------------+

+=======================================================================================================================+
|   ⚙️  EXECUTION FLOW V5.0 (With Service Integration + Security)                                                      |
+=======================================================================================================================+
|                                                                                                                       |
|   0. AUTH:     User authenticates via OAuth OR Email/Password → Receives JWT Tokens (Supabase + Our JWT).            |
|   1. SERVICES: 🆕 [Service Registry] loads user's connected services → Injects env vars + code templates.            |
|   2. CSRF:     Client fetches CSRF token → Includes X-CSRF-Token in state-changing requests.                         |
|   3. INGEST:   User Request + [JWT Token] + [CSRF Token] + [Stack Constraints] + [Services] -> Thinking Engine      |
|   4. VERIFY:   [Auth Middleware] validates JWT + checks blacklist + verifies roles.                                  |
|   5. PLAN:     DeepSeek V3 (Stage 1) analyzes complexity & needed agents. Checks [Vector DB] for similar past plans. |
|   6. PREPARE:  [MCP Hub] alerts relevant Agents. [Context Manager] pulls history & [Learned Patterns] & [Services].   |
|   7. FACTORY:  [Enhanced CodeGen] spins up. [Scaffold] -> [DB Schema] -> [Routes] -> [Tests] generated in parallel.  |
|   8. GENERATE: 🆕 GLM-4.6 (Stage 2) writes code using [Service Templates]. Refs user's DB/Auth/etc services.         |
|   9. REFINE:   If Validator fails, [Learner] records failure, calls Stage 2 again (Retry/Self-Correction).           |
|  10. OUTPUT:   Success -> File System Write -> Supabase Metadata Log -> Cost Calculated.                             |
|  11. LOG:      [Security Event Logger] records action type, user, IP, success/failure.                                |
|  12. TRACK:    🆕 [Service Usage Logger] records which services were used in generation.                              |
|  13. PREVIEW:  [Live Preview System] hot-loads code -> Generates Sandbox URL -> Pushes to Client via SSE.            |
|  14. DEPLOY:   (Async) [Auto-Deploy Manager] -> Commits to [GitHub] -> Triggers [Netlify] Build.                     |
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
|   🆕 API KEY VALIDATION FLOW:                                                                                         |
|   ┌──────────┐    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐                               |
|   │  Client  │───>│ x-api-key header │───>│ SHA-256 Hash Key │───>│ Query api_keys   │                               |
|   │  Request │    │ "lvb_xxx..."     │    │ Compare to DB    │    │ Check active,    │                               |
|   └──────────┘    └──────────────────┘    └──────────────────┘    │ expiry, scopes   │                               |
|                                                                   └────────┬─────────┘                               |
|                                                                            │                                          |
|                                                                            v                                          |
|                                                                   ┌──────────────────┐                               |
|                                                                   │ Update last_used │                               |
|                                                                   │ Grant access     │                               |
|                                                                   └──────────────────┘                               |
|                                                                                                                       |
|   🆕 IP BLOCKING FLOW:                                                                                                |
|   ┌──────────┐    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐                               |
|   │ Incoming │───>│ Check ip_blocklist│───>│   If Blocked:   │───>│  403 Forbidden   │                               |
|   │ Request  │    │ (cached + DB)    │    │   Return 403    │    │  "IP blocked"    │                               |
|   └──────────┘    └────────┬─────────┘    └──────────────────┘    └──────────────────┘                               |
|                            │                                                                                          |
|                            │ Not Blocked                                                                              |
|                            v                                                                                          |
|   ┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐   |
|   │                              ON FAILED LOGIN (10 attempts in 15 min)                                          │   |
|   │   [Login Attempt] ──> [Failed] ──> [Log to security_events] ──> [Check count] ──> [Auto-block 1 hour]         │   |
|   └──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   |
|                                                                                                                       |
+=======================================================================================================================+

+=======================================================================================================================+
|   🔌  SERVICE INTEGRATION FRAMEWORK (Phase 21)                                                                       |
+=======================================================================================================================+
|                                                                                                                       |
|   OVERVIEW: Enable AI agents to utilize 100+ third-party services with user-configured credentials.                  |
|                                                                                                                       |
|   ┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────┐  |
|   │                                     USER CONNECTION FLOW                                                      │  |
|   │                                                                                                               │  |
|   │   1. User visits Connection Dashboard                                                                        │  |
|   │   2. Browses Service Registry (15 categories, 100+ services)                                                 │  |
|   │   3. Selects service (e.g., Supabase, Auth0, Sentry)                                                         │  |
|   │   4. Enters credentials (API keys, connection strings)                                                       │  |
|   │   5. System encrypts credentials using Supabase Vault                                                        │  |
|   │   6. Tests connection via service adapter                                                                    │  |
|   │   7. Saves to user_service_connections table                                                                 │  |
|   │                                                                                                               │  |
|   └───────────────────────────────────────────────────────────────────────────────────────────────────────────────┘  |
|                                                                                                                       |
|   ┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────┐  |
|   │                                 AI AGENT CODE GENERATION FLOW                                                 │  |
|   │                                                                                                               │  |
|   │   1. User requests: "Create API with Supabase database"                                                      │  |
|   │   2. Context Manager loads user's Supabase connection                                                        │  |
|   │   3. Service Registry provides:                                                                              │  |
|   │      - Service instructions (how to use @supabase/supabase-js)                                               │  |
|   │      - Code templates (query, insert, update patterns)                                                       │  |
|   │      - Credential references (env var names)                                                                 │  |
|   │   4. AI generates code using templates:                                                                      │  |
|   │      ```typescript                                                                                           │  |
|   │      import { createClient } from '@supabase/supabase-js';                                                   │  |
|   │      const supabase = createClient(                                                                          │  |
|   │        process.env.SUPABASE_URL,                                                                             │  |
|   │        process.env.SUPABASE_ANON_KEY                                                                         │  |
|   │      );                                                                                                      │  |
|   │      const { data } = await supabase.from('users').select('*');                                             │  |
|   │      ```                                                                                                     │  |
|   │   5. Service Usage Logger tracks Supabase usage                                                              │  |
|   │                                                                                                               │  |
|   └───────────────────────────────────────────────────────────────────────────────────────────────────────────────┘  |
|                                                                                                                       |
|   SERVICE CATEGORIES (15):                                                                                            |
|                                                                                                                       |
|   📊 DATABASE (8 services)                                                                                            |
|   ├─ Supabase, MongoDB Atlas, PlanetScale, Neon, Firebase Firestore                                                  |
|   └─ Redis Cloud, Upstash, Prisma                                                                                    |
|                                                                                                                       |
|   🔐 AUTHENTICATION (7 services)                                                                                      |
|   ├─ Auth0, Clerk, Firebase Auth, Supabase Auth                                                                      |
|   └─ WorkOS, Magic, Descope                                                                                          |
|                                                                                                                       |
|   📈 MONITORING (8 services)                                                                                          |
|   ├─ Sentry, Datadog, Grafana Cloud, New Relic                                                                       |
|   └─ LogRocket, Honeycomb, Better Stack, Axiom                                                                       |
|                                                                                                                       |
|   🚀 CI/CD & DEPLOYMENT (10 services)                                                                                 |
|   ├─ GitHub Actions, GitLab CI/CD, CircleCI, Jenkins, Travis CI                                                      |
|   └─ Vercel, Netlify, Railway, Render, Fly.io                                                                        |
|                                                                                                                       |
|   🐳 CONTAINERS & ORCHESTRATION (7 services)                                                                          |
|   ├─ Docker, Kubernetes, Docker Hub, GKE, EKS, AKS                                                                   |
|   └─ Portainer                                                                                                        |
|                                                                                                                       |
|   🌐 API MANAGEMENT (6 services)                                                                                      |
|   └─ Kong, Nginx, Traefik, AWS API Gateway, Postman, RapidAPI                                                        |
|                                                                                                                       |
|   📦 STORAGE & CDN (7 services)                                                                                       |
|   └─ AWS S3, Cloudflare R2, Backblaze B2, UploadThing, Cloudinary, ImageKit, Vercel Blob                            |
|                                                                                                                       |
|   📨 MESSAGING & QUEUES (7 services)                                                                                  |
|   └─ RabbitMQ, Apache Kafka, AWS SQS, Redis Pub/Sub, Upstash Kafka, BullMQ, Inngest                                 |
|                                                                                                                       |
|   ✉️  EMAIL & COMMUNICATION (7 services)                                                                             |
|   └─ SendGrid, Resend, Postmark, AWS SES, Mailgun, Twilio, Vonage                                                   |
|                                                                                                                       |
|   💳 PAYMENTS (5 services)                                                                                            |
|   └─ Stripe, PayPal, Paddle, LemonSqueezy, Square                                                                    |
|                                                                                                                       |
|   🔍 SEARCH & ANALYTICS (8 services)                                                                                  |
|   └─ Algolia, Elasticsearch, Meilisearch, Typesense, Google Analytics, Mixpanel, PostHog, Plausible                 |
|                                                                                                                       |
|   🤖 AI & ML (10 services)                                                                                            |
|   └─ OpenAI, Anthropic, Z.AI, Groq, Hugging Face, Replicate, ElevenLabs, Pinecone, Weaviate                         |
|                                                                                                                       |
|   🔑 SECRETS MANAGEMENT (5 services)                                                                                  |
|   └─ HashiCorp Vault, AWS Secrets Manager, Doppler, Infisical, 1Password                                            |
|                                                                                                                       |
|   🚩 FEATURE FLAGS (4 services)                                                                                       |
|   └─ LaunchDarkly, Split, Flagsmith, PostHog                                                                         |
|                                                                                                                       |
|   🧪 TESTING (6 services)                                                                                             |
|   └─ Playwright, Cypress, Jest, Vitest, BrowserStack, Percy                                                          |
|                                                                                                                       |
|   IMPLEMENTATION COMPONENTS:                                                                                          |
|                                                                                                                       |
|   ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐               |
|   │  📋 Service Registry                                                                              │               |
|   │  - ServiceDefinition: id, name, category, credentials schema, capabilities                       │               |
|   │  - 100+ pre-configured service definitions                                                       │               |
|   │  - Search, filter, and discover services by category                                             │               |
|   └──────────────────────────────────────────────────────────────────────────────────────────────────┘               |
|                                                                                                                       |
|   ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐               |
|   │  🔌 Connection Manager                                                                            │               |
|   │  - CRUD operations for user service connections                                                  │               |
|   │  - Credential encryption/decryption (Supabase Vault AES-256-GCM)                                 │               |
|   │  - Connection testing & validation                                                               │               |
|   │  - Health monitoring                                                                              │               |
|   └──────────────────────────────────────────────────────────────────────────────────────────────────┘               |
|                                                                                                                       |
|   ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐               |
|   │  🔧 Service Adapters                                                                              │               |
|   │  - Base adapter pattern for all services                                                         │               |
|   │  - Service-specific implementations (Supabase, Auth0, Sentry, etc.)                              │               |
|   │  - test(): Validate connection with credentials                                                  │               |
|   │  - generateCodeTemplate(): Return code snippets for common operations                            │               |
|   │  - getAgentInstructions(): Provide AI usage guidelines                                           │               |
|   └──────────────────────────────────────────────────────────────────────────────────────────────────┘               |
|                                                                                                                       |
|   ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐               |
|   │  🧠 Context Injection                                                                             │               |
|   │  - ContextManager loads user's connected services                                                │               |
|   │  - Injects service instructions into AI prompt                                                   │               |
|   │  - Provides code templates library                                                               │               |
|   │  - Maps credentials to environment variables                                                     │               |
|   └──────────────────────────────────────────────────────────────────────────────────────────────────┘               |
|                                                                                                                       |
|   API ENDPOINTS:                                                                                                      |
|   +-- GET    /api/v1/services              (List all available services)                                             |
|   +-- GET    /api/v1/services/:id          (Get service definition)                                                  |
|   +-- GET    /api/v1/connections           (List user's connections)                                                 |
|   +-- POST   /api/v1/connections           (Create new connection)                                                   |
|   +-- GET    /api/v1/connections/:id       (Get connection details)                                                  |
|   +-- PUT    /api/v1/connections/:id       (Update connection)                                                       |
|   +-- DELETE /api/v1/connections/:id       (Delete connection)                                                       |
|   +-- POST   /api/v1/connections/:id/test  (Test connection health)                                                  |
|                                                                                                                       |
|   DATABASE SCHEMA ADDITIONS:                                                                                          |
|   - user_service_connections (id, user_id, service_id, connection_name, credentials, metadata, ...)                  |
|   - service_usage_logs (id, connection_id, user_id, service_id, operation, success, duration_ms, ...)                |
|                                                                                                                       |
|   SECURITY:                                                                                                           |
|   ✓ All credentials encrypted using Supabase Vault (AES-256-GCM)                                                     |
|   ✓ User can only access their own connections                                                                       |
|   ✓ Credentials never logged or exposed in API responses                                                             |
|   ✓ Audit trail for all credential access                                                                            |
|   ✓ Connection health checks detect invalid credentials                                                              |
|                                                                                                                       |
|   SEE: docs/project/Services.md for complete implementation details                                                  |
|                                                                                                                       |
+=======================================================================================================================+

+=======================================================================================================================+
|   🧠  PHASE 22: AI INTENT ANALYSIS + VECTOR LEARNING SYSTEM                                                          |
+=======================================================================================================================+
|                                                                                                                       |
|   OVERVIEW: Replace regex with AI intelligence for intent detection and semantic code search.                        |
|                                                                                                                       |
|   ┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────┐  |
|   │                          AI INTENT ANALYZER (Replaces intent-classifier.ts)                                   │  |
|   │                                                                                                               │  |
|   │   OLD (Phase 21): Regex patterns, hardcoded TypeScript/Fastify                                              │  |
|   │   NEW (Phase 22): AI-powered with 90-100% confidence scores                                                 │  |
|   │                                                                                                               │  |
|   │   ✅ Detects: QUESTION | SIMPLE_SCRIPT | FULL_BACKEND | EDIT_REQUEST                                         │  |
|   │   ✅ Selects Language: Python for scripts, TypeScript for APIs, Go for performance                          │  |
|   │   ✅ Chooses Framework: NestJS for microservices, Fastify for REST, FastAPI for ML                          │  |
|   │   ✅ Returns: confidence score (0-100%) + reasoning                                                         │  |
|   │                                                                                                               │  |
|   │   EXAMPLES:                                                                                                   │  |
|   │   "script to reverse string"    → SIMPLE_SCRIPT | python/none | 98%                                        │  |
|   │   "Build e-commerce backend"    → FULL_BACKEND | typescript/nestjs | 95%                                    │  |
|   │   "What is JWT?"                → QUESTION | none/none | 98%                                                │  |
|   │                                                                                                               │  |
|   └───────────────────────────────────────────────────────────────────────────────────────────────────────────────┘  |
|                                                                                                                       |
|   ┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────┐  |
|   │                    VECTOR LEARNING SYSTEM (Semantic Code Search - No OpenAI!)                                │  |
|   │                                                                                                               │  |
|   │   EMBEDDING GENERATION (Using Fast AI Model - Groq):                                                        │  |
|   │   1. Fast Model extracts 30 semantic features (complexity, technical_depth, backend_focus...)               │  |
|   │   2. Expand 30 → 1536 dimensions (OpenAI compatible)                                                        │  |
|   │   3. Normalize to unit vector for cosine similarity                                                         │  |
|   │   4. Fallback: Hash-based if AI fails (still searchable!)                                                   │  |
|   │                                                                                                               │  |
|   │   SEMANTIC SEARCH FLOW:                                                                                      │  |
|   │   User: "Build REST API for tasks"                                                                          │  |
|   │   ↓                                                                                                          │  |
|   │   Generate embedding [0.8, 0.3, ..., 0.2] (1536 dims)                                                       │  |
|   │   ↓                                                                                                          │  |
|   │   Search code_embeddings table (1,157+ chunks)                                                              │  |
|   │   ↓                                                                                                          │  |
|   │   FOUND:                                                                                                     │  |
|   │   - /api/auth.ts (87% match) - JWT patterns                                                                 │  |
|   │   - /routes/tasks.ts (85% match) - CRUD operations                                                          │  |
|   │   - /db/connection.ts (78% match) - PostgreSQL setup                                                        │  |
|   │   ↓                                                                                                          │  |
|   │   Inject into AI prompt as learning context                                                                 │  |
|   │   ↓                                                                                                          │  |
|   │   AI generates BETTER code using proven patterns! 🚀                                                        │  |
|   │                                                                                                               │  |
|   └───────────────────────────────────────────────────────────────────────────────────────────────────────────────┘  |
|                                                                                                                       |
|   SUPABASE RPC FUNCTIONS (migration 012):                                                                            |
|   +-- match_code_embeddings(embedding, threshold, limit, language)                                                   |
|   |   Returns: Similar code from past projects with similarity scores                                                |
|   +-- match_knowledge_embeddings(embedding, threshold, limit)                                                        |
|       Returns: Best practices from backend_knowledge_base                                                            |
|                                                                                                                       |
|   DATABASE CURRENT STATE:                                                                                             |
|   ✅ code_embeddings: 1,157+ indexed chunks                                                                          |
|   ✅ generation_iterations: 36+ past generations                                                                     |
|   ✅ learned_patterns: 1+ patterns extracted                                                                         |
|   ✅ backend_knowledge_base: Ready for best practices                                                                |
|                                                                                                                       |
|   QUESTION HANDLING:                                                                                                  |
|   When intent = QUESTION:                                                                                             |
|   1. Skip code generation                                                                                             |
|   2. Use Fast AI to answer                                                                                            |
|   3. Save to output/last-question-answer.txt                                                                          |
|   4. Return in API response                                                                                           |
|                                                                                                                       |
|   SERVICES:                                                                                                           |
|   📁 packages/api/src/services/ai-intent-analyzer.ts                                                                 |
|   📁 packages/api/src/services/vector-learning-system.ts                                                             |
|   📁 packages/database/src/migrations/012_vector_search_functions.sql                                                |
|                                                                                                                       |
|   PERFORMANCE (Test Run - E-commerce Microservices):                                                                 |
|   ✅ AI Intent: 12s | Vector Context: <1s | Generation: 70-120s | Total: ~6.5min | Cost: $0.023                      |
|                                                                                                                       |
|   KEY BENEFITS:                                                                                                       |
|   ✅ No OpenAI dependency (uses Fast AI Model)                                                                       |
|   ✅ Intelligent language selection (Python vs TypeScript vs Go)                                                     |
|   ✅ Learns from past successful code                                                                                |
|   ✅ Self-improving with each generation                                                                             |
|   ✅ Better code quality through proven patterns                                                                     |
|                                                                                                                       |
+=======================================================================================================================+

