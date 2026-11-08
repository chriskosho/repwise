import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import lib from '../src/data/library.json';
import { clearLocalData, listSessions, newSession, saveGoal, saveSession, saveActivity, newActivity } from '../src/db';
import { categoryGroup, imageUrls, searchExercises, youtubeUrl } from '../src/library';
import { suggestWorkout, suggestionAsRoutine } from '../src/suggest';
import { activitySummary, typeLabel } from '../src/activities';
import { setPrefs } from '../src/prefs';

const library = lib.map(([name, muscle, equipment, category, id, level, m]) => ({ name, muscle, equipment, category, id, level, compound: m === 'c' }));
const TODAY = '2026-11-07';
const sess = (date, name, exName) => ({
  id: crypto.randomUUID(), date, name, ended_at: `${date}T10:00:00Z`, deleted_at: null,
  exercises: [{ id: 'e', name: exName, sets: [{ id: 's', reps: 5, weight: 100, type: 'normal', done: true }] }],
});

beforeEach(async () => {
  await clearLocalData();
  localStorage.clear();
  setPrefs({ restEnabled: false, alerts: false, keepAwake: false });
});
afterEach(cleanup);

describe('library help', () => {
  it('builds video searches from the exercise name, Shorts first', () => {
    const u = new URL(youtubeUrl('Barbell Squat'));
    expect(u.hostname).toBe('www.youtube.com');
    expect(u.searchParams.get('search_query')).toBe('Barbell Squat exercise form #shorts');
    expect(new URL(youtubeUrl("Child's Pose", { shorts: false, stretch: true })).searchParams.get('search_query')).toBe("Child's Pose stretch tutorial");
  });
  it('has ids for pictures and a stretching filter', () => {
    expect(imageUrls('Cat_Stretch')[1]).toMatch(/Cat_Stretch\/1\.jpg$/);
    expect(library.every((l) => l.id)).toBe(true);
    const stretches = searchExercises({ library, category: 'stretching' });
    expect(stretches.length).toBeGreaterThan(100);
    expect(stretches.every((s) => s.category === 'stretching')).toBe(true);
    expect(categoryGroup('powerlifting')).toBe('strength');
  });
});

describe('suggested workouts', () => {
  const base = { library, todayStr: TODAY };

  it('picks the muscle group you have trained least recently', () => {
    const sessions = [sess('2026-11-06', 'Push', 'Barbell Bench Press - Medium Grip'), sess('2026-11-05', 'Pull', 'Barbell Deadlift')];
    const s = suggestWorkout({ ...base, sessions, options: { focus: 'auto' } });
    expect(s.groups).toEqual(['legs']);
    expect(s.reasons[0]).toMatch(/Legs is next/);
  });
  it('puts a lift goal first and says why', () => {
    const goals = [{ type: 'lift', exercise: 'Barbell Squat', metric: 'weight', target: 225 }];
    const s = suggestWorkout({ ...base, sessions: [], goals, options: { focus: 'legs' } });
    expect(s.exercises[0]).toMatchObject({ name: 'Barbell Squat', sets: 5, reps: '3–5' });
    expect(s.reasons.join(' ')).toMatch(/Barbell Squat leads/);
  });
  it('shapes the work around a body-weight goal', () => {
    const lose = suggestWorkout({ ...base, sessions: [], latestKg: 90, goals: [{ type: 'body_weight', target: 82 }], options: { focus: 'push' } });
    expect(lose.intent).toBe('lose');
    expect(lose.exercises.every((e) => e.reps.startsWith('1'))).toBe(true);
    expect(lose.ideas[0].type).toBe('walk');
    const gain = suggestWorkout({ ...base, sessions: [], latestKg: 70, goals: [{ type: 'body_weight', target: 78 }], options: { focus: 'push' } });
    expect(gain.exercises[0].sets).toBe(4);
  });
  it('respects time and equipment, and only offers real exercises', () => {
    const short = suggestWorkout({ ...base, sessions: [], options: { minutes: 20, focus: 'full' } });
    const long = suggestWorkout({ ...base, sessions: [], options: { minutes: 60, focus: 'full' } });
    expect(short.exercises.length).toBeLessThan(long.exercises.length);
    const home = suggestWorkout({ ...base, sessions: [], options: { gear: 'bodyweight', focus: 'push', minutes: 45 } });
    const byName = new Map(library.map((l) => [l.name, l]));
    expect(home.exercises.length).toBeGreaterThan(2);
    expect(home.exercises.every((e) => byName.get(e.name).equipment === 'bodyweight')).toBe(true);
    expect(long.exercises.every((e) => byName.get(e.name))).toBe(true);
    expect(new Set(long.exercises.map((e) => e.name)).size).toBe(long.exercises.length);
  });
  it('adds cool-down stretches for the muscles worked, and shuffles', () => {
    const a = suggestWorkout({ ...base, sessions: [], options: { focus: 'legs', seed: 0 } });
    expect(a.stretches.length).toBeGreaterThan(0);
    for (const n of a.stretches) expect(library.find((l) => l.name === n).category).toBe('stretching');
    const names = (seed) => suggestWorkout({ ...base, sessions: [], options: { focus: 'legs', seed } }).exercises.map((e) => e.name).join('|');
    expect(new Set([0, 1, 2, 3].map(names)).size).toBeGreaterThan(1);
    expect(names(2)).toBe(names(2));
  });
  it('suggests your usual activities for a non-gym day', () => {
    const activities = [1, 2, 3].map((n) => ({ ...newActivity(`2026-11-0${n}`), type: 'pickleball', duration_min: 60 }));
    const s = suggestWorkout({ ...base, sessions: [], activities });
    expect(s.ideas[0]).toMatchObject({ type: 'pickleball', minutes: 60 });
  });
  it('becomes a routine with the right number of sets', () => {
    const s = suggestWorkout({ ...base, sessions: [], options: { focus: 'pull' } });
    const r = suggestionAsRoutine(s);
    expect(r.exercises[0].sets).toHaveLength(s.exercises[0].sets);
  });
});

