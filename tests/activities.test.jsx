import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import { buildExport, importFile } from '../src/backup';
import {
  clearLocalData, db, deletePlace, listActivities, listGoals, listPlaces, listSessions, newActivity, newSession, renamePlace, saveActivity,
  saveGoal, savePlace, saveSession,
} from '../src/db';
import { activityAsSession, bestEfforts, byType, distanceIn, distanceOut, paceText, totals, weeklyMinutes } from '../src/activities';
import { activeWeekStreaks } from '../src/analytics';
import { weekStartOf, goalStatus } from '../src/goals';
import { setPrefs } from '../src/prefs';

beforeEach(async () => {
  await clearLocalData();
  localStorage.clear();
  setPrefs({ restEnabled: false, alerts: false, keepAwake: false });
});
afterEach(cleanup);

const run = (over = {}) => ({ ...newActivity('2026-11-02'), type: 'run', duration_min: 45, distance_km: 8.04672, ...over });
const asFile = (obj) => new File([JSON.stringify(obj)], 'x.json', { type: 'application/json' });

describe('activity math', () => {
  it('converts distance both ways and works out pace and speed', () => {
    expect(distanceOut(8.04672, 'lb')).toBe(5);
    expect(distanceOut(8, 'kg')).toBe(8);
    expect(distanceIn(5, 'lb')).toBeCloseTo(8.04672, 4);
    expect(paceText({ type: 'run', duration_min: 45, distance_km: 8.04672 }, 'lb')).toBe('9:00 /mi');
    expect(paceText({ type: 'cycle', duration_min: 60, distance_km: 32.18688 }, 'lb')).toBe('20 mph');
    expect(paceText({ type: 'soccer', duration_min: 60, distance_km: 5 }, 'lb')).toBe('');
    expect(paceText({ type: 'run', duration_min: 30, distance_km: null }, 'lb')).toBe('');
  });
  it('summarises totals, types, best efforts and weekly minutes', () => {
    const list = [run(), run({ date: '2026-11-03', duration_min: 40 }), run({ date: '2026-10-20', type: 'soccer', distance_km: null, duration_min: 60 })];
    expect(totals(list)).toMatchObject({ count: 3, minutes: 145 });
    expect(byType(list)[0]).toMatchObject({ type: 'run', count: 2 });
    expect(bestEfforts(list)).toHaveLength(1);
    expect(bestEfforts(list)[0].activity.date).toBe('2026-11-03');
    const weeks = weeklyMinutes(list, weekStartOf, 1, 3, '2026-11-04');
    expect(weeks.map((w) => w.minutes)).toEqual([60, 0, 85]);
  });
  it('counts as a workout for streaks and weekly goals but leaves records alone', () => {
    const pseudo = activityAsSession(run({ date: '2026-11-02' }));
    expect(pseudo.exercises[0].sets).toEqual([]);
    expect(activeWeekStreaks([pseudo], 1, '2026-11-04').current).toBe(1);
    const goal = { type: 'weekly_workouts', target: 2 };
    const st = goalStatus(goal, { sessions: [], workouts: [pseudo], entries: [], weekStart: 1, latestKg: null, todayStr: '2026-11-04' });
    expect(st.done).toBe(1);
  });
});

describe('saving activities', () => {
  it('rejects bad input with a friendly message', async () => {
    await expect(saveActivity(run({ duration_min: 0 }))).rejects.toThrow(/how long/);
    await expect(saveActivity(run({ distance_km: -2 }))).rejects.toThrow(/distance/);
    await expect(saveActivity(run({ effort: 11 }))).rejects.toThrow(/Effort/);
  });
  it('stores, edits and soft-deletes', async () => {
    const a = await saveActivity(run({ title: '  Loop ' }));
    expect(a).toMatchObject({ title: 'Loop', dirty: 1 });
    expect(await listActivities()).toHaveLength(1);
    await saveActivity({ ...a, duration_min: 50 });
    expect((await listActivities())[0].duration_min).toBe(50);
    await db.activities.update(a.id, { deleted_at: new Date().toISOString() });
    expect(await listActivities()).toHaveLength(0);
  });
});

describe('places', () => {
  it('dedupes by name, renames, deletes, and remembers the last one used', async () => {
    const a = await savePlace('  Planet   Fitness ');
    expect(a.name).toBe('Planet Fitness');
    expect((await savePlace('planet fitness')).id).toBe(a.id);
    const b = await savePlace('Riverside Park');
    await expect(renamePlace(b.id, 'PLANET fitness')).rejects.toThrow(/already/);
    await renamePlace(b.id, 'River Park');
    expect((await listPlaces()).map((p) => p.name)).toEqual(['Planet Fitness', 'River Park']);
    await saveActivity(run({ place_id: b.id }));
    expect(newSession().place_id).toBe(b.id);
    await deletePlace(b.id);
    expect(await listPlaces()).toHaveLength(1);
    await expect(savePlace('   ')).rejects.toThrow();
  });
  it('keeps notes on goals', async () => {
    await saveGoal({ type: 'weekly_workouts', target: 3, notes: 'Summer plan' });
    expect((await listGoals())[0].notes).toBe('Summer plan');
  });
});

