import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addFoodEntry, deleteFood, deleteFoodEntry, getProfile, listFoodLog, listFoods, restoreFoodEntry, saveFood, saveProfile, today, updateFoodEntry } from '../db';
import { averageCalories, byTime, dayTotals, entryTotals, fmtServings, fmtTime, frequentFoods, nowTime, parseQuick, round, searchFoods, usageFrom } from '../food';
import FoodComposer, { NutritionFields } from './FoodComposer';
import Journal from './Journal';
import { foodMode } from '../food';

const shift = (date, n) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
};
const dayLabel = (date, todayStr) => {
  if (date === todayStr) return 'Today';
  if (date === shift(todayStr, -1)) return 'Yesterday';
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};
const per = (f) => [f.calories != null ? `${Math.round(f.calories)} cal` : '', f.serving].filter(Boolean).join(' · ');
const defaultTime = (date, todayStr) => (date === todayStr ? nowTime() : '12:00');

function Goal({ profile, totals }) {
  const [edit, setEdit] = useState(false);
  const [cal, setCal] = useState('');
  const [pro, setPro] = useState('');
  const target = profile?.calorie_target;
  const pt = profile?.protein_target;
  const begin = () => {
    setCal(target ? String(target) : '');
    setPro(pt ? String(pt) : '');
    setEdit(true);
  };
  if (edit) {
    return (
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          await saveProfile({ calorie_target: cal, protein_target: pro });
          setEdit(false);
        }}
      >
        <div className="row">
          <label className="field">
            <span>Daily calories</span>
            <input type="number" inputMode="numeric" min="500" max="10000" value={cal} onChange={(e) => setCal(e.target.value)} />
          </label>
          <label className="field">
            <span>Daily protein (g)</span>
            <input type="number" inputMode="numeric" min="10" max="600" value={pro} onChange={(e) => setPro(e.target.value)} />
          </label>
        </div>
        <p className="muted">Optional. Leave a box empty for no target. Repwise doesn’t know your age or body, so pick numbers from your doctor, dietitian or a calculator you trust.</p>
        <div className="actions">
          <button type="submit" className="btn btn-small">
            Save goal
          </button>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setEdit(false)}>
            Cancel
          </button>
        </div>
      </form>
    );
  }
  return (
    <>
      {target ? (
        <>
          <div className="progress-bar" role="progressbar" aria-label="Calories toward your goal" aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(Math.round(totals.calories), target)}>
            <span style={{ width: `${Math.min(100, (totals.calories / target) * 100)}%` }} />
          </div>
          <p className="muted">
            {totals.calories <= target ? `${Math.round(target - totals.calories)} cal left of ${target}` : `${Math.round(totals.calories).toLocaleString()} of ${target.toLocaleString()} cal`}
            {pt ? ` · protein ${Math.round(totals.protein)} of ${pt} g` : ''}
          </p>
        </>
      ) : null}
      <button type="button" className="btn btn-link" onClick={begin}>
        {target || pt ? 'Change goal' : 'Set a daily goal (optional)'}
      </button>
    </>
  );
}

