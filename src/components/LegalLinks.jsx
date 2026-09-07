import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function LegalLinks({ className, prefix }) {
  return (
    <p className={cn('text-center text-xs text-muted-foreground', className)}>
      {prefix ? <>{prefix}{' '}</> : null}
      <Link to="/terms" className="underline-offset-4 hover:underline">Terms of Service</Link>
      {' and '}
      <Link to="/privacy" className="underline-offset-4 hover:underline">Privacy Policy</Link>
    </p>
  );
}
