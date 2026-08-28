/**
 * Prompt Templates
 * Phase 24: Context Management System
 * 
 * Standardized prompt builders that ALWAYS include context.
 * These ensure the AI never loses sight of what we're building.
 */

import type { GenerationContext } from '../../../../domain/services/context/generation-context.js';
import type { ExtractedEntity } from '../../../../domain/services/analysis/entity-extractor.js';

// ============================================
// PROMPT TEMPLATE BUILDERS
// ============================================

/**
 * Build a subtask prompt with full context
 * This is the main template for code generation subtasks
 */
export function buildSubtaskPrompt(
    subtask: string,
    context: GenerationContext,
    additionalInstructions?: string
): string {
    const entityList = context.entities.map(e => e.name).join(', ') || 'None extracted';
    const featureList = getEnabledFeatures(context);

    return `
╔══════════════════════════════════════════════════════════════════════════════╗
║                          CONTEXT (DO NOT IGNORE)                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ ORIGINAL USER REQUEST:                                                        ║
║ ${wrapText(context.originalPrompt, 76)}
╠══════════════════════════════════════════════════════════════════════════════╣
║ PROJECT DETAILS:                                                              ║
║ • Type: ${context.projectType.toUpperCase()}                                  ║
║ • Language: ${context.language}                                               ║
║ • Framework: ${context.framework}                                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ REQUIRED ENTITIES (Generate code for THESE entities):                         ║
║ ${entityList}
╠══════════════════════════════════════════════════════════════════════════════╣
║ ENABLED FEATURES:                                                             ║
║ ${featureList || 'None specified'}
╠══════════════════════════════════════════════════════════════════════════════╣
║                           CURRENT SUBTASK                                     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ ${wrapText(subtask, 76)}
╠══════════════════════════════════════════════════════════════════════════════╣
║                              RULES                                            ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ 1. ONLY generate code for the entities listed above                          ║
║ 2. Use EXACT entity names: ${entityList}
║ 3. Do NOT add unrelated models or generic CRUD scaffolding                   ║
║ 4. Stay focused on the ORIGINAL USER REQUEST                                  ║
║ 5. All routes should relate to the specified entities                        ║
╚══════════════════════════════════════════════════════════════════════════════╝
${additionalInstructions ? `\nADDITIONAL INSTRUCTIONS:\n${additionalInstructions}\n` : ''}
Generate the code for this subtask:`;
}

/**
 * Build a Prisma schema generation prompt
 */
export function buildSchemaPrompt(context: GenerationContext): string {
    const entitiesDesc = context.entities.map(e => formatEntityForPrompt(e)).join('\n\n');

    return `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    PRISMA SCHEMA GENERATION                                   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ ORIGINAL REQUEST: ${wrapText(context.originalPrompt, 58)}
╠══════════════════════════════════════════════════════════════════════════════╣
║ DATABASE: PostgreSQL                                                          ║
╚══════════════════════════════════════════════════════════════════════════════╝

Generate a Prisma schema with EXACTLY these models:

${entitiesDesc}

RULES:
1. Include ALL entities listed above - no more, no less
2. Use proper Prisma types (String, Int, DateTime, Boolean, etc.)
3. Add appropriate relations between models
4. Include @id, @default, @createdAt, @updatedAt where appropriate
5. Use @relation for foreign key relationships

Return ONLY the schema.prisma content, no explanation.`;
}

/**
 * Build a route generation prompt for a specific entity
 */
export function buildRoutePrompt(entity: ExtractedEntity, context: GenerationContext): string {
    const propsDesc = entity.properties
        .map(p => `  - ${p.name}: ${p.type}${p.required ? ' (required)' : ''}`)
        .join('\n');

    return `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    ROUTE GENERATION: ${entity.name.toUpperCase().padEnd(40)}║
╠══════════════════════════════════════════════════════════════════════════════╣
║ PROJECT CONTEXT: ${wrapText(context.originalPrompt.substring(0, 55), 58)}...
╠══════════════════════════════════════════════════════════════════════════════╣
║ FRAMEWORK: ${context.framework}                                               ║
╚══════════════════════════════════════════════════════════════════════════════╝

Generate a complete ${context.framework} route file for the ${entity.name} entity.

ENTITY: ${entity.name}
DESCRIPTION: ${entity.description}
PROPERTIES:
${propsDesc}

REQUIREMENTS:
1. Create CRUD endpoints: GET all, GET by id, POST, PUT, DELETE
2. Use Zod for request/response validation
3. Import from '../services/${entity.name.toLowerCase()}-service'
4. Add proper error handling with try/catch
5. Return appropriate HTTP status codes
6. Add TypeScript types for all parameters

Return ONLY the TypeScript code for routes/${entity.name.toLowerCase()}.ts`;
}

/**
 * Build a service generation prompt for a specific entity
 */
