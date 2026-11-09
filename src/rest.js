import { useSyncExternalStore } from 'react';
import { getPrefs } from './prefs';

// Rest timer. It lives outside React so it survives tab switches, and it stores
// an end timestamp rather than a countdown, so a throttled background tab still
// shows the right time when you come back.
const KEY = 'repwise.rest';
const listeners = new Set();
let state = { end: null, total: 0, over: false };
let timeout = null;
let overTimeout = null;
let audio = null;

const emit = () => listeners.forEach((l) => l());

function persist() {
  try {
    if (state.end) localStorage.setItem(KEY, JSON.stringify({ end: state.end, total: state.total }));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

function set(next) {
  state = next;
  persist();
  emit();
}

function ensureAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audio) audio = new AC();
    if (audio.state === 'suspended') audio.resume();
  } catch {
    /* sound is optional */
  }
}

function beep() {
  if (!audio) return;
  const t0 = audio.currentTime;
  [0, 0.25, 0.5].forEach((d) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t0 + d);
    gain.gain.exponentialRampToValueAtTime(0.3, t0 + d + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.18);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(t0 + d);
    osc.stop(t0 + d + 0.2);
  });
}

function notify() {
  if (!getPrefs().alerts) return;
  try {
    navigator.vibrate?.([250, 120, 250]);
  } catch {
    /* ignore */
  }
  try {
    beep();
  } catch {
    /* ignore */
  }
}

function fire() {
  clearTimeout(timeout);
  set({ end: null, total: state.total, over: true });
  notify();
  clearTimeout(overTimeout);
  overTimeout = setTimeout(() => {
    if (state.over) set({ ...state, over: false });
  }, 8000);
}

function check() {
  if (state.end != null && Date.now() >= state.end) fire();
  else schedule();
}

function schedule() {
  clearTimeout(timeout);
  if (state.end == null) return;
  timeout = setTimeout(check, Math.max(0, state.end - Date.now()) + 20);
}

export function startRest(seconds) {
  ensureAudio(); // must run inside a tap so the browser allows sound later
  clearTimeout(overTimeout);
  set({ end: Date.now() + seconds * 1000, total: seconds, over: false });
  schedule();
}

export function adjustRest(deltaSeconds) {
  if (state.end == null) return;
  const end = Math.max(Date.now() + 1000, state.end + deltaSeconds * 1000);
  set({ end, total: Math.max(5, state.total + deltaSeconds), over: false });
  schedule();
}

export function stopRest() {
  clearTimeout(timeout);
  clearTimeout(overTimeout);
  set({ end: null, total: 0, over: false });
}

export const getRestState = () => state;

export function useRest() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

// Restore a timer that was running when the page was reloaded.
if (typeof window !== 'undefined') {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved?.end && saved.end > Date.now()) {
      state = { end: saved.end, total: saved.total || 0, over: false };
      schedule();
    } else if (saved) {
      localStorage.removeItem(KEY);
    }
  } catch {
    /* ignore */
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
}

// Sounds for other timers (the guided stretch session). Call primeAudio inside a tap.
export const primeAudio = () => ensureAudio();
export function chime(strong = false) {
  if (!getPrefs().alerts) return;
  try {
    navigator.vibrate?.(strong ? [200, 100, 200] : [80]);
  } catch {
    /* ignore */
  }
  try {
    ensureAudio();
    if (!audio) return;
    const t0 = audio.currentTime;
    (strong ? [0, 0.22] : [0]).forEach((d) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = strong ? 880 : 660;
      gain.gain.setValueAtTime(0.0001, t0 + d);
      gain.gain.exponentialRampToValueAtTime(0.25, t0 + d + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.16);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(t0 + d);
      osc.stop(t0 + d + 0.18);
    });
  } catch {
    /* sound is optional */
  }
}
