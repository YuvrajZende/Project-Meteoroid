# ✅ Service Integration - Quick Start Checklist

Use this checklist to implement the Service Integration Framework step-by-step.

## 📌 PHASE 0: Preparation (2 days)

### Database Setup
- [ ] Create migration file: `packages/database/migrations/XXX_add_service_connections.sql`
- [ ] Copy SQL from roadmap Phase 0.2
- [ ] Run migration on dev database: `supabase db push` or apply manually
- [ ] Verify tables created:
  - [ ] `user_service_connections` table exists
  - [ ] `service_usage_logs` table exists
  - [ ] Indexes created
  - [ ] RLS policies enabled

### Directory Structure
- [ ] Create `packages/api/src/services/service-registry/`
- [ ] Create `packages/api/src/services/connection-manager/`
- [ ] Create `packages/api/src/services/adapters/`
- [ ] Create subdirectories:
  - [ ] `adapters/database/`
  - [ ] `adapters/monitoring/`
  - [ ] `adapters/cicd/`
  - [ ] `adapters/email/`
  - [ ] `adapters/payment/`

### Routes Setup
- [ ] Create `packages/api/src/routes/services/`
- [ ] Create `packages/api/src/routes/connections/`

---

## 📌 PHASE 1: Core Infrastructure (5 days)

### Type Definitions (Day 1)
- [ ] Create `packages/api/src/services/service-registry/types.ts`
- [ ] Define `ServiceCategory` enum (15 categories)
- [ ] Define `CredentialField` interface
- [ ] Define `ServiceDefinition` interface
- [ ] Define `CodeTemplate` interface
- [ ] Define `UserConnection` interface
- [ ] Export all types

### Service Registry (Day 2)
- [ ] Create `packages/api/src/services/service-registry/index.ts`
- [ ] Implement `ServiceRegistry` class:
  - [ ] `register()` method
  - [ ] `getService()` method
  - [ ] `getByCategory()` method
  - [ ] `search()` method
  - [ ] `getAllServices()` method
  - [ ] `getStats()` method
- [ ] Create `getServiceRegistry()` singleton function
- [ ] Add `loadDefaultServices()` placeholder

### Connection Manager (Day 3-4)
- [ ] Create `packages/api/src/services/connection-manager/types.ts`
- [ ] Create `packages/api/src/services/connection-manager/encryption.ts`:
  - [ ] `encryptCredentials()` function
  - [ ] `decryptCredentials()` function
- [ ] Create `packages/api/src/services/connection-manager/index.ts`
- [ ] Implement `ConnectionManager` class:
  - [ ] `createConnection()` method
  - [ ] `getUserConnections()` method
  - [ ] `getConnection()` method
  - [ ] `updateConnection()` method
  - [ ] `deleteConnection()` method
  - [ ] `logUsage()` method
  - [ ] `validateCredentials()` private method
  - [ ] `mapToUserConnection()` private method
- [ ] Create `getConnectionManager()` singleton function

### Unit Tests (Day 5)
- [ ] Create `packages/api/src/services/service-registry/index.test.ts`
- [ ] Test service registration
- [ ] Test service retrieval
- [ ] Test search functionality
- [ ] Create `packages/api/src/services/connection-manager/index.test.ts`
- [ ] Test connection CRUD operations
- [ ] Test credential validation
- [ ] Run tests: `npm test`
- [ ] Verify all tests pass

---

## 📌 PHASE 2: First 5 Services (7 days)

### Base Adapter (Day 1)
- [ ] Create `packages/api/src/services/adapters/base-adapter.ts`
- [ ] Define `TestResult` interface
- [ ] Implement `BaseAdapter` abstract class:
  - [ ] `test()` abstract method
  - [ ] `generateCodeTemplate()` abstract method
  - [ ] `getAgentInstructions()` method
  - [ ] `getCodeTemplates()` method
  - [ ] `serviceId` getter

### Adapter Factory (Day 1)
- [ ] Create `packages/api/src/services/adapters/adapter-factory.ts`
- [ ] Implement `getServiceAdapter()` function
- [ ] Add adapter registry map
- [ ] Export factory function

### Service 1: Supabase (Day 2)
- [ ] Create `packages/api/src/services/service-registry/services/supabase.ts`
- [ ] Define `supabaseService` definition with:
  - [ ] Service metadata
  - [ ] Credential fields (url, anonKey)
  - [ ] Capabilities list
  - [ ] Agent instructions
  - [ ] Code templates
