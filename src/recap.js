// What a finished workout means: how it compares with last time, where the week stands and
// what's next. Pure functions, used by the summary screen after you finish.
import { key, sessionStats, workSets } from './stats';
import { addDays, isWorkoutDay, planDate, planProgress } from './plan';
import { weekStartOf } from './review';

// Heaviest working set (most reps breaks a tie), or null when nothing was lifted.
export function topSet(ex) {
  let best = null;
  for (const s of workSets(ex ?? {})) {
    const w = Number(s.weight) || 0;
    const r = Number(s.reps) || 0;
    if (w <= 0 || r <= 0) continue;
    if (!best || w > best.weight || (w === best.weight && r > best.reps)) best = { weight: w, reps: r };
  }
  return best;
}

const when = (s) => `${s.date ?? ''}${s.started_at ?? ''}`;

// The last finished session with the same name before this one, and what changed since.
export function compareWithLast(session, sessions, stats = sessionStats(session)) {
  const name = key(session?.name);
  if (!name) return null;
  const prev = (sessions ?? [])
    .filter((s) => s.id !== session.id && s.ended_at && !s.deleted_at && key(s.name) === name && when(s) < when(session))
    .sort((a, b) => when(b).localeCompare(when(a)))[0];
  if (!prev) return null;
  const before = sessionStats(prev).volume;
  const volume = { before, after: stats.volume, change: before > 0 ? Math.round(((stats.volume - before) / before) * 100) : null };
  const tops = [];
  for (const ex of session.exercises ?? []) {
    const old = prev.exercises?.find((e) => key(e.name) === key(ex.name));
    const a = topSet(old);
    const b = topSet(ex);
    if (!a || !b) continue;
    const dir = b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? 'up' : b.weight < a.weight || b.reps < a.reps ? 'down' : 'same';
    tops.push({ name: ex.name, before: a, after: b, dir });
  }
  // Show what moved first; same-as-last-time lifts only fill in.
  const rank = { up: 0, down: 1, same: 2 };
  tops.sort((x, y) => rank[x.dir] - rank[y.dir]);
  return { prev, volume, tops: tops.slice(0, 3) };
}

// This week's workout days against the plan (or a weekly goal). { done, target, of } where
// `of` says what the target is: 'plan', 'goal' or null when there's nothing to compare with.
export function weekCount({ plan = null, workouts = [], goals = [], todayStr, weekStart = 1, extraDate = null }) {
  const start = weekStartOf(todayStr, weekStart);
  const end = addDays(start, 6);
  const dates = new Set(workouts.filter((w) => !w.deleted_at && w.date >= start && w.date <= end).map((w) => w.date));
  if (extraDate && extraDate >= start && extraDate <= end) dates.add(extraDate);
  const done = dates.size;
  if (plan && !plan.ended_at) {
    const planned = plan.days.map((d, i) => ({ ...d, date: planDate(plan, i + 1) })).filter((d) => d.date >= start && d.date <= end && isWorkoutDay(d) && !d.mv).length;
    if (planned > 0) return { done, target: planned, of: 'plan' };
  }
  const goal = goals.find((g) => !g.deleted_at && g.type === 'weekly_workouts');
  if (goal) return { done, target: goal.target, of: 'goal' };
  return { done, target: null, of: null };
}

// The next workout in your plan after today, or null.
export function nextPlanned(plan, workouts, todayStr) {
  if (!plan || plan.ended_at) return null;
  const p = planProgress(plan, workouts, todayStr);
  return p.status === 'finished' ? null : p.next;
}
