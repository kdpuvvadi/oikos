import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LinkIcon, Share2Icon } from 'lucide-react';
import {
  fetchTransaction,
  fetchSharedTransaction,
  deleteTransaction,
  enableTransactionShare,
  disableTransactionShare,
  publicTransactionShareUrl
} from '@/lib/api';
import { money, formatDate, formatLongDate } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useData } from '@/context/DataContext';
import { EditTransactionDialog } from '@/components/EditTransactionDialog';
import { ConfirmDialog } from '@/components/DeleteReferenceDialog';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  document.body.appendChild(input);
  input.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(input);
  if (!ok) throw new Error('Could not copy link.');
}

async function shareOrCopy(url, title) {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url, text: title });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
    }
  }
  await copyText(url);
  return 'copied';
}

function DetailRow({ label, children }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-start sm:gap-4">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div className="min-w-0 font-medium">{children}</div>
    </div>
  );
}

export default function TransactionDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAdmin, isApproved } = useAuth();
  const { toast } = useToast();
  const {
    displayStore,
    loadCategories,
    loadPaymentMethods,
    loadStores,
    invalidate
  } = useData();

  const publicKey = String(searchParams.get('key') || '').trim();
  const isPublicView = Boolean(publicKey);

  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shareBusy, setShareBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmRevokeOpen, setConfirmRevokeOpen] = useState(false);

  async function loadDetail() {
    if (!id) {
      setTransaction(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (isPublicView) {
        const data = await fetchSharedTransaction(id, publicKey);
        setTransaction(data);
        return;
      }
      await Promise.all([
        loadCategories(),
        loadPaymentMethods(),
        loadStores()
      ]);
      const data = await fetchTransaction(id);
      setTransaction(data);
    } catch (error) {
      if (error?.isAbort) return;
      setTransaction(null);
      toast(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, publicKey]);

  async function handleDelete() {
    if (!transaction?.id) return;
    try {
      await deleteTransaction(transaction.id);
      invalidate('transactions', 'homeTotals', 'summaryTransactions');
      toast('Transaction deleted.');
      setConfirmDeleteOpen(false);
      navigate('/transactions');
    } catch (error) {
      toast(error.message);
      throw error;
    }
  }

  async function handleCreateOrCopyShare() {
    if (!transaction?.id || shareBusy) return;
    setShareBusy(true);
    try {
      const updated = await enableTransactionShare(transaction.id);
      setTransaction((current) => ({ ...current, ...updated, expand: current?.expand }));
      const url = publicTransactionShareUrl(updated.id, updated.shareKey);
      const title = updated.title
        || transaction.expand?.subcategory?.name
        || 'Transaction';
      const result = await shareOrCopy(url, title);
      if (result === 'copied') toast('Public link copied to clipboard.');
      else if (result === 'shared') toast('Public link ready to share.');
    } catch (error) {
      toast(error.message || 'Could not create share link.');
    } finally {
      setShareBusy(false);
    }
  }

  async function handleRevokeShare() {
    if (!transaction?.id) return;
    try {
      const updated = await disableTransactionShare(transaction.id);
      setTransaction((current) => ({ ...current, ...updated, expand: current?.expand, shareKey: '' }));
      toast('Public link revoked.');
      setConfirmRevokeOpen(false);
    } catch (error) {
      toast(error.message);
      throw error;
    }
  }

  const transactionLabel = transaction
    ? (transaction.title || transaction.expand?.subcategory?.name || 'this transaction')
    : 'this transaction';
  const canManage = Boolean(user && isApproved && !isPublicView);
  const hasPublicLink = Boolean(sanitizeShareKey(transaction?.shareKey));

  return (
    <section id="transactionDetailPage" className="space-y-6">
      <PageHeader
        eyebrow={isPublicView ? 'Shared transaction' : 'Transaction'}
        title="Transaction details"
        actions={
          isPublicView ? null : (
            <Button asChild variant="outline">
              <Link to="/transactions">Back to transactions</Link>
            </Button>
          )
        }
      />

      <Card id="transactionDetailCard">
        {loading ? (
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Loading transaction...
          </CardContent>
        ) : !transaction ? (
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {isPublicView ? 'This shared link is invalid or has been revoked.' : 'Transaction not found.'}
          </CardContent>
        ) : (
          <>
            <CardHeader className="border-b">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <CardDescription>
                    Recorded on {formatLongDate(transaction.date)}
                  </CardDescription>
                  <CardTitle className="text-2xl">
                    {transaction.title || transaction.expand?.subcategory?.name || 'Untitled transaction'}
                  </CardTitle>
                </div>
                <p className="text-2xl font-semibold tracking-tight tabular-nums">
                  {money.format(Number(transaction.amount || 0))}
                </p>
              </div>
            </CardHeader>
            <CardContent className="grid gap-5 pt-6">
              <DetailRow label="Category">
                {transaction.expand?.category?.name || 'Uncategorized'}
              </DetailRow>
              <DetailRow label="Subcategory">
                {transaction.expand?.subcategory?.name || 'None'}
              </DetailRow>
              <DetailRow label="Store">
                {displayStore(transaction)}
              </DetailRow>
              <DetailRow label="Payment method">
                {transaction.expand?.payment_method?.name || 'Not set'}
              </DetailRow>
              <DetailRow label="Date">
                {formatDate(transaction.date)}
              </DetailRow>
              {canManage && isAdmin ? (
                <DetailRow label="User">
                  {transaction.expand?.user?.email || transaction.expand?.user?.name || 'Unknown user'}
                </DetailRow>
              ) : null}
              {canManage ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    data-share-transaction={transaction.id}
                    disabled={shareBusy}
                    onClick={() => void handleCreateOrCopyShare()}
                  >
                    {hasPublicLink ? (
                      <LinkIcon data-icon="inline-start" />
                    ) : (
                      <Share2Icon data-icon="inline-start" />
                    )}
                    {hasPublicLink ? 'Copy link' : 'Share'}
                  </Button>
                  {hasPublicLink ? (
                    <Button
                      type="button"
                      variant="outline"
                      data-revoke-transaction-share={transaction.id}
                      disabled={shareBusy}
                      onClick={() => setConfirmRevokeOpen(true)}
                    >
                      Revoke
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    data-edit-transaction-detail={transaction.id}
                    onClick={() => setEditOpen(true)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    data-delete-transaction-detail={transaction.id}
                    onClick={() => setConfirmDeleteOpen(true)}
                  >
                    Delete
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </>
        )}
      </Card>

      {canManage ? (
        <>
          <EditTransactionDialog
            open={editOpen}
            transaction={transaction}
            onClose={() => setEditOpen(false)}
            onSaved={async () => {
              await loadDetail();
            }}
          />

          <ConfirmDialog
            open={confirmDeleteOpen}
            title="Delete transaction"
            message={`Delete “${transactionLabel}”? This cannot be undone.`}
            confirmLabel="Delete transaction"
            onClose={() => setConfirmDeleteOpen(false)}
            onConfirm={handleDelete}
          />

          <ConfirmDialog
            open={confirmRevokeOpen}
            title="Revoke public link"
            message="Anyone with the current link will lose access. You can create a new link later."
            confirmLabel="Revoke link"
            onClose={() => setConfirmRevokeOpen(false)}
            onConfirm={handleRevokeShare}
          />
        </>
      ) : null}
    </section>
  );
}

function sanitizeShareKey(value) {
  return String(value || '').trim();
}
