import { adjustRest, stopRest, useRest } from '../rest';
import { fmtClock } from '../stats';
import { useNow } from '../useNow';

// Floating rest timer, shown on every tab while it runs.
export default function RestBar() {
  const rest = useRest();
  const running = rest.end != null;
  const now = useNow(250, running);

  if (rest.over) {
    return (
      <div className="restbar over" role="status">
        <span>Rest over. Time for your next set.</span>
        <button type="button" className="btn btn-small btn-ghost" onClick={stopRest}>
          Dismiss
        </button>
      </div>
    );
  }
  if (!running) return null;

  const left = Math.max(0, Math.ceil((rest.end - now) / 1000));
  const pct = rest.total > 0 ? Math.min(100, Math.max(0, ((rest.total - left) / rest.total) * 100)) : 0;

  return (
    <div className="restbar">
      <div className="restbar-row">
        <span className="restbar-label">Rest</span>
        <strong className="restbar-time">{fmtClock(left)}</strong>
        <div className="restbar-actions">
          <button type="button" className="btn btn-small btn-ghost" onClick={() => adjustRest(-15)} aria-label="Subtract 15 seconds">
            −15
          </button>
          <button type="button" className="btn btn-small btn-ghost" onClick={() => adjustRest(15)} aria-label="Add 15 seconds">
            +15
          </button>
          <button type="button" className="btn btn-small" onClick={stopRest}>
            Skip
          </button>
        </div>
      </div>
      <div className="restbar-track" aria-hidden="true">
        <div className="restbar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
