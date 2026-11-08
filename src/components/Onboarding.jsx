import { useMemo, useState } from 'react';
import { getProfile, listGoals, saveBodyEntry, saveGoal, saveProfile, today } from '../db';
import { CARDIO_CHOICES, DAYS_PER_WEEK, GOALS, LENGTHS, LEVELS, TIMES_OF_DAY, WEEKDAYS as DOW, addDays, buildPlan, dayTitle } from '../plan';
import { GEAR, TIMES } from '../suggest';
import { ACTIVITY_TYPES, typeLabel } from '../activities';
import { weightIn } from '../units';
import Tour from './Tour';

const STEPS = ['welcome', 'goal', 'level', 'schedule', 'when', 'interests', 'gear', 'body', 'length', 'review', 'tour'];
const PLAN_STEPS = ['goal', 'level', 'schedule', 'when', 'interests', 'gear', 'length', 'review'];
const INTEREST_TYPES = ACTIVITY_TYPES.filter(([k]) => k !== 'other');
const RECOMMENDED = { new: 21, some: 30, pro: 60 };
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

// Height from two boxes: feet + inches for pounds, meters + centimeters for kilograms.
export function heightCm(unit, a, b) {
  const x = Number(a) || 0;
  const y = Number(b) || 0;
  const cm = unit === 'kg' ? x * 100 + y : (x * 12 + y) * 2.54;
  return cm >= 50 && cm <= 272 ? Math.round(cm * 10) / 10 : null;
}

function nextMonday(from) {
  const dow = new Date(`${from}T12:00:00`).getDay();
  return addDays(from, ((8 - dow) % 7) || 7);
}

