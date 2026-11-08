import { useEffect, useState } from 'react';

// Tells the app when a newer version has been installed in the background, so it can offer a reload.
export function useUpdateReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const onReady = () => setReady(true);
    window.addEventListener('repwise-update-ready', onReady);
    return () => window.removeEventListener('repwise-update-ready', onReady);
  }, []);
  return ready;
}
