// Plate math for a barbell: which plates go on each side.
export const PLATE_DEFAULTS = {
  lb: { bar: 45, plates: '45, 35, 25, 10, 5, 2.5' },
  kg: { bar: 20, plates: '25, 20, 15, 10, 5, 2.5, 1.25' },
};

export function parsePlates(text) {
  const nums = String(text ?? '')
    .split(/[\s,;]+/)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0 && n < 500);
  return [...new Set(nums)].sort((a, b) => b - a);
}

export function plateSetup(prefs, unit) {
  const d = PLATE_DEFAULTS[unit] ?? PLATE_DEFAULTS.lb;
  const bar = Number(prefs?.[`bar_${unit}`]);
  const plates = parsePlates(prefs?.[`plates_${unit}`] ?? d.plates);
  return { bar: bar > 0 ? bar : d.bar, plates: plates.length ? plates : parsePlates(d.plates) };
}

// Returns { perSide: [45, 25], left } or null when the weight is at or under the bar.
// `left` is the weight (both sides together) that can't be made with your plates.
export function platesPerSide(total, { bar, plates }) {
  const w = Number(total);
  if (!(w > bar)) return null;
  let rest = Math.round(((w - bar) / 2) * 1000) / 1000;
  const perSide = [];
  for (const p of plates) {
    while (rest + 1e-9 >= p) {
      perSide.push(p);
      rest = Math.round((rest - p) * 1000) / 1000;
    }
  }
  return { perSide, left: Math.round(rest * 2 * 100) / 100 };
}

export function plateText(total, setup, unit) {
  const r = platesPerSide(total, setup);
  if (!r) return '';
  const text = r.perSide.length ? `Each side: ${r.perSide.join(' + ')}` : 'Just the bar';
  return r.left > 0 ? `${text} (${r.left} ${unit} short with your plates)` : text;
}
