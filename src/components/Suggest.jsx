import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listBodyEntries, listCustomExercises, listGoals, getProfile, routineFromSession, saveSession, sessionFromRoutine, newRoutine } from '../db';
import { useLibrary } from '../library';
import { useWorkouts } from '../workouts';
import { FEELING, FOCUS, GEAR, TIMES, coolDownNote, suggestWorkout, suggestionAsRoutine } from '../suggest';
import { typeLabel } from '../activities';
import ExerciseInfo from './ExerciseInfo';
import { InfoIcon } from './Icons';

// "I don't know what to do today": a workout built from your goals and what you've trained lately.
export default function Suggest({ unit, onClose, onStarted, onLogActivity, onSaveRoutine }) {
  const [minutes, setMinutes] = useState(45);
  const [gear, setGear] = useState('gym');
  const [focus, setFocus] = useState('auto');
  const [seed, setSeed] = useState(0);
  const [feeling, setFeeling] = useState('auto');
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  const { list: library } = useLibrary();
  const { sessions, activities, workouts } = useWorkouts();
  const custom = useLiveQuery(listCustomExercises, [], []);
  const goals = useLiveQuery(listGoals, [], []);
  const entries = useLiveQuery(listBodyEntries, [], []);
  const profile = useLiveQuery(async () => (await getProfile()) ?? null, [], null);
  const latestKg = entries?.find((e) => e.weight_kg != null)?.weight_kg ?? null; // entries are newest first

  const plan = useMemo(() => {
    if (!library || !sessions || !activities || !workouts) return null;
    return suggestWorkout({
      library,
      custom,
      sessions,
      activities,
      workouts,
      goals,
      latestKg,
      unit,
      weekStart: profile?.week_start ?? 1,
      options: { minutes, gear, focus, seed, feeling },
    });
  }, [library, custom, sessions, activities, workouts, goals, latestKg, unit, profile?.week_start, minutes, gear, focus, seed, feeling]);

  async function start() {
    setBusy(true);
    try {
      const s = sessionFromRoutine(suggestionAsRoutine(plan));
      await saveSession({ ...s, notes: coolDownNote(plan) });
      onStarted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="card editor-head">
        <button type="button" className="btn btn-ghost btn-small back" onClick={onClose}>
          ← Back
        </button>
        <h2>Suggest a workout</h2>
        <p className="muted">Built from your goals and what you've trained lately. Change anything, or shuffle for another option.</p>
      </div>

      <div className="card form">
        <div className="row">
          <label className="field">
            <span>Time</span>
            <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {TIMES.map((t) => (
                <option key={t} value={t}>
                  {t} min
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Equipment</span>
            <select value={gear} onChange={(e) => setGear(e.target.value)}>
              {GEAR.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Focus</span>
          <select value={focus} onChange={(e) => setFocus(e.target.value)}>
            {FOCUS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>How are you feeling?</span>
          <select value={feeling} onChange={(e) => setFeeling(e.target.value)}>
            {FEELING.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {plan?.recovery?.rest && feeling !== 'great' && (
        <p className="notice" role="note">
          You've worked out {plan.recovery.streak} days in a row. Consider a rest day, a walk, or some stretching instead.
        </p>
      )}

      {!plan && <p className="muted">Thinking…</p>}
      {plan && plan.empty && <p className="muted empty">Nothing fits those settings. Try a different focus or equipment.</p>}
      {plan && !plan.empty && (
        <>
          <section className="card">
            <h2>{plan.title}</h2>
            <p className="muted">About {plan.minutes} minutes</p>
            <ul className="plain why">
              {plan.reasons.map((r) => (
                <li key={r} className="muted">
                  {r}
                </li>
              ))}
            </ul>
            <ol className="plan-list">
              {plan.exercises.map((e) => (
                <li key={e.name}>
                  <div>
                    <strong>{e.name}</strong>
                    <span className="muted">
                      {e.sets} × {e.reps}
                      {e.weight ? ` @ ${e.weight} ${unit}` : ''}
                      {e.note ? ` · ${e.note}` : ''}
                    </span>
                    {e.why && <span className="muted why-line">{e.why}</span>}
                  </div>
                  <button type="button" className="icon-btn" aria-label={`How to: ${e.name}`} onClick={() => setInfo(e.name)}>
                    <InfoIcon />
                  </button>
                </li>
              ))}
            </ol>
            {plan.stretches.length > 0 && (
              <>
                <h3>Cool-down stretches</h3>
                <ul className="plan-list">
                  {plan.stretches.map((n) => (
                    <li key={n}>
                      <div>
                        <strong>{n}</strong>
                        <span className="muted">Hold 20–30 seconds</span>
                      </div>
                      <button type="button" className="icon-btn" aria-label={`How to: ${n}`} onClick={() => setInfo(n)}>
                        <InfoIcon />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="actions">
              <button type="button" className="btn" disabled={busy} onClick={start}>
                Start this workout
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setSeed((n) => n + 1)}>
                Shuffle
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => onSaveRoutine({ ...newRoutine(), ...routineFromSession(sessionFromRoutine(suggestionAsRoutine(plan))), name: plan.title })}
              >
                Save as routine
              </button>
            </div>
          </section>

          <section className="card">
            <h3>Not feeling the gym?</h3>
            <p className="muted">These count as a workout too.</p>
            <div className="actions">
              {plan.ideas.map((i) => (
                <button key={i.type} type="button" className="btn btn-ghost btn-small" onClick={() => onLogActivity(i)}>
                  {i.label} · {i.minutes} min
                </button>
              ))}
            </div>
          </section>
        </>
      )}
      {info && <ExerciseInfo name={info} onClose={() => setInfo(null)} />}
    </div>
  );
}
