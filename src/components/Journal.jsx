import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { typeLabel } from '../activities';
import { getFoodNote, listFoodNotes, mergeDuplicateNotes, saveFoodNote, today } from '../db';
import { FEELINGS, clockNow } from '../food';
import { useWorkouts } from '../workouts';

const shift = (date, n) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
};
const dayLabel = (date, todayStr) => {
  if (date === todayStr) return 'Today';
  if (date === shift(todayStr, -1)) return 'Yesterday';
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
};
const short = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const MAX = 5000;

// One day's note. It saves itself a moment after you stop typing.
function DayNote({ date }) {
  const note = useLiveQuery(() => getFoodNote(date), [date], undefined);
  const [text, setText] = useState('');
  const [feeling, setFeeling] = useState('');
  const [status, setStatus] = useState('');
  const saved = useRef({ text: '', feeling: '' });
  const ready = useRef(false);
  const timer = useRef(null);
  const area = useRef(null);
  const latest = useRef({ text: '', feeling: '' });
  latest.current = { text, feeling };

  // Load the note once, and follow later changes (from another device) while nothing is unsaved.
  useEffect(() => {
    if (note === undefined) return;
    const incoming = { text: note?.text ?? '', feeling: note?.feeling ?? '' };
    const clean = !ready.current || (latest.current.text === saved.current.text && latest.current.feeling === saved.current.feeling);
    if (clean) {
      setText(incoming.text);
      setFeeling(incoming.feeling);
      saved.current = incoming;
    }
    ready.current = true;
  }, [note]);

  const flush = async () => {
    clearTimeout(timer.current);
    const cur = latest.current;
    if (!ready.current || (cur.text === saved.current.text && cur.feeling === saved.current.feeling)) return;
    saved.current = { ...cur };
    await saveFoodNote({ date, text: cur.text, feeling: cur.feeling });
    setStatus('Saved');
  };
  const later = () => {
    setStatus('');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  };
  useEffect(() => () => void flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const addTime = () => {
    const el = area.current;
    el?.focus();
    const base = text && !text.endsWith('\n') ? `${text}\n` : text;
    const next = `${base}${clockNow()} – `;
    setText(next.slice(0, MAX));
    later();
    requestAnimationFrame(() => {
      el?.setSelectionRange(next.length, next.length);
    });
  };

  return (
    <div className="card">
      <label className="field">
        <span className="sr-only">What you ate</span>
        <textarea
          ref={area}
          className="journal-text"
          rows={8}
          maxLength={MAX}
          value={text}
          placeholder="What did you eat today? Write as much or as little as you like."
          onChange={(e) => {
            setText(e.target.value);
            later();
          }}
          onBlur={flush}
        />
      </label>
      <div className="actions">
        <button type="button" className="btn btn-ghost btn-small" onClick={addTime}>
          Add the time
        </button>
        <span className="muted" role="status">
          {status}
          {text.length > MAX - 500 ? ` ${MAX - text.length} characters left` : ''}
        </span>
      </div>
      <p className="muted">How did eating feel today? (optional)</p>
      <div className="chips" role="group" aria-label="How eating felt">
        {FEELINGS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`chip chip-btn${feeling === k ? ' on' : ''}`}
            aria-pressed={feeling === k}
            onClick={() => {
              setFeeling(feeling === k ? '' : k);
              latest.current = { text, feeling: feeling === k ? '' : k };
              later();
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Journal({ onSwitch }) {
  const todayStr = today();
  const [date, setDate] = useState(todayStr);
  const notes = useLiveQuery(listFoodNotes, [], []);
  const { workouts } = useWorkouts();

  // Self-heal if two devices each started a note for the same day.
  useEffect(() => {
    const seen = new Set();
    if (notes.some((n) => seen.size === seen.add(n.date).size)) mergeDuplicateNotes();
  }, [notes]);

  const trained = useMemo(() => (workouts ?? []).filter((w) => w.date === date), [workouts, date]);
  const earlier = useMemo(() => notes.filter((n) => n.date !== date).slice(0, 30), [notes, date]);

  return (
    <div className="food">
      <div className="card food-day">
        <div className="day-switch">
          <button type="button" className="btn btn-ghost btn-small" aria-label="Previous day" onClick={() => setDate(shift(date, -1))}>
            ‹
          </button>
          <label className="day-label">
            <span className="sr-only">Choose a day</span>
            <input type="date" value={date} max={todayStr} onChange={(e) => e.target.value && setDate(e.target.value > todayStr ? todayStr : e.target.value)} />
          </label>
          <button type="button" className="btn btn-ghost btn-small" aria-label="Next day" disabled={date >= todayStr} onClick={() => setDate(shift(date, 1))}>
            ›
          </button>
        </div>
        <h2>{dayLabel(date, todayStr)}</h2>
        {trained.length > 0 && <p className="muted">You trained: {trained.map((w) => (w.isActivity ? w.activity?.name || typeLabel(w.activity?.type) : w.name || 'Workout')).join(', ')}</p>}
      </div>

      <DayNote key={date} date={date} />

      {earlier.length > 0 && (
        <section className="card">
          <h3>Earlier days</h3>
          <ul className="plain food-list">
            {earlier.map((n) => (
              <li key={n.id}>
                <button type="button" className="food-row journal-row" onClick={() => setDate(n.date)} aria-label={`Open ${short(n.date)}`}>
                  <span className="food-time">{short(n.date)}</span>
                  <span className="food-name journal-preview">{n.text.trim().split('\n')[0] || FEELINGS.find(([k]) => k === n.feeling)?.[1]}</span>
                  <span aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="card">
        <p className="muted">Your journal stays with your other data and is included in backups. Want numbers? Calorie tracking keeps everything you have written here.</p>
        <div className="actions">
          <button type="button" className="btn btn-link" onClick={onSwitch}>
            Switch to calorie tracking
          </button>
        </div>
      </div>
    </div>
  );
}
