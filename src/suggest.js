// Suggested workouts for when you can't decide. Pure functions: give them your library,
// history and goals and they return a plan. "Shuffle" just changes the seed.
import { e1rm, key } from './stats';
import { cardioEvents, weekStartOf, weeklyTotalProgress } from './goals';
import { typeLabel } from './activities';
import { deriveMode, isMode } from './measure';
import { CORE_EXERCISES, COMPOUND_SLOTS, NOT_FOR_BEGINNERS, coreExercise, gearAllows, levelAllows } from './coreExercises';
import { buildStretches, workoutPlan } from './stretches';

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

const STRENGTH = new Set(['strength', 'powerlifting']);
// Familiar, effective movements get a head start over obscure variations.
const STAPLE = /\b(squat|bench press|deadlift|row|pull-?up|chin-?up|pulldown|overhead press|shoulder press|military press|lunge|leg press|curl|pushdown|push-?up|dip|lateral raise|face pull|hip thrust|calf raise|leg extension|plank|crunch|fly|flye|triceps extension|step-?up)\b/i;

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


// ---- recovery: should you rest, go light, or train hard? ----
export const FEELING = [
  ['auto', 'Not sure'],
  ['great', 'Great: full effort'],
  ['ok', 'OK'],
  ['beat', 'Beat up: keep it light'],
];

// Looks at how many days in a row you've trained and how many weeks you've been at it.
export function assessRecovery(workouts, todayStr) {
  const days = new Set(workouts.filter((w) => !w.deleted_at).map((w) => w.date));
  let streak = 0;
  // A streak counts back from today, or from yesterday if you haven't trained yet today.
  let d = days.has(todayStr) ? 0 : 1;
  while (days.has(shiftDay(todayStr, -d)) && streak < 30) {
    streak++;
    d++;
  }
  const trainedToday = days.has(todayStr);
  // Weeks (counted back in 7-day blocks from today) with at least three workouts.
  let heavyWeeks = 0;
  for (let w = 0; w < 8; w++) {
    let n = 0;
    for (let i = w * 7; i < w * 7 + 7; i++) if (days.has(shiftDay(todayStr, -i))) n++;
    if (n >= 3) heavyWeeks++;
    else break;
  }
  return { streak, trainedToday, heavyWeeks, rest: streak >= 3, deload: heavyWeeks >= 5 };
}
function shiftDay(dateStr, delta) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toLocaleDateString('en-CA');
}

// Warm-up ramp toward a working weight: lighter sets first, rounded to plates.
export function warmupRamp(weight, unit = 'lb') {
  const bar = unit === 'kg' ? 20 : 45;
  const step = unit === 'kg' ? 2.5 : 5;
  const heavy = weight >= (unit === 'kg' ? 100 : 225);
  const fractions = heavy ? [0.4, 0.6, 0.8] : [0.5, 0.75];
  const out = [];
  for (const f of fractions) {
    const w = Math.max(bar, Math.round((weight * f) / step) * step);
    if (w < weight && !out.includes(w)) out.push(w);
  }
  return out;
}

