import { useEffect, useMemo, useState } from 'react';
import {
  countTransactionsUsing,
  createPaymentMethod,
  deletePaymentMethod,
  updatePaymentMethod
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useData } from '@/context/DataContext';
import { EditNameDialog } from '@/components/EditNameDialog';
import { DeleteReferenceDialog } from '@/components/DeleteReferenceDialog';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';

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
    <section id="paymentMethodsPage" className="space-y-6">
      <PageHeader eyebrow="Payment methods" title="Payment methods" />

      {isAdmin ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Add payment method</CardTitle>
            <CardDescription>Create a payment mode for expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              id="paymentMethodForm"
              className="flex flex-col gap-3 sm:flex-row sm:items-center"
              onSubmit={handleSubmit}
            >
              <Input
                type="text"
                name="name"
                placeholder="Payment method name"
                required
                className="sm:flex-1"
              />
              <Button type="submit" className="sm:shrink-0">Add payment method</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div id="paymentMethodList" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {paymentMethods.length ? paymentMethods.map((paymentMethod) => (
          <Card key={paymentMethod.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <CardTitle className="text-base">{paymentMethod.name}</CardTitle>
              {isAdmin ? (
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditMethod(paymentMethod)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteTarget(paymentMethod)}
                  >
                    Delete
                  </Button>
                </div>
              ) : null}
            </CardHeader>
          </Card>
        )) : (
          <Card size="sm" className="sm:col-span-2 lg:col-span-3">
            <CardContent className="py-8 text-center text-muted-foreground">
              No payment methods yet.
            </CardContent>
          </Card>
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
