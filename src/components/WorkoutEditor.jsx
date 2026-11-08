import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { blankSet, byNewest, deleteSession, listCustomExercises, newId, routineFromSession, saveSession, sessionOrder, toDoc } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { MODES, describeSet, fmtCardioTime, hasIncline, isLogged, kmToLong, kmToShort, longToKm, longUnit, modeOf, needsHint, resolveMode, shortToKm, shortUnit, usesRest } from '../measure';
import { useLibrary } from '../library';
import { computePRs, fmtClock, fmtNum, fmtVolume, previousSets, plural, sessionStats } from '../stats';
import { usePrefs } from '../prefs';
import { startRest, stopRest } from '../rest';
import { useNow } from '../useNow';
import ExercisePicker from './ExercisePicker';
import PlacePicker from './PlacePicker';
import ExerciseInfo from './ExerciseInfo';
import { InfoIcon } from './Icons';
import { listPlaces } from '../db';

const TYPES = [
  ['normal', 'Normal'],
  ['warmup', 'Warm-up'],
  ['drop', 'Drop set'],
  ['failure', 'Failure'],
];
const TYPE_LETTER = { warmup: 'W', drop: 'D', failure: 'F' };
const MAX_PREFILL_SETS = 8;

const nowIso = () => new Date().toISOString();
const normalizeSet = (s) => ({
  ...s,
  reps: Number(s.reps) || 0,
  weight: Number(s.weight) || 0,
  time: Number(s.time) || 0,
  distance: Number(s.distance) || 0,
  incline: Number(s.incline) || 0,
  done: true,
});
const round2 = (n) => Math.round(n * 100) / 100;

// A number box that shows one unit but stores another (minutes <-> seconds, miles <-> km).
// It keeps what you typed while you type, and follows outside changes (copying the last set).
function UnitInput({ value, toDisplay, fromDisplay, onValue, ...props }) {
  const show = (v) => (v === '' || v == null || Number(v) === 0 ? '' : String(toDisplay(Number(v))));
  const [text, setText] = useState(() => show(value));
  useEffect(() => {
    const mine = text === '' ? '' : fromDisplay(Number(text));
    if (!(mine === value || (mine === '' && (value === '' || value == null || Number(value) === 0)) || Math.abs(Number(mine) - Number(value)) < 1e-9)) setText(show(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input
      {...props}
      className="num"
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/[^0-9.]/g, '');
        setText(t);
        onValue(t === '' || Number.isNaN(Number(t)) ? '' : fromDisplay(Number(t)));
      }}
    />
  );
}

// How a set row is laid out for each way of measuring.
function layoutOf(mode, name) {
  if (mode === 'cardio') return hasIncline(name) ? 'cardio-incline' : 'cardio';
  if (mode === 'time' || mode === 'stretch') return 'time';
  if (mode === 'carry') return 'carry';
  return 'weights';
}
function headers(mode, name, unit) {
  switch (mode) {
    case 'bodyweight':
      return [`+${unit}`, 'Reps'];
    case 'time':
    case 'stretch':
      return ['Seconds'];
    case 'cardio':
      return ['Min', longUnit(unit), ...(hasIncline(name) ? ['Incline %'] : [])];
    case 'carry':
      return [unit, shortUnit(unit)];
    default:
      return [unit, 'Reps'];
  }
}

function Elapsed({ since }) {
  const now = useNow(1000);
  return <span className="elapsed">{fmtClock((now - Date.parse(since)) / 1000)}</span>;
}

