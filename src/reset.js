import { clearLocalData } from './db';

// Wipes everything Repwise keeps in this browser (data, settings, saved copy of the app) so the
// next load looks like a first visit. Signing out first stops a synced account from refilling it.
export async function resetDevice(signOut) {
  try {
    await signOut?.();
  } catch {
    /* ignore */
  }
  await clearLocalData();
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('repwise') || k.startsWith('sb-'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
    const keys = (await globalThis.caches?.keys?.()) ?? [];
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch {
    /* ignore */
  }
}
