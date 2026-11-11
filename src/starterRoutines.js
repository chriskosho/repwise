// Ready-made routines anyone can add with one tap. They are copies: once added, they are
// yours to rename or change like any other routine.
import { newId, newRoutine } from './db';
import { curatedStretch } from './stretches';

const x = (name, sets, reps) => ({ name, sets, reps });
const hold = (name, sets, time) => ({ name, sets, time });

export const STARTER_GROUPS = [
  { id: 'gym', label: 'Gym' },
  { id: 'home', label: 'At home' },
  { id: 'stretch', label: 'Stretching' },
];

export const STARTERS = [
  {
    id: 'full-a',
    group: 'gym',
    name: 'Full body A',
    blurb: 'Squat, press, row. Alternate with Full body B, three days a week.',
    exercises: [x('Barbell Full Squat', 3, 8), x('Barbell Bench Press - Medium Grip', 3, 8), x('Bent Over Barbell Row', 3, 8), hold('Plank', 3, 30)],
  },
  {
    id: 'full-b',
    group: 'gym',
    name: 'Full body B',
    blurb: 'Hinge, overhead press, pulldown. The other half of the pair.',
    exercises: [x('Romanian Deadlift', 3, 8), x('Standing Military Press', 3, 8), x('Wide-Grip Lat Pulldown', 3, 10), x('Dumbbell Lunges', 2, 10), x('Dead Bug', 3, 10)],
  },
  {
    id: 'push',
    group: 'gym',
    name: 'Push day',
    blurb: 'Chest, shoulders and triceps.',
    exercises: [x('Barbell Bench Press - Medium Grip', 3, 8), x('Standing Military Press', 3, 8), x('Incline Dumbbell Press', 3, 10), x('Side Lateral Raise', 3, 12), x('Triceps Pushdown', 3, 12)],
  },
  {
    id: 'pull',
    group: 'gym',
    name: 'Pull day',
    blurb: 'Back and biceps.',
    exercises: [x('Barbell Deadlift', 3, 5), x('Wide-Grip Lat Pulldown', 3, 10), x('Seated Cable Rows', 3, 10), x('Face Pull', 3, 15), x('Dumbbell Bicep Curl', 3, 12)],
  },
  {
    id: 'legs',
    group: 'gym',
    name: 'Leg day',
    blurb: 'Quads, hamstrings, glutes and calves.',
    exercises: [x('Barbell Full Squat', 4, 8), x('Romanian Deadlift', 3, 8), x('Leg Press', 3, 10), x('Seated Leg Curl', 3, 12), x('Standing Calf Raises', 4, 12)],
  },
  {
    id: 'upper',
    group: 'gym',
    name: 'Upper body',
    blurb: 'Push and pull in one session. Pair with Lower body.',
    exercises: [x('Barbell Bench Press - Medium Grip', 3, 8), x('Bent Over Barbell Row', 3, 8), x('Dumbbell Shoulder Press', 3, 10), x('Wide-Grip Lat Pulldown', 3, 10), x('Dumbbell Bicep Curl', 2, 12), x('Triceps Pushdown', 2, 12)],
  },
  {
    id: 'lower',
    group: 'gym',
    name: 'Lower body',
    blurb: 'Legs and core. Pair with Upper body.',
    exercises: [x('Barbell Full Squat', 3, 8), x('Romanian Deadlift', 3, 8), x('Dumbbell Lunges', 3, 10), x('Seated Leg Curl', 3, 12), x('Standing Calf Raises', 3, 15), hold('Plank', 3, 30)],
  },
  {
    id: 'bodyweight',
    group: 'home',
    name: 'Bodyweight basics',
    blurb: 'No equipment. Good for travel or a first month.',
    exercises: [x('Pushups', 3, 10), x('Bodyweight Squat', 3, 15), x('Bodyweight Walking Lunge', 3, 10), x('Single Leg Glute Bridge', 3, 10), x('Dead Bug', 3, 10), hold('Plank', 3, 30)],
  },
  {
    id: 'dumbbell',
    group: 'home',
    name: 'Dumbbells only',
    blurb: 'A full session with just a pair of dumbbells and a bench.',
    exercises: [x('Dumbbell Bench Press', 3, 10), x('One-Arm Dumbbell Row', 3, 10), x('Dumbbell Shoulder Press', 3, 10), x('Dumbbell Lunges', 3, 10), x('Dumbbell Bicep Curl', 2, 12), x('Dumbbell Flyes', 2, 12)],
  },
  { id: 'st-total', group: 'stretch', stretch: true, name: 'Total body stretch', blurb: 'About 10 minutes, head to toe.', names: ['Neck side tilt', 'Cross-body shoulder stretch', 'Doorway chest stretch', 'Child’s pose', 'Cat-cow', 'Seated spinal twist', 'Figure-4 stretch', 'Kneeling hip flexor stretch', 'Standing quad stretch', 'Seated hamstring stretch', 'Wall calf stretch'] },
  { id: 'st-run', group: 'stretch', stretch: true, name: 'After a run', blurb: 'Hips, quads, hamstrings and calves.', names: ['Standing quad stretch', 'Kneeling hip flexor stretch', 'Standing hamstring stretch', 'Figure-4 stretch', 'Wall calf stretch', 'Bent-knee calf stretch'] },
  { id: 'st-desk', group: 'stretch', stretch: true, name: 'Desk relief', blurb: 'Neck, chest, wrists, back and hips after a long sit.', names: ['Neck side tilt', 'Upper trap stretch', 'Doorway chest stretch', 'Wrist flexor stretch', 'Wrist extensor stretch', 'Seated spinal twist', 'Kneeling hip flexor stretch'] },
  { id: 'st-upper', group: 'stretch', stretch: true, name: 'After upper body lifting', blurb: 'Shoulders, chest, arms and lats.', names: ['Cross-body shoulder stretch', 'Doorway chest stretch', 'Overhead triceps stretch', 'Biceps wall stretch', 'Standing lat stretch', 'Child’s pose'] },
  { id: 'st-lower', group: 'stretch', stretch: true, name: 'After leg day', blurb: 'Hips, quads, hamstrings and calves.', names: ['Figure-4 stretch', 'Pigeon pose', 'Kneeling hip flexor stretch', 'Lying quad stretch', 'Supine hamstring stretch', 'Wall calf stretch'] },
];

// The exercise names a starter uses, for checking them against the library.
export const starterNames = (st) => (st.stretch ? st.names : st.exercises.map((e) => e.name));

// A fresh routine you own, built from a starter.
export function routineFromStarter(st) {
  const exercises = st.stretch
    ? st.names.map((name) => {
        const c = curatedStretch(name);
        return { id: newId(), name, mode: 'stretch', link: false, notes: c?.sides ? 'Each side' : '', target: { time: c?.hold ?? 30 }, sets: [{ id: newId(), type: 'normal' }] };
      })
    : st.exercises.map((e) => ({
        id: newId(),
        name: e.name,
        link: false,
        notes: '',
        target: e.time ? { time: e.time } : { reps: e.reps },
        sets: Array.from({ length: e.sets }, () => ({ id: newId(), type: 'normal' })),
      }));
  return { ...newRoutine(), name: st.name, exercises };
}
