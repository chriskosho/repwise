import { continuePlan, dayTitle, isWorkoutDay, phaseOf, planNote, planProgress } from '../plan';
import { typeLabel } from '../activities';
import { DayIcon, dayKind } from './Icons';

const dowName = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
const shortDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
// Days set aside as "Time away" when a plan resumed after a break show as one row per stretch.
const away = (d) => d.k === 'r' && d.adj === 'Time away';
function collapseAway(days) {
  const out = [];
  for (const d of days) {
    const last = out[out.length - 1];
    if (away(d) && last?.run) last.run.push(d);
    else out.push(away(d) ? { ...d, run: [d] } : d);
  }
  return out;
}
const longDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

// What a plan day asks you to do, in a sentence.
export function dayLine(d) {
  if (d.k === 'r') return 'Rest day';
  if (d.k === 'a') return `Easy day: ${d.m} min ${typeLabel(d.t).toLowerCase()} or stretch`;
  if (d.k === 'c') return `Cardio: ${typeLabel(d.t)} ${d.m} min`;
  return `${dayTitle(d)} · ${d.m} min${d.ease ? ' · easy' : ''}`;
}

export default function PlanCard({ plan, workouts, todayStr, onDo, onViewPlan, onViewDay = () => {}, onNewPlan, onEndPlan, onSuggest, onContinue }) {
  const p = planProgress(plan, workouts, todayStr);

  if (p.status === 'upcoming') {
    return (
      <section data-tour="plan" className="card plan-card">
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
      <section data-tour="plan" className="card plan-card">
        <h3>Plan complete 🎉</h3>
        <p>
          You finished {p.done} of {p.planned} planned workouts ({p.percent}%) over {plan.length} days.
        </p>
        <p className="muted">Check Progress for your records, and the Body tab for how your weight changed.</p>
        {onContinue && (() => {
          const next = continuePlan(plan, p, todayStr);
          return (
            <div className="plan-next">
              <h4>Next up</h4>
              <ul className="tour-lines">
                {next.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              <button type="button" className="btn" onClick={() => onContinue(next)}>
                Continue with this plan
              </button>
            </div>
          );
        })()}
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={onNewPlan}>
            Choose something different
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
    <section data-tour="plan" className="card plan-card" aria-label="Your plan">
      <p className="muted plan-meta">
        Day {p.dayNumber} of {plan.length} · Week {p.week}: {phase}
      </p>
      <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={p.planned} aria-valuenow={p.done} aria-label="Plan progress">
        <span style={{ width: `${p.percent}%` }} />
      </div>
      <p className="muted plan-meta">
        {p.done} of {p.planned} workouts done
      </p>

      <ol className="week-strip" aria-label="This week">
        {p.days
          .filter((d) => d.week === p.week)
          .map((d) => {
            const rest = d.k === 'r' || d.mv;
                        return (
              <li key={d.n}>
                <button
                  type="button"
                  className={`wk-day${d.date === todayStr ? ' today' : ''}${d.done ? ' done' : ''}${rest ? ' rest' : ''}`}
                  aria-label={`${longDate(d.date)}: ${d.done ? 'done' : rest ? 'rest day' : dayLine(d)}`}
                  onClick={() => onViewDay(d.n)}
                >
                  <span>{dowName(d.date).slice(0, 3)}</span>
                  <strong><DayIcon kind={dayKind(d, rest)} /></strong>
                </button>
              </li>
            );
          })}
      </ol>

      {planNote(plan, todayStr) && (
        <p className="plan-note" role="note">
          {planNote(plan, todayStr)}
        </p>
      )}

      {t.done && isWorkoutDay(t) ? (
        <h3>Today: done Nice work.</h3>
      ) : (
        <>
          <h3>Today: {t.mv ? 'Rest day' : dayLine(t)}</h3>
          {t.adj && <p className="muted">{t.adj}.</p>}
          {plan.time && isWorkoutDay(t) && !t.mv && <p className="muted">Planned for the {plan.time}.</p>}
          {(t.k === 'r' || t.mv) && <p className="muted">Recovery is when your body adapts. Take it easy, or go for a walk.</p>}
          {t.k === 's' && t.ease && <p className="muted">An easy session: fewer sets and lighter weights.</p>}
        </>
      )}

      <div className="actions">
        {t.k === 's' && !t.mv && !t.done && (
          <button type="button" className="btn" onClick={() => onDo(t)}>
            Start {dayTitle(t).toLowerCase()} workout
          </button>
        )}
        {(t.k === 'c' || t.k === 'a') && !t.mv && !t.done && (
          <button type="button" className="btn" onClick={() => onDo(t)}>
            Log {typeLabel(t.t).toLowerCase()}
          </button>
        )}
        {(t.k === 'r' || t.mv) && (
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
          <button type="button" className="btn btn-link" onClick={() => onViewDay(p.next.n)}>
            Next: {dowName(p.next.date)}, {dayLine(p.next)}
          </button>
        </p>
      )}
      <div className="actions">
        <button type="button" className="btn btn-link" onClick={() => onViewDay(t.n)}>
          See what’s planned today
        </button>
        <button type="button" className="btn btn-link" onClick={onViewPlan}>
          View plan
        </button>
      </div>
    </section>
  );
}

export function PlanView({ plan, workouts, todayStr, onClose, onNewPlan, onEndPlan, onViewDay = () => {} }) {
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
          {p.done} of {p.planned} workouts done · starts {longDate(plan.start)}. Tap a day to see the workout, change it or swap it.
        </p>
      </div>
      {weeks.map((days, w) => (
        <section className="card" key={w}>
          <h3>
            Week {w + 1}: {days.every(away) ? 'Time away' : phaseOf(plan, w + 1)}
          </h3>
          <ul className="plain plan-days">
            {collapseAway(days).map((d) => {
              if (d.run)
                return (
                  <li key={d.n} className="is-rest away-run">
                    <div className="plan-row">
                      <strong>{d.run.length > 1 ? `${shortDate(d.date)}–${shortDate(d.run[d.run.length - 1].date)}` : longDate(d.date)}</strong>
                      <span>Time away{d.run.length > 1 ? ` · ${d.run.length} days` : ''}</span>
                      <span className="plan-state" />
                    </div>
                  </li>
                );
              const past = d.date < todayStr;
              const state = d.date === todayStr ? 'today' : d.done ? 'done' : d.mv ? 'moved' : past && isWorkoutDay(d) ? 'missed' : '';
              return (
                <li key={d.n} className={`${state} ${d.k === 'r' || d.mv ? 'is-rest' : ''}`}>
                  <button type="button" className="plan-row" onClick={() => onViewDay(d.n)} aria-label={`${longDate(d.date)}: ${d.mv ? 'Rest day' : dayLine(d)}`}>
                    <strong>{longDate(d.date)}</strong>
                    <span>
                      {d.mv ? `${dayLine(d)} (moved)` : dayLine(d)}
                      {d.adj ? ` · ${d.adj}` : ''}
                    </span>
                    <span className="plan-state">
                      {state === 'done' ? <span role="img" aria-label="Done"><DayIcon kind="done" /></span> : state === 'today' ? 'Today' : state === 'missed' ? 'Not done' : state === 'moved' ? 'Moved' : ''}
                      <span aria-hidden="true"> ›</span>
                    </span>
                  </button>
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
