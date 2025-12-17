# 🗺️ SERVICE INTEGRATION FRAMEWORK - IMPLEMENTATION ROADMAP

## 📋 Executive Summary

This roadmap outlines the **best approach** to implement the Service Integration Framework into your existing backend system. The strategy is:

✅ **Incremental** - Build piece by piece, not all at once  
✅ **Non-Breaking** - Existing features continue working  
✅ **Testable** - Each phase can be tested independently  
✅ **Production-Ready** - Focus on quality over speed  
✅ **Scalable** - Foundation supports 100+ services  

**Timeline**: 4-6 weeks for MVP (5 essential services)  
**Team**: Can be built by 1-2 developers  

---

## 🎯 IMPLEMENTATION STRATEGY

### **Why This Approach?**

1. **Start Small, Scale Fast**: Begin with 5 essential services, then add more
2. **Leverage Existing Patterns**: Use your current agent/orchestrator architecture
3. **Test-Driven**: E2E tests for each service adapter
4. **Database-First**: Schema migrations before application code
5. **API-First**: Define contracts before implementation

---

## � INTERACTIVE SERVICE SELECTION STRATEGY (NEW!)

### **The Revolutionary Approach: Always Production-Ready**

When users haven't configured services yet, we DON'T generate generic placeholder code. Instead, we use an **Interactive Questioning Session** to understand their needs, then generate production-ready code and guide them through setup.

### **Core Principles**:

1. ✅ **Never Generic Code** - Always use real services (no placeholders)
2. ✅ **AI Chooses Best** - If user doesn't know, AI picks optimal services
3. ✅ **Interactive Questions** - Ask what they need during generation
4. ✅ **Post-Gen Setup Guide** - Give step-by-step configuration guide
5. ✅ **Auto-Connect Later** - Once configured, everything works immediately

---

### **Complete Flow: User Without Services**

```
┌─────────────────────────────────────────────────────────────┐
│ SCENARIO: Sarah has NO services configured yet              │
└─────────────────────────────────────────────────────────────┘

Step 1: Sarah Requests Code
────────────────────────────
Input: "Create a task management API"

Step 2: System Detects No Services
───────────────────────────────────
const connections = await connectionManager.getUserConnections('sarah-123');
// Returns: [] (empty!)

Step 3: START INTERACTIVE SESSION
──────────────────────────────────
System asks Sarah questions:

┌──────────────────────────────────────────────────┐
│ 🤔 Let's help you choose the best services      │
├──────────────────────────────────────────────────┤
│                                                  │
│ Q1: Do you have a preferred database?           │
│  ○ I have Supabase                              │
│  ○ I have MongoDB                               │
│  ○ I don't know (recommend one)  ← SELECTED     │
│                                                  │
│ Q2: Do you need user authentication?            │
│  ○ Yes, I have Auth0                            │
│  ○ Yes, recommend a service  ← SELECTED         │
│  ○ No authentication needed                     │
│                                                  │
│ Q3: Want error monitoring in production?        │
│  ○ Yes, I have Sentry                           │
│  ○ Yes, recommend a service  ← SELECTED         │
│  ○ Not right now                                │
│                                                  │
│ [Generate Production Code →]                    │
└──────────────────────────────────────────────────┘

Step 4: AI Analyzes & Recommends
─────────────────────────────────
Based on answers + task analysis:
✓ Database: Supabase (easiest + has auth)
✓ Auth: Supabase Auth (integrated with DB)
✓ Monitoring: Sentry (production standard)

Step 5: Generate REAL Production Code
──────────────────────────────────────
// Generated code uses REAL services (not placeholders!)

import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/node';

// Production-ready Supabase setup
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Production-ready Sentry setup
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});

// Real task management endpoint
app.post('/tasks', async (req, res) => {
  try {
    const { title, userId } = req.body;
    
    // Real Supabase insert
    const { data, error } = await supabase
      .from('tasks')
      .insert({ title, user_id: userId, completed: false })
      .select();
    
    if (error) throw error;
    return res.json(data);
    
  } catch (error) {
    // Real Sentry error tracking
    Sentry.captureException(error);
    return res.status(500).json({ error: 'Internal error' });
  }
});

Step 6: Return Code + Setup Guide
──────────────────────────────────
Response includes:
{
  code: "... (production-ready code above)",
  
  servicesUsed: [
    { id: 'supabase', name: 'Supabase' },
    { id: 'sentry', name: 'Sentry' }
  ],
  
  setupGuide: {
    title: "Connect Your Services (5 minutes)",
    estimatedTime: "5 minutes",
    steps: [
      {
        service: 'supabase',
        title: "Step 1: Create Supabase Project",
        instructions: [
          "1. Go to https://supabase.com",
          "2. Click 'New Project'",
          "3. Copy your Project URL and anon key",
          "4. Come back here and connect it"
        ],
        connectUrl: "/dashboard/connections?add=supabase",
        requiredCredentials: ['url', 'anonKey'],
        videoTutorial: "https://..."
      },
      {
        service: 'sentry',
        title: "Step 2: Create Sentry Project",
        instructions: [
          "1. Go to https://sentry.io",
          "2. Click 'Create Project'",
          "3. Select 'Node.js'",
          "4. Copy your DSN",
          "5. Connect it here"
        ],
        connectUrl: "/dashboard/connections?add=sentry",
        requiredCredentials: ['dsn']
      }
    ],
    
    nextSteps: [
      {
        action: "Configure Services Now",
        url: "/dashboard/connections",
        primary: true
      },
      {
        action: "Download Code (works after setup)",
        url: "/download/project",
        primary: false
      }
    ]
  },
  
  envVarsNeeded: {
    message: "Add these to your .env file after setup:",
    variables: [
      { key: "SUPABASE_URL", source: "From Supabase dashboard" },
      { key: "SUPABASE_ANON_KEY", source: "From Supabase dashboard" },
      { key: "SENTRY_DSN", source: "From Sentry project settings" }
    ]
  }
}

Step 7: Sarah Configures Services
──────────────────────────────────
Sarah follows the guide:
1. Creates Supabase project (2 min)
2. Copies credentials
3. Goes to /dashboard/connections
4. Adds Supabase connection ✓
5. Creates Sentry project (2 min)
6. Adds Sentry connection ✓

Step 8: Auto-Connection Complete!
──────────────────────────────────
System now knows Sarah's services.

Next time she generates code:
✓ Automatically uses HER Supabase
✓ Automatically uses HER Sentry
✓ No questions needed
✓ Just works!
```

---

### **Implementation: Service Selector**

