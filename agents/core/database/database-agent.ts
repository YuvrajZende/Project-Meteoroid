/**
 * ============================================
 * DATABASE AGENT - CORE IMPLEMENTATION
 * ============================================
 * 
 * The Database Agent is responsible for generating database schemas,
 * migrations, seeds, and optimized queries. It supports Prisma ORM,
 * Supabase/PostgreSQL, and provides advanced features like:
 * 
 * - Schema generation from natural language
 * - Migration file generation
 * - Seed data creation
 * - Query optimization and index suggestions
 * - Row Level Security (RLS) policy generation
 * - Connection pool configuration
 * 
 * This agent integrates with Person 1's infrastructure including:
 * - Multi-Model Pipeline for AI analysis
 * - Benchmarking Service for performance tracking
 * - Cost Tracker for API call monitoring
 */

import {
    TableDefinition,
    ColumnDefinition,
    SchemaDefinition,
    RelationshipDefinition,
    MigrationDefinition,
    QueryDefinition,
    SeedConfig,
    IndexDefinition,
    IndexRecommendation,
    RLSPolicy,
    DatabaseGeneratedFile,
    DatabaseGenerationResult,
    DatabaseAgentConfig,
    DatabaseTaskContext,
    ColumnDataType,
    EnumDefinition,
} from './types.js';

import {
    PRISMA_SCHEMA_HEADER,
    PRISMA_MODEL_TEMPLATE,
    PRISMA_ENUM_TEMPLATE,
    PRISMA_FIELD_TEMPLATES,
    SUPABASE_MIGRATION_HEADER,
    SUPABASE_CREATE_TABLE,
    SUPABASE_RLS_TEMPLATE,
    SUPABASE_INDEX_TEMPLATE,
    TYPESCRIPT_SEED_TEMPLATE,
    SQL_SEED_TEMPLATE,
    QUERY_BUILDER_SERVICE_TEMPLATE,
    DATABASE_SERVICE_TEMPLATE,
    CONNECTION_POOL_TEMPLATE,
    getAvailableTemplates,
    DATABASE_TEMPLATE_SETS,
} from './templates/index.js';

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert string to PascalCase
 */
function toPascalCase(str: string): string {
    return str
        .replace(/[-_](.)/g, (_, char) => char.toUpperCase())
        .replace(/^(.)/, (_, char) => char.toUpperCase());
}

/**
 * Convert string to camelCase
 */
function toCamelCase(str: string): string {
    const pascal = toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Convert string to snake_case
 */
function toSnakeCase(str: string): string {
    return str
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '')
        .replace(/-/g, '_');
}

/**
 * Map column types to Prisma types
 */
function mapToPrismaType(type: ColumnDataType): string {
    const typeMap: Record<ColumnDataType, string> = {
        string: 'String',
        text: 'String',
        int: 'Int',
        bigint: 'BigInt',
        float: 'Float',
        decimal: 'Decimal',
        boolean: 'Boolean',
        datetime: 'DateTime',
        date: 'DateTime',
        time: 'DateTime',
        json: 'Json',
        uuid: 'String',
        enum: 'String', // Will be replaced with actual enum
    };
    return typeMap[type] || 'String';
}

/**
 * Map column types to PostgreSQL types
 */
function mapToPostgresType(type: ColumnDataType, column: ColumnDefinition): string {
    const typeMap: Record<ColumnDataType, string> = {
        string: column.length ? `VARCHAR(${column.length})` : 'TEXT',
        text: 'TEXT',
        int: 'INTEGER',
        bigint: 'BIGINT',
        float: 'REAL',
        decimal: `NUMERIC(${column.precision || 10}, ${column.scale || 2})`,
        boolean: 'BOOLEAN',
        datetime: 'TIMESTAMPTZ',
        date: 'DATE',
        time: 'TIME',
        json: 'JSONB',
        uuid: 'UUID',
        enum: 'TEXT', // Enums handled separately
    };
    return typeMap[type] || 'TEXT';
}

// ============================================
// DATABASE AGENT CLASS
// ============================================

export class DatabaseAgent {
    private config: DatabaseAgentConfig;
    private aiClient: any = null; // Will be injected
    private metricsService: any = null; // Will be injected
    private cacheService: any = null; // Will be injected

    constructor(config?: Partial<DatabaseAgentConfig>) {
        this.config = {
            databaseType: config?.databaseType || 'postgresql',
            ormType: config?.ormType || 'prisma',
            enableRLS: config?.enableRLS ?? true,
            enableAudit: config?.enableAudit ?? false,
            ssl: config?.ssl ?? true,
            poolSize: config?.poolSize || 10,
            ...config,
        };
    }

    // ========================================
    // SERVICE INJECTION (For Person 1's infra)
    // ========================================

    /**
     * Inject AI client from Person 1's services
     */
    setAIClient(client: any): void {
        this.aiClient = client;
    }

