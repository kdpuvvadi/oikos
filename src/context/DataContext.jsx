import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  fetchCategories,
  fetchPaymentMethods,
  fetchStores,
  fetchUsers,
  fetchSummary,
  fetchHomeTotals,
  getAppInfo
} from '../lib/api';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [stores, setStores] = useState([]);
  const [users, setUsers] = useState([]);
  const [summaryTransactions, setSummaryTransactions] = useState([]);
  const [homeTotals, setHomeTotals] = useState({ thisMonth: 0, lastMonth: 0 });
  const [appVersion, setAppVersion] = useState('');
  const [appBranch, setAppBranch] = useState('');
  const [pocketbaseVersion, setPocketbaseVersion] = useState('');

  const loadedRef = useRef({
    categories: false,
    paymentMethods: false,
    stores: false,
    users: false,
    summaryTransactions: false,
    homeTotals: false,
    appVersion: false
  });
  const pendingRef = useRef({});

  const ensureLoaded = useCallback(async (key, loader, force = false) => {
    if (force) loadedRef.current[key] = false;
    if (loadedRef.current[key]) return;
    if (!pendingRef.current[key]) {
      pendingRef.current[key] = loader().finally(() => {
        delete pendingRef.current[key];
      });
    }
    await pendingRef.current[key];
  }, []);

  const invalidate = useCallback((...keys) => {
    keys.forEach((key) => {
      loadedRef.current[key] = false;
    });
  }, []);

  const reset = useCallback(() => {
    setCategories([]);
    setPaymentMethods([]);
    setStores([]);
    setUsers([]);
    setSummaryTransactions([]);
    setHomeTotals({ thisMonth: 0, lastMonth: 0 });
    setAppVersion('');
    setAppBranch('');
    setPocketbaseVersion('');
    Object.keys(loadedRef.current).forEach((key) => {
      loadedRef.current[key] = false;
    });
    pendingRef.current = {};
  }, []);

  const loadCategories = useCallback(async (force = false) => {
    await ensureLoaded('categories', async () => {
      const data = await fetchCategories();
      setCategories(data);
      loadedRef.current.categories = true;
    }, force);
  }, [ensureLoaded]);

  const loadPaymentMethods = useCallback(async (force = false) => {
    await ensureLoaded('paymentMethods', async () => {
      const data = await fetchPaymentMethods();
      setPaymentMethods(data);
      loadedRef.current.paymentMethods = true;
    }, force);
  }, [ensureLoaded]);

  const loadStores = useCallback(async (force = false) => {
    await ensureLoaded('stores', async () => {
      const data = await fetchStores();
      setStores(data);
      loadedRef.current.stores = true;
    }, force);
  }, [ensureLoaded]);

  const loadUsers = useCallback(async (force = false) => {
    await ensureLoaded('users', async () => {
      const data = await fetchUsers();
      setUsers(data);
      loadedRef.current.users = true;
    }, force);
  }, [ensureLoaded]);

  const loadSummaryTransactions = useCallback(async (force = false) => {
    await ensureLoaded('summaryTransactions', async () => {
      const data = await fetchSummary();
      setSummaryTransactions(data.transactions || []);
      loadedRef.current.summaryTransactions = true;
    }, force);
  }, [ensureLoaded]);

  const loadHomeTotals = useCallback(async (force = false) => {
    await ensureLoaded('homeTotals', async () => {
      const data = await fetchHomeTotals();
      setHomeTotals(data);
      loadedRef.current.homeTotals = true;
    }, force);
  }, [ensureLoaded]);

  const loadAppVersion = useCallback(async (force = false) => {
    await ensureLoaded('appVersion', async () => {
      try {
        const appInfo = await getAppInfo();
        const manifestResponse = await fetch('/manifest.json', { cache: 'no-store' });
        const manifest = manifestResponse.ok ? await manifestResponse.json() : {};
        setAppVersion(String(appInfo.version || manifest.version || '').trim());
        setAppBranch(String(appInfo.branch || '').trim());
        setPocketbaseVersion(String(appInfo.pocketbase || '').trim());
      } catch {
        setAppVersion('');
        setAppBranch('');
        setPocketbaseVersion('');
      }
      loadedRef.current.appVersion = true;
    }, force);
  }, [ensureLoaded]);

  const otherStoreId = useCallback(() => (
    stores.find((store) => store.name?.trim().toLowerCase() === 'other')?.id || ''
  ), [stores]);

  const displayStore = useCallback((transaction) => (
    transaction.storeText || transaction.expand?.store?.name || 'Unknown'
  ), []);

  const summaryStoreLabel = useCallback((transaction) => {
    const storeText = String(transaction?.storeText || '').trim();
    if (storeText) return storeText;
    const store = String(transaction?.store || '').trim();
    if (!store || store.toLowerCase() === 'other') return '';
    return store;
  }, []);

  const summaryLabelFor = useCallback((transaction, field) => {
    if (field === 'month') return String(transaction.date || '').slice(0, 7);
    if (field === 'category') return transaction.category || 'Uncategorized';
    if (field === 'subcategory') return transaction.subcategory || 'None';
    if (field === 'store') return summaryStoreLabel(transaction) || null;
    if (field === 'paymentMethod') return transaction.paymentMethod || 'Not set';
    return 'Total';
  }, [summaryStoreLabel]);

  const value = useMemo(() => ({
    categories,
    paymentMethods,
    stores,
    users,
    summaryTransactions,
    homeTotals,
    appVersion,
    appBranch,
    pocketbaseVersion,
    loadCategories,
    loadPaymentMethods,
    loadStores,
    loadUsers,
    loadSummaryTransactions,
    loadHomeTotals,
    loadAppVersion,
    invalidate,
    reset,
    otherStoreId,
    displayStore,
    summaryStoreLabel,
    summaryLabelFor
  }), [
    categories,
    paymentMethods,
    stores,
    users,
    summaryTransactions,
    homeTotals,
    appVersion,
    appBranch,
    pocketbaseVersion,
    loadCategories,
    loadPaymentMethods,
    loadStores,
    loadUsers,
    loadSummaryTransactions,
    loadHomeTotals,
    loadAppVersion,
    invalidate,
    reset,
    otherStoreId,
    displayStore,
    summaryStoreLabel,
    summaryLabelFor
  ]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
}
