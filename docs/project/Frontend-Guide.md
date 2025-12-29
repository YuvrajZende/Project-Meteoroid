# 🚀 METEOROID FRONTEND ARCHITECTURE GUIDE

```
+===================================================================================+
|                     METEOROID FRONTEND - COMPLETE ARCHITECTURE                    |
|                          Based on Backend Services (Phase 20)                      |
+===================================================================================+

                              ┌─────────────────────┐
                              │   🌐 LANDING PAGE   │
                              │   (Public Routes)   │
                              └──────────┬──────────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              │                          │                          │
              v                          v                          v
    ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
    │   /login        │      │   /signup       │      │   /docs         │
    │   OAuth + Email │      │   Registration  │      │   API Docs      │
    └────────┬────────┘      └────────┬────────┘      └─────────────────┘
             │                        │
             └───────────┬────────────┘
                         │ Authentication
                         v
    +===================================================================================+
    │                           🔐 PROTECTED DASHBOARD                                  │
    +===================================================================================+
    │                                                                                   │
    │   ┌─────────────────────────────────────────────────────────────────────────┐    │
    │   │                           APP SHELL                                      │    │
    │   │  ┌─────────┐  ┌──────────────────────────────────────────────────────┐  │    │
    │   │  │SIDEBAR  │  │                    HEADER                             │  │    │
    │   │  │         │  │  [Breadcrumbs] [Quick Command ⌘K] [Notifications 🔔] │  │    │
    │   │  │ • Dash  │  └──────────────────────────────────────────────────────┘  │    │
    │   │  │ • Orch  │  ┌──────────────────────────────────────────────────────┐  │    │
    │   │  │ • Code  │  │                                                      │  │    │
    │   │  │ • Deploy│  │                   MAIN CONTENT                       │  │    │
    │   │  │ • Vector│  │                   (Page Routes)                      │  │    │
    │   │  │ • Learn │  │                                                      │  │    │
    │   │  │ • Prev  │  └──────────────────────────────────────────────────────┘  │    │
    │   │  │─────────│                                                            │    │
    │   │  │SETTINGS │                                                            │    │
    │   │  │ • API   │                                                            │    │
    │   │  │ • Sec   │                                                            │    │
    │   │  │ • Prof  │                                                            │    │
    │   │  └─────────┘                                                            │    │
    │   └─────────────────────────────────────────────────────────────────────────┘    │
    │                                                                                   │
    +===================================================================================+
```

---

## 📁 ROUTE STRUCTURE

```
/                           → Landing Page (Public)
├── /login                  → Login (OAuth + Email/Password)
├── /signup                 → Registration
├── /forgot-password        → Password Reset
│
├── /(dashboard)/           → Protected Routes (Requires Auth)
│   ├── /dashboard          → Main Dashboard (Stats, Activity, Health)
│   │
│   ├── /orchestrator       → AI Orchestrator Chat Interface
│   │   └── /[taskId]       → Individual Task Details
│   │
│   ├── /codegen            → Code Generation Studio
│   │   └── /[projectId]    → Generated Project Details
│   │
│   ├── /deployments        → Deployment Management
│   │   └── /[deployId]     → Deployment Logs & Details
│   │
│   ├── /vector             → Vector Search (Semantic Code Search)
│   │
│   ├── /learning           → AI Learning Dashboard
│   │
│   ├── /preview            → Live Preview Sessions
│   │   └── /[previewId]    → Active Preview
│   │
│   ├── /monitoring         → System Monitoring & Logs
│   │
│   └── /settings/
│       ├── /               → General Settings (Profile, Theme)
│       ├── /api-keys       → API Key Management
│       └── /security       → MFA, Sessions, Security Events
```

---

## 📊 PAGE BREAKDOWN

