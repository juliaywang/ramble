-- ==============================================================================
-- RAMBLE APP: SUPABASE DATABASE SCHEMA
-- Run this in your Supabase project's SQL Editor (https://supabase.com/dashboard)
-- ==============================================================================

-- 1. Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- 2. PROFILES TABLE
-- Holds Ramble explorer profiles, their NYC interests, and exploration stats.
create table if not exists public.profiles (
  id text primary key,
  username text unique not null,
  name text not null,
  bio text default '',
  photo text,
  interests text[] default '{}',
  discovered_ids text[] default '{}',
  quests_count integer default 0,
  passport_percent integer default 0,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 3. FRIENDSHIPS TABLE
-- Handles bidirectional friendships and friend requests (pending, accepted, declined).
create table if not exists public.friendships (
  id uuid default gen_random_uuid() primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  friend_id text not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null,
  constraint unique_friendship unique (user_id, friend_id),
  constraint no_self_friendship check (user_id <> friend_id)
);

-- 4. INDEXES
create index if not exists idx_profiles_username on public.profiles (lower(username));
create index if not exists idx_profiles_name on public.profiles (lower(name));
create index if not exists idx_friendships_user_id on public.friendships (user_id);
create index if not exists idx_friendships_friend_id on public.friendships (friend_id);
create index if not exists idx_friendships_status on public.friendships (status);

-- 5. ROW LEVEL SECURITY (RLS)
-- Enables security with prototype-friendly public anon policies.
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;

-- Drop existing policies if re-running script
drop policy if exists "Profiles are publicly readable" on public.profiles;
drop policy if exists "Profiles can be created or updated" on public.profiles;
drop policy if exists "Friendships are publicly readable" on public.friendships;
drop policy if exists "Friendships can be inserted" on public.friendships;
drop policy if exists "Friendships can be updated" on public.friendships;
drop policy if exists "Friendships can be deleted" on public.friendships;

-- Profiles policies
create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "Profiles can be created or updated"
  on public.profiles for all
  using (true)
  with check (true);

-- Friendships policies
create policy "Friendships are publicly readable"
  on public.friendships for select
  using (true);

create policy "Friendships can be inserted"
  on public.friendships for insert
  with check (true);

create policy "Friendships can be updated"
  on public.friendships for update
  using (true)
  with check (true);

create policy "Friendships can be deleted"
  on public.friendships for delete
  using (true);

-- 6. SAMPLE SEED DATA (NYC Explorers)
-- Optional initial seed profiles so you have users to discover and friend right away!
insert into public.profiles (id, username, name, bio, photo, interests, discovered_ids, quests_count, passport_percent)
values
  (
    'usr_mayawalks',
    'mayawalks',
    'Maya Chen',
    'Coffee enthusiast & weekend mural hunter exploring Bushwick, Morningside, and Chinatown.',
    null,
    array['coffee', 'art', 'books', 'food'],
    array['book-culture', 'hungarian', 'greenmarket', 'hex-and-co', 'peace-fountain'],
    8,
    83
  ),
  (
    'usr_marcus_nyc',
    'marcus_nyc',
    'Marcus Rivera',
    'Community organizer, local historian, and board game lover in Upper Manhattan.',
    null,
    array['history', 'gaming', 'culture', 'volunteering'],
    array['ford-hall', 'greenmarket', 'st-john-the-divine', 'grant-tomb'],
    5,
    67
  ),
  (
    'usr_elenarambles',
    'elenarambles',
    'Elena Rostova',
    'Plant lover, botanical explorer, and neighborhood garden caretaker.',
    null,
    array['sustainability', 'art', 'music', 'coffee'],
    array['book-culture', 'greenmarket', 'riverside-church', 'sakura-park', 'morningside-park'],
    12,
    100
  ),
  (
    'usr_jordanr',
    'jordanr',
    'Jordan Reed',
    'Student radio producer and jazz listener roaming Harlem and the Village.',
    null,
    array['music', 'coffee', 'technology', 'food'],
    array['hungarian', 'columbia-radio', 'miller-theatre', 'greenmarket'],
    4,
    50
  )
on conflict (id) do update set
  name = excluded.name,
  username = excluded.username,
  bio = excluded.bio,
  interests = excluded.interests,
  discovered_ids = excluded.discovered_ids,
  quests_count = excluded.quests_count,
  passport_percent = excluded.passport_percent;

-- ==============================================================================
-- 7. ACCOUNT STATE TABLE (OPTIONAL CLOUD PROGRESS BACKUP)
-- Stores complete JSON snapshots of user quests, saves, and journeys
-- ==============================================================================
create table if not exists public.account_state (
  user_id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.account_state enable row level security;

drop policy if exists "Account state is manageable by anyone" on public.account_state;
create policy "Account state is manageable by anyone"
  on public.account_state for all
  using (true)
  with check (true);

