# 🔧 Developer Guide: How to Add New Services

This guide will show you how to add new third-party services to the Service Integration Framework.

---

## Overview

Adding a new service involves **3 main steps**:

1. **Define the service** (metadata, credentials, templates)
2. **Create an adapter** (test connection, generate code)
3. **Register** the adapter and service

**Time to add a service:** ~30-60 minutes

---

## Step 1: Define the Service

Create a new file in `packages/api/src/services/service-registry/services/`

### Example: Adding MongoDB

Create `mongodb.ts`:

```typescript
import { ServiceDefinition, ServiceCategory } from '../types.js';

export const mongodbService: ServiceDefinition = {
    id: 'mongodb',
    name: 'MongoDB',
    category: ServiceCategory.DATABASE,
    description: 'NoSQL document database with flexible schema',
    documentation: 'https://www.mongodb.com/docs/',
    website: 'https://www.mongodb.com',
    logo: 'https://www.mongodb.com/assets/images/global/favicon.ico',
    
    // Required credentials
    credentials: [
        {
            key: 'connectionString',
            label: 'Connection String',
            type: 'password',
            required: true,
            description: 'MongoDB connection string (MongoDB Atlas or self-hosted)',
            placeholder: 'mongodb+srv://username:password@cluster.mongodb.net/database',
        },
    ],
    
    // What this service can do
    capabilities: [
        'Document storage',
        'Full-text search',
        'Aggregation pipelines',
        'Transactions',
        'Geospatial queries',
        'Time series data',
    ],
    
    // Instructions for AI to generate code
    agentInstructions: `
## MongoDB Integration

**Package:** \`mongodb\` (npm)

**Client Setup:**
\`\`\`typescript
import { MongoClient } from 'mongodb';

const client = new MongoClient(process.env.MONGODB_CONNECTION_STRING);
await client.connect();
const db = client.db('yourDatabaseName');
\`\`\`

**Best Practices:**
- Use connection pooling (built-in with MongoClient)
- Always close connections when done
- Use indexes for frequently queried fields
- Handle errors gracefully

**Common Patterns:**
- Find documents: \`db.collection('users').find({ status: 'active' }).toArray()\`
- Insert: \`db.collection('users').insertOne({ name: 'John', email: 'john@example.com' })\`
- Update: \`db.collection('users').updateOne({ _id }, { $set: { status: 'inactive' } })\`
- Delete: \`db.collection('users').deleteOne({ _id })\`
    `,
    
    // Code templates
    codeTemplates: {
        'client-setup': {
            name: 'MongoDB Client Setup',
            description: 'Initialize MongoDB client connection',
            language: 'typescript',
            code: `
import { MongoClient, Db } from 'mongodb';

const connectionString = process.env.MONGODB_CONNECTION_STRING;
if (!connectionString) {
    throw new Error('MONGODB_CONNECTION_STRING is not defined');
}

const client = new MongoClient(connectionString);

export async function connectToDatabase(): Promise<Db> {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    return client.db(); // Uses database from connection string
}

export function getDatabase(): Db {
    return client.db();
}

export async function closeDatabaseConnection(): Promise<void> {
    await client.close();
    console.log('🔌 MongoDB connection closed');
}
            `,
            requiredPackages: ['mongodb'],
            envVars: ['MONGODB_CONNECTION_STRING'],
        },
        
        'find-documents': {
            name: 'Find Documents',
            description: 'Query documents from a collection',
            language: 'typescript',
            code: `
import { getDatabase } from './mongodb-client.js';

export async function find{{CollectionName}}(filter: any = {}) {
    const db = getDatabase();
    const collection = db.collection('{{collectionName}}');
    
    const documents = await collection.find(filter).toArray();
    return documents;
}

// Example usage:
// const users = await findUsers({ status: 'active' });
            `,
            requiredPackages: ['mongodb'],
        },
        
        'insert-document': {
            name: 'Insert Document',
            description: 'Insert a new document into collection',
            language: 'typescript',
            code: `
import { getDatabase } from './mongodb-client.js';

export async function create{{ModelName}}(data: any) {
    const db = getDatabase();
    const collection = db.collection('{{collectionName}}');
    
    const result = await collection.insertOne({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
    });
    
    return {
        _id: result.insertedId,
        ...data,
    };
}

// Example usage:
// const user = await createUser({ name: 'John', email: 'john@example.com' });
            `,
            requiredPackages: ['mongodb'],
        },
    },
    
    // Tags for search
    tags: ['database', 'nosql', 'document', 'mongodb', 'atlas'],
    
    // Pricing info
    pricing: {
        free: true,
        freeTier: 'MongoDB Atlas: 512MB storage',
        paidPlans: 'Starting at $0.08/hour',
    },
    
    // Setup complexity
    setupComplexity: 'medium',
    setupTime: '5 minutes',
};
```

---

## Step 2: Create the Adapter

Create a new file in `packages/api/src/services/adapters/database/`

### Example: MongoDB Adapter

Create `mongodb-adapter.ts`:

```typescript
import { BaseAdapter } from '../base-adapter.js';
import {
    AdapterTestResult,
    AdapterCodeGenerationContext,
    CodeTemplate,
} from '../../service-registry/types.js';
import { mongodbService } from '../../service-registry/services/mongodb.js';

