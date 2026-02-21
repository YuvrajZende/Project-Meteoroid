/**
 * Plugin Registry Service - Phase 28
 * 
 * Backend-aware plugin system that:
 * - Maintains a catalog of all available plugins with required credentials
 * - Validates plugin configurations (field presence & format)
 * - Tests connectivity to external services
 * - Provides structured context for AI code generation
 * - Builds context tree nodes for the TUI
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';

// ============================================
// TYPES
// ============================================

export interface PluginCredentialField {
    key: string;
    label: string;
    type: 'string' | 'url' | 'secret';
    required: boolean;
    placeholder?: string;
    pattern?: string; // regex for validation
}

export interface PluginDefinition {
    id: string;
    name: string;
    category: PluginCategory;
    description: string;
    fields: PluginCredentialField[];
    /** Tags for searchability */
    tags: string[];
    /** Connection test type */
    connectionTest: 'http' | 'tcp' | 'none';
    /** Which field holds the URL/endpoint for connectivity test */
    connectionField?: string;
    /** Code generation hints for the AI */
    codegenHints: {
        packages: string[];
        imports: string[];
        setupSnippet?: string;
        envVars: string[];
    };
}

export type PluginCategory = 'database' | 'security' | 'cicd' | 'monitoring';

export interface PluginConfig {
    pluginId: string;
    name: string;
    category: string;
    config: Record<string, string>;
}

export interface PluginValidationResult {
    valid: boolean;
    pluginId: string;
    errors: string[];
    warnings: string[];
}

export interface PluginConnectionTestResult {
    pluginId: string;
    reachable: boolean;
    latencyMs: number;
    error?: string;
    details?: string;
}

export interface ContextTreeNode {
    label: string;
    tag: string;
    size: string;
    summary: string;
    children?: ContextTreeNode[];
}

export interface PluginContextResult {
    systemPromptSection: string;
    techStack: string[];
    envVars: Record<string, string>;
    packages: Record<string, string[]>;
    contextTree: ContextTreeNode[];
}

// ============================================
// PLUGIN CATALOG
// ============================================

