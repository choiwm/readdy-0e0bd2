import { useEffect, useState } from 'react';
import { subscribeToasts, ToastMessage } from '@/utils/errorHandler';

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return subscribeToasts((toast) => {
      setToasts((prev) => [...prev, toast]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, toast.durationMs);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          aria-live={t.level === 'error' ? 'assertive' : 'polite'}
          className={`min-w-[240px] max-w-sm rounded-md px-4 py-3 text-sm shadow-lg ${
            t.level === 'error'
              ? 'bg-red-600 text-white'
              : t.level === 'warn'
                ? 'bg-amber-500 text-black'
                : 'bg-neutral-800 text-white'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

export default ToastHost;
