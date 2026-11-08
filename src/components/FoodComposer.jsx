import { useState } from 'react';
import { MACROS, entryTotals, fmtServings, round } from '../food';

const LABELS = { calories: 'Calories', protein: 'Protein (g)', carbs: 'Carbs (g)', fat: 'Fat (g)' };
const show = (v) => (v == null ? '' : String(v));

// Nutrition boxes for one serving. All optional.
export function NutritionFields({ values, onChange, required = false }) {
  return (
    <div className="nutrition-fields">
      {MACROS.map((k) => (
        <label className="field" key={k}>
          <span>{LABELS[k]}</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={values[k]}
            required={required && k === 'calories'}
            onChange={(e) => onChange({ ...values, [k]: e.target.value })}
          />
        </label>
      ))}
    </div>
  );
}

// Adds or edits one thing you ate. `initial` holds the food (name, serving, per-serving numbers).
export default function FoodComposer({ initial, mode = 'add', isNew = false, onSave, onCancel, onDelete, onAgain }) {
  const [name, setName] = useState(initial.name ?? '');
  const [serving, setServing] = useState(initial.serving ?? '');
  const [servings, setServings] = useState(String(initial.servings ?? 1));
  const [nums, setNums] = useState({ calories: show(initial.calories), protein: show(initial.protein), carbs: show(initial.carbs), fat: show(initial.fat) });
  const [time, setTime] = useState(initial.time ?? '');
  const [date, setDate] = useState(initial.date ?? '');
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [keep, setKeep] = useState(true);
  const [more, setMore] = useState(isNew || mode === 'edit');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const qty = Number(servings);
  const valid = name.trim() && qty > 0;
  const t = entryTotals({ ...Object.fromEntries(MACROS.map((k) => [k, nums[k] === '' ? null : Number(nums[k])])), servings: qty > 0 ? qty : 1 });
  const known = nums.calories !== '';
  const bump = (d) => setServings(String(Math.max(0.25, round((qty > 0 ? qty : 1) + d, 2))));

  async function submit(e) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setErr('');
    try {
      await onSave({ name, serving, servings: qty, ...nums, time, date, notes, keep });
    } catch (x) {
      setErr(x.message || 'Could not save that.');
      setBusy(false);
    }
  }

  return (
    <form className="card food-composer form" onSubmit={submit} aria-label={mode === 'edit' ? 'Edit food entry' : 'Add food'}>
      <h3>{mode === 'edit' ? 'Edit entry' : isNew ? 'New food' : 'Add food'}</h3>

      {(isNew || mode === 'edit') && (
        <label className="field">
          <span>Food</span>
          <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} autoFocus={isNew} />
        </label>
      )}
      {!isNew && mode !== 'edit' && (
        <p>
          <strong>{name}</strong>
          {serving && <span className="muted"> · {serving}</span>}
        </p>
      )}

      <div className="row">
        <div className="field">
          <span>{isNew ? 'How much did you have?' : 'How many servings?'}</span>
          <div className="stepper">
            <button type="button" className="btn btn-ghost btn-small" aria-label="Fewer servings" onClick={() => bump(-0.5)}>
              −
            </button>
            <input type="number" inputMode="decimal" min="0.25" step="0.25" aria-label="Servings" value={servings} onChange={(e) => setServings(e.target.value)} />
            <button type="button" className="btn btn-ghost btn-small" aria-label="More servings" onClick={() => bump(0.5)}>
              +
            </button>
          </div>
        </div>
        <label className="field">
          <span>Time</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
      </div>

      {mode === 'edit' && (
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      )}

      <p className="food-sum" aria-live="polite">
        {known ? (
          <>
            <strong>{Math.round(t.calories)} cal</strong>
            {nums.protein !== '' || nums.carbs !== '' || nums.fat !== '' ? (
              <span className="muted">
                {' '}
                · {round(t.protein)}g protein · {round(t.carbs)}g carbs · {round(t.fat)}g fat
              </span>
            ) : null}
            {qty !== 1 && qty > 0 && serving ? <span className="muted"> ({fmtServings(qty)} × {serving})</span> : null}
          </>
        ) : (
          <span className="muted">No calories entered. It will still be logged.</span>
        )}
      </p>

      <button type="button" className="btn btn-link" onClick={() => setMore(!more)} aria-expanded={more}>
        {more ? 'Hide details' : 'Edit details'}
      </button>
      {more && (
        <>
          <label className="field">
            <span>Serving size</span>
            <input value={serving} maxLength={60} placeholder="1 cup, 1 slice, 1 bowl…" onChange={(e) => setServing(e.target.value)} />
          </label>
          <p className="muted">Numbers below are for one serving.</p>
          <NutritionFields values={nums} onChange={setNums} />
          <label className="field">
            <span>Note</span>
            <input value={notes} maxLength={500} placeholder="Optional" onChange={(e) => setNotes(e.target.value)} />
          </label>
        </>
      )}
      {isNew && (
        <label className="check-row">
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> Save to my foods so it autofills next time
        </label>
      )}

      {err && <p className="error" role="alert">{err}</p>}
      <div className="actions">
        <button type="submit" className="btn" disabled={!valid || busy}>
          {mode === 'edit' ? 'Save' : 'Add'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {mode === 'edit' && (
        <div className="actions">
          {onAgain && (
            <button type="button" className="btn btn-link" onClick={onAgain}>
              Log again now
            </button>
          )}
          <button type="button" className="btn btn-link btn-danger" onClick={onDelete}>
            Delete entry
          </button>
        </div>
      )}
    </form>
  );
}
