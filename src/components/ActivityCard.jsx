import { activitySummary, activityTitle, typeLabel } from '../activities';
import { fmtDayDate } from '../stats';

export default function ActivityCard({ activity, unit, placeName, onOpen, showDate = true }) {
  const meta = [showDate && fmtDayDate(activity.date), activitySummary(activity, unit), placeName].filter(Boolean);
  return (
    <button type="button" className="card session-card" onClick={() => onOpen(activity)}>
      <div className="session-title">
        <strong>{activityTitle(activity)}</strong>
        <span className="badge">{typeLabel(activity.type)}</span>
      </div>
      <span className="muted">{meta.join(' · ')}</span>
      {activity.notes && <p className="notes">{activity.notes}</p>}
    </button>
  );
}