describe('new activity types', () => {
  it('knows baseball, softball, table tennis and stretching', () => {
    expect(['baseball', 'softball', 'table_tennis', 'pickleball', 'stretching'].map(typeLabel)).toEqual(['Baseball', 'Softball', 'Table tennis', 'Pickleball', 'Stretching / mobility']);
    expect(activitySummary({ type: 'stretching', duration_min: 15, stretches: ['Cat Stretch', 'Child\'s Pose'] }, 'lb')).toBe('15 min · 2 stretches');
  });
});

describe('the screens', () => {
  it('suggests a workout and starts it', async () => {
    await saveGoal({ type: 'lift', exercise: 'Barbell Squat', metric: 'weight', target: 225, start_value: 200 });
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /Suggest a workout/ }));
    expect(await screen.findByText(/Barbell Squat leads/, {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^How to:/ }).length).toBeGreaterThan(3);
    await user.click(screen.getByRole('button', { name: 'Start this workout' }));
    expect(await screen.findByRole('button', { name: 'Finish' })).toBeTruthy();
    const [s] = await listSessions();
    expect(s.exercises.length).toBeGreaterThan(2);
    expect(s.notes).toMatch(/Cool-down/);
  });

  it('opens how-to with video links from a workout', async () => {
    const s = newSession();
    s.exercises = [{ id: 'e', name: 'Cat Stretch', mode: 'stretch', link: false, notes: '', sets: [{ id: 's', type: 'normal', reps: '', weight: '', done: false }] }];
    await saveSession(s);
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'How to: Cat Stretch' }));
    const link = await screen.findByRole('link', { name: 'Watch Shorts' });
    expect(link.getAttribute('href')).toContain('Cat%20Stretch%20stretch%20%23shorts');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(await screen.findByText('How to do it', {}, { timeout: 4000 })).toBeTruthy();
  });

  it('adds stretches to an activity', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /Log an activity/ }));
    await user.selectOptions(screen.getByLabelText('Activity'), 'stretching');
    await user.type(screen.getByLabelText('Minutes'), '15');
    await user.click(screen.getByRole('button', { name: '+ Add stretches' }));
    await user.type(await screen.findByLabelText('Search exercises'), 'cat stretch');
    await user.click(await screen.findByRole('button', { name: 'Cat Stretch' }));
    await user.click(screen.getByRole('button', { name: /^Add 1 exercise/ }));
    expect(await screen.findByText('Cat Stretch')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Save activity' }));
    const { listActivities } = await import('../src/db');
    await screen.findByRole('button', { name: 'Start workout' });
    expect((await listActivities())[0]).toMatchObject({ type: 'stretching', stretches: ['Cat Stretch'] });
  });
});
