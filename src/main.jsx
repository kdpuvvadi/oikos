import { StrictMode, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import { ToastProvider } from './context/ToastContext';
import { initializeTheme } from './lib/theme';
import './styles.css';

initializeTheme();
document.documentElement.classList.add('js');
if (document.cookie.includes('oikos_session=1')) {
  document.documentElement.classList.add('has-session');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.log('Service Worker registration failed:', error);
    });
  }, { once: true });
}

function Root() {
  const dataResetRef = useRef(null);
  const onAuthCleared = useCallback(() => {
    dataResetRef.current?.();
  }, []);

  return (
    <BrowserRouter>
      <ToastProvider>
        <DataProvider>
          <DataResetBridge resetRef={dataResetRef} />
          <AuthProvider onAuthCleared={onAuthCleared}>
            <App />
          </AuthProvider>
        </DataProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

function DataResetBridge({ resetRef }) {
  const { reset } = useData();
  resetRef.current = reset;
  return null;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
