-- ============================================================
-- Questly — 1v1 Quiz Battle System
-- Migration: 20260313_battle_system.sql
--
-- Creates all tables, enums, indexes, and RLS policies
-- required for the Battle Mode module.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 0. ENUM TYPES
-- ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE battle_status AS ENUM ('pending', 'accepted', 'live', 'ended', 'declined', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE battle_mode AS ENUM ('friend', 'random');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ──────────────────────────────────────────────────────────────
-- 1. QUIZ_BATTLES TABLE
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quiz_battles (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  player_one        UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_two        UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  topic             TEXT          NOT NULL,
  difficulty        contest_difficulty NOT NULL DEFAULT 'medium',
  questions_count   INT           NOT NULL DEFAULT 10 CHECK (questions_count > 0 AND questions_count <= 30),
  question_set      JSONB,        -- Same ContestQuestion[] shape
  mode              battle_mode   NOT NULL DEFAULT 'friend',
  status            battle_status NOT NULL DEFAULT 'pending',
  winner            UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quiz_battles_player_one_idx ON quiz_battles (player_one);
CREATE INDEX IF NOT EXISTS quiz_battles_player_two_idx ON quiz_battles (player_two);
CREATE INDEX IF NOT EXISTS quiz_battles_status_idx     ON quiz_battles (status);
CREATE INDEX IF NOT EXISTS quiz_battles_mode_idx       ON quiz_battles (mode, status);
CREATE INDEX IF NOT EXISTS quiz_battles_created_at_idx ON quiz_battles (created_at DESC);


-- ──────────────────────────────────────────────────────────────
-- 2. BATTLE_ANSWERS TABLE
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS battle_answers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id        UUID        NOT NULL REFERENCES quiz_battles(id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id      TEXT        NOT NULL,
  selected_answer  TEXT        NOT NULL,
  is_correct       BOOLEAN     NOT NULL,
  answered_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS battle_answers_battle_id_idx      ON battle_answers (battle_id);
CREATE INDEX IF NOT EXISTS battle_answers_user_id_idx        ON battle_answers (user_id);
CREATE INDEX IF NOT EXISTS battle_answers_battle_user_idx    ON battle_answers (battle_id, user_id);


-- ──────────────────────────────────────────────────────────────
-- 3. BATTLE_RESULTS TABLE
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS battle_results (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id           UUID          NOT NULL REFERENCES quiz_battles(id) ON DELETE CASCADE,
  user_id             UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score               INT           NOT NULL DEFAULT 0 CHECK (score >= 0),
  total_questions     INT           NOT NULL CHECK (total_questions > 0),
  accuracy            NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (accuracy >= 0 AND accuracy <= 100),
  time_taken_seconds  INT           NOT NULL DEFAULT 0 CHECK (time_taken_seconds >= 0),
  submitted_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (battle_id, user_id)
);

CREATE INDEX IF NOT EXISTS battle_results_battle_id_idx ON battle_results (battle_id);
CREATE INDEX IF NOT EXISTS battle_results_user_id_idx   ON battle_results (user_id);
-- Useful for global battle leaderboard aggregation
CREATE INDEX IF NOT EXISTS battle_results_user_score_idx ON battle_results (user_id, score DESC);


-- ──────────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY
-- ──────────────────────────────────────────────────────────────

-- ── quiz_battles ──────────────────────────────────────────────
ALTER TABLE quiz_battles ENABLE ROW LEVEL SECURITY;

-- Players can only see their own battles; super_admin sees all
CREATE POLICY "battles_select"
  ON quiz_battles FOR SELECT
  USING (
    player_one = auth.uid()
    OR player_two = auth.uid()
    OR is_super_admin()
    -- Allow reading pending random battles for matchmaking
    OR (mode = 'random' AND status = 'pending' AND player_two IS NULL)
  );

-- Any authenticated user can create a battle (as player_one)
CREATE POLICY "battles_insert"
  ON quiz_battles FOR INSERT
  WITH CHECK (player_one = auth.uid());

-- Players can update battles they are part of (accept/decline/update status)
CREATE POLICY "battles_update"
  ON quiz_battles FOR UPDATE
  USING (
    player_one = auth.uid()
    OR player_two = auth.uid()
    OR is_super_admin()
  );

-- ── battle_answers ────────────────────────────────────────────
ALTER TABLE battle_answers ENABLE ROW LEVEL SECURITY;

-- Users can only read their own answers (privacy during live battle)
CREATE POLICY "battle_answers_select"
  ON battle_answers FOR SELECT
  USING (user_id = auth.uid() OR is_super_admin());

CREATE POLICY "battle_answers_insert"
  ON battle_answers FOR INSERT
  WITH CHECK (user_id = auth.uid());


-- ── battle_results ────────────────────────────────────────────
ALTER TABLE battle_results ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read results (for result screen and global leaderboard)
CREATE POLICY "battle_results_select"
  ON battle_results FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "battle_results_insert"
  ON battle_results FOR INSERT
  WITH CHECK (user_id = auth.uid());


-- ──────────────────────────────────────────────────────────────
-- 5. REALTIME PUBLICATION
-- ──────────────────────────────────────────────────────────────
-- Enable Realtime on battle tables for live lobby and progress tracking

ALTER PUBLICATION supabase_realtime ADD TABLE quiz_battles;
ALTER PUBLICATION supabase_realtime ADD TABLE battle_results;
ALTER PUBLICATION supabase_realtime ADD TABLE battle_answers;