// ---- weights: progress from what you did last time ----
const repRange = (text) => {
  const m = String(text).match(/(\d+)\D+(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : [8, 12];
};
const roundTo = (v, step) => Math.round(v / step) * step;
const clean = (n) => Math.round(n * 10) / 10;

// Suggest a working weight in your unit, or null when there is nothing to go on.
export function suggestWeight(name, sessions, { unit = 'lb', reps = '8–12', equipment = '', goal = null, light = false } = {}) {
  const k = key(name);
  const dumb = equipment === 'dumbbell' || equipment === 'kettlebell';
  const step = unit === 'kg' ? (dumb ? 1 : 2.5) : dumb ? 5 : 5;
  const bump = unit === 'kg' ? (dumb ? 2 : 2.5) : 5;
  const done = sessions
    .filter((s) => s.ended_at && !s.deleted_at)
    .sort((a, b) => (b.date + (b.started_at || '')).localeCompare(a.date + (a.started_at || '')));
  let last = null;
  for (const s of done) {
    const ex = s.exercises.find((e) => key(e.name) === k && (e.mode === undefined || e.mode === 'weight' || e.mode === ''));
    const work = (ex?.sets ?? []).filter((x) => x.done && (x.type || 'normal') !== 'warmup' && Number(x.weight) > 0 && Number(x.reps) > 0);
    if (work.length) {
      last = work;
      break;
    }
  }
  if (!last) return null;
  // Progress check: best estimated 1RM per session, newest first.
  const bests = [];
  for (const s of done) {
    const ex = s.exercises.find((e) => key(e.name) === k && (e.mode === undefined || e.mode === 'weight' || e.mode === ''));
    const sets = (ex?.sets ?? []).filter((x) => x.done && (x.type || 'normal') !== 'warmup' && Number(x.weight) > 0 && Number(x.reps) > 0);
    if (sets.length) bests.push(Math.max(...sets.map((x) => e1rm(Number(x.reps), Number(x.weight)))));
  }
  const justPR = bests.length >= 2 && bests[0] > Math.max(...bests.slice(1)) + 0.01;
  const stalled = bests.length >= 3 && bests[0] <= Math.max(...bests.slice(1, 3)) + 0.01 && bests[1] <= bests[2] + 0.01;
  const top = Math.max(...last.map((x) => Number(x.weight)));
  const atTop = last.filter((x) => Number(x.weight) === top);
  const [lo, hi] = repRange(reps);
  let weight = top;
  let why = `Last time ${clean(top)} × ${atTop.map((x) => x.reps).join(', ')}`;
  if (goal) {
    // Strength goal: aim near a 5-rep weight for the e1RM you've shown.
    const best = Math.max(...last.map((x) => e1rm(Number(x.reps), Number(x.weight))));
    weight = Math.max(top, roundTo(best / (1 + 5 / 30), step));
    why += weight > top ? '; stepping toward your goal' : '';
  } else if (atTop.length && atTop.every((x) => Number(x.reps) >= hi)) {
    weight = top + bump;
    why += `, so add ${bump}`;
  } else if (atTop.some((x) => Number(x.reps) < lo)) {
    weight = Math.max(step, roundTo(top - bump, step));
    why += ', so ease back a little';
  } else {
    why += ', so repeat it and try to add a rep';
  }
  if (light) {
    weight = Math.max(step, roundTo(weight * 0.9, step));
    why += ' (lighter today)';
  }
  return { weight: clean(weight), note: why, justPR, stalled };
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
  const { minutes = 45, gear = 'gym', focus = 'auto', seed = 0, feeling = 'auto', style = '', ease = false, interests = [], boost = 0, level = '' } = options;
  const rand = rng(seed + 1);
  const meta = new Map();
  for (const l of library) meta.set(key(l.name), l);
  const muscleOf = (name) => {
    const c = custom.find((x) => !x.deleted_at && key(x.name) === key(name));
    return c?.muscle || meta.get(key(name))?.muscle || '';
  };
  const since = daysSinceTrained(sessions, muscleOf, todayStr);
  const reasons = [];
  const recovery = assessRecovery([...workouts, ...sessions.filter((x) => x.ended_at)], todayStr);
  const easing = ease && feeling !== 'great';
  const light = feeling === 'beat' || easing || (feeling === 'auto' && recovery.deload);
  if (easing && feeling !== 'beat') reasons.push('Easy week in your plan: fewer sets and lighter weights while you learn the moves or recover. Pick Great to go full effort.');
  if (feeling === 'beat') reasons.push('You said you feel beat up, so this is a lighter session: fewer sets and about 10% less weight.');
  else if (feeling === 'auto' && recovery.deload && !easing) reasons.push(`You've trained 3+ times a week for ${recovery.heavyWeeks} weeks. This is a lighter "deload" session so your body can catch up. Pick Great to go full effort.`);
  if (recovery.rest && feeling !== 'great') reasons.push(`You've worked out ${recovery.streak} days in a row. A rest day or an easy walk is a good idea.`);

  // ---- what are we working toward? ----
  const live = goals.filter((g) => !g.deleted_at);
  const lifts = live.filter((g) => g.type === 'lift' && g.exercise);
  const bw = live.find((g) => g.type === 'body_weight');
  const weekly = live.find((g) => g.type === 'weekly_workouts');
  let intent = 'general';
  if (bw && latestKg != null) intent = bw.target < latestKg - 0.2 ? 'lose' : bw.target > latestKg + 0.2 ? 'gain' : 'general';
  const STYLES = {
    strength: { reps: '5–8', sets: 4, why: 'Heavier, lower reps to build strength.' },
    muscle: { reps: '8–12', sets: 3, why: 'Moderate reps to build muscle.' },
    lean: { reps: '12–15', sets: 3, why: 'Higher reps and steady pace for conditioning and calorie burn.' },
    general: { reps: '10–12', sets: 3, why: 'Comfortable reps for all-round fitness.' },
  };
  const scheme = STYLES[style] ?? {
    general: { reps: '8–12', sets: 3 },
    lose: { reps: '12–15', sets: 3 },
    gain: { reps: '8–12', sets: 4 },
  }[intent];
  if (STYLES[style]) reasons.push(STYLES[style].why);

  // ---- which part of the body? ----
  let groups;
  if (focus === 'full') groups = ['push', 'pull', 'legs', 'core'];
  else if (focus !== 'auto' && GROUPS[focus]) groups = [focus];
  else {
    const liftGroups = new Set(lifts.map((g) => groupOf(muscleOf(g.exercise))).filter(Boolean));
    const score = (g) => Math.min(since[g], 14) + (since[g] < 2 ? -6 : 0) + (liftGroups.has(g) ? 3 : 0) + rand() * 0.5;
    const best = ['legs', 'push', 'pull'].sort((a, b) => score(b) - score(a))[0];
    groups = [best];
    const parts = ['push', 'pull', 'legs'].map((g) => `${GROUPS[g].label.toLowerCase()} ${since[g] === Infinity ? 'never' : since[g] === 0 ? 'today' : `${since[g]} day${since[g] === 1 ? '' : 's'} ago`}`);
    reasons.push(`${GROUPS[best].label} is next: it's the part you've trained least recently (${parts.join(', ')}).`);
    if (liftGroups.has(best)) reasons.push('It also covers one of your lift goals.');
    if (since[best] === 0) reasons.push('You already trained this today, so keep it light or choose another focus.');
    // With no equipment there's very little to pull with, so a pull day becomes full body.
    if (best === 'pull' && gear === 'bodyweight') {
      groups = ['push', 'pull', 'legs', 'core'];
      reasons.push('Back is due, but with no equipment there are few pulling moves, so this is a full-body session with a row.');
    }
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
  // Slots first (a squat, a press, a row…), filled from the core list of familiar exercises
  // that suit your gear and experience. The full library only fills a slot the core list can't.
  const want = Math.max(3, Math.min(8, Math.round(minutes / 9)));
  const wanted = new Set(groups.flatMap((g) => GROUPS[g].muscles));
  const used = new Map(); // how often each exercise appears in your history
  for (const s of sessions) for (const ex of s.exercises) used.set(key(ex.name), (used.get(key(ex.name)) ?? 0) + 1);
  const beginner = level === 'new';
  const suits = (name, lvl) => levelAllows(level, lvl) && !(beginner && NOT_FOR_BEGINNERS.test(name));

  // Score a candidate: staples and things you already do lead; gear that fits your setup next.
  const fit = (equip) => {
    if (gear === 'gym') return ['barbell', 'dumbbell', 'cable', 'machine', 'ez-bar'].includes(equip) ? 1 : equip === 'bodyweight' ? -0.5 : -1;
    if (gear === 'dumbbells') return ['dumbbell', 'kettlebell'].includes(equip) ? 1 : equip === 'bands' ? 0 : -0.5;
    return 0;
  };
  const scoreOf = (c) => (c.star ? 2 : 0) + (used.get(key(c.name)) ? 2.5 : 0) + (c.mine ? 1 : 0) + fit(c.equip) + (beginner && c.equip === 'barbell' ? -0.5 : 0) + (beginner && c.equip === 'machine' ? 0.5 : 0) + rand() * 3;

  const core = CORE_EXERCISES.filter((c) => wanted.has(c.muscle) && gearAllows(gear, c.equip, c.bar) && suits(c.name, c.level));
  // Your own exercises can fill an accessory spot for their muscle.
  const mine = custom
    .filter((c) => !c.deleted_at && wanted.has(c.muscle) && (!c.equipment || gearAllows(gear, c.equipment)) && !(isMode(c.mode) && (c.mode === 'cardio' || c.mode === 'stretch')))
    .map((c) => ({ name: c.name, slot: 'accessory', muscle: c.muscle, equip: c.equipment || 'bodyweight', mine: true, mode: isMode(c.mode) ? c.mode : 'weight' }));
  const SLOT_MUSCLES = {
    squat: ['quadriceps'],
    hinge: ['hamstrings', 'glutes', 'lower back'],
    'h-push': ['chest', 'triceps'],
    'v-push': ['shoulders'],
    'h-pull': ['middle back'],
    'v-pull': ['lats'],
    core: ['abdominals'],
  };
  // Last resort for a slot: the full library, with the same gear, level and focus rules.
  const fallback = (muscles) =>
    library
      .filter((l) => STRENGTH.has(l.category) && l.level !== 'expert' && wanted.has(l.muscle) && muscles.includes(l.muscle) && !coreExercise(l.name))
      // Only beginner-friendly, everyday variations: no one-arm, jumping or specialist moves.
      .filter((l) => l.level === 'beginner' && !/single-arm|one[- ]arm|jump|glute ham|plyo/i.test(l.name))
      .filter((l) => gearAllows(gear, l.equipment, /pull-?ups?\b|chin-?ups?\b/i.test(l.name)) && suits(l.name, 'new'))
      .map((l) => ({ name: l.name, slot: 'library', muscle: l.muscle, equip: l.equipment, star: STAPLE.test(l.name) }));

  const TEMPLATES = {
    push: ['h-push', 'v-push', 'acc:shoulders', 'acc:triceps', 'h-push', 'acc:chest', 'acc:triceps', 'acc:shoulders'],
    pull: ['v-pull', 'h-pull', 'acc:biceps', 'h-pull', 'hinge', 'acc:traps', 'acc:biceps', 'v-pull'],
    legs: ['squat', 'hinge', 'acc:hamstrings', 'squat', 'acc:calves', 'acc:quadriceps', 'acc:glutes', 'hinge'],
    full: ['squat', 'h-push', 'h-pull', 'hinge', 'v-push', 'core', 'v-pull', 'acc:biceps'],
    core: ['core', 'core', 'core', 'core', 'core', 'core', 'core', 'core'],
  };
  const candidatesFor = (slot) => {
    if (slot.startsWith('acc:')) {
      const m = slot.slice(4);
      return [...core.filter((c) => c.slot === 'accessory' && c.muscle === m), ...mine.filter((c) => c.muscle === m)];
    }
    return core.filter((c) => c.slot === slot);
  };
  const musclesFor = (slot) => (slot.startsWith('acc:') ? [slot.slice(4)] : SLOT_MUSCLES[slot] ?? []);

  const picked = [];
  const take = (p, extra = {}) => {
    if (picked.some((x) => key(x.name) === key(p.name))) return false;
    const mode = p.mode ?? deriveMode({ name: p.name, ...(meta.get(key(p.name)) ?? {}) });
    const base = mode === 'time' ? { reps: '30–45 s', sets: 3 } : mode === 'carry' ? { reps: '30–40 yd', sets: 3 } : { sets: scheme.sets, reps: scheme.reps };
    picked.push({ name: p.name, muscle: p.muscle, compound: !!p.compound, mode, ...base, ...(mode === 'weight' || mode === 'bodyweight' ? extra : { note: extra.note }) });
    return true;
  };

  // Lift goals first, so what you're working toward is always in the plan.
  for (const g of lifts) {
    const m = muscleOf(g.exercise);
    if (!wanted.has(m)) continue;
    if (picked.length >= want) break;
    take({ name: g.exercise, muscle: m, compound: true }, g.metric === 'weight' ? { sets: 5, reps: '3–5', note: `Goal: ${g.target} ${unit}. Work up heavy.` } : { note: `Goal: ${g.target} ${unit} (estimated 1RM).` });
    reasons.push(`${g.exercise} leads because it's one of your goals.`);
  }

  const best = (list) => {
    let top = null;
    let topScore = -Infinity;
    for (const c of list) {
      if (picked.some((x) => key(x.name) === key(c.name))) continue;
      const sc = scoreOf(c);
      if (sc > topScore) {
        top = c;
        topScore = sc;
      }
    }
    return top;
  };
  const fill = (slot) => {
    const c = best(candidatesFor(slot)) ?? best(fallback(musclesFor(slot)));
    if (!c) return false;
    const compound = COMPOUND_SLOTS.has(c.slot) || (c.slot === 'library' && !!meta.get(key(c.name))?.compound);
    return take({ ...c, compound }, compound ? {} : { sets: Math.min(scheme.sets, 3), reps: intent === 'lose' ? '12–15' : '10–15' });
  };
  const focusKey = groups.length > 1 ? 'full' : groups[0];
  const template = TEMPLATES[focusKey] ?? TEMPLATES.full;
  for (const slot of template) {
    if (picked.length >= want) break;
    fill(slot);
  }
  // Still short (a small setup or a narrow focus): any other familiar exercise for these muscles.
  for (const slot of [...template, ...template]) {
    if (picked.length >= want) break;
    if (!fill(slot)) {
      const any = best([...core, ...mine]);
      if (any) fill(any.slot === 'accessory' ? `acc:${any.muscle}` : any.slot);
    }
  }
  // Big compound lifts open the session (after any goal lifts), then the smaller ones.
  const goalCount = picked.filter((p) => lifts.some((g) => key(g.exercise) === key(p.name))).length;
  const rest = picked.splice(goalCount);
  picked.push(...rest.filter((p) => p.compound), ...rest.filter((p) => !p.compound));
  if (picked.length < 3 && gear !== 'gym') reasons.push('There are only a few familiar moves for this focus with your equipment. A resistance band or a pair of dumbbells opens up more.');

  // ---- weights, and a lighter day when you need one ----
  const equipOf = (name) => custom.find((c) => !c.deleted_at && key(c.name) === key(name))?.equipment || meta.get(key(name))?.equipment || '';
  const extra = light ? 0 : Math.min(2, Math.max(0, Math.round(boost)));
  if (extra && picked.some((p) => p.mode === 'weight')) reasons.push(`Strong recent weeks, so your first lifts get ${extra === 1 ? 'an extra set' : 'two extra sets'}.`);
  picked.forEach((p, i) => {
    if (extra && i < 2 && p.mode === 'weight') p.sets = Math.min(5, p.sets + extra);
  });
  for (const p of picked) {
    if (light && p.sets > 2) p.sets -= 1;
    if (p.mode !== 'weight') continue;
    const goalLift = lifts.find((g) => key(g.exercise) === key(p.name) && g.metric === 'weight');
    const w = suggestWeight(p.name, sessions, { unit, reps: p.reps, equipment: equipOf(p.name), goal: !!goalLift, light });
    if (w) {
      p.weight = w.weight;
      p.why = w.note;
      if (w.justPR) p.why = `New best last time, nice. ${w.note}`;
      if (w.stalled) p.why = `${w.note}. No progress in 3 sessions: try a new rep range (5–6 or 12–15), add a lighter back-off set, or take a rest day first.`;
    } else {
      p.why = 'No history yet: pick a weight where the last rep is hard but clean.';
    }
  }

  // Heavy opening lifts get a short ramp of warm-up sets.
  const heavyMin = unit === 'kg' ? 40 : 95;
  let ramps = 0;
  for (const p of picked) {
    if (ramps >= 2) break;
    if (p.mode !== 'weight' || !p.weight) continue;
    if (!(equipOf(p.name) === 'barbell' || p.weight >= heavyMin)) continue;
    const ramp = warmupRamp(p.weight, unit);
    if (ramp.length) {
      p.warmups = ramp;
      ramps++;
    }
  }

  // ---- cool-down stretches for the muscles you worked, from the curated stretch list ----
  const cool = workoutPlan({ exercises: picked.map((p) => ({ name: p.name, sets: Array.from({ length: p.sets }, () => ({ done: true })) })) }, library);
  const stretches = buildStretches({ regions: cool.regions, weights: cool.weights, minutes: 5, seed })
    .slice(0, 5)
    .map((x) => x.name);

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
  for (const type of interests) {
    if (ideas.length >= 3) break;
    if (!ideas.some((i) => i.type === type)) ideas.push({ type, minutes: ['stretching', 'yoga'].includes(type) ? 20 : ['basketball', 'soccer', 'tennis', 'pickleball', 'baseball', 'softball', 'volleyball', 'golf', 'climb', 'martial'].includes(type) ? 45 : 30, label: `${typeLabel(type)} (you enjoy it)` });
  }
  const defaults = intent === 'lose' ? [['walk', 40], ['cycle', 30], ['run', 25]] : [['walk', 30], ['cycle', 30], ['stretching', 20]];
  for (const [type, m] of defaults) {
    if (ideas.length >= 3) break;
    if (!ideas.some((i) => i.type === type)) ideas.push({ type, minutes: m, label: typeLabel(type) });
  }

  // Cardio goals: if you're behind this week, put a matching activity first.
  const events = cardioEvents(activities, sessions);
  for (const g of live.filter((x) => x.type === 'weekly_minutes' || x.type === 'weekly_distance')) {
    const isMin = g.type === 'weekly_minutes';
    const p = weeklyTotalProgress(events, isMin ? 'minutes' : 'km', g.target, { type: isMin ? '' : g.exercise, weekStart, todayStr });
    if (p.reached) continue;
    const type = (!isMin && g.exercise) || ideas[0]?.type || 'walk';
    const left = isMin ? g.target - p.done : (g.target - p.done) / (events.filter((e) => e.type === type && e.km > 0 && e.minutes > 0).reduce((a, e) => a + e.km / e.minutes, 0) / Math.max(1, events.filter((e) => e.type === type && e.km > 0 && e.minutes > 0).length) || 0.1);
    const minutes = Math.max(20, Math.min(60, Math.round((isMin ? left : left) / 5) * 5 || 30));
    reasons.push(isMin ? `Cardio goal: ${Math.round(p.done)} of ${g.target} active minutes so far this week.` : `Distance goal: ${Math.round((p.done / g.target) * 100)}% of this week's target so far.`);
    const at = ideas.findIndex((i) => i.type === type);
    if (at >= 0) ideas.splice(at, 1);
    ideas.unshift({ type, minutes, label: `${typeLabel(type)} (for your goal)` });
  }
  ideas.length = Math.min(ideas.length, 3);

  const title = groups.length > 1 ? 'Full body' : `${GROUPS[groups[0]].label} day`;
  return { title, groups, intent, minutes, light, recovery, exercises: picked, stretches, ideas, reasons, empty: picked.length === 0 };
}

// Turn a suggestion into a routine-shaped template the workout screen can start from.
export function suggestionAsRoutine(s) {
  return {
    name: s.title,
    exercises: s.exercises.map((e) => ({
      name: e.name,
      mode: e.mode,
      link: false,
      notes: [`${e.sets} × ${e.reps}`, e.note, e.why].filter(Boolean).join('. '),
      ...(e.weight ? { target: { weight: e.weight, reps: Number(String(e.reps).match(/\d+/)?.[0]) || undefined, ...(e.warmups?.length ? { warmups: e.warmups } : {}) } } : {}),
      sets: [...(e.warmups ?? []).map(() => ({ type: 'warmup' })), ...Array.from({ length: e.sets }, () => ({ type: 'normal' }))],
    })),
  };
}

export const coolDownNote = (s) => (s.stretches.length ? `Cool-down: ${s.stretches.join(', ')} (hold each 20–30 seconds).` : '');
