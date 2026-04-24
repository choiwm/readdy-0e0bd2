import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getAuthorizationHeader, SUPABASE_URL } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export default function MyAccountPage() {
  const { isLoggedIn, loading, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => { document.title = '계정 설정 | AiMetaWOW'; }, []);

  useEffect(() => {
    if (!loading && !isLoggedIn) navigate('/');
  }, [loading, isLoggedIn, navigate]);

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-[#06060a] text-white flex items-center justify-center">
        <i className="ri-loader-4-line animate-spin text-zinc-500 text-xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06060a] text-white">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/95 border-b border-white/5 backdrop-blur-xl py-3 px-4 md:px-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center cursor-pointer group">
            <img
              src="https://static.readdy.ai/image/818485967d328b35909ddcc1d73f5659/99fa675bf72ff13d36de270333b480ff.png"
              alt="AiMetaWOW"
              className="h-8 transition-all duration-300 group-hover:scale-105"
            />
          </Link>
          <Link to="/my/payments" className="text-sm font-bold text-zinc-400 hover:text-white transition-colors whitespace-nowrap cursor-pointer px-3 py-1.5 rounded-lg hover:bg-zinc-800/60">
            결제 내역
          </Link>
        </div>
      </nav>

      <section className="pt-28 pb-16 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black mb-2">계정 설정</h1>
            <p className="text-zinc-500 text-sm">프로필 정보와 계정 관리 옵션을 확인할 수 있습니다.</p>
          </div>

          {/* Profile */}
          <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6">
            <h2 className="text-sm font-bold text-zinc-300 mb-4">프로필</h2>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3 text-sm">
                <span className="text-zinc-500 flex-shrink-0">이메일</span>
                <span className="text-zinc-200 text-right break-all">{profile.email}</span>
              </div>
              <div className="flex items-start justify-between gap-3 text-sm">
                <span className="text-zinc-500 flex-shrink-0">이름</span>
                <span className="text-zinc-200 text-right">{profile.display_name ?? '—'}</span>
              </div>
              <div className="flex items-start justify-between gap-3 text-sm">
                <span className="text-zinc-500 flex-shrink-0">요금제</span>
                <span className="text-zinc-200 text-right uppercase">{profile.plan}</span>
              </div>
              <div className="flex items-start justify-between gap-3 text-sm">
                <span className="text-zinc-500 flex-shrink-0">잔액</span>
                <span className="text-amber-400 font-bold text-right">{profile.credit_balance.toLocaleString()} CR</span>
              </div>
            </div>
          </div>

          {/* Security / Password */}
          <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6">
            <h2 className="text-sm font-bold text-zinc-300 mb-2">비밀번호</h2>
            <p className="text-xs text-zinc-500 mb-4">
              비밀번호 재설정 링크를 이메일로 받아 변경할 수 있습니다.
            </p>
            <PasswordResetButton email={profile.email} />
          </div>

          {/* Danger zone */}
          <div className="bg-red-500/5 border border-red-500/25 rounded-2xl p-6">
            <h2 className="text-sm font-bold text-red-400 mb-2">계정 삭제</h2>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              계정을 삭제하면 프로필, 생성 이력, 보유 크레딧이 모두 즉시 제거되며
              복구할 수 없습니다. 결제 내역은 법령상 보관 의무에 따라 일정 기간 익명화된
              형태로 유지됩니다.
            </p>
            <button
              onClick={() => setDeleteOpen(true)}
              className="inline-flex items-center gap-2 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-sm font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-delete-bin-6-line" />
              계정 삭제 요청
            </button>
          </div>
        </div>
      </section>

      {deleteOpen && (
        <DeleteAccountModal
          onCancel={() => setDeleteOpen(false)}
          onDeleted={async () => {
            await signOut();
            navigate('/');
          }}
        />
      )}
    </div>
  );
}

function PasswordResetButton({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        onClick={async () => {
          setBusy(true);
          setError(null);
          const { error } = await supabase.auth.resetPasswordForEmail(email);
          if (error) setError(error.message);
          else setSent(true);
          setBusy(false);
        }}
        disabled={busy || sent}
        className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-white/5 text-zinc-300 text-sm font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy ? (
          <><i className="ri-loader-4-line animate-spin" /> 전송 중...</>
        ) : sent ? (
          <><i className="ri-check-line text-emerald-400" /> 이메일 전송됨</>
        ) : (
          <><i className="ri-mail-send-line" /> 재설정 링크 받기</>
        )}
      </button>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}

function DeleteAccountModal({
  onCancel,
  onDeleted,
}: {
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const REQUIRED = '삭제합니다';
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = confirmText !== REQUIRED || busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/account-delete`, {
        method: 'POST',
        headers: {
          'Authorization': getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirm_text: confirmText }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? '계정 삭제 처리에 실패했습니다.');
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={!busy ? onCancel : undefined}>
      <div className="bg-zinc-900 border border-red-500/30 rounded-t-3xl sm:rounded-3xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="h-1 w-full bg-gradient-to-r from-red-500 to-rose-500" />
        <div className="px-6 pt-6 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
              <i className="ri-error-warning-line text-red-400 text-lg" />
            </div>
            <p className="text-white font-bold">계정을 영구 삭제합니다</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <ul className="bg-red-500/5 border border-red-500/15 rounded-xl p-4 space-y-1.5 text-xs text-red-200/80">
            {[
              '프로필, 생성 이력, 갤러리가 즉시 삭제됩니다',
              '보유하신 크레딧은 복구할 수 없습니다',
              '결제 내역은 법령상 보관 의무로 익명화되어 유지됩니다',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <i className="ri-subtract-line text-red-400/60 mt-0.5" />
                <span>{t}</span>
              </li>
            ))}
          </ul>

          <div>
            <label className="text-xs font-semibold text-zinc-400 mb-2 block">
              계속하시려면 <span className="text-red-400 font-bold">{REQUIRED}</span> 라고 입력하세요
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={REQUIRED}
              className="w-full bg-zinc-800 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/40"
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-xs text-red-300">{error}</div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onCancel}
              disabled={busy}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-semibold hover:bg-white/5 cursor-pointer transition-colors whitespace-nowrap disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={submit}
              disabled={disabled}
              className="flex-[2] py-2.5 rounded-xl bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold cursor-pointer transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {busy ? (
                <><i className="ri-loader-4-line animate-spin" /> 삭제 중...</>
              ) : (
                <><i className="ri-delete-bin-6-line" /> 영구 삭제</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
