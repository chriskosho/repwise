import { describe, expect, it } from 'vitest';
import { computePRs, e1rm, fmtClock, fmtDuration, previousSets, sessionStats, summarizeSets } from '../src/stats';

let n = 0;
const id = () => `id-${++n}`;
const set = (reps, weight, over = {}) => ({ id: id(), type: 'normal', reps, weight, done: true, ...over });
const ex = (name, sets) => ({ id: id(), name, link: false, notes: '', sets });
const sess = (date, exercises, over = {}) => ({
  id: id(),
  date,
  name: 'W',
  started_at: `${date}T10:00:00.000Z`,
  ended_at: `${date}T11:00:00.000Z`,
  exercises,
  ...over,
});

describe('sessionStats', () => {
  it('counts only completed work sets and totals volume and minutes', () => {
    const s = sess('2026-11-01', [
      ex('Squat', [set(5, 100, { type: 'warmup' }), set(5, 200), set(3, 220), set(5, 200, { done: false })]),
    ]);
    expect(sessionStats(s)).toEqual({ sets: 2, volume: 5 * 200 + 3 * 220, exercises: 1, minutes: 60 });
  });

  it('has no duration for an unfinished workout', () => {
    expect(sessionStats(sess('2026-11-01', [], { ended_at: null })).minutes).toBeNull();
  });
});

describe('previousSets', () => {
  const older = sess('2026-10-01', [ex('Squat', [set(5, 150)])]);
  const newer = sess('2026-10-10', [ex('squat', [set(5, 160), set(3, 170, { done: false })])]);

  it('returns the completed sets from the most recent earlier session, ignoring case', () => {
    expect(previousSets('SQUAT', [newer, older])).toEqual([{ type: 'normal', reps: 5, weight: 160 }]);
  });

  it('is empty for an exercise never done', () => {
    expect(previousSets('Deadlift', [newer, older])).toEqual([]);
  });
});

describe('computePRs', () => {
  const prior = [sess('2026-10-01', [ex('Bench Press', [set(5, 100)])])];

  it('does not mark records the first time you do an exercise', () => {
    const { bySet, list } = computePRs([ex('Row', [set(5, 500)])], prior);
    expect(bySet.size).toBe(0);
    expect(list).toEqual([]);
  });

  it('marks a heavier weight on the heaviest set only', () => {
    const heavy = set(3, 110);
    const light = set(3, 105);
    const { bySet, list } = computePRs([ex('bench press', [light, heavy])], prior);
    expect(bySet.get(heavy.id)).toMatchObject({ weight: true });
    expect(bySet.has(light.id)).toBe(false);
    expect(list[0]).toMatchObject({ name: 'bench press', weight: 110 });
  });

  it('marks an estimated 1RM record even at the same weight', () => {
    const more = set(8, 100);
    const { bySet } = computePRs([ex('Bench Press', [more])], prior);
    expect(bySet.get(more.id)).toEqual({ orm: true });
  });

  it('does not mark a tie, warm-ups, or sets not marked done', () => {
    const tie = set(5, 100);
    const warm = set(5, 300, { type: 'warmup' });
    const undone = set(5, 300, { done: false });
    const { bySet } = computePRs([ex('Bench Press', [tie, warm, undone])], prior);
    expect(bySet.size).toBe(0);
  });
});

describe('formatting and math', () => {
  it('estimates a 1RM', () => {
    expect(e1rm(1, 200)).toBe(200);
    expect(e1rm(10, 150)).toBeCloseTo(200);
  });

  it('groups identical sets', () => {
    expect(summarizeSets([set(8, 135), set(8, 135), set(6, 135), set(10, 0)], 'lb')).toBe('2 × 8 @ 135 lb, 1 × 6 @ 135 lb, 1 × 10');
  });

  it('formats clocks and durations', () => {
    expect(fmtClock(65)).toBe('1:05');
    expect(fmtClock(3661)).toBe('1:01:01');
    expect(fmtClock(-5)).toBe('0:00');
    expect(fmtDuration(45)).toBe('45 min');
    expect(fmtDuration(75)).toBe('1 h 15 min');
  });
});
