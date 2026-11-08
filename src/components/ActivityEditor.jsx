import { useState } from 'react';
import { deleteActivity, saveActivity } from '../db';
import { ACTIVITY_TYPES, distIn, distLabel, distOut, elevationIn, elevationLabel, elevationOut, hasElevation, hasIncline, paceText } from '../activities';
import PlacePicker from './PlacePicker';
import ExercisePicker from './ExercisePicker';
import ExerciseInfo from './ExerciseInfo';
import { InfoIcon } from './Icons';

// Log or change a non-gym activity: a run, a ride, a game. Everything is typed in; no GPS.
export default function ActivityEditor({ initial, isNew, places, unit, onClose }) {
  const [a, setA] = useState(initial);
  const total = initial.duration_min ?? 0;
  const [hours, setHours] = useState(total ? String(Math.floor(total / 60)) : '');
  const [mins, setMins] = useState(total ? String(Math.round(total % 60)) : '');
  const [dist, setDist] = useState(initial.distance_km != null ? String(distOut(initial.distance_km, initial.type, unit)) : '');
  const [elev, setElev] = useState(initial.elevation_m != null ? String(elevationOut(initial.elevation_m, unit)) : '');
  const [incline, setIncline] = useState(initial.incline_pct != null ? String(initial.incline_pct) : '');
  const [hr, setHr] = useState(initial.avg_hr != null ? String(initial.avg_hr) : '');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [picking, setPicking] = useState(false);
  const [info, setInfo] = useState(null);
  const set = (patch) => setA((x) => ({ ...x, ...patch }));

  const draft = () => ({
    ...a,
    duration_min: (Number(hours) || 0) * 60 + (Number(mins) || 0),
    distance_km: dist === '' ? null : distIn(dist, a.type, unit),
    elevation_m: elev === '' || !hasElevation(a.type) ? null : elevationIn(elev, unit),
    incline_pct: incline === '' || !hasIncline(a.type) ? null : incline,
    avg_hr: hr === '' ? null : hr,
  });
  const pace = (() => {
    const d = draft();
    return d.duration_min > 0 && d.distance_km > 0 ? paceText(d, unit) : '';
  })();

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      await saveActivity(draft());
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="editor" onSubmit={save}>
      <div className="card editor-head">
        <button type="button" className="btn btn-ghost btn-small back" onClick={onClose}>
          ← Back
        </button>
        <h2>{isNew ? 'Log an activity' : 'Edit activity'}</h2>
      </div>

      <div className="card form">
        <label className="field">
          <span>Activity</span>
          <select value={a.type} onChange={(e) => set({ type: e.target.value })}>
            {ACTIVITY_TYPES.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Title (optional)</span>
          <input value={a.title} onChange={(e) => set({ title: e.target.value })} maxLength={80} placeholder="Morning loop, pickup game…" />
        </label>
        <label className="field">
          <span>Date</span>
          <input type="date" value={a.date} onChange={(e) => e.target.value && set({ date: e.target.value })} required />
        </label>
        <div className="row">
          <label className="field">
            <span>Hours</span>
            <input type="number" inputMode="numeric" min="0" max="24" value={hours} onChange={(e) => setHours(e.target.value)} />
          </label>
          <label className="field">
            <span>Minutes</span>
            <input type="number" inputMode="numeric" min="0" max="59" value={mins} onChange={(e) => setMins(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Distance, optional ({distLabel(a.type, unit)})</span>
          <input type="number" inputMode="decimal" step="any" min="0" value={dist} onChange={(e) => setDist(e.target.value)} />
        </label>
        {pace && <p className="muted">Average: {pace}</p>}
        {hasIncline(a.type) && (
          <label className="field">
            <span>Incline, optional (%)</span>
            <input type="number" inputMode="decimal" step="any" min="0" max="100" value={incline} onChange={(e) => setIncline(e.target.value)} />
          </label>
        )}
        {hasElevation(a.type) && (
          <label className="field">
            <span>Elevation gain, optional ({elevationLabel(unit)})</span>
            <input type="number" inputMode="numeric" min="0" value={elev} onChange={(e) => setElev(e.target.value)} />
          </label>
        )}
        <label className="field">
          <span>Average heart rate, optional (bpm)</span>
          <input type="number" inputMode="numeric" min="30" max="250" value={hr} onChange={(e) => setHr(e.target.value)} />
        </label>
        <label className="field">
          <span>Effort, optional (1 easy – 10 all out)</span>
          <select value={a.effort ?? ''} onChange={(e) => set({ effort: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Not rated</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>Stretches, optional</span>
          {a.stretches?.length > 0 && (
            <ul className="plain stretch-list">
              {a.stretches.map((n) => (
                <li key={n}>
                  <span>{n}</span>
                  <span className="actions">
                    <button type="button" className="icon-btn" aria-label={`How to: ${n}`} onClick={() => setInfo(n)}>
                      <InfoIcon />
                    </button>
                    <button type="button" className="btn btn-small btn-ghost" aria-label={`Remove ${n}`} onClick={() => set({ stretches: a.stretches.filter((x) => x !== n) })}>
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setPicking(true)}>
            + Add stretches
          </button>
        </div>
        <PlacePicker places={places} value={a.place_id} onChange={(id) => set({ place_id: id })} />
        <label className="field">
          <span>Notes</span>
          <textarea rows={3} value={a.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={2000} placeholder="How it felt, who you played with…" />
        </label>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-big btn-block">
        Save activity
      </button>
      {!isNew &&
        (confirm ? (
          <div className="menu" role="alertdialog" aria-label="Confirm delete">
            <p>Delete this activity? This can’t be undone.</p>
            <div className="actions">
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  await deleteActivity(a.id);
                  onClose();
                }}
              >
                Yes, delete
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirm(false)}>
                Keep
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-ghost btn-danger btn-block" onClick={() => setConfirm(true)}>
            Delete activity
          </button>
        ))}
      {picking && (
        <ExercisePicker
          sessions={[]}
          initialCategory="stretching"
          onClose={() => setPicking(false)}
          onAdd={(names) => {
            setA((x) => ({ ...x, stretches: [...(x.stretches ?? []), ...names.filter((n) => !(x.stretches ?? []).includes(n))] }));
            setPicking(false);
          }}
        />
      )}
      {info && <ExerciseInfo name={info} onClose={() => setInfo(null)} />}
    </form>
  );
}