describe('backup v5', () => {
  it('round-trips places, activities, session places and goal notes without duplicating', async () => {
    const p = await savePlace('Gym A');
    await saveActivity(run({ place_id: p.id, notes: 'Windy' }));
    const s = newSession({ finished: true });
    s.exercises = [{ id: 'e1', name: 'Squat', link: false, notes: '', sets: [{ id: 's1', reps: 5, weight: 100, type: 'normal', done: true }] }];
    s.place_id = p.id;
    s.notes = 'Felt strong';
    await saveSession(s);
    await saveGoal({ type: 'weekly_workouts', target: 2, notes: 'N' });
    const exp = await buildExport();
    expect(exp.version).toBe(5);
    expect(exp.places).toHaveLength(1);
    expect(exp.activities).toHaveLength(1);
    expect(exp.sessions[0]).toMatchObject({ place_id: p.id, notes: 'Felt strong' });

    await clearLocalData();
    expect(await importFile(asFile(exp))).toMatchObject({ places: 1, activities: 1, added: 1, goals: 1 });
    expect(await listActivities()).toHaveLength(1);
    expect((await listSessions())[0].place_id).toBe(p.id);
    const again = await importFile(asFile(exp));
    expect(again).toMatchObject({ places: 0, activities: 0, added: 0 });
  });
  it('points imported items at a place you already have with the same name', async () => {
    const mine = await savePlace('Gym A');
    const exp = {
      app: 'repwise', version: 5,
      places: [{ id: '11111111-1111-4111-8111-111111111111', name: 'gym a' }],
      activities: [{ id: '22222222-2222-4222-8222-222222222222', date: '2026-11-01', type: 'run', title: '', duration_min: 30, distance_km: null, effort: null, place_id: '11111111-1111-4111-8111-111111111111', notes: '' }],
    };
    const r = await importFile(asFile(exp));
    expect(r.activities).toBe(1);
    expect((await listActivities())[0].place_id).toBe(mine.id);
    expect(await listPlaces()).toHaveLength(1);
  });
  it('ignores malformed activities', async () => {
    const r = await importFile(asFile({ app: 'repwise', version: 5, activities: [{ id: 'nope' }, { id: '22222222-2222-4222-8222-222222222222', date: 'x', type: 'run', duration_min: 5 }] }));
    expect(r.activities).toBe(0);
    expect(r.invalid).toBe(2);
  });
});

describe('the screens', () => {
  it('logs an activity from the home screen, then shows it in history and the home count', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Log', exact: true }));
    await user.click(await screen.findByRole('button', { name: /^A run, walk or sport/ }));
    await user.selectOptions(screen.getByLabelText('Activity'), 'cycle');
    await user.type(screen.getByLabelText('Minutes'), '30');
    await user.type(screen.getByLabelText(/^Distance/), '10');
    await user.selectOptions(screen.getByLabelText('Place'), '__new__');
    await user.type(screen.getByLabelText('New place name'), 'Lakeside Trail');
    await user.click(screen.getByRole('button', { name: 'Add place' }));
    await user.type(screen.getByLabelText('Notes'), 'Headwind home');
    await user.click(screen.getByRole('button', { name: 'Save activity' }));

    expect(await screen.findByRole('button', { name: /^Last: Cycling/ })).toBeTruthy();
    const [a] = await listActivities();
    expect(a).toMatchObject({ type: 'cycle', duration_min: 30, notes: 'Headwind home' });
    expect(a.distance_km).toBeCloseTo(16.09, 1);
    expect((await listPlaces())[0].id).toBe(a.place_id);

    await user.click(screen.getByRole('button', { name: 'History' }));
    const card = await screen.findByRole('button', { name: /Cycling/ });
    expect(within(card).getByText(/Lakeside Trail/)).toBeTruthy();
    await user.type(screen.getByRole('searchbox'), 'headwind');
    expect(await screen.findByRole('button', { name: /Cycling/ })).toBeTruthy();
  });

  it('shows the Activity stats and manages places in Settings', async () => {
    await saveActivity(run());
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Progress' }));
    await user.click(await screen.findByRole('tab', { name: 'Activity' }));
    expect(await screen.findByText('Best efforts')).toBeTruthy();
    expect(screen.getAllByText(/9:00 \/mi/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.type(await screen.findByLabelText('Add a place'), 'Home gym');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Home gym')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Rename Home gym' }));
    const input = screen.getByLabelText('Place name');
    await user.clear(input);
    await user.type(input, 'Garage');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Garage')).toBeTruthy();
  });

  it('keeps notes and a place on a workout', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Start workout' }));
    await user.click(await screen.findByRole('button', { name: /^Empty workout/ }));
    await user.click(await screen.findByText('Place and notes'));
    await user.type(screen.getByLabelText('Workout notes'), 'Shoulder tight');
    await user.selectOptions(screen.getByLabelText('Place'), '__new__');
    await user.type(screen.getByLabelText('New place name'), 'Planet Fitness');
    await user.click(screen.getByRole('button', { name: 'Add place' }));
    await new Promise((r) => setTimeout(r, 600));
    const [s] = await listSessions();
    expect(s.notes).toBe('Shoulder tight');
    expect((await listPlaces())[0].id).toBe(s.place_id);
  });
});
