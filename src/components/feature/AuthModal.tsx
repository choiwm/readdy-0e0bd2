import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';

type AuthMode = 'login' | 'signup' | 'forgot';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: AuthMode;
}

export default function AuthModal({ isOpen, onClose, defaultMode = 'login' }: AuthModalProps) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(defaultMode);
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setDisplayName('');
      setError('');
      setSuccess('');
      setAgreed(false);
      setShowPassword(false);
      setUnverifiedEmail('');
      setResendDone(false);
    }
  }, [isOpen, defaultMode]);

  useEffect(() => {
    setError('');
    setSuccess('');
  }, [mode]);

  const handleClose = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('이메일과 비밀번호를 입력해주세요.'); return; }
    setLoading(true);
    setError('');
    const { error: err } = await signIn(email, password);
    setLoading(false);
    if (err) {
      if (err.message.includes('Invalid login credentials')) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else if (err.message.includes('Email not confirmed')) {
        setUnverifiedEmail(email);
        setError('이메일 인증이 완료되지 않았습니다. 가입 시 발송된 인증 메일을 확인해주세요.');
      } else {
        setError(err.message);
      }
    } else {
      onClose();
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) { setError('닉네임을 입력해주세요.'); return; }
    if (!email) { setError('이메일을 입력해주세요.'); return; }
    if (password.length < 8) { setError('비밀번호는 8자 이상이어야 합니다.'); return; }
    if (password !== confirmPassword) { setError('비밀번호가 일치하지 않습니다.'); return; }
    if (!agreed) { setError('이용약관에 동의해주세요.'); return; }
    setLoading(true);
    setError('');
    const { error: err } = await signUp(email, password, displayName.trim());
    setLoading(false);
    if (err) {
      if (err.message.includes('already registered') || err.message.includes('User already registered')) {
        setError('이미 가입된 이메일입니다. 로그인해주세요.');
      } else {
        setError(err.message);
      }
    } else {
      setSuccess('가입 완료! 이메일 인증 링크를 확인해주세요. 인증 후 로그인이 가능합니다.');
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedEmail || resendLoading) return;
    setResendLoading(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      await supabase.auth.resend({ type: 'signup', email: unverifiedEmail });
      setResendDone(true);
      setError('');
      setSuccess('인증 메일을 재발송했습니다. 받은 편지함(스팸 폴더 포함)을 확인해주세요.');
    } catch {
      setError('재발송 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
    setResendLoading(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('이메일을 입력해주세요.'); return; }
    setLoading(true);
    setError('');
    const { supabase } = await import('@/lib/supabase');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSuccess('비밀번호 재설정 링크를 이메일로 발송했습니다.');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-md bg-[#111113] border border-zinc-800/80 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header gradient bar */}
        <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer z-10"
        >
          <i className="ri-close-line text-lg" />
        </button>

        <div className="p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img
              src="https://static.readdy.ai/image/818485967d328b35909ddcc1d73f5659/99fa675bf72ff13d36de270333b480ff.png"
              alt="AiMetaWOW"
              className="h-8"
            />
          </div>

          {/* Title */}
          <div className="text-center mb-6">
            {mode === 'login' && (
              <>
                <h2 className="text-xl font-bold text-white mb-1">다시 만나서 반가워요!</h2>
                <p className="text-zinc-500 text-sm">계정에 로그인하세요</p>
              </>
            )}
            {mode === 'signup' && (
              <>
                <h2 className="text-xl font-bold text-white mb-1">AI 크리에이터가 되어보세요</h2>
                <p className="text-zinc-500 text-sm">무료로 시작 · 200 크레딧 즉시 지급</p>
              </>
            )}
            {mode === 'forgot' && (
              <>
                <h2 className="text-xl font-bold text-white mb-1">비밀번호 재설정</h2>
                <p className="text-zinc-500 text-sm">가입한 이메일로 재설정 링크를 보내드려요</p>
              </>
            )}
          </div>

          {/* Error / Success */}
          {error && (
            <div className="mb-4 space-y-2">
              <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <i className="ri-error-warning-line text-red-400 text-sm mt-0.5 flex-shrink-0" />
                <p className="text-red-400 text-xs leading-relaxed">{error}</p>
              </div>
              {unverifiedEmail && !resendDone && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold rounded-xl hover:bg-amber-500/20 transition-all cursor-pointer"
                >
                  {resendLoading ? (
                    <><i className="ri-loader-4-line animate-spin" /> 발송 중...</>
                  ) : (
                    <><i className="ri-mail-send-line" /> 인증 메일 재발송</>
                  )}
                </button>
              )}
            </div>
          )}
          {success && (
            <div className="mb-4 flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
              <i className="ri-checkbox-circle-line text-emerald-400 text-sm mt-0.5 flex-shrink-0" />
              <p className="text-emerald-400 text-xs leading-relaxed">{success}</p>
            </div>
          )}

          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">이메일</label>
                <div className="relative">
                  <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full bg-zinc-900/80 border border-zinc-700/60 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:bg-zinc-900 transition-all"
                    autoComplete="email"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">비밀번호</label>
                <div className="relative">
                  <i className="ri-lock-line absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호 입력"
                    className="w-full bg-zinc-900/80 border border-zinc-700/60 rounded-xl pl-9 pr-10 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:bg-zinc-900 transition-all"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                  >
                    <i className={showPassword ? 'ri-eye-off-line text-sm' : 'ri-eye-line text-sm'} />
                  </button>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-xs text-zinc-500 hover:text-indigo-400 transition-colors cursor-pointer"
                >
                  비밀번호를 잊으셨나요?
                </button>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 hover:from-indigo-400 hover:via-violet-400 hover:to-purple-400 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <><i className="ri-loader-4-line animate-spin" /> 로그인 중...</>
                ) : (
                  <><i className="ri-login-box-line" /> 로그인</>
                )}
              </button>
            </form>
          )}

          {/* Signup Form */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">닉네임</label>
                <div className="relative">
                  <i className="ri-user-line absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="사용할 닉네임"
                    className="w-full bg-zinc-900/80 border border-zinc-700/60 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:bg-zinc-900 transition-all"
                    maxLength={30}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">이메일</label>
                <div className="relative">
                  <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full bg-zinc-900/80 border border-zinc-700/60 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:bg-zinc-900 transition-all"
                    autoComplete="email"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">비밀번호</label>
                <div className="relative">
                  <i className="ri-lock-line absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="8자 이상"
                    className="w-full bg-zinc-900/80 border border-zinc-700/60 rounded-xl pl-9 pr-10 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:bg-zinc-900 transition-all"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                  >
                    <i className={showPassword ? 'ri-eye-off-line text-sm' : 'ri-eye-line text-sm'} />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">비밀번호 확인</label>
                <div className="relative">
                  <i className="ri-lock-2-line absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="비밀번호 재입력"
                    className={`w-full bg-zinc-900/80 border rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-all ${
                      confirmPassword && password !== confirmPassword
                        ? 'border-red-500/50 focus:border-red-500/70'
                        : 'border-zinc-700/60 focus:border-indigo-500/60 focus:bg-zinc-900'
                    }`}
                    autoComplete="new-password"
                  />
                  {confirmPassword && (
                    <i className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm ${
                      password === confirmPassword ? 'ri-checkbox-circle-line text-emerald-400' : 'ri-close-circle-line text-red-400'
                    }`} />
                  )}
                </div>
              </div>
              {/* 이용약관 동의 */}
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <div
                  onClick={() => setAgreed(!agreed)}
                  className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded border transition-all cursor-pointer flex items-center justify-center ${
                    agreed ? 'bg-indigo-500 border-indigo-500' : 'border-zinc-600 bg-zinc-900/80 group-hover:border-zinc-400'
                  }`}
                >
                  {agreed && <i className="ri-check-line text-white text-[10px]" />}
                </div>
                <span className="text-xs text-zinc-500 leading-relaxed">
                  <a href="/terms" target="_blank" className="text-indigo-400 hover:underline">이용약관</a> 및{' '}
                  <a href="/privacy" target="_blank" className="text-indigo-400 hover:underline">개인정보처리방침</a>에 동의합니다
                </span>
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 hover:from-indigo-400 hover:via-violet-400 hover:to-purple-400 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <><i className="ri-loader-4-line animate-spin" /> 가입 중...</>
                ) : (
                  <><i className="ri-user-add-line" /> 무료로 시작하기</>
                )}
              </button>
              {/* 가입 혜택 */}
              <div className="flex items-center justify-center gap-4 pt-1">
                <span className="flex items-center gap-1 text-[11px] text-zinc-600">
                  <i className="ri-copper-diamond-line text-amber-500 text-xs" />
                  200 크레딧 무료
                </span>
                <span className="flex items-center gap-1 text-[11px] text-zinc-600">
                  <i className="ri-shield-check-line text-emerald-500 text-xs" />
                  신용카드 불필요
                </span>
                <span className="flex items-center gap-1 text-[11px] text-zinc-600">
                  <i className="ri-sparkling-2-line text-indigo-400 text-xs" />
                  즉시 이용 가능
                </span>
              </div>
            </form>
          )}

          {/* Forgot Password Form */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">가입한 이메일</label>
                <div className="relative">
                  <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full bg-zinc-900/80 border border-zinc-700/60 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:bg-zinc-900 transition-all"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 hover:from-indigo-400 hover:via-violet-400 hover:to-purple-400 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <><i className="ri-loader-4-line animate-spin" /> 발송 중...</>
                ) : (
                  <><i className="ri-send-plane-line" /> 재설정 링크 발송</>
                )}
              </button>
            </form>
          )}

          {/* Mode switch */}
          <div className="mt-5 pt-5 border-t border-zinc-800/60 text-center">
            {mode === 'login' && (
              <p className="text-xs text-zinc-500">
                아직 계정이 없으신가요?{' '}
                <button
                  onClick={() => setMode('signup')}
                  className="text-indigo-400 font-semibold hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  무료 회원가입
                </button>
              </p>
            )}
            {mode === 'signup' && (
              <p className="text-xs text-zinc-500">
                이미 계정이 있으신가요?{' '}
                <button
                  onClick={() => setMode('login')}
                  className="text-indigo-400 font-semibold hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  로그인
                </button>
              </p>
            )}
            {mode === 'forgot' && (
              <button
                onClick={() => setMode('login')}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer flex items-center gap-1 mx-auto"
              >
                <i className="ri-arrow-left-line text-xs" /> 로그인으로 돌아가기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
