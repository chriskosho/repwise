import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  getActiveSession,
  getSession,
  listRoutines,
  listSessions,
  newRoutine,
  newSession,
  routineFromSession,
  saveSession,
  sessionFromRoutine,
  today,
} from '../db';
import { fmtDuration, fmtVolume, plural } from '../stats';
import { fmtCardioTime, fmtSeconds, kmToLong, longUnit, paceFromMinPerKm } from '../measure';
import { weekStartOf } from '../goals';
import SessionCard from './SessionCard';
import ActivityCard from './ActivityCard';
import { useWorkouts } from '../workouts';
import { useLibrary } from '../library';
import { regionLabel, workoutPlan } from '../stretches';
import WorkoutEditor from './WorkoutEditor';
import PlanCard from './PlanCard';
import { ReviewCard } from './Review';
import { reviewPeriod, showReviewCard } from '../review';

function Summary({ info, unit, onDone, onSaveRoutine, onStretch }) {
  const { session, stats, prs } = info;
  const { list: library } = useLibrary();
  const plan = library ? workoutPlan(session, library) : null;
  return (
    <div className="card">
      <h2>Workout complete</h2>
      <p className="muted">{session.name}</p>
      <div className="stats">
        <div>
          <span className="stat-label">Duration</span>
          <strong>{stats.minutes >= 1 ? fmtDuration(stats.minutes) : '< 1 min'}</strong>
        </div>
        <div>
          <span className="stat-label">Volume</span>
          <strong>
            {fmtVolume(stats.volume)} {unit}
          </strong>
        </div>
        <div>
          <span className="stat-label">Sets</span>
          <strong>{stats.sets}</strong>
        </div>
        {stats.cardioSec > 0 && (
          <div>
            <span className="stat-label">Cardio</span>
            <strong>{fmtCardioTime(stats.cardioSec)}</strong>
          </div>
        )}
        {stats.km > 0 && (
          <div>
            <span className="stat-label">Distance</span>
            <strong>
              {Math.round(kmToLong(stats.km, unit) * 100) / 100} {longUnit(unit)}
            </strong>
          </div>
        )}
      </div>
      {prs.length > 0 && (
        <>
          <h3>Personal records</h3>
          <ul className="pr-list">
            {prs.map((p) => (
              <li key={p.name}>
                <strong>{p.name}</strong>
                <span className="muted">
                  {[
                    p.weight && `Heaviest ${p.weight} ${unit}`,
                    p.orm && `Est. 1RM ${p.orm} ${unit}`,
                    p.reps && `Most reps: ${p.reps}${p.repsWeight ? ` (+${p.repsWeight} ${unit})` : ''}`,
                    p.time && `Longest hold: ${fmtSeconds(p.time)}`,
                    p.distance && `Longest: ${Math.round(kmToLong(p.distance, unit) * 100) / 100} ${longUnit(unit)}`,
                    p.pace && `Best ${/bicycl|bike|row|skat|ellip/i.test(p.name) ? 'speed' : 'pace'}: ${paceFromMinPerKm(p.name, p.pace, unit)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {plan?.regions.length > 0 && onStretch && (
        <div className="stretch-offer">
          <h3>Stretch what you just trained</h3>
          <p className="muted">
            {plan.regions.map(regionLabel).join(', ')} · about {plan.minutes} min
          </p>
          <button type="button" className="btn btn-block" onClick={() => onStretch({ preset: 'workout', minutes: plan.minutes, focus: plan })}>
            Stretch now
          </button>
        </div>
      )}
      <div className="actions">
        <button type="button" className="btn" onClick={onDone}>
          Done
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => onSaveRoutine(routineFromSession(session))}>
          Save as routine
        </button>
      </div>
    </div>
  );
}

// Opens a finished workout for changes (from History or Recent).
export function EditSession({ id, unit, onClose, onSaveRoutine }) {
  const [row, setRow] = useState(undefined);
  const sessions = useLiveQuery(listSessions, [], undefined);

  useEffect(() => {
    let on = true;
    getSession(id).then((r) => on && setRow(r));
    return () => {
      on = false;
    };
  }, [id]);

  if (row === undefined || sessions === undefined) return <p className="muted">Loading…</p>;
  if (row === null) {
    return (
      <div className="card">
        <p className="muted">That workout no longer exists.</p>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Back
        </button>
      </div>
    );
  }
  return (
    <WorkoutEditor key={row.id} initial={row} mode="edit" sessions={sessions} unit={unit} onClose={onClose} onSaveRoutine={onSaveRoutine} />
  );
}

function RoutineCard({ routine, onStart, onEdit }) {
  const sets = routine.exercises.reduce((a, e) => a + e.sets.length, 0);
  return (
    <div className="card routine">
      <div className="routine-top">
        <strong className="routine-name">{routine.name}</strong>
        <span className="muted">
          {plural(routine.exercises.length, 'exercise')} · {plural(sets, 'set')}
        </span>
      </div>
      <p className="routine-list">{routine.exercises.map((e) => e.name).join(' · ')}</p>
      <div className="routine-actions">
        <button type="button" className="btn btn-small" onClick={() => onStart(routine)}>
          Start {routine.name}
        </button>
        <button type="button" className="btn btn-ghost btn-small" onClick={() => onEdit(routine)}>
          Edit
        </button>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function WorkoutTab({ unit, name, weekStart = 1, onOpenSession, onOpenRoutine, onShowHistory, onLogActivity, onStretch, onOpenActivity, onSuggest, plan = null, hasOnboarding = false, onContinue, onOpenReview, onPlanDo, onPlanView, onPlanDay, onNewPlan, onEndPlan, onDismissOffer }) {
  const active = useLiveQuery(getActiveSession, [], undefined);
  const { sessions, activities, places, workouts } = useWorkouts();
  const routines = useLiveQuery(listRoutines, [], undefined);
  const [summary, setSummary] = useState(null);
  const [reviewHidden, setReviewHidden] = useState(false);
  const [busy, setBusy] = useState(false);

  if (summary) {
    return (
      <Summary
        info={summary}
        unit={unit}
        onDone={() => setSummary(null)}
        onSaveRoutine={(doc) => onOpenRoutine(doc, true)}
        onStretch={(o) => {
          setSummary(null);
          onStretch(o);
        }}
      />
    );
  }
  if (active === undefined || !workouts || routines === undefined) return <p className="muted">Loading…</p>;

  if (active) {
    return <WorkoutEditor key={active.id} initial={active} mode="active" sessions={sessions} unit={unit} onFinish={setSummary} onSaveRoutine={(doc) => onOpenRoutine(doc, true)} />;
  }

  async function start(routine) {
    setBusy(true);
    try {
      await saveSession(routine ? sessionFromRoutine(routine) : newSession());
    } finally {
      setBusy(false);
    }
  }

  async function logPast() {
    const s = newSession({ finished: true });
    await saveSession(s);
    onOpenSession(s.id);
  }

  const recent = workouts.slice(0, 2);
  const placeName = (id) => places.find((p) => p.id === id)?.name;
  let dismissed = '';
  try {
    dismissed = localStorage.getItem('repwise.reviewDismissed') ?? '';
  } catch {
    /* ignore */
  }
  const showReview = !reviewHidden && showReviewCard(today(), weekStart) && dismissed !== reviewPeriod(today(), weekStart).start;
  const weekFrom = weekStartOf(today(), weekStart);
  const thisWeek = workouts.filter((s) => s.date >= weekFrom).length;

  return (
    <div>
      {showReview && (
        <ReviewCard
          workouts={workouts}
          todayStr={today()}
          weekStart={weekStart}
          onOpen={onOpenReview}
          onDismiss={() => {
            try {
              localStorage.setItem('repwise.reviewDismissed', reviewPeriod(today(), weekStart).start);
            } catch {
              /* ignore */
            }
            setReviewHidden(true);
          }}
        />
      )}
      {plan && (
        <PlanCard plan={plan} workouts={workouts} todayStr={today()} onDo={onPlanDo} onViewPlan={onPlanView} onViewDay={onPlanDay} onNewPlan={onNewPlan} onEndPlan={onEndPlan} onSuggest={onSuggest} onContinue={onContinue} />
      )}
      {!plan && !hasOnboarding && workouts.length > 0 && (
        <section className="card" aria-label="Starter plans">
          <h3>New: starter plans</h3>
          <p className="muted">Answer a few questions and get a 7, 21, 30 or 60 day plan with workouts, cardio and rest days.</p>
          <div className="actions">
            <button type="button" className="btn btn-small" onClick={onNewPlan}>
              Build my plan
            </button>
            <button type="button" className="btn btn-small btn-ghost" onClick={onDismissOffer}>
              Not now
            </button>
          </div>
        </section>
      )}
      <section className="hero">
        <h2 className="hero-title">
          {greeting()}
          {name ? `, ${name}` : ''}
        </h2>
        <p className="muted">
          {thisWeek ? `${plural(thisWeek, 'workout')} this week. Keep it going.` : 'No workouts yet this week.'}
        </p>
        <button type="button" data-tour="start" className="btn btn-big btn-block" disabled={busy} onClick={() => start(null)}>
          Start workout
        </button>
        <button type="button" data-tour="suggest" className="btn btn-ghost btn-block" onClick={onSuggest}>
          Not sure what to do? Suggest a workout
        </button>
        <button type="button" className="btn btn-link" onClick={logPast}>
          Log a past workout
        </button>
        <button type="button" data-tour="activity" className="btn btn-link" onClick={onLogActivity}>
          Log an activity (run, sport…)
        </button>
        <button type="button" className="btn btn-link" onClick={() => onStretch()}>
          Stretch
        </button>
      </section>

      <div className="section-head" data-tour="routines">
        <h3>Routines</h3>
        <button type="button" className="btn btn-ghost btn-small" onClick={() => onOpenRoutine(newRoutine(), true)}>
          + New routine
        </button>
      </div>
      {routines.length === 0 && (
        <p className="muted routine-empty">
          Save a workout you do often as a routine and start it with one tap. Create one here, or tap “Save as routine” after a workout.
        </p>
      )}
      {routines.map((r) => (
        <RoutineCard key={r.id} routine={r} onStart={start} onEdit={(x) => onOpenRoutine(x, false)} />
      ))}

      {recent.length > 0 && (
        <>
          <div className="section-head">
            <h3>Recent</h3>
            {workouts.length > recent.length && (
              <button type="button" className="btn btn-link btn-small" onClick={onShowHistory}>
                See all
              </button>
            )}
          </div>
          {recent.map((s) =>
            s.isActivity ? (
              <ActivityCard key={s.id} activity={s.activity} unit={unit} placeName={placeName(s.activity.place_id)} onOpen={onOpenActivity} />
            ) : (
              <SessionCard key={s.id} session={s} unit={unit} placeName={placeName(s.place_id)} onOpen={(x) => onOpenSession(x.id)} />
            ),
          )}
          <button type="button" className="btn btn-link" onClick={onOpenReview}>
            Weekly review
          </button>
        </>
      )}
    </div>
  );
}
