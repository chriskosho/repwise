import { useSyncExternalStore } from 'react';

// Workout preferences, stored per device in localStorage.
const KEY = 'repwise.prefs';
const defaults = { restEnabled: true, restSeconds: 90, alerts: true, keepAwake: true, showPlates: true };

let cache = null;
const listeners = new Set();

function read() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...defaults };
  }
}

export function getPrefs() {
  if (!cache) cache = read();
  return cache;
}

export function setPrefs(patch) {
  cache = { ...getPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function usePrefs() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getPrefs,
  );
}
