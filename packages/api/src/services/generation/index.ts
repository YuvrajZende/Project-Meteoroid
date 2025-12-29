/**
 * Generation Services
 * 
 * Code generation services for the orchestration pipeline.
 * Uses EnhancedCodeGenerator as the main generator.
 */

// ============================================
// MAIN CODE GENERATOR - EnhancedCodeGenerator
// ============================================

export {
    EnhancedCodeGenerator,
    getEnhancedCodeGenerator,
    type EnhancedCodeGenRequest,
    type EnhancedCodeGenResult,
    type GeneratedFile,
    type EnhancedFeature,
    type SupportedLanguage,
    type SupportedFramework,
} from './enhanced-code-generator.js';

// ============================================
// TYPES
// ============================================

export * from './types.js';

// ============================================
// SPECIALIZED GENERATORS
// ============================================

export { DatabaseCodeGenerator, getDatabaseCodeGenerator } from './database-generator.js';
export { RouteGenerator, getRouteGenerator } from './route-generator.js';

// ============================================
// TEMPLATES
// ============================================

export { buildSubtaskPrompt, buildSchemaPrompt, buildRoutePrompt, buildServicePrompt } from './templates/prompt-templates.js';
export { FASTIFY_TEMPLATES, EXPRESS_TEMPLATES } from './templates/framework-templates.js';
export { type AgentTemplate, type TemplateContext, type TemplateResult } from './templates/agent-templates.js';
