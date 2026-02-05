# 🎯 Loveable Backend - Complete Refactoring & Migration Strategy

## Executive Summary

This plan addresses critical issues preventing production readiness:
- **265+ compiled files** polluting source directory
- **4 duplicate directory structures** causing confusion
- **82 TODO comments** in production code
- **149 `any` types** breaking type safety
- **Supabase → Convex** database migration required
- **~5% test coverage** (need 80%+ target)

**Timeline:** 8 weeks | **Risk Level:** Medium | **Team Size:** 1-2 developers

---

## 📊 Phase 0: Production-Grade Code Quality Criteria

### Static Code Quality Checklist (NO RUNNING TESTS)

#### ✅ Type Safety (40 points)
- [ ] No `any` types except absolutely necessary (documented)
- [ ] No `@ts-ignore` or `@ts-expect-error` without clear justification
- [ ] All functions have explicit parameter and return types
- [ ] No implicit `any` in catch blocks
- [ ] Proper use of generics (not `unknown` abuse)
- [ ] Strict null checks enabled everywhere

#### ✅ Error Handling (25 points)
- [ ] All async functions have try/catch or error handling
- [ ] No `console.log` in production code (use proper logging)
- [ ] Custom error classes with error codes
- [ ] Error boundaries where appropriate
- [ ] Graceful degradation (no silent failures)

#### ✅ Architecture (20 points)
- [ ] SOLID principles followed (especially Dependency Inversion)
- [ ] Clear separation: domain/infrastructure/application/shared
- [ ] No circular dependencies
- [ ] Single Responsibility Principle enforced
- [ ] No god objects or 1000+ line files

#### ✅ Security (15 points)
- [ ] Input validation on all public APIs
- [ ] No hardcoded credentials or API keys
- [ ] Proper authentication/authorization checks
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention in any HTML output

#### ✅ Documentation (10 points)
- [ ] All public methods have JSDoc comments
- [ ] README in each major directory
- [ ] Complex algorithms have inline explanation
- [ ] API documentation (OpenAPI/Swagger) current

#### ✅ Code Organization (10 points)
- [ ] Consistent naming conventions (kebab-case for files, PascalCase for classes)
- [ ] No duplicate code (DRY principle)
- [ ] Files in correct directories (infrastructure in infrastructure/, not services/)
- [ ] Imports organized (no wildcards like `import * from`)
- [ ] No unused imports or dead code

**Scoring:**
- 90-100: Production Ready ✅
- 75-89: Good with Minor Issues ⚠️
- 60-74: Needs Improvement ⚠️
- <60: Not Production Ready ❌

---

## 🗂️ Phase 1: EMERGENCY CLEANUP (Week 1)

### Priority: CRITICAL | Complexity: LOW | Risk: LOW

#### 1.1 Remove Compiled Files from Source
**Problem:** 265+ .js, .d.ts, .js.map files in `src/` (should be in `dist/`)

**Files to Delete:**
```bash
# Find all compiled files in src
find packages/api/src -type f \( -name "*.js" -o -name "*.d.ts" -o -name "*.js.map" \)
```

**Action:**
1. Update `.gitignore` (ensure `*.js`, `*.d.ts`, `*.js.map` are ignored for src/)
2. Delete all compiled files from `packages/api/src/`
3. Run `npm run build` to verify `dist/` is correct
4. Add pre-commit hook to prevent future commits

**Files Affected:** All .js files in src/
**Time:** 1 hour
**Verification:** `ls packages/api/src/*.js` returns empty

#### 1.2 Consolidate Duplicate Directories
**Problem:** 4 sets of duplicate directories causing confusion

**Duplicates to Fix:**

1. **service-registry** (2 locations)
   - Keep: `packages/api/src/services/service-registry/`
   - Delete: `packages/api/src/services/registry/service-registry/`

2. **connection-manager** (2 locations)
   - Keep: `packages/api/src/services/connection-manager/`
   - Delete: `packages/api/src/services/integrations/connection-manager/`

3. **adapters** (2 locations)
   - Keep: `packages/api/src/services/adapters/`
   - Delete: `packages/api/src/services/agents/adapters/`

**Action:**
1. Identify unique files in each duplicate
2. Move unique files to kept location
3. Update all imports
4. Delete duplicate directories
5. Run tests to verify

**Files Affected:** All files importing from deleted directories
**Time:** 3 hours
**Verification:** No duplicate paths, all tests pass

