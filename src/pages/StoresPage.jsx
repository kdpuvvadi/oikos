import { useEffect, useMemo, useState } from 'react';
import {
  countTransactionsUsing,
  createStore,
  deleteStore,
  updateStore
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
    <section id="storesPage" className="space-y-6">
      <PageHeader eyebrow="Stores" title="Stores" />

      {isAdmin ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Add store</CardTitle>
            <CardDescription>Create a store used on expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <form id="storeForm" className="flex flex-col gap-3 sm:flex-row sm:items-center" onSubmit={handleSubmit}>
              <Input
                type="text"
                name="name"
                placeholder="Store name"
                required
                className="sm:flex-1"
              />
              <Button type="submit" className="sm:shrink-0">Add store</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div id="storeList" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stores.length ? stores.map((store) => (
          <Card key={store.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <CardTitle className="text-base">{store.name}</CardTitle>
              {isAdmin ? (
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditStore(store)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteStoreTarget(store)}
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
              No stores yet.
            </CardContent>
          </Card>
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
