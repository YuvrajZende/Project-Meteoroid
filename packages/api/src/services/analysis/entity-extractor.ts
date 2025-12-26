/**
 * Entity Extractor Service
 * Phase 24: Context Management System
 * 
 * Extracts domain entities from user prompts BEFORE code generation.
 * This ensures the system knows exactly what entities to generate.
 */

import { getAIClient, type AIClient } from '../infrastructure/ai-client.js';
import { getRobustJSONParser } from './robust-json-parser.js';

// ============================================
// TYPES
// ============================================

export interface EntityProperty {
    name: string;
    type: string;
    required: boolean;
    description?: string;
}

export interface EntityRelationship {
    targetEntity: string;
    type: 'one-to-one' | 'one-to-many' | 'many-to-many';
    fieldName: string;
    description?: string;
}

export interface ExtractedEntity {
    name: string;
    type: 'model' | 'service' | 'controller' | 'utility';
    description: string;
    properties: EntityProperty[];
    relationships: EntityRelationship[];
}

export interface ExtractedFeatures {
    authentication: boolean;
    realTime: boolean;
    fileUpload: boolean;
    payments: boolean;
    notifications: boolean;
    search: boolean;
    analytics: boolean;
    rateLimit: boolean;
    custom: string[];
}

export interface ExtractedIntegrations {
    database: 'postgresql' | 'mysql' | 'mongodb' | 'sqlite' | 'none';
    cache: 'redis' | 'memcached' | 'none';
    queue: 'rabbitmq' | 'kafka' | 'redis' | 'none';
    storage: 's3' | 'cloudinary' | 'local' | 'none';
    email: 'sendgrid' | 'ses' | 'smtp' | 'none';
    websocket: boolean;
    custom: string[];
}

export interface EntityExtractionResult {
    success: boolean;
    entities: ExtractedEntity[];
    features: ExtractedFeatures;
    integrations: ExtractedIntegrations;
    projectType: 'api' | 'fullstack' | 'microservice' | 'cli' | 'library';
    summary: string;
    extractionTime: number;
    error?: string;
}

export interface EntityExtractorConfig {
    /** AI model for extraction */
    model: string;
    /** Max tokens for response */
    maxTokens: number;
    /** Temperature for extraction */
    temperature: number;
}

// ============================================
// ENTITY EXTRACTOR SERVICE
// ============================================

export class EntityExtractorService {
    private config: EntityExtractorConfig;
    private aiClient: AIClient;
    private initialized = false;

    constructor(config?: Partial<EntityExtractorConfig>) {
        this.config = {
            model: config?.model || process.env.FAST_MODEL || 'glm-4-flash',
            maxTokens: config?.maxTokens || 2000,
            temperature: config?.temperature || 0.3, // Low temp for accurate extraction
        };
        this.aiClient = getAIClient();
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;
    }

    /**
     * Extract entities from a user prompt
     * This is the main method - call before code generation
     */
    async extract(prompt: string): Promise<EntityExtractionResult> {
        const startTime = Date.now();
        console.log('[ENTITY-EXTRACTOR] Starting entity extraction...');

        try {
            const extractionPrompt = this.buildExtractionPrompt(prompt);

            // Call AI to extract entities
            const response = await this.aiClient.chat([
                {
                    role: 'system',
                    content: 'You are an expert software architect. Extract domain entities, features, and integrations from user requirements. Return ONLY valid JSON.',
                },
                {
                    role: 'user',
                    content: extractionPrompt,
                },
            ], {
                maxTokens: this.config.maxTokens,
                temperature: this.config.temperature,
            });

            // Parse the response
            const parser = getRobustJSONParser();
            const parseResult = parser.parse<{
                entities: ExtractedEntity[];
                features: Partial<ExtractedFeatures>;
                integrations: Partial<ExtractedIntegrations>;
                projectType: string;
                summary: string;
            }>(response);

            if (!parseResult.success || !parseResult.data) {
                console.warn('[ENTITY-EXTRACTOR] Failed to parse AI response, using fallback extraction');
                return this.fallbackExtraction(prompt, startTime);
            }

            const data = parseResult.data;
            const extractionTime = Date.now() - startTime;

            console.log(`[ENTITY-EXTRACTOR] Extracted ${data.entities?.length || 0} entities in ${extractionTime}ms`);

            return {
                success: true,
                entities: this.normalizeEntities(data.entities || []),
                features: this.normalizeFeatures(data.features || {}),
                integrations: this.normalizeIntegrations(data.integrations || {}),
                projectType: this.normalizeProjectType(data.projectType),
                summary: data.summary || 'Extracted entities from prompt',
                extractionTime,
            };
        } catch (error) {
            console.error('[ENTITY-EXTRACTOR] Extraction failed:', error);
            return this.fallbackExtraction(prompt, startTime);
        }
    }

