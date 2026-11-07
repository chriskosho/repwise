import Dexie from 'dexie';
import { key } from './stats';
import { isActivityType } from './activities';

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

// Version 4 adds your profile, body measurements and goals. No data needs converting.
db.version(4).stores({
  workouts: 'id, date, exercise, dirty', // legacy, no longer written to
  sessions: 'id, date, dirty',
  routines: 'id, dirty',
  customExercises: 'id, dirty',
  profile: 'id, dirty',
  bodyEntries: 'id, date, dirty',
  goals: 'id, dirty',
  meta: 'key',
});

// Version 5 adds places and non-gym activities. No data needs converting.
db.version(5).stores({
  workouts: 'id, date, exercise, dirty', // legacy, no longer written to
  sessions: 'id, date, dirty',
  routines: 'id, dirty',
  customExercises: 'id, dirty',
  profile: 'id, dirty',
  bodyEntries: 'id, date, dirty',
  goals: 'id, dirty',
  places: 'id, dirty',
  activities: 'id, date, dirty',
  meta: 'key',
});

// Newest first. Date decides, then start time.
export const sessionOrder = (s) => `${s.date}|${s.started_at || ''}`;
export const byNewest = (a, b) => sessionOrder(b).localeCompare(sessionOrder(a));

const DOC_FIELDS = ['id', 'date', 'name', 'started_at', 'ended_at', 'notes', 'exercises', 'place_id', 'created_at', 'deleted_at'];
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
    place_id: lastPlaceId(),
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
    rememberPlace(row.place_id);
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

// ---- profile (a single row, id 'me'; on the server its id is your account id) ----
export const PROFILE_ID = 'me';
export const PROFILE_DEFAULTS = { display_name: '', units: 'lb', height_cm: null, week_start: 1 };

export async function getProfile() {
  const row = await db.profile.get(PROFILE_ID);
  return row && !row.deleted_at ? { ...PROFILE_DEFAULTS, ...row } : null;
}

export async function saveProfile(patch) {
  const clean = {};
  if ('display_name' in patch) clean.display_name = String(patch.display_name ?? '').trim().slice(0, 40);
  if ('units' in patch) clean.units = patch.units === 'kg' ? 'kg' : 'lb';
  if ('week_start' in patch) clean.week_start = Number(patch.week_start) === 0 ? 0 : 1;
  if ('height_cm' in patch) {
    const h = Number(patch.height_cm);
    clean.height_cm = patch.height_cm === null || patch.height_cm === '' || !(h > 0 && h < 300) ? null : h;
  }
  return putRow(db.profile, { ...PROFILE_DEFAULTS, ...(await db.profile.get(PROFILE_ID)), ...clean, id: PROFILE_ID, deleted_at: null });
}

// ---- body entries: one per date; saving a date again updates that entry ----
const MAX_CM = 400;
export function cleanMeasurements(m) {
  const out = {};
  for (const [k, v] of Object.entries(m || {})) {
    const n = Number(v);
    if (v !== '' && v != null && Number.isFinite(n) && n > 0 && n < MAX_CM) out[k] = n;
  }
  return out;
}

export async function listBodyEntries() {
  const all = (await db.bodyEntries.toArray()).filter((e) => !e.deleted_at);
  // Two devices may have both logged the same day before syncing; keep the newer one.
  const byDate = new Map();
  for (const e of all) {
    const cur = byDate.get(e.date);
    const stamp = (x) => x.updated_at || x.created_at || '';
    if (!cur || stamp(e) > stamp(cur)) byDate.set(e.date, e);
  }
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export async function saveBodyEntry({ date = today(), weight_kg = null, body_fat = null, measurements = {}, notes = '' }) {
  const w = weight_kg === null || weight_kg === '' ? null : Number(weight_kg);
  const f = body_fat === null || body_fat === '' ? null : Number(body_fat);
  const entry = {
    date,
    weight_kg: w != null && w > 0 && w < 700 ? w : null,
    body_fat: f != null && f > 0 && f < 100 ? f : null,
    measurements: cleanMeasurements(measurements),
    notes: String(notes ?? '').slice(0, 500),
  };
  const existing = (await db.bodyEntries.where('date').equals(date).toArray()).find((e) => !e.deleted_at);
  return putRow(db.bodyEntries, { id: existing?.id ?? newId(), ...entry, deleted_at: null });
}
export const deleteBodyEntry = (id) => softDelete(db.bodyEntries, id);

// ---- goals ----
export function cleanGoal(g) {
  const target = Number(g.target);
  if (!['weekly_workouts', 'body_weight', 'lift'].includes(g.type) || !(target > 0)) return null;
  const start = g.start_value === null || g.start_value === undefined || g.start_value === '' ? null : Number(g.start_value);
  return {
    id: g.id || newId(),
    type: g.type,
    exercise: g.type === 'lift' ? String(g.exercise ?? '').trim().slice(0, 100) : '',
    metric: g.type === 'lift' ? (g.metric === 'e1rm' ? 'e1rm' : 'weight') : '',
    target,
    start_value: Number.isFinite(start) ? start : null,
    start_date: g.start_date || today(),
    notes: String(g.notes ?? '').slice(0, 2000),
    deleted_at: null,
  };
}
export async function saveGoal(g) {
  const row = cleanGoal(g);
  if (!row || (row.type === 'lift' && !row.exercise)) throw new Error('That goal is missing something.');
  return putRow(db.goals, row);
}
export const deleteGoal = (id) => softDelete(db.goals, id);
export async function listGoals() {
  const all = await db.goals.toArray();
  return all.filter((g) => !g.deleted_at).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
}

// ---- places (names only; no coordinates) ----
const LAST_PLACE = 'repwise.lastPlace';
export const lastPlaceId = () => read(LAST_PLACE) || null;
export const rememberPlace = (id) => {
  if (id) write(LAST_PLACE, id);
};

const cleanPlaceName = (name) => String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);