#### 1.3 Remove Suspicious Files
**Problem:** `nul` file in root (likely accidental Windows system file)

**Action:**
1. Delete `packages/api/nul`
2. Add to `.gitignore`: `nul`

**Files Affected:** packages/api/nul
**Time:** 5 minutes
**Verification:** File gone, git status clean

#### 1.4 Fix .gitignore
**Action:** Ensure `.gitignore` has:
```gitignore
# Compiled output in src
src/**/*.js
src/**/*.d.ts
src/**/*.js.map

# Keep dist/
!dist/

# System files
nul
Thumbs.db
.DS_Store
```

**Time:** 15 minutes
**Verification:** `git status` shows only source files

---

## 🔧 Phase 2: FOLDER STRUCTURE REORGANIZATION (Week 2)

### Priority: HIGH | Complexity: MEDIUM | Risk: MEDIUM

#### 2.1 Proposed New Structure
```
packages/api/src/
├── application/           # Use cases, workflows
│   ├── dto/               # Data Transfer Objects
│   ├── errors/            # Application error classes
│   └── services/          # Application services
├── domain/                # Business entities
│   ├── entities/          # Core business entities
│   ├── repositories/      # Data access layer (keep as-is)
│   └── services/          # Domain services (business logic)
├── infrastructure/        # External integrations
│   ├── database/          # Database adapters (Convex, etc.)
│   ├── vector-store/      # Vector search
│   └── api/               # External API clients (GitHub, etc.)
├── interfaces/            # Type definitions (keep as-is)
├── middleware/            # Express/Fastify middleware (keep as-is)
├── routes/                # API routes (keep as-is)
├── utils/                 # Shared utilities
├── config/                # Configuration
├── types/                 # Global type definitions
└── index.ts               # Entry point
```

#### 2.2 Directory Migration Plan
**Action:**
1. Create new directory structure
2. Move files incrementally (batch by service)
3. Update imports as we go
4. Test after each batch

**Batch 1:** services/infrastructure → infrastructure/
**Batch 2:** services/analysis → domain/services/
**Batch 3:** services/orchestration → application/services/
**Batch 4:** services/agents → domain/services/

**Files Affected:** All service files, all imports
**Time:** 8 hours
**Verification:** All imports resolve, tests pass

---

## 🛡️ Phase 3: TYPE SAFETY IMPROVEMENT (Week 3)

### Priority: HIGH | Complexity: MEDIUM | Risk: MEDIUM

#### 3.1 Eliminate `any` Types (Current: 149 instances)

**Create Shared Type Definitions:**

**File:** `packages/api/src/types/common.ts`
```typescript
// Common API types
export interface ApiResponse<T = void> {
    success: boolean;
    data?: T;
    error?: string;
    errors?: ValidationError[];
}

export interface Pagination {
    page: number;
    limit: number;
    total: number;
}

export interface Timestamps {
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}

// Replace 'any' in API responses
export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}
```

**File:** `packages/api/src/types/database.ts`
```typescript
// Database operation types
export interface DbResult<T> {
    data: T[];
    error: string | null;
    count: number;
}

export interface WhereClause {
    field: string;
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'like' | 'ilike' | 'in';
    value: unknown;
}

// Replace 'any' in database operations
export type QueryParams = Record<string, string | number | boolean | null>;
```

**Action:**
1. Create type definition files
2. Replace `any` with proper types (most in error handling)
3. Use generics where appropriate
4. Run TypeScript compiler to catch missed cases

**Files Affected:** All files with `any` types
**Time:** 12 hours
**Verification:** `tsc --noEmit` has no errors

#### 3.2 Strengthen Interfaces

**File:** `packages/api/src/types/validation.ts`
```typescript
import { z } from 'zod';

// Replaces 'any' in validation
export const createProjectSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    techStack: z.array(z.enum(['typescript', 'python', 'go', 'rust'])),
    config: z.record(z.unknown()).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
```

**Time:** 4 hours
**Verification:** All API routes use schemas

---

## 🔨 Phase 4: TECHNICAL DEBT RESOLUTION (Week 4)

### Priority: HIGH | Complexity: MEDIUM | Risk: LOW

#### 4.1 Resolve TODO Comments (Current: 82 TODOs)

**Categorized TODOs:**
- **Payment Integration** (webhooks.ts) → Create service in infrastructure/api/
- **Authentication** (auth.ts) → Implement in domain/services/auth/
- **Task Management** (tasks.ts) → Already exists, remove TODO
- **Agent Logic** (generation-worker.ts) → Implement in domain/services/

