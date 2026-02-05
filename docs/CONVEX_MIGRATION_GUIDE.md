# Phase 5: Convex Migration Guide

This guide covers migrating from Supabase to Convex as the primary database.

## Overview

**Why Convex?**
- Zero-config backend with built-in real-time sync
- No connection pooling issues
- Automatic schema management
- Better TypeScript support
- Simplified deployment

**Migration Status:** Phase 5 - In Progress

---

## Prerequisites

1. **Convex Account**
   - Sign up at https://convex.dev
   - Create a new project

2. **Environment Variables**
   ```bash
   # Add to .env
   CONVEX_URL=https://your-project.convex.cloud
   ```

3. **Install Convex CLI**
   ```bash
   npm install -g convex-dev
   # Or use npx
   npx convex dev
   ```

---

## Step 1: Initialize Convex Project

```bash
cd packages/api
npx convex dev
```

This will:
- Create a `convex/` directory
- Set up your Convex deployment
- Generate `convex/_generated/` types

---

## Step 2: Schema Migration

The schema has been defined in `convex/convex.config.ts`:

### Tables Created:
- `users` - User accounts
- `projects` - Project metadata
- `tasks` - AI generation tasks
- `generated_files` - Code output
- `connections` - OAuth connections
- `deployments` - Deployment records
- `audit_logs` - Security logs
- `learning_contexts` - AI learning data
- `benchmarks` - Performance metrics

---

## Step 3: Deploy Schema

```bash
npx convex deploy
```

This deploys your schema and functions to Convex.

---

## Step 4: Data Migration

### Check Migration Status
```bash
npm run migrate:status
```

### Export from Supabase
```bash
npm run migrate:export
```

### Import to Convex
```bash
npm run migrate:import
```

### Run Full Migration
```bash
npm run migrate:run
```

### Validate Migration
```bash
npm run migrate:validate
```

---

## Step 5: Update Application Code

### Database Client Import
```typescript
// Old (Supabase)
import { getSupabaseAdmin } from './infrastructure/database/database-client.js';

// New (Convex)
import { getConvexClient } from './infrastructure/database/convex-client.js';
```

### Query Pattern
```typescript
// Old (Supabase)
const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

// New (Convex) - using functions
import { api } from '../../convex/_generated';
import { Id } from '../../convex/_generated/dataModel';

const client = getConvexClient();
const user = await client.query(api.users.getByEmail, { email });
```

### Mutation Pattern
```typescript
// Old (Supabase)
const { data, error } = await supabase
    .from('users')
    .insert({ email, name });

// New (Convex)
const client = getConvexClient();
const userId = await client.mutation(api.users.upsert, { email, name });
```

---

## Step 6: Health Check Verification

After migration, verify the health check:

```bash
curl http://localhost:3000/health/deep
```

Expected response:
```json
{
  "status": "healthy",
  "checks": {
    "convex": {
      "status": "healthy"
    },
    "supabase": {
      "status": "unhealthy"  // Expected, as we migrate away
    }
  }
}
```

---

## File Structure

```
packages/api/
├── convex/
│   ├── convex.config.ts       # Schema definition
│   ├── users.ts               # User functions
│   ├── projects.ts            # Project functions
│   ├── tasks.ts               # Task functions
│   ├── connections.ts         # Connection functions
│   └── _generated/            # Auto-generated types
├── src/
│   ├── infrastructure/
│   │   └── database/
│   │       ├── convex-client.ts       # Convex client wrapper
│   │       ├── convex-migration.ts    # Migration utilities
│   │       └── database-client.ts     # Unified DB exports
│   ├── cli/
│   │   └── migrate.ts          # Migration CLI
│   └── routes/
│       └── health.ts           # Updated health checks
```

---

## Migration Checklist

- [ ] Convex account created
- [ ] `CONVEX_URL` added to `.env`
- [ ] Schema deployed (`npx convex deploy`)
- [ ] Migration status checked
- [ ] Data exported from Supabase
- [ ] Data imported to Convex
- [ ] Migration validated
- [ ] Health check verified
- [ ] Application code updated
- [ ] Tests updated
- [ ] TODO: Remove Supabase dependencies after validation

---

## Rollback Plan

If you need to rollback to Supabase:

1. Revert code changes to use Supabase client
2. Ensure `SUPABASE_URL` and keys are set
3. Restart the application

The health check still reports Supabase status, so you can monitor both databases during the transition period.

---

## Troubleshooting

### Error: "CONVEX_URL not set"
**Solution:** Add `CONVEX_URL=https://your-project.convex.cloud` to `.env`

### Error: "Function not found"
**Solution:** Run `npx convex deploy` to deploy your functions

### Error: "Type 'Id<...>' not found"
**Solution:** Run `npx convex dev` to generate types

### Migration hangs or times out
**Solution:** Check Supabase connection - ensure service role key has proper permissions

---

## Performance Considerations

| Metric | Supabase | Convex |
|--------|----------|--------|
| Connection Pool | Required | Not needed |
| Query Latency | ~50-200ms | ~10-50ms |
| Real-time | Manual (WebSockets) | Built-in |
| Schema Management | Manual migrations | Auto-sync |
| TypeScript Support | Generated | First-class |

---

## Next Steps

After migration is complete:

1. **Phase 6:** Update all services to use Convex
2. **Phase 7:** Remove Supabase dependencies
3. **Phase 8:** Update TODO items that were blocked by database issues
4. **Phase 9:** Optimize Convex queries with indexes

---

## Support

- Convex Docs: https://www.convex.dev/docs
- Convex Discord: https://discord.gg/convex-dev
- GitHub Issues: Report database-related issues
