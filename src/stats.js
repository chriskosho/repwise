// Pure helpers for workout math and formatting. Only completed sets count, and
// warm-up sets are excluded from volume and records.

export const key = (name) => String(name ?? '').trim().toLowerCase();
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const doneSets = (ex) => ex.sets.filter((s) => s.done && num(s.reps) > 0);
export const workSets = (ex) => doneSets(ex).filter((s) => s.type !== 'warmup');

// Epley estimate of a one-rep max.
export const e1rm = (reps, weight) => (reps <= 1 ? weight : weight * (1 + reps / 30));

export function sessionStats(session) {
  let sets = 0;
  let volume = 0;
  let exercises = 0;
  for (const ex of session.exercises) {
    const w = workSets(ex);
    if (w.length) exercises++;
    sets += w.length;
    volume += w.reduce((a, s) => a + num(s.reps) * num(s.weight), 0);
  }
  const minutes = session.ended_at
    ? Math.max(0, Math.round((Date.parse(session.ended_at) - Date.parse(session.started_at)) / 60000))
    : null;
  return { sets, volume, exercises, minutes };
}

// What you did last time for this exercise: the completed sets of the most
// recent earlier session that included it. `prior` must be newest first.
export function previousSets(name, prior) {
  const k = key(name);
  for (const s of prior) {
    const ex = s.exercises.find((e) => key(e.name) === k && doneSets(e).length);
    if (ex) return doneSets(ex).map((st) => ({ type: st.type, reps: num(st.reps), weight: num(st.weight) }));
  }
  return [];
}

// Personal records: heaviest weight and best estimated 1RM versus every earlier
// session. The first time you do an exercise there is nothing to beat, so no PR.
// At most one set per exercise gets each badge.
export function computePRs(exercises, prior) {
  const bySet = new Map();
  const list = [];
  for (const ex of exercises) {
    const k = key(ex.name);
    let bestW = 0;
    let bestE = 0;
    let seen = false;
    for (const s of prior) {
      for (const e of s.exercises) {
        if (key(e.name) !== k) continue;
        for (const st of workSets(e)) {
          seen = true;
          const w = num(st.weight);
          bestW = Math.max(bestW, w);
          bestE = Math.max(bestE, e1rm(num(st.reps), w));
        }
      }
    }
    if (!seen) continue;

    let topW = null;
    let topE = null;
    for (const st of workSets(ex)) {
      if (topW === null || num(st.weight) > num(topW.weight)) topW = st;
      if (topE === null || e1rm(num(st.reps), num(st.weight)) > e1rm(num(topE.reps), num(topE.weight))) topE = st;
    }

    const entry = { name: ex.name };
    if (topW && num(topW.weight) > bestW) {
      entry.weight = num(topW.weight);
      bySet.set(topW.id, { ...(bySet.get(topW.id) || {}), weight: true });
    }
    if (topE) {
      const e = e1rm(num(topE.reps), num(topE.weight));
      if (e > bestE + 0.001) {
        entry.orm = Math.round(e);
        bySet.set(topE.id, { ...(bySet.get(topE.id) || {}), orm: true });
      }
    }
    if (entry.weight || entry.orm) list.push(entry);
  }
  return { bySet, list };
}

// Flatten sessions into per-exercise entries for the progress charts.
export function entriesFromSessions(sessions) {
  const out = [];
  for (const s of sessions) {
    for (const ex of s.exercises) {
      const sets = workSets(ex).map((st) => ({ reps: num(st.reps), weight: num(st.weight) }));
      if (sets.length) out.push({ date: s.date, exercise: ex.name, sets });
    }
  }
  return out;
}

export function summarizeSets(sets, unit) {
  const groups = [];
  for (const s of sets) {
    const reps = num(s.reps);
    const weight = num(s.weight);
    const last = groups[groups.length - 1];
    if (last && last.reps === reps && last.weight === weight) last.n++;
    else groups.push({ reps, weight, n: 1 });
  }
  return groups.map((g) => `${g.n} × ${g.reps}${g.weight ? ` @ ${g.weight} ${unit}` : ''}`).join(', ');
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
