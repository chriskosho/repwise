import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import ProgressCharts from '../src/components/ProgressCharts';
import History from '../src/components/History';
import { clearLocalData, db, listBodyEntries, saveBodyEntry, saveProfile } from '../src/db';
import { setPrefs } from '../src/prefs';
import { stopRest } from '../src/rest';
import { plural } from '../src/stats';

const set = (reps, weight, type = 'normal') => ({ id: crypto.randomUUID(), type, reps, weight, done: true });
async function seed(date, name, sets, finished = true) {
  await db.sessions.put({
    id: crypto.randomUUID(), date, name: 'Workout', started_at: `${date}T09:00:00.000Z`, ended_at: finished ? `${date}T10:00:00.000Z` : null,
    notes: '', created_at: `${date}T09:00:00.000Z`, deleted_at: null, dirty: 0, rev: 1,
    exercises: [{ id: crypto.randomUUID(), name, link: false, notes: '', sets }],
  });
}

beforeEach(async () => {
  await clearLocalData();
  localStorage.clear();
  setPrefs({ restEnabled: false, alerts: false, keepAwake: false });
});
afterEach(() => {
  cleanup();
  stopRest();
});

it('says "1 set" and "2 sets"', () => {
  expect(plural(1, 'set')).toBe('1 set');
  expect(plural(2, 'set')).toBe('2 sets');
  expect(plural(1, 'entry', 'entries')).toBe('1 entry');
});

it('lift charts ignore a workout that is still in progress', async () => {
  await seed('2026-10-01', 'Bench', [set(5, 150)]);
  await seed('2026-10-08', 'Bench', [set(5, 160)]);
  await seed('2026-10-09', 'Bench', [set(10, 45, 'normal')], false); // mid-workout
  render(<ProgressCharts unit="lb" />);
  const latest = (await screen.findByText('Latest')).parentElement;
  expect(latest.textContent).toContain('160 lb');
  expect(screen.getByText('Sessions').parentElement.textContent).toContain('2');
});

it('greets you by name and counts this week on the home screen', async () => {
  await saveProfile({ display_name: 'Chris' });
  await seed(new Date().toLocaleDateString('en-CA'), 'Squat', [set(5, 100)]);
  render(<App />);
  expect(await screen.findByText(/, Chris$/)).toBeTruthy();
  expect(screen.getByText(/1 workout this week/)).toBeTruthy();
});

it('deletes a body entry from the form after a confirming tap', async () => {
  const d = new Date().toLocaleDateString('en-CA');
  await saveBodyEntry({ date: d, weight_kg: 80 });
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Body' }));
  await user.click(await screen.findByRole('button', { name: 'Delete entry' }));
  expect(await listBodyEntries()).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: /^Yes, delete / }));
  await waitFor(async () => expect(await listBodyEntries()).toHaveLength(0));
  expect(await screen.findByRole('button', { name: 'Save entry' })).toBeTruthy();
});

it('tapping a body history row loads that day into the form', async () => {
  await saveBodyEntry({ date: '2026-10-01', weight_kg: 90 });
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Body' }));
  await user.click(await screen.findByRole('button', { name: 'Edit entry 2026-10-01' }));
  expect(screen.getByLabelText('Date').value).toBe('2026-10-01');
  expect(screen.getByLabelText('Weight (lb)').value).toBe('198.4');
  expect(screen.getByRole('button', { name: 'Update entry' })).toBeTruthy();
});

it('history shows 15 days at a time', async () => {
  for (let i = 1; i <= 17; i++) await seed(`2026-09-${String(i).padStart(2, '0')}`, 'Squat', [set(5, 100)]);
  const user = userEvent.setup();
  render(<History unit="lb" onOpen={() => {}} />);
  expect((await screen.findAllByText('Squat')).length).toBe(15);
  await user.click(screen.getByRole('button', { name: /Show more \(2 more days\)/ }));
  expect(screen.getAllByText('Squat').length).toBe(17);
});
