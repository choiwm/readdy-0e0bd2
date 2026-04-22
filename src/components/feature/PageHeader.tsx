/**
 * PageHeader — 모든 페이지/패널 헤더에 사용하는 공통 컴포넌트
 *
 * 사용 예:
 *   <PageHeader icon="ri-sparkling-2-line" title="AI Create" subtitle="Image Generation" />
 *   <PageHeader title="카메라 앵글" badge="생성용" badgeColor="amber" />
 *   <PageHeader title="내 갤러리" statusLabel="총 24개" />
 *
 * subtitle    → 장식/설명용 부제목 (text-[10px] text-zinc-500)
 * statusLabel → 상태/카운트 정보 (text-[10px] text-zinc-300 font-medium)
 */

import { ReactNode } from 'react';

type BadgeColor = 'indigo' | 'amber' | 'orange' | 'violet' | 'emerald' | 'zinc';

interface PageHeaderProps {
  /** Remix Icon class — shown as a small icon box on the left */
  icon?: string;
  /** Main title */
  title: string;
  /** Decorative subtitle — muted, small (text-[10px] text-zinc-500) */
  subtitle?: string;
  /** Status / count info — slightly brighter (text-[10px] text-zinc-300 font-medium) */
  statusLabel?: string | ReactNode;
  /** Optional badge text next to title */
  badge?: string;
  badgeColor?: BadgeColor;
  /** Extra content on the right side */
  actions?: ReactNode;
  /** Applied status badge (e.g. "앵글 적용 중") */
  appliedLabel?: string;
  appliedColor?: BadgeColor;
  /** Extra className for the wrapper */
  className?: string;
  /** Compact mode — less padding, used inside narrow sidebars */
  compact?: boolean;
}

const BADGE_STYLES: Record<BadgeColor, string> = {
  indigo:  'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  amber:   'bg-amber-500/20  text-amber-400  border-amber-500/30',
  orange:  'bg-orange-500/20 text-orange-400 border-orange-500/30',
  violet:  'bg-violet-500/20 text-violet-400 border-violet-500/30',
  emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  zinc:    'bg-zinc-800/60 text-zinc-400 border-white/5',
};


export default function PageHeader({
  icon,
  title,
  subtitle,
  statusLabel,
  badge,
  badgeColor = 'indigo',
  actions,
  appliedLabel,
  appliedColor = 'amber',
  className = '',
  compact = false,
}: PageHeaderProps) {
  const pad = compact ? 'px-3 py-2' : 'px-4 py-3';
  const height = compact ? '' : 'min-h-[56px]';

  return (
    <div className={`${pad} ${height} border-b border-white/5 flex-shrink-0 bg-zinc-950/30 flex flex-col justify-center ${className}`}>
      <div className="flex items-center justify-between gap-2">
        {/* Left: icon + title + badge + subtitle/statusLabel */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="min-w-0">
            {/* Title row */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-bold text-sm text-white leading-tight truncate">{title}</h3>
              {badge && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border leading-none whitespace-nowrap ${BADGE_STYLES[badgeColor]}`}>
                  {badge}
                </span>
              )}
            </div>

            {/* Subtitle / StatusLabel row */}
            {subtitle && (
              <span className="text-[11px] text-zinc-400 font-medium leading-tight block mt-0.5 truncate tracking-wide">
                {subtitle}
              </span>
            )}

          </div>
        </div>

        {/* Right: actions */}
        {actions && (
          <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
            {actions}
          </div>
        )}
      </div>

      {/* Applied status row */}
      {appliedLabel && (
        <div className={`mt-2 flex items-center gap-1.5 px-2 py-1 rounded-md border ${BADGE_STYLES[appliedColor]}`}>
          <i className="ri-check-line text-[10px]" />
          <span className="text-[10px] font-bold">{appliedLabel}</span>
        </div>
      )}
    </div>
  );
}
