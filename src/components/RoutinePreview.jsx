import { useState } from 'react';
import { useLibrary, findExercise, muscleLabel, exName } from '../library';
import { workSets, plural } from '../stats';
import { fmtSeconds } from '../measure';
import ExerciseInfo from './ExerciseInfo';
import { InfoIcon } from './Icons';

// The weight you last used for an exercise, if any.
export function lastWeight(name, sessions) {
  const key = (name || '').trim().toLowerCase();
  const done = (sessions ?? []).filter((s) => s.ended_at).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  for (const s of done) {
    const ex = s.exercises?.find((e) => (e.name || '').trim().toLowerCase() === key);
    const w = ex && workSets(ex).map((st) => Number(st.weight)).filter((n) => n > 0);
    if (w?.length) return w[w.length - 1];
  }
  return 0;
}

// "3 × 8", "3 × 30 s" or just "3 sets", from a routine exercise's target or its first set.
export function targetLine(e) {
  const n = e.sets?.length ?? 0;
  const first = e.sets?.[0] ?? {};
  const time = e.target?.time ?? first.time;
  const reps = e.target?.reps ?? first.reps;
  if (time) return `${n} × ${fmtSeconds(time)}`;
  if (reps) return `${n} × ${reps}`;
  return plural(n, 'set');
}

// A rough length: ~2.5 minutes per lifting set, the hold time for stretches.
export function routineMinutes(routine) {
  let sec = 0;
  for (const e of routine.exercises ?? []) {
    const n = e.sets?.length ?? 0;
    const time = Number(e.target?.time ?? e.sets?.[0]?.time ?? 0);
    sec += e.mode === 'stretch' ? n * (time || 30) * (e.notes === 'Each side' ? 2 : 1) + 10 : n * 150;
  }
  return Math.max(1, Math.round(sec / 60 / 5) * 5 || Math.round(sec / 60));
}

// Look through a routine before you add or start it. Nothing is saved until you press a button.
export default function RoutinePreview({ routine, unit = 'lb', sessions, primary, onEdit, onBack }) {
  const library = useLibrary();
  const [info, setInfo] = useState(null);
  const lib = library?.list ?? null;
  const muscles = [...new Set((routine.exercises ?? []).map((e) => muscleLabel(findExercise(lib, e.name)?.muscle)).filter(Boolean))];
  const stretch = (routine.exercises ?? []).length > 0 && routine.exercises.every((e) => e.mode === 'stretch');
  const sets = (routine.exercises ?? []).reduce((a, e) => a + (e.sets?.length ?? 0), 0);

  return (
    <div>
      <div className="card editor-head">
        <button type="button" className="btn btn-ghost btn-small back" onClick={onBack}>
          ← Back
        </button>
        <h2>{routine.name || 'Routine'}</h2>
        <p className="muted">
          {plural(routine.exercises?.length ?? 0, stretch ? 'stretch' : 'exercise', stretch ? 'stretches' : undefined)} · {plural(sets, 'set')} · about {routineMinutes(routine)} min
        </p>
        {muscles.length > 0 && <p className="muted">Works: {muscles.join(', ')}</p>}
      </div>

      <section className="card" aria-label="Exercises">
        <ol className="plan-list">
          {(routine.exercises ?? []).map((e) => {
            const w = e.mode === 'stretch' ? 0 : lastWeight(e.name, sessions);
            return (
              <li key={e.id ?? e.name}>
                <div>
                  <strong>{exName(e.name)}</strong>
                  <span className="muted">
                    {targetLine(e)}
                    {e.notes ? ` · ${e.notes}` : ''}
                    {w ? ` · last ${w} ${unit}` : ''}
                  </span>
                </div>
                <button type="button" className="icon-btn" aria-label={`How to: ${e.name}`} onClick={() => setInfo(e.name)}>
                  <InfoIcon />
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="actions">
        {primary && (
          <button type="button" className="btn" disabled={primary.disabled} onClick={primary.onClick}>
            {primary.label}
          </button>
        )}
        {onEdit && (
          <button type="button" className="btn btn-ghost" onClick={onEdit}>
            Edit
          </button>
        )}
      </div>
      {info && <ExerciseInfo name={info} onClose={() => setInfo(null)} />}
    </div>
  );
}
