-- Run this in the Supabase SQL Editor to create the profiles table

create table if not exists profiles (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  company text not null,
  role text not null,
  what_building text not null,
  stage text not null,
  looking_for text[] not null default '{}',
  can_offer text[] not null default '{}',
  walk_away_with text not null,
  created_at timestamptz default now()
);

-- Enable Row Level Security (permissive for now, tighten when auth is added)
alter table profiles enable row level security;

create policy "Allow all reads" on profiles for select using (true);
create policy "Allow all inserts" on profiles for insert with check (true);
