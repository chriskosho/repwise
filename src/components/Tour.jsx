import { useState } from 'react';

// A short orientation: what each part of the app is for.
export const TOUR = [
  {
    title: 'Your Workout tab',
    lines: [
      'This is home. If you have a plan, today\'s card is at the top: tap it to start the planned workout.',
      'Start workout begins an empty session. Not sure what to do? Suggest a workout builds one from your goals and recovery.',
      'Routines are saved workouts you can start in one tap.',
    ],
  },
  {
    title: 'Logging a workout',
    lines: [
      'Add exercises from the library (tap the i for pictures, steps and a video search). Enter weight and reps and tap the check when a set is done.',
      'The Previous column shows what you did last time, so you always know what to beat.',
      'Tap a set\'s number to mark it a warm-up, drop set or failure. A rest timer starts when you finish a set.',
      'Running, holds and stretches are tracked by time and distance instead of reps.',
    ],
  },
  {
    title: 'Suggested workouts',
    lines: [
      'Pick your time, equipment and focus, or let Repwise choose the body part you have trained least.',
      'It suggests weights from your last session, adds warm-up sets, and goes lighter when you are tired or due for a rest.',
      'Shuffle for a different mix, start it, or save it as a routine.',
    ],
  },
  {
    title: 'Runs, sports and stretching',
    lines: [
      'Log a run, walk, sport or stretch session as an activity. It counts toward your streak and weekly goal.',
      'Add the place you went and any notes. Nothing is tracked by GPS; you enter what you did.',
    ],
  },
  {
    title: 'Progress, goals and your body',
    lines: [
      'Progress shows records, charts and muscle balance. History has a calendar of everything you have done.',
      'Set goals for weekly workouts, minutes, distance, a lift or your body weight.',
      'The Body tab tracks weight and measurements. You can fix an entry\'s date by tapping it.',
    ],
  },
  {
    title: 'Your data',
    lines: [
      'Everything is saved on this device first, so Repwise works with no signal.',
      'Sign in under Settings to sync between devices. Export a backup now and then for safekeeping.',
      'You can reopen this tour any time from Settings.',
    ],
  },
];

export default function Tour({ onDone, doneLabel = 'Got it' }) {
  const [i, setI] = useState(0);
  const page = TOUR[i];
  const last = i === TOUR.length - 1;
  return (
    <section className="card tour" aria-label="How to use Repwise">
      <p className="muted tour-step">
        {i + 1} of {TOUR.length}
      </p>
      <h2>{page.title}</h2>
      <ul className="tour-lines">
        {page.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <div className="tour-dots" aria-hidden="true">
        {TOUR.map((t, n) => (
          <span key={t.title} className={n === i ? 'on' : ''} />
        ))}
      </div>
      <div className="actions">
        {i > 0 && (
          <button type="button" className="btn btn-ghost" onClick={() => setI(i - 1)}>
            Back
          </button>
        )}
        {last ? (
          <button type="button" className="btn" onClick={onDone}>
            {doneLabel}
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => setI(i + 1)}>
            Next
          </button>
        )}
        {!last && (
          <button type="button" className="btn btn-link" onClick={onDone}>
            Skip tour
          </button>
        )}
      </div>
    </section>
  );
}
