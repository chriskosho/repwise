import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Only the publishable key ever ships to the browser; row-level security
// on the server is what keeps each user's rows private.
export const supabase = url && key ? createClient(url, key) : null;

const PUSH_CHUNK = 200;
const PULL_PAGE = 1000;
const LAST_SYNCED = 'repwise.lastSynced';

async function push(userId) {
  const dirty = await db.workouts.where('dirty').equals(1).toArray();
  for (let i = 0; i < dirty.length; i += PUSH_CHUNK) {
    const chunk = dirty.slice(i, i + PUSH_CHUNK);
    // updated_at is deliberately not sent: the server sets it, so a device
    // with a wrong clock can't win a conflict.
    const payload = chunk.map((w) => ({
      id: w.id,
      user_id: userId,
      date: w.date,
      exercise: w.exercise,
      sets: w.sets,
      notes: w.notes ?? '',
      created_at: w.created_at,
      deleted_at: w.deleted_at ?? null,
    }));
    const { data, error } = await supabase
      .from('workouts')
      .upsert(payload, { onConflict: 'id' })
      .select('id, updated_at');
    if (error) throw error;

    const sent = new Map(chunk.map((w) => [w.id, w.rev ?? 0]));
    await db.transaction('rw', db.workouts, async () => {
      for (const r of data) {
        const local = await db.workouts.get(r.id);
        if (!local) continue;
        // Edited again while the request was in flight? Stay dirty.
        const stillSame = (local.rev ?? 0) === sent.get(r.id);
        await db.workouts.update(r.id, {
          user_id: userId,
          updated_at: r.updated_at,
          ...(stillSame ? { dirty: 0 } : {}),
        });
      }
    });
  }
}

async function pull() {
  let since = (await db.meta.get('last_pull'))?.value ?? null;
  for (;;) {
    let q = supabase.from('workouts').select('*').order('updated_at', { ascending: true }).limit(PULL_PAGE);
    if (since) q = q.gte('updated_at', since); // gte + idempotent merge: never skips rows sharing a timestamp
    const { data, error } = await q;
    if (error) throw error;
    if (!data.length) break;

    await db.transaction('rw', db.workouts, db.meta, async () => {
      for (const r of data) {
        const local = await db.workouts.get(r.id);
        if (local?.dirty) continue; // unpushed local edit wins until it is pushed
        await db.workouts.put({ ...r, dirty: 0, rev: local?.rev ?? 0 });
      }
      await db.meta.put({ key: 'last_pull', value: data[data.length - 1].updated_at });
    });

    const next = data[data.length - 1].updated_at;
    if (data.length < PULL_PAGE || next === since) break;
    since = next;
  }
}

async function runSync() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return false;
  await push(session.user.id);
  await pull();
  return true;
}

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
  const pending = useLiveQuery(() => db.workouts.where('dirty').equals(1).count(), [], 0);

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
      const ok = await runSync();
      if (ok) {
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

  const signOut = useCallback(() => supabase.auth.signOut(), []);

  return { enabled: !!supabase, session, status, error, lastSynced, pending, syncNow, signIn, signOut };
}
