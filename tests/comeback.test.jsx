import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import { addDays, adaptPlan, buildPlan, cleanPlan, planDate, planNote, planProgress, resumePlan, welcomeBack } from '../src/plan';
import { compareWithLast, nextPlanned, topSet, weekCount } from '../src/recap';
import { clearLocalData, getProfile, listActivities, newSession, saveProfile, saveSession, today } from '../src/db';

afterEach(async () => {
  cleanup();
  await new Promise((r) => setTimeout(r, 150));
});
beforeEach(clearLocalData);

const START = '2026-11-02'; // a Monday
const plan30 = () => buildPlan({ length: 30, start: START, goal: 'muscle', level: 'some', per_week: 3, minutes: 45 });

describe('one plan note on home', () => {
  it('merges recent changes into one neutral sentence', () => {
    const plan = {
      ...plan30(),
      log: [
        { k: 'miss:2026-11-04', d: '2026-11-10', t: 'Wed’s workout moved to Fri.', x: 'Wed’s workout moved to Fri' },
        { k: 'week:2', d: '2026-11-10', t: 'This week is a little lighter.', x: 'this week is a little lighter' },
        { k: 'boost:2', d: '2026-11-10', t: 'Strong week.', x: 'your first lifts get an extra set' },
      ],
    };
    const note = planNote(plan, '2026-11-10');
    expect(note).toBe('Plan update: This week is a little lighter and Wed’s workout moved to Fri, plus 1 more change.');
    expect(note).not.toMatch(/missed|tough/i);
    expect(planNote({ ...plan, log: [] }, '2026-11-10')).toBeNull();
  });
  it('rewords notes saved by older versions', () => {
    const plan = {
      ...plan30(),
      log: [
        { k: 'miss:2026-11-04', d: '2026-11-10', t: "You missed Wed's full body workout, so it moved to Fri." },
        { k: 'week:2', d: '2026-11-10', t: 'Last week was tough (0 of 3 workouts), so this week is lighter.' },
      ],
    };
    expect(planNote(plan, '2026-11-10')).toBe('Plan update: This week is a little lighter and a workout moved to Fri.');
  });
  it('writes new notes without blame', () => {
    const plan = plan30();
    const r = adaptPlan(plan, [{ date: START }], '2026-11-10');
    for (const e of r.plan.log ?? []) expect(e.t).not.toMatch(/missed|tough/i);
  });
});

describe('welcome back after a break', () => {
  const plan = plan30();
  const workouts = [{ date: START }, { date: '2026-11-04' }];
  it('appears after 7 or more days away, during an active plan', () => {
    expect(welcomeBack(plan, workouts, '2026-11-10')).toBeNull(); // 6 days
    expect(welcomeBack(plan, workouts, '2026-11-11')).toEqual({ away: 7, lastDate: '2026-11-04' });
    expect(welcomeBack({ ...plan, ack: '2026-11-04' }, workouts, '2026-11-14')).toBeNull();
    expect(welcomeBack(plan, [...workouts, { date: '2026-11-13' }], '2026-11-14')).toBeNull();
    expect(welcomeBack({ ...plan, ended_at: 'x' }, workouts, '2026-11-14')).toBeNull();
  });
  it('counts from the day before the plan when nothing is logged yet', () => {
    expect(welcomeBack(plan, [], '2026-11-08')).toEqual({ away: 7, lastDate: '2026-11-01' });
  });
});

