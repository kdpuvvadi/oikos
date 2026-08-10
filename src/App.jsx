import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { resolveSeo } from './lib/seo';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import MePage from './pages/MePage';
import CategoriesPage from './pages/CategoriesPage';
import CategoryDetailPage from './pages/CategoryDetailPage';
import StoresPage from './pages/StoresPage';
import PaymentMethodsPage from './pages/PaymentMethodsPage';
import UsersPage from './pages/UsersPage';
import TransactionsPage from './pages/TransactionsPage';
import TransactionDetailPage from './pages/TransactionDetailPage';
import DashboardPage from './pages/DashboardPage';
import FilterPage from './pages/FilterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';

function AdminRoute({ children }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/me" element={<MePage />} />
      <Route path="/categories" element={<AdminRoute><CategoriesPage /></AdminRoute>} />
      <Route path="/categories/:id" element={<AdminRoute><CategoryDetailPage /></AdminRoute>} />
      <Route path="/stores" element={<AdminRoute><StoresPage /></AdminRoute>} />
      <Route path="/payment-methods" element={<AdminRoute><PaymentMethodsPage /></AdminRoute>} />
      <Route path="/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
      <Route path="/transactions" element={<TransactionsPage />} />
      <Route path="/transactions/:id" element={<TransactionDetailPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/filter" element={<FilterPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const { user, ready, isApproved } = useAuth();
  const location = useLocation();
  const isVerifyEmail = location.pathname === '/verify-email';
  const showApp = Boolean(user && isApproved);
  const showAuth = !showApp && !isVerifyEmail;

  useEffect(() => {
    const { title } = resolveSeo(location.pathname);
    document.title = title;
  }, [location.pathname]);

  if (!ready && !isVerifyEmail) {
    return (
      <>
        <Header />
        <div className="auth-shell">
          <p className="panel-empty" style={{ padding: '2rem', textAlign: 'center' }}>Loading…</p>
        </div>
      </>
    );
  }

  if (isVerifyEmail) {
    if (ready && showApp) return <Navigate to="/" replace />;
    return (
      <>
        <Header />
        <VerifyEmailPage />
      </>
    );
  }

  return (
    <>
      <Header />
      {showAuth ? <AuthPage /> : null}
      {showApp ? (
        <main id="appShell">
          <AppRoutes />
        </main>
      ) : null}
    </>
  );
}
