import { useEffect, useState } from 'react';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

interface Props {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}

export default function AdminToast({ toasts, onRemove }: Props) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onRemove }: { toast: ToastItem; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(toast.id), 300);
    }, 3000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const config = {
    success: { icon: 'ri-checkbox-circle-fill', bg: 'bg-emerald-500', text: 'text-white' },
    error:   { icon: 'ri-close-circle-fill',    bg: 'bg-red-500',     text: 'text-white' },
    info:    { icon: 'ri-information-fill',      bg: 'bg-indigo-500',  text: 'text-white' },
    warning: { icon: 'ri-error-warning-fill',    bg: 'bg-amber-500',   text: 'text-white' },
  }[toast.type];

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg transition-all duration-300 ${config.bg} ${config.text} ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
        <i className={`${config.icon} text-sm`} />
      </div>
      <span className="text-sm font-semibold whitespace-nowrap">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="w-4 h-4 flex items-center justify-center opacity-70 hover:opacity-100 cursor-pointer transition-opacity flex-shrink-0"
      >
        <i className="ri-close-line text-xs" />
      </button>
    </div>
  );
}
