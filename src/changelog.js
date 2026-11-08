// What changed, newest first. `highlights` are the few things worth a pop-up the first time
// someone opens a new version; `items` is the fuller list shown in Settings.
export const RELEASES = [
  {
    id: '2.1',
    date: '2026-11-08',
    title: 'Plans you can open, a guided tour, easier finishing',
    highlights: [
      'Every day in your plan is now tappable: see the exact workout with suggested weights, swap it with another day, skip it, or start it early.',
      'A week strip on the Workout tab shows your week at a glance.',
      'The tour now points at the real buttons and tabs, one step at a time, and switches screens for you.',
      'Reopen it any time from Settings → Plan and tour.',
    ],
    items: [
      'Plan days: tap any day (week strip, plan view or the Next line) for a preview of its exercises, sets and weights, cardio tips, rest-day ideas, and options to swap, skip, add a workout or change the activity and minutes.',
      'Fixed: the extra sets that plans add after strong weeks were not being applied to suggested workouts.',
      'Logging a workout: Add exercise, a big Done button, Save as routine and Delete workout now sit at the bottom in that order. You can save a routine mid-workout.',
      'Settings → Start over: restart the welcome setup, or clear everything Repwise stores on this device.',
      'Guided tour with a spotlight on each feature (replaces the text cards), offered at the end of the welcome questions.',
    ],
  },
  {
    id: '2.0',
    date: '2026-11-08',
    title: 'Reviews, photos and plans that grow',
    highlights: [
      'Weekly review: see your week in numbers, records and what is next.',
      'Progress photos: add pictures on the Body tab and compare any two side by side. They stay on your device.',
      'Plans now add extra sets after strong weeks, and a finished plan can continue into the next one.',
      'Share Repwise with friends from Settings, and a note when a new version is ready.',
    ],
    items: [
      'Weekly review on the Workout tab: workout days, active minutes, volume, new records, plan progress, weight change and next week\'s schedule.',
      'Progress photos on the Body tab with pose tags, notes and a side-by-side compare (photos are stored on your device only).',
      'Plans that progress: extra sets after strong weeks, and "Continue with this plan" when one finishes.',
      'Height in Settings uses feet and inches, or meters and centimeters.',
      'Share link and a way to support the app in Settings.',
      'A "new version ready" notice, and this change log.',
    ],
  },
  {
    id: '1.9',
    date: '2026-11-07',
    title: 'Welcome questions and starter plans',
    highlights: [],
    items: [
      'A short welcome flow for new users: goal, experience, schedule, time of day, free days, activities and equipment.',
      '7, 21, 30 and 60 day plans with workouts, cardio, easy days and rest days.',
      'Today card on the Workout tab, catch-up for missed days, and a full plan view.',
      'Plans adapt: missed workouts move to a free day, extra rest after long streaks, lighter weeks after rough ones.',
      'A six-card tour you can reopen from Settings.',
      'Your favorite activities appear first when you log an activity.',
    ],
  },
  {
    id: '1.8',
    date: '2026-11-07',
    title: 'Smarter suggestions',
    highlights: [],
    items: [
      'Suggested workouts include weights, warm-up sets and a "How are you feeling?" picker, with rest-day and deload advice.',
      'Plate calculator for barbell lifts.',
      'Notes when a lift has stalled or just hit a new best.',
      'Target weights in routines, and an option to convert logged weights when you switch between lb and kg.',
      'Rename, edit or delete your own exercises in Settings.',
    ],
  },
  {
    id: '1.7',
    items: [
      'Exercises are tracked the right way: running by time, distance and incline; planks by time; bodyweight moves by reps.',
      'Weekly cardio goals (active minutes or distance).',
      'Body entries can be moved to a different date.',
    ],
    title: 'Tracking that fits the exercise',
    highlights: [],
  },
  {
    id: '1.6',
    title: 'Suggested workouts and exercise help',
    highlights: [],
    items: [
      'Suggested workouts based on your goals and what you trained recently.',
      'Pictures, steps and video searches for exercises, plus a stretching library.',
      'Baseball, softball and table tennis activities.',
    ],
  },
  {
    id: '1.5',
    title: 'Activities, places and notes',
    highlights: [],
    items: ['Log runs, sports and other activities without GPS.', 'Named places and notes throughout the app.'],
  },
];

export const LATEST = RELEASES[0];
const KEY = 'repwise.seenRelease';

export function readSeen() {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}
export function writeSeen(id = LATEST.id) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}
// The pop-up appears once per release, and only if that release has highlights.
export const shouldShowWhatsNew = (seen, latest = LATEST) => !!latest.highlights?.length && seen !== latest.id;
