/**
 * Architecture Blueprint Generator - Phase 20
 * 
 * This service generates ASCII art diagrams for backend architecture during the
 * fast model analysis phase. The power model then uses these blueprints to
 * generate consistent, well-structured code.
 * 
 * Benefits:
 * - Clear visual representation of the system
 * - Consistent file structure across projects
 * - Power model has a concrete reference to follow
 * - Reduces ambiguity in code generation
 */

// ============================================
// TYPES
// ============================================

export interface RouteDefinition {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    handler: string;
    middleware?: string[];
    description: string;
}

export interface ServiceDefinition {
    name: string;
    methods: string[];
    dependencies: string[];
    description: string;
}

export interface DatabaseTable {
    name: string;
    columns: Array<{
        name: string;
        type: string;
        constraints?: string[];
    }>;
    relationships?: string[];
}

export interface AgentDefinition {
    id: string;
    name: string;
    capabilities: string[];
    role: 'core' | 'support' | 'integration';
}

export interface MiddlewareDefinition {
    name: string;
    order: number;
    description: string;
}

export interface ArchitectureBlueprint {
    projectName: string;
    description: string;

    // Architecture components
    routes: RouteDefinition[];
    services: ServiceDefinition[];
    database: {
        provider: 'supabase' | 'prisma' | 'drizzle';
        tables: DatabaseTable[];
    };
    agents: AgentDefinition[];
    middleware: MiddlewareDefinition[];

    // File structure
    fileStructure: string[];

    // ASCII art representation
    asciiDiagram: string;

    // Metadata
    complexity: 'simple' | 'moderate' | 'complex';
    estimatedFiles: number;
    techStack: string[];
    timestamp: string;
}

export interface BlueprintRequest {
    prompt: string;
    projectName: string;
    language: string;
    framework: string;
    features: string[];
    includeAuth?: boolean;
    includeDatabase?: boolean;
    includeMonitoring?: boolean;
}

// ============================================
// ASCII TEMPLATES
// ============================================

const HEADER_TEMPLATE = (projectName: string, description: string) => `
+=======================================================================================================================+
|                                                                                                                       |
|                                    🚀 ${projectName.toUpperCase()} - ARCHITECTURE BLUEPRINT                                        |
|                                    ${description.substring(0, 80).padEnd(80)}                                         |
|                                                                                                                       |
+=======================================================================================================================+`;

const API_GATEWAY_TEMPLATE = (port: number) => `
+-----------------------------------------------------------------------------------------------------------------------+
|   🛡️  API GATEWAY (Fastify Server - Port ${port})                                                                      |
|-----------------------------------------------------------------------------------------------------------------------|`;

const MIDDLEWARE_TEMPLATE = (middleware: MiddlewareDefinition[]) => {
    const middlewareList = middleware.map(m => `[ ${m.name} ]`).join('  ');
    return `|   Middleware Layer:                                                                                                   |
|   ${middlewareList.padEnd(117)}|`;
};

const ROUTES_TEMPLATE = (routes: RouteDefinition[]) => {
    let routeStr = '|                                                                                                                       |\n';
    routeStr += '|   Routes:                                                                                                             |\n';

    // Group routes by path prefix
    const grouped: Record<string, RouteDefinition[]> = {};
    for (const route of routes) {
        const prefix = route.path.split('/').slice(0, 3).join('/');
        if (!grouped[prefix]) grouped[prefix] = [];
        grouped[prefix].push(route);
    }

    for (const [prefix, groupRoutes] of Object.entries(grouped)) {
        routeStr += `|   ${prefix}/*                                                                                                         |\n`.substring(0, 121) + '|\n';
        for (const route of groupRoutes.slice(0, 5)) { // Limit to 5 routes per group
            const routeLine = `|   +-- ${route.method.padEnd(6)} ${route.path.padEnd(40)} (${route.description.substring(0, 30)})`;
            routeStr += routeLine.padEnd(120) + '|\n';
        }
        if (groupRoutes.length > 5) {
            routeStr += `|   +-- ... and ${groupRoutes.length - 5} more routes                                                                               |\n`;
        }
    }

    return routeStr;
};