**File**: `packages/orchestrator/src/service-selector/index.ts`

```typescript
export interface ServiceQuestion {
  id: string;
  question: string;
  category: ServiceCategory;
  required: boolean;
  options: Array<{
    value: string;
    label: string;
    isRecommend: boolean; // "I don't know, recommend one"
  }>;
}

export interface ServiceSelection {
  serviceId: string;
  reason: string;
  autoSelected: boolean; // AI chose this
}

export class InteractiveServiceSelector {
  constructor(
    private registry: ServiceRegistry,
    private connectionManager: ConnectionManager
  ) {}

  /**
   * Generate questions based on task requirements
   */
  async generateQuestions(task: string, userId: string): Promise<ServiceQuestion[]> {
    // Check what services user already has
    const existingConnections = await this.connectionManager.getUserConnections(userId);
    
    const questions: ServiceQuestion[] = [];
    const taskLower = task.toLowerCase();

    // Question 1: Database (if task needs storage)
    if (this.needsDatabase(taskLower) && !this.hasCategory(existingConnections, ServiceCategory.DATABASE)) {
      questions.push({
        id: 'database',
        question: 'Do you have a preferred database?',
        category: ServiceCategory.DATABASE,
        required: true,
        options: [
          { value: 'supabase', label: 'I have Supabase', isRecommend: false },
          { value: 'mongodb', label: 'I have MongoDB', isRecommend: false },
          { value: 'postgresql', label: 'I have PostgreSQL', isRecommend: false },
          { value: 'recommend', label: "I don't know (recommend one)", isRecommend: true }
        ]
      });
    }

    // Question 2: Authentication (if task needs users)
    if (this.needsAuth(taskLower) && !this.hasCategory(existingConnections, ServiceCategory.AUTHENTICATION)) {
      questions.push({
        id: 'auth',
        question: 'Do you need user authentication?',
        category: ServiceCategory.AUTHENTICATION,
        required: false,
        options: [
          { value: 'auth0', label: 'I have Auth0', isRecommend: false },
          { value: 'clerk', label: 'I have Clerk', isRecommend: false },
          { value: 'supabase-auth', label: 'I have Supabase (has built-in auth)', isRecommend: false },
          { value: 'recommend', label: 'Yes, recommend a service', isRecommend: true },
          { value: 'none', label: 'No authentication needed', isRecommend: false }
        ]
      });
    }

    // Question 3: Monitoring (always ask)
    if (!this.hasCategory(existingConnections, ServiceCategory.MONITORING)) {
      questions.push({
        id: 'monitoring',
        question: 'Want error monitoring in production?',
        category: ServiceCategory.MONITORING,
        required: false,
        options: [
          { value: 'sentry', label: 'I have Sentry', isRecommend: false },
          { value: 'datadog', label: 'I have Datadog', isRecommend: false },
          { value: 'recommend', label: 'Yes, recommend a service', isRecommend: true },
          { value: 'none', label: 'Not right now', isRecommend: false }
        ]
      });
    }

    return questions;
  }

  /**
   * Process user answers and select optimal services
   */
  async selectServices(
    task: string,
    answers: Record<string, string>
  ): Promise<ServiceSelection[]> {
    const selections: ServiceSelection[] = [];

    for (const [questionId, answer] of Object.entries(answers)) {
      if (answer === 'recommend') {
        // AI chooses best service
        const best = await this.recommendService(questionId, task);
        selections.push({
          serviceId: best.id,
          reason: best.reason,
          autoSelected: true
        });
      } else if (answer !== 'none') {
        // User specified a service
        selections.push({
          serviceId: answer,
          reason: 'User-specified',
          autoSelected: false
        });
      }
    }

    return selections;
  }

  /**
   * AI recommends best service for category
   */
  private async recommendService(
    category: string,
    task: string
  ): Promise<{ id: string; reason: string }> {
    switch (category) {
      case 'database':
        return {
          id: 'supabase',
          reason: 'Supabase is easiest to set up, has built-in auth, and works great for most applications'
        };
      
      case 'auth':
        return {
          id: 'supabase-auth',
          reason: 'Supabase Auth integrates seamlessly with your database and is free to start'
        };
      
      case 'monitoring':
        return {
          id: 'sentry',
          reason: 'Sentry is the industry standard for error tracking with excellent free tier'
        };
      
      default:
        return {
          id: 'supabase',
          reason: 'Recommended starter service'
        };
    }
  }

  private needsDatabase(task: string): boolean {
    return task.includes('store') || task.includes('save') || 
           task.includes('database') || task.includes('crud') ||
           task.includes('data') || task.includes('api');
  }

  private needsAuth(task: string): boolean {
    return task.includes('auth') || task.includes('login') || 
           task.includes('user') || task.includes('signup') ||
           task.includes('account');
  }

  private hasCategory(connections: UserConnection[], category: ServiceCategory): boolean {
    return connections.some(c => {
      const service = this.registry.getService(c.serviceId);
      return service?.category === category;
    });
  }
}
```

---

### **Implementation: Setup Guide Generator**

**File**: `packages/orchestrator/src/setup-guide-generator/index.ts`

