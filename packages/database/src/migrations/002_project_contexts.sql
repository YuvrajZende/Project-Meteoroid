-- =====================================================
-- PROJECT CONTEXTS TABLE - For Context Manager Persistence
-- Run this AFTER the initial migration in Supabase SQL Editor
-- =====================================================

-- Project contexts table (stores conversation history and project state)
CREATE TABLE IF NOT EXISTS project_contexts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_history JSONB DEFAULT '[]' NOT NULL,
    project_context JSONB DEFAULT '{}' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Unique constraint for upsert
    UNIQUE(project_id, user_id)
);

-- Create indexes for project contexts
CREATE INDEX IF NOT EXISTS idx_project_contexts_project_id ON project_contexts(project_id);
CREATE INDEX IF NOT EXISTS idx_project_contexts_user_id ON project_contexts(user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_project_contexts_updated_at
    BEFORE UPDATE ON project_contexts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE project_contexts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own project contexts"
    ON project_contexts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own project contexts"
    ON project_contexts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own project contexts"
    ON project_contexts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own project contexts"
    ON project_contexts FOR DELETE
    USING (auth.uid() = user_id);

-- Comment
COMMENT ON TABLE project_contexts IS 'Persisted context windows for the orchestrator ContextManager';
