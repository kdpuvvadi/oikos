import { useEffect, useMemo, useState } from 'react';
import { createTransaction } from '../lib/api';
import { money } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useData } from '../context/DataContext';

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function HomePage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const {
    categories,
    paymentMethods,
    stores,
    homeTotals,
    loadCategories,
    loadPaymentMethods,
    loadStores,
    loadHomeTotals,
    invalidate,
    otherStoreId
  } = useData();

  const [date, setDate] = useState(todayIsoDate);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [store, setStore] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [subcategoryName, setSubcategoryName] = useState('');
  const [storeFieldValue, setStoreFieldValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void Promise.all([
      loadCategories(),
      loadPaymentMethods(),
      loadStores(),
      loadHomeTotals()
    ]).catch((error) => toast(error.message));
  }, [loadCategories, loadPaymentMethods, loadStores, loadHomeTotals, toast]);

  const selectedCategory = useMemo(
    () => categories.find((item) => item.id === category),
    [categories, category]
  );
  const subcategories = selectedCategory?.subcategories || [];

  const showNewCategory = isAdmin && category === '__new__';
  const showNewSubcategory = isAdmin && (category === '__new__' || subcategory === '__new__');
  const otherId = typeof otherStoreId === 'function' ? otherStoreId() : otherStoreId;
  const isAdminCreatingStore = isAdmin && store === '__new__';
  const usesCustomStoreText = Boolean(otherId) && store === otherId;
  const showStoreWrap = isAdminCreatingStore || usesCustomStoreText;

  useEffect(() => {
    if (category === '__new__' && isAdmin) {
      setSubcategory('__new__');
      return;
    }
    if (subcategory && subcategory !== '__new__' && !subcategories.some((item) => item.id === subcategory)) {
      setSubcategory('');
    }
  }, [category, subcategory, subcategories, isAdmin]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    const body = {
      date,
      title,
      amount,
      paymentMethod,
      category: category === '__new__' ? '' : category,
      subcategory: subcategory === '__new__' ? '' : subcategory,
      store: store === '__new__' ? '' : store,
      categoryName,
      subcategoryName,
      storeName: isAdminCreatingStore ? storeFieldValue : '',
      storeText: usesCustomStoreText ? storeFieldValue : ''
    };

    try {
      await createTransaction(body);
      setDate(todayIsoDate());
      setTitle('');
      setAmount('');
      setPaymentMethod('');
      setCategory('');
      setSubcategory('');
      setStore('');
      setCategoryName('');
      setSubcategoryName('');
      setStoreFieldValue('');
      toast('Expense saved.');
      invalidate('categories', 'stores', 'transactions', 'homeTotals', 'summaryTransactions');
      await Promise.all([
        loadCategories(true),
        loadStores(true),
        loadHomeTotals(true)
      ]);
    } catch (error) {
      toast(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="homePage">
      <div className="page-title">
        <p className="eyebrow">This month</p>
        <h1>Expense entry</h1>
      </div>

      <div className="stats-grid">
        <article className="stat-card">
          <span>This month so far</span>
          <strong id="thisMonthTotal">{money.format(homeTotals?.thisMonth || 0)}</strong>
        </article>
        <article className="stat-card">
          <span>Last month total</span>
          <strong id="lastMonthTotal">{money.format(homeTotals?.lastMonth || 0)}</strong>
        </article>
      </div>

      <form id="expenseForm" className="panel form-grid" onSubmit={handleSubmit}>
        <label>
          Date
          <input
            type="date"
            name="date"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label>
          Title
          <input
            type="text"
            name="title"
            placeholder="Example: Fuel refill"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          Amount spent
          <input
            type="number"
            name="amount"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <label>
          Payment mode
          <select
            name="paymentMethod"
            id="oikosPaymentMethod"
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
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
            id="oikosCategory"
            required
            value={category}
            onChange={(event) => {
              const next = event.target.value;
              setCategory(next);
              if (next === '__new__' && isAdmin) setSubcategory('__new__');
              else setSubcategory('');
            }}
          >
            <option value="">Select category</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
            {isAdmin ? <option value="__new__">Add new category</option> : null}
          </select>
        </label>
        <label id="newCategoryWrap" className={showNewCategory ? '' : 'hidden'}>
          New category
          <input
            type="text"
            name="categoryName"
            placeholder="Example: Travel"
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
          />
        </label>
        <label>
          Subcategory
          <select
            name="subcategory"
            id="oikosSubcategory"
            required
            value={subcategory}
            onChange={(event) => setSubcategory(event.target.value)}
          >
            <option value="">{category === '__new__' ? 'Create subcategory' : 'Select subcategory'}</option>
            {subcategories.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
            {isAdmin ? <option value="__new__">Add new subcategory</option> : null}
          </select>
        </label>
        <label id="newSubcategoryWrap" className={showNewSubcategory ? '' : 'hidden'}>
          New subcategory
          <input
            type="text"
            name="subcategoryName"
            placeholder="Example: Train tickets"
            value={subcategoryName}
            onChange={(event) => setSubcategoryName(event.target.value)}
          />
        </label>
        <label>
          Store
          <select
            name="store"
            id="oikosStore"
            required
            value={store}
            onChange={(event) => {
              setStore(event.target.value);
              setStoreFieldValue('');
            }}
          >
            <option value="">Select store</option>
            {stores.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
            {isAdmin ? <option value="__new__">Add new store</option> : null}
          </select>
        </label>
        <label id="newStoreWrap" className={showStoreWrap ? '' : 'hidden'}>
          Store name
          <input
            type="text"
            name={isAdminCreatingStore ? 'storeName' : 'storeText'}
            placeholder="Example: Corner shop"
            value={storeFieldValue}
            onChange={(event) => setStoreFieldValue(event.target.value)}
          />
        </label>
        <button type="submit" className="expense-submit-button" disabled={submitting}>
          Submit expense
        </button>
      </form>
    </section>
  );
}
