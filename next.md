# 📋 TASK LIST - Phase 25+ Improvements

**Last Updated**: December 19, 2024  
**Current System Rating**: 7.5/10 → Target: 9/10

---

## ✅ COMPLETED (Phase 23)

- [x] **CLI Timeout Fix** - Extended to 12 minutes with explicit `postWithTimeout`
- [x] **JSON Repair Strategies** - Added 3 new repair methods to `RobustJSONParser`
- [x] **Original Prompt Injection** - Full prompt context injected into every subtask
- [x] **Vector Store Retry Logic** - `withRetry()` with exponential backoff

---

## ✅ COMPLETED (Phase 24) - Context Management System

- [x] **Entity Extraction Service** - `entity-extractor.ts`
  - [x] AI-powered extraction using fast model
  - [x] Fallback keyword-based extraction
  - [x] Extract entity names, properties, relationships
  - [x] Extract features (auth, real-time, presence)
  - [x] Pre-built templates (User, Message, Room, Post, etc.)

- [x] **Generation Context Service** - `generation-context.ts`
  - [x] Context creation and tracking
  - [x] Entity validation (checks implementations)
  - [x] Decision logging throughout pipeline
  - [x] Database persistence for learning
  - [x] Graceful shutdown with flush

- [x] **Prompt Templates** - `prompt-templates.ts`
  - [x] `buildSubtaskPrompt()` with full context
  - [x] `buildSchemaPrompt()` for Prisma generation
  - [x] `buildRoutePrompt()` for route generation
  - [x] `getEntityConstraints()` for enforcement

- [x] **API Routes** - `routes/context.ts`
  - [x] POST `/api/v1/context/extract`
  - [x] POST `/api/v1/context/create`
  - [x] GET `/api/v1/context/:id`
  - [x] GET `/api/v1/context/:id/validate`
  - [x] POST `/api/v1/context/:id/finalize`

- [x] **Database Migration** - `015_generation_contexts.sql`
  - [x] `generation_contexts` table
  - [x] `entity_extractions` table
  - [x] `generation_quality_feedback` table
  - [x] RPC functions for pattern matching

- [x] **Integration with IntegratedOrchestrator**
  - [x] Phase 1.5: Entity Extraction added
  - [x] Prompt templates used for subtasks
  - [x] Entity constraints added to prompts
  - [x] Context finalization with validation

---

## 🔴 HIGH PRIORITY (Phase 25)

### Task 1: Post-Generation Import Validation
**Effort**: 6 hours | **Impact**: Catches missing services  
**Status**: ⏳ NOT STARTED

**Description**: After code generation, verify all imports exist before writing files.

**Files to Modify**:
- [ ] `packages/api/src/services/code-validator.ts` (enhance)

**Acceptance Criteria**:
- [ ] Parse all import statements from generated files
- [ ] Check if imported modules exist in generated files or are external packages
- [ ] Report missing imports as validation errors
- [ ] Optionally trigger regeneration for missing services

---

### Task 2: Duplicate File Prevention
**Effort**: 2 hours | **Impact**: Clean file output  
**Status**: ⏳ NOT STARTED

**Description**: Track written file paths and skip duplicates.

**Files to Modify**:
- [ ] `packages/api/src/services/file-writer.ts`

**Acceptance Criteria**:
- [ ] Add `Set<string>` to track written paths per generation session
- [ ] Warn when duplicate path is attempted
- [ ] Optionally merge content or keep newest version

---

## 🟡 MEDIUM PRIORITY (Phase 26)

### Task 3: Schema Validation Against Entities
**Effort**: 4 hours | **Impact**: Correct database models  
**Status**: ⏳ NOT STARTED

**Description**: Verify Prisma schema contains all extracted entities.

**Files to Modify**:
- [ ] `packages/api/src/services/code-validator.ts`

