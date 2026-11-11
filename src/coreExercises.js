// The core list: familiar, well-understood exercises that suggested workouts are built from.
// Names are the library's exact names (so history, records and pictures keep matching);
// `display` is the short, everyday name shown in the app.
//
// slot:  squat | hinge | h-push | v-push | h-pull | v-pull | core | accessory
// level: the least experience it suits: new | some | pro
// equip: what you need (bodyweight means nothing at all)
// bar:   needs a pull-up bar or rack, so only offered with a full gym
// star:  a staple most people know; gets a head start when picking
import { key } from './stats';

// [library name, display name, slot, muscle, equip, level, flags]
const RAW = [
  // ---- legs: knee-dominant (squat slot) ----
  ['Barbell Squat', 'Back squat', 'squat', 'quadriceps', 'barbell', 'some', 'star'],
  ['Goblet Squat', 'Goblet squat', 'squat', 'quadriceps', 'kettlebell', 'new', 'star'],
  ['Leg Press', 'Leg press', 'squat', 'quadriceps', 'machine', 'new', 'star'],
  ['Dumbbell Squat', 'Dumbbell squat', 'squat', 'quadriceps', 'dumbbell', 'new'],
  ['Bodyweight Squat', 'Bodyweight squat', 'squat', 'quadriceps', 'bodyweight', 'new', 'star'],
  ['Split Squat with Dumbbells', 'Split squat', 'squat', 'quadriceps', 'dumbbell', 'new'],
  ['Dumbbell Lunges', 'Dumbbell lunge', 'squat', 'quadriceps', 'dumbbell', 'new'],
  ['Bodyweight Walking Lunge', 'Walking lunge', 'squat', 'quadriceps', 'bodyweight', 'new'],
  ['Dumbbell Step Ups', 'Step-up', 'squat', 'quadriceps', 'dumbbell', 'new'],
  ['Hack Squat', 'Hack squat', 'squat', 'quadriceps', 'machine', 'some'],
  ['Front Squat (Clean Grip)', 'Front squat', 'squat', 'quadriceps', 'barbell', 'pro'],

  // ---- legs and back: hip-dominant (hinge slot) ----
  ['Barbell Deadlift', 'Deadlift', 'hinge', 'lower back', 'barbell', 'some', 'star'],
  ['Romanian Deadlift', 'Romanian deadlift', 'hinge', 'hamstrings', 'barbell', 'some', 'star'],
  ['Stiff-Legged Dumbbell Deadlift', 'Dumbbell Romanian deadlift', 'hinge', 'hamstrings', 'dumbbell', 'new', 'star'],
  ['Barbell Hip Thrust', 'Hip thrust', 'hinge', 'glutes', 'barbell', 'some'],
  ['Butt Lift (Bridge)', 'Glute bridge', 'hinge', 'glutes', 'bodyweight', 'new', 'star'],
  ['Single Leg Glute Bridge', 'Single-leg glute bridge', 'hinge', 'glutes', 'bodyweight', 'some'],
  ['One-Arm Kettlebell Swings', 'Kettlebell swing', 'hinge', 'hamstrings', 'kettlebell', 'some'],
  ['Band Good Morning', 'Band good morning', 'hinge', 'hamstrings', 'bands', 'new'],
  ['Good Morning', 'Good morning', 'hinge', 'hamstrings', 'barbell', 'pro'],
  ['Hyperextensions (Back Extensions)', 'Back extension', 'hinge', 'lower back', 'other', 'new'],
  ['Hyperextensions With No Hyperextension Bench', 'Floor back extension', 'hinge', 'lower back', 'bodyweight', 'some'],

  // ---- legs: accessories ----
  ['Leg Extensions', 'Leg extension', 'accessory', 'quadriceps', 'machine', 'new'],
  ['Lying Leg Curls', 'Lying leg curl', 'accessory', 'hamstrings', 'machine', 'new', 'star'],
  ['Seated Leg Curl', 'Seated leg curl', 'accessory', 'hamstrings', 'machine', 'new', 'star'],
  ['Ball Leg Curl', 'Ball leg curl', 'accessory', 'hamstrings', 'exercise-ball', 'some'],
  ['Standing Calf Raises', 'Standing calf raise', 'accessory', 'calves', 'machine', 'new', 'star'],
  ['Seated Calf Raise', 'Seated calf raise', 'accessory', 'calves', 'machine', 'new'],
  ['Standing Dumbbell Calf Raise', 'Dumbbell calf raise', 'accessory', 'calves', 'dumbbell', 'new'],
  ['Calf Raises - With Bands', 'Band calf raise', 'accessory', 'calves', 'bands', 'new'],
  ['Glute Kickback', 'Glute kickback', 'accessory', 'glutes', 'bodyweight', 'new'],
  ['Thigh Abductor', 'Hip abduction machine', 'accessory', 'abductors', 'machine', 'new'],
  ['Thigh Adductor', 'Hip adduction machine', 'accessory', 'adductors', 'machine', 'new'],

  // ---- chest: horizontal push ----
  ['Barbell Bench Press - Medium Grip', 'Bench press', 'h-push', 'chest', 'barbell', 'new', 'star'],
  ['Dumbbell Bench Press', 'Dumbbell bench press', 'h-push', 'chest', 'dumbbell', 'new', 'star'],
  ['Incline Dumbbell Press', 'Incline dumbbell press', 'h-push', 'chest', 'dumbbell', 'new', 'star'],
  ['Barbell Incline Bench Press - Medium Grip', 'Incline bench press', 'h-push', 'chest', 'barbell', 'some'],
  ['Machine Bench Press', 'Machine chest press', 'h-push', 'chest', 'machine', 'new'],
  ['Pushups', 'Push-up', 'h-push', 'chest', 'bodyweight', 'new', 'star'],
  ['Incline Push-Up', 'Incline push-up', 'h-push', 'chest', 'bodyweight', 'new'],
  ['Push-Ups With Feet Elevated', 'Decline push-up', 'h-push', 'chest', 'bodyweight', 'some'],
  ['Push-Up Wide', 'Wide push-up', 'h-push', 'chest', 'bodyweight', 'some'],
  ['Dips - Chest Version', 'Chest dip', 'h-push', 'chest', 'other', 'some'],
  ['Close-Grip Barbell Bench Press', 'Close-grip bench press', 'h-push', 'triceps', 'barbell', 'some'],

  // ---- shoulders: vertical push ----
  ['Standing Military Press', 'Overhead press', 'v-push', 'shoulders', 'barbell', 'some', 'star'],
  ['Seated Dumbbell Press', 'Seated dumbbell shoulder press', 'v-push', 'shoulders', 'dumbbell', 'new', 'star'],
  ['Standing Dumbbell Press', 'Standing dumbbell press', 'v-push', 'shoulders', 'dumbbell', 'new'],
  ['Machine Shoulder (Military) Press', 'Machine shoulder press', 'v-push', 'shoulders', 'machine', 'new'],
  ['Arnold Dumbbell Press', 'Arnold press', 'v-push', 'shoulders', 'dumbbell', 'some'],
  ['Shoulder Press - With Bands', 'Band shoulder press', 'v-push', 'shoulders', 'bands', 'new'],

  // ---- push accessories ----
  ['Side Lateral Raise', 'Lateral raise', 'accessory', 'shoulders', 'dumbbell', 'new', 'star'],
  ['Cable Seated Lateral Raise', 'Cable lateral raise', 'accessory', 'shoulders', 'cable', 'new'],
  ['Lateral Raise - With Bands', 'Band lateral raise', 'accessory', 'shoulders', 'bands', 'new'],
  ['Face Pull', 'Face pull', 'accessory', 'shoulders', 'cable', 'some'],
  ['Band Pull Apart', 'Band pull-apart', 'accessory', 'shoulders', 'bands', 'new'],
  ['Dumbbell Flyes', 'Dumbbell fly', 'accessory', 'chest', 'dumbbell', 'new'],
  ['Cable Crossover', 'Cable fly', 'accessory', 'chest', 'cable', 'new'],
  ['Butterfly', 'Pec deck', 'accessory', 'chest', 'machine', 'new'],
  ['Triceps Pushdown', 'Triceps pushdown', 'accessory', 'triceps', 'cable', 'new', 'star'],
  ['Triceps Pushdown - Rope Attachment', 'Rope pushdown', 'accessory', 'triceps', 'cable', 'new'],
  ['Cable Rope Overhead Triceps Extension', 'Overhead cable triceps extension', 'accessory', 'triceps', 'cable', 'new'],
  ['EZ-Bar Skullcrusher', 'Skull crusher', 'accessory', 'triceps', 'ez-bar', 'some'],
  ['Standing Dumbbell Triceps Extension', 'Overhead dumbbell triceps extension', 'accessory', 'triceps', 'dumbbell', 'new'],
  ['Tricep Dumbbell Kickback', 'Triceps kickback', 'accessory', 'triceps', 'dumbbell', 'new'],
  ['Bench Dips', 'Bench dip', 'accessory', 'triceps', 'bodyweight', 'new'],
  ['Incline Push-Up Close-Grip', 'Close-grip incline push-up', 'accessory', 'triceps', 'bodyweight', 'new'],
  ['Push-Ups - Close Triceps Position', 'Diamond push-up', 'accessory', 'triceps', 'bodyweight', 'some'],

  // ---- back: vertical pull ----
  ['Wide-Grip Lat Pulldown', 'Lat pulldown', 'v-pull', 'lats', 'cable', 'new', 'star'],
  ['Close-Grip Front Lat Pulldown', 'Close-grip pulldown', 'v-pull', 'lats', 'cable', 'new'],
  ['Pullups', 'Pull-up', 'v-pull', 'lats', 'bodyweight', 'some', 'star bar'],
  ['Chin-Up', 'Chin-up', 'v-pull', 'lats', 'bodyweight', 'some', 'bar'],
  ['Band Assisted Pull-Up', 'Assisted pull-up', 'v-pull', 'lats', 'bands', 'some', 'bar'],
  ['Straight-Arm Pulldown', 'Straight-arm pulldown', 'accessory', 'lats', 'cable', 'some'],

  // ---- back: horizontal pull ----
  ['Seated Cable Rows', 'Seated cable row', 'h-pull', 'middle back', 'cable', 'new', 'star'],
  ['One-Arm Dumbbell Row', 'One-arm dumbbell row', 'h-pull', 'middle back', 'dumbbell', 'new', 'star'],
  ['Bent Over Two-Dumbbell Row', 'Dumbbell row', 'h-pull', 'middle back', 'dumbbell', 'new'],
  ['Dumbbell Incline Row', 'Chest-supported dumbbell row', 'h-pull', 'middle back', 'dumbbell', 'new'],
  ['Bent Over Barbell Row', 'Barbell row', 'h-pull', 'middle back', 'barbell', 'some', 'star'],
  ['T-Bar Row with Handle', 'T-bar row', 'h-pull', 'middle back', 'barbell', 'some'],
  ['Inverted Row', 'Inverted row', 'h-pull', 'middle back', 'bodyweight', 'new'],

  // ---- pull accessories ----
  ['Dumbbell Bicep Curl', 'Dumbbell curl', 'accessory', 'biceps', 'dumbbell', 'new', 'star'],
  ['Barbell Curl', 'Barbell curl', 'accessory', 'biceps', 'barbell', 'new', 'star'],
  ['Hammer Curls', 'Hammer curl', 'accessory', 'biceps', 'dumbbell', 'new'],
  ['Machine Preacher Curls', 'Machine preacher curl', 'accessory', 'biceps', 'machine', 'new'],
  ['Preacher Curl', 'Preacher curl', 'accessory', 'biceps', 'barbell', 'some'],
  ['Dumbbell Shrug', 'Dumbbell shrug', 'accessory', 'traps', 'dumbbell', 'new'],
  ['Barbell Shrug', 'Barbell shrug', 'accessory', 'traps', 'barbell', 'new'],

  // ---- core ----
  ['Plank', 'Plank', 'core', 'abdominals', 'bodyweight', 'new', 'star'],
  ['Crunches', 'Crunch', 'core', 'abdominals', 'bodyweight', 'new', 'star'],
  ['Dead Bug', 'Dead bug', 'core', 'abdominals', 'bodyweight', 'new'],
  ['Side Bridge', 'Side plank', 'core', 'abdominals', 'bodyweight', 'new'],
  ['Flat Bench Lying Leg Raise', 'Lying leg raise', 'core', 'abdominals', 'bodyweight', 'new'],
  ['Bent-Knee Hip Raise', 'Reverse crunch', 'core', 'abdominals', 'bodyweight', 'new'],
  ['Air Bike', 'Bicycle crunch', 'core', 'abdominals', 'bodyweight', 'new'],
  ['Russian Twist', 'Russian twist', 'core', 'abdominals', 'bodyweight', 'some'],
  ['Cable Crunch', 'Cable crunch', 'core', 'abdominals', 'cable', 'new'],
  ['Pallof Press', 'Pallof press', 'core', 'abdominals', 'cable', 'new'],
  ['Standing Cable Wood Chop', 'Cable wood chop', 'core', 'abdominals', 'cable', 'some'],
  ['Knee/Hip Raise On Parallel Bars', "Captain's chair knee raise", 'core', 'abdominals', 'other', 'some'],
  ['Ab Roller', 'Ab wheel rollout', 'core', 'abdominals', 'other', 'some'],
];

