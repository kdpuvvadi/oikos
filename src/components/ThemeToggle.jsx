import { useEffect, useState } from 'react';
import { MoonIcon, SunIcon } from 'lucide-react';
import { activeTheme, toggleTheme as flipTheme } from '@/lib/theme';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className, id, size = 'icon' }) {
  const [theme, setTheme] = useState(() => (typeof document === 'undefined' ? 'light' : activeTheme()));
  const nextLabel = theme === 'dark' ? 'Light mode' : 'Dark mode';

  useEffect(() => {
    setTheme(activeTheme());
  }, []);

  function handleClick() {
    setTheme(flipTheme());
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={cn(className)}
      id={id}
      data-theme-toggle
      aria-label={`Switch to ${nextLabel.toLowerCase()}`}
      title={nextLabel}
      onClick={handleClick}
    >
      {theme === 'dark' ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </Button>
  );
}
