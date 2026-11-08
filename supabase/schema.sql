-- Repwise schema. Paste this into the Supabase SQL editor and run it once.
-- Safe to re-run: every statement is idempotent.

create table if not exists public.workouts (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  exercise    text not null,
  sets        jsonb not null default '[]'::jsonb,
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists workouts_user_updated_idx on public.workouts (user_id, updated_at);

-- The server owns updated_at, so a device with a wrong clock can't win a conflict.
-- clock_timestamp() (not now()) gives each row in a batch its own timestamp.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists workouts_set_updated_at on public.workouts;
create trigger workouts_set_updated_at
  before insert or update on public.workouts
  for each row execute function public.set_updated_at();

-- Row-level security: each signed-in user can only touch their own rows.
alter table public.workouts enable row level security;

drop policy if exists "workouts_select_own" on public.workouts;
create policy "workouts_select_own" on public.workouts
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "workouts_insert_own" on public.workouts;
create policy "workouts_insert_own" on public.workouts
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "workouts_update_own" on public.workouts;
create policy "workouts_update_own" on public.workouts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "workouts_delete_own" on public.workouts;
create policy "workouts_delete_own" on public.workouts
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Defense in depth: signed-out (anon) visitors get no access at all.
revoke all on public.workouts from anon;

-- ---------------------------------------------------------------------------
-- v2: one row per workout session. A session holds its exercises and sets as
-- JSON, so a whole workout syncs as a single document. The older `workouts`
-- table above is no longer used by the app and is kept only for rollback.
-- ---------------------------------------------------------------------------
create table if not exists public.sessions (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  name        text not null default '',
  started_at  timestamptz not null,
  ended_at    timestamptz,
  notes       text not null default '',
  exercises   jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists sessions_user_updated_idx on public.sessions (user_id, updated_at);

drop trigger if exists sessions_set_updated_at on public.sessions;
create trigger sessions_set_updated_at
  before insert or update on public.sessions
  for each row execute function public.set_updated_at();

alter table public.sessions enable row level security;

drop policy if exists "sessions_select_own" on public.sessions;
create policy "sessions_select_own" on public.sessions
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "sessions_insert_own" on public.sessions;
create policy "sessions_insert_own" on public.sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "sessions_update_own" on public.sessions;
create policy "sessions_update_own" on public.sessions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "sessions_delete_own" on public.sessions;
create policy "sessions_delete_own" on public.sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.sessions from anon;

-- ---------------------------------------------------------------------------
-- v3: saved routines and your own exercises.
-- ---------------------------------------------------------------------------
create table if not exists public.routines (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  notes       text not null default '',
  exercises   jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists routines_user_updated_idx on public.routines (user_id, updated_at);

drop trigger if exists routines_set_updated_at on public.routines;
create trigger routines_set_updated_at
  before insert or update on public.routines
  for each row execute function public.set_updated_at();

alter table public.routines enable row level security;

drop policy if exists "routines_select_own" on public.routines;
create policy "routines_select_own" on public.routines
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "routines_insert_own" on public.routines;
create policy "routines_insert_own" on public.routines
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "routines_update_own" on public.routines;
create policy "routines_update_own" on public.routines
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "routines_delete_own" on public.routines;
create policy "routines_delete_own" on public.routines
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.routines from anon;

create table if not exists public.custom_exercises (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  muscle      text not null default '',
  equipment   text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists custom_exercises_user_updated_idx on public.custom_exercises (user_id, updated_at);

drop trigger if exists custom_exercises_set_updated_at on public.custom_exercises;
create trigger custom_exercises_set_updated_at
  before insert or update on public.custom_exercises
  for each row execute function public.set_updated_at();

alter table public.custom_exercises enable row level security;

drop policy if exists "custom_exercises_select_own" on public.custom_exercises;
create policy "custom_exercises_select_own" on public.custom_exercises
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "custom_exercises_insert_own" on public.custom_exercises;
create policy "custom_exercises_insert_own" on public.custom_exercises
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "custom_exercises_update_own" on public.custom_exercises;
create policy "custom_exercises_update_own" on public.custom_exercises
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "custom_exercises_delete_own" on public.custom_exercises;
create policy "custom_exercises_delete_own" on public.custom_exercises
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.custom_exercises from anon;

-- ============================================================================
-- Profiles, body tracking, goals, account deletion (Piece 1)
-- ============================================================================

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null default '',
  units         text not null default 'lb' check (units in ('lb', 'kg')),
  height_cm     numeric check (height_cm is null or (height_cm > 0 and height_cm < 300)),
  week_start    smallint not null default 1 check (week_start in (0, 1)),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before insert or update on public.profiles
  for each row execute function public.set_updated_at();
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles for delete to authenticated using ((select auth.uid()) = id);
revoke all on public.profiles from anon;

create table if not exists public.body_entries (
  id            uuid primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date          date not null,
  weight_kg     numeric check (weight_kg is null or (weight_kg > 0 and weight_kg < 700)),
  body_fat      numeric check (body_fat is null or (body_fat > 0 and body_fat < 100)),
  measurements  jsonb not null default '{}'::jsonb,
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index if not exists body_entries_user_updated_idx on public.body_entries (user_id, updated_at);
drop trigger if exists body_entries_set_updated_at on public.body_entries;
create trigger body_entries_set_updated_at before insert or update on public.body_entries
  for each row execute function public.set_updated_at();
alter table public.body_entries enable row level security;
drop policy if exists "body_entries_select_own" on public.body_entries;
create policy "body_entries_select_own" on public.body_entries for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "body_entries_insert_own" on public.body_entries;
create policy "body_entries_insert_own" on public.body_entries for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "body_entries_update_own" on public.body_entries;
create policy "body_entries_update_own" on public.body_entries for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "body_entries_delete_own" on public.body_entries;
create policy "body_entries_delete_own" on public.body_entries for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.body_entries from anon;

create table if not exists public.goals (
  id           uuid primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type         text not null check (type in ('weekly_workouts', 'body_weight', 'lift')),
  exercise     text not null default '',
  metric       text not null default '' check (metric in ('', 'weight', 'e1rm')),
  target       numeric not null check (target > 0),
  start_value  numeric,
  start_date   date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index if not exists goals_user_updated_idx on public.goals (user_id, updated_at);
drop trigger if exists goals_set_updated_at on public.goals;
create trigger goals_set_updated_at before insert or update on public.goals
  for each row execute function public.set_updated_at();
alter table public.goals enable row level security;
drop policy if exists "goals_select_own" on public.goals;
create policy "goals_select_own" on public.goals for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "goals_insert_own" on public.goals;
create policy "goals_insert_own" on public.goals for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "goals_update_own" on public.goals;
create policy "goals_update_own" on public.goals for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "goals_delete_own" on public.goals;
create policy "goals_delete_own" on public.goals for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.goals from anon;

-- Lets a signed-in user delete their OWN account; related rows cascade.
-- Takes no arguments, so it can only ever act on the caller. (The Supabase
-- advisor warns about SECURITY DEFINER functions; this one is intentional.)
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ============================================================================
-- Places, activities, workout location, goal notes
-- ============================================================================

-- Places you exercise (names only; no coordinates are stored).
create table if not exists public.places (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists places_user_updated_idx on public.places (user_id, updated_at);
drop trigger if exists places_set_updated_at on public.places;
create trigger places_set_updated_at before insert or update on public.places
  for each row execute function public.set_updated_at();
alter table public.places enable row level security;
drop policy if exists "places_select_own" on public.places;
create policy "places_select_own" on public.places for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "places_insert_own" on public.places;
create policy "places_insert_own" on public.places for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "places_update_own" on public.places;
create policy "places_update_own" on public.places for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "places_delete_own" on public.places;
create policy "places_delete_own" on public.places for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.places from anon;

-- Non-gym activities: runs, rides, sports and so on. Distance is stored in km.
-- place_id is deliberately not a foreign key: places and activities sync independently.
create table if not exists public.activities (
  id            uuid primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date          date not null,
  type          text not null check (char_length(type) between 1 and 40),
  title         text not null default '' check (char_length(title) <= 80),
  duration_min  numeric not null check (duration_min > 0 and duration_min <= 1440),
  distance_km   numeric check (distance_km is null or (distance_km >= 0 and distance_km <= 5000)),
  effort        smallint check (effort is null or (effort between 1 and 10)),
  place_id      uuid,
  notes         text not null default '' check (char_length(notes) <= 2000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index if not exists activities_user_updated_idx on public.activities (user_id, updated_at);
drop trigger if exists activities_set_updated_at on public.activities;
create trigger activities_set_updated_at before insert or update on public.activities
  for each row execute function public.set_updated_at();
alter table public.activities enable row level security;
drop policy if exists "activities_select_own" on public.activities;
create policy "activities_select_own" on public.activities for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "activities_insert_own" on public.activities;
create policy "activities_insert_own" on public.activities for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "activities_update_own" on public.activities;
create policy "activities_update_own" on public.activities for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "activities_delete_own" on public.activities;
create policy "activities_delete_own" on public.activities for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.activities from anon;

-- A workout can say where it happened; a goal can carry a note.
alter table public.sessions add column if not exists place_id uuid;
alter table public.goals add column if not exists notes text not null default '' check (char_length(notes) <= 2000);

-- Stretches done during an activity (a list of exercise names).
alter table public.activities add column if not exists stretches jsonb not null default '[]'::jsonb;
alter table public.activities drop constraint if exists activities_stretches_is_array;
alter table public.activities add constraint activities_stretches_is_array check (jsonb_typeof(stretches) = 'array' and jsonb_array_length(stretches) <= 40);

-- How an exercise is measured (weight, bodyweight, time, stretch, cardio, carry) and extra activity details.
alter table public.custom_exercises add column if not exists mode text not null default '';
alter table public.custom_exercises drop constraint if exists custom_exercises_mode_check;
alter table public.custom_exercises add constraint custom_exercises_mode_check check (mode in ('', 'weight', 'bodyweight', 'time', 'stretch', 'cardio', 'carry'));
alter table public.activities add column if not exists elevation_m numeric check (elevation_m is null or (elevation_m >= 0 and elevation_m <= 10000));
alter table public.activities add column if not exists incline_pct numeric check (incline_pct is null or (incline_pct >= 0 and incline_pct <= 100));
alter table public.activities add column if not exists avg_hr smallint check (avg_hr is null or (avg_hr between 30 and 250));
