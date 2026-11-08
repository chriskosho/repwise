import { workSets, e1rm, key } from './stats';
import { modeOf } from './measure';

export const GOAL_TYPES = [
  ['weekly_workouts', 'Workouts per week'],
  ['body_weight', 'Body weight'],
  ['lift', 'Lift target'],
  ['weekly_minutes', 'Active minutes per week'],
  ['weekly_distance', 'Distance per week'],
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
  return progressFromCounts(weeklyCounts(sessions, weekStart), target, weekStart, todayStr);
}

function progressFromCounts(counts, target, weekStart, todayStr) {
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

// ---- cardio goals ----
// Which kind of activity a cardio machine in a workout counts as.
const machineType = (name) =>
  /bicycl|bike/i.test(name) ? 'cycle' : /rowing/i.test(name) ? 'row' : /walking|trail/i.test(name) ? 'walk' : /running|jogging|sprint/i.test(name) ? 'run' : /elliptical|stair|step ?mill/i.test(name) ? 'elliptical' : 'other';

// Every bout of cardio: your logged activities plus cardio exercises inside gym workouts.
// Each is { date, type, minutes, km }.
export function cardioEvents(activities = [], sessions = []) {
  const out = [];
  for (const a of activities) {
    if (a.deleted_at) continue;
    out.push({ date: a.date, type: a.type, minutes: Number(a.duration_min) || 0, km: Number(a.distance_km) || 0 });
  }
  for (const s of sessions) {
    if (s.deleted_at || !s.ended_at) continue;
    for (const ex of s.exercises) {
      if (modeOf(ex) !== 'cardio') continue;
      for (const st of workSets(ex)) out.push({ date: s.date, type: machineType(ex.name), minutes: (Number(st.time) || 0) / 60, km: Number(st.distance) || 0 });
    }
  }
  return out;
}

// Weekly total of `field` ('minutes' or 'km'), optionally for one activity type, with the current
// week's progress and how many weeks in a row met the target.
export function weeklyTotalProgress(events, field, target, { type = '', weekStart = 1, todayStr = fmt(new Date()) } = {}) {
  const sums = new Map();
  for (const e of events) {
    if (type && e.type !== type) continue;
    const w = weekStartOf(e.date, weekStart);
    sums.set(w, (sums.get(w) ?? 0) + e[field]);
  }
  const thisWeek = weekStartOf(todayStr, weekStart);
  const done = sums.get(thisWeek) ?? 0;
  let streak = 0;
  let w = done >= target ? thisWeek : addDays(thisWeek, -7);
  while ((sums.get(w) ?? 0) >= target) {
    streak++;
    w = addDays(w, -7);
  }
  return { done, target, streak, pct: Math.min(1, done / target), reached: done >= target };
}

// Everything the goals list needs to display one goal. Weights in kg for body_weight;
// lifts are in whatever unit you log.
export function goalStatus(goal, { sessions, workouts, activities, entries, weekStart, latestKg, todayStr }) {
  if (goal.type === 'weekly_minutes' || goal.type === 'weekly_distance') {
    const events = cardioEvents(activities ?? [], sessions ?? []);
    const p = weeklyTotalProgress(events, goal.type === 'weekly_minutes' ? 'minutes' : 'km', goal.target, {
      type: goal.type === 'weekly_distance' ? goal.exercise : '',
      weekStart,
      todayStr,
    });
    return { ...p, current: p.done };
  }
  if (goal.type === 'weekly_workouts') {
    // Activities (a run, a game of pickup) count as workouts for a weekly goal.
    const p = weeklyGoalProgress(workouts ?? sessions, goal.target, weekStart, todayStr);
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
