import { lazy, Suspense, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getProfile, listPlaces, listSessions, needsExportReminder, newActivity, saveProfile } from './db';
import { downloadExport } from './backup';
import { loadLibrary } from './library';
import { useRest } from './rest';
import { useSync } from './sync';
import { useOnline } from './useOnline';
import WorkoutTab, { EditSession } from './components/WorkoutTab';
import History from './components/History';
import Settings from './components/Settings';
import RestBar from './components/RestBar';
import RoutineEditor from './components/RoutineEditor';
import ActivityEditor from './components/ActivityEditor';
import { BodyIcon, HistoryIcon, Logo, ProgressIcon, SettingsIcon, WorkoutIcon } from './components/Icons';

// The chart library is the heaviest dependency, so load it only when needed.
const Progress = lazy(() => import('./components/Progress'));
const Body = lazy(() => import('./components/Body'));

const TABS = [
  ['workout', 'Workout', WorkoutIcon],
  ['history', 'History', HistoryIcon],
  ['progress', 'Progress', ProgressIcon],
  ['body', 'Body', BodyIcon],
  ['settings', 'Settings', SettingsIcon],
];

function readUnit() {
  try {
    return localStorage.getItem('repwise.unit') === 'kg' ? 'kg' : 'lb';
  } catch {
    return 'lb';
  }
}

function statusLabel(sync, online) {
  if (!sync.enabled || !sync.session) return 'Local only';
  if (!online) return sync.pending > 0 ? `Offline · ${sync.pending} pending` : 'Offline';
  if (sync.status === 'syncing') return 'Syncing…';
  if (sync.status === 'offline') return 'Offline';
  if (sync.status === 'error') return 'Sync error';
  if (sync.pending > 0) return `${sync.pending} pending`;
  return 'Synced';
}

export default function App() {
  const [tab, setTab] = useState('workout');
  const [editId, setEditId] = useState(null);
  const [routineView, setRoutineView] = useState(null); // { doc, isNew } while the routine editor is open
  const [activityView, setActivityView] = useState(null); // { doc, isNew } while the activity editor is open
  const [unitCache, setUnitCache] = useState(readUnit);
  const [dismissed, setDismissed] = useState(false);
  const [, setTick] = useState(0);
  const sync = useSync();
  const online = useOnline();
  const rest = useRest();

  const count = useLiveQuery(
    () => db.sessions.filter((s) => !s.deleted_at && s.ended_at && s.exercises.length > 0).count(),
    [],
    0,
  );

  // The unit lives in your profile (so it follows you between devices); a copy in
  // localStorage keeps it right before the profile has loaded.
  const profile = useLiveQuery(async () => (await getProfile()) ?? null, [], null);
  const unit = profile?.units ?? unitCache;
  useEffect(() => {
    if (!profile?.units) return;
    try {
      localStorage.setItem('repwise.unit', profile.units);
    } catch {
      /* ignore */
    }
  }, [profile?.units]);
  const setUnit = (u) => {
    setUnitCache(u);
    try {
      localStorage.setItem('repwise.unit', u);
    } catch {
      /* ignore */
    }
    saveProfile({ units: u });
  };

  const goTab = (id) => {
    setEditId(null);
    setRoutineView(null);
    setActivityView(null);
    setTab(id);
  };

  const openRoutine = (doc, isNew) => setRoutineView({ doc, isNew });

  // Fetch the exercise library quietly in the background so the picker opens instantly.
  useEffect(() => {
    const t = setTimeout(() => loadLibrary().catch(() => {}), 2500);
    return () => clearTimeout(t);
  }, []);

  const sessions = useLiveQuery(listSessions, [], []);
  const places = useLiveQuery(listPlaces, [], []);
  const openActivity = (doc, isNew = false) => setActivityView({ doc, isNew });

  const showReminder = count > 0 && !dismissed && needsExportReminder();
  const restVisible = rest.end != null || rest.over;

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">
          <Logo />
          <span>Repwise</span>
        </h1>
        <button
          type="button"
          className={`chip chip-${sync.status === 'error' ? 'error' : sync.session ? 'ok' : 'idle'}`}
          onClick={() => goTab('settings')}
          title={sync.error || undefined}
        >
          {statusLabel(sync, online)}
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
          <EditSession
            id={editId}
            unit={unit}
            onClose={() => setEditId(null)}
            onSaveRoutine={(doc) => {
              setEditId(null);
              openRoutine(doc, true);
            }}
          />
        ) : activityView ? (
          <ActivityEditor
            key={activityView.doc.id}
            initial={activityView.doc}
            isNew={activityView.isNew}
            places={places}
            unit={unit}
            onClose={() => setActivityView(null)}
          />
        ) : routineView ? (
          <RoutineEditor
            key={routineView.doc.id}
            initial={routineView.doc}
            isNew={routineView.isNew}
            sessions={sessions}
            onClose={() => setRoutineView(null)}
          />
        ) : (
          <>
            {tab === 'workout' && <WorkoutTab
                unit={unit}
                name={profile?.display_name}
                weekStart={profile?.week_start ?? 1}
                onOpenSession={setEditId}
                onLogActivity={() => openActivity(newActivity(), true)}
                onOpenActivity={(a) => openActivity(a)}
                onOpenRoutine={openRoutine}
                onShowHistory={() => goTab('history')}
              />}
            {tab === 'history' && (
              <History
                unit={unit}
                onOpenActivity={(a) => openActivity(a)}
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
            {tab === 'body' && (
              <Suspense fallback={<p className="muted">Loading…</p>}>
                <Body unit={unit} />
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
        {TABS.map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            className={tab === id && !editId && !routineView && !activityView ? 'tab active' : 'tab'}
            aria-current={tab === id && !editId && !routineView && !activityView ? 'page' : undefined}
            onClick={() => goTab(id)}
          >
            <span className="tab-icon">
              <Icon />
            </span>
            <span className="tab-label">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