// First-run questions, then a starter plan and a short tour. `mode` is "first" for a new
// user or "plan" when someone comes back to build a new plan from Settings or the plan card.
export default function Onboarding({ unit, setUnit, name: startName = '', saved = null, mode = 'first', onDone }) {
  const [step, setStep] = useState(mode === 'plan' ? (saved?.goal && saved?.level ? 'length' : 'goal') : 'welcome');
  const [name, setName] = useState(startName);
  const [u, setU] = useState(unit);
  const [goal, setGoal] = useState(saved?.goal ?? '');
  const [level, setLevel] = useState(saved?.level ?? '');
  const [perWeek, setPerWeek] = useState(saved?.per_week ?? 3);
  const [minutes, setMinutes] = useState(saved?.minutes ?? 45);
  const [gear, setGear] = useState(saved?.gear ?? 'gym');
  const [interests, setInterests] = useState(saved?.interests ?? saved?.cardio ?? []);
  const [time, setTime] = useState(saved?.time ?? '');
  const [days, setDays] = useState(saved?.days ?? [0, 1, 2, 3, 4, 5, 6]);
  const cardio = interests.filter((t) => CARDIO_CHOICES.includes(t));
  const [weight, setWeight] = useState('');
  const [h1, setH1] = useState(''); // feet, or meters
  const [h2, setH2] = useState(''); // inches, or centimeters
  const [target, setTarget] = useState('');
  const [length, setLength] = useState(0);
  const [startOn, setStartOn] = useState('today');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const start = startOn === 'today' ? today() : startOn === 'tomorrow' ? addDays(today(), 1) : nextMonday(today());
  const chosenLength = length || RECOMMENDED[level] || 21;
  const plan = useMemo(
    () => (goal && level ? buildPlan({ length: chosenLength, start, goal, level, per_week: perWeek, minutes, gear, cardio, available: days, time }) : null),
    [chosenLength, start, goal, level, perWeek, minutes, gear, interests, days, time],
  );

  const steps = mode === 'first' ? STEPS : PLAN_STEPS;
  const idx = steps.indexOf(step);
  const canNext = step === 'goal' ? !!goal : step === 'level' ? !!level : step === 'when' ? days.length > 0 && !!time : true;
  const go = (d) => setStep(steps[Math.max(0, Math.min(steps.length - 1, idx + d))]);

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
        const patch = { display_name: name, units: u };
        const cm = heightCm(u, h1, h2);
        if (cm) patch.height_cm = cm;
        await saveProfile(patch);
        if (weight !== '' && Number(weight) > 0) {
          await saveBodyEntry({ weight_kg: weightIn(weight, u) });
          if (target !== '' && Number(target) > 0) {
            await saveGoal({ type: 'body_weight', target: weightIn(target, u), start_value: weightIn(weight, u) });
          }
        }
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
          <h2>You're all set{name ? `, ${name}` : ''}</h2>
          <p className="muted">Your plan starts {startOn === 'today' ? 'today' : startOn === 'tomorrow' ? 'tomorrow' : 'next Monday'}. Here is a quick look around.</p>
        </div>
        <Tour onDone={onDone} doneLabel="Start using Repwise" />
      </div>
    );
  }

  const wUnit = u;
  const week1 = plan ? plan.days.slice(0, 7) : [];

  return (
    <div className="onboarding">
      <div className="card onboarding-head">
        <p className="muted tour-step">
          {mode === 'first' ? `Step ${idx + 1} of ${STEPS.length - 1}` : `New plan · step ${idx + 1} of ${PLAN_STEPS.length}`}
        </p>
        <div className="progress-bar" aria-hidden="true">
          <span style={{ width: `${(idx / (steps.length - (mode === 'first' ? 2 : 1))) * 100}%` }} />
        </div>
      </div>

      <section className="card form">
        {step === 'welcome' && (
          <>
            <h2>Welcome to Repwise</h2>
            <p>
              A few quick questions and Repwise will build you a starter plan: what to do each day, how hard, and when to rest. It
              takes about a minute, and you can change everything later.
            </p>
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

        {step === 'goal' && (
          <>
            <h2>What is your main goal?</h2>
            <div className="choices">
              {GOALS.map(([k, label, text]) => (
                <Choice key={k} selected={goal === k} title={label} text={text} onClick={() => setGoal(k)} />
              ))}
            </div>
          </>
        )}

        {step === 'level' && (
          <>
            <h2>How much have you trained?</h2>
            <div className="choices">
              {LEVELS.map(([k, label, text]) => (
                <Choice key={k} selected={level === k} title={label} text={text} onClick={() => setLevel(k)} />
              ))}
            </div>
          </>
        )}

        {step === 'schedule' && (
          <>
            <h2>How much time do you have?</h2>
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
          </>
        )}

        {step === 'when' && (
          <>
            <h2>When do you like to work out?</h2>
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
            <div className="field">
              <span id="avail">Days you can work out</span>
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
          </>
        )}

        {step === 'interests' && (
          <>
            <h2>What do you enjoy doing?</h2>
            <p className="muted">Pick any. These go first when you log an activity, show up in workout ideas, and set the cardio days in your plan.</p>
            <div className="pills" role="group" aria-label="Activities you enjoy">
              {INTEREST_TYPES.map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className={`pill${interests.includes(k) ? ' on' : ''}`}
                  aria-pressed={interests.includes(k)}
                  onClick={() => setInterests(interests.includes(k) ? interests.filter((x) => x !== k) : [...interests, k])}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="muted">Not sure? Skip it. We'll learn from what you log.</p>
          </>
        )}

        {step === 'gear' && (
          <>
            <h2>What do you have to train with?</h2>
            <div className="choices">
              {GEAR.map(([k, label]) => (
                <Choice key={k} selected={gear === k} title={label} onClick={() => setGear(k)} />
              ))}
            </div>
          </>
        )}

        {step === 'body' && (
          <>
            <h2>About you (optional)</h2>
            <p className="muted">This stays on your device and your own account. It sets a starting point so Progress can show change.</p>
            {(
              <>
                <label className="field">
                  <span>Current weight ({wUnit})</span>
                  <input type="number" inputMode="decimal" min="0" step="any" value={weight} onChange={(e) => setWeight(e.target.value)} />
                </label>
                {(goal === 'lose' || goal === 'muscle') && (
                  <label className="field">
                    <span>Goal weight ({wUnit})</span>
                    <input type="number" inputMode="decimal" min="0" step="any" value={target} onChange={(e) => setTarget(e.target.value)} />
                  </label>
                )}
                <div className="field">
                  <span id="height-label">Height</span>
                  <div className="row" role="group" aria-labelledby="height-label">
                    <label className="field">
                      <span>{wUnit === 'kg' ? 'Meters' : 'Feet'}</span>
                      <input type="number" inputMode="numeric" min="0" max={wUnit === 'kg' ? 2 : 8} step="1" value={h1} onChange={(e) => setH1(e.target.value)} />
                    </label>
                    <label className="field">
                      <span>{wUnit === 'kg' ? 'Centimeters' : 'Inches'}</span>
                      <input type="number" inputMode="decimal" min="0" max={wUnit === 'kg' ? 99 : 11.9} step="any" value={h2} onChange={(e) => setH2(e.target.value)} />
                    </label>
                  </div>
                </div>
              </>
            )}
            <p className="muted">
              If something hurts or a doctor has told you to take it easy, check with them before starting, and swap out any exercise that doesn't feel right.
            </p>
          </>
        )}

        {step === 'length' && (
          <>
            <h2>How long should your plan be?</h2>
            <div className="choices">
              {LENGTHS.map(([n, label, text]) => (
                <Choice
                  key={n}
                  selected={chosenLength === n}
                  title={`${n} days: ${label}`}
                  text={text}
                  tag={level && RECOMMENDED[level] === n ? 'Suggested' : ''}
                  onClick={() => setLength(n)}
                />
              ))}
            </div>
          </>
        )}

        {step === 'review' && plan && (
          <>
            <h2>Your plan</h2>
            <p>
              {chosenLength} days, {Math.min(perWeek, days.length || 7)} workouts a week, about {minutes} minutes each
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
              <span id="start-on">Start</span>
              <div className="pills" role="group" aria-labelledby="start-on">
                {[['today', 'Today'], ['tomorrow', 'Tomorrow'], ['monday', 'Next Monday']].map(([k, label]) => (
                  <button key={k} type="button" className={`pill${startOn === k ? ' on' : ''}`} aria-pressed={startOn === k} onClick={() => setStartOn(k)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className="muted">Missed a day? No problem. Repwise offers to catch up, and the plan never locks you out.</p>
          </>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="actions">
          {idx > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => go(-1)}>
              Back
            </button>
          )}
          {step === 'review' ? (
            <button type="button" className="btn" disabled={busy || !plan} onClick={createPlan}>
              {mode === 'first' ? 'Create my plan' : 'Start this plan'}
            </button>
          ) : (
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
