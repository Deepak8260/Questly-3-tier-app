-- ============================================================
-- Questly — Live Quiz Contest System
-- Migration: 20260310_live_contest_system.sql
--
-- Phase 1: Database Schema
-- Creates all tables, enums, indexes, and RLS policies
-- required for the Live Quiz Contest module.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 0. ENUM TYPES
-- ──────────────────────────────────────────────────────────────

-- Drop types if they already exist (safe for re-runs)
DO $$ BEGIN
  CREATE TYPE contest_difficulty AS ENUM ('easy', 'medium', 'hard');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contest_visibility AS ENUM ('public', 'private');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contest_status AS ENUM ('draft', 'published', 'live', 'ended', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ──────────────────────────────────────────────────────────────
-- 1. CONTESTS TABLE
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contests (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  title              TEXT          NOT NULL,
  description        TEXT,
  topic              TEXT          NOT NULL,
  difficulty         contest_difficulty        NOT NULL DEFAULT 'medium',
  questions_count    INT           NOT NULL CHECK (questions_count > 0 AND questions_count <= 50),
  start_time         TIMESTAMPTZ   NOT NULL,
  duration_minutes   INT           NOT NULL CHECK (duration_minutes > 0),
  max_participants   INT           CHECK (max_participants IS NULL OR max_participants > 0),
  visibility         contest_visibility        NOT NULL DEFAULT 'public',
  status             contest_status            NOT NULL DEFAULT 'draft',
  -- Stores the full GeneratedQuiz questions array as JSONB
  -- Schema: [{ id, question, code?, options[], correctIndex, explanation }]
  question_set       JSONB,
  -- When the admin clicks "Announce Winners", this timestamp is set
  announced_at       TIMESTAMPTZ,
  created_by         UUID          NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Indexes for most frequently queried columns
CREATE INDEX IF NOT EXISTS contests_status_idx       ON contests (status);
CREATE INDEX IF NOT EXISTS contests_start_time_idx   ON contests (start_time);
CREATE INDEX IF NOT EXISTS contests_created_by_idx   ON contests (created_by);
CREATE INDEX IF NOT EXISTS contests_visibility_idx   ON contests (visibility);
-- Composite index for the most common user-facing query: public contests that are published/live
CREATE INDEX IF NOT EXISTS contests_public_active_idx ON contests (visibility, status, start_time);


-- ──────────────────────────────────────────────────────────────
-- 2. CONTEST_PARTICIPANTS TABLE
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contest_participants (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id   UUID        NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enrolled_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contest_id, user_id)
);

CREATE INDEX IF NOT EXISTS contest_participants_contest_id_idx ON contest_participants (contest_id);
CREATE INDEX IF NOT EXISTS contest_participants_user_id_idx    ON contest_participants (user_id);


-- ──────────────────────────────────────────────────────────────
-- 3. CONTEST_ANSWERS TABLE
-- ──────────────────────────────────────────────────────────────
-- Stores per-question answers as the user submits.
-- question_id matches the 'id' field inside contest.question_set JSONB array.

CREATE TABLE IF NOT EXISTS contest_answers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id       UUID        NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id      TEXT        NOT NULL,  -- matches QuizQuestion.id (e.g. "q1", "q2", ...)
  selected_answer  TEXT        NOT NULL,  -- the text of the option selected
  is_correct       BOOLEAN     NOT NULL,
  answered_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contest_answers_contest_id_idx           ON contest_answers (contest_id);
CREATE INDEX IF NOT EXISTS contest_answers_user_id_idx              ON contest_answers (user_id);
CREATE INDEX IF NOT EXISTS contest_answers_contest_user_idx         ON contest_answers (contest_id, user_id);


-- ──────────────────────────────────────────────────────────────
-- 4. CONTEST_RESULTS TABLE
-- ──────────────────────────────────────────────────────────────
-- One row per (contest_id, user_id). Written atomically on submission.
-- Rank is computed server-side: score DESC, time_taken_seconds ASC, then name ASC.

CREATE TABLE IF NOT EXISTS contest_results (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id          UUID          NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  user_id             UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score               INT           NOT NULL CHECK (score >= 0),
  total_questions     INT           NOT NULL CHECK (total_questions > 0),
  accuracy            NUMERIC(5,2)  NOT NULL CHECK (accuracy >= 0 AND accuracy <= 100),
  time_taken_seconds  INT           NOT NULL CHECK (time_taken_seconds >= 0),
  rank                INT           CHECK (rank > 0),
  submitted_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (contest_id, user_id)
);

CREATE INDEX IF NOT EXISTS contest_results_contest_id_idx ON contest_results (contest_id);
CREATE INDEX IF NOT EXISTS contest_results_user_id_idx    ON contest_results (user_id);
-- Composite index to accelerate ranking queries (the most common leaderboard query)
CREATE INDEX IF NOT EXISTS contest_results_ranking_idx    ON contest_results (contest_id, score DESC, time_taken_seconds ASC);


-- ──────────────────────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY (RLS)
-- ──────────────────────────────────────────────────────────────

-- Helper function: returns true if the calling user is a super_admin.
-- Used across all RLS policies below to avoid re-querying per row.
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER                -- runs as the function owner (postgres), not the caller
STABLE                          -- same result within a transaction, allow caching
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE  id   = auth.uid()
    AND    role = 'super_admin'
  );
