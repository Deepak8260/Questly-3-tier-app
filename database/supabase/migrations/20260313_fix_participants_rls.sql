-- ============================================================
-- Fix: Recursive RLS policy on contest_participants
-- Migration: 20260313_fix_participants_rls.sql
--
-- The original "participants_select" policy had a self-referencing
-- EXISTS sub-query that caused infinite recursion in Postgres RLS
-- evaluation. Postgres resolves this by returning 0 rows for ALL
-- SELECT queries on the table — including a user's own rows.
--
-- This caused:
--   1. Admin panel showing "0 enrolled" (can't read any rows)
--   2. Users always showing as not-enrolled (own row invisible)
--   3. Participant counts always showing 0
-- ============================================================

-- Step 1: Drop ALL existing select policies (idempotent — safe to re-run)
DROP POLICY IF EXISTS "participants_select"       ON contest_participants;
DROP POLICY IF EXISTS "participants_select_own"   ON contest_participants;
DROP POLICY IF EXISTS "participants_select_admin" ON contest_participants;

-- Step 2: Create two clean, non-recursive replacement policies

-- Policy A: Each user can see only their OWN enrollment rows.
-- This allows the user-facing pages to check if THEY are enrolled
-- and to count their own enrollments.
CREATE POLICY "participants_select_own"
  ON contest_participants FOR SELECT
  USING (user_id = auth.uid());

-- Policy B: Super admins can see ALL participant rows for any contest.
-- Uses the existing is_super_admin() SECURITY DEFINER function which
-- queries the profiles table — no recursion risk.
CREATE POLICY "participants_select_admin"
  ON contest_participants FOR SELECT
  USING (is_super_admin());

-- ============================================================
-- NOTE on participant counts for non-admin users:
-- Because regular users can now only see their OWN rows, a plain
-- SELECT COUNT(*) will only return 1 (their own row) or 0.
-- The application uses a SECURITY DEFINER RPC function to get
-- accurate counts. Create that function below:
-- ============================================================

-- Step 3: Create a SECURITY DEFINER function to safely count
-- participants per contest without exposing other users' data.
-- Runs as the postgres superuser role, bypasses RLS.
CREATE OR REPLACE FUNCTION get_contest_participant_count(contest_id_input UUID)
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::BIGINT
  FROM contest_participants
  WHERE contest_id = contest_id_input;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_contest_participant_count(UUID) TO authenticated;
