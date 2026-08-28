-- =====================================================
-- MIGRATION: Fix project_id columns to support string identifiers
-- =====================================================
-- The orchestrator uses string project IDs like "simple-flask-api"
-- but the tables have UUID columns. This migration converts them to TEXT.

-- =====================================================
-- ALTER CODE_EMBEDDINGS TABLE
-- =====================================================

-- First, drop the existing index
DROP INDEX IF EXISTS idx_code_embeddings_project;

-- Alter the column type from UUID to TEXT
ALTER TABLE code_embeddings 
ALTER COLUMN project_id TYPE TEXT USING project_id::TEXT;

-- Recreate the index
CREATE INDEX IF NOT EXISTS idx_code_embeddings_project 
    ON code_embeddings(project_id);

-- =====================================================
-- ALTER GENERATION_ITERATIONS TABLE
-- =====================================================

DROP INDEX IF EXISTS idx_generation_iterations_project;

-- Allow NULL and convert to TEXT
ALTER TABLE generation_iterations 
ALTER COLUMN project_id TYPE TEXT USING project_id::TEXT;

ALTER TABLE generation_iterations 
ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

CREATE INDEX IF NOT EXISTS idx_generation_iterations_project 
    ON generation_iterations(project_id);

-- =====================================================
-- ALTER TESTING_ITERATIONS TABLE
-- =====================================================

DROP INDEX IF EXISTS idx_testing_iterations_project;

ALTER TABLE testing_iterations 
ALTER COLUMN project_id TYPE TEXT USING project_id::TEXT;

CREATE INDEX IF NOT EXISTS idx_testing_iterations_project 
    ON testing_iterations(project_id);

-- =====================================================
-- ALTER KNOWLEDGE_EMBEDDINGS TABLE (if exists)
-- =====================================================

-- Check if column exists and alter it
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'knowledge_embeddings' 
        AND column_name = 'project_id'
    ) THEN
        ALTER TABLE knowledge_embeddings 
        ALTER COLUMN project_id TYPE TEXT USING project_id::TEXT;
    END IF;
END $$;

-- =====================================================
-- UPDATE RPC FUNCTIONS TO USE TEXT
-- =====================================================

-- Drop existing functions first (required when changing return types)
DROP FUNCTION IF EXISTS match_code_embeddings(vector(1536), FLOAT, INT, UUID, TEXT);
DROP FUNCTION IF EXISTS match_code_embeddings(vector(1536), FLOAT, INT, TEXT, TEXT);
DROP FUNCTION IF EXISTS match_similar_iterations(vector(1536), FLOAT, INT, BOOLEAN);

CREATE OR REPLACE FUNCTION match_code_embeddings(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10,
    filter_project_id TEXT DEFAULT NULL,
    filter_language TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    project_id TEXT,
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

CREATE OR REPLACE FUNCTION match_similar_iterations(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.65,
    match_count INT DEFAULT 5,
    filter_success BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    task_id TEXT,
    project_id TEXT,
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

-- Reload schema cache
NOTIFY pgrst, 'reload config';
