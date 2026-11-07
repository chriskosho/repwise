import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import Settings from '../src/components/Settings';
import { clearLocalData, getProfile, listBodyEntries, listGoals, saveBodyEntry } from '../src/db';
import { setPrefs } from '../src/prefs';
import { stopRest } from '../src/rest';

beforeEach(async () => {
  await clearLocalData();
  localStorage.clear();
  setPrefs({ restEnabled: false, alerts: false, keepAwake: false });
});
afterEach(() => {
  cleanup();
  stopRest();
});

it('logs a weigh-in in pounds, stores kg, and shows it in the history', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Body' }));
  await user.type(await screen.findByLabelText('Weight (lb)'), '180');
  await user.type(screen.getByLabelText('Body fat (%)'), '18');
  await user.click(screen.getByRole('button', { name: 'Save entry' }));
  expect(await screen.findByText('Saved.')).toBeTruthy();

  const [e] = await listBodyEntries();
  expect(e.weight_kg).toBeCloseTo(81.65, 2);
  expect(e.body_fat).toBe(18);
  expect(await screen.findByText(/180 lb · 18% fat/)).toBeTruthy();
  // Saving the same day again updates rather than adding.
  expect(screen.getByRole('button', { name: 'Update entry' })).toBeTruthy();
});

it('shows weights in kg when the profile unit is kg', async () => {
  await saveBodyEntry({ date: '2026-11-01', weight_kg: 80 });
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.selectOptions(await screen.findByLabelText('Weight unit'), 'kg');
  await waitFor(async () => expect((await getProfile()).units).toBe('kg'));
  await user.click(screen.getByRole('button', { name: 'Body' }));
  expect((await screen.findAllByText(/80 kg/)).length).toBeGreaterThan(0);
  expect(screen.queryByText(/176.4 lb/)).toBeNull();
});

it('adds a weekly goal, and a body-weight goal only once there is a weigh-in', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Body' }));

  // Weekly workouts: default target 3.
  await user.click(await screen.findByRole('button', { name: 'Add goal' }));
  await user.click(screen.getByRole('button', { name: 'Add goal' }));
  expect(await screen.findByText(/3 workouts a week: 0 so far this week/)).toBeTruthy();

  // Body weight needs a starting weigh-in.
  await user.click(screen.getByRole('button', { name: 'Add goal' }));
  await user.selectOptions(screen.getByLabelText('Goal type'), 'body_weight');
  await user.type(screen.getByLabelText('Target weight (lb)'), '170');
  await user.click(screen.getByRole('button', { name: 'Add goal' }));
  expect((await screen.findByRole('alert')).textContent).toMatch(/Log your weight first/);
  expect(await listGoals()).toHaveLength(1);

  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await saveBodyEntry({ date: '2026-11-01', weight_kg: 81.65 });
  await user.click(screen.getByRole('button', { name: 'Add goal' }));
  await user.selectOptions(screen.getByLabelText('Goal type'), 'body_weight');
  await user.type(screen.getByLabelText('Target weight (lb)'), '170');
  await user.click(screen.getByRole('button', { name: 'Add goal' }));
  expect(await screen.findByText(/Reach 170 lb: now 180/)).toBeTruthy();
  const goals = await listGoals();
  expect(goals).toHaveLength(2);
  expect(goals[1].target).toBeCloseTo(77.11, 2); // stored in kg
  expect(goals[1].start_value).toBeCloseTo(81.65, 2);

  // Remove needs a second tap.
  await user.click(screen.getByRole('button', { name: 'Remove goal: Body weight' }));
  await user.click(screen.getByRole('button', { name: 'Yes, remove' }));
  await waitFor(async () => expect(await listGoals()).toHaveLength(1));
});

function fakeSync(overrides = {}) {
  return {
    enabled: true,
    session: { user: { email: 'me@example.com' } },
    status: 'idle',
    error: '',
    lastSynced: null,
    pending: 0,
    syncNow: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    deleteAccount: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

it('saves the profile', async () => {
  const user = userEvent.setup();
  render(<Settings sync={fakeSync()} unit="lb" setUnit={() => {}} onExported={() => {}} />);
  await user.type(await screen.findByLabelText('Name'), '  Chris ');
  await user.type(screen.getByLabelText('Height (in)'), '71');
  await user.click(screen.getByRole('button', { name: 'Save profile' }));
  expect(await screen.findByText('Saved.')).toBeTruthy();
  const p = await getProfile();
  expect(p.display_name).toBe('Chris');
  expect(p.height_cm).toBeCloseTo(180.34, 2);
});

it('only deletes the account after typing DELETE', async () => {
  const user = userEvent.setup();
  const sync = fakeSync();
  render(<Settings sync={sync} unit="lb" setUnit={() => {}} onExported={() => {}} />);
  await user.click(screen.getByRole('button', { name: /Delete my account/ }));
  const go = screen.getByRole('button', { name: 'Permanently delete my account' });
  expect(go.disabled).toBe(true);
  await user.type(screen.getByLabelText('Type DELETE to confirm'), 'delete');
  expect(go.disabled).toBe(true); // case matters
  await user.clear(screen.getByLabelText('Type DELETE to confirm'));
  await user.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
  expect(go.disabled).toBe(false);
  await user.click(go);
  await waitFor(() => expect(sync.deleteAccount).toHaveBeenCalledTimes(1));
});

it('reports a failed deletion and lets you retry', async () => {
  const user = userEvent.setup();
  const sync = fakeSync({ deleteAccount: vi.fn().mockRejectedValue(new Error('network down')) });
  render(<Settings sync={sync} unit="lb" setUnit={() => {}} onExported={() => {}} />);
  await user.click(screen.getByRole('button', { name: /Delete my account/ }));
  await user.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
  await user.click(screen.getByRole('button', { name: 'Permanently delete my account' }));
  expect((await screen.findByRole('alert')).textContent).toMatch(/network down/);
  expect(screen.getByRole('button', { name: 'Permanently delete my account' }).disabled).toBe(false);
});

it('asks before signing out, and warns about changes that have not uploaded', async () => {
  const user = userEvent.setup();
  const sync = fakeSync({ pending: 2 });
  render(<Settings sync={sync} unit="lb" setUnit={() => {}} onExported={() => {}} />);
  await user.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(sync.signOut).not.toHaveBeenCalled();
  expect(screen.getByText(/2 changes haven’t uploaded yet/)).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Sign out and clear this device' }));
  expect(sync.signOut).toHaveBeenCalledTimes(1);
});

it('does not offer account deletion when signed out', () => {
  render(<Settings sync={fakeSync({ session: null })} unit="lb" setUnit={() => {}} onExported={() => {}} />);
  expect(screen.queryByRole('button', { name: /Delete my account/ })).toBeNull();
  expect(screen.getByText('Privacy')).toBeTruthy();
});
