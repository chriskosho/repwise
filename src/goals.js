import { workSets, e1rm, key } from './stats';

export const GOAL_TYPES = [
  ['weekly_workouts', 'Workouts per week'],
  ['body_weight', 'Body weight'],
  ['lift', 'Lift target'],
];

const parse = (date) => new Date(`${date}T00:00:00`);
const fmt = (d) => d.toLocaleDateString('en-CA');

// First day (YYYY-MM-DD) of the week containing `date`. weekStart: 1 = Monday, 0 = Sunday.
export function weekStartOf(date, weekStart = 1) {
  const d = parse(date);
  const diff = (d.getDay() - weekStart + 7) % 7;
  d.setDate(d.getDate() - diff);
  return fmt(d);
}
const addDays = (date, n) => {
  const d = parse(date);
  d.setDate(d.getDate() + n);
  return fmt(d);
};

const finished = (sessions) => sessions.filter((s) => !s.deleted_at && s.ended_at && s.exercises.length);

// Map of week-start date -> number of finished workouts.
export function weeklyCounts(sessions, weekStart = 1) {
  const m = new Map();
  for (const s of finished(sessions)) {
    const w = weekStartOf(s.date, weekStart);
    m.set(w, (m.get(w) ?? 0) + 1);
  }
  return m;
}

// Workouts so far this week, plus how many weeks in a row met the target.
// The current week counts if it is already met; if not, it is simply still in progress
// and the streak is counted back from last week.
export function weeklyGoalProgress(sessions, target, weekStart = 1, todayStr = fmt(new Date())) {
  const counts = weeklyCounts(sessions, weekStart);
  const thisWeek = weekStartOf(todayStr, weekStart);
  const done = counts.get(thisWeek) ?? 0;
  let streak = 0;
  let w = done >= target ? thisWeek : addDays(thisWeek, -7);
  while ((counts.get(w) ?? 0) >= target) {
    streak++;
    w = addDays(w, -7);
  }
  return { done, target, streak, pct: Math.min(1, done / target) };
}

// Best result for a lift across finished sessions. metric: 'weight' | 'e1rm'.
export function bestForExercise(sessions, name, metric = 'weight') {
  const k = key(name);
  let best = 0;
  for (const s of finished(sessions)) {
    for (const ex of s.exercises) {
      if (key(ex.name) !== k) continue;
      for (const st of workSets(ex)) {
        const v = metric === 'e1rm' ? e1rm(Number(st.reps), Number(st.weight)) : Number(st.weight);
        if (v > best) best = v;
      }
    }
  }
  return best || null;
}

const clamp01 = (n) => Math.max(0, Math.min(1, n));

// Progress from where you started to the target, in either direction.
export function progressBetween(start, current, target) {
  if (start == null || current == null) return 0;
  if (start === target) return current === target ? 1 : 0;
  return clamp01((current - start) / (target - start));
}

// Everything the goals list needs to display one goal. Weights in kg for body_weight;
// lifts are in whatever unit you log.
export function goalStatus(goal, { sessions, entries, weekStart, latestKg, todayStr }) {
  if (goal.type === 'weekly_workouts') {
    const p = weeklyGoalProgress(sessions, goal.target, weekStart, todayStr);
    return { ...p, current: p.done, reached: p.done >= goal.target };
  }
  if (goal.type === 'body_weight') {
    const pct = progressBetween(goal.start_value, latestKg, goal.target);
    const reached =
      latestKg != null &&
      goal.start_value != null &&
      (goal.target >= goal.start_value ? latestKg >= goal.target : latestKg <= goal.target);
    return { pct, current: latestKg, reached };
  }
  const best = bestForExercise(sessions, goal.exercise, goal.metric || 'weight');
  const start = goal.start_value ?? 0;
  const reached = best != null && best >= goal.target;
  return { pct: reached ? 1 : progressBetween(start, best, goal.target), current: best, reached };
}
