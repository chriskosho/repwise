import { useState } from 'react';
import { DEFAULTS, platesFor, warmupSets } from '../calc';

// Draws the loaded bar: plates sized by weight, mirrored on both sides.
function BarDiagram({ perSide, plates }) {
  const list = perSide.flatMap((x) => Array(x.count).fill(x.plate));
  const biggest = Math.max(...plates);
  const W = 340;
  const H = 120;
  const mid = W / 2;
  const plateW = list.length > 8 ? 9 : 12;
  const gap = 2;
  const sleeveStart = 62; // distance from the centre to the collar
  const h = (p) => 34 + 76 * Math.sqrt(p / biggest); // bigger plates are taller
  const shade = (p) => 0.35 + 0.65 * (p / biggest);
  const side = (dir) =>
    list.map((p, i) => {
      const x = mid + dir * (sleeveStart + i * (plateW + gap)) - (dir < 0 ? plateW : 0);
      const ph = h(p);
      return <rect key={`${dir}-${i}`} x={x} y={(H - ph) / 2} width={plateW} height={ph} rx="2.5" fill="var(--accent)" fillOpacity={shade(p)} />;
    });
  return (
    <svg className="bar-diagram" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Plates on the bar">
      <rect x="6" y={H / 2 - 3} width={W - 12} height="6" rx="3" fill="var(--muted)" />
      <rect x={mid - sleeveStart - 4} y={H / 2 - 9} width="5" height="18" rx="1.5" fill="var(--muted)" />
      <rect x={mid + sleeveStart - 1} y={H / 2 - 9} width="5" height="18" rx="1.5" fill="var(--muted)" />
      {side(-1)}
      {side(1)}
    </svg>
  );
}

function Plates({ unit }) {
  const d = DEFAULTS[unit];
  const [target, setTarget] = useState('');
  const [bar, setBar] = useState(String(d.bar));
  const [have, setHave] = useState(() => new Set(d.plates));
  const result = target === '' ? null : platesFor(target, bar, [...have]);
  const toggle = (p) =>
    setHave((s) => {
      const n = new Set(s);
      if (n.has(p)) n.delete(p);
      else n.add(p);
      return n;
    });

  return (
    <section className="card">
      <h2>Plate calculator</h2>
      <div className="row">
        <label className="field">
          <span>Target weight ({unit})</span>
          <input type="number" inputMode="decimal" step="any" min="0" value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>
        <label className="field">
          <span>Bar ({unit})</span>
          <input type="number" inputMode="decimal" step="any" min="0" value={bar} onChange={(e) => setBar(e.target.value)} />
        </label>
      </div>
      <fieldset className="plates-have">
        <legend className="field-label">Plates you have</legend>
        {d.plates.map((p) => (
          <label className="toggle-chip" key={p}>
            <input type="checkbox" checked={have.has(p)} onChange={() => toggle(p)} />
            <span>{p}</span>
          </label>
        ))}
      </fieldset>
      {result?.error && <p className="error">{result.error}</p>}
      {result && !result.error && (
        <div aria-live="polite">
          <BarDiagram perSide={result.perSide} plates={d.plates} />
          <p className="plate-answer">
            <span className="stat-label">Each side</span>
            <strong>{result.perSide.length ? result.perSide.map((x) => `${x.count} × ${x.plate}`).join(' + ') : 'Just the bar'}</strong>
          </p>
          <p className="muted">
            Total on the bar: {result.achieved} {unit}
          </p>
          {result.short > 0 && (
            <p className="error">
              Closest you can load with these plates is {result.achieved} {unit}, {result.short} {unit} short.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Warmup({ unit }) {
  const d = DEFAULTS[unit];
  const [working, setWorking] = useState('');
  const sets = warmupSets(working, d.bar, d.step);
  return (
    <section className="card">
      <h2>Warm-up calculator</h2>
      <label className="field">
        <span>Working weight ({unit})</span>
        <input type="number" inputMode="decimal" step="any" min="0" value={working} onChange={(e) => setWorking(e.target.value)} />
      </label>
      {working !== '' && !sets.length && <p className="muted">That is light enough to start with no warm-up sets.</p>}
      {sets.length > 0 && (
        <ol className="warmups">
          {sets.map((s, i) => (
            <li key={s.weight}>
              <span className="warm-n">{i + 1}</span>
              <strong>
                {s.weight} {unit} × {s.reps}
              </strong>
              <span className="muted">{i === 0 && s.weight === d.bar ? 'empty bar' : `${Math.round((s.weight / Number(working)) * 100)}%`}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="muted">
        A simple ramp: the empty bar, then about 40%, 60% and 80% of your working weight, rounded to {d.step} {unit}. Adjust to how you feel.
      </p>
    </section>
  );
}

// Keyed by unit so the defaults (bar, plates) reset when you change units.
export default function Tools({ unit }) {
  return (
    <div key={unit}>
      <Plates unit={unit} />
      <Warmup unit={unit} />
    </div>
  );
}
