import { cleanGoal, cleanMeasurements, db, newId, PROFILE_ID, sessionFromLegacy, setLastExport, today } from './db';
import { key as nameKey } from './stats';
import { EQUIPMENT, MUSCLES } from './library';
import { MEASUREMENT_KEYS } from './body';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SET_TYPES = new Set(['normal', 'warmup', 'drop', 'failure']);
const MAX_FILE_BYTES = 10 * 1024 * 1024;

// Backups hold finished workouts, routines, your own exercises, body measurements,
// goals and your profile. Version 4 is the current format; versions 3 and 2 (sessions
// only) and version 1 (sessions only) and version 1 (one row per
// exercise entry) are still accepted and converted on import.
export async function buildExport() {
  const sessions = (await db.sessions.toArray()).filter((s) => !s.deleted_at && s.ended_at && s.exercises.length);
  const routines = (await db.routines.toArray()).filter((r) => !r.deleted_at);
  const custom = (await db.customExercises.toArray()).filter((c) => !c.deleted_at);
  const body = (await db.bodyEntries.toArray()).filter((e) => !e.deleted_at);
  const goals = (await db.goals.toArray()).filter((g) => !g.deleted_at);
  const profile = await db.profile.get(PROFILE_ID);
  return {
    app: 'repwise',
    version: 4,
    exported_at: new Date().toISOString(),
    sessions: sessions.map(({ id, date, name, started_at, ended_at, notes, exercises, created_at }) => ({
      id,
      date,
      name,
      started_at,
      ended_at,
      notes,
      exercises,
      created_at,
    })),
    routines: routines.map(({ id, name, notes, exercises, created_at }) => ({ id, name, notes, exercises, created_at })),
    custom_exercises: custom.map(({ id, name, muscle, equipment, created_at }) => ({ id, name, muscle, equipment, created_at })),
    body_entries: body.map(({ id, date, weight_kg, body_fat, measurements, notes, created_at }) => ({
      id,
      date,
      weight_kg,
      body_fat,
      measurements,
      notes,
      created_at,
    })),
    goals: goals.map(({ id, type, exercise, metric, target, start_value, start_date, created_at }) => ({
      id,
      type,
      exercise,
      metric,
      target,
      start_value,
      start_date,
      created_at,
    })),
    profile:
      profile && !profile.deleted_at
        ? { display_name: profile.display_name, units: profile.units, height_cm: profile.height_cm, week_start: profile.week_start }
        : null,
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

function normalizeRoutine(raw) {
  if (!raw || typeof raw.id !== 'string' || !UUID.test(raw.id)) return null;
  if (typeof raw.name !== 'string' || !raw.name.trim() || !Array.isArray(raw.exercises)) return null;
  const exercises = [];
  for (const ex of raw.exercises) {
    if (!ex || typeof ex.name !== 'string' || !ex.name.trim()) continue;
    const sets = (Array.isArray(ex.sets) ? ex.sets : [])
      .slice(0, 12)
      .map((st) => ({ id: newId(), type: SET_TYPES.has(st?.type) ? st.type : 'normal' }));
    exercises.push({
      id: newId(),
      name: ex.name.trim().slice(0, 100),
      link: !!ex.link,
      notes: typeof ex.notes === 'string' ? ex.notes.slice(0, 2000) : '',
      sets: sets.length ? sets : [{ id: newId(), type: 'normal' }],
    });
  }
  if (!exercises.length) return null;
  return {
    id: raw.id,
    name: raw.name.trim().slice(0, 60),
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 2000) : '',
    exercises,
    created_at: validIso(raw.created_at) ? raw.created_at : new Date().toISOString(),
    deleted_at: null,
    dirty: 1,
    rev: 1,
  };
}

const MUSCLE_KEYS = new Set(MUSCLES.map(([k]) => k));
const EQUIPMENT_KEYS = new Set(EQUIPMENT.map(([k]) => k));

function normalizeCustom(raw) {
  if (!raw || typeof raw.id !== 'string' || !UUID.test(raw.id)) return null;
  if (typeof raw.name !== 'string' || !raw.name.trim()) return null;
  return {
    id: raw.id,
    name: raw.name.trim().replace(/\s+/g, ' ').slice(0, 100),
    muscle: MUSCLE_KEYS.has(raw.muscle) ? raw.muscle : '',
    equipment: EQUIPMENT_KEYS.has(raw.equipment) ? raw.equipment : '',
    created_at: validIso(raw.created_at) ? raw.created_at : new Date().toISOString(),
    deleted_at: null,
    dirty: 1,
    rev: 1,
  };
}

function normalizeBody(raw) {
  if (!raw || typeof raw.id !== 'string' || !UUID.test(raw.id)) return null;
  if (typeof raw.date !== 'string' || !DATE.test(raw.date)) return null;
  const w = raw.weight_kg == null ? null : Number(raw.weight_kg);
  const f = raw.body_fat == null ? null : Number(raw.body_fat);
  const weight = w != null && w > 0 && w < 700 ? w : null;
  const fat = f != null && f > 0 && f < 100 ? f : null;
  const measurements = cleanMeasurements(raw.measurements);
  const keys = Object.keys(measurements).filter((k) => MEASUREMENT_KEYS.has(k));
  const clean = Object.fromEntries(keys.map((k) => [k, measurements[k]]));
  if (weight == null && fat == null && !keys.length) return null;
  return {
    id: raw.id,
    date: raw.date,
    weight_kg: weight,
    body_fat: fat,
    measurements: clean,
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 500) : '',
    created_at: validIso(raw.created_at) ? raw.created_at : new Date().toISOString(),
    deleted_at: null,
    dirty: 1,
    rev: 1,
  };
}

