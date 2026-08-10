import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '../lib/api';
import { useAuth } from '../context/AuthContext';

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
    <section className="auth-shell">
      <div id="verificationStatus">
        <article className={`verification-card ${status.type || ''}`}>
          <h1>Email verification</h1>
          <p>{status.message}</p>
          <div className="inline-actions">
            <Link className="ghost-link" to="/">Go to sign in</Link>
          </div>
        </article>
      </div>
    </section>
  );
}