    /**
     * Build the extraction prompt
     */
    private buildExtractionPrompt(userPrompt: string): string {
        return `
Analyze this software requirement and extract all domain entities, features, and integrations.

USER REQUIREMENT:
"""
${userPrompt}
"""

Extract and return as JSON with this EXACT structure:
{
  "entities": [
    {
      "name": "EntityName",
      "type": "model",
      "description": "What this entity represents",
      "properties": [
        { "name": "id", "type": "string", "required": true, "description": "Unique identifier" },
        { "name": "createdAt", "type": "datetime", "required": true, "description": "Creation timestamp" }
      ],
      "relationships": [
        { "targetEntity": "OtherEntity", "type": "one-to-many", "fieldName": "items", "description": "Related items" }
      ]
    }
  ],
  "features": {
    "authentication": true,
    "realTime": false,
    "fileUpload": false,
    "payments": false,
    "notifications": false,
    "search": false,
    "analytics": false,
    "rateLimit": true,
    "custom": []
  },
  "integrations": {
    "database": "postgresql",
    "cache": "none",
    "queue": "none",
    "storage": "none",
    "email": "none",
    "websocket": false,
    "custom": []
  },
  "projectType": "api",
  "summary": "Brief description of what this project does"
}

RULES:
1. Extract ALL entities mentioned or implied in the requirement
2. For a chat app: User, Room, Message, RoomMember
3. For an e-commerce: User, Product, Order, OrderItem, Cart
4. For a blog: User, Post, Comment, Category, Tag
5. Always include standard properties: id, createdAt, updatedAt
6. Detect relationships between entities
7. Identify required features (auth, real-time, etc.)
8. Return ONLY the JSON, no explanation

JSON:`;
    }

    /**
     * Fallback extraction using keyword analysis
     */
    private fallbackExtraction(prompt: string, startTime: number): EntityExtractionResult {
        console.log('[ENTITY-EXTRACTOR] Using fallback keyword extraction');

        const lowerPrompt = prompt.toLowerCase();
        const entities: ExtractedEntity[] = [];
        const features: ExtractedFeatures = this.getDefaultFeatures();
        const integrations: ExtractedIntegrations = this.getDefaultIntegrations();

        // Detect common entity patterns
        const entityPatterns = [
            { keywords: ['user', 'account', 'profile'], entity: this.createUserEntity() },
            { keywords: ['chat', 'message', 'conversation'], entity: this.createMessageEntity() },
            { keywords: ['room', 'channel', 'group'], entity: this.createRoomEntity() },
            { keywords: ['post', 'article', 'blog'], entity: this.createPostEntity() },
            { keywords: ['comment', 'reply'], entity: this.createCommentEntity() },
            { keywords: ['product', 'item', 'goods'], entity: this.createProductEntity() },
            { keywords: ['order', 'purchase', 'transaction'], entity: this.createOrderEntity() },
            { keywords: ['cart', 'basket'], entity: this.createCartEntity() },
        ];

        for (const pattern of entityPatterns) {
            if (pattern.keywords.some(k => lowerPrompt.includes(k))) {
                entities.push(pattern.entity);
            }
        }

        // Detect features
        if (lowerPrompt.includes('auth') || lowerPrompt.includes('login') || lowerPrompt.includes('register')) {
            features.authentication = true;
        }
        if (lowerPrompt.includes('real-time') || lowerPrompt.includes('realtime') || lowerPrompt.includes('websocket') || lowerPrompt.includes('live')) {
            features.realTime = true;
            integrations.websocket = true;
        }
        if (lowerPrompt.includes('upload') || lowerPrompt.includes('file') || lowerPrompt.includes('image')) {
            features.fileUpload = true;
        }
        if (lowerPrompt.includes('payment') || lowerPrompt.includes('stripe') || lowerPrompt.includes('checkout')) {
            features.payments = true;
        }
        if (lowerPrompt.includes('notification') || lowerPrompt.includes('alert') || lowerPrompt.includes('push')) {
            features.notifications = true;
        }
        if (lowerPrompt.includes('search') || lowerPrompt.includes('filter') || lowerPrompt.includes('query')) {
            features.search = true;
        }

        // Always add User entity if auth is detected
        if (features.authentication && !entities.find(e => e.name === 'User')) {
            entities.unshift(this.createUserEntity());
        }

        // Determine project type
        let projectType: EntityExtractionResult['projectType'] = 'api';
        if (lowerPrompt.includes('frontend') || lowerPrompt.includes('fullstack')) {
            projectType = 'fullstack';
        } else if (lowerPrompt.includes('microservice') || lowerPrompt.includes('service')) {
            projectType = 'microservice';
        } else if (lowerPrompt.includes('cli') || lowerPrompt.includes('command line')) {
            projectType = 'cli';
        }

        return {
            success: true,
            entities,
            features,
            integrations,
            projectType,
            summary: `Extracted ${entities.length} entities using keyword analysis`,
            extractionTime: Date.now() - startTime,
        };
    }

