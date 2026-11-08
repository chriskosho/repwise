import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import Review, { ReviewCard } from '../src/components/Review';
import { buildPlan } from '../src/plan';
import { clearLocalData, saveBodyEntry } from '../src/db';
import { defaultWhich, reviewPeriod, showReviewCard, weekStartOf, weeklyReview } from '../src/review';

const sess = (date, name, sets, id = crypto.randomUUID(), started = '10:00') => ({
  id, date, name: 'W', started_at: `${date}T${started}:00Z`, ended_at: `${date}T11:00:00Z`, deleted_at: null,
  exercises: [{ id: id + 'e', name, mode: 'weight', sets: sets.map(([weight, reps]) => ({ id: crypto.randomUUID(), weight, reps, type: 'normal', done: true })) }],
});
const act = (date, type = 'run', min = 30, km = 5) => ({ id: crypto.randomUUID(), date, type, duration_min: min, distance_km: km, deleted_at: null });

beforeEach(clearLocalData);
afterEach(cleanup);

describe('review periods', () => {
  it('picks the week to look back on', () => {
    expect(weekStartOf('2026-11-08', 1)).toBe('2026-11-02'); // Sunday belongs to the week starting Monday 2nd
    expect(defaultWhich('2026-11-08', 1)).toBe('this'); // last day of the week
    expect(defaultWhich('2026-11-10', 1)).toBe('last');
    expect(reviewPeriod('2026-11-10', 1)).toMatchObject({ start: '2026-11-02', end: '2026-11-08' });
    expect(reviewPeriod('2026-11-08', 1)).toMatchObject({ start: '2026-11-02', end: '2026-11-08' });
    expect(reviewPeriod('2026-11-08', 0, 'last')).toMatchObject({ start: '2026-11-01', end: '2026-11-07' });
    expect(showReviewCard('2026-11-08', 1)).toBe(true);
    expect(showReviewCard('2026-11-09', 1)).toBe(true);
    expect(showReviewCard('2026-11-11', 1)).toBe(false);
  });
});

describe('weekly review numbers', () => {
  const sessions = [
    sess('2026-10-28', 'Bench', [[100, 5]], 'a'),
    sess('2026-11-02', 'Bench', [[100, 5], [105, 5]], 'b'),
    sess('2026-11-04', 'Bench', [[110, 5]], 'c'),
  ];
  const r = weeklyReview({ sessions, activities: [act('2026-11-03')], entries: [], start: '2026-11-02', end: '2026-11-08' });
  it('counts days, minutes, volume and the change from the week before', () => {
    expect(r.days).toBe(3);
    expect(r.prevDays).toBe(1);
    expect(r.strength).toBe(2);
    expect(r.activities).toBe(1);
    expect(r.volume).toBe(100 * 5 + 105 * 5 + 110 * 5);
    expect(r.volumeChange).toBe(Math.round(((1575 - 500) / 500) * 100));
    expect(r.km).toBeCloseTo(5, 5);
    expect(r.headline).toMatch(/records|3 workout days/);
  });
  it('finds records set during the week', () => {
    expect(r.prs.map((p) => p.date)).toEqual(['2026-11-02', '2026-11-04']);
    expect(r.prs.every((p) => p.name === 'Bench')).toBe(true);
  });
  it('compares with the plan and previews next week', () => {
    const plan = buildPlan({ length: 21, start: '2026-11-02', goal: 'muscle', level: 'pro', per_week: 3, minutes: 45 }); // Mon, Wed, Fri
    const p = weeklyReview({ sessions, activities: [], entries: [], plan, start: '2026-11-02', end: '2026-11-08' });
    expect(p.plan).toEqual({ planned: 3, done: 2 }); // Mon + Wed planned; Wed was Nov 4 = done; Fri missed; Mon done
    expect(p.nextWeek).toHaveLength(7);
    expect(p.nextWeek.filter((d) => d.k === 's')).toHaveLength(3);
  });
  it('reports weight change and quiet weeks', () => {
    const e = [{ date: '2026-10-30', weight_kg: 82 }, { date: '2026-11-06', weight_kg: 81.2 }];
    expect(weeklyReview({ entries: e, start: '2026-11-02', end: '2026-11-08' }).weight).toEqual({ to: 81.2, change_kg: -0.8 });
    const q = weeklyReview({ start: '2026-11-02', end: '2026-11-08' });
    expect(q.empty).toBe(true);
    expect(q.headline).toMatch(/quiet week/);
  });
});

describe('review screens', () => {
  it('renders the review with a unit-aware weight change', async () => {
    await saveBodyEntry({ date: '2026-10-30', weight_kg: 82 });
    await saveBodyEntry({ date: '2026-11-06', weight_kg: 81 });
    const sessions = [sess('2026-11-02', 'Bench', [[100, 5]])];
    render(<Review sessions={sessions} activities={[act('2026-11-03')]} plan={null} unit="lb" weekStart={1} todayStr="2026-11-08" onClose={() => {}} />);
    expect(screen.getByText('Weekly review')).toBeTruthy();
    expect(screen.getByText('workout days')).toBeTruthy();
    expect(await screen.findByText(/178\.6 lb/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'This week so far' }).getAttribute('aria-pressed')).toBe('true');
  });
  it('shows the card only when there was a workout', () => {
    const { container } = render(<ReviewCard workouts={[]} todayStr="2026-11-08" weekStart={1} onOpen={() => {}} onDismiss={() => {}} />);
    expect(container.textContent).toBe('');
    cleanup();
    render(<ReviewCard workouts={[{ date: '2026-11-03' }]} todayStr="2026-11-08" weekStart={1} onOpen={() => {}} onDismiss={() => {}} />);
    expect(screen.getByText(/1 workout day/)).toBeTruthy();
  });
});
