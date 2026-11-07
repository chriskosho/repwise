import { useState } from 'react';
import { DEFAULTS, platesFor, warmupSets } from '../calc';

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
        <legend className="muted">Plates you have</legend>
        {d.plates.map((p) => (
          <label className="check-row" key={p}>
            <input type="checkbox" checked={have.has(p)} onChange={() => toggle(p)} />
            <span>{p}</span>
          </label>
        ))}
      </fieldset>
      {result?.error && <p className="error">{result.error}</p>}
      {result && !result.error && (
        <div aria-live="polite">
          <p>
            <strong>Each side:</strong>{' '}
            {result.perSide.length ? result.perSide.map((x) => `${x.count} × ${x.plate}`).join(', ') : 'no plates, just the bar'}
          </p>
          <p className="muted">Total on the bar: {result.achieved} {unit}</p>
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
          {sets.map((s) => (
            <li key={s.weight}>
              {s.weight} {unit} × {s.reps}
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
