/**
 * Database Code Generator
 * 
 * Phase 17.2: Database Integration in Generated Code
 * 
 * Generates database-related code:
 * - Prisma schema from entity definitions
 * - Supabase client integration
 * - Database migration files
 * - Real database calls (replacing in-memory stores)
 */

export interface EntityField {
    name: string;
    type: 'string' | 'int' | 'float' | 'boolean' | 'datetime' | 'json' | 'relation';
    required?: boolean;
    unique?: boolean;
    default?: string | number | boolean;
    relation?: {
        model: string;
        field: string;
        type: 'one-to-one' | 'one-to-many' | 'many-to-many';
    };
}

export interface EntityDefinition {
    name: string;
    tableName?: string;
    fields: EntityField[];
    timestamps?: boolean;
    softDelete?: boolean;
}

export interface DatabaseConfig {
    provider: 'prisma' | 'drizzle' | 'supabase';
    database: 'postgresql' | 'mysql' | 'sqlite' | 'mongodb';
    connectionString?: string;
}

export interface GeneratedDbFile {
    path: string;
    content: string;
    type: 'schema' | 'migration' | 'client' | 'service' | 'types';
}

export interface DatabaseGenerationResult {
    files: GeneratedDbFile[];
    dependencies: string[];
    devDependencies: string[];
    envVars: Record<string, string>;
}

// ============================================
// TYPE MAPPINGS
// ============================================

const PRISMA_TYPE_MAP: Record<string, Record<string, string>> = {
    postgresql: {
        string: 'String',
        int: 'Int',
        float: 'Float',
        boolean: 'Boolean',
        datetime: 'DateTime',
        json: 'Json',
    },
    mysql: {
        string: 'String',
        int: 'Int',
        float: 'Float',
        boolean: 'Boolean',
        datetime: 'DateTime',
        json: 'Json',
    },
    sqlite: {
        string: 'String',
        int: 'Int',
        float: 'Float',
        boolean: 'Boolean',
        datetime: 'DateTime',
        json: 'String', // SQLite doesn't have native JSON
    },
    mongodb: {
        string: 'String',
        int: 'Int',
        float: 'Float',
        boolean: 'Boolean',
        datetime: 'DateTime',
        json: 'Json',
    },
};

const TYPESCRIPT_TYPE_MAP: Record<string, string> = {
    string: 'string',
    int: 'number',
    float: 'number',
    boolean: 'boolean',
    datetime: 'Date',
    json: 'Record<string, unknown>',
};

// ============================================
// DATABASE CODE GENERATOR
// ============================================

export class DatabaseCodeGenerator {
    private config: DatabaseConfig;

    constructor(config?: Partial<DatabaseConfig>) {
        this.config = {
            provider: config?.provider || 'prisma',
            database: config?.database || 'postgresql',
            connectionString: config?.connectionString,
        };
    }

    /**
     * Generate all database code for given entities
     */
    generate(entities: EntityDefinition[]): DatabaseGenerationResult {
        console.log(`[DB-GENERATOR] Generating code for ${entities.length} entities using ${this.config.provider}`);

        const files: GeneratedDbFile[] = [];
        const dependencies: string[] = [];
        const devDependencies: string[] = [];
        const envVars: Record<string, string> = {};

        switch (this.config.provider) {
            case 'prisma':
                files.push(...this.generatePrismaFiles(entities));
                dependencies.push('@prisma/client');
                devDependencies.push('prisma');
                envVars['DATABASE_URL'] = this.config.connectionString ||
                    'postgresql://user:password@localhost:5432/mydb';
                break;
            case 'drizzle':
                files.push(...this.generateDrizzleFiles(entities));
                dependencies.push('drizzle-orm', 'postgres');
                devDependencies.push('drizzle-kit');
                envVars['DATABASE_URL'] = this.config.connectionString ||
                    'postgresql://user:password@localhost:5432/mydb';
                break;
            case 'supabase':
                files.push(...this.generateSupabaseFiles(entities));
                dependencies.push('@supabase/supabase-js');
                envVars['SUPABASE_URL'] = 'https://your-project.supabase.co';
                envVars['SUPABASE_ANON_KEY'] = 'your-anon-key';
                envVars['SUPABASE_SERVICE_KEY'] = 'your-service-key';
                break;
        }

        // Generate TypeScript types
        files.push(this.generateTypeDefinitions(entities));

        // Generate service layer
        files.push(...this.generateServiceLayer(entities));

        console.log(`[DB-GENERATOR] Generated ${files.length} files`);

        return { files, dependencies, devDependencies, envVars };
    }

