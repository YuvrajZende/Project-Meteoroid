# 🤖 AGENT DEVELOPMENT GUIDE
## Building the Loveable for Backend Agent System

---

## 📋 TABLE OF CONTENTS

1. [Architecture Overview](#architecture-overview)
2. [Agent Development Strategy](#agent-development-strategy)
3. [Building Blocks](#building-blocks)
4. [Agent Implementation Blueprint](#agent-implementation-blueprint)
5. [Testing Strategy](#testing-strategy)
6. [User Query Processing Flow](#user-query-processing-flow)
7. [Development Tools & Frameworks](#development-tools--frameworks)
8. [Code Examples](#code-examples)
9. [Best Practices](#best-practices)
10. [Troubleshooting Guide](#troubleshooting-guide)

---

## 🏗️ ARCHITECTURE OVERVIEW

### System Design Philosophy

```
We're NOT building AI agents from scratch.
We're orchestrating EXISTING powerful AI models (Claude, GPT-4)
with specialized prompts and workflows.
```

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  LAYER 3: ORCHESTRATION                 │
│  ┌─────────────────┐  ┌─────────────────┐               │
│  │   AutoGen       │  │   MCP Protocol  │               │
│  │   Framework     │  │   Communication │               │
│  └─────────────────┘  └─────────────────┘               │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                  LAYER 2: AGENT SYSTEM                   │
│                                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │  Agent Base │ │ Specialized │ │ Utility     │        │
│  │   Class     │ │ Agents      │ │ Functions   │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                  LAYER 1: AI MODELS                     │
│                                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │   Claude    │ │    GPT-4    │ │   Gemini    │        │
│  │  Sonnet 4.5 │ │     o       │ │   Pro       │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────┘
```

### Key Decision: Why Not Build From Scratch?

1. **Time to Market**: Existing models are incredibly capable
2. **Cost Efficiency**: $100M+ to train GPT-4 level model
3. **Maintenance**: Models are constantly improving
4. **Reliability**: Proven models with enterprise support
5. **Focus**: Our value is in orchestration, not model training

---

## 🎯 AGENT DEVELOPMENT STRATEGY

### The "Smart Wrapper" Approach

```typescript
// We're not creating the AI brain
// We're creating specialized "smart wrappers" around existing AI

interface AgentWrapper {
  // Input: Task description + context
  process(task: Task): Promise<GeneratedCode>;

  // Core components:
  // 1. Prompt templates (specialized for each agent type)
  // 2. Context gathering (understands project state)
  // 3. Output validation (ensures quality)
  // 4. Tool integration (uses specialized tools)
}
```

### Agent Types by Complexity

#### Type 1: Simple Generation Agents
- **Auth Agent**: Generates auth middleware from requirements
- **Database Agent**: Creates schemas and migrations
- **API Agent**: Generates REST endpoints from specs

#### Type 2: Tool-Enhanced Agents
- **Security Agent**: Uses scanning tools (Trivy, Escape.tech)
- **Test Agent**: Integrates with testing frameworks
- **CI/CD Agent**: Generates pipeline configurations

#### Type 3: Coordination Agents
- **Orchestrator**: Coordinates other agents
- **Monitoring Agent**: Sets up observability
- **Infrastructure Agent**: Manages IaC generation

---

## 🧱 BUILDING BLOCKS

### 1. Core Agent Base Class

```typescript
// packages/core/src/agent/base-agent.ts

import { LLMProvider } from '../llm/provider';
import { PromptTemplate } from '../prompts/template';
import { ContextManager } from '../context/manager';
import { Validator } from '../validation/validator';

export abstract class BaseAgent {
  protected llm: LLMProvider;
  protected prompts: Map<string, PromptTemplate>;
  protected context: ContextManager;
  protected validator: Validator;

  constructor(config: AgentConfig) {
    this.llm = new LLMProvider(config.llm);
    this.context = new ContextManager(config.context);
    this.validator = new Validator(config.validation);
    this.prompts = this.loadPrompts();
  }

  abstract process(task: AgentTask): Promise<AgentResult>;

  protected async executeLLM(prompt: string, tools?: Tool[]): Promise<string> {
    return this.llm.complete({
      prompt,
      tools: tools || [],
      temperature: this.getTemperature(),
      maxTokens: this.getMaxTokens()
    });
  }
}
```

### 2. LLM Provider Abstraction

```typescript
// packages/core/src/llm/provider.ts

export class LLMProvider {
  private providers: Map<string, LLMInterface> = new Map();

  constructor() {
    this.providers.set('claude', new ClaudeProvider());
    this.providers.set('openai', new OpenAIProvider());
    this.providers.set('gemini', new GeminiProvider());
  }

  async complete(request: CompletionRequest): Promise<string> {
    const provider = this.selectProvider(request);
    return provider.complete(request);
  }

  private selectProvider(request: CompletionRequest): LLMInterface {
    // Smart routing based on task type
    if (request.taskType === 'code-generation') {
      return this.providers.get('claude'); // Best for TypeScript
    }
    if (request.taskType === 'analysis') {
      return this.providers.get('gpt-4'); // Best for reasoning
    }
    return this.providers.get('claude'); // Default
  }
}
```

### 3. Prompt Template System

```typescript
// packages/core/src/prompts/template.ts

export class PromptTemplate {
  private template: string;
  private variables: string[];

  constructor(templatePath: string) {
    const content = fs.readFileSync(templatePath, 'utf-8');
    this.parseTemplate(content);
  }

  render(context: any): string {
    let rendered = this.template;
    for (const variable of this.variables) {
      rendered = rendered.replace(
        `{{${variable}}}`,
        this.getValue(context, variable)
      );
    }
    return rendered;
  }

  // Example template for Auth Agent:
  /*
  You are an authentication specialist generating TypeScript code.

  Project Context:
  - Framework: {{framework}}
  - Database: {{database}}
  - Auth Method: {{authMethod}}

  Requirements:
  {{requirements}}

  Generate complete authentication middleware with:
  1. User model
  2. Auth controllers
  3. Middleware functions
  4. Error handling
  5. Type definitions
  */
}
```

---

## 🔧 AGENT IMPLEMENTATION BLUEPRINT

### Step 1: Define Agent Interface

```typescript
// packages/auth-agent/src/interface.ts

export interface AuthAgentConfig extends AgentConfig {
  supportedProviders: ('clerk' | 'auth0' | 'custom')[];
  defaultDatabase: string;
}

export interface AuthTask extends AgentTask {
  type: 'auth-setup';
  provider: string;
  features: {
    login: boolean;
    register: boolean;
    mfa: boolean;
    social: boolean;
  };
}
```

### Step 2: Implement Agent Class

```typescript
// packages/auth-agent/src/auth-agent.ts

export class AuthAgent extends BaseAgent {
  constructor(config: AuthAgentConfig) {
    super(config);
  }

  async process(task: AuthTask): Promise<AuthResult> {
    // 1. Gather context
    const context = await this.context.gather(task);

    // 2. Select appropriate prompt
    const prompt = this.prompts.get('generate-auth').render({
      provider: task.provider,
      features: task.features,
      framework: context.framework,
      database: context.database
    });

    // 3. Execute with tools
    const tools = this.getToolsForProvider(task.provider);
    const response = await this.executeLLM(prompt, tools);

    // 4. Parse and validate
    const generated = this.parseResponse(response);
    await this.validator.validate(generated);

    // 5. Post-process
    return this.postProcess(generated, context);
  }

  private getToolsForProvider(provider: string): Tool[] {
    const tools = [new FileWriter(), new TypeValidator()];

    if (provider === 'clerk') {
      tools.push(new ClerkIntegrator());
    }

    return tools;
  }
}
```

### Step 3: Create Tool Functions

```typescript
// packages/auth-agent/src/tools/clerk-integrator.ts

export class ClerkIntegrator implements Tool {
  name = 'clerk_integrate';
  description = 'Integrate Clerk authentication';

  async execute(params: {
    apiKey: string;
    frontendUrl: string;
  }): Promise<IntegrationResult> {
    // 1. Create Clerk client
    const clerk = Clerk({ apiKey: params.apiKey });

    // 2. Configure application
    await clerk.updateApplication({
      callbackUrls: [params.frontendUrl],
      logoutUrls: [params.frontendUrl]
    });

    // 3. Generate environment variables
    const envVars = {
      CLERK_PUBLISHABLE_KEY: clerk.publishableKey,
      CLERK_SECRET_KEY: params.apiKey
    };

    return {
      envVars,
      instructions: this.getInstructions()
    };
  }
}
```

---

## 🧪 TESTING STRATEGY

### 1. Unit Testing Individual Agents

```typescript
// packages/auth-agent/src/__tests__/auth-agent.test.ts

describe('AuthAgent', () => {
  let agent: AuthAgent;
  let mockLLM: MockLLMProvider;

  beforeEach(() => {
    mockLLM = new MockLLMProvider();
    agent = new AuthAgent({
      llm: mockLLM,
      context: new MockContextManager()
    });
  });

  it('should generate Clerk authentication', async () => {
    // Arrange
    const task: AuthTask = {
      type: 'auth-setup',
      provider: 'clerk',
      features: { login: true, register: true, mfa: false, social: false }
    };

    mockLLM.setResponse(MOCK_CLERK_RESPONSE);

    // Act
    const result = await agent.process(task);

    // Assert
    expect(result.files).toHaveProperty('auth/middleware.ts');
    expect(result.files).toHaveProperty('auth/controller.ts');
    expect(result.envVars).toHaveProperty('CLERK_PUBLISHABLE_KEY');
    await expect(result.files['auth/middleware.ts'])
      .toMatchFileSnapshot('__snapshots__/middleware.ts');
  });
});
```

### 2. Integration Testing

```typescript
// packages/core/src/__tests__/agent-integration.test.ts

describe('Agent Integration', () => {
  it('should coordinate Auth and API agents', async () => {
    const orchestrator = new Orchestrator();

    const task = {
      description: 'Create a blog API with authentication',
      requirements: ['JWT auth', 'CRUD operations', 'role-based access']
    };

    const result = await orchestrator.process(task);

    // Verify both agents contributed
    expect(result.files).toHaveProperty('auth/*');
    expect(result.files).toHaveProperty('api/*');

    // Verify integration points
    expect(result.files['api/posts.ts'])
      .toContain('authMiddleware');
  });
});
```

### 3. End-to-End Testing

```typescript
// e2e/tests/user-journey.test.ts

describe('Complete User Journey', () => {
  it('should generate full backend from user query', async () => {
    const userQuery = "I need a todo API with user authentication";

    // Process through system
    const result = await system.process(userQuery);

    // Verify complete project
    expect(result.structure).toEqual({
      'src/auth/': expect.any(Object),
      'src/api/': expect.any(Object),
      'src/models/': expect.any(Object),
      'tests/': expect.any(Object),
      'docker-compose.yml': expect.any(String),
      'package.json': expect.any(Object)
    });

    // Verify it actually works
    const testResult = await testGeneratedCode(result);
    expect(testResult.success).toBe(true);
  });
});
```

---

## 🔄 USER QUERY PROCESSING FLOW

### Complete Flow Diagram

```
User Input
    │
    ▼
┌─────────────────┐
│   Intent Parser │  ← "What does the user want?"
│   (Claude)       │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│   Task Breakdown│  ← "Which agents are needed?"
│   (Decision     │
│    Tree)        │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│   Agent         │  ← "Execute in parallel where possible"
│  Coordination   │
│   (AutoGen)     │
└─────┬─────┬─────┘
      │     │
      ▼     ▼
┌─────────┐ ┌─────────┐
│  Agent 1│ │  Agent 2│  ← Each agent uses appropriate LLM
│(Claude) │ │ (GPT-4) │
└─────┬───┘ └─────┬───┘
      │           │
      ▼           ▼
┌─────────────────┐
│   Result        │  ← "Combine and validate"
│  Aggregation    │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│   Validation    │  ← "Is the code good?"
│   & Testing     │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│   Output        │  ← "Present to user"
│  Formatting     │
└─────────────────┘
```

### Step-by-Step Implementation

#### Step 1: Intent Parsing

```typescript
// packages/orchestrator/src/intent-parser.ts

export class IntentParser {
  async parse(query: string): Promise<Intent> {
    const prompt = `
    Analyze this user request: "${query}"

    Return JSON with:
    {
      "primaryIntent": "api|auth|database|deployment|all",
      "entities": ["auth", "api", "database"],
      "technologies": ["typescript", "postgresql", "jwt"],
      "complexity": "simple|medium|complex",
      "confidence": 0.95
    }
    `;

    const response = await this.llm.complete(prompt);
    return JSON.parse(response);
  }
}
```

#### Step 2: Task Distribution

```typescript
// packages/orchestrator/src/task-distributor.ts

export class TaskDistributor {
  private agentRegistry: Map<string, BaseAgent>;

  distribute(intent: Intent): AgentTask[] {
    const tasks: AgentTask[] = [];

    // Always include Auth if needed
    if (intent.entities.includes('auth')) {
      tasks.push({
        type: 'auth-setup',
        agent: 'auth',
        priority: 1,
        dependencies: []
      });
    }

    // API depends on Auth
    if (intent.entities.includes('api')) {
      tasks.push({
        type: 'api-generation',
        agent: 'api',
        priority: 2,
        dependencies: intent.entities.includes('auth') ? ['auth-setup'] : []
      });
    }

    return tasks;
  }
}
```

#### Step 3: Parallel Execution

```typescript
// packages/orchestrator/src/executor.ts

export class TaskExecutor {
  async execute(tasks: AgentTask[]): Promise<Map<string, any>> {
    const results = new Map();
    const taskQueue = new PriorityQueue(tasks);

    while (!taskQueue.isEmpty()) {
      const task = taskQueue.dequeue();

      // Check dependencies
      if (this.hasUnmetDeps(task, results)) {
        taskQueue.enqueue(task);
        continue;
      }

      // Execute in parallel when possible
      const executable = taskQueue.getExecutableTasks();
      const promises = executable.map(t => this.runAgent(t));

      const batchResults = await Promise.allSettled(promises);

      // Store results
      executable.forEach((t, i) => {
        results.set(t.id, batchResults[i]);
      });
    }

    return results;
  }
}
```

---

## 🛠️ DEVELOPMENT TOOLS & FRAMEWORKS

### Essential Libraries

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.20.0",
    "openai": "^4.20.0",
    "autogen": "^0.2.0",
    "ts-morph": "^21.0.0",
    "prisma": "^5.6.0",
    "redis": "^4.6.0",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "playwright": "^1.40.0",
    "typescript": "^5.3.0",
    "eslint": "^8.54.0"
  }
}
```

### Development Environment Setup

```bash
# 1. Clone repository
git clone https://github.com/yourorg/loveable-backend.git
cd loveable-backend

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Edit .env with your API keys

# 4. Start development
npm run dev

# 5. Run tests
npm test

# 6. Build for production
npm run build
```

### IDE Configuration

```json
// .vscode/settings.json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.git": true
  }
}
```

---

## 💻 CODE EXAMPLES

### Complete Auth Agent Implementation

```typescript
// packages/auth-agent/src/index.ts

export class AuthAgent extends BaseAgent<AuthConfig> {
  private readonly providers = new Map([
    ['clerk', new ClerkProvider()],
    ['auth0', new Auth0Provider()],
    ['custom', new CustomProvider()]
  ]);

  async process(task: AuthTask): Promise<AuthResult> {
    // 1. Validate input
    this.validateTask(task);

    // 2. Get provider
    const provider = this.providers.get(task.provider);
    if (!provider) {
      throw new Error(`Unsupported auth provider: ${task.provider}`);
    }

    // 3. Generate base authentication code
    const baseCode = await this.generateBaseAuth(task);

    // 4. Add provider-specific code
    const providerCode = await provider.generate(task);

    // 5. Merge and optimize
    const merged = this.mergeCode(baseCode, providerCode);
    const optimized = await this.optimizeCode(merged);

    // 6. Create test files
    const tests = await this.generateTests(optimized, task);

    // 7. Generate documentation
    const docs = await this.generateDocs(optimized, task);

    return {
      files: {
        ...optimized.files,
        ...tests,
        ...docs
      },
      envVars: provider.getEnvVars(),
      dependencies: this.getDependencies(),
      instructions: provider.getInstructions()
    };
  }

  private async generateBaseAuth(task: AuthTask): Promise<CodeResult> {
    const prompt = `
    Generate TypeScript authentication middleware with:
    - Express.js compatibility
    - JWT tokens
    - Role-based access control
    - Error handling
    - Type definitions

    Features required: ${JSON.stringify(task.features)}
    Framework: Express.js
    Database: ${task.database || 'PostgreSQL'}
    `;

    return this.executeLLM(prompt, [
      new TypeScriptValidator(),
      new FileWriter(),
      new TypeGenerator()
    ]);
  }
}
```

### Real-World Tool Implementation

```typescript
// packages/tools/src/security-scanner.ts

export class SecurityScanner implements Tool {
  name = 'security_scan';
  description = 'Scan generated code for security vulnerabilities';

  async execute(params: { files: Record<string, string> }) {
    const results = await Promise.all([
      this.scanWithTrivy(params.files),
      this.scanWithSemgrep(params.files),
      this.scanWithCustomRules(params.files)
    ]);

    return {
      vulnerabilities: this.mergeResults(results),
      fixes: await this.generateFixes(results),
      score: this.calculateSecurityScore(results)
    };
  }

  private async scanWithTrivy(files: Record<string, string>) {
    // Run Trivy on generated files
    const trivy = new TrivyScanner();
    return trivy.scan(files);
  }

  private async generateFixes(results: ScanResult[]) {
    const fixes = [];
    for (const vuln of this.getCriticalVulns(results)) {
      const fix = await this.llm.complete(`
      Fix this security vulnerability:
      Type: ${vuln.type}
      File: ${vuln.file}
      Code: ${vuln.code}

      Provide secure TypeScript code replacement.
      `);

      fixes.push({ vuln, fix });
    }
    return fixes;
  }
}
```

---

## ✅ BEST PRACTICES

### 1. Prompt Engineering

```typescript
// DO: Use structured prompts
const goodPrompt = `
You are an expert TypeScript developer.
Task: Generate ${entity} for ${framework}
Context: ${context}
Requirements:
1. Must be type-safe
2. Include error handling
3. Add comprehensive tests

Output format: JSON with files array
`;

// DON'T: Use vague prompts
const badPrompt = "Make some auth code";
```

### 2. Error Handling

```typescript
// Always wrap LLM calls
try {
  const result = await this.llm.complete(prompt);
  return this.parseResult(result);
} catch (error) {
  // Fallback strategy
  logger.error('LLM failed, using template', error);
  return this.useTemplate(task);
}
```

### 3. Caching

```typescript
// Cache expensive LLM calls
const cacheKey = this.generateCacheKey(prompt);
const cached = await this.cache.get(cacheKey);
if (cached) return cached;

const result = await this.llm.complete(prompt);
await this.cache.set(cacheKey, result, { ttl: 3600 });
return result;
```

### 4. Validation

```typescript
// Always validate generated code
const validation = await this.validator.validate(code);
if (!validation.isValid) {
  // Retry with feedback
  const retryPrompt = `${prompt}\n\nFix these issues:\n${validation.errors}`;
  return this.llm.complete(retryPrompt);
}
```

---

## 🚨 TROUBLESHOOTING GUIDE

### Common Issues

1. **LLM Rate Limits**
   ```typescript
   // Implement exponential backoff
   const result = await retry(
     () => this.llm.complete(prompt),
     { retries: 3, delay: 1000 }
   );
   ```

2. **Generated Code Won't Compile**
   ```typescript
   // Use ts-morph to fix syntax errors
   const sourceFile = ts.addSourceFileFromText('tmp.ts', code);
   sourceFile.fixUnusedIdentifiers();
   const fixedCode = sourceFile.getFullText();
   ```

3. **Agent Dependencies Not Met**
   ```typescript
   // Create dependency graph
   const graph = new DependencyGraph(tasks);
   const ordered = graph.topologicalSort();
   // Execute in order, not parallel
   ```

4. **Memory Issues with Large Projects**
   ```typescript
   // Stream generation for large files
   for await (const chunk of this.llm.stream(prompt)) {
     yield chunk;
     // Process chunk, don't hold everything in memory
   }
   ```

### Debugging Tools

```typescript
// Enable debug mode
process.env.DEBUG = 'loveable:*';

// Add logging
import debug from 'debug';
const log = debug('loveable:auth-agent');
log('Processing task', task);

// Use observability
import { trace } from '@opentelemetry/api';
const span = trace.getActiveSpan();
span?.setAttributes({ 'agent.type': 'auth' });
```

### Performance Optimization

```typescript
// 1. Parallel processing
const promises = agents.map(agent => agent.process(task));
const results = await Promise.all(promises);

// 2. Streaming responses
for await (const token of this.llm.stream(prompt)) {
  // Send token to user immediately
}

// 3. Intelligent caching
const shouldCache = this.isDeterministic(prompt);
if (shouldCache) {
  return this.fromCache(prompt);
}
```

---

## 📚 RESOURCES

### Documentation
- [AutoGen Documentation](https://microsoft.github.io/autogen/)
- [Claude API Guide](https://docs.anthropic.com/claude/reference)
- [TypeScript AST](https://github.com/dsherret/ts-morph)

### Community
- [Discord Server](https://discord.gg/loveable)
- [GitHub Discussions](https://github.com/loveable/backend/discussions)
- [Stack Overflow Tag](https://stackoverflow.com/questions/tagged/loveable-backend)

### Training
- [Prompt Engineering Guide](https://www.promptingguide.ai/)
- [LLM Ops Best Practices](https://llmops.org/)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)

---

*Last Updated: December 2024*
*Version: 1.0.0*

---

## 🎯 QUICK START CHECKLIST

For developers building agents:

- [ ] Understand the 3-layer architecture
- [ ] Set up development environment
- [ ] Create agent interface
- [ ] Implement BaseAgent subclass
- [ ] Write prompt templates
- [ ] Create tool functions
- [ ] Add comprehensive tests
- [ ] Document agent capabilities
- [ ] Register with orchestrator

Remember: **We're orchestrating, not recreating!** Leverage existing AI models and focus on excellent prompts and workflows.