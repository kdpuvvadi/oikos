import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTransactions } from '../lib/api';
import { money, formatLongDate, TRANSACTION_PAGE_SIZE_OPTIONS } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useData } from '../context/DataContext';
import { transactionToneClass, transactionAvatarLabel } from '../lib/transactions';
import { EditTransactionDialog } from '../components/EditTransactionDialog';

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
      // page effect will reload with stale filters; force immediate reload with cleared filters
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
    <section id="transactionsPage">
      <div className="page-title-bar">
        <div className="page-title transaction-page-title">
          <p className="eyebrow">Transactions</p>
          <h1>Transactions</h1>
          <p className="page-subtitle">All your transactions</p>
        </div>
        <div className="transactions-toolbar">
          <button
            type="button"
            className="ghost transactions-filter-button"
            id="toggleTransactionFilters"
            aria-expanded={filtersOpen || filtersActive}
            aria-controls="transactionFiltersPanel"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            Filter
          </button>
        </div>
      </div>

      <div id="transactionFiltersPanel" className={filtersOpen || filtersActive ? '' : 'hidden'}>
        <form
          id="transactionFilterForm"
          className="panel inline-form transaction-filter-form"
          onSubmit={(event) => void applyFilters(event)}
        >
          <label>
            From
            <input
              type="date"
              name="fromDate"
              value={filters.fromDate}
              onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))}
            />
          </label>
          <label>
            To
            <input
              type="date"
              name="toDate"
              value={filters.toDate}
              onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))}
            />
          </label>
          <label>
            Category
            <select
              name="category"
              id="transactionFilterCategory"
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
            </select>
          </label>
          <label>
            Subcategory
            <select
              name="subcategory"
              id="transactionFilterSubcategory"
              value={filters.subcategory}
              disabled={!filters.category}
              onChange={(event) => setFilters((current) => ({ ...current, subcategory: event.target.value }))}
            >
              <option value="">All subcategories</option>
              {filterSubcategories.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>
            Payment Method
            <select
              name="paymentMethod"
              id="transactionFilterPaymentMethod"
              value={filters.paymentMethod}
              onChange={(event) => setFilters((current) => ({ ...current, paymentMethod: event.target.value }))}
            >
              <option value="">All payment methods</option>
              {paymentMethods.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>
            Store
            <select
              name="store"
              id="transactionFilterStore"
              value={filters.store}
              onChange={(event) => setFilters((current) => ({ ...current, store: event.target.value }))}
            >
              <option value="">All stores</option>
              {stores.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="admin-only">
            User
            <select
              name="user"
              id="transactionFilterUser"
              value={filters.user}
              onChange={(event) => setFilters((current) => ({ ...current, user: event.target.value }))}
            >
              <option value="">All users</option>
              {users.map((item) => (
                <option key={item.id} value={item.id}>{item.name || item.email}</option>
              ))}
            </select>
          </label>
          <button type="submit">Apply filters</button>
          <button type="button" className="ghost" id="clearTransactionFilters" onClick={() => void clearFilters()}>
            Clear
          </button>
        </form>
      </div>

      <div
        id="transactionsSummary"
        className={`transactions-summary${filtersActive ? '' : ' hidden'}`}
      >
        {filtersActive ? (
          <>
            <span>Filtered total</span>
            <strong>{money.format(Number(totalAmount || 0))}</strong>
            <span>{totalItems || 0} transaction{totalItems === 1 ? '' : 's'}</span>
          </>
        ) : null}
      </div>

      <div id="transactionsList" className="transactions-list" aria-live="polite">
        {!rows.length ? (
          <div className="panel">
            <p className="panel-empty">{loading ? 'Loading transactions...' : 'No transactions yet.'}</p>
          </div>
        ) : (
          grouped.map((group) => (
            <section key={group.date} className="transaction-day-group">
              <header className="transaction-day-header">
                <div>
                  <h2>{formatLongDate(group.date)}</h2>
                </div>
                <strong className="transaction-day-total">{money.format(group.total)}</strong>
              </header>
              <div className="transaction-day-items">
                {group.items.map((transaction) => (
                  <Link
                    key={transaction.id}
                    className="transaction-list-card"
                    to={`/transactions/${transaction.id}`}
                    data-transaction-link={transaction.id}
                  >
                    <div className={`transaction-list-avatar ${transactionToneClass(transaction)}`} aria-hidden="true">
                      {transactionAvatarLabel(transaction)}
                    </div>
                    <div className="transaction-list-main">
                      <div className="transaction-list-topline">
                        <strong className="transaction-list-title">
                          {transaction.title || transaction.expand?.subcategory?.name || 'Untitled transaction'}
                        </strong>
                        {transaction.expand?.category?.name ? (
                          <span className="transaction-list-badge">{transaction.expand.category.name}</span>
                        ) : null}
                      </div>
                      <div className="transaction-list-subline">
                        {transaction.expand?.subcategory?.name || 'None'} • {displayStore(transaction)} • {transaction.expand?.payment_method?.name || 'Not set'}
                        {isAdmin ? ` • ${transaction.expand?.user?.email || transaction.expand?.user?.name || 'Unknown user'}` : ''}
                      </div>
                    </div>
                    <div className="transaction-list-side">
                      <strong className="transaction-list-amount">{money.format(Number(transaction.amount || 0))}</strong>
                      <span className="transaction-list-date">{formatLongDate(transaction.date)}</span>
                    </div>
                    <div className="transaction-list-chevron" aria-hidden="true">›</div>
                    <div className="transaction-list-mobile-meta">
                      <strong className="transaction-list-amount">{money.format(Number(transaction.amount || 0))}</strong>
                      <span className="transaction-list-date">{formatLongDate(transaction.date)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <div id="transactionsPagination" className="panel transactions-pagination">
        <div className="pagination-summary">
          <strong>{startItem}-{endItem} of {totalItems}</strong>
          <span>Page {safePage} of {safeTotalPages}</span>
        </div>
        <div className="pagination-actions">
          <label className="pagination-page-size">
            <span>Rows</span>
            <select
              data-transaction-page-size
              value={perPage}
              onChange={(event) => void updatePageSize(event.target.value)}
            >
              {TRANSACTION_PAGE_SIZE_OPTIONS.map((value) => (
                <option key={value} value={value}>{value} per page</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="ghost"
            data-page-action="prev"
            disabled={safePage <= 1}
            onClick={() => changePage(safePage - 1)}
          >
            Previous
          </button>
          <button
            type="button"
            className="ghost"
            data-page-action="next"
            disabled={safePage >= safeTotalPages}
            onClick={() => changePage(safePage + 1)}
          >
            Next
          </button>
        </div>
      </div>

      <EditTransactionDialog
        open={Boolean(editTransaction)}
        transaction={editTransaction}
        onClose={() => setEditTransaction(null)}
        onSaved={() => loadRows(filters, page, perPage)}
      />
    </section>
  );
}
