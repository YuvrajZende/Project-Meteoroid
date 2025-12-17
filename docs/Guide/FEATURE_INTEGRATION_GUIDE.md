# 🚀 Feature Integration Roadmap

A step-by-step guide for properly connecting new features to the Loveable Backend system.

---

## 📋 Overview

When adding a new feature (like Multi-Model Orchestrator), you need to connect it to **7 key layers**:

```
┌─────────────────────────────────────────────────────────────────┐
│                        LAYER 1: SERVICE                         │
│         Create the core service file with all logic             │
├─────────────────────────────────────────────────────────────────┤
│                        LAYER 2: EXPORTS                         │
│         Export from services/index.ts for easy imports          │
├─────────────────────────────────────────────────────────────────┤
│                        LAYER 3: INTEGRATION                     │
│         Connect to IntegratedOrchestrator (the brain)           │
├─────────────────────────────────────────────────────────────────┤
│                        LAYER 4: API ROUTES                      │
│         Add HTTP endpoints for external access                  │
├─────────────────────────────────────────────────────────────────┤
│                        LAYER 5: STARTUP                         │
│         Initialize at server startup (index.ts)                 │
├─────────────────────────────────────────────────────────────────┤
│                        LAYER 6: CONFIGURATION                   │
│         Add .env variables and documentation                    │
├─────────────────────────────────────────────────────────────────┤
│                   LAYER 7: DATABASE (If Needed)                 │
│       Create migration, update schema, persist data             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Layer 1: Create the Service

**Location**: `packages/api/src/services/[feature-name].ts`

### Checklist:
- [ ] Create the main class (e.g., `MultiModelOrchestrator`)
- [ ] Define TypeScript interfaces for input/output
- [ ] Add a singleton getter (e.g., `getMultiModelOrchestrator()`)
- [ ] Add initialization method if needed
- [ ] Add proper error handling
- [ ] Add console logging with prefix (e.g., `[MULTI-MODEL]`)

### Template:
```typescript
// packages/api/src/services/my-feature.ts

export interface MyFeatureConfig {
    option1: string;
    option2: boolean;
}

export interface MyFeatureResult {
    success: boolean;
    data: unknown;
}

export class MyFeatureService {
    private config: MyFeatureConfig;
    private initialized = false;

    constructor(config?: Partial<MyFeatureConfig>) {
        this.config = {
            option1: config?.option1 || process.env.MY_FEATURE_OPTION1 || 'default',
            option2: config?.option2 ?? true,
        };
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;
        console.log('[MY-FEATURE] Initializing...');
        // Setup logic here
        this.initialized = true;
        console.log('[MY-FEATURE] Initialization complete');
    }

    async execute(input: string): Promise<MyFeatureResult> {
        // Main logic here
        return { success: true, data: {} };
    }
}

// Singleton instance
let instance: MyFeatureService | null = null;

