import { useEffect, useMemo } from 'react';
import { approveUser, adminResendVerification } from '@/lib/api';
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

function UserRow({ user, onApprove, onResend }) {
  const canResend = !user.verified && Boolean(user.email);
  const canApprove = !user.isAdmin && !user.approved;
  const displayName = user.name || user.email || 'Unknown user';

  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-start gap-3">
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
          </div>
          <StatusBadges user={user} />
        </div>
      </div>

      {(canApprove || canResend) ? (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
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
        </div>
      ) : null}
    </div>
  );
}

export default function UsersPage() {
  const { toast } = useToast();
  const { users, loadUsers, invalidate } = useData();

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

  return (
    <section id="usersPage" className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Users"
        description={
          pendingUsers.length
            ? `${pendingUsers.length} user${pendingUsers.length === 1 ? '' : 's'} need attention`
            : users.length
              ? 'Everyone is verified and approved'
              : 'No users yet'
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
                  Pending verification or approval
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                {pendingUsers.map((user, index) => (
                  <div key={user.id} className="px-(--card-spacing)">
                    <UserRow
                      user={user}
                      onApprove={handleApproveUser}
                      onResend={handleAdminResendVerification}
                    />
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
                  {settledUsers.length} settled · {users.length} total
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                {settledUsers.map((user, index) => (
                  <div key={user.id} className="px-(--card-spacing)">
                    <UserRow
                      user={user}
                      onApprove={handleApproveUser}
                      onResend={handleAdminResendVerification}
                    />
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
