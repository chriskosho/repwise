import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { listSessions } from '../db';
import { kmToLong, kmToShort, longUnit, shortUnit } from '../measure';
import { entriesFromSessions, key } from '../stats';

const sum = (sets, f) => sets.reduce((a, s) => a + f(s), 0);
const max = (sets, f) => Math.max(0, ...sets.map(f));
const eOf = (s) => (s.reps === 1 ? s.weight : s.weight * (1 + s.reps / 30));

// Which numbers you can chart depends on how the exercise is measured.
// value(sets, unit) -> number; label(unit) -> axis text.
const M = {
  top: { label: 'Top weight', value: (x) => max(x, (s) => s.weight), axis: (u) => u, weighted: true },
  e1rm: { label: 'Estimated 1RM', value: (x) => max(x, eOf), axis: (u) => u, weighted: true },
  volume: { label: 'Total volume', value: (x) => sum(x, (s) => s.reps * s.weight), axis: (u) => `${u}·reps`, weighted: true },
  reps: { label: 'Total reps', value: (x) => sum(x, (s) => s.reps), axis: () => 'reps' },
  bestReps: { label: 'Most reps in a set', value: (x) => max(x, (s) => s.reps), axis: () => 'reps' },
  hold: { label: 'Longest hold', value: (x) => max(x, (s) => s.time), axis: () => 'sec' },
  totalTime: { label: 'Total time', value: (x) => sum(x, (s) => s.time), axis: () => 'sec' },
  distance: { label: 'Distance', value: (x, u) => kmToLong(sum(x, (s) => s.distance), u), axis: (u) => longUnit(u) },
  minutes: { label: 'Time', value: (x) => sum(x, (s) => s.time) / 60, axis: () => 'min' },
  speed: {
    label: 'Average speed',
    value: (x, u) => {
      const km = sum(x, (s) => s.distance);
      const hrs = sum(x, (s) => (s.distance > 0 ? s.time : 0)) / 3600;
      return km > 0 && hrs > 0 ? kmToLong(km, u) / hrs : 0;
    },
    axis: (u) => (u === 'kg' ? 'km/h' : 'mph'),
  },
  carryDistance: { label: 'Longest carry', value: (x, u) => kmToShort(max(x, (s) => s.distance), u), axis: (u) => shortUnit(u) },
};
const BY_MODE = {
  weight: ['top', 'e1rm', 'volume', 'reps'],
  bodyweight: ['bestReps', 'reps', 'top'],
  time: ['hold', 'totalTime'],
  cardio: ['distance', 'minutes', 'speed'],
  carry: ['top', 'carryDistance'],
};

const round = (n) => Math.round(n * 10) / 10;
const shortDate = (iso) => {
  const [, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}`;
};

export default function ProgressCharts({ unit }) {
  const sessions = useLiveQuery(listSessions, [], undefined);
  const all = useMemo(() => (sessions ? entriesFromSessions(sessions.filter((s) => s.ended_at)) : null), [sessions]);
  const [exercise, setExercise] = useState('');
  const [metricPick, setMetric] = useState('top');

  // Only finished workouts count: a set ticked off mid-workout (say a warm-up) is not a result yet.
  // One entry per exercise, ignoring capitalization ("squat" and "Squat" are the same).
  const names = useMemo(() => {
    if (!all) return [];
    const m = new Map();
    for (const w of all) if (!m.has(key(w.exercise))) m.set(key(w.exercise), w.exercise);
    return [...m.values()].sort((a, b) => a.localeCompare(b));
  }, [all]);
  const selected = names.includes(exercise) ? exercise : names[0] || '';

  // How the chosen exercise is measured (the latest way you logged it).
  const mode = useMemo(() => {
    const list = (all ?? []).filter((w) => key(w.exercise) === key(selected));
    return list.length ? list[list.length - 1].mode : 'weight';
  }, [all, selected]);
  const ids = BY_MODE[mode] ?? BY_MODE.weight;
  const metric = ids.includes(metricPick) ? metricPick : ids[0];

  const series = useMemo(() => {
    if (!all || !selected) return [];
    const byDate = new Map();
    for (const w of all) {
      if (key(w.exercise) !== key(selected)) continue;
      byDate.set(w.date, [...(byDate.get(w.date) ?? []), ...w.sets]);
    }
    const fn = (sets) => M[metric].value(sets, unit);
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, sets]) => ({ date, value: round(fn(sets)) }));
  }, [all, selected, metric, unit]);

  if (!all) return <p className="muted">Loading…</p>;
  if (!names.length) return <p className="muted empty">Log a few workouts and your progress will show up here.</p>;

  const unitLabel = M[metric].axis(unit);
  const best = series.length ? Math.max(...series.map((p) => p.value)) : 0;
  const latest = series.length ? series[series.length - 1].value : 0;

  return (
    <div className="card">
      <h2>Exercise charts</h2>
      <div className="row">
        <label className="field">
          <span>Exercise</span>
          <select value={selected} onChange={(e) => setExercise(e.target.value)}>
            {names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Metric</span>
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            {ids.map((id) => (
              <option key={id} value={id}>
                {M[id].label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="stats">
        <div>
          <span className="stat-label">Sessions</span>
          <strong>{series.length}</strong>
        </div>
        <div>
          <span className="stat-label">Best</span>
          <strong>
            {best} {unitLabel}
          </strong>
        </div>
        <div>
          <span className="stat-label">Latest</span>
          <strong>
            {latest} {unitLabel}
          </strong>
        </div>
      </div>

      {M[metric].weighted && best === 0 && (
        <p className="muted">No weight was logged for this exercise. Try “Total reps”.</p>
      )}

      <div className="chart">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: 'var(--muted)', fontSize: 12 }} stroke="var(--line)" />
            <YAxis
              domain={[(min) => Math.max(0, Math.floor(min * 0.9)), (max) => Math.ceil(max * 1.05)]}
              allowDecimals={mode === 'cardio'}
              tick={{ fill: 'var(--muted)', fontSize: 12 }}
              stroke="var(--line)"
              width={52}
            />
            <Tooltip
              formatter={(v) => [`${v} ${unitLabel}`, M[metric].label]}
              labelFormatter={(d) => d}
              contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)' }}
            />
            <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