    // ============================================
    // PRISMA GENERATION
    // ============================================

    private generatePrismaFiles(entities: EntityDefinition[]): GeneratedDbFile[] {
        const files: GeneratedDbFile[] = [];

        // Generate schema.prisma
        files.push({
            path: 'prisma/schema.prisma',
            content: this.generatePrismaSchema(entities),
            type: 'schema',
        });

        // Generate Prisma client wrapper
        files.push({
            path: 'src/lib/prisma.ts',
            content: this.generatePrismaClient(),
            type: 'client',
        });

        // Generate migration SQL
        files.push({
            path: `prisma/migrations/${this.getMigrationTimestamp()}_init/migration.sql`,
            content: this.generatePrismaMigration(entities),
            type: 'migration',
        });

        // Generate seed file
        files.push({
            path: 'prisma/seed.ts',
            content: this.generatePrismaSeed(entities),
            type: 'schema',
        });

        return files;
    }

    private generatePrismaSchema(entities: EntityDefinition[]): string {
        const typeMap = PRISMA_TYPE_MAP[this.config.database];

        const models = entities.map(entity => {
            const fields: string[] = [];

            // ID field
            fields.push('  id        String   @id @default(cuid())');

            // Entity fields
            for (const field of entity.fields) {
                if (field.type === 'relation') {
                    // Handle relations
                    if (field.relation) {
                        const relationType = field.relation.type;
                        if (relationType === 'one-to-many') {
                            fields.push(`  ${field.name} ${field.relation.model}[]`);
                        } else if (relationType === 'many-to-many') {
                            fields.push(`  ${field.name} ${field.relation.model}[]`);
                        } else {
                            const optional = field.required ? '' : '?';
                            fields.push(`  ${field.name}   ${field.relation.model}${optional} @relation(fields: [${field.name}Id], references: [id])`);
                            fields.push(`  ${field.name}Id String${optional}`);
                        }
                    }
                } else {
                    const prismaType = typeMap[field.type] || 'String';
                    const optional = field.required ? '' : '?';
                    const unique = field.unique ? ' @unique' : '';
                    const defaultVal = field.default !== undefined
                        ? ` @default(${this.formatPrismaDefault(field.default, field.type)})`
                        : '';

                    // Pad field name for alignment
                    const paddedName = field.name.padEnd(12);
                    fields.push(`  ${paddedName}${prismaType}${optional}${unique}${defaultVal}`);
                }
            }

            // Timestamps
            if (entity.timestamps !== false) {
                fields.push('  createdAt DateTime @default(now())');
                fields.push('  updatedAt DateTime @updatedAt');
            }

            // Soft delete
            if (entity.softDelete) {
                fields.push('  deletedAt DateTime?');
            }

            // Table mapping
            const tableName = entity.tableName || this.toSnakeCase(entity.name) + 's';
            fields.push('');
            fields.push(`  @@map("${tableName}")`);

            return `model ${entity.name} {\n${fields.join('\n')}\n}`;
        }).join('\n\n');

        return `// Prisma Schema
// Generated by Loveable Backend Orchestrator
// https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${this.config.database}"
  url      = env("DATABASE_URL")
}

${models}
`;
    }

