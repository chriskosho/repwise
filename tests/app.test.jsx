import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import { db } from '../src/db';
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

it('walks through start, log, finish, history and editing', async () => {
  const user = userEvent.setup();
  render(<App />);

  // Start a workout.
  await user.click(await screen.findByRole('button', { name: 'Start workout' }));
  expect(await screen.findByLabelText('Workout name')).toBeTruthy();

  // Log one set.
  await user.click(screen.getByRole('button', { name: '+ Add exercise' }));
  await user.type(screen.getByLabelText('Search exercises'), 'Zercher squat');
  await user.click(screen.getByRole('button', { name: /Create “Zercher squat”/ }));
  await user.click(screen.getByRole('button', { name: 'Create and select' }));
  await user.click(await screen.findByRole('button', { name: 'Add 1 exercise' }));
  await user.type(screen.getByLabelText('Set 1 weight'), '100');
  await user.type(screen.getByLabelText('Set 1 reps'), '10');
  await user.click(screen.getByRole('button', { name: 'Mark set 1 done' }));

  // Finish: summary, then back to the start screen with the workout under Recent.
  await user.click(screen.getByRole('button', { name: 'Finish' }));
  expect(await screen.findByText('Workout complete')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Done' }));
  expect(await screen.findByRole('button', { name: 'Start workout' })).toBeTruthy();
  expect(screen.getByText('Recent')).toBeTruthy();

  // History lists it; opening it shows the editor with the logged set.
  await user.click(screen.getByRole('button', { name: 'History' }));
  await user.click(await screen.findByText('Zercher squat'));
  expect((await screen.findByLabelText('Set 1 weight')).value).toBe('100');

  // Leaving the editor returns to History.
  await user.click(screen.getByRole('button', { name: '← Done' }));
  await waitFor(() => expect(screen.queryByLabelText('Set 1 weight')).toBeNull());
  expect(await screen.findByText('Zercher squat')).toBeTruthy();

  // Settings shows the workout preferences.
  await user.click(screen.getByRole('button', { name: 'Settings' }));
  expect(screen.getByText('Keep the screen on during a workout')).toBeTruthy();
});

it('resumes a workout that was in progress after a reload', async () => {
  const user = userEvent.setup();
  const first = render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Start workout' }));
  await user.click(await screen.findByRole('button', { name: '+ Add exercise' }));
  await user.type(screen.getByLabelText('Search exercises'), 'Barbell Curl');
  await user.click(await screen.findByRole('button', { name: 'Barbell Curl' }));
  await user.click(screen.getByRole('button', { name: 'Add 1 exercise' }));
  await user.type(screen.getByLabelText('Set 1 reps'), '12');
  first.unmount(); // like closing the tab: the editor flushes on the way out

  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Barbell Curl' })).toBeTruthy();
  expect((await screen.findByLabelText('Set 1 reps')).value).toBe('12');
  expect(screen.queryByRole('button', { name: 'Start workout' })).toBeNull();
});
