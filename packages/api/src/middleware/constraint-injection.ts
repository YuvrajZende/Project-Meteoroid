/**
 * ============================================
 * CONSTRAINT INJECTION MIDDLEWARE
 * ============================================
 * 
 * Phase 14.2: System Prompt Engineering
 * 
 * This middleware injects tech stack constraints into agent prompts
 * to ensure consistent, opinionated code generation across all agents.
 */

import {
    StackPresetType,
    StackPreset,
    detectStackType,
    getStackPreset,
    generateConstraintPrompt,
    FRAMEWORK_PATTERNS
} from '../config/stack-constraints.js';

// ============================================
// TYPES
// ============================================

export interface PromptContext {
    userPrompt: string;
    projectDescription?: string;
    stackType?: StackPresetType;
    agentName?: string;
    existingCode?: string;
    customConstraints?: string[];
}

export interface EnhancedPrompt {
    systemPrompt: string;
    userPrompt: string;
    constraintSummary: string;
    detectedStack: StackPresetType;
    preset: StackPreset;
}

// ============================================
// SYSTEM PROMPT TEMPLATES
// ============================================

const BASE_SYSTEM_PROMPT = `You are an expert code generation AI. You generate production-ready, type-safe code following strict patterns and best practices.

## CORE PRINCIPLES:
1. Generate ONLY working, compilable code
2. Follow the specified tech stack EXACTLY - no alternatives
3. Use modern TypeScript patterns with strict typing
4. Include proper error handling and validation
5. Add appropriate comments for complex logic
6. Never hallucinate non-existent APIs or packages
`;

const AGENT_SPECIFIC_PROMPTS: Record<string, string> = {
    'auth-agent': `
## AUTH AGENT SPECIALIZATION:
- Generate secure authentication implementations
- Always use bcrypt or argon2 for password hashing (never MD5/SHA1)
- Implement proper JWT with refresh token rotation
- Include CSRF protection for session-based auth
- Add rate limiting to auth endpoints
- Never log sensitive data (passwords, tokens)
`,

    'security-agent': `
## SECURITY AGENT SPECIALIZATION:
- Apply defense-in-depth approach
- Implement input validation at all entry points
- Use parameterized queries (never string concatenation)
- Configure security headers (Helmet defaults + custom)
- Add rate limiting with tiered limits per endpoint
- Implement audit logging for sensitive operations
`,

    'monitoring-agent': `
## MONITORING AGENT SPECIALIZATION:
- Use structured logging (Pino with JSON)
- Include request IDs for distributed tracing
- Add health check endpoints (basic + deep)
- Implement graceful shutdown with cleanup
- Use appropriate log levels (error, warn, info, debug)
- Never log sensitive data or PII
`,

    'database-agent': `
## DATABASE AGENT SPECIALIZATION:
- Generate Prisma schema with proper relations
- Use migrations for schema changes
- Implement connection pooling
- Add soft delete where appropriate
- Use transactions for multi-table operations
- Include indexes for frequently queried fields
`,

    'api-agent': `
## API AGENT SPECIALIZATION:
- Follow RESTful conventions
- Use proper HTTP status codes
- Implement pagination for list endpoints
- Add request validation with Zod schemas
- Include OpenAPI/Swagger documentation
- Use proper error response format
`,

    'codegen-agent': `
## CODEGEN AGENT SPECIALIZATION:
- Generate complete, runnable code
- Include all necessary imports
- Add TypeScript types for all functions
- Follow project naming conventions
- Include basic test stubs
- Add configuration placeholders with comments
`
};

// ============================================
// DO NOT SUGGEST ALTERNATIVES BLOCK
// ============================================

const DO_NOT_SUGGEST_BLOCK = `
## ⛔ CRITICAL: DO NOT SUGGEST ALTERNATIVES

You MUST NOT:
- Suggest alternative frameworks (e.g., "you could also use Express instead of Fastify")
- Recommend different libraries than those specified
- Provide multiple options for the same functionality
- Question the tech stack choices
- Mention that "there are other ways to do this"

You MUST:
- Use ONLY the specified technologies
- Generate code that works with the given stack
- Follow the patterns established in the project
- Be opinionated and decisive in your implementations
`;

// ============================================
// MIDDLEWARE FUNCTIONS
// ============================================

/**
 * Main function to inject constraints into prompts
 */
