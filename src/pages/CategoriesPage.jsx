import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createCategory } from '@/lib/api';
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

export default function CategoriesPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { categories, loadCategories, invalidate } = useData();

  useEffect(() => {
    void loadCategories().catch((error) => toast(error.message));
  }, [loadCategories, toast]);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await createCategory(Object.fromEntries(new FormData(form)));
      form.reset();
      toast('Category saved.');
      invalidate('categories', 'transactions', 'summaryTransactions', 'homeTotals');
      await loadCategories(true);
    } catch (error) {
      toast(error.message);
    }
  }

  return (
    <section id="categoriesPage" className="space-y-6">
      <PageHeader eyebrow="Admin" title="Categories" />

      {isAdmin ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Add category</CardTitle>
            <CardDescription>Create a new expense category</CardDescription>
          </CardHeader>
          <CardContent>
            <form id="categoryForm" className="flex flex-col gap-3 sm:flex-row sm:items-center" onSubmit={handleSubmit}>
              <Input
                type="text"
                name="name"
                placeholder="Category name"
                required
                className="sm:flex-1"
              />
              <Button type="submit" className="sm:shrink-0">Add category</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div id="categoryList" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.length ? categories.map((category) => {
          const count = (category.subcategories || []).length;
          return (
            <Link
              key={category.id}
              to={`/categories/${category.id}`}
              className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full transition-colors hover:bg-muted/40">
                <CardHeader>
                  <CardTitle className="text-base">{category.name}</CardTitle>
                  <CardDescription>
                    {count === 0
                      ? 'No subcategories'
                      : `${count} subcategor${count === 1 ? 'y' : 'ies'}`}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        }) : (
          <Card size="sm" className="sm:col-span-2 lg:col-span-3">
            <CardContent className="py-8 text-center text-muted-foreground">
              No categories yet.
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
