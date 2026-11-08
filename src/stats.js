// Pure helpers for workout math and formatting. Only completed sets count, and
// warm-up sets are excluded from volume and records.
import { describeSet, isLogged, modeOf, num } from './measure';

export const key = (name) => String(name ?? '').trim().toLowerCase();

// A set counts once it is ticked off AND has the measurement that matters for the exercise
// (reps for lifts, seconds for holds, time or distance for cardio, distance for carries).
export const doneSets = (ex) => {
  const mode = modeOf(ex);
  return ex.sets.filter((s) => s.done && isLogged(mode, s));
};
export const workSets = (ex) => doneSets(ex).filter((s) => s.type !== 'warmup');

// Epley estimate of a one-rep max.
export const e1rm = (reps, weight) => (reps <= 1 ? weight : weight * (1 + reps / 30));

export function sessionStats(session) {
  let sets = 0;
  let volume = 0;
  let exercises = 0;
  let cardioSec = 0;
  let km = 0;
  let holdSec = 0;
  for (const ex of session.exercises) {
    const w = workSets(ex);
    if (w.length) exercises++;
    const mode = modeOf(ex);
    if (mode === 'cardio') {
      cardioSec += w.reduce((a, s) => a + num(s.time), 0);
      km += w.reduce((a, s) => a + num(s.distance), 0);
    } else if (mode === 'stretch') {
      // stretches are not strength work
    } else {
      sets += w.length;
      if (mode === 'weight' || mode === 'bodyweight') volume += w.reduce((a, s) => a + num(s.reps) * num(s.weight), 0);
      if (mode === 'time') holdSec += w.reduce((a, s) => a + num(s.time), 0);
      if (mode === 'carry') km += w.reduce((a, s) => a + num(s.distance), 0);
    }
  }
  const minutes = session.ended_at
    ? Math.max(0, Math.round((Date.parse(session.ended_at) - Date.parse(session.started_at)) / 60000))
    : null;
  return { sets, volume, exercises, minutes, cardioSec, km, holdSec };
}

// What you did last time for this exercise: the completed sets of the most
// recent earlier session that included it. `prior` must be newest first.
export function previousSets(name, prior) {
  const k = key(name);
  for (const s of prior) {
    const ex = s.exercises.find((e) => key(e.name) === k && doneSets(e).length);
    if (ex)
      return doneSets(ex).map((st) => ({
        type: st.type,
        reps: num(st.reps),
        weight: num(st.weight),
        time: num(st.time),
        distance: num(st.distance),
        incline: num(st.incline),
      }));
  }
  return [];
}

