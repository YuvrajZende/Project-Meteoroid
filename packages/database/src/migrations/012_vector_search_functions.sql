-- ============================================
-- Migration 012: Vector Search RPC Functions (SQL VERSION)
-- Phase 22: Simple SQL functions (no PL/pgSQL)
-- ============================================

DROP FUNCTION IF EXISTS match_code_embeddings CASCADE;
DROP FUNCTION IF EXISTS match_knowledge_embeddings CASCADE;

-- Code embeddings search using pure SQL
CREATE OR REPLACE FUNCTION match_code_embeddings(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 5,
    filter_language text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    project_id uuid,
    file_path text,
    content text,
    language text,
    created_at timestamptz,
    similarity float
)
LANGUAGE sql STABLE
AS $$
    SELECT
        ce.id,
        ce.project_id,
        ce.file_path,
        ce.content,
        ce.language,
        ce.created_at,
        (1 - (ce.embedding <=> query_embedding))::float AS similarity
    FROM code_embeddings ce
    WHERE 
        (filter_language IS NULL OR ce.language = filter_language)
        AND (1 - (ce.embedding <=> query_embedding)) > match_threshold
    ORDER BY ce.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- Knowledge base search using pure SQL
CREATE OR REPLACE FUNCTION match_knowledge_embeddings(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.6,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    category text,
    title text,
    description text,
    language text,
    framework text,
    similarity float
)
LANGUAGE sql STABLE
AS $$
    SELECT
        kb.id,
        kb.category,
        kb.title,
        kb.description,
        kb.language,
        kb.framework,
        (1 - (kb.embedding <=> query_embedding))::float AS similarity
    FROM backend_knowledge_base kb
    WHERE 
        kb.embedding IS NOT NULL
        AND (1 - (kb.embedding <=> query_embedding)) > match_threshold
    ORDER BY kb.embedding <=> query_embedding
    LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION match_code_embeddings TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION match_knowledge_embeddings TO anon, authenticated, service_role;
