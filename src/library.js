import { useEffect, useState } from 'react';
import { key } from './stats';

// The exercise library: 876 exercises from free-exercise-db (public domain),
// loaded on demand so it isn't part of the first download.

export const MUSCLES = [
  ['chest', 'Chest'],
  ['lats', 'Lats'],
  ['middle back', 'Middle back'],
  ['lower back', 'Lower back'],
  ['traps', 'Traps'],
  ['shoulders', 'Shoulders'],
  ['biceps', 'Biceps'],
  ['triceps', 'Triceps'],
  ['forearms', 'Forearms'],
  ['abdominals', 'Abs'],
  ['quadriceps', 'Quads'],
  ['hamstrings', 'Hamstrings'],
  ['glutes', 'Glutes'],
  ['calves', 'Calves'],
  ['adductors', 'Adductors'],
  ['abductors', 'Abductors'],
  ['neck', 'Neck'],
];

export const EQUIPMENT = [
  ['barbell', 'Barbell'],
  ['dumbbell', 'Dumbbell'],
  ['bodyweight', 'Bodyweight'],
  ['cable', 'Cable'],
  ['machine', 'Machine'],
  ['kettlebell', 'Kettlebell'],
  ['bands', 'Bands'],
  ['ez-bar', 'EZ bar'],
  ['medicine-ball', 'Medicine ball'],
  ['exercise-ball', 'Exercise ball'],
  ['foam-roll', 'Foam roll'],
  ['other', 'Other'],
];

const MUSCLE_LABEL = new Map(MUSCLES);
const EQUIPMENT_LABEL = new Map(EQUIPMENT);
export const muscleLabel = (m) => MUSCLE_LABEL.get(m) ?? '';
export const equipmentLabel = (e) => EQUIPMENT_LABEL.get(e) ?? '';

let cache = null;
export function loadLibrary() {
  if (!cache) {
    cache = import('./data/library.json')
      .then((m) => m.default.map(([name, muscle, equipment, category, id, level, mech]) => ({ name, muscle, equipment, category, id, level, compound: mech === 'c' })))
      .catch((e) => {
        cache = null; // allow a retry, for example after coming back online
        throw e;
      });
  }
  return cache;
}

// { list, failed }. `list` is null until the library has loaded.
export function useLibrary() {
  const [state, setState] = useState({ list: null, failed: false });
  useEffect(() => {
    let on = true;
    loadLibrary().then(
      (list) => on && setState({ list, failed: false }),
      () => on && setState({ list: null, failed: true }),
    );
    return () => {
      on = false;
    };
  }, []);
  return state;
}

// Exercise names from your workouts, most recently used first.
export function historyNames(sessions) {
  const seen = new Set();
  const names = [];
  for (const s of sessions) {
    for (const e of s.exercises) {
      const k = key(e.name);
      if (k && !seen.has(k)) {
        seen.add(k);
        names.push(e.name);
      }
    }
  }
  return names;
}

// ---- exercise help: steps, pictures and video searches ----
export const CATEGORIES = [
  ['', 'All types'],
  ['strength', 'Strength'],
  ['stretching', 'Stretching'],
  ['cardio', 'Cardio'],
  ['plyometrics', 'Plyometrics'],
];
// Powerlifting, Olympic lifts and strongman count as strength in the filter.
export const categoryGroup = (c) => (['powerlifting', 'olympic weightlifting', 'strongman'].includes(c) ? 'strength' : c || '');

const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
export const imageUrls = (id) => (id ? [`${IMAGE_BASE}${id}/0.jpg`, `${IMAGE_BASE}${id}/1.jpg`] : []);

// A YouTube search built from the exercise's name. "#shorts" steers results toward Shorts
// (YouTube has no URL switch for them); the second form finds longer how-to videos.
export function youtubeUrl(name, { shorts = true, stretch = false } = {}) {
  const q = `${name} ${stretch ? 'stretch' : 'exercise form'}${shorts ? ' #shorts' : ' tutorial'}`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

let howtoCache = null;
export function loadHowTo() {
  if (!howtoCache) {
    howtoCache = import('./data/howto.json').then((m) => m.default).catch((e) => {
      howtoCache = null;
      throw e;
    });
  }
  return howtoCache;
}

// Library entry for a name (null for your own exercises).
export function findExercise(library, name) {
  const k = key(name);
  return (library ?? []).find((l) => key(l.name) === k) ?? null;
}

const CATEGORY_RANK = { stretching: 2, cardio: 2 };

// Combine your own exercises, exercises you've logged, and the library into one
// searchable, filterable list. Yours come first. A logged exercise that matches
// a library or custom name borrows its muscle and equipment so filters work.
export function searchExercises({ library = [], custom = [], history = [], query = '', muscle = '', equipment = '', category = '' }) {
  const meta = new Map();
  for (const l of library) meta.set(key(l.name), { muscle: l.muscle, equipment: l.equipment, category: l.category });
  for (const c of custom) meta.set(key(c.name), { muscle: c.muscle, equipment: c.equipment, category: '' });

  const seen = new Set();
  const all = [];
  const add = (name, mine) => {
    const k = key(name);
    if (!k || seen.has(k)) return;
    seen.add(k);
    const m = meta.get(k) ?? {};
    all.push({ name, key: k, mine, muscle: m.muscle ?? '', equipment: m.equipment ?? '', category: m.category ?? '' });
  };
  custom.forEach((c) => add(c.name, true));
  history.forEach((n) => add(n, true));
  library.forEach((l) => add(l.name, false));

  const terms = key(query).split(' ').filter(Boolean);
  const q = terms.join(' ');
  const tier = (e) => {
    if (!terms.length) return 0;
    if (e.key === q) return 0;
    if (e.key.startsWith(q)) return 1;
    const words = e.key.split(/[\s/\-(),]+/);
    if (terms.every((t) => words.some((w) => w.startsWith(t)))) return 2;
    if (terms.every((t) => e.key.includes(t))) return 3;
    return 4;
  };

  const rows = [];
  for (const e of all) {
    if (muscle && e.muscle !== muscle) continue;
    if (equipment && e.equipment !== equipment) continue;
    if (category && categoryGroup(e.category) !== category) continue;
    let t = 0;
    if (terms.length) {
      const hay = `${e.key} ${key(equipmentLabel(e.equipment))} ${key(muscleLabel(e.muscle))}`;
      if (!terms.every((x) => hay.includes(x))) continue;
      t = tier(e);
    }
    rows.push({ e, t, order: rows.length });
  }

  rows.sort(
    (a, b) =>
      a.t - b.t ||
      Number(b.e.mine) - Number(a.e.mine) ||
      // yours keep their recency order; the library goes strength-first, then A to Z
      (a.e.mine && b.e.mine
        ? a.order - b.order
        : (CATEGORY_RANK[a.e.category] ?? 0) - (CATEGORY_RANK[b.e.category] ?? 0) || a.e.name.localeCompare(b.e.name)),
  );
  return rows.map((r) => r.e);
}
