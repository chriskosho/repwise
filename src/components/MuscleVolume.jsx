import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { muscleLookup, muscleWeek } from '../analytics';
import { listCustomExercises } from '../db';
import { muscleLabel, useLibrary } from '../library';
import { fmtVolume } from '../stats';

const WEEKS = 8;
const short = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function MuscleVolume({ sessions, unit, weekStart }) {
  const [weeksAgo, setWeeksAgo] = useState(0);
  const { list: library } = useLibrary();
  const custom = useLiveQuery(listCustomExercises, [], []);
  const lookup = useMemo(() => muscleLookup(library ?? [], custom), [library, custom]);
  const week = useMemo(() => muscleWeek(sessions, lookup, { weekStart, weeksAgo }), [sessions, lookup, weekStart, weeksAgo]);

  const rows = Object.entries(week.by)
    .map(([m, v]) => ({ m, label: m === 'other' ? 'Other / not set' : muscleLabel(m) || m, ...v }))
    .sort((a, b) => b.sets - a.sets);
  const max = Math.max(1, ...rows.map((r) => r.sets));
  const total = rows.reduce((a, r) => a + r.sets, 0);

  return (
    <section className="card">
      <h2>Sets by muscle</h2>
      <div className="stepper-row">
        <button type="button" className="btn btn-small btn-ghost" onClick={() => setWeeksAgo((n) => Math.min(WEEKS - 1, n + 1))} disabled={weeksAgo >= WEEKS - 1} aria-label="Previous week">
          ←
        </button>
        <strong>
          {weeksAgo === 0 ? 'This week' : weeksAgo === 1 ? 'Last week' : `${weeksAgo} weeks ago`}: {short(week.start)} – {short(week.end)}
        </strong>
        <button type="button" className="btn btn-small btn-ghost" onClick={() => setWeeksAgo((n) => Math.max(0, n - 1))} disabled={weeksAgo === 0} aria-label="Next week">
          →
        </button>
      </div>
      {!rows.length ? (
        <p className="muted empty">No finished workouts in this week.</p>
      ) : (
        <>
          <p className="muted">
            {total} working set{total === 1 ? '' : 's'}. Warm-ups aren’t counted, and each exercise counts toward its main muscle.
          </p>
          {rows.map((r) => (
            <div className="vol-row" key={r.m}>
              <div className="goal-top">
                <span>{r.label}</span>
                <span className="muted">
                  {r.sets} set{r.sets === 1 ? '' : 's'}
                  {r.volume > 0 ? ` · ${fmtVolume(r.volume)} ${unit}` : ''}
                </span>
              </div>
              <div className="bar" aria-hidden="true">
                <div className="bar-fill" style={{ width: `${(r.sets / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
