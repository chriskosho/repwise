import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import Settings from '../src/components/Settings';
import { progressHint } from '../src/suggest';
import { nextWeekAdvice, weeklyReview } from '../src/review';
import { addDays, buildPlan, phaseOf, resumePlan } from '../src/plan';
import { clearLocalData, getProfile, newSession, saveProfile, saveSession, today } from '../src/db';

afterEach(async () => {
  cleanup();
  await new Promise((r) => setTimeout(r, 150));
});
beforeEach(clearLocalData);

const set = (weight, reps) => ({ id: `${weight}-${reps}-${Math.random()}`, type: 'normal', weight, reps, done: true });
const session = (date, name, sets, extra = {}) => ({ id: `${date}-${name}`, name: 'Workout', date, started_at: `${date}T10:00`, ended_at: 'x', exercises: [{ name, sets }], ...extra });

describe('progress hints on the workout screen', () => {
  it('says what to try next, or nothing without history', () => {
    expect(progressHint('Barbell Curl', [])).toBeNull();
    expect(progressHint('Barbell Curl', [session('2026-11-01', 'Barbell Curl', [set(100, 12), set(100, 12)])]).text).toBe('Try 105 lb');
    expect(progressHint('Barbell Curl', [session('2026-11-01', 'Barbell Curl', [set(100, 10)])]).text).toBe('Repeat and add a rep');
    expect(progressHint('Barbell Curl', [session('2026-11-01', 'Barbell Curl', [set(100, 6)])]).text).toBe('Try 95 lb, a little lighter');
    const stall = [session('2026-11-05', 'Barbell Curl', [set(100, 9)]), session('2026-11-03', 'Barbell Curl', [set(100, 9)]), session('2026-11-01', 'Barbell Curl', [set(100, 9)])];
    expect(progressHint('Barbell Curl', stall).text).toBe('Stalled for 3 sessions: drop 10% and rebuild');
    // Stuck at the top of the rep range: add weight rather than back off.
    const top = stall.map((x) => ({ ...x, exercises: [{ name: 'Barbell Curl', sets: [set(100, 12)] }] }));
    expect(progressHint('Barbell Curl', top).text).toBe('Try 105 lb');
    expect(progressHint('Barbell Curl', [session('2026-11-01', 'Barbell Curl', [set(20, 12)])], { unit: 'kg' }).text).toBe('Try 22.5 kg');
  });
  it('shows one line per weighted exercise with history', async () => {
    await saveSession({ ...newSession({ finished: true }), name: 'Arms', date: addDays(today(), -2), started_at: `${addDays(today(), -2)}T10:00:00Z`, exercises: [{ id: 'a', name: 'Barbell Curl', link: false, notes: '', sets: [set(60, 12), set(60, 12)] }] });
    const s = newSession();
    s.name = 'Arms';
    s.exercises = [
      { id: 'b', name: 'Barbell Curl', link: false, notes: '', sets: [{ id: 'x', type: 'normal', weight: '', reps: '', done: false }] },
      { id: 'c', name: 'Triceps Pushdown', link: false, notes: '', sets: [{ id: 'y', type: 'normal', weight: '', reps: '', done: false }] },
    ];
    await saveSession(s);
    render(<App />);
    expect(await screen.findByText('Try 65 lb', {}, { timeout: 4000 })).toBeTruthy();
    expect(document.querySelectorAll('.ex-hint')).toHaveLength(1); // no history for pushdowns, so no hint
  });
});

describe('advice for next week', () => {
  const end = '2026-11-08'; // a Sunday
  it('nudges after a quiet week', () => {
    expect(nextWeekAdvice({ days: 0, end }).kind).toBe('low');
    expect(nextWeekAdvice({ days: 1, plannedDays: 3, end }).text).toMatch(/Only 1 workout day/);
  });
  it('calls for rest after a long streak', () => {
    const finished = [0, 1, 2, 3, 4].map((i) => session(addDays(end, -i), 'Leg Press', [set(100, 10)]));
    const a = nextWeekAdvice({ finished, days: 5, end });
    expect(a.kind).toBe('streak');
    expect(a.text).toMatch(/^5 training days in a row/);
  });
  it('spots a stalled lift by its everyday name', () => {
    const finished = ['2026-11-07', '2026-11-04', '2026-11-01'].map((d) => session(d, 'Barbell Bench Press - Medium Grip', [set(135, 8)]));
    const a = nextWeekAdvice({ finished, days: 2, end });
    expect(a.kind).toBe('stalled');
    expect(a.text).toMatch(/^Bench press hasn't moved in 3 sessions/);
  });
  it('notices a part of the body left out', () => {
    const finished = [session('2026-11-07', 'Barbell Bench Press - Medium Grip', [set(135, 8)]), session('2026-11-05', 'Wide-Grip Lat Pulldown', [set(100, 10)]), session('2026-11-02', 'Seated Cable Rows', [set(90, 10)])];
    const a = nextWeekAdvice({ finished, days: 3, end });
    expect(a).toEqual({ kind: 'neglected', text: 'No legs work in the last two weeks. Make one session next week a legs day.' });
  });
  it('otherwise keeps it steady, and is part of the weekly review', () => {
    const sessions = [session('2026-11-06', 'Leg Press', [set(100, 10)]), session('2026-11-04', 'Barbell Bench Press - Medium Grip', [set(100, 10)]), session('2026-11-02', 'Wide-Grip Lat Pulldown', [set(100, 10)])];
    const r = weeklyReview({ sessions, start: '2026-11-02', end });
    expect(r.advice.kind).toBe('steady');
  });
});

describe('the activities you enjoy, in Settings', () => {
  it('can be picked there now that onboarding skips them', async () => {
    const user = userEvent.setup();
    await saveProfile({ onboarding: { goal: 'health', level: 'new' } });
    render(<Settings sync={{ session: null, status: 'idle' }} unit="lb" setUnit={() => {}} onExported={() => {}} />);
    const group = await screen.findByRole('group', { name: 'Activities you enjoy' });
    await user.click(within(group).getByRole('button', { name: 'Pickleball' }));
    await waitFor(async () => expect((await getProfile()).onboarding).toMatchObject({ goal: 'health', interests: ['pickleball'] }));
  });
});

describe('week labels in a resumed plan', () => {
  it('one easy comeback workout does not make a "lighter week"', () => {
    const plan = buildPlan({ length: 30, start: '2026-11-02', goal: 'muscle', level: 'some', per_week: 3, minutes: 45 });
    const r = resumePlan(plan, [{ date: '2026-11-02' }], '2026-11-12');
    const week = Math.floor(r.days.findIndex((d) => d.ease) / 7) + 1;
    expect(phaseOf(r, week)).not.toBe('Lighter week to recover');
    expect(phaseOf(plan, 4)).toBe('Lighter week to recover'); // a real lighter week still says so
  });
});