export function getMyFeatureService(): MyFeatureService {
    if (!instance) {
        instance = new MyFeatureService();
    }
    return instance;
}
```

---

## 📦 Layer 2: Export from services/index.ts

**Location**: `packages/api/src/services/index.ts`

### Add to exports:
```typescript
// ============================================
// MY FEATURE SERVICE (Phase XX)
// ============================================
export {
    MyFeatureService,
    getMyFeatureService,
    type MyFeatureConfig,
    type MyFeatureResult,
} from './my-feature.js';
```

### Why this matters:
- Allows clean imports: `import { getMyFeatureService } from './services/index.js'`
- Single source of truth for all services
- Easy to track what's available

---

## 🧠 Layer 3: Integrate with IntegratedOrchestrator

**Location**: `packages/api/src/services/integrated-orchestrator.ts`

This is the **BRAIN** of the system. If your feature should be used during code generation, it MUST be connected here.

### Step 1: Add imports
```typescript
import { getMyFeatureService, type MyFeatureService } from './my-feature.js';
```

### Step 2: Add to class properties
```typescript
export class IntegratedOrchestrator {
    private config: IntegratedOrchestratorConfig & { useMyFeature: boolean };
    private myFeatureService: MyFeatureService;
    // ... other properties
```

### Step 3: Initialize in constructor
```typescript
constructor(config?: Partial<IntegratedOrchestratorConfig & { useMyFeature: boolean }>) {
    this.config = {
        // ... existing config
        useMyFeature: config?.useMyFeature ?? true, // Enable by default
    };

    // Initialize services
    this.myFeatureService = getMyFeatureService();
}
```

### Step 4: Use in orchestration flow
```typescript
// In the orchestrate() method or relevant section:
if (this.config.useMyFeature) {
    addStep('my-feature', 'Using my feature...', undefined, agent);
    const result = await this.myFeatureService.execute(input);
    // Handle result
}
```

### Step 5: Update OrchestrationStep type (if new phases)
```typescript
export interface OrchestrationStep {
    phase: 'init' | 'thinking' | 'my-feature' | 'execution' | 'finalize';
    // ...
}
```

---

## 🌐 Layer 4: Add API Routes (Optional)

**Location**: `packages/api/src/routes/[feature-name].ts`

If your feature needs HTTP endpoints:

### Create route file:
```typescript
// packages/api/src/routes/my-feature.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getMyFeatureService } from '../services/index.js';

export async function myFeatureRoutes(app: FastifyInstance): Promise<void> {
    const service = getMyFeatureService();

    app.get('/api/v1/my-feature/status', async (request: FastifyRequest, reply: FastifyReply) => {
        return { status: 'ready' };
    });

    app.post('/api/v1/my-feature/execute', async (request: FastifyRequest, reply: FastifyReply) => {
        const result = await service.execute('input');
        return result;
    });

    console.log('[ROUTES] My Feature routes registered: /api/v1/my-feature/*');
}
```

### Register in routes/index.ts:
```typescript
import { myFeatureRoutes } from './my-feature.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
    // ... existing routes
    await app.register(myFeatureRoutes);
}
```

---

## 🚀 Layer 5: Server Startup (index.ts)

**Location**: `packages/api/src/index.ts`

Add startup logging and initialization:

```typescript
import { getMyFeatureService } from './services/index.js';

// In the startup section:
const myFeature = getMyFeatureService();

console.log(`
  🆕 MY FEATURE
  ----------------------------------------------------------------
  Enabled:        ${myFeature.isEnabled() ? '✅' : '❌'}
  Config Option:  ${process.env.MY_FEATURE_OPTION1 || 'default'}
  ----------------------------------------------------------------
`);
```

---

## ⚙️ Layer 6: Configuration

### .env.example
```env
# -----------------
# My Feature (Phase XX)
# -----------------
MY_FEATURE_OPTION1=value
MY_FEATURE_ENABLED=true
```

### PERSON1_TASK_LIST.md
Document the feature status:
```markdown
## Phase XX: My Feature
- [x] Create MyFeatureService
- [x] Export from services/index.ts
- [x] Integrate with IntegratedOrchestrator
- [x] Add API routes
- [x] Add startup logging
- [x] Add .env configuration
- [x] Create database migration (if storing data)
- [x] Add persistence logic to service
- [x] Test feature
```

---

## 🗄️ Layer 7: Database (If Feature Stores Data)

**⚠️ CRITICAL:** If your feature stores ANY data, you MUST complete this layer!

### When Do You Need Database Persistence?

| Feature Type | Needs Database? |
|--------------|-----------------|
| Cost tracking | ✅ YES - Store cost records |
| Agent benchmarks | ✅ YES - Store performance metrics |
| User preferences | ✅ YES - Store settings |
| Analytics data | ✅ YES - Store metrics |
| Temporary calculations | ❌ NO - Keep in memory |
| Configuration | ❌ NO - Use .env |

---

### Step 1: Create Migration File

**Location:** `packages/database/src/migrations/XXX_feature_name.sql`

Use the next available number (e.g., `005_my_feature.sql`).

### Migration Template:

```sql
-- =====================================================
-- MY FEATURE MIGRATION (Phase XX)
-- =====================================================
-- Description: What this migration adds

-- =====================================================
-- TABLE DEFINITION
-- =====================================================

