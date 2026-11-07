// Gym calculators: which plates to load, and a warm-up ramp toward a working weight.

export const DEFAULTS = {
  lb: { bar: 45, plates: [45, 35, 25, 10, 5, 2.5], step: 5 },
  kg: { bar: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25], step: 2.5 },
};

const r2 = (n) => Math.round(n * 100) / 100;

// Plates for ONE side of the bar, largest first (greedy). `achieved` is the weight you
// can really load with those plates; `short` is how far that falls from the target.
export function platesFor(target, bar, plates) {
  const t = Number(target);
  const b = Number(bar);
  if (!(t > 0) || !(b >= 0)) return { error: 'Enter a target weight.' };
  if (t < b) return { error: 'That is lighter than the bar.' };
  const sizes = [...new Set(plates.map(Number))].filter((p) => p > 0).sort((x, y) => y - x);
  if (!sizes.length) return { error: 'Choose at least one plate size.' };
  let left = r2((t - b) / 2);
  const perSide = [];
  for (const p of sizes) {
    const n = Math.floor(left / p + 1e-9);
    if (n > 0) {
      perSide.push({ plate: p, count: n });
      left = r2(left - n * p);
    }
  }
  const loaded = perSide.reduce((a, x) => a + x.plate * x.count, 0);
  const achieved = r2(b + 2 * loaded);
  return { perSide, achieved, short: r2(t - achieved) };
}

export const roundTo = (w, step) => Math.round(w / step) * step;

// Warm-up sets before a working weight: the empty bar, then a rising share of the working
// weight with fewer reps each time. Weights are rounded to `step` and dropped if they
// duplicate another set or are not below the working weight.
export function warmupSets(working, bar, step) {
  const w = Number(working);
  if (!(w > 0)) return [];
  const scheme = [
    [0.4, 5],
    [0.6, 3],
    [0.8, 2],
  ];
  const out = [];
  const seen = new Set();
  const push = (weight, reps) => {
    if (weight >= w || seen.has(weight)) return;
    seen.add(weight);
    out.push({ weight, reps });
  };
  if (bar > 0 && w > bar * 1.5) push(bar, 10);
  for (const [pct, reps] of scheme) {
    const x = Math.max(roundTo(w * pct, step), bar > 0 ? bar : 0);
    if (bar > 0 && x <= bar) continue; // the empty bar is already covered
    push(x, reps);
  }
  return out;
}
