import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listWorkouts, deleteWorkout } from '../db';

export function summarizeSets(sets, unit) {
  const groups = [];
  for (const s of sets) {
    const last = groups[groups.length - 1];
    if (last && last.reps === s.reps && last.weight === s.weight) last.n++;
    else groups.push({ reps: s.reps, weight: s.weight, n: 1 });
  }
  return groups.map((g) => `${g.n} × ${g.reps}${g.weight ? ` @ ${g.weight} ${unit}` : ''}`).join(', ');
}

const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

export default function History({ unit, onEdit }) {
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const all = useLiveQuery(listWorkouts, [], null);

  const groups = useMemo(() => {
    if (!all) return [];
    const q = query.trim().toLowerCase();
    const filtered = all.filter(
      (w) => (!q || w.exercise.toLowerCase().includes(q)) && (!from || w.date >= from) && (!to || w.date <= to),
    );
    const byDate = new Map();
    for (const w of filtered) {
      if (!byDate.has(w.date)) byDate.set(w.date, []);
      byDate.get(w.date).push(w);
    }
    return [...byDate.entries()];
  }, [all, query, from, to]);

  if (!all) return <p className="muted">Loading…</p>;

  return (
    <div>
      <div className="card filters">
        <label className="field">
          <span>Exercise</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" />
        </label>
        <div className="row">
          <label className="field">
            <span>From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field">
            <span>To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        {(query || from || to) && (
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => {
              setQuery('');
              setFrom('');
              setTo('');
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {groups.length === 0 && (
        <p className="muted empty">{all.length ? 'No workouts match those filters.' : 'No workouts yet. Log your first one on the Log tab.'}</p>
      )}

      {groups.map(([date, items]) => (
        <section key={date} className="day">
          <h3>{fmtDate(date)}</h3>
          {items.map((w) => (
            <article key={w.id} className="card entry">
              <div className="entry-main">
                <strong>{w.exercise}</strong>
                <span className="sets-summary">{summarizeSets(w.sets, unit)}</span>
                {w.notes && <span className="notes">{w.notes}</span>}
              </div>
              <div className="entry-actions">
                <button type="button" className="btn btn-ghost btn-small" onClick={() => onEdit(w)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-small btn-danger"
                  onClick={() => {
                    if (window.confirm(`Delete ${w.exercise} on ${fmtDate(w.date)}?`)) deleteWorkout(w.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