export class MongoDBAdapter extends BaseAdapter {
    constructor() {
        super('mongodb');
    }

    /**
     * Test the MongoDB connection
     */
    async test(credentials: Record<string, string>): Promise<AdapterTestResult> {
        try {
            const { MongoClient } = await import('mongodb');
            const { connectionString } = credentials;

            if (!connectionString) {
                return {
                    success: false,
                    message: 'Connection string is required',
                };
            }

            // Try to connect
            const client = new MongoClient(connectionString);
            const startTime = Date.now();
            
            await client.connect();
            await client.db().admin().ping(); // Test connection
            
            const latency = Date.now() - startTime;
            
            // Get server info
            const serverInfo = await client.db().admin().serverInfo();
            
            await client.close();

            return {
                success: true,
                message: 'Successfully connected to MongoDB',
                latencyMs: latency,
                version: serverInfo.version,
                details: {
                    database: client.db().databaseName,
                },
            };
        } catch (error: any) {
            return {
                success: false,
                message: `MongoDB connection failed: ${error.message}`,
                details: {
                    error: error.message,
                },
            };
        }
    }

    /**
     * Generate code template based on operation
     */
    generateCodeTemplate(
        operation: string,
        context: AdapterCodeGenerationContext
    ): string {
        const templates = this.getCodeTemplates();
        
        switch (operation) {
            case 'find':
            case 'select':
                return this.generateFindCode(context);
                
            case 'insert':
            case 'create':
                return this.generateInsertCode(context);
                
            case 'update':
                return this.generateUpdate Code(context);
                
            case 'delete':
                return this.generateDeleteCode(context);
                
            default:
                return templates['client-setup']?.code || '';
        }
    }

    /**
     * Get all code templates
     */
    getCodeTemplates(): Record<string, CodeTemplate> {
        return mongodbService.codeTemplates;
    }

    /**
     * Get agent instructions
     */
    getAgentInstructions(): string {
        return mongodbService.agentInstructions;
    }

    /**
     * Get environment variable names
     */
    getEnvVarNames(): string[] {
        return ['MONGODB_CONNECTION_STRING'];
    }

    // Private helper methods
    private generateFindCode(context: AdapterCodeGenerationContext): string {
        const collection = context.tableName || 'items';
        const filter = context.filter || {};
        
        return `
import { getDatabase } from './mongodb-client.js';

export async function find${this.capitalize(collection)}(filter = ${JSON.stringify(filter)}) {
    const db = getDatabase();
    const collection = db.collection('${collection}');
    const documents = await collection.find(filter).toArray();
    return documents;
}
        `.trim();
    }

    private generateInsertCode(context: AdapterCodeGenerationContext): string {
        const collection = context.tableName || 'items';
        const record = context.record || {};
        
        return `
import { getDatabase } from './mongodb-client';

export async function create${this.capitalize(collection.slice(0, -1))}(data: any) {
    const db = getDatabase();
    const collection = db.collection('${collection}');
    
    const result = await collection.insertOne({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
    });
    
    return { _id: result.insertedId, ...data };
}
        `.trim();
    }

    private generateUpdateCode(context: AdapterCodeGenerationContext): string {
        const collection = context.tableName || 'items';
        
        return `
import { getDatabase } from './mongodb-client.js';
import { ObjectId } from 'mongodb';

export async function update${this.capitalize(collection.slice(0, -1))}(id: string, updates: any) {
    const db = getDatabase();
    const collection = db.collection('${collection}');
    
    const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { ...updates, updatedAt: new Date() } }
    );
    
    return result.modifiedCount > 0;
}
        `.trim();
    }

    private generateDeleteCode(context: AdapterCodeGenerationContext): string {
        const collection = context.tableName || 'items';
        
        return `
import { getDatabase } from './mongodb-client.js';
import { ObjectId } from 'mongodb';

export async function delete${this.capitalize(collection.slice(0, -1))}(id: string) {
    const db = getDatabase();
    const collection = db.collection('${collection}');
    
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
}
        `.trim();
    }

