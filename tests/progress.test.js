import { describe, expect, it } from 'vitest';
import lib from '../src/data/library.json';
import { assessRecovery, suggestWeight, suggestWorkout, suggestionAsRoutine } from '../src/suggest';

const library = lib.map(([name, muscle, equipment, category, id, level, m]) => ({ name, muscle, equipment, category, id, level, compound: m === 'c' }));
const TODAY = '2026-11-07';
const day = (n) => { const d = new Date(`${TODAY}T12:00:00`); d.setDate(d.getDate() - n); return d.toLocaleDateString('en-CA'); };
const sess = (date, name, reps, weight = 100) => ({
  id: crypto.randomUUID(), date, name: 'W', started_at: `${date}T10:00:00Z`, ended_at: `${date}T11:00:00Z`, deleted_at: null,
  exercises: [{ id: 'e', name, mode: 'weight', sets: reps.map((r) => ({ id: crypto.randomUUID(), reps: r, weight, type: 'normal', done: true })) }],
});

describe('suggested weights', () => {
  it('adds weight when every set hit the top of the range', () => {
    const w = suggestWeight('Bench', [sess(day(3), 'Bench', [12, 12, 12], 135)], { unit: 'lb', reps: '8–12' });
    expect(w.weight).toBe(140);
    expect(suggestWeight('Bench', [sess(day(3), 'Bench', [12, 12, 12], 60)], { unit: 'kg', reps: '8–12' }).weight).toBe(62.5);
  });
  it('repeats when reps are in range, eases back when too low, none without history', () => {
    expect(suggestWeight('Bench', [sess(day(3), 'Bench', [10, 9, 8], 135)], { reps: '8–12' }).weight).toBe(135);
    expect(suggestWeight('Bench', [sess(day(3), 'Bench', [5, 4, 4], 135)], { reps: '8–12' }).weight).toBe(130);
    expect(suggestWeight('Bench', [], {})).toBeNull();
  });
  it('goes lighter on a light day', () => {
    expect(suggestWeight('Bench', [sess(day(3), 'Bench', [10, 10, 10], 100)], { reps: '8–12', light: true }).weight).toBe(90);
  });
  it('uses smaller jumps for dumbbells', () => {
    expect(suggestWeight('Curl', [sess(day(3), 'Curl', [12, 12], 30)], { reps: '8–12', equipment: 'dumbbell' }).weight).toBe(35);
    expect(suggestWeight('Curl', [sess(day(3), 'Curl', [12, 12], 14)], { unit: 'kg', reps: '8–12', equipment: 'dumbbell' }).weight).toBe(16);
  });
});

describe('recovery', () => {
  it('flags a rest day after three days in a row, counting from yesterday if needed', () => {
    const w = [day(1), day(2), day(3)].map((date) => ({ date }));
    expect(assessRecovery(w, TODAY)).toMatchObject({ streak: 3, rest: true });
    expect(assessRecovery([{ date: day(2) }, { date: day(3) }], TODAY).rest).toBe(false);
    expect(assessRecovery([{ date: day(4) }], TODAY).streak).toBe(0);
  });
  it('suggests a deload after five weeks of 3+ workouts', () => {
    const w = [];
    for (let wk = 0; wk < 5; wk++) for (const d of [0, 2, 4]) w.push({ date: day(wk * 7 + d + 1) });
    expect(assessRecovery(w, TODAY).deload).toBe(true);
    expect(assessRecovery(w.slice(0, 9), TODAY).deload).toBe(false);
  });
  it('makes a lighter plan when beat up and keeps weights in the routine targets', () => {
    const history = [sess(day(5), 'Barbell Squat', [10, 10, 10], 200)];
    const sq = (p) => p.exercises.find((e) => e.name === 'Barbell Squat');
    let seed = 0;
    const mk = (feeling) => suggestWorkout({ library, sessions: history, todayStr: TODAY, options: { focus: 'legs', seed, feeling } });
    while (seed < 40 && !sq(mk('auto'))) seed++;
    const normal = mk('auto');
    const beat = mk('beat');
    expect(sq(normal)).toBeTruthy();
    expect(beat.light).toBe(true);
    expect(beat.reasons.join(' ')).toMatch(/beat up/);
    expect(sq(normal).weight).toBe(200);
    expect(sq(beat).weight).toBe(180);
    expect(sq(beat).sets).toBe(sq(normal).sets - 1);
    expect(suggestionAsRoutine(normal).exercises.find((e) => e.name === 'Barbell Squat').target.weight).toBe(200);
    expect(normal.exercises.find((e) => e.mode === 'weight' && !e.weight)?.why).toMatch(/No history/);
  });
});
