import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearLocalData, db, deleteBodyEntry, getProfile, listBodyEntries, listGoals, saveBodyEntry, saveGoal, saveProfile, deleteGoal,
} from '../src/db';
import { buildExport, importFile } from '../src/backup';
import { changeOver, weightTrend } from '../src/body';
import { bestForExercise, goalStatus, progressBetween, weekStartOf, weeklyGoalProgress } from '../src/goals';
import { cmToIn, inToCm, kgToLb, lbToKg, weightIn, weightOut } from '../src/units';

beforeEach(() => clearLocalData());

describe('units', () => {
  it('round-trips weights and lengths', () => {
    expect(weightOut(100, 'kg')).toBe(100);
    expect(weightOut(100, 'lb')).toBe(220.5);
    expect(lbToKg(kgToLb(72.3))).toBeCloseTo(72.3, 8);
    expect(weightIn(180, 'lb')).toBeCloseTo(81.65, 2);
    expect(inToCm(cmToIn(91.4))).toBeCloseTo(91.4, 8);
    expect(weightOut(null, 'lb')).toBeNull();
  });
});

describe('profile', () => {
  it('is null until saved, then holds cleaned values', async () => {
    expect(await getProfile()).toBeNull();
    await saveProfile({ display_name: '  Chris  ', units: 'kg', height_cm: '180', week_start: 0 });
    expect(await getProfile()).toMatchObject({ display_name: 'Chris', units: 'kg', height_cm: 180, week_start: 0, dirty: 1 });
  });
  it('rejects nonsense and keeps other fields on a partial save', async () => {
    await saveProfile({ display_name: 'A', units: 'kg' });
    await saveProfile({ height_cm: 9999, units: 'stone' });
    expect(await getProfile()).toMatchObject({ display_name: 'A', units: 'lb', height_cm: null });
    expect(await db.profile.count()).toBe(1);
  });
});

describe('body entries', () => {
  it('saving the same date again updates that entry instead of adding one', async () => {
    const a = await saveBodyEntry({ date: '2026-11-01', weight_kg: 80 });
    const b = await saveBodyEntry({ date: '2026-11-01', weight_kg: 79.5, measurements: { waist: 88, chest: '' } });
    expect(b.id).toBe(a.id);
    const list = await listBodyEntries();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ weight_kg: 79.5, measurements: { waist: 88 } });
  });
  it('drops impossible numbers and lists newest first', async () => {
    await saveBodyEntry({ date: '2026-11-01', weight_kg: -3, body_fat: 150 });
    await saveBodyEntry({ date: '2026-11-03', weight_kg: 80 });
    const list = await listBodyEntries();
    expect(list.map((e) => e.date)).toEqual(['2026-11-03', '2026-11-01']);
    expect(list[1]).toMatchObject({ weight_kg: null, body_fat: null });
  });
  it('shows only one entry per day if two devices both logged it', async () => {
    const base = { weight_kg: 80, body_fat: null, measurements: {}, notes: '', deleted_at: null, dirty: 0, rev: 1 };
    await db.bodyEntries.put({ ...base, id: 'a', date: '2026-11-01', updated_at: '2026-11-01T10:00:00Z' });
    await db.bodyEntries.put({ ...base, id: 'b', date: '2026-11-01', weight_kg: 81, updated_at: '2026-11-01T12:00:00Z' });
    const list = await listBodyEntries();
    expect(list).toHaveLength(1);
    expect(list[0].weight_kg).toBe(81);
  });
  it('delete is soft and a deleted day can be logged again', async () => {
    const a = await saveBodyEntry({ date: '2026-11-01', weight_kg: 80 });
    await deleteBodyEntry(a.id);
    expect(await listBodyEntries()).toEqual([]);
    expect((await db.bodyEntries.get(a.id)).deleted_at).toBeTruthy();
    await saveBodyEntry({ date: '2026-11-01', weight_kg: 82 });
    expect(await listBodyEntries()).toHaveLength(1);
  });
});

describe('weight trend', () => {
  const e = (date, w) => ({ date, weight_kg: w });
  it('averages the last 7 days', () => {
    const t = weightTrend([e('2026-11-01', 80), e('2026-11-02', 82), e('2026-11-10', 78)]);
    expect(t[1].trend_kg).toBe(81);
    expect(t[2].trend_kg).toBe(78); // the earlier ones are more than 7 days old
  });
  it('reports change over a period and needs enough data', () => {
    const now = new Date('2026-11-30T12:00:00');
    expect(changeOver([e('2026-11-29', 80)], 30, now)).toBeNull();
    const c = changeOver([e('2026-11-05', 84), e('2026-11-29', 80)], 30, now);
    expect(c).toBeCloseTo(-4, 5);
  });
});

