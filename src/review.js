// A weekly look-back: what you did, what improved, what's next. Pure functions.
import { addDays, diffDays, isWorkoutDay, planDate } from './plan';
import { computePRs, key, sessionStats, workSets } from './stats';
import { GROUPS, suggestWeight } from './suggest';
import { coreExercise } from './coreExercises';
import { exName } from './library';

const dow = (d) => new Date(`${d}T12:00:00`).getDay();
export const weekStartOf = (date, weekStart = 1) => addDays(date, -((dow(date) - weekStart + 7) % 7));

// Which week to review. "this" is the current week so far; "last" is the one before it.
// On the last day of a week the current week is the natural one to look back on.
export function defaultWhich(todayStr, weekStart = 1) {
  return diffDays(todayStr, weekStartOf(todayStr, weekStart)) === 6 ? 'this' : 'last';
}
export function reviewPeriod(todayStr, weekStart = 1, which = defaultWhich(todayStr, weekStart)) {
  const thisStart = weekStartOf(todayStr, weekStart);
  const start = which === 'this' ? thisStart : addDays(thisStart, -7);
  return { start, end: addDays(start, 6), which };
}
// Show the nudge on the week's last day and for the two days after.
export function showReviewCard(todayStr, weekStart = 1) {
  const since = diffDays(todayStr, weekStartOf(todayStr, weekStart));
  return since === 6 || since < 2;
}

const inRange = (d, a, b) => d >= a && d <= b;
const pct = (now, before) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

export function weeklyReview({ sessions = [], activities = [], entries = [], plan = null, library = [], start, end }) {
  const finished = sessions.filter((s) => s.ended_at && !s.deleted_at);
  const acts = activities.filter((a) => !a.deleted_at);
  const section = (a, b) => {
    const ss = finished.filter((s) => inRange(s.date, a, b));
    const as = acts.filter((x) => inRange(x.date, a, b));
    const stats = ss.map(sessionStats);
    return {
      ss,
      as,
      days: new Set([...ss.map((s) => s.date), ...as.map((x) => x.date)]).size,
      sets: stats.reduce((n, x) => n + x.sets, 0),
      volume: stats.reduce((n, x) => n + x.volume, 0),
      minutes: Math.round(stats.reduce((n, x) => n + (x.minutes || 0), 0) + as.reduce((n, x) => n + (x.duration_min || 0), 0)),
      km: stats.reduce((n, x) => n + (x.km || 0), 0) + as.reduce((n, x) => n + (x.distance_km || 0), 0),
    };
  };
  const cur = section(start, end);
  const prev = section(addDays(start, -7), addDays(start, -1));

  // Records set this week: compare each session with everything before it.
  const prs = [];
  for (const s of cur.ss) {
    const prior = finished.filter((p) => p.date < s.date || (p.date === s.date && (p.started_at || '') < (s.started_at || '')));
    for (const e of computePRs(s.exercises, prior).list) prs.push({ date: s.date, ...e });
  }

  const planned = plan
    ? plan.days
        .map((d, i) => ({ ...d, date: planDate(plan, i + 1) }))
        .filter((d) => inRange(d.date, start, end) && isWorkoutDay(d) && !d.mv)
    : [];
  const planInfo = plan && planned.length ? { planned: planned.length, done: planned.filter((d) => cur.ss.some((s) => s.date === d.date) || cur.as.some((x) => x.date === d.date)).length } : null;

  const wEntries = entries.filter((e) => e.weight_kg != null && !e.deleted_at).sort((a, b) => a.date.localeCompare(b.date));
  const inWeek = wEntries.filter((e) => inRange(e.date, start, end));
  const before = wEntries.filter((e) => e.date < start).pop();
  let weight = null;
  if (inWeek.length) {
    const to = inWeek[inWeek.length - 1];
    const from = before ?? (inWeek.length > 1 ? inWeek[0] : null);
    weight = { to: to.weight_kg, change_kg: from ? Math.round((to.weight_kg - from.weight_kg) * 100) / 100 : null };
  }

  const nextWeek = plan
    ? Array.from({ length: 7 }, (_, i) => addDays(end, i + 1))
        .map((date) => ({ date, day: plan.days[diffDays(date, plan.start)] }))
        .filter((x) => x.day)
        .map(({ date, day }) => ({ date, ...day }))
    : null;

  const notes = plan ? (plan.log ?? []).filter((e) => inRange(e.d, start, end)) : [];

  let headline;
  if (cur.days === 0) headline = 'A quiet week. Even a short walk or a light session gets momentum back.';
  else if (planInfo && planInfo.done >= planInfo.planned) headline = `You hit every planned workout (${planInfo.done} of ${planInfo.planned}). Nice consistency.`;
  else if (prs.length) headline = `${cur.days} workout ${cur.days === 1 ? 'day' : 'days'} and ${prs.length} new ${prs.length === 1 ? 'record' : 'records'}. Strong week.`;
  else if (prev.days && cur.days > prev.days) headline = `${cur.days} workout days, up from ${prev.days} the week before.`;
  else headline = `${cur.days} workout ${cur.days === 1 ? 'day' : 'days'} this week. Keep showing up.`;

  const advice = nextWeekAdvice({ finished, acts, days: cur.days, plannedDays: planInfo?.planned ?? null, library, end });

  return {
    start,
    end,
    headline,
    advice,
    days: cur.days,
    prevDays: prev.days,
    strength: cur.ss.length,
    activities: cur.as.length,
    sets: cur.sets,
    volume: cur.volume,
    volumeChange: pct(cur.volume, prev.volume),
    minutes: cur.minutes,
    minutesChange: pct(cur.minutes, prev.minutes),
    km: cur.km,
    prs,
    plan: planInfo,
    weight,
    notes,
    nextWeek,
    empty: cur.days === 0,
  };
}

