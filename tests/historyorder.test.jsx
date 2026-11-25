import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import History from '../src/components/History';
import { db, newActivity, newSession, saveActivity } from '../src/db';

beforeEach(async () => {
  await db.sessions.clear();
  await db.activities.clear();
});
afterEach(cleanup);

const lift = (date, i) => ({
  ...newSession(),
  id: `s${i}`,
  date,
  name: `Lift ${i}`,
  ended_at: `${date}T10:00:00.000Z`,
  exercises: [{ id: `e${i}`, name: 'Squat', sets: [{ id: `x${i}`, type: 'normal', reps: 5, weight: 100, done: true }] }],
});

it('shows an activity-only day in date order, not after every gym day', async () => {
  // 20 gym days, then a run on a newer day with no gym session.
  for (let i = 0; i < 20; i++) await db.sessions.put(lift(`2026-10-${String(i + 1).padStart(2, '0')}`, i));
  await saveActivity({ ...newActivity('2026-11-05'), type: 'run', duration_min: 30 });
  render(<History unit="lb" onOpen={() => {}} onOpenActivity={() => {}} />);
  await screen.findByRole('heading', { level: 3, name: /Nov 5/ });
  const days = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
  expect(days[0]).toMatch(/Nov 5/);
  await waitFor(() => expect(days.length).toBeGreaterThan(1));
});
