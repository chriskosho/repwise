import Dexie from 'dexie';

// Local-first store. Every workout lives here first; `dirty` marks rows that
// still need to be pushed to Supabase and `rev` guards against edits made
// while a sync is in flight.
export const db = new Dexie('repwise');
db.version(1).stores({
  workouts: 'id, date, exercise, dirty',
  meta: 'key',
});

export const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local time
const nowIso = () => new Date().toISOString();

export async function saveWorkout({ id, date, exercise, sets, notes }) {
  const existing = id ? await db.workouts.get(id) : null;
  const row = {
    ...(existing || {}),
    id: existing ? existing.id : crypto.randomUUID(),
    date,
    exercise: exercise.trim(),
    sets,
    notes: (notes || '').trim(),
    created_at: existing?.created_at ?? nowIso(),
    deleted_at: null,
    dirty: 1,
    rev: (existing?.rev ?? 0) + 1,
  };
  await db.workouts.put(row);
  markBackupBaseline();
  return row;
}

// Soft delete so the removal can sync to other devices.
export async function deleteWorkout(id) {
  await db.workouts
    .where('id')
    .equals(id)
    .modify((w) => {
      w.deleted_at = nowIso();
      w.dirty = 1;
      w.rev = (w.rev ?? 0) + 1;
    });
}

export async function listWorkouts() {
  const all = await db.workouts.toArray();
  return all
    .filter((w) => !w.deleted_at)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.created_at || '').localeCompare(a.created_at || ''));
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
