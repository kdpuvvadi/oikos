import { useEffect, useRef, useState } from 'react';
import { getSignInMethods, requestVerification } from '@/lib/api';
import { TRANSACTION_PAGE_SIZE_OPTIONS } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useData } from '@/context/DataContext';
import {
  userDisplayName,
  verificationBadge,
  approvalBadge,
  isApprovedUser
} from '@/lib/transactions';
import { PageHeader } from '@/components/PageHeader';
import { UserAvatar } from '@/components/UserAvatar';
import { GoogleMark } from '@/components/GoogleMark';
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
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { StatusPill } from '@/components/StatusPill';

function DetailRow({ label, children }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-start sm:gap-4">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div className="min-w-0 space-y-2">{children}</div>
    </div>
  );
}

export default function MePage() {
  const {
    user,
    saveProfile,
    linkOAuth,
    pendingVerificationEmail,
    setPendingVerificationEmail
  } = useAuth();
  const { toast } = useToast();
  const { appVersion, appBranch, pocketbaseVersion, loadAppVersion } = useData();
  const [editMode, setEditMode] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [signInMethods, setSignInMethods] = useState({ password: true, oauth: [] });
  const [linkingProvider, setLinkingProvider] = useState('');
  const avatarInputRef = useRef(null);

  useEffect(() => {
    void loadAppVersion().catch(() => {});
  }, [loadAppVersion]);

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName || '');
    setLastName(user.lastName || '');
    setEmail(user.email || '');
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void getSignInMethods().then((methods) => {
      if (!cancelled) setSignInMethods(methods);
    }).catch(() => {
      if (!cancelled) setSignInMethods({ password: true, oauth: [] });
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!user) {
    return (
      <section id="mePage" className="space-y-6">
        <div id="meProfile">
          <p className="text-sm text-muted-foreground">Please sign in to view your profile.</p>
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

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setAvatarBusy(true);
    try {
      await saveProfile({ avatar: file });
      toast('Profile picture updated.');
    } catch (error) {
      toast(error.message);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleAvatarRemove() {
    if (!user.avatarUrl || avatarBusy) return;
    setAvatarBusy(true);
    try {
      await saveProfile({ avatar: null });
      toast('Profile picture removed.');
    } catch (error) {
      toast(error.message);
    } finally {
      setAvatarBusy(false);
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

  async function toggleWeeklyDigest() {
    const nextValue = !user.weeklyDigest;
    try {
      await saveProfile({ weeklyDigest: nextValue });
      toast(nextValue ? 'Weekly digest enabled.' : 'Weekly digest disabled.');
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

  function handleLinkOAuth(provider) {
    if (linkingProvider) return;
    setLinkingProvider(provider);
    linkOAuth(provider)
      .then((result) => {
        if (result?.methods) setSignInMethods(result.methods);
        toast('Google account linked.');
      })
      .catch((error) => {
        toast(error.message);
      })
      .finally(() => {
        setLinkingProvider('');
      });
  }

  const versionDetails = [
    appVersion ? `Version: ${appVersion}` : '',
    appBranch ? `Branch: ${appBranch}` : '',
    pocketbaseVersion ? `PocketBase: ${pocketbaseVersion}` : ''
  ].filter(Boolean);

  const avatarRow = (
    <DetailRow label="Photo">
      <div className="flex flex-wrap items-center gap-4">
        <UserAvatar user={user} className="size-16 text-base" size="lg" />
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
              className="sr-only"
              data-avatar-input
              onChange={(event) => void handleAvatarChange(event)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={avatarBusy}
              data-avatar-upload
              onClick={() => avatarInputRef.current?.click()}
            >
              {avatarBusy ? 'Updating…' : user.avatarUrl ? 'Change photo' : 'Upload photo'}
            </Button>
            {user.avatarUrl ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={avatarBusy}
                data-avatar-remove
                onClick={() => void handleAvatarRemove()}
              >
                Remove
              </Button>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            JPEG, PNG, GIF, WebP, or SVG up to 2 MB.
          </p>
        </div>
      </div>
    </DetailRow>
  );

  const sharedRows = (
    <>
      <DetailRow label="Sign-in">
        <div className="grid gap-3" data-sign-in-methods>
          {signInMethods.password ? (
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">Email and password</p>
                <p className="text-sm text-muted-foreground">
                  Sign in with the email and password for this account.
                </p>
              </div>
              <StatusPill>Available</StatusPill>
            </div>
          ) : null}
          {signInMethods.oauth.map((provider) => (
            <div key={provider.name} className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  {provider.name === 'google' ? <GoogleMark /> : null}
                  {provider.displayName || provider.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {provider.linked
                    ? `You can sign in with ${provider.displayName || provider.name}.`
                    : `Link ${provider.displayName || provider.name} to sign in without your password.`}
                </p>
              </div>
              {provider.linked ? (
                <StatusPill>Linked</StatusPill>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-link-oauth={provider.name}
                  disabled={Boolean(linkingProvider)}
                  onClick={() => handleLinkOAuth(provider.name)}
                >
                  {linkingProvider === provider.name
                    ? 'Linking…'
                    : `Link ${provider.displayName || provider.name}`}
                </Button>
              )}
            </div>
          ))}
        </div>
      </DetailRow>
      <DetailRow label="Transaction page size">
        <NativeSelect
          data-transaction-page-size
          value={user.transactionPageSize || 25}
          onChange={(event) => void updatePageSize(event.target.value)}
        >
          {TRANSACTION_PAGE_SIZE_OPTIONS.map((value) => (
            <option key={value} value={value}>{value} per page</option>
          ))}
        </NativeSelect>
        <p className="text-sm text-muted-foreground">
          Choose how many transactions load on each page by default.
        </p>
      </DetailRow>
      <DetailRow label="Email verification">
        <p className="text-sm">
          {user.verified ? 'Your email is verified.' : 'Your email still needs verification.'}
        </p>
        {!user.verified ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-resend-verification
            onClick={() => void resendVerification()}
          >
            Resend verification email
          </Button>
        ) : null}
      </DetailRow>
      <DetailRow label="Admin approval">
        <div className="flex flex-wrap items-center gap-2">
          {approvalBadge(user)}
        </div>
        <p className="text-sm text-muted-foreground">
          {isApprovedUser(user)
            ? 'Your account is approved.'
            : 'Your account is waiting for admin approval.'}
        </p>
      </DetailRow>
      <DetailRow label="Weekly digest">
        <Switch
          checked={Boolean(user.weeklyDigest)}
          data-weekly-digest
          onCheckedChange={() => void toggleWeeklyDigest()}
        />
        <p className="text-sm text-muted-foreground">
          {user.weeklyDigest
            ? 'On by default — you’ll get a Monday email with last week’s spending. Turn off to opt out.'
            : 'Weekly spending summary emails are off.'}
        </p>
      </DetailRow>
      <DetailRow label="Email visibility">
        <Switch
          checked={Boolean(user.emailVisibility)}
          data-email-visibility
          onCheckedChange={() => void toggleEmailVisibility()}
        />
        <p className="text-sm text-muted-foreground">
          {user.emailVisibility
            ? 'Your email is visible to other users and admins.'
            : 'Your email is hidden from other users and admin lists.'}
        </p>
      </DetailRow>
    </>
  );

  return (
    <section id="mePage" className="space-y-6">
      <div id="meProfile" className="space-y-6">
        <PageHeader
          eyebrow="Profile"
          title="Me"
          actions={
            editMode ? (
              <>
                <Button type="submit" form="profileEditForm">Save profile</Button>
                <Button
                  type="button"
                  variant="outline"
                  data-cancel-profile-edit
                  onClick={() => setEditMode(false)}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                data-edit-profile
                onClick={() => setEditMode(true)}
              >
                Edit profile
              </Button>
            )
          }
        />

        {editMode ? (
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Edit profile</CardTitle>
              <CardDescription>Update your name and email</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                id="profileEditForm"
                className="grid gap-6"
                data-profile-form
                onSubmit={handleSaveProfile}
              >
                {avatarRow}
                <div className="grid gap-1.5">
                  <Label htmlFor="profile-first-name">First name</Label>
                  <Input
                    id="profile-first-name"
                    type="text"
                    name="firstName"
                    value={firstName}
                    autoComplete="given-name"
                    required
                    onChange={(event) => setFirstName(event.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="profile-last-name">Last name</Label>
                  <Input
                    id="profile-last-name"
                    type="text"
                    name="lastName"
                    value={lastName}
                    autoComplete="family-name"
                    required
                    onChange={(event) => setLastName(event.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">Your full name is shown around the app.</p>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="profile-email">Email</Label>
                  <Input
                    id="profile-email"
                    type="email"
                    name="email"
                    value={email}
                    autoComplete="email"
                    required
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span>{user.email || '-'}</span>
                    {verificationBadge(user)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    If your email changes, you may need to verify the new address again.
                  </p>
                </div>
                {sharedRows}
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your account details and preferences</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              {avatarRow}
              <DetailRow label="Name">
                <p className="font-medium">{userDisplayName(user)}</p>
              </DetailRow>
              <DetailRow label="Email">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{user.email || '-'}</span>
                  {verificationBadge(user)}
                </div>
              </DetailRow>
              {sharedRows}
            </CardContent>
          </Card>
        )}

        {versionDetails.length ? (
          <p className="text-xs text-muted-foreground">{versionDetails.join(' | ')}</p>
        ) : null}
      </div>
    </section>
  );
}
