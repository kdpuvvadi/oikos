import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createCategory } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useData } from '../context/DataContext';

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
    <section id="categoriesPage">
      <div className="page-title">
        <p className="eyebrow">Admin</p>
        <h1>Categories</h1>
      </div>

      {isAdmin ? (
        <form id="categoryForm" className="panel inline-form" onSubmit={handleSubmit}>
          <input type="text" name="name" placeholder="Category name" required />
          <button type="submit">Add category</button>
        </form>
      ) : null}

      <div id="categoryList" className="list-grid compact">
        {categories.length ? categories.map((category) => {
          const count = (category.subcategories || []).length;
          return (
            <Link
              key={category.id}
              to={`/categories/${category.id}`}
              className="ref-item ref-card category-list-link"
            >
              <strong>{category.name}</strong>
              <span className="category-list-meta">
                {count === 0
                  ? 'No subcategories'
                  : `${count} subcategor${count === 1 ? 'y' : 'ies'}`}
              </span>
            </Link>
          );
        }) : (
          <p className="panel-empty">No categories yet.</p>
        )}
      </div>
    </section>
  );
}
