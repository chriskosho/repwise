import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, saveWorkout, today } from '../db';

const blankSet = () => ({ reps: '', weight: '' });

export default function LogForm({ editing, unit, onDone, onCancel }) {
  const [date, setDate] = useState(editing?.date ?? today());
  const [exercise, setExercise] = useState(editing?.exercise ?? '');
  const [sets, setSets] = useState(
    editing?.sets?.length ? editing.sets.map((s) => ({ reps: String(s.reps), weight: String(s.weight || '') })) : [blankSet()],
  );
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const names = useLiveQuery(
    async () => {
      const all = await db.workouts.toArray();
      return [...new Set(all.filter((w) => !w.deleted_at).map((w) => w.exercise))].sort((a, b) => a.localeCompare(b));
    },
    [],
    [],
  );

  const updateSet = (i, field, value) =>
    setSets((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));

  // A new set starts as a copy of the previous one, which is usually what you did.
  const addSet = () => setSets((prev) => [...prev, { ...(prev[prev.length - 1] ?? blankSet()) }]);
  const removeSet = (i) => setSets((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));

  async function submit(e) {
    e.preventDefault();
    setSaved('');
    if (!exercise.trim()) return setError('Enter an exercise.');
    if (!date) return setError('Pick a date.');

    const cleaned = [];
    for (const s of sets) {
      if (s.reps === '' && s.weight === '') continue;
      const reps = Number(s.reps);
      const weight = s.weight === '' ? 0 : Number(s.weight);
      if (!Number.isFinite(reps) || reps <= 0 || !Number.isFinite(weight) || weight < 0) {
        return setError('Each set needs reps above 0 and a weight of 0 or more.');
      }
      cleaned.push({ reps, weight });
    }
    if (!cleaned.length) return setError('Add at least one set.');

    setError('');
    await saveWorkout({ id: editing?.id, date, exercise, sets: cleaned, notes });
    if (editing) {
      onDone();
    } else {
      setSaved(`Saved ${exercise.trim()}`);
      setExercise('');
      setSets([blankSet()]);
      setNotes('');
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h2>{editing ? 'Edit workout' : 'Log a workout'}</h2>

      <label className="field">
        <span>Date</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>

      <label className="field">
        <span>Exercise</span>
        <input
          list="exercise-names"
          value={exercise}
          onChange={(e) => setExercise(e.target.value)}
          placeholder="e.g. Back squat"
          maxLength={100}
          autoComplete="off"
        />
        <datalist id="exercise-names">
          {names.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </label>

      <div className="sets">
        <div className="sets-head">
          <span>Set</span>
          <span>Reps</span>
          <span>Weight ({unit})</span>
          <span />
        </div>
        {sets.map((s, i) => (
          <div className="set-row" key={i}>
            <span className="set-num">{i + 1}</span>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              aria-label={`Set ${i + 1} reps`}
              value={s.reps}
              onChange={(e) => updateSet(i, 'reps', e.target.value)}
              placeholder="0"
            />
            <input
              inputMode="decimal"
              aria-label={`Set ${i + 1} weight`}
              value={s.weight}
              onChange={(e) => updateSet(i, 'weight', e.target.value)}
              placeholder="0"
            />
            <button
              type="button"
              className="icon-btn"
              onClick={() => removeSet(i)}
              disabled={sets.length === 1}
              aria-label={`Remove set ${i + 1}`}
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-ghost" onClick={addSet}>
          + Add set
        </button>
      </div>

      <label className="field">
        <span>Notes</span>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
      </label>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="success" role="status">
          {saved}
        </p>
      )}

      <div className="actions">
        <button type="submit" className="btn">
          {editing ? 'Save changes' : 'Save workout'}
        </button>
        {editing && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
