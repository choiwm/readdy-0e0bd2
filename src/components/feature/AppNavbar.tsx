import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import AuthModal from '@/components/feature/AuthModal';
import NotificationDropdown from '@/components/feature/NotificationDropdown';

const navItems = [
  { label: 'AI Create', to: '/ai-create', icon: 'ri-sparkling-2-line' },
  { label: 'AI Automation', to: '/automation-studio', icon: 'ri-magic-line' },
  { label: 'AI Sound', to: '/ai-sound', icon: 'ri-equalizer-line' },
  { label: 'AI Ad', to: '/ai-ad', icon: 'ri-advertisement-line' },
  { label: 'AI Shortcuts', to: '/ai-services', icon: 'ri-flashlight-line' },
];

interface AppNavbarProps {
  active?: string;
  hideBottomNav?: boolean;
}

export default function AppNavbar({ active, hideBottomNav = false }: AppNavbarProps) {
  const { pathname } = useLocation();
  const { isLoggedIn, user, profile, signOut, loading } = useAuth();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const isActive = (item: typeof navItems[0]) => {
    if (active) return active === item.label;
    return pathname === item.to || pathname.startsWith(item.to + '/');
  };

  useEffect(() => {
    setUserMenuOpen(false);
    setNotifOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    if (userMenuOpen || notifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen, notifOpen]);

  const openLogin = () => { setAuthMode('login'); setAuthModalOpen(true); };
  const openSignup = () => { setAuthMode('signup'); setAuthModalOpen(true); };

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    await signOut();
  };

  const avatarLetter =
    profile?.display_name?.[0]?.toUpperCase() ||
    profile?.email?.[0]?.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    'U';

  const planBadge =
    profile?.plan === 'pro' ? 'PRO' :
    profile?.plan === 'enterprise' ? 'ENT' : null;

  // ─── 로그인 여부: user 객체 기준 (profile 로딩 기다리지 않음) ───────────
  // loading 중에도 user가 있으면 로그인 상태로 처리
  const loggedIn = !!user;

  // ─── 우측 Auth 영역 ────────────────────────────────────────────────────────
  const renderAuthArea = () => {
    // 초기 로딩 중 (user 정보도 없음) → 스켈레톤
    if (loading && !user) {
      return (
        <div className="flex items-center gap-1.5">
          <div className="h-7 w-20 rounded-full bg-zinc-800 animate-pulse" />
          <div className="h-7 w-16 rounded-full bg-zinc-800 animate-pulse" />
        </div>
      );
    }

    if (loggedIn) {
      // 로그인 상태 — 유저 아바타 드롭다운
      return (
        <div ref={userMenuRef} className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            aria-label="사용자 메뉴"
            aria-expanded={userMenuOpen}
            className="h-8 flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 hover:border-zinc-500 rounded-full pl-1.5 pr-2.5 transition-colors cursor-pointer"
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
              {avatarLetter}
            </div>
            <span className="text-[11px] font-semibold text-zinc-200 max-w-[64px] truncate">
              {profile?.display_name || profile?.email || user?.email?.split('@')[0] || '사용자'}
            </span>
            {planBadge && (
              <span className="text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1 py-0.5 rounded-full">
                {planBadge}
              </span>
            )}
            <i className={`ri-arrow-down-s-line text-zinc-500 text-xs transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* 드롭다운 */}
          <div className={`absolute right-0 top-full mt-2 w-56 bg-[#1a1a1e] border border-zinc-700/60 rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 origin-top-right z-[100] ${
            userMenuOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
          }`}>
            <div className="px-4 py-3.5 border-b border-zinc-800/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {avatarLetter}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">
                    {profile?.display_name || '사용자'}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">
                    {profile?.email || user?.email}
                  </p>
                </div>
              </div>
              {profile && (
                <div className="mt-2.5 flex items-center justify-between bg-zinc-900/60 rounded-xl px-3 py-2">
                  <span className="text-xs text-zinc-500">보유 크레딧</span>
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                    <i className="ri-copper-diamond-line" />
                    {profile.credit_balance.toLocaleString()} CR
                  </span>
                </div>
              )}
            </div>
            <div className="py-1.5">
              <Link to="/credit-purchase" onClick={() => setUserMenuOpen(false)}>
                <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800/60 hover:text-white transition-all cursor-pointer">
                  <i className="ri-copper-diamond-line text-amber-400 text-base w-4 h-4 flex items-center justify-center" />
                  크레딧 충전
                </button>
              </Link>
              <Link to="/customer-support" onClick={() => setUserMenuOpen(false)}>
                <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800/60 hover:text-white transition-all cursor-pointer">
                  <i className="ri-customer-service-2-line text-zinc-400 text-base w-4 h-4 flex items-center justify-center" />
                  고객 지원
                </button>
              </Link>
            </div>
            <div className="border-t border-zinc-800/60 py-1.5">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all cursor-pointer"
              >
                <i className="ri-logout-box-r-line text-base w-4 h-4 flex items-center justify-center" />
                로그아웃
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 비로그인 — 로그인 + 회원가입 버튼 (항상 보임, 고대비)
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={openLogin}
          className="h-8 flex items-center gap-1 bg-zinc-600 border border-zinc-500 hover:bg-zinc-500 hover:border-zinc-400 text-white text-[11px] font-bold px-3 rounded-full transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-user-line text-xs" />
          로그인
        </button>
        <button
          onClick={openSignup}
          className="h-8 flex items-center gap-1 bg-white text-zinc-900 text-[11px] font-extrabold px-3 rounded-full hover:bg-zinc-100 transition-colors cursor-pointer whitespace-nowrap shadow-md"
        >
          회원가입
        </button>
      </div>
    );
  };

  // ─── 크레딧 버튼 ──────────────────────────────────────────────────────────
  const renderCreditBtn = () => {
    if (loading && !user) {
      return (
        <div className="h-8 w-24 rounded-full bg-amber-500/10 border border-amber-500/20 animate-pulse" />
      );
    }
    return (
      <Link to="/credit-purchase">
        <button className="h-8 flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500/25 hover:border-amber-400/60 text-amber-400 text-xs font-bold px-3 rounded-full transition-all cursor-pointer whitespace-nowrap">
          <i className="ri-copper-diamond-line text-sm" />
          {loggedIn && profile ? (
            <span>{profile.credit_balance.toLocaleString()} CR</span>
          ) : (
            <span>크레딧 충전</span>
          )}
        </button>
      </Link>
    );
  };

  return (
    <>
      {/* ─── Top Nav ─── */}
      <nav className="h-12 bg-[#111113] border-b border-zinc-800/60 flex-shrink-0 z-50 relative">
        {/*
          3분할 레이아웃:
          - 좌: 로고 (고정 너비 w-[160px])
          - 중: 네비 탭 (flex-1, 중앙 정렬)
          - 우: 버튼들 (고정 너비 w-[280px], 오른쪽 정렬)
          → 우측 버튼이 절대 밀려나지 않음
        */}
        <div className="h-full flex items-center px-4">

          {/* 좌: 로고 */}
          <div className="w-[160px] flex-shrink-0 flex items-center">
            <Link to="/" className="flex items-center">
              <img
                src="https://static.readdy.ai/image/818485967d328b35909ddcc1d73f5659/99fa675bf72ff13d36de270333b480ff.png"
                alt="AiMetaWOW"
                className="h-7"
              />
            </Link>
          </div>

          {/* 중: 네비 탭 (flex-1) */}
          <div className="flex-1 flex justify-center items-center min-w-0">
            {/* Desktop: 텍스트 + 아이콘 */}
            <div className="hidden lg:flex items-center gap-0.5 bg-zinc-900/60 border border-zinc-800/80 p-1 rounded-xl">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                    isActive(item)
                      ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30'
                      : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                >
                  <i className={`${item.icon} text-sm flex-shrink-0 ${isActive(item) ? 'text-indigo-400' : ''}`} />
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Tablet: 아이콘만 */}
            <div className="hidden md:flex lg:hidden items-center gap-0.5 bg-zinc-900/60 border border-zinc-800/80 p-1 rounded-xl">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  title={item.label}
                  className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                    isActive(item)
                      ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30'
                      : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                >
                  <i className={`${item.icon} text-base`} />
                </Link>
              ))}
            </div>
          </div>

          {/* 우: 버튼 영역 (고정 너비, 절대 밀려나지 않음) */}
          <div className="w-[280px] flex-shrink-0 hidden md:flex items-center justify-end gap-2">

            {/* 크레딧 버튼 */}
            {renderCreditBtn()}

            {/* 알림 벨 — 로그인 시만 */}
            {loggedIn && (
              <div ref={notifRef} className="relative flex-shrink-0">
                <button
                  onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); }}
                  aria-label={`알림 ${unreadCount > 0 ? `(읽지 않음 ${unreadCount}개)` : ''}`}
                  aria-expanded={notifOpen}
                  className={`relative w-8 h-8 flex items-center justify-center rounded-xl transition-all cursor-pointer ${
                    notifOpen ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  <i className={`text-base ${notifOpen ? 'ri-notification-3-fill' : 'ri-notification-3-line'}`} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5 leading-none">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                <div className={`absolute right-0 top-full mt-2 shadow-2xl transition-all duration-200 origin-top-right z-[100] ${
                  notifOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
                }`}>
                  <NotificationDropdown
                    notifications={notifications}
                    unreadCount={unreadCount}
                    onMarkRead={markRead}
                    onMarkAllRead={markAllRead}
                    onClose={() => setNotifOpen(false)}
                  />
                </div>
              </div>
            )}

            {/* Auth 영역 */}
            {renderAuthArea()}
          </div>

          {/* Mobile 우측 */}
          <div className="flex md:hidden items-center gap-1.5 ml-auto">
            <Link to="/credit-purchase">
              <button className="flex items-center gap-1 bg-zinc-900 border border-zinc-700 text-amber-400 text-xs font-bold px-2.5 py-1.5 rounded-lg cursor-pointer whitespace-nowrap">
                <i className="ri-copper-diamond-line text-sm" />
                {loggedIn && profile ? (
                  <span>{profile.credit_balance.toLocaleString()}</span>
                ) : (
                  <span>CR</span>
                )}
              </button>
            </Link>
            {loggedIn ? (
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-label="사용자 메뉴"
                aria-expanded={userMenuOpen}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold cursor-pointer"
              >
                {avatarLetter}
              </button>
            ) : (
              <button
                onClick={openLogin}
                className="bg-zinc-700 border border-zinc-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-zinc-600 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1"
              >
                <i className="ri-login-box-line text-sm" />
                <span>로그인</span>
              </button>
            )}
          </div>

        </div>
      </nav>

      {/* ─── Mobile Bottom Tab Bar ─── */}
      {!hideBottomNav && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#111113] border-t border-zinc-800/60">
          <div className="flex items-stretch h-16">
            {navItems.slice(0, 4).map((item) => {
              const activeItem = isActive(item);
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-all cursor-pointer relative"
                >
                  {activeItem && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-400 rounded-full" />
                  )}
                  <div className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${activeItem ? 'bg-indigo-500/20' : ''}`}>
                    <i className={`${item.icon} text-lg ${activeItem ? 'text-indigo-400' : 'text-zinc-500'}`} />
                  </div>
                  <span className={`text-[10px] font-semibold leading-none truncate max-w-[56px] text-center ${activeItem ? 'text-indigo-300' : 'text-zinc-500'}`}>
                    {item.label.replace('AI ', '')}
                  </span>
                </Link>
              );
            })}
            <Link
              to="/ai-services"
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 cursor-pointer"
            >
              <div className={`w-7 h-7 flex items-center justify-center rounded-lg ${isActive(navItems[4]) ? 'bg-indigo-500/20' : ''}`}>
                <i className={`ri-flashlight-line text-lg ${isActive(navItems[4]) ? 'text-indigo-400' : 'text-zinc-500'}`} />
              </div>
              <span className={`text-[10px] font-semibold ${isActive(navItems[4]) ? 'text-indigo-300' : 'text-zinc-500'}`}>
                Shortcuts
              </span>
            </Link>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultMode={authMode}
      />
    </>
  );
}
