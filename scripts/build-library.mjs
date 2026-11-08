// Builds src/data/library.json from the free-exercise-db dataset
// (https://github.com/yuhonas/free-exercise-db, The Unlicense / public domain).
//
//   node scripts/build-library.mjs path/to/free-exercise-db/dist/exercises.json
//
// Two files come out: library.json with compact [name, muscle, equipment, category, id, level, mechanic]
// rows, and howto.json with the written steps keyed by id. Pictures are not bundled; the app
// loads them from the dataset's public GitHub folder when you're online.
import { readFileSync, writeFileSync } from 'node:fs';

const src = process.argv[2];
if (!src) {
  console.error('Usage: node scripts/build-library.mjs <exercises.json>');
  process.exit(1);
}

const EQUIPMENT = {
  barbell: 'barbell',
  dumbbell: 'dumbbell',
  'body only': 'bodyweight',
  cable: 'cable',
  machine: 'machine',
  kettlebells: 'kettlebell',
  bands: 'bands',
  'medicine ball': 'medicine-ball',
  'exercise ball': 'exercise-ball',
  'foam roll': 'foam-roll',
  'e-z curl bar': 'ez-bar',
};

const raw = JSON.parse(readFileSync(src, 'utf8'));
const seen = new Set();
const rows = [];
const howto = {};
for (const x of raw) {
  const name = String(x.name ?? '').trim().replace(/\s+/g, ' ');
  const muscle = x.primaryMuscles?.[0];
  if (!name || !muscle || seen.has(name.toLowerCase())) continue;
  seen.add(name.toLowerCase());
  rows.push([name, muscle, EQUIPMENT[x.equipment] ?? 'other', x.category ?? 'strength', x.id ?? '', x.level ?? '', x.mechanic === 'compound' ? 'c' : x.mechanic === 'isolation' ? 'i' : '']);
  if (x.id && Array.isArray(x.instructions) && x.instructions.length) howto[x.id] = x.instructions.map((t) => String(t).trim());
}
rows.sort((a, b) => a[0].localeCompare(b[0]));

writeFileSync(new URL('../src/data/library.json', import.meta.url), JSON.stringify(rows));
writeFileSync(new URL('../src/data/howto.json', import.meta.url), JSON.stringify(howto));
console.log(`Wrote ${rows.length} exercises`);
