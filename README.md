# Repwise

A workout log that works like the popular gym trackers and syncs across your devices.

## Features

- **Live workouts:** start a workout, add exercises, and tick sets off as you go. A workout in progress survives reloads and shows on your other devices.
- **Routines:** save any workout as a routine (or build one from scratch) and start it with one tap. Routines keep exercise order, set counts and types, supersets, and notes; your last numbers fill in from history.
- **Exercise library:** about 880 exercises tagged by muscle and equipment, searchable and filterable, with multi-select. Create your own, with a muscle and equipment, and they sync too.
- **Last time, right there:** every set shows what you did previously, and a blank set fills in from it when you tap done.
- **Set types:** normal, warm-up, drop set, and failure. Warm-ups don't count toward volume or records.
- **Supersets:** link an exercise to the next one; the rest timer waits until the end of the group.
- **Rest timer:** starts when you complete a set, with +15/−15 and skip. Sound and vibration at the end, and the screen stays on during a workout.
- **Personal records:** heaviest weight and estimated 1RM are flagged live and summarized when you finish.
- **History:** search and date filters, edit any past workout, or log one after the fact.
- **Progress:** charts for top weight, estimated 1RM, volume, and reps.
- **Body tracking:** log weight, body fat and ten measurements by date, with a 7-day average trend, 30- and 90-day change, and BMI if you set a height.
- **Goals:** workouts per week (with a weekly streak), a target body weight, or a lift target (top weight or estimated 1RM), each with a progress bar.
- **Stats (Progress tab):** lift charts, a records list (heaviest, estimated 1RM, best volume per exercise), working sets and volume per muscle by week, a workout calendar with week streaks, and plate and warm-up calculators.
- **Profile and privacy:** name, units, height and week start sync with your account. Settings has a plain-language privacy note and a button that permanently deletes your account and all of its data.
- **Works offline:** after the first visit the whole app (including the exercise library and every tab) opens and works without a connection. Workouts save to the device first (IndexedDB via Dexie) and upload when you're back online. Add it to your home screen for an app-style icon.
- **Sync:** Supabase with email magic-link login.
- **Activities:** log runs, walks, rides, swims, sports and classes by hand (type, time, optional distance, effort, notes). Pace or speed is worked out when there's a distance. They count toward streaks, the calendar and weekly workout goals, and have an Activity view under Progress. No GPS.
- **Places and notes:** save named places (a gym, a park) once and pick them on any workout or activity; manage them in Settings. Only the name you type is stored, never coordinates. Workouts, activities and goals all take notes, and History search covers notes and places.
- **Measured the right way:** each exercise is tracked by what makes sense for it: weight × reps for lifts, reps (plus optional added weight) for bodyweight moves, seconds for planks and stretches, time/distance/incline for treadmills, bikes and rowers, and weight/distance for carries. Records, charts, summaries and PRs follow suit, and you can change how any exercise is tracked from its ⋯ menu. Activities also take incline, elevation gain and heart rate, and swims and rows use yards/metres.
- **Cardio goals:** weekly active minutes, or weekly distance (any activity or one sport such as running). Logged activities and cardio machines inside workouts both count, with week streaks like the workout goal.
- **Editing body entries:** tap an entry to change it, including its date (it moves, unless another entry already has that date).
- **Suggested workouts:** "Suggest a workout" on the Workout tab builds a session from your goals (lift targets lead, body-weight goals shape sets and reps), what you've trained least recently, your time and equipment, plus cool-down stretches and non-gym ideas. Shuffle for alternatives, start it, or save it as a routine.
- **How-to help:** every exercise has an info button with start/end pictures (loaded from the public free-exercise-db folder when online), written steps, and YouTube Shorts / longer-video searches built from its name. The exercise picker can filter to stretching, and activities can list the stretches you did.
- **Backup:** JSON export/import of workouts, activities, places, routines, your own exercises, body entries, goals and profile (merged by ID, so re-importing never duplicates; older backups still import) and a weekly export reminder.

## Design

Mobile-first, light and dark themes (Settings → Appearance: match the device, or force Light or Dark on this device), one accent color (teal). The tab bar uses small inline SVG icons (`src/components/Icons.jsx`); there are no web fonts or icon libraries, so nothing extra is downloaded and everything works offline.

## Stack

Vite + React, Dexie, Recharts, Supabase, Vitest, GitHub Pages (deployed by GitHub Actions).

## How data is stored

