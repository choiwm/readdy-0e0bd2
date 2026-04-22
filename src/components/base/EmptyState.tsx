import { ReactNode } from 'react';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: string;
  variant?: 'primary' | 'ghost';
}

interface EmptyStateProps {
  /** Remix Icon class name, e.g. "ri-image-line" */
  icon?: string;
  /** Custom icon node (overrides icon prop) */
  iconNode?: ReactNode;
  title: string;
  description?: string;
  actions?: EmptyStateAction[];
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Icon background color theme */
  theme?: 'default' | 'indigo' | 'emerald' | 'amber' | 'rose';
  className?: string;
}

const THEME_MAP = {
  default: {
    iconBg: 'bg-zinc-900 border-white/5',
    iconColor: 'text-zinc-600',
  },
  indigo: {
    iconBg: 'bg-indigo-500/10 border-indigo-500/20',
    iconColor: 'text-indigo-400',
  },
  emerald: {
    iconBg: 'bg-emerald-500/10 border-emerald-500/20',
    iconColor: 'text-emerald-400',
  },
  amber: {
    iconBg: 'bg-amber-500/10 border-amber-500/20',
    iconColor: 'text-amber-400',
  },
  rose: {
    iconBg: 'bg-rose-500/10 border-rose-500/20',
    iconColor: 'text-rose-400',
  },
};

const SIZE_MAP = {
  sm: {
    wrapper: 'py-10 gap-3',
    iconBox: 'w-10 h-10 rounded-xl',
    iconText: 'text-lg',
    title: 'text-xs font-bold text-zinc-400',
    desc: 'text-[10px] text-zinc-600',
    btnPrimary: 'px-3 py-1.5 text-xs rounded-lg',
    btnGhost: 'text-xs',
  },
  md: {
    wrapper: 'py-14 gap-4',
    iconBox: 'w-14 h-14 rounded-2xl',
    iconText: 'text-2xl',
    title: 'text-sm font-bold text-zinc-400',
    desc: 'text-xs text-zinc-600',
    btnPrimary: 'px-4 py-2 text-xs rounded-xl',
    btnGhost: 'text-xs',
  },
  lg: {
    wrapper: 'py-20 gap-5',
    iconBox: 'w-20 h-20 rounded-3xl',
    iconText: 'text-4xl',
    title: 'text-base font-bold text-zinc-300',
    desc: 'text-sm text-zinc-500',
    btnPrimary: 'px-5 py-2.5 text-sm rounded-xl',
    btnGhost: 'text-sm',
  },
};

export default function EmptyState({
  icon,
  iconNode,
  title,
  description,
  actions = [],
  size = 'md',
  theme = 'default',
  className = '',
}: EmptyStateProps) {
  const s = SIZE_MAP[size];
  const t = THEME_MAP[theme];

  return (
    <div className={`flex flex-col items-center justify-center text-center ${s.wrapper} ${className}`}>
      {/* Icon */}
      <div className={`${s.iconBox} border flex items-center justify-center flex-shrink-0 ${t.iconBg}`}>
        {iconNode ?? (
          icon ? <i className={`${icon} ${s.iconText} ${t.iconColor}`} /> : null
        )}
      </div>

      {/* Text */}
      <div className="flex flex-col items-center gap-1.5">
        <p className={s.title}>{title}</p>
        {description && <p className={s.desc}>{description}</p>}
      </div>

      {/* Actions */}
      {actions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {actions.map((action, idx) => (
            action.variant === 'ghost' ? (
              <button
                key={idx}
                onClick={action.onClick}
                className={`${s.btnGhost} text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors flex items-center gap-1 whitespace-nowrap`}
              >
                {action.icon && <i className={`${action.icon}`} />}
                {action.label}
              </button>
            ) : (
              <button
                key={idx}
                onClick={action.onClick}
                className={`${s.btnPrimary} bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/25 text-indigo-400 font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap`}
              >
                {action.icon && <i className={`${action.icon}`} />}
                {action.label}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  );
}