    private capitalize(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}
```

---

## Step 3: Register the Service

### 3.1 Add to Service Index

Edit `packages/api/src/services/service-registry/services/index.ts`:

```typescript
export { mongodbService } from './mongodb.js';

// In getDefaultServices()
export function getDefaultServices(): ServiceDefinition[] {
    return [
        supabaseService,
        sentryService,
        githubActionsService,
        resendService,
        stripeService,
        mongodbService,  // Add here
    ];
}
```

### 3.2 Register the Adapter

Edit `packages/api/src/services/adapters/adapter-factory.ts`:

```typescript
import { MongoDBAdapter } from './database/mongodb-adapter.js';

// In adapter registry
const adapterRegistry: Map<string, BaseAdapter> = new Map();

export function initializeAdapters(): void {
    adapterRegistry.set('supabase', new SupabaseAdapter());
    adapterRegistry.set('sentry', new SentryAdapter());
    adapterRegistry.set('mongodb', new MongoDBAdapter());  // Add here
    // ... other adapters
}
```

---

## Step 4: Test Your Service

### 4.1 Start the Server

```bash
cd packages/api
npm run dev
```

### 4.2 Check Service is Registered

```bash
curl http://localhost:3000/api/v1/services/mongodb
```

Expected response:
```json
{
  "success": true,
  "service": {
    "id": "mongodb",
    "name": "MongoDB",
    "category": "database",
    ...
  }
}
```

### 4.3 Create a Test Connection

```bash
curl -X POST http://localhost:3000/api/v1/connections \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "serviceId": "mongodb",
    "connectionName": "Test MongoDB",
    "credentials": {
      "connectionString": "mongodb+srv://..."
    }
  }'
```

### 4.4 Test the Connection

```bash
curl -X POST http://localhost:3000/api/v1/connections/CONNECTION_ID/test \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Best Practices

### 1. Service Definition

- ✅ **Complete credentials list** - Include all required and optional fields
- ✅ **Clear descriptions** - Users should understand what each credential does
- ✅ **Helpful placeholders** - Show example values
- ✅ **Comprehensive capabilities** - List all features
- ✅ **Detailed agent instructions** - AI needs clear guidance

### 2. Adapter Implementation

- ✅ **Robust error handling** - Catch and return meaningful errors
- ✅ **Timeout handling** - Don't let connections hang indefinitely
- ✅ **Resource cleanup** - Close connections, free resources
- ✅ **Type safety** - Use TypeScript types properly
- ✅ **Logging** - Add debug logs for troubleshooting

### 3. Code Templates

- ✅ **Production-ready** - Code should work out of the box
- ✅ **Best practices** - Follow service-specific conventions
- ✅ **Error handling** - Include try/catch blocks
- ✅ **Environment variables** - Use process.env for credentials
- ✅ **TypeScript** - Prefer TypeScript over JavaScript

### 4. Testing

- ✅ **Test with real credentials** - Use test/sandbox accounts
- ✅ **Test all operations** - Find, insert, update, delete
- ✅ **Test error cases** - Invalid credentials, network errors
- ✅ **Test concurrent operations** - Ensure thread safety

---

## Common Patterns

### Pattern 1: OAuth Services

```typescript
credentials: [
    {
        key: 'clientId',
        label: 'Client ID',
        type: 'text',
        required: true,
    },
    {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        required: true,
    },
    {
        key: 'redirectUri',
        label: 'Redirect URI',
        type: 'url',
        required: false,
        defaultValue: 'http://localhost:3000/auth/callback',
    },
],
```

### Pattern 2: API Key Services

```typescript
credentials: [
    {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        description: 'Get from Dashboard → API Keys',
    },
],
```

### Pattern 3: Connection String Services

```typescript
credentials: [
    {
        key: 'connectionString',
        label: 'Connection String',
        type: 'password',
        required: true,
        placeholder: 'postgresql://user:pass@host:5432/db',
    },
],
```

---

## Service Categories

Choose the right category:

- `DATABASE` - PostgreSQL, MongoDB, MySQL, etc.
- `AUTHENTICATION` - Auth0, Clerk, Firebase Auth
- `MONITORING` - Sentry, Datadog, New Relic
- `EMAIL` - Resend, SendGrid, Mailgun
- `PAYMENT` - Stripe, PayPal, Square
- `STORAGE` - AWS S3, Cloudinary, Upload care
- `CICD` - GitHub Actions, CircleCI, Jenkins
- `ANALYTICS` - Google Analytics, Mixpanel, Amplitude
- `SEARCH` - Algolia, Elasticsearch, Meilisearch
- `MESSAGING` - Twilio, Vonage, MessageBird
- `CMS` - Contentful, Sanity, Strapi
- `DEPLOYMENT` - Vercel, Netlify, Railway
- `CONTAINER` - Docker Hub, AWS ECR, Google GCR

---

## Troubleshooting

### "Adapter not found" error

**Solution:** Make sure you registered the adapter in `adapter-factory.ts`

### "Service not appearing in list"

**Solution:** Check that you added it to `getDefaultServices()` in `services/index.ts`

### "Connection test failing"

**Solution:** Add more detailed error logging in your adapter's `test()` method

### "Generated code has errors"

**Solution:** Test your code templates manually. Make sure imports and syntax are correct.

---

## Examples

See these services for reference:
- **Supabase** - Complex service with many templates
- **Sentry** - Simple API key service
- **Stripe** - Multiple credential types
- **GitHub Actions** - YAML-based configuration

---

## Next Steps

1. **Define your service** - Create the service definition file
2. **Build the adapter** - Implement test() and code generation
3. **Register everything** - Add to indexes and factory
4. **Test thoroughly** - Use real credentials
5. **Submit PR** - Share with the community!

---

## Support

- Found a bug? Open an issue
- Need help? Check existing services for examples
- Want to contribute? PRs welcome!
