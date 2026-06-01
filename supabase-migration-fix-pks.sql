-- =============================================
-- Fix Primary Keys for Multi-Event Support
-- SAFE: Does NOT delete or modify any existing row data
-- Only changes constraints to allow same email across events
-- Run this in Supabase SQL Editor
-- =============================================

-- ============ luma_list ============

-- 1. Add a surrogate id column (existing rows get auto-generated UUIDs)
ALTER TABLE luma_list ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

-- 2. Backfill any NULL ids (just in case)
UPDATE luma_list SET id = gen_random_uuid() WHERE id IS NULL;

-- 3. Make id NOT NULL
ALTER TABLE luma_list ALTER COLUMN id SET NOT NULL;

-- 4. Drop the old email-only primary key
ALTER TABLE luma_list DROP CONSTRAINT luma_list_pkey;

-- 5. Set id as the new primary key
ALTER TABLE luma_list ADD PRIMARY KEY (id);

-- 6. Keep a unique constraint on (email) WHERE event_id IS NULL (protects event 1 data)
CREATE UNIQUE INDEX IF NOT EXISTS luma_list_email_null_event_idx ON luma_list (email) WHERE event_id IS NULL;

-- ============ profiles ============

-- 7. Add a surrogate id column (existing rows get auto-generated UUIDs)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

-- 8. Backfill any NULL ids
UPDATE profiles SET id = gen_random_uuid() WHERE id IS NULL;

-- 9. Make id NOT NULL
ALTER TABLE profiles ALTER COLUMN id SET NOT NULL;

-- 10. Drop the old email-only primary key
ALTER TABLE profiles DROP CONSTRAINT profiles_pkey;

-- 11. Set id as the new primary key
ALTER TABLE profiles ADD PRIMARY KEY (id);

-- 12. Keep a unique constraint on (email) WHERE event_id IS NULL (protects event 1 data)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_null_event_idx ON profiles (email) WHERE event_id IS NULL;

-- =============================================
-- DONE. All existing rows are untouched.
-- Event 1 rows (event_id=NULL) still have unique email enforcement.
-- New events can have the same email appear with different event_ids.
-- =============================================
