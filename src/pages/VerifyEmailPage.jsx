import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const { setPendingVerificationEmail } = useAuth();
  const [status, setStatus] = useState({ type: 'pending', message: 'Verifying your email now...' });

  useEffect(() => {
    const token = String(searchParams.get('token') || searchParams.get('verificationToken') || '').trim();
    const email = String(searchParams.get('email') || '').trim().toLowerCase();
    if (email) setPendingVerificationEmail(email);

    if (!token) {
      setStatus({
        type: 'warning',
        message: 'Open the verification link from your email to finish verifying your account.'
      });
      return;
    }

    let cancelled = false;
    setStatus({ type: 'pending', message: 'Verifying your email now...' });

    void (async () => {
      try {
        const result = await verifyEmail(token);
        if (cancelled) return;
        setPendingVerificationEmail('');
        setStatus({
          type: 'success',
          message: result.message || 'Email verified. You can sign in now.'
        });
      } catch (error) {
        if (cancelled) return;
        setStatus({
          type: 'error',
          message: error.message || 'Verification failed.'
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, setPendingVerificationEmail]);

  return (
    <section className="mx-auto w-full max-w-[880px] px-4 py-8 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Email verification</CardTitle>
          <CardDescription
            className={cn(
              status.type === 'success' && 'text-[var(--chart-2)]',
              status.type === 'error' && 'text-destructive',
              status.type === 'warning' && 'text-[var(--chart-3)]'
            )}
          >
            {status.message}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/">Go to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