- [ ] Create `packages/api/src/services/adapters/database/supabase-adapter.ts`
- [ ] Implement `SupabaseAdapter` class:
  - [ ] `test()` method - test connection
  - [ ] `generateCodeTemplate()` method with operations:
    - [ ] select
    - [ ] insert
    - [ ] update
    - [ ] delete
    - [ ] auth-signup
- [ ] Register adapter in factory
- [ ] Test adapter manually

### Service 2: Sentry (Day 3)
- [ ] Create service definition: `services/sentry.ts`
- [ ] Create adapter: `adapters/monitoring/sentry-adapter.ts`
- [ ] Implement test method (try Sentry.captureMessage)
- [ ] Implement code templates:
  - [ ] initialization
  - [ ] error-capture
  - [ ] performance-monitoring
- [ ] Register in factory
- [ ] Test adapter

### Service 3: GitHub Actions (Day 4)
- [ ] Create service definition: `services/github-actions.ts`
- [ ] Create adapter: `adapters/cicd/github-actions-adapter.ts`
- [ ] Implement test method (verify token with GitHub API)
- [ ] Implement code templates:
  - [ ] basic-workflow
  - [ ] test-workflow
  - [ ] deploy-workflow
- [ ] Register in factory
- [ ] Test adapter

### Service 4: Resend (Day 5)
- [ ] Create service definition: `services/resend.ts`
- [ ] Create adapter: `adapters/email/resend-adapter.ts`
- [ ] Implement test method (send test email)
- [ ] Implement code templates:
  - [ ] send-email
  - [ ] send-with-template
- [ ] Register in factory
- [ ] Test adapter

### Service 5: Stripe (Day 6)
- [ ] Create service definition: `services/stripe.ts`
- [ ] Create adapter: `adapters/payment/stripe-adapter.ts`
- [ ] Implement test method (verify API key)
- [ ] Implement code templates:
  - [ ] create-customer
  - [ ] create-payment-intent
  - [ ] create-subscription
- [ ] Register in factory
- [ ] Test adapter

### Registry Update (Day 7)
- [ ] Update `ServiceRegistry.loadDefaultServices()`:
  - [ ] Import all 5 service definitions
  - [ ] Register each service
- [ ] Test registry contains all 5 services
- [ ] Verify `getStats()` returns correct count

---

## 📌 PHASE 3: API Routes (4 days)

### Service Routes (Day 1)
- [ ] Create `packages/api/src/routes/services/index.ts`
- [ ] Implement routes:
  - [ ] `GET /` - list all services
  - [ ] `GET /:id` - get service details
  - [ ] `GET /category/:category` - get by category
  - [ ] `GET /search?q=` - search services
- [ ] Add route to app: `app.register(servicesRoutes, { prefix: '/api/v1/services' })`

### Connection Routes (Day 2-3)
- [ ] Create `packages/api/src/routes/connections/index.ts`
- [ ] Add auth middleware hook
- [ ] Implement routes:
  - [ ] `GET /` - list user connections
  - [ ] `POST /` - create connection
  - [ ] `GET /:id` - get connection with credentials
  - [ ] `PUT /:id` - update connection
  - [ ] `DELETE /:id` - delete connection
  - [ ] `POST /:id/test` - test connection
- [ ] Add route to app: `app.register(connectionsRoutes, { prefix: '/api/v1/connections' })`

### Manual Testing (Day 4)
- [ ] Test service listing: `curl http://localhost:3000/api/v1/services`
- [ ] Test service details: `curl http://localhost:3000/api/v1/services/supabase`
- [ ] Test connection creation (with auth token)
- [ ] Test connection retrieval
- [ ] Test connection update
- [ ] Test connection deletion
- [ ] Test connection testing endpoint
- [ ] Verify credentials encrypted in database

---

## 📌 PHASE 4: Interactive Service Selection + Agent Integration (7 days)

### 🆕 Interactive Service Selector (Day 1-2)
**NEW APPROACH**: For users without configured services, ask intelligent questions and generate production-ready code!

- [ ] Create directory: `packages/orchestrator/src/service-selector/`
- [ ] Create `packages/orchestrator/src/service-selector/index.ts`
- [ ] Define interfaces:
  - [ ] `ServiceQuestion` interface
  - [ ] `ServiceSelection` interface
