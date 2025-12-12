/**
 * ============================================
 * DATABASE AGENT - TEMPLATES
 * ============================================
 * Code templates for database operations including Prisma schemas,
 * migrations, seeds, and query builders.
 */

// ============================================
// PRISMA SCHEMA TEMPLATES
// ============================================

export const PRISMA_SCHEMA_HEADER = `// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
`;

export const PRISMA_MODEL_TEMPLATE = `
model {{MODEL_NAME}} {
  {{FIELDS}}

  {{RELATIONS}}

  {{INDEXES}}
}
`;

export const PRISMA_FIELD_TEMPLATES = {
    string: '{{NAME}} String{{MODIFIERS}}',
    text: '{{NAME}} String{{MODIFIERS}} @db.Text',
    int: '{{NAME}} Int{{MODIFIERS}}',
    bigint: '{{NAME}} BigInt{{MODIFIERS}}',
    float: '{{NAME}} Float{{MODIFIERS}}',
    decimal: '{{NAME}} Decimal{{MODIFIERS}}',
    boolean: '{{NAME}} Boolean{{MODIFIERS}}',
    datetime: '{{NAME}} DateTime{{MODIFIERS}}',
    date: '{{NAME}} DateTime{{MODIFIERS}} @db.Date',
    time: '{{NAME}} DateTime{{MODIFIERS}} @db.Time',
    json: '{{NAME}} Json{{MODIFIERS}}',
    uuid: '{{NAME}} String{{MODIFIERS}} @db.Uuid @default(uuid())',
    enum: '{{NAME}} {{ENUM_TYPE}}{{MODIFIERS}}',
};

export const PRISMA_ENUM_TEMPLATE = `
enum {{ENUM_NAME}} {
  {{VALUES}}
}
`;

// ============================================
// SUPABASE MIGRATION TEMPLATES
// ============================================

export const SUPABASE_MIGRATION_HEADER = `-- =====================================================
-- {{MIGRATION_NAME}}
-- =====================================================
-- Description: {{DESCRIPTION}}
-- Created: {{TIMESTAMP}}

`;

export const SUPABASE_CREATE_TABLE = `
-- =====================================================
-- TABLE: {{TABLE_NAME}}
-- =====================================================

CREATE TABLE IF NOT EXISTS {{TABLE_NAME}} (
    {{COLUMNS}}
);

-- Indexes
{{INDEXES}}

-- Comments
COMMENT ON TABLE {{TABLE_NAME}} IS '{{COMMENT}}';
`;

export const SUPABASE_RLS_TEMPLATE = `
-- =====================================================
-- ROW LEVEL SECURITY FOR {{TABLE_NAME}}
-- =====================================================

ALTER TABLE {{TABLE_NAME}} ENABLE ROW LEVEL SECURITY;

-- Policy: {{POLICY_NAME}}
CREATE POLICY "{{POLICY_NAME}}"
    ON {{TABLE_NAME}}
    FOR {{OPERATION}}
    {{USING_CLAUSE}}
    {{WITH_CHECK_CLAUSE}};
`;

export const SUPABASE_INDEX_TEMPLATE = `CREATE INDEX IF NOT EXISTS idx_{{TABLE_NAME}}_{{COLUMN_NAMES}}
    ON {{TABLE_NAME}}({{COLUMNS}}){{INDEX_OPTIONS}};
`;

export const SUPABASE_FOREIGN_KEY_TEMPLATE = `ALTER TABLE {{TABLE_NAME}}
    ADD CONSTRAINT fk_{{TABLE_NAME}}_{{COLUMN_NAME}}
    FOREIGN KEY ({{COLUMN_NAME}})
    REFERENCES {{REFERENCE_TABLE}}({{REFERENCE_COLUMN}})
    ON DELETE {{ON_DELETE}}
    ON UPDATE {{ON_UPDATE}};
`;

// ============================================
// SEED DATA TEMPLATES
// ============================================