const SERVICES_TEMPLATE = (services: ServiceDefinition[]) => {
    let servicesStr = `
+-----------------------------------------------------------------------------------------------------------------------+
|   ⚙️  SERVICES LAYER                                                                                                   |
|-----------------------------------------------------------------------------------------------------------------------|
|                                                                                                                       |
`;

    // Arrange services in rows of 3
    for (let i = 0; i < services.length; i += 3) {
        const row = services.slice(i, i + 3);
        const boxes = row.map(s => {
            const box = `┌─────────────────────┐
│ ${s.name.substring(0, 19).padEnd(19)} │
│ ${s.methods.slice(0, 2).join(', ').substring(0, 19).padEnd(19)} │
└─────────────────────┘`;
            return box.split('\n');
        });

        // Join boxes horizontally
        for (let j = 0; j < 4; j++) {
            const line = boxes.map(b => b[j] || ''.padEnd(23)).join('    ');
            servicesStr += `|   ${line.padEnd(117)}|\n`;
        }
    }

    return servicesStr;
};

const DATABASE_TEMPLATE = (tables: DatabaseTable[], provider: string) => {
    let dbStr = `
+-----------------------------------------------------------------------------------------------------------------------+
|   💾  DATABASE (${provider.toUpperCase()})                                                                                          |
|-----------------------------------------------------------------------------------------------------------------------|
|                                                                                                                       |
`;

    // Show table names
    const tableNames = tables.map(t => `[ ${t.name} ]`).join('  ');
    dbStr += `|   Tables: ${tableNames.padEnd(109)}|\n`;

    // Show table structure (first 3 tables only)
    for (const table of tables.slice(0, 3)) {
        dbStr += `|                                                                                                                       |\n`;
        dbStr += `|   ${table.name}:                                                                                                       |\n`.substring(0, 121) + '|\n';
        for (const col of table.columns.slice(0, 5)) {
            const constraints = col.constraints ? ` (${col.constraints.join(', ')})` : '';
            dbStr += `|     - ${col.name}: ${col.type}${constraints}                                                                            |\n`.substring(0, 121) + '|\n';
        }
        if (table.columns.length > 5) {
            dbStr += `|     ... and ${table.columns.length - 5} more columns                                                                              |\n`;
        }
    }

    return dbStr;
};

const AGENTS_TEMPLATE = (agents: AgentDefinition[]) => {
    let agentsStr = `
+-----------------------------------------------------------------------------------------------------------------------+
|   🤖  AGENT ECOSYSTEM                                                                                                  |
|-----------------------------------------------------------------------------------------------------------------------|
|                                                                                                                       |
`;

    // Group by role
    const core = agents.filter(a => a.role === 'core');
    const support = agents.filter(a => a.role === 'support');
    const integration = agents.filter(a => a.role === 'integration');

    if (core.length > 0) {
        agentsStr += `|   [ CORE AGENTS ]                                                                                                     |\n`;
        for (const agent of core) {
            agentsStr += `|   - ${agent.name}: ${agent.capabilities.slice(0, 3).join(', ').substring(0, 80).padEnd(80)}                               |\n`.substring(0, 121) + '|\n';
        }
    }

    if (support.length > 0) {
        agentsStr += `|                                                                                                                       |\n`;
        agentsStr += `|   [ SUPPORT AGENTS ]                                                                                                  |\n`;
        for (const agent of support) {
            agentsStr += `|   - ${agent.name}: ${agent.capabilities.slice(0, 3).join(', ').substring(0, 80).padEnd(80)}                               |\n`.substring(0, 121) + '|\n';
        }
    }

    if (integration.length > 0) {
        agentsStr += `|                                                                                                                       |\n`;
        agentsStr += `|   [ INTEGRATION AGENTS ]                                                                                              |\n`;
        for (const agent of integration) {
            agentsStr += `|   - ${agent.name}: ${agent.capabilities.slice(0, 3).join(', ').substring(0, 80).padEnd(80)}                               |\n`.substring(0, 121) + '|\n';
        }
    }

    return agentsStr;
};

