import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Progress from '../src/components/Progress';
import { clearLocalData, db, saveCustomExercise } from '../src/db';

const set = (reps, weight, type = 'normal') => ({ id: crypto.randomUUID(), type, reps, weight, done: true });
async function seed(date, name, sets) {
  await db.sessions.put({
    id: crypto.randomUUID(), date, name: 'Workout', started_at: `${date}T09:00:00.000Z`, ended_at: `${date}T10:00:00.000Z`,
    notes: '', created_at: `${date}T09:00:00.000Z`, deleted_at: null, dirty: 0, rev: 1,
    exercises: [{ id: crypto.randomUUID(), name, link: false, notes: '', sets }],
  });
}

beforeEach(() => clearLocalData());
afterEach(cleanup);

it('lists personal records and filters them', async () => {
  await seed('2026-10-01', 'Barbell Squat', [set(5, 100), set(1, 120)]);
  await seed('2026-10-05', 'Overhead Press', [set(8, 40)]);
  const user = userEvent.setup();
  render(<Progress unit="lb" />);
  await user.click(await screen.findByRole('tab', { name: 'Records' }));
  expect(await screen.findByText('Barbell Squat')).toBeTruthy();
  expect(screen.getByText('Overhead Press')).toBeTruthy();
  expect(screen.getAllByText('120 lb').length).toBeGreaterThan(0); // heaviest (and est. 1RM)
  expect(screen.getByText(/^× 1 · /)).toBeTruthy();
  await user.type(screen.getByLabelText('Find an exercise'), 'press');
  expect(screen.queryByText('Barbell Squat')).toBeNull();
  expect(screen.getByText('Overhead Press')).toBeTruthy();
});

it('shows sets by muscle for this week, including your own exercises', async () => {
  const d = new Date().toLocaleDateString('en-CA');
  await saveCustomExercise({ name: 'Zercher hold', muscle: 'abdominals' });
  await seed(d, 'Zercher hold', [set(10, 50), set(10, 50), set(10, 20, 'warmup')]);
  const user = userEvent.setup();
  render(<Progress unit="lb" />);
  await user.click(await screen.findByRole('tab', { name: 'Volume' }));
  expect(await screen.findByText('Abs')).toBeTruthy();
  expect(screen.getByText(/2 sets · 1,000 lb/)).toBeTruthy();
  expect(screen.getByText(/2 working sets/)).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Previous week' }));
  expect(await screen.findByText('No finished workouts in this week.')).toBeTruthy();
});

it('marks workout days on the calendar and shows the day on tap', async () => {
  const d = new Date().toLocaleDateString('en-CA');
  await seed(d, 'Barbell Squat', [set(5, 100)]);
  const user = userEvent.setup();
  render(<Progress unit="lb" />);
  await user.click(await screen.findByRole('tab', { name: 'Calendar' }));
  const day = await screen.findByRole('button', { name: `${d}, 1 workout` });
  expect(within(screen.getByText('Week streak').parentElement).getByText('1')).toBeTruthy();
  await user.click(day);
  expect(await screen.findByText(/Workout: 1 exercise, 1 set, 500 lb/)).toBeTruthy();
});

it('plate calculator loads 225 lb and says when plates run out', async () => {
  const user = userEvent.setup();
  render(<Progress unit="lb" />);
  await user.click(await screen.findByRole('tab', { name: 'Tools' }));
  await user.type(screen.getByLabelText('Target weight (lb)'), '225');
  expect(await screen.findByText(/2 × 45/)).toBeTruthy();
  await user.clear(screen.getByLabelText('Target weight (lb)'));
  await user.type(screen.getByLabelText('Target weight (lb)'), '100');
  await user.click(screen.getByRole('checkbox', { name: '10' }));
  await user.click(screen.getByRole('checkbox', { name: '5' }));
  await user.click(screen.getByRole('checkbox', { name: '2.5' }));
  expect(await screen.findByText(/short/)).toBeTruthy();
});

it('warm-up calculator builds a ramp, and the kg tools use kg defaults', async () => {
  const user = userEvent.setup();
  const { rerender } = render(<Progress unit="lb" />);
  await user.click(await screen.findByRole('tab', { name: 'Tools' }));
  await user.type(screen.getByLabelText('Working weight (lb)'), '225');
  expect(await screen.findByText('90 lb × 5')).toBeTruthy();
  expect(screen.getByText('180 lb × 2')).toBeTruthy();
  rerender(<Progress unit="kg" />);
  expect(screen.getByLabelText('Bar (kg)').value).toBe('20');
});
