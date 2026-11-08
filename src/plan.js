// Starter plans: a day-by-day schedule built from a few questions. Pure functions.
// A plan is stored on your profile as { v, length, start, goal, level, per_week, minutes,
// gear, cardio, days: [{ k, f, m, t, ease }] }. Dates come from `start` + day number.
import { ACTIVITY_TYPES } from './activities';

export const LENGTHS = [
  [7, 'Kick-start week', 'A first week to find your rhythm and try the app.'],
  [21, 'Habit builder', 'Three weeks, long enough for training to start feeling normal.'],
  [30, 'Month challenge', 'A month of steady progress with a lighter week to recover.'],
  [60, 'Two-month build', 'Real change: gradual progress with two lighter weeks built in.'],
];
export const GOALS = [
  ['muscle', 'Build muscle', 'Add size and shape with moderate weights.'],
  ['strength', 'Get stronger', 'Lift heavier over time with lower reps.'],
  ['lose', 'Lose weight', 'Lifting plus cardio, with a steady pace.'],
  ['endurance', 'Build endurance', 'More cardio, with strength to support it.'],
  ['health', 'Feel healthier', 'A balanced mix to move more and feel good.'],
];
export const LEVELS = [
  ['new', 'New to this', 'Little or no training. We start easy.'],
  ['some', 'Some experience', 'You have trained on and off.'],
  ['pro', 'Experienced', 'You train regularly and know the lifts.'],
];
export const DAYS_PER_WEEK = [2, 3, 4, 5, 6];
export const TIMES_OF_DAY = [
  ['morning', 'Morning'],
  ['afternoon', 'Afternoon'],
  ['evening', 'Evening'],
  ['any', 'It varies'],
];
export const WEEKDAYS = [
  [0, 'Sun'],
  [1, 'Mon'],
  [2, 'Tue'],
  [3, 'Wed'],
  [4, 'Thu'],
  [5, 'Fri'],
  [6, 'Sat'],
];
export const CARDIO_CHOICES = ['walk', 'run', 'cycle', 'swim', 'row', 'hike', 'elliptical'];
export const STYLE_FOR_GOAL = { muscle: 'muscle', strength: 'strength', lose: 'lean', endurance: 'lean', health: 'general' };
const FOCI = new Set(['push', 'pull', 'legs', 'core', 'full']);
const KINDS = new Set(['s', 'c', 'a', 'r']);
const GEARS = new Set(['gym', 'dumbbells', 'bodyweight']);
const CARDIO_TYPES = new Set(ACTIVITY_TYPES.map(([k]) => k));

const parse = (d) => new Date(`${d}T12:00:00`);
const fmt = (d) => d.toLocaleDateString('en-CA');
export const addDays = (date, n) => {
  const d = parse(date);
  d.setDate(d.getDate() + n);
  return fmt(d);
};
export const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / 86400000);

// Where the training days fall in a 7-day week.
const SLOTS = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };

// Which of the 7 days in a week block to train on, given the weekdays you are free.
function slotsFor(d, startDow, available) {
  const free = [];
  for (let p = 0; p < 7; p++) if (!available || available.includes((startDow + p) % 7)) free.push(p);
  if (!available || free.length === 0 || free.length === 7) return SLOTS[d];
  const n = Math.min(d, free.length);
  if (n === free.length) return free;
  if (n === 1) return [free[0]];
  return [...new Set(Array.from({ length: n }, (_, i) => free[Math.round((i * (free.length - 1)) / (n - 1))]))];
}

function strengthFoci(s, level) {
  if (s <= 0) return [];
  if (s === 1) return ['full'];
  if (s === 2) return ['full', 'full'];
  if (s === 3) return level === 'pro' ? ['push', 'pull', 'legs'] : ['full', 'full', 'full'];
  if (s === 4) return ['push', 'legs', 'pull', 'full'];
  if (s === 5) return ['push', 'pull', 'legs', 'full', 'core'];
  return ['push', 'pull', 'legs', 'push', 'pull', 'legs'];
}