function normalizeGoalRow(raw) {
  if (!raw || typeof raw.id !== 'string' || !UUID.test(raw.id)) return null;
  const g = cleanGoal({ ...raw, start_date: DATE.test(raw.start_date ?? '') ? raw.start_date : today() });
  if (!g || (g.type === 'lift' && !g.exercise)) return null;
  return {
    ...g,
    created_at: validIso(raw.created_at) ? raw.created_at : new Date().toISOString(),
    dirty: 1,
    rev: 1,
  };
}

// Merge by ID: anything that already exists on this device (even a workout you
// deleted) is left alone, so importing the same file twice never duplicates.
// `added` counts workouts; routines and exercises are counted separately.
export async function importFile(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error('That file is too large to be a Repwise backup.');
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!parsed || parsed.app !== 'repwise') throw new Error('That file is not a Repwise backup.');

  const sessionItems = Array.isArray(parsed.sessions) ? parsed.sessions : Array.isArray(parsed.workouts) ? parsed.workouts : null;
  const routineItems = Array.isArray(parsed.routines) ? parsed.routines : null;
  const customItems = Array.isArray(parsed.custom_exercises) ? parsed.custom_exercises : null;
  const bodyItems = Array.isArray(parsed.body_entries) ? parsed.body_entries : null;
  const goalItems = Array.isArray(parsed.goals) ? parsed.goals : null;
  if (!sessionItems && !routineItems && !customItems && !bodyItems && !goalItems) throw new Error('That file is not a Repwise backup.');
  const normalizeSessionItem = Array.isArray(parsed.sessions) ? normalizeSession : normalizeLegacy;

  const out = { added: 0, skipped: 0, invalid: 0, routines: 0, exercises: 0, body: 0, goals: 0, profile: false };
  await db.transaction('rw', [db.sessions, db.routines, db.customExercises, db.bodyEntries, db.goals, db.profile], async () => {
    for (const raw of sessionItems ?? []) {
      const row = normalizeSessionItem(raw);
      if (!row) out.invalid++;
      else if (await db.sessions.get(row.id)) out.skipped++;
      else {
        await db.sessions.put(row);
        out.added++;
      }
    }
    for (const raw of routineItems ?? []) {
      const row = normalizeRoutine(raw);
      if (!row) out.invalid++;
      else if (await db.routines.get(row.id)) out.skipped++;
      else {
        await db.routines.put(row);
        out.routines++;
      }
    }
    const haveNames = new Set((await db.customExercises.toArray()).filter((c) => !c.deleted_at).map((c) => nameKey(c.name)));
    for (const raw of customItems ?? []) {
      const row = normalizeCustom(raw);
      if (!row) out.invalid++;
      else if ((await db.customExercises.get(row.id)) || haveNames.has(nameKey(row.name))) out.skipped++;
      else {
        await db.customExercises.put(row);
        haveNames.add(nameKey(row.name));
        out.exercises++;
      }
    }
    const haveDates = new Set((await db.bodyEntries.toArray()).filter((e) => !e.deleted_at).map((e) => e.date));
    for (const raw of bodyItems ?? []) {
      const row = normalizeBody(raw);
      if (!row) out.invalid++;
      else if ((await db.bodyEntries.get(row.id)) || haveDates.has(row.date)) out.skipped++;
      else {
        await db.bodyEntries.put(row);
        haveDates.add(row.date);
        out.body++;
      }
    }
    for (const raw of goalItems ?? []) {
      const row = normalizeGoalRow(raw);
      if (!row) out.invalid++;
      else if (await db.goals.get(row.id)) out.skipped++;
      else {
        await db.goals.put(row);
        out.goals++;
      }
    }
    // A backup never overwrites a profile that already exists on this device.
    const p = parsed.profile;
    if (p && typeof p === 'object' && !(await db.profile.get(PROFILE_ID))) {
      const h = Number(p.height_cm);
      await db.profile.put({
        id: PROFILE_ID,
        display_name: typeof p.display_name === 'string' ? p.display_name.trim().slice(0, 40) : '',
        units: p.units === 'kg' ? 'kg' : 'lb',
        height_cm: h > 0 && h < 300 ? h : null,
        week_start: p.week_start === 0 ? 0 : 1,
        created_at: new Date().toISOString(),
        deleted_at: null,
        dirty: 1,
        rev: 1,
      });
      out.profile = true;
    }
  });
  return out;
}