const PLUGIN_CATALOG: PluginDefinition[] = [
    // ---- DATABASE ----
    {
        id: 'supabase', name: 'Supabase', category: 'database',
        description: 'Open-source Firebase alternative with PostgreSQL, Auth, Storage, and Realtime',
        fields: [
            { key: 'url', label: 'Project URL', type: 'url', required: true, placeholder: 'https://xxxxx.supabase.co' },
            { key: 'anon_key', label: 'Anon Key', type: 'secret', required: true },
            { key: 'service_key', label: 'Service Role Key', type: 'secret', required: false },
        ],
        tags: ['postgres', 'auth', 'storage', 'realtime', 'baas'],
        connectionTest: 'http', connectionField: 'url',
        codegenHints: {
            packages: ['@supabase/supabase-js'],
            imports: ["import { createClient } from '@supabase/supabase-js'"],
            envVars: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY'],
            setupSnippet: `const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);`,
        },
    },
    {
        id: 'convex', name: 'Convex', category: 'database',
        description: 'Reactive backend platform with real-time sync, serverless functions, and file storage',
        fields: [
            { key: 'deploy_url', label: 'Deployment URL', type: 'url', required: true, placeholder: 'https://xxxxx.convex.cloud' },
            { key: 'deploy_key', label: 'Deploy Key', type: 'secret', required: true },
        ],
        tags: ['reactive', 'realtime', 'serverless', 'nosql'],
        connectionTest: 'http', connectionField: 'deploy_url',
        codegenHints: {
            packages: ['convex'],
            imports: ["import { ConvexClient } from 'convex/browser'"],
            envVars: ['CONVEX_URL', 'CONVEX_DEPLOY_KEY'],
            setupSnippet: `const convex = new ConvexClient(process.env.CONVEX_URL!);`,
        },
    },
    {
        id: 'postgresql', name: 'PostgreSQL', category: 'database',
        description: 'Advanced open-source relational database with ACID compliance',
        fields: [
            { key: 'connection_url', label: 'Connection URL', type: 'secret', required: true, placeholder: 'postgresql://user:pass@host:5432/db' },
        ],
        tags: ['sql', 'relational', 'acid'],
        connectionTest: 'none',
        codegenHints: {
            packages: ['pg', '@types/pg'],
            imports: ["import { Pool } from 'pg'"],
            envVars: ['DATABASE_URL'],
            setupSnippet: `const pool = new Pool({ connectionString: process.env.DATABASE_URL });`,
        },
    },
    {
        id: 'mongodb', name: 'MongoDB', category: 'database',
        description: 'Document-oriented NoSQL database for high-volume data',
        fields: [
            { key: 'connection_string', label: 'Connection String', type: 'secret', required: true, placeholder: 'mongodb+srv://user:pass@cluster.mongodb.net/db' },
        ],
        tags: ['nosql', 'document', 'atlas'],
        connectionTest: 'none',
        codegenHints: {
            packages: ['mongodb', 'mongoose'],
            imports: ["import mongoose from 'mongoose'"],
            envVars: ['MONGODB_URI'],
            setupSnippet: `await mongoose.connect(process.env.MONGODB_URI!);`,
        },
    },
    {
        id: 'mysql', name: 'MySQL', category: 'database',
        description: 'Popular open-source relational database',
        fields: [
            { key: 'connection_url', label: 'Connection URL', type: 'secret', required: true },
        ],
        tags: ['sql', 'relational'],
        connectionTest: 'none',
        codegenHints: {
            packages: ['mysql2'],
            imports: ["import mysql from 'mysql2/promise'"],
            envVars: ['MYSQL_URL'],
            setupSnippet: `const pool = mysql.createPool(process.env.MYSQL_URL!);`,
        },
    },
    {
        id: 'redis', name: 'Redis', category: 'database',
        description: 'In-memory data structure store, cache, and message broker',
        fields: [
            { key: 'url', label: 'Redis URL', type: 'url', required: true, placeholder: 'redis://localhost:6379' },
            { key: 'password', label: 'Password', type: 'secret', required: false },
        ],
        tags: ['cache', 'pubsub', 'inmemory'],
        connectionTest: 'none',
        codegenHints: {
            packages: ['ioredis'],
            imports: ["import Redis from 'ioredis'"],
            envVars: ['REDIS_URL'],
            setupSnippet: `const redis = new Redis(process.env.REDIS_URL!);`,
        },
    },
    {
        id: 'tigerbeetle', name: 'TigerBeetle', category: 'database',
        description: 'High-performance financial accounting database for OLTP',
        fields: [
            { key: 'cluster_id', label: 'Cluster ID', type: 'string', required: true },
            { key: 'addresses', label: 'Addresses (comma-separated)', type: 'string', required: true },
        ],
        tags: ['financial', 'accounting', 'oltp'],
        connectionTest: 'none',
        codegenHints: {
            packages: ['tigerbeetle-node'],
            imports: ["import { createClient } from 'tigerbeetle-node'"],
            envVars: ['TIGERBEETLE_CLUSTER_ID', 'TIGERBEETLE_ADDRESSES'],
            setupSnippet: `const client = createClient({ cluster_id: BigInt(process.env.TIGERBEETLE_CLUSTER_ID!), replica_addresses: process.env.TIGERBEETLE_ADDRESSES!.split(',') });`,
        },
    },
    {
        id: 'sqlite', name: 'SQLite', category: 'database',
        description: 'Lightweight embedded relational database',
        fields: [
            { key: 'db_path', label: 'Database File Path', type: 'string', required: true, placeholder: './data/app.db' },
        ],
        tags: ['embedded', 'sql', 'file'],
        connectionTest: 'none',
        codegenHints: {
            packages: ['better-sqlite3', '@types/better-sqlite3'],
            imports: ["import Database from 'better-sqlite3'"],
            envVars: ['SQLITE_PATH'],
            setupSnippet: `const db = new Database(process.env.SQLITE_PATH || './data/app.db');`,
        },
    },
    {
        id: 'cockroachdb', name: 'CockroachDB', category: 'database',
        description: 'Distributed SQL for cloud-native resilience',
        fields: [
            { key: 'connection_url', label: 'Connection URL', type: 'secret', required: true },
        ],
        tags: ['distributed', 'sql', 'cloud'],
        connectionTest: 'none',
        codegenHints: {
            packages: ['pg', '@types/pg'],
            imports: ["import { Pool } from 'pg'"],
            envVars: ['COCKROACH_URL'],
            setupSnippet: `const pool = new Pool({ connectionString: process.env.COCKROACH_URL, ssl: { rejectUnauthorized: false } });`,
        },
    },
    {
        id: 'planetscale', name: 'PlanetScale', category: 'database',
        description: 'Serverless MySQL-compatible platform with branching',
        fields: [
            { key: 'host', label: 'Host', type: 'string', required: true },
            { key: 'username', label: 'Username', type: 'string', required: true },
            { key: 'password', label: 'Password', type: 'secret', required: true },
        ],
        tags: ['mysql', 'serverless', 'branching'],
        connectionTest: 'none',
        codegenHints: {
            packages: ['@planetscale/database'],
            imports: ["import { connect } from '@planetscale/database'"],
            envVars: ['PLANETSCALE_HOST', 'PLANETSCALE_USERNAME', 'PLANETSCALE_PASSWORD'],
            setupSnippet: `const conn = connect({ host: process.env.PLANETSCALE_HOST, username: process.env.PLANETSCALE_USERNAME, password: process.env.PLANETSCALE_PASSWORD });`,
        },
    },

    // ---- SECURITY ----
    {
        id: 'oauth2', name: 'OAuth 2.0', category: 'security',
        description: 'Industry-standard authorization framework with provider support',
        fields: [
            { key: 'client_id', label: 'Client ID', type: 'string', required: true },
            { key: 'client_secret', label: 'Client Secret', type: 'secret', required: true },
            { key: 'redirect_url', label: 'Redirect URL', type: 'url', required: true },
        ],
        tags: ['auth', 'oauth', 'social-login'],
        connectionTest: 'none',
        codegenHints: {
            packages: ['passport', 'passport-oauth2'],
            imports: ["import passport from 'passport'", "import { Strategy as OAuth2Strategy } from 'passport-oauth2'"],
            envVars: ['OAUTH_CLIENT_ID', 'OAUTH_CLIENT_SECRET', 'OAUTH_REDIRECT_URL'],
            setupSnippet: `passport.use(new OAuth2Strategy({ clientID: process.env.OAUTH_CLIENT_ID!, clientSecret: process.env.OAUTH_CLIENT_SECRET!, callbackURL: process.env.OAUTH_REDIRECT_URL! }, verify));`,
        },
    },
    {
        id: 'jwt', name: 'JWT Auth', category: 'security',
        description: 'JSON Web Token authentication with signing and verification',
        fields: [
            { key: 'secret', label: 'JWT Secret Key', type: 'secret', required: true },
            { key: 'issuer', label: 'Issuer', type: 'string', required: false },
        ],
        tags: ['auth', 'token', 'stateless'],
        connectionTest: 'none',
        codegenHints: {
            packages: ['jsonwebtoken', '@types/jsonwebtoken'],
            imports: ["import jwt from 'jsonwebtoken'"],
            envVars: ['JWT_SECRET', 'JWT_ISSUER'],
            setupSnippet: `const token = jwt.sign(payload, process.env.JWT_SECRET!, { issuer: process.env.JWT_ISSUER, expiresIn: '24h' });`,
        },
    },
    {
        id: 'apikeys', name: 'API Keys', category: 'security',
        description: 'Key-based API access control with header validation',
        fields: [
            { key: 'header', label: 'Header Name', type: 'string', required: false, placeholder: 'X-API-Key' },
            { key: 'prefix', label: 'Key Prefix', type: 'string', required: false, placeholder: 'mk_' },
        ],
        tags: ['auth', 'apikey', 'header'],
        connectionTest: 'none',
        codegenHints: {
            packages: [],
            imports: [],
            envVars: ['API_KEY_HEADER'],
        },
    },
    {
        id: 'rbac', name: 'RBAC', category: 'security',
        description: 'Role-based access control with permission matrices',
        fields: [],
        tags: ['auth', 'roles', 'permissions'],
        connectionTest: 'none',
        codegenHints: {
            packages: ['casl', '@casl/ability'],
            imports: ["import { AbilityBuilder, createMongoAbility } from '@casl/ability'"],
            envVars: [],
        },
    },
    {
        id: 'encryption', name: 'Encryption', category: 'security',
        description: 'AES-256 data encryption at rest and in transit',
        fields: [
            { key: 'encryption_key', label: 'Encryption Key', type: 'secret', required: true },
        ],
        tags: ['crypto', 'aes', 'security'],
        connectionTest: 'none',
        codegenHints: {
            packages: [],
            imports: ["import crypto from 'crypto'"],
            envVars: ['ENCRYPTION_KEY'],
        },
    },
    {
        id: 'ratelimit', name: 'Rate Limiting', category: 'security',
        description: 'Request throttling and DDoS protection middleware',
        fields: [
            { key: 'max_requests', label: 'Max Requests per Window', type: 'string', required: false, placeholder: '100' },
            { key: 'window_seconds', label: 'Window (seconds)', type: 'string', required: false, placeholder: '60' },
        ],
        tags: ['throttle', 'ddos', 'middleware'],
        connectionTest: 'none',
        codegenHints: {
            packages: ['@fastify/rate-limit'],
            imports: ["import rateLimit from '@fastify/rate-limit'"],
            envVars: ['RATE_LIMIT_MAX', 'RATE_LIMIT_WINDOW'],
        },
    },
    {
        id: 'cors', name: 'CORS', category: 'security',
        description: 'Cross-origin resource sharing configuration',
        fields: [
            { key: 'origins', label: 'Allowed Origins (comma-separated)', type: 'string', required: false, placeholder: 'http://localhost:3000' },
        ],
        tags: ['cors', 'cross-origin', 'middleware'],
        connectionTest: 'none',
        codegenHints: {
            packages: ['@fastify/cors'],
            imports: ["import cors from '@fastify/cors'"],
            envVars: ['CORS_ORIGINS'],
        },
    },
    {
        id: 'helmet', name: 'Helmet', category: 'security',
        description: 'HTTP security headers middleware',
        fields: [],
        tags: ['headers', 'security', 'middleware'],
        connectionTest: 'none',
        codegenHints: {
            packages: ['@fastify/helmet'],
            imports: ["import helmet from '@fastify/helmet'"],
            envVars: [],
        },
    },
    {
        id: 'csrf', name: 'CSRF Protection', category: 'security',
        description: 'Cross-site request forgery prevention tokens',
        fields: [
            { key: 'secret', label: 'CSRF Secret', type: 'secret', required: true },
        ],
        tags: ['csrf', 'token', 'security'],
        connectionTest: 'none',
        codegenHints: {
            packages: ['@fastify/csrf-protection'],
            imports: ["import csrf from '@fastify/csrf-protection'"],
            envVars: ['CSRF_SECRET'],
        },
    },
    {
        id: '2fa', name: '2FA / MFA', category: 'security',
        description: 'Multi-factor authentication with TOTP support',
        fields: [
            { key: 'issuer_name', label: 'Issuer Name', type: 'string', required: false },
        ],
        tags: ['mfa', 'totp', '2fa', 'auth'],
        connectionTest: 'none',
        codegenHints: {
            packages: ['otplib', 'qrcode'],
            imports: ["import { authenticator } from 'otplib'", "import QRCode from 'qrcode'"],
            envVars: ['MFA_ISSUER'],
        },
    },

    // ---- CI/CD ----
    {
        id: 'github-actions', name: 'GitHub Actions', category: 'cicd',
        description: 'GitHub-native CI/CD workflows and automation',
        fields: [
            { key: 'token', label: 'GitHub Token', type: 'secret', required: true },
        ],
        tags: ['ci', 'github', 'automation'],
        connectionTest: 'http', connectionField: undefined, // tested via API
        codegenHints: {
            packages: ['@octokit/rest'],
            imports: ["import { Octokit } from '@octokit/rest'"],
            envVars: ['GITHUB_TOKEN'],
        },
    },
    {
        id: 'gitlab-ci', name: 'GitLab CI', category: 'cicd',
        description: 'GitLab integrated pipeline automation',
        fields: [
            { key: 'token', label: 'GitLab Token', type: 'secret', required: true },
            { key: 'project_id', label: 'Project ID', type: 'string', required: false },
        ],
        tags: ['ci', 'gitlab', 'pipeline'],
        connectionTest: 'none',
        codegenHints: {
            packages: ['@gitbeaker/rest'],
            imports: ["import { Gitlab } from '@gitbeaker/rest'"],
            envVars: ['GITLAB_TOKEN', 'GITLAB_PROJECT_ID'],
        },
    },
    {
        id: 'docker', name: 'Docker', category: 'cicd',
        description: 'Container build, ship, and run platform',
        fields: [
            { key: 'registry_url', label: 'Registry URL', type: 'url', required: false, placeholder: 'https://registry.hub.docker.com' },
            { key: 'username', label: 'Username', type: 'string', required: false },
            { key: 'password', label: 'Password', type: 'secret', required: false },
        ],
        tags: ['container', 'docker', 'registry'],
        connectionTest: 'http', connectionField: 'registry_url',
        codegenHints: {
            packages: [],
            imports: [],
            envVars: ['DOCKER_REGISTRY_URL', 'DOCKER_USERNAME', 'DOCKER_PASSWORD'],
        },
    },
    {
        id: 'kubernetes', name: 'Kubernetes', category: 'cicd',
        description: 'Container orchestration platform',
        fields: [
            { key: 'cluster_url', label: 'Cluster URL', type: 'url', required: true },
            { key: 'token', label: 'Bearer Token', type: 'secret', required: true },
        ],
        tags: ['k8s', 'orchestration', 'container'],
        connectionTest: 'http', connectionField: 'cluster_url',
        codegenHints: {
            packages: ['@kubernetes/client-node'],
            imports: ["import * as k8s from '@kubernetes/client-node'"],
            envVars: ['K8S_CLUSTER_URL', 'K8S_TOKEN'],
        },
    },
    {
        id: 'vercel', name: 'Vercel', category: 'cicd',
        description: 'Frontend deployment and edge functions platform',
        fields: [
            { key: 'token', label: 'Vercel Token', type: 'secret', required: true },
            { key: 'project_id', label: 'Project ID', type: 'string', required: false },
        ],
        tags: ['deploy', 'edge', 'serverless'],
        connectionTest: 'http',
        codegenHints: {
            packages: ['vercel'],
            imports: [],
            envVars: ['VERCEL_TOKEN', 'VERCEL_PROJECT_ID'],
        },
    },

    // ---- MONITORING ----
    {
        id: 'prometheus', name: 'Prometheus', category: 'monitoring',
        description: 'Metrics collection and alerting toolkit',
        fields: [
            { key: 'endpoint', label: 'Scrape Endpoint', type: 'string', required: false, placeholder: '/metrics' },
        ],
        tags: ['metrics', 'alerting', 'timeseries'],
        connectionTest: 'none',
        codegenHints: {
            packages: ['prom-client'],
            imports: ["import client from 'prom-client'"],
            envVars: ['PROMETHEUS_ENDPOINT'],
        },
    },
    {
        id: 'grafana', name: 'Grafana', category: 'monitoring',
        description: 'Observability and dashboard platform',
        fields: [
            { key: 'url', label: 'Grafana URL', type: 'url', required: true },
            { key: 'api_key', label: 'API Key', type: 'secret', required: true },
        ],
        tags: ['dashboard', 'visualization', 'observability'],
        connectionTest: 'http', connectionField: 'url',
        codegenHints: {
            packages: [],
            imports: [],
            envVars: ['GRAFANA_URL', 'GRAFANA_API_KEY'],
        },
    },
    {
        id: 'datadog', name: 'Datadog', category: 'monitoring',
        description: 'Cloud-scale monitoring and analytics',
        fields: [
            { key: 'api_key', label: 'API Key', type: 'secret', required: true },
            { key: 'app_key', label: 'App Key', type: 'secret', required: false },
        ],
        tags: ['apm', 'monitoring', 'logs'],
        connectionTest: 'http',
        codegenHints: {
            packages: ['dd-trace'],
            imports: ["import tracer from 'dd-trace'"],
            envVars: ['DD_API_KEY', 'DD_APP_KEY'],
            setupSnippet: `tracer.init({ service: 'my-app', env: process.env.NODE_ENV });`,
        },
    },
    {
        id: 'sentry', name: 'Sentry', category: 'monitoring',
        description: 'Error tracking and performance monitoring',
        fields: [
            { key: 'dsn', label: 'Sentry DSN', type: 'secret', required: true, placeholder: 'https://xxx@xxx.ingest.sentry.io/xxx' },
        ],
        tags: ['errors', 'performance', 'tracing'],
        connectionTest: 'none',
        codegenHints: {
            packages: ['@sentry/node'],
            imports: ["import * as Sentry from '@sentry/node'"],
            envVars: ['SENTRY_DSN'],
            setupSnippet: `Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 1.0 });`,
        },
    },
    {
        id: 'newrelic', name: 'New Relic', category: 'monitoring',
        description: 'Full-stack observability platform',
        fields: [
            { key: 'license_key', label: 'License Key', type: 'secret', required: true },
        ],
        tags: ['apm', 'observability', 'fullstack'],
        connectionTest: 'none',
        codegenHints: {
            packages: ['newrelic'],
            imports: ["import 'newrelic'"],
            envVars: ['NEW_RELIC_LICENSE_KEY', 'NEW_RELIC_APP_NAME'],
        },
    },
    {
        id: 'elk', name: 'ELK Stack', category: 'monitoring',
        description: 'Elasticsearch, Logstash, Kibana logging suite',
        fields: [
            { key: 'es_url', label: 'Elasticsearch URL', type: 'url', required: true, placeholder: 'http://localhost:9200' },
            { key: 'api_key', label: 'API Key', type: 'secret', required: false },
        ],
        tags: ['logging', 'elasticsearch', 'kibana'],
        connectionTest: 'http', connectionField: 'es_url',
        codegenHints: {
            packages: ['@elastic/elasticsearch'],
            imports: ["import { Client } from '@elastic/elasticsearch'"],
            envVars: ['ELASTICSEARCH_URL', 'ELASTICSEARCH_API_KEY'],
            setupSnippet: `const esClient = new Client({ node: process.env.ELASTICSEARCH_URL! });`,
        },
    },
];

