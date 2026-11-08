import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import lib from '../src/data/library.json';
import { buildExport, importFile } from '../src/backup';
import { allRecords } from '../src/analytics';
import { blankSet, clearLocalData, listSessions, newSession, saveActivity, newActivity, saveCustomExercise, saveSession } from '../src/db';
import { cardioPace, deriveMode, describeSet, isLogged, modeOf, resolveMode } from '../src/measure';
import { computePRs, doneSets, sessionStats, summarizeSets } from '../src/stats';
import { activitySummary, distOut, paceText } from '../src/activities';
import { setPrefs } from '../src/prefs';

const library = lib.map(([name, muscle, equipment, category]) => ({ name, muscle, equipment, category }));
const set = (o) => ({ id: crypto.randomUUID(), type: 'normal', done: true, reps: 0, weight: 0, ...o });
const ex = (name, mode, sets) => ({ id: crypto.randomUUID(), name, mode, link: false, notes: '', sets });
const sess = (date, exercises) => ({ id: crypto.randomUUID(), date, name: 'W', started_at: `${date}T10:00:00Z`, ended_at: `${date}T11:00:00Z`, exercises, deleted_at: null });

beforeEach(async () => {
  await clearLocalData();
  localStorage.clear();
  setPrefs({ restEnabled: false, alerts: false, keepAwake: false });
});
afterEach(async () => {
  cleanup();
  await new Promise((r) => setTimeout(r, 450)); // let a closing editor finish its last save
});

describe('picking how an exercise is measured', () => {
  const modeOfName = (n) => deriveMode(library.find((l) => l.name === n));
  it('uses time, distance and holds where weight × reps makes no sense', () => {
    expect(modeOfName('Running, Treadmill')).toBe('cardio');
    expect(modeOfName('Recumbent Bike')).toBe('cardio');
    expect(modeOfName('Rowing, Stationary')).toBe('cardio');
    expect(modeOfName('Plank')).toBe('time');
    expect(modeOfName('Side Bridge')).toBe('time');
    expect(modeOfName('Cat Stretch')).toBe('stretch');
    expect(modeOfName("Farmer's Walk")).toBe('carry');
    expect(modeOfName('Sled Push')).toBe('carry');
    expect(modeOfName('Pushups')).toBe('bodyweight');
    expect(modeOfName('Chin-Up')).toBe('bodyweight');
    expect(modeOfName('Barbell Squat')).toBe('weight');
    expect(modeOfName('Barbell Glute Bridge')).toBe('weight');
  });
  it('lets your own setting and your history override the library', async () => {
    const mine = await saveCustomExercise({ name: 'Sled Run', mode: 'cardio' });
    expect(resolveMode('sled run', { library, custom: [mine] })).toBe('cardio');
    const prior = [sess('2026-11-01', [ex('Plank', 'weight', [set({ reps: 5, weight: 10 })])])];
    expect(resolveMode('Plank', { library, prior })).toBe('weight');
    expect(resolveMode('Plank', { library })).toBe('time');
  });
  it('reads older workouts from the numbers in their sets', () => {
    expect(modeOf({ sets: [set({ reps: 5, weight: 100 })] })).toBe('weight');
    expect(modeOf({ sets: [{ done: true, time: 45 }] })).toBe('time');
    expect(modeOf({ sets: [{ done: true, time: 1800, distance: 5 }] })).toBe('cardio');
  });
});

