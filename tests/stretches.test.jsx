import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURATED, PRESETS, REGIONS, REGION_IDS, buildStretches, curatedStretch, guideSteps, recentRegions, sessionSeconds, sessionTitle, stepsSeconds, swapStretch } from '../src/stretches';
import StretchBuilder from '../src/components/StretchBuilder';
import StretchGuide from '../src/components/StretchGuide';
import RoutinePicker from '../src/components/RoutinePicker';
import { clearLocalData, listActivities, newRoutine, saveRoutine } from '../src/db';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
beforeEach(clearLocalData);

describe('stretch engine', () => {
  it('curated data is complete and every area has stretches', () => {
    expect(CURATED.length).toBeGreaterThanOrEqual(30);
    for (const r of REGIONS) expect(CURATED.some((s) => s.region === r.id)).toBe(true);
    for (const s of CURATED) {
      expect(s.hold).toBeGreaterThanOrEqual(15);
      expect(s.cue.length).toBeGreaterThan(10);
    }
    expect(curatedStretch('pigeon POSE')).toMatchObject({ region: 'hips', sides: true });
  });
  it('fits the time and stays in the chosen areas, head to toe', () => {
    for (const minutes of [5, 10, 15, 20]) {
      const list = buildStretches({ minutes, seed: 3 });
      const secs = sessionSeconds(list);
      expect(secs).toBeGreaterThan(minutes * 60 - 100);
      expect(secs).toBeLessThanOrEqual(minutes * 60 + 20);
      const order = list.map((s) => REGION_IDS.indexOf(s.region));
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    }
    const lower = buildStretches({ regions: PRESETS.find((p) => p.id === 'lower').regions, minutes: 10 });
    expect(lower.every((s) => ['hips', 'quads', 'hamstrings', 'calves'].includes(s.region))).toBe(true);
    expect(new Set(lower.map((s) => s.name)).size).toBe(lower.length);
  });
  it('a short session still touches every chosen area it can', () => {
    const list = buildStretches({ regions: REGION_IDS, minutes: 5 });
    expect(new Set(list.map((s) => s.region)).size).toBeGreaterThanOrEqual(6);
    expect(buildStretches({ regions: [] })).toEqual([]);
  });
  it('is repeatable for a seed and swaps for something new in the same area', () => {
    expect(buildStretches({ minutes: 10, seed: 4 })).toEqual(buildStretches({ minutes: 10, seed: 4 }));
    const list = buildStretches({ regions: ['hamstrings'], minutes: 5, seed: 1 });
    const library = [{ name: 'Lying hamstring stretch', muscle: 'hamstrings', equipment: 'bodyweight', category: 'stretching', level: 'beginner' }];
    const swapped = swapStretch(list, 0, { seed: 9, library });
    expect(swapped[0].name).toBe('Lying hamstring stretch');
    expect(swapped[0].region).toBe('hamstrings');
  });
  it('turns a list into timed steps with a switch between sides', () => {
    const steps = guideSteps([
      { name: 'A', hold: 30, sides: true },
      { name: 'B', hold: 20, sides: false },
    ]);
    expect(steps.map((s) => s.kind)).toEqual(['ready', 'hold', 'switch', 'hold', 'ready', 'hold']);
    expect(stepsSeconds(steps)).toBe(5 + 30 + 4 + 30 + 5 + 20);
  });
  it('names the session and finds recently trained areas', () => {
    expect(sessionTitle(REGION_IDS)).toBe('Total body stretch');
    expect(sessionTitle(['hips', 'hamstrings'])).toBe('Stretch: hips, hamstrings');
    const lib = [{ name: 'Squat', muscle: 'quadriceps' }];
    const sessions = [{ date: '2026-11-08', ended_at: 'x', exercises: [{ name: 'Squat' }] }, { date: '2026-10-01', ended_at: 'x', exercises: [{ name: 'Squat' }] }];
    expect(recentRegions(sessions, lib, '2026-11-09')).toEqual(['quads']);
    expect(recentRegions([sessions[1]], lib, '2026-11-09')).toEqual([]);
  });
});

describe('curated stretches borrow library pictures and steps', () => {
  it('every mapped name exists in the library', async () => {
    const { loadLibrary, findExercise } = await import('../src/library');
    const lib = await loadLibrary();
    const mapped = CURATED.filter((s) => s.lib);
    expect(mapped.length).toBeGreaterThanOrEqual(18);
    for (const s of mapped) expect(findExercise(lib, s.lib), s.lib).toBeTruthy();
  });
});

