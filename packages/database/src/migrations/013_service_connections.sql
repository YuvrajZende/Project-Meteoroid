-- ============================================================
-- Migration: 013_service_connections.sql
-- Description: Add Service Integration Framework tables
-- Phase: 21 - Service Integration
-- Priority: HIGH
-- Dependencies: None
-- ============================================================

-- ============================================================
-- TABLE: user_service_connections
-- Purpose: Store user's configured service connections
-- ============================================================
CREATE TABLE IF NOT EXISTS user_service_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id VARCHAR(100) NOT NULL,          -- e.g., 'supabase', 'auth0', 'sentry'
  connection_name VARCHAR(255) NOT NULL,     -- User-friendly name like "Production DB"
  credentials JSONB NOT NULL,                -- Encrypted credentials (via Vault)
  metadata JSONB DEFAULT '{}'::jsonb,        -- Additional config (region, tier, etc.)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  last_health_check TIMESTAMPTZ,
  health_status VARCHAR(20) DEFAULT 'unknown', -- 'healthy', 'unhealthy', 'unknown'
  
  -- Ensure unique connection per user/service/name combo
  CONSTRAINT unique_user_service_connection UNIQUE(user_id, service_id, connection_name)
);

-- Add comments for documentation
COMMENT ON TABLE user_service_connections IS 'Stores user-configured third-party service connections with encrypted credentials';
COMMENT ON COLUMN user_service_connections.credentials IS 'Encrypted using Supabase Vault - never store plain text';
COMMENT ON COLUMN user_service_connections.health_status IS 'Last known connection health: healthy, unhealthy, or unknown';

-- ============================================================
-- TABLE: service_usage_logs
-- Purpose: Track service usage for analytics and debugging
-- ============================================================
CREATE TABLE IF NOT EXISTS service_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES user_service_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id VARCHAR(100) NOT NULL,
  operation VARCHAR(100),                    -- e.g., 'query', 'insert', 'auth.login'
  success BOOLEAN NOT NULL,
  duration_ms INTEGER,
  error_message TEXT,
  request_metadata JSONB DEFAULT '{}'::jsonb, -- Request details (sanitized)
  response_metadata JSONB DEFAULT '{}'::jsonb, -- Response summary
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE service_usage_logs IS 'Tracks all service operations for analytics, debugging, and usage limits';

-- ============================================================
-- INDEXES for Performance
-- ============================================================

-- user_service_connections indexes
CREATE INDEX IF NOT EXISTS idx_user_service_connections_user_id 
  ON user_service_connections(user_id);

CREATE INDEX IF NOT EXISTS idx_user_service_connections_service_id 
  ON user_service_connections(service_id);

CREATE INDEX IF NOT EXISTS idx_user_service_connections_active 
  ON user_service_connections(user_id, is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_service_connections_health 
  ON user_service_connections(health_status, last_health_check);

-- service_usage_logs indexes
CREATE INDEX IF NOT EXISTS idx_service_usage_logs_user_id 
  ON service_usage_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_service_usage_logs_connection_id 
  ON service_usage_logs(connection_id);

CREATE INDEX IF NOT EXISTS idx_service_usage_logs_service_id 
  ON service_usage_logs(service_id);

CREATE INDEX IF NOT EXISTS idx_service_usage_logs_created_at 
  ON service_usage_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_usage_logs_success 
  ON service_usage_logs(user_id, success, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on both tables
ALTER TABLE user_service_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_usage_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own connections
CREATE POLICY user_service_connections_select_policy 
  ON user_service_connections
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY user_service_connections_insert_policy 
  ON user_service_connections
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_service_connections_update_policy 
  ON user_service_connections
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY user_service_connections_delete_policy 
  ON user_service_connections
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Policy: Users can only see their own usage logs
CREATE POLICY service_usage_logs_select_policy 
  ON service_usage_logs
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY service_usage_logs_insert_policy 
  ON service_usage_logs
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function: Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_service_connection_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update updated_at on user_service_connections
DROP TRIGGER IF EXISTS trigger_update_service_connection_timestamp ON user_service_connections;
CREATE TRIGGER trigger_update_service_connection_timestamp
  BEFORE UPDATE ON user_service_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_service_connection_timestamp();

-- Function: Get user's active connections by category
CREATE OR REPLACE FUNCTION get_user_connections_by_category(
  p_user_id UUID,
  p_category VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  service_id VARCHAR,
  connection_name VARCHAR,
  health_status VARCHAR,
  last_used_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    usc.id,
    usc.service_id,
    usc.connection_name,
    usc.health_status,
    usc.last_used_at
  FROM user_service_connections usc
  WHERE usc.user_id = p_user_id
    AND usc.is_active = true
  ORDER BY usc.last_used_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Log service usage
CREATE OR REPLACE FUNCTION log_service_usage(
  p_connection_id UUID,
  p_user_id UUID,
  p_service_id VARCHAR,
  p_operation VARCHAR,
  p_success BOOLEAN,
  p_duration_ms INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO service_usage_logs (
    connection_id,
    user_id,
    service_id,
    operation,
    success,
    duration_ms,
    error_message
  ) VALUES (
    p_connection_id,
    p_user_id,
    p_service_id,
    p_operation,
    p_success,
    p_duration_ms,
    p_error_message
  )
  RETURNING id INTO v_log_id;
  
  -- Update last_used_at on connection
  IF p_connection_id IS NOT NULL THEN
    UPDATE user_service_connections
    SET last_used_at = NOW()
    WHERE id = p_connection_id;
  END IF;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get service usage statistics
CREATE OR REPLACE FUNCTION get_service_usage_stats(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  service_id VARCHAR,
  total_calls BIGINT,
  successful_calls BIGINT,
  failed_calls BIGINT,
  avg_duration_ms NUMERIC,
  last_used_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sul.service_id,
    COUNT(*)::BIGINT as total_calls,
    COUNT(*) FILTER (WHERE sul.success = true)::BIGINT as successful_calls,
    COUNT(*) FILTER (WHERE sul.success = false)::BIGINT as failed_calls,
    ROUND(AVG(sul.duration_ms)::NUMERIC, 2) as avg_duration_ms,
    MAX(sul.created_at) as last_used_at
  FROM service_usage_logs sul
  WHERE sul.user_id = p_user_id
    AND sul.created_at > NOW() - (p_days || ' days')::INTERVAL
  GROUP BY sul.service_id
  ORDER BY total_calls DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_service_connections TO authenticated;
GRANT SELECT, INSERT ON service_usage_logs TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_connections_by_category TO authenticated;
GRANT EXECUTE ON FUNCTION log_service_usage TO authenticated;
GRANT EXECUTE ON FUNCTION get_service_usage_stats TO authenticated;

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 013_service_connections.sql completed successfully!';
  RAISE NOTICE '   - Created table: user_service_connections';
  RAISE NOTICE '   - Created table: service_usage_logs';
  RAISE NOTICE '   - Created indexes for performance';
  RAISE NOTICE '   - Enabled Row Level Security (RLS)';
  RAISE NOTICE '   - Created helper functions';
END $$;
