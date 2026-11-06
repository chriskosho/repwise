import { db, today, setLastExport } from './db';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function buildExport() {
  const rows = (await db.workouts.toArray()).filter((w) => !w.deleted_at);
  return {
    app: 'repwise',
    version: 1,
    exported_at: new Date().toISOString(),
    workouts: rows.map(({ id, date, exercise, sets, notes, created_at }) => ({
      id,
      date,
      exercise,
      sets,
      notes,
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
  return data.workouts.length;
}

function normalize(w) {
  if (!w || typeof w.id !== 'string' || !UUID.test(w.id)) return null;
  if (typeof w.date !== 'string' || !DATE.test(w.date)) return null;
  if (typeof w.exercise !== 'string' || !w.exercise.trim()) return null;
  if (!Array.isArray(w.sets)) return null;

  const sets = w.sets
    .map((s) => ({ reps: Number(s?.reps), weight: Number(s?.weight ?? 0) }))
    .filter((s) => Number.isFinite(s.reps) && s.reps > 0 && Number.isFinite(s.weight) && s.weight >= 0);
  if (!sets.length) return null;

  const created =
    typeof w.created_at === 'string' && !Number.isNaN(Date.parse(w.created_at))
      ? w.created_at
      : new Date().toISOString();

  return {
    id: w.id,
    date: w.date,
    exercise: w.exercise.trim().slice(0, 100),
    sets,
    notes: typeof w.notes === 'string' ? w.notes.slice(0, 2000) : '',
    created_at: created,
    deleted_at: null,
    dirty: 1,
    rev: 1,
  };
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
  if (!parsed || parsed.app !== 'repwise' || !Array.isArray(parsed.workouts)) {
    throw new Error('That file is not a Repwise backup.');
  }

  let added = 0;
  let skipped = 0;
  let invalid = 0;
  await db.transaction('rw', db.workouts, async () => {
    for (const raw of parsed.workouts) {
      const row = normalize(raw);
      if (!row) {
        invalid++;
        continue;
      }
      if (await db.workouts.get(row.id)) {
        skipped++;
        continue;
      }
      await db.workouts.put(row);
      added++;
    }
  });
  return { added, skipped, invalid };
}
