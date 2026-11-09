import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useLiveQuery } from 'dexie-react-hooks';
import { clearLocalData, db, getOwner, PROFILE_ID, setOwner } from './db';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Only the publishable key ever ships to the browser; row-level security
// on the server is what keeps each user's rows private.
export const supabase = url && key ? createClient(url, key) : null;

const PUSH_CHUNK = 100;
const PULL_PAGE = 1000;
const LAST_SYNCED = 'repwise.lastSynced';

// What gets synced. `toRemote` lists the columns we send; updated_at is
// deliberately not one of them: the server sets it, so a device with a wrong
// clock can't win a conflict.
//
// The profile is special: there is one per account and its server id is the account
// id, while on the device it is always the row 'me'. `pullFirst` tables are pulled
// before anything is pushed, and a never-synced local copy loses to the server's.
export const TABLES = [
  {
    remote: 'profiles',
    local: () => db.profile,
    cursor: 'last_pull_profiles',
    pullFirst: true,
    toLocalId: () => PROFILE_ID,
    toRemote: (p, userId) => ({
      id: userId,
      display_name: p.display_name ?? '',
      units: p.units === 'kg' ? 'kg' : 'lb',
      height_cm: p.height_cm ?? null,
      week_start: p.week_start === 0 ? 0 : 1,
      onboarding: p.onboarding ?? null,
      plan: p.plan ?? null,
      calorie_target: p.calorie_target ?? null,
      protein_target: p.protein_target ?? null,
      food_mode: p.food_mode ?? null,
      created_at: p.created_at,
      deleted_at: p.deleted_at ?? null,
    }),
  },
  {
    remote: 'sessions',
    local: () => db.sessions,
    cursor: 'last_pull_sessions',
    toRemote: (s, userId) => ({
      id: s.id,
      user_id: userId,
      date: s.date,
      name: s.name ?? '',
      started_at: s.started_at,
      ended_at: s.ended_at ?? null,
      notes: s.notes ?? '',
      exercises: s.exercises ?? [],
      place_id: s.place_id ?? null,
      created_at: s.created_at,
      deleted_at: s.deleted_at ?? null,
    }),
  },
  {
    remote: 'routines',
    local: () => db.routines,
    cursor: 'last_pull_routines',
    toRemote: (r, userId) => ({
      id: r.id,
      user_id: userId,
      name: r.name ?? '',
      notes: r.notes ?? '',
      exercises: r.exercises ?? [],
      created_at: r.created_at,
      deleted_at: r.deleted_at ?? null,
    }),
  },
  {
    remote: 'custom_exercises',
    local: () => db.customExercises,
    cursor: 'last_pull_custom_exercises',
    toRemote: (c, userId) => ({
      id: c.id,
      user_id: userId,
      name: c.name,
      muscle: c.muscle ?? '',
      equipment: c.equipment ?? '',
      mode: c.mode ?? '',
      created_at: c.created_at,
      deleted_at: c.deleted_at ?? null,
    }),
  },
  {
    remote: 'foods',
    local: () => db.foods,
    cursor: 'last_pull_foods',
    toRemote: (f, userId) => ({
      id: f.id,
      user_id: userId,
      name: f.name,
      serving: f.serving ?? '',
      calories: f.calories ?? null,
      protein: f.protein ?? null,
      carbs: f.carbs ?? null,
      fat: f.fat ?? null,
      created_at: f.created_at,
      deleted_at: f.deleted_at ?? null,
    }),
  },
  {
    remote: 'food_notes',
    local: () => db.foodNotes,
    cursor: 'last_pull_food_notes',
    toRemote: (n, userId) => ({ id: n.id, user_id: userId, date: n.date, text: n.text ?? '', feeling: n.feeling ?? '', created_at: n.created_at, deleted_at: n.deleted_at ?? null }),
  },
  {
    remote: 'food_log',
    local: () => db.foodLog,
    cursor: 'last_pull_food_log',
    toRemote: (e, userId) => ({
      id: e.id,
      user_id: userId,
      date: e.date,
      time: e.time ?? '',
      name: e.name,
      serving: e.serving ?? '',
      servings: e.servings ?? 1,
      calories: e.calories ?? null,
      protein: e.protein ?? null,
      carbs: e.carbs ?? null,
      fat: e.fat ?? null,
      food_id: e.food_id ?? null,
      notes: e.notes ?? '',
      created_at: e.created_at,
      deleted_at: e.deleted_at ?? null,
    }),
  },
  {
    remote: 'body_entries',
    local: () => db.bodyEntries,
    cursor: 'last_pull_body_entries',
    toRemote: (e, userId) => ({
      id: e.id,
      user_id: userId,
      date: e.date,
      weight_kg: e.weight_kg ?? null,
      body_fat: e.body_fat ?? null,
      measurements: e.measurements ?? {},
      notes: e.notes ?? '',
      created_at: e.created_at,
      deleted_at: e.deleted_at ?? null,
    }),
  },
  {
    remote: 'goals',
    local: () => db.goals,
    cursor: 'last_pull_goals',
    toRemote: (g, userId) => ({
      id: g.id,
      user_id: userId,
      type: g.type,
      exercise: g.exercise ?? '',
      metric: g.metric ?? '',
      target: g.target,
      start_value: g.start_value ?? null,
      start_date: g.start_date ?? null,
      notes: g.notes ?? '',
      created_at: g.created_at,
      deleted_at: g.deleted_at ?? null,
    }),
  },
  {
    remote: 'places',
    local: () => db.places,
    cursor: 'last_pull_places',
    toRemote: (p, userId) => ({
      id: p.id,
      user_id: userId,
      name: p.name,
      created_at: p.created_at,
      deleted_at: p.deleted_at ?? null,
    }),
  },
  {
    remote: 'activities',
    local: () => db.activities,
    cursor: 'last_pull_activities',
    toRemote: (a, userId) => ({
      id: a.id,
      user_id: userId,
      date: a.date,
      type: a.type,
      title: a.title ?? '',
      duration_min: a.duration_min,
      distance_km: a.distance_km ?? null,
      effort: a.effort ?? null,
      elevation_m: a.elevation_m ?? null,
      incline_pct: a.incline_pct ?? null,
      avg_hr: a.avg_hr ?? null,
      place_id: a.place_id ?? null,
      stretches: a.stretches ?? [],
      notes: a.notes ?? '',
      created_at: a.created_at,
      deleted_at: a.deleted_at ?? null,
    }),
  },
];

