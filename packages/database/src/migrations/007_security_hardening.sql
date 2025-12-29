-- =====================================================
-- SECURITY HARDENING MIGRATION (Phase 19)
-- =====================================================
-- Description: Adds tables for JWT refresh tokens, API keys,
-- encrypted secrets, MFA, and audit logging enhancements
-- 
-- Run this migration in Supabase SQL Editor

-- =====================================================
-- REFRESH TOKENS TABLE
-- =====================================================
-- Stores refresh tokens with family tracking for rotation detection

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Token data (hashed, never stored in plain text)
    token_hash TEXT NOT NULL UNIQUE,
    
    -- User reference
    user_id UUID NOT NULL,
    
    -- Token family for rotation detection
    -- If a token from old family is used, all tokens in family are revoked
    family_id UUID NOT NULL,
    
    -- Expiration and status
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    revoked_at TIMESTAMPTZ,
    
    -- If this token was rotated, reference to the new token
    replaced_by UUID REFERENCES refresh_tokens(id),
    
    -- Device/session info for security
    ip_address INET,
    user_agent TEXT,
    device_name TEXT
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash 
    ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id 
    ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_id 
    ON refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at 
    ON refresh_tokens(expires_at);

-- Enable RLS
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service full access to refresh_tokens"
    ON refresh_tokens FOR ALL
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE refresh_tokens IS 'Stores JWT refresh tokens with rotation family tracking';

-- =====================================================
-- API KEYS TABLE
-- =====================================================
-- Stores API keys for programmatic access

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Key data (only hash stored, prefix shown to user)
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL, -- e.g., "lvb_abc..." for display
    
    -- User reference
    user_id UUID NOT NULL,
    
    -- Key metadata
    name TEXT NOT NULL,
    description TEXT,
    
    -- Permissions
    scopes TEXT[] NOT NULL DEFAULT ARRAY['read'],
    
    -- Rate limits (per key)
    rate_limit_per_minute INTEGER DEFAULT 60,
    
    -- Usage tracking
    last_used_at TIMESTAMPTZ,
    use_count BIGINT DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash 
    ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id 
    ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active 
    ON api_keys(is_active);

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service full access to api_keys"
    ON api_keys FOR ALL
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE api_keys IS 'Stores API keys for programmatic access with scopes and rate limits';

-- =====================================================
-- ENCRYPTED SECRETS TABLE
-- =====================================================
-- Stores encrypted sensitive data (tokens, credentials, etc.)

