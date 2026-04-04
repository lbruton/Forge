/** Shared link utilities for the vuln-cisco plugin. */

const ALLOWED_SCHEMES = ['https:', 'http:'];

/**
 * Open a URL in a centered 1250×800 popup window.
 *
 * - Validates URL scheme (https/http only) to prevent javascript: injection
 * - Centers on the current browser window, not the physical display
 * - Falls back to a new tab if popup is blocked
 */
export function openAdvisoryPopup(url: string, e?: React.MouseEvent) {
  // Always prevent default FIRST — the <a href> will navigate the main tab otherwise
  e?.preventDefault();
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

  // If popup was blocked, fall back to opening in a new tab
  if (!popup) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
