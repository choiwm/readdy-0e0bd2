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



          {/* 내 문의 + 답변 */}
          <MyInquiriesSection userId={profile.id} />

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

// 사용자가 customer-support 페이지에서 보낸 문의에 admin 이 답변을 달면 (admin-cs
// 의 reply_ticket 액션이 cs_tickets.reply_content / replied_at 을 채워요),
// 이전엔 사용자가 그 답변을 어디서도 볼 수 없었어요. cs_tickets 의 RLS
// (cs_tickets_select_own) 가 본인 row 만 SELECT 허용하고 있어서, 여기서 직접
// 조회해 표시.
interface CsTicket {
  id: string;
  category: string | null;
  title: string | null;
  body: string | null;
  status: string | null;
  reply_content: string | null;
  replied_at: string | null;
  created_at: string;
}

function MyInquiriesSection({ userId }: { userId: string }) {
  const [tickets, setTickets] = useState<CsTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase
        .from('cs_tickets')
        .select('id, category, title, body, status, reply_content, replied_at, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (err) {
        setError(err.message);
        setTickets([]);
        return;
      }
      setTickets((data ?? []) as CsTicket[]);
    })();
  }, [userId]);

  if (tickets === null) {
    return (
      <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6">
        <h2 className="text-sm font-bold text-zinc-300 mb-3">내 문의 / 답변</h2>
        <p className="text-xs text-zinc-500">불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6">
        <h2 className="text-sm font-bold text-zinc-300 mb-3">내 문의 / 답변</h2>
        <p className="text-xs text-red-400">불러오기 실패: {error}</p>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6">
        <h2 className="text-sm font-bold text-zinc-300 mb-2">내 문의 / 답변</h2>
        <p className="text-xs text-zinc-500 leading-relaxed">
          아직 보내신 문의가 없어요. 문의는 <Link to="/customer-support" className="text-indigo-400 hover:underline">고객센터</Link> 에서 보낼 수 있어요.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-zinc-300">내 문의 / 답변 ({tickets.length})</h2>
        <Link to="/customer-support" className="text-[11px] text-indigo-400 hover:underline">새 문의 작성</Link>
      </div>
      <div className="space-y-3">
        {tickets.map((t) => (
          <div key={t.id} className="bg-zinc-950/60 border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                t.status === 'resolved'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : t.status === 'in_progress'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-zinc-700/40 border-zinc-600/40 text-zinc-400'
              }`}>
                {t.status === 'resolved' ? '답변 완료' : t.status === 'in_progress' ? '처리 중' : '접수됨'}
              </span>
              {t.category && (
                <span className="text-[10px] text-zinc-500">{t.category}</span>
              )}
              <span className="text-[10px] text-zinc-600 ml-auto">
                {new Date(t.created_at).toLocaleString('ko-KR')}
              </span>
            </div>
            {t.title && <p className="text-sm font-bold text-white mb-1">{t.title}</p>}
            {t.body && <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">{t.body}</p>}
            {t.reply_content && (
              <div className="mt-3 pt-3 border-t border-white/5 bg-indigo-500/5 -mx-4 -mb-4 px-4 pb-4 rounded-b-xl">
                <p className="text-[10px] font-bold text-indigo-300 mb-1">
                  운영팀 답변 {t.replied_at && `· ${new Date(t.replied_at).toLocaleString('ko-KR')}`}
                </p>
                <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap">{t.reply_content}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
