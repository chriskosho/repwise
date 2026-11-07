import { describe, expect, it } from 'vitest';
import { activeWeekStreaks, allRecords, monthGrid, muscleLookup, muscleWeek } from '../src/analytics';
import { platesFor, warmupSets } from '../src/calc';

const set = (reps, weight, type = 'normal', done = true) => ({ id: Math.random().toString(), type, reps, weight, done });
const sess = (date, exercises, extra = {}) => ({
  id: date + Math.random(), date, deleted_at: null, started_at: date + 'T09:00:00Z', ended_at: date + 'T10:00:00Z',
  exercises: exercises.map(([name, sets]) => ({ id: name, name, sets })), ...extra,
});

describe('records', () => {
  it('finds heaviest, best 1RM and best volume, ignoring warm-ups and undone sets', () => {
    const s = [
      sess('2026-11-01', [['Squat', [set(5, 100), set(5, 200, 'warmup'), set(5, 300, 'normal', false)]]]),
      sess('2026-11-05', [['squat', [set(1, 120), set(8, 90)]]]),
    ];
    const [r] = allRecords(s);
    expect(r.count).toBe(2);
    expect(r.weight).toMatchObject({ value: 120, reps: 1, date: '2026-11-05' });
    expect(r.e1rm.value).toBeCloseTo(120, 5); // 90 x 8 = 114 < 120
    expect(r.volume).toEqual({ value: 840, date: '2026-11-05' }); // 120 + 8x90, versus 500 on the 1st
    expect(r.last).toBe('2026-11-05');
  });
  it('skips unfinished and deleted workouts and bodyweight-only exercises have no weight record', () => {
    const s = [sess('2026-11-01', [['Pull up', [set(10, 0)]]]), sess('2026-11-02', [['Squat', [set(5, 100)]]], { ended_at: null }), sess('2026-11-03', [['Bench', [set(5, 80)]]], { deleted_at: 'x' })];
    const r = allRecords(s);
    expect(r.map((x) => x.name)).toEqual(['Pull up']);
    expect(r[0].weight).toBeNull();
  });
});

describe('muscle volume', () => {
  const lookup = muscleLookup([{ name: 'Squat', muscle: 'quadriceps' }, { name: 'Bench', muscle: 'chest' }], [{ name: 'My lift', muscle: 'lats' }]);
  it('maps names, with your own exercises and a fallback', () => {
    expect(lookup('squat')).toBe('quadriceps');
    expect(lookup('My Lift')).toBe('lats');
    expect(lookup('???')).toBe('other');
  });
  it('totals sets and volume for one week', () => {
    const s = [
      sess('2026-11-02', [['Squat', [set(5, 100), set(5, 100), set(5, 50, 'warmup')]]]), // Monday
      sess('2026-11-08', [['Bench', [set(10, 50)]]]), // Sunday, same Mon-start week
      sess('2026-11-09', [['Bench', [set(10, 50)]]]), // next week
    ];
    const w = muscleWeek(s, lookup, { weekStart: 1, todayStr: '2026-11-04' });
    expect(w.start).toBe('2026-11-02');
    expect(w.by.quadriceps).toEqual({ sets: 2, volume: 1000 });
    expect(w.by.chest).toEqual({ sets: 1, volume: 500 });
    const last = muscleWeek(s, lookup, { weekStart: 1, weeksAgo: 1, todayStr: '2026-11-04' });
    expect(last.by).toEqual({});
  });
});

describe('streaks and calendar', () => {
  it('counts consecutive active weeks', () => {
    const s = ['2026-10-12', '2026-10-20', '2026-10-27', '2026-11-03'].map((d) => sess(d, [['Squat', [set(5, 100)]]]));
    expect(activeWeekStreaks(s, 1, '2026-11-04')).toEqual({ current: 4, longest: 4, total: 4 });
    // Nothing yet this week: streak counts back from last week.
    expect(activeWeekStreaks(s, 1, '2026-11-10').current).toBe(4);
    expect(activeWeekStreaks(s, 1, '2026-11-17').current).toBe(0);
  });
  it('lays a month out in whole weeks and marks workout days', () => {
    const s = [sess('2026-11-03', [['Squat', [set(5, 100)]]]), sess('2026-11-03', [['Bench', [set(5, 100)]]])];
    const weeks = monthGrid(s, 2026, 10, 1); // November 2026 starts on a Sunday
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0].slice(0, 6).every((c) => c === null)).toBe(true);
    expect(weeks[0][6]).toMatchObject({ date: '2026-11-01', day: 1 });
    const cells = weeks.flat().filter(Boolean);
    expect(cells).toHaveLength(30);
    expect(cells.find((c) => c.date === '2026-11-03').count).toBe(2);
    expect(monthGrid([], 2026, 10, 0)[0][0]).toMatchObject({ day: 1 }); // Sunday start
  });
});

describe('plate calculator', () => {
  const lb = [45, 35, 25, 10, 5, 2.5];
  it('loads 225 lb as two 45s a side', () => {
    expect(platesFor(225, 45, lb)).toMatchObject({ perSide: [{ plate: 45, count: 2 }], achieved: 225, short: 0 });
  });
  it('builds mixed loads and reports what cannot be made', () => {
    expect(platesFor(135, 45, lb).perSide).toEqual([{ plate: 45, count: 1 }]);
    expect(platesFor(195, 45, lb).perSide).toEqual([{ plate: 45, count: 1 }, { plate: 25, count: 1 }, { plate: 5, count: 1 }]);
    const r = platesFor(100, 45, [45, 25]);
    expect(r.perSide).toEqual([{ plate: 25, count: 1 }]);
    expect(r.achieved).toBe(95);
    expect(r.short).toBe(5);
  });
  it('handles the bar alone and bad input', () => {
    expect(platesFor(45, 45, lb)).toMatchObject({ perSide: [], achieved: 45 });
    expect(platesFor(30, 45, lb).error).toBeTruthy();
    expect(platesFor('', 45, lb).error).toBeTruthy();
    expect(platesFor(100, 20, []).error).toBeTruthy();
  });
  it('works in kg with small plates', () => {
    expect(platesFor(102.5, 20, [25, 20, 15, 10, 5, 2.5, 1.25]).perSide).toEqual([{ plate: 25, count: 1 }, { plate: 15, count: 1 }, { plate: 1.25, count: 1 }]);
  });
});

describe('warm-up calculator', () => {
  it('ramps from the bar toward the working weight', () => {
    expect(warmupSets(225, 45, 5)).toEqual([
      { weight: 45, reps: 10 },
      { weight: 90, reps: 5 },
      { weight: 135, reps: 3 },
      { weight: 180, reps: 2 },
    ]);
  });
  it('skips duplicates and anything not below the working weight', () => {
    const w = warmupSets(60, 45, 5);
    expect(w.every((s) => s.weight < 60)).toBe(true);
    expect(new Set(w.map((s) => s.weight)).size).toBe(w.length);
    expect(warmupSets(45, 45, 5)).toEqual([]);
    expect(warmupSets('', 45, 5)).toEqual([]);
  });
});

it('longest streak can be longer than the current one', () => {
  const s = ['2026-09-07', '2026-09-14', '2026-09-21', '2026-11-02'].map((d) => sess(d, [['Squat', [set(5, 100)]]]));
  expect(activeWeekStreaks(s, 1, '2026-11-04')).toMatchObject({ current: 1, longest: 3 });
});
