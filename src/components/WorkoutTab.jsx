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
} from '../db';
import { fmtDuration, fmtVolume } from '../stats';
import SessionCard from './SessionCard';
import WorkoutEditor from './WorkoutEditor';

function Summary({ info, unit, onDone, onSaveRoutine }) {
  const { session, stats, prs } = info;
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
      </div>
      {prs.length > 0 && (
        <>
          <h3>Personal records</h3>
          <ul className="pr-list">
            {prs.map((p) => (
              <li key={p.name}>
                <strong>{p.name}</strong>
                <span className="muted">
                  {[p.weight && `Heaviest ${p.weight} ${unit}`, p.orm && `Est. 1RM ${p.orm} ${unit}`].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </>
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
  const shown = routine.exercises.slice(0, 4);
  const more = routine.exercises.length - shown.length;
  return (
    <div className="card routine">
      <strong>{routine.name}</strong>
      <ul className="session-lines">
        {shown.map((e) => (
          <li key={e.id}>
            <span>{e.name}</span>
            <span className="muted">
              {e.sets.length} set{e.sets.length === 1 ? '' : 's'}
            </span>
          </li>
        ))}
        {more > 0 && <li className="muted">+{more} more</li>}
      </ul>
      <div className="actions">
        <button type="button" className="btn" onClick={() => onStart(routine)}>
          Start {routine.name}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => onEdit(routine)}>
          Edit
        </button>
      </div>
    </div>
  );
}

export default function WorkoutTab({ unit, onOpenSession, onOpenRoutine }) {
  const active = useLiveQuery(getActiveSession, [], undefined);
  const sessions = useLiveQuery(listSessions, [], undefined);
  const routines = useLiveQuery(listRoutines, [], undefined);
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);

  if (summary) {
    return (
      <Summary
        info={summary}
        unit={unit}
        onDone={() => setSummary(null)}
        onSaveRoutine={(doc) => onOpenRoutine(doc, true)}
      />
    );
  }
  if (active === undefined || sessions === undefined || routines === undefined) return <p className="muted">Loading…</p>;

  if (active) {
    return <WorkoutEditor key={active.id} initial={active} mode="active" sessions={sessions} unit={unit} onFinish={setSummary} />;
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

  const recent = sessions.filter((s) => s.ended_at).slice(0, 3);

  return (
    <div>
      <div className="card start">
        <h2>Workout</h2>
        <p className="muted">Start an empty workout and add exercises as you go. Your last numbers show up next to each set.</p>
        <div className="actions">
          <button type="button" className="btn btn-big" disabled={busy} onClick={() => start(null)}>
            Start workout
          </button>
          <button type="button" className="btn btn-ghost" onClick={logPast}>
            Log a past workout
          </button>
        </div>
      </div>

      <div className="section-head">
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
          <h3>Recent</h3>
          {recent.map((s) => (
            <SessionCard key={s.id} session={s} unit={unit} onOpen={(x) => onOpenSession(x.id)} />
          ))}
        </>
      )}
    </div>
  );
}
