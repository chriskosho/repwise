import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkoutEditor from '../src/components/WorkoutEditor';
import { db, newSession, saveSession } from '../src/db';
import { getRestState, stopRest } from '../src/rest';
import { setPrefs } from '../src/prefs';

beforeEach(async () => {
  await db.sessions.clear();
  await db.customExercises.clear();
  setPrefs({ restEnabled: true, restSeconds: 90, alerts: false, keepAwake: false });
});

afterEach(() => {
  cleanup();
  stopRest();
});

const finishedSession = (date, name, exName, sets) => ({
  id: crypto.randomUUID(),
  date,
  name,
  started_at: `${date}T10:00:00.000Z`,
  ended_at: `${date}T11:00:00.000Z`,
  notes: '',
  created_at: `${date}T10:00:00.000Z`,
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

// Open the picker, select each named exercise (library names are exact), and add them.
async function addViaPicker(user, ...names) {
  await user.click(screen.getByRole('button', { name: '+ Add exercise' }));
  for (const name of names) {
    const box = screen.getByLabelText('Search exercises');
    await user.clear(box);
    await user.type(box, name);
    await user.click(await screen.findByRole('button', { name }));
  }
  await user.click(screen.getByRole('button', { name: new RegExp(`^Add ${names.length} exercise`) }));
}

async function startActive() {
  const s = newSession();
  await saveSession(s);
  return db.sessions.get(s.id);
}

describe('active workout', () => {
  it('adds an exercise, logs a set, starts the rest timer and finishes', async () => {
    const user = userEvent.setup();
    const row = await startActive();
    const onFinish = vi.fn();
    render(<WorkoutEditor initial={row} mode="active" sessions={[]} unit="lb" onFinish={onFinish} />);

    await user.click(screen.getByRole('button', { name: '+ Add exercise' }));
    await user.type(screen.getByLabelText('Search exercises'), 'Zercher squat');
    await user.click(screen.getByRole('button', { name: /Create “Zercher squat”/ }));
    await user.click(screen.getByRole('button', { name: 'Create and select' }));
    await user.click(await screen.findByRole('button', { name: 'Add 1 exercise' }));
    expect(screen.getByRole('heading', { name: 'Zercher squat' })).toBeTruthy();
    expect((await db.customExercises.toArray()).map((c) => c.name)).toEqual(['Zercher squat']);

    await user.type(screen.getByLabelText('Set 1 weight'), '225');
    await user.type(screen.getByLabelText('Set 1 reps'), '5');
    await user.click(screen.getByRole('button', { name: 'Mark set 1 done' }));

    expect(screen.getByRole('button', { name: 'Set 1 done' }).getAttribute('aria-pressed')).toBe('true');
    expect(getRestState().end).not.toBeNull();
    expect(getRestState().total).toBe(90);

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
    const info = onFinish.mock.calls[0][0];
    expect(info.stats).toMatchObject({ sets: 1, volume: 1125, exercises: 1 });
    expect(getRestState().end).toBeNull(); // finishing stops the timer

    await waitFor(async () => {
      const saved = await db.sessions.get(row.id);
      expect(saved.ended_at).toBeTruthy();
      expect(saved.exercises[0].sets[0]).toMatchObject({ reps: 5, weight: 225, done: true });
    });
  });

  it('shows last time, uses it as a placeholder, and flags new records', async () => {
    const user = userEvent.setup();
    const row = await startActive();
    const earlier = finishedSession('2026-10-01', 'Old', 'Squat', [[5, 200]]);
    render(<WorkoutEditor initial={row} mode="active" sessions={[earlier]} unit="lb" onFinish={() => {}} />);

    await addViaPicker(user, 'Squat'); // from "Your exercises"

    // Previous column shows last time; one empty set row was pre-created to match.
    expect(screen.getByText('200 × 5')).toBeTruthy();
    expect(screen.getByLabelText('Set 1 weight').getAttribute('placeholder')).toBe('200');

    await user.type(screen.getByLabelText('Set 1 weight'), '225');
    await user.type(screen.getByLabelText('Set 1 reps'), '5');
    await user.click(screen.getByRole('button', { name: 'Mark set 1 done' }));

    expect(screen.getByText('Weight PR')).toBeTruthy();
    expect(screen.getByText('1RM PR')).toBeTruthy();
  });

  it('fills a blank set from last time when you tap done', async () => {
    const user = userEvent.setup();
    const row = await startActive();
    const earlier = finishedSession('2026-10-01', 'Old', 'Squat', [[5, 200]]);
    render(<WorkoutEditor initial={row} mode="active" sessions={[earlier]} unit="lb" onFinish={() => {}} />);

    await addViaPicker(user, 'Squat');
    await user.click(screen.getByRole('button', { name: 'Mark set 1 done' }));

    expect(screen.getByLabelText('Set 1 weight').value).toBe('200');
    expect(screen.getByLabelText('Set 1 reps').value).toBe('5');
  });

  it('will not complete a set with no reps', async () => {
    const user = userEvent.setup();
    const row = await startActive();
    render(<WorkoutEditor initial={row} mode="active" sessions={[]} unit="lb" onFinish={() => {}} />);

    await addViaPicker(user, 'Barbell Curl');
    await user.click(screen.getByRole('button', { name: 'Mark set 1 done' }));

    expect(screen.getByRole('alert').textContent).toMatch(/reps/i);
    expect(getRestState().end).toBeNull();
  });

  it('does not run the rest timer between superset exercises', async () => {
    const user = userEvent.setup();
    const row = await startActive();
    render(<WorkoutEditor initial={row} mode="active" sessions={[]} unit="lb" onFinish={() => {}} />);

    await addViaPicker(user, 'Barbell Bench Press - Medium Grip', 'Bent Over Barbell Row'); // added together
    await user.click(screen.getByRole('button', { name: 'Barbell Bench Press - Medium Grip options' }));
    await user.click(screen.getByLabelText('Superset with the next exercise'));

    // Two exercises on screen, so each set label appears twice; use the first (the bench press).
    await user.type(screen.getAllByLabelText('Set 1 weight')[0], '135');
    await user.type(screen.getAllByLabelText('Set 1 reps')[0], '8');
    await user.click(screen.getAllByRole('button', { name: 'Mark set 1 done' })[0]);
    expect(getRestState().end).toBeNull(); // linked to the next exercise: no rest yet

    // The last exercise of the group does start the rest timer.
    await user.type(screen.getAllByLabelText('Set 1 weight')[1], '95');
    await user.type(screen.getAllByLabelText('Set 1 reps')[1], '8');
    await user.click(screen.getAllByRole('button', { name: 'Mark set 1 done' })[0]);
    expect(getRestState().end).not.toBeNull();
  });

  it('changes a set type and deletes a set', async () => {
    const user = userEvent.setup();
    const row = await startActive();
    render(<WorkoutEditor initial={row} mode="active" sessions={[]} unit="lb" onFinish={() => {}} />);

    await addViaPicker(user, 'Barbell Deadlift');
    await user.click(screen.getByRole('button', { name: '+ Add set' }));

    await user.click(screen.getByRole('button', { name: 'Set 1 options' }));
    await user.click(screen.getByRole('button', { name: 'Warm-up' }));
    expect(screen.getByRole('button', { name: 'Set W options' })).toBeTruthy();
    // The next normal set is numbered 1, since warm-ups aren't counted.
    expect(screen.getByRole('button', { name: 'Set 1 options' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Set 1 options' }));
    await user.click(screen.getByRole('button', { name: 'Delete set' }));
    expect(screen.queryByRole('button', { name: 'Set 1 options' })).toBeNull();
  });
});

describe('editing a finished workout', () => {
  it('saves changes and closes', async () => {
    const user = userEvent.setup();
    const s = finishedSession('2026-10-01', 'Legs', 'Squat', [[5, 200]]);
    await saveSession(s);
    const row = await db.sessions.get(s.id);
    const onClose = vi.fn();
    render(<WorkoutEditor initial={row} mode="edit" sessions={[]} unit="lb" onClose={onClose} />);

    const weight = screen.getByLabelText('Set 1 weight');
    await user.clear(weight);
    await user.type(weight, '205');
    await user.click(screen.getByRole('button', { name: '← Back' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const saved = await db.sessions.get(s.id);
    expect(saved.exercises[0].sets[0].weight).toBe(205);
  });

  it('deletes the workout after confirming', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const s = finishedSession('2026-10-01', 'Legs', 'Squat', [[5, 200]]);
    await saveSession(s);
    const row = await db.sessions.get(s.id);
    const onClose = vi.fn();
    render(<WorkoutEditor initial={row} mode="edit" sessions={[]} unit="lb" onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Delete workout' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await db.sessions.get(s.id)).deleted_at).toBeTruthy();
  });
});
