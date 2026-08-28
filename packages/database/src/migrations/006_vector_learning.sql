-- =====================================================
-- PHASE 18: VECTOR DATABASE & LEARNING SYSTEM
-- =====================================================
-- Description: Creates tables for code embeddings, 
-- AI learning iterations, and testing pre-context
-- Requires: pgvector extension (enabled in Supabase)

-- =====================================================
-- ENABLE PGVECTOR EXTENSION
-- =====================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- TABLE 1: CODE EMBEDDINGS
-- =====================================================
-- Stores vector embeddings for codebase indexing and
-- semantic similarity search

CREATE TABLE IF NOT EXISTS code_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Context
    project_id UUID NOT NULL,
    file_path TEXT NOT NULL,
    
    -- Content
    content TEXT NOT NULL,
    start_line INTEGER NOT NULL DEFAULT 1,
    end_line INTEGER NOT NULL DEFAULT 1,
    language TEXT NOT NULL DEFAULT 'text',
    
    -- Embedding (1536 dimensions for OpenAI text-embedding-3-small)
    embedding vector(1536) NOT NULL,
    embedding_model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for code_embeddings
CREATE INDEX IF NOT EXISTS idx_code_embeddings_project 
    ON code_embeddings(project_id);
CREATE INDEX IF NOT EXISTS idx_code_embeddings_file_path 
    ON code_embeddings(file_path);
CREATE INDEX IF NOT EXISTS idx_code_embeddings_language 
    ON code_embeddings(language);

-- Vector similarity index (IVFFlat for faster search)
CREATE INDEX IF NOT EXISTS idx_code_embeddings_vector 
    ON code_embeddings USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- =====================================================
-- TABLE 2: GENERATION ITERATIONS
-- =====================================================
-- Stores each code generation attempt for AI learning

CREATE TABLE IF NOT EXISTS generation_iterations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Context
    task_id TEXT NOT NULL,
    project_id UUID,
    user_id UUID,
    
    -- The prompt and result
    prompt TEXT NOT NULL,
    generated_code JSONB NOT NULL DEFAULT '[]',
    config JSONB DEFAULT '{}',
    
    -- Outcome
    success BOOLEAN NOT NULL DEFAULT FALSE,
    errors TEXT[] DEFAULT '{}',
    
    -- Feedback
    feedback JSONB DEFAULT NULL,
    test_results JSONB DEFAULT NULL,
    
    -- Metrics
    metrics JSONB DEFAULT '{}',
    
    -- Embedding for similarity search
    prompt_embedding vector(1536),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_generation_iterations_task 
    ON generation_iterations(task_id);
CREATE INDEX IF NOT EXISTS idx_generation_iterations_project 
    ON generation_iterations(project_id);
CREATE INDEX IF NOT EXISTS idx_generation_iterations_success 
    ON generation_iterations(success);
CREATE INDEX IF NOT EXISTS idx_generation_iterations_created 
    ON generation_iterations(created_at DESC);

-- Vector index for prompt similarity
CREATE INDEX IF NOT EXISTS idx_generation_iterations_embedding 
    ON generation_iterations USING ivfflat (prompt_embedding vector_cosine_ops)
    WITH (lists = 50);

-- =====================================================
-- TABLE 3: TESTING ITERATIONS
-- =====================================================
-- Stores testing experiences for pre-context building

CREATE TABLE IF NOT EXISTS testing_iterations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Context
    project_id UUID NOT NULL,
    
    -- Test details
    test_type TEXT NOT NULL CHECK (test_type IN ('unit', 'integration', 'e2e', 'manual')),
    test_description TEXT NOT NULL,
    user_query TEXT,
    
    -- Results
    expected_behavior TEXT NOT NULL,
    actual_result TEXT NOT NULL,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Learnings
    lessons TEXT[] DEFAULT '{}',
    related_files TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    
    -- Embedding for similarity search
    description_embedding vector(1536),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_testing_iterations_project 
    ON testing_iterations(project_id);
CREATE INDEX IF NOT EXISTS idx_testing_iterations_type 
    ON testing_iterations(test_type);
CREATE INDEX IF NOT EXISTS idx_testing_iterations_success 
    ON testing_iterations(success);
CREATE INDEX IF NOT EXISTS idx_testing_iterations_tags 
    ON testing_iterations USING gin(tags);

-- =====================================================
-- TABLE 4: LEARNED PATTERNS
-- =====================================================
-- Stores patterns extracted from iterations

