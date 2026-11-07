import { useMemo, useState } from 'react';
import { allRecords } from '../analytics';
import { fmtNum, fmtVolume, key } from '../stats';

const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function Records({ sessions, unit }) {
  const [q, setQ] = useState('');
  const records = useMemo(() => allRecords(sessions), [sessions]);
  const shown = records.filter((r) => !q.trim() || key(r.name).includes(key(q)));

  if (!records.length) return <p className="muted empty">Finish a workout and your personal records will be listed here.</p>;

  return (
    <section className="card">
      <h2>Personal records</h2>
      <label className="field">
        <span>Find an exercise</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {!shown.length && <p className="muted empty">No exercises match.</p>}
      {shown.map((r) => (
        <div className="record" key={r.name}>
          <div className="goal-top">
            <strong>{r.name}</strong>
            <span className="muted">
              {r.count} workout{r.count === 1 ? '' : 's'}
            </span>
          </div>
          <dl className="rec-grid">
            {r.weight && (
              <div>
                <dt>Heaviest</dt>
                <dd>
                  {fmtNum(r.weight.value)} {unit} × {r.weight.reps}
                  <span className="muted"> · {shortDate(r.weight.date)}</span>
                </dd>
              </div>
            )}
            {r.e1rm && (
              <div>
                <dt>Est. 1RM</dt>
                <dd>
                  {fmtNum(Math.round(r.e1rm.value * 10) / 10)} {unit}
                  <span className="muted">
                    {' '}
                    · {fmtNum(r.e1rm.weight)} × {r.e1rm.reps}, {shortDate(r.e1rm.date)}
                  </span>
                </dd>
              </div>
            )}
            {r.volume && (
              <div>
                <dt>Best volume</dt>
                <dd>
                  {fmtVolume(r.volume.value)} {unit}
                  <span className="muted"> · {shortDate(r.volume.date)}</span>
                </dd>
              </div>
            )}
            {!r.weight && <p className="muted">No weight logged for this exercise.</p>}
          </dl>
        </div>
      ))}
    </section>
  );
}