    private generatePrismaClient(): string {
        return `/**
 * Prisma Client Singleton
 * Ensures single database connection across the application
 */

import { PrismaClient } from '@prisma/client';

// Extend PrismaClient with logging
const prismaClientSingleton = () => {
    return new PrismaClient({
        log: process.env.NODE_ENV === 'development' 
            ? ['query', 'info', 'warn', 'error']
            : ['error'],
    });
};

// Type for global prisma instance
declare const globalThis: {
    prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

// Use existing instance or create new one
const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

// Store in global for development (prevents multiple instances on hot reload)
if (process.env.NODE_ENV !== 'production') {
    globalThis.prismaGlobal = prisma;
}

export { prisma };

/**
 * Graceful shutdown handler
 */
export async function disconnectPrisma(): Promise<void> {
    await prisma.$disconnect();
}

// Handle process termination
process.on('beforeExit', disconnectPrisma);
`;
    }

    private generatePrismaMigration(entities: EntityDefinition[]): string {
        const tables = entities.map(entity => {
            const tableName = entity.tableName || this.toSnakeCase(entity.name) + 's';
            const columns: string[] = [];

            columns.push('    "id" TEXT NOT NULL PRIMARY KEY');

            for (const field of entity.fields) {
                if (field.type !== 'relation') {
                    const sqlType = this.getSqlType(field.type);
                    const nullable = field.required ? 'NOT NULL' : '';
                    const unique = field.unique ? 'UNIQUE' : '';
                    const defaultVal = field.default !== undefined
                        ? `DEFAULT ${this.formatSqlDefault(field.default, field.type)}`
                        : '';

                    columns.push(`    "${this.toSnakeCase(field.name)}" ${sqlType} ${nullable} ${unique} ${defaultVal}`.trim());
                } else if (field.relation?.type === 'one-to-one' || field.relation?.type === 'many-to-many') {
                    columns.push(`    "${this.toSnakeCase(field.name)}_id" TEXT`);
                }
            }

            if (entity.timestamps !== false) {
                columns.push('    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP');
                columns.push('    "updated_at" TIMESTAMP(3) NOT NULL');
            }

            if (entity.softDelete) {
                columns.push('    "deleted_at" TIMESTAMP(3)');
            }

            return `-- CreateTable
CREATE TABLE "${tableName}" (
${columns.join(',\n')}
);`;
        }).join('\n\n');

        // Add indexes
        const indexes = entities.flatMap(entity => {
            const tableName = entity.tableName || this.toSnakeCase(entity.name) + 's';
            return entity.fields
                .filter(f => f.unique)
                .map(f => `-- CreateIndex
CREATE UNIQUE INDEX "${tableName}_${this.toSnakeCase(f.name)}_key" ON "${tableName}"("${this.toSnakeCase(f.name)}");`);
        }).join('\n\n');

        return `-- Migration: Initial Schema
-- Generated: ${new Date().toISOString()}

${tables}

${indexes}
`;
    }

    private generatePrismaSeed(entities: EntityDefinition[]): string {
        const seedData = entities.map(entity => {
            const modelName = entity.name.charAt(0).toLowerCase() + entity.name.slice(1);
            return `    // Seed ${entity.name}
    const ${modelName} = await prisma.${modelName}.upsert({
        where: { id: 'seed-${modelName}-1' },
        update: {},
        create: {
            id: 'seed-${modelName}-1',
            // Add your seed data here
        },
    });
    console.log('Created ${entity.name}:', ${modelName}.id);`;
        }).join('\n\n');

        return `/**
 * Database Seed Script
 * Run with: npx prisma db seed
 */

import { prisma } from '../src/lib/prisma';

async function main() {
    console.log('🌱 Starting database seed...');

${seedData}

    console.log('✅ Seed completed!');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
`;
    }

    // ============================================
    // DRIZZLE GENERATION
    // ============================================

    private generateDrizzleFiles(entities: EntityDefinition[]): GeneratedDbFile[] {
        const files: GeneratedDbFile[] = [];

        // Generate schema file
        files.push({
            path: 'src/db/schema.ts',
            content: this.generateDrizzleSchema(entities),
            type: 'schema',
        });

        // Generate database client
        files.push({
            path: 'src/db/index.ts',
            content: this.generateDrizzleClient(),
            type: 'client',
        });

        // Generate drizzle config
        files.push({
            path: 'drizzle.config.ts',
            content: this.generateDrizzleConfig(),
            type: 'schema',
        });

        return files;
    }