    // ============================================
    // ENTITY TEMPLATES
    // ============================================

    private createUserEntity(): ExtractedEntity {
        return {
            name: 'User',
            type: 'model',
            description: 'System user account',
            properties: [
                { name: 'id', type: 'uuid', required: true, description: 'Unique identifier' },
                { name: 'email', type: 'string', required: true, description: 'User email' },
                { name: 'username', type: 'string', required: false, description: 'Display name' },
                { name: 'passwordHash', type: 'string', required: true, description: 'Hashed password' },
                { name: 'createdAt', type: 'datetime', required: true, description: 'Account creation time' },
                { name: 'updatedAt', type: 'datetime', required: true, description: 'Last update time' },
            ],
            relationships: [],
        };
    }

    private createMessageEntity(): ExtractedEntity {
        return {
            name: 'Message',
            type: 'model',
            description: 'Chat message',
            properties: [
                { name: 'id', type: 'uuid', required: true, description: 'Unique identifier' },
                { name: 'content', type: 'text', required: true, description: 'Message content' },
                { name: 'senderId', type: 'uuid', required: true, description: 'Sender user ID' },
                { name: 'roomId', type: 'uuid', required: false, description: 'Room ID if in a room' },
                { name: 'createdAt', type: 'datetime', required: true, description: 'Send time' },
            ],
            relationships: [
                { targetEntity: 'User', type: 'many-to-many', fieldName: 'sender', description: 'Message sender' },
                { targetEntity: 'Room', type: 'many-to-many', fieldName: 'room', description: 'Room this message belongs to' },
            ],
        };
    }

    private createRoomEntity(): ExtractedEntity {
        return {
            name: 'Room',
            type: 'model',
            description: 'Chat room or channel',
            properties: [
                { name: 'id', type: 'uuid', required: true, description: 'Unique identifier' },
                { name: 'name', type: 'string', required: true, description: 'Room name' },
                { name: 'description', type: 'string', required: false, description: 'Room description' },
                { name: 'isPrivate', type: 'boolean', required: true, description: 'Whether room is private' },
                { name: 'createdById', type: 'uuid', required: true, description: 'Creator user ID' },
                { name: 'createdAt', type: 'datetime', required: true, description: 'Creation time' },
            ],
            relationships: [
                { targetEntity: 'User', type: 'many-to-many', fieldName: 'members', description: 'Room members' },
                { targetEntity: 'Message', type: 'one-to-many', fieldName: 'messages', description: 'Messages in room' },
            ],
        };
    }

