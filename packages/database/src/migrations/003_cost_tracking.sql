-- =====================================================
-- COST TRACKING MIGRATION (Phase 13)
-- =====================================================
-- Stores AI API costs for budgeting and optimization

-- =====================================================
-- COST RECORDS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS cost_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Model info
    model_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    provider TEXT NOT NULL,
    
    -- Token usage
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    cache_hit BOOLEAN DEFAULT FALSE,
    
    -- Cost in USD
    input_cost NUMERIC(10, 8) NOT NULL DEFAULT 0,
    output_cost NUMERIC(10, 8) NOT NULL DEFAULT 0,
    total_cost NUMERIC(10, 8) NOT NULL DEFAULT 0,
    
    -- Context
    task_id TEXT,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    stage TEXT NOT NULL CHECK (stage IN ('analysis', 'code-generation', 'context-preparation', 'other')),
    
    -- Performance
    latency_ms INTEGER NOT NULL DEFAULT 0,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for cost records
CREATE INDEX IF NOT EXISTS idx_cost_records_model_id ON cost_records(model_id);
CREATE INDEX IF NOT EXISTS idx_cost_records_provider ON cost_records(provider);
CREATE INDEX IF NOT EXISTS idx_cost_records_user_id ON cost_records(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_records_project_id ON cost_records(project_id);
CREATE INDEX IF NOT EXISTS idx_cost_records_created_at ON cost_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_records_stage ON cost_records(stage);

-- Index for daily/monthly aggregation queries (using date_trunc instead of DATE)
-- Note: We use a simple btree index on created_at instead of a functional index
-- because Supabase requires IMMUTABLE functions for index expressions

-- =====================================================
-- BUDGET LIMITS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS budget_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Budget limits (NULL = global/system limit)
    daily_limit_usd NUMERIC(10, 2) DEFAULT 10.00,
    monthly_limit_usd NUMERIC(10, 2) DEFAULT 100.00,
    alert_threshold NUMERIC(3, 2) DEFAULT 0.80 CHECK (alert_threshold >= 0 AND alert_threshold <= 1),
    hard_limit BOOLEAN DEFAULT FALSE,
    
    -- Current usage (cached, updated periodically)
    current_daily_usd NUMERIC(10, 4) DEFAULT 0,
    current_monthly_usd NUMERIC(10, 4) DEFAULT 0,
    last_reset_daily TIMESTAMPTZ DEFAULT NOW(),
    last_reset_monthly TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Unique constraint: one limit per user (NULL = system default)
    UNIQUE(user_id)
);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get daily cost for a user
CREATE OR REPLACE FUNCTION get_daily_cost(p_user_id UUID DEFAULT NULL)
RETURNS NUMERIC
LANGUAGE sql STABLE
AS $$
    SELECT COALESCE(SUM(total_cost), 0)
    FROM cost_records
    WHERE (p_user_id IS NULL OR user_id = p_user_id)
      AND created_at >= CURRENT_DATE::timestamptz;
$$;

-- Function to get monthly cost for a user
CREATE OR REPLACE FUNCTION get_monthly_cost(p_user_id UUID DEFAULT NULL)
RETURNS NUMERIC
LANGUAGE sql STABLE
AS $$
    SELECT COALESCE(SUM(total_cost), 0)
    FROM cost_records
    WHERE (p_user_id IS NULL OR user_id = p_user_id)
      AND created_at >= DATE_TRUNC('month', NOW());
$$;

-- Function to get cost summary by model
CREATE OR REPLACE FUNCTION get_cost_by_model(
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours',
    p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    model_id TEXT,
    model_name TEXT,
    provider TEXT,
    total_requests BIGINT,
    total_cost NUMERIC,
    total_tokens BIGINT,
    avg_latency_ms NUMERIC
)
LANGUAGE sql STABLE
AS $$
    SELECT 
        model_id,
        model_name,
        provider,
        COUNT(*) as total_requests,
        SUM(total_cost) as total_cost,
        SUM(total_tokens) as total_tokens,
        AVG(latency_ms) as avg_latency_ms
    FROM cost_records
    WHERE created_at >= p_start_date AND created_at <= p_end_date
    GROUP BY model_id, model_name, provider
    ORDER BY total_cost DESC;
$$;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE cost_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_limits ENABLE ROW LEVEL SECURITY;

-- Cost records: Users can read their own + service role for inserts
DROP POLICY IF EXISTS "Users can read own cost records" ON cost_records;
CREATE POLICY "Users can read own cost records"
    ON cost_records FOR SELECT
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service can insert cost records" ON cost_records;
CREATE POLICY "Service can insert cost records"
    ON cost_records FOR INSERT
    WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Budget limits: Users can manage their own
DROP POLICY IF EXISTS "Users can read own budget" ON budget_limits;
CREATE POLICY "Users can read own budget"
    ON budget_limits FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can update own budget" ON budget_limits;
CREATE POLICY "Users can update own budget"
    ON budget_limits FOR UPDATE
    USING (auth.uid() = user_id);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at for budget_limits
DROP TRIGGER IF EXISTS update_budget_limits_updated_at ON budget_limits;
CREATE TRIGGER update_budget_limits_updated_at
    BEFORE UPDATE ON budget_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE cost_records IS 'Tracks all AI API costs for budgeting and optimization';
COMMENT ON TABLE budget_limits IS 'User-specific or system-wide budget limits';
COMMENT ON FUNCTION get_daily_cost IS 'Get total cost for current day';
COMMENT ON FUNCTION get_monthly_cost IS 'Get total cost for current month';
COMMENT ON FUNCTION get_cost_by_model IS 'Get cost breakdown by model';

-- =====================================================
-- RELOAD SCHEMA CACHE
-- =====================================================
NOTIFY pgrst, 'reload config';
