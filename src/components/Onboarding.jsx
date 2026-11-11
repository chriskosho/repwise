import { useMemo, useState } from 'react';
import { listGoals, saveGoal, saveProfile, today } from '../db';
import { CARDIO_CHOICES, CARDIO_LIKES, DAYS_PER_WEEK, GOALS, LENGTHS, LEVELS, TIMES_OF_DAY, WANTS, WEEKDAYS as DOW, addDays, buildPlan, dayTitle, suggestGoal } from '../plan';
import { GEAR, TIMES } from '../suggest';
import { typeLabel } from '../activities';
import { heightFromParts } from '../units';

// Five short steps. Food, body details and the activities you enjoy live in Settings.
const STEPS = ['welcome', 'goal', 'when', 'gear', 'review', 'tour'];
const PLAN_STEPS = ['goal', 'when', 'gear', 'review'];
const RECOMMENDED = { new: 21, some: 30, pro: 60 };
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LEVEL_TEXT = { new: 'Little or none', some: 'On and off', pro: 'Regularly' };

function Choice({ selected, title, text, onClick, tag }) {
  return (
    <button type="button" className={`choice${selected ? ' on' : ''}`} aria-pressed={selected} onClick={onClick}>
      <strong>
        {title}
        {tag && <span className="choice-tag">{tag}</span>}
      </strong>
      {text && <span className="muted">{text}</span>}
    </button>
  );
}

export const heightCm = heightFromParts;

function nextMonday(from) {
  const dow = new Date(`${from}T12:00:00`).getDay();
  return addDays(from, ((8 - dow) % 7) || 7);
}

