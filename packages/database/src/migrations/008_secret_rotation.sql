-- ============================================
-- Phase 19.6: Secret Rotation & Vault Support
-- ============================================
-- This migration adds support for:
-- 1. Secret versioning and rotation
-- 2. Request signing audit
-- 3. Vault integration metadata
-- ============================================

-- ============================================
-- SECRET VERSIONS TABLE
-- ============================================
-- Stores all versions of secrets for rotation
CREATE TABLE IF NOT EXISTS secret_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL CHECK (type IN ('jwt', 'encryption', 'api_key', 'csrf', 'oauth')),
    version INTEGER NOT NULL,
    secret_encrypted TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_primary BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    rotated_by TEXT DEFAULT 'system',
    metadata JSONB DEFAULT '{}',
    
    -- Ensure unique version per type
    UNIQUE(type, version)
);

-- Indexes for secret_versions
CREATE INDEX IF NOT EXISTS idx_secret_versions_type ON secret_versions(type);
CREATE INDEX IF NOT EXISTS idx_secret_versions_active ON secret_versions(type, is_active);
CREATE INDEX IF NOT EXISTS idx_secret_versions_primary ON secret_versions(type, is_primary) WHERE is_primary = TRUE;
CREATE INDEX IF NOT EXISTS idx_secret_versions_expires ON secret_versions(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================
-- REQUEST SIGNATURES AUDIT TABLE
-- ============================================
-- Tracks signed requests for security monitoring
CREATE TABLE IF NOT EXISTS request_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
    signature_hash TEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    nonce TEXT NOT NULL UNIQUE,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for signature lookups
CREATE INDEX IF NOT EXISTS idx_request_signatures_nonce ON request_signatures(nonce);
CREATE INDEX IF NOT EXISTS idx_request_signatures_api_key ON request_signatures(api_key_id);
CREATE INDEX IF NOT EXISTS idx_request_signatures_timestamp ON request_signatures(timestamp);

-- Auto-cleanup old signatures (older than 24 hours)
-- This can be run periodically via a cron job or Supabase function
-- DELETE FROM request_signatures WHERE created_at < NOW() - INTERVAL '24 hours';

-- ============================================
-- VAULT METADATA TABLE
-- ============================================
-- Tracks vault integration status and configuration
CREATE TABLE IF NOT EXISTS vault_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider TEXT NOT NULL CHECK (provider IN ('hashicorp', 'aws', 'azure', 'env')),
    path TEXT NOT NULL,
    key_name TEXT NOT NULL,
    last_synced_at TIMESTAMPTZ,
    sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed', 'stale')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Unique path/key per provider
    UNIQUE(provider, path, key_name)
);

-- Index for vault metadata
CREATE INDEX IF NOT EXISTS idx_vault_metadata_provider ON vault_metadata(provider);
CREATE INDEX IF NOT EXISTS idx_vault_metadata_status ON vault_metadata(sync_status);

-- ============================================
-- ROTATION SCHEDULE TABLE
-- ============================================
-- Configures automatic rotation schedules
CREATE TABLE IF NOT EXISTS rotation_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    secret_type TEXT NOT NULL UNIQUE CHECK (secret_type IN ('jwt', 'encryption', 'api_key', 'csrf', 'oauth')),
    rotation_interval_days INTEGER NOT NULL DEFAULT 30,
    grace_period_days INTEGER NOT NULL DEFAULT 7,
    auto_rotate BOOLEAN DEFAULT TRUE,
    last_rotation_at TIMESTAMPTZ,
    next_rotation_at TIMESTAMPTZ,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Insert default rotation schedules
INSERT INTO rotation_schedules (secret_type, rotation_interval_days, grace_period_days, auto_rotate)
VALUES
    ('jwt', 30, 7, TRUE),
    ('encryption', 90, 14, TRUE),
    ('csrf', 30, 7, TRUE),
    ('oauth', 60, 14, TRUE),
    ('api_key', 90, 30, FALSE)
ON CONFLICT (secret_type) DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Secret versions - only service role can access
ALTER TABLE secret_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for secret_versions"
    ON secret_versions FOR ALL
    USING (auth.role() = 'service_role');

-- Request signatures - service role only
ALTER TABLE request_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for request_signatures"
    ON request_signatures FOR ALL
    USING (auth.role() = 'service_role');

-- Vault metadata - service role only
ALTER TABLE vault_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for vault_metadata"
    ON vault_metadata FOR ALL
    USING (auth.role() = 'service_role');

-- Rotation schedules - service role only
ALTER TABLE rotation_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for rotation_schedules"
    ON rotation_schedules FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamp trigger for vault_metadata
CREATE OR REPLACE FUNCTION update_vault_metadata_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vault_metadata_updated
    BEFORE UPDATE ON vault_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_vault_metadata_timestamp();

-- Update timestamp trigger for rotation_schedules
CREATE TRIGGER rotation_schedules_updated
    BEFORE UPDATE ON rotation_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_vault_metadata_timestamp();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get the current primary secret for a type
CREATE OR REPLACE FUNCTION get_primary_secret(p_type TEXT)
RETURNS TEXT AS $$
DECLARE
    v_secret TEXT;
BEGIN
    SELECT secret_encrypted INTO v_secret
    FROM secret_versions
    WHERE type = p_type AND is_active = TRUE AND is_primary = TRUE
    ORDER BY version DESC
    LIMIT 1;
    
    RETURN v_secret;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if rotation is needed
CREATE OR REPLACE FUNCTION check_rotation_needed(p_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_next_rotation TIMESTAMPTZ;
BEGIN
    SELECT next_rotation_at INTO v_next_rotation
    FROM rotation_schedules
    WHERE secret_type = p_type AND enabled = TRUE;
    
    IF v_next_rotation IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN v_next_rotation <= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE secret_versions IS 'Stores all versions of rotated secrets with active/primary status';
COMMENT ON TABLE request_signatures IS 'Audit log for signed API requests to prevent replay attacks';
COMMENT ON TABLE vault_metadata IS 'Tracks external vault provider integration status';
COMMENT ON TABLE rotation_schedules IS 'Configures automatic secret rotation intervals';
