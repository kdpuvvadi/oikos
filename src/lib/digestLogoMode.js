export const DIGEST_LOGO_MODE_KEY = 'oikos_digest_logo_mode';

export function normalizeDigestLogoMode(value) {
  return String(value || '').trim().toLowerCase() === 'link' ? 'link' : 'embed';
}

export function getStoredDigestLogoMode() {
  try {
    if (typeof localStorage === 'undefined') return 'embed';
    return normalizeDigestLogoMode(localStorage.getItem(DIGEST_LOGO_MODE_KEY));
  } catch {
    return 'embed';
  }
}

export function setStoredDigestLogoMode(mode) {
  const next = normalizeDigestLogoMode(mode);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DIGEST_LOGO_MODE_KEY, next);
    }
  } catch {
    // ignore storage failures
  }
  return next;
}