// First-run questions, then a starter plan and a short tour. `mode` is "first" for a new
// user or "plan" when someone comes back to build a new plan from Settings or the plan card.
export default function Onboarding({ unit, setUnit, name: startName = '', saved = null, mode = 'first', onDone }) {
  const known = !!(saved?.goal && saved?.level);
  const [step, setStep] = useState(mode === 'plan' ? (known ? 'review' : 'goal') : 'welcome');
  const [q, setQ] = useState(0); // which goal question: 0 want, 1 experience, 2 cardio, 3 the suggestion
  const [name, setName] = useState(startName);
  const [u, setU] = useState(unit);
  const [want, setWant] = useState('');
  const [cardioLike, setCardioLike] = useState('');
  const [goal, setGoal] = useState(saved?.goal ?? '');
  const [level, setLevel] = useState(saved?.level ?? '');
  const [changing, setChanging] = useState(false);
  const [perWeek, setPerWeek] = useState(saved?.per_week ?? 3);
  const [minutes, setMinutes] = useState(saved?.minutes ?? 45);
  const [gear, setGear] = useState(saved?.gear ?? 'gym');
  const interests = saved?.interests ?? saved?.cardio ?? [];
  const [time, setTime] = useState(saved?.time ?? 'any');
  const [days, setDays] = useState(saved?.days ?? [0, 1, 2, 3, 4, 5, 6]);
  const cardio = interests.filter((t) => CARDIO_CHOICES.includes(t));
  const [length, setLength] = useState(0);
  const [startOn, setStartOn] = useState('today');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const start = startOn === 'today' ? today() : startOn === 'tomorrow' ? addDays(today(), 1) : nextMonday(today());
  const chosenLength = length || RECOMMENDED[level] || 21;
  const plan = useMemo(
    () => (goal && level ? buildPlan({ length: chosenLength, start, goal, level, per_week: perWeek, minutes, gear, cardio, available: days, time }) : null),
    [chosenLength, start, goal, level, perWeek, minutes, gear, days, time], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const suggestion = want && level && cardioLike ? suggestGoal({ want, level, cardio: cardioLike }) : null;

  const steps = mode === 'first' ? STEPS : PLAN_STEPS;
  const idx = steps.indexOf(step);
  const shown = steps.filter((x) => x !== 'tour').length;
  const canNext = step === 'goal' ? !!goal && !!level && q === 3 : step === 'when' ? days.length > 0 : true;
  const go = (d) => setStep(steps[Math.max(0, Math.min(steps.length - 1, idx + d))]);
  const back = () => {
    if (step === 'goal' && q > 0) setQ(q - 1);
    else go(-1);
  };

  // Each goal question moves on as soon as you answer it.
  const answer = (setter, value) => {
    setter(value);
    if (q < 2) setQ(q + 1);
    else {
      const sug = suggestGoal({ want, level, cardio: value });
      setGoal(sug.goal);
      setChanging(false);
      setQ(3);
    }
  };
  const answerLevel = (value) => {
    setLevel(value);
    setQ(2);
  };

  async function skip() {
    await saveProfile({ onboarding: { skipped: true } });
    onDone();
  }

  async function createPlan() {
    setError('');
    setBusy(true);
    try {
      if (mode === 'first') {
        if (u !== unit) setUnit(u);
        await saveProfile({ display_name: name, units: u });
      }
      const goals = await listGoals();
      if (!goals.some((g) => g.type === 'weekly_workouts')) await saveGoal({ type: 'weekly_workouts', target: perWeek });
      await saveProfile({
        onboarding: { done_at: new Date().toISOString(), goal, level, per_week: perWeek, minutes, gear, cardio, interests, time, days },
        plan,
      });
      if (mode === 'first') setStep('tour');
      else onDone();
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'tour') {
    return (
      <div className="onboarding">
        <div className="card">
          <h1 className="page-title">You're all set{name ? `, ${name}` : ''}</h1>
          <p className="muted">Your plan starts {startOn === 'today' ? 'today' : startOn === 'tomorrow' ? 'tomorrow' : 'next Monday'}.</p>
          <p>Want a 30-second walk through the app? Repwise will point at each part and show you what it does.</p>
          <div className="actions">
            <button type="button" className="btn" onClick={() => onDone({ tour: true })}>
              Show me around
            </button>
            <button type="button" className="btn btn-link" onClick={() => onDone()}>
              Skip the tour
            </button>
          </div>
        </div>
      </div>
    );
  }

  const week1 = plan ? plan.days.slice(0, 7) : [];
  const goalLabel = (k) => GOALS.find(([g]) => g === k)?.[1] ?? '';

  return (
    <div className="onboarding">
      <section className="card form">
        <p className="muted tour-step">{mode === 'first' ? `Step ${idx + 1} of ${shown}` : `New plan · step ${idx + 1} of ${shown}`}</p>
        {step === 'welcome' && (
          <>
            <h1 className="page-title">Welcome to Repwise</h1>
            <p>A few quick questions and Repwise builds you a starter plan: what to do each day, how hard, and when to rest. It takes about a minute.</p>
            <label className="field">
              <span>What should we call you?</span>
              <input value={name} maxLength={40} autoComplete="given-name" onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" />
            </label>
            <label className="field">
              <span>Weight unit</span>
              <select value={u} onChange={(e) => setU(e.target.value)}>
                <option value="lb">Pounds (lb)</option>
                <option value="kg">Kilograms (kg)</option>
              </select>
            </label>
          </>
        )}

        {step === 'goal' && q === 0 && (
          <>
            <h1 className="page-title">What would make the biggest difference for you?</h1>
            <div className="choices">
              {WANTS.map(([k, label, text]) => (
                <Choice key={k} selected={want === k} title={label} text={text} onClick={() => answer(setWant, k)} />
              ))}
            </div>
          </>
        )}
        {step === 'goal' && q === 1 && (
          <>
            <h1 className="page-title">How much have you worked out before?</h1>
            <div className="choices">
              {LEVELS.map(([k, label]) => (
                <Choice key={k} selected={level === k} title={LEVEL_TEXT[k]} text={label} onClick={() => answerLevel(k)} />
              ))}
            </div>
          </>
        )}
        {step === 'goal' && q === 2 && (
          <>
            <h1 className="page-title">Do you like cardio, like walking, running or cycling?</h1>
            <div className="choices">
              {CARDIO_LIKES.map(([k, label]) => (
                <Choice key={k} selected={cardioLike === k} title={label} onClick={() => answer(setCardioLike, k)} />
              ))}
            </div>
          </>
        )}
        {step === 'goal' && q === 3 && (
          <>
            <h1 className="page-title">Your goal: {goalLabel(goal)}</h1>
            {suggestion && suggestion.goal === goal && <p className="goal-reason">{suggestion.reason}</p>}
            {!changing ? (
              <button type="button" className="btn btn-link goal-change" onClick={() => setChanging(true)}>
                Pick a different goal
              </button>
            ) : (
              <div className="choices">
                {GOALS.map(([k, label, text]) => (
                  <Choice key={k} selected={goal === k} title={label} text={text} tag={suggestion?.goal === k ? 'Suggested' : ''} onClick={() => setGoal(k)} />
                ))}
              </div>
            )}
          </>
        )}

        {step === 'when' && (
          <>
            <h1 className="page-title">When can you work out?</h1>
            <p className="muted">Be realistic. A plan you can keep beats a perfect one you can't.</p>
            <div className="field">
              <span id="dpw">Workouts per week</span>
              <div className="pills" role="group" aria-labelledby="dpw">
                {DAYS_PER_WEEK.map((n) => (
                  <button key={n} type="button" className={`pill${perWeek === n ? ' on' : ''}`} aria-pressed={perWeek === n} onClick={() => setPerWeek(n)}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span id="mps">Minutes per workout</span>
              <div className="pills" role="group" aria-labelledby="mps">
                {TIMES.map((n) => (
                  <button key={n} type="button" className={`pill${minutes === n ? ' on' : ''}`} aria-pressed={minutes === n} onClick={() => setMinutes(n)}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span id="avail">Days you're free</span>
              <div className="pills" role="group" aria-labelledby="avail">
                {DOW.map(([n, label]) => (
                  <button
                    key={n}
                    type="button"
                    className={`pill${days.includes(n) ? ' on' : ''}`}
                    aria-pressed={days.includes(n)}
                    onClick={() => setDays(days.includes(n) ? days.filter((x) => x !== n) : [...days, n].sort())}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {days.length === 0 && <span className="error">Pick at least one day.</span>}
              {days.length > 0 && days.length < perWeek && (
                <span className="muted">
                  You picked {days.length} {days.length === 1 ? 'day' : 'days'}, so your plan will have {days.length} {days.length === 1 ? 'workout' : 'workouts'} a week.
                </span>
              )}
            </div>
            <div className="field">
              <span id="tod">Best time of day</span>
              <div className="pills" role="group" aria-labelledby="tod">
                {TIMES_OF_DAY.map(([k, label]) => (
                  <button key={k} type="button" className={`pill${time === k ? ' on' : ''}`} aria-pressed={time === k} onClick={() => setTime(k)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 'gear' && (
          <>
            <h1 className="page-title">What do you have to train with?</h1>
            <div className="choices">
              {GEAR.map(([k, label]) => (
                <Choice
                  key={k}
                  selected={gear === k}
                  title={label}
                  onClick={() => {
                    setGear(k);
                    go(1);
                  }}
                />
              ))}
            </div>
          </>
        )}

        {step === 'review' && plan && (
          <>
            <h1 className="page-title">Your plan</h1>
            <p>
              {goalLabel(goal)} · {Math.min(perWeek, days.length || 7)} workouts a week, about {minutes} minutes each
              {time && time !== 'any' ? `, planned for the ${time}` : ''}. Here is your first week:
            </p>
            <ul className="plain plan-week">
              {week1.map((d, i) => {
                const date = addDays(start, i);
                const dow = WEEKDAYS[new Date(`${date}T12:00:00`).getDay()];
                return (
                  <li key={date} className={d.k === 'r' ? 'is-rest' : ''}>
                    <strong>{dow}</strong>
                    <span>
                      {dayTitle(d)}
                      {d.k === 'c' || d.k === 'a' ? ` · ${typeLabel(d.t)} ${d.m} min` : d.k === 's' ? ` · ${d.m} min` : ''}
                      {d.ease ? ' · easy' : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
            {level === 'new' && <p className="muted">Week 1 is deliberately easy: fewer sets and lighter weights while you learn the moves.</p>}
            <div className="field">
              <span id="plan-length">Plan length</span>
              <div className="pills" role="group" aria-labelledby="plan-length">
                {LENGTHS.map(([n, label]) => (
                  <button key={n} type="button" className={`pill${chosenLength === n ? ' on' : ''}`} aria-pressed={chosenLength === n} aria-label={`${n} days: ${label}`} onClick={() => setLength(n)}>
                    {n} days
                  </button>
                ))}
              </div>
              <span className="muted">{LENGTHS.find(([n]) => n === chosenLength)?.[2]}</span>
            </div>
            <div className="field">
              <span id="start-on">Start</span>
              <div className="pills" role="group" aria-labelledby="start-on">
                {[['today', 'Today'], ['tomorrow', 'Tomorrow'], ['monday', 'Next Monday']].map(([k, label]) => (
                  <button key={k} type="button" className={`pill${startOn === k ? ' on' : ''}`} aria-pressed={startOn === k} onClick={() => setStartOn(k)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className="muted">Missed a day? No problem. Repwise moves things around, and the plan never locks you out.</p>
            {mode === 'plan' && known && (
              <button type="button" className="btn btn-link goal-change" onClick={() => setStep('goal')}>
                Change goal or schedule
              </button>
            )}
          </>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="actions">
          {(idx > 0 || (step === 'goal' && q > 0)) && (
            <button type="button" className="btn btn-ghost" onClick={back}>
              Back
            </button>
          )}
          {step === 'review' ? (
            <button type="button" className="btn" disabled={busy || !plan} onClick={createPlan}>
              {mode === 'first' ? 'Create my plan' : 'Start this plan'}
            </button>
          ) : step === 'gear' || (step === 'goal' && q < 3) ? null : (
            <button type="button" className="btn" disabled={!canNext} onClick={() => go(1)}>
              Next
            </button>
          )}
          {mode === 'first' ? (
            <button type="button" className="btn btn-link" onClick={skip}>
              Skip for now
            </button>
          ) : (
            <button type="button" className="btn btn-link" onClick={onDone}>
              Cancel
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