```typescript
export interface SetupStep {
  service: string;
  title: string;
  instructions: string[];
  connectUrl: string;
  requiredCredentials: string[];
  videoTutorial?: string;
  estimatedTime: string;
}

export interface SetupGuide {
  title: string;
  estimatedTime: string;
  steps: SetupStep[];
  envVarsNeeded: {
    message: string;
    variables: Array<{ key: string; source: string }>;
  };
  nextSteps: Array<{
    action: string;
    url: string;
    primary: boolean;
  }>;
}

export class SetupGuideGenerator {
  constructor(private registry: ServiceRegistry) {}

  generate(serviceIds: string[]): SetupGuide {
    const steps: SetupStep[] = [];
    const envVars: Array<{ key: string; source: string }> = [];

    for (const serviceId of serviceIds) {
      const service = this.registry.getService(serviceId);
      if (!service) continue;

      // Generate setup step for this service
      const step = this.generateServiceStep(service);
      steps.push(step);

      // Collect env vars
      for (const cred of service.credentials) {
        const envKey = `${service.id.toUpperCase()}_${cred.key.toUpperCase()}`;
        envVars.push({
          key: envKey,
          source: `From ${service.name} dashboard`
        });
      }
    }

    return {
      title: `Connect Your Services (${steps.length * 2} minutes)`,
      estimatedTime: `${steps.length * 2} minutes`,
      steps,
      envVarsNeeded: {
        message: 'Add these to your .env file after setup:',
        variables: envVars
      },
      nextSteps: [
        {
          action: 'Configure Services Now',
          url: '/dashboard/connections',
          primary: true
        },
        {
          action: 'Download Code',
          url: '/download/project',
          primary: false
        }
      ]
    };
  }

  private generateServiceStep(service: ServiceDefinition): SetupStep {
    const guides: Record<string, any> = {
      supabase: {
        title: 'Create Supabase Project',
        instructions: [
          '1. Go to https://supabase.com',
          '2. Click "New Project"',
          '3. Choose a name and password',
          '4. Copy your Project URL from Settings → API',
          '5. Copy your anon/public key from the same page'
        ],
        estimatedTime: '2 minutes',
        videoTutorial: 'https://www.youtube.com/watch?v=...'
      },
      sentry: {
        title: 'Create Sentry Project',
        instructions: [
          '1. Go to https://sentry.io',
          '2. Click "Create Project"',
          '3. Select "Node.js" as platform',
          '4. Choose a project name',
          '5. Copy the DSN from project settings'
        ],
        estimatedTime: '2 minutes'
      },
      auth0: {
        title: 'Create Auth0 Application',
        instructions: [
          '1. Go to https://auth0.com',
          '2. Create a new tenant',
          '3. Go to Applications → Create Application',
          '4. Choose "Regular Web Application"',
          '5. Copy Domain and Client ID from settings'
        ],
        estimatedTime: '3 minutes'
      },
      // Add more services...
    };

    const guide = guides[service.id] || {
      title: `Setup ${service.name}`,
      instructions: [`1. Visit ${service.documentation}`],
      estimatedTime: '5 minutes'
    };

    return {
      service: service.id,
      title: `Step ${Object.keys(guides).indexOf(service.id) + 1}: ${guide.title}`,
      instructions: guide.instructions,
      connectUrl: `/dashboard/connections?add=${service.id}`,
      requiredCredentials: service.credentials.map(c => c.key),
      videoTutorial: guide.videoTutorial,
      estimatedTime: guide.estimatedTime
    };
  }
}
```

---

### **API Route Update**

**File**: `packages/api/src/routes/orchestrator/index.ts`

```typescript
// NEW: Interactive generation endpoint
app.post('/generate-interactive', async (request, reply) => {
  const userId = request.user.id;
  const { task } = request.body;

  // Check if user has services
  const connections = await connectionManager.getUserConnections(userId);

  if (connections.length === 0) {
    // Start interactive session
    const selector = new InteractiveServiceSelector(registry, connectionManager);
    const questions = await selector.generateQuestions(task, userId);

    return {
      mode: 'interactive',
      questions,
      message: "Let's choose the best services for your project"
    };
  }

  // User has services - generate normally
  const code = await orchestrator.generate(task, connections);
  return { mode: 'direct', code };
});

// Process interactive answers
app.post('/generate-interactive/submit', async (request, reply) => {
  const userId = request.user.id;
  const { task, answers } = request.body;

  const selector = new InteractiveServiceSelector(registry, connectionManager);
  const selections = await selector.selectServices(task, answers);

  // Generate code using selected services
  const code = await orchestrator.generateWithServices(task, selections);

  // Generate setup guide
  const guideGenerator = new SetupGuideGenerator(registry);
  const setupGuide = guideGenerator.generate(selections.map(s => s.serviceId));

  return {
    code,
    servicesUsed: selections,
    setupGuide,
    envVarsNeeded: setupGuide.envVarsNeeded
  };
});
```

---

## �📅 PHASE-BY-PHASE BREAKDOWN

## **PHASE 0: Preparation (Week 0 - 2 days)**

### Goal: Set up foundation without writing service code yet

### Tasks:

#### 0.1 Create Directory Structure
```bash
packages/api/src/services/
├── service-registry/
│   ├── index.ts              # ServiceRegistry class
│   ├── types.ts              # ServiceDefinition, CredentialSchema
│   ├── categories.ts         # ServiceCategory enum
│   └── registry.ts           # Pre-configured service definitions
├── connection-manager/
│   ├── index.ts              # ConnectionManager class
│   ├── encryption.ts         # Credential encryption helpers
│   └── types.ts              # Connection types
└── adapters/
    ├── base-adapter.ts       # BaseAdapter abstract class
    ├── adapter-factory.ts    # Factory to get adapters
    └── [services]/           # Service-specific adapters (added later)
```

#### 0.2 Database Migrations
**File**: `packages/database/migrations/XXX_add_service_connections.sql`

```sql
-- Migration: Add service connection tables
-- Priority: HIGH
-- Dependencies: None

-- Service connections table
CREATE TABLE IF NOT EXISTS user_service_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id VARCHAR(100) NOT NULL,
  connection_name VARCHAR(255) NOT NULL,
  credentials JSONB NOT NULL, -- Encrypted
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  CONSTRAINT unique_user_service_connection UNIQUE(user_id, service_id, connection_name)
);

-- Service usage tracking
CREATE TABLE IF NOT EXISTS service_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES user_service_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id VARCHAR(100) NOT NULL,
  operation VARCHAR(100),
  success BOOLEAN NOT NULL,
  duration_ms INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_service_connections_user_id 
  ON user_service_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_service_connections_service_id 
  ON user_service_connections(service_id);
CREATE INDEX IF NOT EXISTS idx_user_service_connections_active 
  ON user_service_connections(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_service_usage_logs_user_id 
  ON service_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_service_usage_logs_created_at 
  ON service_usage_logs(created_at DESC);

-- Row Level Security (RLS)
ALTER TABLE user_service_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own connections
CREATE POLICY user_service_connections_policy ON user_service_connections
  FOR ALL USING (auth.uid() = user_id);

-- Users can only see their own usage logs
CREATE POLICY service_usage_logs_policy ON service_usage_logs
  FOR ALL USING (auth.uid() = user_id);
```

**Action**: Run migration
```bash
# If using Supabase CLI
supabase db push

# Or apply manually to your Supabase project
```

#### 0.3 Update Environment Variables
**File**: `.env.example`

Add:
```bash
# Service Integration
SERVICE_ENCRYPTION_KEY=${SUPABASE_SERVICE_ROLE_KEY} # Re-use for Vault
```

✅ **Success Criteria**: 
- Directory structure exists
- Database tables created
- Migrations tested on dev database

---

## **PHASE 1: Core Infrastructure (Week 1 - 5 days)**

### Goal: Build the registry and connection manager without any real services yet

### 1.1 Implement Type Definitions

**File**: `packages/api/src/services/service-registry/types.ts`

