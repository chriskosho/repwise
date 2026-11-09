import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { newActivity, newId, newRoutine, saveActivity, listSessions, today } from '../db';
import { useLibrary } from '../library';
import { plural as pl } from '../stats';
const plural = (n, w) => (w === 'stretch' ? pl(n, 'stretch', 'stretches') : pl(n, w));
import { PRESETS, REGIONS, REGION_IDS, TIMES, buildStretches, recentRegions, regionLabel, sessionSeconds, sessionTitle, stretchItem, swapStretch } from '../stretches';
import ExercisePicker from './ExercisePicker';
import ExerciseInfo from './ExerciseInfo';
import StretchGuide from './StretchGuide';
import { primeAudio } from '../rest';

const HOLDS = [15, 20, 30, 45, 60];
const mins = (secs) => Math.max(1, Math.round(secs / 60));

// Choose what to stretch and for how long, then do it with a timer or just log it.
// In pick mode (inside a workout) it only builds the list and hands it back.
export default function StretchBuilder({ preset = 'total', minutes: startMinutes = 10, pick = false, onUse, onClose, onEditActivity, onSaveRoutine }) {
  const { list: library } = useLibrary();
  const sessions = useLiveQuery(listSessions, [], []);
  const recent = useMemo(() => recentRegions(sessions, library, today()), [sessions, library]);
  const [regions, setRegions] = useState(() => PRESETS.find((p) => p.id === preset)?.regions ?? REGION_IDS);
  const [minutes, setMinutes] = useState(startMinutes);
  const [seed, setSeed] = useState(1);
  const [list, setList] = useState([]);
  const [guide, setGuide] = useState(false);
  const [saved, setSaved] = useState(null);
  const [adding, setAdding] = useState(false);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const edited = useRef(false);

  // "What I trained recently" can only be worked out once workouts and the library have loaded.
  useEffect(() => {
    if (preset === 'recent' && recent.length && !edited.current) setRegions(recent);
  }, [preset, recent]);

  useEffect(() => {
    setList(buildStretches({ regions, minutes, library: library ?? [], seed }));
  }, [regions, minutes, seed, library]);

  const all = regions.length === REGION_IDS.length;
  const toggle = (id) => {
    edited.current = true;
    setRegions((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  };
  const choose = (rs) => {
    edited.current = true;
    setRegions(rs);
  };
  const setHold = (i, hold) => setList((l) => l.map((s, k) => (k === i ? { ...s, hold: Number(hold) } : s)));
  const total = sessionSeconds(list);
  const title = sessionTitle(regions);

  async function log({ seconds, completed, names }) {
    setError('');
    try {
      const doc = await saveActivity({ ...newActivity(), type: 'stretching', title, duration_min: mins(seconds), stretches: completed ?? names ?? list.map((s) => s.name) });
      setSaved(doc);
    } catch (e) {
      setError(e.message || 'Could not save that.');
    }
  }

  function routineDoc() {
    return {
      ...newRoutine(),
      name: title.slice(0, 60),
      exercises: list.map((s) => ({ id: newId(), name: s.name, mode: 'stretch', link: false, notes: '', target: { time: s.hold }, sets: [{ id: newId(), type: 'normal' }] })),
    };
  }

  if (saved) {
    return (
      <div className="stretch-page">
        <h2>Nice. That is logged.</h2>
        <p className="muted">
          {title} · {saved.duration_min} min · {plural(saved.stretches.length, 'stretch')} saved to your activity history.
        </p>
        <button type="button" className="btn btn-big btn-block" onClick={onClose}>
          Done
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={() => onEditActivity?.(saved)}>
          Edit details
        </button>
      </div>
    );
  }

  if (guide) {
    return (
      <div className="stretch-page">
        <StretchGuide
          list={list}
          onExit={() => setGuide(false)}
          onFinish={(r) => {
            setGuide(false);
            if (r.completed.length || r.seconds >= 30) log({ seconds: Math.max(r.seconds, 60), completed: r.completed.length ? r.completed : list.map((s) => s.name) });
            else onClose();
          }}
        />
      </div>
    );
  }

  return (
    <div className={pick ? 'stretch-page stretch-pick' : 'stretch-page'}>
      <div className="sheet-head">
        <h2 className="sheet-title">{pick ? 'Add stretches' : 'Stretch'}</h2>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
      </div>

      <h3>What do you want to stretch?</h3>
      <div className="chips" role="group" aria-label="Quick picks">
        <button type="button" className={all ? 'chip-toggle on' : 'chip-toggle'} aria-pressed={all} onClick={() => choose(REGION_IDS)}>
          Total body
        </button>
        {PRESETS.map((p) => (
          <button key={p.id} type="button" className="chip-toggle" onClick={() => choose(p.regions)}>
            {p.label}
          </button>
        ))}
        {recent.length > 0 && (
          <button type="button" className="chip-toggle" onClick={() => choose(recent)}>
            What I trained recently
          </button>
        )}
      </div>
      <div className="chips" role="group" aria-label="Body areas">
        {REGIONS.map((r) => (
          <button key={r.id} type="button" className={regions.includes(r.id) ? 'chip-toggle on' : 'chip-toggle'} aria-pressed={regions.includes(r.id)} onClick={() => toggle(r.id)}>
            {r.label}
          </button>
        ))}
      </div>

      <h3>How long?</h3>
      <div className="chips" role="group" aria-label="Time">
        {TIMES.map((t) => (
          <button key={t} type="button" className={minutes === t ? 'chip-toggle on' : 'chip-toggle'} aria-pressed={minutes === t} onClick={() => setMinutes(t)}>
            {t} min
          </button>
        ))}
      </div>

      {regions.length === 0 ? (
        <p className="muted">Pick at least one area to build your stretches.</p>
      ) : (
        <>
          <div className="row">
            <h3>
              {plural(list.length, 'stretch')} · about {mins(total)} min
            </h3>
            <button type="button" className="btn btn-ghost" onClick={() => setSeed((s) => s + 1)}>
              Shuffle
            </button>
          </div>
          <ul className="list stretch-list">
            {list.map((s, i) => (
              <li key={s.name} className="stretch-row">
                <div>
                  <button type="button" className="stretch-name" onClick={() => setInfo(s.name)}>
                    {s.name}
                  </button>
                  <div className="muted small">{regionLabel(s.region)}</div>
                </div>
                <div className="stretch-ctl">
                  <select aria-label={`Hold time for ${s.name}`} value={s.hold} onChange={(e) => setHold(i, e.target.value)}>
                    {[...new Set([...HOLDS, s.hold])].sort((a, b) => a - b).map((h) => (
                      <option key={h} value={h}>
                        {h}s{s.sides ? ' each side' : ''}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-ghost" aria-label={`Swap ${s.name}`} onClick={() => setList((l) => swapStretch(l, i, { library: library ?? [], seed: seed + i + l.length }))}>
                    Swap
                  </button>
                  <button type="button" className="btn btn-ghost" aria-label={`Remove ${s.name}`} onClick={() => setList((l) => l.filter((_, k) => k !== i))}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <button type="button" className="btn btn-block" onClick={() => setAdding(true)}>
        + Add a stretch
      </button>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {pick ? (
        <button type="button" className="btn btn-big btn-block" disabled={!list.length} onClick={() => onUse(list)}>
          Add {plural(list.length, 'stretch')} to workout
        </button>
      ) : (
        <>
          <button
            type="button"
            className="btn btn-big btn-block"
            disabled={!list.length}
            onClick={() => {
              primeAudio();
              setGuide(true);
            }}
          >
            Start guided session
          </button>
          <button type="button" className="btn btn-block" disabled={!list.length} onClick={() => log({ seconds: total })}>
            Just log it
          </button>
          <button type="button" className="btn btn-ghost btn-block" disabled={!list.length} onClick={() => onSaveRoutine?.(routineDoc())}>
            Save as routine
          </button>
        </>
      )}

      {info && <ExerciseInfo name={info} onClose={() => setInfo(null)} />}
      {adding && (
        <ExercisePicker
          sessions={[]}
          initialCategory="stretching"
          onAdd={(names) => {
            setAdding(false);
            setList((l) => [...l, ...names.filter((n) => !l.some((x) => x.name.toLowerCase() === n.toLowerCase())).map((n) => stretchItem(n, library ?? []))]);
          }}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}
