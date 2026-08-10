import { useEffect, useState } from 'react';
import { activeTheme, toggleTheme as flipTheme } from '../lib/theme';

function ThemeIcon({ theme }) {
  if (theme === 'dark') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 4.75a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V5.5a.75.75 0 0 1 .75-.75Zm0 11a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Zm0 1.5a5.25 5.25 0 1 1 0-10.5 5.25 5.25 0 0 1 0 10.5Zm6.5-6a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Zm-16 0a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Zm13.096-5.846a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 1 1-1.06 1.061l-1.06-1.06a.75.75 0 0 1 0-1.061Zm-9.192 9.192a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 1 1-1.06 1.061l-1.06-1.06a.75.75 0 0 1 0-1.061Zm10.252 1.06a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 1 1-1.06 1.061l-1.06-1.06a.75.75 0 0 1 0-1.061Zm-10.252-10.252a.75.75 0 0 1 1.06 0l1.06 1.06A.75.75 0 0 1 7.464 8.53l-1.06-1.06a.75.75 0 0 1 0-1.061ZM12 17a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 12 17Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M14.768 3.96a.75.75 0 0 1 .79.214 7.99 7.99 0 0 0 1.947 1.662 8 8 0 1 0-9.679 12.86 8.08 8.08 0 0 0 8.208-.542.75.75 0 0 1 1.125.804 9.5 9.5 0 1 1-2.39-14.762Z" />
    </svg>
  );
}

export function ThemeToggle({ className = 'ghost theme-toggle', id }) {
  const [theme, setTheme] = useState(() => (typeof document === 'undefined' ? 'light' : activeTheme()));
  const nextLabel = theme === 'dark' ? 'Light mode' : 'Dark mode';

  useEffect(() => {
    setTheme(activeTheme());
  }, []);

  function handleClick() {
    const next = flipTheme();
    setTheme(next);
  }

  return (
    <button
      type="button"
      className={className}
      id={id}
      data-theme-toggle
      aria-label={`Switch to ${nextLabel.toLowerCase()}`}
      title={nextLabel}
      onClick={handleClick}
    >
      <ThemeIcon theme={theme} />
    </button>
  );
}
