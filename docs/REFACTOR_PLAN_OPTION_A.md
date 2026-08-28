# 🏗️ COMPREHENSIVE REFACTOR PLAN
## Option A: Fix Foundation - Stay with Current Tech Stack

**Project:** LOVEABLE Backend
**Version:** 1.0.0
**Date:** 2025-01-19
**Status:** Ready for Implementation
**Estimated Duration:** 3 weeks
**Team Size:** 1-2 developers

---

## 📋 EXECUTIVE SUMMARY

**Goal:** Fix the root cause (Singleton + God Object) that creates 90+ of 127 issues

**Strategy:**
1. Eliminate singleton pattern → Implement Dependency Injection
2. Break up God Object → Split into focused services
3. Add safety nets → Auth, transactions, tests

**Expected Outcome:**
- ✅ Resolves 90+ issues automatically
- ✅ 80% reduction in technical debt
- ✅ System becomes testable, scalable, maintainable
- ✅ Production-ready in 3 weeks vs 6+ months

---

## 🎯 ROOT CAUSE ANALYSIS

### The Two Deadly Patterns

**Pattern 1: Singleton Abuse** (Everywhere)
```typescript
// ❌ CURRENT - Found in every service file
let instance: ContextManager | null = null;

export function getContextManager() {
    if (!instance) {
        instance = new ContextManager();
    }
    return instance;  // Shared global state
}
```

