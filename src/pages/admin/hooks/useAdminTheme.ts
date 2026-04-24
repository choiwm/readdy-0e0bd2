export interface AdminTheme {
  bg: string;
  headerBg: string;
  sidebarBg: string;
  cardBg: string;
  cardBg2: string;
  border: string;
  border2: string;
  text: string;
  textSub: string;
  textMuted: string;
  textFaint: string;
  inputBg: string;
  inputBg2: string;
  rowHover: string;
  divider: string;
  navActive: string;
  navInactive: string;
  tableHead: string;
  btnSecondary: string;
  toggleBg: string;
  statusBg: string;
}

export function useAdminTheme(isDark: boolean): AdminTheme {
  return {
    bg:          isDark ? 'bg-[#09090c]'    : 'bg-slate-50',
    headerBg:    isDark ? 'bg-[#0d0d10]'    : 'bg-white',
    sidebarBg:   isDark ? 'bg-[#0d0d10]'    : 'bg-white',
    cardBg:      isDark ? 'bg-[#0f0f13]'    : 'bg-white',
    cardBg2:     isDark ? 'bg-zinc-900/60'   : 'bg-slate-50',
    border:      isDark ? 'border-white/5'   : 'border-slate-200',
    border2:     isDark ? 'border-white/10'  : 'border-slate-300',
    text:        isDark ? 'text-white'       : 'text-slate-900',
    textSub:     isDark ? 'text-zinc-300'    : 'text-slate-700',
    textMuted:   isDark ? 'text-zinc-400'    : 'text-slate-600',
    textFaint:   isDark ? 'text-zinc-500'    : 'text-slate-500',
    inputBg:     isDark ? 'bg-zinc-900'      : 'bg-white',
    inputBg2:    isDark ? 'bg-zinc-800'      : 'bg-slate-100',
    rowHover:    isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50',
    divider:     isDark ? 'divide-white/[0.03]'   : 'divide-slate-100',
    navActive:   isDark ? 'bg-indigo-500/15 border-indigo-500/25 text-white' : 'bg-indigo-50 border-indigo-300 text-indigo-800',
    navInactive: isDark ? 'border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-white/5' : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100',
    tableHead:   isDark ? 'text-zinc-400'    : 'text-slate-500',
    btnSecondary: isDark ? 'bg-zinc-800 border border-white/10 hover:border-white/20 text-zinc-200' : 'bg-white border border-slate-300 hover:border-slate-400 text-slate-700',
    toggleBg:    isDark ? 'bg-zinc-700'      : 'bg-slate-200',
    statusBg:    isDark ? 'bg-zinc-800/60 border border-white/5' : 'bg-slate-100 border border-slate-200',
  };
}
