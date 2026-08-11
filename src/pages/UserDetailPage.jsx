import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  adminResendVerification,
  adminUpdateUser,
  approveUser,
  fetchUser,
  previewWeeklyDigest,
  sendWeeklyDigest
} from '@/lib/api';
import { money as formatMoney } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { useData } from '@/context/DataContext';
import { PageHeader } from '@/components/PageHeader';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

function userInitials(user) {
  const source = String(user?.name || user?.email || '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function StatusBadges({ user }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant={user.isAdmin ? 'default' : 'secondary'}>
        {user.isAdmin ? 'Admin' : 'User'}
      </Badge>
      <Badge
        variant="outline"
        className={cn(
          user.verified
            ? 'border-transparent bg-[color-mix(in_srgb,var(--chart-2)_18%,transparent)] text-[var(--chart-2)]'
            : 'border-transparent bg-[color-mix(in_srgb,var(--chart-3)_18%,transparent)] text-[color-mix(in_srgb,var(--chart-3)_85%,black)] dark:text-[var(--chart-3)]'
        )}
      >
        {user.verified ? 'Verified' : 'Pending verification'}
      </Badge>
      <Badge
        variant="outline"
        className={cn(
          user.approved || user.isAdmin
            ? 'border-transparent bg-[color-mix(in_srgb,var(--chart-2)_18%,transparent)] text-[var(--chart-2)]'
            : 'border-transparent bg-[color-mix(in_srgb,var(--chart-3)_18%,transparent)] text-[color-mix(in_srgb,var(--chart-3)_85%,black)] dark:text-[var(--chart-3)]'
        )}
      >
        {user.approved || user.isAdmin ? 'Approved' : 'Approval pending'}
      </Badge>
    </div>
  );
}

