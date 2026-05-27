-- =============================================
-- Multi-Event Support Migration
-- SAFE: Does NOT modify any existing data
-- Existing rows get event_id = NULL (event 1 data untouched)
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Create events table
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,          -- e.g. 'agentic-infra-2026'
  name text NOT NULL,                 -- e.g. 'Agentic Infra Event'
  event_date date,
  location text,
  is_active boolean DEFAULT true,     -- controls which event the form shows
  created_at timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all reads on events" ON events FOR SELECT USING (true);
CREATE POLICY "Allow service role all on events" ON events FOR ALL USING (true);

-- 2. Add nullable event_id to luma_list (existing rows stay NULL = event 1)
ALTER TABLE luma_list ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES events(id);

-- 3. Add nullable event_id to profiles (existing rows stay NULL = event 1)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES events(id);

-- 4. Add nullable event_id to matches (existing rows stay NULL = event 1)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES events(id);

-- 5. Update luma_list primary key to allow same email across events
-- We need a composite unique constraint instead of email-only PK
-- But we CANNOT drop the existing PK (that would affect event 1 data)
-- So we add a unique constraint for (event_id, email) for new data
CREATE UNIQUE INDEX IF NOT EXISTS luma_list_event_email_idx ON luma_list (event_id, email) WHERE event_id IS NOT NULL;

-- 6. Same for profiles - allow same email across events
CREATE UNIQUE INDEX IF NOT EXISTS profiles_event_email_idx ON profiles (event_id, email) WHERE event_id IS NOT NULL;

-- 7. Indexes for fast event-scoped queries
CREATE INDEX IF NOT EXISTS matches_event_id_idx ON matches (event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_event_id_idx ON profiles (event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS luma_list_event_id_idx ON luma_list (event_id) WHERE event_id IS NOT NULL;

-- =============================================
-- DONE. No existing data was modified.
-- Event 1 rows have event_id = NULL and are untouched.
-- New events will have explicit event_id set.
-- =============================================
