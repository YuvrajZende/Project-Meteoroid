-- =====================================================
-- RELAX USER CONSTRAINTS FOR DEVELOPMENT/TESTING
-- =====================================================
-- This migration allows projects, tasks, and audit_logs to be created
-- without requiring an authenticated user in the users table.
-- 
-- RUN THIS IN SUPABASE SQL EDITOR
-- =====================================================

-- =====================================================
-- STEP 1: CREATE SERVICE/SYSTEM USER (optional fallback)
-- =====================================================

-- First, try to create a system user for testing
-- This might fail if auth.users FK is enforced, which is OK
DO $$
BEGIN
    INSERT INTO public.users (id, email, name, tier, api_quota_used)
    VALUES (
        '00000000-0000-0000-0000-000000000001',
        'system@loveable.dev',
        'System User',
        'enterprise',
        0
    )
    ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN foreign_key_violation THEN
    -- Auth FK exists, we'll handle this differently
    RAISE NOTICE 'Could not create system user (auth.users constraint). Proceeding with schema changes.';
END $$;

-- =====================================================
-- STEP 2: MAKE user_id NULLABLE IN PROJECTS
-- =====================================================

-- Drop the NOT NULL constraint on projects.user_id
ALTER TABLE projects ALTER COLUMN user_id DROP NOT NULL;

-- =====================================================
-- STEP 3: MAKE user_id NULLABLE IN TASKS  
-- =====================================================

-- Drop the NOT NULL constraint on tasks.user_id
ALTER TABLE tasks ALTER COLUMN user_id DROP NOT NULL;

-- =====================================================
-- STEP 4: UPDATE RLS POLICIES TO ALLOW NULL user_id
-- =====================================================

-- Allow service role to insert projects without user_id
DROP POLICY IF EXISTS "Service can insert projects" ON projects;
CREATE POLICY "Service can insert projects"
    ON projects FOR INSERT
    WITH CHECK (true);

-- Allow service role to insert tasks without user_id  
DROP POLICY IF EXISTS "Service can insert tasks" ON tasks;
CREATE POLICY "Service can insert tasks"
    ON tasks FOR INSERT
    WITH CHECK (true);

-- Allow service role to read all projects (for testing)
DROP POLICY IF EXISTS "Service can read all projects" ON projects;
CREATE POLICY "Service can read all projects"
    ON projects FOR SELECT
    USING (true);

-- Allow service role to read all tasks (for testing)
DROP POLICY IF EXISTS "Service can read all tasks" ON tasks;
CREATE POLICY "Service can read all tasks"
    ON tasks FOR SELECT
    USING (true);

-- Allow service role to insert audit logs without user_id
DROP POLICY IF EXISTS "Service can insert audit_logs" ON audit_logs;
CREATE POLICY "Service can insert audit_logs"
    ON audit_logs FOR INSERT
    WITH CHECK (true);

-- Allow service role to read audit logs
DROP POLICY IF EXISTS "Service can read audit_logs" ON audit_logs;
CREATE POLICY "Service can read audit_logs"
    ON audit_logs FOR SELECT
    USING (true);

-- =====================================================
-- RELOAD SCHEMA CACHE
-- =====================================================
NOTIFY pgrst, 'reload config';

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check that constraints are relaxed
SELECT 
    table_name,
    column_name,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('projects', 'tasks')
  AND column_name = 'user_id';

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE projects IS 'User projects - user_id nullable for development/testing';
COMMENT ON TABLE tasks IS 'Task queue - user_id nullable for development/testing';