**Acceptance Criteria**:
- [ ] Parse Prisma schema for model names
- [ ] Compare against extracted entities (from context)
- [ ] Report missing models
  files_generated TEXT[],
  quality_score NUMERIC(3,1),
  validation_issues JSONB,
  user_feedback TEXT,
  created_at TIMESTAMPTZ
);
```

---

### Task 6: Learn from Failures
**Effort**: 1 day | **Impact**: Continuous improvement  
**Status**: ⏳ NOT STARTED

**Description**: Store failure patterns and use them to avoid repeating mistakes.

**Files to Modify**:
- [ ] `packages/api/src/services/learning-service.ts`

---

## 🟢 LOW PRIORITY (Phase 27-28)

### Task 7: Frontend Dashboard
**Effort**: 2-3 days | **Impact**: User experience  
**Status**: ⏳ NOT STARTED

- [ ] Service connections UI
- [ ] Real-time generation progress (SSE)
- [ ] Code preview with syntax highlighting
- [ ] One-click deploy integration

---

## 📊 Progress Tracker

| Category | Done | Total | % |
|----------|------|-------|---|
| Phase 23 (Reliability) | 4 | 4 | 100% |
| Phase 24 (Entity) | 0 | 3 | 0% |
| Phase 25-26 (Validation) | 0 | 3 | 0% |
| Phase 27-28 (Frontend) | 0 | 1 | 0% |
| **TOTAL** | **4** | **11** | **36%** |

---

# 🧠 CONTEXT MANAGEMENT SYSTEM - Brainstorming

## The Problem

Subtasks lose sight of the original user request, generating generic code instead of domain-specific code.

**Example**:
- User: "Build a real-time chat backend with rooms, messages, and presence"
- Subtask 1: "Set up WebSocket server" → ✅ Generates WebSocket manager
- Subtask 2: "Design database schema" → ❌ Generates generic CRUD models
- Subtask 3: "Implement endpoints" → ❌ Generates `api-design` routes instead of `rooms/messages`

---

## 💡 Ideas for Context Management

### Idea 1: **Context Object (Current Approach - Enhanced)**

Pass a structured context object through the entire pipeline.

```typescript
interface GenerationContext {
  // Original request - NEVER changes
  originalPrompt: string;
  originalTimestamp: Date;
  
  // Extracted entities - Set once after entity extraction
  entities: ExtractedEntity[];
  features: string[];
  
  // Current state - Updated as we progress
  currentPhase: 'analysis' | 'blueprint' | 'generation' | 'validation';
  currentSubtask: string;
  completedSubtasks: string[];
  
  // Accumulated context - Grows with each step
  generatedFiles: Map<string, string>;
  decisions: string[]; // "Using PostgreSQL", "Added JWT auth"
}
```

**Pros**: Simple, explicit, no external dependencies  
**Cons**: Must be passed through all functions manually

---

### Idea 2: **Context Window Service (Singleton)**

A global singleton that maintains context across the entire generation.

```typescript
class ContextWindowService {
  private static instance: ContextWindowService;
  private contextStack: GenerationContext[] = [];
  
  // Push new generation context
  startGeneration(prompt: string): string { 
    const contextId = uuid();
    this.contextStack.push({ id: contextId, originalPrompt: prompt, ... });
    return contextId;
  }
  
  // Get current context
  getCurrentContext(): GenerationContext { ... }
  
  // Add to context
  addEntity(entity: ExtractedEntity): void { ... }
  addDecision(decision: string): void { ... }
  
  // Query context
  getOriginalPrompt(): string { ... }
  getEntities(): ExtractedEntity[] { ... }
}
```

**Pros**: Accessible anywhere, no prop drilling  
**Cons**: Global state, harder to test, concurrency issues

---

### Idea 3: **Prompt Template System**

Define structured prompts that ALWAYS include context.

```typescript
function buildSubtaskPrompt(subtask: string, context: GenerationContext): string {
  return `
╔══════════════════════════════════════════════════════════════════╗
║ CONTEXT (DO NOT IGNORE)                                          ║
╠══════════════════════════════════════════════════════════════════╣
║ Original Request: ${context.originalPrompt}                       ║
║ Project Type: ${context.projectType}                              ║
║ Required Entities: ${context.entities.map(e => e.name).join(', ')}║
╠══════════════════════════════════════════════════════════════════╣
║ CURRENT TASK                                                      ║
╠══════════════════════════════════════════════════════════════════╣
║ ${subtask}                                                        ║
╠══════════════════════════════════════════════════════════════════╣
║ RULES                                                             ║
╠══════════════════════════════════════════════════════════════════╣
║ 1. ONLY generate code for entities listed above                   ║
║ 2. Use exact entity names (Room, Message, User)                   ║
║ 3. Do NOT add unrelated models                                    ║
╚══════════════════════════════════════════════════════════════════╝
`;
}
```

**Pros**: Very explicit, hard to ignore  
**Cons**: Long prompts, uses more tokens

---

### Idea 4: **Entity Registry (Domain-Driven)**

Extract entities FIRST, then register them as "the ground truth".

```typescript
// Step 1: Extract entities (before any code generation)
const registry = new EntityRegistry();
await registry.extractFromPrompt("Build a chat backend with rooms...");