A **session** is one workout: name, times, and a list of exercises, each with its sets. Each session is one row (one JSON document) in Supabase, so a whole workout syncs as a unit. **Routines**, your own **custom exercises**, **body entries** and **goals** work the same way, in their own tables (`routines`, `custom_exercises`, `body_entries`, `goals`). Your **profile** is one row per account (`profiles`, keyed by your account id).

1. Edits save to IndexedDB a moment after you stop typing and mark the row `dirty`.
2. While signed in, dirty rows are upserted to Supabase. The server sets `updated_at` (a trigger), so a wrong device clock can't win a conflict.
3. The app then pulls rows changed since its last sync point and merges them. A local edit that hasn't uploaded yet is never overwritten.
4. Deletes are soft (`deleted_at`) so they reach your other devices.
5. Only one browser tab syncs at a time.
6. Data on a device belongs to the account that signed in first. Signing out clears the device (after asking), and a different account signing in never inherits or uploads the previous account's rows.
7. Body weight is stored in kg and lengths in cm; the app converts to your unit for display. Logged lifting weights are stored as typed.

### Deleting an account

Settings → Delete account (type `DELETE`) calls the `delete_my_account()` database function. It takes no arguments and removes only the signed-in user's auth record; every table references it with `on delete cascade`, so all rows go too. The device is then cleared. Supabase's security advisor flags this function as a warning because signed-in users can call it; that is intentional.

If the same workout is edited on two devices at once, the last save wins for the whole workout, so edit a workout in progress on one device at a time.

The first version stored one row per exercise in a `workouts` table. On first open, the app converts those into one-exercise sessions that keep the same IDs. The old table is no longer used and can be dropped from Supabase once you're happy with v2.

## Setup

### 1. Supabase

1. Open the SQL editor in your Supabase project, paste `supabase/schema.sql`, and run it. It is safe to re-run. It creates the tables, the `updated_at` trigger, and row-level security so each user only sees their own rows.
2. In **Authentication → URL Configuration**, set the **Site URL** to `https://chriskosho.github.io/repwise/` and add these under **Redirect URLs**:
   - `https://chriskosho.github.io/repwise/`
   - `http://localhost:5173/repwise/` (for local development)

### 2. Local development

```bash
cp .env.example .env   # then fill in your project URL and publishable key
npm install
npm run dev            # http://localhost:5173/repwise/
npm test               # run the tests
```

Only the publishable key belongs in the app. Never put a `service_role` or secret key in this repo.

### 3. Deploy to GitHub Pages

1. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Under **Settings → Secrets and variables → Actions → Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the publishable key).
3. Push to `main`. The workflow in `.github/workflows/deploy.yml` runs the tests, builds, and publishes the site at `https://chriskosho.github.io/repwise/`.

## Offline support

`vite.config.js` has a small plugin that lists every file in the build and writes `dist/sw.js` from `scripts/sw.template.js`. The service worker saves all of them when installed, serves files from that copy, and for page loads tries the network first (4 s) before falling back to the saved copy. Requests to other sites (Supabase) are never touched, and your data is not cached by it (it lives in IndexedDB). The two most recent versions are kept so a tab left open across an update still finds its files.

To check it in a real browser: `npm run build && node scripts/check-offline.cjs` (needs Playwright).

## Exercise library

The built-in library comes from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (The Unlicense, public domain). Only names, primary muscle, equipment and category are kept. It loads on demand, as its own small file. To rebuild it from a fresh copy of that dataset:

```bash
node scripts/build-library.mjs path/to/free-exercise-db/dist/exercises.json
```

## Limits of a web app

- Sets-by-muscle credits each exercise to its main muscle only, using the library's tags (or the muscle you chose for your own exercises). Exercises without a muscle show as "Other".

- Rest-timer sound and vibration only work while Repwise is open and the screen is on (browsers don't allow background alarms), which is why the screen stays on during a workout.
- No Apple Watch / Wear OS app and no Apple Health or Health Connect sync.
- Offline support needs one online visit first, and a new version of the app is picked up the next time you open it with a connection (you may need to reopen it once). Signing in needs a connection.
- Free-tier Supabase projects pause after a period of inactivity and have no automatic backups. The JSON export is your real backup.
- Changing the weight unit only changes labels; it doesn't convert logged workout weights (body weight and measurements do convert).
- The privacy note describes how the app is built; the person who runs the Supabase project can technically read the database.
