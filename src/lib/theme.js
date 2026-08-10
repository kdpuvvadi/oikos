const themeStorageKey = 'oikos_theme';

export function preferredSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function savedTheme() {
  const theme = window.localStorage.getItem(themeStorageKey);
  return theme === 'dark' || theme === 'light' ? theme : '';
}

export function activeTheme() {
  return document.documentElement.dataset.theme || savedTheme() || preferredSystemTheme();
}

export function applyTheme(theme, { persist = true } = {}) {
  const resolved = theme === 'dark' || theme === 'light' ? theme : preferredSystemTheme();
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.classList.toggle('dark', resolved === 'dark');
  if (persist) {
    window.localStorage.setItem(themeStorageKey, resolved);
  }
  return resolved;
}

export function initializeTheme() {
  applyTheme(savedTheme() || preferredSystemTheme(), { persist: false });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!savedTheme()) applyTheme(preferredSystemTheme(), { persist: false });
  });
}

export function toggleTheme() {
  return applyTheme(activeTheme() === 'dark' ? 'light' : 'dark');
}