```typescript
export enum ServiceCategory {
  DATABASE = 'database',
  AUTHENTICATION = 'authentication',
  MONITORING = 'monitoring',
  CICD = 'ci_cd',
  STORAGE = 'storage',
  MESSAGING = 'messaging',
  EMAIL = 'email',
  PAYMENT = 'payment',
  // ... add all 15 categories
}

export interface CredentialField {
  key: string;
  label: string;
  type: 'api_key' | 'oauth' | 'username_password' | 'connection_string' | 'json';
  required: boolean;
  sensitive: boolean;
  validation?: RegExp;
  placeholder?: string;
  description?: string;
}

export interface ServiceDefinition {
  id: string;
  name: string;
  category: ServiceCategory;
  description: string;
  documentation: string;
  logo?: string;
  credentials: CredentialField[];
  capabilities: string[];
  agentInstructions: string;
  codeTemplates: Record<string, CodeTemplate>;
}

export interface CodeTemplate {
  name: string;
  description: string;
  language: 'typescript' | 'javascript' | 'python';
  code: string;
  requiredPackages?: string[];
}

export interface UserConnection {
  id: string;
  userId: string;
  serviceId: string;
  connectionName: string;
  credentials: Record<string, string>; // Decrypted in memory only
  metadata: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
}
```

### 1.2 Implement Service Registry

**File**: `packages/api/src/services/service-registry/index.ts`

```typescript
import { ServiceDefinition, ServiceCategory } from './types.js';

export class ServiceRegistry {
  private services: Map<string, ServiceDefinition> = new Map();

  constructor() {
    this.loadDefaultServices();
  }

  /**
   * Register a new service
   */
  register(service: ServiceDefinition): void {
    this.services.set(service.id, service);
  }

  /**
   * Get service by ID
   */
  getService(id: string): ServiceDefinition | undefined {
    return this.services.get(id);
  }

  /**
   * Get all services in a category
   */
  getByCategory(category: ServiceCategory): ServiceDefinition[] {
    return Array.from(this.services.values())
      .filter(s => s.category === category);
  }

  /**
   * Search services
   */
  search(query: string): ServiceDefinition[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.services.values()).filter(s =>
      s.name.toLowerCase().includes(lowerQuery) ||
      s.description.toLowerCase().includes(lowerQuery) ||
      s.capabilities.some(c => c.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get all services
   */
  getAllServices(): ServiceDefinition[] {
    return Array.from(this.services.values());
  }

  /**
   * Get statistics
   */
  getStats() {
    const services = this.getAllServices();
    const byCategory = new Map<ServiceCategory, number>();
    
    for (const service of services) {
      byCategory.set(service.category, (byCategory.get(service.category) || 0) + 1);
    }

    return {
      total: services.length,
      byCategory: Object.fromEntries(byCategory)
    };
  }

  /**
   * Load default 5 essential services (will expand later)
   */
  private loadDefaultServices(): void {
    // Start with just structure - services added in Phase 2
  }
}

// Singleton instance
let registryInstance: ServiceRegistry | null = null;

export function getServiceRegistry(): ServiceRegistry {
  if (!registryInstance) {
    registryInstance = new ServiceRegistry();
  }
  return registryInstance;
}
```

### 1.3 Implement Connection Manager

**File**: `packages/api/src/services/connection-manager/index.ts`

```typescript
import { getSupabaseClient } from '../database-client.js';
import { ServiceRegistry } from '../service-registry/index.js';
import { UserConnection } from '../service-registry/types.js';
import { encryptCredentials, decryptCredentials } from './encryption.js';

export class ConnectionManager {
  constructor(
    private registry: ServiceRegistry,
    private db = getSupabaseClient()
  ) {}

  /**
   * Create a new service connection
   */
  async createConnection(
    userId: string,
    serviceId: string,
    connectionName: string,
    credentials: Record<string, string>
  ): Promise<UserConnection> {
    // Validate service exists
    const service = this.registry.getService(serviceId);
    if (!service) {
      throw new Error(`Service '${serviceId}' not found`);
    }

    // Validate credentials
    this.validateCredentials(service, credentials);

    // Encrypt sensitive credentials
    const encryptedCreds = await encryptCredentials(credentials);

    // Insert into database
    const { data, error } = await this.db
      .from('user_service_connections')
      .insert({
        user_id: userId,
        service_id: serviceId,
        connection_name: connectionName,
        credentials: encryptedCreds,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    return this.mapToUserConnection(data);
  }

  /**
   * Get user's connections
   */
  async getUserConnections(userId: string, activeOnly = true): Promise<UserConnection[]> {
    let query = this.db
      .from('user_service_connections')
      .select('*')
      .eq('user_id', userId);

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return Promise.all(data.map(d => this.mapToUserConnection(d)));
  }

  /**
   * Get specific connection (with decrypted credentials)
   */
  async getConnection(userId: string, connectionId: string): Promise<UserConnection> {
    const { data, error } = await this.db
      .from('user_service_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new Error('Connection not found');
    }

    return this.mapToUserConnection(data);
  }

  /**
   * Update connection
   */
  async updateConnection(
    userId: string,
    connectionId: string,
    updates: Partial<{ connectionName: string; credentials: Record<string, string>; isActive: boolean }>
  ): Promise<UserConnection> {
    const dbUpdates: any = {};

    if (updates.connectionName) {
      dbUpdates.connection_name = updates.connectionName;
    }

    if (updates.credentials) {
      dbUpdates.credentials = await encryptCredentials(updates.credentials);
    }

    if (updates.isActive !== undefined) {
      dbUpdates.is_active = updates.isActive;
    }

    dbUpdates.updated_at = new Date().toISOString();

    const { data, error } = await this.db
      .from('user_service_connections')
      .update(dbUpdates)
      .eq('id', connectionId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    return this.mapToUserConnection(data);
  }

  /**
   * Delete connection
   */
  async deleteConnection(userId: string, connectionId: string): Promise<void> {
    const { error } = await this.db
      .from('user_service_connections')
      .delete()
      .eq('id', connectionId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  /**
   * Log service usage
   */
  async logUsage(
    connectionId: string,
    userId: string,
    serviceId: string,
    operation: string,
    success: boolean,
    durationMs: number,
    errorMessage?: string
  ): Promise<void> {
    await this.db.from('service_usage_logs').insert({
      connection_id: connectionId,
      user_id: userId,
      service_id: serviceId,
      operation,
      success,
      duration_ms: durationMs,
      error_message: errorMessage
    });
  }

  /**
   * Validate credentials against service schema
   */
  private validateCredentials(service: any, credentials: Record<string, string>): void {
    for (const field of service.credentials) {
      if (field.required && !credentials[field.key]) {
        throw new Error(`Missing required credential: ${field.label}`);
      }

      if (credentials[field.key] && field.validation) {
        if (!field.validation.test(credentials[field.key])) {
          throw new Error(`Invalid format for ${field.label}`);
        }
      }
    }
  }

  /**
   * Map database row to UserConnection
   */
  private async mapToUserConnection(data: any): Promise<UserConnection> {
    const credentials = await decryptCredentials(data.credentials);

    return {
      id: data.id,
      userId: data.user_id,
      serviceId: data.service_id,
      connectionName: data.connection_name,
      credentials,
      metadata: data.metadata || {},
      isActive: data.is_active,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      lastUsedAt: data.last_used_at ? new Date(data.last_used_at) : undefined
    };
  }
}

// Singleton
let connectionManagerInstance: ConnectionManager | null = null;

export function getConnectionManager(): ConnectionManager {
  if (!connectionManagerInstance) {
    const { getServiceRegistry } = await import('../service-registry/index.js');
    connectionManagerInstance = new ConnectionManager(getServiceRegistry());
  }
  return connectionManagerInstance;
}
```