**Action:**
1. Audit all TODOs
2. For each: implement, mark as wontfix, or create ticket
3. Remove TODO comments when done

**Time:** 16 hours
**Verification:** `grep -r "TODO" src/` returns minimal results

#### 4.2 Replace console.log with Proper Logging

**File:** `packages/api/src/infrastructure/logging/logger.ts`
```typescript
import pino from 'pino';

export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
        target: 'pino-pretty',
        options: { colorize: true }
    }
});

// Replace: console.log('[X]', message)
// With: logger.info({ context: 'X' }, message)
```

**Action:**
1. Create logger utility
2. Replace console.log in order:
   - src/di/types.ts (lines 84, 185, 258)
   - All service files
   - Route files

**Time:** 3 hours
**Verification:** `grep -r "console.log" src/` returns minimal results

#### 4.3 Implement Custom Error Classes

**File:** `packages/api/src/application/errors/AppError.ts`
```typescript
export class AppError extends Error {
    constructor(
        public code: string,
        message: string,
        public statusCode: number = 500,
        public details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'AppError';
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string, id: string) {
        super('NOT_FOUND', `${resource} not found`, 404, { resource, id });
    }
}

export class ValidationError extends AppError {
    constructor(errors: z.ZodError) {
        super('VALIDATION_ERROR', 'Invalid input', 400, { errors: errors.issues });
    }
}

// Usage: throw new NotFoundError('Project', id)
```

**Time:** 4 hours
**Verification:** Errors are properly caught and returned as API responses

---

## 🔄 Phase 5: SUPABASE → CONVEX MIGRATION (Weeks 5-6)

### Priority: CRITICAL | Complexity: HIGH | Risk: HIGH

#### 5.1 Current State Analysis

**Good News:** Repository pattern already in place!
- All repositories use `IDatabase` interface
- `BaseRepository` provides common functionality
- Only need to replace the adapter layer

#### 5.2 Migration Architecture

```
Current:
Repository (IDatabase) → SupabaseDatabase → SupabaseClient

Target:
Repository (IDatabase) → ConvexDatabase → ConvexClient
```

#### 5.3 Tables to Migrate (11 total)

**Core Tables (5):**
1. `users` → Convex `users` collection
2. `projects` → Convex `projects` collection
3. `tasks` → Convex `tasks` collection
4. `audit_logs` → Convex `audit_logs` collection
5. `api_keys` → Convex `api_keys` collection

**Learning Tables (6):**
6. `generation_iterations` → Convex `generation_iterations`
7. `testing_iterations` → Convex `testing_iterations`
8. `learned_patterns` → Convex `learned_patterns`
9. `project_contexts` → Convex `project_contexts`
10. `knowledge_embeddings` → Convex `knowledge_embeddings` (use vector search)
11. `project_learning` → Convex `project_learning`

#### 5.4 Implementation Steps

###### Step 0: Create New Convex Project (Since you need this from scratch)
**Time:** 4 hours

**Action:**
```bash
# 1. Install Convex CLI
cd packages/api
npm install -D convex

# 2. Initialize Convex project
npx convex dev

# 3. This creates:
#    - convex/ directory with schema.ts
#    - CONVEX_DEPLOYMENT_URL in .env
#    - convexc/config directory
```