    private createPostEntity(): ExtractedEntity {
        return {
            name: 'Post',
            type: 'model',
            description: 'Blog post or article',
            properties: [
                { name: 'id', type: 'uuid', required: true, description: 'Unique identifier' },
                { name: 'title', type: 'string', required: true, description: 'Post title' },
                { name: 'content', type: 'text', required: true, description: 'Post content' },
                { name: 'slug', type: 'string', required: true, description: 'URL slug' },
                { name: 'published', type: 'boolean', required: true, description: 'Publish status' },
                { name: 'authorId', type: 'uuid', required: true, description: 'Author user ID' },
                { name: 'createdAt', type: 'datetime', required: true, description: 'Creation time' },
                { name: 'publishedAt', type: 'datetime', required: false, description: 'Publish time' },
            ],
            relationships: [
                { targetEntity: 'User', type: 'many-to-many', fieldName: 'author', description: 'Post author' },
                { targetEntity: 'Comment', type: 'one-to-many', fieldName: 'comments', description: 'Post comments' },
            ],
        };
    }

    private createCommentEntity(): ExtractedEntity {
        return {
            name: 'Comment',
            type: 'model',
            description: 'Comment on a post',
            properties: [
                { name: 'id', type: 'uuid', required: true, description: 'Unique identifier' },
                { name: 'content', type: 'text', required: true, description: 'Comment content' },
                { name: 'authorId', type: 'uuid', required: true, description: 'Author user ID' },
                { name: 'postId', type: 'uuid', required: true, description: 'Parent post ID' },
                { name: 'createdAt', type: 'datetime', required: true, description: 'Creation time' },
            ],
            relationships: [
                { targetEntity: 'User', type: 'many-to-many', fieldName: 'author', description: 'Comment author' },
                { targetEntity: 'Post', type: 'many-to-many', fieldName: 'post', description: 'Parent post' },
            ],
        };
    }

    private createProductEntity(): ExtractedEntity {
        return {
            name: 'Product',
            type: 'model',
            description: 'Product for sale',
            properties: [
                { name: 'id', type: 'uuid', required: true, description: 'Unique identifier' },
                { name: 'name', type: 'string', required: true, description: 'Product name' },
                { name: 'description', type: 'text', required: false, description: 'Product description' },
                { name: 'price', type: 'decimal', required: true, description: 'Price in cents' },
                { name: 'stock', type: 'integer', required: true, description: 'Stock quantity' },
                { name: 'imageUrl', type: 'string', required: false, description: 'Product image' },
                { name: 'createdAt', type: 'datetime', required: true, description: 'Creation time' },
            ],
            relationships: [],
        };
    }

    private createOrderEntity(): ExtractedEntity {
        return {
            name: 'Order',
            type: 'model',
            description: 'Customer order',
            properties: [
                { name: 'id', type: 'uuid', required: true, description: 'Unique identifier' },
                { name: 'userId', type: 'uuid', required: true, description: 'Customer user ID' },
                { name: 'status', type: 'string', required: true, description: 'Order status' },
                { name: 'totalAmount', type: 'decimal', required: true, description: 'Total in cents' },
                { name: 'createdAt', type: 'datetime', required: true, description: 'Order time' },
            ],
            relationships: [
                { targetEntity: 'User', type: 'many-to-many', fieldName: 'user', description: 'Customer' },
            ],
        };
    }

    private createCartEntity(): ExtractedEntity {
        return {
            name: 'Cart',
            type: 'model',
            description: 'Shopping cart',
            properties: [
                { name: 'id', type: 'uuid', required: true, description: 'Unique identifier' },
                { name: 'userId', type: 'uuid', required: true, description: 'Owner user ID' },
                { name: 'createdAt', type: 'datetime', required: true, description: 'Creation time' },
            ],
            relationships: [
                { targetEntity: 'User', type: 'one-to-one', fieldName: 'user', description: 'Cart owner' },
            ],
        };
    }

    // ============================================
    // NORMALIZERS
    // ============================================

