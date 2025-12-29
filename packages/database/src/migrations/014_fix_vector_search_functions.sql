-- ============================================
-- Migration 014: Fix Vector Search Functions
-- FIXES: Column type mismatches and missing parameters
-- ============================================

-- Drop existing functions to recreate with correct signatures
DROP FUNCTION IF EXISTS match_code_embeddings CASCADE;
DROP FUNCTION IF EXISTS match_knowledge_embeddings CASCADE;

-- ============================================
-- 1. MATCH CODE EMBEDDINGS (FIXED)
-- Now uses TEXT for project_id (matches actual table)
-- Added filter_project_id parameter
-- ============================================

CREATE OR REPLACE FUNCTION match_code_embeddings(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 10,
    filter_project_id text DEFAULT NULL,
    filter_language text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    project_id text,
    file_path text,
    content text,
    start_line int,
    end_line int,
    language text,
    embedding_model text,
    created_at timestamptz,
    updated_at timestamptz,
    similarity float
)
LANGUAGE sql STABLE
AS $$
    SELECT
        ce.id,
        ce.project_id::text,
        ce.file_path,
        ce.content,
        ce.start_line,
        ce.end_line,
        ce.language,
        ce.embedding_model,
        ce.created_at,
        ce.updated_at,
        (1 - (ce.embedding <=> query_embedding))::float AS similarity
    FROM code_embeddings ce
    WHERE 
        (filter_project_id IS NULL OR ce.project_id::text = filter_project_id)
        AND (filter_language IS NULL OR ce.language = filter_language)
        AND ce.embedding IS NOT NULL
        AND (1 - (ce.embedding <=> query_embedding)) > match_threshold
    ORDER BY ce.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- ============================================
-- 2. MATCH KNOWLEDGE EMBEDDINGS (FIXED)
-- Now searches knowledge_embeddings table (not backend_knowledge_base)
-- Returns content and metadata fields that actually exist
-- ============================================

CREATE OR REPLACE FUNCTION match_knowledge_embeddings(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 10,
    p_project_id text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    content text,
    file_path text,
    metadata jsonb,
    created_at timestamptz,
    similarity float
)
LANGUAGE sql STABLE
AS $$
    SELECT
        ke.id,
        ke.content,
        (ke.metadata->>'filePath')::text AS file_path,
        ke.metadata,
        ke.created_at,
        (1 - (ke.embedding <=> query_embedding))::float AS similarity
    FROM knowledge_embeddings ke
    WHERE 
        (p_project_id IS NULL OR (ke.metadata->>'projectId')::text = p_project_id)
        AND ke.embedding IS NOT NULL
        AND (1 - (ke.embedding <=> query_embedding)) > match_threshold
    ORDER BY ke.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- ============================================
-- 3. SEARCH GENERATION ITERATIONS (NEW)
-- Text-based search for past generation prompts
-- ============================================

-- Enable pg_trgm for text similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION search_generation_iterations(
    search_query text,
    max_results int DEFAULT 10,
    only_successful boolean DEFAULT false
)
RETURNS TABLE (
    id uuid,
    task_id text,
    project_id text,
    prompt text,
    success boolean,
    errors text[],
    config jsonb,
    generated_code jsonb,
    created_at timestamptz,
    similarity float
)
LANGUAGE sql STABLE
AS $$
    SELECT
        gi.id,
        gi.task_id,
        gi.project_id::text,
        gi.prompt,
        gi.success,
        gi.errors,
        gi.config,
        gi.generated_code,
        gi.created_at,
        similarity(gi.prompt, search_query)::float AS similarity
    FROM generation_iterations gi
    WHERE 
        gi.prompt IS NOT NULL 
        AND gi.prompt != ''
        AND (NOT only_successful OR gi.success = true)
    ORDER BY similarity(gi.prompt, search_query) DESC
    LIMIT max_results;
$$;

-- ============================================
-- 4. GET SUCCESSFUL GENERATIONS (NEW)
-- For learning from past successes
-- ============================================

