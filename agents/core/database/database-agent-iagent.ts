/**
 * ============================================
 * DATABASE AGENT - IAgent Implementation
 * ============================================
 * 
 * Wrapper that makes DatabaseAgent conform to the IAgent interface
 * for seamless integration with Person 1's orchestrator system.
 * 
 * Following the 7-Layer Feature Integration Guide:
 * Layer 1: SERVICE ✓ (database-agent.ts)
 * Layer 3: INTEGRATION (this file - IAgent wrapper)
 */

import type {
    IAgent,
    AgentConfig,
    AgentInput,
    AgentOutput,
    AgentHealthStatus,
    AgentTier,
} from '@loveable/shared';

import { DatabaseAgent, databaseAgent } from './database-agent.js';
import type {
    ColumnDataType,
    DatabaseGenerationResult,
    RelationshipDefinition,
    SchemaDefinition,
    TableDefinition,
} from './types.js';

/**
 * DatabaseAgentWrapper - Implements IAgent interface
 * This wrapper enables the DatabaseAgent to be discovered and used
 * by Person 1's agent loader and orchestrator.
 */
export class DatabaseAgentWrapper implements IAgent {
    // ========================================
    // REQUIRED: Agent Identity
    // ========================================

    readonly id = 'database-agent';
    readonly name = 'Database Agent';
    readonly tier: AgentTier = 1; // Core agent

    readonly capabilities = [
        // Schema Operations
        'schema-generation',
        'schema-analysis',
        'schema-migration',

        // Prisma Operations
        'prisma-schema',
        'prisma-models',
        'prisma-relations',

        // Supabase Operations
        'supabase-migration',
        'supabase-rls',
        'supabase-policies',

        // Query Operations
        'query-builder',
        'query-optimization',
        'query-parameterization',

        // Data Operations
        'seed-generation',
        'seed-typescript',
        'seed-sql',

        // Performance
        'index-advisor',
        'connection-pool',
        'performance-optimization',

        // Services
        'database-service',
        'crud-operations',
        'pagination',
    ];

    readonly description = 'Generates database schemas, migrations, seeds, and optimized queries for PostgreSQL/Supabase with Prisma ORM support';
    readonly version = '1.0.0';

    // ========================================
    // PRIVATE: Internal state
    // ========================================

    private agent: DatabaseAgent;
    private isInitialized = false;
    private initializationTime?: Date;
    private lastExecutionTime?: Date;
    private successCount = 0;
    private failureCount = 0;

    constructor() {
        this.agent = databaseAgent;
    }

    // ========================================
    // REQUIRED: IAgent Methods
    // ========================================

    /**
     * Initialize the agent
     * Called once when the orchestrator loads the agent
     */
    async initialize(config: AgentConfig): Promise<void> {
        // Inject AI client if provided
        if (config.customSettings?.aiClient) {
            this.agent.setAIClient(config.customSettings.aiClient);
        }

        // Inject metrics service if provided
        if (config.customSettings?.metricsService) {
            this.agent.setMetricsService(config.customSettings.metricsService);
        }

        // Inject cache service if provided
        if (config.customSettings?.cacheService) {
            this.agent.setCacheService(config.customSettings.cacheService);
        }

        this.isInitialized = true;
        this.initializationTime = new Date();
    }

