import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import { mainAction } from '../src/components/TodayCard';
import { clearLocalData, listSessions, newSession, saveSession } from '../src/db';

afterEach(cleanup);
beforeEach(clearLocalData);

describe('the main button', () => {
  const plan = {};
  const day = (k, extra = {}) => ({ k, n: 3, f: 'push', m: 40, t: 'run', ...extra });
  it('follows the plan: start, log, stretch or done', () => {
    expect(mainAction({ plan, progress: { status: 'active', today: day('s') } }).kind).toBe('planned');
    expect(mainAction({ plan, progress: { status: 'active', today: day('c') } }).kind).toBe('cardio');
    expect(mainAction({ plan, progress: { status: 'active', today: day('r') } }).kind).toBe('rest');
    expect(mainAction({ plan, progress: { status: 'active', today: day('s', { mv: true }) } }).kind).toBe('rest');
    expect(mainAction({ plan, progress: { status: 'active', today: day('s', { done: true }) } }).kind).toBe('done');
  });
  it('without a plan: repeat the last workout, preferring a matching routine', () => {
    const last = { name: 'Biceps', exercises: [{ name: 'Curl' }], ended_at: 'x' };
    expect(mainAction({ lastSession: last }).kind).toBe('repeat');
    expect(mainAction({ lastSession: last, routines: [{ name: 'biceps ' }] }).routine.name).toBe('biceps ');
    expect(mainAction({}).kind).toBe('new');
    expect(mainAction({ plan, progress: { status: 'finished' } }).kind).toBe('new');
  });
});

describe('home screen', () => {
  it('a new person sees one main button, one Log button, and no starter list', async () => {
    render(<App />);
    const hero = await screen.findByRole('region', { name: 'Today' });
    expect(within(hero).getAllByRole('button').map((b) => b.textContent)).toEqual(['Start workout', 'Log']);
    expect(screen.queryByText('Starter routines')).toBeNull();
    expect(screen.getByRole('button', { name: 'Browse starter routines' })).toBeTruthy();
  });
  it('starts a starter routine in two taps', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Start workout' }));
    await user.click(await screen.findByRole('button', { name: /^Bodyweight basics/ }));
    expect((await screen.findByLabelText('Workout name')).value).toBe('Bodyweight basics');
    const [s] = await listSessions();
    expect(s.exercises[0]).toMatchObject({ name: 'Pushups' });
  });
  it('repeats the last workout in one tap', async () => {
    const s = newSession({ finished: true });
    s.name = 'Arms';
    s.exercises = [{ id: 'e', name: 'Barbell Curl', link: false, notes: '', sets: [{ id: 'a', type: 'normal', weight: 50, reps: 10, done: true }] }];
    await saveSession(s);
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText(/Last time: 1 exercise, Barbell Curl/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Repeat Arms' }));
    expect(await screen.findByRole('heading', { name: 'Barbell Curl' })).toBeTruthy();
    expect((await listSessions()).filter((x) => !x.ended_at)).toHaveLength(1);
  });
  it('Log opens one sheet with every kind of log', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Log', exact: true }));
    const sheet = screen.getByRole('dialog', { name: 'Log something you did' });
    expect(within(sheet).getAllByRole('button').map((b) => b.querySelector('strong')?.textContent).filter(Boolean)).toEqual(['A past workout', 'A run, walk or sport', 'A stretch session']);
  });
});

describe('planned workout from home', () => {
  it('starts today\'s planned workout in one tap, the same one the preview shows', async () => {
    const { buildPlan, planDate } = await import('../src/plan');
    const { saveProfile, today } = await import('../src/db');
    const base = buildPlan({ length: 21, start: today(), goal: 'muscle', level: 'some', per_week: 3, minutes: 45 });
    // Make today a strength day.
    const s = base.days.find((d) => d.k === 's');
    const plan = { ...base, days: [s, ...base.days.slice(1)] };
    expect(planDate(plan, 1)).toBe(today());
    await saveProfile({ plan, onboarding: { goal: 'muscle' } });
    const user = userEvent.setup();
    render(<App />);
    const btn = await screen.findByRole('button', { name: /^Start .* workout$/ }, { timeout: 4000 });
    await screen.findByText(/^Today: /);
    await user.click(screen.getByRole('button', { name: 'Preview or change it first' }));
    await screen.findByRole('button', { name: 'Start this workout' }, { timeout: 4000 });
    const previewNames = screen.getAllByRole('button', { name: /^How to:/ }).map((b) => b.getAttribute('aria-label').replace('How to: ', ''));
    await user.click(screen.getByRole('button', { name: /Back/ }));
    await user.click(await screen.findByRole('button', { name: btn.textContent }));
    await screen.findByLabelText('Workout name');
    const [session] = await listSessions();
    expect(session.exercises.length).toBeGreaterThan(2);
    for (const e of session.exercises) expect(previewNames).toContain(e.name);
  });
});
