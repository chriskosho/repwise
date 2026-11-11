import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listBodyEntries } from '../db';
import { typeLabel } from '../activities';
import { dayLine } from './PlanCard';
import { defaultWhich, reviewPeriod, weeklyReview } from '../review';
import { fmtVolume } from '../stats';
import { kmToLong, longUnit } from '../measure';
import { weightOut } from '../units';
import { exName } from '../library';

const day = (d) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const arrow = (n) => (n == null ? '' : n > 0 ? `▲ ${n}%` : n < 0 ? `▼ ${Math.abs(n)}%` : 'same');

function Stat({ label, value, sub }) {
  return (
    <div className="review-stat">
      <strong>{value}</strong>
      <span>{label}</span>
      {sub && <span className="muted">{sub}</span>}
    </div>
  );
}

export default function Review({ sessions, activities, plan, unit, weekStart = 1, todayStr, onClose }) {
  const entries = useLiveQuery(listBodyEntries, [], []);
  const [which, setWhich] = useState(defaultWhich(todayStr, weekStart));
  const { start, end } = reviewPeriod(todayStr, weekStart, which);
  const r = weeklyReview({ sessions, activities, entries, plan, start, end });
  return (
    <div>
      <div className="card editor-head">
        <button type="button" className="btn btn-ghost btn-small back" onClick={onClose}>
          ← Back
        </button>
        <h2>Weekly review</h2>
        <p className="muted">
          {day(start)} to {day(end)}
        </p>
        <div className="segments two" role="group" aria-label="Which week">
          {[['last', 'Last week'], ['this', 'This week so far']].map(([k, label]) => (
            <button key={k} type="button" className={which === k ? 'seg on' : 'seg'} aria-pressed={which === k} onClick={() => setWhich(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <section className="card">
        <h3>{r.headline}</h3>
        <div className="review-grid">
          <Stat label="workout days" value={r.days} sub={r.prevDays ? `${r.prevDays} the week before` : ''} />
          <Stat label="active minutes" value={r.minutes} sub={arrow(r.minutesChange)} />
          {r.volume > 0 && <Stat label={`lifted (${unit})`} value={fmtVolume(r.volume)} sub={arrow(r.volumeChange)} />}
          {r.km > 0 && <Stat label={longUnit(unit)} value={Math.round(kmToLong(r.km, unit) * 10) / 10} />}
          <Stat label="new records" value={r.prs.length} />
        </div>
        {r.plan && (
          <>
            <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={r.plan.planned} aria-valuenow={r.plan.done} aria-label="Plan this week">
              <span style={{ width: `${Math.round((r.plan.done / r.plan.planned) * 100)}%` }} />
            </div>
            <p className="muted">
              Plan: {r.plan.done} of {r.plan.planned} workouts done
            </p>
          </>
        )}
      </section>

      {r.prs.length > 0 && (
        <section className="card">
          <h3>Records</h3>
          <ul className="plain">
            {r.prs.map((p, i) => (
              <li key={i}>
                <strong>{exName(p.name)}</strong>{' '}
                <span className="muted">
                  {p.orm ? `est. 1RM ${p.orm}` : p.weight ? `${p.weight} ${unit}` : p.reps ? `${p.reps} reps` : p.time ? `${p.time}s hold` : 'new best'} · {day(p.date)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.weight && (
        <section className="card">
          <h3>Body weight</h3>
          <p>
            {weightOut(r.weight.to, unit)} {unit}
            {r.weight.change_kg != null && r.weight.change_kg !== 0 && (
              <span className="muted">
                {' '}
                ({r.weight.change_kg > 0 ? '+' : ''}
                {weightOut(Math.abs(r.weight.change_kg), unit) * (r.weight.change_kg < 0 ? -1 : 1)} {unit} vs before)
              </span>
            )}
          </p>
        </section>
      )}

      {r.notes.length > 0 && (
        <section className="card">
          <h3>Plan updates</h3>
          <ul className="plain">
            {r.notes.map((n) => (
              <li key={n.k}>{n.t}</li>
            ))}
          </ul>
        </section>
      )}

      {r.nextWeek && r.nextWeek.some((d) => d.k !== 'r') && (
        <section className="card">
          <h3>Next week</h3>
          <ul className="plain plan-days">
            {r.nextWeek.map((d) => (
              <li key={d.date} className={d.k === 'r' || d.mv ? 'is-rest' : ''}>
                <div className="plan-row">
                  <strong>{day(d.date)}</strong>
                  <span>{d.mv ? 'Rest day' : dayLine(d)}</span>
                  <span />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function ReviewCard({ workouts, todayStr, weekStart, onOpen, onDismiss }) {
  const { start, end } = reviewPeriod(todayStr, weekStart);
  const dates = new Set(workouts.filter((w) => w.date >= start && w.date <= end).map((w) => w.date));
  if (!dates.size) return null;
  return (
    <section className="card review-card" aria-label="Weekly review">
      <h3>Your week in review</h3>
      <p className="muted">
        {dates.size} workout {dates.size === 1 ? 'day' : 'days'}. See how it went and what's next.
      </p>
      <div className="actions">
        <button type="button" className="btn btn-small" onClick={onOpen}>
          Open review
        </button>
        <button type="button" className="btn btn-small btn-ghost" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </section>
  );
}
