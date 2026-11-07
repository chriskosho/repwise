import { doneSets, fmtDayDate, fmtDuration, fmtVolume, plural, sessionStats, summarizeSets, workSets } from '../stats';

// One workout in a list. `showDate` is off when the list already groups by date.
export default function SessionCard({ session, unit, onOpen, showDate = true }) {
  const stats = sessionStats(session);
  const inProgress = !session.ended_at;
  const meta = showDate ? [fmtDayDate(session.date)] : [];
  if (stats.minutes != null && stats.minutes >= 1) meta.push(fmtDuration(stats.minutes));
  if (stats.sets) meta.push(plural(stats.sets, 'set'));
  if (stats.volume) meta.push(`${fmtVolume(stats.volume)} ${unit}`);

  return (
    <button type="button" className="card session-card" onClick={() => onOpen(session)}>
      <div className="session-title">
        <strong>{session.name || 'Workout'}</strong>
        {inProgress && <span className="badge">In progress</span>}
      </div>
      {meta.length > 0 && <span className="muted">{meta.join(' · ')}</span>}
      <ul className="session-lines">
        {session.exercises.map((ex) => {
          const sets = workSets(ex);
          const warm = doneSets(ex).length - sets.length;
          return (
            <li key={ex.id}>
              <span className="ex-name">{ex.name}</span>
              <span className="muted">{sets.length ? summarizeSets(sets, unit) : warm ? `${warm} warm-up` : '—'}</span>
            </li>
          );
        })}
      </ul>
    </button>
  );
}