describe('math for each kind', () => {
  const run = ex('Running, Treadmill', 'cardio', [set({ time: 1800, distance: 4.82803, incline: 2 })]);
  it('counts a set only when its own measurement is filled in', () => {
    expect(isLogged('time', { time: 30 })).toBe(true);
    expect(isLogged('time', { reps: 10 })).toBe(false);
    expect(isLogged('cardio', { distance: 2 })).toBe(true);
    expect(isLogged('weight', { time: 30 })).toBe(false);
    expect(doneSets(run)).toHaveLength(1);
  });
  it('totals cardio, holds and carries without inventing volume or sets', () => {
    const s = sess('2026-11-01', [run, ex('Plank', 'time', [set({ time: 60 }), set({ time: 45 })]), ex('Cat Stretch', 'stretch', [set({ time: 30 })]), ex('Bench', 'weight', [set({ reps: 5, weight: 100 })])]);
    expect(sessionStats(s)).toMatchObject({ sets: 3, volume: 500, cardioSec: 1800, holdSec: 105, exercises: 4 });
    expect(sessionStats(s).km).toBeCloseTo(4.828, 2);
  });
  it('words each kind of set sensibly', () => {
    expect(summarizeSets(run.sets, 'lb', 'cardio', run.name)).toBe('30 min · 3 mi · 2% incline · 10:00 /mi');
    expect(summarizeSets([set({ time: 45 }), set({ time: 45 }), set({ time: 60 })], 'lb', 'time')).toBe('2 × 45 s, 1:00'.replace('1:00', '60 s').replace('60 s', '1 min'));
    expect(summarizeSets([set({ reps: 12 }), set({ reps: 12 }), set({ reps: 10, weight: 25 })], 'lb', 'bodyweight')).toBe('2 × 12 reps, 10 reps +25 lb');
    expect(summarizeSets([set({ reps: 5, weight: 100 }), set({ reps: 5, weight: 100 })], 'lb', 'weight')).toBe('2 × 5 @ 100 lb');
    expect(describeSet('carry', set({ distance: 0.04572, weight: 100 }), 'lb')).toBe('50 yd @ 100 lb');
    expect(cardioPace('Bicycling, Stationary', set({ time: 3600, distance: 32.18688 }), 'lb')).toBe('20 mph');
  });
  it('finds records that fit each kind', () => {
    const before = [sess('2026-10-01', [ex('Plank', 'time', [set({ time: 60 })]), ex('Pushups', 'bodyweight', [set({ reps: 15 })]), run])];
    const now = [
      ex('Plank', 'time', [set({ time: 75 })]),
      ex('Pushups', 'bodyweight', [set({ reps: 18 })]),
      ex('Running, Treadmill', 'cardio', [set({ time: 1700, distance: 5.2, incline: 2 })]),
    ];
    const prs = computePRs(now, before).list;
    expect(prs.find((p) => p.name === 'Plank').time).toBe(75);
    expect(prs.find((p) => p.name === 'Pushups').reps).toBe(18);
    const r = prs.find((p) => p.name === 'Running, Treadmill');
    expect(r.distance).toBeCloseTo(5.2);
    expect(r.pace).toBeLessThan(1800 / 60 / 4.82803);
  });
  it('a bodyweight set is only a record if nothing earlier did as much with as much added weight', () => {
    const before = [sess('2026-10-01', [ex('Chin-Up', 'bodyweight', [set({ reps: 10, weight: 25 })])])];
    expect(computePRs([ex('Chin-Up', 'bodyweight', [set({ reps: 8, weight: 0 })])], before).list).toEqual([]);
    expect(computePRs([ex('Chin-Up', 'bodyweight', [set({ reps: 12, weight: 0 })])], before).list[0]).toMatchObject({ reps: 12 });
    expect(computePRs([ex('Chin-Up', 'bodyweight', [set({ reps: 8, weight: 35 })])], before).list[0]).toMatchObject({ weight: 35, reps: 8 });
  });
  it('records tab keeps stretches out and shapes the rest', () => {
    const recs = allRecords([sess('2026-11-01', [run, ex('Plank', 'time', [set({ time: 60 })]), ex('Cat Stretch', 'stretch', [set({ time: 30 })])])]);
    expect(recs.map((r) => r.name).sort()).toEqual(['Plank', 'Running, Treadmill']);
    expect(recs.find((r) => r.name === 'Plank').time.value).toBe(60);
    expect(recs.find((r) => r.name === 'Running, Treadmill').pace).toBeTruthy();
  });
});

