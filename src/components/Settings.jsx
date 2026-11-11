import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { downloadExport, importFile } from '../backup';
import { convertLiftWeights, deleteCustomExercise, deletePlace, getProfile, listCustomExercises, updateCustomExercise, lastExportAt, listFoodLog, listPlaces, renamePlace, saveProfile, savePlace } from '../db';
import { heightFromParts, heightToParts } from '../units';
import { EQUIPMENT, MUSCLES, equipmentLabel, muscleLabel } from '../library';
import { MODES } from '../measure';
import { setPrefs, usePrefs } from '../prefs';
import { PLATE_DEFAULTS, parsePlates } from '../plates';
import { setTheme, useTheme } from '../theme';
import { ChangeLog } from './WhatsNew';
import { DONATE_URL, shareApp } from '../share';
import { resetDevice } from '../reset';
import { foodMode } from '../food';

const REST_CHOICES = [30, 45, 60, 90, 120, 150, 180, 240, 300];
const restLabel = (s) => (s % 60 === 0 ? `${s / 60} min` : s > 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`);

const fmt = (iso) => (iso ? new Date(iso).toLocaleString() : 'never');

function MyExercises() {
  const list = useLiveQuery(listCustomExercises, [], []);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [error, setError] = useState('');
  const modeLabel = (m) => (MODES.find(([k]) => k === m) ?? [])[1] ?? 'Automatic';

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      await updateCustomExercise(editing.id, editing);
      setEditing(null);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!list.length) return null;
  return (
    <section className="card">
      <h2>My exercises</h2>
      <p className="muted">Exercises you added yourself. Renaming one also updates it in past workouts and routines. Deleting one keeps your history.</p>
      <ul className="plain place-list">
        {list.map((c) => (
          <li key={c.id}>
            {editing?.id === c.id ? (
              <form className="stack" onSubmit={save}>
                <label className="field">
                  <span>Name</span>
                  <input value={editing.name} maxLength={100} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </label>
                <label className="field">
                  <span>Muscle</span>
                  <select value={editing.muscle || ''} onChange={(e) => setEditing({ ...editing, muscle: e.target.value })}>
                    <option value="">Not set</option>
                    {MUSCLES.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Equipment</span>
                  <select value={editing.equipment || ''} onChange={(e) => setEditing({ ...editing, equipment: e.target.value })}>
                    <option value="">Not set</option>
                    {EQUIPMENT.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Tracked by</span>
                  <select value={editing.mode || ''} onChange={(e) => setEditing({ ...editing, mode: e.target.value })}>
                    <option value="">Automatic</option>
                    {MODES.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="actions">
                  <button type="submit" className="btn btn-small">
                    Save
                  </button>
                  <button type="button" className="btn btn-small btn-ghost" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                </span>
              </form>
            ) : removing === c.id ? (
              <span className="actions">
                <span>Delete {c.name}? Past workouts keep it.</span>
                <button type="button" className="btn btn-small btn-danger-solid" onClick={() => deleteCustomExercise(c.id).then(() => setRemoving(null))}>
                  Yes, delete
                </button>
                <button type="button" className="btn btn-small btn-ghost" onClick={() => setRemoving(null)}>
                  Keep
                </button>
              </span>
            ) : (
              <>
                <span>
                  <strong>{c.name}</strong>
                  <span className="muted">
                    {' '}
                    {[muscleLabel(c.muscle), equipmentLabel(c.equipment), modeLabel(c.mode)].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="actions">
                  <button type="button" className="btn btn-small btn-ghost" onClick={() => { setError(''); setEditing({ id: c.id, name: c.name, muscle: c.muscle || '', equipment: c.equipment || '', mode: c.mode || '' }); }} aria-label={`Edit ${c.name}`}>
                    Edit
                  </button>
                  <button type="button" className="btn btn-small btn-ghost" onClick={() => setRemoving(c.id)} aria-label={`Delete ${c.name}`}>
                    Delete
                  </button>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function Places() {
  const places = useLiveQuery(listPlaces, [], []);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null); // { id, name }
  const [removing, setRemoving] = useState(null);
  const [error, setError] = useState('');

  async function run(fn) {
    setError('');
    try {
      await fn();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }

  return (
    <section className="card">
      <h2>Places</h2>
      <p className="muted">
        Name the places you train, like a gym or a park, and pick them on any workout or activity. Only the name you type is saved; Repwise
        never reads your location.
      </p>
      {places.length === 0 && <p className="muted empty">No places yet.</p>}
      <ul className="plain place-list">
        {places.map((p) => (
          <li key={p.id}>
            {editing?.id === p.id ? (
              <form
                className="row"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await run(() => renamePlace(p.id, editing.name))) setEditing(null);
                }}
              >
                <input value={editing.name} onChange={(e) => setEditing({ id: p.id, name: e.target.value })} maxLength={80} aria-label="Place name" />
                <button type="submit" className="btn btn-small">
                  Save
                </button>
                <button type="button" className="btn btn-small btn-ghost" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </form>
            ) : removing === p.id ? (
              <span className="actions">
                <span>Remove {p.name}? Workouts keep working, they just lose the place.</span>
                <button type="button" className="btn btn-small btn-danger-solid" onClick={() => run(() => deletePlace(p.id)).then(() => setRemoving(null))}>
                  Yes, remove
                </button>
                <button type="button" className="btn btn-small btn-ghost" onClick={() => setRemoving(null)}>
                  Keep
                </button>
              </span>
            ) : (
              <>
                <strong>{p.name}</strong>
                <span className="actions">
                  <button type="button" className="btn btn-small btn-ghost" onClick={() => setEditing({ id: p.id, name: p.name })} aria-label={`Rename ${p.name}`}>
                    Rename
                  </button>
                  <button type="button" className="btn btn-small btn-ghost" onClick={() => setRemoving(p.id)} aria-label={`Remove ${p.name}`}>
                    Remove
                  </button>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      <form
        className="row place-add"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => savePlace(name))) setName('');
        }}
      >
        <label className="field">
          <span>Add a place</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </label>
        <button type="submit" className="btn">
          Add
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function FoodModeCard() {
  const profile = useLiveQuery(async () => (await getProfile()) ?? null, [], undefined);
  const log = useLiveQuery(listFoodLog, [], []);
  if (profile === undefined) return null;
  const mode = foodMode(profile, log);
  const pick = (m) => saveProfile({ food_mode: m });
  return (
    <section className="card">
      <h2>Food</h2>
      <p className="muted">Choose how the food tab works. Switching never deletes anything.</p>
      <div className="choices">
        <button type="button" className={`choice${mode === 'journal' ? ' on' : ''}`} aria-pressed={mode === 'journal'} onClick={() => pick('journal')}>
          <strong>Journal</strong>
          <span className="muted">One note a day about what you ate. No numbers.</span>
        </button>
        <button type="button" className={`choice${mode === 'track' ? ' on' : ''}`} aria-pressed={mode === 'track'} onClick={() => pick('track')}>
          <strong>Track calories and macros</strong>
          <span className="muted">Search foods, set servings, see daily totals.</span>
        </button>
      </div>
    </section>
  );
}

function ShareCard() {
  const [note, setNote] = useState('');
  const onShare = async () => {
    const r = await shareApp();
    setNote(r === 'copied' ? 'Link copied.' : r === 'failed' ? 'Could not share. Copy the address from your browser instead.' : '');
  };
  return (
    <section className="card">
      <h2>Share and support</h2>
      <p className="muted">Repwise is free. If it helps you, tell a friend, or chip in to keep it going.</p>
      <div className="actions">
        <button type="button" className="btn" onClick={onShare}>
          Share Repwise
        </button>
        <a className="btn btn-ghost" href={DONATE_URL} target="_blank" rel="noopener noreferrer">
          Donate
        </a>
      </div>
      {note && (
        <p className="muted" role="status">
          {note}
        </p>
      )}
    </section>
  );
}

export default function Settings({ sync, unit, setUnit, onExported, plan = null, onboarded = false, onGuide = () => {} }) {
  const [pendingUnit, setPendingUnit] = useState(null);
  const [email, setEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const [backupErr, setBackupErr] = useState('');
  const prefs = usePrefs();
  const theme = useTheme();
  const profile = useLiveQuery(async () => (await getProfile()) ?? null, [], null);
  const [name, setName] = useState('');
  const [h1, setH1] = useState('');
  const [h2, setH2] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [signOutAsk, setSignOutAsk] = useState(false);
  const [deleteAsk, setDeleteAsk] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');

  // Show what's saved. (Typing is kept until you save.)
  useEffect(() => {
    setName(profile?.display_name ?? '');
    [setH1, setH2].forEach((fn, i) => fn(heightToParts(profile?.height_cm, unit)[i]));
  }, [profile?.display_name, profile?.height_cm, unit]);

  async function onSaveProfile(e) {
    e.preventDefault();
    await saveProfile({ display_name: name, height_cm: h1 === '' && h2 === '' ? null : heightFromParts(unit, h1, h2) });
    setProfileMsg('Saved.');
  }

  async function onDelete() {
    setDeleteErr('');
    setDeleteBusy(true);
    try {
      await sync.deleteAccount();
    } catch (err) {
      setDeleteErr(err?.message || 'Could not delete the account. Nothing was deleted; try again.');
      setDeleteBusy(false);
    }
  }

  async function sendLink(e) {
    e.preventDefault();
    setAuthError('');
    setBusy(true);
    try {
      await sync.signIn(email.trim());
      setLinkSent(true);
    } catch (err) {
      setAuthError(err?.message || 'Could not send the link.');
    } finally {
      setBusy(false);
    }
  }

  async function onExport() {
    setBackupErr('');
    const n = await downloadExport();
    setBackupMsg(`Exported ${n} workout${n === 1 ? '' : 's'}.`);
    onExported();
  }

  async function onImport(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBackupMsg('');
    setBackupErr('');
    try {
      const { added, skipped, invalid, routines, exercises, body, goals, places, activities, foods } = await importFile(file);
      const parts = [`${added} new workout${added === 1 ? '' : 's'}`];
      if (routines) parts.push(`${routines} routine${routines === 1 ? '' : 's'}`);
      if (exercises) parts.push(`${exercises} exercise${exercises === 1 ? '' : 's'}`);
      if (body) parts.push(`${body} body entr${body === 1 ? 'y' : 'ies'}`);
      if (activities) parts.push(`${activities} activit${activities === 1 ? 'y' : 'ies'}`);
      if (foods) parts.push(`${foods} food entr${foods === 1 ? 'y' : 'ies'}`);
      if (places) parts.push(`${places} place${places === 1 ? '' : 's'}`);
      if (goals) parts.push(`${goals} goal${goals === 1 ? '' : 's'}`);
      setBackupMsg(
        `Imported ${parts.join(', ')}` + (skipped ? `, skipped ${skipped} already here` : '') + (invalid ? `, ignored ${invalid} invalid` : '') + '.',
      );
    } catch (err) {
      setBackupErr(err.message);
    }
  }

  return (
    <div>
      <section className="card">
        <h2>Profile</h2>
        <form className="form" onSubmit={onSaveProfile}>
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="given-name" />
          </label>
          <label className="field">
            <span>Weight unit</span>
            <select value={unit} onChange={(e) => (e.target.value === unit ? null : setPendingUnit(e.target.value))}>
              <option value="lb">Pounds (lb)</option>
              <option value="kg">Kilograms (kg)</option>
            </select>
          </label>
          {pendingUnit && (
            <div className="notice" role="group" aria-label="Convert weights">
              <p>
                Switch to {pendingUnit === 'kg' ? 'kilograms' : 'pounds'}? Convert your logged lifts, routine targets and lift goals to{' '}
                {pendingUnit}, or only change the labels.
              </p>
              <span className="actions">
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={async () => {
                    const from = unit;
                    const to = pendingUnit;
                    setPendingUnit(null);
                    await convertLiftWeights(from, to);
                    setUnit(to);
                  }}
                >
                  Convert weights
                </button>
                <button
                  type="button"
                  className="btn btn-small btn-ghost"
                  onClick={() => {
                    setUnit(pendingUnit);
                    setPendingUnit(null);
                  }}
                >
                  Only change labels
                </button>
                <button type="button" className="btn btn-small btn-ghost" onClick={() => setPendingUnit(null)}>
                  Cancel
                </button>
              </span>
            </div>
          )}
          <div className="field">
            <span id="settings-height">Height</span>
            <div className="row" role="group" aria-labelledby="settings-height">
              <label className="field">
                <span>{unit === 'kg' ? 'Meters' : 'Feet'}</span>
                <input type="number" inputMode="numeric" min="0" max={unit === 'kg' ? 2 : 8} step="1" value={h1} onChange={(e) => setH1(e.target.value)} />
              </label>
              <label className="field">
                <span>{unit === 'kg' ? 'Centimeters' : 'Inches'}</span>
                <input type="number" inputMode="decimal" min="0" max={unit === 'kg' ? 99 : 11.9} step="any" value={h2} onChange={(e) => setH2(e.target.value)} />
              </label>
            </div>
          </div>
          <label className="field">
            <span>Appearance (this device)</span>
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="system">Match my device</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="field">
            <span>Week starts on</span>
            <select value={profile?.week_start ?? 1} onChange={(e) => saveProfile({ week_start: Number(e.target.value) })}>
              <option value={1}>Monday</option>
              <option value={0}>Sunday</option>
            </select>
          </label>
          <div className="actions">
            <button type="submit" className="btn">
              Save profile
            </button>
            {profileMsg && (
              <span className="success" role="status">
                {profileMsg}
              </span>
            )}
          </div>
          <p className="muted">
            When you change the unit you can convert logged lifting weights too, or only change the labels. Body weight and measurements are
            stored in kg and cm and always convert automatically.
          </p>
        </form>
      </section>

      <section className="card">
        <h2>Sync</h2>
        {!sync.enabled && <p className="muted">Sync isn't configured in this build. Your data stays on this device.</p>}

        {sync.enabled && !sync.session && (
          <form onSubmit={sendLink} className="form">
            <p className="muted">
              Sign in to sync across devices. We'll email you a one-time link, no password needed. The email can take up to 3 minutes to
              arrive.
            </p>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <button type="submit" className="btn" disabled={busy}>
              {busy ? 'Sending…' : 'Send magic link'}
            </button>
            {linkSent && (
              <p className="success">
                Link sent. It can take up to 3 minutes to arrive, so please wait before trying again (check spam too). Open it on this device.
              </p>
            )}
            {authError && (
              <p className="error" role="alert">
                {authError}
              </p>
            )}
          </form>
        )}

        {sync.enabled && sync.session && (
          <div className="form">
            <p>
              Signed in as <strong>{sync.session.user.email}</strong>
            </p>
            <p className="muted">
              Last synced: {fmt(sync.lastSynced)}
              {sync.pending > 0 ? ` · ${sync.pending} change${sync.pending === 1 ? '' : 's'} waiting to upload` : ''}
            </p>
            {sync.status === 'error' && (
              <p className="error" role="alert">
                {sync.error}
              </p>
            )}
            <div className="actions">
              <button type="button" className="btn" onClick={sync.syncNow} disabled={sync.status === 'syncing'}>
                {sync.status === 'syncing' ? 'Syncing…' : 'Sync now'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setSignOutAsk(true)}>
                Sign out
              </button>
            </div>
            {signOutAsk && (
              <div className="menu" role="alertdialog" aria-label="Confirm sign out">
                <p>
                  Signing out also clears Repwise from this device, so the next person here sees none of your data. Everything that has synced is safe
                  and comes back when you sign in.
                </p>
                {sync.pending > 0 && (
                  <p className="error">
                    {sync.pending} change{sync.pending === 1 ? ' hasn’t' : 's haven’t'} uploaded yet and would be lost. Press “Sync now” first.
                  </p>
                )}
                <div className="actions">
                  <button type="button" className="btn btn-danger" onClick={sync.signOut}>
                    Sign out and clear this device
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setSignOutAsk(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Workout</h2>
        <div className="form">
          <label className="check-row">
            <input type="checkbox" checked={prefs.restEnabled} onChange={(e) => setPrefs({ restEnabled: e.target.checked })} />
            <span>Start the rest timer when I complete a set</span>
          </label>
          <label className="field">
            <span>Default rest</span>
            <select
              value={prefs.restSeconds}
              disabled={!prefs.restEnabled}
              onChange={(e) => setPrefs({ restSeconds: Number(e.target.value) })}
            >
              {REST_CHOICES.map((s) => (
                <option key={s} value={s}>
                  {restLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={prefs.alerts} onChange={(e) => setPrefs({ alerts: e.target.checked })} />
            <span>Sound and vibration when rest ends</span>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={prefs.keepAwake} onChange={(e) => setPrefs({ keepAwake: e.target.checked })} />
            <span>Keep the screen on during a workout</span>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={prefs.showPlates} onChange={(e) => setPrefs({ showPlates: e.target.checked })} />
            <span>Show which plates to load for barbell lifts</span>
          </label>
          {prefs.showPlates && (
            <div className="row">
              <label className="field">
                <span>Bar weight ({unit})</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={prefs[`bar_${unit}`] ?? PLATE_DEFAULTS[unit].bar}
                  onChange={(e) => setPrefs({ [`bar_${unit}`]: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Plates you have, per side ({unit})</span>
                <input
                  value={prefs[`plates_${unit}`] ?? PLATE_DEFAULTS[unit].plates}
                  onChange={(e) => setPrefs({ [`plates_${unit}`]: e.target.value })}
                  onBlur={(e) => setPrefs({ [`plates_${unit}`]: parsePlates(e.target.value).join(', ') || PLATE_DEFAULTS[unit].plates })}
                />
              </label>
            </div>
          )}
          <p className="muted">
            Alerts only work while Repwise is open and the screen is on. Browsers don't allow web apps to sound alarms from the
            background, which is why the screen stays on during a workout.
          </p>
        </div>
      </section>

      <FoodModeCard />

      <ShareCard />

      <section className="card">
        <h2>What’s new</h2>
        <ChangeLog />
      </section>

      <section className="card">
        <h2>Plan and tour</h2>
        <p className="muted">
          {plan ? `Active plan: ${plan.length} days starting ${plan.start}.` : 'No active plan.'} Plans are built from a few questions about your goal and schedule.
        </p>
        <div className="actions">
          <button type="button" className="btn" onClick={() => onGuide(onboarded ? 'plan' : 'first')}>
            {plan ? 'Build a new plan' : 'Set up my plan'}
          </button>
          {plan && (
            <button type="button" className="btn btn-ghost" onClick={() => onGuide('plan-view')}>
              View plan
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => onGuide('tour')}>
            Take the tour
          </button>
        </div>
      </section>

      <MyExercises />
      <Places />

      <section className="card">
        <h2>Backup</h2>
        <p className="muted">Last export: {fmt(lastExportAt())}. Keep exported files somewhere safe, like a cloud folder.</p>
        <div className="actions">
          <button type="button" className="btn" onClick={onExport}>
            Export JSON
          </button>
          <label className="btn btn-ghost file-btn">
            Import JSON
            <input type="file" accept="application/json,.json" onChange={onImport} hidden />
          </label>
        </div>
        {backupMsg && <p className="success">{backupMsg}</p>}
        {backupErr && (
          <p className="error" role="alert">
            {backupErr}
          </p>
        )}
      </section>

      <section className="card">
        <h2>Privacy</h2>
        <ul className="plain">
          <li>Your data is private to your account. Other people who use Repwise cannot see it.</li>
          <li>It is stored on this device and, if you sign in, in the project’s database. The person who runs that database technically has access to it.</li>
          <li>Repwise has no ads and no tracking, and your data is never sold or shared.</li>
          <li>Your email address is used only to sign you in.</li>
          <li>Places are just names you type. Repwise never asks for or reads your device location, and there is no GPS tracking.</li>
          <li>You can export everything at any time, and delete your account and all its data below.</li>
        </ul>
      </section>

      <section className="card danger-zone">
        <h2>Start over</h2>
        <p className="muted">
          <strong>Restart setup</strong> clears your answers and plan and walks you through the welcome questions again. Your workouts stay.
        </p>
        <div className="actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={async () => {
              if (!window.confirm('Restart the welcome setup? Your current plan and answers are replaced. Workouts are kept.')) return;
              await saveProfile({ onboarding: null, plan: null });
              onGuide('first');
            }}
          >
            Restart setup
          </button>
        </div>
        <p className="muted">
          <strong>Clear this device</strong> deletes all Repwise data and settings stored in this browser, including progress photos, and the saved copy of the app. {sync.session ? 'You will be signed out. Anything already synced stays in your account.' : 'Export a backup first if you want to keep anything: nothing is stored anywhere else.'}
        </p>
        <button
          type="button"
          className="btn btn-danger"
          onClick={async () => {
            if (!window.confirm('Clear everything Repwise stores on this device? This can’t be undone.')) return;
            await resetDevice(sync.session ? sync.signOut : null);
            window.location.reload();
          }}
        >
          Clear this device…
        </button>
      </section>

      {sync.enabled && sync.session && (
        <section className="card danger-zone">
          <h2>Delete account</h2>
          <p className="muted">
            This permanently deletes your account and every workout, activity, place, routine, measurement and goal stored on the server, and clears this device.
            It can’t be undone. Export a backup first if you want to keep anything.
          </p>
          {!deleteAsk ? (
            <button type="button" className="btn btn-danger" onClick={() => setDeleteAsk(true)}>
              Delete my account…
            </button>
          ) : (
            <div className="form">
              <label className="field">
                <span>Type DELETE to confirm</span>
                <input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} autoComplete="off" autoCapitalize="characters" />
              </label>
              {deleteErr && (
                <p className="error" role="alert">
                  {deleteErr}
                </p>
              )}
              <div className="actions">
                <button type="button" className="btn btn-danger-solid" disabled={deleteText.trim() !== 'DELETE' || deleteBusy} onClick={onDelete}>
                  {deleteBusy ? 'Deleting…' : 'Permanently delete my account'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={deleteBusy}
                  onClick={() => {
                    setDeleteAsk(false);
                    setDeleteText('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
