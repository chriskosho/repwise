import { useSyncExternalStore } from 'react';

// 'system' follows the device; 'light' and 'dark' force a palette. Stored per device
// (not in your profile), since a phone and a laptop may reasonably differ.
const KEY = 'repwise.theme';
const listeners = new Set();

export function getTheme() {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(theme = getTheme()) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
}

export function setTheme(theme) {
  try {
    if (theme === 'light' || theme === 'dark') localStorage.setItem(KEY, theme);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the choice just won't persist */
  }
  applyTheme(theme);
  listeners.forEach((l) => l());
}

const subscribe = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
export const useTheme = () => useSyncExternalStore(subscribe, getTheme, () => 'system');