// ============================================
// PLUGIN REGISTRY SERVICE
// ============================================

let instance: PluginRegistryService | null = null;

export class PluginRegistryService {
    private catalog: Map<string, PluginDefinition>;
    private readonly _activeConfigs: Map<string, PluginConfig> = new Map();

    constructor() {
        this.catalog = new Map();
        for (const plugin of PLUGIN_CATALOG) {
            this.catalog.set(plugin.id, plugin);
        }
    }

    // --- Catalog ---

    getCatalog(): PluginDefinition[] {
        return Array.from(this.catalog.values());
    }

    getCatalogByCategory(): Record<string, PluginDefinition[]> {
        const result: Record<string, PluginDefinition[]> = {};
        for (const p of this.catalog.values()) {
            if (!result[p.category]) result[p.category] = [];
            result[p.category].push(p);
        }
        return result;
    }

    getPlugin(id: string): PluginDefinition | undefined {
        return this.catalog.get(id);
    }

    // --- Validation ---

    validateConfig(pluginId: string, config: Record<string, string>): PluginValidationResult {
        const plugin = this.catalog.get(pluginId);
        if (!plugin) {
            return { valid: false, pluginId, errors: [`Unknown plugin: ${pluginId}`], warnings: [] };
        }

        const errors: string[] = [];
        const warnings: string[] = [];

        for (const field of plugin.fields) {
            const value = config[field.key];

            if (field.required && (!value || value.trim() === '')) {
                errors.push(`Missing required field: ${field.label} (${field.key})`);
                continue;
            }

            if (!value || value.trim() === '') continue;

            // URL validation
            if (field.type === 'url') {
                try {
                    new URL(value);
                } catch {
                    errors.push(`Invalid URL for ${field.label}: ${value}`);
                }
            }

            // Pattern validation
            if (field.pattern) {
                const regex = new RegExp(field.pattern);
                if (!regex.test(value)) {
                    errors.push(`${field.label} does not match expected pattern`);
                }
            }

            // Secret length checks
            if (field.type === 'secret' && value.length < 8) {
                warnings.push(`${field.label} seems too short (${value.length} chars)`);
            }
        }

        return { valid: errors.length === 0, pluginId, errors, warnings };
    }

