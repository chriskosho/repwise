// Non-gym activities (runs, rides, sports...). Entered by hand: no GPS involved.
// Distance is stored in km and shown in miles or km to match your weight unit setting
// (pounds = miles, kilograms = km).

// [key, label, measure] where measure is 'pace' (min per mile/km), 'speed' (mph / km/h),
// or '' when distance doesn't make sense.
export const ACTIVITY_TYPES = [
  ['run', 'Run', 'pace'],
  ['walk', 'Walk', 'pace'],
  ['hike', 'Hike', 'pace'],
  ['cycle', 'Cycling', 'speed'],
  ['swim', 'Swim', 'pace'],
  ['row', 'Rowing', 'speed'],
  ['elliptical', 'Elliptical', ''],
  ['basketball', 'Basketball', ''],
  ['soccer', 'Soccer', ''],
  ['tennis', 'Tennis', ''],
  ['pickleball', 'Pickleball', ''],
  ['volleyball', 'Volleyball', ''],
  ['golf', 'Golf', ''],
  ['climb', 'Climbing', ''],
  ['yoga', 'Yoga / stretching', ''],
  ['hiit', 'HIIT / class', ''],
  ['martial', 'Martial arts', ''],
  ['other', 'Other', ''],
];

const BY_KEY = new Map(ACTIVITY_TYPES.map(([k, label, measure]) => [k, { label, measure }]));
export const isActivityType = (k) => BY_KEY.has(k);
export const typeLabel = (k) => BY_KEY.get(k)?.label ?? 'Other';
export const typeMeasure = (k) => BY_KEY.get(k)?.measure ?? '';
// Distance is offered for every type (a golf round or a pickup game can have one), but
// pace/speed is only worked out for the types where it means something.
export const canMeasureDistance = () => true;

// ---- units ----
const KM_PER_MI = 1.609344;
export const kmToMi = (km) => km / KM_PER_MI;
export const miToKm = (mi) => mi * KM_PER_MI;
export const distUnit = (unit) => (unit === 'kg' ? 'km' : 'mi');
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
export const distanceOut = (km, unit) => (km == null ? null : round(unit === 'kg' ? km : kmToMi(km)));
export const distanceIn = (v, unit) => (unit === 'kg' ? Number(v) : miToKm(Number(v)));

// ---- formatting ----
export function fmtMinutes(min) {
  const m = Math.round(Number(min) || 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

// "8:30 /mi" for runs, "14.2 mph" for rides; '' when there is no distance.
export function paceText(a, unit) {
  const d = distanceOut(a.distance_km, unit);
  if (!(d > 0) || !(a.duration_min > 0)) return '';
  const u = distUnit(unit);
  if (typeMeasure(a.type) === 'speed') return `${round((d / a.duration_min) * 60, 1)} ${u === 'mi' ? 'mph' : 'km/h'}`;
  if (typeMeasure(a.type) === 'pace') {
    const total = Math.round((a.duration_min / d) * 60); // seconds per unit distance
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} /${u}`;
  }
  return '';
}

export function activityTitle(a) {
  return a.title?.trim() || typeLabel(a.type);
}

// One line for a list: "45 min · 5.2 mi · 8:41 /mi".
export function activitySummary(a, unit) {
  const parts = [fmtMinutes(a.duration_min)];
  const d = distanceOut(a.distance_km, unit);
  if (d > 0) parts.push(`${d} ${distUnit(unit)}`);
  const p = paceText(a, unit);
  if (p) parts.push(p);
  if (a.effort) parts.push(`effort ${a.effort}/10`);
  return parts.join(' · ');
}

// Lets activities count as workouts for streaks, the calendar and weekly goals. They have
// no sets, so records and muscle volume skip them automatically.
export function activityAsSession(a) {
  return {
    id: a.id,
    date: a.date,
    name: activityTitle(a),
    started_at: `${a.date}T12:00:00.000Z`,
    ended_at: `${a.date}T12:00:00.000Z`,
    deleted_at: a.deleted_at ?? null,
    exercises: [{ id: a.id, name: typeLabel(a.type), link: false, notes: '', sets: [] }],
    isActivity: true,
    activity: a,
  };
}

// ---- summaries for the Activity view ----
export const live = (list) => list.filter((a) => !a.deleted_at);

export function totals(list) {
  const items = live(list);
  const km = items.reduce((s, a) => s + (a.distance_km || 0), 0);
  return { count: items.length, minutes: items.reduce((s, a) => s + (a.duration_min || 0), 0), km };
}

// Per type: count, minutes, km, longest distance, longest time.
export function byType(list) {
  const m = new Map();
  for (const a of live(list)) {
    const cur = m.get(a.type) ?? { type: a.type, count: 0, minutes: 0, km: 0, longestKm: 0, longestMin: 0 };
    cur.count++;
    cur.minutes += a.duration_min || 0;
    cur.km += a.distance_km || 0;
    cur.longestKm = Math.max(cur.longestKm, a.distance_km || 0);
    cur.longestMin = Math.max(cur.longestMin, a.duration_min || 0);
    m.set(a.type, cur);
  }
  return [...m.values()].sort((a, b) => b.minutes - a.minutes);
}

// Fastest pace (lowest min/km) or best speed per type, for types where it means something.
export function bestEfforts(list) {
  const out = new Map();
  for (const a of live(list)) {
    const measure = typeMeasure(a.type);
    if (!measure || !(a.distance_km > 0) || !(a.duration_min > 0)) continue;
    const minPerKm = a.duration_min / a.distance_km;
    const cur = out.get(a.type);
    if (!cur || minPerKm < cur.minPerKm) out.set(a.type, { type: a.type, minPerKm, activity: a });
  }
  return [...out.values()];
}

// Minutes per week for the last `weeks` weeks (oldest first), for the chart.
export function weeklyMinutes(list, weekStartOf, weekStart, weeks, todayStr) {
  const starts = [];
  let cur = weekStartOf(todayStr, weekStart);
  for (let i = 0; i < weeks; i++) {
    starts.unshift(cur);
    const d = new Date(`${cur}T00:00:00`);
    d.setDate(d.getDate() - 7);
    cur = d.toLocaleDateString('en-CA');
  }
  const sums = new Map(starts.map((s) => [s, 0]));
  for (const a of live(list)) {
    const w = weekStartOf(a.date, weekStart);
    if (sums.has(w)) sums.set(w, sums.get(w) + (a.duration_min || 0));
  }
  return starts.map((s) => ({ week: s, minutes: Math.round(sums.get(s)) }));
}
