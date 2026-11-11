// Stretch sessions: pick what to stretch, build a list that fits your time, and turn it into
// timed steps for the guided mode. Pure functions, so they are easy to test.

// Head to toe. `muscles` are the library's muscle names.
export const REGIONS = [
  { id: 'neck', label: 'Neck and shoulders', muscles: ['neck', 'shoulders', 'traps'] },
  { id: 'chest', label: 'Chest and arms', muscles: ['chest', 'biceps', 'triceps', 'forearms'] },
  { id: 'back', label: 'Back', muscles: ['lats', 'middle back', 'lower back'] },
  { id: 'core', label: 'Core', muscles: ['abdominals'] },
  { id: 'hips', label: 'Hips and glutes', muscles: ['glutes', 'abductors', 'adductors'] },
  { id: 'quads', label: 'Quads', muscles: ['quadriceps'] },
  { id: 'hamstrings', label: 'Hamstrings', muscles: ['hamstrings'] },
  { id: 'calves', label: 'Calves', muscles: ['calves'] },
];
export const REGION_IDS = REGIONS.map((r) => r.id);
export const regionLabel = (id) => REGIONS.find((r) => r.id === id)?.label ?? 'Other';
export const regionOfMuscle = (m) => REGIONS.find((r) => r.muscles.includes(m))?.id ?? null;

export const PRESETS = [
  { id: 'upper', label: 'Upper body', regions: ['neck', 'chest', 'back', 'core'] },
  { id: 'lower', label: 'Lower body', regions: ['hips', 'quads', 'hamstrings', 'calves'] },
  { id: 'run', label: 'After a run', regions: ['hips', 'quads', 'hamstrings', 'calves'] },
  { id: 'desk', label: 'Desk relief', regions: ['neck', 'chest', 'back', 'hips'] },
];
export const TIMES = [5, 10, 15, 20];

// [name, region, hold seconds, each side, how to do it]
const RAW = [
  ['Neck side tilt', 'neck', 20, true, 'Sit tall. Lower one ear toward the same shoulder and let the other shoulder drop. No pulling.'],
  ['Upper trap stretch', 'neck', 20, true, 'Sit tall. Tilt your head to one side and turn your nose slightly down. Rest a hand lightly on your head.'],
  ['Cross-body shoulder stretch', 'neck', 30, true, 'Bring one arm across your chest. Hold it above the elbow with the other hand and keep your shoulder down.'],
  ['Eagle arms stretch', 'neck', 30, true, 'Cross one arm over the other and wrap your forearms. Lift your elbows slightly and breathe.'],
  ['Doorway chest stretch', 'chest', 30, false, 'Forearms on a door frame, elbows just below shoulder height. Step through until you feel your chest open.'],
  ['Behind-the-back chest opener', 'chest', 30, false, 'Clasp your hands behind you, straighten your arms and lift them slightly while you stand tall.'],
  ['Overhead triceps stretch', 'chest', 30, true, 'Reach one hand down your back. Use the other hand to gently press the elbow back and up.'],
  ['Biceps wall stretch', 'chest', 30, true, 'Place your palm on a wall behind you at shoulder height, fingers back. Turn your body away.'],
  ['Wrist flexor stretch', 'chest', 20, true, 'Arm out, palm up. Use the other hand to gently pull the fingers back toward the floor.'],
  ['Wrist extensor stretch', 'chest', 20, true, 'Arm out, palm down. Use the other hand to gently press the back of the hand toward you.'],
  ['Child’s pose', 'back', 40, false, 'Sit back on your heels with your arms stretched forward and your forehead down. Breathe into your back.'],
  ['Cat-cow', 'back', 30, false, 'On hands and knees, slowly arch your back and drop your belly, then round it and tuck your chin. Move with your breath.'],
  ['Thread the needle', 'back', 30, true, 'From hands and knees, slide one arm under your chest and rest your shoulder and ear on the floor.'],
  ['Seated spinal twist', 'back', 30, true, 'Sit tall with legs crossed or extended. Twist toward the bent knee and look over your shoulder.'],
  ['Standing lat stretch', 'back', 30, true, 'Hold a wall or post with one hand, sit your hips back and lean away until your side body lengthens.'],
  ['Knees-to-chest stretch', 'back', 30, false, 'Lie on your back and hug both knees toward your chest. Let your lower back relax into the floor.'],
  ['Supine spinal twist', 'back', 30, true, 'Lie on your back, drop both knees to one side and open your opposite arm. Keep both shoulders down.'],
  ['Cobra stretch', 'core', 30, false, 'Lie on your stomach, hands under your shoulders. Press up gently and let your belly stretch. Keep your hips down.'],
  ['Standing side bend', 'core', 20, true, 'Reach one arm overhead and lean to the opposite side. Keep both feet planted and your chest facing forward.'],
  ['Figure-4 stretch', 'hips', 30, true, 'On your back, rest one ankle on the opposite knee and pull that thigh toward you.'],
  ['Pigeon pose', 'hips', 40, true, 'From hands and knees, bring one shin forward across your body and extend the other leg back. Fold forward if you can.'],
  ['Kneeling hip flexor stretch', 'hips', 30, true, 'Half-kneel, tuck your tailbone under and shift forward until the front of your back hip stretches.'],
  ['Butterfly stretch', 'hips', 40, false, 'Sit with the soles of your feet together and let your knees fall open. Sit tall or fold forward.'],
  ['Side lunge stretch', 'hips', 30, true, 'Step wide, bend one knee and sit back into it. Keep the other leg straight and your chest up.'],
  ['90/90 hip stretch', 'hips', 40, true, 'Sit with both knees bent at right angles, one in front and one to the side. Sit tall, then lean forward.'],
  ['Standing quad stretch', 'quads', 30, true, 'Hold a wall for balance. Pull one heel toward your glute with your knees together and hips tucked.'],
  ['Lying quad stretch', 'quads', 30, true, 'Lie on your side, pull your top heel toward your glute and push the hip forward slightly.'],
  ['Seated hamstring stretch', 'hamstrings', 30, true, 'Sit with one leg straight and the other bent. Hinge forward from your hips with a long back.'],
  ['Standing hamstring stretch', 'hamstrings', 30, true, 'Rest one heel on a low step, keep the leg straight and hinge forward from your hips.'],
  ['Supine hamstring stretch', 'hamstrings', 30, true, 'Lie on your back and raise one leg. Hold behind the thigh or use a towel around your foot.'],
  ['Standing forward fold', 'hamstrings', 30, false, 'Feet hip width apart, soft knees. Hang forward from your hips and let your head and arms hang.'],
  ['Wall calf stretch', 'calves', 30, true, 'Hands on a wall, one leg back with the heel down and the knee straight. Lean in.'],
  ['Bent-knee calf stretch', 'calves', 30, true, 'Same position as the wall stretch, but bend the back knee slightly to reach the lower calf.'],
  ['Downward dog', 'calves', 30, false, 'Hands and feet on the floor, hips high. Pedal your heels down one at a time.'],
].map(([name, region, hold, sides, cue]) => ({ name, region, hold, sides, cue, curated: true }));

