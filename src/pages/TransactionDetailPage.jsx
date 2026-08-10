import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchTransaction, deleteTransaction } from '../lib/api';
import { money, formatDate, formatLongDate } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useData } from '../context/DataContext';
import { EditTransactionDialog } from '../components/EditTransactionDialog';
import { ConfirmDialog } from '../components/DeleteReferenceDialog';

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
    <section id="transactionDetailPage">
      <div className="page-title-bar">
        <div className="page-title">
          <p className="eyebrow">Transaction</p>
          <h1>Transaction details</h1>
        </div>
        <div className="transactions-toolbar">
          <Link className="ghost button-link" to="/transactions">Back to transactions</Link>
        </div>
      </div>

      <div id="transactionDetailCard" className="panel transaction-detail-card">
        {loading ? (
          <p className="panel-empty">Loading transaction...</p>
        ) : !transaction ? (
          <p className="panel-empty">Transaction not found.</p>
        ) : (
          <>
            <div className="transaction-detail-hero">
              <div>
                <p className="eyebrow">Recorded on {formatLongDate(transaction.date)}</p>
                <h2>{transaction.title || transaction.expand?.subcategory?.name || 'Untitled transaction'}</h2>
              </div>
              <strong className="transaction-detail-amount">{money.format(Number(transaction.amount || 0))}</strong>
            </div>
            <div className="detail-list transaction-detail-list">
              <div className="detail-row">
                <span className="detail-label">Category</span>
                <strong className="detail-value">{transaction.expand?.category?.name || 'Uncategorized'}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Subcategory</span>
                <strong className="detail-value">{transaction.expand?.subcategory?.name || 'None'}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Store</span>
                <strong className="detail-value">{displayStore(transaction)}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Payment method</span>
                <strong className="detail-value">{transaction.expand?.payment_method?.name || 'Not set'}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Date</span>
                <strong className="detail-value">{formatDate(transaction.date)}</strong>
              </div>
              {isAdmin ? (
                <div className="detail-row admin-only">
                  <span className="detail-label">User</span>
                  <strong className="detail-value">
                    {transaction.expand?.user?.email || transaction.expand?.user?.name || 'Unknown user'}
                  </strong>
                </div>
              ) : null}
            </div>
            <div className="inline-actions transaction-detail-actions">
              <button
                type="button"
                className="ghost"
                data-edit-transaction-detail={transaction.id}
                onClick={() => setEditOpen(true)}
              >
                Edit transaction
              </button>
              <button
                type="button"
                className="danger"
                data-delete-transaction-detail={transaction.id}
                onClick={() => setConfirmDeleteOpen(true)}
              >
                Delete transaction
              </button>
            </div>
          </>
        )}
      </div>

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
