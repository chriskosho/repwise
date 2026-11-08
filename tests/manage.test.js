import { beforeEach, describe, expect, it } from 'vitest';
import { clearLocalData, deleteCustomExercise, listCustomExercises, listRoutines, listSessions, saveCustomExercise, saveRoutine, saveSession, updateCustomExercise } from '../src/db';

const sess = (name) => ({ id: crypto.randomUUID(), date: '2026-01-01', name: 'W', started_at: '2026-01-01T10:00:00Z', ended_at: '2026-01-01T11:00:00Z', exercises: [{ id: 'e1', name, mode: 'weight', link: false, notes: '', sets: [] }], deleted_at: null });

beforeEach(clearLocalData);

describe('managing your own exercises', () => {
  it('renames everywhere and keeps other fields', async () => {
    const c = await saveCustomExercise({ name: 'Sled push', muscle: 'quadriceps', mode: 'carry' });
    await saveSession(sess('Sled push'));
    await saveRoutine({ id: 'r1', name: 'R', exercises: [{ id: 'x', name: 'sled PUSH', sets: [] }], deleted_at: null });
    await updateCustomExercise(c.id, { name: 'Prowler push', equipment: 'other' });
    const [row] = await listCustomExercises();
    expect(row).toMatchObject({ name: 'Prowler push', muscle: 'quadriceps', mode: 'carry', equipment: 'other', dirty: 1 });
    expect((await listSessions())[0].exercises[0].name).toBe('Prowler push');
    expect((await listRoutines())[0].exercises[0].name).toBe('Prowler push');
  });
  it('rejects clashes and empty names', async () => {
    const a = await saveCustomExercise({ name: 'Thing A' });
    await saveCustomExercise({ name: 'Thing B' });
    await expect(updateCustomExercise(a.id, { name: 'thing b' })).rejects.toThrow(/already/);
    await expect(updateCustomExercise(a.id, { name: 'Barbell Squat' })).rejects.toThrow(/library|already/);
    await expect(updateCustomExercise(a.id, { name: '  ' })).rejects.toThrow();
  });
  it('deletes without touching history', async () => {
    const c = await saveCustomExercise({ name: 'Gone' });
    await saveSession(sess('Gone'));
    await deleteCustomExercise(c.id);
    expect(await listCustomExercises()).toHaveLength(0);
    expect((await listSessions())[0].exercises[0].name).toBe('Gone');
  });
});

import { convertLiftWeights, saveGoal, listGoals } from '../src/db';
describe('converting units', () => {
  it('converts sets, routine targets and lift goals', async () => {
    await saveSession({ ...sess('Bench'), exercises: [{ id: 'e', name: 'Bench', mode: 'weight', sets: [{ id: 's', weight: 225, reps: 5, done: true }, { id: 't', weight: 0, reps: 5 }] }] });
    await saveRoutine({ id: 'r', name: 'R', exercises: [{ id: 'x', name: 'Bench', target: { weight: 100 }, sets: [] }], deleted_at: null });
    await saveGoal({ type: 'lift', exercise: 'Bench', target: 315, start_value: 225 });
    await convertLiftWeights('lb', 'kg');
    expect((await listSessions())[0].exercises[0].sets.map((x) => x.weight)).toEqual([102.1, 0]);
    expect((await listRoutines())[0].exercises[0].target.weight).toBe(45.4);
    const g = (await listGoals()).find((x) => x.type === 'lift');
    expect(g.target).toBe(142.9);
    expect(await convertLiftWeights('kg', 'kg')).toBe(0);
  });
});

import { cleanTarget, sessionFromRoutine, routineFromSession } from '../src/db';
describe('routine targets', () => {
  it('cleans targets and prefills sets, but not warm-ups', () => {
    expect(cleanTarget({ weight: '135', reps: '8.4', time: '' })).toEqual({ weight: 135, reps: 8 });
    expect(cleanTarget({ weight: -5, reps: 'x' })).toBeNull();
    const r = { name: 'R', exercises: [{ name: 'Bench', target: { weight: 100, reps: 5 }, sets: [{ type: 'warmup' }, { type: 'normal' }] }] };
    const s = sessionFromRoutine(r);
    expect(s.exercises[0].target).toEqual({ weight: 100, reps: 5 });
    expect(s.exercises[0].sets.map((x) => x.weight)).toEqual(['', 100]);
    expect(s.exercises[0].sets.every((x) => x.done === false)).toBe(true);
    expect(routineFromSession(s).exercises[0].target).toEqual({ weight: 100, reps: 5 });
  });
});
