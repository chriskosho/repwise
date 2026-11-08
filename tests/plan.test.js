import { beforeEach, describe, expect, it } from 'vitest';
import { LENGTHS, addDays, buildPlan, cleanOnboarding, cleanPlan, planProgress, shouldOnboard } from '../src/plan';
import { clearLocalData, getProfile, saveProfile } from '../src/db';
import { buildExport } from '../src/backup';

const START = '2026-11-09'; // a Monday
const mk = (o = {}) => buildPlan({ length: 21, start: START, goal: 'muscle', level: 'some', per_week: 3, minutes: 45, ...o });
const count = (plan, k) => plan.days.filter((d) => d.k === k).length;

beforeEach(clearLocalData);

describe('building plans', () => {
  it('makes the right number of days for each length', () => {
    for (const [n] of LENGTHS) expect(mk({ length: n }).days).toHaveLength(n);
  });
  it('spreads training days with rest between them', () => {
    const p = mk({ per_week: 3 });
    expect(p.days.slice(0, 7).map((d) => d.k)).toEqual(['s', 'r', 's', 'r', 's', 'r', 'r']);
    expect(count(mk({ per_week: 5, length: 7 }), 's') + count(mk({ per_week: 5, length: 7 }), 'c')).toBe(5);
    expect(mk({ per_week: 6 }).days.slice(0, 7).filter((d) => d.k === 'r')).toHaveLength(1);
  });
  it('eases new lifters in, with at most three days and easy sets in week 1', () => {
    const p = mk({ level: 'new', per_week: 5 });
    const w1 = p.days.slice(0, 7);
    expect(w1.filter((d) => d.k !== 'r' && d.k !== 'a')).toHaveLength(3);
    expect(w1.filter((d) => d.k === 's').every((d) => d.ease)).toBe(true);
    expect(p.days.slice(7, 14).filter((d) => d.k === 's').some((d) => d.ease)).toBe(false);
    expect(p.days.slice(7, 14).filter((d) => d.k !== 'r' && d.k !== 'a')).toHaveLength(5);
  });
  it('adds lighter weeks to long plans', () => {
    const p30 = mk({ length: 30, level: 'pro' });
    expect(p30.days.slice(21, 28).filter((d) => d.k === 's').every((d) => d.ease)).toBe(true);
    const p60 = mk({ length: 60, level: 'pro' });
    expect(p60.days.slice(49, 56).filter((d) => d.k === 's').every((d) => d.ease)).toBe(true);
    expect(mk({ length: 21, level: 'pro' }).days.some((d) => d.ease)).toBe(false);
  });
  it('mixes in cardio for weight loss and uses the cardio you like', () => {
    const lose = mk({ goal: 'lose', per_week: 4, cardio: ['swim', 'row'] });
    const cardio = lose.days.filter((d) => d.k === 'c');
    expect(cardio.length).toBeGreaterThanOrEqual(3);
    expect(new Set(cardio.map((d) => d.t))).toEqual(new Set(['swim', 'row']));
    expect(count(mk({ goal: 'strength', per_week: 3 }), 'c')).toBe(0);
    expect(mk({ goal: 'strength', per_week: 3, level: 'pro' }).days.slice(0, 5).filter((d) => d.k === 's').map((d) => d.f)).toEqual(['push', 'pull', 'legs']);
  });
  it('survives cleaning unchanged and rejects broken plans', () => {
    const p = mk({ length: 30, goal: 'lose' });
    expect(cleanPlan(p)).toEqual(p);
    expect(cleanPlan({ ...p, days: p.days.slice(1) })).toBeNull();
    expect(cleanPlan({ ...p, start: 'tomorrow' })).toBeNull();
    expect(cleanPlan(null)).toBeNull();
    expect(cleanPlan({ ...p, days: p.days.map((d) => ({ ...d, k: 'zzz' })) }).days.every((d) => d.k === 'r')).toBe(true);
  });
});

describe('progress', () => {
  const p = mk({ per_week: 3 }); // workouts on days 1, 3, 5 (Mon, Wed, Fri)
  it('reports before, during and after the plan', () => {
    expect(planProgress(p, [], addDays(START, -2)).status).toBe('upcoming');
    expect(planProgress(p, [], START)).toMatchObject({ status: 'active', dayNumber: 1 });
    expect(planProgress(p, [], addDays(START, 30)).status).toBe('finished');
  });
  it('tracks completed days and offers to catch up on a missed one', () => {
    const wed = addDays(START, 2);
    const noneYet = planProgress(p, [], wed);
    expect(noneYet.today.k).toBe('s');
    expect(noneYet.catchUp).toBeNull(); // today's workout is still to do
    const thu = addDays(START, 3);
    const r = planProgress(p, [{ date: START }], thu);
    expect(r.done).toBe(1);
    expect(r.today.k).toBe('r');
    expect(r.catchUp.date).toBe(wed);
    expect(r.next.date).toBe(addDays(START, 4));
    expect(r.planned).toBe(9);
    expect(r.percent).toBe(11);
  });
});

describe('storage and gating', () => {
  it('keeps onboarding and the plan on the profile, cleaned', async () => {
    const plan = mk();
    await saveProfile({ onboarding: { goal: 'lose', per_week: 4, junk: 1 }, plan });
    const prof = await getProfile();
    expect(prof.onboarding).toEqual({ goal: 'lose', per_week: 4 });
    expect(prof.plan).toEqual(plan);
    await saveProfile({ plan: { length: 3 } });
    expect((await getProfile()).plan).toBeNull();
    expect(cleanOnboarding({})).toBeNull();
  });
  it('travels in a backup', async () => {
    await saveProfile({ onboarding: { goal: 'muscle' }, plan: mk() });
    const out = await buildExport();
    expect(out.profile.plan.length).toBe(21);
    expect(out.profile.onboarding.goal).toBe('muscle');
  });
  it('only welcomes people who are new, and waits for sync', () => {
    const base = { profile: null, workoutCount: 0, signedIn: false, synced: false };
    expect(shouldOnboard(base)).toBe(true);
    expect(shouldOnboard({ ...base, profile: undefined })).toBe(false);
    expect(shouldOnboard({ ...base, workoutCount: 3 })).toBe(false);
    expect(shouldOnboard({ ...base, profile: { onboarding: { skipped: true } } })).toBe(false);
    expect(shouldOnboard({ ...base, signedIn: true, synced: false })).toBe(false);
    expect(shouldOnboard({ ...base, signedIn: true, synced: true })).toBe(true);
  });
});
