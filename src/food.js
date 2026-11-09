import { COMMON_FOODS } from './foodData';

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9% ]+/g, ' ').replace(/\s+/g, ' ').trim();
export const foodKey = norm;
const words = (s) => norm(s).split(' ').filter(Boolean);

export const MACROS = ['calories', 'protein', 'carbs', 'fat'];
const num = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Number(v));
export const cleanNum = num;
export const round = (n, d = 0) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);

// "chicken salad 450" or "chicken salad 450 cal" -> a one-off entry with those calories.
export function parseQuick(text) {
  const m = String(text ?? '').trim().match(/^(.*?[^\d\s].*?)\s+(\d{2,4})\s*(?:cal|kcal|calories)?$/i);
  if (!m) return null;
  const name = m[1].trim();
  const calories = Number(m[2]);
  return name && calories > 0 && calories <= 10000 ? { name, calories } : null;
}

// Foods that match what you have typed so far. Every typed word must start a word in the
// name, so "ban" finds Banana and "chick br" finds Chicken breast. Your own foods and the
// ones you log most come first.
export function searchFoods(query, { mine = [], usage = {}, limit = 8 } = {}) {
  const q = words(query);
  if (!q.length) return [];
  const seen = new Set();
  const out = [];
  for (const f of [...mine, ...COMMON_FOODS]) {
    const key = norm(f.name);
    if (seen.has(key)) continue;
    const w = words(f.name);
    const hit = q.every((t) => w.some((x) => x.startsWith(t)));
    if (!hit) continue;
    seen.add(key);
    const exact = key === q.join(' ');
    const starts = key.startsWith(q.join(' '));
    const firstWord = w[0]?.startsWith(q[0]);
    let score = (exact ? 100 : 0) + (starts ? 40 : 0) + (firstWord ? 15 : 0) - Math.min(w.length, 8) * 0.1;
    if (!f.common) score += 25;
    score += Math.min(usage[f.id] ?? usage[key] ?? 0, 20);
    out.push({ f, score });
  }
  return out.sort((a, b) => b.score - a.score || a.f.name.localeCompare(b.f.name)).slice(0, limit).map((x) => x.f);
}

// How often and how recently each food was logged, so suggestions favor what you eat.
export function usageFrom(log, todayStr) {
  const usage = {};
  const last = {};
  const cutoff = new Date(`${todayStr}T12:00:00`);
  cutoff.setDate(cutoff.getDate() - 60);
  const cut = cutoff.toISOString().slice(0, 10);
  for (const e of log) {
    if (e.deleted_at || e.date < cut) continue;
    const key = e.food_id || norm(e.name);
    usage[key] = (usage[key] ?? 0) + 1;
    usage[norm(e.name)] = (usage[norm(e.name)] ?? 0) + 1;
    if (!last[key] || `${e.date}${e.time}` > `${last[key].date}${last[key].time}`) last[key] = e;
  }
  return { usage, last };
}

// Foods you log often, newest and most frequent first, for one-tap re-adding.
export function frequentFoods(log, todayStr, limit = 8) {
  const { usage, last } = usageFrom(log, todayStr);
  return Object.keys(last)
    .map((k) => ({ e: last[k], n: usage[k], at: `${last[k].date}${last[k].time}` }))
    .sort((a, b) => b.n - a.n || b.at.localeCompare(a.at))
    .slice(0, limit)
    .map((x) => x.e);
}

const part = (e, k) => (e[k] == null ? 0 : Number(e[k]) * Number(e.servings ?? 1));
export const entryTotals = (e) => ({ calories: part(e, 'calories'), protein: part(e, 'protein'), carbs: part(e, 'carbs'), fat: part(e, 'fat') });

export function dayTotals(entries) {
  const t = { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0, unknown: 0 };
  for (const e of entries) {
    if (e.deleted_at) continue;
    const x = entryTotals(e);
    for (const k of MACROS) t[k] += x[k];
    t.count++;
    if (e.calories == null) t.unknown++;
  }
  return t;
}

export const byTime = (a, b) => `${a.time || '99:99'}|${a.created_at}`.localeCompare(`${b.time || '99:99'}|${b.created_at}`);

// Average calories per day over days that have entries, within the last `days` days.
export function averageCalories(log, todayStr, days = 7) {
  const end = new Date(`${todayStr}T12:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  const from = start.toISOString().slice(0, 10);
  const byDay = {};
  for (const e of log) {
    if (e.deleted_at || e.date < from || e.date > todayStr || e.calories == null) continue;
    byDay[e.date] = (byDay[e.date] ?? 0) + entryTotals(e).calories;
  }
  const vals = Object.values(byDay);
  return vals.length >= 3 ? { avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), days: vals.length } : null;
}

export const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
export const fmtTime = (t) => {
  if (!/^\d{2}:\d{2}$/.test(t ?? '')) return '';
  const [h, m] = t.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};
export const fmtServings = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '1';
  const w = Math.floor(v);
  const frac = Math.round((v - w) * 100) / 100;
  const names = { 0.25: '¼', 0.33: '⅓', 0.5: '½', 0.67: '⅔', 0.75: '¾' };
  if (frac === 0) return String(w);
  return names[frac] ? `${w || ''}${names[frac]}` : String(round(v, 2));
};

// Journal for new people; anyone who already logs foods keeps full tracking until they choose.
export const foodMode = (profile, log = []) => profile?.food_mode ?? (log.some((e) => !e.deleted_at) ? 'track' : 'journal');

export const FEELINGS = [
  ['great', 'Great'],
  ['okay', 'Okay'],
  ['rough', 'Not great'],
];

// "8:15 AM" for the current time, in the person's own format.
export const clockNow = () => new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