    /**
     * Execute a database task
     * This is the main entry point for agent functionality
     */
    async execute(input: AgentInput): Promise<AgentOutput> {
        const startTime = Date.now();
        try {
            // NOTE: brief's original two-line cast chain ((x as T)?.upstream \n as U)?.[k]
            // is a TS parse error (newline directly before an `as` cast); restructured into
            // equivalent statements without changing semantics.
            const context = input.context as Record<string, unknown> | undefined;
            const analysis = (context?.upstream as Record<string, unknown> | undefined)?.['analysis-agent'] as import('../analysis/types').FrontendAnalysisResult | undefined;
            if (!analysis) {
                return { success: false, error: { code: 'MISSING_UPSTREAM', message: 'database agent requires upstream analysis-agent output' } };
            }

            // --- deterministic mapping: InferredModel[] -> SchemaDefinition ---
            const TYPE_MAP: Record<string, ColumnDataType> = {
                string: 'string', number: 'float', boolean: 'boolean', date: 'datetime',
                array: 'json', object: 'json', enum: 'enum', uuid: 'uuid',
                email: 'string', url: 'string', unknown: 'text',
            };
            const tableName = (m: string) => m.toLowerCase();

            const tables: TableDefinition[] = analysis.dataModels.map(model => ({
                name: tableName(model.name),
                timestamps: true,
                columns: model.fields.map(field => {
                    const pk = field.name === (model.primaryKey ?? 'id');
                    return {
                        name: field.name,
                        type: TYPE_MAP[field.type] ?? 'text',
                        nullable: field.optional === true && !pk,
                        primaryKey: pk,
                        ...(field.type === 'enum' && field.enumValues ? { enumValues: field.enumValues } : {}),
                    };
                }),
            }));

            const relationships: RelationshipDefinition[] = [];
            for (const model of analysis.dataModels) {
                for (const rel of model.relationships) {
                    relationships.push({
                        name: rel.fieldName,
                        type: rel.type,
                        fromTable: tableName(model.name),
                        fromColumn: `${tableName(rel.targetModel)}Id`,
                        toTable: tableName(rel.targetModel),
                        toColumn: 'id',
                    });
                }
            }

            const schema: SchemaDefinition = { tables, relationships };

            // --- deterministic template generation ---
            // VERIFIED ENGINE DEVIATIONS (database-agent.ts):
            // 1. generatePrismaSchema(schema) returns the raw Prisma DDL string, not a
            //    { path, content } file -> we wrap it under 'prisma/schema.prisma' ourselves.
            // 2. The engine derives model names via table.name.slice(0, -1), i.e. it expects
            //    PLURAL table names ('products' -> 'model Product'). Our canonical table names
            //    are singular lowercase ('product'), so we hand the prisma generator a
            //    pluralized view of the SAME canonical schema; query-builder/service files and
            //    metadata.data.schema keep the singular names.
            const prismaView: SchemaDefinition = {
                tables: tables.map(t => ({ ...t, name: `${t.name}s` })),
                relationships: relationships.map(r => ({
                    ...r,
                    fromTable: `${r.fromTable}s`,
                    toTable: `${r.toTable}s`,
                })),
            };

            const files: Array<{ path: string; content: string }> = [
                { path: 'prisma/schema.prisma', content: this.agent.generatePrismaSchema(prismaView) },
            ];
            for (const table of tables) {
                files.push(this.agent.generateQueryBuilder(table));
                files.push(this.agent.generateDatabaseService(table));
            }
            files.push(this.agent.generateConnectionPoolConfig());

            return {
                success: true,
                files: files.map(f => ({ path: f.path, content: f.content, type: 'code' as const, language: 'typescript' })),
                message: `generated ${files.length} database files from ${tables.length} tables`,
                metadata: {
                    executionTime: Date.now() - startTime,
                    data: { schema },
                    dependencies: ['prisma', '@prisma/client'],
                    instructions: ['run: npx prisma generate', 'run: npx prisma migrate dev'],
                },
            };
        } catch (error) {
            return {
                success: false,
                error: { code: 'DATABASE_GENERATION_ERROR', message: error instanceof Error ? error.message : String(error) },
                metadata: { executionTime: Date.now() - startTime },
            };
        }
    }

    /**
     * Health check
     * Returns the current health status of the agent
     */
    async healthCheck(): Promise<AgentHealthStatus> {
        const totalExecutions = this.successCount + this.failureCount;
        const successRate = totalExecutions > 0
            ? (this.successCount / totalExecutions * 100).toFixed(1)
            : 'N/A';

        return {
            healthy: this.isInitialized,
            message: this.isInitialized
                ? `Database Agent is ready (${successRate}% success rate)`
                : 'Database Agent not initialized',
            lastSuccessfulExecution: this.lastExecutionTime,
            details: {
                version: this.version,
                tier: this.tier,
                capabilities: this.capabilities.length,
                initializedAt: this.initializationTime?.toISOString(),
                successCount: this.successCount,
                failureCount: this.failureCount,
                successRate: `${successRate}%`,
                supportedDatabases: ['postgresql', 'supabase'],
                supportedORMs: ['prisma'],
            },
        };
    }