describe('stretch builder', () => {
  it('builds a list, responds to areas, and logs a stretching activity', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<StretchBuilder onClose={onClose} />);
    await screen.findByText(/stretch(es)? · about/);
    await user.click(screen.getByRole('button', { name: 'Lower body' }));
    expect(screen.getByRole('button', { name: 'Lower body' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Total body' }).getAttribute('aria-pressed')).toBe('false');
    await waitFor(() => expect(screen.getAllByText(/Hips and glutes|Quads|Hamstrings|Calves/).length).toBeGreaterThan(0));
    expect(screen.getByRole('button', { name: 'Back' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Calves' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Just log it' }));
    await screen.findByText(/That is logged/);
    const all = await listActivities();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ type: 'stretching', title: 'Stretch: hips, quads, hamstrings…' });
    expect(all[0].stretches.length).toBeGreaterThan(3);
  });
  it('removes a stretch and hands a list back in pick mode', async () => {
    const user = userEvent.setup();
    const onUse = vi.fn();
    render(<StretchBuilder pick minutes={5} onUse={onUse} onClose={() => {}} />);
    await screen.findByText(/stretch(es)? · about/);
    const first = screen.getAllByRole('button', { name: /^Remove / })[0];
    const gone = first.getAttribute('aria-label').replace('Remove ', '');
    await user.click(first);
    await user.click(screen.getByRole('button', { name: /^Add \d+ stretch/ }));
    const list = onUse.mock.calls[0][0];
    expect(list.some((s) => s.name === gone)).toBe(false);
    expect(list.length).toBeGreaterThan(3);
  });
  it('saves a stretch routine with timed stretch exercises', async () => {
    const user = userEvent.setup();
    const onSaveRoutine = vi.fn();
    render(<StretchBuilder onSaveRoutine={onSaveRoutine} onClose={() => {}} />);
    await screen.findByText(/stretch(es)? · about/);
    await user.click(screen.getByRole('button', { name: 'Save as routine' }));
    const doc = onSaveRoutine.mock.calls[0][0];
    expect(doc.name).toBe('Total body stretch');
    expect(doc.exercises[0]).toMatchObject({ mode: 'stretch' });
    expect(doc.exercises[0].target.time).toBeGreaterThan(0);
  });
});

describe('guided stretching', () => {
  it('counts down, switches sides, advances and reports when finished', async () => {
    vi.useFakeTimers();
    const onFinish = vi.fn();
    const list = [{ name: 'Pigeon pose', region: 'hips', hold: 6, sides: true, cue: 'Fold forward.' }];
    render(<StretchGuide list={list} onFinish={onFinish} onExit={() => {}} />);
    expect(screen.getByText('Get ready')).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(5300));
    expect(screen.getByText('Side 1 of 2')).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(6300));
    expect(screen.getByText('Switch sides')).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(4300));
    expect(screen.getByText('Side 2 of 2')).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(6500));
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ finished: true, completed: ['Pigeon pose'] }));
  });
  it('pauses and can be ended early', async () => {
    vi.useFakeTimers();
    const onFinish = vi.fn();
    const list = [{ name: 'A', region: 'back', hold: 20, sides: false, cue: '' }, { name: 'B', region: 'back', hold: 20, sides: false, cue: '' }];
    render(<StretchGuide list={list} onFinish={onFinish} onExit={() => {}} />);
    const btn = (n) => screen.getByRole('button', { name: n });
    await act(async () => btn('Pause').click());
    await act(async () => vi.advanceTimersByTime(20000));
    expect(screen.getByText('Get ready')).toBeTruthy();
    await act(async () => btn('Skip').click());
    expect(screen.getByRole('heading', { name: 'B' })).toBeTruthy();
    await act(async () => btn('End session').click());
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ finished: false }));
  });
});

describe('add a routine to a workout', () => {
  it('lists routines, skips exercises already there, and adds the rest', async () => {
    const user = userEvent.setup();
    await saveRoutine({
      ...newRoutine(),
      name: 'Pull day',
      exercises: [
        { id: 'a', name: 'Barbell Row', link: false, notes: '', sets: [{ id: 's1', type: 'normal' }, { id: 's2', type: 'normal' }] },
        { id: 'b', name: 'Pull-up', link: false, notes: '', sets: [{ id: 's3', type: 'normal' }] },
      ],
    });
    const onAdd = vi.fn();
    render(<RoutinePicker existing={['Pull-up']} onAdd={onAdd} onClose={() => {}} />);
    await user.click(await screen.findByRole('button', { name: /Pull day · 2 exercises/ }));
    expect(screen.getByRole('checkbox', { name: 'Barbell Row' }).checked).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'Pull-up' }).checked).toBe(false);
    expect(screen.getByText(/already added/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Add 1 exercise' }));
    const added = onAdd.mock.calls[0][0];
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ name: 'Barbell Row' });
    expect(added[0].sets).toHaveLength(2);
  });
  it('explains when there are no routines', async () => {
    render(<RoutinePicker onAdd={() => {}} onClose={() => {}} />);
    await screen.findByText(/no routines yet/);
  });
});

