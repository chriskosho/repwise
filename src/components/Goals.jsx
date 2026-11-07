import { useState } from 'react';
import { deleteGoal, saveGoal } from '../db';
import { GOAL_TYPES, bestForExercise, goalStatus } from '../goals';
import { historyNames } from '../library';
import { weightIn, weightOut } from '../units';

function describe(goal, status, unit) {
  if (goal.type === 'weekly_workouts') {
    const streak = status.streak > 0 ? ` · ${status.streak}-week streak` : '';
    return `${goal.target} workout${goal.target === 1 ? '' : 's'} a week: ${status.done} so far this week${streak}`;
  }
  if (goal.type === 'body_weight') {
    const now = status.current != null ? `now ${weightOut(status.current, unit)}` : 'no weigh-in yet';
    return `Reach ${weightOut(goal.target, unit)} ${unit}: ${now}`;
  }
  const what = goal.metric === 'e1rm' ? 'estimated 1RM' : 'top weight';
  const now = status.current != null ? `best so far ${Math.round(status.current * 10) / 10}` : 'not logged yet';
  return `${goal.exercise} ${what} of ${goal.target} ${unit}: ${now}`;
}

function GoalCard({ goal, status, unit }) {
  const [confirm, setConfirm] = useState(false);
  const title = GOAL_TYPES.find(([t]) => t === goal.type)?.[1] ?? 'Goal';
  const pct = Math.round(status.pct * 100);
  return (
    <div className="goal">
      <div className="goal-top">
        <strong>{title}</strong>
        {status.reached && <span className="badge">Reached</span>}
      </div>
      <p className="muted goal-text">{describe(goal, status, unit)}</p>
      {goal.notes && <p className="notes">{goal.notes}</p>}
      <div className="bar" role="progressbar" aria-label={`${title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="goal-foot">
        <span className="muted">{pct}%</span>
        {confirm ? (
          <span className="actions">
            <button type="button" className="btn btn-small btn-danger" onClick={() => deleteGoal(goal.id)}>
              Yes, remove
            </button>
            <button type="button" className="btn btn-small btn-ghost" onClick={() => setConfirm(false)}>
              Keep
            </button>
          </span>
        ) : (
          <button type="button" className="btn btn-small btn-ghost" onClick={() => setConfirm(true)} aria-label={`Remove goal: ${title}`}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

function GoalForm({ unit, sessions, latestKg, onDone }) {
  const [type, setType] = useState('weekly_workouts');
  const [target, setTarget] = useState('3');
  const [exercise, setExercise] = useState('');
  const [metric, setMetric] = useState('weight');
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const names = historyNames(sessions);

  async function submit(e) {
    e.preventDefault();
    setError('');
    const n = Number(target);
    if (!(n > 0)) return setError('Enter a target above zero.');
    try {
      if (type === 'weekly_workouts') {
        if (!Number.isInteger(n) || n > 14) return setError('Choose a whole number of workouts, up to 14.');
        await saveGoal({ type, target: n, notes });
      } else if (type === 'body_weight') {
        if (latestKg == null) return setError('Log your weight first, so there is a starting point.');
        await saveGoal({ type, target: weightIn(n, unit), start_value: latestKg, notes });
      } else {
        if (!exercise.trim()) return setError('Pick an exercise.');
        await saveGoal({ type, exercise, metric, target: n, start_value: bestForExercise(sessions, exercise, metric) ?? 0, notes });
      }
      onDone();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="form menu" onSubmit={submit}>
      <label className="field">
        <span>Goal type</span>
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setTarget(e.target.value === 'weekly_workouts' ? '3' : '');
            setError('');
          }}
        >
          {GOAL_TYPES.map(([t, label]) => (
            <option key={t} value={t}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {type === 'lift' && (
        <>
          <label className="field">
            <span>Exercise</span>
            <input list="goal-exercises" value={exercise} onChange={(e) => setExercise(e.target.value)} maxLength={100} />
            <datalist id="goal-exercises">
              {names.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span>Measure</span>
            <select value={metric} onChange={(e) => setMetric(e.target.value)}>
              <option value="weight">Top weight</option>
              <option value="e1rm">Estimated 1RM</option>
            </select>
          </label>
        </>
      )}

      <label className="field">
        <span>{type === 'weekly_workouts' ? 'Workouts per week' : type === 'body_weight' ? `Target weight (${unit})` : `Target (${unit})`}</span>
        <input type="number" inputMode="decimal" step="any" min="0" value={target} onChange={(e) => setTarget(e.target.value)} required />
      </label>
      <label className="field">
        <span>Notes (optional)</span>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Why this goal, a deadline…" />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="btn">
          Add goal
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function Goals({ goals, sessions, workouts, entries, profile, unit, latestKg }) {
  const [adding, setAdding] = useState(false);
  const ctx = { sessions, workouts, entries, weekStart: profile?.week_start ?? 1, latestKg };
  return (
    <section className="card">
      <div className="section-head">
        <h2>Goals</h2>
        {!adding && (
          <button type="button" className="btn btn-small" onClick={() => setAdding(true)}>
            Add goal
          </button>
        )}
      </div>
      {adding && <GoalForm unit={unit} sessions={sessions} latestKg={latestKg} onDone={() => setAdding(false)} />}
      {!goals.length && !adding && <p className="muted empty">Set a goal, like three workouts a week or a target weight.</p>}
      {goals.map((g) => (
        <GoalCard key={g.id} goal={g} status={goalStatus(g, ctx)} unit={unit} />
      ))}
    </section>
  );
}
