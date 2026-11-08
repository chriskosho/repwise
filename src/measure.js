// How an exercise is measured. Not everything is weight × reps:
//   weight      weight and reps                (bench press, squat)
//   bodyweight  reps, plus optional added weight   (push-up, pull-up, crunch)
//   time        a timed hold, in seconds           (plank, side bridge)
//   stretch     a timed stretch, in seconds        (not counted as strength work)
//   cardio      time, distance, incline            (treadmill, bike, rower)
//   carry       weight and distance                (farmer's walk, sled push)
// Distances are stored in km and times in seconds; the screens convert.

export const MODES = [
  ['weight', 'Weight × reps'],
  ['bodyweight', 'Bodyweight reps'],
  ['time', 'Timed hold'],
  ['stretch', 'Stretch (timed)'],
  ['cardio', 'Cardio (time, distance)'],
  ['carry', 'Carry (weight, distance)'],
];
const MODE_SET = new Set(MODES.map(([m]) => m));
export const isMode = (m) => MODE_SET.has(m);

export const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// The mode of a logged exercise. Older workouts have no mode; their sets tell us what it was.
export function modeOf(ex) {
  if (isMode(ex?.mode)) return ex.mode;
  const sets = ex?.sets ?? [];
  if (sets.some((s) => num(s.distance) > 0 || num(s.incline) > 0)) return 'cardio';
  if (sets.some((s) => num(s.time) > 0)) return 'time';
  return 'weight';
}

// Strength modes build muscle volume; cardio and stretches don't.
export const isStrength = (mode) => mode === 'weight' || mode === 'bodyweight' || mode === 'time' || mode === 'carry';
export const usesWeight = (mode) => mode === 'weight' || mode === 'bodyweight' || mode === 'carry';
export const usesRest = (mode) => mode !== 'cardio' && mode !== 'stretch';

// Has this set been filled in enough to count?
export function isLogged(mode, s) {
  switch (mode) {
    case 'time':
    case 'stretch':
      return num(s.time) > 0;
    case 'cardio':
      return num(s.time) > 0 || num(s.distance) > 0;
    case 'carry':
      return num(s.distance) > 0;
    default:
      return num(s.reps) > 0;
  }
}

// What to call the thing you still need to enter.
export const needsHint = (mode) =>
  ({ time: 'Enter the time first.', stretch: 'Enter the time first.', cardio: 'Enter the time or distance first.', carry: 'Enter the distance first.' })[mode] ??
  'Enter the reps first.';

// Choose a mode for a library exercise from its category and name.
const HOLDS = /^plank$|side bridge|isometric (neck|chest|wipers)|battling ropes/i;
const CARRIES = /farmer's walk|rickshaw carry|yoke walk|sled (push|drag)|bear crawl sled|backward walk/i;
export function deriveMode({ name = '', category = '', equipment = '' } = {}) {
  if (category === 'cardio') return 'cardio';
  if (category === 'stretching') return 'stretch';
  if (/^wind sprints$/i.test(name)) return 'cardio';
  if (HOLDS.test(name)) return 'time';
  if (CARRIES.test(name)) return 'carry';
  if (equipment === 'bodyweight') return 'bodyweight';
  if (category === 'plyometrics' && (equipment === 'other' || equipment === 'bodyweight')) return 'bodyweight';
  return 'weight';
}

// Resolve the mode for a name: your own exercise's setting, then what you chose last time, then the library.
export function resolveMode(name, { library = [], custom = [], prior = [] } = {}) {
  const k = String(name ?? '').trim().toLowerCase();
  const mine = custom.find((c) => !c.deleted_at && c.name.trim().toLowerCase() === k && isMode(c.mode));
  if (mine) return mine.mode;
  for (const s of prior) {
    const ex = s.exercises?.find((e) => e.name.trim().toLowerCase() === k && isMode(e.mode));
    if (ex) return ex.mode;
  }
  const lib = library.find((l) => l.name.trim().toLowerCase() === k);
  return lib ? deriveMode(lib) : 'weight';
}

// Treadmills, ellipticals and stair machines have an incline or grade.
export const hasIncline = (name) => /treadmill|trail|jogging|running|walking|elliptical|stair|step ?mill|hike/i.test(name);
// Bikes and rowers read better as a speed than as a pace.
export const isSpeedy = (name) => /bicycl|bike|rowing|skating|elliptical/i.test(name);

// ---- units: distances are km; carries and sprints use yards or metres ----
const YD_PER_KM = 1093.6133;
export const shortUnit = (unit) => (unit === 'kg' ? 'm' : 'yd');
export const kmToShort = (km, unit) => (unit === 'kg' ? km * 1000 : km * YD_PER_KM);
export const shortToKm = (v, unit) => (unit === 'kg' ? v / 1000 : v / YD_PER_KM);
const KM_PER_MI = 1.609344;
export const longUnit = (unit) => (unit === 'kg' ? 'km' : 'mi');
export const kmToLong = (km, unit) => (unit === 'kg' ? km : km / KM_PER_MI);
export const longToKm = (v, unit) => (unit === 'kg' ? v : v * KM_PER_MI);
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

// Distance shown for a set of this mode, as { value, label }.
export function setDistance(mode, s, unit) {
  const km = num(s.distance);
  if (!(km > 0)) return null;
  return mode === 'carry' ? { value: Math.round(kmToShort(km, unit)), label: shortUnit(unit) } : { value: round(kmToLong(km, unit)), label: longUnit(unit) };
}

export function fmtSeconds(sec) {
  const s = Math.round(num(sec));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}:${String(r).padStart(2, '0')}` : `${m} min`;
}
export function fmtCardioTime(sec) {
  const m = num(sec) / 60;
  if (m < 1) return `${Math.round(num(sec))} s`;
  return m < 60 ? `${round(m, 1)} min` : `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`;
}

// Pace (or speed, for bikes and rowers) from minutes per km.
export function paceFromMinPerKm(name, minPerKm, unit) {
  if (!(minPerKm > 0)) return '';
  if (isSpeedy(name)) return `${round(kmToLong(60 / minPerKm, unit), 1)} ${unit === 'kg' ? 'km/h' : 'mph'}`;
  const total = Math.round((unit === 'kg' ? minPerKm : minPerKm * KM_PER_MI) * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} /${longUnit(unit)}`;
}

// "8:30 /mi" or "14.2 mph" for one cardio set, '' without both time and distance.
export function cardioPace(name, s, unit) {
  const km = num(s.distance);
  const min = num(s.time) / 60;
  return km > 0 && min > 0 ? paceFromMinPerKm(name, min / km, unit) : '';
}

export function describeSet(mode, s, unit, name = '') {
  const w = num(s.weight);
  switch (mode) {
    case 'bodyweight':
      return `${num(s.reps)} reps${w ? ` +${w} ${unit}` : ''}`;
    case 'time':
    case 'stretch':
      return fmtSeconds(s.time);
    case 'cardio': {
      const d = setDistance('cardio', s, unit);
      return [num(s.time) > 0 && fmtCardioTime(s.time), d && `${d.value} ${d.label}`, num(s.incline) > 0 && `${num(s.incline)}% incline`, cardioPace(name, s, unit)]
        .filter(Boolean)
        .join(' · ');
    }
    case 'carry': {
      const d = setDistance('carry', s, unit);
      return `${d.value} ${d.label}${w ? ` @ ${w} ${unit}` : ''}`;
    }
    default:
      return w ? `${w} × ${num(s.reps)}` : `${num(s.reps)} reps`;
  }
}