CREATE TABLE IF NOT EXISTS my_feature_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Core data fields
    name TEXT NOT NULL,
    value NUMERIC(10, 4) NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}' NOT NULL,
    
    -- Context fields (for tracking)
    task_id TEXT,                    -- String task identifier
    project_id UUID,                 -- Must be valid UUID or NULL
    user_id UUID,                    -- Must be valid UUID or NULL
    
    -- Status fields
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_my_feature_records_task_id 
    ON my_feature_records(task_id);
CREATE INDEX IF NOT EXISTS idx_my_feature_records_created_at 
    ON my_feature_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_my_feature_records_success 
    ON my_feature_records(success);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE my_feature_records ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for API server)
CREATE POLICY "Service full access to my_feature_records"
    ON my_feature_records FOR ALL
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE my_feature_records IS 'Stores records for My Feature';

-- =====================================================
-- RELOAD SCHEMA CACHE (Required for Supabase)
-- =====================================================
NOTIFY pgrst, 'reload config';
```

---

### Step 2: Add Persistence to Your Service

Update your service class to save data to Supabase:

```typescript
// In your service file (e.g., my-feature.ts)

import { getSupabaseAdmin } from './database-client.js';
import { v4 as uuidv4 } from 'uuid';

export class MyFeatureService {
    private supabaseEnabled: boolean = false;
    private pendingRecords: MyFeatureRecord[] = [];
    private flushInterval: NodeJS.Timeout | null = null;

