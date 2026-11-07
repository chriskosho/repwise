import Dexie from 'dexie';
import { key } from './stats';

export const newId = () => crypto.randomUUID();
export const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local time
const nowIso = () => new Date().toISOString();

// A workout session is one document: name, times, and a list of exercises, each
// with its sets. Set shape: { id, type: 'normal'|'warmup'|'drop'|'failure', reps, weight, done }.
//
// Local-first store. `dirty` marks rows still to be pushed to Supabase and `rev`
// guards against edits made while a sync is in flight.

// Version 1 stored one row per exercise entry. Convert those into one-exercise
// sessions that keep the same id, so converting on several devices can't duplicate.
export function sessionFromLegacy(w) {
  const created = w.created_at || nowIso();
  return {
    id: w.id,
    date: w.date,
    name: 'Workout',
    started_at: created,
    ended_at: created,
    notes: '',
    exercises: [
      {
        id: newId(),
        name: w.exercise,
        link: false,
        notes: w.notes || '',
        sets: (w.sets || []).map((s) => ({
          id: newId(),
          type: 'normal',
          reps: s.reps,
          weight: s.weight,
          done: true,
        })),
      },
    ],
    created_at: created,
    deleted_at: null,
    dirty: 1,
    rev: 1,
  };
}

export const db = new Dexie('repwise');
db.version(1).stores({
  workouts: 'id, date, exercise, dirty',
  meta: 'key',
});
db.version(2)
  .stores({
    workouts: 'id, date, exercise, dirty', // legacy, no longer written to
    sessions: 'id, date, dirty',
    meta: 'key',
  })
  .upgrade(async (tx) => {
    const legacy = await tx.table('workouts').toArray();
    for (const w of legacy) {
      if (w.deleted_at) continue;
      await tx.table('sessions').put(sessionFromLegacy(w));
    }
  });

// Version 3 adds saved routines and your own exercises. No data needs converting.
db.version(3).stores({
  workouts: 'id, date, exercise, dirty', // legacy, no longer written to
  sessions: 'id, date, dirty',
  routines: 'id, dirty',
  customExercises: 'id, dirty',
  meta: 'key',
});

// Newest first. Date decides, then start time.
export const sessionOrder = (s) => `${s.date}|${s.started_at || ''}`;
export const byNewest = (a, b) => sessionOrder(b).localeCompare(sessionOrder(a));

const DOC_FIELDS = ['id', 'date', 'name', 'started_at', 'ended_at', 'notes', 'exercises', 'created_at', 'deleted_at'];
export function toDoc(row) {
  const doc = {};
  for (const k of DOC_FIELDS) doc[k] = row[k] ?? (k === 'exercises' ? [] : k === 'notes' || k === 'name' ? '' : null);
  return doc;
}

export function newSession({ date = today(), finished = false } = {}) {
  const now = nowIso();
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  return {
    id: newId(),
    date,
    name: finished ? 'Workout' : `${part} workout`,
    started_at: now,
    ended_at: finished ? now : null,
    notes: '',
    exercises: [],
    created_at: now,
    deleted_at: null,
  };
}

// Saves are queued so two quick saves can never land out of order.
let queue = Promise.resolve();
export function saveSession(doc) {
  const run = async () => {
    const existing = await db.sessions.get(doc.id);
    const row = {
      ...(existing || {}),
      ...doc,
      created_at: existing?.created_at ?? doc.created_at ?? nowIso(),
      // A workout deleted elsewhere stays deleted; a late autosave must not resurrect it.
      deleted_at: existing?.deleted_at ?? doc.deleted_at ?? null,
      dirty: 1,
      rev: (existing?.rev ?? 0) + 1,
    };
    await db.sessions.put(row);
    markBackupBaseline();
    return row;
  };
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}

// Soft delete so the removal can sync to other devices.
export async function deleteSession(id) {
  await queue.catch(() => {});
  await db.sessions
    .where('id')
    .equals(id)
    .modify((s) => {
      s.deleted_at = nowIso();
      s.dirty = 1;
      s.rev = (s.rev ?? 0) + 1;
    });
}

export const getSession = async (id) => {
  const row = await db.sessions.get(id);
  return row && !row.deleted_at ? row : null;
};