- [ ] Implement `InteractiveServiceSelector` class:
  - [ ] `generateQuestions(task, userId)` method
    - [ ] Detect if task needs database
    - [ ] Detect if task needs authentication
    - [ ] Detect if task needs monitoring
    - [ ] Check user's existing connections
    - [ ] Only ask about missing services
  - [ ] `selectServices(task, answers)` method
    - [ ] Process user answers
    - [ ] Handle "recommend" option (AI chooses best)
    - [ ] Handle user-specified services
    - [ ] Return service selections
  - [ ] `recommendService(category, task)` method
    - [ ] Recommend Supabase for database
    - [ ] Recommend Supabase Auth for authentication
    - [ ] Recommend Sentry for monitoring
  - [ ] Helper methods:
    - [ ] `needsDatabase(task)` - detect storage keywords
    - [ ] `needsAuth(task)` - detect user/login keywords
    - [ ] `hasCategory(connections, category)` - check existing

### 🆕 Setup Guide Generator (Day 2-3)
- [ ] Create directory: `packages/orchestrator/src/setup-guide-generator/`
- [ ] Create `packages/orchestrator/src/setup-guide-generator/index.ts`
- [ ] Define interfaces:
  - [ ] `SetupStep` interface
  - [ ] `SetupGuide` interface
- [ ] Implement `SetupGuideGenerator` class:
  - [ ] `generate(serviceIds)` method
    - [ ] Generate step-by-step instructions
    - [ ] Create env var list
    - [ ] Add video tutorials
    - [ ] Estimate setup time
  - [ ] `generateServiceStep(service)` method
    - [ ] Supabase setup instructions
    - [ ] Sentry setup instructions
    - [ ] Auth0 setup instructions
    - [ ] Generic fallback instructions
  - [ ] Include:
    - [ ] Dashboard connection URLs
    - [ ] Required credentials list
    - [ ] Estimated time per service

### 🆕 New API Routes (Day 3)
- [ ] Create `packages/api/src/routes/orchestrator/index.ts` (if not exists)
- [ ] Implement `/generate-interactive` endpoint:
  - [ ] Check if user has services
  - [ ] If NO services: return questions
  - [ ] If HAS services: generate code normally
- [ ] Implement `/generate-interactive/submit` endpoint:
  - [ ] Process user's question answers
  - [ ] Select optimal services (AI or user choice)
  - [ ] Generate production-ready code with selected services
  - [ ] Generate setup guide
  - [ ] Return code + setup instructions + env vars

### Context Manager Update (Day 4)
- [ ] Open `packages/orchestrator/src/context-manager.ts`
- [ ] Add `buildServiceContext()` method
- [ ] Add `buildEnvVarMapping()` method
- [ ] Add `buildCombinedInstructions()` method
- [ ] Update `buildContext()` to include services:
  ```typescript
  const connections = await connectionManager.getUserConnections(userId);
  const serviceContext = await this.buildServiceContext(connections);
  context.services = serviceContext;
  ```

