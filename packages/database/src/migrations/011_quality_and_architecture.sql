-- Migration: Add Quality Assessment and Architecture Knowledge tables
-- This enables the learning system to:
-- 1. Track quality assessments of generated code
-- 2. Store architecture blueprints for cross-referencing
-- 3. Enable semantic search on past architectures

-- =====================================================
-- QUALITY ASSESSMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS quality_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Context
    language TEXT NOT NULL,
    framework TEXT NOT NULL,
    
    
    -- Scores
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    passed BOOLEAN NOT NULL DEFAULT false,
    
    -- Statistics
    total_files INTEGER NOT NULL DEFAULT 0,
    complete_files INTEGER NOT NULL DEFAULT 0,
    issues_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    should_regenerate BOOLEAN DEFAULT false,
    
    -- Detailed summary (JSON)
    summary JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for quality assessments
CREATE INDEX IF NOT EXISTS idx_quality_assessments_language 
    ON quality_assessments(language);
CREATE INDEX IF NOT EXISTS idx_quality_assessments_framework 
    ON quality_assessments(framework);
CREATE INDEX IF NOT EXISTS idx_quality_assessments_score 
    ON quality_assessments(score DESC);
CREATE INDEX IF NOT EXISTS idx_quality_assessments_passed 
    ON quality_assessments(passed);

-- =====================================================
-- ARCHITECTURE KNOWLEDGE TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS architecture_knowledge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Project info
    project_id TEXT NOT NULL,
    prompt TEXT NOT NULL,
    
    -- Tech stack
    language TEXT NOT NULL,
    framework TEXT NOT NULL,
    features TEXT[] DEFAULT '{}',
    
    -- Architecture data
    blueprint JSONB NOT NULL,
    ascii_diagram TEXT,
    
    -- Quality metrics
    quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
    
    -- Generated output info
    generated_files TEXT[] DEFAULT '{}',
    success BOOLEAN NOT NULL DEFAULT true,
    
    -- Vector embedding for similarity search
    embedding vector(1536),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for architecture knowledge
CREATE INDEX IF NOT EXISTS idx_arch_knowledge_language 
    ON architecture_knowledge(language);
CREATE INDEX IF NOT EXISTS idx_arch_knowledge_framework 
    ON architecture_knowledge(framework);
CREATE INDEX IF NOT EXISTS idx_arch_knowledge_success 
    ON architecture_knowledge(success);
CREATE INDEX IF NOT EXISTS idx_arch_knowledge_quality 
    ON architecture_knowledge(quality_score DESC);

-- Vector similarity index
CREATE INDEX IF NOT EXISTS idx_arch_knowledge_embedding 
    ON architecture_knowledge 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- =====================================================
-- FUNCTION: Match Architecture Knowledge
-- =====================================================

CREATE OR REPLACE FUNCTION match_architecture_knowledge(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 5,
    p_language text DEFAULT NULL,
    p_framework text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    project_id text,
    prompt text,
    language text,
    framework text,
    features text[],
    blueprint jsonb,
    ascii_diagram text,
    quality_score integer,
    generated_files text[],
    success boolean,
    created_at timestamptz,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ak.id,
        ak.project_id,
        ak.prompt,
        ak.language,
        ak.framework,
        ak.features,
        ak.blueprint,
        ak.ascii_diagram,
        ak.quality_score,
        ak.generated_files,
        ak.success,
        ak.created_at,
        (1 - (ak.embedding <=> query_embedding))::float AS similarity
    FROM architecture_knowledge ak
    WHERE 
        ak.success = true
        AND (p_language IS NULL OR ak.language = p_language)
        AND (p_framework IS NULL OR ak.framework = p_framework)
        AND (1 - (ak.embedding <=> query_embedding)) > match_threshold
    ORDER BY ak.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- =====================================================
-- BACKEND KNOWLEDGE BASE (Pre-seeded patterns)
-- =====================================================

-- Create a knowledge base table for backend development patterns
CREATE TABLE IF NOT EXISTS backend_knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Category and topic
    category TEXT NOT NULL,
    topic TEXT NOT NULL,
    
    -- Language/framework specifics
    language TEXT,
    framework TEXT,
    
    -- Content
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    code_example TEXT,
    best_practices TEXT[],
    common_mistakes TEXT[],
    
    -- Embedding for search
    embedding vector(1536),
    
    -- Metadata
    importance INTEGER DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for knowledge base
CREATE INDEX IF NOT EXISTS idx_backend_kb_category
    ON backend_knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_backend_kb_language
    ON backend_knowledge_base(language);
CREATE INDEX IF NOT EXISTS idx_backend_kb_framework
    ON backend_knowledge_base(framework);
CREATE INDEX IF NOT EXISTS idx_backend_kb_embedding
    ON backend_knowledge_base
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE quality_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE architecture_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE backend_knowledge_base ENABLE ROW LEVEL SECURITY;

-- Service role policies
CREATE POLICY "Service full access to quality_assessments"
    ON quality_assessments FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service full access to architecture_knowledge"
    ON architecture_knowledge FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service full access to backend_knowledge_base"
    ON backend_knowledge_base FOR ALL
    USING (auth.role() = 'service_role');

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE quality_assessments IS 'Stores quality assessment results for learning';
COMMENT ON TABLE architecture_knowledge IS 'Stores successful architectures for cross-referencing';
COMMENT ON TABLE backend_knowledge_base IS 'Pre-seeded backend development knowledge';
COMMENT ON FUNCTION match_architecture_knowledge IS 'Find similar architectures by embedding similarity';