// Finished and in-progress sessions that have something in them, newest first.
export async function listSessions() {
  const all = await db.sessions.toArray();
  return all.filter((s) => !s.deleted_at && (s.exercises.length > 0 || !s.ended_at)).sort(byNewest);
}

export async function getActiveSession() {
  const all = await db.sessions.toArray();
  return all.filter((s) => !s.deleted_at && !s.ended_at).sort(byNewest)[0] ?? null;
}

// ---- routines and custom exercises (same local-first pattern as sessions) ----
async function putRow(table, doc) {
  const existing = await table.get(doc.id);
  const row = {
    ...(existing || {}),
    ...doc,
    created_at: existing?.created_at ?? doc.created_at ?? nowIso(),
    deleted_at: existing?.deleted_at ?? doc.deleted_at ?? null,
    dirty: 1,
    rev: (existing?.rev ?? 0) + 1,
  };
  await table.put(row);
  markBackupBaseline();
  return row;
}

async function softDelete(table, id) {
  await table
    .where('id')
    .equals(id)
    .modify((r) => {
      r.deleted_at = nowIso();
      r.dirty = 1;
      r.rev = (r.rev ?? 0) + 1;
    });
}

const MAX_ROUTINE_SETS = 12;

export function newRoutine() {
  return { id: newId(), name: '', notes: '', exercises: [], created_at: nowIso(), deleted_at: null };
}

// A routine is a template: exercises in order, with the number and type of each
// set. Weights and reps aren't stored; the "previous" column supplies those.
export function routineFromSession(session) {
  const exercises = session.exercises
    .filter((e) => e.sets.length)
    .map((e) => ({
      id: newId(),
      name: e.name,
      link: !!e.link,
      notes: e.notes || '',
      sets: e.sets.slice(0, MAX_ROUTINE_SETS).map((s) => ({ id: newId(), type: s.type || 'normal' })),
    }));
  return { ...newRoutine(), name: (session.name || '').trim(), exercises };
}

// A fresh, unfinished workout with the routine's exercises and empty sets.
export function sessionFromRoutine(routine) {
  const base = newSession();
  return {
    ...base,
    name: routine.name || base.name,
    exercises: routine.exercises.map((e) => ({
      id: newId(),
      name: e.name,
      link: !!e.link,
      notes: e.notes || '',
      sets: (e.sets.length ? e.sets : [{ type: 'normal' }]).map((s) => ({
        id: newId(),
        type: s.type || 'normal',
        reps: '',
        weight: '',
        done: false,
      })),
    })),
  };
}

export const saveRoutine = (doc) => putRow(db.routines, doc);
export const deleteRoutine = (id) => softDelete(db.routines, id);
export async function listRoutines() {
  const all = await db.routines.toArray();
  return all.filter((r) => !r.deleted_at).sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
}

// Your own exercises. Adding a name you already have returns the existing one.
export async function saveCustomExercise({ name, muscle = '', equipment = '' }) {
  const clean = String(name).trim().replace(/\s+/g, ' ').slice(0, 100);
  const existing = (await db.customExercises.toArray()).find((c) => !c.deleted_at && key(c.name) === key(clean));
  if (existing) return existing;
  return putRow(db.customExercises, { id: newId(), name: clean, muscle, equipment, deleted_at: null });
}
export async function listCustomExercises() {
  const all = await db.customExercises.toArray();
  return all.filter((c) => !c.deleted_at).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

// ---- backup bookkeeping (kept in localStorage; per device) ----
const LAST_EXPORT = 'repwise.lastExport';
const BASELINE = 'repwise.backupBaseline';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const read = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage unavailable; reminders just won't persist */
  }
};

export function markBackupBaseline() {
  if (!read(BASELINE)) write(BASELINE, nowIso());
}
export function setLastExport() {
  write(LAST_EXPORT, nowIso());
}
export function lastExportAt() {
  return read(LAST_EXPORT);
}
export function needsExportReminder() {
  const last = read(LAST_EXPORT) || read(BASELINE);
  if (!last) return false;
  return Date.now() - Date.parse(last) > WEEK_MS;
}