    /**
     * Inject metrics service for benchmarking
     */
    setMetricsService(service: any): void {
        this.metricsService = service;
    }

    /**
     * Inject cache service for query caching
     */
    setCacheService(service: any): void {
        this.cacheService = service;
    }

    // ========================================
    // SCHEMA GENERATION
    // ========================================

    /**
     * Analyze natural language requirements and generate schema
     */
    async analyzeRequirements(userRequest: string): Promise<SchemaDefinition> {
        console.log('[DATABASE-AGENT] Analyzing requirements...');

        // Parse common patterns from the request
        const tables = this.extractTablesFromRequest(userRequest);
        const relationships = this.inferRelationships(tables);
        const enums = this.extractEnumsFromRequest(userRequest);

        return {
            tables,
            relationships,
            enums,
        };
    }

    /**
     * Extract table definitions from natural language
     */
    private extractTablesFromRequest(request: string): TableDefinition[] {
        const tables: TableDefinition[] = [];
        const lowerRequest = request.toLowerCase();

        // Common entity patterns
        const entityPatterns = [
            { pattern: /user/i, name: 'users', columns: this.getDefaultUserColumns() },
            { pattern: /product/i, name: 'products', columns: this.getDefaultProductColumns() },
            { pattern: /order/i, name: 'orders', columns: this.getDefaultOrderColumns() },
            { pattern: /post/i, name: 'posts', columns: this.getDefaultPostColumns() },
            { pattern: /comment/i, name: 'comments', columns: this.getDefaultCommentColumns() },
            { pattern: /category/i, name: 'categories', columns: this.getDefaultCategoryColumns() },
            { pattern: /tag/i, name: 'tags', columns: this.getDefaultTagColumns() },
            { pattern: /project/i, name: 'projects', columns: this.getDefaultProjectColumns() },
            { pattern: /task/i, name: 'tasks', columns: this.getDefaultTaskColumns() },
            { pattern: /team/i, name: 'teams', columns: this.getDefaultTeamColumns() },
        ];

        for (const entityPattern of entityPatterns) {
            if (entityPattern.pattern.test(lowerRequest)) {
                tables.push({
                    name: entityPattern.name,
                    columns: entityPattern.columns,
                    timestamps: true,
                    softDelete: true,
                });
            }
        }

        // If no entities found, create a generic table
        if (tables.length === 0) {
            tables.push({
                name: 'items',
                columns: this.getDefaultGenericColumns(),
                timestamps: true,
            });
        }

        return tables;
    }

    /**
     * Infer relationships between tables
     */
    private inferRelationships(tables: TableDefinition[]): RelationshipDefinition[] {
        const relationships: RelationshipDefinition[] = [];
        const tableNames = tables.map(t => t.name);

        // Common relationship patterns
        const relationPatterns: Array<{
            from: string;
            to: string;
            type: 'one-to-many' | 'many-to-many';
        }> = [
                { from: 'users', to: 'posts', type: 'one-to-many' },
                { from: 'users', to: 'orders', type: 'one-to-many' },
                { from: 'users', to: 'comments', type: 'one-to-many' },
                { from: 'posts', to: 'comments', type: 'one-to-many' },
                { from: 'categories', to: 'products', type: 'one-to-many' },
                { from: 'orders', to: 'products', type: 'many-to-many' },
                { from: 'posts', to: 'tags', type: 'many-to-many' },
                { from: 'users', to: 'projects', type: 'one-to-many' },
                { from: 'projects', to: 'tasks', type: 'one-to-many' },
                { from: 'teams', to: 'users', type: 'many-to-many' },
            ];

        for (const pattern of relationPatterns) {
            if (tableNames.includes(pattern.from) && tableNames.includes(pattern.to)) {
                relationships.push({
                    name: `${pattern.from}_${pattern.to}`,
                    type: pattern.type,
                    fromTable: pattern.from,
                    fromColumn: 'id',
                    toTable: pattern.to,
                    toColumn: pattern.type === 'one-to-many'
                        ? `${pattern.from.slice(0, -1)}_id`
                        : 'id',
                    through: pattern.type === 'many-to-many'
                        ? `${pattern.from}_${pattern.to}`
                        : undefined,
                });
            }
        }

        return relationships;
    }

    /**
     * Extract enum definitions from request
     */
    private extractEnumsFromRequest(request: string): EnumDefinition[] {
        const enums: EnumDefinition[] = [];
        const lowerRequest = request.toLowerCase();

        // Status enum
        if (/status/i.test(request)) {
            enums.push({
                name: 'Status',
                values: ['ACTIVE', 'INACTIVE', 'PENDING', 'ARCHIVED'],
            });
        }

        // Role enum
        if (/role/i.test(request) || /user/i.test(request)) {
            enums.push({
                name: 'Role',
                values: ['ADMIN', 'USER', 'MODERATOR', 'GUEST'],
            });
        }

        // Order status
        if (/order/i.test(request)) {
            enums.push({
                name: 'OrderStatus',
                values: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
            });
        }

        // Priority enum
        if (/priority/i.test(request) || /task/i.test(request)) {
            enums.push({
                name: 'Priority',
                values: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
            });
        }

        return enums;
    }