export const TYPESCRIPT_SEED_TEMPLATE = `/**
 * Seed data for {{TABLE_NAME}}
 * Run with: npx prisma db seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const {{TABLE_NAME_CAMEL}}Data = {{SEED_DATA}};

async function seed{{TABLE_NAME_PASCAL}}() {
    console.log('Seeding {{TABLE_NAME}}...');

    for (const data of {{TABLE_NAME_CAMEL}}Data) {
        await prisma.{{TABLE_NAME_CAMEL}}.upsert({
            where: { id: data.id },
            update: data,
            create: data,
        });
    }

    console.log('✅ {{TABLE_NAME}} seeded successfully');
}

export { seed{{TABLE_NAME_PASCAL}} };
`;

export const SQL_SEED_TEMPLATE = `-- =====================================================
-- Seed data for {{TABLE_NAME}}
-- =====================================================

{{INSERT_STATEMENTS}}

-- Verify seed data
SELECT COUNT(*) as total_records FROM {{TABLE_NAME}};
`;

// ============================================
// QUERY BUILDER TEMPLATES
// ============================================

export const QUERY_BUILDER_SERVICE_TEMPLATE = `/**
 * Query Builder Service for {{TABLE_NAME}}
 * Provides type-safe query building for {{TABLE_NAME_PASCAL}}
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export interface {{TABLE_NAME_PASCAL}}QueryOptions {
    where?: Prisma.{{TABLE_NAME_PASCAL}}WhereInput;
    orderBy?: Prisma.{{TABLE_NAME_PASCAL}}OrderByWithRelationInput | Prisma.{{TABLE_NAME_PASCAL}}OrderByWithRelationInput[];
    include?: Prisma.{{TABLE_NAME_PASCAL}}Include;
    take?: number;
    skip?: number;
    cursor?: Prisma.{{TABLE_NAME_PASCAL}}WhereUniqueInput;
}

export class {{TABLE_NAME_PASCAL}}QueryBuilder {
    /**
     * Find many {{TABLE_NAME}} records with pagination
     */
    static async findMany(options: {{TABLE_NAME_PASCAL}}QueryOptions = {}) {
        const { where, orderBy, include, take = 20, skip = 0, cursor } = options;

        const [data, total] = await Promise.all([
            prisma.{{TABLE_NAME_CAMEL}}.findMany({
                where,
                orderBy,
                include,
                take,
                skip,
                cursor,
            }),
            prisma.{{TABLE_NAME_CAMEL}}.count({ where }),
        ]);

        return {
            data,
            pagination: {
                total,
                page: Math.floor(skip / take) + 1,
                pageSize: take,
                totalPages: Math.ceil(total / take),
                hasNext: skip + take < total,
                hasPrev: skip > 0,
            },
        };
    }

    /**
     * Find unique {{TABLE_NAME}} by ID
     */
    static async findById(id: string, include?: Prisma.{{TABLE_NAME_PASCAL}}Include) {
        return prisma.{{TABLE_NAME_CAMEL}}.findUnique({
            where: { id },
            include,
        });
    }

    /**
     * Create new {{TABLE_NAME}} record
     */
    static async create(data: Prisma.{{TABLE_NAME_PASCAL}}CreateInput) {
        return prisma.{{TABLE_NAME_CAMEL}}.create({ data });
    }

    /**
     * Update {{TABLE_NAME}} record
     */
    static async update(id: string, data: Prisma.{{TABLE_NAME_PASCAL}}UpdateInput) {
        return prisma.{{TABLE_NAME_CAMEL}}.update({
            where: { id },
            data,
        });
    }

    /**
     * Delete {{TABLE_NAME}} record
     */
    static async delete(id: string) {
        return prisma.{{TABLE_NAME_CAMEL}}.delete({
            where: { id },
        });
    }

    /**
     * Soft delete {{TABLE_NAME}} record (if deletedAt column exists)
     */
    static async softDelete(id: string) {
        return prisma.{{TABLE_NAME_CAMEL}}.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }
}
`;