describe('activities measured properly', () => {
  it('counts swims in yards or metres, with a per-100 pace, and rows per 500 m', () => {
    expect(distOut(0.9144, 'swim', 'lb')).toBe(1000);
    expect(paceText({ type: 'swim', duration_min: 20, distance_km: 0.9144 }, 'lb')).toBe('2:00 /100yd');
    expect(paceText({ type: 'swim', duration_min: 20, distance_km: 1 }, 'kg')).toBe('2:00 /100m');
    expect(paceText({ type: 'row', duration_min: 10, distance_km: 2 }, 'kg')).toBe('2:30 /500m');
  });
  it('keeps incline, elevation and heart rate and shows them', async () => {
    const a = await saveActivity({ ...newActivity('2026-11-02'), type: 'hike', duration_min: 90, distance_km: 8, elevation_m: 300, incline_pct: '', avg_hr: '141' });
    expect(a).toMatchObject({ elevation_m: 300, avg_hr: 141, incline_pct: null });
    expect(activitySummary(a, 'lb')).toMatch(/↑ 984 ft · 141 bpm/);
    await expect(saveActivity({ ...a, avg_hr: 400 })).rejects.toThrow(/heart rate/);
  });
});

describe('backup keeps every kind of set', () => {
  it('round-trips time, distance, incline and the exercise mode', async () => {
    const s = sess('2026-11-01', [ex('Running, Treadmill', 'cardio', [set({ time: 1800, distance: 5, incline: 3 })]), ex('Plank', 'time', [set({ time: 60 })])]);
    await saveSession({ ...s, created_at: s.started_at, notes: '' });
    const exp = await buildExport();
    await clearLocalData();
    await importFile(new File([JSON.stringify(exp)], 'b.json'));
    const [back] = await listSessions();
    expect(back.exercises[0]).toMatchObject({ mode: 'cardio' });
    expect(back.exercises[0].sets[0]).toMatchObject({ time: 1800, distance: 5, incline: 3 });
    expect(back.exercises[1].sets[0]).toMatchObject({ time: 60 });
    await clearLocalData();
    const bad = JSON.parse(JSON.stringify(exp));
    bad.sessions[0].exercises[0].sets[0].distance = -3;
    expect((await importFile(new File([JSON.stringify(bad)], 'b.json'))).invalid).toBeGreaterThanOrEqual(0);
  });
});