CREATE TABLE IF NOT EXISTS learned_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Pattern details
    pattern_type TEXT NOT NULL CHECK (pattern_type IN ('success', 'failure', 'warning')),
    description TEXT NOT NULL,
    example TEXT,
    context TEXT,
    
    -- Statistics
    frequency INTEGER NOT NULL DEFAULT 1,
    confidence NUMERIC(5, 4) NOT NULL DEFAULT 0.5,
    
    -- Related data
    related_prompts TEXT[] DEFAULT '{}',
    
    -- Embedding
    pattern_embedding vector(1536),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_learned_patterns_type 
    ON learned_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_learned_patterns_confidence 
    ON learned_patterns(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_learned_patterns_frequency 
    ON learned_patterns(frequency DESC);

-- =====================================================
-- RPC FUNCTION: MATCH CODE EMBEDDINGS
-- =====================================================
-- Performs vector similarity search for code chunks

CREATE OR REPLACE FUNCTION match_code_embeddings(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10,
    filter_project_id UUID DEFAULT NULL,
    filter_language TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    project_id UUID,
    file_path TEXT,
    content TEXT,
    start_line INTEGER,
    end_line INTEGER,
    language TEXT,
    embedding_model TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ce.id,
        ce.project_id,
        ce.file_path,
        ce.content,
        ce.start_line,
        ce.end_line,
        ce.language,
        ce.embedding_model,
        ce.created_at,
        ce.updated_at,
        1 - (ce.embedding <=> query_embedding) AS similarity
    FROM code_embeddings ce
    WHERE 
        1 - (ce.embedding <=> query_embedding) > match_threshold
        AND (filter_project_id IS NULL OR ce.project_id = filter_project_id)
        AND (filter_language IS NULL OR ce.language = filter_language)
    ORDER BY ce.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- =====================================================
-- RPC FUNCTION: MATCH SIMILAR ITERATIONS
-- =====================================================
-- Finds similar past generation iterations

CREATE OR REPLACE FUNCTION match_similar_iterations(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.65,
    match_count INT DEFAULT 5,
    filter_success BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    task_id TEXT,
    project_id UUID,
    prompt TEXT,
    success BOOLEAN,
    feedback JSONB,
    created_at TIMESTAMPTZ,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        gi.id,
        gi.task_id,
        gi.project_id,
        gi.prompt,
        gi.success,
        gi.feedback,
        gi.created_at,
        1 - (gi.prompt_embedding <=> query_embedding) AS similarity
    FROM generation_iterations gi
    WHERE 
        gi.prompt_embedding IS NOT NULL
        AND 1 - (gi.prompt_embedding <=> query_embedding) > match_threshold
        AND (filter_success IS NULL OR gi.success = filter_success)
    ORDER BY gi.prompt_embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- =====================================================
-- RPC FUNCTION: GET LEARNING STATISTICS
-- =====================================================

CREATE OR REPLACE FUNCTION get_learning_statistics()
RETURNS TABLE (
    total_iterations BIGINT,
    successful_iterations BIGINT,
    failed_iterations BIGINT,
    patterns_learned BIGINT,
    test_iterations BIGINT,
    success_rate NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_total BIGINT;
    v_success BIGINT;
    v_patterns BIGINT;
    v_tests BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_total FROM generation_iterations;
    SELECT COUNT(*) INTO v_success FROM generation_iterations WHERE success = true;
    SELECT COUNT(*) INTO v_patterns FROM learned_patterns;
    SELECT COUNT(*) INTO v_tests FROM testing_iterations;
    
    RETURN QUERY
    SELECT
        v_total AS total_iterations,
        v_success AS successful_iterations,
        v_total - v_success AS failed_iterations,
        v_patterns AS patterns_learned,
        v_tests AS test_iterations,
        CASE WHEN v_total > 0 
            THEN ROUND(v_success::NUMERIC / v_total::NUMERIC, 4)
            ELSE 0.0
        END AS success_rate;
END;
$$;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE code_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_iterations ENABLE ROW LEVEL SECURITY;
ALTER TABLE testing_iterations ENABLE ROW LEVEL SECURITY;
ALTER TABLE learned_patterns ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service full access to code_embeddings"
    ON code_embeddings FOR ALL
    USING (true) WITH CHECK (true);

CREATE POLICY "Service full access to generation_iterations"
    ON generation_iterations FOR ALL
    USING (true) WITH CHECK (true);

CREATE POLICY "Service full access to testing_iterations"
    ON testing_iterations FOR ALL
    USING (true) WITH CHECK (true);

CREATE POLICY "Service full access to learned_patterns"
    ON learned_patterns FOR ALL
    USING (true) WITH CHECK (true);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE code_embeddings IS 'Stores vector embeddings for codebase semantic search';
COMMENT ON TABLE generation_iterations IS 'Stores code generation attempts for AI learning';
COMMENT ON TABLE testing_iterations IS 'Stores testing experiences for pre-context building';
COMMENT ON TABLE learned_patterns IS 'Stores patterns extracted from iterations';
COMMENT ON FUNCTION match_code_embeddings IS 'Vector similarity search for code chunks';
COMMENT ON FUNCTION match_similar_iterations IS 'Find similar past generation iterations';
COMMENT ON FUNCTION get_learning_statistics IS 'Get learning system statistics';

-- =====================================================
-- RELOAD SCHEMA CACHE
-- =====================================================

NOTIFY pgrst, 'reload config';
