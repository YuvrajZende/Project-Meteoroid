-- ============================================
-- PERFORMANCE: Database Indexes Migration
-- Run this migration to add indexes for query optimization
-- ============================================

-- Projects table indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_user_status ON projects(user_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);

-- Tasks table indexes
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_started_at ON tasks(started_at);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at);

-- Generation iterations indexes
CREATE INDEX IF NOT EXISTS idx_generation_iterations_project_id ON generation_iterations(project_id);
CREATE INDEX IF NOT EXISTS idx_generation_iterations_user_id ON generation_iterations(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_iterations_success ON generation_iterations(success);
CREATE INDEX IF NOT EXISTS idx_generation_iterations_created_at ON generation_iterations(created_at DESC);

-- Testing iterations indexes
CREATE INDEX IF NOT EXISTS idx_testing_iterations_project_id ON testing_iterations(project_id);
CREATE INDEX IF NOT EXISTS idx_testing_iterations_user_id ON testing_iterations(user_id);
CREATE INDEX IF NOT EXISTS idx_testing_iterations_success ON testing_iterations(success);
CREATE INDEX IF NOT EXISTS idx_testing_iterations_created_at ON testing_iterations(created_at DESC);

-- Learned patterns indexes
CREATE INDEX IF NOT EXISTS idx_learned_patterns_project_id ON learned_patterns(project_id);
CREATE INDEX IF NOT EXISTS idx_learned_patterns_pattern_type ON learned_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_learned_patterns_success ON learned_patterns(success);
CREATE INDEX IF NOT EXISTS idx_learned_patterns_confidence ON learned_patterns(confidence DESC);

-- Code embeddings indexes (for vector search)
CREATE INDEX IF NOT EXISTS idx_code_embeddings_project_id ON code_embeddings(project_id);
CREATE INDEX IF NOT EXISTS idx_code_embeddings_language ON code_embeddings(language);
CREATE INDEX IF NOT EXISTS idx_code_embeddings_created_at ON code_embeddings(created_at DESC);

-- Knowledge embeddings indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_category ON knowledge_embeddings(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_created_at ON knowledge_embeddings(created_at DESC);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_project_id ON audit_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_logs(created_at DESC);

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Project context indexes
CREATE INDEX IF NOT EXISTS idx_project_context_user_id ON project_contexts(user_id);
CREATE INDEX IF NOT EXISTS idx_project_context_project_id ON project_contexts(project_id);
CREATE INDEX IF NOT EXISTS idx_project_context_last_active ON project_contexts(last_active DESC);

-- ============================================
-- Partial indexes for common queries
-- ============================================

-- Active projects (exclude deleted/archived)
CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(user_id, updated_at DESC)
    WHERE status NOT IN ('deleted', 'archived');

-- Running tasks
CREATE INDEX IF NOT EXISTS idx_tasks_running ON tasks(project_id, started_at)
    WHERE status = 'running';

-- Failed tasks
CREATE INDEX IF NOT EXISTS idx_tasks_failed ON tasks(project_id, created_at DESC)
    WHERE status = 'failed';

-- Successful iterations
CREATE INDEX IF NOT EXISTS idx_generation_iterations_successful ON generation_iterations(project_id, created_at DESC)
    WHERE success = true;

-- ============================================
-- Composite indexes for dashboard queries
-- ============================================

-- User's projects with latest update
CREATE INDEX IF NOT EXISTS idx_projects_dashboard ON projects(user_id, updated_at DESC, status)
    WHERE status != 'deleted';

-- User's recent tasks
CREATE INDEX IF NOT EXISTS idx_tasks_recent ON tasks(user_id, updated_at DESC)
    WHERE status IN ('completed', 'failed');

-- ============================================
-- Analyze tables after creating indexes
-- ============================================
ANALYZE projects;
ANALYZE tasks;
ANALYZE generation_iterations;
ANALYZE testing_iterations;
ANALYZE learned_patterns;
ANALYZE code_embeddings;
ANALYZE knowledge_embeddings;
ANALYZE audit_logs;
ANALYZE users;
ANALYZE project_contexts;
