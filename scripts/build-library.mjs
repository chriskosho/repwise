// Builds src/data/library.json from the free-exercise-db dataset
// (https://github.com/yuhonas/free-exercise-db, The Unlicense / public domain).
//
//   node scripts/build-library.mjs path/to/free-exercise-db/dist/exercises.json
//
// Only names, primary muscle, equipment and category are kept (no images or
// instructions), as compact [name, muscle, equipment, category] rows.
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
for (const x of raw) {
  const name = String(x.name ?? '').trim().replace(/\s+/g, ' ');
  const muscle = x.primaryMuscles?.[0];
  if (!name || !muscle || seen.has(name.toLowerCase())) continue;
  seen.add(name.toLowerCase());
  rows.push([name, muscle, EQUIPMENT[x.equipment] ?? 'other', x.category ?? 'strength']);
}
rows.sort((a, b) => a[0].localeCompare(b[0]));

writeFileSync(new URL('../src/data/library.json', import.meta.url), JSON.stringify(rows));
console.log(`Wrote ${rows.length} exercises`);
