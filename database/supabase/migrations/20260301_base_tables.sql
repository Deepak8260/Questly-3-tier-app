-- ============================================================
-- Questly — Base Tables
-- Migration: 20260301_base_tables.sql
--
-- Creates the tables the app uses that the later migrations do not
-- create: profiles, questly_quiz_attempts and admin_settings.
-- Columns follow what the frontend and backend code read and write.
--
-- Run this FIRST on a new project. The 20260310 migration defines
-- is_super_admin(), which reads profiles, so profiles must exist before
-- it. Safe to re-run: every statement uses IF NOT EXISTS or skips
-- duplicates.
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- 1. PROFILES  (one row per user)
-- ──────────────────────────────────────────────────────────────
-- Written by the backend (/api/quiz/save-attempt), the dashboard and the
-- admin pages. avatar_url, bio, social_links and notification_preferences
-- are added by 20260707_add_profile_avatar_and_bio.sql.

CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT,
  email         TEXT,
  role          TEXT NOT NULL DEFAULT 'user',      -- 'user' or 'super_admin'
  last_seen_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;


-- ──────────────────────────────────────────────────────────────
-- 2. SUPER ADMIN CHECK
-- ──────────────────────────────────────────────────────────────
-- Same definition as in 20260310_live_contest_system.sql, created here
-- so the policies below can use it.

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE  id   = auth.uid()
    AND    role = 'super_admin'
  );
$$;


-- ──────────────────────────────────────────────────────────────
-- 3. QUIZ ATTEMPTS  (one row per finished quiz)
-- ──────────────────────────────────────────────────────────────
-- Inserted by the backend with the service_role key, which bypasses
-- RLS. Read, deleted and (by admins) updated from the browser.

CREATE TABLE IF NOT EXISTS questly_quiz_attempts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  topic               TEXT,
  difficulty          TEXT,
  question_type       TEXT,
  total_questions     INT,
  correct_answers     INT,
  score_pct           INT,
  time_taken_secs     INT,
  passed              BOOLEAN NOT NULL DEFAULT false,
  certificate_earned  BOOLEAN NOT NULL DEFAULT false,
  questions_data      JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quiz_attempts_user_id_idx    ON questly_quiz_attempts (user_id);
CREATE INDEX IF NOT EXISTS quiz_attempts_created_at_idx ON questly_quiz_attempts (created_at DESC);


-- ──────────────────────────────────────────────────────────────
-- 4. ADMIN SETTINGS  (key/value pairs from /admin/settings)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ──────────────────────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY
-- ──────────────────────────────────────────────────────────────

-- profiles: everyone may read; each user manages their own row;
-- super admins manage all rows (change roles, delete users).
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "profiles_insert_self" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "profiles_update_self" ON profiles FOR UPDATE
    USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "profiles_delete_self" ON profiles FOR DELETE USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "profiles_admin_all" ON profiles FOR ALL
    USING (is_super_admin()) WITH CHECK (is_super_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- questly_quiz_attempts: users see and delete their own attempts;
-- super admins see, update and delete all of them.
ALTER TABLE questly_quiz_attempts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "attempts_select_own" ON questly_quiz_attempts FOR SELECT
    USING (auth.uid() = user_id OR is_super_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "attempts_delete_own" ON questly_quiz_attempts FOR DELETE
    USING (auth.uid() = user_id OR is_super_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "attempts_update_admin" ON questly_quiz_attempts FOR UPDATE
    USING (is_super_admin()) WITH CHECK (is_super_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- admin_settings: super admins only.
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "admin_settings_admin_all" ON admin_settings FOR ALL
    USING (is_super_admin()) WITH CHECK (is_super_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
