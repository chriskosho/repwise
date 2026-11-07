import { describe, expect, it } from 'vitest';
import { historyNames, loadLibrary, searchExercises } from '../src/library';

const lib = [
  { name: 'Barbell Squat', muscle: 'quadriceps', equipment: 'barbell', category: 'strength' },
  { name: 'Squat', muscle: 'quadriceps', equipment: 'barbell', category: 'strength' },
  { name: 'Dumbbell Squat', muscle: 'quadriceps', equipment: 'dumbbell', category: 'strength' },
  { name: 'Quad Stretch', muscle: 'quadriceps', equipment: 'bodyweight', category: 'stretching' },
  { name: 'Barbell Curl', muscle: 'biceps', equipment: 'barbell', category: 'strength' },
  { name: 'Hammer Curl', muscle: 'biceps', equipment: 'dumbbell', category: 'strength' },
];
const names = (rows) => rows.map((r) => r.name);

describe('the bundled library', () => {
  it('loads with tagged exercises and no duplicate names', async () => {
    const list = await loadLibrary();
    expect(list.length).toBeGreaterThan(800);
    expect(list.every((x) => x.name && x.muscle && x.equipment)).toBe(true);
    expect(new Set(list.map((x) => x.name.toLowerCase())).size).toBe(list.length);
    expect(list.find((x) => x.name === 'Barbell Squat')).toMatchObject({ muscle: 'quadriceps', equipment: 'barbell' });
  });
});

describe('searchExercises', () => {
  it('lists your exercises first (most recent first), then the library A to Z with stretches last', () => {
    const rows = searchExercises({ library: lib, history: ['Hammer Curl', 'Cable Fly'] });
    expect(names(rows)).toEqual(['Hammer Curl', 'Cable Fly', 'Barbell Curl', 'Barbell Squat', 'Dumbbell Squat', 'Squat', 'Quad Stretch']);
    expect(rows.filter((r) => r.mine).length).toBe(2);
  });

  it('ranks an exact name, then names that start with the search, then the rest', () => {
    const rows = searchExercises({ library: lib, query: 'squat' });
    expect(names(rows)).toEqual(['Squat', 'Barbell Squat', 'Dumbbell Squat']);
  });

  it('matches every word in any order, and also the equipment and muscle', () => {
    expect(names(searchExercises({ library: lib, query: 'curl barbell' }))).toEqual(['Barbell Curl']);
    expect(names(searchExercises({ library: lib, query: 'biceps' }))).toEqual(['Barbell Curl', 'Hammer Curl']);
    expect(searchExercises({ library: lib, query: 'zzz' })).toEqual([]);
  });

  it('ignores case and extra spaces', () => {
    // 'Squat' is also a barbell exercise, so it matches too, but after the name that starts with the search.
    expect(names(searchExercises({ library: lib, query: '  BARBELL   squat ' }))).toEqual(['Barbell Squat', 'Squat']);
  });

  it('filters by muscle and equipment', () => {
    expect(names(searchExercises({ library: lib, muscle: 'biceps' }))).toEqual(['Barbell Curl', 'Hammer Curl']);
    expect(names(searchExercises({ library: lib, equipment: 'dumbbell' }))).toEqual(['Dumbbell Squat', 'Hammer Curl']);
    expect(names(searchExercises({ library: lib, muscle: 'quadriceps', equipment: 'barbell', query: 'squat' }))).toEqual(['Squat', 'Barbell Squat']);
  });

  it('lets a logged exercise borrow muscle and equipment from the library, and drops unknown ones when filtering', () => {
    const rows = searchExercises({ library: lib, history: ['barbell curl', 'My Odd Lift'], muscle: 'biceps' });
    expect(names(rows)).toEqual(['barbell curl', 'Hammer Curl']); // 'My Odd Lift' has no muscle, so it is filtered out
    expect(rows[0]).toMatchObject({ mine: true, muscle: 'biceps', equipment: 'barbell' });
    expect(names(searchExercises({ library: lib, history: ['My Odd Lift'] }))).toContain('My Odd Lift');
  });

  it('shows each exercise once, preferring yours over the library', () => {
    const custom = [{ name: 'Barbell Squat', muscle: 'glutes', equipment: 'machine' }];
    const rows = searchExercises({ library: lib, custom, history: ['BARBELL SQUAT'], query: 'barbell squat' });
    const same = rows.filter((r) => r.key === 'barbell squat');
    expect(same).toHaveLength(1);
    expect(same[0]).toMatchObject({ name: 'Barbell Squat', mine: true, muscle: 'glutes', equipment: 'machine' });
  });

  it('works with only your own exercises while the library is unavailable', () => {
    const rows = searchExercises({ custom: [{ name: 'Sled Push', muscle: 'quadriceps', equipment: 'other' }], history: ['Squat'] });
    expect(names(rows)).toEqual(['Sled Push', 'Squat']);
  });
});

describe('historyNames', () => {
  it('lists each logged exercise once, most recent first, keeping the latest spelling', () => {
    const sessions = [
      { exercises: [{ name: 'squat' }, { name: 'Row' }] },
      { exercises: [{ name: 'Squat' }, { name: 'Curl' }] },
    ];
    expect(historyNames(sessions)).toEqual(['squat', 'Row', 'Curl']);
  });
});
