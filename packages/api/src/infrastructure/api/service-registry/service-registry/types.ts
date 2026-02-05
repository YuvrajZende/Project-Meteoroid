/**
 * Service Registry Types
 * Phase 21: Service Integration Framework
 * 
 * Defines all types for the service integration system including:
 * - Service definitions (100+ third-party services)
 * - Credential schemas
 * - User connections
 * - Code templates for AI agents
 */

// ============================================================
// SERVICE CATEGORIES (15 Categories)
// ============================================================

export enum ServiceCategory {
    DATABASE = 'database',
    AUTHENTICATION = 'authentication',
    MONITORING = 'monitoring',
    CICD = 'ci_cd',
    CONTAINER = 'container',
    API_GATEWAY = 'api_gateway',
    STORAGE = 'storage',
    MESSAGING = 'messaging',
    EMAIL = 'email',
    PAYMENT = 'payment',
    SEARCH = 'search',
    AI_ML = 'ai_ml',
    SECRETS = 'secrets',
    FEATURE_FLAGS = 'feature_flags',
    TESTING = 'testing'
}

// Human-readable category labels
export const ServiceCategoryLabels: Record<ServiceCategory, string> = {
    [ServiceCategory.DATABASE]: '🗄️ Database',
    [ServiceCategory.AUTHENTICATION]: '🔐 Authentication',
    [ServiceCategory.MONITORING]: '📊 Monitoring & Observability',
    [ServiceCategory.CICD]: '🚀 CI/CD & Deployment',
    [ServiceCategory.CONTAINER]: '🐳 Containers & Orchestration',
    [ServiceCategory.API_GATEWAY]: '🌐 API Management',
    [ServiceCategory.STORAGE]: '📦 Storage & CDN',
    [ServiceCategory.MESSAGING]: '📨 Messaging & Queues',
    [ServiceCategory.EMAIL]: '✉️ Email & Communication',
    [ServiceCategory.PAYMENT]: '💳 Payments',
    [ServiceCategory.SEARCH]: '🔍 Search & Analytics',
    [ServiceCategory.AI_ML]: '🤖 AI & Machine Learning',
    [ServiceCategory.SECRETS]: '🔑 Secrets Management',
    [ServiceCategory.FEATURE_FLAGS]: '🚩 Feature Flags',
    [ServiceCategory.TESTING]: '🧪 Testing & QA'
};

// ============================================================
// CREDENTIAL TYPES
// ============================================================

export type CredentialType =
    | 'api_key'
    | 'oauth'
    | 'username_password'
    | 'connection_string'
    | 'json'
    | 'token';

export interface CredentialField {
    /** Unique key for this credential field */
    key: string;

    /** Human-readable label */
    label: string;

    /** Type of credential */
    type: CredentialType;

    /** Is this field required? */
    required: boolean;

    /** Should this be masked in UI? */
    sensitive: boolean;

    /** Validation regex pattern */
    validation?: string;

    /** Placeholder text for input */
    placeholder?: string;

    /** Help text for the user */
    description?: string;

    /** Default value (for non-sensitive fields) */
    defaultValue?: string;
}

// ============================================================
// CODE TEMPLATES
// ============================================================

export type SupportedLanguage = 'typescript' | 'javascript' | 'python' | 'go' | 'rust';

export interface CodeTemplate {
    /** Template name (e.g., 'query', 'insert', 'auth-signup') */
    name: string;

    /** What this template does */
    description: string;

    /** Programming language */
    language: SupportedLanguage;

    /** The actual code template with placeholders */
    code: string;

    /** NPM/pip packages required */
    requiredPackages?: string[];

    /** Environment variables used */
    envVars?: string[];
}

// ============================================================
// SERVICE DEFINITION
// ============================================================

export interface ServiceDefinition {
    /** Unique identifier (e.g., 'supabase', 'auth0') */
    id: string;

    /** Display name */
    name: string;

    /** Service category */
    category: ServiceCategory;

    /** Short description */
    description: string;

    /** Link to official documentation */
    documentation: string;

    /** Logo URL or icon identifier */
    logo?: string;

    /** Website URL */
    website?: string;

    /** Required credential fields */
    credentials: CredentialField[];

    /** What the service can do */
    capabilities: string[];

    /** Instructions for AI agents on how to use this service */
    agentInstructions: string;

    /** Code templates for common operations */
    codeTemplates: Record<string, CodeTemplate>;

    /** Is this a free tier available? */
    hasFreeTier?: boolean;

    /** Pricing info URL */
    pricingUrl?: string;

