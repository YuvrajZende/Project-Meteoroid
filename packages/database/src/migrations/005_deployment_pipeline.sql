-- =====================================================
-- PHASE 15: DEPLOYMENT PIPELINE MIGRATION
-- =====================================================
-- Description: Tables for tracking deployments and GitHub integrations
-- Created: Phase 15.4

-- =====================================================
-- ENABLE UUID EXTENSION (if not already)
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- DEPLOYMENT SITES TABLE
-- =====================================================
-- Stores connected deployment sites (Netlify/Vercel sites)

CREATE TABLE IF NOT EXISTS deployment_sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Project reference
    project_id UUID NOT NULL,
    
    -- Site details
    provider TEXT NOT NULL CHECK (provider IN ('netlify', 'vercel')),
    provider_site_id TEXT NOT NULL,
    site_name TEXT NOT NULL,
    site_url TEXT,
    admin_url TEXT,
    
    -- Configuration
    auto_deploy BOOLEAN NOT NULL DEFAULT FALSE,
    production_branch TEXT DEFAULT 'main',
    
    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'deleted')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Constraints
    UNIQUE (provider, provider_site_id)
);

-- =====================================================
-- DEPLOYMENTS TABLE
-- =====================================================
-- Stores individual deployment records

CREATE TABLE IF NOT EXISTS deployments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    site_id UUID NOT NULL REFERENCES deployment_sites(id) ON DELETE CASCADE,
    project_id UUID NOT NULL,
    user_id UUID,
    
    -- Deployment details
    provider TEXT NOT NULL CHECK (provider IN ('netlify', 'vercel')),
    provider_deploy_id TEXT NOT NULL,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'building', 'ready', 'error', 'cancelled')),
    
    -- URLs
    url TEXT,
    preview_url TEXT,
    deploy_url TEXT,
    admin_url TEXT,
    
    -- Git info
    commit_sha TEXT,
    commit_message TEXT,
    branch TEXT,
    
    -- Build metrics
    build_time_ms INTEGER,
    file_count INTEGER,
    
    -- Error tracking
    error_message TEXT,
    
    -- Metadata
    is_production BOOLEAN NOT NULL DEFAULT FALSE,
    triggered_by TEXT DEFAULT 'manual' CHECK (triggered_by IN ('manual', 'auto', 'webhook', 'rollback')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deployed_at TIMESTAMPTZ,
    
    -- Constraints
    UNIQUE (provider, provider_deploy_id)
);

-- =====================================================
-- GITHUB CONNECTIONS TABLE
-- =====================================================
-- Stores GitHub OAuth tokens and repository connections

CREATE TABLE IF NOT EXISTS github_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User reference
    user_id UUID NOT NULL,
    
    -- GitHub user info
    github_user_id INTEGER NOT NULL,
    github_username TEXT NOT NULL,
    github_email TEXT,
    github_avatar_url TEXT,
    
    -- Token (encrypted in application layer)
    encrypted_access_token TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ,
    
    -- Scopes granted
    scopes TEXT[] DEFAULT ARRAY['repo', 'user:email'],
    
    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_used_at TIMESTAMPTZ,
    
    -- Constraints
    UNIQUE (user_id, github_user_id)
);

-- =====================================================
-- GITHUB REPOSITORIES TABLE
-- =====================================================
-- Stores linked GitHub repositories for projects

CREATE TABLE IF NOT EXISTS github_repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    project_id UUID NOT NULL,
    connection_id UUID NOT NULL REFERENCES github_connections(id) ON DELETE CASCADE,
    
    -- Repository info
    github_repo_id INTEGER NOT NULL,
    owner TEXT NOT NULL,
    repo_name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    
    -- URLs
    html_url TEXT NOT NULL,
    clone_url TEXT,
    ssh_url TEXT,
    
    -- Settings
    default_branch TEXT DEFAULT 'main',
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    auto_commit BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Webhook
    webhook_id INTEGER,
    webhook_secret TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_commit_at TIMESTAMPTZ,
    
    -- Constraints
    UNIQUE (project_id),
    UNIQUE (github_repo_id)
);

-- =====================================================
-- DEPLOYMENT LOGS TABLE
-- =====================================================
-- Stores build logs and events for deployments

CREATE TABLE IF NOT EXISTS deployment_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Reference
    deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    
    -- Log entry
    level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('debug', 'info', 'warn', 'error')),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Deployment sites
CREATE INDEX IF NOT EXISTS idx_deployment_sites_project_id 
    ON deployment_sites(project_id);
CREATE INDEX IF NOT EXISTS idx_deployment_sites_provider 
    ON deployment_sites(provider);

-- Deployments
CREATE INDEX IF NOT EXISTS idx_deployments_site_id 
    ON deployments(site_id);
CREATE INDEX IF NOT EXISTS idx_deployments_project_id 
    ON deployments(project_id);
CREATE INDEX IF NOT EXISTS idx_deployments_status 
    ON deployments(status);
CREATE INDEX IF NOT EXISTS idx_deployments_created_at 
    ON deployments(created_at DESC);

-- GitHub connections
CREATE INDEX IF NOT EXISTS idx_github_connections_user_id 
    ON github_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_github_connections_github_user_id 
    ON github_connections(github_user_id);

-- GitHub repositories
CREATE INDEX IF NOT EXISTS idx_github_repositories_project_id 
    ON github_repositories(project_id);
CREATE INDEX IF NOT EXISTS idx_github_repositories_connection_id 
    ON github_repositories(connection_id);

-- Deployment logs
CREATE INDEX IF NOT EXISTS idx_deployment_logs_deployment_id 
    ON deployment_logs(deployment_id);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_created_at 
    ON deployment_logs(created_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE deployment_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_logs ENABLE ROW LEVEL SECURITY;

-- Service role full access policies
CREATE POLICY "Service full access to deployment_sites"
    ON deployment_sites FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service full access to deployments"
    ON deployments FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service full access to github_connections"
    ON github_connections FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service full access to github_repositories"
    ON github_repositories FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service full access to deployment_logs"
    ON deployment_logs FOR ALL
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE deployment_sites IS 'Connected deployment sites (Netlify/Vercel)';
COMMENT ON TABLE deployments IS 'Individual deployment records with status and URLs';
COMMENT ON TABLE github_connections IS 'GitHub OAuth connections for users';
COMMENT ON TABLE github_repositories IS 'Linked GitHub repositories for projects';
COMMENT ON TABLE deployment_logs IS 'Build logs and events for deployments';

-- =====================================================
-- RELOAD SCHEMA CACHE
-- =====================================================
NOTIFY pgrst, 'reload config';