### 1. DASHBOARD (`/dashboard`)
```
┌──────────────────────────────────────────────────────────────────┐
│  👋 Welcome, {User}                                              │
├──────────────────────────────────────────────────────────────────┤
│  STATS CARDS (4)                                                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐    │
│  │ Tasks Done │ │ Code Lines │ │ Deploys    │ │ API Calls  │    │
│  │   234      │ │   45.2k    │ │    12      │ │   1.2M     │    │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘    │
├──────────────────────────────────────────────────────────────────┤
│  QUICK ACTIONS           │  RECENT ACTIVITY                      │
│  [🧠 Orchestrator]       │  • Codegen: auth-service              │
│  [💻 Generate Code]      │  • Deploy: api-gateway ✓              │
│  [🚀 Deploy]             │  • Task: user-management              │
│  [📊 Monitoring]         │  • Security: MFA enabled              │
├──────────────────────────────────────────────────────────────────┤
│  SYSTEM STATUS           │  SECURITY OVERVIEW                    │
│  ┌──────────────────┐    │  ┌──────────────────┐                 │
│  │ API Gateway  ✓   │    │  │ MFA: Enabled ✓   │                 │
│  │ Orchestrator ✓   │    │  │ API Keys: 3      │                 │
│  │ Database    ✓   │    │  │ Sessions: 2      │                 │
│  │ AI Provider ✓   │    │  └──────────────────┘                 │
│  └──────────────────┘    │                                       │
└──────────────────────────────────────────────────────────────────┘
```

**API Endpoints Used:**
- `GET /auth/me` → User info
- `GET /health` → System status
- `GET /auth/mfa/status` → MFA status

---

### 2. ORCHESTRATOR (`/orchestrator`)
```
┌──────────────────────────────────────────────────────────────────┐
│  🧠 AI Orchestrator           [All Agents Online ●]              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  CHAT INTERFACE                                            │  │
│  │                                                            │  │
│  │  [System] Welcome! What would you like to build?           │  │
│  │                                                            │  │
│  │  [User] Create a REST API for user management              │  │
│  │                                                            │  │
│  │  [AI] I've analyzed your request:                          │  │
│  │       Complexity: Medium                                   │  │
│  │       Agents: [codegen] [database] [auth]                  │  │
│  │       Cost: ~0.0234 credits                                │  │
│  │       Plan:                                                │  │
│  │         1. Generate database schema                        │  │
│  │         2. Create CRUD routes                              │  │
│  │         3. Add authentication                              │  │
│  │       [████████████████████] 100% Complete ✓               │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ [📝 Describe what you want to build...]          [Send ➤] │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

**API Endpoints Used:**
- `POST /orchestrator/analyze` → Analyze task
- `POST /orchestrator/execute` → Execute task
- `GET /orchestrator/status/:taskId` → Task status (poll)

---

### 3. CODE GENERATION (`/codegen`)
```
┌──────────────────────────────────────────────────────────────────┐
│  💻 Code Generation                    [Powered by GLM-4 ✨]     │
├─────────────────────────────┬────────────────────────────────────┤
│  CONFIGURATION              │  OUTPUT                            │
│  ┌───────────────────────┐  │  ┌────────────────────────────────┐│
│  │ Language: TypeScript  │  │  │ FILES              │ PREVIEW   ││
│  │ Framework: Fastify    │  │  │ ┌───────────────┐  │           ││
│  └───────────────────────┘  │  │ │ src/          │  │ ```ts     ││
│                             │  │ │ ├─ routes/    │  │ import... ││
│  PROMPT                     │  │ │ ├─ services/  │  │           ││
│  ┌───────────────────────┐  │  │ │ └─ index.ts   │  │ export    ││
│  │ Describe what you     │  │  │ └───────────────┘  │ async...  ││
│  │ want to generate...   │  │  │                    │           ││
│  └───────────────────────┘  │  │ [Selected: routes] │ ```       ││
│                             │  │                    │           ││
│  [▶ Generate Code]          │  └────────────────────────────────┘│
│                             │  [📋 Copy] [⬇ Download] [🚀 Deploy]│
├─────────────────────────────┴────────────────────────────────────┤
│  TEMPLATES                                                       │
│  [REST API] [Auth System] [WebSocket] [API Gateway]              │
└──────────────────────────────────────────────────────────────────┘
```

**API Endpoints Used:**
- `POST /codegen/generate` → Generate code
- `POST /codegen/validate` → Validate code

---

### 4. DEPLOYMENTS (`/deployments`)
```
┌──────────────────────────────────────────────────────────────────┐
│  🚀 Deployments                          [+ New Deployment]      │
├──────────────────────────────────────────────────────────────────┤
│  STATS                                                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                │
│  │ Total:6 │ │ Live: 4 │ │ Build:1 │ │ Fail: 1 │                │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘                │
├──────────────────────────────────────────────────────────────────┤
│  [Grid View] [Table View]                                        │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐│
│  │ api-gateway      │  │ auth-service     │  │ user-mgmt       ││
│  │ ────────────     │  │ ────────────     │  │ ─────────       ││
│  │ 🌐 main          │  │ 🌐 main          │  │ 🌐 main         ││
│  │ ✓ deployed       │  │ ⏳ building 67%  │  │ ✓ deployed      ││
│  │                  │  │ [████████░░░]    │  │                 ││
│  │ api-gw.netlify   │  │                  │  │ users.netlify   ││
│  │ [View Logs]      │  │ [View Logs]      │  │ [View Logs]     ││
│  └──────────────────┘  └──────────────────┘  └─────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

