/**
 * Service File Generator
 * 
 * Ensures all imported services are actually generated.
 * Scans generated files for service imports and creates missing service files.
 * 
 * Addresses the critical issue where routes import services that don't exist.
 * 
 * Also integrates with ServiceRegistry to use actual code templates for
 * known third-party services (Supabase, Stripe, etc.)
 */

// Define locally to avoid circular imports
export interface GeneratedFile {
    path: string;
    content: string;
    language?: string;
    type?: 'code' | 'config' | 'schema' | 'migration';
}

// ============================================
// TYPES
// ============================================

interface ServiceImport {
    serviceName: string;        // e.g., "AuthService"
    modulePath: string;         // e.g., "services.auth_service" or "./services/auth_service"
    expectedFilePath: string;   // e.g., "services/auth_service.py" or "src/services/authService.ts"
    sourceFile: string;         // Where this import was found
    language: 'typescript' | 'python' | 'go' | 'java' | 'rust';
}

interface MissingServiceAnalysis {
    missing: ServiceImport[];
    existing: ServiceImport[];
    generated: GeneratedFile[];
}

interface ServiceTemplate {
    name: string;
    methods: string[];
    imports: string[];
    baseClass?: string;
}

// ============================================
// COMMON SERVICE PATTERNS
// ============================================

const COMMON_SERVICE_PATTERNS: Record<string, ServiceTemplate> = {
    // Authentication services
    'AuthService': {
        name: 'AuthService',
        methods: ['sign_up', 'sign_in', 'sign_out', 'verify_token', 'refresh_token', 'get_current_user'],
        imports: [],
        baseClass: 'BaseService',
    },
    'JWTService': {
        name: 'JWTService',
        methods: ['create_token', 'verify_token', 'decode_token', 'refresh_token', 'revoke_token'],
        imports: ['jwt', 'datetime'],
    },
    'PasswordService': {
        name: 'PasswordService',
        methods: ['hash_password', 'verify_password', 'generate_reset_token', 'validate_strength'],
        imports: ['bcrypt'],
    },
    'TokenService': {
        name: 'TokenService',
        methods: ['generate', 'validate', 'refresh', 'revoke'],
        imports: [],
    },

    // User services
    'UserService': {
        name: 'UserService',
        methods: ['create', 'get_by_id', 'get_by_email', 'update', 'delete', 'list', 'search'],
        imports: [],
    },

    // Database services
    'DatabaseService': {
        name: 'DatabaseService',
        methods: ['connect', 'disconnect', 'query', 'execute', 'transaction'],
        imports: [],
    },
    'DatabaseClient': {
        name: 'DatabaseClient',
        methods: ['connect', 'disconnect', 'query', 'execute', 'get_session'],
        imports: [],
    },

    // Content services
    'ContentService': {
        name: 'ContentService',
        methods: ['create', 'get', 'update', 'delete', 'list', 'search', 'publish', 'unpublish'],
        imports: [],
    },

    // Email services
    'EmailService': {
        name: 'EmailService',
        methods: ['send', 'send_template', 'send_bulk', 'verify_email', 'send_password_reset'],
        imports: [],
    },

    // Cache services
    'CacheService': {
        name: 'CacheService',
        methods: ['get', 'set', 'delete', 'clear', 'exists', 'get_many', 'set_many'],
        imports: [],
    },

    // Recommendation services
    'RecommendationService': {
        name: 'RecommendationService',
        methods: ['get_recommendations', 'update_preferences', 'train_model', 'evaluate'],
        imports: [],
    },

    // Interaction services
    'InteractionService': {
        name: 'InteractionService',
        methods: ['log_interaction', 'get_history', 'get_analytics', 'track_event'],
        imports: [],
    },

    // Generic CRUD service
    'BaseService': {
        name: 'BaseService',
        methods: ['create', 'get_by_id', 'update', 'delete', 'list'],
        imports: [],
    },
};

