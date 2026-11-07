import { workSets, e1rm, key } from './stats';
import { weekStartOf, weeklyCounts } from './goals';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const finished = (sessions) => sessions.filter((s) => !s.deleted_at && s.ended_at && s.exercises.length);

// Best result per exercise across all finished workouts (warm-ups ignored):
// heaviest weight, best estimated 1RM, and the best volume in one workout.
export function allRecords(sessions) {
  const map = new Map();
  for (const s of finished(sessions)) {
    for (const ex of s.exercises) {
      const sets = workSets(ex);
      if (!sets.length) continue;
      const k = key(ex.name);
      const rec = map.get(k) ?? { name: ex.name, weight: null, e1rm: null, volume: null, count: 0, last: s.date };
      rec.count++;
      if (s.date > rec.last) rec.last = s.date;
      let vol = 0;
      for (const st of sets) {
        const w = num(st.weight);
        const r = num(st.reps);
        vol += w * r;
        if (w > 0 && (!rec.weight || w > rec.weight.value)) rec.weight = { value: w, reps: r, date: s.date };
        const e = w > 0 ? e1rm(r, w) : 0;
        if (e > 0 && (!rec.e1rm || e > rec.e1rm.value)) rec.e1rm = { value: e, weight: w, reps: r, date: s.date };
      }
      if (vol > 0 && (!rec.volume || vol > rec.volume.value)) rec.volume = { value: vol, date: s.date };
      map.set(k, rec);
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

// Build a name -> muscle lookup from the library plus your own exercises (yours win).
export function muscleLookup(library = [], custom = []) {
  const m = new Map();
  for (const l of library) if (l.muscle) m.set(key(l.name), l.muscle);
  for (const c of custom) if (c.muscle && !c.deleted_at) m.set(key(c.name), c.muscle);
  return (name) => m.get(key(name)) || 'other';
}

const addDays = (date, n) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
};

// Sets and volume per muscle for the week that starts `weeksAgo` weeks before this one.
// Counts completed non-warm-up sets, credited to the exercise's main muscle.
export function muscleWeek(sessions, muscleOf, { weekStart = 1, weeksAgo = 0, todayStr = new Date().toLocaleDateString('en-CA') } = {}) {
  const start = addDays(weekStartOf(todayStr, weekStart), -7 * weeksAgo);
  const end = addDays(start, 6);
  const by = {};
  for (const s of finished(sessions)) {
    if (s.date < start || s.date > end) continue;
    for (const ex of s.exercises) {
      const sets = workSets(ex);
      if (!sets.length) continue;
      const m = muscleOf(ex.name);
      const cur = (by[m] ??= { sets: 0, volume: 0 });
      cur.sets += sets.length;
      cur.volume += sets.reduce((a, st) => a + num(st.reps) * num(st.weight), 0);
    }
  }
  return { start, end, by };
}

// Weeks (starting dates) that have at least one workout -> current and longest run of consecutive weeks.
export function activeWeekStreaks(sessions, weekStart = 1, todayStr = new Date().toLocaleDateString('en-CA')) {
  const counts = weeklyCounts(sessions, weekStart);
  const weeks = [...counts.keys()].sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const w of weeks) {
    run = prev && addDays(prev, 7) === w ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = w;
  }
  const thisWeek = weekStartOf(todayStr, weekStart);
  let w = counts.has(thisWeek) ? thisWeek : addDays(thisWeek, -7);
  let current = 0;
  while (counts.has(w)) {
    current++;
    w = addDays(w, -7);
  }
  return { current, longest, total: finished(sessions).length };
}

// A month laid out as weeks of 7 cells; cells outside the month are null.
// Each in-month cell: { date, day, count }.
export function monthGrid(sessions, year, month, weekStart = 1) {
  const counts = new Map();
  for (const s of finished(sessions)) counts.set(s.date, (counts.get(s.date) ?? 0) + 1);
  const first = new Date(year, month, 1);
  const lead = (first.getDay() - weekStart + 7) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month, d).toLocaleDateString('en-CA');
    cells.push({ date, day: d, count: counts.get(date) ?? 0 });
  }
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
