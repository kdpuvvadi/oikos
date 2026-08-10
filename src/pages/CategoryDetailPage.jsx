import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  countTransactionsUsing,
  createSubcategory,
  deleteCategory,
  deleteSubcategory,
  updateCategory,
  updateSubcategory
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
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';

export default function CategoryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { categories, loadCategories, invalidate } = useData();
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [usageCount, setUsageCount] = useState(0);
  const [usageLoading, setUsageLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void loadCategories()
      .catch((error) => toast(error.message))
      .finally(() => setLoaded(true));
  }, [loadCategories, toast]);

  const category = useMemo(
    () => categories.find((item) => item.id === id) || null,
    [categories, id]
  );

  useEffect(() => {
    if (!deleteTarget) {
      setUsageCount(0);
      return;
    }
    let cancelled = false;
    setUsageLoading(true);
    const field = deleteTarget.kind === 'category' ? 'category' : 'subcategory';
    void countTransactionsUsing(field, deleteTarget.id)
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
    invalidate('categories', 'transactions', 'summaryTransactions', 'homeTotals');
    await loadCategories(true);
  }

  async function handleAddSubcategory(event) {
    event.preventDefault();
    if (!category) return;
    const form = event.currentTarget;
    const name = String(new FormData(form).get('name') || '').trim();
    if (!name) return;
    try {
      await createSubcategory({ categoryId: category.id, name });
      form.reset();
      toast('Subcategory added.');
      await refresh();
    } catch (error) {
      toast(error.message);
    }
  }

  async function handleEditSubmit(name) {
    if (!editTarget) return;
    try {
      if (editTarget.kind === 'category') {
        if (name === editTarget.name) {
          setEditTarget(null);
          return;
        }
        await updateCategory(editTarget.id, { name });
        toast('Category updated.');
      } else if (editTarget.kind === 'subcategory') {
        if (name === editTarget.name) {
          setEditTarget(null);
          return;
        }
        await updateSubcategory(editTarget.id, { name });
        toast('Subcategory updated.');
      }
      setEditTarget(null);
      await refresh();
    } catch (error) {
      toast(error.message);
      throw error;
    }
  }

  const categoryReplacements = useMemo(
    () => categories
      .filter((item) => item.id !== deleteTarget?.id)
      .map((item) => ({ id: item.id, name: item.name })),
    [categories, deleteTarget]
  );

  const subcategoryReplacements = useMemo(() => {
    if (deleteTarget?.kind !== 'subcategory') return [];
    return categories
      .flatMap((item) => (item.subcategories || []).map((subcategory) => ({
        id: subcategory.id,
        name: `${item.name} · ${subcategory.name}`,
        categoryId: item.id
      })))
      .filter((item) => item.id !== deleteTarget.id);
  }, [categories, deleteTarget]);

  async function handleDeleteConfirm(payload) {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.kind === 'category') {
        await deleteCategory(deleteTarget.id, {
          replacementCategoryId: payload.replacementId,
          replacementSubcategoryId: payload.replacementSubcategoryId
        });
        toast('Category deleted.');
        setDeleteTarget(null);
        navigate('/categories', { replace: true });
        await refresh();
        return;
      }
      await deleteSubcategory(deleteTarget.id, {
        replacementId: payload.replacementId
      });
      toast('Subcategory deleted.');
      setDeleteTarget(null);
      await refresh();
    } catch (error) {
      toast(error.message);
      throw error;
    }
  }

  if (!loaded) {
    return (
      <section id="categoryDetailPage" className="space-y-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </section>
    );
  }

  if (!category) {
    return (
      <section id="categoryDetailPage" className="space-y-6">
        <PageHeader
          eyebrow="Categories"
          title="Category not found"
          actions={
            <Button asChild variant="outline">
              <Link to="/categories">Back to categories</Link>
            </Button>
          }
        />
        <Card size="sm">
          <CardContent className="py-8 text-center text-muted-foreground">
            This category does not exist or was deleted.
          </CardContent>
        </Card>
      </section>
    );
  }

  const subcategories = category.subcategories || [];

  return (
    <section id="categoryDetailPage" className="space-y-6">
      <PageHeader
        eyebrow={
          <Link to="/categories" className="text-primary hover:underline">
            Categories
          </Link>
        }
        title={category.name}
        actions={
          isAdmin ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditTarget({
                  kind: 'category',
                  id: category.id,
                  name: category.name
                })}
              >
                Edit
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setDeleteTarget({
                  kind: 'category',
                  id: category.id,
                  name: category.name
                })}
              >
                Delete
              </Button>
            </>
          ) : null
        }
      />

      {isAdmin ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Add subcategory</CardTitle>
            <CardDescription>Create a subcategory under {category.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-3 sm:flex-row sm:items-center" onSubmit={handleAddSubcategory}>
              <Input
                type="text"
                name="name"
                placeholder="Subcategory name"
                required
                className="sm:flex-1"
              />
              <Button type="submit" className="sm:shrink-0">Add subcategory</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {subcategories.length ? subcategories.map((subcategory) => (
          <Card key={subcategory.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <CardTitle className="text-base">{subcategory.name}</CardTitle>
              {isAdmin ? (
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditTarget({
                      kind: 'subcategory',
                      id: subcategory.id,
                      name: subcategory.name
                    })}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteTarget({
                      kind: 'subcategory',
                      id: subcategory.id,
                      name: subcategory.name
                    })}
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
              No subcategories yet.
            </CardContent>
          </Card>
        )}
      </div>

      <EditNameDialog
        open={Boolean(editTarget)}
        title={editTarget?.kind === 'category' ? 'Edit category' : 'Edit subcategory'}
        label="Name"
        initialValue={editTarget?.name || ''}
        submitLabel="Save changes"
        onClose={() => setEditTarget(null)}
        onSubmit={handleEditSubmit}
      />

      <DeleteReferenceDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.kind === 'category' ? 'Delete category' : 'Delete subcategory'}
        itemName={deleteTarget?.name || ''}
        usageCount={usageCount}
        usageLoading={usageLoading}
        replacementLabel={deleteTarget?.kind === 'category' ? 'Replacement category' : 'Replacement subcategory'}
        replacementOptions={deleteTarget?.kind === 'category' ? categoryReplacements : subcategoryReplacements}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        canConfirm={({ replacementId, usageCount: count, replacementSubcategoryId }) => {
          if (deleteTarget?.kind !== 'category' || !count) return true;
          if (!replacementId) return false;
          return Boolean(replacementSubcategoryId);
        }}
        extraFields={deleteTarget?.kind === 'category' && usageCount > 0
          ? ({ replacementId, values, setValues, saving }) => {
            const selected = categories.find((item) => item.id === replacementId);
            const options = selected?.subcategories || [];
            return (
              <div className="grid gap-1.5">
                <Label htmlFor="replacement-subcategory">Replacement subcategory</Label>
                <NativeSelect
                  id="replacement-subcategory"
                  required
                  disabled={saving || !replacementId || !options.length}
                  value={values.replacementSubcategoryId || ''}
                  onChange={(event) => setValues((current) => ({
                    ...current,
                    replacementSubcategoryId: event.target.value
                  }))}
                >
                  <option value="">
                    {!replacementId
                      ? 'Select a category first'
                      : options.length
                        ? 'Select subcategory'
                        : 'Selected category has no subcategories'}
                  </option>
                  {options.map((subcategory) => (
                    <option key={subcategory.id} value={subcategory.id}>
                      {subcategory.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            );
          }
          : null}
      />
    </section>
  );
}
