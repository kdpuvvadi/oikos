import { useEffect, useMemo, useState } from 'react';
import { createTransaction } from '@/lib/api';
import { money } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useData } from '@/context/DataContext';
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
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Separator } from '@/components/ui/separator';

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function Field({ label, htmlFor, children, className = '', hint }) {
  return (
    <div className={`grid min-w-0 gap-2 ${className}`.trim()}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor} className="shrink-0 text-muted-foreground">{label}</Label>
        {hint ? (
          <span className="truncate text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
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
    <section id="homePage" className="min-w-0 space-y-6">
      <PageHeader eyebrow="This month" title="Expense entry" />

      <div className="grid grid-cols-2 gap-3">
        <Card size="sm" className="min-w-0">
          <CardHeader className="gap-1">
            <CardDescription className="text-[0.7rem] sm:text-sm">This month</CardDescription>
            <CardTitle className="truncate text-lg font-semibold tracking-tight sm:text-2xl">
              {money.format(homeTotals?.thisMonth || 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm" className="min-w-0">
          <CardHeader className="gap-1">
            <CardDescription className="text-[0.7rem] sm:text-sm">Last month</CardDescription>
            <CardTitle className="truncate text-lg font-semibold tracking-tight sm:text-2xl">
              {money.format(homeTotals?.lastMonth || 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle>New expense</CardTitle>
          <CardDescription>Capture the basics, then classify where the money went</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form id="expenseForm" className="grid min-w-0 gap-6" onSubmit={handleSubmit}>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <Field label="Date" htmlFor="expense-date" hint="When you spent it">
                <Input
                  id="expense-date"
                  type="date"
                  name="date"
                  required
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </Field>
              <Field label="Amount spent" htmlFor="expense-amount" hint="Total for this purchase">
                <Input
                  id="expense-amount"
                  type="number"
                  name="amount"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  required
                  className="font-semibold tabular-nums"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </Field>
              <Field label="Title" htmlFor="expense-title" className="sm:col-span-2" hint="Optional short description">
                <Input
                  id="expense-title"
                  type="text"
                  name="title"
                  placeholder="Example: Fuel refill"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </Field>
            </div>

            <Separator />

            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <Field label="Payment mode" htmlFor="expense-payment" hint="How you paid">
                <NativeSelect
                  id="expense-payment"
                  name="paymentMethod"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  <option value="">Select payment mode</option>
                  {paymentMethods.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Store" htmlFor="expense-store" hint="Where you bought it">
                <NativeSelect
                  id="expense-store"
                  name="store"
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
                </NativeSelect>
              </Field>
              {showStoreWrap ? (
                <Field
                  label="Store name"
                  htmlFor="expense-store-name"
                  className="sm:col-span-2"
                  hint={isAdminCreatingStore ? 'Creates a reusable store' : 'One-off store label'}
                >
                  <Input
                    id="expense-store-name"
                    type="text"
                    name={isAdminCreatingStore ? 'storeName' : 'storeText'}
                    placeholder="Example: Corner shop"
                    value={storeFieldValue}
                    onChange={(event) => setStoreFieldValue(event.target.value)}
                  />
                </Field>
              ) : null}
            </div>

            <Separator />

            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <Field label="Category" htmlFor="expense-category" hint="Required">
                <NativeSelect
                  id="expense-category"
                  name="category"
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
                </NativeSelect>
              </Field>
              {showNewCategory ? (
                <Field label="New category" htmlFor="expense-category-name" hint="Saved for everyone">
                  <Input
                    id="expense-category-name"
                    type="text"
                    name="categoryName"
                    placeholder="Example: Travel"
                    value={categoryName}
                    onChange={(event) => setCategoryName(event.target.value)}
                  />
                </Field>
              ) : null}
              <Field label="Subcategory" htmlFor="expense-subcategory" hint="Required">
                <NativeSelect
                  id="expense-subcategory"
                  name="subcategory"
                  required
                  value={subcategory}
                  onChange={(event) => setSubcategory(event.target.value)}
                >
                  <option value="">{category === '__new__' ? 'Create subcategory' : 'Select subcategory'}</option>
                  {subcategories.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                  {isAdmin ? <option value="__new__">Add new subcategory</option> : null}
                </NativeSelect>
              </Field>
              {showNewSubcategory ? (
                <Field label="New subcategory" htmlFor="expense-subcategory-name" hint="Under this category">
                  <Input
                    id="expense-subcategory-name"
                    type="text"
                    name="subcategoryName"
                    placeholder="Example: Train tickets"
                    value={subcategoryName}
                    onChange={(event) => setSubcategoryName(event.target.value)}
                  />
                </Field>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Amount, category, subcategory, and store are required.
              </p>
              <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={submitting}>
                {submitting ? 'Saving…' : 'Submit expense'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