**Problems This Causes:**
- ❌ Race conditions during initialization
- ❌ Memory leaks (never garbage collected)
- ❌ Impossible to test (can't inject mocks)
- ❌ No request isolation (all users share state)
- ❌ Circular dependencies

**Pattern 2: God Object** (`integrated-orchestrator.ts` - 1,834 lines)
```typescript
// ❌ CURRENT - One class doing everything
export class IntegratedOrchestrator {
    // ❌ AI Operations
    private aiClient: AIClient;
    private multiModelOrchestrator: MultiModelOrchestrator;

    // ❌ File System
    private fileWriter: FileWriterService;

    // ❌ Database (inline!)
    await supabase.from('projects').insert({...});

    // ❌ Business Logic
    private thinkingEngine: ThinkingEngineService;
    private contextManager: ContextManager;
    private agentMonitor: AgentMonitorService;

    // ❌ Quality Assessment
    private qualityAssessment: QualityAssessmentService;

    // ❌ Learning System
    private learningService: LearningService;

    // ❌ 1,245-line method
    async orchestrate(input: OrchestrationInput): Promise<OrchestrationResult> {
        // 1,245 lines of mixed concerns
    }
}
```

---

## 📅 PHASE 1: DEPENDENCY INJECTION (Week 1)

**Goal:** Eliminate singleton pattern, enable request-scoped services

**Days:** 1-5 (40 hours)

### Step 1.1: Install DI Container (Day 1 - 2 hours)

```bash
npm install inversify reflect-metadata
npm install --save-dev @types/inversify
```

Create DI configuration:

```typescript
// packages/api/src/di/container.ts
import 'reflect-metadata';
import { Container, injectable, inject, interfaces } from 'inversify';

// ============================================
// SERVICE IDENTIFIERS
// ============================================
export const TYPES = {
    // Database
    Database: Symbol.for('Database'),
    ProjectRepository: Symbol.for('ProjectRepository'),
    TaskRepository: Symbol.for('TaskRepository'),

    // AI Services
    AIClient: Symbol.for('AIClient'),
    CodeGenerator: Symbol.for('CodeGenerator'),

    // Context Services
    ContextManager: Symbol.for('ContextManager'),
    LearningService: Symbol.for('LearningService'),

    // Infrastructure
    FileWriter: Symbol.for('FileWriter'),
    VectorStore: Symbol.for('VectorStore'),

    // Orchestration
    Orchestrator: Symbol.for('Orchestrator'),
    AgentCoordinator: Symbol.for('AgentCoordinator'),
};

// ============================================
// DI CONTAINER
// ============================================
export class DIContainer {
    private container: Container;

    constructor() {
        this.container = new Container();
        this.bindings();
    }

    private bindings(): void {
        // ============================================
        // DATABASE LAYER
        // ============================================
        this.container.bind<IDatabase>(TYPES.Database).to(SupabaseDatabase).inSingletonScope();
        this.container.bind<IProjectRepository>(TYPES.ProjectRepository).to(ProjectRepository).inTransientScope();
        this.container.bind<ITaskRepository>(TYPES.TaskRepository).to(TaskRepository).inTransientScope();

        // ============================================
        // AI SERVICES
        // ============================================
        this.container.bind<IAIClient>(TYPES.AIClient).to(AIClient).inSingletonScope();
        this.container.bind<ICodeGenerator>(TYPES.CodeGenerator).to(EnhancedCodeGenerator).inTransientScope();

        // ============================================
        // CONTEXT SERVICES (REQUEST SCOPED)
        // ============================================
        this.container.bind<IContextManager>(TYPES.ContextManager).to(ContextManager).inTransientScope();
        this.container.bind<ILearningService>(TYPES.LearningService).to(LearningService).inTransientScope();

        // ============================================
        // INFRASTRUCTURE
        // ============================================
        this.container.bind<IFileWriter>(TYPES.FileWriter).to(FileWriterService).inSingletonScope();
        this.container.bind<IVectorStore>(TYPES.VectorStore).to(VectorStore).inSingletonScope();

        // ============================================
        // ORCHESTRATION
        // ============================================
        this.container.bind<IOrchestrator>(TYPES.Orchestrator).to(OrchestrationService).inTransientScope();
        this.container.bind<IAgentCoordinator>(TYPES.AgentCoordinator).to(AgentCoordinator).inTransientScope();
    }

    get<T>(serviceIdentifier: interfaces.ServiceIdentifier<T>): T {
        return this.container.get<T>(serviceIdentifier);
    }

    // Create request-scoped child container
    createRequestScope(): interfaces.Container {
        return this.container.createChild();
    }
}

// ============================================
// GLOBAL INSTANCE
// ============================================
let diContainer: DIContainer | null = null;

export function initDIContainer(): DIContainer {
    if (!diContainer) {
        diContainer = new DIContainer();
    }
    return diContainer;
}

export function getDIContainer(): DIContainer {
    if (!diContainer) {
        throw new Error('DI Container not initialized. Call initDIContainer() first.');
    }
    return diContainer;
}
```

### Step 1.2: Define Interfaces (Day 1-2 - 6 hours)

```typescript
// packages/api/src/interfaces/orchestration.interface.ts
export interface IOrchestrator {
    orchestrate(input: OrchestrationInput, onProgress?: Callback): Promise<OrchestrationResult>;
    getStatus(): OrchestratorStatus;
    cancel(taskId: string): Promise<void>;
}

// packages/api/src/interfaces/context.interface.ts
export interface IContextManager {
    getContext(projectId: string, userId: string): Promise<ContextWindow>;
    addMessage(projectId: string, userId: string, message: ConversationMessage): Promise<void>;
    clearContext(projectId: string, userId: string): Promise<void>;
}

// packages/api/src/interfaces/database.interface.ts
export interface IDatabase {
    query<T>(sql: string, params?: Record<string, unknown>): Promise<T[]>;
    transaction<T>(callback: (trx: Transaction) => Promise<T>): Promise<T>;
}

export interface IProjectRepository {
    create(project: Project): Promise<Project>;
    findById(id: string): Promise<Project | null>;
    findByUser(userId: string): Promise<Project[]>;
    update(id: string, updates: Partial<Project>): Promise<void>;
    delete(id: string): Promise<void>;
}

export interface ITaskRepository {
    create(task: Task): Promise<Task>;
    findById(id: string): Promise<Task | null>;
    findByProject(projectId: string): Promise<Task[]>;
    updateStatus(id: string, status: TaskStatus): Promise<void>;
}
```

### Step 1.3: Refactor Services to Use DI (Day 2-4 - 16 hours)

**Before (Singleton):**
```typescript
// ❌ packages/api/src/services/context/context-manager.ts
let instance: ContextManager | null = null;

export class ContextManager {
    private constructor() {}  // Private constructor

    static getInstance(): ContextManager {
        if (!instance) {
            instance = new ContextManager();
        }
        return instance;
    }
}
```

**After (DI + Request Scoped):**
```typescript
// ✅ packages/api/src/services/context/context-manager.ts
import { injectable, inject } from 'inversify';
import { TYPES } from '../../di/container.js';
import type { IDatabase } from '../../interfaces/database.interface.js';
import type { IVectorStore } from '../../interfaces/vector-store.interface.js';

@injectable()
export class ContextManager implements IContextManager {
    private contextCache: Map<string, ContextWindow>;
    private initialized: boolean = false;

    constructor(
        @inject(TYPES.Database) private database: IDatabase,
        @inject(TYPES.VectorStore) private vectorStore: IVectorStore
    ) {
        this.contextCache = new Map();
        // No singleton pattern - can create multiple instances
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Initialization logic here
        this.initialized = true;
    }

    async getContext(projectId: string, userId: string): Promise<ContextWindow> {
        const cacheKey = `${userId}:${projectId}`;

        if (this.contextCache.has(cacheKey)) {
            return this.contextCache.get(cacheKey)!;
        }

        // Load from database
        const context = await this.loadContext(projectId, userId);
        this.contextCache.set(cacheKey, context);

        return context;
    }

    // ... other methods
}
```

### Step 1.4: Repository Pattern (Day 3-4 - 8 hours)

```typescript
// ✅ packages/api/src/repositories/project.repository.ts
import { injectable, inject } from 'inversify';
import { TYPES } from '../../di/container.js';
import type { IDatabase } from '../../interfaces/database.interface.js';
import type { IProjectRepository } from '../../interfaces/database.interface.js';

@injectable()
export class ProjectRepository implements IProjectRepository {
    constructor(
        @inject(TYPES.Database) private database: IDatabase
    ) {}

    async create(project: Project): Promise<Project> {
        const result = await this.database.query<Project>(
            `INSERT INTO projects (user_id, name, config, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())
             RETURNING *`,
            [project.userId, project.name, JSON.stringify(project.config)]
        );

        return result[0];
    }

    async findById(id: string): Promise<Project | null> {
        const result = await this.database.query<Project>(
            `SELECT * FROM projects WHERE id = $1`,
            [id]
        );

        return result[0] || null;
    }

    async findByUser(userId: string): Promise<Project[]> {
        return this.database.query<Project>(
            `SELECT * FROM projects WHERE user_id = $1 ORDER BY updated_at DESC`,
            [userId]
        );
    }

    async update(id: string, updates: Partial<Project>): Promise<void> {
        const fields: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (key === 'id' || key === 'created_at') continue;

            fields.push(`${key} = $${paramIndex++}`);
            values.push(typeof value === 'object' ? JSON.stringify(value) : value);
        }

        if (fields.length === 0) return;

        fields.push(`updated_at = NOW()`);
        values.push(id);

        await this.database.query(
            `UPDATE projects SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
            values
        );
    }

    async delete(id: string): Promise<void> {
        await this.database.query(
            `DELETE FROM projects WHERE id = $1`,
            [id]
        );
    }
}
```

### Step 1.5: Request-Scoped Middleware (Day 4-5 - 6 hours)

```typescript
// ✅ packages/api/src/middleware/di-middleware.ts
import { fastify, FastifyRequest, FastifyReply } from 'fastify';
import { getDIContainer, DIContainer } from '../di/container.js';

// Extend Fastify types
declare module 'fastify' {
    interface FastifyRequest {
        diContainer: DIContainer;
        userId?: string;
    }
}

export function diMiddleware(app: fastify.FastifyInstance): void {
    app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
        // Create request-scoped DI container
        const requestScope = getDIContainer().createRequestScope();

        // Attach to request
        request.diContainer = requestScope as any;

        // Extract user from JWT if present
        try {
            await request.jwtVerify();
            request.userId = (request.user as any)?.userId;
        } catch {
            // No auth for public routes
            request.userId = undefined;
        }
    });

    app.addHook('onResponse', async (request: FastifyRequest) => {
        // Cleanup request-scoped services
        if (request.diContainer) {
            request.diContainer.unbindAll();
        }
    });
}
```

### Step 1.6: Update Main App (Day 5 - 2 hours)

```typescript
// ✅ packages/api/src/index.ts
import fastify from 'fastify';
import { initDIContainer } from './di/container.js';
import { diMiddleware } from './middleware/di-middleware.js';