### 1.4 Implement Encryption Helpers

**File**: `packages/api/src/services/connection-manager/encryption.ts`

```typescript
import { getSupabaseClient } from '../database-client.js';

/**
 * Encrypt credentials using Supabase Vault
 * Note: In production, use Supabase Vault's encrypt function
 * For now, we'll use a simple implementation
 */
export async function encryptCredentials(
  credentials: Record<string, string>
): Promise<Record<string, string>> {
  // TODO: Integrate with Supabase Vault when available
  // For now, store as JSON (will be encrypted at DB level if using Supabase)
  
  // In production, use:
  // const db = getSupabaseClient();
  // const encrypted = await db.rpc('vault_encrypt', { data: JSON.stringify(credentials) });
  
  return credentials; // Temporary - replace with actual encryption
}

/**
 * Decrypt credentials
 */
export async function decryptCredentials(
  encryptedCredentials: Record<string, string>
): Promise<Record<string, string>> {
  // TODO: Integrate with Supabase Vault when available
  
  // In production, use:
  // const db = getSupabaseClient();
  // const decrypted = await db.rpc('vault_decrypt', { encrypted: encryptedCredentials });
  
  return encryptedCredentials; // Temporary - replace with actual decryption
}
```

✅ **Success Criteria**:
- ServiceRegistry can register and retrieve services
- ConnectionManager can create/read/update/delete connections
- Encryption helpers implemented (even if basic)
- Unit tests pass for registry and connection manager

---

## **PHASE 2: First 5 Essential Services (Week 1-2 - 7 days)**

### Goal: Add 5 production-ready service adapters

### **Priority Services** (Most Valuable):
1. **Supabase** (Database + Auth) - Your current stack
2. **Sentry** (Monitoring) - Error tracking
3. **GitHub Actions** (CI/CD) - Deployment automation
4. **Resend** (Email) - Simple email service
5. **Stripe** (Payments) - Revenue generation

### 2.1 Create Base Adapter

**File**: `packages/api/src/services/adapters/base-adapter.ts`

```typescript
import { ServiceDefinition, CodeTemplate } from '../service-registry/types.js';

export interface TestResult {
  success: boolean;
  message: string;
  latency?: number;
  metadata?: Record<string, any>;
}

export abstract class BaseAdapter {
  constructor(protected serviceDefinition: ServiceDefinition) {}

  /**
   * Test connection with provided credentials
   */
  abstract test(credentials: Record<string, string>): Promise<TestResult>;

  /**
   * Generate code template for specific operation
   */
  abstract generateCodeTemplate(
    operation: string,
    context: Record<string, any>
  ): string;

  /**
   * Get instructions for AI agents
   */
  getAgentInstructions(): string {
    return this.serviceDefinition.agentInstructions;
  }

  /**
   * Get all code templates
   */
  getCodeTemplates(): Record<string, CodeTemplate> {
    return this.serviceDefinition.codeTemplates;
  }

  /**
   * Get service ID
   */
  get serviceId(): string {
    return this.serviceDefinition.id;
  }
}
```

### 2.2 Implement Supabase Adapter

**File**: `packages/api/src/services/adapters/database/supabase-adapter.ts`

```typescript
import { BaseAdapter, TestResult } from '../base-adapter.js';
import { ServiceDefinition } from '../../service-registry/types.js';

export class SupabaseAdapter extends BaseAdapter {
  async test(credentials: Record<string, string>): Promise<TestResult> {
    const start = Date.now();
    
    try {
      const { createClient } = await import('@supabase/supabase-js');
      
      const client = createClient(
        credentials.url,
        credentials.anonKey
      );

      // Test query
      const { error } = await client.from('_health').select('*').limit(1);
      
      const latency = Date.now() - start;

      if (error && !error.message.includes('does not exist')) {
        // Ignore "table does not exist" - that's actually a successful connection
        return {
          success: false,
          message: error.message,
          latency
        };
      }

      return {
        success: true,
        message: 'Connection successful',
        latency
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Connection failed',
        latency: Date.now() - start
      };
    }
  }

  generateCodeTemplate(operation: string, context: any = {}): string {
    switch (operation) {
      case 'select':
        return this.generateSelectTemplate(context);
      case 'insert':
        return this.generateInsertTemplate(context);
      case 'update':
        return this.generateUpdateTemplate(context);
      case 'delete':
        return this.generateDeleteTemplate(context);
      case 'auth-signup':
        return this.generateAuthSignupTemplate(context);
      default:
        return '';
    }
  }

  private generateSelectTemplate(context: any): string {
    const table = context.table || 'table_name';
    const columns = context.columns || '*';
    const filter = context.filter || {};
    
    let code = `import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const { data, error } = await supabase
  .from('${table}')
  .select('${columns}')`;

    if (filter.column && filter.value) {
      code += `\n  .eq('${filter.column}', ${JSON.stringify(filter.value)})`;
    }

    code += `;\n\nif (error) throw new Error(error.message);\nreturn data;`;

    return code;
  }

  private generateInsertTemplate(context: any): string {
    const table = context.table || 'table_name';
    const record = context.record || { field: 'value' };

    return `import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const { data, error } = await supabase
  .from('${table}')
  .insert(${JSON.stringify(record, null, 2)})
  .select();