// Closest library entry for each curated stretch, so its pictures and steps can be shown.
// Only confident matches are listed; the rest show the cue and video links.
const LIB = {
  'Neck side tilt': 'Side Neck Stretch',
  'Cross-body shoulder stretch': 'Shoulder Stretch',
  'Doorway chest stretch': 'Chest And Front Of Shoulder Stretch',
  'Overhead triceps stretch': 'Overhead Triceps',
  'Biceps wall stretch': 'Standing Biceps Stretch',
  'Child’s pose': "Child's Pose",
  'Cat-cow': 'Cat Stretch',
  'Standing lat stretch': 'Overhead Lat',
  'Knees-to-chest stretch': 'Hug Knees To Chest',
  'Supine spinal twist': 'Knee Across The Body',
  'Standing side bend': 'Standing Lateral Stretch',
  'Figure-4 stretch': 'Lying Glute',
  'Kneeling hip flexor stretch': 'Kneeling Hip Flexor',
  'Standing quad stretch': 'Quad Stretch',
  'Lying quad stretch': 'On Your Side Quad Stretch',
  'Seated hamstring stretch': 'Seated Hamstring',
  'Standing hamstring stretch': 'Standing Hamstring and Calf Stretch',
  'Supine hamstring stretch': 'Lying Hamstring',
  'Standing forward fold': 'Standing Toe Touches',
  'Wall calf stretch': 'Calf Stretch Hands Against Wall',
  'Bent-knee calf stretch': 'Standing Soleus And Achilles Stretch',
};
for (const s of RAW) if (LIB[s.name]) s.lib = LIB[s.name];
export const CURATED = RAW;
const MAPPED = new Set(Object.values(LIB).map((n) => n.toLowerCase()));
const BY_NAME = new Map(RAW.map((s) => [s.name.toLowerCase(), s]));
export const curatedStretch = (name) => BY_NAME.get(String(name ?? '').toLowerCase()) ?? null;

