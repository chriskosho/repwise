import { lazy, Suspense, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, needsExportReminder } from './db';
import { downloadExport } from './backup';
import { useRest } from './rest';
import { useSync } from './sync';
import WorkoutTab, { EditSession } from './components/WorkoutTab';
import History from './components/History';
import Settings from './components/Settings';
import RestBar from './components/RestBar';

// The chart library is the heaviest dependency, so load it only when needed.
const Progress = lazy(() => import('./components/Progress'));

const TABS = [
  ['workout', 'Workout'],
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
  const [tab, setTab] = useState('workout');
  const [editId, setEditId] = useState(null);
  const [unit, setUnitState] = useState(readUnit);
  const [dismissed, setDismissed] = useState(false);
  const [, setTick] = useState(0);
  const sync = useSync();
  const rest = useRest();

  const count = useLiveQuery(
    () => db.sessions.filter((s) => !s.deleted_at && s.ended_at && s.exercises.length > 0).count(),
    [],
    0,
  );

  const setUnit = (u) => {
    setUnitState(u);
    try {
      localStorage.setItem('repwise.unit', u);
    } catch {
      /* ignore */
    }
  };

  const goTab = (id) => {
    setEditId(null);
    setTab(id);
  };

  const showReminder = count > 0 && !dismissed && needsExportReminder();
  const restVisible = rest.end != null || rest.over;

  return (
    <div className="app">
      <header className="topbar">
        <h1>Repwise</h1>
        <button
          type="button"
          className={`chip chip-${sync.status === 'error' ? 'error' : sync.session ? 'ok' : 'idle'}`}
          onClick={() => goTab('settings')}
          title={sync.error || undefined}
        >
          {statusLabel(sync)}
        </button>
      </header>

      <main className={`content${restVisible ? ' with-rest' : ''}`}>
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

        {editId ? (
          <EditSession id={editId} unit={unit} onClose={() => setEditId(null)} />
        ) : (
          <>
            {tab === 'workout' && <WorkoutTab unit={unit} onOpenSession={setEditId} />}
            {tab === 'history' && (
              <History
                unit={unit}
                onOpen={(s, isActive) => {
                  if (isActive) setTab('workout');
                  else setEditId(s.id);
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
          </>
        )}
      </main>

      <RestBar />

      <nav className="tabbar" aria-label="Main">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id && !editId ? 'tab active' : 'tab'}
            aria-current={tab === id && !editId ? 'page' : undefined}
            onClick={() => goTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
