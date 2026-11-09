import { lazy, Suspense, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getProfile, today, listFoodLog, listPlaces, listSessions, needsExportReminder, newActivity, saveProfile } from './db';
import { downloadExport } from './backup';
import { loadLibrary } from './library';
import { useRest } from './rest';
import { useWorkouts } from './workouts';
import { useSync } from './sync';
import { useOnline } from './useOnline';
import WorkoutTab, { EditSession } from './components/WorkoutTab';
import History from './components/History';
import Settings from './components/Settings';
import RestBar from './components/RestBar';
import RoutineEditor from './components/RoutineEditor';
import StretchBuilder from './components/StretchBuilder';
import ActivityEditor from './components/ActivityEditor';
import Suggest from './components/Suggest';
import Onboarding from './components/Onboarding';
import Coach from './components/Coach';
import { foodMode } from './food';
import Review from './components/Review';
import { PlanView } from './components/PlanCard';
import PlanDay from './components/PlanDay';
import WhatsNew from './components/WhatsNew';
import { LATEST, readSeen, shouldShowWhatsNew, writeSeen } from './changelog';
import { useUpdateReady } from './update';
import { topActivityTypes } from './activities';
import { STYLE_FOR_GOAL, adaptPlan, shouldOnboard } from './plan';
import { BodyIcon, FoodIcon, HistoryIcon, Logo, ProgressIcon, SettingsIcon, WorkoutIcon } from './components/Icons';

// The chart library is the heaviest dependency, so load it only when needed.
const Progress = lazy(() => import('./components/Progress'));
const Body = lazy(() => import('./components/Body'));
const Food = lazy(() => import('./components/Food'));