    private normalizeEntities(entities: unknown[]): ExtractedEntity[] {
        if (!Array.isArray(entities)) return [];

        return entities
            .filter((e): e is Record<string, unknown> => e !== null && typeof e === 'object')
            .map(e => ({
                name: String(e.name || 'Unknown'),
                type: this.normalizeEntityType(e.type),
                description: String(e.description || ''),
                properties: this.normalizeProperties(e.properties),
                relationships: this.normalizeRelationships(e.relationships),
            }));
    }

    private normalizeEntityType(type: unknown): ExtractedEntity['type'] {
        const validTypes = ['model', 'service', 'controller', 'utility'];
        return validTypes.includes(String(type)) ? String(type) as ExtractedEntity['type'] : 'model';
    }

    private normalizeProperties(props: unknown): EntityProperty[] {
        if (!Array.isArray(props)) return [];

        return props
            .filter((p): p is Record<string, unknown> => p !== null && typeof p === 'object')
            .map(p => ({
                name: String(p.name || 'unknown'),
                type: String(p.type || 'string'),
                required: Boolean(p.required),
                description: p.description ? String(p.description) : undefined,
            }));
    }

    private normalizeRelationships(rels: unknown): EntityRelationship[] {
        if (!Array.isArray(rels)) return [];

        return rels
            .filter((r): r is Record<string, unknown> => r !== null && typeof r === 'object')
            .map(r => ({
                targetEntity: String(r.targetEntity || r.target || 'Unknown'),
                type: this.normalizeRelationType(r.type),
                fieldName: String(r.fieldName || r.field || 'relation'),
                description: r.description ? String(r.description) : undefined,
            }));
    }

    private normalizeRelationType(type: unknown): EntityRelationship['type'] {
        const validTypes = ['one-to-one', 'one-to-many', 'many-to-many'];
        return validTypes.includes(String(type)) ? String(type) as EntityRelationship['type'] : 'one-to-many';
    }

    private normalizeFeatures(features: Partial<ExtractedFeatures>): ExtractedFeatures {
        const defaults = this.getDefaultFeatures();
        return {
            authentication: features.authentication ?? defaults.authentication,
            realTime: features.realTime ?? defaults.realTime,
            fileUpload: features.fileUpload ?? defaults.fileUpload,
            payments: features.payments ?? defaults.payments,
            notifications: features.notifications ?? defaults.notifications,
            search: features.search ?? defaults.search,
            analytics: features.analytics ?? defaults.analytics,
            rateLimit: features.rateLimit ?? defaults.rateLimit,
            custom: Array.isArray(features.custom) ? features.custom : [],
        };
    }

    private normalizeIntegrations(integrations: Partial<ExtractedIntegrations>): ExtractedIntegrations {
        const defaults = this.getDefaultIntegrations();
        return {
            database: integrations.database || defaults.database,
            cache: integrations.cache || defaults.cache,
            queue: integrations.queue || defaults.queue,
            storage: integrations.storage || defaults.storage,
            email: integrations.email || defaults.email,
            websocket: integrations.websocket ?? defaults.websocket,
            custom: Array.isArray(integrations.custom) ? integrations.custom : [],
        };
    }

    private normalizeProjectType(type: unknown): EntityExtractionResult['projectType'] {
        const validTypes = ['api', 'fullstack', 'microservice', 'cli', 'library'];
        return validTypes.includes(String(type)) ? String(type) as EntityExtractionResult['projectType'] : 'api';
    }

    private getDefaultFeatures(): ExtractedFeatures {
        return {
            authentication: false,
            realTime: false,
            fileUpload: false,
            payments: false,
            notifications: false,
            search: false,
            analytics: false,
            rateLimit: true,
            custom: [],
        };
    }

    private getDefaultIntegrations(): ExtractedIntegrations {
        return {
            database: 'postgresql',
            cache: 'none',
            queue: 'none',
            storage: 'none',
            email: 'none',
            websocket: false,
            custom: [],
        };
    }
}

// ============================================
// SINGLETON
// ============================================

let instance: EntityExtractorService | null = null;

export function getEntityExtractor(): EntityExtractorService {
    if (!instance) {
        instance = new EntityExtractorService();
    }
    return instance;
}
