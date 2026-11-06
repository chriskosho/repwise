# Repwise

A workout log that works offline and syncs across your devices.

- **Log** workouts: date, exercise, sets (reps and weight), notes
- **History** with search and date-range filters; edit and delete
- **Progress** charts: top weight, estimated 1RM, total volume, total reps
- **Offline-first:** everything is saved on the device first (IndexedDB via Dexie)
- **Sync** through Supabase with email magic-link login
- **Backup:** JSON export/import (merged by ID, so re-importing never duplicates) and a weekly export reminder

## Stack

Vite + React, Dexie, Recharts, Supabase, GitHub Pages (deployed by GitHub Actions).

## How sync works

1. Saves go to IndexedDB and mark the row `dirty`.
2. While signed in, dirty rows are upserted to Supabase. The server sets `updated_at` (a trigger), so a wrong device clock can't win a conflict.
3. The app then pulls rows changed since its last sync point and merges them. A local edit that hasn't uploaded yet is never overwritten.
4. Deletes are soft (`deleted_at`) so they reach your other devices.
5. Sync runs after changes, on sign-in, when you come back online, when the tab regains focus, and every few minutes.

## Setup

### 1. Supabase

1. Open the SQL editor in your Supabase project, paste `supabase/schema.sql`, and run it. It creates the `workouts` table, the `updated_at` trigger, and row-level security so each user only sees their own rows.
2. In **Authentication → URL Configuration**, set the **Site URL** to `https://chriskosho.github.io/repwise/` and add these under **Redirect URLs**:
   - `https://chriskosho.github.io/repwise/`
   - `http://localhost:5173/repwise/` (for local development)

### 2. Local development

```bash
cp .env.example .env   # then fill in your project URL and publishable key
npm install
npm run dev            # http://localhost:5173/repwise/
```

Only the publishable key belongs in the app. Never put a `service_role` or secret key in this repo.

### 3. Deploy to GitHub Pages

1. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Under **Settings → Secrets and variables → Actions → Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the publishable key).
3. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds and publishes the site at `https://chriskosho.github.io/repwise/`.

## Notes

- Free-tier Supabase projects pause after a period of inactivity, and the free tier has no automatic backups. The JSON export is your real backup.
- Changing the weight unit only changes labels; it doesn't convert logged weights.