CREATE TABLE IF NOT EXISTS encrypted_secrets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Owner
    user_id UUID NOT NULL,
    project_id UUID,
    
    -- Secret identification
    secret_type TEXT NOT NULL, -- e.g., 'github_token', 'api_key', 'webhook_secret'
    secret_name TEXT NOT NULL,
    
    -- Encrypted data (base64-encoded AES-256-GCM ciphertext)
    encrypted_value TEXT NOT NULL,
    
    -- Search hash (HMAC of plaintext for lookup without decryption)
    value_hash TEXT,
    
    -- Metadata (not encrypted)
    metadata JSONB DEFAULT '{}',
    
    -- Key version (for key rotation)
    encryption_key_version INTEGER DEFAULT 1,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Unique constraint per user/project/type/name
    UNIQUE(user_id, project_id, secret_type, secret_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_encrypted_secrets_user_id 
    ON encrypted_secrets(user_id);
CREATE INDEX IF NOT EXISTS idx_encrypted_secrets_project_id 
    ON encrypted_secrets(project_id);
CREATE INDEX IF NOT EXISTS idx_encrypted_secrets_type 
    ON encrypted_secrets(secret_type);
CREATE INDEX IF NOT EXISTS idx_encrypted_secrets_value_hash 
    ON encrypted_secrets(value_hash);

-- Enable RLS
ALTER TABLE encrypted_secrets ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service full access to encrypted_secrets"
    ON encrypted_secrets FOR ALL
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE encrypted_secrets IS 'Stores encrypted sensitive data using AES-256-GCM';

-- =====================================================
-- MFA (Multi-Factor Authentication) TABLE
-- =====================================================
-- Stores MFA settings and backup codes

CREATE TABLE IF NOT EXISTS user_mfa (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User reference
    user_id UUID NOT NULL UNIQUE,
    
    -- MFA status
    mfa_enabled BOOLEAN DEFAULT FALSE,
    
    -- TOTP secret (encrypted)
    totp_secret_encrypted TEXT,
    
    -- Backup codes (hashed)
    backup_codes_hashed TEXT[],
    
    -- Recovery
    recovery_email TEXT,
    
    -- Verification status
    verified_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE user_mfa ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service full access to user_mfa"
    ON user_mfa FOR ALL
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE user_mfa IS 'Stores MFA configuration and backup codes for users';

-- =====================================================
-- SECURITY EVENTS TABLE
-- =====================================================
-- Logs security-related events for auditing

CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Event type
    event_type TEXT NOT NULL, -- 'login', 'logout', 'token_refresh', 'password_change', 'mfa_setup', 'suspicious_activity'
    
    -- User (nullable for pre-auth events)
    user_id UUID,
    
    -- Request context
    ip_address INET,
    user_agent TEXT,
    
    -- Event details
    success BOOLEAN NOT NULL,
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Risk assessment
    risk_score INTEGER DEFAULT 0, -- 0-100
    flagged BOOLEAN DEFAULT FALSE,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_security_events_user_id 
    ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type 
    ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at 
    ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_flagged 
    ON security_events(flagged) WHERE flagged = TRUE;
CREATE INDEX IF NOT EXISTS idx_security_events_ip 
    ON security_events(ip_address);

-- Enable RLS
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service full access to security_events"
    ON security_events FOR ALL
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE security_events IS 'Logs all security-related events for auditing and threat detection';

-- =====================================================
-- IP BLOCKLIST TABLE
-- =====================================================
-- Stores blocked IP addresses

CREATE TABLE IF NOT EXISTS ip_blocklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- IP address or CIDR range
    ip_address INET NOT NULL,
    
    -- Reason for block
    reason TEXT NOT NULL,
    blocked_by TEXT, -- 'auto' or user_id
    
    -- Expiry (NULL = permanent)
    expires_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    UNIQUE(ip_address)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ip_blocklist_ip 
    ON ip_blocklist(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_blocklist_expires_at 
    ON ip_blocklist(expires_at);

-- Enable RLS
ALTER TABLE ip_blocklist ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service full access to ip_blocklist"
    ON ip_blocklist FOR ALL
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE ip_blocklist IS 'Stores blocked IP addresses and CIDR ranges';

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to clean up expired refresh tokens
CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM refresh_tokens 
    WHERE expires_at < NOW() - INTERVAL '1 day'
    OR revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to revoke all tokens in a family
CREATE OR REPLACE FUNCTION revoke_token_family(p_family_id UUID)
RETURNS INTEGER AS $$
DECLARE
    revoked_count INTEGER;
BEGIN
    UPDATE refresh_tokens 
    SET revoked_at = NOW()
    WHERE family_id = p_family_id
    AND revoked_at IS NULL;
    
    GET DIAGNOSTICS revoked_count = ROW_COUNT;
    RETURN revoked_count;
END;
$$ LANGUAGE plpgsql;

-- Function to log security event
CREATE OR REPLACE FUNCTION log_security_event(
    p_event_type TEXT,
    p_user_id UUID,
    p_success BOOLEAN,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_failure_reason TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    event_id UUID;
    risk INTEGER;
BEGIN
    -- Calculate basic risk score
    risk := 0;
    IF NOT p_success THEN
        risk := risk + 30;
    END IF;
    IF p_event_type IN ('password_change', 'mfa_disable') THEN
        risk := risk + 20;
    END IF;
    
    INSERT INTO security_events (
        event_type, user_id, ip_address, user_agent,
        success, failure_reason, metadata, risk_score
    ) VALUES (
        p_event_type, p_user_id, p_ip_address, p_user_agent,
        p_success, p_failure_reason, p_metadata, risk
    )
    RETURNING id INTO event_id;
    
    RETURN event_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at for api_keys
CREATE OR REPLACE FUNCTION update_api_keys_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_api_keys_timestamp ON api_keys;
CREATE TRIGGER trigger_update_api_keys_timestamp
    BEFORE UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_api_keys_timestamp();

-- Auto-update updated_at for encrypted_secrets
DROP TRIGGER IF EXISTS trigger_update_encrypted_secrets_timestamp ON encrypted_secrets;
CREATE TRIGGER trigger_update_encrypted_secrets_timestamp
    BEFORE UPDATE ON encrypted_secrets
    FOR EACH ROW
    EXECUTE FUNCTION update_api_keys_timestamp();

-- Auto-update updated_at for user_mfa
DROP TRIGGER IF EXISTS trigger_update_user_mfa_timestamp ON user_mfa;
CREATE TRIGGER trigger_update_user_mfa_timestamp
    BEFORE UPDATE ON user_mfa
    FOR EACH ROW
    EXECUTE FUNCTION update_api_keys_timestamp();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION cleanup_expired_refresh_tokens IS 'Removes expired and revoked refresh tokens';
COMMENT ON FUNCTION revoke_token_family IS 'Revokes all tokens in a token family (for rotation security)';
COMMENT ON FUNCTION log_security_event IS 'Logs a security event with automatic risk scoring';

-- =====================================================
-- RELOAD SCHEMA CACHE (Required for Supabase)
-- =====================================================
NOTIFY pgrst, 'reload config';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Tables created:
-- - refresh_tokens: JWT refresh token storage with rotation
-- - api_keys: API key management with scopes
-- - encrypted_secrets: Encrypted sensitive data storage
-- - user_mfa: Multi-factor authentication settings
-- - security_events: Security audit log
-- - ip_blocklist: Blocked IP addresses
--
-- Functions created:
-- - cleanup_expired_refresh_tokens()
-- - revoke_token_family(family_id)
-- - log_security_event(...)