const localId = (t, remoteId) => (t.toLocalId ? t.toLocalId(remoteId) : remoteId);

async function push(t, userId) {
  const table = t.local();
  const dirty = await table.where('dirty').equals(1).toArray();
  for (let i = 0; i < dirty.length; i += PUSH_CHUNK) {
    const chunk = dirty.slice(i, i + PUSH_CHUNK);
    const payload = chunk.map((row) => t.toRemote(row, userId));
    const { data, error } = await supabase.from(t.remote).upsert(payload, { onConflict: 'id' }).select('id, updated_at');
    if (error) throw error;

    const sent = new Map(chunk.map((row) => [row.id, row.rev ?? 0]));
    await db.transaction('rw', table, async () => {
      for (const r of data) {
        const id = localId(t, r.id);
        const local = await table.get(id);
        if (!local) continue;
        // Edited again while the request was in flight? Stay dirty.
        const stillSame = (local.rev ?? 0) === sent.get(id);
        await table.update(id, {
          user_id: userId,
          updated_at: r.updated_at,
          ...(stillSame ? { dirty: 0 } : {}),
        });
      }
    });
  }
}

async function pull(t) {
  const table = t.local();
  let since = (await db.meta.get(t.cursor))?.value ?? null;
  for (;;) {
    let q = supabase.from(t.remote).select('*').order('updated_at', { ascending: true }).limit(PULL_PAGE);
    if (since) q = q.gte('updated_at', since); // gte + idempotent merge: never skips rows sharing a timestamp
    const { data, error } = await q;
    if (error) throw error;
    if (!data.length) break;

    await db.transaction('rw', table, db.meta, async () => {
      for (const r of data) {
        const id = localId(t, r.id);
        const local = await table.get(id);
        // An unpushed local edit wins until it is pushed, except a profile that has
        // never reached the server: the account's real profile beats a fresh default.
        if (local?.dirty && !(t.pullFirst && !local.updated_at)) continue;
        await table.put({ ...r, id, dirty: 0, rev: local?.rev ?? 0 });
      }
      await db.meta.put({ key: t.cursor, value: data[data.length - 1].updated_at });
    });

    const next = data[data.length - 1].updated_at;
    if (data.length < PULL_PAGE || next === since) break;
    since = next;
  }
}

