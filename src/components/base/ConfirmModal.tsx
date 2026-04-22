export type ConfirmVariant = 'danger' | 'warning' | 'info';

export interface ConfirmModalProps {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  previewImage?: string;
  previewText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const variantConfig: Record<ConfirmVariant, {
  icon: string;
  iconBg: string;
  iconColor: string;
  confirmBg: string;
  confirmHover: string;
}> = {
  danger: {
    icon: 'ri-delete-bin-line',
    iconBg: 'bg-red-500/15 border-red-500/25',
    iconColor: 'text-red-400',
    confirmBg: 'bg-red-500',
    confirmHover: 'hover:bg-red-400',
  },
  warning: {
    icon: 'ri-alert-line',
    iconBg: 'bg-amber-500/15 border-amber-500/25',
    iconColor: 'text-amber-400',
    confirmBg: 'bg-amber-500',
    confirmHover: 'hover:bg-amber-400',
  },
  info: {
    icon: 'ri-information-line',
    iconBg: 'bg-indigo-500/15 border-indigo-500/25',
    iconColor: 'text-indigo-400',
    confirmBg: 'bg-indigo-500',
    confirmHover: 'hover:bg-indigo-400',
  },
};

export default function ConfirmModal({
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  variant = 'danger',
  previewImage,
  previewText,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const cfg = variantConfig[variant];

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm bg-[#111114] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Preview image */}
        {previewImage && (
          <div className="w-full h-28 overflow-hidden">
            <img src={previewImage} alt="preview" className="w-full h-full object-cover object-top" />
          </div>
        )}

        <div className="p-5">
          {/* Icon + Title */}
          <div className="flex items-start gap-3 mb-4">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
              <i className={`${cfg.icon} ${cfg.iconColor} text-lg`} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{title}</p>
              <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{description}</p>
            </div>
          </div>

          {/* Preview text block */}
          {previewText && (
            <div className="bg-zinc-800/60 rounded-xl px-3 py-2.5 mb-4">
              <p className="text-xs text-zinc-300 font-semibold line-clamp-2">{previewText}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-300 text-sm font-semibold hover:bg-white/5 cursor-pointer transition-colors whitespace-nowrap"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold cursor-pointer transition-colors whitespace-nowrap ${cfg.confirmBg} ${cfg.confirmHover}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
