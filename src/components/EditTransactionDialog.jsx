import { useEffect, useState } from 'react';
import { updateTransaction } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';

export function EditTransactionDialog({
  open,
  transaction,
  onClose,
  onSaved
}) {
  const { toast } = useToast();
  const {
    categories,
    paymentMethods,
    stores,
    otherStoreId,
    invalidate,
    loadCategories,
    loadPaymentMethods,
    loadStores
  } = useData();

  const [form, setForm] = useState({
    id: '',
    date: '',
    title: '',
    amount: '',
    paymentMethod: '',
    category: '',
    subcategory: '',
    store: '',
    storeText: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void Promise.all([
      loadCategories(),
      loadPaymentMethods(),
      loadStores()
    ]);
  }, [open, loadCategories, loadPaymentMethods, loadStores]);

  useEffect(() => {
    if (!transaction) return;
    setForm({
      id: transaction.id || '',
      date: String(transaction.date || '').slice(0, 10),
      title: transaction.title || '',
      amount: transaction.amount ?? '',
      paymentMethod: transaction.payment_method || '',
      category: transaction.category || '',
      subcategory: transaction.subcategory || '',
      store: transaction.store || '',
      storeText: transaction.storeText || ''
    });
  }, [transaction]);

  const selectedCategory = categories.find((item) => item.id === form.category);
  const subcategories = selectedCategory?.subcategories || [];
  const otherId = typeof otherStoreId === 'function' ? otherStoreId() : otherStoreId;
  const showStoreText = Boolean(otherId) && form.store === otherId;

  function handleOpenChange(nextOpen) {
    if (!nextOpen && !saving) onClose?.();
  }

  function updateField(name, value) {
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === 'category') {
        const category = categories.find((item) => item.id === value);
        const nextSubs = category?.subcategories || [];
        next.subcategory = nextSubs.some((item) => item.id === current.subcategory)
          ? current.subcategory
          : (nextSubs[0]?.id || '');
      }
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await updateTransaction(form.id, {
        date: form.date,
        title: form.title,
        amount: form.amount,
        paymentMethod: form.paymentMethod,
        category: form.category,
        subcategory: form.subcategory,
        store: form.store,
        storeText: form.storeText
      });
      invalidate('transactions', 'homeTotals', 'summaryTransactions');
      toast('Transaction updated.');
      onClose?.();
      await onSaved?.();
    } catch (error) {
      toast(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        id="editTransactionDialog"
        className="sm:max-w-lg"
        showCloseButton={!saving}
      >
        <form id="editTransactionForm" className="grid gap-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit transaction</DialogTitle>
            <DialogDescription className="sr-only">
              Update transaction details
            </DialogDescription>
          </DialogHeader>
          <input type="hidden" name="id" value={form.id} readOnly />
          <div className="grid gap-1.5">
            <Label htmlFor="edit-date">Date</Label>
            <Input
              id="edit-date"
              type="date"
              name="date"
              required
              disabled={saving}
              value={form.date}
              onChange={(event) => updateField('date', event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              type="text"
              name="title"
              placeholder="Example: Fuel refill"
              disabled={saving}
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-amount">Amount spent</Label>
            <Input
              id="edit-amount"
              type="number"
              name="amount"
              min="0.01"
              step="0.01"
              required
              disabled={saving}
              value={form.amount}
              onChange={(event) => updateField('amount', event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="editPaymentMethod">Payment mode</Label>
            <NativeSelect
              name="paymentMethod"
              id="editPaymentMethod"
              disabled={saving}
              value={form.paymentMethod}
              onChange={(event) => updateField('paymentMethod', event.target.value)}
            >
              <option value="">Select payment mode</option>
              {paymentMethods.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="editCategory">Expense category</Label>
            <NativeSelect
              name="category"
              id="editCategory"
              required
              disabled={saving}
              value={form.category}
              onChange={(event) => updateField('category', event.target.value)}
            >
              {categories.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="editSubcategory">Subcategory</Label>
            <NativeSelect
              name="subcategory"
              id="editSubcategory"
              required
              disabled={saving}
              value={form.subcategory}
              onChange={(event) => updateField('subcategory', event.target.value)}
            >
              {subcategories.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="editStore">Store</Label>
            <NativeSelect
              name="store"
              id="editStore"
              required
              disabled={saving}
              value={form.store}
              onChange={(event) => updateField('store', event.target.value)}
            >
              {stores.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </NativeSelect>
          </div>
          {showStoreText ? (
            <div id="editStoreTextWrap" className="grid gap-1.5">
              <Label htmlFor="editStoreText">Store name</Label>
              <Input
                type="text"
                name="storeText"
                id="editStoreText"
                placeholder="Example: Corner shop"
                disabled={saving}
                value={form.storeText}
                onChange={(event) => updateField('storeText', event.target.value)}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose?.()} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default EditTransactionDialog;
