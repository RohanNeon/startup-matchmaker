-- =============================================
-- Neon Fund Startup Matchmaker — Database Schema v2
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Create luma_list table (attendee list from Luma)
create table if not exists luma_list (
  email text primary key,
  linkedin_url text
);

alter table luma_list enable row level security;
create policy "Allow all reads on luma_list" on luma_list for select using (true);
create policy "Allow service role inserts on luma_list" on luma_list for insert with check (true);

-- 2. Drop old profiles table and recreate with email as PK
drop table if exists profiles cascade;

create table profiles (
  email text primary key,
  name text not null,
  company text not null,
  role text not null,
  what_building text,
  looking_for text[] not null default '{}',
  can_offer text[] not null default '{}',
  created_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "Allow all reads on profiles" on profiles for select using (true);
create policy "Allow all inserts on profiles" on profiles for insert with check (true);