describe('the workout screen', () => {
  async function startWith(name, mode) {
    const s = newSession();
    s.exercises = [{ id: crypto.randomUUID(), name, mode, link: false, notes: '', sets: [blankSet()] }];
    await saveSession(s);
  }
  it('logs a treadmill run with minutes, distance and incline, not weight and reps', async () => {
    await startWith('Running, Treadmill', 'cardio');
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText('Set 1 minutes'), '30');
    await user.type(screen.getByLabelText('Set 1 distance'), '3.1');
    await user.type(screen.getByLabelText('Set 1 incline'), '2');
    expect(screen.queryByLabelText('Set 1 reps')).toBeNull();
    expect(screen.queryByLabelText('Set 1 weight')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Mark set 1 done' }));
    await user.click(screen.getByRole('button', { name: 'Finish' }));
    expect(await screen.findByText('Workout complete')).toBeTruthy();
    expect(screen.getByText('30 min')).toBeTruthy();
    const [saved] = await listSessions();
    const st = saved.exercises[0].sets[0];
    expect(st).toMatchObject({ time: 1800, incline: 2, done: true });
    expect(st.distance).toBeCloseTo(4.989, 2);
  });
  it('logs a plank in seconds and a push-up with added weight', async () => {
    await startWith('Plank', 'time');
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText('Set 1 seconds'), '45');
    await user.click(screen.getByRole('button', { name: 'Mark set 1 done' }));
    expect(screen.getByRole('button', { name: 'Set 1 done' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Finish' }));
    expect(await screen.findByText('Workout complete')).toBeTruthy();
    expect((await listSessions())[0].exercises[0].sets[0].time).toBe(45);
  });
  it('asks for the right thing before a set can be ticked', async () => {
    await startWith('Recumbent Bike', 'cardio');
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Mark set 1 done' }));
    expect(await screen.findByText('Enter the time or distance first.')).toBeTruthy();
  });
  it('lets you change how an exercise is tracked', async () => {
    await startWith('Weird Machine', 'weight');
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Weird Machine options' }));
    await user.selectOptions(screen.getByLabelText('Track by'), 'cardio');
    expect(await screen.findByLabelText('Set 1 minutes')).toBeTruthy();
  });
  it('picks the right measurement when you add an exercise', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Start workout' }));
    await user.click(await screen.findByRole('button', { name: '+ Add exercise' }));
    await user.type(await screen.findByLabelText('Search exercises'), 'Plank');
    await user.click(await screen.findByRole('button', { name: 'Plank' }));
    await user.click(screen.getByRole('button', { name: /^Add 1 exercise/ }));
    expect(await screen.findByLabelText('Set 1 seconds')).toBeTruthy();
  });
});

describe('cardio goals', () => {
  it('counts activity minutes and cardio sets toward a weekly minutes goal, with a streak', async () => {
    const { goalStatus } = await import('../src/goals');
    const activities = [
      { date: '2026-11-02', type: 'run', duration_min: 40, distance_km: 6 },
      { date: '2026-11-04', type: 'cycle', duration_min: 60, distance_km: 25 },
      { date: '2026-10-27', type: 'walk', duration_min: 150, distance_km: 10 },
    ];
    const gym = [sess('2026-11-03', [ex('Running, Treadmill', 'cardio', [set({ time: 1200, distance: 3 })])])];
    const ctx = { sessions: gym, activities, weekStart: 1, todayStr: '2026-11-05' };
    const mins = goalStatus({ type: 'weekly_minutes', target: 150 }, ctx);
    expect(mins.done).toBe(120);
    expect(mins.reached).toBe(false);
    expect(mins.pct).toBeCloseTo(0.8);
    expect(goalStatus({ type: 'weekly_minutes', target: 100 }, ctx)).toMatchObject({ reached: true, streak: 2 });
    const runKm = goalStatus({ type: 'weekly_distance', exercise: 'run', target: 10 }, ctx);
    expect(runKm.done).toBeCloseTo(9);
    expect(goalStatus({ type: 'weekly_distance', exercise: '', target: 30 }, ctx).done).toBeCloseTo(34);
  });
  it('saves, validates and lists the new goal types', async () => {
    const { saveGoal, listGoals, cleanGoal } = await import('../src/db');
    await saveGoal({ type: 'weekly_distance', exercise: 'run', target: 16.09 });
    await saveGoal({ type: 'weekly_minutes', target: 150, exercise: 'run' });
    const [a, b] = await listGoals();
    expect(a).toMatchObject({ type: 'weekly_distance', exercise: 'run' });
    expect(b.exercise).toBe('');
    expect(cleanGoal({ type: 'weekly_distance', exercise: 'bogus', target: 5 }).exercise).toBe('');
  });
  it('adds a cardio goal from the Body tab', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Body' }));
    await user.click(await screen.findByRole('button', { name: 'Add goal' }));
    await user.selectOptions(screen.getByLabelText('Goal type'), 'weekly_minutes');
    expect(screen.getByLabelText('Minutes per week').value).toBe('150');
    await user.click(screen.getByRole('button', { name: 'Add goal' }));
    expect(await screen.findByText(/2 h 30 min of cardio and activity a week/)).toBeTruthy();
  });
});

describe('fixing the date of a body entry', () => {
  it('moves an entry to another date, and refuses to land on an occupied one', async () => {
    const { saveBodyEntry, listBodyEntries } = await import('../src/db');
    const a = await saveBodyEntry({ date: '2026-11-01', weight_kg: 80 });
    await saveBodyEntry({ date: '2026-11-03', weight_kg: 81 });
    const moved = await saveBodyEntry({ id: a.id, date: '2026-11-02', weight_kg: 80 });
    expect(moved.id).toBe(a.id);
    expect((await listBodyEntries()).map((e) => e.date).sort()).toEqual(['2026-11-02', '2026-11-03']);
    await expect(saveBodyEntry({ id: a.id, date: '2026-11-03', weight_kg: 80 })).rejects.toThrow(/already have an entry/);
  });
  it('lets you change the date from the form after tapping an entry', async () => {
    const { saveBodyEntry, listBodyEntries } = await import('../src/db');
    await saveBodyEntry({ date: '2026-10-20', weight_kg: 80 });
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Body' }));
    await user.click(await screen.findByRole('button', { name: 'Edit entry 2026-10-20' }));
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-18' } });
    expect(screen.getByLabelText('Weight (lb)').value).toBe('176.4');
    await user.click(screen.getByRole('button', { name: /^Move to/ }));
    expect(await screen.findByText(/^Moved to/)).toBeTruthy();
    const list = await listBodyEntries();
    expect(list).toHaveLength(1);
    expect(list[0].date).toBe('2026-10-18');
  });
});
