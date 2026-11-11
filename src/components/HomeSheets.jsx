import { useEffect } from 'react';
import { plural } from '../stats';
import { STARTERS } from '../starterRoutines';

const FEATURED = ['full-a', 'bodyweight', 'dumbbell'];

function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop sheet-backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal home-sheet">
        <h2>{title}</h2>
        {children}
        <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const Choice = ({ title, sub, onClick, disabled }) => (
  <button type="button" className="sheet-choice" onClick={onClick} disabled={disabled}>
    <strong>{title}</strong>
    {sub && <span className="muted small">{sub}</span>}
  </button>
);

// Every way to start something, in one place. Each choice starts with one tap.
export function StartSheet({ routines, onRoutine, onStarter, onSuggest, onEmpty, onStretch, onClose }) {
  const mine = routines.slice(0, 6);
  return (
    <Sheet title="Start a workout" onClose={onClose}>
      <Choice title="Suggest a workout" sub="Built for your time, equipment and recent training" onClick={onSuggest} />
      {mine.length > 0 ? (
        <>
          <h4 className="sheet-group">Your routines</h4>
          {mine.map((r) => (
            <Choice key={r.id} title={r.name || 'Untitled routine'} sub={plural(r.exercises.length, 'exercise')} onClick={() => onRoutine(r)} />
          ))}
        </>
      ) : (
        <>
          <h4 className="sheet-group">Try a starter routine</h4>
          {FEATURED.map((id) => STARTERS.find((s) => s.id === id)).map((s) => (
            <Choice key={s.id} title={s.name} sub={s.blurb} onClick={() => onStarter(s)} />
          ))}
        </>
      )}
      <h4 className="sheet-group">Or</h4>
      <Choice title="Empty workout" sub="Add exercises as you go" onClick={onEmpty} />
      <Choice title="Stretch" sub="Pick areas and a time, with a guided timer" onClick={onStretch} />
    </Sheet>
  );
}

// Things you already did.
export function LogSheet({ onPast, onActivity, onStretch, onClose }) {
  return (
    <Sheet title="Log something you did" onClose={onClose}>
      <Choice title="A past workout" sub="Lifts or exercises from an earlier day" onClick={onPast} />
      <Choice title="A run, walk or sport" sub="Time, distance and effort. No GPS." onClick={onActivity} />
      <Choice title="A stretch session" sub="Choose what you stretched and for how long" onClick={onStretch} />
    </Sheet>
  );
}
