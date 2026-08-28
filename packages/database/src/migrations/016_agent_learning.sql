-- =====================================================
-- AGENT LEARNING MIGRATION (Phase 25)
-- =====================================================
-- Description: Creates tables for Code Quality Agent and 
-- Framework Oversight Agent learning capabilities
--
-- Tables:
-- 1. generation_issues - Track quality issues found during validation
-- 2. validated_code_patterns - Store successful code patterns
-- 3. anti_patterns - Store patterns to AVOID in future generations
-- =====================================================

-- =====================================================
-- TABLE 1: GENERATION ISSUES
-- Tracks quality issues found by Code Quality Agent
-- =====================================================

CREATE TABLE IF NOT EXISTS generation_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reference to generation (optional)
    generation_id UUID,
    
    -- Issue details
    issue_type TEXT NOT NULL,
    file_path TEXT,
    details JSONB DEFAULT '{}' NOT NULL,
    
    -- Resolution
    resolution TEXT CHECK (resolution IN ('auto_fixed', 'regenerated', 'manual', 'unresolved')),
    resolution_details JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for generation_issues
CREATE INDEX IF NOT EXISTS idx_generation_issues_type 
    ON generation_issues(issue_type);
CREATE INDEX IF NOT EXISTS idx_generation_issues_created_at 
    ON generation_issues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_issues_resolution 
    ON generation_issues(resolution);

-- =====================================================
-- TABLE 2: VALIDATED CODE PATTERNS
-- Stores successful code patterns for vector search
-- =====================================================

CREATE TABLE IF NOT EXISTS validated_code_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Pattern identity
    pattern_name TEXT NOT NULL,
    language TEXT NOT NULL,
    framework TEXT,
    
    -- The actual code
    code_template TEXT NOT NULL,
    file_path TEXT,
    
    -- Usage tracking
    usage_count INT DEFAULT 1,
    success_rate NUMERIC(5, 2) DEFAULT 100.00,
    
    -- Vector embedding for semantic search (if using pgvector)
    -- Uncomment if pgvector extension is available:
    -- embedding VECTOR(1536),
    
    -- Context
    original_prompt TEXT,
    project_id UUID,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_used_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for validated_code_patterns
CREATE INDEX IF NOT EXISTS idx_validated_patterns_language 
    ON validated_code_patterns(language);
CREATE INDEX IF NOT EXISTS idx_validated_patterns_framework 
    ON validated_code_patterns(framework);
CREATE INDEX IF NOT EXISTS idx_validated_patterns_usage 
    ON validated_code_patterns(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_validated_patterns_created_at 
    ON validated_code_patterns(created_at DESC);

-- GIN index for full-text search on code_template
CREATE INDEX IF NOT EXISTS idx_validated_patterns_code_search 
    ON validated_code_patterns USING GIN (to_tsvector('english', code_template));

-- =====================================================
-- TABLE 3: ANTI PATTERNS
-- Stores patterns to AVOID in future generations
-- =====================================================

CREATE TABLE IF NOT EXISTS anti_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Pattern identity
    pattern_type TEXT NOT NULL,
    
    -- Context that triggers this pattern
    trigger_context TEXT,
    
    -- Example of bad code (optional)
    example_bad_code TEXT,
    
    -- How to avoid/correct
    correction TEXT NOT NULL,
    
    -- Occurrence tracking
    occurrence_count INT DEFAULT 1,
    last_occurred_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Vector embedding for semantic search (if using pgvector)
    -- Uncomment if pgvector extension is available:
    -- embedding VECTOR(1536),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for anti_patterns
CREATE INDEX IF NOT EXISTS idx_anti_patterns_type 
    ON anti_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_anti_patterns_occurrence 
    ON anti_patterns(occurrence_count DESC);
CREATE INDEX IF NOT EXISTS idx_anti_patterns_last_occurred 
    ON anti_patterns(last_occurred_at DESC);

-- Unique constraint to prevent duplicate anti-patterns
CREATE UNIQUE INDEX IF NOT EXISTS idx_anti_patterns_unique_type 
    ON anti_patterns(pattern_type) 
    WHERE trigger_context IS NULL;

-- =====================================================
-- TABLE 4: LEARNING DECISIONS
-- Tracks decisions made by Oversight Agent
-- =====================================================

CREATE TABLE IF NOT EXISTS learning_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Decision details
    decision_type TEXT NOT NULL CHECK (decision_type IN ('success_pattern', 'anti_pattern', 'iteration', 'skip')),
    reason TEXT NOT NULL,
    
    -- Context
    prompt_hash TEXT, -- Hash of the prompt for grouping
    project_id UUID,
    quality_score INT CHECK (quality_score >= 0 AND quality_score <= 100),
    
    -- Decision metadata
    data JSONB DEFAULT '{}' NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for learning_decisions
CREATE INDEX IF NOT EXISTS idx_learning_decisions_type 
    ON learning_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_learning_decisions_score 
    ON learning_decisions(quality_score);
CREATE INDEX IF NOT EXISTS idx_learning_decisions_created_at 
    ON learning_decisions(created_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE generation_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE validated_code_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE anti_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_decisions ENABLE ROW LEVEL SECURITY;

-- Service role full access policies
CREATE POLICY "Service full access to generation_issues"
    ON generation_issues FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service full access to validated_code_patterns"
    ON validated_code_patterns FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service full access to anti_patterns"
    ON anti_patterns FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service full access to learning_decisions"
    ON learning_decisions FOR ALL
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to increment anti-pattern occurrence count
CREATE OR REPLACE FUNCTION increment_anti_pattern_count(pattern_type_param TEXT)
RETURNS void AS $$
BEGIN
    UPDATE anti_patterns 
    SET 
        occurrence_count = occurrence_count + 1,
        last_occurred_at = NOW()
    WHERE pattern_type = pattern_type_param;
END;
$$ LANGUAGE plpgsql;

-- Function to increment validated pattern usage count
CREATE OR REPLACE FUNCTION increment_pattern_usage(pattern_id_param UUID)
RETURNS void AS $$
BEGIN
    UPDATE validated_code_patterns 
    SET 
        usage_count = usage_count + 1,
        last_used_at = NOW()
    WHERE id = pattern_id_param;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE generation_issues IS 'Tracks quality issues found by Code Quality Agent during validation';
COMMENT ON TABLE validated_code_patterns IS 'Stores successful code patterns for vector search and reuse';
COMMENT ON TABLE anti_patterns IS 'Stores patterns to AVOID in future code generations';
COMMENT ON TABLE learning_decisions IS 'Tracks decisions made by Framework Oversight Agent';

COMMENT ON COLUMN generation_issues.issue_type IS 'Type of issue: file_deduplication, truncation_detection, import_resolution, syntax_validation, architecture_consistency, entity_completeness, single_entry_point';
COMMENT ON COLUMN generation_issues.resolution IS 'How the issue was resolved: auto_fixed, regenerated, manual, unresolved';

COMMENT ON COLUMN anti_patterns.pattern_type IS 'Category of anti-pattern (e.g., syntax_mixing, duplicate_service)';
COMMENT ON COLUMN anti_patterns.correction IS 'How to avoid this anti-pattern in future generations';

-- =====================================================
-- RELOAD SCHEMA CACHE (Required for Supabase)
-- =====================================================
NOTIFY pgrst, 'reload config';
