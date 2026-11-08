import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listCustomExercises, saveCustomExercise } from '../db';
import ExerciseInfo from './ExerciseInfo';
import { InfoIcon } from './Icons';
import { CATEGORIES, EQUIPMENT, MUSCLES, equipmentLabel, historyNames, muscleLabel, searchExercises, useLibrary } from '../library';
import { key } from '../stats';

const PAGE = 60;

// Full-screen exercise chooser. Pick one or several, then add them together.
// Your own and previously logged exercises come first, then the library
// (filterable by muscle and equipment). Anything new can be created on the spot.
export default function ExercisePicker({ sessions, onAdd, onClose, initialCategory = '' }) {
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equipment, setEquipment] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [info, setInfo] = useState(null);
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState([]);
  const [creating, setCreating] = useState(false);
  const [newMuscle, setNewMuscle] = useState('');
  const [newEquipment, setNewEquipment] = useState('');
  const inputRef = useRef(null);

  const { list: library, failed } = useLibrary();
  const custom = useLiveQuery(listCustomExercises, [], []);
  const history = useMemo(() => historyNames(sessions), [sessions]);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const results = useMemo(
    () => searchExercises({ library: library ?? [], custom, history, query: q, muscle, equipment, category }),
    [library, custom, history, q, muscle, equipment, category],
  );

  // Every name that already exists, ignoring filters, to decide whether to offer "Create".
  const known = useMemo(() => {
    const s = new Set();
    custom.forEach((c) => s.add(key(c.name)));
    history.forEach((n) => s.add(key(n)));
    (library ?? []).forEach((l) => s.add(key(l.name)));
    return s;
  }, [custom, history, library]);

  const term = key(q);
  const typed = q.trim().replace(/\s+/g, ' ');
  const canCreate = !!term && !known.has(term);
  const isSelected = (name) => selected.some((n) => key(n) === key(name));
  const toggle = (name) => setSelected((prev) => (isSelected(name) ? prev.filter((n) => key(n) !== key(name)) : [...prev, name]));

  async function create() {
    const row = await saveCustomExercise({ name: typed, muscle: newMuscle, equipment: newEquipment });
    setSelected((prev) => (prev.some((n) => key(n) === key(row.name)) ? prev : [...prev, row.name]));
    setQ('');
    setCreating(false);
    setNewMuscle('');
    setNewEquipment('');
    inputRef.current?.focus();
  }

  const shown = results.slice(0, limit);

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Add exercises">
      <div className="sheet-head">
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setLimit(PAGE);
            setCreating(false);
          }}
          placeholder="Search or type a new exercise"
          maxLength={100}
          autoComplete="off"
          aria-label="Search exercises"
        />
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
      </div>

      <div className="sheet-filters">
        <select
          aria-label="Filter by muscle"
          value={muscle}
          onChange={(e) => {
            setMuscle(e.target.value);
            setLimit(PAGE);
          }}
        >
          <option value="">All muscles</option>
          {MUSCLES.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by type"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setLimit(PAGE);
          }}
        >
          {CATEGORIES.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by equipment"
          value={equipment}
          onChange={(e) => {
            setEquipment(e.target.value);
            setLimit(PAGE);
          }}
        >
          <option value="">All equipment</option>
          {EQUIPMENT.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="sheet-list">
        {canCreate && !creating && (
          <button type="button" className="pick create" onClick={() => setCreating(true)}>
            Create “{typed}”
          </button>
        )}
        {canCreate && creating && (
          <div className="menu create-form">
            <strong>New exercise: {typed}</strong>
            <div className="row">
              <label className="field">
                <span>Muscle</span>
                <select value={newMuscle} onChange={(e) => setNewMuscle(e.target.value)}>
                  <option value="">Not set</option>
                  {MUSCLES.map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Equipment</span>
                <select value={newEquipment} onChange={(e) => setNewEquipment(e.target.value)}>
                  <option value="">Not set</option>
                  {EQUIPMENT.map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="actions">
              <button type="button" className="btn" onClick={create}>
                Create and select
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>
                Back
              </button>
            </div>
          </div>
        )}

        {!library && !failed && <p className="muted pick-note">Loading the exercise library…</p>}
        {failed && (
          <p className="muted pick-note">
            The exercise library couldn't load (are you offline?). You can still pick your own exercises or create new ones.
          </p>
        )}

        {shown.map((r, i) => {
          const on = isSelected(r.name);
          const sub = [muscleLabel(r.muscle), equipmentLabel(r.equipment)].filter(Boolean).join(' · ');
          return (
            <div key={r.key}>
              {!term && (i === 0 || shown[i - 1].mine !== r.mine) && <h3>{r.mine ? 'Your exercises' : 'Library'}</h3>}
              <div className="pick-row">
                <button type="button" className={`pick${on ? ' on' : ''}`} aria-label={r.name} aria-pressed={on} onClick={() => toggle(r.name)}>
                  <span className="pick-main">
                    <span>{r.name}</span>
                    {sub && <span className="pick-sub">{sub}</span>}
                  </span>
                  <span className="pick-check" aria-hidden="true">
                    {on ? '✓' : ''}
                  </span>
                </button>
                <button type="button" className="icon-btn" aria-label={`How to: ${r.name}`} onClick={() => setInfo(r.name)}>
                  <InfoIcon />
                </button>
              </div>
            </div>
          );
        })}

        {results.length > limit && (
          <button type="button" className="btn btn-ghost btn-block more" onClick={() => setLimit((l) => l + PAGE)}>
            Show more ({results.length - limit} left)
          </button>
        )}
        {!results.length && library && !canCreate && <p className="muted empty">No exercises match.</p>}
      </div>

      {info && <ExerciseInfo name={info} onClose={() => setInfo(null)} />}

      <div className="sheet-foot">
        <button type="button" className="btn btn-block" disabled={!selected.length} onClick={() => onAdd(selected)}>
          {selected.length ? `Add ${selected.length} exercise${selected.length === 1 ? '' : 's'}` : 'Select exercises to add'}
        </button>
      </div>
    </div>
  );
}
