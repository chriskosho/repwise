import { useState } from 'react';
import { newActivity, routineFromSession, saveActivity, saveProfile, saveSession, sessionFromRoutine } from '../db';
import { STYLE_FOR_GOAL, ackWelcome, dayTitle, isWorkoutDay, planNote, planProgress, resumePlan, welcomeBack } from '../plan';
import { coolDownNote, suggestionAsRoutine } from '../suggest';
import { useSuggestion } from '../useSuggestion';
import { typeLabel } from '../activities';
import { dayLine } from './PlanCard';

const dowName = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
const longDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

// The options the Suggest screen uses for a plan day. Both places must agree, so the workout
// you start straight from home is the same one "Preview or change" shows.
export function planPreset(plan, day, seed = 0) {
  return { minutes: day.m, gear: plan.gear ?? 'gym', focus: day.f ?? 'auto', seed, feeling: 'auto', style: STYLE_FOR_GOAL[plan.goal] ?? '', ease: !!day.ease, boost: plan.boost ?? 0, level: plan.level ?? '' };
}

// What the big button does right now. Pure, so every case is easy to test.
export function mainAction({ plan, progress, lastSession, routines = [] }) {
  if (plan && progress?.status === 'active') {
    const t = progress.today;
    const rest = t.k === 'r' || t.mv;
    if (t.done && isWorkoutDay(t)) return { kind: 'done' };
    if (rest) return { kind: 'rest' };
    if (t.k === 's') return { kind: 'planned', day: t };
    return { kind: 'cardio', day: t };
  }
  if (lastSession) {
    const routine = routines.find((r) => (r.name || '').trim().toLowerCase() === (lastSession.name || '').trim().toLowerCase());
    return { kind: 'repeat', session: lastSession, routine: routine ?? null };
  }
  return { kind: 'new' };
}

