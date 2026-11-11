import { useState } from 'react';
import { saveRoutine } from '../db';
import { plural } from '../stats';
import { STARTERS, STARTER_GROUPS, routineFromStarter } from '../starterRoutines';

// Browse ready-made routines and add the ones you want. Open by default until you have routines.
export default function StarterRoutines({ routines, defaultOpen = false, onPreview = null }) {
  const [open, setOpen] = useState(defaultOpen);
  const [busy, setBusy] = useState('');
  const have = new Set(routines.map((r) => (r.name || '').trim().toLowerCase()));

  async function add(st) {
    setBusy(st.id);
    try {
      await saveRoutine(routineFromStarter(st));
    } finally {
      setBusy('');
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-block btn-ghost" onClick={() => setOpen(true)}>
        Browse starter routines
      </button>
    );
  }
  return (
    <section className="card starters" aria-label="Starter routines">
      <div className="section-head">
        <h3>Starter routines</h3>
        <button type="button" className="btn btn-link btn-small" onClick={() => setOpen(false)}>
          Hide
        </button>
      </div>
      <p className="muted">Add any of these to your routines, then change them however you like.</p>
      {STARTER_GROUPS.map((g) => (
        <div key={g.id}>
          <h4 className="starter-group">{g.label}</h4>
          <ul className="starter-list">
            {STARTERS.filter((s) => s.group === g.id).map((s) => {
              const added = have.has(s.name.toLowerCase());
              const count = s.stretch ? s.names.length : s.exercises.length;
              return (
                <li key={s.id} className="starter-row">
                  {onPreview ? (
                    <button type="button" className="starter-info starter-open" aria-label={`View ${s.name}`} onClick={() => onPreview(s)}>
                      <strong>{s.name}</strong>
                      <span className="muted small">
                        {plural(count, s.stretch ? 'stretch' : 'exercise', s.stretch ? 'stretches' : undefined)} · {s.blurb}
                      </span>
                    </button>
                  ) : (
                    <div className="starter-info">
                      <strong>{s.name}</strong>
                      <span className="muted small">
                        {plural(count, s.stretch ? 'stretch' : 'exercise', s.stretch ? 'stretches' : undefined)} · {s.blurb}
                      </span>
                    </div>
                  )}
                  <button type="button" className="btn btn-small" disabled={added || busy === s.id} onClick={() => add(s)} aria-label={added ? `${s.name} added` : `Add ${s.name}`}>
                    {added ? 'Added' : 'Add'}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