    private generateDrizzleSchema(entities: EntityDefinition[]): string {
        const imports = new Set<string>(['pgTable', 'text', 'timestamp']);
        const tables: string[] = [];

        for (const entity of entities) {
            const tableName = entity.tableName || this.toSnakeCase(entity.name) + 's';
            const fields: string[] = [];

            fields.push(`    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID())`);

            for (const field of entity.fields) {
                if (field.type !== 'relation') {
                    const drizzleType = this.getDrizzleType(field.type);
                    imports.add(drizzleType.import);

                    let fieldDef = `    ${field.name}: ${drizzleType.func}('${this.toSnakeCase(field.name)}')`;
                    if (!field.required) fieldDef += '';
                    if (field.unique) fieldDef += '.unique()';
                    if (field.default !== undefined) {
                        fieldDef += `.default(${JSON.stringify(field.default)})`;
                    }
                    fields.push(fieldDef);
                }
            }

            if (entity.timestamps !== false) {
                fields.push(`    createdAt: timestamp('created_at').defaultNow().notNull()`);
                fields.push(`    updatedAt: timestamp('updated_at').defaultNow().notNull()`);
            }

            tables.push(`export const ${entity.name.toLowerCase()}s = pgTable('${tableName}', {\n${fields.join(',\n')},\n});`);
        }

        return `/**
 * Drizzle ORM Schema
 * Generated by Loveable Backend Orchestrator
 */

import { ${Array.from(imports).join(', ')} } from 'drizzle-orm/pg-core';

${tables.join('\n\n')}
`;
    }

    private generateDrizzleClient(): string {
        return `/**
 * Drizzle Database Client
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// Connection pool
const client = postgres(connectionString, { 
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
});

export const db = drizzle(client, { schema });

export { schema };
`;
    }

    private generateDrizzleConfig(): string {
        return `import type { Config } from 'drizzle-kit';

export default {
    schema: './src/db/schema.ts',
    out: './drizzle',
    driver: 'pg',
    dbCredentials: {
        connectionString: process.env.DATABASE_URL!,
    },
} satisfies Config;
`;
    }

    // ============================================
    // SUPABASE GENERATION
    // ============================================

    private generateSupabaseFiles(entities: EntityDefinition[]): GeneratedDbFile[] {
        const files: GeneratedDbFile[] = [];

        // Generate Supabase client
        files.push({
            path: 'src/lib/supabase.ts',
            content: this.generateSupabaseClient(),
            type: 'client',
        });

        // Generate SQL migration for Supabase
        files.push({
            path: 'supabase/migrations/001_initial_schema.sql',
            content: this.generateSupabaseMigration(entities),
            type: 'migration',
        });

        // Generate RLS policies
        files.push({
            path: 'supabase/migrations/002_rls_policies.sql',
            content: this.generateSupabaseRLS(entities),
            type: 'migration',
        });

        return files;
    }

    private generateSupabaseClient(): string {
        return `/**
 * Supabase Client
 * Generated by Loveable Backend Orchestrator
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

// Client for public access (respects RLS)
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Admin client (bypasses RLS) - use with caution!
export const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

/**
 * Get authenticated Supabase client for a user
 */
export function getSupabaseForUser(accessToken: string): SupabaseClient {
    return createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: {
                Authorization: \`Bearer \${accessToken}\`,
            },
        },
    });
}
`;
    }

