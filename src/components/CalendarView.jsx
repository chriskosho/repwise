import { useMemo, useState } from 'react';
import { activeWeekStreaks, monthGrid } from '../analytics';
import { today } from '../db';
import { activitySummary } from '../activities';
import { sessionStats, fmtDayDate, fmtDuration, fmtVolume, plural } from '../stats';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarView({ sessions, weekStart, unit }) {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [picked, setPicked] = useState(null);

  const weeks = useMemo(() => monthGrid(sessions, ym.y, ym.m, weekStart), [sessions, ym, weekStart]);
  const streaks = useMemo(() => activeWeekStreaks(sessions, weekStart), [sessions, weekStart]);
  const heads = [...DAYS.slice(weekStart), ...DAYS.slice(0, weekStart)];
  const title = new Date(ym.y, ym.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const todayStr = today();
  const monthCount = weeks.flat().filter(Boolean).reduce((a, c) => a + c.count, 0);
  const day = picked ? sessions.filter((s) => s.date === picked && s.ended_at && s.exercises.length) : [];

  const step = (n) => {
    setPicked(null);
    setYm(({ y, m }) => {
      const d = new Date(y, m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  return (
    <section className="card">
      <h2>Consistency</h2>
      <div className="stats">
        <div>
          <span className="stat-label">Week streak</span>
          <strong>{streaks.current}</strong>
        </div>
        <div>
          <span className="stat-label">Longest</span>
          <strong>{streaks.longest}</strong>
        </div>
        <div>
          <span className="stat-label">All workouts</span>
          <strong>{streaks.total}</strong>
        </div>
      </div>
      <p className="muted">A week counts when you finish at least one workout in it.</p>

      <div className="stepper-row cal-head">
        <button type="button" className="btn btn-small btn-ghost" onClick={() => step(-1)} aria-label="Previous month">
          ←
        </button>
        <strong>{title}</strong>
        <button type="button" className="btn btn-small btn-ghost" onClick={() => step(1)} aria-label="Next month">
          →
        </button>
      </div>
      <p className="muted">
        {monthCount} workout{monthCount === 1 ? '' : 's'} this month
      </p>

      <table className="cal" aria-label={title}>
        <thead>
          <tr>
            {heads.map((d) => (
              <th key={d} scope="col">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((w, i) => (
            <tr key={i}>
              {w.map((c, j) => (
                <td key={j}>
                  {c && (
                    <button
                      type="button"
                      className={`cal-day${c.count ? ' has' : ''}${c.date === todayStr ? ' today' : ''}${c.date === picked ? ' picked' : ''}`}
                      aria-label={`${c.date}${c.count ? `, ${c.count} workout${c.count === 1 ? '' : 's'}` : ''}`}
                      aria-pressed={c.date === picked}
                      onClick={() => setPicked(c.date === picked ? null : c.date)}
                    >
                      {c.day}
                    </button>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {picked && (
        <div className="day-detail">
          <strong>{fmtDayDate(picked)}</strong>
          {!day.length && <p className="muted">No workout on this day.</p>}
          {day.map((s) => {
            if (s.isActivity) {
              return (
                <p key={s.id} className="muted">
                  {s.name}: {activitySummary(s.activity, unit)}
                </p>
              );
            }
            const st = sessionStats(s);
            return (
              <p key={s.id} className="muted">
                {s.name}: {plural(st.exercises, 'exercise')}, {plural(st.sets, 'set')}
                {st.volume > 0 ? `, ${fmtVolume(st.volume)} ${unit}` : ''}
                {st.minutes != null ? `, ${fmtDuration(st.minutes)}` : ''}
              </p>
            );
          })}
        </div>
      )}
    </section>
  );
}
