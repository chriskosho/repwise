import { useLiveQuery } from 'dexie-react-hooks';
import { listActivities, listPlaces, listSessions } from './db';
import { activityAsSession } from './activities';

// Gym sessions, activities and saved places in one load. `workouts` is every finished
// gym session plus every activity, newest first: what streaks, the calendar and weekly goals count.
export function useWorkouts() {
  const sessions = useLiveQuery(listSessions, [], undefined);
  const activities = useLiveQuery(listActivities, [], undefined);
  const places = useLiveQuery(listPlaces, [], undefined);
  const ready = sessions !== undefined && activities !== undefined && places !== undefined;
  const workouts = ready
    ? [...sessions.filter((s) => s.ended_at), ...activities.map(activityAsSession)].sort((a, b) => b.date.localeCompare(a.date))
    : undefined;
  return { ready, sessions, activities, places, workouts };
}
