// Suggested workouts for when you can't decide. Pure functions: give them your library,
// history and goals and they return a plan. "Shuffle" just changes the seed.
import { key } from './stats';
import { weekStartOf } from './goals';
import { typeLabel } from './activities';

export const GROUPS = {
  push: { label: 'Push', muscles: ['chest', 'shoulders', 'triceps'] },
  pull: { label: 'Pull', muscles: ['lats', 'middle back', 'lower back', 'biceps', 'traps', 'forearms'] },
  legs: { label: 'Legs', muscles: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'] },
  core: { label: 'Core', muscles: ['abdominals'] },
};
export const FOCUS = [
  ['auto', 'Best for my goals'],
  ['push', 'Push (chest, shoulders, triceps)'],
  ['pull', 'Pull (back, biceps)'],
  ['legs', 'Legs'],
  ['full', 'Full body'],
  ['core', 'Core'],
];
export const GEAR = [
  ['gym', 'Full gym'],
  ['dumbbells', 'Dumbbells and bands'],
  ['bodyweight', 'Bodyweight only'],
];
export const TIMES = [20, 30, 45, 60];

const GEAR_OK = {
  gym: null,
  dumbbells: new Set(['dumbbell', 'bodyweight', 'bands', 'kettlebell', 'exercise-ball']),
  bodyweight: new Set(['bodyweight']),
};
const STRENGTH = new Set(['strength', 'powerlifting']);
// Familiar, effective movements get a head start over obscure variations.
const STAPLE = /\b(squat|bench press|deadlift|row|pull-?up|chin-?up|pulldown|overhead press|shoulder press|military press|lunge|leg press|curl|pushdown|push-?up|dip|lateral raise|face pull|hip thrust|calf raise|leg extension|plank|crunch|fly|flye|triceps extension|step-?up)\b/i;
const GOOD_STRETCH = /stretch|pose|pigeon|cobra|kneeling|hug|fold/i;

const groupOf = (muscle) => Object.keys(GROUPS).find((g) => GROUPS[g].muscles.includes(muscle)) ?? null;

function rng(seed) {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dayDiff = (a, b) => Math.round((new Date(`${a}T00:00:00`) - new Date(`${b}T00:00:00`)) / 86400000);

// Days since each group was last trained (Infinity if never), from finished lifting sessions.
export function daysSinceTrained(sessions, muscleOf, todayStr) {
  const last = {};
  for (const s of sessions) {
    if (!s.ended_at || s.deleted_at) continue;
    for (const ex of s.exercises) {
      if (!ex.sets?.some((x) => x.done)) continue;
      const g = groupOf(muscleOf(ex.name));
      if (g && (!last[g] || s.date > last[g])) last[g] = s.date;
    }
  }
  return Object.fromEntries(Object.keys(GROUPS).map((g) => [g, last[g] ? Math.max(0, dayDiff(todayStr, last[g])) : Infinity]));
}

export function suggestWorkout({
  library = [],
  custom = [],
  sessions = [],
  activities = [],
  workouts = [],
  goals = [],
  latestKg = null,
  unit = 'lb',
  options = {},
  todayStr = new Date().toLocaleDateString('en-CA'),
  weekStart = 1,
}) {
  const { minutes = 45, gear = 'gym', focus = 'auto', seed = 0 } = options;
  const rand = rng(seed + 1);
  const meta = new Map();
  for (const l of library) meta.set(key(l.name), l);
  const muscleOf = (name) => {
    const c = custom.find((x) => !x.deleted_at && key(x.name) === key(name));
    return c?.muscle || meta.get(key(name))?.muscle || '';
  };
  const since = daysSinceTrained(sessions, muscleOf, todayStr);
  const reasons = [];

  // ---- what are we working toward? ----
  const live = goals.filter((g) => !g.deleted_at);
  const lifts = live.filter((g) => g.type === 'lift' && g.exercise);
  const bw = live.find((g) => g.type === 'body_weight');
  const weekly = live.find((g) => g.type === 'weekly_workouts');
  let intent = 'general';
  if (bw && latestKg != null) intent = bw.target < latestKg - 0.2 ? 'lose' : bw.target > latestKg + 0.2 ? 'gain' : 'general';
  const scheme = {
    general: { reps: '8–12', sets: 3 },
    lose: { reps: '12–15', sets: 3 },
    gain: { reps: '8–12', sets: 4 },
  }[intent];

  // ---- which part of the body? ----
  let groups;
  if (focus === 'full') groups = ['push', 'pull', 'legs', 'core'];
  else if (focus !== 'auto' && GROUPS[focus]) groups = [focus];
  else {
    const liftGroups = new Set(lifts.map((g) => groupOf(muscleOf(g.exercise))).filter(Boolean));
    const score = (g) => Math.min(since[g], 14) + (liftGroups.has(g) ? 3 : 0) + rand() * 0.5;
    const best = ['legs', 'push', 'pull'].sort((a, b) => score(b) - score(a))[0];
    groups = [best];
    const parts = ['push', 'pull', 'legs'].map((g) => `${GROUPS[g].label.toLowerCase()} ${since[g] === Infinity ? 'never' : since[g] === 0 ? 'today' : `${since[g]} day${since[g] === 1 ? '' : 's'} ago`}`);
    reasons.push(`${GROUPS[best].label} is next: it's the part you've trained least recently (${parts.join(', ')}).`);
    if (liftGroups.has(best)) reasons.push('It also covers one of your lift goals.');
    if (since[best] === 0) reasons.push('You already trained this today, so keep it light or choose another focus.');
  }
  if (focus !== 'auto') reasons.push(`Focus: ${focus === 'full' ? 'full body' : GROUPS[focus].label.toLowerCase()}.`);
  if (weekly) {
    const from = weekStartOf(todayStr, weekStart);
    const done = workouts.filter((w) => w.date >= from && w.date <= todayStr).length;
    reasons.push(done >= weekly.target ? `You've already hit your ${weekly.target} workouts this week. This one is a bonus.` : `${done} of ${weekly.target} workouts done this week.`);
  }
  if (intent === 'lose') reasons.push('Your body-weight goal is downward, so this uses higher reps and keeps the pace up. Pair it with some cardio below.');
  if (intent === 'gain') reasons.push('Your body-weight goal is upward, so this uses extra sets and solid effort on the big lifts.');

  // ---- build the exercise list ----
  const want = Math.max(3, Math.min(8, Math.round(minutes / 9)));
  const okGear = GEAR_OK[gear] ?? null;
  const wanted = new Set(groups.flatMap((g) => GROUPS[g].muscles));
  const used = new Map(); // how often each exercise appears in your history
  for (const s of sessions) for (const ex of s.exercises) used.set(key(ex.name), (used.get(key(ex.name)) ?? 0) + 1);

  const pool = [];
  for (const l of library) {
    if (!STRENGTH.has(l.category) || l.level === 'expert' || !wanted.has(l.muscle)) continue;
    if (okGear && !okGear.has(l.equipment)) continue;
    pool.push({ name: l.name, muscle: l.muscle, compound: l.compound, level: l.level, mine: false });
  }
  for (const c of custom) {
    if (c.deleted_at || !wanted.has(c.muscle)) continue;
    if (okGear && c.equipment && !okGear.has(c.equipment)) continue;
    if (!pool.some((p) => key(p.name) === key(c.name))) pool.push({ name: c.name, muscle: c.muscle, compound: false, level: 'beginner', mine: true });
  }

  const picked = [];
  const take = (p, extra = {}) => {
    if (picked.some((x) => key(x.name) === key(p.name))) return;
    picked.push({ name: p.name, muscle: p.muscle, compound: !!p.compound, sets: scheme.sets, reps: scheme.reps, ...extra });
  };

  // Lift goals first, so what you're working toward is always in the plan.
  for (const g of lifts) {
    const m = muscleOf(g.exercise);
    if (!wanted.has(m)) continue;
    if (picked.length >= want) break;
    take({ name: g.exercise, muscle: m, compound: true }, g.metric === 'weight' ? { sets: 5, reps: '3–5', note: `Goal: ${g.target} ${unit}. Work up heavy.` } : { note: `Goal: ${g.target} ${unit} (estimated 1RM).` });
    reasons.push(`${g.exercise} leads because it's one of your goals.`);
  }

  const perMuscle = new Map();
  picked.forEach((p) => perMuscle.set(p.muscle, 1));
  const perGroup = new Map();
  picked.forEach((p) => perGroup.set(groupOf(p.muscle), (perGroup.get(groupOf(p.muscle)) ?? 0) + 1));
  while (picked.length < want && pool.length) {
    const early = picked.length < Math.ceil(want / 2);
    // Full body: always add to the part you've covered least (core counts as last).
    const order = ['legs', 'push', 'pull', 'core'].filter((g) => groups.includes(g));
    const target =
      groups.length > 1
        ? [...order].sort((a, b) => (perGroup.get(a) ?? 0) + (a === 'core' ? 0.5 : 0) - ((perGroup.get(b) ?? 0) + (b === 'core' ? 0.5 : 0)))[0]
        : null;
    let best = null;
    let bestScore = -Infinity;
    for (const p of pool) {
      if (picked.some((x) => key(x.name) === key(p.name))) continue;
      if (target && groupOf(p.muscle) !== target) continue;
      const sc =
        (used.get(key(p.name)) ? 2 : 0) +
        (p.mine ? 1 : 0) +
        (p.compound ? (early ? 2.5 : 0.5) : early ? 0 : 1.5) +
        (STAPLE.test(p.name) ? 3 : 0) +
        (p.level === 'beginner' ? 1 : 0) -
        (perMuscle.get(p.muscle) ?? 0) * 2.2 +
        rand() * 2.2;
      if (sc > bestScore) {
        best = p;
        bestScore = sc;
      }
    }
    if (!best) break;
    take(best, best.compound ? {} : { sets: Math.min(scheme.sets, 3), reps: intent === 'lose' ? '12–15' : '10–15' });
    perMuscle.set(best.muscle, (perMuscle.get(best.muscle) ?? 0) + 1);
    perGroup.set(groupOf(best.muscle), (perGroup.get(groupOf(best.muscle)) ?? 0) + 1);
  }

  // ---- cool-down stretches for the muscles you worked ----
  const worked = new Set(picked.map((p) => p.muscle));
  const stretchPool = library.filter(
    (l) => l.category === 'stretching' && worked.has(l.muscle) && !/smr/i.test(l.name) && ['bodyweight', 'other', 'bands'].includes(l.equipment) && l.level !== 'expert',
  );
  const stretches = [];
  for (const m of [...worked].sort(() => rand() - 0.5)) {
    const mine_ = stretchPool.filter((s) => s.muscle === m && !stretches.includes(s.name));
    const options_ = mine_.some((s) => GOOD_STRETCH.test(s.name)) ? mine_.filter((s) => GOOD_STRETCH.test(s.name)) : mine_;
    if (options_.length) stretches.push(options_[Math.floor(rand() * options_.length)].name);
    if (stretches.length >= 5) break;
  }

  // ---- ideas for a non-gym day ----
  const counts = new Map();
  const mins = new Map();
  for (const a of activities) {
    if (a.deleted_at || dayDiff(todayStr, a.date) > 90) continue;
    counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
    mins.set(a.type, [...(mins.get(a.type) ?? []), a.duration_min]);
  }
  const ideas = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([type]) => {
      const list = mins.get(type).sort((a, b) => a - b);
      return { type, minutes: Math.round(list[Math.floor(list.length / 2)] / 5) * 5 || 30, label: `${typeLabel(type)} (your usual)` };
    });
  const defaults = intent === 'lose' ? [['walk', 40], ['cycle', 30], ['run', 25]] : [['walk', 30], ['cycle', 30], ['stretching', 20]];
  for (const [type, m] of defaults) {
    if (ideas.length >= 3) break;
    if (!ideas.some((i) => i.type === type)) ideas.push({ type, minutes: m, label: typeLabel(type) });
  }

  const title = groups.length > 1 ? 'Full body' : `${GROUPS[groups[0]].label} day`;
  return { title, groups, intent, minutes, exercises: picked, stretches, ideas, reasons, empty: picked.length === 0 };
}

// Turn a suggestion into a routine-shaped template the workout screen can start from.
export function suggestionAsRoutine(s) {
  return {
    name: s.title,
    exercises: s.exercises.map((e) => ({
      name: e.name,
      link: false,
      notes: [`${e.sets} × ${e.reps}`, e.note].filter(Boolean).join('. '),
      sets: Array.from({ length: e.sets }, () => ({ type: 'normal' })),
    })),
  };
}

export const coolDownNote = (s) => (s.stretches.length ? `Cool-down: ${s.stretches.join(', ')} (hold each 20–30 seconds).` : '');