function SettingRow({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { invalidate, loadUsers } = useData();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [digest, setDigest] = useState(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [forceSend, setForceSend] = useState(false);

  const displayName = user?.name || user?.email || 'User';

  async function loadTarget() {
    const next = await fetchUser(id);
    setUser(next);
    return next;
  }

  async function loadDigestPreview() {
    setDigestLoading(true);
    try {
      const preview = await previewWeeklyDigest(id);
      setDigest(preview);
    } catch (error) {
      setDigest(null);
      toast(error.message);
    } finally {
      setDigestLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadTarget()
      .catch((error) => {
        if (!cancelled) {
          toast(error.message);
          navigate('/users', { replace: true });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!user) return;
    void loadDigestPreview();
  }, [user?.id]);

  const needsForce = useMemo(() => {
    if (!digest) return false;
    return Boolean(digest.empty || digest.optedOut || !digest.verified);
  }, [digest]);

  async function refreshUsers() {
    invalidate('users');
    await loadUsers(true);
  }

  async function handleApprove() {
    try {
      const result = await approveUser(id);
      setUser(result.user);
      toast('User approved.');
      await refreshUsers();
    } catch (error) {
      toast(error.message);
    }
  }

  async function handleResend() {
    try {
      const result = await adminResendVerification(id);
      toast(result.message || 'Verification email sent.');
    } catch (error) {
      toast(error.message);
    }
  }

  async function handleDigestToggle(nextEnabled) {
    try {
      const result = await adminUpdateUser(id, { weeklyDigest: nextEnabled });
      setUser(result.user);
      toast(nextEnabled ? 'Weekly digest enabled for this user.' : 'Weekly digest opted out for this user.');
      await loadDigestPreview();
      await refreshUsers();
    } catch (error) {
      toast(error.message);
    }
  }

  async function handleSendDigest() {
    setSending(true);
    try {
      const result = await sendWeeklyDigest(id, { force: forceSend || needsForce });
      toast(result.message || 'Weekly digest sent.');
      await loadDigestPreview();
    } catch (error) {
      toast(error.message);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <section className="space-y-6">
        <PageHeader eyebrow="Admin" title="User" description="Loading…" />
      </section>
    );
  }

  if (!user) return null;

  return (
    <section id="userDetailPage" className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title={displayName}
        description={user.email || 'Email hidden'}
        actions={
          <Button asChild variant="outline">
            <Link to="/users">Back to users</Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-start gap-3">
                <Avatar size="lg">
                  <AvatarFallback className="bg-primary/15 font-semibold text-primary">
                    {userInitials(user)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-2">
                  <CardTitle className="truncate text-lg">{displayName}</CardTitle>
                  <CardDescription className="truncate">{user.email || 'Email hidden'}</CardDescription>
                  <StatusBadges user={user} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <SettingRow label="First name" hint="Profile field">
                <p className="text-sm font-medium">{user.firstName || '—'}</p>
              </SettingRow>
              <SettingRow label="Last name" hint="Profile field">
                <p className="text-sm font-medium">{user.lastName || '—'}</p>
              </SettingRow>
              <SettingRow label="Page size" hint="Transactions per page">
                <p className="text-sm font-medium">{user.transactionPageSize || 25}</p>
              </SettingRow>
              <SettingRow label="Email visibility" hint="Shown to other users when on">
                <Badge variant="outline">{user.emailVisibility ? 'Visible' : 'Hidden'}</Badge>
              </SettingRow>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Account actions</CardTitle>
              <CardDescription>Verification and approval</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pt-6">
              {!user.verified ? (
                <Button type="button" variant="outline" onClick={() => void handleResend()}>
                  Resend verification
                </Button>
              ) : null}
              {!user.isAdmin && !user.approved ? (
                <Button type="button" onClick={() => void handleApprove()}>
                  Approve user
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {user.isAdmin ? 'Admins are always approved.' : 'This account is already approved.'}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Weekly digest</CardTitle>
              <CardDescription>Email preference for this account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="user-weekly-digest">Receive weekly digest</Label>
                  <p className="text-sm text-muted-foreground">
                    On by default. Opt out stops the Monday cron email.
                  </p>
                </div>
                <Switch
                  id="user-weekly-digest"
                  checked={Boolean(user.weeklyDigest)}
                  onCheckedChange={(checked) => void handleDigestToggle(checked)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="border-b">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle>Digest preview</CardTitle>
                <CardDescription>
                  {digest?.range
                    ? `${digest.range.fromIso} → ${digest.range.toInclusiveIso} (previous week, UTC)`
                    : 'Previous Mon–Sun spending email'}
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={digestLoading}
                onClick={() => void loadDigestPreview()}
              >
                {digestLoading ? 'Refreshing…' : 'Refresh preview'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            {digest ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-semibold tabular-nums">
                      {formatMoney.format(digest.summary?.total || 0)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Expenses</p>
                    <p className="font-semibold tabular-nums">{digest.summary?.count || 0}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 sm:col-span-1 col-span-2">
                    <p className="text-xs text-muted-foreground">To</p>
                    <p className="truncate font-medium text-sm">{digest.email || '—'}</p>
                  </div>
                </div>

                {(digest.empty || digest.optedOut || !digest.verified) ? (
                  <p className="text-sm text-muted-foreground">
                    {[
                      !digest.verified ? 'Email not verified' : null,
                      digest.optedOut ? 'User opted out' : null,
                      digest.empty ? 'No expenses in this week' : null
                    ].filter(Boolean).join(' · ')}
                    . Enable force send to email anyway.
                  </p>
                ) : null}

                <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
                  <div className="border-b border-border bg-muted/40 px-3 py-2">
                    <p className="truncate text-xs text-muted-foreground">
                      Subject: {digest.subject || 'Weekly digest'}
                    </p>
                  </div>
                  <iframe
                    title="Weekly digest email preview"
                    className="h-[28rem] w-full bg-white"
                    sandbox=""
                    srcDoc={digest.html || '<p style="padding:16px;font-family:sans-serif;color:#6b7280;">No preview</p>'}
                  />
                </div>

                <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="force-digest-send"
                      checked={forceSend || needsForce}
                      onCheckedChange={setForceSend}
                      disabled={needsForce}
                    />
                    <Label htmlFor="force-digest-send" className="font-normal text-muted-foreground">
                      Force send if empty, opted out, or unverified
                    </Label>
                  </div>
                  <Button
                    type="button"
                    disabled={sending || !digest.email}
                    onClick={() => void handleSendDigest()}
                  >
                    {sending ? 'Sending…' : 'Send weekly digest'}
                  </Button>
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {digestLoading ? 'Building preview…' : 'Preview unavailable.'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
