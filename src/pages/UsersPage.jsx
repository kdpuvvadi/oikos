import { useEffect } from 'react';
import { approveUser, adminResendVerification } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { useData } from '../context/DataContext';
import { StatusPill } from '../components/StatusPill';

export default function UsersPage() {
  const { toast } = useToast();
  const { users, loadUsers, invalidate } = useData();

  useEffect(() => {
    void loadUsers().catch((error) => toast(error.message));
  }, [loadUsers, toast]);

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
    <section id="usersPage">
      <div className="page-title">
        <p className="eyebrow">Admin</p>
        <h1>Users</h1>
      </div>
      <div id="userList" className="table-wrap users-table-wrap">
        {!users.length ? (
          <p className="panel-empty">No users yet.</p>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Role</th>
                <th scope="col">Verification</th>
                <th scope="col">Approval</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const canResend = !user.verified && Boolean(user.email);
                const canApprove = !user.isAdmin && !user.approved;
                const hasActions = canResend || canApprove;

                return (
                  <tr key={user.id}>
                    <td className="users-table-user-cell" data-label="User">
                      <strong className="users-table-name">{user.name || user.email}</strong>
                      <span className="users-table-email">{user.email || 'Email hidden'}</span>
                    </td>
                    <td data-label="Role">
                      <span className={`role-pill${user.isAdmin ? ' is-admin' : ''}`}>
                        {user.isAdmin ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td data-label="Verification">
                      <StatusPill variant={user.verified ? 'success' : 'warning'}>
                        {user.verified ? 'Verified' : 'Pending verification'}
                      </StatusPill>
                    </td>
                    <td data-label="Approval">
                      <StatusPill variant={user.approved || user.isAdmin ? 'success' : 'warning'}>
                        {user.approved || user.isAdmin ? 'Approved' : 'Approval pending'}
                      </StatusPill>
                    </td>
                    <td className="users-table-actions-cell" data-label="Actions">
                      {hasActions ? (
                        <div className="users-table-actions">
                          {canResend ? (
                            <button
                              type="button"
                              className="ghost small-button"
                              onClick={() => void handleAdminResendVerification(user.id)}
                            >
                              Resend verification
                            </button>
                          ) : null}
                          {canApprove ? (
                            <button
                              type="button"
                              className="small-button"
                              onClick={() => void handleApproveUser(user.id)}
                            >
                              Approve user
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <span className="users-table-empty">No actions</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
