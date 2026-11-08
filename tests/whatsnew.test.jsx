import { describe, expect, it } from 'vitest';
import { LATEST, RELEASES, shouldShowWhatsNew } from '../src/changelog';
import { DONATE_URL } from '../src/share';

describe('changelog', () => {
  it('shows once per release that has highlights', () => {
    expect(shouldShowWhatsNew('', LATEST)).toBe(true);
    expect(shouldShowWhatsNew('1.0', LATEST)).toBe(true);
    expect(shouldShowWhatsNew(LATEST.id, LATEST)).toBe(false);
    expect(shouldShowWhatsNew('x', { id: '9', highlights: [] })).toBe(false);
  });
  it('has unique ids and items for every release', () => {
    const ids = RELEASES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    RELEASES.forEach((r) => expect(r.items.length).toBeGreaterThan(0));
  });
  it('points donations at PayPal', () => {
    expect(DONATE_URL).toBe('https://paypal.me/chriskosho');
  });
});
