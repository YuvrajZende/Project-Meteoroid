/**
 * AI Prompt Templates
 * Comprehensive prompt engineering for all agents
 * 
 * @author Person 2 (AI/ML Engineer)
 */

// ============================================
// BASE SYSTEM PROMPTS
// ============================================

export const SYSTEM_PROMPTS = {
    /**
     * General assistant system prompt
     */
    GENERAL: `You are an expert full-stack developer assistant specialized in generating 
production-ready code for modern web applications.

Key principles:
- Generate TypeScript code with proper typing
- Follow best practices and design patterns
- Include comprehensive error handling
- Add helpful comments and documentation
- Consider security, performance, and scalability
- Use modern ES modules (import/export)`,

    /**
     * Database agent system prompt
     */
    DATABASE_AGENT: `You are a database expert specializing in:
- Prisma ORM schema design and migrations
- Supabase PostgreSQL and Row-Level Security
- Database optimization and indexing
- Seed data generation

Key principles:
- Design normalized schemas with proper relationships
- Include appropriate indexes for query performance
- Always define foreign key constraints
- Use proper column types and constraints
- Generate TypeScript types alongside schemas
- Include RLS policies for multi-tenant applications`,

    /**
     * Queue agent system prompt
     */
    QUEUE_AGENT: `You are a background job processing expert specializing in:
- BullMQ for Redis-backed job queues
- Worker architecture and concurrency
- Retry strategies and dead letter queues
- Job scheduling and prioritization

Key principles:
- Design type-safe job payloads
- Implement proper error handling and retries
- Configure appropriate backoff strategies
- Include job progress tracking
- Set up queue monitoring and metrics
- Handle job failures gracefully`,

    /**
     * Test agent system prompt
     */
    TEST_AGENT: `You are a testing expert specializing in:
- Vitest and Jest for unit/integration testing
- Playwright for E2E testing
- Testing Library for component testing
- Test coverage and quality

Key principles:
- Write comprehensive test cases with edge cases
- Follow AAA (Arrange-Act-Assert) pattern
- Create proper mocks and fixtures
- Test both happy path and error scenarios
- Aim for high code coverage
- Include accessibility testing where applicable`,

    /**
     * Code generation system prompt
     */
    CODE_GENERATION: `You are an expert code generator. When asked to generate code:

1. Output ONLY valid, runnable code
2. Include proper TypeScript types
3. Add JSDoc comments for public APIs
4. Follow the project's existing patterns
5. Use ES modules (import/export)
6. Handle errors appropriately

Format your response as:
\`\`\`typescript
// Your code here
\`\`\`

Then provide a brief explanation of the code.`,
};

// ============================================
// FEW-SHOT EXAMPLES
// ============================================

export const FEW_SHOT_EXAMPLES = {
    /**
     * Prisma schema generation example
     */
    PRISMA_SCHEMA: {
        input: 'Create a User model with email, name, and role',
        output: `model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  role      Role     @default(USER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([email])
}

enum Role {
  USER
  ADMIN
  MODERATOR
}`,
    },

    /**
     * BullMQ queue example
     */
    BULLMQ_QUEUE: {
        input: 'Create a queue for sending emails',
        output: `import { Queue, QueueOptions } from 'bullmq';
import { redisConnection } from './redis';

export interface EmailJobData {
  to: string;
  subject: string;
  body: string;
  template?: string;
}

const queueOptions: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: { count: 1000, age: 24 * 3600 },
  },
};

export const emailQueue = new Queue<EmailJobData>('email', queueOptions);`,
    },

    /**
     * Unit test example
     */
    UNIT_TEST: {
        input: 'Write tests for a calculateTax function',
        output: `import { describe, it, expect } from 'vitest';
import { calculateTax } from './calculateTax';

describe('calculateTax', () => {
  describe('with valid income', () => {
    it('should calculate 10% tax for income below 50000', () => {
      expect(calculateTax(30000)).toBe(3000);
    });

    it('should calculate 20% tax for income above 50000', () => {
      expect(calculateTax(100000)).toBe(20000);
    });
  });

  describe('with edge cases', () => {
    it('should return 0 for zero income', () => {
      expect(calculateTax(0)).toBe(0);
    });

    it('should throw error for negative income', () => {
      expect(() => calculateTax(-1000)).toThrow('Income cannot be negative');
    });
  });
});`,
    },

    /**
     * E2E test example
     */
    E2E_TEST: {
        input: 'Write E2E test for login flow',
        output: `import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.fill('[data-testid="email"]', 'user@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="submit"]');
    
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Welcome');
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.fill('[data-testid="email"]', 'user@example.com');
    await page.fill('[data-testid="password"]', 'wrongpassword');
    await page.click('[data-testid="submit"]');
    
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Invalid credentials');
  });
});`,
    },
};

// ============================================
// CHAIN-OF-THOUGHT TEMPLATES
// ============================================

