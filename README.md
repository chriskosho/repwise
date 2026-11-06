# Repwise

A workout log that works like the popular gym trackers and syncs across your devices.

## Features

- **Live workouts:** start a workout, add exercises, and tick sets off as you go. A workout in progress survives reloads and shows on your other devices.
- **Last time, right there:** every set shows what you did previously, and a blank set fills in from it when you tap done.
- **Set types:** normal, warm-up, drop set, and failure. Warm-ups don't count toward volume or records.
- **Supersets:** link an exercise to the next one; the rest timer waits until the end of the group.
- **Rest timer:** starts when you complete a set, with +15/−15 and skip. Sound and vibration at the end, and the screen stays on during a workout.
- **Personal records:** heaviest weight and estimated 1RM are flagged live and summarized when you finish.
- **History:** search and date filters, edit any past workout, or log one after the fact.
- **Progress:** charts for top weight, estimated 1RM, volume, and reps.
- **Offline-first:** everything saves to the device first (IndexedDB via Dexie).
- **Sync:** Supabase with email magic-link login.
- **Backup:** JSON export/import (merged by ID, so re-importing never duplicates; older backups still import) and a weekly export reminder.

## Stack

Vite + React, Dexie, Recharts, Supabase, Vitest, GitHub Pages (deployed by GitHub Actions).

## How data is stored

A **session** is one workout: name, times, and a list of exercises, each with its sets. Each session is one row (one JSON document) in Supabase, so a whole workout syncs as a unit.

1. Edits save to IndexedDB a moment after you stop typing and mark the row `dirty`.
2. While signed in, dirty rows are upserted to Supabase. The server sets `updated_at` (a trigger), so a wrong device clock can't win a conflict.
3. The app then pulls rows changed since its last sync point and merges them. A local edit that hasn't uploaded yet is never overwritten.
4. Deletes are soft (`deleted_at`) so they reach your other devices.
5. Only one browser tab syncs at a time.

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

## Limits of a web app

- Rest-timer sound and vibration only work while Repwise is open and the screen is on (browsers don't allow background alarms), which is why the screen stays on during a workout.
- No Apple Watch / Wear OS app and no Apple Health or Health Connect sync.
- The app doesn't yet open without a connection after the first load (offline support is planned).
- Free-tier Supabase projects pause after a period of inactivity and have no automatic backups. The JSON export is your real backup.
- Changing the weight unit only changes labels; it doesn't convert logged weights.
