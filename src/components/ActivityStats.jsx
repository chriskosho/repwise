import { useMemo, useState } from 'react';
import { bestEfforts, byType, distUnit, distanceOut, fmtMinutes, totals, typeLabel, weeklyMinutes, activitySummary } from '../activities';
import { weekStartOf } from '../goals';
import { today } from '../db';
import { fmtShortDate } from '../stats';

const RANGES = [
  ['30', '30 days'],
  ['90', '90 days'],
  ['all', 'All time'],
];

function paceLabel(minPerKm, type, unit) {
  const kmPer = unit === 'kg' ? minPerKm : minPerKm * 1.609344;
  const u = distUnit(unit);
  if (type === 'cycle' || type === 'row') {
    const speed = 60 / kmPer;
    return `${Math.round(speed * 10) / 10} ${u === 'mi' ? 'mph' : 'km/h'}`;
  }
  const s = Math.round(kmPer * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} /${u}`;
}

export default function ActivityStats({ activities, unit, weekStart }) {
  const [range, setRange] = useState('90');
  const todayStr = today();
  const list = useMemo(() => {
    if (range === 'all') return activities;
    const d = new Date(`${todayStr}T00:00:00`);
    d.setDate(d.getDate() - Number(range));
    const from = d.toLocaleDateString('en-CA');
    return activities.filter((a) => a.date >= from);
  }, [activities, range, todayStr]);

  const sum = totals(list);
  const types = byType(list);
  const bests = bestEfforts(list);
  const weeks = weeklyMinutes(activities, weekStartOf, weekStart, 8, todayStr);
  const max = Math.max(1, ...weeks.map((w) => w.minutes));
  const u = distUnit(unit);

  if (!activities.length) {
    return <p className="muted empty">No activities yet. Log a run, ride or game from the Workout tab and its totals show up here.</p>;
  }

  return (
    <div>
      <section className="card">
        <h2>Activity</h2>
        <div className="chips" role="group" aria-label="Range">
          {RANGES.map(([id, label]) => (
            <button key={id} type="button" className={range === id ? 'chip-toggle on' : 'chip-toggle'} aria-pressed={range === id} onClick={() => setRange(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className="stats">
          <div>
            <span className="stat-label">Activities</span>
            <strong>{sum.count}</strong>
          </div>
          <div>
            <span className="stat-label">Time</span>
            <strong>{fmtMinutes(sum.minutes)}</strong>
          </div>
          <div>
            <span className="stat-label">Distance</span>
            <strong>
              {distanceOut(sum.km, unit)} {u}
            </strong>
          </div>
        </div>
      </section>

      <section className="card">
        <h3>Minutes per week</h3>
        <div className="bars" role="img" aria-label={`Active minutes per week, last 8 weeks. This week: ${weeks[weeks.length - 1].minutes} minutes.`}>
          {weeks.map((w) => (
            <div key={w.week} className="bar-col" title={`${fmtShortDate(w.week)}: ${w.minutes} min`}>
              <div className="bar-v" style={{ height: `${(w.minutes / max) * 100}%` }} />
              <span className="bar-n">{w.minutes || ''}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>By activity</h3>
        {types.length === 0 && <p className="muted">Nothing in this range.</p>}
        <ul className="plain by-type">
          {types.map((t) => (
            <li key={t.type}>
              <strong>{typeLabel(t.type)}</strong>
              <span className="muted">
                {t.count}× · {fmtMinutes(t.minutes)}
                {t.km > 0 ? ` · ${distanceOut(t.km, unit)} ${u}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {bests.length > 0 && (
        <section className="card">
          <h3>Best efforts</h3>
          <ul className="plain by-type">
            {bests.map((b) => (
              <li key={b.type}>
                <strong>{typeLabel(b.type)}</strong>
                <span className="muted">
                  {paceLabel(b.minPerKm, b.type, unit)} · {fmtShortDate(b.activity.date)} · {activitySummary(b.activity, unit).split(' · ').slice(0, 2).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