**File:** `packages/api/convex/schema.ts` (Generated)
```typescript
import { defineSchema, defineTable, v } from 'convex/server';

// Define all 11 tables
export default defineSchema({
  users: defineTable({
    id: v.string(),
    email: v.string(),
    name: v.string(),
    passwordHash: v.string(),
    role: v.string(),
    preferences: v.optional(v.any()),
    lastLoginAt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }),

  projects: defineTable({
    id: v.string(),
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    config: v.optional(v.any()),
    techStack: v.array(v.array(v.string())),
    status: v.string(),
    filesCount: v.optional(v.integer()),
    lastGeneratedAt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }),

  tasks: defineTable({
    id: v.string(),
    projectId: v.string(),
    userId: v.optional(v.string()),
    status: v.string(),
    prompt: v.string(),
    result: v.optional(v.any()),
    config: v.optional(v.any()),
    subtasks: v.optional(v.array(v.string())),
    progress: v.optional(v.number()),
    startedAt: v.optional(v.string()),
    completedAt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }),

  audit_logs: defineTable({
    id: v.string(),
    projectId: v.string(),
    userId: v.optional(v.string()),
    action: v.string(),
    metadata: v.optional(v.any()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    timestamp: v.string(),
  }),

  api_keys: defineTable({
    id: v.string(),
    userId: v.string(),
    key: v.string(),
    scopes: v.array(v.string()),
    lastUsed: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }),

  // Learning tables
  generation_iterations: defineTable({
    id: v.string(),
    taskId: v.string(),
    projectId: v.string(),
    userId: v.string(),
    prompt: v.string(),
    generatedCode: v.string(),
    config: v.optional(v.any()),
    success: v.boolean(),
    errors: v.array(v.string()),
    feedback: v.optional(v.any()),
    testResults: v.optional(v.any()),
    metrics: v.optional(v.any()),
    createdAt: v.string(),
  }),

  testing_iterations: defineTable({
    id: v.string(),
    projectId: v.string(),
    testType: v.string(),
    testDescription: v.string(),
    userQuery: v.string(),
    expectedBehavior: v.string(),
    actualResult: v.string(),
    success: v.boolean(),
    lessons: v.array(v.string()),
    relatedFiles: v.array(v.string()),
    tags: v.array(v.string()),
    createdAt: v.string(),
  }),

  learned_patterns: defineTable({
    id: v.string(),
    patternType: v.string(),
    description: v.string(),
    example: v.optional(v.string()),
    context: v.optional(v.string()),
    frequency: v.integer(),
    confidence: v.number(),
    relatedPrompts: v.array(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }),

  project_contexts: defineTable({
    userId: v.string(),
    projectId: v.string(),
    preferences: v.optional(v.any()),
    recentProjects: v.array(v.string()),
    recentPrompts: v.array(v.string()),
    techStackHistory: v.array(v.string()),
    lastActive: v.string(),
  }),

  knowledge_embeddings: defineTable({
    embeddingId: v.id("knowledge_embeddings"),
    embedding: v.array(v.float64()),
    content: v.string(),
    metadata: v.optional(v.any()),
    createdAt: v.string(),
  }),

  project_learning: defineTable({
    id: v.string(),
    projectId: v.string(),
    patterns: v.array(v.string()),
    iterations: v.array(v.string()),
    lastUpdated: v.string(),
  }),
});
```

**Verification:** `npx convex dev` starts successfully, schema validates

##### Step 1: Create Convex Adapter
**File:** `packages/api/src/infrastructure/database/convex-database.ts`

```typescript
import type { IDatabase } from '../../interfaces/database.interface.js';
import { ConvexClient } from 'convex-dev';

export class ConvexDatabase implements IDatabase {
    constructor(private client: ConvexClient) {}

    async query<T>(sql: string, params?: Record<string, unknown>): Promise<T[]> {
        // Parse SQL and translate to Convex queries
        const tableName = this.extractTable(sql);
        const operation = this.extractOperation(sql);

        switch (operation) {
            case 'SELECT':
                return await this.client.query(tableName, params);
            case 'INSERT':
                return await this.client.mutation(tableName, params);
            // ... etc
        }
    }

    // Implement all IDatabase methods
    async transaction<T>(callback): Promise<T> { /* ... */ }
    async getConnectionState(): Promise<{ connected: boolean; latency?: number }> { /* ... */ }
    async close(): Promise<void> { /* ... */ }
}
```

**Time:** 12 hours

##### Step 2: Migration Scripts
**File:** `packages/api/src/migrations/supabase-to-convex.ts`

```typescript
import { getSupabaseAdmin } from './database-client.js';
import { ConvexClient } from 'convex-dev';

// Migrate in batches (handle failures gracefully)
export async function migrateToConvex() {
    const supabase = getSupabaseAdmin();
    const convex = new ConvexClient(process.env.CONVEX_DEPLOYMENT!);

    const tables = [
        'users', 'projects', 'tasks', 'audit_logs', 'api_keys',
        'generation_iterations', 'testing_iterations', 'learned_patterns',
        'project_contexts', 'knowledge_embeddings'
    ];

    for (const table of tables) {
        console.log(`Migrating ${table}...`);

        // 1. Read from Supabase
        const { data } = await supabase.from(table).select('*');
        if (!data || data.length === 0) {
            console.log(`  ✓ ${table}: No data to migrate`);
            continue;
        }

        // 2. Write to Convex
        await convex.mutation(tableName, { insertMany: { data } });
        console.log(`  ✓ ${table}: Migrated ${data.length} rows`);
    }

    // 3. Verification
    console.log('\nVerifying migration...');
    for (const table of tables) {
        const convexCount = await convex.query(table, { count: true });
        const supabaseCount = await supabase.from(table).select('*', { count: 'exact', head: true });
        console.log(`  ${table}: Convex=${convexCount}, Supabase=${supabaseCount.count}`);
    }
}
```

