import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Onboarding, { heightCm } from '../src/components/Onboarding';
import PlanCard, { PlanView } from '../src/components/PlanCard';
import Tour, { TOUR } from '../src/components/Tour';
import { buildPlan, addDays } from '../src/plan';
import { clearLocalData, getProfile, listBodyEntries, listGoals, saveProfile, today } from '../src/db';

beforeEach(async () => {
  await clearLocalData();
  localStorage.clear();
});
afterEach(cleanup);

const next = (user) => user.click(screen.getByRole('button', { name: 'Next' }));

describe('welcome flow', () => {
  it('asks the questions, builds a plan and saves everything', async () => {
    const user = userEvent.setup();
    const setUnit = vi.fn();
    const onDone = vi.fn();
    render(<Onboarding unit="lb" setUnit={setUnit} onDone={onDone} />);

    await user.type(screen.getByPlaceholderText(/Name/), 'Sam');
    await user.selectOptions(screen.getByLabelText('Weight unit'), 'kg');
    await next(user);

    expect(screen.getByRole('button', { name: 'Next' }).disabled).toBe(true); // needs a goal
    await user.click(screen.getByRole('button', { name: /Lose weight/ }));
    await next(user);
    await user.click(screen.getByRole('button', { name: /New to this/ }));
    await next(user);
    await user.click(screen.getByRole('button', { name: '4' }));
    await user.click(screen.getByRole('button', { name: '30' }));
    await next(user);
    await user.click(screen.getByRole('button', { name: /Dumbbells and bands/ }));
    await user.click(screen.getByRole('button', { name: 'Swim' }));
    await next(user);
    await user.type(screen.getByLabelText(/Current weight/), '80');
    await user.type(screen.getByLabelText(/Goal weight/), '72');
    await user.type(screen.getByLabelText('Meters'), '1');
    await user.type(screen.getByLabelText('Centimeters'), '78');
    await next(user);
    // New lifters are steered to the 21-day plan
    expect(screen.getByRole('button', { name: /21 days/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Suggested')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /60 days/ }));
    await next(user);
    expect(screen.getByText(/Week 1 is deliberately easy/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Tomorrow' }));
    await user.click(screen.getByRole('button', { name: 'Create my plan' }));

    expect(await screen.findByText(/You're all set, Sam/)).toBeTruthy();
    expect(setUnit).toHaveBeenCalledWith('kg');

    const profile = await getProfile();
    expect(profile).toMatchObject({ display_name: 'Sam', units: 'kg' });
    expect(profile.onboarding).toMatchObject({ goal: 'lose', level: 'new', per_week: 4, minutes: 30, gear: 'dumbbells', cardio: ['swim'] });
    expect(profile.plan).toMatchObject({ length: 60, start: addDays(today(), 1), goal: 'lose' });
    expect(profile.plan.days.some((d) => d.k === 'c' && d.t === 'swim')).toBe(true);
    expect(profile.height_cm).toBe(178);
    expect((await listBodyEntries())[0].weight_kg).toBe(80);
    const goals = await listGoals();
    expect(goals.find((g) => g.type === 'body_weight')).toMatchObject({ target: 72, start_value: 80 });
    expect(goals.find((g) => g.type === 'weekly_workouts').target).toBe(4);

    await user.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(onDone).toHaveBeenCalled();
  });

  it('can be skipped and then stays out of the way', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<Onboarding unit="lb" setUnit={() => {}} onDone={onDone} />);
    await user.click(screen.getByRole('button', { name: 'Skip for now' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect((await getProfile()).onboarding).toEqual({ skipped: true });
    expect((await getProfile()).plan).toBeNull();
  });

  it('builds a new plan from saved answers without asking everything again', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    const saved = { goal: 'muscle', level: 'pro', per_week: 5, minutes: 60, gear: 'gym', cardio: [] };
    render(<Onboarding mode="plan" saved={saved} unit="lb" setUnit={() => {}} onDone={onDone} />);
    expect(screen.getByRole('button', { name: /60 days/ }).getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: /30 days/ }));
    await next(user);
    await user.click(screen.getByRole('button', { name: 'Start this plan' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect((await getProfile()).plan).toMatchObject({ length: 30, per_week: 5, level: 'pro' });
  });
});

describe('tour', () => {
  it('pages through every card', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<Tour onDone={onDone} />);
    for (let i = 1; i < TOUR.length; i++) await next(user);
    expect(screen.getByText(`${TOUR.length} of ${TOUR.length}`)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onDone).toHaveBeenCalled();
  });
});

describe('plan card', () => {
  const start = '2026-11-09';
  const plan = buildPlan({ length: 21, start, goal: 'muscle', level: 'some', per_week: 3, minutes: 45 });
  const show = (todayStr, workouts = [], extra = {}) => {
    const fns = { onDo: vi.fn(), onViewPlan: vi.fn(), onNewPlan: vi.fn(), onEndPlan: vi.fn(), onSuggest: vi.fn() };
    render(<PlanCard plan={plan} workouts={workouts} todayStr={todayStr} {...fns} {...extra} />);
    return fns;
  };

  it('offers today\'s workout and passes the day to the handler', async () => {
    const user = userEvent.setup();
    const fns = show(start);
    expect(screen.getByText(/Day 1 of 21/)).toBeTruthy();
    expect(screen.getByText(/Today: Full body · 45 min/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Start full body workout/ }));
    expect(fns.onDo).toHaveBeenCalledWith(expect.objectContaining({ k: 's', f: 'full', n: 1 }));
  });
  it('shows a rest day, the next workout, and a catch-up for a skipped one', async () => {
    const user = userEvent.setup();
    const fns = show('2026-11-10', [{ date: start }]);
    expect(screen.getByText(/Today: Rest day/)).toBeTruthy();
    expect(screen.getByText(/Next: Wed/)).toBeTruthy();
    cleanup();
    const f2 = show('2026-11-12', [{ date: start }]);
    expect(screen.getByText(/You skipped Wed's full body workout/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Do it today' }));
    expect(f2.onDo).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-11-11' }));
    expect(fns.onDo).not.toHaveBeenCalled();
  });
  it('celebrates today\'s workout once done and summarizes a finished plan', async () => {
    show(start, [{ date: start }]);
    expect(screen.getByText(/done ✓/)).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1');
    cleanup();
    show('2027-01-30', [{ date: start }]);
    expect(screen.getByText(/Plan complete/)).toBeTruthy();
    expect(screen.getByText(/finished 1 of 9 planned workouts \(11%\)/)).toBeTruthy();
  });
  it('lists every day in the plan view', () => {
    render(<PlanView plan={plan} workouts={[{ date: start }]} todayStr="2026-11-11" onClose={() => {}} onNewPlan={() => {}} onEndPlan={() => {}} />);
    expect(screen.getAllByRole('listitem').length).toBe(21);
    expect(screen.getByText('Week 3: Build momentum')).toBeTruthy();
    expect(within(screen.getAllByRole('listitem')[0]).getByText('✓')).toBeTruthy();
  });
});

describe('profile plan field', () => {
  it('clears a plan', async () => {
    await saveProfile({ plan: buildPlan({ length: 7, start: '2026-11-09', goal: 'health', level: 'new', per_week: 3, minutes: 30 }) });
    expect((await getProfile()).plan.length).toBe(7);
    await saveProfile({ plan: null });
    expect((await getProfile()).plan).toBeNull();
  });
});

describe('height boxes', () => {
  it('uses feet and inches for pounds, meters and centimeters for kilograms', async () => {
    expect(heightCm('lb', '5', '10')).toBe(177.8);
    expect(heightCm('lb', '6', '')).toBe(182.9);
    expect(heightCm('kg', '1', '75')).toBe(175);
    expect(heightCm('kg', '', '')).toBeNull();
    expect(heightCm('lb', '0', '5')).toBeNull();
    const user = userEvent.setup();
    render(<Onboarding unit="lb" setUnit={() => {}} onDone={() => {}} />);
    await next(user);
    await user.click(screen.getByRole('button', { name: /Build muscle/ }));
    await next(user);
    await user.click(screen.getByRole('button', { name: /Some experience/ }));
    await next(user);
    await next(user);
    await next(user);
    expect(screen.getByLabelText('Feet')).toBeTruthy();
    expect(screen.getByLabelText('Inches')).toBeTruthy();
    await user.type(screen.getByLabelText('Feet'), '5');
    await user.type(screen.getByLabelText('Inches'), '10');
    await next(user);
    await next(user);
    await user.click(screen.getByRole('button', { name: 'Create my plan' }));
    await waitFor(async () => expect((await getProfile()).height_cm).toBe(177.8));
  });
});

import { adaptPlan } from '../src/plan';
describe('plan card after adapting', () => {
  it('shows what changed and where a moved workout went', () => {
    const start = '2026-11-09';
    const plan = buildPlan({ length: 28, start, goal: 'muscle', level: 'pro', per_week: 3, minutes: 45 });
    const fri = '2026-11-13';
    const adapted = adaptPlan(plan, [{ date: start }], fri).plan;
    render(<PlanCard plan={adapted} workouts={[{ date: start }]} todayStr={fri} onDo={() => {}} onViewPlan={() => {}} onNewPlan={() => {}} onEndPlan={() => {}} onSuggest={() => {}} />);
    expect(screen.getByText(/Plan update: You missed Wed/)).toBeTruthy();
    cleanup();
    render(<PlanView plan={adapted} workouts={[{ date: start }]} todayStr={fri} onClose={() => {}} onNewPlan={() => {}} onEndPlan={() => {}} />);
    expect(screen.getByText('Moved')).toBeTruthy();
    expect(screen.getByText(/Moved from Wed/)).toBeTruthy();
  });
});
