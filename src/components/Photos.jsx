import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { POSES, addPhoto, deletePhoto, listPhotos, today, updatePhoto } from '../db';
import { photoUrl, prepareImage } from '../photos';
import { weightOut } from '../units';
import { diffDays } from '../plan';

const fmt = (d) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const poseLabel = (p) => (POSES.find(([k]) => k === p) ?? [])[1];

// Object URLs for the photos on screen, revoked when they go away.
function useUrls(photos) {
  const urls = useMemo(() => new Map((photos ?? []).map((p) => [p.id, photoUrl(p)])), [photos]);
  useEffect(() => () => urls.forEach((u) => u && URL.revokeObjectURL?.(u)), [urls]);
  return urls;
}

// Weight on or just before a date, so a photo can sit next to the number.
function weightOn(entries, date, unit) {
  const e = (entries ?? []).filter((x) => x.weight_kg != null && x.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0];
  return e ? `${weightOut(e.weight_kg, unit)} ${unit}` : null;
}

export default function Photos({ entries, unit }) {
  const photos = useLiveQuery(listPhotos, [], undefined);
  const urls = useUrls(photos);
  const input = useRef(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [compare, setCompare] = useState(false);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function onFile(e) {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    if (!files.length) return;
    setError('');
    setBusy(true);
    try {
      for (const f of files) {
        const img = await prepareImage(f);
        await addPhoto({ ...img, date: today() });
      }
      try {
        await navigator.storage?.persist?.();
      } catch {
        /* optional */
      }
    } catch (err) {
      setError(err.message || 'Could not add that photo.');
    } finally {
      setBusy(false);
    }
  }

  const open = photos?.find((p) => p.id === openId);
  const [a, b] = picked.map((id) => photos?.find((p) => p.id === id));

  function tap(p) {
    if (!compare) return setOpenId(p.id);
    setPicked((cur) => (cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id].slice(-2)));
  }
  function firstVsLatest() {
    if (photos?.length >= 2) setPicked([photos[photos.length - 1].id, photos[0].id]);
  }

  return (
    <section className="card photos">
      <div className="section-head">
        <h2>Progress photos</h2>
        {photos?.length >= 2 && (
          <button
            type="button"
            className="btn btn-small btn-ghost"
            aria-pressed={compare}
            onClick={() => {
              setCompare(!compare);
              setPicked([]);
              setOpenId(null);
            }}
          >
            {compare ? 'Done comparing' : 'Compare'}
          </button>
        )}
      </div>
      <p className="muted">Photos live only on this device, in this browser’s storage. They are not uploaded, synced or included in backups. They are lost if you clear this site’s data, delete your data here, or open Repwise in a different browser or on another device.</p>

      {compare && (
        <div className="photo-compare">
          {a && b ? (
            <div className="compare-pair">
              {[a, b].sort((x, y) => x.date.localeCompare(y.date)).map((p) => (
                <figure key={p.id}>
                  <img src={urls.get(p.id)} alt={`Photo from ${fmt(p.date)}`} />
                  <figcaption>
                    <strong>{fmt(p.date)}</strong>
                    {weightOn(entries, p.date, unit) && <span> · {weightOn(entries, p.date, unit)}</span>}
                    {p.pose && <span className="muted"> · {poseLabel(p.pose)}</span>}
                  </figcaption>
                </figure>
              ))}
              <p className="muted">{Math.abs(diffDays(a.date, b.date))} days apart</p>
            </div>
          ) : (
            <p className="muted">Tap two photos to compare them.</p>
          )}
          <button type="button" className="btn btn-small btn-ghost" onClick={firstVsLatest}>
            First vs latest
          </button>
        </div>
      )}

      {open && !compare && (
        <div className="photo-open">
          <img src={urls.get(open.id)} alt={`Photo from ${fmt(open.date)}`} />
          <div className="row">
            <label className="field">
              <span>Date</span>
              <input type="date" value={open.date} max={today()} onChange={(e) => e.target.value && updatePhoto(open.id, { date: e.target.value })} />
            </label>
            <label className="field">
              <span>Pose</span>
              <select value={open.pose} onChange={(e) => updatePhoto(open.id, { pose: e.target.value })}>
                {POSES.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>Note</span>
            <input value={open.note} maxLength={200} onChange={(e) => updatePhoto(open.id, { note: e.target.value })} />
          </label>
          <div className="actions">
            <button type="button" className="btn btn-ghost" onClick={() => { setOpenId(null); setConfirm(false); }}>
              Close
            </button>
            {confirm ? (
              <button type="button" className="btn btn-danger" onClick={() => deletePhoto(open.id).then(() => { setOpenId(null); setConfirm(false); })}>
                Yes, delete photo
              </button>
            ) : (
              <button type="button" className="btn btn-ghost btn-danger" onClick={() => setConfirm(true)}>
                Delete
              </button>
            )}
          </div>
        </div>
      )}

      {photos?.length > 0 && (
        <ul className="photo-grid plain">
          {photos.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={`photo-thumb${picked.includes(p.id) ? ' on' : ''}`}
                aria-label={`${compare ? 'Select' : 'Open'} photo from ${fmt(p.date)}${p.pose ? `, ${poseLabel(p.pose)}` : ''}`}
                aria-pressed={compare ? picked.includes(p.id) : undefined}
                onClick={() => tap(p)}
              >
                <img src={urls.get(p.id)} alt="" loading="lazy" />
                <span>{fmt(p.date)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {photos && photos.length === 0 && <p className="muted empty">Add a photo now and another in a few weeks to see the change side by side.</p>}

      <input ref={input} type="file" accept="image/*" multiple hidden onChange={onFile} aria-label="Choose photos" />
      <button type="button" className="btn btn-small" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'Adding…' : 'Add photo'}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
