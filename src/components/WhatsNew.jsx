import { useEffect, useRef } from 'react';
import { RELEASES } from '../changelog';

const fmt = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');

// A one-time pop-up for a new version.
export default function WhatsNew({ release, onClose, onSeeAll }) {
  const ok = useRef(null);
  useEffect(() => {
    ok.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="whatsnew-title" onClick={(e) => e.stopPropagation()}>
        <p className="muted tour-step">New in Repwise {release.id}</p>
        <h2 id="whatsnew-title">{release.title}</h2>
        <ul className="tour-lines">
          {release.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
        <div className="actions">
          <button ref={ok} type="button" className="btn" onClick={onClose}>
            Got it
          </button>
          <button type="button" className="btn btn-link" onClick={onSeeAll}>
            See all changes
          </button>
        </div>
      </div>
    </div>
  );
}

// The full history, newest first, for Settings.
export function ChangeLog({ open = null }) {
  return (
    <div className="changelog">
      {RELEASES.map((r, i) => (
        <details key={r.id} open={open ? open === r.id : i === 0}>
          <summary>
            <strong>
              {r.id} · {r.title}
            </strong>
            {r.date && <span className="muted"> {fmt(r.date)}</span>}
          </summary>
          <ul>
            {r.items.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
