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
