// What changed, newest first. `highlights` are the few things worth a pop-up the first time
// someone opens a new version; `items` is the fuller list shown in Settings.
export const RELEASES = [
  {
    id: '2.8',
    date: '2026-11-10',
    title: 'A more consistent look',
    highlights: [
      'Buttons, chips and icon buttons now share the same sizes across every screen.',
      'Section headings are easier to read, in plain sentence case.',
      'Spacing and corner shapes match from screen to screen, in light and dark.',
    ],
    items: [
      'Two button heights (44 and 36) and one icon-button size, so tap targets feel the same everywhere.',
      'Cards, rows and sheets use the same padding and spacing.',
      'The weekly review card has even spacing and matching buttons.',
      'History recap rows, the Today card and text beside buttons now have even spacing, and “Clear this device” is a clear red outline button.',
      'Every screen now has the same “← Back” button in the top left (it used to say Done, Plan or Food on some).',
    ],
  },
  {
    id: '2.7',
    date: '2026-11-10',
    title: 'Home, simplified further',
    highlights: [
      'The home screen is now one card: a headline, one main button, and two quiet links.',
      'Routines moved into their own screen, one tap from home, with ready-made routines to add.',
      'One line shows what you did last. The full list stays in History.',
    ],
    items: [
      'A single headline says what today is, such as “Today: Full body · 45 min” or “Last time: Pull day · Tue”.',
      '“Something else” and “Log” are plain links under the main button.',
      'The plan shows as this week’s strip with one “View plan” link.',
      'Routines and starter routines live on the Routines screen; starting a routine is still one tap from “Something else”.',
    ],
  },
  {
    id: '2.6',
    date: '2026-11-10',
    title: 'A simpler home screen',
    highlights: [
      'One main button that starts what you most likely want: today’s planned workout, your last workout again, or a stretch on rest days.',
      'Everything else is behind two buttons: “Something else” (routines, a suggested workout, an empty workout, stretching) and “Log” (things you already did).',
      'Your plan’s week sits right in the same card. Tap any day to see it.',
    ],
    items: [
      'Planned workouts start in one tap. “Preview or change it first” opens the same workout to adjust.',
      'Without a plan, the main button repeats your last workout (or starts its routine if you saved one).',
      'New to Repwise? “Start workout” offers three starter routines, a suggested workout, or an empty one.',
      'Routines show your first three, with “See all”. Starter routines are behind “Browse starter routines”.',
      'Weekly review moved to the Progress tab.',
    ],
  },
  {
    id: '2.5',
    date: '2026-11-10',
    title: 'Starter routines and a cleaner stretch list',
    highlights: [
      'New starter routines: full body, push, pull, legs, upper, lower, bodyweight, dumbbells only, and stretch routines. Add any with one tap.',
      'The stretch list is redesigned: grouped by body area, with compact rows and a Start button that stays in reach.',
      'Selected options now highlight properly across the app (they were not showing a background).',
    ],
    items: [
      'Starter routines live on the Workout tab under Routines. They are copies, so rename or change them freely.',
      'Stretch routines set the hold time for each stretch and note which ones are done each side.',
      'Stretch list: swap and remove are icons, the hold time is a small menu, and Start guided session stays on screen while you scroll.',
      'Fixed the soft highlight color that was missing, which affected today in the week strip, selected choices and plan notes.',
    ],
  },
  {
    id: '2.4',
    date: '2026-11-10',
    title: 'Stretches based on your workout',
    highlights: [
      'After a workout, Repwise offers to stretch exactly what you trained, with more time on the areas you worked hardest.',
      'Supporting muscles count too: squats also point to hips and hamstrings, rows to lats and arms.',
      'Runs and other activities now count toward “What I trained recently”.',
    ],
    items: [
      'A “Stretch what you just trained” card on the workout summary: 5 minutes, or 10 after a workout over an hour.',
      '“+ Add stretches” inside a workout starts from what you have logged so far.',
      '“What I trained recently” looks at the last 3 days, with today counting most, and includes activities.',
      'The builder explains why it picked each area, and you can still change any of it.',
      'Stretches that duplicated each other are gone from the list.',
    ],
  },
  {
    id: '2.3',
    date: '2026-11-09',
    title: 'Stretch sessions and add a routine to a workout',
    highlights: [
      'New Stretch button on the Workout tab: pick total body or the areas you want, choose 5 to 20 minutes, and get a list ordered head to toe.',
      'Start a guided session: a timer walks you through each hold, tells you when to switch sides, and logs it for you.',
      'Already mid-workout? Tap “+ Add routine” to bring in a saved routine, or “+ Add stretches” to finish with a cool-down.',
    ],
    items: [
      'Stretch builder: quick picks (upper body, lower body, after a run, desk relief, what I trained recently), body areas, Shuffle, swap or remove any stretch, change hold times, and add your own.',
      'About 34 stretches with short how-to cues, filled out from the exercise library.',
      'Guided mode with get-ready steps, a hold countdown, switch-sides prompts, sound and vibration (follows your alert setting), pause, back, skip, and the screen stays awake if you have that on.',
      'Finished sessions are saved as a Stretching activity with the time you actually spent; Edit details is one tap away.',
      'Save a stretch session as a routine and add it to any workout.',
      'Add a routine to the workout you are in (active or from History): choose which exercises to bring in, ones already there are left unticked.',
      'Suggested cool-downs have a “Choose areas” link, and rest days in your plan offer a stretch session.',
    ],
  },
  {
    id: '2.2',
    date: '2026-11-08',
    title: 'Food journal and tracking',
    highlights: [
      'A new Journal tab: one simple note a day about what you ate, with the time and how it felt. No numbers.',
      'Want numbers? Switch to calorie tracking in Settings: type a food, pick it from the suggestions, and see daily totals. Your journal stays.',
    ],
    items: [
      'Journal: one note per day that saves itself, an “Add the time” button, an optional “how did eating feel” tap, a note of whether you trained, and a list of earlier days.',
      'Choose Journal or calorie tracking when you set up, or any time in Settings → Food. Switching never deletes anything.',
      'Food tab with search-as-you-type over about 180 common foods plus your own, one-tap “often logged” foods, time and servings per entry, edit, delete with undo, and “Log again now”.',
      'Optional daily calorie and protein goals, a 7-day average, copy yesterday, and a My foods list to edit or remove foods you added.',
      'Food entries sync with your account and are included in backups.',
    ],
  },
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