if (error) throw new Error(error.message);
return data;`;
  }

  private generateUpdateTemplate(context: any): string {
    const table = context.table || 'table_name';
    const updates = context.updates || { field: 'new_value' };
    const filter = context.filter || { column: 'id', value: 'xxx' };

    return `import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const { data, error } = await supabase
  .from('${table}')
  .update(${JSON.stringify(updates, null, 2)})
  .eq('${filter.column}', ${JSON.stringify(filter.value)})
  .select();

if (error) throw new Error(error.message);
return data;`;
  }

  private generateDeleteTemplate(context: any): string {
    const table = context.table || 'table_name';
    const filter = context.filter || { column: 'id', value: 'xxx' };

    return `import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const { error } = await supabase
  .from('${table}')
  .delete()
  .eq('${filter.column}', ${JSON.stringify(filter.value)});

if (error) throw new Error(error.message);`;
  }

  private generateAuthSignupTemplate(context: any): string {
    return `import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const { data, error } = await supabase.auth.signUp({
  email: '${context.email || 'user@example.com'}',
  password: '${context.password || 'secure-password'}',
});

if (error) throw new Error(error.message);
return data.user;`;
  }
}
```

### 2.3 Register Services in Registry

**File**: `packages/api/src/services/service-registry/services/supabase.ts`

```typescript
import { ServiceDefinition, ServiceCategory } from '../types.js';

export const supabaseService: ServiceDefinition = {
  id: 'supabase',
  name: 'Supabase',
  category: ServiceCategory.DATABASE,
  description: 'Open source Firebase alternative with Postgres database, authentication, and storage',
  documentation: 'https://supabase.com/docs',
  logo: 'https://supabase.com/favicon/favicon.ico',
  credentials: [
    {
      key: 'url',
      label: 'Project URL',
      type: 'connection_string',
      required: true,
      sensitive: false,
      placeholder: 'https://xxxxx.supabase.co',
      description: 'Your Supabase project URL',
      validation: /^https:\/\/[a-z0-9-]+\.supabase\.co$/
    },
    {
      key: 'anonKey',
      label: 'Anon/Public Key',
      type: 'api_key',
      required: true,
      sensitive: true,
      placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      description: 'Your project\'s anonymous key (safe for client-side)'
    }
  ],
  capabilities: [
    'postgres-database',
    'authentication',
    'storage',
    'real-time',
    'edge-functions'
  ],
  agentInstructions: `
When using Supabase:
1. Always import from '@supabase/supabase-js'
2. Create client with createClient(url, key)
3. Use these environment variables:
   - SUPABASE_URL: Project URL
   - SUPABASE_ANON_KEY: Anonymous key
4. For queries: supabase.from('table').select/insert/update/delete()
5. For auth: supabase.auth.signUp/signIn/signOut()
6. For storage: supabase.storage.from('bucket').upload/download()
7. Always check for 'error' in response
8. Enable Row Level Security (RLS) for production
9. Use .select() after insert/update to get returned data
  `.trim(),
  codeTemplates: {
    query: {
      name: 'Query Records',
      description: 'Select records from a table',
      language: 'typescript',
      code: `// See generateCodeTemplate for dynamic version`,
      requiredPackages: ['@supabase/supabase-js']
    },
    insert: {
      name: 'Insert Record',
      description: 'Insert a new record',
      language: 'typescript',
      code: `// See generateCodeTemplate for dynamic version`,
      requiredPackages: ['@supabase/supabase-js']
    }
  }
};
```

### 2.4 Similar Implementation for Other 4 Services

Create similar adapters for:
- **Sentry** (`adapters/monitoring/sentry-adapter.ts`)
- **GitHub Actions** (`adapters/cicd/github-actions-adapter.ts`)
- **Resend** (`adapters/email/resend-adapter.ts`)
- **Stripe** (`adapters/payment/stripe-adapter.ts`)

(I can provide full code for these if needed)

### 2.5 Update Registry to Load Services

**File**: `packages/api/src/services/service-registry/index.ts`

Update `loadDefaultServices()`:

```typescript
private loadDefaultServices(): void {
  // Import service definitions
  const { supabaseService } = await import('./services/supabase.js');
  const { sentryService } = await import('./services/sentry.js');
  const { githubActionsService } = await import('./services/github-actions.js');
  const { resendService } = await import('./services/resend.js');
  const { stripeService } = await import('./services/stripe.js');

  // Register services
  this.register(supabaseService);
  this.register(sentryService);
  this.register(githubActionsService);
  this.register(resendService);
  this.register(stripeService);
}
```

✅ **Success Criteria**:
- 5 service adapters implemented
- Each adapter passes connection tests
- Code templates generate valid code
- E2E tests verify adapter functionality

---

## **PHASE 3: API Routes (Week 2-3 - 4 days)**

### Goal: Expose service management via RESTful API

### 3.1 Create Service Routes

**File**: `packages/api/src/routes/services/index.ts`

```typescript
import { FastifyInstance } from 'fastify';
import { getServiceRegistry } from '../../services/service-registry/index.js';

export async function servicesRoutes(app: FastifyInstance) {
  const registry = getServiceRegistry();

  // GET /api/v1/services - List all services
  app.get('/', async (request, reply) => {
    const services = registry.getAllServices();
    
    // Don't send code templates in list view (too large)
    const simplified = services.map(s => ({
      id: s.id,
      name: s.name,
      category: s.category,
      description: s.description,
      logo: s.logo,
      capabilities: s.capabilities
    }));

    return { services: simplified };
  });

  // GET /api/v1/services/:id - Get service details
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const service = registry.getService(id);

    if (!service) {
      return reply.status(404).send({ error: 'Service not found' });
    }

    return { service };
  });

  // GET /api/v1/services/category/:category - Get services by category
  app.get('/category/:category', async (request, reply) => {
    const { category } = request.params as { category: string };
    const services = registry.getByCategory(category as any);

    return { services };
  });

  // GET /api/v1/services/search - Search services
  app.get('/search', async (request, reply) => {
    const { q } = request.query as { q?: string };
    
    if (!q) {
      return reply.status(400).send({ error: 'Query parameter required' });
    }

    const services = registry.search(q);
    return { services };
  });
}
```

### 3.2 Create Connection Routes

**File**: `packages/api/src/routes/connections/index.ts`

```typescript
import { FastifyInstance } from 'fastify';
import { getConnectionManager } from '../../services/connection-manager/index.js';
import { getUserFromRequest } from '../../middleware/auth.js';

