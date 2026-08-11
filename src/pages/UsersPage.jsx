import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  approveUser,
  adminResendVerification,
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
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

function userInitials(user) {
  const source = String(user.name || user.email || '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function needsAttention(user) {
  if (user.isAdmin) return false;
  return !user.verified || !user.approved;
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

function UserRow({
  user,
  digest,
  refreshing,
  sending,
  busy,
  onApprove,
  onResend,
  onRefreshDigest,
  onSendDigest
}) {
  const canResend = !user.verified && Boolean(user.email);
  const canApprove = !user.isAdmin && !user.approved;
  const canDigest = Boolean(user.email);
  const displayName = user.name || user.email || 'Unknown user';
  const digestHint = digest
    ? `${formatMoney.format(digest.summary?.total || 0)} · ${digest.summary?.count || 0} expense${(digest.summary?.count || 0) === 1 ? '' : 's'}`
    : null;

  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <Link
        to={`/users/${user.id}`}
        className="-mx-2 flex min-w-0 flex-1 items-start gap-3 rounded-lg px-2 py-1 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar size="lg" className="mt-0.5">
          <AvatarFallback className="bg-primary/15 font-semibold text-primary">
            {userInitials(user)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-2">
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{displayName}</p>
            <p className="truncate text-sm text-muted-foreground">
              {user.email || 'Email hidden'}
            </p>
            {digestHint ? (
              <p className="truncate text-xs text-muted-foreground">
                Digest ready · {digestHint}
              </p>
            ) : null}
          </div>
          <StatusBadges user={user} />
        </div>
      </Link>

      <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
        {canDigest ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || refreshing || sending}
              onClick={() => void onRefreshDigest(user.id)}
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy || sending || refreshing}
              onClick={() => void onSendDigest(user.id)}
            >
              {sending ? 'Sending…' : 'Send'}
            </Button>
          </>
        ) : null}
        {canResend ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void onResend(user.id)}
          >
            Resend verification
          </Button>
        ) : null}
        {canApprove ? (
          <Button
            type="button"
            size="sm"
            onClick={() => void onApprove(user.id)}
          >
            Approve user
          </Button>
        ) : null}
        <Button asChild variant="ghost" size="sm">
          <Link to={`/users/${user.id}`}>Open</Link>
        </Button>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { toast } = useToast();
  const { users, loadUsers, invalidate } = useData();
  const [digests, setDigests] = useState({});
  const [refreshingId, setRefreshingId] = useState('');
  const [sendingId, setSendingId] = useState('');
  const [bulkRefreshing, setBulkRefreshing] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);

  useEffect(() => {
    void loadUsers().catch((error) => toast(error.message));
  }, [loadUsers, toast]);

  const { pendingUsers, settledUsers } = useMemo(() => {
    const pending = [];
    const settled = [];
    for (const user of users) {
      if (needsAttention(user)) pending.push(user);
      else settled.push(user);
    }
    return { pendingUsers: pending, settledUsers: settled };
  }, [users]);

  const digestUsers = useMemo(
    () => users.filter((user) => Boolean(user.email)),
    [users]
  );

  const bulkBusy = bulkRefreshing || bulkSending;
  const rowBusy = Boolean(refreshingId || sendingId) || bulkBusy;

  async function handleApproveUser(userId) {
    try {
      await approveUser(userId);
      toast('User approved.');
      invalidate('users');
      await loadUsers(true);
    } catch (error) {
      toast(error.message);
    }
  }

  async function handleAdminResendVerification(userId) {
    try {
      const result = await adminResendVerification(userId);
      toast(result.message || 'Verification email sent.');
    } catch (error) {
      toast(error.message);
    }
  }

  async function loadDigestPreview(userId) {
    const preview = await previewWeeklyDigest(userId);
    setDigests((prev) => ({ ...prev, [userId]: preview }));
    return preview;
  }

  async function handleRefreshDigest(userId) {
    setRefreshingId(userId);
    try {
      const preview = await loadDigestPreview(userId);
      toast(
        preview.empty
          ? 'Digest refreshed · no expenses last week.'
          : `Digest refreshed · ${formatMoney.format(preview.summary?.total || 0)}.`
      );
    } catch (error) {
      toast(error.message || 'Could not refresh digest.');
    } finally {
      setRefreshingId('');
    }
  }

  async function handleSendDigest(userId) {
    setSendingId(userId);
    try {
      let preview = digests[userId];
      if (!preview?.html || !preview?.subject) {
        preview = await loadDigestPreview(userId);
      }
      const result = await sendWeeklyDigest(userId, {
        subject: preview.subject,
        html: preview.html
      });
      toast(result.message || 'Weekly digest sent.');
    } catch (error) {
      toast(error.message || 'Could not send weekly digest.');
    } finally {
      setSendingId('');
    }
  }

  async function handleRefreshAllDigests() {
    if (!digestUsers.length) {
      toast('No users with email to refresh.');
      return;
    }
    setBulkRefreshing(true);
    let ok = 0;
    let failed = 0;
    try {
      for (const user of digestUsers) {
        setRefreshingId(user.id);
        try {
          await loadDigestPreview(user.id);
          ok += 1;
        } catch {
          failed += 1;
        }
      }
      toast(
        failed
          ? `Refreshed ${ok} digest${ok === 1 ? '' : 's'} · ${failed} failed.`
          : `Refreshed digests for ${ok} user${ok === 1 ? '' : 's'}.`
      );
    } finally {
      setRefreshingId('');
      setBulkRefreshing(false);
    }
  }

  async function handleSendAllDigests() {
    if (!digestUsers.length) {
      toast('No users with email to send.');
      return;
    }
    setBulkSending(true);
    let sent = 0;
    let failed = 0;
    const previewCache = { ...digests };
    try {
      for (const user of digestUsers) {
        setSendingId(user.id);
        try {
          let preview = previewCache[user.id];
          if (!preview?.html || !preview?.subject) {
            preview = await loadDigestPreview(user.id);
            previewCache[user.id] = preview;
          }
          await sendWeeklyDigest(user.id, {
            subject: preview.subject,
            html: preview.html
          });
          sent += 1;
        } catch {
          failed += 1;
        }
      }
      toast(
        failed
          ? `Sent ${sent} digest${sent === 1 ? '' : 's'} · ${failed} failed.`
          : `Sent weekly digests to ${sent} user${sent === 1 ? '' : 's'}.`
      );
    } finally {
      setSendingId('');
      setBulkSending(false);
    }
  }

  function renderUserRow(user) {
    return (
      <UserRow
        user={user}
        digest={digests[user.id] || null}
        refreshing={refreshingId === user.id}
        sending={sendingId === user.id}
        busy={bulkBusy}
        onApprove={handleApproveUser}
        onResend={handleAdminResendVerification}
        onRefreshDigest={handleRefreshDigest}
        onSendDigest={handleSendDigest}
      />
    );
  }

  return (
    <section id="usersPage" className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Users"
        description={
          users.length
            ? [
                `${users.length} total`,
                pendingUsers.length
                  ? `${pendingUsers.length} need attention`
                  : 'Everyone is verified and approved',
                digestUsers.length
                  ? `${digestUsers.length} can receive digests`
                  : null
              ].filter(Boolean).join(' · ')
            : 'No users yet'
        }
        actions={
          digestUsers.length ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={rowBusy}
                onClick={() => void handleRefreshAllDigests()}
              >
                {bulkRefreshing ? 'Refreshing…' : 'Refresh all'}
              </Button>
              <Button
                type="button"
                disabled={rowBusy}
                onClick={() => void handleSendAllDigests()}
              >
                {bulkSending ? 'Sending…' : 'Send all'}
              </Button>
            </>
          ) : null
        }
      />

      {!users.length ? (
        <Card size="sm">
          <CardContent className="py-8 text-center text-muted-foreground">
            No users yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {pendingUsers.length ? (
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Needs attention</CardTitle>
                <CardDescription>
                  Pending verification or approval — Refresh builds last week’s digest; Send emails it
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                {pendingUsers.map((user, index) => (
                  <div key={user.id} className="px-(--card-spacing)">
                    {renderUserRow(user)}
                    {index < pendingUsers.length - 1 ? <Separator /> : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {settledUsers.length ? (
            <Card>
              <CardHeader className="border-b">
                <CardTitle>
                  {pendingUsers.length ? 'Everyone else' : 'All users'}
                </CardTitle>
                <CardDescription>
                  {settledUsers.length} settled · {users.length} total · Refresh then Send for weekly digests
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                {settledUsers.map((user, index) => (
                  <div key={user.id} className="px-(--card-spacing)">
                    {renderUserRow(user)}
                    {index < settledUsers.length - 1 ? <Separator /> : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </section>
  );
}