const FILE_STRUCTURE_TEMPLATE = (files: string[]) => {
    let fileStr = `
+-----------------------------------------------------------------------------------------------------------------------+
|   📁  FILE STRUCTURE                                                                                                   |
|-----------------------------------------------------------------------------------------------------------------------|
|                                                                                                                       |
`;

    for (const file of files.slice(0, 20)) { // Limit to 20 files
        fileStr += `|   ${file.padEnd(117)}|\n`;
    }

    if (files.length > 20) {
        fileStr += `|   ... and ${files.length - 20} more files                                                                                       |\n`;
    }

    return fileStr;
};

const EXECUTION_FLOW_TEMPLATE = (steps: string[]) => {
    let flowStr = `
+=======================================================================================================================+
|   ⚙️  EXECUTION FLOW                                                                                                   |
+=======================================================================================================================+
|                                                                                                                       |
`;

    for (let i = 0; i < steps.length; i++) {
        flowStr += `|   ${(i + 1).toString().padStart(2)}. ${steps[i].substring(0, 110).padEnd(110)}|\n`;
    }

    flowStr += `|                                                                                                                       |
+=======================================================================================================================+`;

    return flowStr;
};

const FOOTER = `
+=======================================================================================================================+
|                                    📋 Generated by Architecture Blueprint Service                                      |
|                                    💡 Power Model: Use this diagram to generate files                                   |
+=======================================================================================================================+
`;

// ============================================
// ARCHITECTURE BLUEPRINT GENERATOR
// ============================================

