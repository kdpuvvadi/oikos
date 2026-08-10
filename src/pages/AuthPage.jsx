import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestVerification } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ThemeToggle } from '../components/ThemeToggle';

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
  const approvalPending = Boolean(user && !isApproved);

  async function handleLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
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
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
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
    <div className="auth-shell" id="authPage">
      <div className="page-title">
        <h1 id="authTitle">{mode === 'register' ? 'Create account' : 'Sign in'}</h1>
      </div>

      <div id="authStatus">
        {!user && pendingVerificationEmail ? (
          <article className="panel auth-status-panel">
            <div className="detail-list">
              <div className="detail-row">
                <span className="detail-label">Verification pending</span>
                <strong className="detail-value">{pendingVerificationEmail}</strong>
              </div>
              <p className="auth-status-copy">
                Check your inbox for the verification email before signing in. If it didn’t arrive, resend it here.
              </p>
              <div className="inline-actions">
                <button
                  type="button"
                  className="ghost"
                  data-resend-verification={pendingVerificationEmail}
                  onClick={() => void resendVerification(pendingVerificationEmail)}
                >
                  Resend verification email
                </button>
                <Link className="text-link" to="/verify-email">Open verification page</Link>
              </div>
            </div>
          </article>
        ) : null}
      </div>

      <div id="authForms" className={approvalPending ? 'hidden' : ''}>
        <div className="auth-shell-actions">
          <ThemeToggle id="themeToggleGuest" />
        </div>
        <div className="auth-grid">
          <form
            id="loginForm"
            className={`panel form-stack${mode === 'register' ? ' hidden' : ''}`}
            onSubmit={handleLogin}
          >
            <h2>Login</h2>
            <label>
              Email
              <input type="email" name="email" autoComplete="email" required />
            </label>
            <label>
              Password
              <input type="password" name="password" autoComplete="current-password" required />
            </label>
            <button type="submit">Login</button>
            <div className="auth-switch">
              <span>New to Oikos?</span>
              <button type="button" className="ghost" data-auth-mode="register" onClick={() => setMode('register')}>
                Create account
              </button>
            </div>
          </form>

          <form
            id="registerForm"
            className={`panel form-stack${mode === 'register' ? '' : ' hidden'}`}
            onSubmit={handleRegister}
          >
            <h2>Create account</h2>
            <label>
              First name
              <input type="text" name="firstName" autoComplete="given-name" required />
            </label>
            <label>
              Last name
              <input type="text" name="lastName" autoComplete="family-name" required />
            </label>
            <label>
              Email
              <input type="email" name="email" autoComplete="email" required />
            </label>
            <label>
              Password
              <input type="password" name="password" autoComplete="new-password" minLength={8} required />
            </label>
            <button type="submit">Create account</button>
            <div className="auth-switch">
              <span>Already have an account?</span>
              <button type="button" className="ghost" data-auth-mode="login" onClick={() => setMode('login')}>
                Sign in
              </button>
            </div>
          </form>
        </div>
      </div>

      <div id="approvalPending" className={approvalPending ? '' : 'hidden'}>
        <article className="panel approval-pending-panel">
          <h2>Admin approval pending</h2>
          <p>
            Your email is verified, but an administrator still needs to approve your account before you can use Oikos.
          </p>
          <p><strong id="approvalPendingEmail">{user?.email || ''}</strong></p>
          <p>Please check back later or contact your administrator.</p>
          <div className="inline-actions">
            <button type="button" className="ghost" id="approvalLogoutButton" onClick={() => void handleLogout()}>
              Logout
            </button>
          </div>
        </article>
      </div>
    </div>
  );
}
