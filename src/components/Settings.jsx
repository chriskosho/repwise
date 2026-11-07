import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { downloadExport, importFile } from '../backup';
import { getProfile, lastExportAt, saveProfile } from '../db';
import { heightIn, heightOut, lengthUnit } from '../units';
import { setPrefs, usePrefs } from '../prefs';

const REST_CHOICES = [30, 45, 60, 90, 120, 150, 180, 240, 300];
const restLabel = (s) => (s % 60 === 0 ? `${s / 60} min` : s > 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`);

const fmt = (iso) => (iso ? new Date(iso).toLocaleString() : 'never');

export default function Settings({ sync, unit, setUnit, onExported }) {
  const [email, setEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const [backupErr, setBackupErr] = useState('');
  const prefs = usePrefs();
  const profile = useLiveQuery(async () => (await getProfile()) ?? null, [], null);
  const [name, setName] = useState('');
  const [height, setHeight] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [signOutAsk, setSignOutAsk] = useState(false);
  const [deleteAsk, setDeleteAsk] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');

  // Show what's saved. (Typing is kept until you save.)
  useEffect(() => {
    setName(profile?.display_name ?? '');
    setHeight(profile?.height_cm != null ? String(heightOut(profile.height_cm, unit)) : '');
  }, [profile?.display_name, profile?.height_cm, unit]);

  async function onSaveProfile(e) {
    e.preventDefault();
    await saveProfile({ display_name: name, height_cm: height === '' ? null : heightIn(height, unit) });
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
      const { added, skipped, invalid, routines, exercises, body, goals } = await importFile(file);
      const parts = [`${added} new workout${added === 1 ? '' : 's'}`];
      if (routines) parts.push(`${routines} routine${routines === 1 ? '' : 's'}`);
      if (exercises) parts.push(`${exercises} exercise${exercises === 1 ? '' : 's'}`);
      if (body) parts.push(`${body} body entr${body === 1 ? 'y' : 'ies'}`);
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
        <h2>Sync</h2>
        {!sync.enabled && <p className="muted">Sync isn't configured in this build. Your data stays on this device.</p>}

        {sync.enabled && !sync.session && (
          <form onSubmit={sendLink} className="form">
            <p className="muted">Sign in to sync across devices. We'll email you a one-time link, no password needed.</p>
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
            {linkSent && <p className="success">Check your email and open the link on this device.</p>}
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
          <p className="muted">
            Alerts only work while Repwise is open and the screen is on. Browsers don't allow web apps to sound alarms from the
            background, which is why the screen stays on during a workout.
          </p>
        </div>
      </section>

      <section className="card">
        <h2>Profile</h2>
        <form className="form" onSubmit={onSaveProfile}>
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="given-name" />
          </label>
          <label className="field">
            <span>Weight unit</span>
            <select value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="lb">Pounds (lb)</option>
              <option value="kg">Kilograms (kg)</option>
            </select>
          </label>
          <label className="field">
            <span>Height ({lengthUnit(unit)})</span>
            <input type="number" inputMode="decimal" step="0.1" min="0" value={height} onChange={(e) => setHeight(e.target.value)} />
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
            Changing the unit only changes labels for lifting weights; logged workout weights are not converted. Body weight and measurements
            are stored in kg and cm and convert automatically.
          </p>
        </form>
      </section>

      <section className="card">
        <h2>Privacy</h2>
        <ul className="plain">
          <li>Your data is private to your account. Other people who use Repwise cannot see it.</li>
          <li>It is stored on this device and, if you sign in, in the project’s database. The person who runs that database technically has access to it.</li>
          <li>Repwise has no ads and no tracking, and your data is never sold or shared.</li>
          <li>Your email address is used only to sign you in.</li>
          <li>You can export everything at any time, and delete your account and all its data below.</li>
        </ul>
      </section>

      {sync.enabled && sync.session && (
        <section className="card danger-zone">
          <h2>Delete account</h2>
          <p className="muted">
            This permanently deletes your account and every workout, routine, measurement and goal stored on the server, and clears this device.
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
                <button type="button" className="btn btn-danger" disabled={deleteText.trim() !== 'DELETE' || deleteBusy} onClick={onDelete}>
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
