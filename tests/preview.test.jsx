import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clearLocalData, listRoutines, saveProfile } from '../src/db';
import App from '../src/App';
import { lastWeight, routineMinutes, targetLine } from '../src/components/RoutinePreview';

describe('routine preview helpers', () => {
  it('summarises targets', () => {
    expect(targetLine({ sets: [{}, {}, {}], target: { reps: 8 } })).toBe('3 × 8');
    expect(targetLine({ sets: [{}, {}], target: { time: 30 } })).toContain('30');
    expect(targetLine({ sets: [{}, {}] })).toBe('2 sets');
  });
  it('finds the last weight used', () => {
    const sessions = [
      { ended_at: 1, date: '2026-11-01', exercises: [{ name: 'Leg Press', sets: [{ done: true, type: 'normal', weight: 100, reps: 10 }] }] },
      { ended_at: 1, date: '2026-11-05', exercises: [{ name: 'leg press', sets: [{ done: true, type: 'normal', weight: 120, reps: 10 }] }] },
    ];
    expect(lastWeight('Leg Press', sessions)).toBe(120);
    expect(lastWeight('Squat', sessions)).toBe(0);
  });
  it('estimates minutes', () => {
    expect(routineMinutes({ exercises: [{ sets: [{}, {}, {}] }, { sets: [{}, {}, {}] }] })).toBeGreaterThan(10);
  });
});

describe('previewing without adding', () => {
  beforeEach(async () => { await clearLocalData(); await saveProfile({ onboarding: { skipped: true } }); });
  afterEach(async () => { cleanup(); await new Promise((r) => setTimeout(r, 150)); await clearLocalData(); });

  it('shows a starter without saving it, and adds it on request', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /^Routines/ }, { timeout: 4000 }));
    await user.click(await screen.findByRole('button', { name: 'View Push day' }));
    expect(await screen.findByRole('heading', { name: 'Push day' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /How to:/ }).length).toBeGreaterThan(2);
    expect((await listRoutines()).length).toBe(0);
    await user.click(screen.getByRole('button', { name: '← Back' }));
    await user.click(await screen.findByRole('button', { name: 'View Push day' }));
    await user.click(await screen.findByRole('button', { name: 'Add to my routines' }));
    await waitFor(async () => expect((await listRoutines()).length).toBe(1));
  });
});