export class ArchitectureBlueprintGenerator {
    /**
     * Generate a complete ASCII architecture blueprint from a request
     */
    generateBlueprint(request: BlueprintRequest): ArchitectureBlueprint {
        console.log(`[BLUEPRINT] Generating architecture for: ${request.projectName}`);

        // Extract components based on request
        const routes = this.extractRoutes(request);
        const services = this.extractServices(request);
        const tables = this.extractTables(request);
        const agents = this.extractAgents(request);
        const middleware = this.extractMiddleware(request);
        const fileStructure = this.generateFileStructure(request, routes, services, tables);

        // Determine complexity
        const complexity = this.determineComplexity(routes, services, tables);

        // Generate the ASCII diagram
        const asciiDiagram = this.generateAsciiDiagram({
            projectName: request.projectName,
            description: `${request.framework} Backend - ${request.features.join(', ')}`,
            routes,
            services,
            tables,
            agents,
            middleware,
            fileStructure,
        });

        return {
            projectName: request.projectName,
            description: request.prompt.substring(0, 200),
            routes,
            services,
            database: {
                provider: 'supabase',
                tables,
            },
            agents,
            middleware,
            fileStructure,
            asciiDiagram,
            complexity,
            estimatedFiles: fileStructure.length,
            techStack: [request.language, request.framework, ...request.features],
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Extract routes from the request
     */
    private extractRoutes(request: BlueprintRequest): RouteDefinition[] {
        const routes: RouteDefinition[] = [];

        // Health check (always included)
        routes.push({
            method: 'GET',
            path: '/health',
            handler: 'healthHandler',
            description: 'Health check endpoint',
        });

        // Auth routes
        if (request.includeAuth || request.features.includes('auth') || request.features.includes('authentication')) {
            routes.push(
                { method: 'POST', path: '/api/v1/auth/signup', handler: 'signupHandler', middleware: ['validateBody'], description: 'User registration' },
                { method: 'POST', path: '/api/v1/auth/login', handler: 'loginHandler', middleware: ['validateBody'], description: 'User login' },
                { method: 'POST', path: '/api/v1/auth/logout', handler: 'logoutHandler', middleware: ['requireAuth'], description: 'User logout' },
                { method: 'POST', path: '/api/v1/auth/refresh', handler: 'refreshHandler', description: 'Refresh tokens' },
                { method: 'GET', path: '/api/v1/auth/me', handler: 'getMeHandler', middleware: ['requireAuth'], description: 'Get current user' },
            );
        }

        // Extract entity-based routes from features
        const entityFeatures = request.features.filter(f =>
            !['auth', 'authentication', 'monitoring', 'logging', 'security', 'database'].includes(f.toLowerCase())
        );

        for (const entity of entityFeatures) {
            const entityName = entity.toLowerCase();
            const entityPath = `/api/v1/${entityName}`;

            routes.push(
                { method: 'GET', path: entityPath, handler: `list${entity}Handler`, middleware: ['requireAuth'], description: `List all ${entityName}` },
                { method: 'GET', path: `${entityPath}/:id`, handler: `get${entity}Handler`, middleware: ['requireAuth'], description: `Get ${entityName} by ID` },
                { method: 'POST', path: entityPath, handler: `create${entity}Handler`, middleware: ['requireAuth', 'validateBody'], description: `Create ${entityName}` },
                { method: 'PUT', path: `${entityPath}/:id`, handler: `update${entity}Handler`, middleware: ['requireAuth', 'validateBody'], description: `Update ${entityName}` },
                { method: 'DELETE', path: `${entityPath}/:id`, handler: `delete${entity}Handler`, middleware: ['requireAuth'], description: `Delete ${entityName}` },
            );
        }

        // Monitoring routes
        if (request.includeMonitoring || request.features.includes('monitoring')) {
            routes.push(
                { method: 'GET', path: '/api/v1/metrics', handler: 'metricsHandler', description: 'Get system metrics' },
                { method: 'GET', path: '/api/v1/logs', handler: 'logsHandler', middleware: ['requireAdmin'], description: 'Get system logs' },
            );
        }

        return routes;
    }

    /**
     * Extract services from the request
     */
    private extractServices(request: BlueprintRequest): ServiceDefinition[] {
        const services: ServiceDefinition[] = [];

        // Core service (always included)
        services.push({
            name: 'CoreService',
            methods: ['initialize', 'shutdown', 'getStatus'],
            dependencies: ['DatabaseClient'],
            description: 'Core application service',
        });

        // Auth service
        if (request.includeAuth || request.features.includes('auth')) {
            services.push({
                name: 'AuthService',
                methods: ['signup', 'login', 'logout', 'verifyToken', 'refreshToken'],
                dependencies: ['DatabaseClient', 'JWTService', 'PasswordService'],
                description: 'Authentication and authorization',
            });

            services.push({
                name: 'JWTService',
                methods: ['sign', 'verify', 'decode', 'blacklist'],
                dependencies: [],
                description: 'JWT token management',
            });

            services.push({
                name: 'PasswordService',
                methods: ['hash', 'verify', 'validateStrength'],
                dependencies: [],
                description: 'Password hashing and validation',
            });
        }

        // Database service
        if (request.includeDatabase !== false) {
            services.push({
                name: 'DatabaseClient',
                methods: ['connect', 'disconnect', 'query', 'transaction'],
                dependencies: [],
                description: 'Database connection and queries',
            });
        }

        // Entity services
        const entityFeatures = request.features.filter(f =>
            !['auth', 'authentication', 'monitoring', 'logging', 'security', 'database'].includes(f.toLowerCase())
        );

        for (const entity of entityFeatures) {
            services.push({
                name: `${entity}Service`,
                methods: ['create', 'findById', 'findAll', 'update', 'delete'],
                dependencies: ['DatabaseClient'],
                description: `Manage ${entity.toLowerCase()} entities`,
            });
        }

        // Monitoring service
        if (request.includeMonitoring || request.features.includes('monitoring')) {
            services.push({
                name: 'MonitoringService',
                methods: ['trackMetric', 'getMetrics', 'logEvent', 'alert'],
                dependencies: [],
                description: 'System monitoring and metrics',
            });
        }

        return services;
    }

    /**
     * Extract database tables from the request
     */
    private extractTables(request: BlueprintRequest): DatabaseTable[] {
        const tables: DatabaseTable[] = [];

        // Users table (if auth is included)
        if (request.includeAuth || request.features.includes('auth')) {
            tables.push({
                name: 'users',
                columns: [
                    { name: 'id', type: 'UUID', constraints: ['PRIMARY KEY', 'DEFAULT uuid_generate_v4()'] },
                    { name: 'email', type: 'TEXT', constraints: ['UNIQUE', 'NOT NULL'] },
                    { name: 'password_hash', type: 'TEXT', constraints: ['NOT NULL'] },
                    { name: 'role', type: 'TEXT', constraints: ['DEFAULT \'user\''] },
                    { name: 'created_at', type: 'TIMESTAMPTZ', constraints: ['DEFAULT NOW()'] },
                    { name: 'updated_at', type: 'TIMESTAMPTZ', constraints: ['DEFAULT NOW()'] },
                ],
                relationships: [],
            });

            tables.push({
                name: 'refresh_tokens',
                columns: [
                    { name: 'id', type: 'UUID', constraints: ['PRIMARY KEY'] },
                    { name: 'user_id', type: 'UUID', constraints: ['REFERENCES users(id)'] },
                    { name: 'token_hash', type: 'TEXT', constraints: ['NOT NULL'] },
                    { name: 'expires_at', type: 'TIMESTAMPTZ', constraints: ['NOT NULL'] },
                    { name: 'created_at', type: 'TIMESTAMPTZ', constraints: ['DEFAULT NOW()'] },
                ],
                relationships: ['users'],
            });
        }

        // Entity tables
        const entityFeatures = request.features.filter(f =>
            !['auth', 'authentication', 'monitoring', 'logging', 'security', 'database'].includes(f.toLowerCase())
        );

        for (const entity of entityFeatures) {
            const tableName = entity.toLowerCase() + 's';
            tables.push({
                name: tableName,
                columns: [
                    { name: 'id', type: 'UUID', constraints: ['PRIMARY KEY', 'DEFAULT uuid_generate_v4()'] },
                    { name: 'name', type: 'TEXT', constraints: ['NOT NULL'] },
                    { name: 'data', type: 'JSONB', constraints: ['DEFAULT \'{}\''] },
                    { name: 'user_id', type: 'UUID', constraints: ['REFERENCES users(id)'] },
                    { name: 'created_at', type: 'TIMESTAMPTZ', constraints: ['DEFAULT NOW()'] },
                    { name: 'updated_at', type: 'TIMESTAMPTZ', constraints: ['DEFAULT NOW()'] },
                ],
                relationships: ['users'],
            });
        }

        return tables;
    }

    /**
     * Extract required agents from the request
     */
    private extractAgents(request: BlueprintRequest): AgentDefinition[] {
        const agents: AgentDefinition[] = [];

        // Core agents
        if (request.includeAuth || request.features.includes('auth')) {
            agents.push({
                id: 'auth-agent',
                name: 'Auth Agent',
                capabilities: ['JWT', 'OAuth', 'Password hashing', 'Token refresh'],
                role: 'core',
            });

            agents.push({
                id: 'security-agent',
                name: 'Security Agent',
                capabilities: ['Rate limiting', 'CORS', 'CSRF', 'XSS protection'],
                role: 'core',
            });
        }

        if (request.includeDatabase !== false) {
            agents.push({
                id: 'database-agent',
                name: 'Database Agent',
                capabilities: ['Schema design', 'Migrations', 'Query building'],
                role: 'core',
            });
        }

        if (request.includeMonitoring || request.features.includes('monitoring')) {
            agents.push({
                id: 'monitoring-agent',
                name: 'Monitoring Agent',
                capabilities: ['Metrics', 'Logging', 'Alerting', 'Health checks'],
                role: 'core',
            });
        }

        // Support agents
        agents.push({
            id: 'codegen-agent',
            name: 'CodeGen Agent',
            capabilities: ['Code generation', 'Template rendering', 'File creation'],
            role: 'support',
        });

        agents.push({
            id: 'api-agent',
            name: 'API Agent',
            capabilities: ['Route generation', 'OpenAPI spec', 'Validation'],
            role: 'support',
        });

        return agents;
    }

    /**
     * Extract middleware from the request
     */
    private extractMiddleware(request: BlueprintRequest): MiddlewareDefinition[] {
        const middleware: MiddlewareDefinition[] = [
            { name: 'CORS', order: 1, description: 'Cross-origin resource sharing' },
            { name: 'Helmet', order: 2, description: 'Security headers' },
            { name: 'RateLimit', order: 3, description: 'Request rate limiting' },
        ];

        if (request.includeAuth || request.features.includes('auth')) {
            middleware.push({ name: 'JWTAuth', order: 4, description: 'JWT authentication' });
            middleware.push({ name: 'CSRF', order: 5, description: 'CSRF protection' });
        }

        middleware.push({ name: 'Logging', order: 10, description: 'Request/response logging' });

        return middleware.sort((a, b) => a.order - b.order);
    }

    /**
     * Generate file structure
     */
    private generateFileStructure(
        request: BlueprintRequest,
        routes: RouteDefinition[],
        services: ServiceDefinition[],
        tables: DatabaseTable[]
    ): string[] {
        const files: string[] = [];
        const lang = request.language.toLowerCase();
        const isPython = lang === 'python';
        const ext = isPython ? 'py' : (lang === 'typescript' ? 'ts' : 'js');

        // Root files
        if (isPython) {
            files.push(`📄 requirements.txt`);
            files.push(`📄 setup.py`);
        } else {
            files.push(`📄 package.json`);
            files.push(`📄 tsconfig.json`);
        }
        files.push(`📄 .env.example`);
        files.push(`📄 Dockerfile`);
        files.push(`📄 README.md`);

        // Source structure - Python uses flat or package structure
        if (isPython) {
            files.push(`📄 app.py`);
            files.push(`📄 config.py`);
            files.push(`📁 models/`);
            files.push(`  📄 __init__.py`);
            files.push(`  📄 user.py`);
            files.push(`📁 routes/`);
            files.push(`  📄 __init__.py`);

            // Group routes
            const routePrefixes = [...new Set(routes.map(r => r.path.split('/')[3] || 'health'))];
            for (const prefix of routePrefixes) {
                files.push(`  📄 ${prefix}.py`);
            }

            files.push(`📁 services/`);
            files.push(`  📄 __init__.py`);
            for (const service of services) {
                const fileName = service.name.replace(/Service$/, '').toLowerCase();
                files.push(`  📄 ${fileName}_service.py`);
            }

            files.push(`📁 utils/`);
            files.push(`  📄 __init__.py`);
            files.push(`  📄 auth.py`);
            files.push(`  📄 validators.py`);

            // Database
            if (tables.length > 0) {
                files.push(`📁 migrations/`);
                for (let i = 0; i < tables.length; i++) {
                    files.push(`  📄 ${String(i + 1).padStart(3, '0')}_${tables[i].name}.py`);
                }
            }

            // Tests
            files.push(`📁 tests/`);
            files.push(`  📄 __init__.py`);
            files.push(`  📄 conftest.py`);
            files.push(`  📄 test_health.py`);
        } else {
            // TypeScript/JavaScript structure
            files.push(`📁 src/`);
            files.push(`  📄 index.${ext}`);
            files.push(`  📄 app.${ext}`);

            // Config
            files.push(`  📁 config/`);
            files.push(`    📄 index.${ext}`);
            files.push(`    📄 database.${ext}`);

            // Routes
            files.push(`  📁 routes/`);
            files.push(`    📄 index.${ext}`);

            // Group routes
            const routePrefixes = [...new Set(routes.map(r => r.path.split('/')[3] || 'health'))];
            for (const prefix of routePrefixes) {
                files.push(`    📄 ${prefix}.${ext}`);
            }

            // Services
            files.push(`  📁 services/`);
            files.push(`    📄 index.${ext}`);
            for (const service of services) {
                const fileName = service.name.replace(/Service$/, '').toLowerCase();
                files.push(`    📄 ${fileName}-service.${ext}`);
            }

            // Middleware
            files.push(`  📁 middleware/`);
            files.push(`    📄 index.${ext}`);
            files.push(`    📄 auth.${ext}`);
            files.push(`    📄 error-handler.${ext}`);

            // Types
            files.push(`  📁 types/`);
            files.push(`    📄 index.${ext}`);

            // Database
            if (tables.length > 0) {
                files.push(`  📁 database/`);
                files.push(`    📄 client.${ext}`);
                files.push(`    📁 migrations/`);
                for (let i = 0; i < tables.length; i++) {
                    files.push(`      📄 ${String(i + 1).padStart(3, '0')}_${tables[i].name}.sql`);
                }
            }

            // Tests
            files.push(`  📁 tests/`);
            files.push(`    📄 setup.${ext}`);
            files.push(`    📄 health.test.${ext}`);
        }

        return files;
    }

    /**
     * Determine complexity of the project
     */
    private determineComplexity(
        routes: RouteDefinition[],
        services: ServiceDefinition[],
        tables: DatabaseTable[]
    ): 'simple' | 'moderate' | 'complex' {
        const totalComponents = routes.length + services.length + tables.length;

        if (totalComponents <= 10) return 'simple';
        if (totalComponents <= 25) return 'moderate';
        return 'complex';
    }

    /**
     * Generate the complete ASCII diagram
     */
    private generateAsciiDiagram(config: {
        projectName: string;
        description: string;
        routes: RouteDefinition[];
        services: ServiceDefinition[];
        tables: DatabaseTable[];
        agents: AgentDefinition[];
        middleware: MiddlewareDefinition[];
        fileStructure: string[];
    }): string {
        const parts: string[] = [];

        // Header
        parts.push(HEADER_TEMPLATE(config.projectName, config.description));

        // API Gateway
        parts.push(API_GATEWAY_TEMPLATE(3000));

        // Middleware
        parts.push(MIDDLEWARE_TEMPLATE(config.middleware));

        // Routes
        parts.push(ROUTES_TEMPLATE(config.routes));
        parts.push(`+-----------------------------------------------------------------------------------------------------------------------+`);

        // Services
        parts.push(SERVICES_TEMPLATE(config.services));
        parts.push(`+-----------------------------------------------------------------------------------------------------------------------+`);

        // Database
        if (config.tables.length > 0) {
            parts.push(DATABASE_TEMPLATE(config.tables, 'supabase'));
            parts.push(`+-----------------------------------------------------------------------------------------------------------------------+`);
        }

        // Agents
        parts.push(AGENTS_TEMPLATE(config.agents));
        parts.push(`+-----------------------------------------------------------------------------------------------------------------------+`);

        // File Structure
        parts.push(FILE_STRUCTURE_TEMPLATE(config.fileStructure));
        parts.push(`+-----------------------------------------------------------------------------------------------------------------------+`);

        // Execution Flow
        const executionSteps = [
            'Client sends request to API Gateway (Fastify)',
            'Request passes through Middleware Layer (Auth, CORS, Rate Limit)',
            'Route handler validates request and calls Service',
            'Service processes business logic and queries Database',
            'Response is formatted and sent back to client',
            'Monitoring logs the request/response metrics',
        ];
        parts.push(EXECUTION_FLOW_TEMPLATE(executionSteps));

        // Footer
        parts.push(FOOTER);

        return parts.join('\n');
    }

    /**
     * Parse an existing ASCII diagram to extract architecture
     */
    parseAsciiDiagram(diagram: string): Partial<ArchitectureBlueprint> {
        // Basic parsing - extract key sections
        const routeMatches = diagram.match(/\+-- (GET|POST|PUT|PATCH|DELETE)\s+([^\s]+)\s+\(([^)]+)\)/g);
        const routes: RouteDefinition[] = [];

        if (routeMatches) {
            for (const match of routeMatches) {
                const parts = match.match(/\+-- (GET|POST|PUT|PATCH|DELETE)\s+([^\s]+)\s+\(([^)]+)\)/);
                if (parts) {
                    routes.push({
                        method: parts[1] as RouteDefinition['method'],
                        path: parts[2],
                        handler: 'parsedHandler',
                        description: parts[3],
                    });
                }
            }
        }

        return {
            routes,
            asciiDiagram: diagram,
        };
    }
}

// ============================================
// SINGLETON
// ============================================

let blueprintInstance: ArchitectureBlueprintGenerator | null = null;

export function getArchitectureBlueprintGenerator(): ArchitectureBlueprintGenerator {
    if (!blueprintInstance) {
        blueprintInstance = new ArchitectureBlueprintGenerator();
    }
    return blueprintInstance;
}
