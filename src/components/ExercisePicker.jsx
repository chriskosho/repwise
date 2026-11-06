import { useEffect, useMemo, useRef, useState } from 'react';
import { STARTER_EXERCISES } from '../data/starterExercises';
import { key } from '../stats';

// Full-screen exercise chooser. Your own exercises come first (most recently
// used on top), then the starter list. Anything typed can be added as new.
export default function ExercisePicker({ sessions, onPick, onClose }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const options = useMemo(() => {
    const seen = new Set();
    const list = [];
    const add = (name, group) => {
      const k = key(name);
      if (!k || seen.has(k)) return;
      seen.add(k);
      list.push({ name, group });
    };
    for (const s of sessions) for (const e of s.exercises) add(e.name, 'Your exercises');
    for (const n of STARTER_EXERCISES) add(n, 'Common exercises');
    return list;
  }, [sessions]);

  const term = key(q);
  const shown = (term ? options.filter((o) => key(o.name).includes(term)) : options).slice(0, 80);
  const exact = options.some((o) => key(o.name) === term);
  const typed = q.trim().replace(/\s+/g, ' ');

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Add exercise">
      <div className="sheet-head">
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search or type a new exercise"
          maxLength={100}
          autoComplete="off"
          aria-label="Search exercises"
        />
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
      </div>

      <div className="sheet-list">
        {term && !exact && (
          <button type="button" className="pick create" onClick={() => onPick(typed)}>
            Add “{typed}”
          </button>
        )}
        {shown.map((o, i) => (
          <div key={o.name}>
            {(i === 0 || shown[i - 1].group !== o.group) && <h3>{o.group}</h3>}
            <button type="button" className="pick" onClick={() => onPick(o.name)}>
              {o.name}
            </button>
          </div>
        ))}
        {!shown.length && !term && <p className="muted empty">No exercises yet.</p>}
      </div>
    </div>
  );
}
