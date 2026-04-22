export function StatusBadge({ status, isDark = true }: { status: string; isDark?: boolean }) {
  const map: Record<string, { label: string; dark: string; light: string }> = {
    active:      { label: '활성',   dark: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',  light: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
    inactive:    { label: '비활성', dark: 'bg-zinc-700/60 text-zinc-300 border-zinc-600/30',           light: 'bg-slate-100 text-slate-600 border-slate-300' },
    suspended:   { label: '정지',   dark: 'bg-red-500/15 text-red-400 border-red-500/25',              light: 'bg-red-50 text-red-700 border-red-300' },
    completed:   { label: '완료',   dark: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',  light: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
    processing:  { label: '처리중', dark: 'bg-amber-500/15 text-amber-400 border-amber-500/25',        light: 'bg-amber-50 text-amber-700 border-amber-300' },
    failed:      { label: '실패',   dark: 'bg-red-500/15 text-red-400 border-red-500/25',              light: 'bg-red-50 text-red-700 border-red-300' },
    approved:    { label: '승인',   dark: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',  light: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
    pending:     { label: '검토중', dark: 'bg-amber-500/15 text-amber-400 border-amber-500/25',        light: 'bg-amber-50 text-amber-700 border-amber-300' },
    blocked:     { label: '차단',   dark: 'bg-red-500/15 text-red-400 border-red-500/25',              light: 'bg-red-50 text-red-700 border-red-300' },
    open:        { label: '미처리', dark: 'bg-red-500/15 text-red-400 border-red-500/25',              light: 'bg-red-50 text-red-700 border-red-300' },
    in_progress: { label: '처리중', dark: 'bg-amber-500/15 text-amber-400 border-amber-500/25',        light: 'bg-amber-50 text-amber-700 border-amber-300' },
    closed:      { label: '완료',   dark: 'bg-zinc-700/60 text-zinc-300 border-zinc-600/30',           light: 'bg-slate-100 text-slate-600 border-slate-300' },
    published:   { label: '게시됨', dark: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',  light: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
    draft:       { label: '초안',   dark: 'bg-zinc-700/60 text-zinc-300 border-zinc-600/30',           light: 'bg-slate-100 text-slate-600 border-slate-300' },
    refunded:    { label: '환불',   dark: 'bg-violet-500/15 text-violet-400 border-violet-500/25',     light: 'bg-violet-50 text-violet-700 border-violet-300' },
    normal:      { label: '정상',   dark: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',  light: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
    warning:     { label: '경고',   dark: 'bg-amber-500/15 text-amber-400 border-amber-500/25',        light: 'bg-amber-50 text-amber-700 border-amber-300' },
    error:       { label: '오류',   dark: 'bg-red-500/15 text-red-400 border-red-500/25',              light: 'bg-red-50 text-red-700 border-red-300' },
  };
  const s = map[status] ?? { label: status, dark: 'bg-zinc-700 text-zinc-300 border-zinc-600', light: 'bg-slate-100 text-slate-600 border-slate-300' };
  const cls = isDark ? s.dark : s.light;
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls} whitespace-nowrap`}>
      {s.label}
    </span>
  );
}

export function PlanBadge({ plan, isDark = true }: { plan: string; isDark?: boolean }) {
  const map: Record<string, { dark: string; light: string }> = {
    Free:       { dark: 'bg-zinc-700/60 text-zinc-300',      light: 'bg-slate-100 text-slate-700' },
    Pro:        { dark: 'bg-indigo-500/20 text-indigo-300',   light: 'bg-indigo-50 text-indigo-700' },
    Enterprise: { dark: 'bg-amber-500/20 text-amber-300',     light: 'bg-amber-50 text-amber-700' },
  };
  const cls = (map[plan] ?? { dark: 'bg-zinc-700 text-zinc-300', light: 'bg-slate-100 text-slate-700' })[isDark ? 'dark' : 'light'];
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cls} whitespace-nowrap`}>
      {plan}
    </span>
  );
}

export function PriorityBadge({ priority, isDark = true }: { priority: string; isDark?: boolean }) {
  const map: Record<string, { label: string; dark: string; light: string }> = {
    high:   { label: '긴급', dark: 'bg-red-500/15 text-red-400',    light: 'bg-red-50 text-red-700' },
    medium: { label: '보통', dark: 'bg-amber-500/15 text-amber-400', light: 'bg-amber-50 text-amber-700' },
    low:    { label: '낮음', dark: 'bg-zinc-700/60 text-zinc-300',   light: 'bg-slate-100 text-slate-600' },
  };
  const s = map[priority] ?? { label: priority, dark: 'bg-zinc-700 text-zinc-300', light: 'bg-slate-100 text-slate-600' };
  const cls = isDark ? s.dark : s.light;
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cls} whitespace-nowrap`}>
      {s.label}
    </span>
  );
}
