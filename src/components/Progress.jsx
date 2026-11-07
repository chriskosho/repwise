import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getProfile, listSessions } from '../db';
import ProgressCharts from './ProgressCharts';
import Records from './Records';
import MuscleVolume from './MuscleVolume';
import CalendarView from './CalendarView';
import Tools from './Tools';

const VIEWS = [
  ['charts', 'Charts'],
  ['records', 'Records'],
  ['volume', 'Volume'],
  ['calendar', 'Calendar'],
  ['tools', 'Tools'],
];

// Everything about how you're doing, in one tab. The views share one load of your workouts.
export default function Progress({ unit }) {
  const [view, setView] = useState('charts');
  const sessions = useLiveQuery(listSessions, [], undefined);
  const profile = useLiveQuery(async () => (await getProfile()) ?? null, [], null);
  const weekStart = profile?.week_start ?? 1;

  return (
    <div>
      <div className="segments" role="tablist" aria-label="Progress views">
        {VIEWS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} className={view === id ? 'seg on' : 'seg'} onClick={() => setView(id)}>
            {label}
          </button>
        ))}
      </div>

      {view === 'tools' ? (
        <Tools unit={unit} />
      ) : !sessions ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          {view === 'charts' && <ProgressCharts unit={unit} />}
          {view === 'records' && <Records sessions={sessions} unit={unit} />}
          {view === 'volume' && <MuscleVolume sessions={sessions} unit={unit} weekStart={weekStart} />}
          {view === 'calendar' && <CalendarView sessions={sessions} weekStart={weekStart} unit={unit} />}
        </>
      )}
    </div>
  );
}
