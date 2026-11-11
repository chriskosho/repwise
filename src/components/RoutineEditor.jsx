import { useState } from 'react';
import { cleanTarget, deleteRoutine, newId, saveRoutine } from '../db';
import ExercisePicker from './ExercisePicker';
import { useLiveQuery } from 'dexie-react-hooks';
import { listCustomExercises } from '../db';
import { useLibrary, exName } from '../library';
import { resolveMode } from '../measure';

const MAX_SETS = 12;

// Create or change a routine: its name, exercises, set counts and supersets.
// Nothing is saved until you tap Save.
export default function RoutineEditor({ initial, isNew, sessions, unit = 'lb', onClose }) {
  const { list: library } = useLibrary();
  const custom = useLiveQuery(listCustomExercises, [], []);
  const [doc, setDoc] = useState(() => ({ ...initial }));
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState('');

  const update = (fn) => {
    setDoc(fn);
    setError('');
  };
  const updateEx = (id, fn) => update((d) => ({ ...d, exercises: d.exercises.map((e) => (e.id === id ? fn(e) : e)) }));

  function addExercises(names) {
    setPicker(false);
    const fresh = names.map((name) => ({ id: newId(), name, link: false, notes: '', sets: [{ id: newId(), type: 'normal' }, { id: newId(), type: 'normal' }, { id: newId(), type: 'normal' }] }));
    update((d) => ({ ...d, exercises: [...d.exercises, ...fresh] }));
  }

  function setCount(ex, delta) {
    updateEx(ex.id, (e) => {
      if (delta > 0) return e.sets.length >= MAX_SETS ? e : { ...e, sets: [...e.sets, { id: newId(), type: 'normal' }] };
      return e.sets.length <= 1 ? e : { ...e, sets: e.sets.slice(0, -1) };
    });
  }

  function move(id, dir) {
    update((d) => {
      const i = d.exercises.findIndex((e) => e.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.exercises.length) return d;
      const list = [...d.exercises];
      [list[i], list[j]] = [list[j], list[i]];
      // The last exercise can't link to a next one.
      list[list.length - 1] = { ...list[list.length - 1], link: false };
      return { ...d, exercises: list };
    });
  }

  function remove(id) {
    update((d) => {
      const list = d.exercises.filter((e) => e.id !== id);
      if (list.length) list[list.length - 1] = { ...list[list.length - 1], link: false };
      return { ...d, exercises: list };
    });
  }

  async function save() {
    const name = doc.name.trim();
    if (!name) return setError('Give the routine a name.');
    if (!doc.exercises.length) return setError('Add at least one exercise.');
    await saveRoutine({ ...doc, name, exercises: doc.exercises.map(({ target, ...e }) => (cleanTarget(target) ? { ...e, target: cleanTarget(target) } : e)) });
    onClose();
  }

  async function removeRoutine() {
    if (!window.confirm(`Delete the routine “${doc.name || 'Untitled'}”? Your logged workouts are not affected.`)) return;
    await deleteRoutine(doc.id);
    onClose();
  }

  return (
    <div className="editor">
      <div className="card editor-head">
        <h2>{isNew ? 'New routine' : 'Edit routine'}</h2>
        <label className="field">
          <span>Name</span>
          <input
            value={doc.name}
            onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
            placeholder="e.g. Push day"
            maxLength={60}
            autoComplete="off"
          />
        </label>
      </div>

      {doc.exercises.map((ex, i) => {
        const warm = ex.sets.filter((s) => s.type === 'warmup').length;
        const last = i === doc.exercises.length - 1;
        return (
          <section key={ex.id} className={`card exercise${ex.link || doc.exercises[i - 1]?.link ? ' in-superset' : ''}`}>
            <div className="exercise-head">
              <h2>{exName(ex.name)}</h2>
              <button type="button" className="btn btn-ghost btn-small btn-danger" aria-label={`Remove ${ex.name}`} onClick={() => remove(ex.id)}>
                Remove
              </button>
            </div>
            <div className="stepper-row">
              <span>Sets</span>
              <div className="stepper">
                <button type="button" className="btn btn-ghost btn-small" aria-label={`Fewer sets for ${ex.name}`} disabled={ex.sets.length <= 1} onClick={() => setCount(ex, -1)}>
                  −
                </button>
                <strong aria-live="polite">{ex.sets.length}</strong>
                <button type="button" className="btn btn-ghost btn-small" aria-label={`More sets for ${ex.name}`} disabled={ex.sets.length >= MAX_SETS} onClick={() => setCount(ex, 1)}>
                  +
                </button>
              </div>
              {warm > 0 && <span className="muted">{warm} warm-up</span>}
            </div>
            {(() => {
              const mode = ex.mode || resolveMode(ex.name, { library: library ?? [], custom, prior: sessions ?? [] });
              if (mode === 'cardio') return null;
              const t = ex.target ?? {};
              const setT = (k, v) => updateEx(ex.id, (x) => ({ ...x, target: { ...(x.target ?? {}), [k]: v } }));
              const timed = mode === 'time' || mode === 'stretch';
              return (
                <div className="target-row">
                  {(mode === 'weight' || mode === 'carry' || mode === 'bodyweight') && (
                    <label className="field">
                      <span>Target weight ({unit})</span>
                      <input type="number" inputMode="decimal" min="0" step="any" value={t.weight ?? ''} aria-label={`Target weight for ${ex.name}`} onChange={(e) => setT('weight', e.target.value)} />
                    </label>
                  )}
                  {(mode === 'weight' || mode === 'bodyweight') && (
                    <label className="field">
                      <span>Target reps</span>
                      <input type="number" inputMode="numeric" min="0" step="1" value={t.reps ?? ''} aria-label={`Target reps for ${ex.name}`} onChange={(e) => setT('reps', e.target.value)} />
                    </label>
                  )}
                  {timed && (
                    <label className="field">
                      <span>Target seconds</span>
                      <input type="number" inputMode="numeric" min="0" step="1" value={t.time ?? ''} aria-label={`Target seconds for ${ex.name}`} onChange={(e) => setT('time', e.target.value)} />
                    </label>
                  )}
                </div>
              );
            })()}
            <label className="check-row">
              <input type="checkbox" checked={!!ex.link} disabled={last} onChange={(e) => updateEx(ex.id, (x) => ({ ...x, link: e.target.checked }))} />
              <span>Superset with the next exercise</span>
            </label>
            <div className="actions">
              <button type="button" className="btn btn-ghost btn-small" disabled={i === 0} aria-label={`Move ${ex.name} up`} onClick={() => move(ex.id, -1)}>
                ↑ Up
              </button>
              <button type="button" className="btn btn-ghost btn-small" disabled={last} aria-label={`Move ${ex.name} down`} onClick={() => move(ex.id, 1)}>
                ↓ Down
              </button>
            </div>
          </section>
        );
      })}

      <button type="button" className="btn btn-ghost btn-block" onClick={() => setPicker(true)}>
        + Add exercises
      </button>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="actions">
        <button type="button" className="btn" onClick={save}>
          Save routine
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
      {!isNew && (
        <button type="button" className="btn btn-ghost btn-danger btn-block routine-delete" onClick={removeRoutine}>
          Delete routine
        </button>
      )}

      {picker && <ExercisePicker sessions={sessions} onAdd={addExercises} onClose={() => setPicker(false)} />}
    </div>
  );
}