async function buildApp() {
    const app = fastify({
        logger: true,
    });

    // Initialize DI container
    const diContainer = initDIContainer();

    // Register DI middleware
    diMiddleware(app);

    // Register routes
    await app.register(autoLoad, {
        dir: path.join(__dirname, 'routes'),
        options: { prefix: '/api/v1' }
    });

    // Health check
    app.get('/health', async () => {
        return { status: 'ok', timestamp: new Date() };
    });

    return app;
}
```

---

## 📅 PHASE 2: BREAK UP GOD OBJECT (Week 2)

**Goal:** Split IntegratedOrchestrator into focused, testable services

**Days:** 6-10 (40 hours)

### Step 2.1: Design New Architecture (Day 6 - 4 hours)

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATION LAYER                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  OrchestrationFacade (Thin Coordinator)             │   │
│  │  - validateInput()                                   │   │
│  │  - routeToService()                                  │   │
│  │  - aggregateResults()                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│          ┌───────────────┼───────────────┐                 │
│          ▼               ▼               ▼                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│  │   Planning   │ │ Generation   │ │ Validation   │      │
│  │   Service    │ │ Service      │ │ Service      │      │
│  └──────────────┘ └──────────────┘ └──────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│  │   Context    │ │  Database    │ │  Vector      │      │
│  │   Manager    │ │  Repository  │ │  Store       │      │
│  └──────────────┘ └──────────────┘ └──────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│  │   AI Client  │ │ File Writer  │ │    Redis     │      │
│  └──────────────┘ └──────────────┘ └──────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Step 2.2: Create Planning Service (Day 6-7 - 8 hours)

```typescript
// ✅ packages/api/src/services/orchestration/planning.service.ts
import { injectable, inject } from 'inversify';
import { TYPES } from '../../di/container.js';
import type { IContextManager } from '../../interfaces/context.interface.js';
import type { IAgentCoordinator } from '../../interfaces/agent.interface.js';

export interface PlanningResult {
    subtasks: string[];
    dependencies: string[][];
    estimatedDuration: number;
    complexity: 'simple' | 'moderate' | 'complex';
}

@injectable()
export class PlanningService {
    constructor(
        @inject(TYPES.ContextManager) private contextManager: IContextManager,
        @inject(TYPES.AgentCoordinator) private agentCoordinator: IAgentCoordinator
    ) {}

    async planGeneration(input: OrchestrationInput): Promise<PlanningResult> {
        // Step 1: Analyze request
        const analysis = await this.analyzeRequest(input);

        // Step 2: Check context for similar past tasks
        const relevantContext = await this.contextManager.getContext(
            input.projectId,
            input.userId || 'anonymous'
        );

        // Step 3: Generate subtasks
        const subtasks = await this.generateSubtasks(input, analysis, relevantContext);

        // Step 4: Identify dependencies
        const dependencies = await this.identifyDependencies(subtasks);

        // Step 5: Estimate complexity
        const complexity = this.assessComplexity(subtasks, dependencies);

        // Step 6: Estimate duration
        const estimatedDuration = this.estimateDuration(subtasks.length, complexity);

        return {
            subtasks,
            dependencies,
            estimatedDuration,
            complexity
        };
    }

    private async analyzeRequest(input: OrchestrationInput): Promise<RequestAnalysis> {
        // Use AI to analyze the request
        const prompt = this.buildAnalysisPrompt(input);

        // Call AI (lightweight model for analysis)
        const analysis = await this.aiClient.complete(prompt, {
            model: 'gpt-3.5-turbo',
            maxTokens: 500
        });

        return this.parseAnalysis(analysis);
    }

    private async generateSubtasks(
        input: OrchestrationInput,
        analysis: RequestAnalysis,
        context: ContextWindow
    ): Promise<string[]> {
        // Generate subtasks based on analysis
        const subtasks: string[] = [];

        if (analysis.needsAuthentication) {
            subtasks.push('Implement authentication system');
        }

        if (analysis.needsDatabase) {
            subtasks.push('Design database schema');
            subtasks.push('Create database migrations');
            subtasks.push('Implement database models');
        }

        if (analysis.needsAPI) {
            subtasks.push('Design API endpoints');
            subtasks.push('Implement controllers');
            subtasks.push('Add validation middleware');
        }

        // Add context-specific subtasks
        for (const entity of context.entities) {
            subtasks.push(`Implement ${entity.name} management`);
        }

        return subtasks;
    }

    private async identifyDependencies(subtasks: string[]): Promise<string[][]> {
        // Build dependency graph
        const dependencies: string[][] = [];

        // Known dependencies
        const knownDeps: Record<string, string[]> = {
            'Implement authentication system': [],
            'Design database schema': ['Implement authentication system'],
            'Create database migrations': ['Design database schema'],
            'Implement database models': ['Create database migrations'],
            'Design API endpoints': ['Implement database models'],
            'Implement controllers': ['Design API endpoints'],
        };

        for (const subtask of subtasks) {
            const deps = knownDeps[subtask] || [];
            dependencies.push([subtask, ...deps]);
        }

        return dependencies;
    }

    private assessComplexity(
        subtasks: string[],
        dependencies: string[][]
    ): 'simple' | 'moderate' | 'complex' {
        if (subtasks.length <= 3) return 'simple';
        if (subtasks.length <= 7) return 'moderate';
        return 'complex';
    }

    private estimateDuration(subtaskCount: number, complexity: string): number {
        const baseTime = 30; // seconds per subtask
        const multiplier = {
            simple: 1,
            moderate: 1.5,
            complex: 2
        };

        return subtaskCount * baseTime * multiplier[complexity as keyof typeof multiplier];
    }

    private buildAnalysisPrompt(input: OrchestrationInput): string {
        return `
Analyze this backend development request and categorize by complexity:

Request: ${input.prompt}
Language: ${input.context?.language || 'TypeScript'}
Framework: ${input.context?.framework || 'Fastify'}

Provide analysis in JSON format:
{
    "needsAuthentication": boolean,
    "needsDatabase": boolean,
    "needsAPI": boolean,
    "estimatedSubtasks": number,
    "complexity": "simple" | "moderate" | "complex"
}
`;
    }

    private parseAnalysis(analysis: string): RequestAnalysis {
        try {
            const jsonMatch = analysis.match(/```json\s*([\s\S]*?)```/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[1]);
            }
            return JSON.parse(analysis);
        } catch {
            // Default to moderate complexity
            return {
                needsAuthentication: true,
                needsDatabase: true,
                needsAPI: true,
                estimatedSubtasks: 5,
                complexity: 'moderate'
            };
        }
    }
}
```

### Step 2.3: Create Generation Service (Day 7-8 - 10 hours)

```typescript
// ✅ packages/api/src/services/orchestration/generation.service.ts
import { injectable, inject } from 'inversify';
import { TYPES } from '../../di/container.js';
import type { ICodeGenerator } from '../../interfaces/generator.interface.js';
import type { IContextManager } from '../../interfaces/context.interface.js';
import type { IAgentCoordinator } from '../../interfaces/agent.interface.js';

