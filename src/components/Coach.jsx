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
    body: 'Your plan shows what to do today. Tap it to start the planned workout. Missed a day? Repwise moves it for you.',
  },
  {
    id: 'start',
    tab: 'workout',
    target: '[data-tour="start"]',
    title: 'Start a workout',
    body: 'Tap here to begin. Add exercises, type weight and reps, and tap the check on each finished set. A rest timer starts on its own, and “Previous” shows what to beat.',
  },
  {
    id: 'suggest',
    tab: 'workout',
    target: '[data-tour="suggest"]',
    title: 'Not sure what to do?',
    body: 'Pick your time, equipment and focus, and Repwise builds a workout with suggested weights and warm-up sets. It goes lighter when you are tired.',
  },
  {
    id: 'activity',
    tab: 'workout',
    target: '[data-tour="activity"]',
    title: 'Runs, sports and stretching',
    body: 'Log anything that is not a lift. You type what you did and where; nothing is tracked by GPS. It still counts toward your streak and goals.',
  },
  {
    id: 'routines',
    tab: 'workout',
    target: '[data-tour="routines"]',
    title: 'Routines',
    body: 'Save a workout you repeat and start it in one tap. You can set target weights for each exercise.',
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
    body: 'Log what you eat as you go. Type a food and pick it from the list, or add your own. No meals or categories to fill in.',
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
