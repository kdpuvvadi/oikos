import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTransactions } from '@/lib/api';
import { money, formatLongDate, TRANSACTION_PAGE_SIZE_OPTIONS } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useData } from '@/context/DataContext';
import { transactionToneClass, transactionAvatarLabel } from '@/lib/transactions';
import { EditTransactionDialog } from '@/components/EditTransactionDialog';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';

const FILTER_KEYS = ['fromDate', 'toDate', 'category', 'subcategory', 'paymentMethod', 'store', 'user'];

function emptyFilters() {
  return {
    fromDate: '',
    toDate: '',
    category: '',
    subcategory: '',
    paymentMethod: '',
    store: '',
    user: ''
  };
}

function filterKeyFrom(filters) {
  return FILTER_KEYS
    .map((key) => `${key}=${String(filters[key] || '').trim()}`)
    .filter((part) => !part.endsWith('='))
    .join('&');
}

function hasActiveFilters(filters) {
  return FILTER_KEYS.some((key) => String(filters[key] || '').trim());
}

export default function TransactionsPage() {
  const { isAdmin, user, saveProfile } = useAuth();
  const { toast } = useToast();
  const {
    categories,
    paymentMethods,
    stores,
    users,
    displayStore,
    loadCategories,
    loadPaymentMethods,
    loadStores,
    loadUsers
  } = useData();

  const [filters, setFilters] = useState(emptyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(user?.transactionPageSize || 25);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAmount, setTotalAmount] = useState(0);
  const totalFilterKeyRef = useRef('');
  const totalAmountRef = useRef(0);
  const [loading, setLoading] = useState(false);
  const [editTransaction, setEditTransaction] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const metaReadyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loaders = [
          loadCategories(),
          loadPaymentMethods(),
          loadStores()
        ];
        if (isAdmin) loaders.push(loadUsers());
        await Promise.all(loaders);
        if (!cancelled) {
          metaReadyRef.current = true;
          setReloadToken((token) => token + 1);
        }
      } catch (error) {
        if (!cancelled) toast(error.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, loadCategories, loadPaymentMethods, loadStores, loadUsers, toast]);

  useEffect(() => {
    if (user?.transactionPageSize && user.transactionPageSize !== perPage) {
      setPerPage(user.transactionPageSize);
      setPage(1);
    }
  }, [user?.transactionPageSize, perPage]);

  const selectedCategory = categories.find((item) => item.id === filters.category);
  const filterSubcategories = selectedCategory?.subcategories || [];

  const loadRows = useCallback(async (nextFilters, nextPage, nextPerPage) => {
    setLoading(true);
    try {
      const key = filterKeyFrom(nextFilters);
      const filtersActive = Boolean(key);
      const includeTotalAmount = filtersActive && totalFilterKeyRef.current !== key;
      const query = {
        page: nextPage || 1,
        perPage: nextPerPage || user?.transactionPageSize || 25
      };
      FILTER_KEYS.forEach((filterKey) => {
        const value = String(nextFilters[filterKey] || '').trim();
        if (value) query[filterKey] = value;
      });
      if (includeTotalAmount) query.includeTotalAmount = true;

      let data = await fetchTransactions(query);
      if ((data.items || []).length === 0 && (data.totalItems || 0) > 0 && (data.totalPages || 1) < (data.page || 1)) {
        const correctedPage = data.totalPages || 1;
        setPage(correctedPage);
        query.page = correctedPage;
        data = await fetchTransactions(query);
      }

      const previousAmount = totalAmountRef.current || 0;
      const nextAmount = includeTotalAmount || !filtersActive
        ? Number(data.totalAmount || 0)
        : previousAmount;

      setRows(data.items || []);
      setPage(data.page || 1);
      setPerPage(data.perPage || nextPerPage);
      setTotalItems(data.totalItems || 0);
      setTotalPages(data.totalPages || 1);
      setTotalAmount(nextAmount);
      totalAmountRef.current = nextAmount;
      totalFilterKeyRef.current = filtersActive ? key : '';
    } catch (error) {
      toast(error.message);
    } finally {
      setLoading(false);
    }
  }, [toast, user?.transactionPageSize]);

  useEffect(() => {
    if (!metaReadyRef.current && reloadToken === 0) return;
    void loadRows(filters, page, perPage);
    // Intentionally reload only when page/perPage/token change; filter apply/clear call loadRows directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, reloadToken, loadRows]);

  const grouped = useMemo(() => {
    const map = rows.reduce((acc, transaction) => {
      const key = String(transaction.date || '').slice(0, 10);
      if (!acc[key]) acc[key] = { date: key, total: 0, items: [] };
      acc[key].items.push(transaction);
      acc[key].total += Number(transaction.amount || 0);
      return acc;
    }, {});
    return Object.values(map);
  }, [rows]);

  const filtersActive = hasActiveFilters(filters);
  const showFilters = filtersOpen || filtersActive;
  const safePage = Math.max(page || 1, 1);
  const safeTotalPages = Math.max(totalPages || 1, 1);
  const startItem = totalItems ? ((safePage - 1) * perPage) + 1 : 0;
  const endItem = totalItems ? Math.min(safePage * perPage, totalItems) : 0;

  async function applyFilters(event) {
    event.preventDefault();
    setFiltersOpen(true);
    if (page !== 1) {
      setPage(1);
    } else {
      await loadRows(filters, 1, perPage);
    }
  }

  async function clearFilters() {
    const cleared = emptyFilters();
    setFilters(cleared);
    setFiltersOpen(false);
    if (page !== 1) {
      setPage(1);
      await loadRows(cleared, 1, perPage);
    } else {
      await loadRows(cleared, 1, perPage);
    }
  }

  function changePage(nextPage) {
    const bounded = Math.min(Math.max(nextPage, 1), safeTotalPages);
    if (bounded === page) return;
    setPage(bounded);
  }

  async function updatePageSize(nextValue) {
    const pageSize = Number.parseInt(String(nextValue || ''), 10);
    if (!TRANSACTION_PAGE_SIZE_OPTIONS.includes(pageSize)) return;
    try {
      await saveProfile({ transactionPageSize: pageSize });
      toast('Transaction page size updated.');
      setPage(1);
      setPerPage(pageSize);
    } catch (error) {
      toast(error.message);
    }
  }

  return (
    <section id="transactionsPage" className="space-y-6">
      <PageHeader
        eyebrow="Transactions"
        title="Transactions"
        description="All your transactions"
        actions={
          <Button
            type="button"
            variant={showFilters ? 'secondary' : 'outline'}
            aria-expanded={showFilters}
            aria-controls="transactionFiltersPanel"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            Filter
          </Button>
        }
      />

      {showFilters ? (
        <Card id="transactionFiltersPanel">
          <CardHeader className="border-b">
            <CardTitle>Filters</CardTitle>
            <CardDescription>Narrow the transaction list</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              id="transactionFilterForm"
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              onSubmit={(event) => void applyFilters(event)}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="tx-from">From</Label>
                <Input
                  id="tx-from"
                  type="date"
                  name="fromDate"
                  value={filters.fromDate}
                  onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tx-to">To</Label>
                <Input
                  id="tx-to"
                  type="date"
                  name="toDate"
                  value={filters.toDate}
                  onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tx-category">Category</Label>
                <NativeSelect
                  id="tx-category"
                  name="category"
                  value={filters.category}
                  onChange={(event) => setFilters((current) => ({
                    ...current,
                    category: event.target.value,
                    subcategory: ''
                  }))}
                >
                  <option value="">All categories</option>
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tx-subcategory">Subcategory</Label>
                <NativeSelect
                  id="tx-subcategory"
                  name="subcategory"
                  value={filters.subcategory}
                  disabled={!filters.category}
                  onChange={(event) => setFilters((current) => ({ ...current, subcategory: event.target.value }))}
                >
                  <option value="">All subcategories</option>
                  {filterSubcategories.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tx-payment">Payment Method</Label>
                <NativeSelect
                  id="tx-payment"
                  name="paymentMethod"
                  value={filters.paymentMethod}
                  onChange={(event) => setFilters((current) => ({ ...current, paymentMethod: event.target.value }))}
                >
                  <option value="">All payment methods</option>
                  {paymentMethods.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tx-store">Store</Label>
                <NativeSelect
                  id="tx-store"
                  name="store"
                  value={filters.store}
                  onChange={(event) => setFilters((current) => ({ ...current, store: event.target.value }))}
                >
                  <option value="">All stores</option>
                  {stores.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </NativeSelect>
              </div>
              {isAdmin ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="tx-user">User</Label>
                  <NativeSelect
                    id="tx-user"
                    name="user"
                    value={filters.user}
                    onChange={(event) => setFilters((current) => ({ ...current, user: event.target.value }))}
                  >
                    <option value="">All users</option>
                    {users.map((item) => (
                      <option key={item.id} value={item.id}>{item.name || item.email}</option>
                    ))}
                  </NativeSelect>
                </div>
              ) : null}
              <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3">
                <Button type="submit">Apply filters</Button>
                <Button type="button" variant="outline" onClick={() => void clearFilters()}>
                  Clear
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {filtersActive ? (
        <Card size="sm">
          <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-1 py-4">
            <span className="text-sm text-muted-foreground">Filtered total</span>
            <strong className="text-lg">{money.format(Number(totalAmount || 0))}</strong>
            <span className="text-sm text-muted-foreground">
              {totalItems || 0} transaction{totalItems === 1 ? '' : 's'}
            </span>
          </CardContent>
        </Card>
      ) : null}

      <div id="transactionsList" className="space-y-6" aria-live="polite">
        {!rows.length ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {loading ? 'Loading transactions...' : 'No transactions yet.'}
            </CardContent>
          </Card>
        ) : (
          grouped.map((group) => (
            <section key={group.date} className="space-y-3">
              <header className="flex items-end justify-between gap-3">
                <h2 className="text-base font-semibold">{formatLongDate(group.date)}</h2>
                <strong className="text-sm text-muted-foreground">{money.format(group.total)}</strong>
              </header>
              <div className="grid gap-2">
                {group.items.map((transaction) => (
                  <Link
                    key={transaction.id}
                    to={`/transactions/${transaction.id}`}
                    data-transaction-link={transaction.id}
                    className={cn(
                      'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card p-3 text-card-foreground no-underline transition-colors',
                      'hover:bg-muted/40 sm:grid-cols-[auto_minmax(0,1fr)_auto_14px]'
                    )}
                  >
                    <div
                      className={cn(
                        'flex size-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold',
                        transactionToneClass(transaction)
                      )}
                      aria-hidden="true"
                    >
                      {transactionAvatarLabel(transaction)}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="truncate text-sm">
                          {transaction.title || transaction.expand?.subcategory?.name || 'Untitled transaction'}
                        </strong>
                        {transaction.expand?.category?.name ? (
                          <Badge variant="secondary">{transaction.expand.category.name}</Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {transaction.expand?.subcategory?.name || 'None'} • {displayStore(transaction)} • {transaction.expand?.payment_method?.name || 'Not set'}
                        {isAdmin ? ` • ${transaction.expand?.user?.email || transaction.expand?.user?.name || 'Unknown user'}` : ''}
                      </p>
                      <div className="flex items-center justify-between gap-3 sm:hidden">
                        <strong className="text-sm">{money.format(Number(transaction.amount || 0))}</strong>
                        <span className="text-xs text-muted-foreground">{formatLongDate(transaction.date)}</span>
                      </div>
                    </div>
                    <div className="hidden text-right sm:block">
                      <strong className="block text-sm">{money.format(Number(transaction.amount || 0))}</strong>
                      <span className="text-xs text-muted-foreground">{formatLongDate(transaction.date)}</span>
                    </div>
                    <div className="hidden text-muted-foreground sm:block" aria-hidden="true">›</div>
                  </Link>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <strong className="text-sm">{startItem}-{endItem} of {totalItems}</strong>
            <p className="text-xs text-muted-foreground">Page {safePage} of {safeTotalPages}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="tx-page-size" className="text-muted-foreground">Rows</Label>
              <NativeSelect
                id="tx-page-size"
                className="w-auto"
                value={perPage}
                onChange={(event) => void updatePageSize(event.target.value)}
              >
                {TRANSACTION_PAGE_SIZE_OPTIONS.map((value) => (
                  <option key={value} value={value}>{value} per page</option>
                ))}
              </NativeSelect>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={safePage <= 1}
              onClick={() => changePage(safePage - 1)}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={safePage >= safeTotalPages}
              onClick={() => changePage(safePage + 1)}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>

      <EditTransactionDialog
        open={Boolean(editTransaction)}
        transaction={editTransaction}
        onClose={() => setEditTransaction(null)}
        onSaved={() => loadRows(filters, page, perPage)}
      />
    </section>
  );
}