export async function runSync() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return false;
  const uid = session.user.id;
  // Data on this device belongs to whoever signed in first. A different account must
  // never inherit (and upload) someone else's rows.
  const owner = getOwner();
  if (owner && owner !== uid) await clearLocalData();
  setOwner(uid);

  for (const t of TABLES.filter((x) => x.pullFirst)) await pull(t);
  for (const t of TABLES) await push(t, uid);
  for (const t of TABLES.filter((x) => !x.pullFirst)) await pull(t);
  return true;
}

// Only one tab per browser may sync at a time. Without this, two open tabs
// (for example the original and the one a magic link opens) both push and pull
// at once, which shows up as duplicate requests. Returns null if another tab is syncing.
function withSyncLock(fn) {
  if (!navigator.locks?.request) return fn();
  return navigator.locks.request('repwise-sync', { ifAvailable: true }, (lock) => (lock ? fn() : null));
}

// Waits for any sync in progress (in any tab) to finish, then runs fn alone.
function withExclusiveLock(fn) {
  if (!navigator.locks?.request) return fn();
  return navigator.locks.request('repwise-sync', fn);
}

const countDirty = async () => {
  const counts = await Promise.all(TABLES.map((t) => t.local().where('dirty').equals(1).count()));
  return counts.reduce((a, b) => a + b, 0);
};

export function useSync() {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState(supabase ? 'idle' : 'disabled');
  const [error, setError] = useState('');
  const [lastSynced, setLastSynced] = useState(() => {
    try {
      return localStorage.getItem(LAST_SYNCED);
    } catch {
      return null;
    }
  });
  const running = useRef(false);
  const pending = useLiveQuery(countDirty, [], 0);

  const syncNow = useCallback(async () => {
    if (!supabase || running.current) return;
    if (!navigator.onLine) {
      setStatus('offline');
      return;
    }
    running.current = true;
    setStatus('syncing');
    setError('');
    try {
      const ok = await withSyncLock(runSync);
      if (ok === true) {
        const ts = new Date().toISOString();
        setLastSynced(ts);
        try {
          localStorage.setItem(LAST_SYNCED, ts);
        } catch {
          /* ignore */
        }
      }
      setStatus('idle');
    } catch (e) {
      setError(e?.message || String(e));
      setStatus('error');
    } finally {
      running.current = false;
    }
  }, []);

  // Track the auth session (this also handles the magic-link redirect).
  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Sync on sign-in, when coming back online, when the tab regains focus, and on a timer.
  useEffect(() => {
    if (!supabase || !session) return undefined;
    syncNow();
    const onOnline = () => syncNow();
    const onVisible = () => document.visibilityState === 'visible' && syncNow();
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(syncNow, 3 * 60 * 1000);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [session, syncNow]);

  // Push soon after a local change.
  useEffect(() => {
    if (!supabase || !session || !pending) return undefined;
    const t = setTimeout(syncNow, 1500);
    return () => clearTimeout(t);
  }, [pending, session, syncNow]);

  const signIn = useCallback(async (email) => {
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    });
    if (err) throw err;
  }, []);

  // Signing out also wipes this device, so the next person to use it sees nothing of yours.
  // (Everything that reached the server is still there when you sign back in.)
  const signOut = useCallback(async () => {
    await withExclusiveLock(async () => {
      await supabase.auth.signOut();
      await clearLocalData();
    });
  }, []);

  // Permanently deletes the account and all of its server data, then clears this device.
  const deleteAccount = useCallback(async () => {
    const { error: err } = await supabase.rpc('delete_my_account');
    if (err) throw err;
    await withExclusiveLock(async () => {
      await supabase.auth.signOut({ scope: 'local' });
      await clearLocalData();
    });
  }, []);

  return { enabled: !!supabase, session, status, error, lastSynced, pending, syncNow, signIn, signOut, deleteAccount };
}
