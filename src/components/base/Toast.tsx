import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

const typeConfig: Record<ToastType, { icon: string; bg: string; border: string; text: string }> = {
  success: { icon: 'ri-checkbox-circle-fill', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  error:   { icon: 'ri-error-warning-fill',   bg: 'bg-red-500/15',     border: 'border-red-500/30',     text: 'text-red-400'     },
  warning: { icon: 'ri-alert-fill',           bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   text: 'text-amber-400'   },
  info:    { icon: 'ri-information-fill',     bg: 'bg-indigo-500/15',  border: 'border-indigo-500/30',  text: 'text-indigo-400'  },
};

export function Toast({ message, type = 'success', duration = 2800, onClose }: ToastProps) {
  const [visible, setVisible] = useState(false);
  const cfg = typeConfig[type];

  useEffect(() => {
    // Animate in
    const t1 = setTimeout(() => setVisible(true), 10);
    const t2 = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, duration);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [duration, onClose]);

  return (
    <div
      className={`fixed bottom-6 left-1/2 z-[200] flex items-center gap-3 px-5 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-300 ${cfg.bg} ${cfg.border} ${
        visible ? 'opacity-100 -translate-x-1/2 translate-y-0' : 'opacity-0 -translate-x-1/2 translate-y-4'
      }`}
    >
      <i className={`${cfg.icon} ${cfg.text} text-base`} />
      <span className={`text-sm font-bold ${cfg.text}`}>{message}</span>
      <button
        onClick={() => { setVisible(false); setTimeout(onClose, 300); }}
        className="ml-1 w-5 h-5 flex items-center justify-center rounded-full text-white/40 hover:text-white/80 transition-colors cursor-pointer"
      >
        <i className="ri-close-line text-xs" />
      </button>
    </div>
  );
}

// ── Toast Manager Hook ─────────────────────────────────────────────────────
export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (message: string, type: ToastType = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return { toasts, showToast, removeToast };
}

// ── Toast Container ────────────────────────────────────────────────────────
export function ToastContainer({ toasts, onRemove }: { toasts: ToastItem[]; onRemove: (id: string) => void }) {
  return (
    <>
      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} type={t.type} onClose={() => onRemove(t.id)} />
      ))}
    </>
  );
}
