import { lazy, Suspense, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, needsExportReminder } from './db';
import { downloadExport } from './backup';
import { useSync } from './sync';
import LogForm from './components/LogForm';
import History from './components/History';
import Settings from './components/Settings';

// The chart library is the heaviest dependency, so load it only when needed.
const Progress = lazy(() => import('./components/Progress'));

const TABS = [
  ['log', 'Log'],
  ['history', 'History'],
  ['progress', 'Progress'],
  ['settings', 'Settings'],
];

function readUnit() {
  try {
    return localStorage.getItem('repwise.unit') === 'kg' ? 'kg' : 'lb';
  } catch {
    return 'lb';
  }
}

function statusLabel(sync) {
  if (!sync.enabled || !sync.session) return 'Local only';
  if (sync.status === 'syncing') return 'Syncing…';
  if (sync.status === 'offline') return 'Offline';
  if (sync.status === 'error') return 'Sync error';
  if (sync.pending > 0) return `${sync.pending} pending`;
  return 'Synced';
}

export default function App() {
  const [tab, setTab] = useState('log');
  const [editing, setEditing] = useState(null);
  const [unit, setUnitState] = useState(readUnit);
  const [dismissed, setDismissed] = useState(false);
  const [, setTick] = useState(0);
  const sync = useSync();

  const count = useLiveQuery(() => db.workouts.filter((w) => !w.deleted_at).count(), [], 0);

  const setUnit = (u) => {
    setUnitState(u);
    try {
      localStorage.setItem('repwise.unit', u);
    } catch {
      /* ignore */
    }
  };

  const showReminder = count > 0 && !dismissed && needsExportReminder();

  return (
    <div className="app">
      <header className="topbar">
        <h1>Repwise</h1>
        <button
          type="button"
          className={`chip chip-${sync.status === 'error' ? 'error' : sync.session ? 'ok' : 'idle'}`}
          onClick={() => setTab('settings')}
          title={sync.error || undefined}
        >
          {statusLabel(sync)}
        </button>
      </header>

      <main className="content">
        {showReminder && (
          <div className="banner" role="status">
            <span>It's been a week since your last backup.</span>
            <div className="banner-actions">
              <button
                type="button"
                className="btn btn-small"
                onClick={async () => {
                  await downloadExport();
                  setTick((t) => t + 1);
                }}
              >
                Export now
              </button>
              <button type="button" className="btn btn-small btn-ghost" onClick={() => setDismissed(true)}>
                Later
              </button>
            </div>
          </div>
        )}

        {tab === 'log' && (
          <LogForm
            key={editing?.id ?? 'new'}
            editing={editing}
            unit={unit}
            onDone={() => {
              if (editing) {
                setEditing(null);
                setTab('history');
              }
            }}
            onCancel={() => {
              setEditing(null);
              setTab('history');
            }}
          />
        )}
        {tab === 'history' && (
          <History
            unit={unit}
            onEdit={(w) => {
              setEditing(w);
              setTab('log');
            }}
          />
        )}
        {tab === 'progress' && (
          <Suspense fallback={<p className="muted">Loading…</p>}>
            <Progress unit={unit} />
          </Suspense>
        )}
        {tab === 'settings' && (
          <Settings sync={sync} unit={unit} setUnit={setUnit} onExported={() => setTick((t) => t + 1)} />
        )}
      </main>

      <nav className="tabbar" aria-label="Main">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'tab active' : 'tab'}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => {
              if (id !== 'log') setEditing(null);
              setTab(id);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
