import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import AuthModal from '@/components/feature/AuthModal';

const navLinks = [
  { label: 'AI Create', to: '/ai-create' },
  { label: 'AI Automation', to: '/automation-studio' },
  { label: 'AI Sound', to: '/ai-sound' },
  { label: 'AI Ad', to: '/ai-ad' },
  { label: 'AI Shortcuts', to: '/ai-services' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const { isLoggedIn: _isLoggedIn, user, profile, signOut, loading } = useAuth();
  const { credits } = useCredits();
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  const openLogin = () => { setAuthMode('login'); setAuthModalOpen(true); setMobileOpen(false); };
  const openSignup = () => { setAuthMode('signup'); setAuthModalOpen(true); setMobileOpen(false); };

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    await signOut();
  };

  const avatarLetter =
    profile?.display_name?.[0]?.toUpperCase() ||
    profile?.email?.[0]?.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    'U';

  // user 객체 기준으로 로그인 판단 (profile 로딩 기다리지 않음)
  const loggedIn = !!user;

  return (
    <>
      <div className="fixed left-0 right-0 z-50 flex flex-col items-center">
        <nav
          className={`overflow-visible w-full h-14 border-b px-4 transition-all duration-300 flex items-center ${
            scrolled
              ? 'bg-zinc-950/98 border-zinc-800/60 backdrop-blur-xl'
              : 'bg-zinc-950/70 border-white/5 backdrop-blur-md'
          }`}
        >
          <div className="flex items-center w-full justify-center relative">
            {/* Logo */}
            <Link className="absolute left-0 flex-shrink-0 flex items-center cursor-pointer group" to="/">
              <img
                src="https://static.readdy.ai/image/818485967d328b35909ddcc1d73f5659/99fa675bf72ff13d36de270333b480ff.png"
                alt="AiMetaWOW"
                className="transition-all duration-300 group-hover:scale-105 h-7"
              />
            </Link>

            {/* Desktop Center Nav Links */}
            <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-0.5 bg-zinc-900/60 border border-zinc-800/80 p-1 rounded-xl">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors whitespace-nowrap"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Right Actions */}
            <div className="absolute right-0 hidden md:flex items-center gap-2">

              {/* 크레딧 버튼 — user 없는 초기 로딩 중만 스켈레톤 */}
              {loading && !user ? (
                <div className="h-8 w-24 rounded-full bg-amber-500/10 border border-amber-500/20 animate-pulse" />
              ) : (
                <Link to="/credit-purchase">
                  <button className="h-8 flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/50 hover:bg-amber-500/25 hover:border-amber-400/70 text-amber-400 text-xs font-bold px-3 rounded-full transition-all cursor-pointer whitespace-nowrap">
                    <i className="ri-copper-diamond-line text-sm" />
                    {loggedIn && profile ? (
                      <span>{credits.toLocaleString()} CR</span>
                    ) : (
                      <span>크레딧 충전</span>
                    )}
                  </button>
                </Link>
              )}

              {/* Auth 영역 — user 기준으로 즉시 판단 */}
              <div className="flex items-center gap-1.5">
                {loading && !user ? (
                  <div className="flex items-center gap-1.5">
                    <div className="h-8 w-16 rounded-full bg-zinc-700/60 animate-pulse" />
                    <div className="h-8 w-20 rounded-full bg-zinc-700/40 animate-pulse" />
                  </div>
                ) : loggedIn ? (
                  /* 로그인 상태 — 유저 아바타 드롭다운 */
                  <div ref={userMenuRef} className="relative">
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="h-7 flex items-center gap-1.5 bg-zinc-800/80 border border-zinc-700/60 hover:border-zinc-500/80 rounded-full pl-1 pr-2 transition-colors cursor-pointer"
                    >
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                        {avatarLetter}
                      </div>
                      <span className="text-[11px] font-semibold text-zinc-300 max-w-[60px] truncate">
                        {profile?.display_name || profile?.email || user?.email?.split('@')[0] || '사용자'}
                      </span>
                      <i className={`ri-arrow-down-s-line text-zinc-500 text-xs transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* 드롭다운 */}
                    <div className={`absolute right-0 top-full mt-2 w-56 bg-[#1a1a1e] border border-zinc-700/60 rounded-2xl overflow-hidden transition-all duration-200 origin-top-right z-50 ${
                      userMenuOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
                    }`}>
                      <div className="px-4 py-3.5 border-b border-zinc-800/60">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            {avatarLetter}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-white truncate">{profile?.display_name || user?.email?.split('@')[0] || '사용자'}</p>
                            <p className="text-xs text-zinc-500 truncate">{profile?.email || user?.email}</p>
                          </div>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between bg-zinc-900/60 rounded-xl px-3 py-2">
                          <span className="text-xs text-zinc-500">보유 크레딧</span>
                          <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                            <i className="ri-copper-diamond-line" />
                            {credits.toLocaleString()} CR
                          </span>
                        </div>
                      </div>
                      <div className="py-1.5">
                        <Link to="/credit-purchase" onClick={() => setUserMenuOpen(false)}>
                          <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800/60 hover:text-white transition-all cursor-pointer">
                            <i className="ri-copper-diamond-line text-amber-400 text-base" />
                            크레딧 충전
                          </button>
                        </Link>
                        <Link to="/customer-support" onClick={() => setUserMenuOpen(false)}>
                          <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800/60 hover:text-white transition-all cursor-pointer">
                            <i className="ri-customer-service-2-line text-zinc-400 text-base" />
                            고객 지원
                          </button>
                        </Link>
                      </div>
                      <div className="border-t border-zinc-800/60 py-1.5">
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all cursor-pointer"
                        >
                          <i className="ri-logout-box-r-line text-base" />
                          로그아웃
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 비로그인 상태 — 로그인 + 회원가입 버튼 */
                  <div className="flex items-center gap-2">
                    <button
                      onClick={openLogin}
                      className="h-8 flex items-center gap-1.5 bg-zinc-100/15 border border-zinc-100/40 hover:bg-zinc-100/25 hover:border-zinc-100/60 text-white text-xs font-bold px-4 rounded-full transition-all cursor-pointer whitespace-nowrap backdrop-blur-sm"
                    >
                      <i className="ri-user-line text-xs" />
                      로그인
                    </button>
                    <button
                      onClick={openSignup}
                      className="h-8 flex items-center gap-1.5 bg-white text-zinc-900 text-xs font-extrabold px-4 rounded-full hover:bg-zinc-100 transition-colors cursor-pointer whitespace-nowrap shadow-lg shadow-white/10"
                    >
                      회원가입
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Actions */}
            <div className="absolute right-0 md:hidden flex items-center gap-1.5">
              <Link to="/credit-purchase">
                <button className="flex items-center gap-1 bg-zinc-900/80 border border-white/10 text-amber-400 text-xs font-bold px-2.5 py-2 rounded-full cursor-pointer whitespace-nowrap hover:border-amber-500/30 transition-colors">
                  <i className="ri-copper-diamond-line text-sm" />
                  {loggedIn && profile ? (
                    <span>{(profile.credit_balance ?? 0).toLocaleString()}</span>
                  ) : (
                    <span className="hidden xs:inline">CR</span>
                  )}
                </button>
              </Link>
              <button
                className="w-9 h-9 flex items-center justify-center text-gray-300 hover:text-white hover:bg-gray-800 rounded-full transition-colors cursor-pointer"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                <i className={mobileOpen ? 'ri-close-line text-xl' : 'ri-menu-line text-xl'} />
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileOpen && (
            <div className="md:hidden mt-3 flex flex-col gap-1 bg-zinc-900/95 rounded-2xl p-2 border border-white/5">
              <div className="grid grid-cols-2 gap-1 mb-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.label}
                    to={link.to}
                    onClick={() => setMobileOpen(false)}
                    className="px-3 py-2.5 text-sm font-bold text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all truncate"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
              <div className="border-t border-white/5 pt-1 flex items-center gap-1">
                {loggedIn ? (
                  <button
                    onClick={handleSignOut}
                    className="flex-1 inline-flex items-center justify-center whitespace-nowrap h-10 px-4 rounded-xl font-bold text-sm bg-red-500/10 text-red-400 cursor-pointer gap-1.5"
                  >
                    <i className="ri-logout-box-r-line" />
                    로그아웃
                  </button>
                ) : (
                  <button
                    onClick={openLogin}
                    className="flex-1 inline-flex items-center justify-center whitespace-nowrap h-10 px-4 rounded-xl font-bold text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-colors cursor-pointer"
                  >
                    로그인
                  </button>
                )}
              </div>
            </div>
          )}
        </nav>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultMode={authMode}
      />
    </>
  );
}
