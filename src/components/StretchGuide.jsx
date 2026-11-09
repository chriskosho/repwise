import { useEffect, useRef, useState } from 'react';
import { guideSteps, stepsSeconds } from '../stretches';
import { usePrefs } from '../prefs';
import { chime, primeAudio } from '../rest';

// Timer-led stretching. It stores when the current step ends rather than counting down,
// so a throttled or locked screen still shows the right time when you look again.
export default function StretchGuide({ list, onFinish, onExit }) {
  const steps = useRef(guideSteps(list)).current;
  const prefs = usePrefs();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [left, setLeft] = useState(steps[0]?.seconds ?? 0);
  const endAt = useRef(Date.now() + (steps[0]?.seconds ?? 0) * 1000);
  const active = useRef(0); // seconds actually spent stretching or switching, for the log
  const done = useRef(new Set());
  const last = useRef(Date.now());

  const step = steps[i];

  const go = (n) => {
    if (n >= steps.length) {
      chime(true);
      onFinish({ seconds: Math.round(active.current), completed: [...done.current].map((x) => list[x].name), finished: true });
      return;
    }
    const s = steps[n];
    if (steps[i]?.kind === 'hold' && n > i) done.current.add(steps[i].index);
    setI(n);
    setLeft(s.seconds);
    endAt.current = Date.now() + s.seconds * 1000;
    last.current = Date.now();
    chime(s.kind === 'hold' && s.side !== 2);
  };

  useEffect(() => {
    if (paused) return undefined;
    last.current = Date.now();
    endAt.current = Date.now() + left * 1000;
    const t = setInterval(() => {
      const now = Date.now();
      if (step.kind !== 'ready') active.current += Math.min(2, (now - last.current) / 1000);
      last.current = now;
      const rem = Math.max(0, Math.ceil((endAt.current - now) / 1000));
      setLeft(rem);
      if (rem <= 0) go(i + 1);
    }, 250);
    return () => clearInterval(t);
  }, [i, paused]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the screen on while you are on the floor.
  useEffect(() => {
    if (!prefs.keepAwake || !navigator.wakeLock) return undefined;
    let lock = null;
    let gone = false;
    navigator.wakeLock.request('screen').then((l) => (gone ? l.release() : (lock = l))).catch(() => {});
    return () => {
      gone = true;
      lock?.release?.().catch?.(() => {});
    };
  }, [prefs.keepAwake]);

  const startOf = (idx) => steps.findIndex((x) => x.index === idx);
  const back = () => go(i > startOf(step.index) ? startOf(step.index) : Math.max(0, startOf(step.index - 1)));
  const skip = () => go(step.index + 1 < list.length ? startOf(step.index + 1) : steps.length);

  const total = stepsSeconds(steps);
  const doneSecs = steps.slice(0, i).reduce((t, s) => t + s.seconds, 0) + (step.seconds - left);
  const item = list[step.index];
  const label = step.kind === 'ready' ? 'Get ready' : step.kind === 'switch' ? 'Switch sides' : step.side ? `Side ${step.side} of 2` : 'Hold';
  const upNext = step.kind === 'hold' ? null : step.kind === 'switch' ? 'Same stretch, other side' : null;

  const end = () => onFinish({ seconds: Math.round(active.current), completed: [...done.current].map((x) => list[x].name), finished: false });

  return (
    <div className="guide" role="region" aria-label="Guided stretching">
      <p className="muted">
        Stretch {step.index + 1} of {list.length}
      </p>
      <h2>{item.name}</h2>
      <p className="guide-label">{label}</p>
      <p className="guide-clock" aria-live="off">
        {left}
      </p>
      {item.cue && step.kind !== 'switch' && <p className="guide-cue">{item.cue}</p>}
      {upNext && <p className="muted">{upNext}</p>}
      <div className="guide-bar" aria-hidden="true">
        <span style={{ width: `${Math.min(100, (doneSecs / total) * 100)}%` }} />
      </div>
      <div className="add-row">
        <button type="button" className="btn btn-block" onClick={back} aria-label="Previous stretch">
          Back
        </button>
        <button
          type="button"
          className="btn btn-block"
          onClick={() => {
            primeAudio();
            setPaused((p) => !p);
          }}
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>
      <button type="button" className="btn btn-block" onClick={skip}>
        Skip
      </button>
      <button type="button" className="btn btn-ghost btn-block" onClick={end}>
        End session
      </button>
      <button type="button" className="btn btn-ghost btn-block" onClick={onExit}>
        Back to the list
      </button>
    </div>
  );
}