// Personal records versus every earlier session. The first time you do an exercise there is
// nothing to beat, so no PR. At most one set per exercise gets each badge.
//   weight / carry: heaviest        weight: best estimated 1RM
//   bodyweight: most reps (at that added weight or more), heaviest added weight
//   time: longest hold              cardio / carry: longest distance, fastest pace
export function computePRs(exercises, prior) {
  const bySet = new Map();
  const list = [];
  const flag = (id, kind) => bySet.set(id, { ...(bySet.get(id) || {}), [kind]: true });
  for (const ex of exercises) {
    const mode = modeOf(ex);
    if (mode === 'stretch') continue;
    const k = key(ex.name);
    const before = [];
    for (const s of prior) for (const e of s.exercises) if (key(e.name) === k) before.push(...workSets(e));
    if (!before.length) continue;
    const now = workSets(ex);
    if (!now.length) continue;
    const entry = { name: ex.name };

    if (mode === 'weight' || mode === 'bodyweight' || mode === 'carry') {
      const bestW = Math.max(0, ...before.map((x) => num(x.weight)));
      const top = now.reduce((a, b) => (num(b.weight) > num(a.weight) ? b : a));
      if (num(top.weight) > bestW) {
        entry.weight = num(top.weight);
        flag(top.id, 'weight');
      }
    }
    if (mode === 'weight') {
      const bestE = Math.max(0, ...before.map((x) => e1rm(num(x.reps), num(x.weight))));
      const top = now.reduce((a, b) => (e1rm(num(b.reps), num(b.weight)) > e1rm(num(a.reps), num(a.weight)) ? b : a));
      const e = e1rm(num(top.reps), num(top.weight));
      if (e > bestE + 0.001) {
        entry.orm = Math.round(e);
        flag(top.id, 'orm');
      }
    }
    if (mode === 'bodyweight') {
      const top = now.reduce((a, b) => (num(b.reps) > num(a.reps) || (num(b.reps) === num(a.reps) && num(b.weight) > num(a.weight)) ? b : a));
      const beaten = before.some((x) => num(x.weight) >= num(top.weight) && num(x.reps) >= num(top.reps));
      if (!beaten) {
        entry.reps = num(top.reps);
        entry.repsWeight = num(top.weight);
        flag(top.id, 'reps');
      }
    }
    if (mode === 'time') {
      const best = Math.max(0, ...before.map((x) => num(x.time)));
      const top = now.reduce((a, b) => (num(b.time) > num(a.time) ? b : a));
      if (num(top.time) > best) {
        entry.time = num(top.time);
        flag(top.id, 'time');
      }
    }
    if (mode === 'cardio' || mode === 'carry') {
      const best = Math.max(0, ...before.map((x) => num(x.distance)));
      const top = now.reduce((a, b) => (num(b.distance) > num(a.distance) ? b : a));
      if (num(top.distance) > best) {
        entry.distance = num(top.distance);
        flag(top.id, 'distance');
      }
    }
    if (mode === 'cardio') {
      const pace = (x) => (num(x.distance) > 0 && num(x.time) > 0 ? num(x.time) / 60 / num(x.distance) : Infinity);
      const best = Math.min(Infinity, ...before.map(pace));
      const top = now.reduce((a, b) => (pace(b) < pace(a) ? b : a));
      if (pace(top) < Infinity && best < Infinity && pace(top) < best - 1e-9) {
        entry.pace = pace(top);
        flag(top.id, 'pace');
      }
    }
    if (Object.keys(entry).length > 1) list.push(entry);
  }
  return { bySet, list };
}

// Flatten sessions into per-exercise entries for the progress charts.
export function entriesFromSessions(sessions) {
  const out = [];
  for (const s of sessions) {
    for (const ex of s.exercises) {
      const mode = modeOf(ex);
      if (mode === 'stretch') continue;
      const sets = workSets(ex).map((st) => ({ reps: num(st.reps), weight: num(st.weight), time: num(st.time), distance: num(st.distance), incline: num(st.incline) }));
      if (sets.length) out.push({ date: s.date, exercise: ex.name, mode, sets });
    }
  }
  return out;
}

// "3 × 8 @ 135 lb" for lifts, "3 × 45 s" for holds, "30 min · 3.1 mi" for cardio...
export function summarizeSets(sets, unit, mode = 'weight', name = '') {
  if (mode === 'cardio') return sets.map((s) => describeSet('cardio', s, unit, name)).join(', ');
  const groups = [];
  for (const st of sets) {
    const text = describeSet(mode, st, unit, name);
    const last = groups[groups.length - 1];
    if (last && last.text === text) last.n++;
    else groups.push({ text, n: 1 });
  }
  if (mode === 'weight') {
    // Compact the familiar form: "3 × 5 @ 225 lb".
    const g2 = [];
    for (const st of sets) {
      const reps = num(st.reps);
      const weight = num(st.weight);
      const last = g2[g2.length - 1];
      if (last && last.reps === reps && last.weight === weight) last.n++;
      else g2.push({ reps, weight, n: 1 });
    }
    return g2.map((g) => `${g.n} × ${g.reps}${g.weight ? ` @ ${g.weight} ${unit}` : ''}`).join(', ');
  }
  return groups.map((g) => (g.n > 1 ? `${g.n} × ${g.text}` : g.text)).join(', ');
}

export const fmtNum = (n) => {
  const x = Number(n);
  return Number.isFinite(x) ? String(Math.round(x * 100) / 100) : '';
};
export const fmtVolume = (v) => Math.round(v).toLocaleString();

export function fmtDuration(minutes) {
  if (minutes == null) return '';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

export function fmtClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

// "1 set", "3 sets".
export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

// "Nov 6" (this year) or "Nov 6, 2025".
export const fmtShortDate = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
};
// "Sat, Nov 7".
export const fmtDayDate = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
};