// Adding a name you already have returns the existing place.
export async function savePlace(name) {
  const clean = cleanPlaceName(name);
  if (!clean) throw new Error('Give the place a name.');
  const existing = (await db.places.toArray()).find((p) => !p.deleted_at && key(p.name) === key(clean));
  if (existing) return existing;
  return putRow(db.places, { id: newId(), name: clean, deleted_at: null });
}
export async function renamePlace(id, name) {
  const clean = cleanPlaceName(name);
  if (!clean) throw new Error('Give the place a name.');
  const clash = (await db.places.toArray()).find((p) => !p.deleted_at && p.id !== id && key(p.name) === key(clean));
  if (clash) throw new Error('You already have a place with that name.');
  const row = await db.places.get(id);
  if (!row || row.deleted_at) throw new Error('That place no longer exists.');
  return putRow(db.places, { ...row, name: clean });
}
export const deletePlace = (id) => softDelete(db.places, id);
export async function listPlaces() {
  const all = await db.places.toArray();
  return all.filter((p) => !p.deleted_at).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

// ---- activities (runs, rides, sports...) ----
export function newActivity(date = today()) {
  return { id: newId(), date, type: 'run', title: '', duration_min: null, distance_km: null, effort: null, place_id: lastPlaceId(), notes: '', created_at: nowIso(), deleted_at: null };
}

// Returns a clean row or throws an Error with a message for the person.
export function cleanActivity(a) {
  const duration = Number(a.duration_min);
  if (!(duration > 0) || duration > 1440) throw new Error('Enter how long it took (up to 24 hours).');
  const distance = a.distance_km === null || a.distance_km === undefined || a.distance_km === '' ? null : Number(a.distance_km);
  if (distance !== null && !(distance >= 0 && distance <= 5000)) throw new Error('That distance does not look right.');
  const effort = a.effort === null || a.effort === undefined || a.effort === '' ? null : Math.round(Number(a.effort));
  if (effort !== null && !(effort >= 1 && effort <= 10)) throw new Error('Effort is a number from 1 to 10.');
  if (typeof a.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(a.date)) throw new Error('Pick a date.');
  return {
    id: a.id || newId(),
    date: a.date,
    type: isActivityType(a.type) ? a.type : 'other',
    title: String(a.title ?? '').trim().slice(0, 80),
    duration_min: duration,
    distance_km: distance && distance > 0 ? distance : null,
    effort,
    place_id: a.place_id || null,
    notes: String(a.notes ?? '').slice(0, 2000),
    deleted_at: null,
  };
}
export async function saveActivity(doc) {
  const row = cleanActivity(doc);
  const saved = await putRow(db.activities, row);
  rememberPlace(saved.place_id);
  return saved;
}
export const deleteActivity = (id) => softDelete(db.activities, id);
export const getActivity = async (id) => {
  const row = await db.activities.get(id);
  return row && !row.deleted_at ? row : null;
};
export async function listActivities() {
  const all = await db.activities.toArray();
  return all.filter((a) => !a.deleted_at).sort((a, b) => b.date.localeCompare(a.date) || (b.created_at || '').localeCompare(a.created_at || ''));
}

// ---- who owns the data on this device ----
const OWNER = 'repwise.uid';
export const getOwner = () => read(OWNER);
export const setOwner = (uid) => write(OWNER, uid);

// Wipe everything stored on this device (used when signing out, switching accounts,
// or deleting an account). The unit preference is kept.
export async function clearLocalData() {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
  try {
    for (const k of [OWNER, LAST_EXPORT, BASELINE, LAST_PLACE, 'repwise.lastSynced']) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
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