    validateAllConfigs(configs: PluginConfig[]): { valid: boolean; results: PluginValidationResult[] } {
        const results = configs.map(c => {
            // Try to find plugin by ID or name
            const pluginId = this.resolvePluginId(c.pluginId || c.name);
            return this.validateConfig(pluginId, c.config);
        });
        return {
            valid: results.every(r => r.valid),
            results,
        };
    }

    // --- Connection Testing ---

    async testConnection(pluginId: string, config: Record<string, string>): Promise<PluginConnectionTestResult> {
        const plugin = this.catalog.get(pluginId);
        if (!plugin) {
            return { pluginId, reachable: false, latencyMs: 0, error: `Unknown plugin: ${pluginId}` };
        }

        if (plugin.connectionTest === 'none') {
            return { pluginId, reachable: true, latencyMs: 0, details: 'No connectivity test available for this service' };
        }

        // Get URL to test
        let testUrl: string | undefined;
        if (plugin.connectionField) {
            testUrl = config[plugin.connectionField];
        }

        // Special cases
        if (pluginId === 'github-actions') {
            testUrl = 'https://api.github.com';
        } else if (pluginId === 'datadog') {
            testUrl = 'https://api.datadoghq.com/api/v1/validate';
        } else if (pluginId === 'vercel') {
            testUrl = 'https://api.vercel.com/v2/user';
        }

        if (!testUrl) {
            return { pluginId, reachable: false, latencyMs: 0, error: 'No URL configured for connectivity test' };
        }

        return this.httpPing(pluginId, testUrl);
    }

