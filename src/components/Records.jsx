import { useMemo, useState } from 'react';
import { allRecords } from '../analytics';
import { fmtShortDate, fmtVolume, key, plural } from '../stats';

const whole = (n) => Math.round(n).toLocaleString();

function Tile({ label, value, sub }) {
  return (
    <div className="tile">
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
      <span className="tile-sub">{sub}</span>
    </div>
  );
}

export default function Records({ sessions, unit }) {
  const [q, setQ] = useState('');
  const records = useMemo(() => allRecords(sessions), [sessions]);
  const shown = records.filter((r) => !q.trim() || key(r.name).includes(key(q)));

  if (!records.length) return <p className="muted empty">Finish a workout and your personal records will be listed here.</p>;

  return (
    <section className="card">
      <h2>Personal records</h2>
      <label className="field">
        <span className="sr-only">Find an exercise</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an exercise" aria-label="Find an exercise" />
      </label>
      {!shown.length && <p className="muted empty">No exercises match.</p>}
      {shown.map((r) => (
        <div className="record" key={r.name}>
          <div className="record-head">
            <strong>{r.name}</strong>
            <span className="muted">{plural(r.count, 'workout')}</span>
          </div>
          {r.weight ? (
            <div className="tiles">
              <Tile label="Heaviest" value={`${whole(r.weight.value)} ${unit}`} sub={`× ${r.weight.reps} · ${fmtShortDate(r.weight.date)}`} />
              <Tile
                label="Est. 1RM"
                value={`${whole(r.e1rm.value)} ${unit}`}
                sub={`from ${whole(r.e1rm.weight)} × ${r.e1rm.reps}`}
              />
              <Tile label="Best volume" value={`${fmtVolume(r.volume.value)} ${unit}`} sub={fmtShortDate(r.volume.date)} />
            </div>
          ) : (
            <p className="muted">No weight logged for this exercise.</p>
          )}
        </div>
      ))}
    </section>
  );
}
