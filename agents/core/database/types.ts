/**
 * ============================================
 * DATABASE AGENT - TYPE DEFINITIONS
 * ============================================
 * Type definitions for the Database Agent
 */

// ============================================
// DATABASE CONFIGURATION TYPES
// ============================================

/**
 * Supported database types
 */
export type DatabaseType = 'postgresql' | 'mysql' | 'sqlite' | 'mongodb';

/**
 * Supported ORM types
 */
export type ORMType = 'prisma' | 'drizzle' | 'typeorm' | 'raw';

/**
 * Column data types
 */
export type ColumnDataType =
    | 'string'
    | 'text'
    | 'int'
    | 'bigint'
    | 'float'
    | 'decimal'
    | 'boolean'
    | 'datetime'
    | 'date'
    | 'time'
    | 'json'
    | 'uuid'
    | 'enum';

/**
 * Relationship types
 */
export type RelationType = 'one-to-one' | 'one-to-many' | 'many-to-many';

/**
 * Column definition
 */
export interface ColumnDefinition {
    name: string;
    type: ColumnDataType;
    nullable?: boolean;
    unique?: boolean;
    primaryKey?: boolean;
    defaultValue?: string | number | boolean | null;
    enumValues?: string[];
    length?: number;
    precision?: number;
    scale?: number;
    autoIncrement?: boolean;
    references?: {
        table: string;
        column: string;
        onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
        onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
    };
}

/**
 * Index definition
 */
export interface IndexDefinition {
    name: string;
    columns: string[];
    unique?: boolean;
    type?: 'btree' | 'hash' | 'gin' | 'gist';
    where?: string; // Partial index condition
}

/**
 * Table relationship definition
 */
export interface RelationshipDefinition {
    name: string;
    type: RelationType;
    fromTable: string;
    fromColumn: string;
    toTable: string;
    toColumn: string;
    through?: string; // Junction table for many-to-many
}

/**
 * Table definition
 */
export interface TableDefinition {
    name: string;
    columns: ColumnDefinition[];
    indexes?: IndexDefinition[];
    timestamps?: boolean;
    softDelete?: boolean;
    comment?: string;
}

/**
 * Schema definition
 */
export interface SchemaDefinition {
    tables: TableDefinition[];
    relationships?: RelationshipDefinition[];
    enums?: EnumDefinition[];
}

/**
 * Enum definition
 */
export interface EnumDefinition {
    name: string;
    values: string[];
}

// ============================================
// DATABASE AGENT CONFIGURATION
// ============================================

/**
 * Database agent config
 */
export interface DatabaseAgentConfig {
    databaseType: DatabaseType;
    ormType: ORMType;
    schema?: string; // Database schema name
    ssl?: boolean;
    poolSize?: number;
    enableRLS?: boolean; // Row Level Security (PostgreSQL)
    enableAudit?: boolean;
}

// ============================================
// MIGRATION TYPES
// ============================================

/**
 * Migration operation
 */
export interface MigrationOperation {
    type: 'create_table' | 'alter_table' | 'drop_table' | 'create_index' | 'drop_index' | 'add_column' | 'drop_column' | 'modify_column';
    table?: string;
    column?: string;
    definition?: Partial<ColumnDefinition | TableDefinition | IndexDefinition>;
    sql?: string;
}

/**
 * Migration definition
 */
export interface MigrationDefinition {
    version: string;
    name: string;
    description?: string;
    up: MigrationOperation[];
    down: MigrationOperation[];
}

// ============================================
// QUERY TYPES
// ============================================

/**
 * Query condition
 */
export interface QueryCondition {
    column: string;
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'ILIKE' | 'IN' | 'NOT IN' | 'IS NULL' | 'IS NOT NULL' | 'BETWEEN';
    value: unknown;
    value2?: unknown; // For BETWEEN
}

/**
 * Query join
 */
export interface QueryJoin {
    type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
    table: string;
    alias?: string;
    on: {
        leftColumn: string;
        rightColumn: string;
    };
}

/**
 * Query order
 */
export interface QueryOrder {
    column: string;
    direction: 'ASC' | 'DESC';
    nulls?: 'FIRST' | 'LAST';
}

/**
 * Query definition
 */
export interface QueryDefinition {
    type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
    table: string;
    alias?: string;
    columns?: string[];
    conditions?: QueryCondition[];
    joins?: QueryJoin[];
    orderBy?: QueryOrder[];
    groupBy?: string[];
    having?: string;
    limit?: number;
    offset?: number;
    values?: Record<string, unknown>; // For INSERT/UPDATE
}

// ============================================
// SEED DATA TYPES
// ============================================

/**
 * Seed record
 */
export interface SeedRecord {
    [key: string]: unknown;
}

/**
 * Seed configuration
 */
export interface SeedConfig {
    table: string;
    records: SeedRecord[];
    truncateFirst?: boolean;
    onConflict?: 'skip' | 'update' | 'error';
}

// ============================================
// INDEX ADVISOR TYPES
// ============================================

/**
 * Index recommendation
 */
export interface IndexRecommendation {
    table: string;
    columns: string[];
    type: 'btree' | 'hash' | 'gin' | 'gist';
    reason: string;
    priority: 'high' | 'medium' | 'low';
    estimatedImpact?: string;
}

/**
 * Query analysis result
 */
export interface QueryAnalysis {
    query: string;
    estimatedCost?: number;
    indexesUsed: string[];
    suggestions: IndexRecommendation[];
    warnings: string[];
}

// ============================================
// CONNECTION POOL TYPES
// ============================================

/**
 * Connection pool configuration
 */
export interface ConnectionPoolConfig {
    min: number;
    max: number;
    idleTimeoutMs: number;
    connectionTimeoutMs: number;
    maxUses?: number;
    healthCheckIntervalMs?: number;
}

// ============================================
// ROW LEVEL SECURITY TYPES
// ============================================

/**
 * RLS policy definition
 */
export interface RLSPolicy {
    name: string;
    table: string;
    operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';
    using?: string; // Expression for SELECT/UPDATE/DELETE
    withCheck?: string; // Expression for INSERT/UPDATE
    roles?: string[];
}

// ============================================
// GENERATION RESULT TYPES
// ============================================

/**
 * Generated file
 */
export interface DatabaseGeneratedFile {
    path: string;
    content: string;
    description: string;
    type: 'schema' | 'migration' | 'seed' | 'query' | 'config' | 'types';
}

/**
 * Database generation result
 */
export interface DatabaseGenerationResult {
    files: DatabaseGeneratedFile[];
    dependencies: string[];
    envVariables: string[];
    instructions: string[];
    warnings?: string[];
}

// ============================================
// TASK CONTEXT TYPES
// ============================================

/**
 * Database task context for enhanced analysis
 */
export interface DatabaseTaskContext {
    existingSchema?: SchemaDefinition;
    targetDatabase?: DatabaseType;
    targetORM?: ORMType;
    projectType?: 'api' | 'fullstack' | 'microservice';
    features?: string[];
}
