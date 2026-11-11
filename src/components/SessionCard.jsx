import { doneSets, fmtDayDate, fmtDuration, fmtVolume, plural, sessionStats, summarizeSets, workSets } from '../stats';
import { fmtCardioTime, kmToLong, longUnit, modeOf } from '../measure';
import { exName } from '../library';

// One workout in a list. `showDate` is off when the list already groups by date.
export default function SessionCard({ session, unit, onOpen, showDate = true, placeName }) {
  const stats = sessionStats(session);
  const inProgress = !session.ended_at;
  const meta = showDate ? [fmtDayDate(session.date)] : [];
  if (stats.minutes != null && stats.minutes >= 1) meta.push(fmtDuration(stats.minutes));
  if (stats.sets) meta.push(plural(stats.sets, 'set'));
  if (stats.volume) meta.push(`${fmtVolume(stats.volume)} ${unit}`);
  if (stats.cardioSec > 0) meta.push(`${fmtCardioTime(stats.cardioSec)} cardio`);
  if (stats.km > 0) meta.push(`${Math.round(kmToLong(stats.km, unit) * 100) / 100} ${longUnit(unit)}`);
  if (placeName) meta.push(placeName);

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
              <span className="ex-name">{exName(ex.name)}</span>
              <span className="muted">{sets.length ? summarizeSets(sets, unit, modeOf(ex), ex.name) : warm ? `${warm} warm-up` : '—'}</span>
            </li>
          );
        })}
      </ul>
      {session.notes && <p className="notes">{session.notes}</p>}
    </button>
  );
}