    constructor() {
        // Check if Supabase is configured
        this.supabaseEnabled = !!(
            process.env.SUPABASE_URL && 
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        if (this.supabaseEnabled) {
            console.log('[MY-FEATURE] Supabase persistence enabled');
            // Flush pending records every 30 seconds
            this.flushInterval = setInterval(
                () => this.flushPendingRecords(), 
                30000
            );
        }
    }

    // Helper: Validate UUID format
    private isValidUUID(str: string | undefined): boolean {
        if (!str) return false;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
    }

    // Save a record (queues for batch insert)
    recordData(data: MyFeatureRecord): void {
        // Always keep in memory for fast access
        this.memoryCache.push(data);

        // Queue for database persistence
        if (this.supabaseEnabled) {
            this.pendingRecords.push(data);
        }
    }

    // Batch insert to database
    private async flushPendingRecords(): Promise<void> {
        if (!this.supabaseEnabled || this.pendingRecords.length === 0) {
            return;
        }

        const recordsToFlush = [...this.pendingRecords];
        this.pendingRecords = [];

        try {
            const supabase = getSupabaseAdmin();

            // Transform to database format
            const dbRecords = recordsToFlush.map(record => ({
                id: uuidv4(),
                name: record.name,
                value: record.value,
                metadata: record.metadata || {},
                task_id: record.taskId || null,
                // IMPORTANT: Only insert valid UUIDs!
                project_id: this.isValidUUID(record.projectId) 
                    ? record.projectId 
                    : null,
                user_id: this.isValidUUID(record.userId) 
                    ? record.userId 
                    : null,
                success: record.success,
                error: record.error || null,
                created_at: record.timestamp,
            }));

            const { error } = await supabase
                .from('my_feature_records')
                .insert(dbRecords);

            if (error) {
                console.error('[MY-FEATURE] Failed to persist:', error);
                // Put records back for retry
                this.pendingRecords.unshift(...recordsToFlush);
            } else {
                console.log(
                    `[MY-FEATURE] Persisted ${recordsToFlush.length} records`
                );
            }
        } catch (error) {
            console.error('[MY-FEATURE] Persistence error:', error);
            this.pendingRecords.unshift(...recordsToFlush);
        }
    }

    // Graceful shutdown - flush remaining records
    async shutdown(): Promise<void> {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
        await this.flushPendingRecords();
        console.log('[MY-FEATURE] Shutdown complete');
    }
}
```

---

### Step 3: Add Shutdown Hook

**Location:** `packages/api/src/index.ts`

```typescript
import { getMyFeatureService } from './services/index.js';

// In the shutdown handler:
const shutdown = async (signal: string) => {
    // ... existing shutdown code ...

    // Flush my feature records
    const myFeature = getMyFeatureService();
    await myFeature.shutdown();

    // ... rest of shutdown ...
};
```

---

### Step 4: Run Migration in Supabase

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy your migration file content
4. Run the SQL

**Alternative:** Use the Supabase CLI:
```bash
supabase db push
```

---

### ⚠️ Common Database Pitfalls

| Problem | Solution |
|---------|----------|
| `invalid input syntax for type uuid` | Use `isValidUUID()` helper to validate before insert |
| `relation "X" does not exist` | Run the migration in Supabase first |
| `Could not find table in schema cache` | Add `NOTIFY pgrst, 'reload config';` at end of migration |
| Records not appearing | Check if `flushPendingRecords()` is being called |
| RLS blocking inserts | Make sure you're using `getSupabaseAdmin()` (service role) |

---

### UUID Validation Pattern

**IMPORTANT:** If your table has UUID columns for `project_id` or `user_id`, you MUST validate before inserting. Test strings like `"test-project"` will cause errors!

```typescript
// WRONG: Will crash if projectId is "test-project"
project_id: record.projectId

// CORRECT: Validates and uses NULL if invalid
project_id: this.isValidUUID(record.projectId) ? record.projectId : null
```

---

## 🔗 Connection Diagram

```
                    ┌─────────────────┐
                    │   index.ts      │ ← Server startup + shutdown hooks
                    │  (Entry Point)  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  routes/index   │ ← Registers HTTP endpoints
                    │                 │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
┌────────▼────────┐ ┌────────▼────────┐ ┌────────▼────────┐
│ routes/health   │ │routes/orchestr │ │routes/my-feature│
└─────────────────┘ └────────┬────────┘ └────────┬────────┘
                             │                   │
                    ┌────────▼───────────────────▼────────┐
                    │       IntegratedOrchestrator        │
                    │           (The Brain)               │
                    │  - Uses all services                │
                    │  - Orchestrates AI calls            │
                    │  - Manages agents                   │
                    └────────┬───────────────────┬────────┘
                             │                   │
              ┌──────────────┼───────────────────┼──────────────┐
              │              │                   │              │
     ┌────────▼────┐ ┌───────▼───────┐ ┌────────▼────┐ ┌───────▼───────┐
     │ AIClient    │ │MultiModelOrch │ │CostTracker  │ │MyFeatureServ  │
     │             │ │               │ │             │ │               │
     └─────────────┘ └───────────────┘ └──────┬──────┘ └───────┬───────┘
              │              │                │                │
              └──────────────┴────────────────┴────────────────┘
                                      │
                          ┌───────────▼───────────┐
                          │   services/index.ts   │ ← All exports here
                          └───────────┬───────────┘
                                      │
                          ┌───────────▼───────────┐
                          │   database-client.ts  │ ← Supabase connection
                          └───────────┬───────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
          ┌─────────▼─────────┐             ┌──────────▼──────────┐
          │  SUPABASE TABLES  │             │     MIGRATIONS      │
          │  - cost_records   │             │  - 003_cost.sql     │
          │  - agent_bench... │             │  - 004_bench.sql    │
          │  - orchestr_metr  │             │  - XXX_feature.sql  │
          └───────────────────┘             └─────────────────────┘
```

---

## ✅ Integration Checklist

When adding ANY new feature, verify:

| Step | File | Action |
|------|------|--------|
| 1 | `services/[feature].ts` | Create service class |
| 2 | `services/index.ts` | Export service and types |
| 3 | `services/integrated-orchestrator.ts` | Import and use service |
| 4 | `routes/[feature].ts` | Create API routes (if needed) |
| 5 | `routes/index.ts` | Register routes |
| 6 | `index.ts` | Add startup logging + shutdown hook |
| 7 | `.env.example` | Add configuration variables |
| 8 | **`migrations/XXX_feature.sql`** | **Create table if storing data** |
| 9 | **Run migration in Supabase** | **Apply schema changes** |
| 10 | `PERSON1_TASK_LIST.md` | Document the feature |
| 11 | Run tests | Verify everything works |

---

## 🔍 Debugging Integration Issues

### Common Problems:

1. **Service not used at runtime**
   - Check: Is it imported in IntegratedOrchestrator?
   - Check: Is the config flag enabled?

2. **API route 404**
   - Check: Is route registered in routes/index.ts?
   - Check: Is the path correct?

3. **Environment variable not found**
   - Check: Is it in .env file (not just .env.example)?
   - Check: Is the server restarted?

4. **TypeScript errors**
   - Check: Are types exported from services/index.ts?
   - Check: Did you add new phases to OrchestrationStep type?

---

## 📝 Example: Multi-Model Integration

Here's how Multi-Model was integrated:

| Layer | File | What was added |
|-------|------|----------------|
| 1 | `multi-model-orchestrator.ts` | Created MultiModelOrchestrator class |
| 2 | `services/index.ts` | Exported getMultiModelOrchestrator |
| 3 | `integrated-orchestrator.ts` | Added useMultiModel config, imported and used in code generation |
| 4 | (Not needed) | Uses existing /orchestrator/execute endpoint |
| 5 | `index.ts` | Added startup log + shutdown hook for cost tracker |
| 6 | `.env.example` | Added FAST_MODEL_*, POWER_MODEL_*, and budget variables |
| 7 | `003_cost_tracking.sql` | Created `cost_records` and `budget_limits` tables |
| 7 | `004_benchmarking.sql` | Created `agent_benchmarks` and `orchestrator_metrics` tables |

---

## 📝 Example: Cost Tracker Database Integration

Here's how cost tracking was integrated with the database:

| Step | File | What was done |
|------|------|---------------|
| 1 | `cost-tracker.ts` | Added `supabaseEnabled` check in constructor |
| 2 | `cost-tracker.ts` | Added `pendingPersistence` array for batching |
| 3 | `cost-tracker.ts` | Added `flushPendingRecords()` with UUID validation |
| 4 | `cost-tracker.ts` | Added `shutdown()` method for graceful flush |
| 5 | `index.ts` | Added `costTracker.shutdown()` to shutdown handler |
| 6 | `003_cost_tracking.sql` | Created table, indexes, RLS policies |
| 7 | Supabase Dashboard | Ran migration SQL |

---

## 📝 Example: Architecture Blueprint Generator (Phase 20)

Here's how the Architecture Blueprint was integrated:

| Layer | File | What was added |
|-------|------|----------------|
| 1 | `architecture-blueprint.ts` | Created ArchitectureBlueprintGenerator with ASCII templates |
| 2 | `services/index.ts` | Exported getArchitectureBlueprintGenerator and types |
| 3 | `multi-model-orchestrator.ts` | Added Stage 1.5 blueprint generation, passed to Stage 2 |
| 4 | (Not needed) | Uses existing /orchestrator/execute endpoint - blueprint in response |
| 5 | `index.ts` | No startup changes needed (stateless generator) |
| 6 | `PROJECT_CONTEXT.md` | Documented Phase 20 features |
| 7 | (Not needed) | No database persistence - in-memory generation |

### Key Design Decisions:
- **In-memory only**: Blueprints are generated on-demand, not stored
- **Integration point**: Stage 1.5 between analysis and code generation
- **Graceful fallback**: If blueprint fails, continue with normal generation
- **ASCII format**: Matches existing `Whole system.md` for consistency

---

## 🎯 Best Practices

1. **Always use singletons** - Use `getXXXService()` pattern for consistency
2. **Add console logs** - Use prefixes like `[FEATURE-NAME]` for debugging
3. **Config via .env** - All settings should be configurable
4. **Enable by default** - New features should work out of the box
5. **Graceful fallback** - If feature fails, don't crash the main flow
6. **Document immediately** - Update PROJECT_CONTEXT.md as you go
7. **Validate UUIDs** - Always use `isValidUUID()` before database insert
8. **Batch inserts** - Queue records and flush periodically for performance
9. **Add shutdown hooks** - Flush pending records before server shutdown
10. **Run migrations first** - Always apply SQL before deploying code changes
11. **Use ASCII diagrams** - Generate architecture blueprints for complex features
