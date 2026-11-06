import { useState } from 'react';
import { downloadExport, importFile } from '../backup';
import { lastExportAt } from '../db';

const fmt = (iso) => (iso ? new Date(iso).toLocaleString() : 'never');

export default function Settings({ sync, unit, setUnit, onExported }) {
  const [email, setEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const [backupErr, setBackupErr] = useState('');

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
      const { added, skipped, invalid } = await importFile(file);
      setBackupMsg(
        `Imported ${added} new workout${added === 1 ? '' : 's'}` +
          (skipped ? `, skipped ${skipped} already here` : '') +
          (invalid ? `, ignored ${invalid} invalid` : '') +
          '.',
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
              <button type="button" className="btn btn-ghost" onClick={sync.signOut}>
                Sign out
              </button>
            </div>
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
        <h2>Preferences</h2>
        <label className="field">
          <span>Weight unit</span>
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="lb">Pounds (lb)</option>
            <option value="kg">Kilograms (kg)</option>
          </select>
        </label>
        <p className="muted">This changes labels only; it doesn't convert logged weights.</p>
      </section>
    </div>
  );
}
