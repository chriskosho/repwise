import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listSessions } from '../db';
import { fmtDate, key } from '../stats';
import SessionCard from './SessionCard';

export default function History({ unit, onOpen }) {
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const all = useLiveQuery(listSessions, [], undefined);

  // The newest unfinished workout is the one the Workout tab resumes.
  const activeId = all?.find((s) => !s.ended_at)?.id;

  const groups = useMemo(() => {
    if (!all) return [];
    const q = key(query);
    const filtered = all.filter(
      (s) =>
        (!q || s.exercises.some((e) => key(e.name).includes(q)) || key(s.name).includes(q)) &&
        (!from || s.date >= from) &&
        (!to || s.date <= to),
    );
    const byDate = new Map();
    for (const s of filtered) {
      if (!byDate.has(s.date)) byDate.set(s.date, []);
      byDate.get(s.date).push(s);
    }
    return [...byDate.entries()];
  }, [all, query, from, to]);

  if (!all) return <p className="muted">Loading…</p>;

  return (
    <div>
      <div className="card filters">
        <label className="field">
          <span>Search</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Exercise or workout name" />
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
        <p className="muted empty">
          {all.length ? 'No workouts match those filters.' : 'No workouts yet. Start one on the Workout tab.'}
        </p>
      )}

      {groups.map(([date, items]) => (
        <section key={date} className="day">
          <h3>{fmtDate(date)}</h3>
          {items.map((s) => (
            <SessionCard key={s.id} session={s} unit={unit} onOpen={(x) => onOpen(x, x.id === activeId)} />
          ))}
        </section>
      ))}
    </div>
  );
}
