/**
 * ============================================
 * AGENT STACK CONSTRAINTS SERVICE
 * ============================================
 * 
 * Phase 14.4: Per-Agent Stack Constraints
 * 
 * This service provides stack constraints to agents, ensuring consistent
 * code generation across the entire system. Agents can call these methods
 * to get the appropriate constraints for their specific domain.
 */

import {
    StackPresetType,
    StackPreset,
    detectStackType,
    getStackPreset,
    generateConstraintPrompt,
} from '../../../config/stack-constraints.js';
import { AGENT_SPECIFIC_PROMPTS } from '../../../middleware/constraint-injection.js';

// ============================================
// TYPES
// ============================================

export interface AgentConstraints {
    stackType: StackPresetType;
    preset: StackPreset;
    systemPromptAddition: string;
    agentSpecificPrompt: string;
    forbiddenPatterns: string[];
    requiredPatterns: string[];
}

export type AgentType =
    | 'auth-agent'
    | 'security-agent'
    | 'monitoring-agent'
    | 'database-agent'
    | 'api-agent'
    | 'codegen-agent'
    | 'queue-agent'
    | 'test-agent';

// ============================================
// AGENT-SPECIFIC FORBIDDEN PATTERNS
// ============================================

const AGENT_FORBIDDEN_PATTERNS: Record<AgentType, string[]> = {
    'auth-agent': [
        'md5(',
        'sha1(',
        'password in plain text',
        'jwt.sign without expiresIn',
        'localStorage.setItem.*token',
        'console.log.*password',
        'console.log.*token',
    ],
    'security-agent': [
        'eval(',
        'Function(',
        'innerHTML =',
        'dangerouslySetInnerHTML',
        'document.write',
        'disable.*csp',
        'cors: { origin: "*" }',
        "cors.*origin.*'*'",
    ],
    'monitoring-agent': [
        'console.log',  // Should use proper logger
        'throw new Error without catch',
    ],
    'database-agent': [
        'DROP TABLE',
        'DELETE FROM.*WHERE 1=1',
        '${',  // Template literal in SQL (injection risk)
        'raw query.*user input',
    ],
    'api-agent': [
        'any',  // Avoid TypeScript any
        'res.send(req.',  // Potential reflection XSS
    ],
    'codegen-agent': [],
    'queue-agent': [
        'setTimeout.*blocking',
    ],
    'test-agent': [],
};

// ============================================
// AGENT-SPECIFIC REQUIRED PATTERNS
// ============================================

const AGENT_REQUIRED_PATTERNS: Record<AgentType, string[]> = {
    'auth-agent': [
        'bcrypt|argon2',  // Must use secure password hashing
        'z.object|zod|Zod',  // Must use Zod for validation
        'process.env',  // Secrets must come from env
    ],
    'security-agent': [
        'helmet|secureHeaders',  // Must include security headers
        '@fastify/rate-limit|express-rate-limit',  // Must have rate limiting
        'z.object|zod',  // Must validate input
    ],
    'monitoring-agent': [
        'pino|logger',  // Must use proper logging
        'healthCheck|health',  // Must include health checks
    ],
    'database-agent': [
        'prisma|drizzle|@prisma/client',  // Must use proper ORM
    ],
    'api-agent': [
        'FastifyInstance|FastifyRequest|FastifyReply',  // Must use Fastify types
        'z.object|schema',  // Must validate requests
    ],
    'codegen-agent': [],
    'queue-agent': [
        'bullmq|Queue|Worker',  // Must use BullMQ
    ],
    'test-agent': [
        'vitest|describe|it|expect',  // Must use Vitest
    ],
};

// ============================================
// MAIN SERVICE
// ============================================

/**
 * Get constraints for a specific agent
 */
export function getAgentConstraints(
    agentType: AgentType,
    projectDescription?: string
): AgentConstraints {
    // Detect stack type from description or use default (api)
    const stackType = projectDescription
        ? detectStackType(projectDescription)
        : 'api';

    const preset = getStackPreset(stackType);
    const constraintPrompt = generateConstraintPrompt(stackType);
    const agentPrompt = AGENT_SPECIFIC_PROMPTS[agentType] || '';

    return {
        stackType,
        preset,
        systemPromptAddition: constraintPrompt,
        agentSpecificPrompt: agentPrompt,
        forbiddenPatterns: AGENT_FORBIDDEN_PATTERNS[agentType] || [],
        requiredPatterns: AGENT_REQUIRED_PATTERNS[agentType] || [],
    };
}

