import { describe, expect, it } from 'vitest';
import lib from '../src/data/library.json';
import { CORE_EXERCISES, COMPOUND_SLOTS, NOT_FOR_BEGINNERS, SLOTS, coreExercise, gearAllows, levelAllows } from '../src/coreExercises';
import { GROUPS, suggestWorkout, suggestWeight } from '../src/suggest';
import { curatedStretch } from '../src/stretches';
import { exName, searchExercises } from '../src/library';
import { key } from '../src/stats';

const library = lib.map(([name, muscle, equipment, category, id, level, mech]) => ({ name, muscle, equipment, category, id, level, compound: mech === 'c' }));
const byName = new Map(library.map((l) => [key(l.name), l]));
const FOCI = ['push', 'pull', 'legs', 'full', 'core'];
const GEARS = ['gym', 'dumbbells', 'bodyweight'];
const musclesOf = (focus) => new Set((focus === 'full' ? ['push', 'pull', 'legs', 'core'] : [focus]).flatMap((g) => GROUPS[g].muscles));

describe('the core exercise list', () => {
  it('uses real library exercises with valid tags', () => {
    expect(CORE_EXERCISES.length).toBeGreaterThanOrEqual(75);
    for (const c of CORE_EXERCISES) {
      const l = byName.get(key(c.name));
      expect(l, c.name).toBeTruthy();
      expect(l.muscle, c.name).toBe(c.muscle);
      expect(SLOTS).toContain(c.slot);
      expect(['new', 'some', 'pro']).toContain(c.level);
      expect(c.display.length).toBeGreaterThan(2);
    }
    const names = CORE_EXERCISES.map((c) => key(c.name));
    expect(new Set(names).size).toBe(names.length);
    const shown = CORE_EXERCISES.map((c) => key(c.display));
    expect(new Set(shown).size).toBe(shown.length);
  });
  it('covers every slot for a full gym and for dumbbells', () => {
    // Dumbbells have no vertical pull (that needs a bar or a cable); everything else is covered.
    for (const gear of ['gym', 'dumbbells']) for (const slot of SLOTS.filter((x) => gear === 'gym' || x !== 'v-pull')) expect(CORE_EXERCISES.some((c) => c.slot === slot && gearAllows(gear, c.equip, c.bar)), `${gear} ${slot}`).toBe(true);
  });
  it('keeps pull-ups and chin-ups away from beginners and home setups', () => {
    for (const c of CORE_EXERCISES.filter((x) => /pull-?up|chin-?up/i.test(x.name))) {
      expect(levelAllows('new', c.level)).toBe(false);
      expect(gearAllows('dumbbells', c.equip, c.bar)).toBe(false);
      expect(gearAllows('bodyweight', c.equip, c.bar)).toBe(false);
    }
  });
});