function cardioCount(goal, d) {
  if (d <= 1) return 0;
  if (goal === 'lose') return Math.max(1, Math.round(d * 0.4));
  if (goal === 'endurance') return Math.max(1, Math.round(d * 0.6));
  if (goal === 'health') return d >= 4 ? 2 : 1;
  return d >= 5 ? 1 : 0; // muscle, strength
}

// One week's pattern: an array of 7 days of { k, f?, m, t?, ease? }.
function weekPattern({ goal, level, per_week, minutes, cardio }, slots, ease, cardioStart, free) {
  const d = slots.length;
  const c = Math.min(cardioCount(goal, d), d - 1);
  const s = d - c;
  const cardioAt = new Set();
  for (let i = 1; i <= c; i++) cardioAt.add(Math.min(d - 1, Math.floor((i * d) / (c + 1))));
  const foci = strengthFoci(s, level);
  const week = Array.from({ length: 7 }, () => ({ k: 'r' }));
  let si = 0;
  let ci = cardioStart;
  slots.forEach((slot, i) => {
    if (cardioAt.has(i) && c > 0) {
      week[slot] = { k: 'c', m: Math.max(15, Math.min(minutes, level === 'new' ? 30 : 60)), t: cardio[ci++ % cardio.length] };
    } else {
      week[slot] = { k: 's', f: foci[si++] ?? 'full', m: minutes, ...(ease ? { ease: true } : {}) };
    }
  });
  if (['lose', 'health', 'endurance'].includes(goal)) {
    const easy = [6, 5, 4, 3, 2, 1, 0].find((pos) => week[pos].k === 'r' && free(pos));
    if (easy !== undefined) week[easy] = { k: 'a', m: 20, t: 'walk' };
  }
  return { week, cardioUsed: ci - cardioStart };
}

export function defaultCardio(level) {
  return level === 'new' ? ['walk'] : level === 'some' ? ['walk', 'cycle'] : ['run', 'cycle'];
}

