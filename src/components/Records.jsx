import { useMemo, useState } from 'react';
import { allRecords } from '../analytics';
import { fmtCardioTime, fmtSeconds, paceFromMinPerKm, setDistance } from '../measure';
import { fmtShortDate, fmtVolume, key, plural } from '../stats';
import { exName } from '../library';

const whole = (n) => Math.round(n).toLocaleString();

function Tile({ label, value, sub }) {
  return (
    <div className="tile">
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
      <span className="tile-sub">{sub}</span>
    </div>
  );
}

const dist = (mode, km, unit) => {
  const d = setDistance(mode, { distance: km }, unit);
  return d ? `${d.value} ${d.label}` : '';
};

// The tiles that make sense for how this exercise is measured.
function tilesFor(r, unit) {
  const t = [];
  if (r.mode === 'cardio') {
    if (r.distance) t.push(<Tile key="d" label="Longest distance" value={dist('cardio', r.distance.value, unit)} sub={fmtShortDate(r.distance.date)} />);
    if (r.duration) t.push(<Tile key="t" label="Longest time" value={fmtCardioTime(r.duration.value)} sub={fmtShortDate(r.duration.date)} />);
    if (r.pace)
      t.push(
        <Tile key="p" label={/bicycl|bike|row|skat|ellip/i.test(r.name) ? 'Best speed' : 'Best pace'} value={paceFromMinPerKm(r.name, r.pace.value, unit)} sub={`${dist('cardio', r.pace.distance, unit)} · ${fmtShortDate(r.pace.date)}`} />,
      );
  } else if (r.mode === 'time') {
    if (r.time) t.push(<Tile key="t" label="Longest hold" value={fmtSeconds(r.time.value)} sub={fmtShortDate(r.time.date)} />);
    if (r.totalTime) t.push(<Tile key="s" label="Best total" value={fmtSeconds(r.totalTime.value)} sub={`in one workout · ${fmtShortDate(r.totalTime.date)}`} />);
  } else if (r.mode === 'carry') {
    if (r.weight) t.push(<Tile key="w" label="Heaviest" value={`${whole(r.weight.value)} ${unit}`} sub={`${dist('carry', r.weight.distance, unit)} · ${fmtShortDate(r.weight.date)}`} />);
    if (r.distance) t.push(<Tile key="d" label="Longest" value={dist('carry', r.distance.value, unit)} sub={r.distance.weight ? `at ${whole(r.distance.weight)} ${unit}` : fmtShortDate(r.distance.date)} />);
  } else if (r.mode === 'bodyweight' || !r.weight) {
    if (r.reps) t.push(<Tile key="r" label="Most reps" value={`${r.reps.value}`} sub={`${r.reps.weight ? `+${whole(r.reps.weight)} ${unit} · ` : ''}${fmtShortDate(r.reps.date)}`} />);
    if (r.weight) t.push(<Tile key="w" label="Heaviest added" value={`${whole(r.weight.value)} ${unit}`} sub={`× ${r.weight.reps} · ${fmtShortDate(r.weight.date)}`} />);
    if (r.volume) t.push(<Tile key="v" label="Best volume" value={`${fmtVolume(r.volume.value)} ${unit}`} sub={fmtShortDate(r.volume.date)} />);
  } else {
    t.push(<Tile key="w" label="Heaviest" value={`${whole(r.weight.value)} ${unit}`} sub={`× ${r.weight.reps} · ${fmtShortDate(r.weight.date)}`} />);
    if (r.e1rm) t.push(<Tile key="e" label="Est. 1RM" value={`${whole(r.e1rm.value)} ${unit}`} sub={`from ${whole(r.e1rm.weight)} × ${r.e1rm.reps}`} />);
    if (r.volume) t.push(<Tile key="v" label="Best volume" value={`${fmtVolume(r.volume.value)} ${unit}`} sub={fmtShortDate(r.volume.date)} />);
  }
  return t;
}

export default function Records({ sessions, unit }) {
  const [q, setQ] = useState('');
  const records = useMemo(() => allRecords(sessions), [sessions]);
  const shown = records.filter((r) => !q.trim() || key(r.name).includes(key(q)));

  if (!records.length) return <p className="muted empty">Finish a workout and your personal records will be listed here.</p>;

  return (
    <section className="card">
      <h2>Personal records</h2>
      <label className="field">
        <span className="sr-only">Find an exercise</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an exercise" aria-label="Find an exercise" />
      </label>
      {!shown.length && <p className="muted empty">No exercises match.</p>}
      {shown.map((r) => {
        const tiles = tilesFor(r, unit);
        return (
          <div className="record" key={r.name}>
            <div className="record-head">
              <strong>{exName(r.name)}</strong>
              <span className="muted">{plural(r.count, 'workout')}</span>
            </div>
            {tiles.length ? <div className="tiles">{tiles}</div> : <p className="muted">Nothing to rank yet.</p>}
          </div>
        );
      })}
    </section>
  );
}
