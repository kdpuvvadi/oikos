import { useEffect, useState } from 'react';
import { requestVerification } from '../lib/api';
import { TRANSACTION_PAGE_SIZE_OPTIONS } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useData } from '../context/DataContext';
import {
  userDisplayName,
  verificationBadge,
  approvalBadge,
  isApprovedUser
} from '../lib/transactions';

export default function MePage() {
  const {
    user,
    saveProfile,
    pendingVerificationEmail,
    setPendingVerificationEmail
  } = useAuth();
  const { toast } = useToast();
  const { appVersion, appBranch, loadAppVersion } = useData();
  const [editMode, setEditMode] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    void loadAppVersion().catch(() => {});
  }, [loadAppVersion]);

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName || '');
    setLastName(user.lastName || '');
    setEmail(user.email || '');
  }, [user]);

  if (!user) {
    return (
      <section id="mePage">
        <div id="meProfile">
          <p>Please sign in to view your profile.</p>
        </div>
      </section>
    );
  }

  async function handleSaveProfile(event) {
    event.preventDefault();
    const nextFirst = firstName.trim();
    const nextLast = lastName.trim();
    const nextEmail = email.trim();
    if (!nextFirst || !nextLast || !nextEmail) {
      toast('First name, last name, and email are required.');
      return;
    }
    try {
      const emailChanged = nextEmail.toLowerCase() !== String(user.email || '').toLowerCase();
      await saveProfile({ firstName: nextFirst, lastName: nextLast, email: nextEmail });
      setEditMode(false);
      toast(emailChanged ? 'Profile updated. Verify the new email if prompted.' : 'Profile updated.');
    } catch (error) {
      toast(error.message);
    }
  }

  async function toggleEmailVisibility() {
    const nextValue = !user.emailVisibility;
    try {
      await saveProfile({ emailVisibility: nextValue });
      toast(`Email visibility ${nextValue ? 'enabled' : 'disabled'}.`);
    } catch (error) {
      toast(error.message);
    }
  }

  async function updatePageSize(nextValue) {
    const pageSize = Number.parseInt(String(nextValue || ''), 10);
    if (!TRANSACTION_PAGE_SIZE_OPTIONS.includes(pageSize)) return;
    try {
      await saveProfile({ transactionPageSize: pageSize });
      toast('Transaction page size updated.');
    } catch (error) {
      toast(error.message);
    }
  }

  async function resendVerification() {
    const targetEmail = String(user.email || pendingVerificationEmail || '').trim();
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

  const versionDetails = [
    appVersion ? `Version: ${appVersion}` : '',
    appBranch ? `Branch: ${appBranch}` : ''
  ].filter(Boolean);

  const pageSizeSelect = (
    <label>
      <select
        data-transaction-page-size
        value={user.transactionPageSize || 25}
        onChange={(event) => void updatePageSize(event.target.value)}
      >
        {TRANSACTION_PAGE_SIZE_OPTIONS.map((value) => (
          <option key={value} value={value}>{value} per page</option>
        ))}
      </select>
    </label>
  );

  const sharedRows = (
    <>
      <div className="detail-row">
        <span className="detail-label">Transaction page size</span>
        <div className="detail-value detail-stack">
          {pageSizeSelect}
          <div className="detail-help">Choose how many transactions load on each page by default.</div>
        </div>
      </div>
      <div className="detail-row">
        <span className="detail-label">Email verification</span>
        <div className="detail-value detail-stack">
          <div>{user.verified ? 'Your email is verified.' : 'Your email still needs verification.'}</div>
          {!user.verified ? (
            <button type="button" className="ghost" data-resend-verification onClick={() => void resendVerification()}>
              Resend verification email
            </button>
          ) : null}
        </div>
      </div>
      <div className="detail-row">
        <span className="detail-label">Admin approval</span>
        <div className="detail-value detail-stack">
          <div className="detail-inline">{approvalBadge(user)}</div>
          <div>
            {isApprovedUser(user)
              ? 'Your account is approved.'
              : 'Your account is waiting for admin approval.'}
          </div>
        </div>
      </div>
      <div className="detail-row">
        <span className="detail-label">Email visibility</span>
        <div className="detail-value">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={Boolean(user.emailVisibility)}
              data-email-visibility
              onChange={() => void toggleEmailVisibility()}
            />
            <span className="toggle-slider" />
          </label>
          <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
            {user.emailVisibility
              ? 'Your email is visible to other users and admins.'
              : 'Your email is hidden from other users and admin lists.'}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <section id="mePage">
      <div id="meProfile">
        <div className="page-title-bar">
          <div className="page-title">
            <p className="eyebrow">Profile</p>
            <h1>Me</h1>
          </div>
          <div className="inline-actions">
            {editMode ? (
              <>
                <button type="submit" form="profileEditForm">Save profile</button>
                <button type="button" className="ghost" data-cancel-profile-edit onClick={() => setEditMode(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" className="ghost" data-edit-profile onClick={() => setEditMode(true)}>
                Edit profile
              </button>
            )}
          </div>
        </div>

        {editMode ? (
          <article className="panel">
            <form id="profileEditForm" className="detail-list" data-profile-form onSubmit={handleSaveProfile}>
              <div className="detail-row">
                <span className="detail-label">First name</span>
                <label className="detail-value detail-stack">
                  <input
                    type="text"
                    name="firstName"
                    value={firstName}
                    autoComplete="given-name"
                    required
                    onChange={(event) => setFirstName(event.target.value)}
                  />
                </label>
              </div>
              <div className="detail-row">
                <span className="detail-label">Last name</span>
                <label className="detail-value detail-stack">
                  <input
                    type="text"
                    name="lastName"
                    value={lastName}
                    autoComplete="family-name"
                    required
                    onChange={(event) => setLastName(event.target.value)}
                  />
                  <div className="detail-help">Your full name is shown around the app.</div>
                </label>
              </div>
              <div className="detail-row">
                <span className="detail-label">Email</span>
                <label className="detail-value detail-stack">
                  <input
                    type="email"
                    name="email"
                    value={email}
                    autoComplete="email"
                    required
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <div className="detail-inline">
                    <span>{user.email || '-'}</span>
                    {verificationBadge(user)}
                  </div>
                  <div className="detail-help">If your email changes, you may need to verify the new address again.</div>
                </label>
              </div>
              {sharedRows}
            </form>
          </article>
        ) : (
          <article className="panel">
            <div className="detail-list">
              <div className="detail-row">
                <span className="detail-label">Name</span>
                <strong className="detail-value">{userDisplayName(user)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Email</span>
                <div className="detail-value detail-inline">
                  <span>{user.email || '-'}</span>
                  {verificationBadge(user)}
                </div>
              </div>
              {sharedRows}
            </div>
          </article>
        )}

        {versionDetails.length ? (
          <p className="app-version">{versionDetails.join(' | ')}</p>
        ) : null}
      </div>
    </section>
  );
}