function MyFoods({ foods, onClose }) {
  const [editing, setEditing] = useState(null); // food, or {} for new
  const [nums, setNums] = useState({});
  const [name, setName] = useState('');
  const [serving, setServing] = useState('');
  const [err, setErr] = useState('');
  const open = (f) => {
    setEditing(f);
    setName(f.name ?? '');
    setServing(f.serving ?? '');
    setNums({ calories: f.calories ?? '', protein: f.protein ?? '', carbs: f.carbs ?? '', fat: f.fat ?? '' });
    setErr('');
  };
  return (
    <div>
      <div className="card editor-head">
        <button type="button" className="btn btn-ghost btn-small back" onClick={onClose}>
          ← Food
        </button>
        <h2>My foods</h2>
        <p className="muted">Foods you added yourself. They autofill when you type. Changing one doesn’t change what you already logged.</p>
      </div>
      {editing ? (
        <form
          className="card form"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await saveFood({ id: editing.id, name, serving, ...nums });
              setEditing(null);
            } catch (x) {
              setErr(x.message);
            }
          }}
        >
          <h3>{editing.id ? 'Edit food' : 'New food'}</h3>
          <label className="field">
            <span>Food</span>
            <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label className="field">
            <span>Serving size</span>
            <input value={serving} maxLength={60} placeholder="1 cup, 1 slice…" onChange={(e) => setServing(e.target.value)} />
          </label>
          <NutritionFields values={nums} onChange={setNums} />
          {err && <p className="error" role="alert">{err}</p>}
          <div className="actions">
            <button type="submit" className="btn" disabled={!name.trim()}>
              Save
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <button type="button" className="btn btn-block" onClick={() => open({})}>
            Add a food
          </button>
          {foods.length === 0 && <p className="muted">Nothing here yet. Foods you add while logging show up here.</p>}
          <ul className="card plain food-list">
            {foods.map((f) => (
              <li key={f.id}>
                <button type="button" className="food-row" onClick={() => open(f)}>
                  <span>
                    <strong>{f.name}</strong>
                    <span className="muted"> {per(f)}</span>
                  </span>
                  <span aria-hidden="true">›</span>
                </button>
                <button
                  type="button"
                  className="btn btn-link btn-danger btn-small"
                  aria-label={`Delete ${f.name}`}
                  onClick={() => window.confirm(`Delete “${f.name}” from your foods? Past entries stay.`) && deleteFood(f.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Tracker({ onSwitch }) {
  const todayStr = today();
  const [date, setDate] = useState(todayStr);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(null); // { food, isNew }
  const [editId, setEditId] = useState(null);
  const [view, setView] = useState('day');
  const [undo, setUndo] = useState(null);
  const inputRef = useRef(null);

  const log = useLiveQuery(listFoodLog, [], []);
  const foods = useLiveQuery(listFoods, [], []);
  const profile = useLiveQuery(async () => (await getProfile()) ?? null, [], null);

  const entries = useMemo(() => log.filter((e) => e.date === date).sort(byTime), [log, date]);
  const totals = useMemo(() => dayTotals(entries), [entries]);
  const { usage, last } = useMemo(() => usageFrom(log, todayStr), [log, todayStr]);
  const frequent = useMemo(() => frequentFoods(log, todayStr, 8), [log, todayStr]);
  const avg = useMemo(() => averageCalories(log, todayStr, 7), [log, todayStr]);
  const results = useMemo(() => searchFoods(query, { mine: foods, usage }), [query, foods, usage]);
  const quick = parseQuick(query);
  const yesterday = shift(todayStr, -1);
  const canCopy = date === todayStr && entries.length === 0 && log.some((e) => e.date === yesterday);
  const editing = editId ? log.find((e) => e.id === editId) : null;

  const pick = (food) => {
    const prev = last[food.id] ?? last[food.name?.toLowerCase?.()] ?? null;
    setPicked({ food: { ...food, servings: prev?.servings ?? 1 }, isNew: false });
    setQuery('');
  };
  const startNew = (seed) => {
    setPicked({ food: { name: seed.name ?? query.trim(), servings: 1, ...seed }, isNew: true });
    setQuery('');
  };
  const done = () => {
    setPicked(null);
    setEditId(null);
    inputRef.current?.focus();
  };

  async function saveNew(v) {
    let food_id = null;
    if (picked.isNew && v.keep) {
      const f = await saveFood({ name: v.name, serving: v.serving, calories: v.calories, protein: v.protein, carbs: v.carbs, fat: v.fat });
      food_id = f.id;
    } else if (!picked.isNew) food_id = picked.food.id;
    const row = await addFoodEntry({ date, time: v.time, name: v.name, serving: v.serving, servings: v.servings, calories: v.calories, protein: v.protein, carbs: v.carbs, fat: v.fat, food_id, notes: v.notes });
    setUndo({ id: row.id, name: row.name });
    done();
  }

  async function copyYesterday() {
    for (const e of log.filter((x) => x.date === yesterday).sort(byTime)) {
      await addFoodEntry({ ...e, date: todayStr, food_id: e.food_id });
    }
  }

  if (view === 'foods') return <MyFoods foods={foods} onClose={() => setView('day')} />;

  const onKey = (e) => {
    if (e.key !== 'Enter' || !query.trim()) return;
    e.preventDefault();
    if (quick && !results.length) startNew({ name: quick.name, calories: quick.calories, serving: '1 serving' });
    else if (results[0]) pick(results[0]);
    else startNew({});
  };

  return (
    <div className="food">
      <div className="card food-day">
        <div className="day-switch">
          <button type="button" className="btn btn-ghost btn-small" aria-label="Previous day" onClick={() => setDate(shift(date, -1))}>
            ‹
          </button>
          <label className="day-label">
            <span className="sr-only">Choose a day</span>
            <input type="date" value={date} max={todayStr} onChange={(e) => e.target.value && setDate(e.target.value > todayStr ? todayStr : e.target.value)} />
          </label>
          <button type="button" className="btn btn-ghost btn-small" aria-label="Next day" disabled={date >= todayStr} onClick={() => setDate(shift(date, 1))}>
            ›
          </button>
        </div>
        <h2>{dayLabel(date, todayStr)}</h2>
        <p className="food-total">
          <strong>{Math.round(totals.calories)}</strong> <span className="muted">cal</span>
          {totals.protein + totals.carbs + totals.fat > 0 && (
            <span className="muted">
              {' '}
              · {Math.round(totals.protein)}g protein · {Math.round(totals.carbs)}g carbs · {Math.round(totals.fat)}g fat
            </span>
          )}
        </p>
        {totals.unknown > 0 && <p className="muted">{totals.unknown} {totals.unknown === 1 ? 'entry has' : 'entries have'} no calories, so the total is a minimum.</p>}
        <Goal profile={profile} totals={totals} />
      </div>

      {!picked && !editing && (
        <div className="card food-add">
          <label className="field">
            <span>Add food</span>
            <input
              ref={inputRef}
              type="search"
              role="combobox"
              aria-expanded={!!query.trim()}
              aria-controls="food-suggest"
              autoComplete="off"
              autoCorrect="off"
              placeholder="Type a food, like “banana” or “chicken rice”"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKey}
            />
          </label>
          {query.trim() ? (
            <ul id="food-suggest" role="listbox" className="suggest-list plain">
              {results.map((f) => (
                <li key={f.id} role="option" aria-selected="false">
                  <button type="button" className="food-row" onClick={() => pick(f)}>
                    <span>
                      <strong>{f.name}</strong>
                      <span className="muted"> {per(f)}</span>
                    </span>
                    {!f.common && <span className="chip">Mine</span>}
                  </button>
                </li>
              ))}
              {quick && (
                <li role="option" aria-selected="false">
                  <button type="button" className="food-row" onClick={() => startNew({ name: quick.name, calories: quick.calories, serving: '1 serving' })}>
                    <span>
                      Log <strong>{quick.name}</strong> <span className="muted">· {quick.calories} cal</span>
                    </span>
                  </button>
                </li>
              )}
              <li role="option" aria-selected="false">
                <button type="button" className="food-row food-new" onClick={() => startNew({})}>
                  <span>
                    {results.length ? 'Not here? ' : 'No match. '}Add <strong>“{query.trim()}”</strong> as a new food
                  </span>
                </button>
              </li>
            </ul>
          ) : (
            frequent.length > 0 && (
              <div>
                <p className="muted">Often logged</p>
                <div className="chips">
                  {frequent.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className="chip chip-btn"
                      onClick={() => pick({ id: e.food_id ?? `entry:${e.id}`, name: e.name, serving: e.serving, calories: e.calories, protein: e.protein, carbs: e.carbs, fat: e.fat, notes: '' })}
                    >
                      {e.name}
                    </button>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}

      {picked && (
        <FoodComposer
          key={picked.food.id ?? picked.food.name}
          initial={{ ...picked.food, time: defaultTime(date, todayStr) }}
          isNew={picked.isNew}
          onSave={saveNew}
          onCancel={done}
        />
      )}

      {editing && (
        <FoodComposer
          key={editing.id}
          mode="edit"
          initial={editing}
          onSave={async (v) => {
            await updateFoodEntry(editing.id, { name: v.name, serving: v.serving, servings: v.servings, calories: v.calories, protein: v.protein, carbs: v.carbs, fat: v.fat, time: v.time, date: v.date, notes: v.notes });
            done();
          }}
          onCancel={done}
          onDelete={async () => {
            await deleteFoodEntry(editing.id);
            setUndo({ id: editing.id, name: editing.name, deleted: true });
            done();
          }}
          onAgain={async () => {
            await addFoodEntry({ ...editing, date: todayStr, time: nowTime() });
            setDate(todayStr);
            done();
          }}
        />
      )}

      {undo && (
        <p className="toast" role="status">
          {undo.deleted ? `Deleted ${undo.name}.` : `Added ${undo.name}.`}{' '}
          <button
            type="button"
            className="btn btn-link"
            onClick={async () => {
              if (undo.deleted) await restoreFoodEntry(undo.id);
              else await deleteFoodEntry(undo.id);
              setUndo(null);
            }}
          >
            Undo
          </button>
        </p>
      )}

      <section className="card">
        <h3>{entries.length ? 'Eaten' : 'Nothing logged yet'}</h3>
        {entries.length === 0 && <p className="muted">{date === todayStr ? 'Type above to log what you eat. No meals or categories, just add food as you go.' : 'Nothing was logged on this day.'}</p>}
        {canCopy && (
          <button type="button" className="btn btn-ghost" onClick={copyYesterday}>
            Copy yesterday’s foods
          </button>
        )}
        <ul className="plain food-list">
          {entries.map((e) => {
            const t = entryTotals(e);
            return (
              <li key={e.id}>
                <button type="button" className="food-row" onClick={() => { setPicked(null); setEditId(e.id); }} aria-label={`Edit ${e.name}`}>
                  <span className="food-time">{fmtTime(e.time) || '—'}</span>
                  <span className="food-name">
                    <strong>{e.name}</strong>
                    <span className="muted">
                      {' '}
                      {e.servings !== 1 ? `${fmtServings(e.servings)} × ` : ''}
                      {e.serving}
                    </span>
                  </span>
                  <span className="food-cal">{e.calories != null ? `${Math.round(t.calories)}` : '—'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="card">
        {avg && <p className="muted">7-day average: {avg.avg.toLocaleString()} cal a day ({avg.days} days logged).</p>}
        <div className="actions">
          <button type="button" className="btn btn-link" onClick={() => setView('foods')}>
            My foods{foods.length ? ` (${foods.length})` : ''}
          </button>
          <button type="button" className="btn btn-link" onClick={onSwitch}>
            Switch to journal
          </button>
        </div>
        <p className="muted">Built-in foods are rounded estimates. Check a label for exact numbers and add your own food to save them. Your food log is saved with your other data and included in backups.</p>
      </div>
    </div>
  );
}

// The Food tab: a simple daily journal, or full calorie tracking. Same data underneath, so
// switching never loses anything.
export default function Food() {
  const profile = useLiveQuery(async () => (await getProfile()) ?? null, [], undefined);
  const log = useLiveQuery(listFoodLog, [], undefined);
  if (profile === undefined || log === undefined) return null;
  const mode = foodMode(profile, log);
  const set = (food_mode) => saveProfile({ food_mode });
  return mode === 'journal' ? <Journal onSwitch={() => set('track')} /> : <Tracker onSwitch={() => set('journal')} />;
}
