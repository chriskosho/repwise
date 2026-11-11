import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import ExercisePicker from '../src/components/ExercisePicker';
import RoutineEditor from '../src/components/RoutineEditor';
import { db, listRoutines, newRoutine, saveSession } from '../src/db';
import { setPrefs } from '../src/prefs';
import { stopRest } from '../src/rest';

beforeEach(async () => {
  await db.sessions.clear();
  await db.routines.clear();
  await db.customExercises.clear();
  localStorage.clear();
  setPrefs({ restEnabled: false, alerts: false, keepAwake: false });
});

afterEach(() => {
  cleanup();
  stopRest();
});

const finished = (name, exName, sets) => ({
  id: crypto.randomUUID(),
  date: '2026-10-01',
  name,
  started_at: '2026-10-01T10:00:00.000Z',
  ended_at: '2026-10-01T11:00:00.000Z',
  notes: '',
  created_at: '2026-10-01T10:00:00.000Z',
  deleted_at: null,
  exercises: [
    {
      id: crypto.randomUUID(),
      name: exName,
      link: false,
      notes: '',
      sets: sets.map(([reps, weight]) => ({ id: crypto.randomUUID(), type: 'normal', reps, weight, done: true })),
    },
  ],
});

describe('exercise picker', () => {
  it('filters the library by muscle and equipment, and lets you pick several at once', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<ExercisePicker sessions={[]} onAdd={onAdd} onClose={() => {}} />);

    await user.selectOptions(screen.getByLabelText('Filter by muscle'), 'biceps');
    await user.selectOptions(screen.getByLabelText('Filter by equipment'), 'barbell');
    const curl = await screen.findByRole('button', { name: 'Barbell Curl' });
    expect(screen.queryByRole('button', { name: 'Barbell Squat' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dumbbell Bicep Curl' })).toBeNull();

    await user.click(curl);
    expect(curl.getAttribute('aria-pressed')).toBe('true');
    await user.selectOptions(screen.getByLabelText('Filter by equipment'), 'dumbbell');
    await user.click(await screen.findByRole('button', { name: 'Dumbbell Bicep Curl' }));
    await user.click(screen.getByRole('button', { name: 'Add 2 exercises' }));
    expect(onAdd).toHaveBeenCalledWith(['Barbell Curl', 'Dumbbell Bicep Curl']);
  });

  it('unselects on a second tap and keeps the add button disabled with nothing selected', async () => {
    const user = userEvent.setup();
    render(<ExercisePicker sessions={[]} onAdd={() => {}} onClose={() => {}} />);
    const add = screen.getByRole('button', { name: 'Select exercises to add' });
    expect(add.disabled).toBe(true);
    await user.type(screen.getByLabelText('Search exercises'), 'Barbell Curl');
    const curl = await screen.findByRole('button', { name: 'Barbell Curl' });
    await user.click(curl);
    await user.click(curl);
    expect(curl.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Select exercises to add' }).disabled).toBe(true);
  });

  it('creates a new exercise with a muscle and equipment, and finds it again later', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<ExercisePicker sessions={[]} onAdd={onAdd} onClose={() => {}} />);

    await user.type(screen.getByLabelText('Search exercises'), 'Gate Lift Xtra');
    await user.click(screen.getByRole('button', { name: /Create “Gate Lift Xtra”/ }));
    await user.selectOptions(screen.getByLabelText('Muscle'), 'quadriceps');
    await user.click(screen.getByRole('button', { name: 'Create and select' }));
    await user.click(await screen.findByRole('button', { name: 'Add 1 exercise' }));
    expect(onAdd).toHaveBeenCalledWith(['Gate Lift Xtra']);
    expect(await db.customExercises.toArray()).toEqual([expect.objectContaining({ name: 'Gate Lift Xtra' })]);
  });

  it('shows your own exercises even when the library is unavailable', async () => {
    const user = userEvent.setup();
    vi.resetModules();
    vi.doMock('../src/data/library.json', () => {
      throw new Error('offline');
    });
    const { default: Picker } = await import('../src/components/ExercisePicker');
    render(<Picker sessions={[finished('W', 'Squat', [[5, 100]])]} onAdd={() => {}} onClose={() => {}} />);
    expect(await screen.findByText(/library couldn't load/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Squat' }));
    expect(screen.getByRole('button', { name: 'Add 1 exercise' })).toBeTruthy();
    vi.doUnmock('../src/data/library.json');
  });
});