**API Endpoints Used:**
- `GET /deployments` → List deployments
- `POST /deployments` → Create deployment
- `GET /deployments/:id` → Deployment status

---

### 5. VECTOR SEARCH (`/vector`)
```
┌──────────────────────────────────────────────────────────────────┐
│  🔍 Vector Search                                                │
├──────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ [🔎 Search for code patterns, functions...]      [Search] │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Recent: [auth middleware] [rate limiting] [JWT validation]      │
├──────────────────────────────────────────────────────────────────┤
│  RESULTS (4 found for "authentication")                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 📄 src/middleware/auth.ts          [94% match]            │  │
│  │ ┌──────────────────────────────────────────────────────┐  │  │
│  │ │ export async function authenticate(req) {           │  │  │
│  │ │   const token = req.headers.authorization;          │  │  │
│  │ │   ...                                       [Copy]  │  │  │
│  │ └──────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

**API Endpoints Used:**
- `GET /vector/search?query=...` → Semantic search

---

### 6. AI LEARNING (`/learning`)
```
┌──────────────────────────────────────────────────────────────────┐
│  🎓 AI Learning                         [Continuously Learning]  │
├──────────────────────────────────────────────────────────────────┤
│  STATS                                                           │
│  [156 Patterns] [45.2k Lines] [94% Success] [+12% Quality]       │
├──────────────────────────────────────────────────────────────────┤
│  AI INSIGHTS                  │  LEARNING PROGRESS               │
│  ┌─────────────────────────┐  │  Code Style:     [████████░░] 92%│
│  │ 💡 Improved Error       │  │  Architecture:   [███████░░░] 78%│
│  │ Handling Pattern        │  │  Error Handling: [████████░░] 85%│
│  │ HIGH IMPACT             │  │  Security:       [████████░░] 89%│
│  └─────────────────────────┘  │  Testing:        [██████░░░░] 65%│
├──────────────────────────────────────────────────────────────────┤
│  LEARNED PATTERNS                                                │
│  [All] [API] [Security] [Database] [Performance]                 │
│                                                                  │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐           │
│  │ REST Routing  │ │ JWT Auth      │ │ Error Handler │           │
│  │ API • 156x    │ │ Security • 89 │ │ Patterns • 134│           │
│  └───────────────┘ └───────────────┘ └───────────────┘           │
└──────────────────────────────────────────────────────────────────┘
```

**API Endpoints Used:**
- `GET /learning/patterns` → Get learned patterns

---

### 7. LIVE PREVIEW (`/preview`)
```
┌──────────────────────────────────────────────────────────────────┐
│  ⚡ Live Preview                              [+ New Preview]    │
├───────────────┬──────────────────────────────────────────────────┤
│  SESSIONS     │  PREVIEW WINDOW                                  │
│  ┌──────────┐ │  ┌──────────────────────────────────────────────┐│
│  │api-prev  │ │  │ [🖥️] [📱] [💻]   🟢 Live                      ││
│  │ ✓ Ready  │ │  │ ────────────────────────────────────────────││
│  │ 23h left │ │  │ 🌐 preview-abc.meteoroid.dev       [↗ Open] ││
│  ├──────────┤ │  │                                              ││
│  │auth-prev │ │  │      ┌────────────────────────────┐         ││
│  │ ✓ Ready  │ │  │      │                            │         ││
│  └──────────┘ │  │      │     Preview Running        │         ││
│               │  │      │     Click to open          │         ││
│               │  │      │                            │         ││
│               │  │      └────────────────────────────┘         ││
│               │  │                                              ││
│               │  └──────────────────────────────────────────────┘│
│               │  Created: 2h ago • Expires: 23h                  │
└───────────────┴──────────────────────────────────────────────────┘
```

**API Endpoints Used:**
- `POST /preview/create` → Create preview
- `GET /preview/:id/url` → Get preview URL

---

### 8. MONITORING (`/monitoring`)
```
┌──────────────────────────────────────────────────────────────────┐
│  📊 Monitoring                    [Auto-refresh: ON] [Refresh]   │
├──────────────────────────────────────────────────────────────────┤
│  ✓ ALL SYSTEMS OPERATIONAL                     99.99% Uptime     │
├──────────────────────────────────────────────────────────────────┤
│  METRICS                                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│  │Requests │ │Response │ │Error    │ │Sessions │ │CPU      │    │
│  │ 45.2k   │ │  23ms   │ │ 0.02%   │ │  342    │ │  42%    │    │
│  │  +12%   │ │  -5%    │ │ -0.01%  │ │  +8%    │ │         │    │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘    │
├──────────────────────────────────────────────────────────────────┤
│  SERVICE STATUS          │  RESOURCE USAGE                       │
│  ● API Gateway    12ms   │  CPU:     [████████░░░░░] 42%         │
│  ● Orchestrator   45ms   │  Memory:  [███████░░░░░░] 40%         │
│  ● Database        8ms   │  DB Conn: [██░░░░░░░░░░░] 23%         │
│  ● AI Provider   156ms   │  Storage: [█████░░░░░░░░] 45%         │
├──────────────────────────────────────────────────────────────────┤
│  RECENT LOGS                           [All] [Errors] [Warnings] │
│  INFO  api-gateway   GET /health - 200 OK              now       │
│  INFO  orchestrator  Task completed: codegen-abc       10s ago   │
│  WARN  rate-limiter  Rate limit approaching: 85/100    30s ago   │
│  ERROR ai-provider   Connection timeout                 2m ago   │
└──────────────────────────────────────────────────────────────────┘
```

**API Endpoints Used:**
- `GET /health` → System health status

---

### 9. SETTINGS (`/settings/*`)

#### 9a. General Settings (`/settings`)
```
┌──────────────────────────────────────────────────────────────────┐
│  ⚙️ Settings                                                     │
├─────────────────┬────────────────────────────────────────────────┤
│  NAVIGATION     │  PROFILE                                       │
│  ● Profile      │  ┌──────┐                                      │
│  ○ Notifications│  │ [👤] │  [Change Photo]                      │
│  ○ Appearance   │  └──────┘                                      │
│  ○ Language     │                                                │
│                 │  Name:  [John Doe                    ]         │
│                 │  Email: [john@example.com            ]         │
│                 │  Bio:   [Full-stack developer...     ]         │
│                 ├────────────────────────────────────────────────│
│                 │  APPEARANCE                                    │
│                 │  Theme: [☀️ Light] [🌙 Dark] [💻 System]        │
│                 ├────────────────────────────────────────────────│
│                 │  NOTIFICATIONS                                 │
│                 │  Email:        [ON]   Push:     [ON]           │
│                 │  Deployments:  [ON]   Security: [ON]           │
│                 ├────────────────────────────────────────────────│
│                 │                                    [💾 Save]   │
└─────────────────┴────────────────────────────────────────────────┘
```

#### 9b. API Keys (`/settings/api-keys`)
```
┌──────────────────────────────────────────────────────────────────┐
│  🔑 API Keys                               [+ Create API Key]    │
├──────────────────────────────────────────────────────────────────┤
│  ⚠️ API keys grant programmatic access. Keep them secure.        │
├──────────────────────────────────────────────────────────────────┤
│  NAME           KEY              SCOPES          LAST USED  ACT  │
│  ─────────────────────────────────────────────────────────────── │
│  Production     lvb_prod_•••    read,write,dep  2h ago     [🗑️] │
│  Development    lvb_dev_•••     read,write      5m ago     [🗑️] │
│  CI/CD          lvb_ci_•••      deploy          1h ago     [🗑️] │
└──────────────────────────────────────────────────────────────────┘
```

**API Endpoints Used:**
- `GET /auth/api-keys` → List API keys
- `POST /auth/api-keys` → Create key
- `DELETE /auth/api-keys/:id` → Revoke key

#### 9c. Security (`/settings/security`)
```
┌──────────────────────────────────────────────────────────────────┐
│  🛡️ Security                                                     │
├──────────────────────────────────────────────────────────────────┤
│  SECURITY SCORE: 95%  [████████████████████░] Excellent          │
├──────────────────────────────────────────────────────────────────┤
│  TWO-FACTOR AUTH           │  PASSWORD                           │
│  ┌───────────────────────┐ │  Strength: [████████░░] 75%         │
│  │ ✓ Authenticator App   │ │  Last changed: 30 days ago          │
│  │   Enabled & Protecting│ │  [🔄 Change Password]               │
│  │         [Manage]      │ │                                     │
│  └───────────────────────┘ │                                     │
├──────────────────────────────────────────────────────────────────┤
│  ACTIVE SESSIONS                              [Sign Out All]     │
│  ● Windows PC • Chrome    192.168.1.1   Active now    (current)  │
│  ○ MacBook    • Safari    10.0.0.45     2h ago        [Revoke]   │
│  ○ iPhone     • Safari    172.16.0.12   1d ago        [Revoke]   │
├──────────────────────────────────────────────────────────────────┤
│  SECURITY EVENTS                                                 │
│  ✓ Login from Chrome/Windows           192.168.1.1      now      │
│  ✓ API key created: Production         192.168.1.1      30m ago  │
│  ✗ Failed login attempt                203.0.113.42     1h ago   │
└──────────────────────────────────────────────────────────────────┘
```

**API Endpoints Used:**
- `GET /auth/mfa/status` → MFA status
- `POST /auth/mfa/setup` → Setup MFA
- `POST /auth/mfa/verify` → Verify MFA

---

## 🔌 BACKEND INTEGRATION SUMMARY

| Frontend Route     | Backend Endpoints                                      |
|--------------------|-------------------------------------------------------|
| `/login`           | `POST /auth/login`, `GET /auth/oauth/:provider`       |
| `/signup`          | `POST /auth/signup`                                   |
| `/dashboard`       | `GET /auth/me`, `GET /health`, `GET /auth/mfa/status` |
| `/orchestrator`    | `POST /orchestrator/analyze`, `POST /orchestrator/execute`, `GET /orchestrator/status/:id` |
| `/codegen`         | `POST /codegen/generate`, `POST /codegen/validate`    |
| `/deployments`     | `GET /deployments`, `POST /deployments`, `GET /deployments/:id` |
| `/vector`          | `GET /vector/search`                                  |
| `/learning`        | `GET /learning/patterns`                              |
| `/preview`         | `POST /preview/create`, `GET /preview/:id/url`        |
| `/monitoring`      | `GET /health`                                         |
| `/settings`        | `GET /auth/me` (profile updates TBD)                  |
| `/settings/api-keys` | `GET/POST/DELETE /auth/api-keys`                    |
| `/settings/security` | `GET/POST /auth/mfa/*`                              |

---

## 🎨 TECH STACK

- **Framework:** Next.js 16 (App Router)
- **UI Library:** shadcn/ui (Radix + Tailwind CSS v4)
- **State:** React Context + useState/useEffect
- **Icons:** Lucide React
- **Notifications:** Sonner (Toast)
- **Theme:** Dark mode default, Zinc color palette

---

## 📋 DEVELOPMENT CHECKLIST

- [x] Landing Page
- [x] Login/Signup (OAuth + Email)
- [x] Dashboard Layout (Sidebar + Header)
- [x] Dashboard Page
- [x] Orchestrator Chat
- [x] Code Generation Studio
- [x] Deployments Management
- [x] Vector Search
- [x] AI Learning Dashboard
- [x] Live Preview
- [x] Monitoring Dashboard
- [x] Settings (Profile, API Keys, Security)
- [ ] Connect to real backend endpoints
- [ ] Add real-time updates (SSE/WebSocket)
- [ ] Implement MFA flow with QR code
- [ ] Add OAuth redirect handling
