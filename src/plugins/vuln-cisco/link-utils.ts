/** Shared link utilities for the vuln-cisco plugin. */

const ALLOWED_SCHEMES = ['https:', 'http:'];

/**
 * Open a URL in a centered 1250×800 popup window.
 *
 * - Validates URL scheme (https/http only) to prevent javascript: injection
 * - Centers on the current browser window, not the physical display
 * - Falls back to default anchor navigation if the popup is blocked
 */
export function openAdvisoryPopup(url: string, e?: React.MouseEvent) {
  e?.stopPropagation();

  // Scheme validation — reject non-http(s) URLs
  try {
    const parsed = new URL(url, window.location.origin);
    if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
      return;
    }
  } catch {
    return;
  }

  const w = 1250;
  const h = 800;
  const left = Math.max(0, window.screenX + (window.outerWidth - w) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - h) / 2);

  const popup = window.open(url, '_blank', `width=${w},height=${h},left=${left},top=${top},noopener,noreferrer`);

  // Only prevent default if popup succeeded — if blocked, let the anchor navigate normally
  if (popup) {
    e?.preventDefault();
  }
}
