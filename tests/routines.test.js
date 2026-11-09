import { beforeEach, describe, expect, it } from 'vitest';
import { TABLES } from '../src/sync';
import {
  db,
  deleteRoutine,
  listCustomExercises,
  listRoutines,
  newRoutine,
  routineFromSession,
  saveCustomExercise,
  saveRoutine,
  sessionFromRoutine,
} from '../src/db';

const session = () => ({
  id: crypto.randomUUID(),
  name: 'Push day',
  date: '2026-11-01',
  exercises: [
    {
      id: 'e1',
      name: 'Bench Press',
      link: true,
      notes: 'pause reps',
      sets: [
        { id: 's1', type: 'warmup', reps: 10, weight: 45, done: true },
        { id: 's2', type: 'normal', reps: 5, weight: 135, done: true },
        { id: 's3', type: 'failure', reps: 3, weight: 145, done: true },
      ],
    },
    { id: 'e2', name: 'Triceps Pushdown', link: false, notes: '', sets: [{ id: 's4', type: 'normal', reps: 12, weight: 50, done: true }] },
    { id: 'e3', name: 'Empty', link: false, notes: '', sets: [] },
  ],
});

beforeEach(async () => {
  await db.routines.clear();
  await db.customExercises.clear();
});

describe('routines', () => {
  it('turns a workout into a template: names, order, supersets, notes, and set types only', () => {
    const r = routineFromSession(session());
    expect(r.name).toBe('Push day');
    expect(r.exercises.map((e) => e.name)).toEqual(['Bench Press', 'Triceps Pushdown']); // exercises with no sets are left out
    expect(r.exercises[0]).toMatchObject({ link: true, notes: 'pause reps' });
    expect(r.exercises[0].sets.map((s) => s.type)).toEqual(['warmup', 'normal', 'failure']);
    expect(r.exercises[0].sets[0]).not.toHaveProperty('reps');
    expect(r.exercises[0].sets[0]).not.toHaveProperty('weight');
  });

  it('starts a workout from a routine with empty, not-done sets and fresh ids', () => {
    const r = routineFromSession(session());
    const s = sessionFromRoutine(r);
    expect(s.name).toBe('Push day');
    expect(s.ended_at).toBeNull();
    expect(s.id).not.toBe(r.id);
    expect(s.exercises.map((e) => e.name)).toEqual(['Bench Press', 'Triceps Pushdown']);
    expect(s.exercises[0].sets).toHaveLength(3);
    expect(s.exercises[0].sets.map((x) => x.type)).toEqual(['warmup', 'normal', 'failure']);
    expect(s.exercises.flatMap((e) => e.sets).every((x) => x.done === false && x.reps === '' && x.weight === '')).toBe(true);
    const ids = s.exercises.flatMap((e) => [e.id, ...e.sets.map((x) => x.id)]);
    expect(new Set(ids).size).toBe(ids.length);
    // starting twice gives independent workouts
    expect(sessionFromRoutine(r).exercises[0].id).not.toBe(s.exercises[0].id);
  });

  it('caps the sets taken from a very long exercise', () => {
    const big = session();
    big.exercises[0].sets = Array.from({ length: 30 }, (_, i) => ({ id: `x${i}`, type: 'normal', reps: 1, weight: 1, done: true }));
    expect(routineFromSession(big).exercises[0].sets).toHaveLength(12);
  });

  it('saves, lists by name, and deletes softly', async () => {
    const a = { ...routineFromSession(session()), name: 'b routine' };
    const b = { ...routineFromSession(session()), name: 'A routine' };
    await saveRoutine(a);
    await saveRoutine(b);
    expect((await listRoutines()).map((r) => r.name)).toEqual(['A routine', 'b routine']);

    const saved = await db.routines.get(a.id);
    expect(saved).toMatchObject({ dirty: 1, rev: 1 });
    await saveRoutine({ ...saved, name: 'renamed' });
    expect((await db.routines.get(a.id)).rev).toBe(2);

    await deleteRoutine(a.id);
    expect((await listRoutines()).map((r) => r.name)).toEqual(['A routine']);
    expect((await db.routines.get(a.id)).deleted_at).toBeTruthy(); // kept so the delete can sync

    // a late save can't bring back a deleted routine
    await saveRoutine({ ...saved, name: 'late' });
    expect(await listRoutines()).toHaveLength(1);
  });

  it('a blank routine has an id and no exercises', () => {
    expect(newRoutine()).toMatchObject({ name: '', exercises: [], deleted_at: null });
  });
});

describe('custom exercises', () => {
  it('stores name, muscle and equipment and returns the existing one for a repeated name', async () => {
    const a = await saveCustomExercise({ name: '  Sled   Push ', muscle: 'quadriceps', equipment: 'other' });
    expect(a).toMatchObject({ name: 'Sled Push', muscle: 'quadriceps', equipment: 'other', dirty: 1 });
    const again = await saveCustomExercise({ name: 'sled push' });
    expect(again.id).toBe(a.id);
    expect(await listCustomExercises()).toHaveLength(1);
  });
});

describe('what gets sent to the server', () => {
  const byName = Object.fromEntries(TABLES.map((t) => [t.remote, t]));

  it('covers every synced table', () => {
    expect(Object.keys(byName).sort()).toEqual(['activities', 'body_entries', 'custom_exercises', 'food_log', 'food_notes', 'foods', 'goals', 'places', 'profiles', 'routines', 'sessions']);
  });

  it('never sends updated_at (the server owns it) and always sends the owner', () => {
    const rows = {
      sessions: { id: 'a', date: '2026-11-01', started_at: 'x', exercises: [], updated_at: 'client', dirty: 1, rev: 3 },
      routines: { id: 'b', name: 'R', exercises: [], updated_at: 'client', dirty: 1, rev: 3 },
      custom_exercises: { id: 'c', name: 'C', updated_at: 'client', dirty: 1, rev: 3 },
      body_entries: { id: 'd', date: '2026-11-01', weight_kg: 80, updated_at: 'client', dirty: 1, rev: 3 },
      profiles: { id: 'me', display_name: 'Chris', units: 'kg', updated_at: 'client', dirty: 1, rev: 3 },
      goals: { id: 'e', type: 'weekly_workouts', target: 3, updated_at: 'client', dirty: 1, rev: 3 },
      places: { id: 'f', name: 'Gym', updated_at: 'client', dirty: 1, rev: 3 },
      foods: { id: 'h', name: 'Oats', updated_at: 'client', dirty: 1, rev: 3 },
      food_notes: { id: 'j', date: '2026-11-01', text: 'Oats', updated_at: 'client', dirty: 1, rev: 3 },
      food_log: { id: 'i', date: '2026-11-01', name: 'Oats', updated_at: 'client', dirty: 1, rev: 3 },
      activities: { id: 'g', date: '2026-11-01', type: 'run', duration_min: 30, updated_at: 'client', dirty: 1, rev: 3 },
    };
    for (const [name, row] of Object.entries(rows)) {
      const out = byName[name].toRemote(row, 'user-1');
      if (name === 'profiles') expect(out).not.toHaveProperty('user_id');
      else expect(out.user_id).toBe('user-1');
      expect(out).not.toHaveProperty('updated_at');
      expect(out).not.toHaveProperty('dirty');
      expect(out).not.toHaveProperty('rev');
      expect(out.id).toBe(name === 'profiles' ? 'user-1' : row.id);
    }
  });

  it('uses a separate pull cursor per table', () => {
    expect(new Set(TABLES.map((t) => t.cursor)).size).toBe(TABLES.length);
  });
});