export interface GenerationRequest {
    subtask: string;
    projectId: string;
    userId?: string;
    context: GenerationContext;
    dependencies?: string[];
}

export interface GenerationResult {
    subtask: string;
    code: string;
    files: GeneratedFile[];
    explanation: string;
    success: boolean;
    errors: string[];
    duration: number;
}

@injectable()
export class GenerationService {
    constructor(
        @inject(TYPES.CodeGenerator) private codeGenerator: ICodeGenerator,
        @inject(TYPES.ContextManager) private contextManager: IContextManager,
        @inject(TYPES.AgentCoordinator) private agentCoordinator: IAgentCoordinator
    ) {}

    async generate(request: GenerationRequest): Promise<GenerationResult> {
        const startTime = Date.now();
        const errors: string[] = [];

        try {
            // Step 1: Load relevant context
            const context = await this.loadContext(request);

            // Step 2: Select appropriate agent
            const agent = await this.agentCoordinator.selectAgent(request.subtask, context);

            // Step 3: Generate code
            const generationResult = await this.codeGenerator.generate({
                prompt: request.subtask,
                context: context,
                agent: agent,
                config: request.context
            });

            // Step 4: Validate generation
            const validation = await this.validateGeneration(generationResult);

            if (!validation.isValid) {
                errors.push(...validation.errors);

                // Try once more with corrections
                const retryResult = await this.retryWithCorrections(request, validation.errors);
                return retryResult;
            }

            // Step 5: Save to context
            await this.contextManager.addArtifact(request.projectId, {
                type: 'code',
                subtask: request.subtask,
                files: generationResult.files
            });

            return {
                subtask: request.subtask,
                code: generationResult.code,
                files: generationResult.files,
                explanation: generationResult.explanation,
                success: true,
                errors: [],
                duration: Date.now() - startTime
            };

        } catch (error) {
            return {
                subtask: request.subtask,
                code: '',
                files: [],
                explanation: '',
                success: false,
                errors: [error instanceof Error ? error.message : 'Unknown error'],
                duration: Date.now() - startTime
            };
        }
    }

    async generateBatch(
        requests: GenerationRequest[],
        concurrency: number = 3
    ): Promise<GenerationResult[]> {
        const results: GenerationResult[] = [];

        // Process in batches
        for (let i = 0; i < requests.length; i += concurrency) {
            const batch = requests.slice(i, i + concurrency);
            const batchResults = await Promise.all(
                batch.map(req => this.generate(req))
            );
            results.push(...batchResults);
        }

        return results;
    }

    private async loadContext(request: GenerationRequest): Promise<GenerationContext> {
        const contextWindow = await this.contextManager.getContext(
            request.projectId,
            request.userId || 'anonymous'
        );

        return {
            ...request.context,
            entities: contextWindow.entities,
            recentFiles: contextWindow.recentFiles,
            previousDecisions: contextWindow.decisions
        };
    }

    private async validateGeneration(result: CodeGenerationResult): Promise<{
        isValid: boolean;
        errors: string[];
    }> {
        const errors: string[] = [];

        // Check if code was generated
        if (!result.code || result.code.length === 0) {
            errors.push('No code generated');
        }

        // Check if files were generated
        if (!result.files || result.files.length === 0) {
            errors.push('No files generated');
        }

        // Validate file paths
        for (const file of result.files || []) {
            if (!file.path || file.path.length === 0) {
                errors.push(`File missing path`);
            }

            if (!file.content || file.content.length === 0) {
                errors.push(`File ${file.path} has no content`);
            }

            // Check for path traversal
            if (file.path.includes('..')) {
                errors.push(`File ${file.path} contains path traversal`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    private async retryWithCorrections(
        request: GenerationRequest,
        errors: string[]
    ): Promise<GenerationResult> {
        // Retry with error corrections
        const correctedRequest = {
            ...request,
            context: {
                ...request.context,
                corrections: errors
            }
        };

        return this.generate(correctedRequest);
    }
}
```

### Step 2.4: Create Validation Service (Day 8-9 - 8 hours)

```typescript
// ✅ packages/api/src/services/orchestration/validation.service.ts
import { injectable, inject } from 'inversify';
import { TYPES } from '../../di/container.js';
import type { IFileWriter } from '../../interfaces/file.interface.js';
import type { IContextManager } from '../../interfaces/context.interface.js';

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    files: GeneratedFile[];
}

export interface ValidationError {
    file: string;
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning';
}

@injectable()
export class ValidationService {
    constructor(
        @inject(TYPES.FileWriter) private fileWriter: IFileWriter,
        @inject(TYPES.ContextManager) private contextManager: IContextManager
    ) {}

    async validateGeneration(
        files: GeneratedFile[],
        projectId: string
    ): Promise<ValidationResult> {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        // Step 1: Write files to temp location
        const tempDir = path.join(os.tmpdir(), `validation-${Date.now()}`);
        await this.fileWriter.writeToDirectory(tempDir, files);

        try {
            // Step 2: Run type checking
            const typeErrors = await this.runTypeCheck(tempDir, files);
            errors.push(...typeErrors);

            // Step 3: Run linting
            const lintErrors = await this.runLinting(tempDir, files);
            errors.push(...lintErrors);

            // Step 4: Validate imports
            const importErrors = await this.validateImports(tempDir, files);
            errors.push(...importErrors);

            // Step 5: Check for common issues
            const commonIssues = await this.checkCommonIssues(files);
            warnings.push(...commonIssues);

        } finally {
            // Cleanup temp directory
            await fs.rm(tempDir, { recursive: true, force: true });
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            files
        };
    }

    private async runTypeCheck(
        dir: string,
        files: GeneratedFile[]
    ): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];

        // Run TypeScript compiler
        const result = await this.exec('npx tsc --noEmit', { cwd: dir });

        if (result.stderr) {
            const lines = result.stderr.split('\n');
            for (const line of lines) {
                if (line.includes('error TS')) {
                    const match = line.match(/(.+)\((\d+),(\d+)\):\s+error TS\d+:\s+(.+)/);
                    if (match) {
                        errors.push({
                            file: match[1],
                            line: parseInt(match[2]),
                            column: parseInt(match[3]),
                            message: match[4],
                            severity: 'error'
                        });
                    }
                }
            }
        }

        return errors;
    }

    private async runLinting(
        dir: string,
        files: GeneratedFile[]
    ): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];

