import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { listWorkouts } from '../db';

const METRICS = {
  top: { label: 'Top weight', value: (sets) => Math.max(...sets.map((s) => s.weight)), weighted: true },
  e1rm: {
    label: 'Estimated 1RM',
    value: (sets) => Math.max(...sets.map((s) => (s.reps === 1 ? s.weight : s.weight * (1 + s.reps / 30)))),
    weighted: true,
  },
  volume: { label: 'Total volume', value: (sets) => sets.reduce((a, s) => a + s.reps * s.weight, 0), weighted: true },
  reps: { label: 'Total reps', value: (sets) => sets.reduce((a, s) => a + s.reps, 0), weighted: false },
};

const round = (n) => Math.round(n * 10) / 10;
const shortDate = (iso) => {
  const [, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}`;
};

export default function Progress({ unit }) {
  const all = useLiveQuery(listWorkouts, [], null);
  const [exercise, setExercise] = useState('');
  const [metric, setMetric] = useState('top');

  const names = useMemo(
    () => (all ? [...new Set(all.map((w) => w.exercise))].sort((a, b) => a.localeCompare(b)) : []),
    [all],
  );
  const selected = names.includes(exercise) ? exercise : names[0] || '';

  const series = useMemo(() => {
    if (!all || !selected) return [];
    const byDate = new Map();
    for (const w of all) {
      if (w.exercise !== selected) continue;
      byDate.set(w.date, [...(byDate.get(w.date) ?? []), ...w.sets]);
    }
    const fn = METRICS[metric].value;
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, sets]) => ({ date, value: round(fn(sets)) }));
  }, [all, selected, metric]);

  if (!all) return <p className="muted">Loading…</p>;
  if (!names.length) return <p className="muted empty">Log a few workouts and your progress will show up here.</p>;

  const unitLabel = metric === 'reps' ? 'reps' : metric === 'volume' ? `${unit}·reps` : unit;
  const best = series.length ? Math.max(...series.map((p) => p.value)) : 0;
  const latest = series.length ? series[series.length - 1].value : 0;

  return (
    <div className="card">
      <h2>Progress</h2>
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
            {Object.entries(METRICS).map(([id, m]) => (
              <option key={id} value={id}>
                {m.label}
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

      {METRICS[metric].weighted && best === 0 && (
        <p className="muted">No weight was logged for this exercise. Try “Total reps”.</p>
      )}

      <div className="chart">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: 'var(--muted)', fontSize: 12 }} stroke="var(--line)" />
            <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} stroke="var(--line)" width={52} />
            <Tooltip
              formatter={(v) => [`${v} ${unitLabel}`, METRICS[metric].label]}
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
