import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import WorkoutEditor from '../src/components/WorkoutEditor';
import { DayIcon, dayKind } from '../src/components/Icons';
import { db, newSession, saveProfile } from '../src/db';
import { setPrefs } from '../src/prefs';
import { stopRest } from '../src/rest';

beforeEach(async () => {
  await db.sessions.clear();
  await db.routines.clear();
  localStorage.clear();
  setPrefs({ restEnabled: false, alerts: false, keepAwake: false });
});
afterEach(() => {
  cleanup();
  stopRest();
});

it('gives every main screen exactly one page title', async () => {
  const user = userEvent.setup();
  await saveProfile({ onboarding: { skipped: true } });
  render(<App />);
  await screen.findByRole('heading', { level: 1, name: 'Workout' });
  for (const name of ['History', 'Progress', 'Food', 'Body', 'Settings']) {
    await user.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: new RegExp(name === "Food" ? "^(Food|Journal)" : `^${name}`) }));
    await waitFor(() => expect(screen.getAllByRole('heading', { level: 1 }).filter((h) => h.classList.contains('page-title')).length).toBe(1));
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  }
});

it('keeps Done the only filled button in the workout editor', async () => {
  const row = { ...newSession(), name: 'Push', exercises: [] };
  await db.sessions.put(row);
  render(<WorkoutEditor initial={row} mode="active" sessions={[]} unit="lb" onFinish={() => {}} />);
  const filled = screen.getAllByRole('button').filter((b) => b.classList.contains('btn') && !b.classList.contains('btn-ghost') && !b.classList.contains('btn-link'));
  expect(filled.map((b) => b.textContent)).toEqual(['Done']);
  for (const label of ['+ Add exercise', '+ Add routine', '+ Add stretches']) expect(screen.getByRole('button', { name: label }).classList.contains('btn-ghost')).toBe(true);
});

it('draws every week-strip day from one icon set', () => {
  const kinds = [{ done: true }, { k: 'r' }, { k: 'c' }, { k: 'a' }, { k: 's' }].map((d) => dayKind(d, d.k === 'r'));
  expect(kinds).toEqual(['done', 'rest', 'cardio', 'activity', 'lift']);
  for (const kind of kinds) {
    const { container, unmount } = render(<DayIcon kind={kind} />);
    expect(container.querySelector('svg path, svg circle')).toBeTruthy();
    expect(container.textContent).toBe('');
    unmount();
  }
});

it('keeps the sync pill small unless something is wrong', async () => {
  await saveProfile({ onboarding: { skipped: true } });
  render(<App />);
  const pill = await screen.findByRole('button', { name: 'Local only' });
  expect(pill.className).toContain('chip-idle');
  expect(pill.className).not.toMatch(/chip-(error|warn)/);
});

it('does not send a returning user to first-run onboarding while their data loads', async () => {
  // A profile from before onboarding existed, with finished workouts.
  const s = { ...newSession(), name: 'Old', ended_at: new Date().toISOString(), exercises: [{ id: 'e', name: 'Squat', sets: [{ id: 's', type: 'normal', reps: 5, weight: 100, done: true }] }] };
  await db.sessions.put(s);
  await saveProfile({ display_name: 'Pat' });
  render(<App />);
  await screen.findByRole('heading', { level: 1, name: 'Workout' });
  expect(screen.queryByText(/Step 1 of 5/)).toBeNull();
});