    async testAllConnections(configs: PluginConfig[]): Promise<PluginConnectionTestResult[]> {
        const results: PluginConnectionTestResult[] = [];
        for (const c of configs) {
            const pluginId = this.resolvePluginId(c.pluginId || c.name);
            const result = await this.testConnection(pluginId, c.config);
            results.push(result);
        }
        return results;
    }

    // --- Context Building (for AI code generation) ---

    buildPluginContext(configs: PluginConfig[]): PluginContextResult {
        const techStack: string[] = [];
        const envVars: Record<string, string> = {};
        const packages: Record<string, string[]> = {};
        const contextNodes: ContextTreeNode[] = [];
        const promptSections: string[] = [];

        for (const c of configs) {
            const pluginId = this.resolvePluginId(c.pluginId || c.name);
            const plugin = this.catalog.get(pluginId);
            if (!plugin) continue;

            techStack.push(plugin.name);

            // Collect packages
            if (plugin.codegenHints.packages.length > 0) {
                packages[plugin.name] = plugin.codegenHints.packages;
            }

            // Map config values to env vars
            for (let i = 0; i < plugin.fields.length && i < plugin.codegenHints.envVars.length; i++) {
                const field = plugin.fields[i];
                const envVar = plugin.codegenHints.envVars[i];
                if (c.config[field.key]) {
                    if (field.type === 'secret') {
                        envVars[envVar] = '<configured>';
                    } else {
                        envVars[envVar] = c.config[field.key];
                    }
                }
            }

            // Build prompt section
            let section = `- ${plugin.name} (${plugin.category}): ${plugin.description}`;
            if (plugin.codegenHints.packages.length > 0) {
                section += `\n  Packages: ${plugin.codegenHints.packages.join(', ')}`;
            }
            if (plugin.codegenHints.imports.length > 0) {
                section += `\n  Imports: ${plugin.codegenHints.imports.join('; ')}`;
            }
            if (plugin.codegenHints.setupSnippet) {
                section += `\n  Setup: ${plugin.codegenHints.setupSnippet}`;
            }
            if (plugin.codegenHints.envVars.length > 0) {
                section += `\n  Env vars: ${plugin.codegenHints.envVars.join(', ')}`;
            }
            promptSections.push(section);

            // Build context tree node
            const configuredFields = plugin.fields.filter(f => c.config[f.key] && c.config[f.key].trim() !== '').length;
            const totalFields = plugin.fields.length;
            const nodeSize = `${(JSON.stringify(c).length / 1024).toFixed(1)} KB`;

            contextNodes.push({
                label: plugin.name,
                tag: plugin.category,
                size: nodeSize,
                summary: `${plugin.description}\n${configuredFields}/${totalFields} fields configured | Packages: ${plugin.codegenHints.packages.join(', ') || 'none'}`,
            });
        }

        // Build system prompt section
        let systemPromptSection = '';
        if (promptSections.length > 0) {
            systemPromptSection = `
ACTIVE PLUGIN CONFIGURATION (Use these specific services in your code generation):
==================================================================================
${promptSections.join('\n\n')}
==================================================================================

IMPORTANT INSTRUCTIONS FOR CODE GENERATION:
- Use ONLY the packages and imports listed above for the configured services
- Reference the environment variables listed above (do NOT hardcode credentials)
- Include setup/initialization code using the patterns shown
- Generate .env.example with all required environment variables
- If a database plugin is configured, use THAT specific database (not a generic one)
- If a security plugin is configured, implement THAT specific auth strategy
`;
        }

        return {
            systemPromptSection,
            techStack,
            envVars,
            packages,
            contextTree: contextNodes,
        };
    }

