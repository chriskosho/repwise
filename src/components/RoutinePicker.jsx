import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listRoutines, sessionFromRoutine } from '../db';
import { key } from '../stats';
import { plural } from '../stats';

// Add the exercises from a saved routine to the workout you are in. Pick a routine, untick
// anything you do not want, and they are added with the routine's sets and targets.
export default function RoutinePicker({ existing = [], onAdd, onClose }) {
  const routines = useLiveQuery(listRoutines, [], null);
  const [chosen, setChosen] = useState(null);
  const [ticked, setTicked] = useState([]);
  const have = new Set(existing.map((n) => key(n)));

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const choose = (r) => {
    const exercises = sessionFromRoutine(r).exercises;
    setChosen({ routine: r, exercises });
    setTicked(exercises.filter((e) => !have.has(key(e.name))).map((e) => e.id));
  };
  const toggle = (id) => setTicked((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Add a routine">
      <div className="modal">
        {!chosen ? (
          <>
            <h2>Add a routine</h2>
            <p className="muted">Its exercises are added to this workout. The workout keeps its name.</p>
            {routines === null ? null : routines.length === 0 ? (
              <p className="muted">You have no routines yet. Use "Save as routine" on any workout to make one.</p>
            ) : (
              <ul className="list">
                {routines.map((r) => (
                  <li key={r.id}>
                    <button type="button" className="btn btn-ghost btn-block" onClick={() => choose(r)}>
                      {r.name || 'Untitled routine'} · {plural(r.exercises.length, 'exercise')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <h2>{chosen.routine.name || 'Routine'}</h2>
            <ul className="list">
              {chosen.exercises.map((e) => {
                const dup = have.has(key(e.name));
                return (
                  <li key={e.id}>
                    <label className="check-row">
                      <input type="checkbox" checked={ticked.includes(e.id)} onChange={() => toggle(e.id)} aria-label={e.name} />
                      <span>
                        {e.name}
                        {dup && <span className="muted"> · already added</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className="btn btn-big btn-block"
              disabled={!ticked.length}
              onClick={() => onAdd(chosen.exercises.filter((e) => ticked.includes(e.id)))}
            >
              Add {plural(ticked.length, 'exercise')}
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => setChosen(null)}>
              Back
            </button>
          </>
        )}
        <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