    private generateSupabaseMigration(entities: EntityDefinition[]): string {
        const tables = entities.map(entity => {
            const tableName = entity.tableName || this.toSnakeCase(entity.name) + 's';
            const columns: string[] = [];

            columns.push('    id uuid DEFAULT gen_random_uuid() PRIMARY KEY');

            for (const field of entity.fields) {
                if (field.type !== 'relation') {
                    const sqlType = this.getSqlType(field.type);
                    const nullable = field.required ? 'NOT NULL' : '';
                    const unique = field.unique ? 'UNIQUE' : '';
                    const defaultVal = field.default !== undefined
                        ? `DEFAULT ${this.formatSqlDefault(field.default, field.type)}`
                        : '';

                    columns.push(`    ${this.toSnakeCase(field.name)} ${sqlType} ${nullable} ${unique} ${defaultVal}`.trim());
                }
            }

            if (entity.timestamps !== false) {
                columns.push('    created_at timestamptz DEFAULT now() NOT NULL');
                columns.push('    updated_at timestamptz DEFAULT now() NOT NULL');
            }

            if (entity.softDelete) {
                columns.push('    deleted_at timestamptz');
            }

            return `-- Create ${entity.name} table
CREATE TABLE IF NOT EXISTS public.${tableName} (
${columns.join(',\n')}
);

-- Enable RLS
ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_${tableName}_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ${tableName}_updated_at
    BEFORE UPDATE ON public.${tableName}
    FOR EACH ROW
    EXECUTE FUNCTION update_${tableName}_updated_at();`;
        }).join('\n\n');

        return `-- Supabase Migration: Initial Schema
-- Generated: ${new Date().toISOString()}

${tables}
`;
    }

    private generateSupabaseRLS(entities: EntityDefinition[]): string {
        const policies = entities.map(entity => {
            const tableName = entity.tableName || this.toSnakeCase(entity.name) + 's';

            return `-- RLS Policies for ${entity.name}

-- Allow authenticated users to read all rows
CREATE POLICY "${tableName}_select_policy"
    ON public.${tableName}
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert their own rows
CREATE POLICY "${tableName}_insert_policy"
    ON public.${tableName}
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow users to update their own rows (customize as needed)
CREATE POLICY "${tableName}_update_policy"
    ON public.${tableName}
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Allow users to delete their own rows (customize as needed)
CREATE POLICY "${tableName}_delete_policy"
    ON public.${tableName}
    FOR DELETE
    TO authenticated
    USING (true);`;
        }).join('\n\n');

        return `-- Supabase RLS Policies
-- Generated: ${new Date().toISOString()}
-- Customize these policies based on your access requirements

${policies}
`;
    }

    // ============================================
    // TYPE DEFINITIONS
    // ============================================

    private generateTypeDefinitions(entities: EntityDefinition[]): GeneratedDbFile {
        const types = entities.map(entity => {
            const fields = entity.fields
                .filter(f => f.type !== 'relation')
                .map(f => {
                    const tsType = TYPESCRIPT_TYPE_MAP[f.type] || 'unknown';
                    const optional = f.required ? '' : '?';
                    return `    ${f.name}${optional}: ${tsType};`;
                });

            // Add ID
            fields.unshift('    id: string;');

            // Add timestamps
            if (entity.timestamps !== false) {
                fields.push('    createdAt: Date;');
                fields.push('    updatedAt: Date;');
            }

            if (entity.softDelete) {
                fields.push('    deletedAt?: Date | null;');
            }

            const typeName = entity.name;
            const createTypeName = `Create${entity.name}Input`;
            const updateTypeName = `Update${entity.name}Input`;

            // Create input type (exclude id, timestamps)
            const createFields = entity.fields
                .filter(f => f.type !== 'relation')
                .map(f => {
                    const tsType = TYPESCRIPT_TYPE_MAP[f.type] || 'unknown';
                    const optional = f.required ? '' : '?';
                    return `    ${f.name}${optional}: ${tsType};`;
                });

            // Update input type (all optional)
            const updateFields = entity.fields
                .filter(f => f.type !== 'relation')
                .map(f => {
                    const tsType = TYPESCRIPT_TYPE_MAP[f.type] || 'unknown';
                    return `    ${f.name}?: ${tsType};`;
                });

            return `export interface ${typeName} {
${fields.join('\n')}
}

export interface ${createTypeName} {
${createFields.join('\n')}
}

export interface ${updateTypeName} {
${updateFields.join('\n')}
}`;
        }).join('\n\n');

        return {
            path: 'src/types/database.ts',
            content: `/**
 * Database Type Definitions
 * Generated by Loveable Backend Orchestrator
 */

${types}
`,
            type: 'types',
        };
    }