### Prompt Updates (Day 4)
- [ ] Open `packages/orchestrator/src/prompts/codegen-prompt.ts`
- [ ] Add service instructions to prompt:
  ```typescript
  if (context.services?.available.length > 0) {
    prompt += `## Available Services\n`;
    prompt += context.services.instructions;
  }
  ```
- [ ] Add special handling for interactive mode:
  ```typescript
  if (mode === 'interactive') {
    prompt += `\n\nGenerate production-ready code using these services:\n`;
    for (const svc of selectedServices) {
      prompt += `- ${svc.name}: ${svc.reason}\n`;
    }
    prompt += `\nNO PLACEHOLDERS - use real SDKs and implementations!\n`;
  }
  ```

### Service-Aware Generator (Day 5-6)
- [ ] Create `packages/orchestrator/src/codegen/service-aware-generator.ts`
- [ ] Implement `ServiceAwareCodeGenerator`:
  - [ ] `generateCode()` method
  - [ ] `detectRequiredServices()` method
  - [ ] `getAdapters()` method
  - [ ] `buildTemplateLibrary()` method
  - [ ] `processGeneratedCode()` method
- [ ] Integrate into main orchestrator

### Integration Testing (Day 7)
#### Test Scenario 1: User WITH Services
- [ ] Create test user with Supabase connection
- [ ] Test: "Create API to fetch users from database"
- [ ] Verify generated code:
  - [ ] Imports @supabase/supabase-js
  - [ ] Uses process.env.SUPABASE_URL
  - [ ] Uses process.env.SUPABASE_ANON_KEY
  - [ ] Has correct query syntax
- [ ] Test with multiple services

#### Test Scenario 2: User WITHOUT Services (Interactive)
- [ ] Create test user with NO connections
- [ ] Test: "Create task management API"
- [ ] Verify interactive flow:
  - [ ] Returns questions (database, auth, monitoring)
  - [ ] Has "recommend" option for each
  - [ ] Has user-specified options
- [ ] Submit answers with "recommend" selected
- [ ] Verify response:
  - [ ] AI selected Supabase (database)
  - [ ] AI selected Sentry (monitoring)
  - [ ] Code uses REAL Supabase SDK (not placeholders!)
  - [ ] Code uses REAL Sentry SDK
  - [ ] Setup guide included
  - [ ] Env variables listed
  - [ ] Connection dashboard link provided

#### Test Scenario 3: Hybrid (User Has Some Services)
- [ ] Create test user with only Supabase configured
- [ ] Test: "Create API with error tracking"
- [ ] Verify:
  - [ ] Uses existing Supabase connection
  - [ ] Asks only about monitoring (not database)
  - [ ] Recommends Sentry
  - [ ] Generated code uses both services

---

## 📌 PHASE 5: Testing & Documentation (3 days)

### E2E Tests (Day 1-2)
- [ ] Create `packages/api/src/tests/service-integration.test.ts`
- [ ] Test groups:
  - [ ] Service Registry tests
    - [ ] List services
    - [ ] Get service details
    - [ ] Search services
    - [ ] Get by category
  - [ ] Connection Management tests
    - [ ] Create connection
    - [ ] List connections
    - [ ] Get connection
    - [ ] Update connection
    - [ ] Delete connection
    - [ ] Test connection
  - [ ] AI Agent Integration tests
    - [ ] Generate code with Supabase
    - [ ] Generate code with multiple services
    - [ ] Verify env var injection
- [ ] Run all tests: `npm test`
- [ ] Verify coverage > 80%

### Documentation (Day 3)
- [ ] Update main README.md with service integration info
- [ ] Create API documentation (OpenAPI/Swagger)
- [ ] Create user guide: "How to Connect Services"
- [ ] Create developer guide: "How to Add New Services"
- [ ] Update `docs/project/Whole system.md` if needed
- [ ] Add examples to documentation

---

## 📌 PHASE 6: Production Deployment

### Pre-Deploy Checklist
- [ ] All tests passing locally
- [ ] Database migrations tested
- [ ] Environment variables configured:
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Security review:
  - [ ] Credentials encrypted
  - [ ] RLS policies enabled
  - [ ] Rate limiting configured
  - [ ] Auth middleware working
- [ ] Performance testing:
  - [ ] API response times acceptable
  - [ ] Database queries optimized
  - [ ] Connection tests complete quickly

### Deploy Steps
- [ ] Deploy database migrations to production
- [ ] Deploy API changes
- [ ] Verify all endpoints working
- [ ] Monitor error logs
- [ ] Test with real user account

### Post-Deploy Monitoring
- [ ] Monitor connection creation rate
- [ ] Monitor service usage logs
- [ ] Track most popular services
- [ ] Monitor error rates
- [ ] Collect user feedback

---

## 🎯 QUICK WINS (Can Do Today)

If you want to start immediately, here are the quickest wins:

### Option 1: Just Database (30 minutes)
1. [ ] Create migration file
2. [ ] Copy SQL from roadmap
3. [ ] Run migration
4. [ ] Tables ready for future use

### Option 2: Types Only (1 hour)
1. [ ] Create types.ts file
2. [ ] Copy interfaces from roadmap
3. [ ] Types ready for implementation

### Option 3: Full Phase 0 + 1 (1 day)
1. [ ] Database migration
2. [ ] Directory structure
3. [ ] All type definitions
4. [ ] ServiceRegistry implementation
5. [ ] ConnectionManager implementation
6. [ ] Basic tests

---

## 📊 Progress Tracking

Mark your progress:
- ✅ = Complete
- 🔄 = In Progress
- ⏸️ = Blocked
- ⏭️ = Skipped

Current Phase: _________  
Started: _________  
Target Completion: _________  

---

## 🆘 Troubleshooting

### "Migration fails"
- Check Supabase connection
- Verify you have admin access
- Try running SQL manually in Supabase dashboard

### "Import errors"
- Verify file paths are correct
- Check tsconfig.json paths
- Ensure .js extensions on imports (ESM)

### "Tests fail"
- Check test database is clean
- Verify all dependencies installed
- Check environment variables set

### "Encryption not working"
- Verify SUPABASE_SERVICE_ROLE_KEY is set
- Check Supabase Vault is enabled
- Fall back to basic encryption initially

---

## 📞 Need Help?

Refer to:
1. **Service-Integration-Roadmap.md** - Detailed implementation guide
2. **Services.md** - Service catalog and specs
3. **Whole system.md** - Architecture overview

Ready to start? Begin with Phase 0! 🚀
