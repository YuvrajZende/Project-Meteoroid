-- Migration: Add knowledge search functions
-- This enables the learning system to search past code knowledge

-- Ensure pg_trgm extension for fuzzy text matching (must be FIRST)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Drop existing functions if they exist (to avoid conflicts)
DROP FUNCTION IF EXISTS match_knowledge_embeddings(vector, float, int, text);
DROP FUNCTION IF EXISTS match_generation_iterations(text, int);

-- Function to search code_embeddings by similarity
-- Note: The table is code_embeddings, not knowledge_embeddings
-- Vector dimension is 1536 (OpenAI text-embedding-3-small)
CREATE OR REPLACE FUNCTION match_knowledge_embeddings(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.6,
    match_count int DEFAULT 5,
    p_project_id text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    project_id text,
    file_path text,
    content text,
    chunk_type text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ce.id,
        ce.project_id::text,
        ce.file_path,
        ce.content,
        ce.chunk_type,
        (1 - (ce.embedding <=> query_embedding))::float AS similarity
    FROM code_embeddings ce
    WHERE 
        (p_project_id IS NULL OR ce.project_id::text = p_project_id)
        AND (1 - (ce.embedding <=> query_embedding)) > match_threshold
    ORDER BY ce.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Function to search generation_iterations by prompt text
CREATE OR REPLACE FUNCTION match_generation_iterations(
    query_text text,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    project_id text,
    prompt text,
    success boolean,
    created_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        gi.id,
        gi.project_id::text,
        gi.prompt,
        gi.success,
        gi.created_at
    FROM generation_iterations gi
    WHERE gi.prompt ILIKE '%' || query_text || '%'
    ORDER BY 
        CASE WHEN gi.success THEN 0 ELSE 1 END,
        gi.created_at DESC
    LIMIT match_count;
END;
$$;

-- Add GIN index for faster text search on prompts (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'generation_iterations') THEN
        CREATE INDEX IF NOT EXISTS idx_gen_iterations_prompt_trgm 
        ON generation_iterations USING gin (prompt gin_trgm_ops);
    END IF;
END $$;

-- Add index for code embeddings search (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'code_embeddings') THEN
        CREATE INDEX IF NOT EXISTS idx_code_embeddings_project 
        ON code_embeddings (project_id);
    END IF;
END $$;

COMMENT ON FUNCTION match_knowledge_embeddings IS 'Search code embeddings for similar code context';
COMMENT ON FUNCTION match_generation_iterations IS 'Search past generation iterations by prompt similarity';