    // ============================================
    // SERVICE LAYER
    // ============================================

    private generateServiceLayer(entities: EntityDefinition[]): GeneratedDbFile[] {
        return entities.map(entity => ({
            path: `src/services/${this.toKebabCase(entity.name)}.service.ts`,
            content: this.generateEntityService(entity),
            type: 'service' as const,
        }));
    }

    private generateEntityService(entity: EntityDefinition): string {
        const modelName = entity.name;
        const varName = entity.name.charAt(0).toLowerCase() + entity.name.slice(1);
        const pluralVarName = varName + 's';

        if (this.config.provider === 'prisma') {
            return this.generatePrismaService(entity, modelName, varName, pluralVarName);
        } else if (this.config.provider === 'supabase') {
            return this.generateSupabaseService(entity, modelName, varName, pluralVarName);
        }

        return this.generatePrismaService(entity, modelName, varName, pluralVarName);
    }

    private generatePrismaService(
        entity: EntityDefinition,
        modelName: string,
        varName: string,
        _pluralVarName: string
    ): string {
        const tableName = entity.tableName || this.toSnakeCase(entity.name) + 's';

        return `/**
 * ${modelName} Service
 * Generated by Loveable Backend Orchestrator
 */

import { prisma } from '../lib/prisma';
import type { ${modelName}, Create${modelName}Input, Update${modelName}Input } from '../types/database';

export class ${modelName}Service {
    /**
     * Create a new ${varName}
     */
    async create(data: Create${modelName}Input): Promise<${modelName}> {
        return prisma.${varName}.create({ data });
    }

    /**
     * Find ${varName} by ID
     */
    async findById(id: string): Promise<${modelName} | null> {
        return prisma.${varName}.findUnique({ where: { id } });
    }

    /**
     * Find all ${tableName} with pagination
     */
    async findAll(options: {
        page?: number;
        limit?: number;
        orderBy?: string;
        orderDir?: 'asc' | 'desc';
    } = {}): Promise<{ data: ${modelName}[]; total: number; page: number; limit: number }> {
        const page = options.page || 1;
        const limit = Math.min(options.limit || 20, 100);
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            prisma.${varName}.findMany({
                skip,
                take: limit,
                orderBy: options.orderBy 
                    ? { [options.orderBy]: options.orderDir || 'asc' }
                    : { createdAt: 'desc' },
            }),
            prisma.${varName}.count(),
        ]);

        return { data, total, page, limit };
    }

    /**
     * Update ${varName} by ID
     */
    async update(id: string, data: Update${modelName}Input): Promise<${modelName}> {
        return prisma.${varName}.update({
            where: { id },
            data,
        });
    }

    /**
     * Delete ${varName} by ID
     */
    async delete(id: string): Promise<${modelName}> {
        return prisma.${varName}.delete({ where: { id } });
    }

    /**
     * Check if ${varName} exists
     */
    async exists(id: string): Promise<boolean> {
        const count = await prisma.${varName}.count({ where: { id } });
        return count > 0;
    }
}

// Singleton instance
export const ${varName}Service = new ${modelName}Service();
`;
    }