describe('resume from today', () => {
  const todayStr = '2026-11-16';
  const workouts = [{ date: START }, { date: '2026-11-04' }];
  const plan = plan30();
  const r = resumePlan(plan, workouts, todayStr);

  it('keeps completed days where they were', () => {
    const p = planProgress(r, workouts, todayStr);
    expect(r.start).toBe(START);
    expect(p.days.filter((d) => d.done).map((d) => d.date)).toEqual([START, '2026-11-04']);
    expect(r.days.slice(0, 3)).toEqual(plan.days.slice(0, 3));
  });
  it('turns the time away into rest and starts the rest of the plan today, at the next workout', () => {
    const keep = 3; // Mon to Wed
    const gap = 16 - 5; // Thu Nov 5 up to Sun Nov 15
    const from = plan.days.findIndex((d, i) => i >= keep && d.k !== 'r'); // Thursday was rest, so Friday's workout is next
    expect(from).toBe(4);
    expect(r.length).toBe(keep + gap + plan.length - from);
    for (let i = keep; i < keep + gap; i++) expect(r.days[i]).toMatchObject({ k: 'r', adj: 'Time away' });
    // The next workout of the old plan is today, and everything after follows in order.
    expect(planDate(r, keep + gap + 1)).toBe(todayStr);
    expect(r.days[keep + gap].k).toBe('s');
    const rest = r.days.slice(keep + gap).map(({ ease, ...d }) => d);
    expect(rest).toEqual(plan.days.slice(from).map(({ ease, adj, ...d }) => d));
  });
  it('makes the first workout back an easy one and remembers the answer', () => {
    const firstStrength = r.days.findIndex((d, i) => d.k === 's' && planDate(r, i + 1) >= todayStr);
    expect(r.days[firstStrength].ease).toBe(true);
    expect(welcomeBack(r, workouts, todayStr)).toBeNull();
    expect(planNote(r, todayStr)).toBe('Plan update: Your plan picks up from today with an easy workout.');
  });
  it('survives validation for the profile and backups', () => {
    const c = cleanPlan(r);
    expect(c).not.toBeNull();
    expect(c.length).toBe(r.length);
    expect(c.ack).toBe('2026-11-04');
    expect(c.days[3]).toMatchObject({ k: 'r', adj: 'Time away' });
  });
  it('simply starts today when nothing was done yet', () => {
    const fresh = resumePlan(plan, [], todayStr);
    expect(fresh.start).toBe(todayStr);
    expect(fresh.length).toBe(plan.length);
    expect(planProgress(fresh, [], todayStr).dayNumber).toBe(1);
  });
  it('is the plan the app shows on home', async () => {
    const user = userEvent.setup();
    const t = today();
    const p = buildPlan({ length: 30, start: addDays(t, -12), goal: 'muscle', level: 'some', per_week: 3, minutes: 45 });
    await saveProfile({ onboarding: { goal: 'muscle', level: 'some' }, plan: p });
    const s = newSession({ finished: true });
    s.date = addDays(t, -12);
    s.name = 'Full body';
    s.exercises = [{ id: 'e', name: 'Leg Press', link: false, notes: '', sets: [{ id: 'a', type: 'normal', weight: 100, reps: 10, done: true }] }];
    await saveSession(s);
    render(<App />);
    const hero = await screen.findByRole('region', { name: 'Today' }, { timeout: 4000 });
    expect(within(hero).getByRole('heading', { name: 'Welcome back' })).toBeTruthy();
    expect(within(hero).getByText(/It's been 12 days/)).toBeTruthy();
    await user.click(within(hero).getByRole('button', { name: 'Resume from today' }));
    await waitFor(async () => expect((await getProfile()).plan.ack).toBe(addDays(t, -12)));
    const saved = (await getProfile()).plan;
    expect(planProgress(saved, [{ date: s.date }], t).today).toBeTruthy();
    expect(await screen.findByText(/picks up from today/)).toBeTruthy();
  });
  it('can be waved off with "Carry on as is"', async () => {
    const user = userEvent.setup();
    const t = today();
    await saveProfile({ onboarding: { goal: 'muscle', level: 'some' }, plan: buildPlan({ length: 30, start: addDays(t, -9), goal: 'muscle', level: 'some', per_week: 3, minutes: 45 }) });
    render(<App />);
    const hero = await screen.findByRole('region', { name: 'Today' }, { timeout: 4000 });
    await user.click(within(hero).getByRole('button', { name: 'Carry on as is' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Welcome back' })).toBeNull());
    expect((await getProfile()).plan.start).toBe(addDays(t, -9));
  });
});

describe('after a workout', () => {
  const set = (weight, reps) => ({ id: `${weight}-${reps}`, type: 'normal', weight, reps, done: true });
  const prev = { id: 'p', name: 'Push day', date: '2026-11-03', started_at: '2026-11-03T10:00', ended_at: 'x', exercises: [{ name: 'Barbell Bench Press - Medium Grip', sets: [set(135, 8), set(135, 7)] }, { name: 'Triceps Pushdown', sets: [set(50, 12)] }] };
  const now = { id: 'n', name: 'push day', date: '2026-11-10', started_at: '2026-11-10T10:00', ended_at: 'x', exercises: [{ name: 'Barbell Bench Press - Medium Grip', sets: [set(140, 8), set(140, 8)] }, { name: 'Triceps Pushdown', sets: [set(50, 12)] }] };

  it('finds the top set', () => {
    expect(topSet({ sets: [set(100, 5), set(110, 3), set(110, 4), { ...set(200, 1), type: 'warmup' }] })).toEqual({ weight: 110, reps: 4 });
    expect(topSet({ sets: [] })).toBeNull();
  });
  it('compares with the last session of the same name', () => {
    const c = compareWithLast(now, [prev, now, { ...prev, id: 'old', date: '2026-10-01', started_at: '' }]);
    expect(c.prev.id).toBe('p');
    expect(c.volume.change).toBe(Math.round(((2240 + 600 - (2025 + 600)) / (2025 + 600)) * 100));
    expect(c.tops[0]).toMatchObject({ name: 'Barbell Bench Press - Medium Grip', before: { weight: 135, reps: 8 }, after: { weight: 140, reps: 8 }, dir: 'up' });
    expect(c.tops[1].dir).toBe('same');
    expect(compareWithLast({ ...now, name: 'Leg day' }, [prev])).toBeNull();
  });
  it('counts the week against the plan, a goal, or nothing', () => {
    const plan = plan30(); // 3 lifting days a week from Monday Nov 2
    const workouts = [{ date: '2026-11-09' }, { date: '2026-11-11' }, { date: '2026-11-11' }];
    expect(weekCount({ plan, workouts, todayStr: '2026-11-11' })).toEqual({ done: 2, target: 3, of: 'plan' });
    expect(weekCount({ workouts, goals: [{ type: 'weekly_workouts', target: 4 }], todayStr: '2026-11-11' })).toEqual({ done: 2, target: 4, of: 'goal' });
    expect(weekCount({ workouts, todayStr: '2026-11-11', extraDate: '2026-11-12' })).toEqual({ done: 3, target: null, of: null });
  });
  it('names the next planned workout', () => {
    const plan = plan30();
    const n = nextPlanned(plan, [{ date: '2026-11-09' }], '2026-11-09');
    expect(n.date > '2026-11-09').toBe(true);
    expect(nextPlanned({ ...plan, ended_at: 'x' }, [], '2026-11-09')).toBeNull();
  });
  it('shows it all on the summary screen', async () => {
    const user = userEvent.setup();
    const t = today();
    const before = newSession({ finished: true });
    Object.assign(before, { name: 'Push day', date: addDays(t, -2), started_at: `${addDays(t, -2)}T10:00:00.000Z`, exercises: [{ id: 'b', name: 'Barbell Bench Press - Medium Grip', link: false, notes: '', sets: [set(135, 8)] }] });
    await saveSession(before);
    const s = newSession();
    Object.assign(s, { name: 'Push day', exercises: [{ id: 'c', name: 'Barbell Bench Press - Medium Grip', link: false, notes: '', sets: [set(140, 8)] }] });
    await saveSession(s);
    render(<App />);
    await screen.findByRole('heading', { name: 'Bench press' }, { timeout: 4000 });
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByText('Workout complete')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Compared with last time' })).toBeTruthy();
    expect(screen.getByText('135 lb × 8 → 140 lb × 8')).toBeTruthy();
    expect(screen.getByText(/volume up 4%/)).toBeTruthy();
    expect(screen.getByText(/This week:/)).toBeTruthy();
  });
});

describe('one-tap activity log', () => {
  it('saves the planned walk in one tap, then offers details', async () => {
    const user = userEvent.setup();
    const t = today();
    const base = buildPlan({ length: 7, start: t, goal: 'health', level: 'new', per_week: 3, minutes: 30 });
    base.days[0] = { k: 'c', m: 30, t: 'walk' };
    await saveProfile({ onboarding: { goal: 'health', level: 'new' }, plan: base });
    render(<App />);
    const hero = await screen.findByRole('region', { name: 'Today' }, { timeout: 4000 });
    expect(within(hero).getByRole('button', { name: 'Add details' })).toBeTruthy();
    await user.click(within(hero).getByRole('button', { name: 'Log walk · 30 min' }));
    await waitFor(async () => expect((await listActivities()).map((a) => [a.type, a.duration_min, a.date])).toEqual([['walk', 30, t]]));
    expect(await within(hero).findByText(/Walk · 30 min logged/)).toBeTruthy();
    expect(within(hero).getByRole('heading', { name: 'Today: done' })).toBeTruthy();
    await user.click(within(hero).getByRole('button', { name: 'Add details' }));
    expect(await screen.findByRole('button', { name: /Save activity|Save changes/ })).toBeTruthy();
  });
});