    // --- Build Full Context Tree (for TUI response) ---

    buildResponseContextTree(
        input: {
            prompt: string;
            intentAnalysis?: { intent: string; language: string; framework: string; confidence: number; reasoning: string };
            vectorUsed: boolean;
            pluginConfigs: PluginConfig[];
            agentsExecuted: string[];
            generatedCode: Array<{ subtask: string; code: string; explanation: string }>;
        }
    ): ContextTreeNode[] {
        const nodes: ContextTreeNode[] = [];

        // Intent node
        if (input.intentAnalysis) {
            const ia = input.intentAnalysis;
            nodes.push({
                label: 'Intent Analysis',
                tag: 'INTENT',
                size: `${(JSON.stringify(ia).length / 1024).toFixed(1)} KB`,
                summary: `Intent: ${ia.intent} | ${ia.language}/${ia.framework} | ${(ia.confidence * 100).toFixed(0)}% confidence\n${ia.reasoning}`,
            });
        }

        // Vector node
        if (input.vectorUsed) {
            nodes.push({
                label: 'Vector Learning Context',
                tag: 'VECTOR',
                size: '~4.0 KB',
                summary: 'Similar projects matched from vector knowledge base.\nBest practices and code patterns injected into generation.',
            });
        }

        // Plugins node
        if (input.pluginConfigs.length > 0) {
            const pluginChildren: ContextTreeNode[] = [];
            for (const c of input.pluginConfigs) {
                const pluginId = this.resolvePluginId(c.pluginId || c.name);
                const plugin = this.catalog.get(pluginId);
                const configuredCount = Object.keys(c.config).filter(k => c.config[k] && c.config[k].trim() !== '').length;
                pluginChildren.push({
                    label: plugin?.name || c.name,
                    tag: c.category || plugin?.category || 'plugin',
                    size: `${(JSON.stringify(c).length / 1024).toFixed(1)} KB`,
                    summary: `${plugin?.description || 'Configured plugin'}\n${configuredCount} credential fields set | Packages: ${plugin?.codegenHints.packages.join(', ') || 'n/a'}`,
                });
            }
            nodes.push({
                label: 'Active Plugin Context',
                tag: 'PLUGINS',
                size: `${(pluginChildren.reduce((s, c) => s + parseFloat(c.size), 0)).toFixed(1)} KB`,
                summary: `${input.pluginConfigs.length} plugins providing infrastructure context and code patterns.`,
                children: pluginChildren,
            });
        }

        // Agents node
        if (input.agentsExecuted.length > 0) {
            nodes.push({
                label: 'Agent Execution',
                tag: 'AGENTS',
                size: '~0.5 KB',
                summary: `Agents: ${input.agentsExecuted.join(', ')}\n${input.agentsExecuted.length} agents executed in pipeline.`,
            });
        }

        // Output node
        if (input.generatedCode.length > 0) {
            const codeChildren: ContextTreeNode[] = [];
            let totalSize = 0;
            for (const c of input.generatedCode) {
                const sz = (c.code?.length || 0);
                totalSize += sz;
                codeChildren.push({
                    label: c.subtask,
                    tag: 'file',
                    size: `${(sz / 1024).toFixed(1)} KB`,
                    summary: c.explanation?.substring(0, 120) || 'Generated code',
                });
            }
            nodes.push({
                label: 'Generated Output',
                tag: 'OUTPUT',
                size: `${(totalSize / 1024).toFixed(1)} KB`,
                summary: `${input.generatedCode.length} code blocks generated.`,
                children: codeChildren,
            });
        }

        return nodes;
    }