    // ========================================
    // DEFAULT COLUMN TEMPLATES
    // ========================================

    private getDefaultUserColumns(): ColumnDefinition[] {
        return [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'email', type: 'string', unique: true, length: 255 },
            { name: 'password_hash', type: 'string', length: 255 },
            { name: 'name', type: 'string', length: 100, nullable: true },
            { name: 'avatar_url', type: 'text', nullable: true },
            { name: 'role', type: 'enum', enumValues: ['ADMIN', 'USER', 'MODERATOR'], defaultValue: 'USER' },
            { name: 'email_verified', type: 'boolean', defaultValue: false },
            { name: 'last_login_at', type: 'datetime', nullable: true },
            { name: 'metadata', type: 'json', nullable: true },
        ];
    }

    private getDefaultProductColumns(): ColumnDefinition[] {
        return [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'name', type: 'string', length: 255 },
            { name: 'description', type: 'text', nullable: true },
            { name: 'price', type: 'decimal', precision: 10, scale: 2 },
            { name: 'sku', type: 'string', unique: true, length: 50 },
            { name: 'stock_quantity', type: 'int', defaultValue: 0 },
            { name: 'category_id', type: 'uuid', nullable: true, references: { table: 'categories', column: 'id', onDelete: 'SET NULL' } },
            { name: 'images', type: 'json', nullable: true },
            { name: 'is_active', type: 'boolean', defaultValue: true },
        ];
    }

    private getDefaultOrderColumns(): ColumnDefinition[] {
        return [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'user_id', type: 'uuid', references: { table: 'users', column: 'id', onDelete: 'CASCADE' } },
            { name: 'status', type: 'enum', enumValues: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'], defaultValue: 'PENDING' },
            { name: 'total_amount', type: 'decimal', precision: 10, scale: 2 },
            { name: 'shipping_address', type: 'json' },
            { name: 'payment_method', type: 'string', length: 50 },
            { name: 'notes', type: 'text', nullable: true },
        ];
    }

    private getDefaultPostColumns(): ColumnDefinition[] {
        return [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'user_id', type: 'uuid', references: { table: 'users', column: 'id', onDelete: 'CASCADE' } },
            { name: 'title', type: 'string', length: 255 },
            { name: 'slug', type: 'string', unique: true, length: 255 },
            { name: 'content', type: 'text' },
            { name: 'excerpt', type: 'text', nullable: true },
            { name: 'published', type: 'boolean', defaultValue: false },
            { name: 'published_at', type: 'datetime', nullable: true },
            { name: 'featured_image', type: 'text', nullable: true },
            { name: 'view_count', type: 'int', defaultValue: 0 },
        ];
    }

    private getDefaultCommentColumns(): ColumnDefinition[] {
        return [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'user_id', type: 'uuid', references: { table: 'users', column: 'id', onDelete: 'CASCADE' } },
            { name: 'post_id', type: 'uuid', references: { table: 'posts', column: 'id', onDelete: 'CASCADE' } },
            { name: 'parent_id', type: 'uuid', nullable: true, references: { table: 'comments', column: 'id', onDelete: 'CASCADE' } },
            { name: 'content', type: 'text' },
            { name: 'is_approved', type: 'boolean', defaultValue: true },
        ];
    }

    private getDefaultCategoryColumns(): ColumnDefinition[] {
        return [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'name', type: 'string', length: 100 },
            { name: 'slug', type: 'string', unique: true, length: 100 },
            { name: 'description', type: 'text', nullable: true },
            { name: 'parent_id', type: 'uuid', nullable: true, references: { table: 'categories', column: 'id', onDelete: 'SET NULL' } },
            { name: 'sort_order', type: 'int', defaultValue: 0 },
        ];
    }

    private getDefaultTagColumns(): ColumnDefinition[] {
        return [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'name', type: 'string', length: 50 },
            { name: 'slug', type: 'string', unique: true, length: 50 },
            { name: 'color', type: 'string', length: 7, nullable: true },
        ];
    }

    private getDefaultProjectColumns(): ColumnDefinition[] {
        return [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'user_id', type: 'uuid', references: { table: 'users', column: 'id', onDelete: 'CASCADE' } },
            { name: 'name', type: 'string', length: 255 },
            { name: 'description', type: 'text', nullable: true },
            { name: 'status', type: 'enum', enumValues: ['ACTIVE', 'COMPLETED', 'ARCHIVED'], defaultValue: 'ACTIVE' },
            { name: 'start_date', type: 'date', nullable: true },
            { name: 'end_date', type: 'date', nullable: true },
            { name: 'settings', type: 'json', nullable: true },
        ];
    }

    private getDefaultTaskColumns(): ColumnDefinition[] {
        return [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'project_id', type: 'uuid', references: { table: 'projects', column: 'id', onDelete: 'CASCADE' } },
            { name: 'assignee_id', type: 'uuid', nullable: true, references: { table: 'users', column: 'id', onDelete: 'SET NULL' } },
            { name: 'title', type: 'string', length: 255 },
            { name: 'description', type: 'text', nullable: true },
            { name: 'status', type: 'enum', enumValues: ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'], defaultValue: 'TODO' },
            { name: 'priority', type: 'enum', enumValues: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], defaultValue: 'MEDIUM' },
            { name: 'due_date', type: 'datetime', nullable: true },
            { name: 'completed_at', type: 'datetime', nullable: true },
        ];
    }

    private getDefaultTeamColumns(): ColumnDefinition[] {
        return [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'name', type: 'string', length: 100 },
            { name: 'description', type: 'text', nullable: true },
            { name: 'owner_id', type: 'uuid', references: { table: 'users', column: 'id', onDelete: 'CASCADE' } },
            { name: 'avatar_url', type: 'text', nullable: true },
            { name: 'settings', type: 'json', nullable: true },
        ];
    }

    private getDefaultGenericColumns(): ColumnDefinition[] {
        return [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'name', type: 'string', length: 255 },
            { name: 'description', type: 'text', nullable: true },
            { name: 'metadata', type: 'json', nullable: true },
            { name: 'is_active', type: 'boolean', defaultValue: true },
        ];
    }

    // ========================================
    // PRISMA SCHEMA GENERATION
    // ========================================

    /**
     * Generate Prisma schema from table definitions
     */
    generatePrismaSchema(schema: SchemaDefinition): string {
        let output = PRISMA_SCHEMA_HEADER;

        // Generate enums first
        for (const enumDef of schema.enums || []) {
            output += this.generatePrismaEnum(enumDef);
        }

        // Generate models
        for (const table of schema.tables) {
            output += this.generatePrismaModel(table, schema.relationships || []);
        }

        return output;
    }

    private generatePrismaEnum(enumDef: EnumDefinition): string {
        return PRISMA_ENUM_TEMPLATE
            .replace('{{ENUM_NAME}}', enumDef.name)
            .replace('{{VALUES}}', enumDef.values.join('\n  '));
    }

    private generatePrismaModel(table: TableDefinition, relationships: RelationshipDefinition[]): string {
        const modelName = toPascalCase(table.name.slice(0, -1)); // Remove 's' for singular
        const fields: string[] = [];
        const relations: string[] = [];
        const indexes: string[] = [];

        // Generate fields
        for (const column of table.columns) {
            fields.push(this.generatePrismaField(column));
        }

        // Add timestamps if enabled
        if (table.timestamps) {
            fields.push('  createdAt DateTime @default(now())');
            fields.push('  updatedAt DateTime @updatedAt');
        }

        // Add soft delete if enabled
        if (table.softDelete) {
            fields.push('  deletedAt DateTime?');
        }

        // Generate relations
        const tableRelations = relationships.filter(
            r => r.fromTable === table.name || r.toTable === table.name
        );

        for (const relation of tableRelations) {
            relations.push(this.generatePrismaRelation(relation, table.name));
        }

        // Build model template
        let model = `\nmodel ${modelName} {\n`;
        model += fields.join('\n') + '\n';
        if (relations.length > 0) {
            model += '\n  // Relations\n' + relations.join('\n') + '\n';
        }
        model += '}\n';

        return model;
    }

    private generatePrismaField(column: ColumnDefinition): string {
        let field = `  ${column.name} `;

        // Type
        if (column.type === 'enum' && column.enumValues) {
            field += toPascalCase(column.name);
        } else {
            field += mapToPrismaType(column.type);
        }

        // Nullable
        if (column.nullable) {
            field += '?';
        }

        // Modifiers
        const modifiers: string[] = [];

        if (column.primaryKey) {
            modifiers.push('@id');
            if (column.type === 'uuid') {
                modifiers.push('@default(uuid())');
            }
        }

        if (column.unique) {
            modifiers.push('@unique');
        }

        if (column.defaultValue !== undefined && !column.primaryKey) {
            if (typeof column.defaultValue === 'string') {
                if (column.type === 'enum') {
                    modifiers.push(`@default(${column.defaultValue})`);
                } else {
                    modifiers.push(`@default("${column.defaultValue}")`);
                }
            } else if (typeof column.defaultValue === 'boolean') {
                modifiers.push(`@default(${column.defaultValue})`);
            } else if (typeof column.defaultValue === 'number') {
                modifiers.push(`@default(${column.defaultValue})`);
            }
        }

        if (column.references) {
            // Add @relation for foreign keys - handle in relations section
        }

        // Database-specific
        if (column.type === 'text') {
            modifiers.push('@db.Text');
        } else if (column.type === 'uuid' && !column.primaryKey) {
            modifiers.push('@db.Uuid');
        }

        if (modifiers.length > 0) {
            field += ' ' + modifiers.join(' ');
        }

        return field;
    }

    private generatePrismaRelation(relation: RelationshipDefinition, currentTable: string): string {
        const isFrom = relation.fromTable === currentTable;
        const otherTable = isFrom ? relation.toTable : relation.fromTable;
        const modelName = toPascalCase(otherTable.slice(0, -1));

        if (relation.type === 'one-to-many') {
            if (isFrom) {
                // One side - has many
                return `  ${toCamelCase(otherTable)} ${modelName}[]`;
            } else {
                // Many side - belongs to
                return `  ${toCamelCase(relation.fromTable.slice(0, -1))} ${toPascalCase(relation.fromTable.slice(0, -1))} @relation(fields: [${relation.toColumn}], references: [${relation.fromColumn}])`;
            }
        } else if (relation.type === 'many-to-many') {
            return `  ${toCamelCase(otherTable)} ${modelName}[]`;
        }

        return '';
    }

    // ========================================
    // SUPABASE MIGRATION GENERATION
    // ========================================

    /**
     * Generate Supabase migration SQL
     */
    generateSupabaseMigration(
        schema: SchemaDefinition,
        migrationName: string
    ): DatabaseGeneratedFile[] {
        const files: DatabaseGeneratedFile[] = [];
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

        let migrationSQL = SUPABASE_MIGRATION_HEADER
            .replace('{{MIGRATION_NAME}}', migrationName)
            .replace('{{DESCRIPTION}}', `Creates tables: ${schema.tables.map(t => t.name).join(', ')}`)
            .replace('{{TIMESTAMP}}', new Date().toISOString());

        // Generate enums
        for (const enumDef of schema.enums || []) {
            migrationSQL += this.generatePostgresEnum(enumDef);
        }

        // Generate tables
        for (const table of schema.tables) {
            migrationSQL += this.generatePostgresTable(table);
        }

        // Generate foreign keys (after all tables exist)
        for (const table of schema.tables) {
            for (const column of table.columns) {
                if (column.references) {
                    migrationSQL += this.generatePostgresForeignKey(table.name, column);
                }
            }
        }

        // Generate RLS if enabled
        if (this.config.enableRLS) {
            for (const table of schema.tables) {
                migrationSQL += this.generatePostgresRLS(table.name);
            }
        }

        // Add schema reload notification
        migrationSQL += '\n-- Reload schema cache\nNOTIFY pgrst, \'reload config\';\n';

        files.push({
            path: `migrations/${timestamp}_${toSnakeCase(migrationName)}.sql`,
            content: migrationSQL,
            description: `Supabase migration for ${migrationName}`,
            type: 'migration',
        });

        return files;
    }

    private generatePostgresEnum(enumDef: EnumDefinition): string {
        const values = enumDef.values.map(v => `'${v}'`).join(', ');
        return `
-- Enum: ${enumDef.name}
DO $$ BEGIN
    CREATE TYPE ${toSnakeCase(enumDef.name)}_enum AS ENUM (${values});
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
`;
    }

    private generatePostgresTable(table: TableDefinition): string {
        const columns: string[] = [];
        const indexes: string[] = [];

        for (const column of table.columns) {
            columns.push(this.generatePostgresColumn(column, table));
        }

        // Add timestamps
        if (table.timestamps) {
            columns.push('    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL');
            columns.push('    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL');
        }

        // Add soft delete
        if (table.softDelete) {
            columns.push('    deleted_at TIMESTAMPTZ');
        }

        // Generate indexes
        for (const index of table.indexes || []) {
            indexes.push(this.generatePostgresIndex(table.name, index));
        }

        // Add common indexes
        indexes.push(SUPABASE_INDEX_TEMPLATE
            .replace(/\{\{TABLE_NAME\}\}/g, table.name)
            .replace('{{COLUMN_NAMES}}', 'created_at')
            .replace('{{COLUMNS}}', 'created_at DESC')
            .replace('{{INDEX_OPTIONS}}', ''));

        let sql = `
-- =====================================================
-- TABLE: ${table.name}
-- =====================================================

CREATE TABLE IF NOT EXISTS ${table.name} (
${columns.join(',\n')}
);

-- Indexes
${indexes.join('\n')}

`;

        if (table.comment) {
            sql += `COMMENT ON TABLE ${table.name} IS '${table.comment}';\n`;
        }

        return sql;
    }

    private generatePostgresColumn(column: ColumnDefinition, table: TableDefinition): string {
        let sql = `    ${toSnakeCase(column.name)} `;

        // Type
        sql += mapToPostgresType(column.type, column);

        // Primary key
        if (column.primaryKey) {
            sql += ' PRIMARY KEY';
            if (column.type === 'uuid') {
                sql += ' DEFAULT uuid_generate_v4()';
            } else if (column.autoIncrement) {
                sql = `    ${toSnakeCase(column.name)} SERIAL PRIMARY KEY`;
            }
        }

        // Nullable
        if (!column.nullable && !column.primaryKey) {
            sql += ' NOT NULL';
        }

        // Unique
        if (column.unique && !column.primaryKey) {
            sql += ' UNIQUE';
        }

        // Default
        if (column.defaultValue !== undefined && !column.primaryKey) {
            if (typeof column.defaultValue === 'string') {
                if (column.type === 'enum') {
                    sql += ` DEFAULT '${column.defaultValue}'`;
                } else {
                    sql += ` DEFAULT '${column.defaultValue}'`;
                }
            } else if (typeof column.defaultValue === 'boolean') {
                sql += ` DEFAULT ${column.defaultValue}`;
            } else if (typeof column.defaultValue === 'number') {
                sql += ` DEFAULT ${column.defaultValue}`;
            } else if (column.defaultValue === null) {
                sql += ' DEFAULT NULL';
            }
        }

        return sql;
    }

    private generatePostgresIndex(tableName: string, index: IndexDefinition): string {
        const unique = index.unique ? 'UNIQUE ' : '';
        const columns = index.columns.join(', ');
        const where = index.where ? ` WHERE ${index.where}` : '';

        return `CREATE ${unique}INDEX IF NOT EXISTS idx_${tableName}_${index.columns.join('_')}
    ON ${tableName}(${columns})${where};`;
    }

    private generatePostgresForeignKey(tableName: string, column: ColumnDefinition): string {
        if (!column.references) return '';

        const ref = column.references;
        return `
ALTER TABLE ${tableName}
    ADD CONSTRAINT fk_${tableName}_${column.name}
    FOREIGN KEY (${toSnakeCase(column.name)})
    REFERENCES ${ref.table}(${ref.column})
    ON DELETE ${ref.onDelete || 'NO ACTION'}
    ON UPDATE ${ref.onUpdate || 'NO ACTION'};
`;
    }

    private generatePostgresRLS(tableName: string): string {
        return `
-- =====================================================
-- ROW LEVEL SECURITY FOR ${tableName}
-- =====================================================

ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated read"
    ON ${tableName}
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow users to manage their own records (if user_id column exists)
-- CREATE POLICY "Users manage own records"
--     ON ${tableName}
--     FOR ALL
--     TO authenticated
--     USING (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "Service full access"
    ON ${tableName}
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
`;
    }

    // ========================================
    // SEED DATA GENERATION
    // ========================================

    /**
     * Generate seed data files
     */
    generateSeedFiles(schema: SchemaDefinition): DatabaseGeneratedFile[] {
        const files: DatabaseGeneratedFile[] = [];

        for (const table of schema.tables) {
            // TypeScript seed
            const tsSeed = this.generateTypescriptSeed(table);
            files.push({
                path: `seeds/${table.name}.seed.ts`,
                content: tsSeed,
                description: `TypeScript seed file for ${table.name}`,
                type: 'seed',
            });

            // SQL seed
            const sqlSeed = this.generateSQLSeed(table);
            files.push({
                path: `seeds/${table.name}.seed.sql`,
                content: sqlSeed,
                description: `SQL seed file for ${table.name}`,
                type: 'seed',
            });
        }

        return files;
    }

    private generateTypescriptSeed(table: TableDefinition): string {
        const modelName = toPascalCase(table.name.slice(0, -1));
        const camelName = toCamelCase(table.name);

        // Generate sample data
        const sampleData = this.generateSampleData(table, 5);

        return TYPESCRIPT_SEED_TEMPLATE
            .replace(/\{\{TABLE_NAME\}\}/g, table.name)
            .replace(/\{\{TABLE_NAME_PASCAL\}\}/g, modelName)
            .replace(/\{\{TABLE_NAME_CAMEL\}\}/g, camelName)
            .replace('{{SEED_DATA}}', JSON.stringify(sampleData, null, 4));
    }

    private generateSQLSeed(table: TableDefinition): string {
        const sampleData = this.generateSampleData(table, 5);
        const columns = table.columns.map(c => toSnakeCase(c.name));

        const insertStatements = sampleData.map(record => {
            const values = columns.map(col => {
                const value = record[col];
                if (value === null) return 'NULL';
                if (typeof value === 'string') return `'${value}'`;
                if (typeof value === 'boolean') return value.toString();
                if (typeof value === 'object') return `'${JSON.stringify(value)}'`;
                return value;
            });
            return `INSERT INTO ${table.name} (${columns.join(', ')})
VALUES (${values.join(', ')});`;
        });

        return SQL_SEED_TEMPLATE
            .replace(/\{\{TABLE_NAME\}\}/g, table.name)
            .replace('{{INSERT_STATEMENTS}}', insertStatements.join('\n\n'));
    }

    private generateSampleData(table: TableDefinition, count: number): Record<string, any>[] {
        const data: Record<string, any>[] = [];

        for (let i = 1; i <= count; i++) {
            const record: Record<string, any> = {};

            for (const column of table.columns) {
                record[toSnakeCase(column.name)] = this.generateSampleValue(column, i);
            }

            data.push(record);
        }

        return data;
    }

    private generateSampleValue(column: ColumnDefinition, index: number): any {
        if (column.primaryKey && column.type === 'uuid') {
            return `00000000-0000-0000-0000-00000000000${index}`;
        }

        if (column.defaultValue !== undefined && !column.primaryKey) {
            return column.defaultValue;
        }

        switch (column.type) {
            case 'uuid':
                return `00000000-0000-0000-0000-00000000010${index}`;
            case 'string':
            case 'text':
                if (column.name.includes('email')) return `user${index}@example.com`;
                if (column.name.includes('name')) return `Sample Name ${index}`;
                if (column.name.includes('slug')) return `sample-slug-${index}`;
                if (column.name.includes('url')) return `https://example.com/image${index}.jpg`;
                return `Sample ${column.name} ${index}`;
            case 'int':
            case 'bigint':
                return index * 10;
            case 'float':
            case 'decimal':
                return Number((index * 10.99).toFixed(2));
            case 'boolean':
                return index % 2 === 0;
            case 'datetime':
            case 'date':
                return new Date().toISOString();
            case 'json':
                return { key: `value${index}` };
            case 'enum':
                if (column.enumValues && column.enumValues.length > 0) {
                    return column.enumValues[index % column.enumValues.length];
                }
                return null;
            default:
                return null;
        }
    }

    // ========================================
    // QUERY BUILDER GENERATION
    // ========================================

    /**
     * Generate query builder service
     */
    generateQueryBuilder(table: TableDefinition): DatabaseGeneratedFile {
        const modelName = toPascalCase(table.name.slice(0, -1));
        const camelName = toCamelCase(table.name.slice(0, -1));

        const content = QUERY_BUILDER_SERVICE_TEMPLATE
            .replace(/\{\{TABLE_NAME\}\}/g, table.name)
            .replace(/\{\{TABLE_NAME_PASCAL\}\}/g, modelName)
            .replace(/\{\{TABLE_NAME_CAMEL\}\}/g, camelName);

        return {
            path: `services/${table.name}-query-builder.ts`,
            content,
            description: `Query builder service for ${table.name}`,
            type: 'query',
        };
    }

    /**
     * Generate database service
     */
    generateDatabaseService(table: TableDefinition): DatabaseGeneratedFile {
        const modelName = toPascalCase(table.name.slice(0, -1));
        const camelName = toCamelCase(table.name.slice(0, -1));

        const content = DATABASE_SERVICE_TEMPLATE
            .replace(/\{\{TABLE_NAME\}\}/g, table.name)
            .replace(/\{\{TABLE_NAME_PASCAL\}\}/g, modelName)
            .replace(/\{\{TABLE_NAME_CAMEL\}\}/g, camelName);

        return {
            path: `services/${table.name}-service.ts`,
            content,
            description: `Database service for ${table.name}`,
            type: 'query',
        };
    }

    // ========================================
    // INDEX ADVISOR
    // ========================================

    /**
     * Analyze schema and suggest indexes
     */
    suggestIndexes(schema: SchemaDefinition): IndexRecommendation[] {
        const recommendations: IndexRecommendation[] = [];

        for (const table of schema.tables) {
            // Foreign key indexes
            for (const column of table.columns) {
                if (column.references) {
                    recommendations.push({
                        table: table.name,
                        columns: [column.name],
                        type: 'btree',
                        reason: `Foreign key to ${column.references.table} should be indexed for JOIN performance`,
                        priority: 'high',
                    });
                }
            }

            // Common query pattern indexes
            const hasUserId = table.columns.some(c => c.name === 'user_id');
            if (hasUserId) {
                recommendations.push({
                    table: table.name,
                    columns: ['user_id', 'created_at'],
                    type: 'btree',
                    reason: 'Composite index for user-specific ordered queries',
                    priority: 'high',
                });
            }

            // Status columns
            const statusColumn = table.columns.find(c => c.name === 'status');
            if (statusColumn) {
                recommendations.push({
                    table: table.name,
                    columns: ['status'],
                    type: 'btree',
                    reason: 'Status column often used in WHERE clauses',
                    priority: 'medium',
                });
            }

            // Slug/unique text columns
            const slugColumn = table.columns.find(c => c.name.includes('slug'));
            if (slugColumn && !slugColumn.unique) {
                recommendations.push({
                    table: table.name,
                    columns: [slugColumn.name],
                    type: 'btree',
                    reason: 'Slug lookups are common and should be indexed',
                    priority: 'high',
                });
            }

            // JSON columns
            const jsonColumns = table.columns.filter(c => c.type === 'json');
            for (const jsonCol of jsonColumns) {
                recommendations.push({
                    table: table.name,
                    columns: [jsonCol.name],
                    type: 'gin',
                    reason: 'GIN index for JSONB column enables efficient JSON queries',
                    priority: 'medium',
                });
            }

            // Text search columns
            const textColumns = table.columns.filter(c =>
                c.type === 'text' && (c.name.includes('content') || c.name.includes('description'))
            );
            for (const textCol of textColumns) {
                recommendations.push({
                    table: table.name,
                    columns: [textCol.name],
                    type: 'gin',
                    reason: 'GIN index for full-text search on content columns',
                    priority: 'low',
                });
            }
        }

        return recommendations;
    }

    // ========================================
    // CONNECTION POOL CONFIGURATION
    // ========================================

    /**
     * Generate connection pool configuration
     */
    generateConnectionPoolConfig(poolSize: number = 10): DatabaseGeneratedFile {
        const content = CONNECTION_POOL_TEMPLATE
            .replace('{{POOL_SIZE}}', poolSize.toString())
            .replace('{{IDLE_TIMEOUT}}', '30000')
            .replace('{{CONNECTION_TIMEOUT}}', '5000');

        return {
            path: 'config/database-pool.ts',
            content,
            description: 'Database connection pool configuration',
            type: 'config',
        };
    }

    // ========================================
    // MAIN GENERATION METHOD
    // ========================================

    /**
     * Generate complete database system from requirements
     */
    async generateDatabaseSystem(config: {
        requirements: string;
        generateMigration?: boolean;
        generateSeeds?: boolean;
        generateServices?: boolean;
        generatePoolConfig?: boolean;
        migrationName?: string;
    }): Promise<DatabaseGenerationResult> {
        console.log('[DATABASE-AGENT] Starting database system generation...');

        const result: DatabaseGenerationResult = {
            files: [],
            dependencies: ['@prisma/client', 'prisma'],
            envVariables: ['DATABASE_URL'],
            instructions: [],
        };

        // Step 1: Analyze requirements
        const schema = await this.analyzeRequirements(config.requirements);
        console.log(`[DATABASE-AGENT] Analyzed schema: ${schema.tables.length} tables`);

        // Step 2: Generate Prisma schema
        const prismaSchema = this.generatePrismaSchema(schema);
        result.files.push({
            path: 'prisma/schema.prisma',
            content: prismaSchema,
            description: 'Prisma schema file',
            type: 'schema',
        });

        // Step 3: Generate migration
        if (config.generateMigration !== false) {
            const migrationName = config.migrationName || 'initial_schema';
            const migrationFiles = this.generateSupabaseMigration(schema, migrationName);
            result.files.push(...migrationFiles);
            result.instructions.push(`Run migration in Supabase SQL Editor: ${migrationFiles[0].path}`);
        }

        // Step 4: Generate seed files
        if (config.generateSeeds !== false) {
            const seedFiles = this.generateSeedFiles(schema);
            result.files.push(...seedFiles);
            result.instructions.push('Run seeds with: npx prisma db seed');
        }

        // Step 5: Generate services
        if (config.generateServices !== false) {
            for (const table of schema.tables) {
                result.files.push(this.generateQueryBuilder(table));
                result.files.push(this.generateDatabaseService(table));
            }
        }

        // Step 6: Generate pool config
        if (config.generatePoolConfig) {
            result.files.push(this.generateConnectionPoolConfig(this.config.poolSize));
        }

        // Step 7: Add index recommendations
        const indexRecommendations = this.suggestIndexes(schema);
        if (indexRecommendations.length > 0) {
            result.instructions.push('Index recommendations available - reviewed in console output');
            console.log('[DATABASE-AGENT] Index recommendations:', indexRecommendations);
        }

        // Final instructions
        result.instructions.push('Install dependencies: npm install @prisma/client prisma');
        result.instructions.push('Generate Prisma client: npx prisma generate');
        result.instructions.push('Push to database: npx prisma db push');

        console.log(`[DATABASE-AGENT] Generation complete: ${result.files.length} files`);

        return result;
    }

    // ========================================
    // TEMPLATE ACCESS
    // ========================================

    /**
     * Get available templates
     */
    getAvailableTemplates(): string[] {
        return getAvailableTemplates();
    }

    /**
     * Get all template sets
     */
    getTemplateSets(): typeof DATABASE_TEMPLATE_SETS {
        return DATABASE_TEMPLATE_SETS;
    }
}

// Export singleton instance
export const databaseAgent = new DatabaseAgent();