// The workout screen. `mode` is 'active' (live workout with rest timer) or 'edit'
// (changing a finished workout). Changes save automatically a moment after you stop typing.
export default function WorkoutEditor({ initial, mode, sessions, unit, onFinish, onClose, onSaveRoutine }) {
  const active = mode === 'active';
  const prefs = usePrefs();
  const [session, setSession] = useState(() => toDoc(initial));
  const [picker, setPicker] = useState(false);
  const [openSet, setOpenSet] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [hint, setHint] = useState('');
  const [info, setInfo] = useState(null);
  const { list: library } = useLibrary();
  const custom = useLiveQuery(listCustomExercises, [], []);
  const places = useLiveQuery(listPlaces, [], []);

  const latest = useRef(session);
  const timer = useRef(null);
  const unsaved = useRef(false);
  const dead = useRef(false); // set once the workout is deleted, so nothing is saved after

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (dead.current || !unsaved.current) return Promise.resolve();
    unsaved.current = false;
    return saveSession(latest.current);
  }, []);

  const update = useCallback(
    (fn) => {
      const next = fn(latest.current);
      latest.current = next;
      unsaved.current = true;
      setSession(next);
      setHint('');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 400);
    },
    [flush],
  );

  // Save when the tab is hidden or closed, and when leaving the screen.
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  // Keep the screen on during a live workout so the rest timer can alert you.
  useEffect(() => {
    if (!active || !prefs.keepAwake || !navigator.wakeLock) return undefined;
    let lock = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        const l = await navigator.wakeLock.request('screen');
        if (cancelled) l.release().catch(() => {});
        else lock = l;
      } catch {
        /* not allowed right now; fine */
      }
    };
    acquire();
    const onVisible = () => document.visibilityState === 'visible' && acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release?.().catch(() => {});
    };
  }, [active, prefs.keepAwake]);

  // Earlier finished workouts, newest first: the source for "previous" and records.
  const prior = useMemo(() => {
    const me = sessionOrder(session);
    return sessions.filter((s) => s.id !== session.id && s.ended_at && sessionOrder(s) < me).sort(byNewest);
  }, [sessions, session.id, session.date, session.started_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const previous = useMemo(() => {
    const m = new Map();
    for (const ex of session.exercises) m.set(ex.id, previousSets(ex.name, prior));
    return m;
  }, [session.exercises, prior]);

  const prs = useMemo(() => computePRs(session.exercises, prior), [session.exercises, prior]);
  const stats = sessionStats(session);

  // Exercises from older routines or workouts have no measurement type yet. Work it out once
  // the library has loaded, unless sets were already logged (then what you entered decides).
  useEffect(() => {
    if (!library) return;
    const missing = latest.current.exercises.filter((e) => !e.mode && !e.sets.some((x) => x.done));
    if (!missing.length) return;
    update((s) => ({
      ...s,
      exercises: s.exercises.map((e) => (!e.mode && !e.sets.some((x) => x.done) ? { ...e, mode: resolveMode(e.name, { library, custom, prior }) } : e)),
    }));
  }, [library, session.exercises.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- edits ----
  const updateEx = (exId, fn) =>
    update((s) => ({ ...s, exercises: s.exercises.map((e) => (e.id === exId ? fn(e) : e)) }));
  const updateSet = (exId, setId, patch) =>
    updateEx(exId, (e) => ({ ...e, sets: e.sets.map((st) => (st.id === setId ? { ...st, ...patch } : st)) }));

  function addExercises(names) {
    setPicker(false);
    const fresh = [];
    for (const raw of names) {
      const name = raw.trim().replace(/\s+/g, ' ');
      if (!name) continue;
      // Start with as many empty sets as last time, so the "previous" column lines up.
      const prev = previousSets(name, prior);
      const count = Math.min(Math.max(prev.length, 1), MAX_PREFILL_SETS);
      const sets = Array.from({ length: count }, (_, i) => blankSet(prev[i]?.type ?? 'normal', !active));
      fresh.push({ id: newId(), name, mode: resolveMode(name, { library: library ?? [], custom, prior }), link: false, notes: '', sets });
    }
    if (fresh.length) update((s) => ({ ...s, exercises: [...s.exercises, ...fresh] }));
  }

  function addSet(ex) {
    const last = ex.sets[ex.sets.length - 1];
    const next = blankSet(last?.type === 'warmup' ? 'normal' : last?.type ?? 'normal', !active);
    if (last) {
      next.reps = last.reps;
      next.weight = last.weight;
      next.time = last.time ?? '';
      next.distance = last.distance ?? '';
      next.incline = last.incline ?? '';
    }
    updateEx(ex.id, (e) => ({ ...e, sets: [...e.sets, next] }));
  }

  function removeSet(ex, setId) {
    setOpenSet(null);
    updateEx(ex.id, (e) => ({ ...e, sets: e.sets.filter((st) => st.id !== setId) }));
  }

  function removeExercise(ex) {
    const hasDone = ex.sets.some((st) => st.done && isLogged(modeOf(ex), st));
    if (hasDone && !window.confirm(`Remove ${ex.name} and its sets?`)) return;
    setOpenMenu(null);
    update((s) => ({ ...s, exercises: s.exercises.filter((e) => e.id !== ex.id) }));
  }

  function moveExercise(exId, dir) {
    update((s) => {
      const i = s.exercises.findIndex((e) => e.id === exId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.exercises.length) return s;
      const list = [...s.exercises];
      [list[i], list[j]] = [list[j], list[i]];
      return { ...s, exercises: list };
    });
  }

  function toggleDone(ex, st, index) {
    if (st.done && active) {
      updateSet(ex.id, st.id, { done: false });
      return;
    }
    if (st.done) return; // finished workouts keep their sets; edit the numbers or remove the set
    const prev = previous.get(ex.id)?.[index];
    const mode = modeOf(ex);
    const pick = (cur, was) => (cur === '' || cur == null ? (was ? was : '') : cur);
    const filled = {
      reps: pick(st.reps, prev?.reps),
      weight: pick(st.weight, prev?.weight),
      time: pick(st.time, prev?.time),
      distance: pick(st.distance, prev?.distance),
      incline: pick(st.incline, prev?.incline),
    };
    if (!isLogged(mode, filled)) {
      setHint(needsHint(mode));
      return;
    }
    updateSet(ex.id, st.id, { ...Object.fromEntries(Object.entries(filled).map(([k, v]) => [k, v === '' ? (k === 'weight' || k === 'reps' ? 0 : '') : Number(v)])), done: true });
    // Supersets rest after the last exercise of the group, not between them.
    if (active && prefs.restEnabled && !ex.link && usesRest(mode)) startRest(prefs.restSeconds);
  }

  // ---- finishing ----
  async function finish() {
    const current = latest.current;
    const incomplete = current.exercises.some((e) => e.sets.some((s) => !s.done));
    if (incomplete && !window.confirm('Some sets are not marked done. Finish anyway? Unfinished sets are removed.')) return;
    const exercises = current.exercises
      .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done && isLogged(modeOf(e), normalizeSet(s))).map(normalizeSet) }))
      .filter((e) => e.sets.length);
    if (!exercises.length) {
      if (window.confirm('Nothing was logged. Discard this workout?')) await remove();
      return;
    }
    const done = { ...current, exercises, ended_at: nowIso() };
    latest.current = done;
    unsaved.current = true;
    stopRest();
    const saved = flush();
    onFinish({
      session: done,
      stats: sessionStats(done),
      prs: computePRs(done.exercises, prior).list,
    });
    await saved;
  }

  async function remove() {
    dead.current = true;
    if (timer.current) clearTimeout(timer.current);
    stopRest();
    await deleteSession(session.id);
    onClose?.();
  }

  async function discard() {
    if (window.confirm("Discard this workout? This can't be undone.")) await remove();
  }

  async function removeFinished() {
    if (window.confirm('Delete this workout? This can\'t be undone.')) await remove();
  }

  async function saveAndClose() {
    const exercises = latest.current.exercises
      .map((e) => ({ ...e, sets: e.sets.filter((s) => isLogged(modeOf(e), normalizeSet(s))).map(normalizeSet) }))
      .filter((e) => e.sets.length);
    if (!exercises.length) {
      if (window.confirm('This workout has no sets. Delete it?')) await remove();
      return;
    }
    latest.current = { ...latest.current, exercises, ended_at: latest.current.ended_at ?? nowIso() };
    unsaved.current = true;
    await flush();
    onClose();
  }

  // ---- render ----
  return (
    <div className="editor">
      <div className={`card editor-head${active ? ' sticky-head' : ''}`}>
        {!active && (
          <button type="button" className="btn btn-ghost btn-small back" onClick={saveAndClose}>
            ← Done
          </button>
        )}
        <input
          className="title-input"
          value={session.name}
          onChange={(e) => update((s) => ({ ...s, name: e.target.value }))}
          aria-label="Workout name"
          maxLength={60}
        />
        {active ? (
          <div className="live-row">
            <div className="live-stats">
              <Elapsed since={session.started_at} />
              <span className="muted">
                {[
                  (stats.sets > 0 || stats.cardioSec === 0) && plural(stats.sets, 'set'),
                  (stats.volume > 0 || stats.cardioSec === 0) && `${fmtVolume(stats.volume)} ${unit}`,
                  stats.cardioSec > 0 && `${fmtCardioTime(stats.cardioSec)} cardio`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
            <button type="button" className="btn" onClick={finish}>
              Finish
            </button>
          </div>
        ) : (
          <label className="field">
            <span>Date</span>
            <input
              type="date"
              value={session.date}
              onChange={(e) => e.target.value && update((s) => ({ ...s, date: e.target.value }))}
            />
          </label>
        )}
      </div>

      <details className="card details-card" open={Boolean(session.place_id || session.notes)}>
        <summary>Place and notes</summary>
        <div className="form">
          <PlacePicker places={places} value={session.place_id} onChange={(id) => update((s) => ({ ...s, place_id: id }))} />
          <label className="field">
            <span>Workout notes</span>
            <textarea
              rows={3}
              value={session.notes ?? ''}
              maxLength={2000}
              placeholder="How it went, how you felt…"
              onChange={(e) => update((s) => ({ ...s, notes: e.target.value }))}
            />
          </label>
        </div>
      </details>

      {session.exercises.map((ex, i) => {
        const prev = previous.get(ex.id) ?? [];
        const inChain = ex.link || session.exercises[i - 1]?.link;
        let normalCount = 0;
        return (
          <section key={ex.id} className={`card exercise${inChain ? ' in-superset' : ''}`}>
            <div className="exercise-head">
              <div>
                <h2>{ex.name}</h2>
                {inChain && <span className="badge">Superset</span>}
              </div>
              <button type="button" className="icon-btn" aria-label={`How to: ${ex.name}`} onClick={() => setInfo(ex.name)}>
                <InfoIcon />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                aria-expanded={openMenu === ex.id}
                aria-label={`${ex.name} options`}
                onClick={() => setOpenMenu(openMenu === ex.id ? null : ex.id)}
              >
                ⋯
              </button>
            </div>
            {ex.notes && openMenu !== ex.id && <p className="notes">{ex.notes}</p>}

            {openMenu === ex.id && (
              <div className="menu">
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={!!ex.link}
                    disabled={i === session.exercises.length - 1}
                    onChange={(e) => updateEx(ex.id, (x) => ({ ...x, link: e.target.checked }))}
                  />
                  <span>Superset with the next exercise</span>
                </label>
                <label className="field">
                  <span>Track by</span>
                  <select
                    value={modeOf(ex)}
                    onChange={(e) => {
                      if (ex.sets.some((x) => x.done) && !window.confirm('Sets you already logged were measured differently and will stop counting. Change anyway?')) return;
                      updateEx(ex.id, (x) => ({ ...x, mode: e.target.value }));
                    }}
                  >
                    {MODES.map(([m, label]) => (
                      <option key={m} value={m}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Notes</span>
                  <textarea
                    rows={2}
                    value={ex.notes}
                    maxLength={2000}
                    onChange={(e) => updateEx(ex.id, (x) => ({ ...x, notes: e.target.value }))}
                  />
                </label>
                <div className="actions">
                  <button type="button" className="btn btn-ghost btn-small" disabled={i === 0} onClick={() => moveExercise(ex.id, -1)}>
                    Move up
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    disabled={i === session.exercises.length - 1}
                    onClick={() => moveExercise(ex.id, 1)}
                  >
                    Move down
                  </button>
                  <button type="button" className="btn btn-ghost btn-small btn-danger" onClick={() => removeExercise(ex)}>
                    Remove exercise
                  </button>
                </div>
              </div>
            )}

            <div className={`sets-grid mode-${modeOf(ex)}`}>
              {modeOf(ex) === 'cardio' && prev[0] && (
                <p className="muted small last-time">Last time: {describeSet('cardio', prev[0], unit, ex.name)}</p>
              )}
              <div className={`set-row set-head layout-${layoutOf(modeOf(ex), ex.name)}`}>
                <span>Set</span>
                {layoutOf(modeOf(ex), ex.name) !== 'cardio' && layoutOf(modeOf(ex), ex.name) !== 'cardio-incline' && <span>Previous</span>}
                {headers(modeOf(ex), ex.name, unit).map((h) => (
                  <span key={h}>{h}</span>
                ))}
                <span>Done</span>
              </div>
              {ex.sets.map((st, idx) => {
                const mode = modeOf(ex);
                const layout = layoutOf(mode, ex.name);
                const label = st.type === 'normal' ? String(++normalCount) : TYPE_LETTER[st.type];
                const p = prev[idx];
                const flags = st.done ? prs.bySet.get(st.id) : null;
                const set = (patch) => updateSet(ex.id, st.id, patch);
                const secs = { toDisplay: (v) => v, fromDisplay: (v) => v };
                const mins = { toDisplay: (v) => round2(v / 60), fromDisplay: (v) => v * 60 };
                const longD = { toDisplay: (v) => round2(kmToLong(v, unit)), fromDisplay: (v) => longToKm(v, unit) };
                const shortD = { toDisplay: (v) => Math.round(kmToShort(v, unit)), fromDisplay: (v) => shortToKm(v, unit) };
                const ph = (v, f = (x) => x) => (p && Number(v) ? String(f(v)) : '0');
                return (
                  <div key={st.id}>
                    <div className={`set-row layout-${layout}${st.done ? ' is-done' : ''}`}>
                      <button
                        type="button"
                        className={`set-type type-${st.type}`}
                        aria-expanded={openSet === st.id}
                        aria-label={`Set ${label} options`}
                        onClick={() => setOpenSet(openSet === st.id ? null : st.id)}
                      >
                        {label}
                      </button>
                      {layout !== 'cardio' && layout !== 'cardio-incline' && <span className="prev">{p ? describeSet(mode, p, unit, ex.name) : '—'}</span>}
                      {(layout === 'weights' || layout === 'carry') && (
                        <input
                          className="num"
                          inputMode="decimal"
                          value={st.weight}
                          placeholder={p ? fmtNum(p.weight) : '0'}
                          aria-label={`Set ${label} ${mode === 'bodyweight' ? 'added weight' : 'weight'}`}
                          onChange={(e) => set({ weight: e.target.value.replace(/[^0-9.]/g, '') })}
                        />
                      )}
                      {layout === 'weights' && (
                        <input
                          className="num"
                          inputMode="numeric"
                          value={st.reps}
                          placeholder={p ? String(p.reps) : '0'}
                          aria-label={`Set ${label} reps`}
                          onChange={(e) => set({ reps: e.target.value.replace(/[^0-9]/g, '') })}
                        />
                      )}
                      {layout === 'time' && (
                        <UnitInput {...secs} inputMode="numeric" value={st.time} placeholder={ph(p?.time)} aria-label={`Set ${label} seconds`} onValue={(v) => set({ time: v })} />
                      )}
                      {(layout === 'cardio' || layout === 'cardio-incline') && (
                        <>
                          <UnitInput {...mins} inputMode="decimal" value={st.time} placeholder={ph(p?.time, (v) => round2(v / 60))} aria-label={`Set ${label} minutes`} onValue={(v) => set({ time: v })} />
                          <UnitInput {...longD} inputMode="decimal" value={st.distance} placeholder={ph(p?.distance, (v) => round2(kmToLong(v, unit)))} aria-label={`Set ${label} distance`} onValue={(v) => set({ distance: v })} />
                        </>
                      )}
                      {layout === 'cardio-incline' && (
                        <input
                          className="num"
                          inputMode="decimal"
                          value={st.incline}
                          placeholder={p?.incline ? String(p.incline) : '0'}
                          aria-label={`Set ${label} incline`}
                          onChange={(e) => set({ incline: e.target.value.replace(/[^0-9.]/g, '') })}
                        />
                      )}
                      {layout === 'carry' && (
                        <UnitInput {...shortD} inputMode="numeric" value={st.distance} placeholder={ph(p?.distance, (v) => Math.round(kmToShort(v, unit)))} aria-label={`Set ${label} distance`} onValue={(v) => set({ distance: v })} />
                      )}
                      <button
                        type="button"
                        className={`check${st.done ? ' on' : ''}`}
                        aria-pressed={st.done}
                        aria-label={st.done ? `Set ${label} done` : `Mark set ${label} done`}
                        onClick={() => toggleDone(ex, st, idx)}
                      >
                        ✓
                      </button>
                    </div>
                    {flags && (
                      <div className="pr-row">
                        {flags.weight && <span className="pr">Weight PR</span>}
                        {flags.orm && <span className="pr">1RM PR</span>}
                        {flags.reps && <span className="pr">Reps PR</span>}
                        {flags.time && <span className="pr">Hold PR</span>}
                        {flags.distance && <span className="pr">Distance PR</span>}
                        {flags.pace && <span className="pr">Pace PR</span>}
                      </div>
                    )}
                    {openSet === st.id && (
                      <div className="set-options" role="group" aria-label={`Set ${label} type`}>
                        {TYPES.map(([t, text]) => (
                          <button
                            key={t}
                            type="button"
                            className="btn btn-small btn-ghost"
                            aria-pressed={st.type === t}
                            onClick={() => {
                              updateSet(ex.id, st.id, { type: t });
                              setOpenSet(null);
                            }}
                          >
                            {text}
                          </button>
                        ))}
                        <button type="button" className="btn btn-small btn-ghost btn-danger" onClick={() => removeSet(ex, st.id)}>
                          Delete set
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => addSet(ex)}>
              + Add set
            </button>
          </section>
        );
      })}

      <button type="button" className="btn btn-block" onClick={() => setPicker(true)}>
        + Add exercise
      </button>

      {hint && (
        <p className="error" role="alert">
          {hint}
        </p>
      )}

      {!active && onSaveRoutine && (
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={async () => {
            await flush();
            onSaveRoutine(routineFromSession(latest.current));
          }}
        >
          Save as routine
        </button>
      )}
      {!active && (
        <button type="button" className="btn btn-ghost btn-danger btn-block" onClick={removeFinished}>
          Delete workout
        </button>
      )}
      {active && (
        <button type="button" className="btn btn-ghost btn-danger btn-block" onClick={discard}>
          Discard workout
        </button>
      )}

      {info && <ExerciseInfo name={info} onClose={() => setInfo(null)} />}
      {picker && <ExercisePicker sessions={sessions} onAdd={addExercises} onClose={() => setPicker(false)} />}
    </div>
  );
}