describe('suggested workouts follow the rules across 50 seeds', () => {
  for (const gear of GEARS) {
    for (const focus of FOCI) {
      it(`${gear} · ${focus}`, () => {
        const wanted = musclesOf(focus);
        for (const level of ['new', 'some', 'pro']) {
          for (let seed = 0; seed < 50; seed++) {
            const s = suggestWorkout({ library, options: { minutes: 45, gear, focus, seed, level } });
            const ex = s.exercises;
            const tag = `${gear}/${focus}/${level}/${seed}: ${ex.map((e) => e.name).join(', ')}`;
            // Enough to be a workout (a bodyweight-only pull day is the one honest exception).
            expect(ex.length, tag).toBeGreaterThanOrEqual(gear === 'bodyweight' && focus === 'pull' ? 1 : 3);
            expect(new Set(ex.map((e) => key(e.name))).size, tag).toBe(ex.length);
            let fromCore = 0;
            for (const e of ex) {
              const c = coreExercise(e.name);
              const l = byName.get(key(e.name));
              expect(l, tag).toBeTruthy();
              // Never outside the focus.
              expect(wanted.has(l.muscle), `${tag} → ${e.name} works ${l.muscle}`).toBe(true);
              if (c) {
                fromCore++;
                expect(gearAllows(gear, c.equip, c.bar), `${tag} → ${e.name} needs ${c.equip}`).toBe(true);
                expect(levelAllows(level, c.level), `${tag} → ${e.name} is ${c.level}`).toBe(true);
              } else {
                expect(gearAllows(gear, l.equipment, /pull-?ups?\b|chin-?ups?\b/i.test(l.name)), `${tag} → ${e.name}`).toBe(true);
                expect(l.level, `${tag} → ${e.name}`).toBe('beginner');
              }
              if (level === 'new') expect(NOT_FOR_BEGINNERS.test(e.name), `${tag} → ${e.name}`).toBe(false);
            }
            // The core list does the work; the library only plugs gaps.
            if (gear === 'gym') expect(fromCore, tag).toBe(ex.length);
            else expect(fromCore / ex.length, tag).toBeGreaterThanOrEqual(0.5);
            // Two compound staples open every lifting day.
            if (focus !== 'core' && ex.length >= 2) {
              for (const e of ex.slice(0, 2)) {
                const c = coreExercise(e.name);
                expect(c ? COMPOUND_SLOTS.has(c.slot) : byName.get(key(e.name)).compound, `${tag} → ${e.name} should be compound`).toBe(true);
              }
            }
            // Cool-down comes from the curated stretch list.
            expect(s.stretches.length, tag).toBeGreaterThan(0);
            for (const n of s.stretches) expect(curatedStretch(n), `${tag} → ${n}`).toBeTruthy();
          }
        }
      });
    }
  }

  it('changes with the seed but repeats for the same seed', () => {
    const names = (seed) => suggestWorkout({ library, options: { focus: 'full', gear: 'gym', seed, level: 'some' } }).exercises.map((e) => e.name).join('|');
    expect(new Set(Array.from({ length: 10 }, (_, i) => names(i))).size).toBeGreaterThan(1);
    expect(names(3)).toBe(names(3));
  });

  it('still puts lift goals first', () => {
    const goals = [{ id: 'g', type: 'lift', exercise: 'Barbell Bench Press - Medium Grip', metric: 'weight', target: 225 }];
    const s = suggestWorkout({ library, goals, options: { focus: 'push', gear: 'gym', level: 'some' } });
    expect(s.exercises[0].name).toBe('Barbell Bench Press - Medium Grip');
    expect(s.reasons.join(' ')).toMatch(/one of your goals/);
  });

  it('can include your own exercises', () => {
    const custom = [{ id: 'c', name: 'Band curl at home', muscle: 'biceps', equipment: 'bands' }];
    const done = { id: 's', ended_at: 'x', date: '2026-11-01', exercises: [{ name: 'Band curl at home', sets: [{ done: true, type: 'normal', weight: 0, reps: 12 }] }] };
    const hits = Array.from({ length: 20 }, (_, seed) => suggestWorkout({ library, custom, sessions: [done], options: { focus: 'pull', gear: 'dumbbells', seed, level: 'some' } }));
    expect(hits.some((s) => s.exercises.some((e) => e.name === 'Band curl at home'))).toBe(true);
  });

  it('turns a no-equipment pull day into full body', () => {
    const sessions = ['push', 'legs'].map((f, i) => ({
      id: f,
      ended_at: 'x',
      date: `2026-11-0${i + 8}`,
      exercises: [{ name: f === 'push' ? 'Pushups' : 'Bodyweight Squat', sets: [{ done: true, type: 'normal', reps: 10 }] }],
    }));
    const s = suggestWorkout({ library, sessions, todayStr: '2026-11-11', options: { gear: 'bodyweight', level: 'new' } });
    expect(s.title).toBe('Full body');
    expect(s.exercises.length).toBeGreaterThanOrEqual(4);
  });
});

describe('display names', () => {
  it('shows everyday names but keeps the stored one', () => {
    expect(exName('Barbell Bench Press - Medium Grip')).toBe('Bench press');
    expect(exName('Wide-Grip Lat Pulldown')).toBe('Lat pulldown');
    expect(exName('My own thing')).toBe('My own thing');
    // Suggestions store library names, so history and progression still match.
    const s = suggestWorkout({ library, options: { focus: 'push', gear: 'gym', level: 'some', seed: 1 } });
    for (const e of s.exercises) expect(byName.has(key(e.name))).toBe(true);
    const hist = [{ id: 'h', ended_at: 'x', date: '2026-11-01', exercises: [{ name: 'Barbell Bench Press - Medium Grip', sets: [{ done: true, type: 'normal', weight: 135, reps: 12 }] }] }];
    expect(suggestWeight('Barbell Bench Press - Medium Grip', hist).weight).toBe(140);
  });
  it('finds exercises by their everyday name', () => {
    const rows = searchExercises({ library, query: 'lat pulldown' });
    expect(rows[0].name).toBe('Wide-Grip Lat Pulldown');
    expect(searchExercises({ library, query: 'skull crusher' }).some((r) => r.name === 'EZ-Bar Skullcrusher')).toBe(true);
  });
});
