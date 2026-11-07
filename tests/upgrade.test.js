import Dexie from 'dexie';
import { expect, it } from 'vitest';

// A device that already ran version 2 must keep its workouts when the app upgrades.
it('keeps existing sessions and their unsynced state when upgrading from version 2', async () => {
  const old = new Dexie('repwise');
  old.version(1).stores({ workouts: 'id, date, exercise, dirty', meta: 'key' });
  old.version(2).stores({ workouts: 'id, date, exercise, dirty', sessions: 'id, date, dirty', meta: 'key' });
  const id = crypto.randomUUID();
  await old.sessions.put({
    id,
    date: '2026-11-05',
    name: 'Morning workout',
    started_at: '2026-11-05T14:00:00.000Z',
    ended_at: '2026-11-05T15:00:00.000Z',
    notes: '',
    exercises: [{ id: 'e', name: 'Dumbells', link: false, notes: '', sets: [{ id: 's', type: 'normal', reps: 10, weight: 20, done: true }] }],
    created_at: '2026-11-05T14:00:00.000Z',
    deleted_at: null,
    dirty: 0,
    rev: 3,
    updated_at: '2026-11-06T16:36:23.146467+00:00',
  });
  await old.meta.put({ key: 'last_pull_sessions', value: '2026-11-06T16:36:23.146467+00:00' });
  old.close();

  const { db, listSessions, listRoutines, listCustomExercises } = await import('../src/db.js');
  const [s] = await listSessions();
  expect(s).toMatchObject({ id, name: 'Morning workout', dirty: 0, rev: 3 });
  expect(s.exercises[0].sets[0]).toMatchObject({ reps: 10, weight: 20 });
  expect((await db.meta.get('last_pull_sessions')).value).toBe('2026-11-06T16:36:23.146467+00:00'); // no needless full re-download
  expect(await listRoutines()).toEqual([]);
  expect(await listCustomExercises()).toEqual([]);
  expect(db.verno).toBe(4);
});
