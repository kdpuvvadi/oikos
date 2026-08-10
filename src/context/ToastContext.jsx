import { createContext, useCallback, useContext } from 'react';
import { toast as sonnerToast } from 'sonner';
import { isAbortError } from '@/lib/api';
import { Toaster } from '@/components/ui/sonner';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const toast = useCallback((nextMessage) => {
    if (isAbortError({ message: nextMessage }) || isAbortError(nextMessage)) return;
    const message = String(nextMessage || '').trim();
    if (!message) return;
    sonnerToast(message);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <Toaster position="bottom-center" richColors closeButton />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
