import { useEffect, useRef, useState } from 'react';
import { updateTransaction } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { useData } from '../context/DataContext';

export function EditTransactionDialog({
  open,
  transaction,
  onClose,
  onSaved
}) {
  const dialogRef = useRef(null);
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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  const selectedCategory = categories.find((item) => item.id === form.category);
  const subcategories = selectedCategory?.subcategories || [];
  const otherId = typeof otherStoreId === 'function' ? otherStoreId() : otherStoreId;
  const showStoreText = Boolean(otherId) && form.store === otherId;

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
    }
  }

  function handleClose() {
    onClose?.();
  }

  return (
    <dialog
      id="editTransactionDialog"
      ref={dialogRef}
      onClose={handleClose}
      onCancel={(event) => {
        event.preventDefault();
        handleClose();
      }}
    >
      <form id="editTransactionForm" className="form-stack" onSubmit={handleSubmit}>
        <div className="dialog-title">
          <h2>Edit transaction</h2>
          <button type="button" className="ghost" id="closeEditDialog" onClick={handleClose}>Close</button>
        </div>
        <input type="hidden" name="id" value={form.id} readOnly />
        <label>
          Date
          <input
            type="date"
            name="date"
            required
            value={form.date}
            onChange={(event) => updateField('date', event.target.value)}
          />
        </label>
        <label>
          Title
          <input
            type="text"
            name="title"
            placeholder="Example: Fuel refill"
            value={form.title}
            onChange={(event) => updateField('title', event.target.value)}
          />
        </label>
        <label>
          Amount spent
          <input
            type="number"
            name="amount"
            min="0.01"
            step="0.01"
            required
            value={form.amount}
            onChange={(event) => updateField('amount', event.target.value)}
          />
        </label>
        <label>
          Payment mode
          <select
            name="paymentMethod"
            id="editPaymentMethod"
            value={form.paymentMethod}
            onChange={(event) => updateField('paymentMethod', event.target.value)}
          >
            <option value="">Select payment mode</option>
            {paymentMethods.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label>
          Expense category
          <select
            name="category"
            id="editCategory"
            required
            value={form.category}
            onChange={(event) => updateField('category', event.target.value)}
          >
            {categories.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label>
          Subcategory
          <select
            name="subcategory"
            id="editSubcategory"
            required
            value={form.subcategory}
            onChange={(event) => updateField('subcategory', event.target.value)}
          >
            {subcategories.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label>
          Store
          <select
            name="store"
            id="editStore"
            required
            value={form.store}
            onChange={(event) => updateField('store', event.target.value)}
          >
            {stores.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label id="editStoreTextWrap" className={showStoreText ? '' : 'hidden'}>
          Store name
          <input
            type="text"
            name="storeText"
            id="editStoreText"
            placeholder="Example: Corner shop"
            value={form.storeText}
            onChange={(event) => updateField('storeText', event.target.value)}
          />
        </label>
        <button type="submit">Save changes</button>
      </form>
    </dialog>
  );
}

export default EditTransactionDialog;
