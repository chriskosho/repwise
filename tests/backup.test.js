import { beforeEach, describe, expect, it } from 'vitest';
import { buildExport, importFile } from '../src/backup';
import { db, deleteSession, listSessions, newSession, saveSession } from '../src/db';

const asFile = (obj) => {
  const text = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return { size: text.length, text: async () => text };
};

const finished = (date, name, exercises) => ({
  ...newSession({ date, finished: true }),
  name,
  exercises,
});
const squat = (sets) => ({
  id: crypto.randomUUID(),
  name: 'Squat',
  link: false,
  notes: '',
  sets: sets.map(([reps, weight, type = 'normal']) => ({ id: crypto.randomUUID(), type, reps, weight, done: true })),
});

beforeEach(async () => {
  await db.sessions.clear();
});

describe('saving', () => {
  it('queues saves in order and bumps the revision', async () => {
    const s = finished('2026-11-01', 'A', [squat([[5, 100]])]);
    await Promise.all([saveSession(s), saveSession({ ...s, name: 'B' }), saveSession({ ...s, name: 'C' })]);
    const row = await db.sessions.get(s.id);
    expect(row.name).toBe('C');
    expect(row.rev).toBe(3);
    expect(row.dirty).toBe(1);
  });

  it('does not bring back a deleted workout when a late save arrives', async () => {
    const s = finished('2026-11-01', 'A', [squat([[5, 100]])]);
    await saveSession(s);
    await deleteSession(s.id);
    await saveSession({ ...s, name: 'late' });
    expect((await db.sessions.get(s.id)).deleted_at).toBeTruthy();
    expect(await listSessions()).toHaveLength(0);
  });

  it('hides empty finished workouts but keeps unfinished ones', async () => {
    await saveSession(newSession({ finished: true })); // abandoned "log a past workout"
    await saveSession(newSession()); // live workout, nothing added yet
    const list = await listSessions();
    expect(list).toHaveLength(1);
    expect(list[0].ended_at).toBeNull();
  });
});

describe('export and import', () => {
  it('round-trips finished workouts and never duplicates on re-import', async () => {
    await saveSession(finished('2026-11-01', 'Legs', [squat([[5, 225], [3, 245, 'failure']])]));
    await saveSession(newSession()); // unfinished: not exported
    const exp = await buildExport();
    expect(exp.version).toBe(2);
    expect(exp.sessions).toHaveLength(1);

    await db.sessions.clear();
    expect(await importFile(asFile(exp))).toEqual({ added: 1, skipped: 0, invalid: 0 });
    expect(await importFile(asFile(exp))).toEqual({ added: 0, skipped: 1, invalid: 0 });

    const [row] = await db.sessions.toArray();
    expect(row.name).toBe('Legs');
    expect(row.dirty).toBe(1);
    expect(row.exercises[0].sets.map((x) => x.type)).toEqual(['normal', 'failure']);
  });

  it('accepts version 1 backups and converts them', async () => {
    const id = '33333333-3333-4333-8333-333333333333';
    const v1 = {
      app: 'repwise',
      version: 1,
      workouts: [{ id, date: '2026-10-05', exercise: 'Row', sets: [{ reps: 10, weight: 80 }], notes: 'easy', created_at: '2026-10-05T12:00:00.000Z' }],
    };
    expect(await importFile(asFile(v1))).toEqual({ added: 1, skipped: 0, invalid: 0 });
    const row = await db.sessions.get(id);
    expect(row.exercises[0]).toMatchObject({ name: 'Row', notes: 'easy' });
  });

  it('ignores invalid entries and rejects wrong files', async () => {
    const good = (await (async () => {
      await saveSession(finished('2026-11-01', 'Ok', [squat([[5, 100]])]));
      const e = await buildExport();
      await db.sessions.clear();
      return e.sessions[0];
    })());
    const file = {
      app: 'repwise',
      version: 2,
      sessions: [
        good,
        { id: 'nope' },
        { ...good, id: crypto.randomUUID(), exercises: [squat([[0, 100]])] }, // no valid sets
      ],
    };
    expect(await importFile(asFile(file))).toEqual({ added: 1, skipped: 0, invalid: 2 });

    await expect(importFile(asFile({ hello: 1 }))).rejects.toThrow(/not a Repwise backup/);
    await expect(importFile(asFile('{oops'))).rejects.toThrow(/not valid JSON/);
  });

  it('does not re-add a workout you deleted', async () => {
    const s = finished('2026-11-01', 'Gone', [squat([[5, 100]])]);
    await saveSession(s);
    const exp = await buildExport();
    await deleteSession(s.id);
    expect(await importFile(asFile(exp))).toEqual({ added: 0, skipped: 1, invalid: 0 });
    expect(await listSessions()).toHaveLength(0);
  });
});