describe('routine editor', () => {
  it('builds a routine, changes set counts, links a superset, and saves it', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<RoutineEditor initial={newRoutine()} isNew sessions={[]} onClose={onClose} />);

    // validation first
    await user.click(screen.getByRole('button', { name: 'Save routine' }));
    expect(screen.getByRole('alert').textContent).toMatch(/name/i);
    await user.type(screen.getByLabelText('Name'), 'Arm day');
    await user.click(screen.getByRole('button', { name: 'Save routine' }));
    expect(screen.getByRole('alert').textContent).toMatch(/exercise/i);

    // add two exercises together
    await user.click(screen.getByRole('button', { name: '+ Add exercises' }));
    for (const name of ['Barbell Curl', 'Triceps Pushdown']) {
      const box = screen.getByLabelText('Search exercises');
      await user.clear(box);
      await user.type(box, name);
      await user.click(await screen.findByRole('button', { name }));
    }
    await user.click(screen.getByRole('button', { name: 'Add 2 exercises' }));

    // each starts with 3 sets; change the first to 4 and the second to 2
    await user.click(screen.getByRole('button', { name: 'More sets for Barbell Curl' }));
    await user.click(screen.getByRole('button', { name: 'Fewer sets for Triceps Pushdown' }));
    await user.click(screen.getAllByLabelText('Superset with the next exercise')[0]);

    await user.click(screen.getByRole('button', { name: 'Save routine' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const [r] = await listRoutines();
    expect(r.name).toBe('Arm day');
    expect(r.exercises.map((e) => [e.name, e.sets.length, e.link])).toEqual([
      ['Barbell Curl', 4, true],
      ['Triceps Pushdown', 2, false],
    ]);
  });

  it('removing or moving the last exercise never leaves a dangling superset link', async () => {
    const user = userEvent.setup();
    const routine = {
      ...newRoutine(),
      name: 'R',
      exercises: ['A', 'B', 'C'].map((name, i) => ({ id: `e${i}`, name, link: i === 1, notes: '', sets: [{ id: `s${i}`, type: 'normal' }] })),
    };
    const onClose = vi.fn();
    render(<RoutineEditor initial={routine} isNew={false} sessions={[]} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Remove C' }));
    await user.click(screen.getByRole('button', { name: 'Save routine' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [r] = await listRoutines();
    expect(r.exercises.map((e) => [e.name, e.link])).toEqual([
      ['A', false],
      ['B', false],
    ]);
  });

  it('deletes an existing routine after confirming', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const routine = { ...newRoutine(), name: 'Old', exercises: [{ id: 'e', name: 'Row', link: false, notes: '', sets: [{ id: 's', type: 'normal' }] }] };
    await db.routines.put({ ...routine, dirty: 0, rev: 1 });
    const onClose = vi.fn();
    render(<RoutineEditor initial={routine} isNew={false} sessions={[]} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Delete routine' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await listRoutines()).toHaveLength(0);
  });
});

describe('routines in the app', () => {
  it('saves a finished workout as a routine and starts it with the last numbers shown', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Log a workout.
    await user.click(await screen.findByRole('button', { name: 'Start workout' }));
    await user.click(await screen.findByRole('button', { name: /^Empty workout/ }));
    await user.click(await screen.findByRole('button', { name: '+ Add exercise' }));
    await user.type(screen.getByLabelText('Search exercises'), 'Barbell Curl');
    await user.click(await screen.findByRole('button', { name: 'Barbell Curl' }));
    await user.click(screen.getByRole('button', { name: 'Add 1 exercise' }));
    await user.click(screen.getByRole('button', { name: '+ Add set' }));
    for (const n of ['1', '2']) {
      await user.type(screen.getByLabelText(`Set ${n} weight`), '60');
      await user.type(screen.getByLabelText(`Set ${n} reps`), '8');
      await user.click(screen.getByRole('button', { name: `Mark set ${n} done` }));
    }
    await user.clear(screen.getByLabelText('Workout name'));
    await user.type(screen.getByLabelText('Workout name'), 'Biceps');
    await user.click(screen.getByRole('button', { name: 'Done' }));

    // Save it as a routine from the summary; the editor opens pre-filled.
    await user.click(await screen.findByRole('button', { name: 'Save as routine' }));
    expect((await screen.findByLabelText('Name')).value).toBe('Biceps');
    expect(screen.getByRole('heading', { name: 'Barbell curl' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Save routine' }));

    // It now shows under Routines on the start screen.
    expect(await screen.findByRole('button', { name: /^Routines \(1\)/ })).toBeTruthy();
    const [start] = await screen.findAllByRole('button', { name: 'Start Biceps' }); // the main button and the routine card both offer it

    // Starting it creates a live workout with 2 empty sets and last time's numbers.
    await user.click(start);
    expect((await screen.findByLabelText('Workout name')).value).toBe('Biceps');
    expect(screen.getByRole('heading', { name: 'Barbell curl' })).toBeTruthy();
    expect(screen.getByLabelText('Set 1 reps').value).toBe('');
    expect(screen.getAllByText('60 × 8')).toHaveLength(2);
    expect(screen.getByLabelText('Set 2 weight').getAttribute('placeholder')).toBe('60');
  });

  it('creates a routine from scratch and edits it', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /^Routines/ }));
    await user.click(await screen.findByRole('button', { name: '+ New routine' }));
    await user.type(screen.getByLabelText('Name'), 'Leg day');
    await user.click(screen.getByRole('button', { name: '+ Add exercises' }));
    await user.type(screen.getByLabelText('Search exercises'), 'Barbell Squat');
    await user.click(await screen.findByRole('button', { name: 'Barbell Squat' }));
    await user.click(screen.getByRole('button', { name: 'Add 1 exercise' }));
    await user.click(screen.getByRole('button', { name: 'Save routine' }));

    const card = (await screen.findAllByText('Leg day')).map((e) => e.closest('.routine')).find(Boolean); // a starter is also called Leg day
    expect(within(card).getByText('Back squat')).toBeTruthy();
    expect(within(card).getByText(/1 exercise · 3 sets/)).toBeTruthy();

    await user.click(within(card).getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Legs');
    await user.click(screen.getByRole('button', { name: 'Save routine' }));
    expect(await screen.findByRole('button', { name: 'Start Legs' })).toBeTruthy();
    expect(document.querySelectorAll('.routine')).toHaveLength(1);
    expect(within(document.querySelector('.routine')).queryByText('Leg day')).toBeNull();
  });

  it('saves a past workout as a routine from the workout editor', async () => {
    const user = userEvent.setup();
    const s = finished('Pull', 'Pullups', [[8, 0]]);
    await saveSession(s);
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'History' }));
    await user.click(await screen.findByText('Pull-up'));
    await user.click(await screen.findByRole('button', { name: 'Save as routine' }));
    expect((await screen.findByLabelText('Name')).value).toBe('Pull');
    await user.click(screen.getByRole('button', { name: 'Save routine' }));
    expect((await listRoutines()).map((r) => r.name)).toEqual(['Pull']);
  });
});