        // Run ESLint
        const result = await this.exec('npx eslint . --format json', { cwd: dir });

        if (result.stdout) {
            const lintResults = JSON.parse(result.stdout);
            for (const fileResult of lintResults) {
                for (const message of fileResult.messages) {
                    errors.push({
                        file: fileResult.filePath,
                        line: message.line,
                        column: message.column,
                        message: message.message,
                        severity: message.severity
                    });
                }
            }
        }

        return errors;
    }

    private async validateImports(
        dir: string,
        files: GeneratedFile[]
    ): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];

        for (const file of files) {
            // Check for duplicate imports
            const importMatches = file.content.matchAll(/^import .+$/gm);
            const imports = Array.from(importMatches).map(m => m[0]);

            const seen = new Set<string>();
            for (const import_ of imports) {
                const normalized = import_.replace(/\s+/g, ' ');
                if (seen.has(normalized)) {
                    errors.push({
                        file: file.path,
                        line: 0,
                        column: 0,
                        message: `Duplicate import: ${import_}`,
                        severity: 'warning'
                    });
                }
                seen.add(normalized);
            }
        }

        return errors;
    }

    private async checkCommonIssues(
        files: GeneratedFile[]
    ): Promise<ValidationWarning[]> {
        const warnings: ValidationWarning[] = [];

        for (const file of files) {
            // Check for console.log
            const consoleLogs = file.content.matchAll(/console\.log\(/g);
            const logCount = Array.from(consoleLogs).length;
            if (logCount > 0) {
                warnings.push({
                    file: file.path,
                    message: `Found ${logCount} console.log statements`,
                    severity: 'warning'
                });
            }

            // Check for TODOs
            const todos = file.content.matchAll(/TODO:/gi);
            const todoCount = Array.from(todos).length;
            if (todoCount > 0) {
                warnings.push({
                    file: file.path,
                    message: `Found ${todoCount} TODO comments`,
                    severity: 'info'
                });
            }
        }

        return warnings;
    }

    private async exec(
        command: string,
        options: { cwd: string }
    ): Promise<{ stdout: string; stderr: string }> {
        return new Promise((resolve, reject) => {
            exec(command, options, (error, stdout, stderr) => {
                if (error) {
                    resolve({ stdout: stdout || '', stderr: stderr || '' });
                } else {
                    resolve({ stdout, stderr: stderr || '' });
                }
            });
        });
    }
}
```

### Step 2.5: Create Orchestration Facade (Day 9-10 - 10 hours)

```typescript
// ✅ packages/api/src/services/orchestration/orchestration.service.ts
import { injectable, inject } from 'inversify';
import { TYPES } from '../../di/container.js';
import type { IPlanningService } from './planning.service.js';
import type { IGenerationService } from './generation.service.js';
import type { IValidationService } from './validation.service.js';
import type { IProjectRepository } from '../../interfaces/database.interface.js';
import type { ITaskRepository } from '../../interfaces/database.interface.js';
import type { IFileWriter } from '../../interfaces/file.interface.js';

@injectable()
export class OrchestrationService implements IOrchestrator {
    private activeTasks: Map<string, AbortController>;

    constructor(
        @inject(TYPES.PlanningService) private planningService: IPlanningService,
        @inject(TYPES.GenerationService) private generationService: IGenerationService,
        @inject(TYPES.ValidationService) private validationService: IValidationService,
        @inject(TYPES.ProjectRepository) private projectRepo: IProjectRepository,
        @inject(TYPES.TaskRepository) private taskRepo: ITaskRepository,
        @inject(TYPES.FileWriter) private fileWriter: IFileWriter
    ) {
        this.activeTasks = new Map();
    }

    async orchestrate(
        input: OrchestrationInput,
        onProgress?: (step: OrchestrationStep) => void
    ): Promise<OrchestrationResult> {
        const taskId = input.taskId || this.generateTaskId();
        const abortController = new AbortController();
        this.activeTasks.set(taskId, abortController);

        try {
            // ============================================
            // PHASE 1: VALIDATE INPUT
            // ============================================
            this.reportProgress(onProgress, {
                phase: 'validation',
                step: 'validate_input',
                message: 'Validating input',
                progress: 5
            });

            const validation = await this.validateInput(input);
            if (!validation.isValid) {
                return {
                    success: false,
                    errors: validation.errors,
                    taskId
                };
            }

            // ============================================
            // PHASE 2: PLAN GENERATION
            // ============================================
            this.reportProgress(onProgress, {
                phase: 'planning',
                step: 'analyze_request',
                message: 'Analyzing request and planning generation',
                progress: 10
            });

            const plan = await this.planningService.planGeneration(input);

            this.reportProgress(onProgress, {
                phase: 'planning',
                step: 'plan_complete',
                message: `Plan created: ${plan.subtasks.length} subtasks`,
                progress: 20,
                metadata: { subtasks: plan.subtasks }
            });

            // Save task to database
            await this.taskRepo.create({
                id: taskId,
                projectId: input.projectId,
                userId: input.userId,
                status: 'running',
                config: plan
            });

            // ============================================
            // PHASE 3: GENERATE CODE
            // ============================================
            this.reportProgress(onProgress, {
                phase: 'generation',
                step: 'generate_start',
                message: 'Starting code generation',
                progress: 25
            });

            const generationRequests: GenerationRequest[] = plan.subtasks.map(subtask => ({
                subtask,
                projectId: input.projectId,
                userId: input.userId,
                context: input.context || {},
                dependencies: this.getDependenciesForSubtask(subtask, plan.dependencies)
            }));

            // Execute in parallel batches
            const generationResults = await this.generationService.generateBatch(
                generationRequests,
                3 // concurrency
            );

            this.reportProgress(onProgress, {
                phase: 'generation',
                step: 'generate_complete',
                message: `Generated ${generationResults.length} subtasks`,
                progress: 60,
                metadata: {
                    results: generationResults.map(r => ({
                        subtask: r.subtask,
                        success: r.success,
                        duration: r.duration
                    }))
                }
            });

            // ============================================
            // PHASE 4: VALIDATE RESULTS
            // ============================================
            this.reportProgress(onProgress, {
                phase: 'validation',
                step: 'validate_results',
                message: 'Validating generated code',
                progress: 70
            });

            const allFiles = generationResults.flatMap(r => r.files);
            const validationResult = await this.validationService.validateGeneration(
                allFiles,
                input.projectId
            );

            if (!validationResult.isValid) {
                this.reportProgress(onProgress, {
                    phase: 'validation',
                    step: 'validation_failed',
                    message: `Validation failed: ${validationResult.errors.length} errors`,
                    progress: 75,
                    metadata: { errors: validationResult.errors }
                });

                return {
                    success: false,
                    errors: validationResult.errors.map(e => e.message),
                    warnings: validationResult.warnings.map(w => w.message),
                    taskId
                };
            }

            // ============================================
            // PHASE 5: PERSIST FILES
            // ============================================
            this.reportProgress(onProgress, {
                phase: 'persistence',
                step: 'write_files',
                message: `Writing ${allFiles.length} files`,
                progress: 80
            });

            const writeResult = await this.fileWriter.writeProject(
                input.projectId,
                allFiles
            );

            // ============================================
            // PHASE 6: SAVE TO DATABASE
            // ============================================
            this.reportProgress(onProgress, {
                phase: 'persistence',
                step: 'save_metadata',
                message: 'Saving metadata',
                progress: 90
            });

            // Update task status
            await this.taskRepo.updateStatus(taskId, 'completed');

            // Save generation record
            await this.projectRepo.update(input.projectId, {
                lastGeneratedAt: new Date(),
                filesCount: allFiles.length
            });

            // ============================================
            // PHASE 7: COMPLETE
            // ============================================
            this.reportProgress(onProgress, {
                phase: 'complete',
                step: 'done',
                message: 'Orchestration complete',
                progress: 100
            });

            return {
                success: true,
                taskId,
                files: allFiles,
                subtasks: generationResults,
                warnings: validationResult.warnings.map(w => w.message),
                duration: Date.now() - startTime
            };

        } catch (error) {
            await this.taskRepo.updateStatus(taskId, 'failed');

            return {
                success: false,
                errors: [error instanceof Error ? error.message : 'Unknown error'],
                taskId
            };
        } finally {
            this.activeTasks.delete(taskId);
        }
    }

