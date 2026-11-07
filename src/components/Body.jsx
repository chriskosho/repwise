import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { deleteBodyEntry, getProfile, listBodyEntries, listGoals, listSessions, saveBodyEntry, today } from '../db';
import { MEASUREMENTS, bmi, changeOver, latestWeightKg, measurementLabel, weightTrend } from '../body';
import { lengthIn, lengthOut, lengthUnit, weightIn, weightOut } from '../units';
import Goals from './Goals';

const RANGES = [
  ['30', '30 days'],
  ['90', '90 days'],
  ['all', 'All'],
];
const shortDate = (iso) => {
  const [, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}`;
};
const signed = (n) => `${n > 0 ? '+' : ''}${Math.round(n * 10) / 10}`;

function Change({ label, kg, unit }) {
  return (
    <div>
      <span className="stat-label">{label}</span>
      <strong>{kg == null ? '–' : `${signed(weightOut(kg, unit))} ${unit}`}</strong>
    </div>
  );
}

export default function Body({ unit }) {
  const entries = useLiveQuery(listBodyEntries, [], undefined);
  const goals = useLiveQuery(listGoals, [], []);
  const sessions = useLiveQuery(listSessions, [], []);
  const profile = useLiveQuery(async () => (await getProfile()) ?? null, [], null);

  const [date, setDate] = useState(today());
  const [weight, setWeight] = useState('');
  const [fat, setFat] = useState('');
  const [meas, setMeas] = useState({});
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState('');
  const [range, setRange] = useState('90');
  const [confirmId, setConfirmId] = useState(null);

  const lu = lengthUnit(unit);

  // Fill the form from whatever is already saved for the chosen date.
  const existing = useMemo(() => entries?.find((e) => e.date === date), [entries, date]);
  useEffect(() => {
    setWeight(existing?.weight_kg != null ? String(weightOut(existing.weight_kg, unit)) : '');
    setFat(existing?.body_fat != null ? String(existing.body_fat) : '');
    setMeas(
      Object.fromEntries(Object.entries(existing?.measurements ?? {}).map(([k, v]) => [k, String(lengthOut(v, unit))])),
    );
    setNotes(existing?.notes ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id, existing?.updated_at, date, unit]);

  const trend = useMemo(() => (entries ? weightTrend(entries) : []), [entries]);
  const shown = useMemo(() => {
    if (range === 'all' || !trend.length) return trend;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(range));
    const c = cutoff.toLocaleDateString('en-CA');
    return trend.filter((p) => p.date >= c);
  }, [trend, range]);
  const chart = shown.map((p) => ({ date: p.date, weight: weightOut(p.weight_kg, unit), trend: weightOut(p.trend_kg, unit) }));

  async function save(e) {
    e.preventDefault();
    setMsg('');
    const w = weight === '' ? null : weightIn(weight, unit);
    const f = fat === '' ? null : Number(fat);
    const m = Object.fromEntries(Object.entries(meas).filter(([, v]) => v !== '').map(([k, v]) => [k, lengthIn(v, unit)]));
    if (w == null && f == null && !Object.keys(m).length) return setMsg('Enter at least one number.');
    await saveBodyEntry({ date, weight_kg: w, body_fat: f, measurements: m, notes });
    setMsg(existing ? 'Updated.' : 'Saved.');
  }

  if (!entries) return <p className="muted">Loading…</p>;

  const latest = latestWeightKg(entries);
  const bmiVal = bmi(latest, profile?.height_cm);

  return (
    <div>
      <section className="card">
        <h2>Body</h2>
        <form className="form" onSubmit={save}>
          <div className="row">
            <label className="field">
              <span>Date</span>
              <input type="date" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} required />
            </label>
            <label className="field">
              <span>Weight ({unit})</span>
              <input type="number" inputMode="decimal" step="0.1" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </label>
            <label className="field">
              <span>Body fat (%)</span>
              <input type="number" inputMode="decimal" step="0.1" min="0" max="100" value={fat} onChange={(e) => setFat(e.target.value)} />
            </label>
          </div>

          <details className="more-fields">
            <summary>Measurements ({lu})</summary>
            <div className="meas-grid">
              {MEASUREMENTS.map(([k, label]) => (
                <label className="field" key={k}>
                  <span>{label}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    value={meas[k] ?? ''}
                    onChange={(e) => setMeas((m) => ({ ...m, [k]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
          </details>

          <label className="field">
            <span>Notes</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          </label>
          <div className="actions">
            <button type="submit" className="btn">
              {existing ? 'Update entry' : 'Save entry'}
            </button>
            {msg && (
              <span className={msg.startsWith('Enter') ? 'error' : 'success'} role="status">
                {msg}
              </span>
            )}
          </div>
        </form>
      </section>

      {trend.length > 0 && (
        <section className="card">
          <div className="section-head">
            <h2>Weight</h2>
            <div className="range">
              {RANGES.map(([id, label]) => (
                <button key={id} type="button" className="btn btn-small btn-ghost" aria-pressed={range === id} onClick={() => setRange(id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="stats">
            <div>
              <span className="stat-label">Latest</span>
              <strong>{latest != null ? `${weightOut(latest, unit)} ${unit}` : '–'}</strong>
            </div>
            <Change label="30 days" kg={changeOver(entries, 30)} unit={unit} />
            <Change label="90 days" kg={changeOver(entries, 90)} unit={unit} />
          </div>
          {bmiVal != null && <p className="muted">BMI {Math.round(bmiVal * 10) / 10} (a rough guide only; it ignores muscle).</p>}
          <div className="chart">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chart} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: 'var(--muted)', fontSize: 12 }} stroke="var(--line)" />
                <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--muted)', fontSize: 12 }} stroke="var(--line)" width={52} />
                <Tooltip
                  formatter={(v, name) => [`${v} ${unit}`, name === 'trend' ? '7-day average' : 'Weigh-in']}
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)' }}
                />
                <Line type="monotone" dataKey="weight" stroke="var(--muted)" strokeWidth={1} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="trend" stroke="var(--accent)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="muted">The line is a 7-day average, which smooths out day-to-day swings.</p>
        </section>
      )}

      <Goals goals={goals} sessions={sessions} entries={entries} profile={profile} unit={unit} latestKg={latest} />

      <section className="card">
        <h2>History</h2>
        {!entries.length && <p className="muted empty">Your weigh-ins and measurements will be listed here.</p>}
        {entries.map((e) => {
          const parts = [];
          if (e.weight_kg != null) parts.push(`${weightOut(e.weight_kg, unit)} ${unit}`);
          if (e.body_fat != null) parts.push(`${e.body_fat}% fat`);
          for (const [k, v] of Object.entries(e.measurements ?? {})) parts.push(`${measurementLabel(k)} ${lengthOut(v, unit)} ${lu}`);
          return (
            <div className="entry" key={e.id}>
              <div className="entry-main">
                <strong>{e.date}</strong>
                <span className="sets-summary">{parts.join(' · ')}</span>
                {e.notes && <span className="notes">{e.notes}</span>}
              </div>
              <div className="entry-actions">
                <button type="button" className="btn btn-small btn-ghost" onClick={() => setDate(e.date)}>
                  Edit
                </button>
                {confirmId === e.id ? (
                  <button
                    type="button"
                    className="btn btn-small btn-danger"
                    onClick={async () => {
                      await deleteBodyEntry(e.id);
                      setConfirmId(null);
                    }}
                  >
                    Confirm
                  </button>
                ) : (
                  <button type="button" className="btn btn-small btn-ghost" aria-label={`Delete entry ${e.date}`} onClick={() => setConfirmId(e.id)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
