import { useState } from 'react';
import { savePlace } from '../db';

const NEW = '__new__';

// Pick a saved place, or add one by name. Only the name is kept: Repwise never reads your location.
export default function PlacePicker({ places, value, onChange, label = 'Place' }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  async function add() {
    setError('');
    try {
      const p = await savePlace(name);
      onChange(p.id);
      setAdding(false);
      setName('');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="place-picker">
      <label className="field">
        <span>{label}</span>
        <select
          value={value ?? ''}
          onChange={(e) => {
            if (e.target.value === NEW) setAdding(true);
            else onChange(e.target.value || null);
          }}
        >
          <option value="">No place</option>
          {places.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value={NEW}>＋ New place…</option>
        </select>
      </label>
      {adding && (
        <div className="row place-add">
          <label className="field">
            <span>New place name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Planet Fitness, Riverside Park…" />
          </label>
          <button type="button" className="btn btn-small" onClick={add}>
            Add place
          </button>
          <button type="button" className="btn btn-small btn-ghost" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
