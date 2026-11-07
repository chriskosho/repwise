import { useMemo, useState } from 'react';
import { fmtDayDate, key } from '../stats';
import { activityTitle, typeLabel } from '../activities';
import { useWorkouts } from '../workouts';
import SessionCard from './SessionCard';
import ActivityCard from './ActivityCard';

const PAGE = 15; // days shown before "Show more"

export default function History({ unit, onOpen, onOpenActivity }) {
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showDates, setShowDates] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const { sessions, activities, places, ready } = useWorkouts();
  const placeName = (id) => places?.find((p) => p.id === id)?.name ?? '';
  const all = ready ? [...sessions, ...activities.map((a) => ({ isActivity: true, activity: a, id: a.id, date: a.date, created_at: a.created_at }))] : undefined;

  // The newest unfinished workout is the one the Workout tab resumes.
  const activeId = sessions?.find((s) => !s.ended_at)?.id;

  const groups = useMemo(() => {
    if (!all) return [];
    const q = key(query);
    const matches = (s) =>
      s.isActivity
        ? [activityTitle(s.activity), typeLabel(s.activity.type), s.activity.notes, placeName(s.activity.place_id)].some((t) => key(t ?? '').includes(q))
        : s.exercises.some((e) => key(e.name).includes(q)) || [s.name, s.notes, placeName(s.place_id)].some((t) => key(t ?? '').includes(q));
    const filtered = all.filter(
      (s) =>
        (!q || matches(s)) &&
        (!from || s.date >= from) &&
        (!to || s.date <= to),
    );
    const byDate = new Map();
    for (const s of filtered) {
      if (!byDate.has(s.date)) byDate.set(s.date, []);
      byDate.get(s.date).push(s);
    }
    return [...byDate.entries()];
  }, [sessions, activities, places, query, from, to]);

  if (!all) return <p className="muted">Loading…</p>;

  return (
    <div>
      <div className="card filters">
        <label className="field">
          <span className="sr-only">Search</span>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Search exercises, activities, places, notes"
          />
        </label>
        {!showDates && !from && !to && (
          <button type="button" className="btn btn-link btn-small" onClick={() => setShowDates(true)}>
            Filter by date
          </button>
        )}
        {(showDates || from || to) && (
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
        )}
        {(query || from || to) && (
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => {
              setQuery('');
              setFrom('');
              setTo('');
              setShowDates(false);
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

      {groups.slice(0, limit).map(([date, items]) => (
        <section key={date} className="day">
          <h3>{fmtDayDate(date)}</h3>
          {items.map((s) =>
            s.isActivity ? (
              <ActivityCard key={s.id} activity={s.activity} unit={unit} showDate={false} placeName={placeName(s.activity.place_id)} onOpen={onOpenActivity} />
            ) : (
              <SessionCard key={s.id} session={s} unit={unit} showDate={false} placeName={placeName(s.place_id)} onOpen={(x) => onOpen(x, x.id === activeId)} />
            ),
          )}
        </section>
      ))}
      {groups.length > limit && (
        <button type="button" className="btn btn-ghost btn-block" onClick={() => setLimit((l) => l + PAGE)}>
          Show more ({groups.length - limit} more days)
        </button>
      )}
    </div>
  );
}
