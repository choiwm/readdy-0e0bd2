export type AdminTabType =
  | 'overview'
  | 'users'
  | 'coin-grant'
  | 'content'
  | 'ai-engine'
  | 'billing'
  | 'cs'
  | 'cs-notice'
  | 'audit'
  | 'sys-settings'
  | 'security'
  | 'grade-settings'
  | 'admin-roster';

export interface NavItem {
  id: AdminTabType;
  label: string;
  icon: string;
  badge?: string;
}

export interface ApiHealthSnapshot {
  total_requests_1h?: number;
  image?: { error_rate: number };
  video?: { error_rate: number };
}

interface Theme {
  sidebarBg: string;
  cardBg2: string;
  border: string;
  text: string;
  textFaint: string;
  navActive: string;
  navInactive: string;
}

interface AdminSidebarProps {
  isDark: boolean;
  t: Theme;

  sidebarOpen: boolean;
  setSidebarOpen: (updater: (v: boolean) => boolean | boolean) => void;
  onCloseSidebar: () => void;

  activeTab: AdminTabType;
  setActiveTab: (t: AdminTabType) => void;

  navItems: NavItem[];
  systemNavItems: NavItem[];

  apiHealthData: ApiHealthSnapshot | null;
  onSignOut: () => void | Promise<void>;
}

function ServerLoadWidget({ apiHealthData, isDark, t }: { apiHealthData: ApiHealthSnapshot | null; isDark: boolean; t: Theme }) {
  const totalReq1h = apiHealthData?.total_requests_1h ?? 0;
  const maxReq = 1000;
  const cpuPct = apiHealthData
    ? Math.min(95, Math.round((totalReq1h / maxReq) * 100) + 20)
    : 42;
  const imgErrRate = apiHealthData?.image?.error_rate ?? 0;
  const vidErrRate = apiHealthData?.video?.error_rate ?? 0;
  const gpuPct = apiHealthData
    ? Math.min(95, Math.round(((imgErrRate + vidErrRate) / 2) * 5 + 40))
    : 71;
  const memPct = apiHealthData
    ? Math.min(90, Math.round(cpuPct * 0.8 + 10))
    : 58;

  const warn = imgErrRate > 5 || vidErrRate > 5;

  const bars = [
    { label: 'CPU', pct: cpuPct, color: cpuPct > 80 ? 'bg-red-500' : cpuPct > 60 ? 'bg-amber-500' : 'bg-emerald-500' },
    { label: 'MEM', pct: memPct, color: memPct > 80 ? 'bg-red-500' : memPct > 60 ? 'bg-amber-500' : 'bg-amber-500' },
    { label: 'GPU', pct: gpuPct, color: gpuPct > 80 ? 'bg-red-500' : gpuPct > 60 ? 'bg-amber-500' : 'bg-indigo-500' },
  ];

  return (
    <div className={`${t.cardBg2} rounded-xl p-3`}>
      <div className="flex items-center justify-between mb-2">
        <p className={`text-[10px] font-semibold ${t.textFaint}`}>서버 부하</p>
        <span className={`text-[10px] font-bold ${warn ? 'text-amber-400' : 'text-emerald-400'}`}>
          {warn ? '주의' : '정상'}
        </span>
      </div>
      <div className="space-y-1.5">
        {bars.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className={`text-[9px] ${t.textFaint} w-6`}>{s.label}</span>
            <div className={`flex-1 h-1 ${isDark ? 'bg-zinc-800' : 'bg-slate-200'} rounded-full overflow-hidden`}>
              <div className={`h-full ${s.color} rounded-full transition-all`} style={{ width: `${s.pct}%` }} />
            </div>
            <span className={`text-[9px] ${t.textFaint} font-mono w-6 text-right`}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminSidebar({
  isDark, t,
  sidebarOpen, onCloseSidebar,
  activeTab, setActiveTab,
  navItems, systemNavItems,
  apiHealthData, onSignOut,
}: AdminSidebarProps) {
  const handleNavClick = (id: AdminTabType) => {
    setActiveTab(id);
    onCloseSidebar();
  };

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/60 md:hidden" onClick={onCloseSidebar} aria-hidden="true" />
      )}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-20 w-60 flex-shrink-0
          ${t.sidebarBg} border-r ${t.border} flex flex-col
          transition-transform duration-300 md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          top-14 md:top-0
        `}
        aria-label="관리자 네비게이션"
      >
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <p className={`text-[10px] font-black uppercase tracking-widest px-3 mb-3 ${isDark ? 'text-zinc-600' : 'text-slate-400'}`}>운영 메뉴</p>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              aria-current={activeTab === item.id ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer text-left border ${
                activeTab === item.id ? t.navActive : t.navInactive
              }`}
            >
              <div className={`w-5 h-5 flex items-center justify-center ${activeTab === item.id ? (isDark ? 'text-indigo-400' : 'text-indigo-600') : ''}`}>
                <i className={`${item.icon} text-sm`} />
              </div>
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  item.id === 'content' || item.id === 'cs'
                    ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700')
                    : (isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-100 text-slate-600')
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}

          <div className="pt-4">
            <p className={`text-[10px] font-black uppercase tracking-widest px-3 mb-3 ${isDark ? 'text-zinc-600' : 'text-slate-400'}`}>시스템</p>
            {systemNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                aria-current={activeTab === item.id ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer text-left border ${
                  activeTab === item.id ? t.navActive : t.navInactive
                }`}
              >
                <div className={`w-5 h-5 flex items-center justify-center ${activeTab === item.id ? 'text-indigo-400' : ''}`}>
                  <i className={`${item.icon} text-sm`} />
                </div>
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        <div className={`px-3 py-4 border-t ${t.border} space-y-2`}>
          <ServerLoadWidget apiHealthData={apiHealthData} isDark={isDark} t={t} />
          <div className="flex items-center gap-2 px-1">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-[9px] font-black">A</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-zinc-300">관리자A</p>
              <p className="text-[9px] text-zinc-600">Super Admin</p>
            </div>
            <button
              onClick={() => { void onSignOut(); }}
              className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer transition-colors"
              title="로그아웃"
              aria-label="로그아웃"
            >
              <i className="ri-logout-box-r-line text-xs" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
