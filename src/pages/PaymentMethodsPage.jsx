import { useEffect, useMemo, useState } from 'react';
import {
  countTransactionsUsing,
  createPaymentMethod,
  deletePaymentMethod,
  updatePaymentMethod
} from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useData } from '../context/DataContext';
import { EditNameDialog } from '../components/EditNameDialog';
import { DeleteReferenceDialog } from '../components/DeleteReferenceDialog';

export default function PaymentMethodsPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { paymentMethods, loadPaymentMethods, invalidate } = useData();
  const [editMethod, setEditMethod] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [usageCount, setUsageCount] = useState(0);
  const [usageLoading, setUsageLoading] = useState(false);

  useEffect(() => {
    void loadPaymentMethods().catch((error) => toast(error.message));
  }, [loadPaymentMethods, toast]);

  useEffect(() => {
    if (!deleteTarget) {
      setUsageCount(0);
      return;
    }
    let cancelled = false;
    setUsageLoading(true);
    void countTransactionsUsing('payment_method', deleteTarget.id)
      .then((count) => {
        if (!cancelled) setUsageCount(count);
      })
      .catch((error) => {
        if (!cancelled) toast(error.message);
      })
      .finally(() => {
        if (!cancelled) setUsageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deleteTarget, toast]);

  async function refresh() {
    invalidate('paymentMethods', 'transactions', 'summaryTransactions', 'homeTotals');
    await loadPaymentMethods(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await createPaymentMethod(Object.fromEntries(new FormData(form)));
      form.reset();
      toast('Payment method saved.');
      await refresh();
    } catch (error) {
      toast(error.message);
    }
  }

  async function handleEditSubmit(name) {
    if (!editMethod) return;
    if (name === editMethod.name) {
      setEditMethod(null);
      return;
    }
    try {
      await updatePaymentMethod(editMethod.id, { name });
      toast('Payment method updated.');
      setEditMethod(null);
      await refresh();
    } catch (error) {
      toast(error.message);
      throw error;
    }
  }

  const replacements = useMemo(
    () => paymentMethods
      .filter((method) => method.id !== deleteTarget?.id)
      .map((method) => ({ id: method.id, name: method.name })),
    [paymentMethods, deleteTarget]
  );

  async function handleDeleteConfirm({ replacementId }) {
    if (!deleteTarget) return;
    try {
      await deletePaymentMethod(deleteTarget.id, { replacementId });
      toast('Payment method deleted.');
      setDeleteTarget(null);
      await refresh();
    } catch (error) {
      toast(error.message);
      throw error;
    }
  }

  return (
    <section id="paymentMethodsPage">
      <div className="page-title">
        <p className="eyebrow">Payment methods</p>
        <h1>Payment methods</h1>
      </div>

      {isAdmin ? (
        <form id="paymentMethodForm" className="panel inline-form" onSubmit={handleSubmit}>
          <input type="text" name="name" placeholder="Payment method name" required />
          <button type="submit">Add payment method</button>
        </form>
      ) : null}

      <div id="paymentMethodList" className="list-grid compact">
        {paymentMethods.length ? paymentMethods.map((paymentMethod) => (
          <article key={paymentMethod.id} className="list-item ref-card">
            <div className="list-heading">
              <strong>{paymentMethod.name}</strong>
              {isAdmin ? (
                <div className="ref-card-actions">
                  <button
                    type="button"
                    className="ghost small-button"
                    onClick={() => setEditMethod(paymentMethod)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="ghost small-button danger-text"
                    onClick={() => setDeleteTarget(paymentMethod)}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          </article>
        )) : (
          <p className="panel-empty">No payment methods yet.</p>
        )}
      </div>

      <EditNameDialog
        open={Boolean(editMethod)}
        title="Edit payment method"
        label="Payment method name"
        initialValue={editMethod?.name || ''}
        placeholder="Example: UPI"
        onClose={() => setEditMethod(null)}
        onSubmit={handleEditSubmit}
      />

      <DeleteReferenceDialog
        open={Boolean(deleteTarget)}
        title="Delete payment method"
        itemName={deleteTarget?.name || ''}
        usageCount={usageCount}
        usageLoading={usageLoading}
        replacementLabel="Replacement payment method"
        replacementOptions={replacements}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </section>
  );
}
