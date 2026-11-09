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
export function buildStretches({ regions = REGION_IDS, minutes = 10, library = [], seed = 0, exclude = [] } = {}) {
  const chosen = REGION_IDS.filter((r) => regions.includes(r));
  if (!chosen.length) return [];
  const rand = rng(seed);
  const used = new Set(exclude.map((n) => n.toLowerCase()));
  const budget = minutes * 60;
  const avg = 60;
  const firstRound = Math.max(1, Math.min(chosen.length, Math.floor(budget / avg)));
  const round1 = firstRound >= chosen.length ? chosen : Array.from({ length: firstRound }, (_, i) => chosen[Math.floor(((i + 0.5) * chosen.length) / firstRound)]);
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
  while (progress && guard++ < 20) {
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

// Regions you worked in the last few days, from your sessions.
export function recentRegions(sessions, library, todayStr, days = 3) {
  const from = new Date(`${todayStr}T12:00:00`);
  from.setDate(from.getDate() - days);
  const cut = from.toLocaleDateString('en-CA');
  const byName = new Map((library ?? []).map((l) => [l.name.toLowerCase(), l.muscle]));
  const out = new Set();
  for (const s of sessions ?? []) {
    if (s.deleted_at || !s.ended_at || s.date < cut) continue;
    for (const e of s.exercises ?? []) {
      const r = regionOfMuscle(byName.get(String(e.name).toLowerCase()));
      if (r) out.add(r);
    }
  }
  return REGION_IDS.filter((r) => out.has(r));
}

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
