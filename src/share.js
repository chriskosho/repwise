export const DONATE_URL = 'https://paypal.me/chriskosho';
export const appUrl = () => `${window.location.origin}${import.meta.env.BASE_URL}`;

// Opens the phone's share sheet when there is one, otherwise copies the link.
// Returns 'shared', 'copied', or 'failed'.
export async function shareApp() {
  const data = { title: 'Repwise', text: 'Repwise is a free, simple workout log. It works offline and keeps your data on your device.', url: appUrl() };
  try {
    if (navigator.share) {
      await navigator.share(data);
      return 'shared';
    }
  } catch (err) {
    if (err?.name === 'AbortError') return 'cancelled';
  }
  try {
    await navigator.clipboard.writeText(data.url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
