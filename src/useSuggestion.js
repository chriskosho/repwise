import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listBodyEntries, listCustomExercises, listGoals, getProfile } from './db';
import { useLibrary } from './library';
import { useWorkouts } from './workouts';
import { suggestWorkout } from './suggest';

// The workout Repwise would suggest for the given options, or null while data loads.
// Same inputs always give the same workout, so a preview matches what you later start.
export function useSuggestion(unit, options) {
  const { list: library } = useLibrary();
  const { sessions, activities, workouts } = useWorkouts();
  const custom = useLiveQuery(listCustomExercises, [], []);
  const goals = useLiveQuery(listGoals, [], []);
  const entries = useLiveQuery(listBodyEntries, [], []);
  const profile = useLiveQuery(async () => (await getProfile()) ?? null, [], null);
  const latestKg = entries?.find((e) => e.weight_kg != null)?.weight_kg ?? null; // newest first
  const optKey = JSON.stringify(options);
  return useMemo(() => {
    if (!library || !sessions || !activities || !workouts) return null;
    return suggestWorkout({
      library,
      custom,
      sessions,
      activities,
      workouts,
      goals,
      latestKg,
      unit,
      weekStart: profile?.week_start ?? 1,
      options: { level: profile?.plan?.level ?? profile?.onboarding?.level ?? '', ...options, interests: profile?.onboarding?.interests ?? [] },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library, custom, sessions, activities, workouts, goals, latestKg, unit, profile?.week_start, profile?.onboarding, profile?.plan?.level, optKey]);
}
