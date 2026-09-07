const AUTH_EVENT_KEY = 'oikos_auth_event';
const DISMISS_KEY = 'oikos_google_link_prompt';

export function markAuthEvent(event) {
  try {
    sessionStorage.setItem(AUTH_EVENT_KEY, JSON.stringify({
      method: event?.method || '',
      isNew: Boolean(event?.isNew),
      userId: event?.userId || '',
      at: Date.now()
    }));
  } catch {
    // ignore quota / private mode
  }
}

export function readAuthEvent() {
  try {
    const raw = sessionStorage.getItem(AUTH_EVENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearAuthEvent() {
  try {
    sessionStorage.removeItem(AUTH_EVENT_KEY);
  } catch {
    // ignore
  }
}

export function wasGoogleLinkPromptDismissed(userId) {
  if (!userId) return false;
  try {
    return localStorage.getItem(`${DISMISS_KEY}:${userId}`) === '1';
  } catch {
    return false;
  }
}

export function dismissGoogleLinkPrompt(userId) {
  if (!userId) return;
  try {
    localStorage.setItem(`${DISMISS_KEY}:${userId}`, '1');
  } catch {
    // ignore quota / private mode
  }
  clearAuthEvent();
}

export function isRecentlyLinked(linkedAt, maxAgeMs = 5 * 60 * 1000) {
  const created = Date.parse(String(linkedAt || '').replace(' ', 'T'));
  return Number.isFinite(created) && (Date.now() - created) < maxAgeMs;
}
