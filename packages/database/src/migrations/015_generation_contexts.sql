-- =====================================================
-- GENERATION CONTEXTS MIGRATION (Phase 24)
-- =====================================================
-- Stores context from each code generation for learning
-- This enables the system to improve over time

-- =====================================================
-- TABLE: generation_contexts
-- =====================================================

CREATE TABLE IF NOT EXISTS generation_contexts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identity
    task_id TEXT NOT NULL,
    project_id UUID,
    user_id UUID,
    
    -- Original request (never changes)
    original_prompt TEXT NOT NULL,
    
    -- Extracted entities and features
    entities JSONB DEFAULT '[]'::jsonb NOT NULL,
    features JSONB DEFAULT '{}'::jsonb NOT NULL,
    integrations JSONB DEFAULT '{}'::jsonb NOT NULL,
    project_type TEXT DEFAULT 'api' NOT NULL,
    
    -- Language and framework
    language TEXT DEFAULT 'typescript' NOT NULL,
    framework TEXT DEFAULT 'fastify' NOT NULL,
    
    -- Generated files tracking
    generated_files JSONB DEFAULT '[]'::jsonb NOT NULL,
    
    -- Decisions made during generation
    decisions JSONB DEFAULT '[]'::jsonb NOT NULL,
    
    -- Subtask results
    subtask_results JSONB DEFAULT '[]'::jsonb NOT NULL,
    
    -- Metrics
    total_duration INTEGER, -- milliseconds
    total_cost NUMERIC(10, 6),
    quality_score NUMERIC(3, 1), -- 0.0 to 10.0
    
    -- Status
    status TEXT DEFAULT 'extraction' NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_generation_contexts_task_id 
    ON generation_contexts(task_id);

CREATE INDEX IF NOT EXISTS idx_generation_contexts_project_id 
    ON generation_contexts(project_id);

CREATE INDEX IF NOT EXISTS idx_generation_contexts_user_id 
    ON generation_contexts(user_id);

CREATE INDEX IF NOT EXISTS idx_generation_contexts_status 
    ON generation_contexts(status);

CREATE INDEX IF NOT EXISTS idx_generation_contexts_created_at 
    ON generation_contexts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generation_contexts_quality_score 
    ON generation_contexts(quality_score DESC);

-- Index for entity search (GIN for JSONB)
CREATE INDEX IF NOT EXISTS idx_generation_contexts_entities 
    ON generation_contexts USING GIN (entities);

-- Index for prompt similarity search
CREATE INDEX IF NOT EXISTS idx_generation_contexts_prompt_trgm 
    ON generation_contexts USING GIN (original_prompt gin_trgm_ops);

-- =====================================================
-- TABLE: entity_extractions (for learning patterns)
-- =====================================================

CREATE TABLE IF NOT EXISTS entity_extractions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Link to context
    context_id UUID REFERENCES generation_contexts(id) ON DELETE CASCADE,
    
    -- Original prompt (for pattern matching)
    prompt_hash TEXT NOT NULL, -- Hash of prompt for deduplication
    prompt_preview TEXT NOT NULL, -- First 200 chars
    
    -- Extracted data
    entity_names TEXT[] NOT NULL,
    entity_count INTEGER NOT NULL,
    features JSONB DEFAULT '{}'::jsonb NOT NULL,
    integrations JSONB DEFAULT '{}'::jsonb NOT NULL,
    project_type TEXT NOT NULL,
    
    -- Extraction method
    extraction_method TEXT DEFAULT 'ai' NOT NULL, -- 'ai' or 'fallback'
    extraction_time INTEGER, -- milliseconds
    
    -- Quality feedback
    user_approved BOOLEAN,
    corrections JSONB, -- If user corrected the extraction
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for finding similar prompts
CREATE INDEX IF NOT EXISTS idx_entity_extractions_prompt_hash 
    ON entity_extractions(prompt_hash);

CREATE INDEX IF NOT EXISTS idx_entity_extractions_entity_names 
    ON entity_extractions USING GIN (entity_names);

-- =====================================================
-- TABLE: generation_quality_feedback
-- =====================================================

CREATE TABLE IF NOT EXISTS generation_quality_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Link to context
    context_id UUID REFERENCES generation_contexts(id) ON DELETE CASCADE,
    
    -- Feedback
    feedback_type TEXT NOT NULL, -- 'positive', 'negative', 'correction'
    feedback_text TEXT,
    
    -- Specific issues
    missing_entities TEXT[],
    unexpected_entities TEXT[],
    missing_features TEXT[],
    code_issues JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_generation_quality_feedback_context_id 
    ON generation_quality_feedback(context_id);

CREATE INDEX IF NOT EXISTS idx_generation_quality_feedback_type 
    ON generation_quality_feedback(feedback_type);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE generation_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_quality_feedback ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service full access to generation_contexts"
    ON generation_contexts FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service full access to entity_extractions"
    ON entity_extractions FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service full access to generation_quality_feedback"
    ON generation_quality_feedback FOR ALL
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- FUNCTIONS: Search similar contexts
-- =====================================================

CREATE OR REPLACE FUNCTION search_similar_contexts(
    search_prompt TEXT,
    max_results INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    original_prompt TEXT,
    entities JSONB,
    quality_score NUMERIC,
    similarity REAL
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gc.id,
        gc.original_prompt,
        gc.entities,
        gc.quality_score,
        similarity(gc.original_prompt, search_prompt) AS similarity
    FROM generation_contexts gc
    WHERE gc.status = 'complete'
      AND gc.quality_score >= 7.0
    ORDER BY similarity(gc.original_prompt, search_prompt) DESC
    LIMIT max_results;
END;
$$;

-- =====================================================
-- FUNCTIONS: Get entity patterns
-- =====================================================

CREATE OR REPLACE FUNCTION get_entity_patterns(
    entity_name TEXT
)
RETURNS TABLE (
    prompt_preview TEXT,
    entity_names TEXT[],
    features JSONB,
    quality_score NUMERIC,
    count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ee.prompt_preview,
        ee.entity_names,
        ee.features,
        gc.quality_score,
        COUNT(*) OVER () as count
    FROM entity_extractions ee
    JOIN generation_contexts gc ON ee.context_id = gc.id
    WHERE entity_name = ANY(ee.entity_names)
      AND gc.quality_score >= 7.0
    ORDER BY gc.quality_score DESC
    LIMIT 10;
END;
$$;

-- =====================================================
-- TRIGGER: Update timestamp
-- =====================================================

CREATE OR REPLACE FUNCTION update_generation_contexts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_generation_contexts_timestamp
    BEFORE UPDATE ON generation_contexts
    FOR EACH ROW
    EXECUTE FUNCTION update_generation_contexts_timestamp();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE generation_contexts IS 'Stores the full context of each code generation for learning';
COMMENT ON TABLE entity_extractions IS 'Stores entity extraction patterns for improving future extractions';
COMMENT ON TABLE generation_quality_feedback IS 'Stores user feedback on generated code quality';

COMMENT ON COLUMN generation_contexts.entities IS 'JSONB array of extracted entities with properties and relationships';
COMMENT ON COLUMN generation_contexts.decisions IS 'JSONB array of decisions made during generation';
COMMENT ON COLUMN generation_contexts.quality_score IS 'Quality score from 0-10 assigned by validation';

-- =====================================================
-- RELOAD SCHEMA CACHE
-- =====================================================

NOTIFY pgrst, 'reload config';