**Time:** 8 hours

##### Step 3: Update DI Container
**File:** `packages/api/src/di/types.ts`

```typescript
// Replace:
const { SupabaseDatabase } = require('../infrastructure/database/supabase-database.js');
this.container.bind(TYPES.Database).to(SupabaseDatabase).inSingletonScope();

// With:
const { ConvexDatabase } = require('../infrastructure/database/convex-database.js');
this.container.bind(TYPES.Database).to(ConvexDatabase).inSingletonScope();
```

**Time:** 2 hours

##### Step 4: Update Repository Queries
**Problem:** Convex doesn't use SQL, uses function queries

**Solution:** Update repositories to use Convex query syntax
```typescript
// Current (SQL-based):
const results = await this.query(`SELECT * FROM projects WHERE user_id = $userId`, { userId });

// New (Convex-based):
const results = await this.database.query('projects', {
    filter: (q) => q.eq('userId', userId)
});
```

**Time:** 16 hours (all 8 repositories)

#### 5.5 Rollback Plan
**If migration fails:**
1. Keep Supabase running as primary
2. Add feature flag: `USE_CONVEX=false`
3. Switch database via environment variable
4. Run dual-write until stable

**File:** `packages/api/src/infrastructure/database/hybrid-database.ts`
```typescript
export class HybridDatabase implements IDatabase {
    private useConvex: boolean;

    async query<T>(sql: string, params?: Record<string, unknown>): Promise<T[]> {
        if (this.useConvex) {
            return await this.convex.query(sql, params);
        } else {
            return await this.supabase.query(sql, params);
        }
    }
}
```

#### 5.6 Verification Steps
1. Migrate test data first
2. Run migration script
3. Verify row counts match
4. Run API tests against Convex
5. Performance test
6. Keep Supabase backup for 30 days

**Total Time:** 38 hours (~1 week)

---

## 📁 Phase 6: TESTING STRATEGY (Weeks 7-8)

### Priority: MEDIUM | Complexity: MEDIUM | Risk: LOW

#### 6.1 Test Structure
```
packages/api/src/
└── __tests__/
    ├── unit/              # Fast, isolated tests
    │   ├── repositories/
    │   ├── services/
    │   └── utils/
    ├── integration/       # API and service integration
    │   ├── api/
    │   └── database/
    └── e2e/               # Full workflow tests
        ├── api.workflows.test.ts (already created)
        └── ui/              # Playwright tests (already created)
```

#### 6.2 Priority Testing Order

**Week 7: Critical Path**
1. Repository tests (already exist, add missing)
2. Authentication/Authorization tests
3. API endpoint tests (all routes)

**Week 8: Coverage**
1. Service tests (all services in domain/services/)
2. Integration tests (Convex queries)
3. E2E tests (user workflows)

**Target Coverage:** 80% (from current ~5%)

**Time:** 40 hours
**Verification:** `npm run test:coverage` shows >80%

---

## 📋 Implementation Order & Dependencies

### Critical Path (Must Complete in Order):
1. **Phase 1** (Cleanup) → Foundation for everything
2. **Phase 2** (Reorganization) → Required for clean migration
3. **Phase 3** (Type Safety) → Prevents bugs during migration
4. **Phase 5** (Convex Migration) → Core business value
5. **Phase 6** (Testing) → Validates everything works

### Can Run in Parallel:
- **Phase 4** (Technical Debt) → During migration
- Documentation updates → Throughout

### Your Chosen Approach:
- **Convex:** Create new project from scratch
- **Priority:** Cleanup first (Phase 1-4), then migrate (Phase 5), then test (Phase 6)
- **Migration:** Hard cutover (no dual-write, no feature flags)

### Risk Mitigation for Hard Cutover:
- **Comprehensive backup** of Supabase before migration
- **Staging environment** with Convex for testing
- **Complete verification** before cutover
- **Keep Supabase accessible** for 30 days post-migration (emergency rollback)
- **Full test suite** against Convex before cutover