export const CHAIN_OF_THOUGHT = {
    /**
     * Schema design reasoning
     */
    SCHEMA_DESIGN: `Let me think through this schema design step by step:

1. **Entities**: What are the main entities/models needed?
2. **Relationships**: How do these entities relate to each other?
   - One-to-one
   - One-to-many
   - Many-to-many
3. **Fields**: What fields does each entity need?
   - Required vs optional
   - Primary keys and IDs
   - Timestamps (createdAt, updatedAt)
4. **Indexes**: Which fields need indexes for query performance?
5. **Constraints**: Any unique constraints or validations?
6. **Cascade**: How should deletions cascade?

Now let me generate the schema:`,

    /**
     * Test case reasoning
     */
    TEST_CASE_DESIGN: `Let me analyze what needs to be tested:

1. **Happy Path**: What should happen when everything works correctly?
2. **Edge Cases**: What are the boundary conditions?
   - Empty inputs
   - Maximum values
   - Minimum values
3. **Error Cases**: What errors should be thrown?
   - Invalid inputs
   - Missing required fields
   - Unauthorized access
4. **Integration Points**: What external dependencies need mocking?
5. **State Management**: How to set up and tear down test state?

Now let me write the tests:`,

    /**
     * Queue design reasoning
     */
    QUEUE_DESIGN: `Let me design this job queue step by step:

1. **Job Type**: What data does this job need?
2. **Processing**: What happens when the job runs?
3. **Failure Handling**: What if the job fails?
   - How many retries?
   - What backoff strategy?
   - Dead letter queue?
4. **Priority**: Does this need priority levels?
5. **Scheduling**: Should this be scheduled (cron)?
6. **Monitoring**: What metrics should we track?

Now let me generate the queue configuration:`,
};

// ============================================
// DYNAMIC PROMPT BUILDERS
// ============================================

/**
 * Build a database schema generation prompt
 */
export function buildDatabasePrompt(requirements: string, options: {
    orm?: 'prisma' | 'drizzle';
    database?: 'postgresql' | 'mysql' | 'sqlite';
    includeRLS?: boolean;
}): string {
    const orm = options.orm || 'prisma';
    const db = options.database || 'postgresql';

    return `${SYSTEM_PROMPTS.DATABASE_AGENT}

## Requirements
${requirements}

## Context
- ORM: ${orm}
- Database: ${db}
${options.includeRLS ? '- Include Row Level Security policies' : ''}

## Example
${FEW_SHOT_EXAMPLES.PRISMA_SCHEMA.output}

## Reasoning
${CHAIN_OF_THOUGHT.SCHEMA_DESIGN}

Generate the database schema now:`;
}

/**
 * Build a queue generation prompt
 */
export function buildQueuePrompt(requirements: string, options: {
    provider?: 'bullmq' | 'redis';
    includeWorker?: boolean;
    includeScheduler?: boolean;
}): string {
    return `${SYSTEM_PROMPTS.QUEUE_AGENT}

## Requirements
${requirements}

## Context
- Provider: ${options.provider || 'bullmq'}
${options.includeWorker ? '- Include worker implementation' : ''}
${options.includeScheduler ? '- Include job scheduling' : ''}

## Example
${FEW_SHOT_EXAMPLES.BULLMQ_QUEUE.output}

## Reasoning
${CHAIN_OF_THOUGHT.QUEUE_DESIGN}

Generate the queue configuration now:`;
}

/**
 * Build a test generation prompt
 */
export function buildTestPrompt(requirements: string, options: {
    framework?: 'vitest' | 'jest' | 'playwright';
    testType?: 'unit' | 'integration' | 'e2e';
    sourceCode?: string;
}): string {
    const example = options.testType === 'e2e'
        ? FEW_SHOT_EXAMPLES.E2E_TEST
        : FEW_SHOT_EXAMPLES.UNIT_TEST;

    return `${SYSTEM_PROMPTS.TEST_AGENT}

## Requirements
${requirements}

## Context
- Framework: ${options.framework || 'vitest'}
- Test Type: ${options.testType || 'unit'}

${options.sourceCode ? `## Source Code to Test
\`\`\`typescript
${options.sourceCode}
\`\`\`
` : ''}

## Example
${example.output}

## Reasoning
${CHAIN_OF_THOUGHT.TEST_CASE_DESIGN}

Generate the tests now:`;
}

/**
 * Build a general code generation prompt
 */
export function buildCodeGenerationPrompt(task: string, context: {
    language?: string;
    framework?: string;
    existingCode?: string;
    constraints?: string[];
}): string {
    const constraints = context.constraints?.length
        ? `## Constraints\n${context.constraints.map(c => `- ${c}`).join('\n')}`
        : '';

    return `${SYSTEM_PROMPTS.CODE_GENERATION}

## Task
${task}

## Context
- Language: ${context.language || 'TypeScript'}
- Framework: ${context.framework || 'Node.js'}

${context.existingCode ? `## Existing Code
\`\`\`typescript
${context.existingCode}
\`\`\`
` : ''}

${constraints}

Generate the code now:`;
}

// ============================================
// PROMPT VERSIONING
// ============================================

export const PROMPT_VERSIONS = {
    DATABASE_AGENT: '1.0.0',
    QUEUE_AGENT: '1.0.0',
    TEST_AGENT: '1.0.0',
    CODE_GENERATION: '1.0.0',
};

// ============================================
// PROMPT METRICS
// ============================================

export interface PromptMetrics {
    promptId: string;
    version: string;
    tokensUsed: number;
    responseTime: number;
    success: boolean;
    timestamp: Date;
}

export function trackPromptUsage(metrics: PromptMetrics): void {
    // In production, this would send to analytics
    console.log(`[PROMPT-METRICS] ${metrics.promptId} v${metrics.version}: ${metrics.success ? 'success' : 'failed'} in ${metrics.responseTime}ms`);
}
