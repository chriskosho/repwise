import { addDays, dayTitle, isWorkoutDay, phaseOf, planProgress } from '../plan';
import { typeLabel } from '../activities';

const dowName = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
const longDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

// What a plan day asks you to do, in a sentence.
export function dayLine(d) {
  if (d.k === 'r') return 'Rest day';
  if (d.k === 'a') return `Easy day: ${d.m} min ${typeLabel(d.t).toLowerCase()} or stretch`;
  if (d.k === 'c') return `Cardio: ${typeLabel(d.t)} ${d.m} min`;
  return `${dayTitle(d)} · ${d.m} min${d.ease ? ' · easy' : ''}`;
}

export default function PlanCard({ plan, workouts, todayStr, onDo, onViewPlan, onNewPlan, onEndPlan, onSuggest }) {
  const p = planProgress(plan, workouts, todayStr);

  if (p.status === 'upcoming') {
    return (
      <section className="card plan-card">
        <h3>Your plan starts {longDate(plan.start)}</h3>
        <p className="muted">{dayLine(p.days[0])} is first.</p>
        <button type="button" className="btn btn-link" onClick={onViewPlan}>
          View plan
        </button>
      </section>
    );
  }

  if (p.status === 'finished') {
    return (
      <section className="card plan-card">
        <h3>Plan complete 🎉</h3>
        <p>
          You finished {p.done} of {p.planned} planned workouts ({p.percent}%) over {plan.length} days.
        </p>
        <p className="muted">Check Progress for your records, and the Body tab for how your weight changed.</p>
        <div className="actions">
          <button type="button" className="btn" onClick={onNewPlan}>
            Start a new plan
          </button>
          <button type="button" className="btn btn-ghost" onClick={onEndPlan}>
            Close plan
          </button>
        </div>
      </section>
    );
  }

  const t = p.today;
  const phase = phaseOf(plan, p.week);
  return (
    <section className="card plan-card" aria-label="Your plan">
      <p className="muted plan-meta">
        Day {p.dayNumber} of {plan.length} · Week {p.week}: {phase}
      </p>
      <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={p.planned} aria-valuenow={p.done} aria-label="Plan progress">
        <span style={{ width: `${p.percent}%` }} />
      </div>
      <p className="muted plan-meta">
        {p.done} of {p.planned} workouts done
      </p>

      {t.done && isWorkoutDay(t) ? (
        <h3>Today: done ✓ Nice work.</h3>
      ) : (
        <>
          <h3>Today: {dayLine(t)}</h3>
          {t.k === 'r' && <p className="muted">Recovery is when your body adapts. Take it easy, or go for a walk.</p>}
          {t.k === 's' && t.ease && <p className="muted">An easy session: fewer sets and lighter weights.</p>}
        </>
      )}

      <div className="actions">
        {t.k === 's' && !t.done && (
          <button type="button" className="btn" onClick={() => onDo(t)}>
            Start {dayTitle(t).toLowerCase()} workout
          </button>
        )}
        {(t.k === 'c' || t.k === 'a') && !t.done && (
          <button type="button" className="btn" onClick={() => onDo(t)}>
            Log {typeLabel(t.t).toLowerCase()}
          </button>
        )}
        {t.k === 'r' && (
          <button type="button" className="btn btn-ghost" onClick={onSuggest}>
            Feeling good? Train anyway
          </button>
        )}
      </div>

      {p.catchUp && (
        <p className="plan-catchup">
          You skipped {dowName(p.catchUp.date)}'s {p.catchUp.k === 'c' ? 'cardio' : dayTitle(p.catchUp).toLowerCase()} workout.{' '}
          <button type="button" className="btn btn-link" onClick={() => onDo(p.catchUp)}>
            Do it today
          </button>
        </p>
      )}
      {p.next && (t.k === 'r' || t.done) && (
        <p className="muted">
          Next: {dowName(p.next.date)}, {dayLine(p.next)}
        </p>
      )}
      <button type="button" className="btn btn-link" onClick={onViewPlan}>
        View plan
      </button>
    </section>
  );
}

export function PlanView({ plan, workouts, todayStr, onClose, onNewPlan, onEndPlan }) {
  const p = planProgress(plan, workouts, todayStr);
  const weeks = [];
  for (let i = 0; i < p.days.length; i += 7) weeks.push(p.days.slice(i, i + 7));
  return (
    <div>
      <div className="card editor-head">
        <button type="button" className="btn btn-ghost btn-small back" onClick={onClose}>
          ← Back
        </button>
        <h2>Your {plan.length}-day plan</h2>
        <p className="muted">
          {p.done} of {p.planned} workouts done · starts {longDate(plan.start)}
        </p>
      </div>
      {weeks.map((days, w) => (
        <section className="card" key={w}>
          <h3>
            Week {w + 1}: {phaseOf(plan, w + 1)}
          </h3>
          <ul className="plain plan-days">
            {days.map((d) => {
              const past = d.date < todayStr;
              const state = d.date === todayStr ? 'today' : d.done ? 'done' : past && isWorkoutDay(d) ? 'missed' : '';
              return (
                <li key={d.n} className={`${state} ${d.k === 'r' ? 'is-rest' : ''}`}>
                  <strong>{longDate(d.date)}</strong>
                  <span>{dayLine(d)}</span>
                  <span className="plan-state">{state === 'done' ? '✓' : state === 'today' ? 'Today' : state === 'missed' ? 'Missed' : ''}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <div className="actions">
        <button type="button" className="btn btn-ghost" onClick={onNewPlan}>
          Build a new plan
        </button>
        <button type="button" className="btn btn-ghost" onClick={onEndPlan}>
          End this plan
        </button>
      </div>
    </div>
  );
}