describe('goals', () => {
  const sess = (date, name = 'Squat', weight = 100, reps = 5) => ({
    id: date + name, date, deleted_at: null, ended_at: date + 'T10:00:00Z', started_at: date + 'T09:00:00Z',
    exercises: [{ name, sets: [{ type: 'normal', reps, weight, done: true }] }],
  });

  it('week starts on Monday or Sunday', () => {
    expect(weekStartOf('2026-11-08', 1)).toBe('2026-11-02'); // Sunday
    expect(weekStartOf('2026-11-08', 0)).toBe('2026-11-08');
    expect(weekStartOf('2026-11-02', 1)).toBe('2026-11-02');
  });

  it('counts this week and the streak of weeks that hit the target', () => {
    const s = [
      sess('2026-10-19'), sess('2026-10-21'), // week of Oct 19: 2
      sess('2026-10-26'), sess('2026-10-28'), // week of Oct 26: 2
      sess('2026-11-02'), // this week: 1
    ];
    const p = weeklyGoalProgress(s, 2, 1, '2026-11-04');
    expect(p).toMatchObject({ done: 1, streak: 2 }); // this week still in progress; streak counted back
    const q = weeklyGoalProgress([...s, sess('2026-11-03')], 2, 1, '2026-11-04');
    expect(q).toMatchObject({ done: 2, streak: 3 });
  });

  it('ignores unfinished and deleted workouts', () => {
    const s = [{ ...sess('2026-11-02'), ended_at: null }, { ...sess('2026-11-03'), deleted_at: 'x' }];
    expect(weeklyGoalProgress(s, 1, 1, '2026-11-04').done).toBe(0);
  });

  it('progress works whether the target is above or below the start', () => {
    expect(progressBetween(90, 85, 80)).toBeCloseTo(0.5);
    expect(progressBetween(70, 75, 80)).toBeCloseTo(0.5);
    expect(progressBetween(90, 95, 80)).toBe(0);
    expect(progressBetween(90, 70, 80)).toBe(1);
    expect(progressBetween(null, 70, 80)).toBe(0);
  });

  it('finds the best lift by weight or estimated 1RM, ignoring warm-ups', () => {
    const s = [sess('2026-11-01', 'Squat', 100, 5), sess('2026-11-02', 'squat', 110, 1)];
    s[0].exercises[0].sets.push({ type: 'warmup', reps: 5, weight: 200, done: true });
    expect(bestForExercise(s, 'Squat', 'weight')).toBe(110);
    expect(bestForExercise(s, 'SQUAT', 'e1rm')).toBeCloseTo(116.67, 1);
    expect(bestForExercise(s, 'Deadlift')).toBeNull();
  });

  it('describes each goal type', () => {
    const base = { sessions: [sess('2026-11-01', 'Squat', 100, 5)], entries: [], weekStart: 1, todayStr: '2026-11-04' };
    expect(goalStatus({ type: 'lift', exercise: 'Squat', metric: 'weight', target: 120, start_value: 80 }, { ...base })).toMatchObject({ current: 100, reached: false });
    expect(goalStatus({ type: 'lift', exercise: 'Squat', metric: 'weight', target: 100, start_value: 80 }, { ...base }).reached).toBe(true);
    expect(goalStatus({ type: 'body_weight', target: 75, start_value: 85 }, { ...base, latestKg: 80 }).pct).toBeCloseTo(0.5);
    expect(goalStatus({ type: 'body_weight', target: 75, start_value: 85 }, { ...base, latestKg: 74 }).reached).toBe(true);
    expect(goalStatus({ type: 'body_weight', target: 75, start_value: 85 }, { ...base, latestKg: null }).pct).toBe(0);
  });

  it('saves, lists and deletes goals, and refuses ones that are incomplete', async () => {
    await expect(saveGoal({ type: 'lift', exercise: '', target: 100 })).rejects.toThrow();
    await expect(saveGoal({ type: 'weekly_workouts', target: 0 })).rejects.toThrow();
    const g = await saveGoal({ type: 'lift', exercise: ' Bench Press ', metric: 'e1rm', target: '100', start_value: 80 });
    expect(g).toMatchObject({ exercise: 'Bench Press', metric: 'e1rm', target: 100 });
    expect(await listGoals()).toHaveLength(1);
    await deleteGoal(g.id);
    expect(await listGoals()).toEqual([]);
  });
});

describe('backup version 4', () => {
  it('exports and re-imports body entries, goals and profile without duplicating', async () => {
    await saveProfile({ display_name: 'Chris', units: 'kg', height_cm: 180 });
    await saveBodyEntry({ date: '2026-11-01', weight_kg: 80, body_fat: 18, measurements: { waist: 88 } });
    await saveGoal({ type: 'body_weight', target: 75, start_value: 80 });
    const data = await buildExport();
    expect(data.version).toBe(5);
    expect(data.body_entries).toHaveLength(1);
    expect(data.goals).toHaveLength(1);
    expect(data.profile).toMatchObject({ display_name: 'Chris', units: 'kg' });
    expect(data.profile).not.toHaveProperty('id');

    const file = new File([JSON.stringify(data)], 'b.json');
    const same = await importFile(file);
    expect(same).toMatchObject({ body: 0, goals: 0, profile: false });

    await clearLocalData();
    const fresh = await importFile(new File([JSON.stringify(data)], 'b.json'));
    expect(fresh).toMatchObject({ body: 1, goals: 1, profile: true });
    expect((await getProfile()).display_name).toBe('Chris');
    expect((await listBodyEntries())[0]).toMatchObject({ weight_kg: 80, body_fat: 18, measurements: { waist: 88 } });
  });

  it('does not overwrite an existing profile, and skips a day that already has an entry', async () => {
    await saveProfile({ display_name: 'Mine' });
    await saveBodyEntry({ date: '2026-11-01', weight_kg: 80 });
    const id = crypto.randomUUID();
    const data = {
      app: 'repwise', version: 4,
      profile: { display_name: 'Other' },
      body_entries: [{ id, date: '2026-11-01', weight_kg: 90 }, { id: 'bad', date: '2026-11-02', weight_kg: 90 }, { id: crypto.randomUUID(), date: '2026-11-03', weight_kg: 5000 }],
    };
    const r = await importFile(new File([JSON.stringify(data)], 'b.json'));
    expect(r).toMatchObject({ body: 0, skipped: 1, invalid: 2, profile: false });
    expect((await getProfile()).display_name).toBe('Mine');
  });
});