CREATE OR REPLACE FUNCTION get_successful_iterations(
    p_language text DEFAULT NULL,
    p_framework text DEFAULT NULL,
    p_limit int DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    prompt text,
    generated_code jsonb,
    config jsonb,
    metrics jsonb,
    created_at timestamptz
)
LANGUAGE sql STABLE
AS $$
    SELECT
        gi.id,
        gi.prompt,
        gi.generated_code,
        gi.config,
        gi.metrics,
        gi.created_at
    FROM generation_iterations gi
    WHERE 
        gi.success = true
        AND gi.generated_code IS NOT NULL
        AND (p_language IS NULL OR (gi.config->>'language')::text = p_language)
        AND (p_framework IS NULL OR (gi.config->>'framework')::text = p_framework)
    ORDER BY gi.created_at DESC
    LIMIT p_limit;
$$;

-- ============================================
-- 5. GET LEARNED PATTERNS (NEW)
-- Retrieve patterns for pre-context building
-- ============================================

CREATE OR REPLACE FUNCTION get_learned_patterns(
    p_pattern_type text DEFAULT NULL,
    p_min_confidence float DEFAULT 0.5,
    p_limit int DEFAULT 20
)
RETURNS TABLE (
    id uuid,
    pattern_type text,
    description text,
    example text,
    context text,
    frequency int,
    confidence float,
    related_prompts text[],
    created_at timestamptz
)
LANGUAGE sql STABLE
AS $$
    SELECT
        lp.id,
        lp.pattern_type,
        lp.description,
        lp.example,
        lp.context,
        lp.frequency,
        lp.confidence::float,
        lp.related_prompts,
        lp.created_at
    FROM learned_patterns lp
    WHERE 
        (p_pattern_type IS NULL OR lp.pattern_type = p_pattern_type)
        AND lp.confidence >= p_min_confidence
    ORDER BY lp.frequency DESC, lp.confidence DESC
    LIMIT p_limit;
$$;

-- ============================================
-- 6. GET LEARNING STATISTICS (NEW)
-- Get overall learning system statistics
-- ============================================

CREATE OR REPLACE FUNCTION get_learning_stats()
RETURNS TABLE (
    total_iterations bigint,
    successful_iterations bigint,
    failed_iterations bigint,
    total_patterns bigint,
    success_patterns bigint,
    failure_patterns bigint,
    total_code_chunks bigint,
    total_knowledge_entries bigint
)
LANGUAGE sql STABLE
AS $$
    SELECT
        (SELECT COUNT(*) FROM generation_iterations) AS total_iterations,
        (SELECT COUNT(*) FROM generation_iterations WHERE success = true) AS successful_iterations,
        (SELECT COUNT(*) FROM generation_iterations WHERE success = false) AS failed_iterations,
        (SELECT COUNT(*) FROM learned_patterns) AS total_patterns,
        (SELECT COUNT(*) FROM learned_patterns WHERE pattern_type = 'success') AS success_patterns,
        (SELECT COUNT(*) FROM learned_patterns WHERE pattern_type = 'failure') AS failure_patterns,
        (SELECT COUNT(*) FROM code_embeddings) AS total_code_chunks,
        (SELECT COUNT(*) FROM knowledge_embeddings) AS total_knowledge_entries;
$$;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT EXECUTE ON FUNCTION match_code_embeddings TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION match_knowledge_embeddings TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION search_generation_iterations TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_successful_iterations TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_learned_patterns TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_learning_stats TO anon, authenticated, service_role;

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Index for faster text search on prompts
CREATE INDEX IF NOT EXISTS idx_generation_iterations_prompt_trgm 
ON generation_iterations USING gin (prompt gin_trgm_ops);

-- Index for filtering by success
CREATE INDEX IF NOT EXISTS idx_generation_iterations_success 
ON generation_iterations (success);

-- Index for pattern lookups
CREATE INDEX IF NOT EXISTS idx_learned_patterns_type_confidence 
ON learned_patterns (pattern_type, confidence DESC);
