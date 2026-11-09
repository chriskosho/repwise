import { useState } from 'react';
import { typeLabel } from '../activities';
import { CARDIO_CHOICES, STYLE_FOR_GOAL, addDays, addWorkout, cardioTip, dayTitle, isWorkoutDay, phaseOf, planProgress, skipDay, swapDays, trainingRun, updateDay } from '../plan';
import { coolDownNote, suggestionAsRoutine } from '../suggest';
import { newRoutine, routineFromSession, sessionFromRoutine } from '../db';
import { useSuggestion } from '../useSuggestion';
import ExerciseInfo from './ExerciseInfo';
import { InfoIcon } from './Icons';
import { dayLine } from './PlanCard';

const longDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
const shortDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const MINUTES = [10, 15, 20, 30, 40, 45, 60, 75, 90];
const REST_IDEAS = [
  'Go for an easy 20 to 30 minute walk.',
  'Do some gentle stretching or mobility work.',
  'Drink water, eat enough protein and get a full night of sleep.',
  'Sore? Light movement helps more than sitting still.',
];

// One day of the plan: what it is, a preview of the workout, and what you can do about it.
export default function PlanDay({ plan, workouts, todayStr, n, unit, onBack, onGoto, onChangePlan, onStart, onSaveRoutine, onLogActivity, onStretch, onOpenWorkout }) {
  const p = planProgress(plan, workouts, todayStr);
  const day = p.days[n - 1];
  const [seed, setSeed] = useState(n);
  const [info, setInfo] = useState(null);
  const [swapTo, setSwapTo] = useState('');
  const strength = day?.k === 's';
  const suggestion = useSuggestion(unit, {
    minutes: day?.m ?? 45,
    gear: plan.gear ?? 'gym',
    focus: day?.f ?? 'full',
    style: STYLE_FOR_GOAL[plan.goal] ?? '',
    ease: !!day?.ease,
    boost: plan.boost ?? 0,
    seed,
  });
  if (!day) return null;

  const isToday = day.date === todayStr;
  const future = day.date > todayStr;
  const past = day.date < todayStr;
  const rest = day.k === 'r' || day.mv;
  const todayDay = p.today;
  const done = workouts.filter((w) => w.date === day.date);
  const change = (next) => onChangePlan(next);

  // Days you could trade places with: still to come (or today), and not already done.
  const swapChoices = p.days.filter((d) => d.n !== n && !d.done && !day.done && d.date >= todayStr);
  const swapDay = swapChoices.find((d) => String(d.n) === swapTo);
  const swapRun = swapDay ? Math.max(trainingRun(swapDays(plan, n, swapDay.n), n, workouts), trainingRun(swapDays(plan, n, swapDay.n), swapDay.n, workouts)) : 0;

  const start = async (alsoToday) => {
    if (alsoToday && todayDay && !todayDay.done && todayDay.n !== n) change(swapDays(plan, n, todayDay.n));
    onStart({ ...day }, seed);
  };

  const state = day.done ? 'Done ✓' : isToday ? 'Today' : past && isWorkoutDay(day) && !day.mv ? 'Missed' : day.mv ? 'Moved' : future ? 'Coming up' : '';

  return (
    <div>
      <div className="card editor-head">
        <button type="button" className="btn btn-ghost btn-small back" onClick={onBack}>
          ← Plan
        </button>
        <h2>{rest ? 'Rest day' : dayTitle(day)}</h2>
        <p className="muted">
          {longDate(day.date)} · Day {day.n} of {plan.length} · Week {day.week}: {phaseOf(plan, day.week)}
          {state ? ` · ${state}` : ''}
        </p>
        <div className="actions day-nav">
          <button type="button" className="btn btn-ghost btn-small" disabled={n <= 1} onClick={() => onGoto(n - 1)}>
            ← Previous day
          </button>
          <button type="button" className="btn btn-ghost btn-small" disabled={n >= plan.length} onClick={() => onGoto(n + 1)}>
            Next day →
          </button>
        </div>
      </div>

      {day.adj && <p className="plan-note">{day.adj}.</p>}

      {day.done && (
        <section className="card">
          <h3>You trained this day ✓</h3>
          <ul className="plain">
            {done.map((w) => (
              <li key={w.id}>
                <button type="button" className="btn btn-link" onClick={() => onOpenWorkout(w)}>
                  {w.isActivity ? w.activity?.name || typeLabel(w.activity?.type) : w.name || 'Workout'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {strength && !day.mv && (
        <section className="card">
          <h3>{day.ease ? 'Easy session' : 'Planned workout'}</h3>
          <p className="muted">
            About {day.m} minutes{plan.time ? ` · planned for the ${plan.time}` : ''}.{day.ease ? ' Fewer sets and lighter weights.' : ''} Suggested weights come from what you have lifted before, so they update as you get stronger.
          </p>
          {!suggestion && <p className="muted">Building your workout…</p>}
          {suggestion?.empty && <p className="muted">Nothing fits your equipment setting. Start it and add exercises yourself.</p>}
          {suggestion && !suggestion.empty && (
            <>
              <ol className="plan-list">
                {suggestion.exercises.map((e) => (
                  <li key={e.name}>
                    <div>
                      <strong>{e.name}</strong>
                      <span className="muted">
                        {e.sets} × {e.reps}
                        {e.weight ? ` @ ${e.weight} ${unit}` : ''}
                        {e.note ? ` · ${e.note}` : ''}
                      </span>
                    </div>
                    <button type="button" className="icon-btn" aria-label={`How to: ${e.name}`} onClick={() => setInfo(e.name)}>
                      <InfoIcon />
                    </button>
                  </li>
                ))}
              </ol>
              {!suggestion.exercises.some((e) => e.weight) && (
                <p className="muted">No lifting history yet, so no weights are suggested. Start light: pick a weight you can lift for every rep with 2 or 3 reps to spare. Repwise suggests weights from your next workout on.</p>
              )}
              {suggestion.stretches.length > 0 && <p className="muted">{coolDownNote(suggestion)}</p>}
            </>
          )}
          {!day.done && (
            <div className="actions">
              {(isToday || past) && (
                <button type="button" className="btn" onClick={() => start(false)}>
                  {past ? 'Do it today' : 'Start workout'}
                </button>
              )}
              {future && (
                <button type="button" className="btn" onClick={() => start(true)}>
                  Do this today instead
                </button>
              )}
              {suggestion && !suggestion.empty && (
                <button type="button" className="btn btn-ghost" onClick={() => setSeed((s) => s + 1)}>
                  Shuffle
                </button>
              )}
              {suggestion && !suggestion.empty && onSaveRoutine && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => onSaveRoutine({ ...newRoutine(), ...routineFromSession(sessionFromRoutine(suggestionAsRoutine(suggestion))), name: suggestion.title })}
                >
                  Save as routine
                </button>
              )}
            </div>
          )}
          {!day.done && future && todayDay && !todayDay.done && todayDay.n !== n && <p className="muted">That swaps it with today, so {dayLine(todayDay).toLowerCase()} moves to {shortDate(day.date)}.</p>}
        </section>
      )}

      {(day.k === 'c' || day.k === 'a') && !day.mv && (
        <section className="card">
          <h3>{day.k === 'a' ? 'Easy day' : 'Cardio'}: {typeLabel(day.t)}</h3>
          <p>{cardioTip(day.t)}</p>
          {!day.done && (
            <div className="row">
              <label className="field">
                <span>Activity</span>
                <select value={day.t} onChange={(e) => change(updateDay(plan, n, { t: e.target.value }))}>
                  {CARDIO_CHOICES.map((t) => (
                    <option key={t} value={t}>
                      {typeLabel(t)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Minutes</span>
                <select value={MINUTES.includes(day.m) ? day.m : ''} onChange={(e) => change(updateDay(plan, n, { m: Number(e.target.value) }))}>
                  {!MINUTES.includes(day.m) && <option value="">{day.m}</option>}
                  {MINUTES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {!day.done && (
            <div className="actions">
              <button type="button" className="btn" onClick={() => onStart({ ...day }, seed)}>
                Log {typeLabel(day.t).toLowerCase()}
              </button>
            </div>
          )}
          <p className="muted">Nothing is tracked by GPS. Do it any time, then enter what you did.</p>
        </section>
      )}

      {rest && !day.done && (
        <section className="card">
          <h3>Rest and recovery</h3>
          <p className="muted">Muscles grow and get stronger while you rest, so this day is part of the plan.</p>
          <ul className="tour-lines">
            {REST_IDEAS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <div className="actions">
            <button type="button" className="btn btn-ghost" onClick={() => onStretch({ preset: 'total', minutes: 10 })}>
              Stretch session…
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => onLogActivity({ type: 'walk', minutes: 30 })}>
              Log a walk · 30 min
            </button>
            {!past && (
              <button type="button" className="btn btn-ghost" onClick={() => change(addWorkout(plan, n))}>
                Add a workout here
              </button>
            )}
          </div>
        </section>
      )}

      {!day.done && !past && (
        <section className="card">
          <h3>Change this day</h3>
          {swapChoices.length > 0 && (
            <div className="form">
              <label className="field">
                <span>Swap with another day</span>
                <select value={swapTo} onChange={(e) => setSwapTo(e.target.value)}>
                  <option value="">Choose a day…</option>
                  {swapChoices.slice(0, 21).map((d) => (
                    <option key={d.n} value={d.n}>
                      {shortDate(d.date)} · {d.mv ? 'Rest day' : dayLine(d)}
                    </option>
                  ))}
                </select>
              </label>
              {swapDay && swapRun >= 4 && <p className="notice">That puts {swapRun} training days in a row. Your body may want a rest day in between.</p>}
              {swapDay && (
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => {
                    change(swapDays(plan, n, swapDay.n));
                    setSwapTo('');
                  }}
                >
                  Swap with {shortDate(swapDay.date)}
                </button>
              )}
            </div>
          )}
          {isWorkoutDay(day) && !day.mv && (
            <button
              type="button"
              className="btn btn-ghost btn-danger btn-small"
              onClick={() => window.confirm(`Skip ${shortDate(day.date)}'s workout and make it a rest day?`) && change(skipDay(plan, n))}
            >
              Skip this workout
            </button>
          )}
          <p className="muted">Repwise also moves missed workouts for you and adds rest after long streaks.</p>
        </section>
      )}

      {info && <ExerciseInfo name={info} onClose={() => setInfo(null)} />}
    </div>
  );
}

export const planDateLabel = (plan, n) => shortDate(addDays(plan.start, n - 1));
