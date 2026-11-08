import lib from '../src/data/library.json';
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

import { adaptPlan, recentNotes } from '../src/plan';
describe('adapting to what you do', () => {
  const p3 = () => mk({ per_week: 3, length: 28, level: 'pro' }); // workouts Mon, Wed, Fri
  const D = (n) => addDays(START, n); // D(0)=Mon
  const wk = (...ns) => ns.map((n) => ({ date: D(n) }));

  it('does nothing when you are on track, before the plan, or after it', () => {
    expect(adaptPlan(p3(), wk(0), D(1)).changed).toBe(false);
    expect(adaptPlan(p3(), [], addDays(START, -3)).changed).toBe(false);
    expect(adaptPlan(p3(), [], addDays(START, 40)).changed).toBe(false);
  });
  it('moves a missed workout to the next rest day when today is also a workout day', () => {
    // Mon done, Wed missed, now Fri (a workout day): Wed's workout moves to Sat.
    const r = adaptPlan(p3(), wk(0), D(4));
    expect(r.changed).toBe(true);
    expect(r.plan.days[2].mv).toBe(true);
    expect(r.plan.days[5]).toMatchObject({ k: 's', adj: 'Moved from Wed' });
    expect(recentNotes(r.plan, D(4))[0].t).toMatch(/missed Wed.*moved to Sat/);
    // Idempotent, and the moved workout no longer counts as planned for Wed.
    expect(adaptPlan(r.plan, wk(0), D(4)).changed).toBe(false);
    expect(planProgress(r.plan, wk(0), D(4)).catchUp).toBeNull();
    expect(cleanPlan(r.plan)).toEqual(r.plan);
  });
  it('waits one day so you can still catch up yourself', () => {
    expect(adaptPlan(p3(), wk(0), D(3)).changed).toBe(false); // Thu: Wed's miss is offered as a catch-up
    expect(adaptPlan(p3(), wk(0), D(4)).changed).toBe(true);
  });
  it('adds a rest day after four days in a row', () => {
    // Trained Mon-Thu (extra Tue and Thu), tomorrow Fri was planned.
    const r = adaptPlan(p3(), wk(0, 1, 2, 3), D(3));
    expect(r.changed).toBe(true);
    expect(r.plan.days[4].mv).toBe(true);
    expect(r.plan.days[5].adj).toBe('Moved from Fri');
    expect(recentNotes(r.plan, D(3))[0].t).toMatch(/4 days in a row/);
  });
  it('lightens a week that follows a rough one', () => {
    const p = mk({ per_week: 4, length: 28, level: 'pro' });
    // Week 1 almost entirely missed, now Monday of week 2.
    const r = adaptPlan(p, wk(0), D(7));
    expect(r.changed).toBe(true);
    const w2 = r.plan.days.slice(7, 14).filter((d) => d.k === 's');
    expect(w2.some((d) => d.mv)).toBe(true);
    expect(w2.filter((d) => !d.mv).every((d) => d.ease)).toBe(true);
    expect(recentNotes(r.plan, D(7)).some((e) => /Last week was tough/.test(e.t))).toBe(true);
  });
  it('eases you back in after a week away', () => {
    const p = mk({ per_week: 4, length: 28, level: 'pro' });
    const r = adaptPlan(p, wk(0), D(9)); // last workout Monday, now Wed of week 2
    expect(r.plan.log.some((e) => e.k.startsWith('back:'))).toBe(true);
    const first = r.plan.days.slice(9).find((d) => d.k === 's' && !d.mv);
    expect(first.ease).toBe(true);
  });
  it('praises two full weeks', () => {
    const p = mk({ per_week: 3, length: 28, level: 'pro' });
    const done = [0, 2, 4, 7, 9, 11].map((n) => ({ date: D(n) }));
    const r = adaptPlan(p, done, D(14));
    expect(recentNotes(r.plan, D(14)).some((e) => /Two full weeks/.test(e.t))).toBe(true);
  });
});