// Registry now contains:
// - Room { name, createdAt, members[] }
// - Message { content, senderId, roomId, timestamp }
// - User { id, name, onlineStatus }

// Step 2: All subsequent steps MUST reference the registry
const schemaGenerator = new PrismaSchemaGenerator(registry);
const routeGenerator = new RouteGenerator(registry);

// Generators can ONLY create code for registered entities
schemaGenerator.generate(); // Creates Room, Message, User models
routeGenerator.generate();  // Creates /rooms, /messages, /users routes

// Step 3: Validation
registry.validate(generatedFiles); // Ensures all entities are implemented
```

**Pros**: Single source of truth, validation built-in  
**Cons**: More upfront work, requires AI call for extraction

---

### Idea 5: **Conversational Memory (Like ChatGPT)**

Store the entire conversation history and include it in every prompt.

```typescript
class ConversationMemory {
  private messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];
  
  addUserMessage(content: string): void { ... }
  addAssistantMessage(content: string): void { ... }
  
  // Get last N messages for context
  getRecentContext(n: number): string {
    return this.messages.slice(-n).map(m => `${m.role}: ${m.content}`).join('\n');
  }
  
  // Summarize older messages to save tokens
  async summarize(): Promise<string> {
    if (this.messages.length > 10) {
      const oldMessages = this.messages.slice(0, -5);
      const summary = await aiClient.summarize(oldMessages);
      // Keep summary + last 5 messages
    }
    return this.getFullContext();
  }
}
```

**Pros**: Natural, like human memory  
**Cons**: Token usage, complexity

---

### Idea 6: **Checkpoint System**

Save context at key points, restore if something goes wrong.

```typescript
interface Checkpoint {
  id: string;
  phase: string;
  context: GenerationContext;
  generatedSoFar: Map<string, string>;
  timestamp: Date;
}

class CheckpointManager {
  private checkpoints: Checkpoint[] = [];
  
  save(phase: string, context: GenerationContext): void { ... }
  restore(checkpointId: string): GenerationContext { ... }
  
  // If validation fails, restore and retry with more context
  async retryFromCheckpoint(id: string, additionalContext: string): Promise<void> { ... }
}
```

**Pros**: Recovery possible, debugging easier  
**Cons**: Storage overhead, complexity

---

## 🎯 RECOMMENDED APPROACH

Combine **Ideas 1 + 3 + 4**:

1. **Entity Registry** (Idea 4): Extract entities FIRST, create a registry
2. **Context Object** (Idea 1): Pass structured context through pipeline
3. **Prompt Templates** (Idea 3): Always include context in prompts

### Implementation Plan:

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: User Prompt                                              │
│ "Build a real-time chat backend with rooms, messages, presence" │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Entity Extraction (NEW)                                  │
│ Extract: Room, Message, User, Presence                           │
│ Features: real-time, WebSocket                                   │
│ → Create EntityRegistry                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Build GenerationContext                                  │
│ {                                                                │
│   originalPrompt: "...",                                         │
│   entities: [Room, Message, User],                               │
│   features: ["real-time", "WebSocket"],                          │
│   ...                                                            │
│ }                                                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: Generate Subtasks (referencing entities)                 │
│ 1. Create Prisma schema with Room, Message, User models          │
│ 2. Create /rooms CRUD routes                                     │
│ 3. Create /messages CRUD routes                                  │
│ 4. Set up WebSocket for real-time                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: Execute Each Subtask with Full Context                   │
│ Prompt = ContextTemplate(context) + Subtask                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: Validate Against EntityRegistry                          │
│ ✓ Room model exists?                                             │
│ ✓ Message model exists?                                          │
│ ✓ /rooms route exists?                                           │
│ ✓ All imports resolve?                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Files to Create for Context Management

1. `packages/api/src/services/entity-extractor.ts` - Extract entities from prompt
2. `packages/api/src/services/entity-registry.ts` - Store and validate entities
3. `packages/api/src/services/generation-context.ts` - Context object definition
4. `packages/api/src/utils/prompt-templates.ts` - Standardized prompt builders

---

## Next Action

**Start with Task 1: Entity Extraction Service** - This is the foundation for proper context management.