const TABS = [
  ['workout', 'Workout', WorkoutIcon],
  ['history', 'History', HistoryIcon],
  ['progress', 'Progress', ProgressIcon],
  ['food', 'Food', FoodIcon],
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
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestPreset, setSuggestPreset] = useState(null);
  const [welcomeDone, setWelcomeDone] = useState(false);
  const [guide, setGuide] = useState(null); // 'first' | 'plan' | 'tour' | 'plan-view' | 'plan-day'
  const [planDayN, setPlanDayN] = useState(1);
  const [dayBack, setDayBack] = useState('plan-view');
  const [stretchView, setStretchView] = useState(null); // { preset, minutes } while the stretch builder is open
  const [activityView, setActivityView] = useState(null); // { doc, isNew } while the activity editor is open
  const [unitCache, setUnitCache] = useState(readUnit);
  const [dismissed, setDismissed] = useState(false);
  const [seenRelease, setSeenRelease] = useState(readSeen);
  const updateReady = useUpdateReady();
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
  const profileQ = useLiveQuery(async () => ({ p: (await getProfile()) ?? null }), [], undefined);
  const profile = profileQ?.p ?? null;
  const profileLoaded = profileQ !== undefined;
  const hasFood = useLiveQuery(async () => (await listFoodLog()).length > 0, [], false);
  const foodLabel = foodMode(profile, hasFood ? [{}] : []) === 'journal' ? 'Journal' : 'Food';
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
    setSuggestOpen(false);
    setGuide(null);
    setTab(id);
  };

  // The guided tour switches tabs without ending itself.
  const showTab = (id) => {
    setEditId(null);
    setRoutineView(null);
    setActivityView(null);
    setSuggestOpen(false);
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
  const openStretch = (o = {}) => setStretchView({ preset: o.preset ?? 'total', minutes: o.minutes ?? 10 });
  const openActivity = (doc, isNew = false) => setActivityView({ doc, isNew });

  const { workouts: workoutsList, activities: activityRows, sessions: sessionRows } = useWorkouts();
  const favorites = topActivityTypes(profile?.onboarding?.interests ?? [], activityRows ?? []);
  const openPlanDay = (n, from = 'plan-view') => {
    setPlanDayN(n);
    setDayBack(from);
    setGuide('plan-day');
  };
  const planDone = (day, seed = 0) => {
    const plan = profile?.plan;
    setGuide(null);
    if (day.k === 's') {
      setSuggestPreset({ focus: day.f, minutes: day.m, gear: plan.gear, style: STYLE_FOR_GOAL[plan.goal], ease: !!day.ease, boost: plan.boost ?? 0, seed });
      setSuggestOpen(true);
    } else {
      openActivity({ ...newActivity(), type: day.t, duration_min: day.m }, true);
    }
  };
  // New users get the welcome flow automatically (tests render it directly instead).
  const autoOnboard =
    import.meta.env.MODE !== 'test' &&
    !welcomeDone &&
    profileLoaded &&
    shouldOnboard({ profile, workoutCount: count, signedIn: !!sync.session, synced: !!sync.lastSynced });
  const closeGuide = () => setGuide(null);

  // Keep the plan in step with what you actually do: missed workouts move, extra days
  // add rest, rough weeks get lighter. The change is saved once, with a note.
  const planJson = profile?.plan ? JSON.stringify(profile.plan) : '';
  useEffect(() => {
    if (!profile?.plan || !workoutsList) return;
    const r = adaptPlan(profile.plan, workoutsList, today());
    if (r.changed) saveProfile({ plan: r.plan });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planJson, workoutsList]);
  const continueWith = (next) =>
    saveProfile({ plan: next.plan, onboarding: { ...(profile?.onboarding ?? {}), level: next.level, per_week: next.per_week } });
  const endPlan = () => saveProfile({ plan: null }).then(() => setGuide(null));
  // Once the welcome flow starts it stays up until it finishes, even after answers are saved.
  useEffect(() => {
    if (autoOnboard && !guide) setGuide('first');
  }, [autoOnboard, guide]);
  const guideMode = autoOnboard && !guide ? 'first' : guide;

  // New users have nothing to compare against, so they are marked as up to date instead of seeing the pop-up.
  useEffect(() => {
    if (count === 0 && !seenRelease && !guideMode) {
      writeSeen();
      setSeenRelease(LATEST.id);
    }
  }, [count, seenRelease, guideMode]);
  const closeWhatsNew = () => {
    writeSeen();
    setSeenRelease(LATEST.id);
  };
  const showWhatsNew =
    count > 0 && !guideMode && !editId && !routineView && !activityView && !stretchView && !suggestOpen && shouldShowWhatsNew(seenRelease);

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

      {updateReady && (
        <div className="update-banner" role="status">
          <span>A new version of Repwise is ready.</span>
          <button type="button" className="btn btn-small btn-ghost" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )}

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

        {guideMode === 'first' || guideMode === 'plan' ? (
          <Onboarding
            key={guideMode}
            mode={guideMode}
            unit={unit}
            setUnit={setUnit}
            name={profile?.display_name ?? ''}
            saved={profile?.onboarding ?? null}
            onDone={(opts) => {
              setWelcomeDone(true);
              setTab('workout');
              if (opts?.tour) setGuide('tour');
              else closeGuide();
            }}
          />
        ) : guideMode === 'review' ? (
          <Review
            sessions={sessionRows ?? []}
            activities={activityRows ?? []}
            plan={profile?.plan ?? null}
            unit={unit}
            weekStart={profile?.week_start ?? 1}
            todayStr={today()}
            onClose={closeGuide}
          />
        ) : guideMode === 'plan-view' && profile?.plan ? (
          <PlanView
            plan={profile.plan}
            workouts={workoutsList ?? []}
            todayStr={today()}
            onClose={closeGuide}
            onNewPlan={() => setGuide('plan')}
            onEndPlan={endPlan}
            onViewDay={(n) => openPlanDay(n, 'plan-view')}
          />
        ) : guideMode === 'plan-day' && profile?.plan ? (
          <PlanDay
            plan={profile.plan}
            workouts={workoutsList ?? []}
            todayStr={today()}
            n={planDayN}
            unit={unit}
            onBack={() => setGuide(dayBack === 'plan-view' ? 'plan-view' : null)}
            onGoto={setPlanDayN}
            onChangePlan={(next) => saveProfile({ plan: next })}
            onStart={planDone}
            onSaveRoutine={(doc) => {
              setGuide(null);
              openRoutine(doc, true);
            }}
            onLogActivity={(idea) => {
              setGuide(null);
              openActivity({ ...newActivity(), type: idea.type, duration_min: idea.minutes }, true);
            }}
            onStretch={(o) => {
              setGuide(null);
              openStretch(o);
            }}
            onOpenWorkout={(w) => {
              setGuide(null);
              if (w.isActivity) openActivity(w.activity);
              else setEditId(w.id);
            }}
          />
        ) : editId ? (
          <EditSession
            id={editId}
            unit={unit}
            onClose={() => setEditId(null)}
            onSaveRoutine={(doc) => {
              setEditId(null);
              openRoutine(doc, true);
            }}
          />
        ) : suggestOpen ? (
          <Suggest
            unit={unit}
            preset={suggestPreset}
            onClose={() => setSuggestOpen(false)}
            onStarted={() => {
              setSuggestOpen(false);
              setTab('workout');
            }}
            onSaveRoutine={(doc) => {
              setSuggestOpen(false);
              openRoutine(doc, true);
            }}
            onLogActivity={(idea) => {
              setSuggestOpen(false);
              openActivity({ ...newActivity(), type: idea.type, duration_min: idea.minutes }, true);
            }}
            onStretch={(o) => {
              setSuggestOpen(false);
              openStretch(o);
            }}
          />
        ) : stretchView ? (
          <StretchBuilder
            preset={stretchView.preset}
            minutes={stretchView.minutes}
            onClose={() => setStretchView(null)}
            onEditActivity={(doc) => {
              setStretchView(null);
              openActivity(doc);
            }}
            onSaveRoutine={(doc) => {
              setStretchView(null);
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
            favorites={favorites}
            onClose={() => setActivityView(null)}
          />
        ) : routineView ? (
          <RoutineEditor
            key={routineView.doc.id}
            initial={routineView.doc}
            isNew={routineView.isNew}
            sessions={sessions}
            unit={unit}
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
                onStretch={() => openStretch()}
                onSuggest={() => {
                  setSuggestPreset(null);
                  setSuggestOpen(true);
                }}
                plan={profile?.plan ?? null}
                hasOnboarding={!!profile?.onboarding}
                onPlanDo={planDone}
                onPlanView={() => setGuide('plan-view')}
                onPlanDay={(n) => openPlanDay(n, 'workout')}
                onNewPlan={() => setGuide(profile?.onboarding?.goal ? 'plan' : 'first')}
                onEndPlan={endPlan}
                onContinue={continueWith}
                onOpenReview={() => setGuide('review')}
                onDismissOffer={() => saveProfile({ onboarding: { skipped: true } })}
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
            {tab === 'food' && (
              <Suspense fallback={<p className="muted">Loading…</p>}>
                <Food />
              </Suspense>
            )}
            {tab === 'settings' && (
              <Settings sync={sync} unit={unit} setUnit={setUnit} onExported={() => setTick((t) => t + 1)} plan={profile?.plan ?? null} onboarded={!!profile?.onboarding?.goal} onGuide={setGuide} />
            )}
          </>
        )}
      </main>

      <RestBar />

      {guideMode === 'tour' && <Coach onTab={showTab} onDone={closeGuide} />}

      {showWhatsNew && (
        <WhatsNew
          release={LATEST}
          onClose={closeWhatsNew}
          onSeeAll={() => {
            closeWhatsNew();
            goTab('settings');
          }}
        />
      )}

      {!(guideMode === 'first') && (
      <nav className="tabbar" aria-label="Main">
        {TABS.map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            data-tour={`tab-${id}`}
            className={tab === id && !editId && !routineView && !activityView && !stretchView && !suggestOpen ? 'tab active' : 'tab'}
            aria-current={tab === id && !editId && !routineView && !activityView && !stretchView && !suggestOpen ? 'page' : undefined}
            onClick={() => goTab(id)}
          >
            <span className="tab-icon">
              <Icon />
            </span>
            <span className="tab-label">{id === 'food' ? foodLabel : label}</span>
          </button>
        ))}
      </nav>
      )}
    </div>
  );
}
