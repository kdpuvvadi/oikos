import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestVerification } from '@/lib/api';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export default function AuthPage() {
  const {
    user,
    isApproved,
    login,
    register,
    logout,
    pendingVerificationEmail,
    setPendingVerificationEmail
  } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState('login');
  const [submitting, setSubmitting] = useState(false);
  const approvalPending = Boolean(user && !isApproved);

  async function handleLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setSubmitting(true);
    try {
      const result = await login(data);
      if (result?.requiresVerification) {
        form.reset();
        setPendingVerificationEmail(result.email || String(data.email || '').trim().toLowerCase());
        toast(result.message || 'Check your email to verify your account.');
        return;
      }
      if (result?.approvalPending) {
        form.reset();
        toast('Admin approval is still pending.');
        return;
      }
      toast('Logged in.');
    } catch (error) {
      if (error.data?.requiresVerification) {
        setPendingVerificationEmail(error.data.email || String(data.email || '').trim().toLowerCase());
      }
      toast(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setSubmitting(true);
    try {
      const result = await register(data);
      if (result?.requiresVerification) {
        form.reset();
        setPendingVerificationEmail(result.email || String(data.email || '').trim().toLowerCase());
        toast(result.message || 'Check your email to verify your account.');
        return;
      }
      if (result?.approvalPending) {
        form.reset();
        toast('Admin approval is still pending.');
        return;
      }
      toast('Account created.');
    } catch (error) {
      if (error.data?.requiresVerification) {
        setPendingVerificationEmail(error.data.email || String(data.email || '').trim().toLowerCase());
      }
      toast(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function resendVerification(email = pendingVerificationEmail) {
    const targetEmail = String(email || '').trim();
    if (!targetEmail) {
      toast('Email address unavailable for verification.');
      return;
    }
    try {
      const result = await requestVerification(targetEmail);
      setPendingVerificationEmail(result.email || targetEmail);
      toast(result.message || 'Verification email sent.');
    } catch (error) {
      toast(error.message);
    }
  }

  async function handleLogout() {
    try {
      await logout();
      toast('Logged out.');
    } catch (error) {
      toast(error.message);
    }
  }

  return (
    <div
      id="authPage"
      className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center px-4 py-8 sm:px-6"
    >
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-extrabold uppercase tracking-wide text-primary">Oikos</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {approvalPending
              ? 'Almost there'
              : mode === 'register'
                ? 'Create account'
                : 'Welcome back'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {approvalPending
              ? 'Your account is waiting on admin approval.'
              : mode === 'register'
                ? 'Track household spending in one place.'
                : 'Sign in to continue tracking expenses.'}
          </p>
        </div>
        <ThemeToggle id="themeToggleGuest" className="size-9 shrink-0" />
      </div>

      {!user && pendingVerificationEmail ? (
        <Card className="mb-4 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Verify your email</CardTitle>
            <CardDescription>{pendingVerificationEmail}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Check your inbox for the verification link. If it didn’t arrive, resend it below.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void resendVerification(pendingVerificationEmail)}
              >
                Resend email
              </Button>
              <Button asChild variant="ghost">
                <Link to="/verify-email">Verification page</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {approvalPending ? (
        <Card>
          <CardHeader>
            <CardTitle>Admin approval pending</CardTitle>
            <CardDescription>
              Your email is verified. An administrator still needs to approve your account before you can use Oikos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-medium">
              {user?.email || ''}
            </div>
            <p className="text-sm text-muted-foreground">
              Check back later or contact your administrator.
            </p>
            <Button type="button" variant="outline" className="w-full" onClick={() => void handleLogout()}>
              Logout
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden shadow-sm">
          <div className="grid grid-cols-2 gap-1 border-b border-border bg-muted/40 p-1">
            <button
              type="button"
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                mode === 'login'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setMode('login')}
            >
              Sign in
            </button>
            <button
              type="button"
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                mode === 'register'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setMode('register')}
            >
              Sign up
            </button>
          </div>

          {mode === 'login' ? (
            <>
              <CardHeader>
                <CardTitle>Sign in</CardTitle>
                <CardDescription>Use your email and password</CardDescription>
              </CardHeader>
              <CardContent>
                <form id="loginForm" className="grid gap-4" onSubmit={handleLogin}>
                  <div className="grid gap-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" name="email" autoComplete="email" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      name="password"
                      autoComplete="current-password"
                      required
                    />
                  </div>
                  <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                    {submitting ? 'Signing in…' : 'Sign in'}
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Create account</CardTitle>
                <CardDescription>You’ll verify email, then wait for admin approval</CardDescription>
              </CardHeader>
              <CardContent>
                <form id="registerForm" className="grid gap-4" onSubmit={handleRegister}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="register-first">First name</Label>
                      <Input
                        id="register-first"
                        type="text"
                        name="firstName"
                        autoComplete="given-name"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="register-last">Last name</Label>
                      <Input
                        id="register-last"
                        type="text"
                        name="lastName"
                        autoComplete="family-name"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input id="register-email" type="email" name="email" autoComplete="email" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="register-password">Password</Label>
                    <Input
                      id="register-password"
                      type="password"
                      name="password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                    <p className="text-xs text-muted-foreground">At least 8 characters</p>
                  </div>
                  <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                    {submitting ? 'Creating…' : 'Create account'}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
