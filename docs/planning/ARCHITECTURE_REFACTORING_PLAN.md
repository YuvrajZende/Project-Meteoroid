# 🏗️ Architecture Refactoring Plan

## Phase 27: Production-Ready Architecture Consolidation

**Created**: 2024-12-22
**Priority**: HIGH
**Estimated Effort**: 4-6 hours
**Pre-requisite**: Commit current Phase 26 work first!

---

## 📋 Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Target Architecture](#target-architecture)
3. [Folder Structure Reorganization](#folder-structure-reorganization)
4. [Dead Code Identification](#dead-code-identification)
5. [Service Consolidation Plan](#service-consolidation-plan)
6. [ServiceRegistry Integration](#serviceregistry-integration)
7. [Implementation Steps](#implementation-steps)
8. [Testing Strategy](#testing-strategy)

---

## 1. Current State Analysis

### 📊 Services Inventory (52 files)

| Category | Files | Status |
|----------|-------|--------|
| **Orchestrators** (3) | `orchestrator.ts`, `integrated-orchestrator.ts`, `multi-model-orchestrator.ts` | ⚠️ DUPLICATE |
| **Code Generators** (5) | `codegen-service.ts`, `enhanced-code-generator.ts`, `database-generator.ts`, `route-generator.ts`, `complete-project-generator.ts` | ⚠️ FRAGMENTED |
| **Context/Memory** (4) | `persistent-context.ts`, `generation-context.ts`, `enhanced-learning-context.ts`, `core-services.ts` | ⚠️ OVERLAPPING |
| **Learning** (3) | `learning-service.ts`, `enhanced-learning-context.ts`, `vector-learning-system.ts` | ⚠️ OVERLAPPING |
| **Templates** (3) | `agent-templates.ts`, `framework-templates.ts`, `prompt-templates.ts` | ⚠️ FRAGMENTED |
| **Validation** (3) | `code-validator.ts`, `code-postprocessor.ts`, `project-integrity-validator.ts` | ⚠️ CAN MERGE |
| **Registry** (4) | `dependency-registry.ts`, `import-registry.ts`, `agent-registry.ts`, `model-registry.ts` | ✅ OK |
| **Infrastructure** (5) | `ai-client.ts`, `database-client.ts`, `file-writer.ts`, `job-queue.ts`, `key-manager.ts` | ✅ OK |
| **Third-Party** (3) | `deployment-service.ts`, `github-service.ts`, `preview-service.ts` | ✅ OK |
| **AI Features** (4) | `ai-intent-analyzer.ts`, `intent-classifier.ts`, `entity-extractor.ts`, `quality-assessment.ts` | ✅ OK |
| **Architecture** (3) | `architecture-blueprint.ts`, `architecture-knowledge.ts`, `project-scaffold.ts` | ⚠️ OVERLAPPING |
| **Other** (12) | Various utility services | 🔍 REVIEW |

### 🔴 Critical Issues

1. **IntegratedOrchestrator is 68KB** - God object anti-pattern
2. **3 different orchestrators** - Unclear which to use
3. **5 code generators** - Should be unified
4. **ServiceRegistry unused** - Stripe, Sentry, Resend definitions exist but don't feed into generation
5. **No clear separation** - All 52 files in flat structure

---

## 2. Target Architecture

### 🎯 Goals

1. **Single Orchestration Pipeline** - One clear flow
2. **Unified Code Generation** - One generator with plugins
3. **Clear Folder Structure** - Category-based organization
4. **Production-Ready Quality** - Validation at every step
5. **ServiceRegistry Integration** - Third-party services in prompts

### 📐 New Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    MAIN ORCHESTRATOR                            │
│                 (simplified, < 500 lines)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   ANALYSIS   │ →  │  GENERATION  │ →  │  VALIDATION  │      │
│  │    Phase     │    │    Phase     │    │    Phase     │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ AIAnalyzer   │    │ CodeGenerator│    │ CodeValidator│      │
│  │ EntityExtr.  │    │ (unified)    │    │ PostProcessor│      │
│  │ ServiceCtx   │    │              │    │ IntegrityVal.│      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┤
│  │                    SHARED SERVICES                          │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │  │Registry │ │Learning │ │Context  │ │Templates│           │
│  │  │Services │ │System   │ │Manager  │ │Engine   │           │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│  └─────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┤
│  │                    INFRASTRUCTURE                           │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │  │AIClient │ │Database │ │FileIO   │ │Queue    │           │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│  └─────────────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Folder Structure Reorganization

### 📁 Current Structure (FLAT - BAD)

```
packages/api/src/services/
├── orchestrator.ts
├── integrated-orchestrator.ts
├── multi-model-orchestrator.ts
├── codegen-service.ts
├── enhanced-code-generator.ts
├── ... (49 more files in same folder!)
```

### 📁 Target Structure (CATEGORIZED - GOOD)

```
packages/api/src/services/
│
├── orchestration/
│   ├── index.ts                    # Main export
│   ├── orchestrator.ts             # CONSOLIDATED (merge all 3)
│   ├── pipeline-phases.ts          # Analysis → Generation → Validation
│   └── types.ts                    # Orchestration types
│
├── generation/
│   ├── index.ts                    # Main export
│   ├── code-generator.ts           # UNIFIED (merge 5 generators)
│   ├── language-adapters/
│   │   ├── typescript.ts
│   │   ├── python.ts
│   │   ├── go.ts
│   │   └── index.ts
│   ├── templates/
│   │   ├── framework-templates.ts  # (merged templates)
│   │   ├── prompt-templates.ts
│   │   └── index.ts
│   └── types.ts
│
├── validation/
│   ├── index.ts
│   ├── code-validator.ts           # Syntax validation
│   ├── code-postprocessor.ts       # Cleaning & formatting
│   ├── project-validator.ts        # RENAMED from project-integrity-validator
│   └── types.ts
│
├── registry/
│   ├── index.ts
│   ├── dependency-registry.ts
│   ├── import-registry.ts
│   ├── agent-registry.ts
│   ├── model-registry.ts
│   ├── service-registry/           # (existing)
│   │   ├── index.ts
│   │   ├── types.ts
│   │   └── services/
│   └── types.ts
│
├── context/
│   ├── index.ts
│   ├── context-manager.ts          # CONSOLIDATED (merge 4)
│   ├── generation-context.ts
│   └── types.ts
│
├── learning/
│   ├── index.ts
│   ├── learning-service.ts         # CONSOLIDATED (merge 3)
│   ├── vector-store.ts
│   └── types.ts
│
├── analysis/
│   ├── index.ts
│   ├── intent-analyzer.ts          # MERGED (ai-intent + intent-classifier)
│   ├── entity-extractor.ts
│   ├── quality-assessment.ts
│   └── types.ts
│
├── architecture/
│   ├── index.ts
│   ├── blueprint-service.ts        # MERGED (blueprint + knowledge + scaffold)
│   └── types.ts
│
├── infrastructure/
│   ├── index.ts
│   ├── ai-client.ts
│   ├── database-client.ts
│   ├── file-writer.ts
│   ├── job-queue.ts
│   ├── key-manager.ts
│   ├── cost-tracker.ts
│   └── types.ts
│
├── integrations/
│   ├── index.ts
│   ├── github-service.ts
│   ├── deployment-service.ts
│   ├── preview-service.ts
│   ├── auto-deploy-manager.ts
│   ├── connection-manager/
│   └── types.ts
│
├── agents/
│   ├── index.ts
│   ├── agent-coordinator.ts
│   ├── agent-loader.ts
│   ├── agent-stack-constraints.ts
│   ├── adapters/                   # (existing)
│   └── types.ts
│
├── security/
│   ├── index.ts
│   ├── mfa-service.ts
│   └── types.ts
│
└── index.ts                        # Main barrel export
```

---

## 4. Dead Code Identification

### 🗑️ Files to REMOVE (After verification)

| File | Reason | Action |
|------|--------|--------|
| `orchestrator.ts` | Replaced by `integrated-orchestrator.ts` | DELETE after merge |
| `robust-json-parser.ts` | Not imported anywhere | VERIFY then DELETE |
| `interactive-service-selector.ts` | Not imported anywhere | VERIFY then DELETE |
| `setup-guide-generator.ts` | Not imported anywhere | VERIFY then DELETE |
| `test-generator.ts` | Incomplete, unused | VERIFY then DELETE |

### 🔍 Files to VERIFY Usage

```bash
# To check if a file is imported anywhere:
grep -r "from './robust-json-parser" packages/api/src/
grep -r "from './interactive-service-selector" packages/api/src/
grep -r "from './setup-guide-generator" packages/api/src/
grep -r "from './test-generator" packages/api/src/
```

### ⚠️ Services to REVIEW

| Service | Current Status | Decision |
|---------|---------------|----------|
| `service-registry/services/stripe.ts` | Defined but unused in generation | INTEGRATE or REMOVE |
| `service-registry/services/sentry.ts` | Defined but unused in generation | INTEGRATE or REMOVE |
| `service-registry/services/resend.ts` | Defined but unused in generation | INTEGRATE or REMOVE |
| `service-registry/services/github-actions.ts` | Defined but unused in generation | INTEGRATE or REMOVE |

---

## 5. Service Consolidation Plan

### 5.1 Orchestrator Consolidation

**MERGE**: `orchestrator.ts` + `integrated-orchestrator.ts` + `multi-model-orchestrator.ts`
**INTO**: `orchestration/orchestrator.ts`

```typescript
// New structure
export class Orchestrator {
    private phases: {
        analysis: AnalysisPhase;
        generation: GenerationPhase;
        validation: ValidationPhase;
    };
    
    async execute(input: OrchestrationInput): Promise<OrchestrationResult> {
        const analysis = await this.phases.analysis.run(input);
        const generated = await this.phases.generation.run(analysis);
        const validated = await this.phases.validation.run(generated);
        return validated;
    }
}
```

### 5.2 Code Generator Consolidation

**MERGE**: 5 generators → 1 unified generator

| Original | Functionality | Target Location |
|----------|--------------|-----------------|
| `codegen-service.ts` | Basic generation | `generation/code-generator.ts` |
| `enhanced-code-generator.ts` | Multi-lang | `generation/code-generator.ts` |
| `database-generator.ts` | Prisma schemas | `generation/code-generator.ts` (plugin) |
| `route-generator.ts` | API routes | `generation/code-generator.ts` (plugin) |
| `complete-project-generator.ts` | Full projects | `generation/code-generator.ts` (plugin) |

```typescript
// New unified generator
export class CodeGenerator {
    private plugins: Map<string, GeneratorPlugin>;
    
    registerPlugin(type: string, plugin: GeneratorPlugin): void;
    
    async generate(request: GenerationRequest): Promise<GeneratedOutput> {
        // Uses appropriate plugin based on request type
    }
}
```

### 5.3 Context Consolidation

**MERGE**: 4 context services → 2 focused services

| Original | Functionality | Target |
|----------|--------------|--------|
| `core-services.ts` (ContextManager) | Core context | `context/context-manager.ts` |
| `generation-context.ts` | Generation state | `context/generation-context.ts` |
| `persistent-context.ts` | Persistence | MERGE into `context-manager.ts` |
| `enhanced-learning-context.ts` | Learning | MERGE into `learning/learning-service.ts` |

### 5.4 Learning Consolidation

**MERGE**: 3 learning services → 1 unified service

| Original | Target |
|----------|--------|
| `learning-service.ts` | `learning/learning-service.ts` |
| `enhanced-learning-context.ts` | MERGE IN |
| `vector-learning-system.ts` | MERGE IN |
| `vector-store.ts` | `learning/vector-store.ts` (keep separate) |

---

## 6. ServiceRegistry Integration

### Current Problem

The ServiceRegistry contains service definitions (Stripe, Sentry, Resend, Supabase, GitHub Actions) but these are NOT used in code generation prompts.

### Solution: Wire into Generation Pipeline

```typescript
// In generation/code-generator.ts

async generateWithServices(
    request: GenerationRequest,
    userId: string
): Promise<GeneratedOutput> {
    // 1. Get user's connected services
    const connections = await this.connectionManager.getUserConnections(userId);
    const services = connections.map(c => this.serviceRegistry.getService(c.serviceId));
    
    // 2. Build service context for AI prompt
    const serviceContext = services.map(s => ({
        name: s.name,
        capabilities: s.capabilities,
        instructions: s.agentInstructions,
        templates: s.codeTemplates
    }));
    
    // 3. Inject into prompt
    const prompt = this.buildPrompt(request, {
        availableServices: serviceContext,
        // Include which services to integrate
        integrateServices: request.services || []
    });
    
    // 4. Generate code with service awareness
    return this.generate(prompt);
}
```

### Required Changes

1. **Add service context to prompts**:

```typescript
// In prompt-templates.ts
export function buildGenerationPrompt(
    request: GenerationRequest,
    context: GenerationContext,
    services: ServiceContext[]
): string {
    return `
You are generating code for a ${request.framework} project.

AVAILABLE SERVICES (integrate if requested):
${services.map(s => `
- ${s.name}
  Capabilities: ${s.capabilities.join(', ')}
  Instructions: ${s.instructions}
`).join('\n')}

USER REQUEST: ${request.prompt}

${request.integrateServices?.length > 0 
    ? `MUST INTEGRATE THESE SERVICES: ${request.integrateServices.join(', ')}`
    : ''}
    `;
}
```

2. **Update API routes**:

```typescript
// In routes/codegen.ts
app.post('/api/v1/generate', async (request, reply) => {
    const { prompt, services } = request.body;
    const userId = request.user.id;
    
    const result = await codeGenerator.generateWithServices({
        prompt,
        services  // ['stripe', 'resend'] - services to integrate
    }, userId);
    
    return result;
});
```

---

## 7. Implementation Steps

### 📅 Execution Order

```
PRE-WORK: Commit current Phase 26 work
    │
    ▼
STEP 1: Create folder structure (30 min)
    │   - Create all new directories
    │   - Create index.ts barrel files
    │
    ▼
STEP 2: Move & categorize files (45 min)
    │   - Move files to appropriate folders
    │   - Update imports
    │
    ▼
STEP 3: Consolidate orchestrators (60 min)
    │   - Merge 3 → 1
    │   - Create pipeline phases
    │
    ▼
STEP 4: Unify code generators (60 min)
    │   - Merge 5 → 1 with plugins
    │   - Create language adapters
    │
    ▼
STEP 5: Wire ServiceRegistry (45 min)
    │   - Add service context to prompts
    │   - Update generation pipeline
    │
    ▼
STEP 6: Consolidate context & learning (30 min)
    │   - Merge context services
    │   - Merge learning services
    │
    ▼
STEP 7: Remove dead code (15 min)
    │   - Delete verified unused files
    │
    ▼
STEP 8: Update all imports (30 min)
    │   - Fix all broken imports
    │   - Update barrel exports
    │
    ▼
STEP 9: Test & verify (30 min)
    │   - TypeScript compilation
    │   - Basic functionality test
    │
    ▼
DONE: Commit refactored architecture
```

### 📝 Step-by-Step Commands

```bash
# STEP 1: Create folder structure
mkdir -p packages/api/src/services/orchestration
mkdir -p packages/api/src/services/generation/language-adapters
mkdir -p packages/api/src/services/generation/templates
mkdir -p packages/api/src/services/validation
mkdir -p packages/api/src/services/registry
mkdir -p packages/api/src/services/context
mkdir -p packages/api/src/services/learning
mkdir -p packages/api/src/services/analysis
mkdir -p packages/api/src/services/architecture
mkdir -p packages/api/src/services/infrastructure
mkdir -p packages/api/src/services/integrations
mkdir -p packages/api/src/services/agents
mkdir -p packages/api/src/services/security

# STEP 2: Move files (example)
mv packages/api/src/services/integrated-orchestrator.ts packages/api/src/services/orchestration/
mv packages/api/src/services/ai-client.ts packages/api/src/services/infrastructure/

# ... etc
```

---

## 8. Testing Strategy

### ✅ Verification Checklist

| Test | Command | Expected |
|------|---------|----------|
| TypeScript compiles | `npm run type-check` | No errors |
| Server starts | `npm run dev` | Server running |
| Health endpoint | `curl /health` | 200 OK |
| Generate code | `POST /api/v1/generate` | Generated files |
| Service context | `GET /api/v1/project/status` | All services OK |

### 🧪 Smoke Tests

```bash
# 1. Compile check
cd packages/api && npm run type-check

# 2. Start server
npm run dev

# 3. Test generate endpoint
curl -X POST http://localhost:3000/api/v1/orchestrator/generate \
    -H "Content-Type: application/json" \
    -d '{"prompt": "Create a REST API with users"}'
```

---

## 9. Success Metrics

After refactoring, we should have:

| Metric | Before | After |
|--------|--------|-------|
| **Service files** | 52 | ~35 |
| **Orchestrator files** | 3 | 1 |
| **Generator files** | 5 | 1 |
| **Context files** | 4 | 2 |
| **Learning files** | 3 | 2 |
| **Max file size** | 68KB | <20KB |
| **ServiceRegistry usage** | Unused | Integrated |
| **Folder depth** | 1 | 2-3 (organized) |

---

## 10. Rollback Plan

If refactoring fails:

1. `git checkout .` - Discard all changes
2. `git stash` - Save work if needed
3. Return to pre-refactor commit

---

## ⏰ Time Estimate

| Phase | Duration |
|-------|----------|
| Pre-work (commit) | 5 min |
| Step 1-2 (structure & move) | 75 min |
| Step 3-4 (consolidation) | 120 min |
| Step 5-6 (wiring & context) | 75 min |
| Step 7-9 (cleanup & test) | 75 min |
| **TOTAL** | **~6 hours** |

---

## ✅ Ready to Execute

**Before starting:**

1. ✅ Commit current Phase 26 work
2. ✅ Create a backup branch: `git checkout -b backup-before-refactor`
3. ✅ Review this plan
4. ✅ Start execution

**Command to save current work:**

```bash
git add -A
git commit -m "Phase 26: Production-Ready Code Generation - Complete

- Added DependencyRegistry for auto-generating package.json
- Added ImportRegistry for import deduplication  
- Added CompleteProjectGenerator for full project structures
- Added ProjectIntegrityValidator to prevent code loss
- Integrated all services into IntegratedOrchestrator
- Created Phase 26 API routes (/api/v1/project/*)
- Updated CodePostProcessor with Phase 26 services
- Updated FEATURE_INTEGRATION_GUIDE.md documentation"
```