// ============================================
// DATABASE SERVICE TEMPLATE
// ============================================

export const DATABASE_SERVICE_TEMPLATE = `/**
 * {{TABLE_NAME_PASCAL}} Database Service
 * CRUD operations and business logic for {{TABLE_NAME}}
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Types
export type {{TABLE_NAME_PASCAL}} = Prisma.{{TABLE_NAME_PASCAL}}GetPayload<{}>;
export type {{TABLE_NAME_PASCAL}}CreateInput = Prisma.{{TABLE_NAME_PASCAL}}CreateInput;
export type {{TABLE_NAME_PASCAL}}UpdateInput = Prisma.{{TABLE_NAME_PASCAL}}UpdateInput;

class {{TABLE_NAME_PASCAL}}Service {
    /**
     * Find all {{TABLE_NAME}} with optional filtering
     */
    async findAll(options?: {
        page?: number;
        limit?: number;
        search?: string;
        orderBy?: string;
        order?: 'asc' | 'desc';
    }) {
        const {
            page = 1,
            limit = 20,
            search,
            orderBy = 'createdAt',
            order = 'desc',
        } = options || {};

        const skip = (page - 1) * limit;

        const where: Prisma.{{TABLE_NAME_PASCAL}}WhereInput = search
            ? {
                OR: [
                    // Add searchable fields here
                    // { name: { contains: search, mode: 'insensitive' } },
                ],
            }
            : {};

        const [data, total] = await Promise.all([
            prisma.{{TABLE_NAME_CAMEL}}.findMany({
                where,
                orderBy: { [orderBy]: order },
                skip,
                take: limit,
            }),
            prisma.{{TABLE_NAME_CAMEL}}.count({ where }),
        ]);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Find by ID
     */
    async findById(id: string): Promise<{{TABLE_NAME_PASCAL}} | null> {
        return prisma.{{TABLE_NAME_CAMEL}}.findUnique({
            where: { id },
        });
    }

    /**
     * Create new record
     */
    async create(data: {{TABLE_NAME_PASCAL}}CreateInput): Promise<{{TABLE_NAME_PASCAL}}> {
        return prisma.{{TABLE_NAME_CAMEL}}.create({ data });
    }

    /**
     * Update record
     */
    async update(id: string, data: {{TABLE_NAME_PASCAL}}UpdateInput): Promise<{{TABLE_NAME_PASCAL}}> {
        return prisma.{{TABLE_NAME_CAMEL}}.update({
            where: { id },
            data,
        });
    }

    /**
     * Delete record
     */
    async delete(id: string): Promise<{{TABLE_NAME_PASCAL}}> {
        return prisma.{{TABLE_NAME_CAMEL}}.delete({
            where: { id },
        });
    }

    /**
     * Check if record exists
     */
    async exists(id: string): Promise<boolean> {
        const count = await prisma.{{TABLE_NAME_CAMEL}}.count({
            where: { id },
        });
        return count > 0;
    }
}

// Export singleton instance
export const {{TABLE_NAME_CAMEL}}Service = new {{TABLE_NAME_PASCAL}}Service();
`;

// ============================================
// CONNECTION POOL TEMPLATE
// ============================================

