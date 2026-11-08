// A weekly look-back: what you did, what improved, what's next. Pure functions.
import { addDays, diffDays, isWorkoutDay, planDate } from './plan';
import { computePRs, sessionStats } from './stats';

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

export function weeklyReview({ sessions = [], activities = [], entries = [], plan = null, start, end }) {
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

  return {
    start,
    end,
    headline,
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
