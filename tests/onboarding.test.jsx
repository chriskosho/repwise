import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Onboarding, { heightCm } from '../src/components/Onboarding';
import PlanCard, { PlanView } from '../src/components/PlanCard';
import Coach from '../src/components/Coach';
import { buildPlan, addDays, suggestGoal } from '../src/plan';
import { clearLocalData, getProfile, listBodyEntries, listGoals, saveProfile, today } from '../src/db';

beforeEach(async () => {
  await clearLocalData();
  localStorage.clear();
});
afterEach(cleanup);

const next = (user) => user.click(screen.getByRole('button', { name: 'Next' }));

describe('welcome flow', () => {
  it('asks five short steps, suggests a goal, builds a plan and saves it', async () => {
    const user = userEvent.setup();
    const setUnit = vi.fn();
    const onDone = vi.fn();
    render(<Onboarding unit="lb" setUnit={setUnit} onDone={onDone} />);
    expect(screen.getByText('Step 1 of 5')).toBeTruthy();

    await user.type(screen.getByPlaceholderText(/Name/), 'Sam');
    await user.selectOptions(screen.getByLabelText('Weight unit'), 'kg');
    await next(user);

    // Goal discovery: three plain questions, each moves on when tapped.
    expect(screen.getByText('Step 2 of 5')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    await user.click(screen.getByRole('button', { name: /Lose some weight/ }));
    await user.click(screen.getByRole('button', { name: /Little or none/ }));
    await user.click(screen.getByRole('button', { name: /Not really/ }));
    expect(screen.getByRole('heading', { name: 'Your goal: Lose weight' })).toBeTruthy();
    expect(screen.getByText(/cardio isn’t your favorite/)).toBeTruthy();
    // It can be overridden.
    await user.click(screen.getByRole('button', { name: 'Pick a different goal' }));
    await user.click(screen.getByRole('button', { name: /Feel healthier/ }));
    expect(screen.getByRole('heading', { name: 'Your goal: Feel healthier' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Lose weight/ }));
    await next(user);

    expect(screen.getByText('Step 3 of 5')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '4' }));
    await user.click(screen.getByRole('button', { name: '30' }));
    await user.click(screen.getByRole('button', { name: 'Sat' }));
    await user.click(screen.getByRole('button', { name: 'Sun' }));
    await user.click(screen.getByRole('button', { name: 'Wed' }));
    await user.click(screen.getByRole('button', { name: 'Evening' }));
    await next(user);

    // Equipment moves on when tapped.
    await user.click(screen.getByRole('button', { name: /Dumbbells and bands/ }));
    expect(screen.getByText('Step 5 of 5')).toBeTruthy();
    // New lifters are steered to the 21-day plan
    expect(screen.getByRole('button', { name: /21 days/ }).getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: /60 days/ }));
    expect(screen.getByText(/Week 1 is deliberately easy/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Tomorrow' }));
    await user.click(screen.getByRole('button', { name: 'Create my plan' }));

    expect(await screen.findByText(/You're all set, Sam/)).toBeTruthy();
    expect(setUnit).toHaveBeenCalledWith('kg');

    const profile = await getProfile();
    expect(profile).toMatchObject({ display_name: 'Sam', units: 'kg' });
    expect(profile.onboarding).toMatchObject({ goal: 'lose', level: 'new', per_week: 4, minutes: 30, gear: 'dumbbells', time: 'evening', days: [1, 2, 4, 5] });
    expect(profile.plan).toMatchObject({ time: 'evening', available: [1, 2, 4, 5] });
    // Every training day lands on a day you said you were free (Mon, Tue, Thu, Fri)
    expect(profile.plan.days.every((d, i) => d.k === 'r' || [1, 2, 4, 5].includes(new Date(`${addDays(profile.plan.start, i)}T12:00:00`).getDay()))).toBe(true);
    expect(profile.plan).toMatchObject({ length: 60, start: addDays(today(), 1), goal: 'lose' });
    // Food, body details and interests are no longer asked here.
    expect(profile.height_cm ?? null).toBeNull();
    expect(await listBodyEntries()).toEqual([]);
    const goals = await listGoals();
    expect(goals.find((g) => g.type === 'weekly_workouts').target).toBe(4);

    await user.click(screen.getByRole('button', { name: 'Show me around' }));
    expect(onDone).toHaveBeenCalledWith({ tour: true });
  });

  it('suggests a goal from plain answers', () => {
    expect(suggestGoal({ want: 'strong', level: 'pro', cardio: 'no' }).goal).toBe('strength');
    expect(suggestGoal({ want: 'strong', level: 'new', cardio: 'no' }).goal).toBe('muscle');
    expect(suggestGoal({ want: 'shape', level: 'some', cardio: 'yes' }).goal).toBe('muscle');
    expect(suggestGoal({ want: 'lose', level: 'some', cardio: 'yes' }).goal).toBe('lose');
    expect(suggestGoal({ want: 'energy', level: 'some', cardio: 'yes' }).goal).toBe('endurance');
    expect(suggestGoal({ want: 'energy', level: 'some', cardio: 'no' }).goal).toBe('health');
    expect(suggestGoal({ want: 'move', level: 'new', cardio: 'some' }).goal).toBe('health');
    for (const want of ['strong', 'shape', 'lose', 'energy', 'move']) for (const cardio of ['yes', 'some', 'no']) expect(suggestGoal({ want, level: 'some', cardio }).reason.length).toBeGreaterThan(20);
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
    // Straight to the review, with the length suggested for an experienced lifter.
    expect(screen.getByRole('button', { name: /60 days/ }).getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: /30 days/ }));
    await user.click(screen.getByRole('button', { name: 'Start this plan' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect((await getProfile()).plan).toMatchObject({ length: 30, per_week: 5, level: 'pro' });
  });
});

describe('guided tour', () => {
  const steps = [
    { id: 'a', tab: 'workout', target: '[data-tour="a"]', title: 'First', body: 'Points at A.' },
    { id: 'gone', tab: 'workout', target: '[data-tour="missing"]', optional: true, title: 'Skipped', body: 'No target.' },
    { id: 'b', tab: 'history', target: '[data-tour="b"]', title: 'Second', body: 'Points at B.' },
    { id: 'end', tab: 'workout', target: null, title: 'Finish', body: 'All done.' },
  ];
  it('spotlights real elements, switches tabs and skips steps with nothing to point at', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    const onTab = vi.fn();
    render(
      <div>
        <button data-tour="a">A</button>
        <button data-tour="b">B</button>
        <Coach steps={steps} onTab={onTab} onDone={onDone} />
      </div>,
    );
    expect(await screen.findByText('First')).toBeTruthy();
    expect(document.querySelector('.coach-spot')).toBeTruthy();
    expect(onTab).toHaveBeenCalledWith('workout');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Second', {}, { timeout: 2000 })).toBeTruthy();
    expect(onTab).toHaveBeenCalledWith('history');
    expect(screen.getByText('2 of 3')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Finish')).toBeTruthy();
    expect(document.querySelector('.coach-spot')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalled();
  });
  it('can be skipped', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<Coach steps={steps} onTab={() => {}} onDone={onDone} />);
    await user.click(await screen.findByRole('button', { name: 'Skip tour' }));
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
    expect(screen.getByText(/Today: done/)).toBeTruthy();
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
    expect(within(screen.getAllByRole('listitem')[0]).getByRole('img', { name: 'Done' })).toBeTruthy();
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
    expect(heightCm('lb', '6', '')).toBe(182.88);
    expect(heightCm('kg', '1', '75')).toBe(175);
    expect(heightCm('kg', '', '')).toBeNull();
    expect(heightCm('lb', '0', '5')).toBeNull();
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
    expect(screen.getByText(/Plan update: Wed's workout moved to/)).toBeTruthy();
    cleanup();
    render(<PlanView plan={adapted} workouts={[{ date: start }]} todayStr={fri} onClose={() => {}} onNewPlan={() => {}} onEndPlan={() => {}} />);
    expect(screen.getByText('Moved')).toBeTruthy();
    expect(screen.getByText(/Moved from Wed/)).toBeTruthy();
  });
});

import ActivityEditor from '../src/components/ActivityEditor';
import { newActivity } from '../src/db';
describe('activity picker favorites', () => {
  it('puts your activities first and keeps the full list', async () => {
    const user = userEvent.setup();
    render(<ActivityEditor initial={newActivity()} isNew places={[]} unit="lb" favorites={['pickleball', 'swim']} onClose={() => {}} />);
    expect(screen.getByText('Your activities')).toBeTruthy();
    const sw = screen.getByRole('button', { name: 'Swim' });
    await user.click(sw);
    expect(sw.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText('All activities').value).toBe('swim');
  });
  it('shows the plain list when there are no favorites yet', () => {
    render(<ActivityEditor initial={newActivity()} isNew places={[]} unit="lb" onClose={() => {}} />);
    expect(screen.queryByText('Your activities')).toBeNull();
    expect(screen.getByLabelText('Activity')).toBeTruthy();
  });
});

describe('finished plan', () => {
  it('offers to continue with a promoted next plan', async () => {
    const user = userEvent.setup();
    const start = '2026-11-09';
    const plan = buildPlan({ length: 21, start, goal: 'muscle', level: 'new', per_week: 3, minutes: 45 });
    const all = plan.days.map((d, i) => ({ d, i })).filter(({ d }) => d.k !== 'r').map(({ i }) => ({ date: addDays(start, i) }));
    const onContinue = vi.fn();
    render(<PlanCard plan={plan} workouts={all} todayStr={addDays(start, 30)} onDo={() => {}} onViewPlan={() => {}} onNewPlan={() => {}} onEndPlan={() => {}} onSuggest={() => {}} onContinue={onContinue} />);
    expect(screen.getByText(/One more workout a week \(4\)/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Continue with this plan' }));
    expect(onContinue).toHaveBeenCalledWith(expect.objectContaining({ level: 'some', per_week: 4 }));
  });
});
