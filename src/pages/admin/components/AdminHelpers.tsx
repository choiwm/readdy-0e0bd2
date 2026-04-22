export const GRADE_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  general:   { label: '일반',   color: 'text-slate-400',   bg: 'bg-slate-500/15',   icon: 'ri-user-line' },
  staff:     { label: '운영진', color: 'text-violet-400',  bg: 'bg-violet-500/15',  icon: 'ri-shield-star-line' },
  b2b:       { label: 'B2B',    color: 'text-amber-400',   bg: 'bg-amber-500/15',   icon: 'ri-building-2-line' },
  group:     { label: '단체',   color: 'text-emerald-400', bg: 'bg-emerald-500/15', icon: 'ri-group-line' },
  vip:       { label: 'VIP',    color: 'text-orange-400',  bg: 'bg-orange-500/15',  icon: 'ri-vip-crown-line' },
  suspended: { label: '정지',   color: 'text-red-400',     bg: 'bg-red-500/15',     icon: 'ri-forbid-line' },
};

export function GradeBadge({ grade }: { grade: string }) {
  const meta = GRADE_META[grade] ?? GRADE_META.general;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color} whitespace-nowrap`}>
      <i className={`${meta.icon} text-[10px]`} />
      {meta.label}
    </span>
  );
}

export const subscriptionPlans = [
  { name: 'Free', price: '₩0', credits: 100, features: ['워터마크 포함', '기본 해상도', '월 100 크레딧'], color: 'border-zinc-600' },
  { name: 'Pro', price: '₩29,000', credits: 5000, features: ['워터마크 없음', 'HD 해상도', '월 5,000 크레딧', '우선 처리'], color: 'border-indigo-500' },
  { name: 'Enterprise', price: '₩99,000', credits: 50000, features: ['워터마크 없음', '4K 해상도', '월 50,000 크레딧', '전담 지원', 'API 직접 연동'], color: 'border-amber-500' },
];

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: { label: string; icon: string; onClick: () => void };
  isDark?: boolean;
}

export function SectionHeader({ title, subtitle, action, isDark = true }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div>
        <h2 className={`text-sm font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h2>
        {subtitle && <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>{subtitle}</p>}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className={`flex items-center gap-1.5 text-xs cursor-pointer transition-colors whitespace-nowrap ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800'}`}
        >
          <i className={`${action.icon} text-xs`} />
          {action.label}
        </button>
      )}
    </div>
  );
}