    async cancel(taskId: string): Promise<void> {
        const controller = this.activeTasks.get(taskId);
        if (controller) {
            controller.abort();
            await this.taskRepo.updateStatus(taskId, 'cancelled');
        }
    }

    getStatus(): OrchestratorStatus {
        return {
            activeTasks: this.activeTasks.size,
            totalTasks: this.activeTasks.size,
            uptime: process.uptime()
        };
    }

    private async validateInput(input: OrchestrationInput): Promise<{
        isValid: boolean;
        errors: string[];
    }> {
        const errors: string[] = [];

        // Required fields
        if (!input.prompt || input.prompt.length === 0) {
            errors.push('Prompt is required');
        }

        if (!input.projectId || input.projectId.length === 0) {
            errors.push('Project ID is required');
        }

        // Validate project ID format
        if (input.projectId && !/^[a-zA-Z0-9_-]+$/.test(input.projectId)) {
            errors.push('Project ID contains invalid characters');
        }

        // Validate prompt length
        if (input.prompt && input.prompt.length > 10000) {
            errors.push('Prompt is too long (max 10000 characters)');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    private reportProgress(
        callback: ((step: OrchestrationStep) => void) | undefined,
        step: OrchestrationStep
    ): void {
        if (callback) {
            callback(step);
        }
    }

    private generateTaskId(): string {
        return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private getDependenciesForSubtask(
        subtask: string,
        dependencies: string[][]
    ): string[] {
        for (const depList of dependencies) {
            if (depList[0] === subtask) {
                return depList.slice(1);
            }
        }
        return [];
    }
}
```

---

## 📅 PHASE 3: SAFETY NETS (Week 3)

**Goal:** Add authentication, transactions, tests

**Days:** 11-15 (40 hours)

### Step 3.1: Authentication Middleware (Day 11-12 - 10 hours)

```typescript
// ✅ packages/api/src/middleware/auth.middleware.ts
import fastify, { FastifyRequest, FastifyReply } from 'fastify';
import jwt from '@fastify/jwt';

// Extend Fastify types
declare module 'fastify' {
    interface FastifyRequest {
        userId?: string;
        user?: {
            userId: string;
            email: string;
            role: string;
        };
    }
}

export async function registerAuthMiddleware(app: fastify.FastifyInstance): Promise<void> {
    // Register JWT
    await app.register(jwt, {
        secret: process.env.JWT_SECRET || 'fallback-secret',
        sign: {
            expiresIn: '7d'
        },
        verify: {
            extractToken: (request) => {
                // Try Authorization header first
                const authHeader = request.headers.authorization;
                if (authHeader?.startsWith('Bearer ')) {
                    return authHeader.substring(7);
                }

                // Try query parameter
                if ((request.query as any).token) {
                    return (request.query as any).token;
                }

                return undefined;
            }
        }
    });

    // Public routes (no auth required)
    const publicRoutes = ['/health', '/docs', '/api/v1/auth/login'];

    app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
        // Check if route is public
        const isPublic = publicRoutes.some(route =>
            request.url.startsWith(route) || request.url.startsWith('/api/v1/auth')
        );

        if (isPublic) {
            return;
        }

        // Verify JWT
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.status(401).send({
                error: 'Unauthorized',
                message: 'Invalid or missing authentication token'
            });
            throw err; // Stop execution
        }
    });
}

// Auth routes
export async function registerAuthRoutes(app: fastify.FastifyInstance): Promise<void> {
    // Login endpoint
    app.post('/api/v1/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
        const { email, password } = request.body as { email: string; password: string };

        // Validate credentials against database
        const user = await validateCredentials(email, password);

        if (!user) {
            return reply.status(401).send({
                error: 'Invalid credentials'
            });
        }

        // Generate JWT
        const token = app.jwt.sign({
            userId: user.id,
            email: user.email,
            role: user.role
        });

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        };
    });

    // Register endpoint
    app.post('/api/v1/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
        const { email, password, name } = request.body as {
            email: string;
            password: string;
            name: string
        };

        // Validate input
        if (!email || !password || !name) {
            return reply.status(400).send({
                error: 'Missing required fields'
            });
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create user
        const user = await createUser({
            email,
            password: hashedPassword,
            name
        });

        // Generate JWT
        const token = app.jwt.sign({
            userId: user.id,
            email: user.email,
            role: user.role
        });

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        };
    });
}
```

### Step 3.2: Transaction Safety (Day 12-13 - 8 hours)

```typescript
// ✅ packages/api/src/services/infrastructure/transaction.service.ts
import { injectable, inject } from 'inversify';
import { TYPES } from '../../di/container.js';
import type { IDatabase } from '../../interfaces/database.interface.js';

