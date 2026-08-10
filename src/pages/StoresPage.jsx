import { useEffect, useMemo, useState } from 'react';
import {
  countTransactionsUsing,
  createStore,
  deleteStore,
  updateStore
} from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useData } from '../context/DataContext';
import { EditNameDialog } from '../components/EditNameDialog';
import { DeleteReferenceDialog } from '../components/DeleteReferenceDialog';

export default function StoresPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { stores, loadStores, invalidate } = useData();
  const [editStore, setEditStore] = useState(null);
  const [deleteStoreTarget, setDeleteStoreTarget] = useState(null);
  const [usageCount, setUsageCount] = useState(0);
  const [usageLoading, setUsageLoading] = useState(false);

  useEffect(() => {
    void loadStores().catch((error) => toast(error.message));
  }, [loadStores, toast]);

  useEffect(() => {
    if (!deleteStoreTarget) {
      setUsageCount(0);
      return;
    }
    let cancelled = false;
    setUsageLoading(true);
    void countTransactionsUsing('store', deleteStoreTarget.id)
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
  }, [deleteStoreTarget, toast]);

  async function refresh() {
    invalidate('stores', 'transactions', 'summaryTransactions', 'homeTotals');
    await loadStores(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await createStore(Object.fromEntries(new FormData(form)));
      form.reset();
      toast('Store saved.');
      await refresh();
    } catch (error) {
      toast(error.message);
    }
  }

  async function handleEditSubmit(name) {
    if (!editStore) return;
    if (name === editStore.name) {
      setEditStore(null);
      return;
    }
    try {
      await updateStore(editStore.id, { name });
      toast('Store updated.');
      setEditStore(null);
      await refresh();
    } catch (error) {
      toast(error.message);
      throw error;
    }
  }

  const replacements = useMemo(
    () => stores
      .filter((store) => store.id !== deleteStoreTarget?.id)
      .map((store) => ({ id: store.id, name: store.name })),
    [stores, deleteStoreTarget]
  );

  async function handleDeleteConfirm({ replacementId }) {
    if (!deleteStoreTarget) return;
    try {
      await deleteStore(deleteStoreTarget.id, { replacementId });
      toast('Store deleted.');
      setDeleteStoreTarget(null);
      await refresh();
    } catch (error) {
      toast(error.message);
      throw error;
    }
  }

  return (
    <section id="storesPage">
      <div className="page-title">
        <p className="eyebrow">Stores</p>
        <h1>Stores</h1>
      </div>

      {isAdmin ? (
        <form id="storeForm" className="panel inline-form" onSubmit={handleSubmit}>
          <input type="text" name="name" placeholder="Store name" required />
          <button type="submit">Add store</button>
        </form>
      ) : null}

      <div id="storeList" className="list-grid compact">
        {stores.length ? stores.map((store) => (
          <article key={store.id} className="ref-item ref-card">
            <div className="list-heading">
              <strong>{store.name}</strong>
              {isAdmin ? (
                <div className="ref-card-actions">
                  <button
                    type="button"
                    className="ghost small-button"
                    onClick={() => setEditStore(store)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="ghost small-button danger-text"
                    onClick={() => setDeleteStoreTarget(store)}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          </article>
        )) : (
          <p className="panel-empty">No stores yet.</p>
        )}
      </div>

      <EditNameDialog
        open={Boolean(editStore)}
        title="Edit store"
        label="Store name"
        initialValue={editStore?.name || ''}
        placeholder="Example: Corner shop"
        onClose={() => setEditStore(null)}
        onSubmit={handleEditSubmit}
      />

      <DeleteReferenceDialog
        open={Boolean(deleteStoreTarget)}
        title="Delete store"
        itemName={deleteStoreTarget?.name || ''}
        usageCount={usageCount}
        usageLoading={usageLoading}
        replacementLabel="Replacement store"
        replacementOptions={replacements}
        onClose={() => setDeleteStoreTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </section>
  );
}
