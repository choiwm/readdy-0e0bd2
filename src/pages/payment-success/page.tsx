import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getAuthorizationHeader, SUPABASE_URL } from '@/lib/env';
import { useAuth } from '@/hooks/useAuth';

interface ConfirmResult {
  ok: boolean;
  credits_granted?: number;
  new_balance?: number | null;
  already_confirmed?: boolean;
}

type Phase = 'confirming' | 'success' | 'error';

export default function PaymentSuccessPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  const [phase, setPhase] = useState<Phase>('confirming');
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const ranOnce = useRef(false);

  const paymentKey = params.get('paymentKey') ?? '';
  const orderId = params.get('orderId') ?? '';
  const amount = Number(params.get('amount') ?? 0);

  useEffect(() => {
    document.title = '결제 처리 중... | AiMetaWOW';
  }, []);

  useEffect(() => {
    // Toss redirects can fire React StrictMode's double-effect; guard with a ref.
    if (ranOnce.current) return;
    ranOnce.current = true;

    if (!paymentKey || !orderId || !Number.isFinite(amount) || amount <= 0) {
      setPhase('error');
      setErrorMsg('결제 정보가 누락되었습니다. (필수: paymentKey, orderId, amount)');
      return;
    }

    void (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/payments-toss?action=confirm`,
          {
            method: 'POST',
            headers: {
              'Authorization': getAuthorizationHeader(),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ paymentKey, orderId, amount }),
          },
        );
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          setPhase('error');
          setErrorMsg(
            data?.toss_message
              ?? data?.error
              ?? '결제 확정에 실패했습니다. 결제 내역에 문제가 있다면 고객지원으로 문의해주세요.',
          );
          return;
        }
        setResult(data);
        setPhase('success');
        // 새 잔액이 즉시 헤더에 반영되도록 프로필 재조회.
        try { await refreshProfile(); } catch { /* ignore */ }
      } catch {
        setPhase('error');
        setErrorMsg('결제 확정 중 네트워크 오류가 발생했습니다.');
      }
    })();
  }, [paymentKey, orderId, amount, refreshProfile]);

  return (
    <div className="min-h-screen bg-[#06060a] text-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden">
        {phase === 'confirming' && (
          <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <div className="w-12 h-12 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            <div>
              <p className="text-sm font-bold">결제를 확인하고 있습니다</p>
              <p className="text-xs text-zinc-500 mt-1">잠시만 기다려주세요. 페이지를 닫지 마세요.</p>
            </div>
          </div>
        )}

        {phase === 'success' && (
          <div className="flex flex-col items-center gap-5 px-6 py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <i className="ri-check-line text-emerald-400 text-3xl" />
            </div>
            <div>
              <p className="text-base font-bold">결제가 완료되었습니다</p>
              <p className="text-xs text-zinc-500 mt-1">
                {result?.already_confirmed
                  ? '이미 처리된 결제입니다.'
                  : '크레딧이 즉시 충전되었습니다.'}
              </p>
            </div>
            <div className="w-full bg-zinc-800/60 border border-white/5 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">충전된 크레딧</span>
                <span className="text-amber-400 font-black">
                  +{(result?.credits_granted ?? 0).toLocaleString()} CR
                </span>
              </div>
              {result?.new_balance != null && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">현재 잔액</span>
                  <span className="text-white font-bold">
                    {result.new_balance.toLocaleString()} CR
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-[10px] text-zinc-600 pt-2 border-t border-white/5 font-mono">
                <span>주문번호</span>
                <span>{orderId}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 w-full">
              <Link to="/credit-purchase" className="contents">
                <button className="w-full py-2.5 bg-zinc-800/60 hover:bg-zinc-700/60 border border-white/5 text-zinc-300 font-semibold text-sm rounded-xl cursor-pointer transition-colors whitespace-nowrap">
                  추가 충전
                </button>
              </Link>
              <button
                onClick={() => navigate('/')}
                className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm rounded-xl cursor-pointer transition-colors whitespace-nowrap"
              >
                홈으로
              </button>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col items-center gap-5 px-6 py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
              <i className="ri-close-line text-red-400 text-3xl" />
            </div>
            <div>
              <p className="text-base font-bold">결제 확정에 실패했습니다</p>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed break-keep">{errorMsg}</p>
              {orderId && (
                <p className="text-[10px] text-zinc-600 mt-3 font-mono">주문번호: {orderId}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 w-full">
              <Link to="/customer-support" className="contents">
                <button className="w-full py-2.5 bg-zinc-800/60 hover:bg-zinc-700/60 border border-white/5 text-zinc-300 font-semibold text-sm rounded-xl cursor-pointer transition-colors whitespace-nowrap">
                  고객지원
                </button>
              </Link>
              <Link to="/credit-purchase" className="contents">
                <button className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm rounded-xl cursor-pointer transition-colors whitespace-nowrap">
                  다시 시도
                </button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