---

## 🎯 Success Criteria

### Phase Completion Checkpoints:

**Phase 1 Complete When:**
- ✅ 0 compiled files in src/
- ✅ 0 duplicate directories
- ✅ `git status` shows clean source tree

**Phase 2 Complete When:**
- ✅ New folder structure created
- ✅ All imports resolve correctly
- ✅ Tests pass after reorganization

**Phase 3 Complete When:**
- ✅ <15 `any` types remaining (only 5% of original)
- ✅ `tsc --noEmit` has 0 errors
- ✅ All files have proper type definitions

**Phase 4 Complete When:**
- ✅ <5 TODO comments remaining (only critical future work)
- ✅ 0 console.log in production code
- ✅ All services use custom error classes

**Phase 5 Complete When:**
- ✅ All 11 tables migrated to Convex
- ✅ Data integrity verified (row counts match)
- ✅ API tests pass against Convex
- ✅ Supabase can be disabled (feature flag)

**Phase 6 Complete When:**
- ✅ 80%+ test coverage
- ✅ All critical paths tested
- ✅ E2E tests pass

---

## 📁 Files to Create/Modify/Delete

### Create (15 files):
1. `src/types/common.ts` - Shared types
2. `src/types/validation.ts` - Zod schemas
3. `src/types/database.ts` - DB types
4. `src/application/errors/AppError.ts` - Error classes
5. `src/infrastructure/logging/logger.ts` - Logger
6. `src/infrastructure/database/convex-database.ts` - Convex adapter
7. `src/infrastructure/database/hybrid-database.ts` - Rollback support
8. `src/migrations/supabase-to-convex.ts` - Migration script
9. `src/migrations/verify-migration.ts` - Verification script
10. `.pre-commit` - Git hook
11. `.eslintrc.json` - Linting rules
12. `packages/api/__tests__/test-setup.ts` - Test utilities
13. `packages/api/__tests__/unit/.gitkeep`
14. `packages/api/__tests__/integration/.gitkeep`
15. `CONVEX_MIGRATION_PLAN.md` - Migration documentation

### Modify (100+ files):
- All files importing from deleted directories
- All repository files (Convex queries)
- All files with `any` types
- All files with TODO comments
- All files with console.log
- `.gitignore`

### Delete (270+ files):
- All .js files in src/ (265 files)
- All .d.ts files in src/
- All .js.map files in src/
- Duplicate directories (4 directories)
- `packages/api/nul`

---

## ⚡ Quick Wins (Do First!)

Can be done in **under 2 hours**:

1. **Delete `nul` file** (1 min)
2. **Update .gitignore** (15 min)
3. **Remove compiled files** (30 min)
4. **Create logger utility** (1 hour)
5. **Replace console.log in DI container** (10 min)

**Immediate Value:** Clean codebase, better development experience

---

## 🚀 Next Steps After Approval

1. **Create detailed task tickets** for each phase
2. **Set up branch protection** rules
3. **Configure CI/CD** to run quality checks
4. **Create staging environment** for Convex testing
5. **Schedule migration window** (minimal downtime needed)

---

## 📊 Time Summary

| Phase | Duration | Complexity | Risk | Dependencies |
|-------|----------|------------|------|--------------|
| Phase 1: Cleanup | 1 week | Low | Low | None |
| Phase 2: Reorganization | 1 week | Medium | Medium | Phase 1 |
| Phase 3: Type Safety | 1 week | Medium | Low | Phase 2 |
| Phase 4: Technical Debt | 1 week | Medium | Low | Phase 3 |
| Phase 5: Convex Migration | 2 weeks | High | High | Phase 2,3 |
| Phase 6: Testing | 2 weeks | Medium | Low | Phase 1-5 |

**Total:** 8 weeks (with parallel work possible)

---

## 🤔 Questions Before We Begin

I need to clarify a few things to finalize this plan:

1. **Convex Setup:** Do you already have a Convex project set up? Do you need help creating one?

2. **Migration Timing:** When do you want to schedule the Supabase → Convex migration? (Can be done with zero downtime using dual-write)

3. **Team Size:** Will you be working alone or with others? This affects parallelization possibilities.

4. **Priority Order:** Given 8 weeks, would you prefer to:
   - A) Focus on cleanup first, then migration
   - B) Focus on getting Convex migration done, then clean up
   - C) Something else?

Let me know your answers and I'll adjust the plan accordingly!
