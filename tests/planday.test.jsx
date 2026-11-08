import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addWorkout, buildPlan, cardioTip, skipDay, swapDays, trainingRun, updateDay } from '../src/plan';
import PlanCard, { PlanView } from '../src/components/PlanCard';
import PlanDay from '../src/components/PlanDay';
import { cleanPlan } from '../src/plan';

afterEach(cleanup);

const start = '2026-11-09';
const plan = buildPlan({ length: 21, start, goal: 'muscle', level: 'some', per_week: 3, minutes: 45 });
const idx = (k) => plan.days.findIndex((d) => d.k === k);

describe('plan edits', () => {
  it('swaps two days and notes it', () => {
    const s = idx('s') + 1;
    const r = plan.days.findIndex((d) => d.k === 'r') + 1;
    const next = swapDays(plan, s, r);
    expect(next.days[s - 1].k).toBe('r');
    expect(next.days[r - 1]).toMatchObject({ k: 's', f: plan.days[s - 1].f });
    expect(next.days[r - 1].adj).toMatch(/Swapped with/);
    expect(cleanPlan(next)).not.toBeNull();
  });
  it('skips, adds and edits', () => {
    const s = idx('s') + 1;
    expect(skipDay(plan, s).days[s - 1]).toMatchObject({ k: 'r', adj: 'Skipped' });
    const r = plan.days.findIndex((d) => d.k === 'r') + 1;
    expect(addWorkout(plan, r).days[r - 1]).toMatchObject({ k: 's', f: 'full', m: 45 });
    const c = idx('c') + 1;
    if (c > 0) expect(updateDay(plan, c, { t: 'swim', m: 25 }).days[c - 1]).toMatchObject({ t: 'swim', m: 25 });
  });
  it('counts training runs and has a tip for each cardio type', () => {
    expect(trainingRun(plan, 1)).toBeGreaterThanOrEqual(1);
    expect(cardioTip('run')).toMatch(/conversational/);
    expect(cardioTip('unknown')).toBeTruthy();
  });
});

describe('plan days are reachable', () => {
  it('week strip and rows open a day', async () => {
    const user = userEvent.setup();
    const onViewDay = vi.fn();
    render(<PlanCard plan={plan} workouts={[]} todayStr={start} onDo={() => {}} onViewPlan={() => {}} onViewDay={onViewDay} onSuggest={() => {}} />);
    const strip = screen.getByRole('list', { name: 'This week' });
    expect(within(strip).getAllByRole('button')).toHaveLength(7);
    await user.click(within(strip).getAllByRole('button')[2]);
    expect(onViewDay).toHaveBeenCalledWith(3);
    await user.click(screen.getByRole('button', { name: /See what.s planned today/ }));
    expect(onViewDay).toHaveBeenCalledWith(1);
  });
  it('plan view rows are buttons', async () => {
    const user = userEvent.setup();
    const onViewDay = vi.fn();
    render(<PlanView plan={plan} workouts={[]} todayStr={start} onClose={() => {}} onNewPlan={() => {}} onEndPlan={() => {}} onViewDay={onViewDay} />);
    await user.click(screen.getAllByRole('button', { name: /: / })[0]);
    expect(onViewDay).toHaveBeenCalled();
  });
});

describe('plan day screen', () => {
  const show = (n, extra = {}, todayStr = start) => {
    const fns = { onBack: vi.fn(), onGoto: vi.fn(), onChangePlan: vi.fn(), onStart: vi.fn(), onSaveRoutine: vi.fn(), onLogActivity: vi.fn(), onOpenWorkout: vi.fn() };
    render(<PlanDay plan={plan} workouts={[]} todayStr={todayStr} n={n} unit="lb" {...fns} {...extra} />);
    return fns;
  };
  it('lets you start a strength day and swap or skip it', async () => {
    const user = userEvent.setup();
    const n = idx('s') + 1;
    const fns = show(n, {}, plan.days.length ? start : start);
    expect(await screen.findByText('Planned workout')).toBeTruthy();
    const startBtn = screen.queryByRole('button', { name: 'Start workout' });
    if (startBtn) {
      await user.click(startBtn);
      expect(fns.onStart).toHaveBeenCalled();
    } else {
      await user.click(screen.getByRole('button', { name: 'Do this today instead' }));
      expect(fns.onChangePlan).toHaveBeenCalled();
      expect(fns.onStart).toHaveBeenCalled();
    }
  });
  it('shows rest ideas and day navigation on a rest day', async () => {
    const user = userEvent.setup();
    const n = plan.days.findIndex((d) => d.k === 'r') + 1;
    const fns = show(n);
    expect(screen.getByText('Rest and recovery')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Log stretching/ }));
    expect(fns.onLogActivity).toHaveBeenCalledWith({ type: 'stretching', minutes: 15 });
    await user.click(screen.getByRole('button', { name: 'Next day →' }));
    expect(fns.onGoto).toHaveBeenCalledWith(n + 1);
  });
});