describe('stretching what you trained', () => {
  const lib = [
    { name: 'Barbell Full Squat', muscle: 'quadriceps', compound: true },
    { name: 'Barbell Deadlift', muscle: 'lower back', compound: true },
    { name: 'Bench Press', muscle: 'chest', compound: true },
    { name: 'Leg Extensions', muscle: 'quadriceps', compound: false },
    { name: 'Barbell Curl', muscle: 'biceps', compound: false },
  ];
  const sets = (n) => Array.from({ length: n }, () => ({ done: true, type: 'normal' }));
  it('credits supporting muscles for compound lifts only', async () => {
    const { workoutPlan } = await import('../src/stretches');
    const squat = workoutPlan({ exercises: [{ name: 'Barbell Full Squat', sets: sets(4) }] }, lib);
    expect(squat.regions).toEqual(expect.arrayContaining(['quads', 'hips', 'hamstrings']));
    const ext = workoutPlan({ exercises: [{ name: 'Leg Extensions', sets: sets(4) }] }, lib);
    expect(ext.regions).toEqual(['quads']);
    expect(squat.because).toBe('Because of Barbell Full Squat.');
  });
  it('weights by completed sets, skips warm-ups, unfinished sets and stretches', async () => {
    const { workoutPlan } = await import('../src/stretches');
    const plan = workoutPlan(
      {
        exercises: [
          { name: 'Bench Press', sets: [...sets(5), { done: true, type: 'warmup' }, { done: false, type: 'normal' }] },
          { name: 'Barbell Curl', sets: sets(1) },
          { name: 'Leg Extensions', mode: 'stretch', sets: sets(9) },
        ],
      },
      lib,
    );
    expect(plan.weights.chest).toBe(1);
    expect(plan.weights.quads).toBeUndefined();
    expect(plan.regions).toContain('chest');
  });
  it('picks 5 minutes, or 10 after a long workout', async () => {
    const { workoutMinutes } = await import('../src/stretches');
    expect(workoutMinutes({ started_at: '2026-11-10T10:00:00Z', ended_at: '2026-11-10T10:45:00Z' })).toBe(5);
    expect(workoutMinutes({ started_at: '2026-11-10T10:00:00Z', ended_at: '2026-11-10T11:20:00Z' })).toBe(10);
    expect(workoutMinutes({})).toBe(5);
  });
  it('gives the most worked area the most stretches', () => {
    const list = buildStretches({ regions: ['back', 'hips', 'calves'], minutes: 10, weights: { hips: 1, back: 0.4, calves: 0.25 }, seed: 2 });
    const n = (r) => list.filter((s) => s.region === r).length;
    expect(n('hips')).toBeGreaterThan(n('calves'));
    expect(n('calves')).toBeGreaterThanOrEqual(1);
    expect(sessionSeconds(list)).toBeLessThanOrEqual(620);
  });
  it('a short session keeps the most worked areas', () => {
    const list = buildStretches({ regions: ['neck', 'chest', 'back', 'core', 'hips'], minutes: 5, weights: { hips: 1, chest: 0.9, neck: 0.2, back: 0.2, core: 0.2 } });
    const regs = list.map((s) => s.region);
    expect(regs).toContain('hips');
    expect(regs).toContain('chest');
  });
  it('counts recent activities, with older days counting less', async () => {
    const { recentPlan } = await import('../src/stretches');
    const run = { type: 'run', date: '2026-11-10', duration_min: 30 };
    const plan = recentPlan([], lib, '2026-11-10', { activities: [run] });
    expect(plan.regions).toEqual(expect.arrayContaining(['hips', 'quads', 'hamstrings', 'calves']));
    const older = recentPlan([{ date: '2026-11-07', ended_at: 'x', exercises: [{ name: 'Bench Press', sets: sets(3) }] }], lib, '2026-11-10', { activities: [run] });
    expect(older.weights.chest).toBeLessThan(older.weights.calves ?? 1);
    expect(recentPlan([], lib, '2026-11-10', { activities: [{ type: 'run', date: '2026-10-01', duration_min: 30 }] }).regions).toEqual([]);
  });
  it('the builder opens on the workout areas and explains why', async () => {
    const user = userEvent.setup();
    const focus = { regions: ['hips', 'quads'], weights: { hips: 1, quads: 0.7 }, because: 'Because of Barbell Full Squat.', minutes: 5 };
    render(<StretchBuilder focus={focus} minutes={5} onClose={() => {}} />);
    await screen.findByText(/stretch(es)? · about/);
    expect(screen.getByText(/Because of Barbell Full Squat/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'What I just trained' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Hips and glutes' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Calves' }).getAttribute('aria-pressed')).toBe('false');
    await user.click(screen.getByRole('button', { name: 'Total body' }));
    expect(screen.queryByText(/Because of Barbell Full Squat/)).toBeNull();
  });
});

describe('against the real exercise library', () => {
  it('a barbell squat points to quads, hips and hamstrings, and a curl only to arms', async () => {
    const { loadLibrary } = await import('../src/library');
    const { workoutPlan } = await import('../src/stretches');
    const library = await loadLibrary();
    const sets = Array.from({ length: 4 }, () => ({ done: true, type: 'normal' }));
    expect(workoutPlan({ exercises: [{ name: 'Barbell Full Squat', sets }] }, library).regions).toEqual(expect.arrayContaining(['quads', 'hips', 'hamstrings']));
    const curl = library.find((l) => l.muscle === 'biceps' && !l.compound);
    expect(workoutPlan({ exercises: [{ name: curl.name, sets }] }, library).regions).toEqual(['chest']);
  });
});
