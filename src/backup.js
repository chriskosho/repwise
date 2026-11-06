import { db, newId, sessionFromLegacy, setLastExport, today } from './db';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SET_TYPES = new Set(['normal', 'warmup', 'drop', 'failure']);
const MAX_FILE_BYTES = 10 * 1024 * 1024;

// Backups hold finished workouts. Version 2 stores sessions; version 1 files
// (one row per exercise entry) are still accepted and converted on import.
export async function buildExport() {
  const rows = (await db.sessions.toArray()).filter((s) => !s.deleted_at && s.ended_at && s.exercises.length);
  return {
    app: 'repwise',
    version: 2,
    exported_at: new Date().toISOString(),
    sessions: rows.map(({ id, date, name, started_at, ended_at, notes, exercises, created_at }) => ({
      id,
      date,
      name,
      started_at,
      ended_at,
      notes,
      exercises,
      created_at,
    })),
  };
}

export async function downloadExport() {
  const data = await buildExport();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `repwise-backup-${today()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setLastExport();
  return data.sessions.length;
}

const validIso = (s) => typeof s === 'string' && !Number.isNaN(Date.parse(s));

function cleanSet(s) {
  const reps = Number(s?.reps);
  const weight = Number(s?.weight ?? 0);
  if (!Number.isFinite(reps) || reps <= 0 || !Number.isFinite(weight) || weight < 0) return null;
  return { id: newId(), type: SET_TYPES.has(s?.type) ? s.type : 'normal', reps, weight, done: true };
}

function normalizeSession(raw) {
  if (!raw || typeof raw.id !== 'string' || !UUID.test(raw.id)) return null;
  if (typeof raw.date !== 'string' || !DATE.test(raw.date)) return null;
  if (!Array.isArray(raw.exercises)) return null;

  const exercises = [];
  for (const ex of raw.exercises) {
    if (!ex || typeof ex.name !== 'string' || !ex.name.trim() || !Array.isArray(ex.sets)) continue;
    const sets = ex.sets.map(cleanSet).filter(Boolean);
    if (!sets.length) continue;
    exercises.push({
      id: newId(),
      name: ex.name.trim().slice(0, 100),
      link: !!ex.link,
      notes: typeof ex.notes === 'string' ? ex.notes.slice(0, 2000) : '',
      sets,
    });
  }
  if (!exercises.length) return null;

  const started = validIso(raw.started_at) ? raw.started_at : `${raw.date}T12:00:00.000Z`;
  return {
    id: raw.id,
    date: raw.date,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 60) : 'Workout',
    started_at: started,
    ended_at: validIso(raw.ended_at) ? raw.ended_at : started,
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 2000) : '',
    exercises,
    created_at: validIso(raw.created_at) ? raw.created_at : new Date().toISOString(),
    deleted_at: null,
    dirty: 1,
    rev: 1,
  };
}

function normalizeLegacy(w) {
  if (!w || typeof w.id !== 'string' || !UUID.test(w.id)) return null;
  if (typeof w.date !== 'string' || !DATE.test(w.date)) return null;
  if (typeof w.exercise !== 'string' || !w.exercise.trim() || !Array.isArray(w.sets)) return null;
  const sets = w.sets
    .map((s) => ({ reps: Number(s?.reps), weight: Number(s?.weight ?? 0) }))
    .filter((s) => Number.isFinite(s.reps) && s.reps > 0 && Number.isFinite(s.weight) && s.weight >= 0);
  if (!sets.length) return null;
  return sessionFromLegacy({
    id: w.id,
    date: w.date,
    exercise: w.exercise.trim().slice(0, 100),
    sets,
    notes: typeof w.notes === 'string' ? w.notes.slice(0, 2000) : '',
    created_at: validIso(w.created_at) ? w.created_at : new Date().toISOString(),
  });
}

// Merge by ID: a workout that already exists on this device (even one you
// deleted) is left alone, so importing the same file twice never duplicates.
export async function importFile(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error('That file is too large to be a Repwise backup.');
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!parsed || parsed.app !== 'repwise') throw new Error('That file is not a Repwise backup.');

  let items;
  let normalize;
  if (Array.isArray(parsed.sessions)) {
    items = parsed.sessions;
    normalize = normalizeSession;
  } else if (Array.isArray(parsed.workouts)) {
    items = parsed.workouts;
    normalize = normalizeLegacy;
  } else {
    throw new Error('That file is not a Repwise backup.');
  }

  let added = 0;
  let skipped = 0;
  let invalid = 0;
  await db.transaction('rw', db.sessions, async () => {
    for (const raw of items) {
      const row = normalize(raw);
      if (!row) {
        invalid++;
        continue;
      }
      if (await db.sessions.get(row.id)) {
        skipped++;
        continue;
      }
      await db.sessions.put(row);
      added++;
    }
  });
  return { added, skipped, invalid };
}
