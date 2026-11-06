import Dexie from 'dexie';
import { expect, it } from 'vitest';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

it('turns version 1 workouts into sessions that keep the same id, skipping deleted ones', async () => {
  // Build a database exactly as the first version of the app left it.
  const old = new Dexie('repwise');
  old.version(1).stores({ workouts: 'id, date, exercise, dirty', meta: 'key' });
  await old.workouts.bulkAdd([
    {
      id: A,
      date: '2026-11-01',
      exercise: 'Squat',
      sets: [
        { reps: 5, weight: 225 },
        { reps: 5, weight: 235 },
      ],
      notes: 'heavy',
      created_at: '2026-11-01T15:00:00.000Z',
      deleted_at: null,
      dirty: 0,
    },
    {
      id: B,
      date: '2026-11-02',
      exercise: 'Bench',
      sets: [{ reps: 8, weight: 135 }],
      notes: '',
      created_at: '2026-11-02T15:00:00.000Z',
      deleted_at: '2026-11-03T10:00:00.000Z',
      dirty: 0,
    },
  ]);
  old.close();

  // Opening it with the current app code runs the upgrade.
  const { db } = await import('../src/db.js');
  const rows = await db.sessions.toArray();

  expect(rows).toHaveLength(1);
  const [s] = rows;
  expect(s.id).toBe(A);
  expect(s.date).toBe('2026-11-01');
  expect(s.ended_at).toBeTruthy();
  expect(s.dirty).toBe(1); // will be pushed to the server
  expect(s.exercises).toHaveLength(1);
  expect(s.exercises[0]).toMatchObject({ name: 'Squat', notes: 'heavy' });
  expect(s.exercises[0].sets.map((x) => [x.reps, x.weight, x.done, x.type])).toEqual([
    [5, 225, true, 'normal'],
    [5, 235, true, 'normal'],
  ]);
});
