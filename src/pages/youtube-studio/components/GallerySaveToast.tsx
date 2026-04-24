import type { GalleryToast } from './step4-image-data';

interface GallerySaveToastProps {
  toasts: GalleryToast[];
  onDismiss: (id: string) => void;
}

export default function GallerySaveToast({ toasts, onDismiss }: GallerySaveToastProps) {
  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-2.5 bg-zinc-900 border border-emerald-500/30 rounded-xl px-3.5 py-2.5 pointer-events-auto"
          style={{ animation: 'slideInRight 0.3s ease-out' }}
        >
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <i className="ri-image-line text-emerald-400 text-sm" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white whitespace-nowrap">{t.message}</p>
            <p className="text-[10px] text-zinc-500 whitespace-nowrap">AI 갤러리에서 확인하세요</p>
          </div>
          <button
            onClick={() => onDismiss(t.id)}
            className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-zinc-400 cursor-pointer transition-colors flex-shrink-0"
          >
            <i className="ri-close-line text-xs" />
          </button>
        </div>
      ))}
    </div>
  );
}