import { topActivityTypes } from '../src/activities';
import { suggestWorkout } from '../src/suggest';
describe('days you are free and what you enjoy', () => {
  const dow = (plan, i) => new Date(`${addDays(plan.start, i)}T12:00:00`).getDay();
  it('only trains on the weekdays you picked and caps workouts at those days', () => {
    const p = mk({ per_week: 4, length: 30, available: [2, 4, 6], time: 'morning' }); // Tue, Thu, Sat
    expect(p).toMatchObject({ available: [2, 4, 6], time: 'morning' });
    const train = p.days.map((d, i) => ({ d, i })).filter(({ d }) => d.k !== 'r');
    expect(train.every(({ i }) => [2, 4, 6].includes(dow(p, i)))).toBe(true);
    expect(train.length).toBeGreaterThanOrEqual(12); // 3 a week for 4 weeks
    expect(cleanPlan(p)).toEqual(p);
  });
  it('spreads fewer workouts evenly across your free days', () => {
    const p = mk({ per_week: 2, length: 14, available: [1, 2, 3, 4, 5] }); // Mon–Fri free, start Monday
    const train = p.days.slice(0, 7).map((d, i) => (d.k !== 'r' ? dow(p, i) : null)).filter((x) => x !== null);
    expect(train).toEqual([1, 5]);
  });
  it('starts mid-week and keeps the pattern on your days', () => {
    const p = mk({ start: '2026-11-11', per_week: 3, available: [1, 3, 5] }); // starts on a Wednesday
    p.days.forEach((d, i) => { if (d.k !== 'r') expect([1, 3, 5]).toContain(dow(p, i)); });
  });
  it('never moves a missed workout onto a day you are not free', () => {
    const p = mk({ per_week: 2, length: 21, available: [1, 3, 5, 6] }); // Mon and Sat planned; Thu is not free
    expect(dow(p, 0)).toBe(1);
    const r = adaptPlan(p, [], addDays(START, 2)); // missed Monday, now Wednesday
    const moved = r.plan.days.findIndex((d) => d.adj);
    expect(dow(p, moved)).toBe(5); // Friday, skipping Thursday
    expect(r.plan.available).toEqual([1, 3, 5, 6]);
  });
  it('ranks activities by what you like and what you log', () => {
    expect(topActivityTypes([], [])).toEqual([]);
    const log = [{ type: 'tennis' }, { type: 'tennis' }, { type: 'run' }];
    expect(topActivityTypes(['swim', 'pickleball'], log).slice(0, 4)).toEqual(['swim', 'pickleball', 'tennis', 'run']);
    expect(topActivityTypes(['yoga'], []).length).toBe(4); // padded with common choices
    expect(topActivityTypes(['other', 'nonsense'], [])).toEqual([]);
  });
  it('uses your interests for non-gym ideas', () => {
    const lib = [{ name: 'Barbell Squat', muscle: 'quadriceps', equipment: 'barbell', category: 'strength', id: 'x', level: 'beginner', compound: true }];
    const s = suggestWorkout({ library: lib, todayStr: '2026-11-07', options: { interests: ['pickleball', 'swim'] } });
    expect(s.ideas.map((i) => i.type)).toEqual(expect.arrayContaining(['pickleball', 'swim']));
    expect(s.ideas.find((i) => i.type === 'pickleball').minutes).toBe(45);
  });
});

import { continuePlan } from '../src/plan';
describe('plans that progress', () => {
  const D2 = (n) => addDays(START, n);
  it('adds a boost after a strong week, with a note, and only once', () => {
    const p = mk({ per_week: 3, length: 21, level: 'pro' });
    const done = [0, 2, 4].map((n) => ({ date: D2(n) }));
    const r = adaptPlan(p, done, D2(7));
    expect(r.plan.boost).toBe(1);
    expect(recentNotes(r.plan, D2(7)).some((e) => /Strong week \(3 of 3\)/.test(e.t))).toBe(true);
    expect(adaptPlan(r.plan, done, D2(7)).changed).toBe(false);
    expect(cleanPlan(r.plan).boost).toBe(1);
    // Another strong week: boost 2, capped at 3.
    const more = [...done, ...[7, 9, 11].map((n) => ({ date: D2(n) }))];
    expect(adaptPlan(r.plan, more, D2(14)).plan.boost).toBe(2);
  });
  it('takes the boost back after a rough week', () => {
    const p = { ...mk({ per_week: 3, length: 21, level: 'pro' }), boost: 2 };
    const r = adaptPlan(p, [], D2(7));
    expect(r.plan.boost).toBe(1);
  });
  it('puts extra sets into suggested workouts, but not on easy days', () => {
    const lib = lib0();
    const base = { library: lib, todayStr: '2026-11-07', options: { focus: 'legs', seed: 1 } };
    const a = suggestWorkout(base);
    const b = suggestWorkout({ ...base, options: { ...base.options, boost: 2 } });
    const c = suggestWorkout({ ...base, options: { ...base.options, boost: 2, ease: true } });
    expect(b.exercises[0].sets).toBe(Math.min(5, a.exercises[0].sets + 2));
    expect(b.exercises[2].sets).toBe(a.exercises[2].sets);
    expect(c.exercises[0].sets).toBeLessThanOrEqual(a.exercises[0].sets);
    expect(b.reasons.join(' ')).toMatch(/extra sets/);
  });
  it('builds the next plan from how this one went', () => {
    const p = mk({ per_week: 3, length: 21, level: 'new' });
    const all = p.days.map((d, i) => ({ d, i })).filter(({ d }) => d.k === 's' || d.k === 'c').map(({ i }) => ({ date: addDays(START, i) }));
    const prog = planProgress(p, all, addDays(START, 25));
    const next = continuePlan({ ...p, boost: 1 }, prog, addDays(START, 25));
    expect(next).toMatchObject({ level: 'some', per_week: 4 });
    expect(next.plan).toMatchObject({ length: 30, level: 'some', per_week: 4, boost: 1, start: addDays(START, 25) });
    expect(next.lines.join(' ')).toMatch(/One more workout/);
    expect(cleanPlan(next.plan).boost).toBe(1);
    // A rough run eases off instead.
    const bad = continuePlan(p, planProgress(p, [], addDays(START, 25)), addDays(START, 25));
    expect(bad).toMatchObject({ level: 'new', per_week: 2 });
  });
});
function lib0() {
  return lib.map(([name, muscle, equipment, category, id, level, m]) => ({ name, muscle, equipment, category, id, level, compound: m === 'c' }));
}