export function buildServicePrompt(entity: ExtractedEntity, context: GenerationContext): string {
    return `
╔══════════════════════════════════════════════════════════════════════════════╗
║                   SERVICE GENERATION: ${entity.name.toUpperCase().padEnd(38)}║
╠══════════════════════════════════════════════════════════════════════════════╣
║ PROJECT CONTEXT: ${wrapText(context.originalPrompt.substring(0, 55), 58)}...
╚══════════════════════════════════════════════════════════════════════════════╝

Generate a complete service class for the ${entity.name} entity.

ENTITY: ${entity.name}
DESCRIPTION: ${entity.description}

REQUIREMENTS:
1. Create a ${entity.name}Service class
2. Use Prisma client for database operations
3. Implement: findAll, findById, create, update, delete methods
4. Add proper TypeScript types
5. Include error handling
6. Export a singleton getter function

Return ONLY the TypeScript code for services/${entity.name.toLowerCase()}-service.ts`;
}

/**
 * Build a validation prompt to check generated code
 */
export function buildValidationPrompt(
    generatedCode: string,
    context: GenerationContext
): string {
    const expectedEntities = context.entities.map(e => e.name);

    return `
╔══════════════════════════════════════════════════════════════════════════════╗
║                      CODE VALIDATION CHECK                                    ║
╚══════════════════════════════════════════════════════════════════════════════╝

ORIGINAL REQUEST: ${context.originalPrompt}

EXPECTED ENTITIES: ${expectedEntities.join(', ')}

GENERATED CODE:
\`\`\`
${generatedCode.substring(0, 3000)}${generatedCode.length > 3000 ? '\n... (truncated)' : ''}
\`\`\`

VALIDATION CHECKLIST:
1. Does the code implement the expected entities? (${expectedEntities.join(', ')})
2. Are there any UNRELATED entities or generic CRUD scaffolding?
3. Does the code match the original request?
4. Are all imports valid?

Return a JSON response:
{
  "valid": boolean,
  "issues": ["list of issues if any"],
  "missingEntities": ["entities that should exist but don't"],
  "unexpectedEntities": ["entities that exist but shouldn't"]
}`;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format an entity for inclusion in prompts
 */
function formatEntityForPrompt(entity: ExtractedEntity): string {
    const props = entity.properties
        .map(p => `  ${p.name}: ${p.type}${p.required ? '' : '?'} // ${p.description || ''}`)
        .join('\n');

    const rels = entity.relationships.length > 0
        ? `\n  // Relations:\n${entity.relationships.map(r =>
            `  ${r.fieldName}: ${r.targetEntity}${r.type === 'one-to-many' ? '[]' : ''}`
        ).join('\n')}`
        : '';

    return `${entity.name} {
${props}${rels}
}`;
}

/**
 * Get enabled features as a string list
 */
function getEnabledFeatures(context: GenerationContext): string {
    const features: string[] = [];

    if (context.features.authentication) features.push('Authentication');
    if (context.features.realTime) features.push('Real-time/WebSocket');
    if (context.features.fileUpload) features.push('File Upload');
    if (context.features.payments) features.push('Payments');
    if (context.features.notifications) features.push('Notifications');
    if (context.features.search) features.push('Search');
    if (context.features.analytics) features.push('Analytics');
    if (context.features.rateLimit) features.push('Rate Limiting');

    if (context.features.custom && context.features.custom.length > 0) {
        features.push(...context.features.custom);
    }

    return features.join(', ');
}

/**
 * Wrap text to fit within a certain width
 */
function wrapText(text: string, maxWidth: number): string {
    if (text.length <= maxWidth) return text;

    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
        if ((currentLine + ' ' + word).trim().length <= maxWidth) {
            currentLine = (currentLine + ' ' + word).trim();
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        }
    }
    if (currentLine) lines.push(currentLine);

    return lines.join('\n║ ');
}

// ============================================
// CONTEXT REMINDER (Short version)
// ============================================

/**
 * Get a short context reminder for injection into prompts
 */
export function getContextReminder(context: GenerationContext): string {
    const entities = context.entities.map(e => e.name).join(', ');

    return `
[CONTEXT REMINDER]
Original Request: "${context.originalPrompt.substring(0, 100)}..."
Required Entities: ${entities || 'None'}
Project Type: ${context.projectType} | Language: ${context.language} | Framework: ${context.framework}
⚠️ STAY FOCUSED on the entities above. Do NOT generate unrelated code.
`;
}

/**
 * Get entity constraint text for prompts
 */
export function getEntityConstraints(context: GenerationContext): string {
    if (context.entities.length === 0) {
        return '';
    }

    const entityNames = context.entities.map(e => e.name);

    return `
═══════════════════════════════════════════════════════════════════
ENTITY CONSTRAINTS (STRICTLY ENFORCE)
═══════════════════════════════════════════════════════════════════
✅ ALLOWED ENTITIES: ${entityNames.join(', ')}
❌ DO NOT CREATE: Generic models, DatabaseDesign, SchemaImplementation, etc.
❌ DO NOT CREATE: Unrelated CRUD scaffolding

If your generated code contains models/routes NOT in the allowed list,
you have FAILED the task. Stay focused on: ${entityNames.join(', ')}
═══════════════════════════════════════════════════════════════════
`;
}