export async function connectionsRoutes(app: FastifyInstance) {
  const connectionManager = getConnectionManager();

  // All routes require authentication
  app.addHook('onRequest', async (request, reply) => {
    const user = await getUserFromRequest(request);
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    request.user = user;
  });

  // GET /api/v1/connections - List user's connections
  app.get('/', async (request, reply) => {
    const userId = request.user.id;
    const connections = await connectionManager.getUserConnections(userId);

    // Don't send credentials in list
    const safe = connections.map(c => ({
      ...c,
      credentials: undefined,
      hasCredentials: true
    }));

    return { connections: safe };
  });

  // POST /api/v1/connections - Create connection
  app.post('/', async (request, reply) => {
    const userId = request.user.id;
    const { serviceId, connectionName, credentials } = request.body as any;

    if (!serviceId || !connectionName || !credentials) {
      return reply.status(400).send({ 
        error: 'Missing required fields: serviceId, connectionName, credentials' 
      });
    }

    const connection = await connectionManager.createConnection(
      userId,
      serviceId,
      connectionName,
      credentials
    );

    return { connection: { ...connection, credentials: undefined } };
  });

  // GET /api/v1/connections/:id - Get connection (with credentials)
  app.get('/:id', async (request, reply) => {
    const userId = request.user.id;
    const { id } = request.params as { id: string };

    const connection = await connectionManager.getConnection(userId, id);
    
    return { connection };
  });

  // PUT /api/v1/connections/:id - Update connection
  app.put('/:id', async (request, reply) => {
    const userId = request.user.id;
    const { id } = request.params as { id: string };
    const updates = request.body as any;

    const connection = await connectionManager.updateConnection(
      userId,
      id,
      updates
    );

    return { connection: { ...connection, credentials: undefined } };
  });

  // DELETE /api/v1/connections/:id - Delete connection
  app.delete('/:id', async (request, reply) => {
    const userId = request.user.id;
    const { id } = request.params as { id: string };

    await connectionManager.deleteConnection(userId, id);

    return { success: true };
  });

  // POST /api/v1/connections/:id/test - Test connection
  app.post('/:id/test', async (request, reply) => {
    const userId = request.user.id;
    const { id } = request.params as { id: string };

    // Get connection
    const connection = await connectionManager.getConnection(userId, id);

    // Get adapter
    const { getServiceAdapter } = await import('../../services/adapters/adapter-factory.js');
    const adapter = getServiceAdapter(connection.serviceId);

    if (!adapter) {
      return reply.status(400).send({ error: 'Adapter not found for this service' });
    }

    // Test connection
    const result = await adapter.test(connection.credentials);

    return { result };
  });
}
```

### 3.3 Register Routes in Main App

**File**: `packages/api/src/app.ts`

Add to route registration:

```typescript
// Service Integration Routes
app.register(servicesRoutes, { prefix: '/api/v1/services' });
app.register(connectionsRoutes, { prefix: '/api/v1/connections' });
```

✅ **Success Criteria**:
- All API endpoints working
- Authentication middleware applied
- Credentials properly encrypted/decrypted
- Error handling in place
- API documentation updated

---

## **PHASE 4: Agent Integration (Week 3-4 - 5 days)**

### Goal: AI agents can use service connections when generating code

### 4.1 Update Context Manager

**File**: `packages/orchestrator/src/context-manager.ts`

```typescript
import { getConnectionManager } from '@api/services/connection-manager';
import { getServiceRegistry } from '@api/services/service-registry';

export class ContextManager {
  async buildContext(userId: string, taskDescription: string): Promise<Context> {
    // ... existing context building ...

    // NEW: Load user's service connections
    const connectionManager = getConnectionManager();
    const connections = await connectionManager.getUserConnections(userId);

    // Build service context
    const serviceContext = await this.buildServiceContext(connections);

    return {
      ...existingContext,
      services: serviceContext
    };
  }

  private async buildServiceContext(connections: UserConnection[]) {
    const registry = getServiceRegistry();
    const serviceContexts = [];

    for (const conn of connections) {
      const service = registry.getService(conn.serviceId);
      if (!service) continue;

      serviceContexts.push({
        connectionId: conn.id,
        serviceName: service.name,
        serviceId: service.id,
        category: service.category,
        instructions: service.agentInstructions,
        envVars: this.buildEnvVarMapping(conn),
        capabilities: service.capabilities
      });
    }

    return {
      available: serviceContexts,
      instructions: this.buildCombinedInstructions(serviceContexts)
    };
  }

  private buildEnvVarMapping(connection: UserConnection): Record<string, string> {
    const envVars: Record<string, string> = {};
    const prefix = connection.serviceId.toUpperCase();

    for (const [key, value] of Object.entries(connection.credentials)) {
      envVars[`${prefix}_${key.toUpperCase()}`] = value;
    }

    return envVars;
  }

  private buildCombinedInstructions(contexts: any[]): string {
    return contexts.map(c => `
## ${c.serviceName} (${c.serviceId})
${c.instructions}

Environment variables:
${Object.keys(c.envVars).map(k => `- ${k}`).join('\n')}
    `).join('\n\n');
  }
}
```

### 4.2 Update AI Prompt to Include Service Context

**File**: `packages/orchestrator/src/prompts/codegen-prompt.ts`

```typescript
export function buildCodegenPrompt(task: Task, context: Context): string {
  let prompt = `Generate code for: ${task.description}\n\n`;

  // NEW: Add available services
  if (context.services?.available.length > 0) {
    prompt += `## Available Services\n\n`;
    prompt += `The user has configured these services:\n`;
    
    for (const svc of context.services.available) {
      prompt += `- ${svc.serviceName}: ${svc.capabilities.join(', ')}\n`;
    }

    prompt += `\n${context.services.instructions}\n\n`;
  }

  // ... rest of prompt ...

  return prompt;
}
```

### 4.3 Service-Aware Code Generation

**File**: `packages/orchestrator/src/codegen/service-aware-generator.ts`

```typescript
export class ServiceAwareCodeGenerator {
  async generateCode(task: Task, context: Context): Promise<GeneratedCode> {
    // Detect which services are needed for this task
    const neededServices = this.detectRequiredServices(task, context);

    // Get adapters for needed services
    const adapters = await this.getAdapters(neededServices);

    // Build prompt with service templates
    const prompt = buildCodegenPrompt(task, {
      ...context,
      serviceTemplates: this.buildTemplateLibrary(adapters)
    });

    // Generate code using AI
    const code = await this.aiClient.generate(prompt);

    // Inject environment variable references
    return this.processGeneratedCode(code, neededServices);
  }

