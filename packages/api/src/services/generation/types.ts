/**
 * Generation Types
 * Phase 27: Production-Ready Architecture
 * 
 * Defines all types for the unified code generation system
 */

// ============================================
// LANGUAGE & FRAMEWORK TYPES
// ============================================

export type SupportedLanguage = 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'java' | 'csharp';

export type SupportedFramework =
    // TypeScript/JavaScript
    | 'fastify' | 'express' | 'nestjs' | 'nextjs' | 'vite' | 'hono'
    // Python
    | 'fastapi' | 'flask' | 'django'
    // Go
    | 'gin' | 'fiber' | 'echo'
    // Rust
    | 'actix' | 'axum' | 'rocket'
    // Java
    | 'spring' | 'quarkus'
    // C#
    | 'aspnet' | 'minimal-api';

export interface LanguageConfig {
    name: string;
    extensions: string[];
    packageManager: string;
    installCommand: string;
    devCommand: string;
    buildCommand: string;
    defaultFramework: SupportedFramework;
    typeSystem: 'static' | 'dynamic' | 'gradual';
}

// ============================================
// CODE FILE TYPES
// ============================================

export type FileType = 'code' | 'config' | 'test' | 'schema' | 'migration' | 'doc' | 'asset';

export interface GeneratedFile {
    path: string;
    content: string;
    type: FileType;
    language: string;
    description?: string;
    dependencies?: string[];
}

// ============================================
// ENTITY TYPES
// ============================================

export interface EntityDefinition {
    name: string;
    fields: EntityField[];
    relations?: EntityRelation[];
    indices?: string[];
    timestamps?: boolean;
}

export interface EntityField {
    name: string;
    type: string;
    required?: boolean;
    unique?: boolean;
    default?: unknown;
    validation?: string;
}

export interface EntityRelation {
    type: 'one-to-one' | 'one-to-many' | 'many-to-many';
    target: string;
    field?: string;
    cascade?: boolean;
}

// ============================================
// GENERATION REQUEST/RESULT
// ============================================

export interface CodeGenerationRequest {
    projectName: string;
    description: string;
    language: SupportedLanguage;
    framework?: SupportedFramework;
    entities?: EntityDefinition[];
    features?: string[];
    database?: 'prisma' | 'supabase' | 'drizzle' | 'typeorm';
    includeTests?: boolean;
    includeDocker?: boolean;
    includeAuth?: boolean;
    includeCI?: boolean;
    services?: string[];  // Service IDs from ServiceRegistry to integrate
}

export interface CodeGenerationResult {
    success: boolean;
    projectName: string;
    language: SupportedLanguage;
    framework: SupportedFramework;
    files: GeneratedFile[];
    dependencies: string[];
    devDependencies: string[];
    scripts: Record<string, string>;
    envVars: Record<string, string>;
    stats: GenerationStats;
    errors: string[];
    warnings: string[];
}

export interface GenerationStats {
    totalFiles: number;
    codeFiles: number;
    configFiles: number;
    testFiles: number;
    totalLines: number;
    tokensUsed: number;
    cost: number;
    duration: number;
}

// ============================================
// PLUGIN SYSTEM
// ============================================

export interface GeneratorPlugin {
    name: string;
    supportedLanguages?: SupportedLanguage[];
    supportedFrameworks?: SupportedFramework[];
    priority: number;

    canHandle(request: CodeGenerationRequest): boolean;
    generate(request: CodeGenerationRequest, context: PluginContext): Promise<GeneratedFile[]>;
}

export interface PluginContext {
    language: SupportedLanguage;
    framework: SupportedFramework;
    existingFiles: GeneratedFile[];
    entities: EntityDefinition[];
    services: ServiceIntegration[];
}

export interface ServiceIntegration {
    id: string;
    name: string;
    capabilities: string[];
    codeTemplates: Record<string, string>;
}

// ============================================
// TEMPLATE TYPES
// ============================================

export interface CodeTemplate {
    id: string;
    name: string;
    language: SupportedLanguage;
    framework?: SupportedFramework;
    type: FileType;
    template: string;
    variables: string[];
    description?: string;
}

export interface FrameworkTemplate {
    framework: SupportedFramework;
    language: SupportedLanguage;
    entryPoint: CodeTemplate;
    config: CodeTemplate[];
    routes?: CodeTemplate;
    services?: CodeTemplate;
    middleware?: CodeTemplate;
}
