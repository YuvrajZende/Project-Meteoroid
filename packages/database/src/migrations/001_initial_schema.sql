-- =====================================================
-- LOVEABLE BACKEND - DATABASE MIGRATIONS
-- Run this migration in Supabase SQL Editor
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";

-- =====================================================
-- ENUMS
-- =====================================================

-- User tier enum
CREATE TYPE user_tier AS ENUM ('free', 'pro', 'enterprise');

-- Project status enum
CREATE TYPE project_status AS ENUM ('pending', 'generating', 'completed', 'failed');

-- Task status enum
CREATE TYPE task_status AS ENUM ('queued', 'processing', 'completed', 'failed');

-- =====================================================
-- TABLES
-- =====================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    tier user_tier DEFAULT 'free' NOT NULL,
    api_quota_used INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index on email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    config JSONB DEFAULT '{}' NOT NULL,
    status project_status DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for projects
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- Tasks table (Job Queue Metadata)
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    prompt TEXT NOT NULL,
    status task_status DEFAULT 'queued' NOT NULL,
    progress INTEGER DEFAULT 0 NOT NULL CHECK (progress >= 0 AND progress <= 100),
    result JSONB,
    error TEXT,
    agents_used TEXT[] DEFAULT '{}' NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for tasks
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    scopes TEXT[] DEFAULT '{read}' NOT NULL,
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for API keys
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);

-- Knowledge embeddings table (Vector Store)
CREATE TABLE IF NOT EXISTS knowledge_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    embedding vector(1536) NOT NULL, -- OpenAI embedding dimension
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create vector similarity index
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_embedding 
ON knowledge_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Vector similarity search function
CREATE OR REPLACE FUNCTION match_embeddings(
    query_embedding vector(1536),
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    similarity float,
    metadata JSONB
)
LANGUAGE sql STABLE
AS $$
    SELECT
        knowledge_embeddings.id,
        knowledge_embeddings.content,
        1 - (knowledge_embeddings.embedding <=> query_embedding) AS similarity,
        knowledge_embeddings.metadata
    FROM knowledge_embeddings
    WHERE 1 - (knowledge_embeddings.embedding <=> query_embedding) > match_threshold
    ORDER BY knowledge_embeddings.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- Increment quota function
CREATE OR REPLACE FUNCTION increment_quota(user_id UUID, amount INTEGER)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE users 
    SET api_quota_used = api_quota_used + amount,
        updated_at = NOW()
    WHERE id = user_id;
END;
$$;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_embeddings ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can read own data"
    ON users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
    ON users FOR UPDATE
    USING (auth.uid() = id);

-- Projects policies
CREATE POLICY "Users can read own projects"
    ON projects FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects"
    ON projects FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
    ON projects FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
    ON projects FOR DELETE
    USING (auth.uid() = user_id);

-- Tasks policies
CREATE POLICY "Users can read own tasks"
    ON tasks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks"
    ON tasks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
    ON tasks FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks"
    ON tasks FOR DELETE
    USING (auth.uid() = user_id);

-- Audit logs policies (read-only for users)
CREATE POLICY "Users can read own audit logs"
    ON audit_logs FOR SELECT
    USING (auth.uid() = user_id);

-- API Keys policies
CREATE POLICY "Users can read own API keys"
    ON api_keys FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own API keys"
    ON api_keys FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own API keys"
    ON api_keys FOR DELETE
    USING (auth.uid() = user_id);

-- Knowledge embeddings - allow all authenticated users to read
CREATE POLICY "Authenticated users can read embeddings"
    ON knowledge_embeddings FOR SELECT
    USING (auth.role() = 'authenticated');

-- =====================================================
-- SERVICE ROLE BYPASS
-- These policies allow service role to bypass RLS
-- =====================================================
-- Note: Service role automatically bypasses RLS in Supabase
-- No additional policies needed

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE users IS 'User profiles linked to Supabase Auth';
COMMENT ON TABLE projects IS 'User projects for code generation';
COMMENT ON TABLE tasks IS 'Job queue metadata for generation tasks';
COMMENT ON TABLE audit_logs IS 'Immutable audit trail for security events';
COMMENT ON TABLE api_keys IS 'User-generated API keys for programmatic access';
COMMENT ON TABLE knowledge_embeddings IS 'Vector embeddings for RAG and similarity search';
