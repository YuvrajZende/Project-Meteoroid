-- =====================================================
-- BENCHMARKING MIGRATION (Phase 11)
-- =====================================================
-- Stores agent benchmarks, orchestrator metrics, and AI performance data

-- =====================================================
-- AGENT BENCHMARKS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS agent_benchmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Agent info
    agent_id TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    
    -- Execution metrics
    execution_time INTEGER NOT NULL DEFAULT 0, -- milliseconds
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error TEXT,
    
    -- Token usage
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    
    -- Output metrics
    files_generated INTEGER NOT NULL DEFAULT 0,
    code_quality_score INTEGER, -- 0-100
    
    -- Context
    task_id TEXT,
    project_id UUID,
    user_id UUID,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_agent_benchmarks_agent_id ON agent_benchmarks(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_benchmarks_created_at ON agent_benchmarks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_benchmarks_success ON agent_benchmarks(success);

-- =====================================================
-- ORCHESTRATOR METRICS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS orchestrator_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Task info
    task_id TEXT NOT NULL,
    project_id UUID,
    user_id UUID,
    
    -- Timing metrics
    total_duration INTEGER NOT NULL DEFAULT 0, -- milliseconds
    thinking_time INTEGER NOT NULL DEFAULT 0,
    coordination_time INTEGER NOT NULL DEFAULT 0,
    
    -- Execution metrics
    agents_used TEXT[] NOT NULL DEFAULT '{}',
    subtasks_count INTEGER NOT NULL DEFAULT 0,
    files_generated INTEGER NOT NULL DEFAULT 0,
    
    -- Quality metrics
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error TEXT,
    
    -- Token usage
    total_tokens INTEGER NOT NULL DEFAULT 0,
    total_cost NUMERIC(10, 8) NOT NULL DEFAULT 0,
    
    -- Multi-model info
    analysis_model TEXT,
    generation_model TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_orchestrator_metrics_task_id ON orchestrator_metrics(task_id);
CREATE INDEX IF NOT EXISTS idx_orchestrator_metrics_created_at ON orchestrator_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orchestrator_metrics_success ON orchestrator_metrics(success);

-- =====================================================
-- AI MODEL PERFORMANCE TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_model_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Model info
    model_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    provider TEXT NOT NULL,
    
    -- Aggregated metrics (updated periodically)
    total_requests INTEGER NOT NULL DEFAULT 0,
    successful_requests INTEGER NOT NULL DEFAULT 0,
    failed_requests INTEGER NOT NULL DEFAULT 0,
    
    -- Token metrics
    total_input_tokens BIGINT NOT NULL DEFAULT 0,
    total_output_tokens BIGINT NOT NULL DEFAULT 0,
    avg_tokens_per_request INTEGER NOT NULL DEFAULT 0,
    
    -- Cost metrics
    total_cost NUMERIC(10, 4) NOT NULL DEFAULT 0,
    avg_cost_per_request NUMERIC(10, 6) NOT NULL DEFAULT 0,
    
    -- Performance metrics
    avg_latency_ms INTEGER NOT NULL DEFAULT 0,
    p50_latency_ms INTEGER,
    p95_latency_ms INTEGER,
    p99_latency_ms INTEGER,
    
    -- Time period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_model_performance_model_id ON ai_model_performance(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_model_performance_provider ON ai_model_performance(provider);
CREATE INDEX IF NOT EXISTS idx_ai_model_performance_period ON ai_model_performance(period_start, period_end);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get agent performance summary
CREATE OR REPLACE FUNCTION get_agent_performance(p_agent_id TEXT DEFAULT NULL, p_days INTEGER DEFAULT 7)
RETURNS TABLE (
    agent_id TEXT,
    agent_name TEXT,
    total_executions BIGINT,
    success_rate NUMERIC,
    avg_execution_time NUMERIC,
    avg_tokens NUMERIC,
    total_files BIGINT
)
LANGUAGE sql STABLE
AS $$
    SELECT 
        agent_id,
        agent_name,
        COUNT(*) as total_executions,
        ROUND(COUNT(*) FILTER (WHERE success) * 100.0 / NULLIF(COUNT(*), 0), 2) as success_rate,
        ROUND(AVG(execution_time), 2) as avg_execution_time,
        ROUND(AVG(total_tokens), 2) as avg_tokens,
        SUM(files_generated) as total_files
    FROM agent_benchmarks
    WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL
      AND (p_agent_id IS NULL OR agent_id = p_agent_id)
    GROUP BY agent_id, agent_name
    ORDER BY total_executions DESC;
$$;

-- Function to get orchestrator performance summary
CREATE OR REPLACE FUNCTION get_orchestrator_performance(p_days INTEGER DEFAULT 7)
RETURNS TABLE (
    total_tasks BIGINT,
    success_rate NUMERIC,
    avg_duration NUMERIC,
    avg_agents_per_task NUMERIC,
    total_cost NUMERIC
)
LANGUAGE sql STABLE
AS $$
    SELECT 
        COUNT(*) as total_tasks,
        ROUND(COUNT(*) FILTER (WHERE success) * 100.0 / NULLIF(COUNT(*), 0), 2) as success_rate,
        ROUND(AVG(total_duration), 2) as avg_duration,
        ROUND(AVG(CARDINALITY(agents_used)), 2) as avg_agents_per_task,
        SUM(total_cost) as total_cost
    FROM orchestrator_metrics
    WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL;
$$;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE agent_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE orchestrator_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_performance ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service full access to agent_benchmarks"
    ON agent_benchmarks FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service full access to orchestrator_metrics"
    ON orchestrator_metrics FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service full access to ai_model_performance"
    ON ai_model_performance FOR ALL
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE agent_benchmarks IS 'Tracks individual agent execution benchmarks';
COMMENT ON TABLE orchestrator_metrics IS 'Tracks overall orchestration performance';
COMMENT ON TABLE ai_model_performance IS 'Aggregated AI model performance metrics';

-- =====================================================
-- RELOAD SCHEMA CACHE
-- =====================================================
NOTIFY pgrst, 'reload config';