    // --- Helpers ---

    private resolvePluginId(nameOrId: string): string {
        // Direct ID match
        if (this.catalog.has(nameOrId)) return nameOrId;

        // Name match (case-insensitive)
        const lower = nameOrId.toLowerCase().replace(/[\s\/]/g, '-');
        for (const [id, plugin] of this.catalog) {
            if (plugin.name.toLowerCase().replace(/[\s\/]/g, '-') === lower) return id;
            if (id === lower) return id;
        }

        // Partial match
        for (const [id, plugin] of this.catalog) {
            if (plugin.name.toLowerCase().includes(lower) || lower.includes(id)) return id;
        }

        return nameOrId; // fallback
    }

    private async httpPing(pluginId: string, url: string): Promise<PluginConnectionTestResult> {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const timeout = 5000;

            try {
                const parsedUrl = new URL(url);
                const lib = parsedUrl.protocol === 'https:' ? https : http;

                const req = lib.request(
                    {
                        hostname: parsedUrl.hostname,
                        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                        path: parsedUrl.pathname || '/',
                        method: 'HEAD',
                        timeout,
                    },
                    (res) => {
                        const latency = Date.now() - startTime;
                        resolve({
                            pluginId,
                            reachable: true,
                            latencyMs: latency,
                            details: `HTTP ${res.statusCode} in ${latency}ms`,
                        });
                    }
                );

                req.on('error', (err) => {
                    resolve({
                        pluginId,
                        reachable: false,
                        latencyMs: Date.now() - startTime,
                        error: err.message,
                    });
                });

                req.on('timeout', () => {
                    req.destroy();
                    resolve({
                        pluginId,
                        reachable: false,
                        latencyMs: timeout,
                        error: `Connection timed out after ${timeout}ms`,
                    });
                });

                req.end();
            } catch (err: any) {
                resolve({
                    pluginId,
                    reachable: false,
                    latencyMs: 0,
                    error: err.message || 'Invalid URL',
                });
            }
        });
    }
}

// Singleton
export function getPluginRegistry(): PluginRegistryService {
    if (!instance) {
        instance = new PluginRegistryService();
    }
    return instance;
}