export function injectConstraints(context: PromptContext): EnhancedPrompt {
    // Detect stack type from description or use provided
    const detectedStack = context.stackType || detectStackType(
        context.projectDescription || context.userPrompt
    );

    const preset = getStackPreset(detectedStack);

    // Build system prompt
    let systemPrompt = BASE_SYSTEM_PROMPT;

    // Add stack constraints
    systemPrompt += '\n' + generateConstraintPrompt(detectedStack);

    // Add agent-specific prompt if applicable
    if (context.agentName && AGENT_SPECIFIC_PROMPTS[context.agentName]) {
        systemPrompt += '\n' + AGENT_SPECIFIC_PROMPTS[context.agentName];
    }

    // Add framework patterns
    const framework = preset.backend.framework;
    if (FRAMEWORK_PATTERNS[framework as keyof typeof FRAMEWORK_PATTERNS]) {
        const patterns = FRAMEWORK_PATTERNS[framework as keyof typeof FRAMEWORK_PATTERNS];
        systemPrompt += `
## ${framework.toUpperCase()} PATTERNS:
\`\`\`typescript
// Imports
${patterns.imports}

// App Creation
${patterns.appCreation}

// Route Pattern
${patterns.routePattern}

// Error Handling
${patterns.errorHandling}
\`\`\`
`;
    }

    // Add DO NOT SUGGEST block
    systemPrompt += '\n' + DO_NOT_SUGGEST_BLOCK;

    // Add custom constraints if provided
    if (context.customConstraints && context.customConstraints.length > 0) {
        systemPrompt += '\n## ADDITIONAL CONSTRAINTS:\n';
        for (const constraint of context.customConstraints) {
            systemPrompt += `- ${constraint}\n`;
        }
    }

    // Build constraint summary for logging
    const constraintSummary = [
        `Stack: ${detectedStack}`,
        `Framework: ${preset.backend.framework}`,
        `ORM: ${preset.database.orm}`,
        `Auth: ${preset.auth.provider}`,
        `Validation: ${preset.security.validation}`,
        `Agent: ${context.agentName || 'generic'}`
    ].join(' | ');

    return {
        systemPrompt,
        userPrompt: context.userPrompt,
        constraintSummary,
        detectedStack,
        preset
    };
}

/**
 * Get agent-specific system prompt addition
 */
export function getAgentPromptAddition(agentName: string): string {
    return AGENT_SPECIFIC_PROMPTS[agentName] || '';
}

/**
 * Create a code generation prompt with all constraints
 */
export function createCodeGenPrompt(
    task: string,
    stackType: StackPresetType,
    _agentName: string, // Reserved for future agent-specific customization
    existingCode?: string
): string {
    const preset = getStackPreset(stackType);

    let prompt = `Generate code for the following task. Follow all constraints exactly.

## TASK:
${task}

## STACK CONFIGURATION:
- Framework: ${preset.backend.framework}
- Language: ${preset.backend.language}
- ORM: ${preset.database.orm}
- Database: ${preset.database.database}
- Auth: ${preset.auth.provider}
- Validation: ${preset.security.validation}
- Logging: ${preset.monitoring.logging}
`;

    if (existingCode) {
        prompt += `
## EXISTING CODE CONTEXT:
\`\`\`typescript
${existingCode}
\`\`\`

Ensure your generated code integrates seamlessly with the existing code.
`;
    }

    prompt += `
## OUTPUT REQUIREMENTS:
1. Complete, working code only
2. Include all necessary imports
3. Add TypeScript types for all parameters and return values
4. Include error handling
5. Add brief comments for complex logic
6. Do NOT include explanatory text outside code blocks
`;

    return prompt;
}

/**
 * Validate generated code against constraints
 */
export function validateGeneratedCode(
    code: string,
    stackType: StackPresetType
): { valid: boolean; violations: string[] } {
    const preset = getStackPreset(stackType);
    const violations: string[] = [];

    // Check for forbidden imports
    const forbiddenImports: Record<StackPresetType, string[]> = {
        api: ['express', 'koa', 'mongoose', 'joi', 'yup'],
        web: ['express', 'styled-components', 'emotion', 'redux'],
        fullstack: ['express', 'pages/api', 'getServerProps'],
        mobile: ['react-native-cli', 'stylesheet.create'],
        microservices: ['express', 'direct-db-import'],
        serverless: ['fs.writeFile', 'global-state', 'in-memory-cache']
    };

    const forbidden = forbiddenImports[stackType] || [];

    for (const pkg of forbidden) {
        if (code.toLowerCase().includes(pkg.toLowerCase())) {
            violations.push(`Forbidden import/pattern detected: "${pkg}"`);
        }
    }

    // Check if using correct framework
    if (preset.backend.framework === 'fastify' &&
        code.includes("import express from 'express'")) {
        violations.push('Using Express when Fastify is required');
    }

    // Check for Zod usage if required
    if (preset.security.validation === 'zod' &&
        code.includes('validation') &&
        !code.includes('zod') &&
        !code.includes('z.')) {
        violations.push('Validation should use Zod, but Zod is not imported');
    }

    return {
        valid: violations.length === 0,
        violations
    };
}

/**
 * Get the full constraint configuration as JSON for debugging
 */
export function getConstraintConfig(stackType: StackPresetType): Record<string, unknown> {
    const preset = getStackPreset(stackType);

    return {
        stackType,
        preset: {
            name: preset.name,
            description: preset.description,
            backend: preset.backend,
            frontend: preset.frontend,
            database: preset.database,
            auth: preset.auth,
            security: preset.security,
            monitoring: preset.monitoring
        },
        constraints: preset.constraints,
        requiredPackages: preset.additionalPackages,
        envVariables: preset.envVariables
    };
}

// ============================================
// EXPORTS
// ============================================

export {
    BASE_SYSTEM_PROMPT,
    AGENT_SPECIFIC_PROMPTS,
    DO_NOT_SUGGEST_BLOCK
};

// Re-export types for convenience
export type { StackPresetType } from '../config/stack-constraints.js';

