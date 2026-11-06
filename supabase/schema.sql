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