// ---- one suggestion for next week, from simple rules ----
// In order: too few days, too many in a row, a stalled lift, a part of the body left out.
// Returns { kind, text }.
export function nextWeekAdvice({ finished = [], acts = [], days = 0, plannedDays = null, library = [], end }) {
  const upTo = finished.filter((s) => s.date <= end);
  const dates = new Set([...upTo.map((s) => s.date), ...acts.filter((a) => a.date <= end).map((a) => a.date)]);

  // Low days.
  if (days === 0) return { kind: 'low', text: 'Start small next week: one short workout early in the week gets things moving again.' };
  if (days < 2 && (plannedDays == null || plannedDays > days))
    return { kind: 'low', text: `Only ${days} workout day this week. Aim for two next week, even if one is just 20 minutes.` };

  // Long streak, ending on the last day of the week.
  let streak = 0;
  for (let d = end; dates.has(d); d = addDays(d, -1)) streak++;
  if (streak >= 5 || days >= 6) {
    const n = Math.max(streak, days);
    return { kind: 'streak', text: `${n} training days ${streak >= 5 ? 'in a row' : 'this week'}. Plan at least two full rest days next week so your body can catch up.` };
  }

  // A lift that has stopped moving.
  const lifted = [];
  for (const s of upTo.filter((x) => x.date >= addDays(end, -6))) {
    for (const ex of s.exercises ?? []) if (workSets(ex).some((x) => Number(x.weight) > 0) && !lifted.some((n) => key(n) === key(ex.name))) lifted.push(ex.name);
  }
  for (const name of lifted) {
    const w = suggestWeight(name, upTo, {});
    if (w?.stalled) return { kind: 'stalled', text: `${exName(name)} hasn't moved in 3 sessions. Next week, drop about 10% and build back up, or try a different rep range.` };
  }

  // A part of the body left out for two weeks while the others got work.
  const byName = new Map(library.map((l) => [key(l.name), l.muscle]));
  const muscleOf = (n) => coreExercise(n)?.muscle ?? byName.get(key(n)) ?? '';
  const recent = upTo.filter((s) => s.date >= addDays(end, -13));
  const hit = new Set();
  for (const s of recent) for (const ex of s.exercises ?? []) if (workSets(ex).length) for (const [g, def] of Object.entries(GROUPS)) if (def.muscles.includes(muscleOf(ex.name))) hit.add(g);
  const main = ['legs', 'push', 'pull'];
  const missing = main.filter((g) => !hit.has(g));
  if (recent.length >= 2 && hit.size > 0 && missing.length && missing.length < main.length) {
    const g = missing[0];
    const what = { legs: 'legs', push: 'chest, shoulders or triceps', pull: 'back or biceps' }[g];
    return { kind: 'neglected', text: `No ${what} work in the last two weeks. Make one session next week a ${GROUPS[g].label.toLowerCase()} day.` };
  }

  return { kind: 'steady', text: 'A good, steady week. Keep the same rhythm next week and try adding a rep or a little weight to one lift.' };
}
