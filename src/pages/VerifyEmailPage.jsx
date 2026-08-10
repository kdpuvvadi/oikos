import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { requestVerification, verifyEmail } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

function waitingMessage(email) {
  return email
    ? 'We sent a verification link to your email. Open it to finish setup, or resend below.'
    : 'Open the verification link from your email, or sign up again to get a new one.';
}

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const { pendingVerificationEmail, setPendingVerificationEmail } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState({ type: 'pending', message: 'Checking verification…' });
  const [resending, setResending] = useState(false);

  const token = String(searchParams.get('token') || searchParams.get('verificationToken') || '').trim();
  const emailFromQuery = String(searchParams.get('email') || '').trim().toLowerCase();
  const email = emailFromQuery || pendingVerificationEmail || '';

  useEffect(() => {
    if (emailFromQuery) setPendingVerificationEmail(emailFromQuery);
  }, [emailFromQuery, setPendingVerificationEmail]);

  useEffect(() => {
    if (!token) {
      setStatus({ type: 'warning', message: waitingMessage(email) });
      return;
    }

    let cancelled = false;
    setStatus({ type: 'pending', message: 'Verifying your email now…' });

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
    // Only re-verify when the token changes — not when email/pending clears after success.
  }, [token, setPendingVerificationEmail]);

  useEffect(() => {
    if (token) return;
    setStatus({ type: 'warning', message: waitingMessage(email) });
  }, [token, email]);

  async function handleResend() {
    const targetEmail = String(email || '').trim();
    if (!targetEmail) {
      toast('Email address unavailable for verification.');
      return;
    }
    setResending(true);
    try {
      const result = await requestVerification(targetEmail);
      setPendingVerificationEmail(result.email || targetEmail);
      toast(result.message || 'Verification email sent.');
    } catch (error) {
      toast(error.message);
    } finally {
      setResending(false);
    }
  }

  function handleBackToLogin() {
    setPendingVerificationEmail('');
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-extrabold uppercase tracking-wide text-primary">Oikos</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {status.type === 'success' ? 'Email verified' : 'Verify your email'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {status.type === 'success'
              ? 'You’re ready to sign in.'
              : 'Confirm your address to continue.'}
          </p>
        </div>
        <ThemeToggle className="size-9 shrink-0" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {status.type === 'success'
              ? 'All set'
              : status.type === 'pending' && token
                ? 'Verifying…'
                : 'Check your inbox'}
          </CardTitle>
          {email ? <CardDescription>{email}</CardDescription> : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <p
            className={cn(
              'text-sm',
              status.type === 'success' && 'text-[var(--chart-2)]',
              status.type === 'error' && 'text-destructive',
              (status.type === 'warning' || status.type === 'pending') && 'text-muted-foreground'
            )}
          >
            {status.message}
          </p>

          <div className="flex flex-col gap-2">
            {status.type !== 'success' && email ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={resending}
                onClick={() => void handleResend()}
              >
                {resending ? 'Sending…' : 'Resend verification email'}
              </Button>
            ) : null}

            <Button asChild variant={status.type === 'success' ? 'default' : 'secondary'} className="w-full">
              <Link to="/" onClick={handleBackToLogin}>
                Back to sign in
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
