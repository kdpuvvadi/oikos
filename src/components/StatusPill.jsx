import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function StatusPill({ variant = 'success', children, className }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        variant === 'success'
          && 'border-transparent bg-[color-mix(in_srgb,var(--chart-2)_18%,transparent)] text-[var(--chart-2)]',
        variant === 'warning'
          && 'border-transparent bg-[color-mix(in_srgb,var(--chart-3)_18%,transparent)] text-[color-mix(in_srgb,var(--chart-3)_85%,black)] dark:text-[var(--chart-3)]',
        className
      )}
    >
      {children}
    </Badge>
  );
}

export default StatusPill;
