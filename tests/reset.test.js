import { describe, expect, it } from 'vitest';
import { db, getProfile, saveProfile } from '../src/db';
import { resetDevice } from '../src/reset';

describe('resetDevice', () => {
  it('wipes data and repwise settings, and signs out first', async () => {
    await saveProfile({ display_name: 'Sam', onboarding: { goal: 'muscle' } });
    localStorage.setItem('repwise.seenRelease', '2.1');
    localStorage.setItem('other', 'keep');
    let out = 0;
    await resetDevice(async () => {
      out += 1;
    });
    expect(out).toBe(1);
    expect(localStorage.getItem('repwise.seenRelease')).toBeNull();
    expect(localStorage.getItem('other')).toBe('keep');
    expect((await getProfile())?.onboarding ?? null).toBeNull();
    expect(await db.sessions.count()).toBe(0);
  });
});
