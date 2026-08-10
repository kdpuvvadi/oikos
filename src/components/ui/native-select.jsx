import * as React from 'react';
import { cn } from '@/lib/utils';

function NativeSelect({ className, children, ...props }) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        'h-10 w-full min-w-0 max-w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground transition-colors outline-none',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'md:h-9 md:text-sm',
        'dark:bg-input/40 dark:[color-scheme:dark]',
        '[&>option]:bg-popover [&>option]:text-popover-foreground',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export { NativeSelect };