export function buildPlan({ length, start, goal, level, per_week, minutes, gear = 'gym', cardio, available, time }) {
  const L = LENGTHS.find(([n]) => n === length) ? length : 21;
  const pw = Math.min(6, Math.max(2, Number(per_week) || 3));
  const mins = Math.min(120, Math.max(10, Number(minutes) || 45));
  const types = (cardio ?? []).filter((t) => CARDIO_TYPES.has(t));
  const avail = Array.isArray(available) ? [...new Set(available.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort() : null;
  const limited = avail && avail.length > 0 && avail.length < 7 ? avail : null;
  const startDow = parse(start).getDay();
  const free = (pos) => !limited || limited.includes((startDow + pos) % 7);
  const opts = { goal, level, per_week: pw, minutes: mins, cardio: types.length ? types : defaultCardio(level) };
  const days = [];
  let cardioIndex = 0;
  for (let w = 0; days.length < L; w++) {
    // New lifters ease in: at most 3 days and lighter sets in week 1. Longer plans get lighter weeks.
    const deload = (L >= 28 && w === 3) || (L >= 56 && w === 7);
    const ease = (level === 'new' && w === 0) || deload;
    const d = level === 'new' && w === 0 ? Math.min(pw, 3) : pw;
    const { week, cardioUsed } = weekPattern(opts, slotsFor(d, startDow, limited), ease, cardioIndex, free);
    cardioIndex += cardioUsed;
    for (const day of week) if (days.length < L) days.push(day);
  }
  return {
    v: 1,
    length: L,
    start,
    goal,
    level,
    per_week: pw,
    minutes: mins,
    gear: GEARS.has(gear) ? gear : 'gym',
    cardio: opts.cardio,
    ...(limited ? { available: limited } : {}),
    ...(TIMES_OF_DAY.some(([k]) => k === time) && time !== 'any' ? { time } : {}),
    days,
  };
}

export const planDate = (plan, n) => addDays(plan.start, n - 1);
export const planWeek = (n) => Math.floor((n - 1) / 7) + 1;
export function phaseOf(plan, week) {
  const days = plan.days.slice((week - 1) * 7, week * 7);
  const lighter = days.some((d) => d.k === 's' && d.ease);
  if (lighter && plan.level !== 'new') return 'Lighter week to recover';
  if (week === 1) return plan.level === 'new' ? 'Learn the moves' : 'Settle into the routine';
  if (week === 2) return plan.level === 'new' ? 'Find your weights' : 'Build the habit';
  if (week === 3) return 'Build momentum';
  return 'Keep progressing';
}
export const isWorkoutDay = (d) => d.k === 's' || d.k === 'c';
export const dayTitle = (d) => {
  if (d.k === 'r') return 'Rest day';
  if (d.k === 'a') return 'Easy day';
  if (d.k === 'c') return 'Cardio';
  return { push: 'Push', pull: 'Pull', legs: 'Legs', core: 'Core', full: 'Full body' }[d.f] ?? 'Strength';
};

// Where you are in the plan. `workouts` only needs a `date` on each item.
export function planProgress(plan, workouts, todayStr) {
  const days = plan.days.map((d, i) => ({ ...d, n: i + 1, date: planDate(plan, i + 1), week: planWeek(i + 1) }));
  const dates = new Set(workouts.filter((w) => !w.deleted_at).map((w) => w.date));
  for (const d of days) d.done = dates.has(d.date);
  const dayNumber = diffDays(todayStr, plan.start) + 1;
  const status = dayNumber < 1 ? 'upcoming' : dayNumber > plan.length ? 'finished' : 'active';
  const work = days.filter((d) => isWorkoutDay(d) && !d.mv);
  const doneCount = work.filter((d) => d.done).length;
  const toDate = work.filter((d) => d.date <= todayStr);
  const today = status === 'active' ? days[dayNumber - 1] : null;
  const missed = work.filter((d) => d.date < todayStr && !d.done && d.date >= addDays(todayStr, -3));
  const catchUp = status === 'active' && !(today && isWorkoutDay(today) && !today.done) ? missed[missed.length - 1] ?? null : null;
  const next = work.find((d) => d.date > todayStr) ?? null;
  const offPlan = [...dates].filter((dt) => dt >= plan.start && dt <= addDays(plan.start, plan.length - 1) && dt <= todayStr).length;
  return {
    status,
    dayNumber: Math.min(Math.max(dayNumber, 0), plan.length),
    week: today ? today.week : status === 'finished' ? planWeek(plan.length) : 1,
    days,
    today,
    catchUp,
    next,
    planned: work.length,
    plannedToDate: toDate.length,
    done: doneCount,
    activeDays: offPlan,
    percent: work.length ? Math.round((doneCount / work.length) * 100) : 0,
  };
}

// ---- validation, for the profile, the server and backups ----
function cleanWhen(p) {
  const out = {};
  if (Array.isArray(p.available)) {
    const a = [...new Set(p.available.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort();
    if (a.length > 0 && a.length < 7) out.available = a;
  }
  if (['morning', 'afternoon', 'evening'].includes(p.time)) out.time = p.time;
  return out;
}

export function cleanPlan(p) {
  if (!p || typeof p !== 'object') return null;
  const length = Number(p.length);
  if (!LENGTHS.some(([n]) => n === length) || !Array.isArray(p.days) || p.days.length !== length) return null;
  if (typeof p.start !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.start)) return null;
  const days = p.days.map((d) => {
    const k = KINDS.has(d?.k) ? d.k : 'r';
    const out = { k };
    if (k === 's') {
      out.f = FOCI.has(d.f) ? d.f : 'full';
      if (d.ease) out.ease = true;
    }
    if (k === 's' || k === 'c' || k === 'a') out.m = Math.min(240, Math.max(5, Math.round(Number(d.m)) || 30));
    if (d.mv) out.mv = true;
    if (typeof d.adj === 'string' && d.adj) out.adj = d.adj.slice(0, 40);
    if (k === 'c' || k === 'a') out.t = CARDIO_TYPES.has(d.t) ? d.t : 'walk';
    return out;
  });
  return {
    v: 1,
    length,
    start: p.start,
    goal: GOALS.some(([k]) => k === p.goal) ? p.goal : 'health',
    level: LEVELS.some(([k]) => k === p.level) ? p.level : 'some',
    per_week: Math.min(6, Math.max(1, Math.round(Number(p.per_week)) || 3)),
    minutes: Math.min(240, Math.max(10, Math.round(Number(p.minutes)) || 45)),
    gear: GEARS.has(p.gear) ? p.gear : 'gym',
    cardio: (Array.isArray(p.cardio) ? p.cardio : []).filter((t) => CARDIO_TYPES.has(t)).slice(0, 8),
    ...cleanWhen(p),
    ...(Math.round(Number(p.boost)) > 0 ? { boost: Math.min(3, Math.round(Number(p.boost))) } : {}),
    days,
    ...(typeof p.ended_at === 'string' ? { ended_at: p.ended_at.slice(0, 30) } : {}),
    ...(Array.isArray(p.log) && p.log.length
      ? {
          log: p.log
            .filter((e) => e && typeof e.k === 'string' && typeof e.t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.d))
            .slice(-30)
            .map((e) => ({ k: e.k.slice(0, 40), d: e.d, t: e.t.slice(0, 200) })),
        }
      : {}),
  };
}

export function cleanOnboarding(o) {
  if (!o || typeof o !== 'object') return null;
  const out = {};
  if (typeof o.done_at === 'string') out.done_at = o.done_at.slice(0, 30);
  if (o.skipped) out.skipped = true;
  if (GOALS.some(([k]) => k === o.goal)) out.goal = o.goal;
  if (LEVELS.some(([k]) => k === o.level)) out.level = o.level;
  const pw = Math.round(Number(o.per_week));
  if (pw >= 1 && pw <= 7) out.per_week = pw;
  const m = Math.round(Number(o.minutes));
  if (m >= 5 && m <= 240) out.minutes = m;
  if (GEARS.has(o.gear)) out.gear = o.gear;
  if (Array.isArray(o.cardio)) out.cardio = o.cardio.filter((t) => CARDIO_TYPES.has(t)).slice(0, 8);
  if (Array.isArray(o.interests)) out.interests = [...new Set(o.interests.filter((t) => CARDIO_TYPES.has(t) && t !== 'other'))].slice(0, 12);
  if (['morning', 'afternoon', 'evening', 'any'].includes(o.time)) out.time = o.time;
  if (Array.isArray(o.days)) {
    const dd = [...new Set(o.days.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort();
    if (dd.length) out.days = dd;
  }
  return Object.keys(out).length ? out : null;
}

// Show the welcome flow only to people who are new: no workouts, no profile choices yet.
export function shouldOnboard({ profile, workoutCount, signedIn, synced }) {
  if (profile === undefined || workoutCount === undefined) return false; // still loading
  if (profile?.onboarding) return false;
  if (workoutCount > 0) return false;
  if (signedIn && !synced) return false; // wait: your profile may be on the server already
  return true;
}


// ---- adapting to what you actually do ----
const weekday = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' });
const training = (d, dates) => (d.k === 's' || d.k === 'c') && !d.mv ? true : dates.has(d.date);

// Move a workout to the first free rest day soon after `fromIdx`, without making a long run of training days.
function moveWorkout(days, fromIdx, todayIdx, dates, available) {
  const src = days[fromIdx];
  days[fromIdx] = { ...src, mv: true }; // so the run count below ignores the day being moved
  for (let j = todayIdx + 1; j <= Math.min(days.length - 1, todayIdx + 4); j++) {
    if (j === fromIdx || !(days[j].k === 'r' || days[j].k === 'a') || dates.has(days[j].date)) continue;
    if (available && !available.includes(parse(days[j].date).getDay())) continue;
    // Count the training run this day would create.
    let run = 1;
    for (let i = j - 1; i >= 0 && training(days[i], dates); i--) run++;
    for (let i = j + 1; i < days.length && training(days[i], dates); i++) run++;
    if (run > 3) continue;
    const { k, f, m, t, ease } = src;
    days[j] = { k, ...(f ? { f } : {}), m, ...(t ? { t } : {}), ...(ease ? { ease: true } : {}), adj: `Moved from ${weekday(src.date)}`, date: days[j].date };
    return days[j];
  }
  days[fromIdx] = src;
  return null;
}

// Look at what you have really done and adjust the days still to come. Safe to call
// often: every change is recorded in `plan.log` by key, so it only happens once.
// Returns { plan, changed }.
export function adaptPlan(plan, workouts, todayStr) {
  const dates = new Set(workouts.filter((w) => !w.deleted_at).map((w) => w.date));
  const dayNumber = diffDays(todayStr, plan.start) + 1;
  if (dayNumber < 1 || dayNumber > plan.length) return { plan, changed: false };
  const days = plan.days.map((d, i) => ({ ...d, date: planDate(plan, i + 1) }));
  const log = [...(plan.log ?? [])];
  const seen = new Set(log.map((e) => e.k));
  const note = (k, t) => {
    seen.add(k);
    log.push({ k, d: todayStr, t });
  };
  const ti = dayNumber - 1;
  const today = days[ti];
  let changed = false;

  // A: a workout you missed is moved to a free day, once today has its own workout (or it's 2+ days old).
  for (let i = Math.max(0, ti - 3); i < ti; i++) {
    const d = days[i];
    const key = `miss:${d.date}`;
    if (seen.has(key) || !isWorkoutDay(d) || d.mv || dates.has(d.date)) continue;
    const todayBusy = isWorkoutDay(today) && !today.mv && !dates.has(todayStr);
    if (!todayBusy && ti - i < 2) continue;
    const moved = moveWorkout(days, i, ti, dates, plan.available);
    if (moved) note(key, `You missed ${weekday(d.date)}'s ${d.k === 's' ? dayTitle(d).toLowerCase() : 'cardio'} workout, so it moved to ${weekday(moved.date)}.`);
    else note(key, `You missed ${weekday(d.date)}'s workout. There was no good day to move it to, so we've left it.`);
    changed = true;
  }

  // B: lots of training days in a row means tomorrow becomes a rest day.
  let run = 0;
  for (let i = dates.has(todayStr) ? ti : ti - 1; i >= 0 && dates.has(days[i].date); i--) run++;
  const tomorrow = days[ti + 1];
  if (run >= 4 && tomorrow && isWorkoutDay(tomorrow) && !tomorrow.mv && !seen.has(`rest:${tomorrow.date}`)) {
    const moved = moveWorkout(days, ti + 1, ti + 1, dates, plan.available);
    if (moved) {
      note(`rest:${tomorrow.date}`, `You've trained ${run} days in a row, so ${weekday(tomorrow.date)} is now a rest day and that workout moved to ${weekday(moved.date)}.`);
    } else {
      days[ti + 1] = { ...tomorrow, mv: true };
      note(`rest:${tomorrow.date}`, `You've trained ${run} days in a row, so ${weekday(tomorrow.date)} is now a rest day.`);
    }
    changed = true;
  }

  // C: after a rough week, the new week is lighter. After two perfect weeks, a pat on the back.
  const week = planWeek(dayNumber);
  const weekStats = (w) => {
    const ds = days.slice((w - 1) * 7, w * 7).filter((d) => isWorkoutDay(d) && !d.mv);
    return { planned: ds.length, done: ds.filter((d) => dates.has(d.date)).length };
  };
  if (week >= 2 && !seen.has(`week:${week}`)) {
    const prev = weekStats(week - 1);
    if (prev.planned >= 2 && prev.done / prev.planned < 0.5) {
      const rest = days.slice((week - 1) * 7, week * 7).filter((d) => d.k === 's' && !d.mv && d.date >= todayStr && !dates.has(d.date));
      const last = rest[rest.length - 1];
      if (rest.length > 1 && last) days[diffDays(last.date, plan.start)] = { ...last, mv: true };
      for (const d of rest.slice(0, -1)) days[diffDays(d.date, plan.start)] = { ...d, ease: true };
      note(`week:${week}`, `Last week was tough (${prev.done} of ${prev.planned} workouts), so this week is lighter to help you get back in the groove.`);
      changed = true;
    } else if (week >= 3 && prev.planned >= 2 && prev.done >= prev.planned && weekStats(week - 2).planned >= 2 && weekStats(week - 2).done >= weekStats(week - 2).planned) {
      note(`week:${week}`, 'Two full weeks in a row. Nice consistency!');
      changed = true;
    } else {
      seen.add(`week:${week}`);
    }
  }

  // E: strong weeks add a set to your first lifts; rough weeks take one back.
  let boost = plan.boost ?? 0;
  if (week >= 2 && !seen.has(`boost:${week}`)) {
    const prev = weekStats(week - 1);
    const next = prev.planned >= 2 && prev.done / prev.planned >= 0.8 ? Math.min(3, boost + 1) : prev.planned >= 2 && prev.done / prev.planned < 0.5 ? Math.max(0, boost - 1) : boost;
    if (next > boost) {
      boost = next;
      note(`boost:${week}`, `Strong week (${prev.done} of ${prev.planned}). Your first lifts now get an extra set on regular days.`);
      changed = true;
    } else if (next < boost) {
      boost = next;
      note(`boost:${week}`, 'Dialing the extra sets back while you find your rhythm.');
      changed = true;
    } else seen.add(`boost:${week}`);
  }

  // D: a week or more away means an easy first workout back.
  const past = [...dates].filter((dt) => dt <= todayStr).sort();
  const lastDate = past[past.length - 1] ?? addDays(plan.start, -1);
  const away = diffDays(todayStr, lastDate);
  const plannedSince = days.filter((d) => isWorkoutDay(d) && !d.mv && d.date > lastDate && d.date < todayStr && d.date >= plan.start).length;
  if (away >= 7 && plannedSince >= 2 && !seen.has(`back:${lastDate}`)) {
    const nextS = days.findIndex((d) => d.k === 's' && !d.mv && d.date >= todayStr);
    if (nextS >= 0) {
      days[nextS] = { ...days[nextS], ease: true };
      note(`back:${lastDate}`, `It's been ${away} days since your last workout. Your next one is an easy session to ease back in.`);
      changed = true;
    }
  }

  if (!changed) return { plan, changed: false };
  const out = { ...plan, days: days.map(({ date, ...d }) => d), log: log.slice(-30) };
  if (boost > 0) out.boost = boost;
  else delete out.boost;
  return { plan: out, changed: true };
}

// Plan notes from the last couple of days, newest first.
export const recentNotes = (plan, todayStr) => (plan.log ?? []).filter((e) => e.d >= addDays(todayStr, -1)).reverse();


// The next plan, built from how this one went: promote beginners, add a day for a great run,
// ease off after a rough one. `prog` is planProgress() for the finished plan.
export function continuePlan(plan, prog, todayStr) {
  const rate = prog.planned ? prog.done / prog.planned : 0;
  const level = rate >= 0.7 && plan.level === 'new' && plan.length >= 21 ? 'some' : plan.level;
  const room = (plan.available?.length ?? 7) > plan.per_week;
  const per_week = rate >= 0.9 && plan.per_week < 5 && room ? plan.per_week + 1 : rate < 0.5 && plan.per_week > 2 ? plan.per_week - 1 : plan.per_week;
  const length = plan.length >= 30 ? 60 : plan.length === 21 ? 30 : 21;
  const end = addDays(plan.start, plan.length);
  const start = end > todayStr ? end : todayStr;
  const next = buildPlan({ length, start, goal: plan.goal, level, per_week, minutes: plan.minutes, gear: plan.gear, cardio: plan.cardio, available: plan.available, time: plan.time });
  if (plan.boost) next.boost = plan.boost;
  const lines = [`${length} days, starting ${start === todayStr ? 'today' : 'tomorrow'}.`];
  if (level !== plan.level) lines.push('You finished strong, so no more easy-start weeks.');
  if (per_week > plan.per_week) lines.push(`One more workout a week (${per_week}).`);
  if (per_week < plan.per_week) lines.push(`One fewer workout a week (${per_week}) to build consistency.`);
  if (next.boost) lines.push('Your extra sets carry over.');
  return { plan: next, level, per_week, lines };
}

// ---- changes you make yourself, from a day's screen ----
const carry = ({ k, f, m, t, ease }) => ({ k, ...(f ? { f } : {}), ...(m ? { m } : {}), ...(t ? { t } : {}), ...(ease ? { ease: true } : {}) });
const withDays = (plan, fn) => {
  const days = plan.days.map((d) => ({ ...d }));
  fn(days);
  return { ...plan, days };
};

// Two days trade places (a workout and a rest day, or two workouts). Days already done stay put.
export function swapDays(plan, a, b) {
  if (a === b || !plan.days[a - 1] || !plan.days[b - 1]) return plan;
  return withDays(plan, (days) => {
    const x = carry(days[a - 1]);
    const y = carry(days[b - 1]);
    days[a - 1] = { ...y, adj: `Swapped with ${weekday(planDate(plan, b))}` };
    days[b - 1] = { ...x, adj: `Swapped with ${weekday(planDate(plan, a))}` };
  });
}

// Takes a workout off the plan and leaves a rest day.
export function skipDay(plan, n) {
  if (!plan.days[n - 1]) return plan;
  return withDays(plan, (days) => {
    days[n - 1] = { k: 'r', adj: 'Skipped' };
  });
}

// Turns a rest or easy day into a strength day.
export function addWorkout(plan, n, focus = 'full') {
  if (!plan.days[n - 1]) return plan;
  return withDays(plan, (days) => {
    days[n - 1] = { k: 's', f: focus, m: plan.minutes ?? 45, adj: 'Added by you' };
  });
}

// Change the focus, length or activity of a day.
export function updateDay(plan, n, patch) {
  if (!plan.days[n - 1]) return plan;
  return withDays(plan, (days) => {
    const d = days[n - 1];
    if (patch.m != null) d.m = Math.min(240, Math.max(5, Math.round(Number(patch.m)) || d.m));
    if (patch.t) d.t = patch.t;
    if (patch.f) d.f = patch.f;
  });
}

// How many training days in a row a day would sit in (itself included).
export function trainingRun(plan, n, workouts = []) {
  const dates = new Set(workouts.filter((w) => !w.deleted_at).map((w) => w.date));
  const on = (i) => {
    const d = plan.days[i];
    return d && (d.k === 's' || d.k === 'c') && !d.mv ? true : d ? dates.has(planDate(plan, i + 1)) : false;
  };
  let run = 1;
  for (let i = n - 2; i >= 0 && on(i); i--) run++;
  for (let i = n; i < plan.days.length && on(i); i++) run++;
  return run;
}

// A short, practical note for each kind of cardio.
export const CARDIO_TIPS = {
  walk: 'A brisk pace where you could talk but not sing. Swing your arms, and use hills if you have them.',
  run: 'An easy, conversational pace. Walk breaks are fine. Finish feeling you could do more.',
  cycle: 'Steady and comfortable. Keep your cadence light and spin rather than grinding.',
  swim: 'Easy laps with rests as needed. Mix strokes if your shoulders get tired.',
  row: 'Smooth, steady strokes. Push with your legs first, then lean back and pull.',
  hike: 'Take it at a pace you can hold for the whole time. Bring water.',
  elliptical: 'Keep a steady rhythm and stand tall. Add resistance in the middle, then ease off.',
};
export const cardioTip = (t) => CARDIO_TIPS[t] ?? 'Keep it easy to moderate. You should be able to talk the whole time.';