const GOOD_STRETCH = /stretch|pose|pigeon|cobra|kneeling|hug|fold/i;
const rng = (seed) => {
  let a = (seed + 1) * 2654435761;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const shuffle = (arr, rand) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Everything that could go in a region: our curated stretches first, then the library's.
function candidates(region, library) {
  const mine = RAW.filter((s) => s.region === region);
  const muscles = REGIONS.find((r) => r.id === region)?.muscles ?? [];
  const lib = (library ?? [])
    .filter((l) => !MAPPED.has(l.name.toLowerCase())) // already covered by one of ours
    .filter((l) => l.category === 'stretching' && muscles.includes(l.muscle) && !/smr/i.test(l.name) && ['bodyweight', 'other', 'bands'].includes(l.equipment) && l.level !== 'expert')
    .filter((l) => GOOD_STRETCH.test(l.name) || !muscles.length)
    .map((l) => ({ name: l.name, region, hold: 30, sides: false, cue: '', curated: false }));
  return { mine, lib };
}

export const slotSeconds = (s, gap = 8) => s.hold * (s.sides ? 2 : 1) + gap;
export const sessionSeconds = (list) => list.reduce((t, s) => t + slotSeconds(s), 0);
const holdFor = (minutes) => (minutes <= 5 ? 20 : 0); // short sessions shorten the holds

const pick = (region, library, rand, used, minutes) => {
  const { mine, lib } = candidates(region, library);
  const free = (arr) => arr.filter((s) => !used.has(s.name.toLowerCase()));
  const pool = free(mine).length ? free(mine) : free(lib);
  if (!pool.length) return null;
  const s = shuffle(pool, rand)[0];
  const cap = holdFor(minutes);
  return { ...s, hold: cap ? Math.min(s.hold, cap) : s.hold };
};

// A stretch list for the areas you chose that fits the time. Regions come head to toe, and
// when time is short we spread across the chosen areas rather than dropping the lower ones.
export function buildStretches({ regions = REGION_IDS, minutes = 10, library = [], seed = 0, exclude = [], weights = null } = {}) {
  const chosen = REGION_IDS.filter((r) => regions.includes(r));
  if (!chosen.length) return [];
  const rand = rng(seed);
  const used = new Set(exclude.map((n) => n.toLowerCase()));
  const budget = minutes * 60;
  const avg = 60;
  const firstRound = Math.max(1, Math.min(chosen.length, Math.floor(budget / avg)));
  const w = (r) => Math.sqrt(weights?.[r] ?? 1); // soften: the top area leads without crowding out the rest
  const round1 =
    firstRound >= chosen.length
      ? chosen
      : weights
        ? [...chosen].sort((a, b) => w(b) - w(a)).slice(0, firstRound) // short on time: the most worked areas
        : Array.from({ length: firstRound }, (_, i) => chosen[Math.floor(((i + 0.5) * chosen.length) / firstRound)]);
  const out = [];
  let secs = 0;
  const add = (region) => {
    const s = pick(region, library, rand, used, minutes);
    if (!s) return false;
    const t = slotSeconds(s);
    if (out.length && secs + t > budget + 20) return false;
    out.push(s);
    used.add(s.name.toLowerCase());
    secs += t;
    return true;
  };
  for (const r of round1) add(r);
  // Time left over: keep adding, one per region in turn.
  let guard = 0;
  let progress = true;
  if (weights) {
    // Spend the spare time where you worked hardest: each area gets stretches in proportion to its weight.
    const count = (r) => out.filter((x) => x.region === r).length;
    const dead = new Set();
    while (secs < budget - 30 && guard++ < 40) {
      const live = chosen.filter((r) => !dead.has(r));
      if (!live.length) break;
      const next = live.reduce((best, r) => (w(r) / (count(r) + 1) > w(best) / (count(best) + 1) ? r : best));
      if (!add(next)) dead.add(next);
    }
  }
  while (!weights && progress && guard++ < 20) {
    progress = false;
    for (const r of chosen) if (secs < budget - 30 && add(r)) progress = true;
  }
  return out.sort((a, b) => REGION_IDS.indexOf(a.region) - REGION_IDS.indexOf(b.region));
}

// Another stretch for the same area, not already in the list.
export function swapStretch(list, index, { library = [], seed = 0 } = {}) {
  const cur = list[index];
  if (!cur) return list;
  const used = new Set(list.map((s) => s.name.toLowerCase()));
  const s = pick(cur.region, library, rng(seed + index * 7), used, 10);
  if (!s) return list;
  return list.map((x, i) => (i === index ? { ...s, hold: cur.hold < s.hold ? s.hold : s.hold } : x));
}

// A name you added yourself from the library or typed.
export function stretchItem(name, library = []) {
  const c = curatedStretch(name);
  if (c) return { ...c };
  const lib = (library ?? []).find((l) => l.name.toLowerCase() === String(name).toLowerCase());
  return { name, region: lib ? regionOfMuscle(lib.muscle) ?? 'other' : 'other', hold: 30, sides: false, cue: '', curated: false };
}

// ---- stretching what you actually trained ----
// Compound lifts also work supporting muscles; this says how much credit each one gets.
const SUPPORT = {
  quadriceps: { glutes: 0.5, hamstrings: 0.3 },
  hamstrings: { glutes: 0.5, 'lower back': 0.3 },
  glutes: { hamstrings: 0.4, quadriceps: 0.3 },
  'lower back': { hamstrings: 0.6, glutes: 0.6 },
  chest: { shoulders: 0.5, triceps: 0.5 },
  shoulders: { triceps: 0.5, traps: 0.3, chest: 0.2 },
  lats: { biceps: 0.5, 'middle back': 0.3, forearms: 0.2 },
  'middle back': { lats: 0.5, biceps: 0.4 },
  traps: { shoulders: 0.4 },
  triceps: { chest: 0.3, shoulders: 0.3 },
  biceps: { forearms: 0.2 },
};
const LEGS = { calves: 1, quads: 1, hamstrings: 1, hips: 1 };
// Areas each activity works, in region ids.
const ACTIVITY_REGIONS = {
  run: LEGS,
  hike: LEGS,
  walk: { calves: 0.6, quads: 0.6, hamstrings: 0.6, hips: 0.6 },
  cycle: { quads: 1, hips: 1, calves: 0.7, hamstrings: 0.7 },
  elliptical: { quads: 0.8, hips: 0.8, calves: 0.8, hamstrings: 0.8 },
  swim: { neck: 1, back: 1, chest: 0.7 },
  row: { back: 1, hamstrings: 0.6, quads: 0.6, neck: 0.5 },
  climb: { chest: 0.8, back: 1, neck: 0.8 },
  hiit: { quads: 0.7, hamstrings: 0.7, hips: 0.7, calves: 0.7, core: 0.5 },
  soccer: { quads: 0.8, hamstrings: 0.8, calves: 0.8, hips: 0.8 },
  basketball: { quads: 0.8, hamstrings: 0.6, calves: 0.8, hips: 0.6 },
  tennis: { neck: 0.7, back: 0.5, quads: 0.5, calves: 0.5 },
  pickleball: { neck: 0.6, quads: 0.5, calves: 0.5, hips: 0.4 },
  volleyball: { neck: 0.7, quads: 0.5, calves: 0.5 },
  table_tennis: { neck: 0.5, back: 0.4 },
  baseball: { neck: 0.7, core: 0.5, hips: 0.5 },
  softball: { neck: 0.7, core: 0.5, hips: 0.5 },
  golf: { back: 0.7, core: 0.5, neck: 0.5, hips: 0.4 },
  martial: { hips: 0.7, hamstrings: 0.6, quads: 0.5, neck: 0.4 },
};
const nameOf = (e) => String(e?.name ?? '').toLowerCase();

// How much each stretch area got worked by a set of exercises, plus which exercises drove it.
function addExerciseWork(acc, exercises, library, factor = 1) {
  const byName = new Map((library ?? []).map((l) => [l.name.toLowerCase(), l]));
  for (const e of exercises ?? []) {
    if (e.mode === 'stretch') continue;
    const lib = byName.get(nameOf(e));
    if (!lib?.muscle) continue;
    const sets = Array.isArray(e.sets) ? e.sets.filter((st) => st.done !== false && st.type !== 'warmup').length : 1;
    if (!sets) continue;
    const credit = { [lib.muscle]: 1 };
    if (lib.compound) for (const [m, f] of Object.entries(SUPPORT[lib.muscle] ?? {})) credit[m] = (credit[m] ?? 0) + f;
    let total = 0;
    for (const [m, f] of Object.entries(credit)) {
      const r = regionOfMuscle(m);
      if (!r) continue;
      acc.weights[r] = (acc.weights[r] ?? 0) + f * sets * factor;
      total += f * sets;
    }
    acc.drivers.push({ name: e.name, score: total * factor });
  }
}

function addActivityWork(acc, a, factor = 1) {
  const map = ACTIVITY_REGIONS[a?.type];
  if (!map) return;
  const load = Math.min(4, Math.max(1, (Number(a.duration_min) || 0) / 15)) * factor;
  for (const [r, f] of Object.entries(map)) acc.weights[r] = (acc.weights[r] ?? 0) + f * load;
  acc.drivers.push({ name: a.title || a.type, score: load * 2 });
}

// Turn raw weights into a plan: the areas that matter, how much, and a sentence on why.
function finishPlan(acc) {
  const entries = Object.entries(acc.weights).filter(([, v]) => v > 0);
  if (!entries.length) return { regions: [], weights: {}, because: '' };
  const max = Math.max(...entries.map(([, v]) => v));
  const keep = entries
    .filter(([, v]) => v >= max * 0.2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const weights = Object.fromEntries(keep.map(([r, v]) => [r, Math.round((v / max) * 100) / 100]));
  const names = [];
  for (const d of [...acc.drivers].sort((a, b) => b.score - a.score)) if (!names.includes(d.name)) names.push(d.name);
  const shown = names.slice(0, 3);
  const because = shown.length ? `Because of ${shown.join(', ').replace(/, ([^,]*)$/, shown.length > 1 ? ' and $1' : ', $1')}${names.length > 3 ? ' and more' : ''}.` : '';
  return { regions: REGION_IDS.filter((r) => weights[r] != null), weights, because };
}
const fresh = () => ({ weights: {}, drivers: [] });

// Stretch areas for one workout: its completed sets (and supporting muscles), nothing else.
export function workoutPlan(session, library) {
  const acc = fresh();
  addExerciseWork(acc, session?.exercises, library);
  const plan = finishPlan(acc);
  return { ...plan, minutes: workoutMinutes(session) };
}

// 5 minutes after a normal workout, 10 after a long one.
export function workoutMinutes(session, now = Date.now()) {
  const start = Date.parse(session?.started_at ?? '');
  if (!Number.isFinite(start)) return 5;
  const end = session?.ended_at ? Date.parse(session.ended_at) : now;
  return (end - start) / 60000 > 60 ? 10 : 5;
}

// The last few days of workouts and activities, today counting most.
export function recentPlan(sessions, library, todayStr, { activities = [], days = 3 } = {}) {
  const dayNum = (d) => Math.round(new Date(`${d}T12:00:00`).getTime() / 86400000);
  const today = dayNum(todayStr);
  const factor = (d) => [1, 0.6, 0.35, 0.2][today - dayNum(d)] ?? 0;
  const acc = fresh();
  for (const s of sessions ?? []) {
    if (s.deleted_at || !s.ended_at || !s.date) continue;
    const age = today - dayNum(s.date);
    if (age < 0 || age > days) continue;
    addExerciseWork(acc, s.exercises, library, factor(s.date));
  }
  for (const a of activities ?? []) {
    if (a.deleted_at || !a.date) continue;
    const age = today - dayNum(a.date);
    if (age < 0 || age > days) continue;
    addActivityWork(acc, a, factor(a.date));
  }
  return finishPlan(acc);
}
export const recentRegions = (sessions, library, todayStr, days = 3) => recentPlan(sessions, library, todayStr, { days }).regions;

// Timed steps for the guided mode: a short get-ready, then each hold (twice for each side).
export function guideSteps(list, { ready = 5, switchSecs = 4 } = {}) {
  const steps = [];
  list.forEach((s, i) => {
    steps.push({ kind: 'ready', seconds: ready, index: i, name: s.name });
    if (s.sides) {
      steps.push({ kind: 'hold', seconds: s.hold, index: i, name: s.name, side: 1 });
      steps.push({ kind: 'switch', seconds: switchSecs, index: i, name: s.name });
      steps.push({ kind: 'hold', seconds: s.hold, index: i, name: s.name, side: 2 });
    } else steps.push({ kind: 'hold', seconds: s.hold, index: i, name: s.name, side: 0 });
  });
  return steps;
}
export const stepsSeconds = (steps) => steps.reduce((t, s) => t + s.seconds, 0);

// A name for the activity that gets logged.
export function sessionTitle(regions) {
  const set = REGION_IDS.filter((r) => regions.includes(r));
  if (!set.length || set.length === REGION_IDS.length) return 'Total body stretch';
  const names = set.slice(0, 3).map((r) => regionLabel(r).split(' and ')[0].toLowerCase());
  return `Stretch: ${names.join(', ')}${set.length > 3 ? '…' : ''}`;
}
