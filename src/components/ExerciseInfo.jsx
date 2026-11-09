import { useEffect, useState } from 'react';
import { curatedStretch } from '../stretches';
import { equipmentLabel, findExercise, imageUrls, loadHowTo, muscleLabel, useLibrary, youtubeUrl } from '../library';

// Pictures for an exercise: the start and end positions, swapped back and forth.
function Pictures({ id, name }) {
  const urls = imageUrls(id);
  const [frame, setFrame] = useState(0);
  const [broken, setBroken] = useState(false);
  const still = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (still || !urls.length || broken) return undefined;
    const t = setInterval(() => setFrame((f) => 1 - f), 900);
    return () => clearInterval(t);
  }, [still, urls.length, broken]);

  if (!urls.length || broken) return null;
  return (
    <div className={`ex-pics${still ? ' still' : ''}`}>
      {still ? (
        urls.map((u, i) => <img key={u} src={u} alt={`${name}, position ${i + 1}`} loading="lazy" onError={() => setBroken(true)} />)
      ) : (
        <img src={urls[frame]} alt={`${name} demonstration`} onError={() => setBroken(true)} />
      )}
    </div>
  );
}

// How-to sheet for one exercise: pictures, steps (when it's in the library) and video searches.
export default function ExerciseInfo({ name, onClose }) {
  const { list } = useLibrary();
  const entry = findExercise(list, name);
  const [steps, setSteps] = useState(null);
  const cur = curatedStretch(name);
  const stretch = entry?.category === 'stretching' || !!cur;

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let on = true;
    if (entry?.id) loadHowTo().then((h) => on && setSteps(h[entry.id] ?? []), () => on && setSteps([]));
    return () => {
      on = false;
    };
  }, [entry?.id]);

  const tags = entry ? [muscleLabel(entry.muscle), equipmentLabel(entry.equipment), entry.level].filter(Boolean) : [];
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={`How to: ${name}`}>
      <div className="sheet-head">
        <h2 className="sheet-title">{name}</h2>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="sheet-list ex-info">
        {tags.length > 0 && <p className="muted">{tags.join(' · ')}</p>}
        {cur && <p className="ex-cue">{cur.cue} Hold {cur.hold} seconds{cur.sides ? ' each side' : ''}.</p>}
        {entry && <Pictures id={entry.id} name={name} />}
        <div className="ex-links">
          <a className="btn" href={youtubeUrl(name, { shorts: true, stretch })} target="_blank" rel="noopener noreferrer">
            Watch Shorts
          </a>
          <a className="btn btn-ghost" href={youtubeUrl(name, { shorts: false, stretch })} target="_blank" rel="noopener noreferrer">
            Longer videos
          </a>
        </div>
        <p className="muted small">Opens a YouTube search for “{name}”.</p>
        {steps && steps.length > 0 && (
          <>
            <h3>How to do it</h3>
            <ol className="ex-steps">
              {steps.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
          </>
        )}
        {!entry && !cur && <p className="muted">This is your own exercise, so there are no built-in steps. The video links still work.</p>}
      </div>
    </div>
  );
}