$$;


-- ── contests ──────────────────────────────────────────────────
ALTER TABLE contests ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can READ published/live/ended contests
CREATE POLICY "contests_select_public"
  ON contests FOR SELECT
  USING (
    -- Super admins see everything (including drafts & cancelled)
    is_super_admin()
    OR
    -- Regular users only see public, non-draft, non-cancelled contests
    (visibility = 'public' AND status IN ('published', 'live', 'ended'))
  );

-- Only super admins can INSERT
CREATE POLICY "contests_insert_admin"
  ON contests FOR INSERT
  WITH CHECK (is_super_admin());

-- Only super admins can UPDATE
CREATE POLICY "contests_update_admin"
  ON contests FOR UPDATE
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Only super admins can DELETE (only draft-status contests make sense to delete)
CREATE POLICY "contests_delete_admin"
  ON contests FOR DELETE
  USING (is_super_admin());


-- ── contest_participants ──────────────────────────────────────
ALTER TABLE contest_participants ENABLE ROW LEVEL SECURITY;

-- Users can see participants for contests they're enrolled in.
-- Super admins can see all participants.
CREATE POLICY "participants_select"
  ON contest_participants FOR SELECT
  USING (
    is_super_admin()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM contest_participants cp2
      WHERE cp2.contest_id = contest_participants.contest_id
      AND   cp2.user_id    = auth.uid()
    )
  );

-- Authenticated users can enroll themselves (INSERT), business logic enforced in app/API
CREATE POLICY "participants_insert_self"
  ON contest_participants FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can only delete their own enrollment; super admins can delete any
CREATE POLICY "participants_delete"
  ON contest_participants FOR DELETE
  USING (user_id = auth.uid() OR is_super_admin());


-- ── contest_answers ───────────────────────────────────────────
ALTER TABLE contest_answers ENABLE ROW LEVEL SECURITY;

-- Users can read only their own answers; super admins can read all
CREATE POLICY "answers_select"
  ON contest_answers FOR SELECT
  USING (user_id = auth.uid() OR is_super_admin());

-- Users can only insert their own answers
CREATE POLICY "answers_insert_self"
  ON contest_answers FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- No UPDATE/DELETE on answers (immutable audit trail)


-- ── contest_results ───────────────────────────────────────────
ALTER TABLE contest_results ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read results for any contest
-- (needed for the live leaderboard & winner announcement)
CREATE POLICY "results_select_all"
  ON contest_results FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can only insert their own result row
CREATE POLICY "results_insert_self"
  ON contest_results FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Only super admins can update results (e.g. rank recalculation)
CREATE POLICY "results_update_admin"
  ON contest_results FOR UPDATE
  USING (is_super_admin());


-- ──────────────────────────────────────────────────────────────
-- 6. REALTIME PUBLICATION
-- ──────────────────────────────────────────────────────────────
-- Enable Realtime on the tables that need live subscriptions:
--   • contest_participants  — live participant count in lobby
--   • contest_results       — live leaderboard updates
--   • contests              — status changes (draft→live→ended)

ALTER PUBLICATION supabase_realtime ADD TABLE contest_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE contest_results;
ALTER PUBLICATION supabase_realtime ADD TABLE contests;


-- ──────────────────────────────────────────────────────────────
-- 7. AUTO-TRANSITION EDGE FUNCTION (Cron)
-- ──────────────────────────────────────────────────────────────
-- The actual Deno code lives in /supabase/functions/auto-start-contests/index.ts
-- This SQL registers the cron job (requires pg_cron extension, enabled in Supabase).
-- Runs every minute, transitions 'published' contests whose start_time has passed to 'live'.

SELECT cron.schedule(
  'auto-start-contests',          -- job name (unique)
  '* * * * *',                    -- every minute
  $$
    UPDATE contests
    SET    status = 'live'
    WHERE  status = 'published'
    AND    start_time <= now();
  $$
);
