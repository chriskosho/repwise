import { useSyncExternalStore } from 'react';

const subscribe = (cb) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};

// Whether the browser thinks it has a connection (it can be wrong behind captive portals,
// but "offline" is reliable).
export const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
