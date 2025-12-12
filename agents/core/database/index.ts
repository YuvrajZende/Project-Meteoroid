/**
 * ============================================
 * DATABASE AGENT MODULE EXPORTS
 * ============================================
 * 
 * Central export file for the Database Agent.
 * Following the 7-Layer Feature Integration Guide.
 */

// ========================================
// IAgent Implementation (for agent loader)
// ========================================
export {
    DatabaseAgentWrapper,
    databaseAgentIAgent,
    default,
} from './database-agent-iagent.js';

// ========================================
// Core Database Agent
// ========================================
export {
    DatabaseAgent,
    databaseAgent,
} from './database-agent.js';

// ========================================
// Type Definitions
// ========================================
export type {
    // Database Configuration
    DatabaseType,
    ORMType,
    ColumnDataType,
    RelationType,
    DatabaseAgentConfig,
    DatabaseTaskContext,

    // Schema Types
    ColumnDefinition,
    IndexDefinition,
    RelationshipDefinition,
    TableDefinition,
    SchemaDefinition,
    EnumDefinition,

    // Migration Types
    MigrationOperation,
    MigrationDefinition,

    // Query Types
    QueryCondition,
    QueryJoin,
    QueryOrder,
    QueryDefinition,

    // Seed Types
    SeedRecord,
    SeedConfig,

    // Advisor Types
    IndexRecommendation,
    QueryAnalysis,
    ConnectionPoolConfig,

    // RLS Types
    RLSPolicy,

    // Output Types
    DatabaseGeneratedFile,
    DatabaseGenerationResult,
} from './types.js';

// ========================================
// Templates
// ========================================
export {
    // Prisma Templates
    PRISMA_SCHEMA_HEADER,
    PRISMA_MODEL_TEMPLATE,
    PRISMA_ENUM_TEMPLATE,
    PRISMA_FIELD_TEMPLATES,

    // Supabase Templates
    SUPABASE_MIGRATION_HEADER,
    SUPABASE_CREATE_TABLE,
    SUPABASE_RLS_TEMPLATE,
    SUPABASE_INDEX_TEMPLATE,
    SUPABASE_FOREIGN_KEY_TEMPLATE,

    // Seed Templates
    TYPESCRIPT_SEED_TEMPLATE,
    SQL_SEED_TEMPLATE,

    // Service Templates
    QUERY_BUILDER_SERVICE_TEMPLATE,
    DATABASE_SERVICE_TEMPLATE,
    CONNECTION_POOL_TEMPLATE,

    // Template Utilities
    getAvailableTemplates,
    getTemplate,
    DATABASE_TEMPLATE_SETS,
    type DatabaseTemplateType,
} from './templates/index.js';
