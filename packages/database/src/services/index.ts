/**
 * Database Services - Barrel Export
 */

// Users Service
export {
    UsersService,
    usersService,
    type User,
    type UserInsert,
    type UserUpdate,
    type UserTier,
} from './users.js';

// Projects Service
export {
    ProjectsService,
    projectsService,
    type Project,
    type ProjectInsert,
    type ProjectUpdate,
    type ProjectStatus,
} from './projects.js';

// Tasks Service
export {
    TasksService,
    tasksService,
    type Task,
    type TaskInsert,
    type TaskUpdate,
    type TaskStatus,
} from './tasks.js';

// Audit Service
export {
    AuditService,
    auditService,
    type AuditLog,
    type AuditLogInsert,
    type AuditAction,
} from './audit.js';

// API Keys Service
export {
    ApiKeysService,
    apiKeysService,
    type ApiKey,
    type ApiKeyInsert,
    type ApiKeyUpdate,
    type ApiKeyScope,
} from './api-keys.js';

// Vector Store Service
export {
    VectorStoreService,
    vectorStoreService,
    type KnowledgeEmbedding,
    type KnowledgeEmbeddingInsert,
    type SimilarityResult,
} from './vector-store.js';