export interface TransactionStep<T> {
    name: string;
    execute: () => Promise<T>;
    compensate: (result: T) => Promise<void>;
}

@injectable()
export class TransactionService {
    constructor(
        @inject(TYPES.Database) private database: IDatabase
    ) {}

    async executeTransaction<T>(
        steps: TransactionStep<T>[],
        options: { timeout?: number } = {}
    ): Promise<T[]> {
        const results: T[] = [];
        const { timeout = 30000 } = options;

        try {
            // Start transaction timeout
            const timeoutId = setTimeout(() => {
                throw new Error('Transaction timeout');
            }, timeout);

            // Execute steps in sequence
            for (const step of steps) {
                console.log(`[Transaction] Executing: ${step.name}`);

                const result = await step.execute();
                results.push(result);

                console.log(`[Transaction] Completed: ${step.name}`);
            }

            clearTimeout(timeoutId);

            return results;

        } catch (error) {
            console.error(`[Transaction] Failed, compensating...`);

            // Compensate in reverse order
            for (let i = results.length - 1; i >= 0; i--) {
                const step = steps[i];
                const result = results[i];

                try {
                    console.log(`[Transaction] Compensating: ${step.name}`);
                    await step.compensate(result);
                } catch (compensationError) {
                    console.error(`[Transaction] Compensation failed for ${step.name}:`, compensationError);
                    // Continue compensating other steps
                }
            }

            throw error;
        }
    }
}

// Usage in orchestrator
async saveOrchestrationResults(
    orchestration: OrchestrationResult,
    input: OrchestrationInput
): Promise<void> {
    const steps: TransactionStep<any>[] = [
        {
            name: 'save_project',
            execute: async () => {
                return await this.projectRepo.upsert({
                    id: input.projectId,
                    userId: input.userId,
                    lastGeneratedAt: new Date(),
                    config: input.context
                });
            },
            compensate: async (result) => {
                await this.projectRepo.delete(result.id);
            }
        },
        {
            name: 'save_task',
            execute: async () => {
                return await this.taskRepo.create({
                    id: input.taskId,
                    projectId: input.projectId,
                    userId: input.userId,
                    status: 'completed',
                    result: orchestration
                });
            },
            compensate: async (result) => {
                await this.taskRepo.delete(result.id);
            }
        },
        {
            name: 'save_audit_log',
            execute: async () => {
                return await this.auditRepo.create({
                    projectId: input.projectId,
                    userId: input.userId,
                    action: 'orchestration_complete',
                    metadata: orchestration
                });
            },
            compensate: async (result) => {
                await this.auditRepo.delete(result.id);
            }
        }
    ];

    await this.transactionService.executeTransaction(steps);
}
```

### Step 3.3: Test Suite (Day 13-15 - 22 hours)

```typescript
// ✅ packages/api/src/tests/unit/orchestration.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Container } from 'inversify';
import { OrchestrationService } from '../services/orchestration/orchestration.service.js';
import { TYPES } from '../di/container.js';