export const SLOTS = ['squat', 'hinge', 'h-push', 'v-push', 'h-pull', 'v-pull', 'core', 'accessory'];
export const COMPOUND_SLOTS = new Set(['squat', 'hinge', 'h-push', 'v-push', 'h-pull', 'v-pull']);
export const LEVELS = ['new', 'some', 'pro'];

export const CORE_EXERCISES = RAW.map(([name, display, slot, muscle, equip, level, flags = '']) => ({
  name,
  display,
  slot,
  muscle,
  equip,
  level,
  bar: flags.includes('bar'),
  star: flags.includes('star'),
}));

const BY_KEY = new Map(CORE_EXERCISES.map((e) => [key(e.name), e]));
export const coreExercise = (name) => BY_KEY.get(key(name)) ?? null;

// What each kind of equipment setup can use. A full gym can use everything.
const GEAR_EQUIP = {
  dumbbells: new Set(['dumbbell', 'kettlebell', 'bands', 'bodyweight', 'exercise-ball']),
  bodyweight: new Set(['bodyweight']),
};
export function gearAllows(gear, equip, bar = false) {
  if (!gear || gear === 'gym') return true;
  if (bar) return false; // a pull-up bar or rack is gym kit
  return GEAR_EQUIP[gear]?.has(equip) ?? true;
}

// Does this exercise suit someone at this level? Unknown levels count as "some experience".
export function levelAllows(userLevel, exLevel) {
  const u = LEVELS.indexOf(userLevel);
  return LEVELS.indexOf(exLevel) <= (u < 0 ? 1 : u);
}

// Movements a beginner shouldn't be handed, whatever list they come from.
export const NOT_FOR_BEGINNERS = /pull-?ups?\b|chin-?ups?\b|single-leg high box/i;