export const CONNECTION_POOL_TEMPLATE = `/**
 * Database Connection Pool Configuration
 * Optimized for production workloads
 */

import { PrismaClient } from '@prisma/client';

// Connection pool configuration
const POOL_CONFIG = {
    connectionLimit: {{POOL_SIZE}},
    idleTimeoutMillis: {{IDLE_TIMEOUT}},
    connectionTimeoutMillis: {{CONNECTION_TIMEOUT}},
};

// Singleton PrismaClient with connection pooling
let prisma: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
    if (!prisma) {
        prisma = new PrismaClient({
            datasources: {
                db: {
                    url: process.env.DATABASE_URL,
                },
            },
            log: process.env.NODE_ENV === 'development'
                ? ['query', 'info', 'warn', 'error']
                : ['error'],
        });

        // Add middleware for logging
        prisma.$use(async (params, next) => {
            const before = Date.now();
            const result = await next(params);
            const after = Date.now();

            if (process.env.NODE_ENV === 'development') {
                console.log(
                    \`[PRISMA] \${params.model}.\${params.action} - \${after - before}ms\`
                );
            }

            return result;
        });
    }

    return prisma;
}

// Health check function
export async function checkDatabaseHealth(): Promise<{
    healthy: boolean;
    latency: number;
    error?: string;
}> {
    const start = Date.now();
    try {
        const client = getPrismaClient();
        await client.$queryRaw\`SELECT 1\`;
        return {
            healthy: true,
            latency: Date.now() - start,
        };
    } catch (error) {
        return {
            healthy: false,
            latency: Date.now() - start,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// Graceful shutdown
export async function disconnectDatabase(): Promise<void> {
    if (prisma) {
        await prisma.$disconnect();
        prisma = null;
        console.log('[DATABASE] Connection closed');
    }
}
`;

// ============================================
// TEMPLATE GETTERS
// ============================================

export type DatabaseTemplateType =
    | 'prisma-schema'
    | 'supabase-migration'
    | 'supabase-rls'
    | 'typescript-seed'
    | 'sql-seed'
    | 'query-builder'
    | 'database-service'
    | 'connection-pool';

/**
 * Get all available template types
 */
export function getAvailableTemplates(): DatabaseTemplateType[] {
    return [
        'prisma-schema',
        'supabase-migration',
        'supabase-rls',
        'typescript-seed',
        'sql-seed',
        'query-builder',
        'database-service',
        'connection-pool',
    ];
}

/**
 * Get template by type
 */
export function getTemplate(type: DatabaseTemplateType): string {
    switch (type) {
        case 'prisma-schema':
            return PRISMA_SCHEMA_HEADER + PRISMA_MODEL_TEMPLATE;
        case 'supabase-migration':
            return SUPABASE_MIGRATION_HEADER + SUPABASE_CREATE_TABLE;
        case 'supabase-rls':
            return SUPABASE_RLS_TEMPLATE;
        case 'typescript-seed':
            return TYPESCRIPT_SEED_TEMPLATE;
        case 'sql-seed':
            return SQL_SEED_TEMPLATE;
        case 'query-builder':
            return QUERY_BUILDER_SERVICE_TEMPLATE;
        case 'database-service':
            return DATABASE_SERVICE_TEMPLATE;
        case 'connection-pool':
            return CONNECTION_POOL_TEMPLATE;
        default:
            throw new Error(`Unknown template type: ${type}`);
    }
}

/**
 * Get all template sets organized by category
 */
export const DATABASE_TEMPLATE_SETS = {
    schema: {
        prisma: PRISMA_SCHEMA_HEADER,
        model: PRISMA_MODEL_TEMPLATE,
        enum: PRISMA_ENUM_TEMPLATE,
        fields: PRISMA_FIELD_TEMPLATES,
    },
    migration: {
        header: SUPABASE_MIGRATION_HEADER,
        createTable: SUPABASE_CREATE_TABLE,
        rls: SUPABASE_RLS_TEMPLATE,
        index: SUPABASE_INDEX_TEMPLATE,
        foreignKey: SUPABASE_FOREIGN_KEY_TEMPLATE,
    },
    seed: {
        typescript: TYPESCRIPT_SEED_TEMPLATE,
        sql: SQL_SEED_TEMPLATE,
    },
    service: {
        queryBuilder: QUERY_BUILDER_SERVICE_TEMPLATE,
        databaseService: DATABASE_SERVICE_TEMPLATE,
        connectionPool: CONNECTION_POOL_TEMPLATE,
    },
};