// ============================================
// THIRD-PARTY SERVICE MAPPING
// Maps service names to ServiceRegistry IDs
// ============================================

const THIRD_PARTY_SERVICE_MAP: Record<string, { registryId: string; envVars: string[] }> = {
    // Database services
    'SupabaseService': { registryId: 'supabase', envVars: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'] },
    'SupabaseClient': { registryId: 'supabase', envVars: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'] },

    // Payment services
    'StripeService': { registryId: 'stripe', envVars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] },
    'PaymentService': { registryId: 'stripe', envVars: ['STRIPE_SECRET_KEY'] },

    // Email services
    'ResendService': { registryId: 'resend', envVars: ['RESEND_API_KEY'] },
    'EmailService': { registryId: 'resend', envVars: ['RESEND_API_KEY'] },

    // Monitoring
    'SentryService': { registryId: 'sentry', envVars: ['SENTRY_DSN'] },
    'MonitoringService': { registryId: 'sentry', envVars: ['SENTRY_DSN'] },
};

// ============================================
// SERVICE FILE GENERATOR CLASS
// ============================================

export class ServiceFileGenerator {
    private language: 'typescript' | 'python' | 'go' | 'java' | 'rust' = 'typescript';
    private framework: string = 'fastify';

    /**
     * Set the target language for generation
     */
    setLanguage(language: 'typescript' | 'python' | 'go' | 'java' | 'rust'): void {
        this.language = language;
    }

    /**
     * Set the framework for language-specific generation
     */
    setFramework(framework: string): void {
        this.framework = framework;
    }

    /**
     * Analyze files for missing service imports and generate them
     */
    analyzeAndGenerate(files: GeneratedFile[]): MissingServiceAnalysis {
        // Detect language from files
        this.detectLanguage(files);

        // Find all service imports
        const allImports = this.findServiceImports(files);

        // Find which services already exist
        const existingPaths = new Set(files.map(f => f.path.toLowerCase()));

        // Separate missing from existing
        const missing: ServiceImport[] = [];
        const existing: ServiceImport[] = [];

        for (const imp of allImports) {
            const normalizedPath = imp.expectedFilePath.toLowerCase();
            const exists = existingPaths.has(normalizedPath) ||
                existingPaths.has(`src/${normalizedPath}`) ||
                existingPaths.has(normalizedPath.replace('src/', ''));

            if (exists) {
                existing.push(imp);
            } else {
                missing.push(imp);
            }
        }

        // Generate missing service files
        const generated = this.generateMissingServices(missing);

        console.log(`[SERVICE-FILE-GEN] Found ${allImports.length} service imports`);
        console.log(`[SERVICE-FILE-GEN] Existing: ${existing.length}, Missing: ${missing.length}, Generated: ${generated.length}`);

        return { missing, existing, generated };
    }

    /**
     * Detect language from generated files
     */
    private detectLanguage(files: GeneratedFile[]): void {
        const extensions: Record<string, number> = {};

        for (const file of files) {
            const ext = file.path.substring(file.path.lastIndexOf('.'));
            extensions[ext] = (extensions[ext] || 0) + 1;
        }

        // Find most common
        let maxCount = 0;
        let dominantExt = '.ts';

        for (const [ext, count] of Object.entries(extensions)) {
            if (count > maxCount) {
                maxCount = count;
                dominantExt = ext;
            }
        }

        // Map extension to language
        const langMap: Record<string, 'typescript' | 'python' | 'go' | 'java' | 'rust'> = {
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.js': 'typescript',
            '.py': 'python',
            '.go': 'go',
            '.java': 'java',
            '.rs': 'rust',
        };

        this.language = langMap[dominantExt] || 'typescript';

        // Detect framework
        for (const file of files) {
            if (file.content.includes('django') || file.content.includes('DJANGO')) {
                this.framework = 'django';
                break;
            } else if (file.content.includes('from fastapi')) {
                this.framework = 'fastapi';
                break;
            } else if (file.content.includes('from flask')) {
                this.framework = 'flask';
                break;
            } else if (file.content.includes('fastify') || file.content.includes('Fastify')) {
                this.framework = 'fastify';
                break;
            } else if (file.content.includes('express')) {
                this.framework = 'express';
                break;
            }
        }
    }

    /**
     * Find all service imports across files
     */
    private findServiceImports(files: GeneratedFile[]): ServiceImport[] {
        const imports: ServiceImport[] = [];
        const seenServices = new Set<string>();

        for (const file of files) {
            const fileImports = this.extractServiceImportsFromFile(file);

            for (const imp of fileImports) {
                // Deduplicate by service name
                if (!seenServices.has(imp.serviceName)) {
                    seenServices.add(imp.serviceName);
                    imports.push(imp);
                }
            }
        }

        return imports;
    }

    /**
     * Extract service imports from a single file
     */
    private extractServiceImportsFromFile(file: GeneratedFile): ServiceImport[] {
        const imports: ServiceImport[] = [];

        if (this.language === 'python') {
            // Python patterns:
            // from services.auth_service import AuthService
            // from services import auth_service
            // from .services.auth_service import AuthService
            const pythonPatterns = [
                /from\s+(?:\.)?(?:services|app\.services)\.(\w+)\s+import\s+(\w+)/g,
                /from\s+(?:\.)?services\s+import\s+(\w+)/g,
            ];

            for (const pattern of pythonPatterns) {
                let match;
                while ((match = pattern.exec(file.content)) !== null) {
                    const moduleName = match[1];
                    const className = match[2] || this.toPascalCase(moduleName);

                    // Skip standard library or third-party
                    if (this.isPythonThirdParty(moduleName)) continue;

                    imports.push({
                        serviceName: className,
                        modulePath: `services.${moduleName}`,
                        expectedFilePath: `services/${moduleName}.py`,
                        sourceFile: file.path,
                        language: 'python',
                    });
                }
            }
        } else {
            // TypeScript/JavaScript patterns:
            // import { AuthService } from './services/auth';
            // import { AuthService } from '../services/auth.service';
            const tsPatterns = [
                /import\s+\{[^}]*\b(\w+Service)\b[^}]*\}\s+from\s+['"]([^'"]*services[^'"]*)['"]/g,
                /import\s+(\w+Service)\s+from\s+['"]([^'"]*services[^'"]*)['"]/g,
            ];

            for (const pattern of tsPatterns) {
                let match;
                while ((match = pattern.exec(file.content)) !== null) {
                    const serviceName = match[1];
                    const modulePath = match[2];

                    // Skip node_modules
                    if (modulePath.includes('node_modules')) continue;

                    const fileName = this.toKebabCase(serviceName.replace('Service', ''));

                    imports.push({
                        serviceName,
                        modulePath,
                        expectedFilePath: `src/services/${fileName}.service.ts`,
                        sourceFile: file.path,
                        language: 'typescript',
                    });
                }
            }
        }

        return imports;
    }

    /**
     * Generate missing service files
     */
    private generateMissingServices(missing: ServiceImport[]): GeneratedFile[] {
        const generated: GeneratedFile[] = [];

        for (const service of missing) {
            const file = this.generateServiceFile(service);
            if (file) {
                generated.push(file);
            }
        }

        // Also generate __init__.py for Python services directory
        if (this.language === 'python' && generated.length > 0) {
            const initContent = this.generatePythonServicesInit(missing);
            generated.push({
                path: 'services/__init__.py',
                content: initContent,
                language: 'python',
                type: 'code',
            });
        }

        return generated;
    }

    /**
     * Generate a single service file
     */
    private generateServiceFile(service: ServiceImport): GeneratedFile | null {
        const template = COMMON_SERVICE_PATTERNS[service.serviceName];
        const thirdParty = THIRD_PARTY_SERVICE_MAP[service.serviceName];

        // If this is a known third-party service, generate specialized code
        if (thirdParty) {
            return this.generateThirdPartyService(service, thirdParty);
        }

        if (this.language === 'python') {
            return this.generatePythonService(service, template);
        } else {
            return this.generateTypeScriptService(service, template);
        }
    }

    /**
     * Generate third-party service file based on ServiceRegistry templates
     */
    private generateThirdPartyService(
        service: ServiceImport,
        thirdParty: { registryId: string; envVars: string[] }
    ): GeneratedFile {
        if (this.language === 'python') {
            return this.generatePythonThirdPartyService(service, thirdParty.registryId, thirdParty.envVars);
        } else {
            return this.generateTypeScriptThirdPartyService(service, thirdParty.registryId, thirdParty.envVars);
        }
    }

    /**
     * Generate Python third-party service
     */
    private generatePythonThirdPartyService(
        service: ServiceImport,
        registryId: string,
        envVars: string[]
    ): GeneratedFile {
        const className = service.serviceName;
        const envVarsCode = envVars.map(v => `${v} = os.getenv('${v}')`).join('\n');
        const envVarsCheck = envVars.map(v => `        if not ${v}:\n            raise ValueError("Missing required env var: ${v}")`).join('\n');

        // Generate specialized code based on registry ID
        let initCode = '';
        let methods = '';

        switch (registryId) {
            case 'supabase':
                initCode = `from supabase import create_client, Client
        self.client: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)`;
                methods = `
    def query(self, table: str, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Query data from a table"""
        query = self.client.table(table).select('*')
        if filters:
            for key, value in filters.items():
                query = query.eq(key, value)
        response = query.execute()
        return response.data

    def insert(self, table: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Insert data into a table"""
        response = self.client.table(table).insert(data).execute()
        return response.data[0] if response.data else {}

    def update(self, table: str, id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Update data in a table"""
        response = self.client.table(table).update(data).eq('id', id).execute()
        return response.data[0] if response.data else {}

    def delete(self, table: str, id: str) -> bool:
        """Delete data from a table"""
        self.client.table(table).delete().eq('id', id).execute()
        return True

    def get_user(self) -> Optional[Dict[str, Any]]:
        """Get the current authenticated user"""
        user = self.client.auth.get_user()
        return user.user.model_dump() if user.user else None
`;
                break;

            case 'stripe':
                initCode = `import stripe
        stripe.api_key = STRIPE_SECRET_KEY`;
                methods = `
    def create_checkout_session(self, price_id: str, success_url: str, cancel_url: str) -> Dict[str, Any]:
        """Create a Stripe checkout session"""
        session = stripe.checkout.Session.create(
            mode='subscription',
            payment_method_types=['card'],
            line_items=[{'price': price_id, 'quantity': 1}],
            success_url=success_url,
            cancel_url=cancel_url,
        )
        return {'id': session.id, 'url': session.url}

    def create_customer(self, email: str, name: Optional[str] = None) -> Dict[str, Any]:
        """Create a Stripe customer"""
        customer = stripe.Customer.create(email=email, name=name)
        return {'id': customer.id, 'email': customer.email}

    def get_subscription(self, subscription_id: str) -> Dict[str, Any]:
        """Get a subscription by ID"""
        sub = stripe.Subscription.retrieve(subscription_id)
        return {'id': sub.id, 'status': sub.status}
`;
                break;

            case 'resend':
                initCode = `import resend
        resend.api_key = RESEND_API_KEY`;
                methods = `
    def send_email(self, to: str, subject: str, html: str, from_addr: str = 'onboarding@resend.dev') -> Dict[str, Any]:
        """Send an email via Resend"""
        response = resend.Emails.send({
            'from': from_addr,
            'to': to,
            'subject': subject,
            'html': html,
        })
        return {'id': response.get('id'), 'status': 'sent'}

    def send_template(self, to: str, template_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Send a templated email"""
        # Implement template logic here
        logger.info(f"Sending template {template_id} to {to}")
        return {'status': 'sent'}
`;
                break;

            case 'sentry':
                initCode = `import sentry_sdk
        sentry_sdk.init(dsn=SENTRY_DSN, traces_sample_rate=1.0)`;
                methods = `
    def capture_exception(self, error: Exception) -> str:
        """Capture an exception to Sentry"""
        event_id = sentry_sdk.capture_exception(error)
        return event_id or ''

    def capture_message(self, message: str, level: str = 'info') -> str:
        """Capture a message to Sentry"""
        event_id = sentry_sdk.capture_message(message, level=level)
        return event_id or ''

    def set_user(self, user_id: str, email: Optional[str] = None) -> None:
        """Set the current user for Sentry context"""
        sentry_sdk.set_user({'id': user_id, 'email': email})
`;
                break;

            default:
                initCode = `# TODO: Configure ${registryId}`;
                methods = '';
        }

        const content = `"""
${className}
Third-party service wrapper for ${registryId}
Generated by Loveable Backend Orchestrator
"""

from typing import Any, Dict, List, Optional
import os
import logging

logger = logging.getLogger(__name__)

# Environment variables
${envVarsCode}


class ${className}:
    """
    ${className} - Third-party service wrapper for ${registryId}
    """
    
    def __init__(self):
        """Initialize the service"""
${envVarsCheck}
        ${initCode}
        logger.info(f"${className} initialized with ${registryId}")
${methods}
    def __repr__(self) -> str:
        return f"<${className} service=${registryId}>"


# Singleton instance
_instance: Optional[${className}] = None


def get_${this.toSnakeCase(className.replace('Service', '').replace('Client', ''))}_service() -> ${className}:
    """Get the singleton instance of ${className}"""
    global _instance
    if _instance is None:
        _instance = ${className}()
    return _instance
`;

        return {
            path: service.expectedFilePath,
            content,
            language: 'python',
            type: 'code',
        };
    }

    /**
     * Generate TypeScript third-party service
     */
    private generateTypeScriptThirdPartyService(
        service: ServiceImport,
        registryId: string,
        envVars: string[]
    ): GeneratedFile {
        const className = service.serviceName;
        const envVarsCode = envVars.map(v => `const ${v} = process.env.${v}!;`).join('\n');

        let importCode = '';
        let initCode = '';
        let methods = '';

        switch (registryId) {
            case 'supabase':
                importCode = `import { createClient, SupabaseClient } from '@supabase/supabase-js';`;
                initCode = `this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);`;
                methods = `
    async query<T>(table: string, filters?: Record<string, unknown>): Promise<T[]> {
        let query = this.client.from(table).select('*');
        if (filters) {
            for (const [key, value] of Object.entries(filters)) {
                query = query.eq(key, value);
            }
        }
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return data as T[];
    }

    async insert<T>(table: string, data: Partial<T>): Promise<T> {
        const { data: result, error } = await this.client.from(table).insert(data).select().single();
        if (error) throw new Error(error.message);
        return result as T;
    }

    async update<T>(table: string, id: string, data: Partial<T>): Promise<T> {
        const { data: result, error } = await this.client.from(table).update(data).eq('id', id).select().single();
        if (error) throw new Error(error.message);
        return result as T;
    }

    async delete(table: string, id: string): Promise<boolean> {
        const { error } = await this.client.from(table).delete().eq('id', id);
        if (error) throw new Error(error.message);
        return true;
    }
`;
                break;

            case 'stripe':
                importCode = `import Stripe from 'stripe';`;
                initCode = `this.stripe = new Stripe(STRIPE_SECRET_KEY);`;
                methods = `
    async createCheckoutSession(priceId: string, successUrl: string, cancelUrl: string) {
        const session = await this.stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: successUrl,
            cancel_url: cancelUrl,
        });
        return { id: session.id, url: session.url };
    }

    async createCustomer(email: string, name?: string) {
        const customer = await this.stripe.customers.create({ email, name });
        return { id: customer.id, email: customer.email };
    }

    async getSubscription(subscriptionId: string) {
        const sub = await this.stripe.subscriptions.retrieve(subscriptionId);
        return { id: sub.id, status: sub.status };
    }
`;
                break;

            default:
                importCode = `// TODO: Add imports for ${registryId}`;
                initCode = `// TODO: Initialize ${registryId}`;
                methods = '';
        }

        const content = `/**
 * ${className}
 * Third-party service wrapper for ${registryId}
 * Generated by Loveable Backend Orchestrator
 */

${importCode}

${envVarsCode}

export class ${className} {
    private client: unknown;
    private stripe: unknown;
    
    constructor() {
        ${initCode}
        console.log(\`[${className}] Initialized with ${registryId}\`);
    }
${methods}
}

// Singleton instance
let instance: ${className} | null = null;

export function get${className}(): ${className} {
    if (!instance) {
        instance = new ${className}();
    }
    return instance;
}
`;

        return {
            path: service.expectedFilePath,
            content,
            language: 'typescript',
            type: 'code',
        };
    }

    /**
     * Generate Python service file
     */
    private generatePythonService(service: ServiceImport, template?: ServiceTemplate): GeneratedFile {
        const className = service.serviceName;
        const methods = template?.methods || ['create', 'get', 'update', 'delete', 'list'];

        const isDjango = this.framework === 'django';

        let content = `"""
${className}
Generated service for ${service.modulePath}
"""

from typing import Any, Dict, List, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

`;

        if (isDjango) {
            content += `from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist

`;
        }

        content += `class ${className}:
    """
    ${className} - Auto-generated service class
    Provides ${methods.slice(0, 3).join(', ')} operations
    """
    
    def __init__(self):
        """Initialize the service"""
        self._initialized = True
        logger.info(f"${className} initialized")
    
`;

        // Generate methods
        for (const method of methods) {
            const methodName = this.toSnakeCase(method);
            content += this.generatePythonMethod(methodName, className);
        }

        content += `
    def __repr__(self) -> str:
        return f"<${className} initialized={self._initialized}>"


# Singleton instance
_instance: Optional[${className}] = None


def get_${this.toSnakeCase(className.replace('Service', ''))}_service() -> ${className}:
    """Get the singleton instance of ${className}"""
    global _instance
    if _instance is None:
        _instance = ${className}()
    return _instance
`;

        return {
            path: service.expectedFilePath,
            content,
            language: 'python',
            type: 'code',
        };
    }

    /**
     * Generate a Python method stub
     */
    private generatePythonMethod(methodName: string, className: string): string {
        const readMethods = ['get', 'list', 'search', 'find', 'get_by', 'verify', 'validate', 'check'];
        const createMethods = ['create', 'sign_up', 'register', 'add', 'insert'];
        const updateMethods = ['update', 'modify', 'edit', 'patch'];
        const deleteMethods = ['delete', 'remove', 'destroy', 'revoke'];

        let returnType = 'Any';
        let body = 'pass';
        let params = 'self';
        let docstring = '';

        if (readMethods.some(m => methodName.startsWith(m))) {
            if (methodName.includes('list') || methodName.includes('search')) {
                returnType = 'List[Dict[str, Any]]';
                params = 'self, filters: Optional[Dict[str, Any]] = None, limit: int = 100';
                docstring = `Retrieve a list of items with optional filtering`;
                body = `logger.info(f"${className}.${methodName} called")
        # TODO: Implement actual logic
        return []`;
            } else {
                returnType = 'Optional[Dict[str, Any]]';
                params = methodName.includes('id') ? 'self, id: str' : 'self, identifier: str';
                docstring = `Retrieve a single item by identifier`;
                body = `logger.info(f"${className}.${methodName} called with {identifier if 'identifier' in dir() else id}")
        # TODO: Implement actual logic
        return None`;
            }
        } else if (createMethods.some(m => methodName.startsWith(m))) {
            returnType = 'Dict[str, Any]';
            params = 'self, data: Dict[str, Any]';
            docstring = `Create a new item`;
            body = `logger.info(f"${className}.${methodName} called")
        # TODO: Implement actual creation logic
        return {"id": "generated-id", "created_at": datetime.utcnow().isoformat(), **data}`;
        } else if (updateMethods.some(m => methodName.startsWith(m))) {
            returnType = 'Dict[str, Any]';
            params = 'self, id: str, data: Dict[str, Any]';
            docstring = `Update an existing item`;
            body = `logger.info(f"${className}.${methodName} called for {id}")
        # TODO: Implement actual update logic
        return {"id": id, "updated_at": datetime.utcnow().isoformat(), **data}`;
        } else if (deleteMethods.some(m => methodName.startsWith(m))) {
            returnType = 'bool';
            params = 'self, id: str';
            docstring = `Delete an item`;
            body = `logger.info(f"${className}.${methodName} called for {id}")
        # TODO: Implement actual deletion logic
        return True`;
        } else {
            returnType = 'Any';
            params = 'self, *args, **kwargs';
            docstring = `${methodName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} operation`;
            body = `logger.info(f"${className}.${methodName} called")
        # TODO: Implement actual logic
        raise NotImplementedError("${methodName} not yet implemented")`;
        }

        return `    def ${methodName}(${params}) -> ${returnType}:
        """${docstring}"""
        ${body}
    
`;
    }

    /**
     * Generate TypeScript service file
     */
    private generateTypeScriptService(service: ServiceImport, template?: ServiceTemplate): GeneratedFile {
        const className = service.serviceName;
        const methods = template?.methods || ['create', 'findById', 'update', 'delete', 'findAll'];

        let content = `/**
 * ${className}
 * Generated service for ${service.modulePath}
 */

`;

        content += `export interface ${className.replace('Service', '')}Data {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    // TODO: Add specific fields
    [key: string]: unknown;
}

export class ${className} {
    private initialized = false;

    constructor() {
        this.initialized = true;
        console.log(\`[${className}] Service initialized\`);
    }

`;

        // Generate methods
        for (const method of methods) {
            const methodName = this.toCamelCase(method);
            content += this.generateTypeScriptMethod(methodName, className);
        }

        content += `}

// Singleton instance
let instance: ${className} | null = null;

export function get${className}(): ${className} {
    if (!instance) {
        instance = new ${className}();
    }
    return instance;
}
`;

        return {
            path: service.expectedFilePath,
            content,
            language: 'typescript',
            type: 'code',
        };
    }

    /**
     * Generate a TypeScript method stub
     */
    private generateTypeScriptMethod(methodName: string, className: string): string {
        const readMethods = ['get', 'find', 'fetch', 'verify', 'validate', 'check'];
        const createMethods = ['create', 'signUp', 'register', 'add', 'insert'];
        const updateMethods = ['update', 'modify', 'edit', 'patch'];
        const deleteMethods = ['delete', 'remove', 'destroy', 'revoke'];

        let returnType = 'Promise<unknown>';
        let body = '';
        let params = '';

        if (methodName.includes('All') || methodName.includes('List') || methodName.includes('Many')) {
            returnType = `Promise<${className.replace('Service', '')}Data[]>`;
            params = 'filters?: Record<string, unknown>, limit = 100';
            body = `console.log(\`[${className}] ${methodName} called\`);
        // TODO: Implement actual logic
        return [];`;
        } else if (readMethods.some(m => methodName.toLowerCase().startsWith(m))) {
            returnType = `Promise<${className.replace('Service', '')}Data | null>`;
            params = methodName.includes('Id') ? 'id: string' : 'identifier: string';
            body = `console.log(\`[${className}] ${methodName} called with \${id || identifier}\`);
        // TODO: Implement actual logic
        return null;`;
        } else if (createMethods.some(m => methodName.toLowerCase().startsWith(m))) {
            returnType = `Promise<${className.replace('Service', '')}Data>`;
            params = 'data: Partial<' + className.replace('Service', '') + 'Data>';
            body = `console.log(\`[${className}] ${methodName} called\`);
        // TODO: Implement actual creation logic
        return {
            id: 'generated-id',
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
        } as ${className.replace('Service', '')}Data;`;
        } else if (updateMethods.some(m => methodName.toLowerCase().startsWith(m))) {
            returnType = `Promise<${className.replace('Service', '')}Data>`;
            params = 'id: string, data: Partial<' + className.replace('Service', '') + 'Data>';
            body = `console.log(\`[${className}] ${methodName} called for \${id}\`);
        // TODO: Implement actual update logic
        return {
            id,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
        } as ${className.replace('Service', '')}Data;`;
        } else if (deleteMethods.some(m => methodName.toLowerCase().startsWith(m))) {
            returnType = 'Promise<boolean>';
            params = 'id: string';
            body = `console.log(\`[${className}] ${methodName} called for \${id}\`);
        // TODO: Implement actual deletion logic
        return true;`;
        } else {
            returnType = 'Promise<unknown>';
            params = '...args: unknown[]';
            body = `console.log(\`[${className}] ${methodName} called\`);
        // TODO: Implement actual logic
        throw new Error('${methodName} not yet implemented');`;
        }

        return `    async ${methodName}(${params}): ${returnType} {
        ${body}
    }

`;
    }

    /**
     * Generate __init__.py for Python services directory
     */
    private generatePythonServicesInit(services: ServiceImport[]): string {
        const imports: string[] = [];
        const exports: string[] = [];

        for (const service of services) {
            const moduleName = service.expectedFilePath
                .replace('services/', '')
                .replace('.py', '');
            const className = service.serviceName;
            const getterName = `get_${this.toSnakeCase(className.replace('Service', ''))}_service`;

            imports.push(`from .${moduleName} import ${className}, ${getterName}`);
            exports.push(className);
            exports.push(getterName);
        }

        return `"""
Services Package
Auto-generated __init__.py
"""

${imports.join('\n')}

__all__ = [
${exports.map(e => `    "${e}",`).join('\n')}
]
`;
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    private toPascalCase(str: string): string {
        return str
            .split(/[_-]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');
    }

    private toCamelCase(str: string): string {
        const pascal = this.toPascalCase(str);
        return pascal.charAt(0).toLowerCase() + pascal.slice(1);
    }

    private toSnakeCase(str: string): string {
        return str
            .replace(/([A-Z])/g, '_$1')
            .toLowerCase()
            .replace(/^_/, '')
            .replace(/[_-]+/g, '_');
    }

    private toKebabCase(str: string): string {
        return this.toSnakeCase(str).replace(/_/g, '-');
    }

    private isPythonThirdParty(moduleName: string): boolean {
        const thirdParty = [
            'django', 'flask', 'fastapi', 'sqlalchemy', 'pydantic',
            'rest_framework', 'celery', 'redis', 'requests', 'jwt',
            'bcrypt', 'passlib', 'jose', 'uvicorn', 'starlette',
        ];
        return thirdParty.some(tp => moduleName.toLowerCase().startsWith(tp));
    }
}

// ============================================
// SINGLETON
// ============================================

let generatorInstance: ServiceFileGenerator | null = null;

export function getServiceFileGenerator(): ServiceFileGenerator {
    if (!generatorInstance) {
        generatorInstance = new ServiceFileGenerator();
    }
    return generatorInstance;
}

export function createServiceFileGenerator(): ServiceFileGenerator {
    generatorInstance = new ServiceFileGenerator();
    return generatorInstance;
}
