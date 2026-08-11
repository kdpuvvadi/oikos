import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function DigestLogoModeSelect({
  value,
  onChange,
  disabled = false,
  id = 'digest-logo-mode',
  className
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3', className)}>
      <Label htmlFor={id} className="shrink-0 font-normal text-muted-foreground">
        Logo
      </Label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="embed">Embed in email</option>
        <option value="link">Link from site</option>
      </select>
    </div>
  );
}