// Home: one card that says what today is and offers the one thing you most likely want.
export default function TodayCard({ unit, plan, workouts, sessions, routines, todayStr, onPreviewPlanned, onPlanDo, onViewPlan, onViewDay, onStretch, onChooser, onLog, onOpenActivity = () => {}, onNewPlan = () => {} }) {
  const progress = plan ? planProgress(plan, workouts, todayStr) : null;
  const lastSession = sessions.find((s) => s.ended_at && s.exercises?.length) ?? null;
  const action = mainAction({ plan, progress, lastSession, routines });
  const suggestion = useSuggestion(unit, action.kind === 'planned' ? planPreset(plan, action.day) : { minutes: 30 });
  const [busy, setBusy] = useState(false);
  const [logged, setLogged] = useState(null); // the activity just saved from the big button
  const back = progress?.status === 'active' ? welcomeBack(plan, workouts, todayStr) : null;

  // One tap: save today's planned activity as planned. Details can be added after.
  async function quickLog(day) {
    setBusy(true);
    try {
      const doc = { ...newActivity(todayStr), type: day.t, duration_min: day.m };
      await saveActivity(doc);
      setLogged(doc);
    } finally {
      setBusy(false);
    }
  }

  async function begin(make) {
    setBusy(true);
    try {
      await saveSession(make());
    } finally {
      setBusy(false);
    }
  }

  let status = null;
  let main = null;
  let alt = null;
  switch (action.kind) {
    case 'planned':
      status = `Today: ${dayLine(action.day)}`;
      main = (
        <button type="button" data-tour="start" className="btn btn-big btn-block" disabled={busy || !suggestion} onClick={() => begin(() => ({ ...sessionFromRoutine(suggestionAsRoutine(suggestion)), notes: coolDownNote(suggestion) }))}>
          Start {dayTitle(action.day).toLowerCase()} workout
        </button>
      );
      alt = (
        <button type="button" className="btn btn-link btn-small" onClick={() => onPreviewPlanned(action.day)}>
          Preview or change it first
        </button>
      );
      break;
    case 'cardio':
      status = `Today: ${dayLine(action.day)}`;
      main = (
        <button type="button" data-tour="start" className="btn btn-big btn-block" disabled={busy} onClick={() => quickLog(action.day)}>
          Log {typeLabel(action.day.t).toLowerCase()} · {action.day.m} min
        </button>
      );
      alt = (
        <div className="today-alt">
          <button type="button" className="btn btn-link btn-small" onClick={() => onPlanDo(action.day)}>
            Add details
          </button>
          {action.day.k === 'a' && (
            <button type="button" className="btn btn-link btn-small" onClick={() => onStretch({ preset: 'recent', minutes: 10 })}>
              Stretch instead
            </button>
          )}
        </div>
      );
      break;
    case 'rest':
      status = 'Today: rest day';
      main = (
        <button type="button" data-tour="start" className="btn btn-big btn-block" onClick={() => onStretch({ preset: 'recent', minutes: 10 })}>
          Stretch · 10 min
        </button>
      );
      break;
    case 'done':
      status = 'Today: done ✓';
      if (logged)
        alt = (
          <p className="today-logged">
            {typeLabel(logged.type)} · {logged.duration_min} min logged.{' '}
            <button type="button" className="btn btn-link btn-small" onClick={() => onOpenActivity(logged)}>
              Add details
            </button>
          </p>
        );
      break;
    case 'repeat': {
      const r = action.routine;
      status = `Last time: ${action.session.name || 'workout'} · ${dowName(action.session.date)}`;
      main = (
        <button type="button" data-tour="start" className="btn btn-big btn-block" disabled={busy} onClick={() => begin(() => sessionFromRoutine(r ?? routineFromSession(action.session)))}>
          {r ? `Start ${r.name}` : `Repeat ${action.session.name || 'last workout'}`}
        </button>
      );
      break;
    }
    default:
      status = 'Ready to train?';
      main = (
        <button type="button" data-tour="start" className="btn btn-big btn-block" onClick={onChooser}>
          Start workout
        </button>
      );
  }

  const t = progress?.status === 'active' ? progress.today : null;
  const note = t ? planNote(plan, todayStr) : null;

  if (back) {
    return (
      <section className="hero today welcome" aria-label="Today">
        <h2 className="today-headline">Welcome back</h2>
        <p className="today-sub">
          It's been {back.away} days. Pick up your plan where it suits you.
        </p>
        <button type="button" className="btn btn-big btn-block" disabled={busy} onClick={() => saveProfile({ plan: resumePlan(plan, workouts, todayStr) })}>
          Resume from today
        </button>
        <div className="today-links">
          <button type="button" className="btn btn-link" onClick={onNewPlan}>
            Start a fresh plan
          </button>
          <button type="button" className="btn btn-link" onClick={() => saveProfile({ plan: ackWelcome(plan, back.lastDate) })}>
            Carry on as is
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="hero today" aria-label="Today">
      <h2 className="today-headline">{status}</h2>
      {note && (
        <p className="plan-note" role="note">
          {note}
        </p>
      )}
      {main}
      {alt}
      {progress?.catchUp && action.kind !== 'planned' && (
        <p className="plan-catchup">
          You skipped {dowName(progress.catchUp.date)}'s {progress.catchUp.k === 'c' ? 'cardio' : dayTitle(progress.catchUp).toLowerCase()} workout.{' '}
          <button type="button" className="btn btn-link" onClick={() => (progress.catchUp.k === 's' ? onPreviewPlanned(progress.catchUp) : onPlanDo(progress.catchUp))}>
            Do it today
          </button>
        </p>
      )}
      <div className="today-links">
        {action.kind !== 'new' && (
          <button type="button" data-tour="suggest" className="btn btn-link" onClick={onChooser}>
            {action.kind === 'done' || action.kind === 'rest' ? 'Train anyway' : 'Something else'}
          </button>
        )}
        <button type="button" data-tour="activity" className="btn btn-link" onClick={onLog}>
          Log
        </button>
      </div>
      {t && (
        <div data-tour="plan" className="today-plan">
          <ol className="week-strip" aria-label="This week">
            {progress.days
              .filter((d) => d.week === progress.week)
              .map((d) => {
                const rest = d.k === 'r' || d.mv;
                const mark = d.done ? '✓' : rest ? '–' : d.k === 'c' ? '♥' : d.k === 'a' ? '○' : '●';
                return (
                  <li key={d.n}>
                    <button
                      type="button"
                      className={`wk-day${d.date === todayStr ? ' today' : ''}${d.done ? ' done' : ''}${rest ? ' rest' : ''}`}
                      aria-label={`${longDate(d.date)}: ${d.done ? 'done' : rest ? 'rest day' : dayLine(d)}`}
                      onClick={() => onViewDay(d.n)}
                    >
                      <span>{dowName(d.date).slice(0, 3)}</span>
                      <strong>{mark}</strong>
                    </button>
                  </li>
                );
              })}
          </ol>
          <button type="button" className="btn btn-link btn-small today-plan-link" onClick={onViewPlan}>
            Day {progress.dayNumber} of {plan.length} · View plan
          </button>
        </div>
      )}
    </section>
  );
}