/**
 * Build a complete system prompt for an agent with all constraints
 */
export function buildAgentSystemPrompt(
    agentType: AgentType,
    basePrompt: string,
    projectDescription?: string
): string {
    const constraints = getAgentConstraints(agentType, projectDescription);

    let fullPrompt = basePrompt + '\n\n';
    fullPrompt += constraints.systemPromptAddition + '\n';
    fullPrompt += constraints.agentSpecificPrompt + '\n';

    if (constraints.forbiddenPatterns.length > 0) {
        fullPrompt += '\n## ⛔ FORBIDDEN PATTERNS (Never use these):\n';
        constraints.forbiddenPatterns.forEach(p => {
            fullPrompt += `- ${p}\n`;
        });
    }

    if (constraints.requiredPatterns.length > 0) {
        fullPrompt += '\n## ✅ REQUIRED PATTERNS (Must include):\n';
        constraints.requiredPatterns.forEach(p => {
            fullPrompt += `- ${p}\n`;
        });
    }

    return fullPrompt;
}

/**
 * Validate generated code against agent constraints
 */
export function validateAgentOutput(
    agentType: AgentType,
    code: string,
    projectDescription?: string
): { valid: boolean; violations: string[]; missing: string[] } {
    const constraints = getAgentConstraints(agentType, projectDescription);
    const violations: string[] = [];
    const missing: string[] = [];

    // Check for forbidden patterns
    for (const pattern of constraints.forbiddenPatterns) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(code)) {
            violations.push(`Forbidden pattern detected: ${pattern}`);
        }
    }

    // Check for required patterns
    for (const pattern of constraints.requiredPatterns) {
        const regex = new RegExp(pattern, 'i');
        // Only require if the code is substantial (>100 chars)
        if (code.length > 100 && !regex.test(code)) {
            // Don't require for very short code snippets
            if (code.length > 500) {
                missing.push(`Required pattern missing: ${pattern}`);
            }
        }
    }

    return {
        valid: violations.length === 0,
        violations,
        missing,
    };
}

/**
 * Get framework-specific boilerplate for an agent
 */
export function getAgentBoilerplate(
    agentType: AgentType,
    projectDescription?: string
): { imports: string; setup: string; patterns: string } {
    const constraints = getAgentConstraints(agentType, projectDescription);
    const framework = constraints.preset.backend.framework;

    // Framework-specific imports
    const frameworkImports: Record<string, string> = {
        fastify: `import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';`,
        express: `import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';`,
        nestjs: `import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { z } from 'zod';`,
        hono: `import { Hono } from 'hono';
import { z } from 'zod';`,
    };

    // Agent-specific imports
    const agentImports: Record<AgentType, string> = {
        'auth-agent': `import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';`,
        'security-agent': `import helmet from 'helmet';`,
        'monitoring-agent': `import pino from 'pino';`,
        'database-agent': `import { PrismaClient } from '@prisma/client';`,
        'api-agent': '',
        'codegen-agent': '',
        'queue-agent': `import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';`,
        'test-agent': `import { describe, it, expect, beforeAll, afterAll } from 'vitest';`,
    };

    const imports = [
        frameworkImports[framework] || frameworkImports.fastify,
        agentImports[agentType] || '',
    ].filter(Boolean).join('\n');

    // Framework-specific setup
    const setup = framework === 'fastify'
        ? `const app = Fastify({ logger: true });`
        : framework === 'express'
            ? `const app = express();`
            : framework === 'hono'
                ? `const app = new Hono();`
                : '';

    // Common patterns
    const patterns = `
// Always use environment variables for secrets
const JWT_SECRET = process.env.JWT_SECRET!;

// Always validate input with Zod
const inputSchema = z.object({
    // Define your schema here
});
`;

    return { imports, setup, patterns };
}

/**
 * Get all supported agent types
 */
export function getSupportedAgentTypes(): AgentType[] {
    return [
        'auth-agent',
        'security-agent',
        'monitoring-agent',
        'database-agent',
        'api-agent',
        'codegen-agent',
        'queue-agent',
        'test-agent',
    ];
}

// ============================================
// EXPORTS
// ============================================

export default {
    getAgentConstraints,
    buildAgentSystemPrompt,
    validateAgentOutput,
    getAgentBoilerplate,
    getSupportedAgentTypes,
};
