import { weightOut } from './units';

export const MEASUREMENTS = [
  ['neck', 'Neck'],
  ['shoulders', 'Shoulders'],
  ['chest', 'Chest'],
  ['waist', 'Waist'],
  ['hips', 'Hips'],
  ['arm_l', 'Left arm'],
  ['arm_r', 'Right arm'],
  ['forearm', 'Forearm'],
  ['thigh', 'Thigh'],
  ['calf', 'Calf'],
];
export const MEASUREMENT_KEYS = new Set(MEASUREMENTS.map(([k]) => k));
export const measurementLabel = (k) => MEASUREMENTS.find(([x]) => x === k)?.[1] ?? k;

const DAY = 24 * 60 * 60 * 1000;
const dayNum = (date) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY);

// Entries with a weight, oldest first.
export const weighIns = (entries) =>
  entries.filter((e) => e.weight_kg != null).sort((a, b) => a.date.localeCompare(b.date));

// 7-day trailing average of weight (kg) for each weigh-in. Smooths out daily water swings.
export function weightTrend(entries, windowDays = 7) {
  const w = weighIns(entries);
  return w.map((e, i) => {
    const from = dayNum(e.date) - (windowDays - 1);
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0 && dayNum(w[j].date) >= from; j--) {
      sum += w[j].weight_kg;
      n++;
    }
    return { date: e.date, weight_kg: e.weight_kg, trend_kg: sum / n };
  });
}

// Change in trend weight (kg) over the last `days` days, or null with too little data.
export function changeOver(entries, days, now = new Date()) {
  const t = weightTrend(entries);
  if (t.length < 2) return null;
  const last = t[t.length - 1];
  const cutoff = dayNum(now.toLocaleDateString('en-CA')) - days;
  const base = t.find((p) => dayNum(p.date) >= cutoff && p !== last);
  if (!base) return null;
  return last.trend_kg - base.trend_kg;
}

export const latestWeightKg = (entries) => {
  const w = weighIns(entries);
  return w.length ? w[w.length - 1].weight_kg : null;
};

export const bmi = (kg, heightCm) => (kg && heightCm ? kg / (heightCm / 100) ** 2 : null);

export const fmtWeight = (kg, unit) => (kg == null ? '–' : `${weightOut(kg, unit)} ${unit}`);
