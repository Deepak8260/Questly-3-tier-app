-- ============================================================
-- Questly — Profile Avatar & Bio Migration
-- Migration: 20260707_add_profile_avatar_and_bio.sql
--
-- Adds avatar_url, bio, social_links, and notification_preferences columns to profiles table
-- Also creates storage bucket for avatars with proper policies
-- ============================================================

-- First, let's ensure the profiles table exists (in case it wasn't created yet)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add new columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email_notifications": true, "push_notifications": true, "battle_invites": true, "contest_reminders": true}'::jsonb;

-- Enable RLS if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
DO $$ BEGIN
  -- Users can view their own profile and others' basic info
  CREATE POLICY "profiles_select_all"
    ON profiles FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Users can update their own profile
  CREATE POLICY "profiles_update_self"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Users can insert their own profile on sign up
  CREATE POLICY "profiles_insert_self"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- STORAGE BUCKET SETUP FOR AVATARS
-- ============================================================

-- Insert the avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the avatars bucket
DO $$ BEGIN
  -- Allow public access to view avatars
  CREATE POLICY "avatars_public_access"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Allow authenticated users to upload their own avatars
  CREATE POLICY "avatars_upload_authenticated"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'avatars' AND
      auth.role() = 'authenticated' AND
      (storage.foldername(name))[1] = 'avatars' AND
      (storage.foldername(name))[2] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Allow users to update their own avatars
  CREATE POLICY "avatars_update_own"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'avatars' AND
      auth.uid()::text = (storage.foldername(name))[2]
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Allow users to delete their own avatars
  CREATE POLICY "avatars_delete_own"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'avatars' AND
      auth.uid()::text = (storage.foldername(name))[2]
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
