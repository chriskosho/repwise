import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// A guided tour: dims the screen, spotlights the real button or tab being described, and
// switches tabs as it goes. `optional` steps are skipped when their target is not on screen.
export const COACH_STEPS = [
  {
    id: 'plan',
    tab: 'workout',
    target: '[data-tour="plan"]',
    optional: true,
    title: 'Today’s plan',
    body: 'This week of your plan. Tap any day to see what is planned. Missed a day? Repwise moves it for you.',
  },
  {
    id: 'start',
    tab: 'workout',
    target: '[data-tour="start"]',
    title: 'Start in one tap',
    body: 'One button for what you most likely want today: your planned workout, your last workout again, or a stretch on rest days. Tick each set as you finish it; a rest timer starts on its own.',
  },
  {
    id: 'suggest',
    tab: 'workout',
    target: '[data-tour="suggest"]',
    title: 'Something else',
    body: 'Want something different? Pick one of your routines, get a suggested workout, start an empty one, or stretch.',
  },
  {
    id: 'activity',
    tab: 'workout',
    target: '[data-tour="activity"]',
    title: 'Log what you did',
    body: 'Already did something? Log a past workout, a run or sport, or a stretch session. Nothing is tracked by GPS.',
  },
  {
    id: 'routines',
    tab: 'workout',
    target: '[data-tour="routines"]',
    title: 'Routines',
    body: 'Your saved workouts live here, along with ready-made routines to add. Starting one is a single tap from the Start sheet too.',
  },
  {
    id: 'history',
    tab: 'history',
    target: '[data-tour="tab-history"]',
    title: 'History',
    body: 'A calendar of everything you have done. Tap any day or workout to look back, fix it or add notes.',
  },
  {
    id: 'progress',
    tab: 'progress',
    target: '[data-tour="tab-progress"]',
    title: 'Progress',
    body: 'Records, charts, muscle balance and goals live here, so you can see your lifts and weekly totals improve.',
  },
  {
    id: 'food',
    tab: 'food',
    target: '[data-tour="tab-food"]',
    title: 'Food',
    body: 'Keep a simple journal of what you eat each day, or switch to calorie tracking with food search and daily totals. Change it any time in Settings.',
  },
  {
    id: 'body',
    tab: 'body',
    target: '[data-tour="tab-body"]',
    title: 'Body',
    body: 'Track weight and measurements, and add progress photos. Photos stay on this device only.',
  },
  {
    id: 'settings',
    tab: 'settings',
    target: '[data-tour="tab-settings"]',
    title: 'Settings and your data',
    body: 'Everything is saved on this device first, so Repwise works with no signal. Sign in here to sync between devices, export a backup, and reopen this tour any time.',
  },
  {
    id: 'done',
    tab: 'workout',
    target: null,
    title: 'You’re ready',
    body: 'That is the tour. Start a workout whenever you like.',
  },
];

const PAD = 6;
const query = (sel) => (sel ? document.querySelector(sel) : null);

export default function Coach({ onTab = () => {}, onDone, steps = COACH_STEPS }) {
  const [list, setList] = useState(steps);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const [prepared, setPrepared] = useState(false);
  const next = useRef(null);
  const step = list[i];
  const last = i === list.length - 1;

  const measure = useCallback(() => {
    const el = query(step?.target);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, [step]);

  // Show the right tab, then find the thing being described (retrying while it renders).
  useEffect(() => {
    if (!step) return undefined;
    setPrepared(false);
    onTab(step.tab);
    let tries = 0;
    let t;
    const find = () => {
      const el = query(step.target);
      if (!el && step.optional) {
        // Nothing to point at: drop this step.
        if (tries < 5) {
          tries += 1;
          t = setTimeout(find, 60);
          return;
        }
        setList((l) => l.filter((s) => s !== step));
        return;
      }
      if (!el && step.target && tries < 8) {
        tries += 1;
        t = setTimeout(find, 60);
        return;
      }
      el?.scrollIntoView?.({ block: 'center', behavior: 'auto' });
      measure();
      setPrepared(true);
    };
    t = setTimeout(find, 30);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    const on = () => measure();
    window.addEventListener('resize', on);
    window.addEventListener('scroll', on, true);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('scroll', on, true);
    };
  }, [measure]);

  useLayoutEffect(() => {
    if (prepared) next.current?.focus();
  }, [prepared, i]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onDone();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  if (!step) return null;

  const below = rect && rect.top + rect.height < window.innerHeight * 0.55;
  const pos = rect
    ? below
      ? { top: Math.min(rect.top + rect.height + 12, window.innerHeight - 40) }
      : { bottom: Math.max(window.innerHeight - rect.top + 12, 8) }
    : { top: '50%', transform: 'translateY(-50%)' };

  return (
    <div className="coach" role="presentation">
      <div className="coach-block" />
      {rect && <div className="coach-spot" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} />}
      {!rect && <div className="coach-dim" />}
      {prepared && (
        <div className="coach-tip" role="dialog" aria-modal="true" aria-labelledby="coach-title" style={pos}>
          <p className="muted tour-step">
            {i + 1} of {list.length}
          </p>
          <h2 id="coach-title">{step.title}</h2>
          <p>{step.body}</p>
          <div className="tour-dots" aria-hidden="true">
            {list.map((s, n) => (
              <span key={s.id} className={n === i ? 'on' : ''} />
            ))}
          </div>
          <div className="actions">
            {i > 0 && (
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setI(i - 1)}>
                Back
              </button>
            )}
            <button ref={next} type="button" className="btn btn-small" onClick={() => (last ? onDone() : setI(i + 1))}>
              {last ? 'Done' : 'Next'}
            </button>
            {!last && (
              <button type="button" className="btn btn-link btn-small" onClick={onDone}>
                Skip tour
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
