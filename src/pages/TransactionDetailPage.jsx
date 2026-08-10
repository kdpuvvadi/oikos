import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchTransaction, deleteTransaction } from '@/lib/api';
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
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const {
    displayStore,
    loadCategories,
    loadPaymentMethods,
    loadStores,
    invalidate
  } = useData();

  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  async function loadDetail() {
    if (!id) {
      setTransaction(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
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
  }, [id]);

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

  const transactionLabel = transaction
    ? (transaction.title || transaction.expand?.subcategory?.name || 'this transaction')
    : 'this transaction';

  return (
    <section id="transactionDetailPage" className="space-y-6">
      <PageHeader
        eyebrow="Transaction"
        title="Transaction details"
        actions={
          <Button asChild variant="outline">
            <Link to="/transactions">Back to transactions</Link>
          </Button>
        }
      />

      <Card id="transactionDetailCard">
        {loading ? (
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Loading transaction...
          </CardContent>
        ) : !transaction ? (
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Transaction not found.
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
              {isAdmin ? (
                <DetailRow label="User">
                  {transaction.expand?.user?.email || transaction.expand?.user?.name || 'Unknown user'}
                </DetailRow>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  data-edit-transaction-detail={transaction.id}
                  onClick={() => setEditOpen(true)}
                >
                  Edit transaction
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  data-delete-transaction-detail={transaction.id}
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  Delete transaction
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>

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
    </section>
  );
}
