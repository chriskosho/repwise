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
  saveRoutine,
  saveSession,
  sessionFromRoutine,
  today,
} from '../db';
import { typeLabel } from '../activities';
import { fmtDuration, fmtVolume, plural } from '../stats';
import { fmtCardioTime, fmtSeconds, kmToLong, longUnit, paceFromMinPerKm } from '../measure';
import { useWorkouts } from '../workouts';
import { useLibrary } from '../library';
import { regionLabel, workoutPlan } from '../stretches';
import WorkoutEditor from './WorkoutEditor';
import PlanCard from './PlanCard';
import StarterRoutines from './StarterRoutines';
import RoutinePreview from './RoutinePreview';
import TodayCard from './TodayCard';
import { LogSheet, StartSheet } from './HomeSheets';
import { routineFromStarter } from '../starterRoutines';
import { planProgress } from '../plan';
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

function RoutineCard({ routine, onStart, onEdit, onPreview }) {
  const sets = routine.exercises.reduce((a, e) => a + e.sets.length, 0);
  return (
    <div className="card routine">
      <button type="button" className="routine-open" aria-label={`View ${routine.name}`} onClick={() => onPreview(routine)}>
        <span className="routine-top">
          <strong className="routine-name">{routine.name}</strong>
          <span className="muted">
            {plural(routine.exercises.length, 'exercise')} · {plural(sets, 'set')}
          </span>
        </span>
        <span className="routine-list">{routine.exercises.map((e) => e.name).join(' · ')}</span>
      </button>
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

// Your routines and the ready-made ones, off the home screen so home stays about today.
function RoutinesScreen({ routines, onBack, onStart, onEdit, onNew, onPreview, onPreviewStarter }) {
  return (
    <div>
      <div className="card editor-head">
        <button type="button" className="btn btn-ghost btn-small back" onClick={onBack}>
          ← Back
        </button>
        <h2>Routines</h2>
        <p className="muted">Save a workout you repeat and start it with one tap.</p>
        <button type="button" className="btn btn-block" onClick={onNew}>
          + New routine
        </button>
      </div>
      {routines.map((r) => (
        <RoutineCard key={r.id} routine={r} onStart={onStart} onEdit={onEdit} onPreview={onPreview} />
      ))}
      <StarterRoutines routines={routines} defaultOpen onPreview={onPreviewStarter} />
    </div>
  );
}

export default function WorkoutTab({ unit, name, weekStart = 1, onOpenSession, onOpenRoutine, onShowHistory, onLogActivity, onStretch, onOpenActivity, onSuggest, plan = null, hasOnboarding = false, onContinue, onOpenReview, onPlanDo, onPlanView, onPlanDay, onNewPlan, onEndPlan, onDismissOffer, routinesOpen = false, onRoutinesOpen = () => {} }) {
  const active = useLiveQuery(getActiveSession, [], undefined);
  const { sessions, activities, places, workouts } = useWorkouts();
  const routines = useLiveQuery(listRoutines, [], undefined);
  const [summary, setSummary] = useState(null);
  const [reviewHidden, setReviewHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(null); // 'start' | 'log'
  const [preview, setPreview] = useState(null); // { routine, starter } while looking at a routine
  const showRoutines = routinesOpen;
  const setShowRoutines = onRoutinesOpen;

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

  if (showRoutines && !active && preview) {
    const back = () => setPreview(null);
    return preview.starter ? (
      <RoutinePreview
        routine={preview.routine}
        unit={unit}
        sessions={sessions}
        onBack={back}
        primary={{
          label: routines.some((r) => (r.name || '').trim().toLowerCase() === preview.routine.name.toLowerCase()) ? 'Added' : 'Add to my routines',
          disabled: routines.some((r) => (r.name || '').trim().toLowerCase() === preview.routine.name.toLowerCase()),
          onClick: async () => {
            await saveRoutine(preview.routine);
            back();
          },
        }}
      />
    ) : (
      <RoutinePreview
        routine={preview.routine}
        unit={unit}
        sessions={sessions}
        onBack={back}
        primary={{
          label: `Start ${preview.routine.name}`,
          onClick: () => {
            setPreview(null);
            setShowRoutines(false);
            start(preview.routine);
          },
        }}
        onEdit={() => {
          setPreview(null);
          onOpenRoutine(preview.routine, false);
        }}
      />
    );
  }
  if (showRoutines && !active) {
    return (
      <RoutinesScreen
        onPreview={(r) => setPreview({ routine: r, starter: false })}
        onPreviewStarter={(st) => setPreview({ routine: routineFromStarter(st), starter: true })}
        routines={routines}
        onBack={() => setShowRoutines(false)}
        onStart={(r) => {
          setShowRoutines(false);
          start(r);
        }}
        onEdit={(x) => onOpenRoutine(x, false)}
        onNew={() => onOpenRoutine(newRoutine(), true)}
      />
    );
  }
  if (active) {
    return <WorkoutEditor key={active.id} initial={active} mode="active" sessions={sessions} unit={unit} onFinish={setSummary} onSaveRoutine={(doc) => onOpenRoutine(doc, true)} />;
  }

  async function start(routine) {
    setSheet(null);
    setBusy(true);
    try {
      await saveSession(routine ? sessionFromRoutine(routine) : newSession());
    } finally {
      setBusy(false);
    }
  }

  async function logPast() {
    setSheet(null);
    const s = newSession({ finished: true });
    await saveSession(s);
    onOpenSession(s.id);
  }

  // One line for the most recent thing you did, unless the main card already says it.
  const lastSession = sessions.find((s) => s.ended_at && s.exercises?.length) ?? null;
  const planActive = plan && planProgress(plan, workouts, today()).status === 'active';
  const newest = workouts[0] ?? null;
  const latest = newest && !(newest.id === lastSession?.id && !planActive) ? newest : null;
  let dismissed = '';
  try {
    dismissed = localStorage.getItem('repwise.reviewDismissed') ?? '';
  } catch {
    /* ignore */
  }
  const showReview = !reviewHidden && showReviewCard(today(), weekStart) && dismissed !== reviewPeriod(today(), weekStart).start;

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
      {plan && planProgress(plan, workouts, today()).status !== 'active' && (
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
      <TodayCard
        unit={unit}
        plan={plan}
        workouts={workouts}
        sessions={sessions}
        routines={routines}
        todayStr={today()}
        onPreviewPlanned={onPlanDo}
        onPlanDo={onPlanDo}
        onViewPlan={onPlanView}
        onViewDay={onPlanDay}
        onStretch={onStretch}
        onChooser={() => setSheet('start')}
        onLog={() => setSheet('log')}
      />
      {sheet === 'start' && (
        <StartSheet
          routines={routines}
          onRoutine={start}
          onStarter={(st) => start(routineFromStarter(st))}
          onSuggest={() => {
            setSheet(null);
            onSuggest();
          }}
          onEmpty={() => start(null)}
          onStretch={() => {
            setSheet(null);
            onStretch();
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'log' && (
        <LogSheet
          onPast={logPast}
          onActivity={() => {
            setSheet(null);
            onLogActivity();
          }}
          onStretch={() => {
            setSheet(null);
            onStretch();
          }}
          onClose={() => setSheet(null)}
        />
      )}

      <button type="button" data-tour="routines" className="home-row" onClick={() => setShowRoutines(true)}>
        <span>Routines{routines.length ? ` (${routines.length})` : ''}</span>
        <span aria-hidden="true">›</span>
      </button>
      {latest && (
        <button type="button" className="home-row" onClick={() => (latest.isActivity ? onOpenActivity(latest.activity) : onOpenSession(latest.id))}>
          <span>
            Last: {latest.isActivity ? latest.activity.title || typeLabel(latest.activity.type) : latest.name || 'Workout'} · {new Date(`${latest.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}
          </span>
          <span aria-hidden="true">›</span>
        </button>
      )}
    </div>
  );
}
