import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import { fmtDuration, fromSeconds, toSeconds } from '../src/activities';
import ActivityEditor from '../src/components/ActivityEditor';
import { blankSet, db, listActivities, listSessions, newActivity, newSession, saveSession } from '../src/db';

beforeEach(async () => {
  await db.sessions.clear();
  await db.activities.clear();
  localStorage.clear();
});
afterEach(cleanup);

describe('durations with seconds', () => {
  it('formats whole minutes as before and adds seconds when there are some', () => {
    expect(fmtDuration(45)).toBe('45 min');
    expect(fmtDuration(60)).toBe('1 h');
    expect(fmtDuration(75)).toBe('1 h 15 min');
    expect(fmtDuration(12.5)).toBe('12 min 30 s');
    expect(fmtDuration(0.75)).toBe('45 s');
    expect(fmtDuration(62 + 5 / 60)).toBe('1 h 2 min 5 s');
  });
  it('round-trips every second count through minutes', () => {
    for (let s = 1; s < 3 * 3600; s += 7) expect(toSeconds(fromSeconds(s))).toBe(s);
    expect(toSeconds(fromSeconds(20))).toBe(20);
  });
});

describe('activity form', () => {
  it('saves hours, minutes and seconds, and shows them again when editing', async () => {
    const user = userEvent.setup();
    const doc = { ...newActivity('2026-11-02'), type: 'run' };
    const { unmount } = render(<ActivityEditor initial={doc} isNew places={[]} unit="lb" onClose={() => {}} />);
    await user.type(screen.getByLabelText('Hours'), '1');
    await user.type(screen.getByLabelText('Minutes'), '2');
    await user.type(screen.getByLabelText('Seconds'), '5');
    await user.click(screen.getByRole('button', { name: 'Save activity' }));
    const [saved] = await listActivities();
    expect(toSeconds(saved.duration_min)).toBe(3725);
    unmount();
    render(<ActivityEditor initial={saved} isNew={false} places={[]} unit="lb" onClose={() => {}} />);
    expect(screen.getByLabelText('Hours').value).toBe('1');
    expect(screen.getByLabelText('Minutes').value).toBe('2');
    expect(screen.getByLabelText('Seconds').value).toBe('5');
  });
  it('accepts a short effort in seconds only', async () => {
    const user = userEvent.setup();
    render(<ActivityEditor initial={{ ...newActivity('2026-11-02'), type: 'run' }} isNew places={[]} unit="lb" onClose={() => {}} />);
    await user.type(screen.getByLabelText('Seconds'), '45');
    await user.click(screen.getByRole('button', { name: 'Save activity' }));
    expect(toSeconds((await listActivities())[0].duration_min)).toBe(45);
  });
});

describe('cardio sets', () => {
  async function startCardio() {
    const s = newSession();
    s.exercises = [{ id: crypto.randomUUID(), name: 'Running, Treadmill', mode: 'cardio', link: false, notes: '', sets: [blankSet()] }];
    await saveSession(s);
  }
  async function logTime(text) {
    await startCardio();
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText('Set 1 minutes'), text);
    await user.click(screen.getByRole('button', { name: 'Mark set 1 done' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await screen.findByText('Workout complete');
    return (await listSessions())[0].exercises[0].sets[0].time;
  }
  it('takes minutes and seconds as 12:30', async () => {
    expect(await logTime('12:30')).toBe(750);
  });
  it('still takes plain and decimal minutes', async () => {
    expect(await logTime('12.5')).toBe(750);
  });
});
