import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getActiveSession, getSession, listSessions, newSession, saveSession } from '../db';
import { fmtDuration, fmtVolume } from '../stats';
import SessionCard from './SessionCard';
import WorkoutEditor from './WorkoutEditor';

function Summary({ info, unit, onDone }) {
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
      <button type="button" className="btn" onClick={onDone}>
        Done
      </button>
    </div>
  );
}

// Opens a finished workout for changes (from History or Recent).
export function EditSession({ id, unit, onClose }) {
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
  return <WorkoutEditor key={row.id} initial={row} mode="edit" sessions={sessions} unit={unit} onClose={onClose} />;
}

export default function WorkoutTab({ unit, onOpenSession }) {
  const active = useLiveQuery(getActiveSession, [], undefined);
  const sessions = useLiveQuery(listSessions, [], undefined);
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);

  if (summary) return <Summary info={summary} unit={unit} onDone={() => setSummary(null)} />;
  if (active === undefined || sessions === undefined) return <p className="muted">Loading…</p>;

  if (active) {
    return <WorkoutEditor key={active.id} initial={active} mode="active" sessions={sessions} unit={unit} onFinish={setSummary} />;
  }

  async function start() {
    setBusy(true);
    try {
      await saveSession(newSession());
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
          <button type="button" className="btn btn-big" disabled={busy} onClick={start}>
            Start workout
          </button>
          <button type="button" className="btn btn-ghost" onClick={logPast}>
            Log a past workout
          </button>
        </div>
      </div>

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