  private detectRequiredServices(task: Task, context: Context): string[] {
    const taskLower = task.description.toLowerCase();
    const needed: string[] = [];

    for (const svc of context.services.available) {
      // Check if task mentions this service or its capabilities
      if (taskLower.includes(svc.serviceId) || 
          svc.capabilities.some(cap => taskLower.includes(cap))) {
        needed.push(svc.serviceId);
      }
    }

    return needed;
  }

  private buildTemplateLibrary(adapters: BaseAdapter[]): Record<string, any> {
    const library: Record<string, any> = {};

    for (const adapter of adapters) {
      library[adapter.serviceId] = adapter.getCodeTemplates();
    }

    return library;
  }

  private processGeneratedCode(code: string, services: any[]): GeneratedCode {
    // Ensure env vars are referenced correctly
    // Add necessary imports
    // Validate generated code uses services correctly

    return {
      code,
      dependencies: this.extractDependencies(code),
      envVars: this.extractEnvVars(services)
    };
  }
}
```

✅ **Success Criteria**:
- AI agents receive service context in prompts
- Generated code uses correct SDKs
- Environment variables properly referenced
- Code generation tests include service scenarios

---

## **PHASE 5: Testing & Documentation (Week 4 - 3 days)**

### Goal: Comprehensive tests and docs

### 5.1 E2E Tests

**File**: `packages/api/src/tests/service-integration.test.ts`

```typescript
describe('Service Integration E2E', () => {
  describe('Service Registry', () => {
    it('should list all registered services', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/services'
      });

      expect(response.statusCode).toBe(200);
      const { services } = JSON.parse(response.payload);
      expect(services.length).toBeGreaterThan(0);
      expect(services.find(s => s.id === 'supabase')).toBeDefined();
    });

    it('should get service details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/services/supabase'
      });

      expect(response.statusCode).toBe(200);
      const { service } = JSON.parse(response.payload);
      expect(service.credentials).toBeDefined();
      expect(service.agentInstructions).toBeDefined();
    });
  });

  describe('Connection Management', () => {
    it('should create a Supabase connection', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/connections',
        headers: { authorization: `Bearer ${testToken}` },
        payload: {
          serviceId: 'supabase',
          connectionName: 'Production',
          credentials: {
            url: 'https://test.supabase.co',
            anonKey: 'test-key'
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const { connection } = JSON.parse(response.payload);
      expect(connection.serviceId).toBe('supabase');
    });

    it('should test connection', async () => {
      // Create connection first
      const createResp = await app.inject({ /* ... */ });
      const { connection } = JSON.parse(createResp.payload);

      // Test it
      const testResp = await app.inject({
        method: 'POST',
        url: `/api/v1/connections/${connection.id}/test`,
        headers: { authorization: `Bearer ${testToken}` }
      });

      expect(testResp.statusCode).toBe(200);
      const { result } = JSON.parse(testResp.payload);
      expect(result.success).toBeDefined();
    });
  });

  describe('AI Agent Integration', () => {
    it('should generate code using Supabase service', async () => {
      // Setup: Create Supabase connection for test user
      await createTestConnection('supabase');

      // Request code generation
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/orchestrator/generate',
        headers: { authorization: `Bearer ${testToken}` },
        payload: {
          task: 'Create an API endpoint that fetches users from Supabase'
        }
      });

      expect(response.statusCode).toBe(200);
      const { code } = JSON.parse(response.payload);
      
      // Verify generated code uses Supabase
      expect(code).toContain('@supabase/supabase-js');
      expect(code).toContain('process.env.SUPABASE_URL');
    });
  });
});
```

### 5.2 Documentation

Create:
- **API Documentation**: OpenAPI/Swagger specs for new endpoints
- **Service Guide**: How to add new services
- **User Guide**: How to configure service connections
- **Developer Guide**: How agents use services

✅ **Success Criteria**:
- All tests passing
- Test coverage > 80%
- Documentation complete
- Ready for production use

---

## **PHASE 6: Scaling to 100+ Services (Ongoing)**

### Goal: Add remaining 95 services over time

### Strategy:
1. **Community contributions**: Open-source service definitions
2. **Priority-based**: Add based on user requests
3. **Template-based**: Use existing adapters as templates
4. **Automated testing**: Each service has test suite

### Service Addition Process:
1. Create service definition file
2. Implement adapter (or use generic adapter)
3. Add E2E test
4. Register in service registry
5. Update documentation
6. Deploy to production

---

## 📊 SUCCESS METRICS

### Phase 1-2 (MVP):
- [ ] 5 services fully integrated
- [ ] API endpoints functional
- [ ] E2E tests passing
- [ ] First production user connection created

### Phase 3-4 (Production):
- [ ] 10+ services available
- [ ] AI agents using service connections
- [ ] 100+ user connections created
- [ ] Code generation quality improved

### Phase 5-6 (Scale):
- [ ] 50+ services available
- [ ] Connection dashboard UI launched
- [ ] 1000+ connections created
- [ ] Community-contributed services

---

## 🚨 RISK MITIGATION

### **Risk 1**: Credential Security Breach
**Mitigation**:
- Use Supabase Vault encryption
- Regular security audits
- Rate limiting on API endpoints
- Audit logging for all credential access

### **Risk 2**: Service Adapter Failures
**Mitigation**:
- Circuit breaker pattern for failing services
- Graceful degradation
- Health checks every 5 minutes
- Auto-disable failing connections

### **Risk 3**: Generated Code Quality
**Mitigation**:
- Code validation before returning to user
- Multiple code templates per service
- User feedback loop for template improvements
- Automated testing of generated code patterns

---

## 🎯 NEXT ACTIONS

### Immediate (This Week):
1. ✅ Review this roadmap
2. ⬜ Run database migration (Phase 0.2)
3. ⬜ Create directory structure (Phase 0.1)
4. ⬜ Implement ServiceRegistry (Phase 1.1-1.2)
5. ⬜ Implement ConnectionManager (Phase 1.3-1.4)

### Short Term (Next 2 Weeks):
6. ⬜ Implement 5 service adapters (Phase 2)
7. ⬜ Create API routes (Phase 3)
8. ⬜ Write E2E tests (Phase 5)

### Long Term (Next Month):
9. ⬜ Integrate with AI agents (Phase 4)
10. ⬜ Add 10 more services
11. ⬜ Launch connection dashboard UI

---

## 📞 SUPPORT & QUESTIONS

If you need help with any phase:
1. Refer to individual file examples in this document
2. Check `docs/project/Services.md` for detailed specs
3. Review existing patterns in `packages/api/src/services/`
4. Ask for specific code examples for any adapter

**Remember**: Start small, test thoroughly, scale gradually! 🚀