    /** Tags for search */
    tags?: string[];
}

// ============================================================
// USER CONNECTION
// ============================================================

export type ConnectionHealthStatus = 'healthy' | 'unhealthy' | 'unknown';

export interface UserConnection {
    /** UUID from database */
    id: string;

    /** Owner user ID */
    userId: string;

    /** Which service this connects to */
    serviceId: string;

    /** User-friendly name (e.g., "Production DB") */
    connectionName: string;

    /** Decrypted credentials (only in memory, never persisted plain) */
    credentials: Record<string, string>;

    /** Additional metadata */
    metadata: Record<string, unknown>;

    /** Is this connection active? */
    isActive: boolean;

    /** When was this created */
    createdAt: Date;

    /** When was this last updated */
    updatedAt: Date;

    /** Last time this was used for code generation */
    lastUsedAt?: Date;

    /** Last health check timestamp */
    lastHealthCheck?: Date;

    /** Current health status */
    healthStatus: ConnectionHealthStatus;
}

// ============================================================
// CONNECTION MANAGER TYPES
// ============================================================

export interface CreateConnectionInput {
    userId: string;
    serviceId: string;
    connectionName: string;
    credentials: Record<string, string>;
    metadata?: Record<string, unknown>;
}

export interface UpdateConnectionInput {
    connectionName?: string;
    credentials?: Record<string, string>;
    metadata?: Record<string, unknown>;
    isActive?: boolean;
}

export interface ConnectionTestResult {
    success: boolean;
    message: string;
    latencyMs?: number;
    details?: Record<string, unknown>;
}

// ============================================================
// SERVICE USAGE TYPES
// ============================================================

export interface ServiceUsageLog {
    id: string;
    connectionId?: string;
    userId: string;
    serviceId: string;
    operation: string;
    success: boolean;
    durationMs?: number;
    errorMessage?: string;
    requestMetadata?: Record<string, unknown>;
    responseMetadata?: Record<string, unknown>;
    createdAt: Date;
}

export interface ServiceUsageStats {
    serviceId: string;
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    avgDurationMs: number;
    lastUsedAt: Date;
}

// ============================================================
// INTERACTIVE SERVICE SELECTION TYPES
// ============================================================

export interface ServiceQuestion {
    /** Unique question ID */
    id: string;

    /** The question to ask the user */
    question: string;

    /** Which category this question is about */
    category: ServiceCategory;

    /** Is an answer required? */
    required: boolean;

    /** Available options */
    options: ServiceQuestionOption[];
}

export interface ServiceQuestionOption {
    /** Option value (service ID or 'recommend' or 'none') */
    value: string;

    /** Display label */
    label: string;

    /** Is this the "let AI recommend" option? */
    isRecommend: boolean;
}

export interface ServiceSelection {
    /** Selected service ID */
    serviceId: string;

    /** Why this service was selected */
    reason: string;

    /** Was this auto-selected by AI? */
    autoSelected: boolean;
}

// ============================================================
// SETUP GUIDE TYPES
// ============================================================

export interface SetupStep {
    /** Service ID */
    service: string;

    /** Step title */
    title: string;

    /** Detailed instructions */
    instructions: string[];

    /** URL to add connection in dashboard */
    connectUrl: string;

    /** Which credentials are needed */
    requiredCredentials: string[];

    /** Optional video tutorial URL */
    videoTutorial?: string;

    /** Estimated time to complete */
    estimatedTime: string;
}

export interface SetupGuide {
    /** Guide title */
    title: string;

    /** Total estimated time */
    estimatedTime: string;

    /** Steps to complete */
    steps: SetupStep[];

    /** Environment variables needed */
    envVarsNeeded: {
        message: string;
        variables: Array<{ key: string; source: string }>;
    };

    /** Next actions for the user */
    nextSteps: Array<{
        action: string;
        url: string;
        primary: boolean;
    }>;
}

// ============================================================
// REGISTRY TYPES
// ============================================================

export interface RegistryStats {
    totalServices: number;
    byCategory: Record<ServiceCategory, number>;
    lastUpdated: Date;
}

// ============================================================
// ADAPTER TYPES
// ============================================================

export interface AdapterTestResult {
    success: boolean;
    message: string;
    latencyMs?: number;
    version?: string;
    details?: Record<string, unknown>;
}

export interface AdapterCodeGenerationContext {
    operation: string;
    tableName?: string;
    columns?: string;
    filter?: { column: string; value: string };
    limit?: number;
    record?: Record<string, unknown>;
    [key: string]: unknown;
}