    private generateSupabaseService(
        entity: EntityDefinition,
        modelName: string,
        varName: string,
        _pluralVarName: string
    ): string {
        const tableName = entity.tableName || this.toSnakeCase(entity.name) + 's';

        return `/**
 * ${modelName} Service (Supabase)
 * Generated by Loveable Backend Orchestrator
 */

import { supabaseAdmin } from '../lib/supabase';
import type { ${modelName}, Create${modelName}Input, Update${modelName}Input } from '../types/database';

export class ${modelName}Service {
    private table = '${tableName}';

    /**
     * Create a new ${varName}
     */
    async create(data: Create${modelName}Input): Promise<${modelName}> {
        const { data: result, error } = await supabaseAdmin
            .from(this.table)
            .insert(data)
            .select()
            .single();

        if (error) throw error;
        return result;
    }

    /**
     * Find ${varName} by ID
     */
    async findById(id: string): Promise<${modelName} | null> {
        const { data, error } = await supabaseAdmin
            .from(this.table)
            .select()
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }

    /**
     * Find all ${tableName} with pagination
     */
    async findAll(options: {
        page?: number;
        limit?: number;
        orderBy?: string;
        orderDir?: 'asc' | 'desc';
    } = {}): Promise<{ data: ${modelName}[]; total: number; page: number; limit: number }> {
        const page = options.page || 1;
        const limit = Math.min(options.limit || 20, 100);
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, error, count } = await supabaseAdmin
            .from(this.table)
            .select('*', { count: 'exact' })
            .order(options.orderBy || 'created_at', { ascending: options.orderDir === 'asc' })
            .range(from, to);

        if (error) throw error;
        return { data: data || [], total: count || 0, page, limit };
    }

    /**
     * Update ${varName} by ID
     */
    async update(id: string, data: Update${modelName}Input): Promise<${modelName}> {
        const { data: result, error } = await supabaseAdmin
            .from(this.table)
            .update(data)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return result;
    }

    /**
     * Delete ${varName} by ID
     */
    async delete(id: string): Promise<${modelName}> {
        const { data, error } = await supabaseAdmin
            .from(this.table)
            .delete()
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Check if ${varName} exists
     */
    async exists(id: string): Promise<boolean> {
        const { count, error } = await supabaseAdmin
            .from(this.table)
            .select('*', { count: 'exact', head: true })
            .eq('id', id);

        if (error) throw error;
        return (count || 0) > 0;
    }
}

// Singleton instance
export const ${varName}Service = new ${modelName}Service();
`;
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    private toSnakeCase(str: string): string {
        return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
    }

    private toKebabCase(str: string): string {
        return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`).replace(/^-/, '');
    }

    private getMigrationTimestamp(): string {
        const now = new Date();
        return now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
    }

    private formatPrismaDefault(value: string | number | boolean, type: string): string {
        if (type === 'boolean') return String(value);
        if (type === 'int' || type === 'float') return String(value);
        if (type === 'datetime' && value === 'now') return 'now()';
        return `"${value}"`;
    }

    private formatSqlDefault(value: string | number | boolean, type: string): string {
        if (type === 'boolean') return value ? 'true' : 'false';
        if (type === 'int' || type === 'float') return String(value);
        return `'${value}'`;
    }

    private getSqlType(type: string): string {
        const map: Record<string, string> = {
            string: 'TEXT',
            int: 'INTEGER',
            float: 'REAL',
            boolean: 'BOOLEAN',
            datetime: 'TIMESTAMP(3)',
            json: 'JSONB',
        };
        return map[type] || 'TEXT';
    }

    private getDrizzleType(type: string): { func: string; import: string } {
        const map: Record<string, { func: string; import: string }> = {
            string: { func: 'text', import: 'text' },
            int: { func: 'integer', import: 'integer' },
            float: { func: 'real', import: 'real' },
            boolean: { func: 'boolean', import: 'boolean' },
            datetime: { func: 'timestamp', import: 'timestamp' },
            json: { func: 'jsonb', import: 'jsonb' },
        };
        return map[type] || { func: 'text', import: 'text' };
    }
}

// ============================================
// FACTORY FUNCTIONS
// ============================================

let generatorInstance: DatabaseCodeGenerator | null = null;

export function getDatabaseCodeGenerator(): DatabaseCodeGenerator {
    if (!generatorInstance) {
        generatorInstance = new DatabaseCodeGenerator();
    }
    return generatorInstance;
}

export function createDatabaseCodeGenerator(config?: Partial<DatabaseConfig>): DatabaseCodeGenerator {
    generatorInstance = new DatabaseCodeGenerator(config);
    return generatorInstance;
}