    /**
     * Shutdown
     * Clean up resources when the server is stopping
     */
    async shutdown(): Promise<void> {
        console.log(`🗄️ [${this.name}] Shutting down...`);

        // Log final statistics
        const totalExecutions = this.successCount + this.failureCount;
        console.log(`   Total executions: ${totalExecutions}`);
        console.log(`   Successes: ${this.successCount}`);
        console.log(`   Failures: ${this.failureCount}`);

        this.isInitialized = false;
        console.log(`✅ [${this.name}] Shutdown complete`);
    }

    // ========================================
    // PRIVATE: Helper Methods
    // ========================================

    /**
     * Parse task string to determine what to generate
     */
    private parseTaskOptions(task: string): {
        generateMigration: boolean;
        generateSeeds: boolean;
        generateServices: boolean;
        generatePoolConfig: boolean;
        migrationName?: string;
    } {
        const lowerTask = task.toLowerCase();

        return {
            generateMigration: !lowerTask.includes('no migration') &&
                !lowerTask.includes('skip migration'),
            generateSeeds: lowerTask.includes('seed') ||
                lowerTask.includes('test data') ||
                lowerTask.includes('sample data') ||
                !lowerTask.includes('no seed'),
            generateServices: lowerTask.includes('service') ||
                lowerTask.includes('crud') ||
                lowerTask.includes('api') ||
                !lowerTask.includes('no service'),
            generatePoolConfig: lowerTask.includes('pool') ||
                lowerTask.includes('connection') ||
                lowerTask.includes('performance'),
            migrationName: this.extractMigrationName(task),
        };
    }

    /**
     * Extract migration name from task
     */
    private extractMigrationName(task: string): string {
        // Try to extract meaningful name from task
        const words = task.toLowerCase().split(/\s+/);
        const keyWords = ['user', 'product', 'order', 'post', 'comment', 'project', 'task', 'team'];

        const found = words.find(w => keyWords.some(k => w.includes(k)));
        if (found) {
            return `create_${found}_tables`;
        }

        return 'schema_update';
    }

    /**
     * Generate success message
     */
    private generateSuccessMessage(result: DatabaseGenerationResult): string {
        const fileCounts: Record<string, number> = {};

        for (const file of result.files) {
            fileCounts[file.type] = (fileCounts[file.type] || 0) + 1;
        }

        const parts = Object.entries(fileCounts).map(
            ([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`
        );

        return `Generated ${result.files.length} files: ${parts.join(', ')}`;
    }

    /**
     * Suggest next agents based on task
     */
    private suggestNextAgents(task: string): string[] {
        const suggestions: string[] = [];
        const lowerTask = task.toLowerCase();

        // If generating API-related schema, suggest API agent
        if (lowerTask.includes('api') || lowerTask.includes('endpoint') || lowerTask.includes('rest')) {
            suggestions.push('api-agent');
        }

        // If generating user-related schema, suggest auth agent
        if (lowerTask.includes('user') || lowerTask.includes('auth') || lowerTask.includes('login')) {
            suggestions.push('auth-agent');
        }

        // Always suggest test agent after database work
        suggestions.push('test-agent');

        return suggestions;
    }

    // ========================================
    // PUBLIC: Additional Methods
    // ========================================

    /**
     * Get available templates
     */
    getAvailableTemplates(): string[] {
        return this.agent.getAvailableTemplates();
    }

    /**
     * Get the underlying DatabaseAgent instance
     */
    getAgent(): DatabaseAgent {
        return this.agent;
    }

    /**
     * Get execution statistics
     */
    getStatistics(): {
        successCount: number;
        failureCount: number;
        successRate: string;
        lastExecution?: Date;
    } {
        const totalExecutions = this.successCount + this.failureCount;
        const successRate = totalExecutions > 0
            ? (this.successCount / totalExecutions * 100).toFixed(1) + '%'
            : 'N/A';

        return {
            successCount: this.successCount,
            failureCount: this.failureCount,
            successRate,
            lastExecution: this.lastExecutionTime,
        };
    }
}

// ========================================
// EXPORTS
// ========================================

// Export singleton instance conforming to IAgent
export const databaseAgentIAgent = new DatabaseAgentWrapper();

// Default export for dynamic loading by agent-loader
export default databaseAgentIAgent;