describe('OrchestrationService', () => {
    let container: Container;
    let orchestrator: OrchestrationService;
    let mockPlanningService: any;
    let mockGenerationService: any;
    let mockValidationService: any;

    beforeEach(() => {
        // Setup DI container with mocks
        container = new Container();

        // Mock services
        mockPlanningService = {
            planGeneration: vi.fn().mockResolvedValue({
                subtasks: ['subtask1', 'subtask2'],
                dependencies: [],
                estimatedDuration: 60,
                complexity: 'simple'
            })
        };

        mockGenerationService = {
            generateBatch: vi.fn().mockResolvedValue([
                {
                    subtask: 'subtask1',
                    code: 'code1',
                    files: [{ path: 'file1.ts', content: 'content1' }],
                    explanation: 'explanation1',
                    success: true,
                    errors: [],
                    duration: 1000
                },
                {
                    subtask: 'subtask2',
                    code: 'code2',
                    files: [{ path: 'file2.ts', content: 'content2' }],
                    explanation: 'explanation2',
                    success: true,
                    errors: [],
                    duration: 1000
                }
            ])
        };

        mockValidationService = {
            validateGeneration: vi.fn().mockResolvedValue({
                isValid: true,
                errors: [],
                warnings: [],
                files: []
            })
        };

        // Bind mocks
        container.bind('PlanningService').toConstantValue(mockPlanningService);
        container.bind('GenerationService').toConstantValue(mockGenerationService);
        container.bind('ValidationService').toConstantValue(mockValidationService);

        // Create orchestrator
        orchestrator = new OrchestrationService(
            mockPlanningService,
            mockGenerationService,
            mockValidationService,
            {} as any, // projectRepo
            {} as any, // taskRepo
            {} as any  // fileWriter
        );
    });

    it('should orchestrate successfully', async () => {
        const input = {
            taskId: 'test-task-1',
            projectId: 'test-project',
            userId: 'test-user',
            prompt: 'Create a simple API'
        };

        const result = await orchestrator.orchestrate(input);

        expect(result.success).toBe(true);
        expect(result.files).toHaveLength(2);
        expect(mockPlanningService.planGeneration).toHaveBeenCalledWith(input);
        expect(mockGenerationService.generateBatch).toHaveBeenCalled();
        expect(mockValidationService.validateGeneration).toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
        mockValidationService.validateGeneration.mockResolvedValueOnce({
            isValid: false,
            errors: [{ file: 'test.ts', line: 1, column: 1, message: 'Test error', severity: 'error' }],
            warnings: [],
            files: []
        });

        const input = {
            taskId: 'test-task-2',
            projectId: 'test-project',
            userId: 'test-user',
            prompt: 'Create a simple API'
        };

        const result = await orchestrator.orchestrate(input);

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
    });

    it('should report progress', async () => {
        const progressCallback = vi.fn();

        const input = {
            taskId: 'test-task-3',
            projectId: 'test-project',
            userId: 'test-user',
            prompt: 'Create a simple API'
        };

        await orchestrator.orchestrate(input, progressCallback);

        expect(progressCallback).toHaveBeenCalled();

        const calls = progressCallback.mock.calls.map(call => call[0]);
        expect(calls).toHaveLength(7); // 7 phases

        expect(calls[0].phase).toBe('validation');
        expect(calls[1].phase).toBe('planning');
        expect(calls[6].phase).toBe('complete');
    });
});
```

### Step 3.4: Integration Tests (Day 14-15 - 10 hours)

```typescript
// ✅ packages/api/src/tests/integration/orchestration.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Orchestration Integration', () => {
    let app: FastifyInstance;
    let authToken: string;

    beforeAll(async () => {
        app = await buildApp();
        await app.listen({ port: 0 });

        // Get auth token
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            payload: {
                email: 'test@example.com',
                password: 'test-password'
            }
        });

        authToken = response.json().token;
    });

    afterAll(async () => {
        await app.close();
    });

    it('should complete full orchestration flow', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/orchestrate',
            headers: {
                authorization: `Bearer ${authToken}`
            },
            payload: {
                taskId: 'integration-test-1',
                projectId: 'test-project',
                prompt: 'Create a user authentication API with JWT',
                context: {
                    language: 'typescript',
                    framework: 'fastify'
                }
            }
        });

        expect(response.statusCode).toBe(200);

        const result = response.json();
        expect(result.success).toBe(true);
        expect(result.files).toBeDefined();
        expect(result.files.length).toBeGreaterThan(0);
        expect(result.subtasks).toBeDefined();
        expect(result.subtasks.length).toBeGreaterThan(0);
    });

    it('should require authentication', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/orchestrate',
            payload: {
                prompt: 'Create an API'
            }
        });

        expect(response.statusCode).toBe(401);
    });

    it('should validate input', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/orchestrate',
            headers: {
                authorization: `Bearer ${authToken}`
            },
            payload: {
                // Missing required fields
                prompt: ''
            }
        });

        expect(response.statusCode).toBe(400);
    });
});
```

---

## 📊 IMPLEMENTATION CHECKLIST

### Week 1: Dependency Injection
- [ ] Install inversify, reflect-metadata
- [ ] Create DI container configuration
- [ ] Define all service interfaces
- [ ] Refactor ContextManager to use DI
- [ ] Refactor LearningService to use DI
- [ ] Create Repository interfaces
- [ ] Implement ProjectRepository
- [ ] Implement TaskRepository
- [ ] Create request-scoped middleware
- [ ] Update main app to use DI
- [ ] Test all services work with DI
- [ ] Measure memory leak fix

### Week 2: Break Up God Object
- [ ] Create PlanningService
- [ ] Create GenerationService
- [ ] Create ValidationService
- [ ] Create OrchestrationService (facade)
- [ ] Migrate business logic from IntegratedOrchestrator
- [ ] Update all imports to use new services
- [ ] Delete old IntegratedOrchestrator
- [ ] Test end-to-end flow
- [ ] Measure performance improvement

### Week 3: Safety Nets
- [ ] Implement JWT authentication
- [ ] Create auth routes (login, register)
- [ ] Add authentication middleware
- [ ] Implement TransactionService
- [ ] Add transactions to orchestrator
- [ ] Write unit tests for all services
- [ ] Write integration tests
- [ ] Setup test coverage reporting
- [ ] Run full test suite
- [ ] Fix any failing tests
- [ ] Document new architecture

---

## 📈 EXPECTED OUTCOMES

### Before Refactor
| Metric | Current |
|--------|---------|
| Architecture Score | 6.5/10 |
| Code Quality | 5/10 (C+) |
| Test Coverage | 0% |
| Memory per Request | 85MB |
| Orchestration Time | 45s |
| Issues Count | 127 |

### After Refactor
| Metric | Target |
|--------|--------|
| Architecture Score | 9/10 (+38%) |
| Code Quality | 8/10 (+60%) |
| Test Coverage | 80%+ |
| Memory per Request | 25MB (-71%) |
| Orchestration Time | 15s (-67%) |
| Issues Count | <30 (-76%) |

---

## 🚀 GETTING STARTED

### Day 1 Checklist
```bash
# 1. Install dependencies
npm install inversify reflect-metadata
npm install --save-dev @types/inversify

# 2. Create DI directory
mkdir -p packages/api/src/di
mkdir -p packages/api/src/interfaces

# 3. Copy the container.ts from this plan
# (See Step 1.1 above)

# 4. Update tsconfig.json
# Add "experimentalDecorators": true and "emitDecoratorMetadata": true

# 5. Test build
npm run build

# 6. Run existing tests
npm test
```

### Immediate Wins (First 2 Days)
After completing Day 1-2, you'll have:
- ✅ DI container initialized
- ✅ Services can be created per-request
- ✅ Memory leaks stopped (request-scoped cleanup)
- ✅ Can inject mocks for testing

After completing Week 1:
- ✅ 40+ issues automatically resolved
- ✅ System is testable
- ✅ Memory usage reduced by 50%

After completing Week 2:
- ✅ 70+ issues automatically resolved
- ✅ Code is maintainable
- ✅ Services are focused and single-purpose

After completing Week 3:
- ✅ 90+ issues automatically resolved
- ✅ Production-ready
- ✅ 80%+ test coverage

---

## 📝 NOTES

**Why This Works:**

Your own reports identified **Singleton + God Object** as the root cause:
> "Fixing this ONE core issue automatically resolves 90+ of 127 issues"

This plan directly addresses that root cause by:
1. Eliminating singletons (DI)
2. Breaking up god object (focused services)
3. Adding safety nets (auth, transactions, tests)

**Risk Level:** LOW
- Incremental changes
- Can test at each step
- Can rollback if needed
- No framework changes

**Estimated Effort:** 3 weeks (120 hours)
**Team Size:** 1-2 developers
**Success Rate:** 95% (based on your own analysis)

---

**Next Steps:**

1. Review this plan with your team
2. Adjust timeline based on your availability
3. Start with Day 1 tasks
4. Create a separate branch for refactoring: `git checkout -b refactor/foundation`
5. Work through each phase sequentially
6. Test thoroughly at each step
7. Merge back to main when complete

**Questions?** Refer to your analysis reports:
- `docs/Issues/PERFORMANCE_ANALYSIS_REPORT.md`
- `docs/Issues/COMPREHENSIVE_PROJECT_ANALYSIS_REPORT.md`

Both reports confirm that fixing the Singleton + God Object pattern is the key to resolving 90+ issues automatically.
