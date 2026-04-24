import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { getAuthorizationHeader, SUPABASE_URL } from '@/lib/env';

interface PaymentRow {
  id: string;
  order_id: string;
  package_id: string;
  amount: number;
  credits: number;
  status: 'pending' | 'done' | 'cancelled' | 'failed' | 'refunded';
  payment_key: string | null;
  payment_method: string | null;
  approved_at: string | null;
  created_at: string;
}

const STATUS_META: Record<PaymentRow['status'], { label: string; cls: string }> = {
  pending:   { label: '대기',   cls: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20' },
  done:      { label: '완료',   cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  cancelled: { label: '취소',   cls: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20' },
  failed:    { label: '실패',   cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
  refunded:  { label: '환불됨', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function withinRefundWindow(approved_at: string | null): boolean {
  if (!approved_at) return false;
  const days = (Date.now() - new Date(approved_at).getTime()) / (1000 * 60 * 60 * 24);
  return days <= 7;
}

export default function MyPaymentsPage() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState<PaymentRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PaymentRow | null>(null);
  const [refundTarget, setRefundTarget] = useState<PaymentRow | null>(null);

  useEffect(() => {
    document.title = '결제 내역 | AiMetaWOW';
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) {
      navigate('/');
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('id, order_id, package_id, amount, credits, status, payment_key, payment_method, approved_at, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) {
        setLoadError(error.message);
        setRows([]);
        return;
      }
      setRows((data ?? []) as PaymentRow[]);
    })();
  }, [authLoading, isLoggedIn, navigate]);

  return (
    <div className="min-h-screen bg-[#06060a] text-white">
      {/* Top Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/95 border-b border-white/5 backdrop-blur-xl py-3 px-4 md:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center cursor-pointer group">
            <img
              src="https://static.readdy.ai/image/818485967d328b35909ddcc1d73f5659/99fa675bf72ff13d36de270333b480ff.png"
              alt="AiMetaWOW"
              className="h-8 transition-all duration-300 group-hover:scale-105"
            />
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/credit-purchase" className="text-sm font-bold text-zinc-400 hover:text-white transition-colors whitespace-nowrap cursor-pointer px-3 py-1.5 rounded-lg hover:bg-zinc-800/60">
              크레딧 충전
            </Link>
            <Link to="/customer-support" className="text-sm font-bold text-zinc-400 hover:text-white transition-colors whitespace-nowrap cursor-pointer px-3 py-1.5 rounded-lg hover:bg-zinc-800/60">
              고객지원
            </Link>
          </div>
        </div>
      </nav>

      <section className="pt-28 pb-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-black mb-2">결제 내역</h1>
            <p className="text-zinc-500 text-sm">최근 100건의 결제 기록을 보여드립니다. 영수증과 환불 요청이 필요하면 해당 버튼을 눌러주세요.</p>
          </div>

          {rows === null && !loadError && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-zinc-900/40 border border-white/5 rounded-2xl animate-pulse" />
              ))}
            </div>
          )}

          {loadError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 flex items-start gap-3">
              <i className="ri-error-warning-line text-red-400 text-xl mt-0.5" />
              <div>
                <p className="font-bold text-red-300 text-sm">결제 내역을 불러오지 못했습니다</p>
                <p className="text-xs text-zinc-400 mt-1">{loadError}</p>
              </div>
            </div>
          )}

          {rows !== null && rows.length === 0 && !loadError && (
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-10 text-center">
              <div className="w-14 h-14 rounded-full bg-zinc-800/60 mx-auto mb-4 flex items-center justify-center">
                <i className="ri-receipt-line text-zinc-500 text-2xl" />
              </div>
              <p className="text-zinc-300 font-bold mb-1">결제 내역이 없어요</p>
              <p className="text-zinc-500 text-sm mb-5">크레딧을 충전하면 이곳에서 영수증을 확인하실 수 있습니다.</p>
              <Link to="/credit-purchase" className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors cursor-pointer">
                <i className="ri-copper-diamond-line" />
                크레딧 충전하기
              </Link>
            </div>
          )}

          {rows !== null && rows.length > 0 && (
            <div className="space-y-2.5">
              {rows.map((p) => {
                const meta = STATUS_META[p.status];
                return (
                  <div key={p.id} className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-white capitalize">{p.package_id}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>
                      </div>
                      <p className="text-xs text-zinc-500 font-mono truncate">{p.order_id}</p>
                      <p className="text-[10px] text-zinc-600 mt-1">{fmtDate(p.created_at)}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-white font-black">₩{p.amount.toLocaleString()}</p>
                      <p className="text-[10px] text-amber-400 font-bold">+{p.credits.toLocaleString()} CR</p>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-1.5">
                      <button
                        onClick={() => setReceipt(p)}
                        className="text-xs font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-white/5 px-3 py-1.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                      >
                        영수증
                      </button>
                      {p.status === 'done' && withinRefundWindow(p.approved_at) && (
                        <button
                          onClick={() => setRefundTarget(p)}
                          className="text-xs font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 px-3 py-1.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                        >
                          환불 요청
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[10px] text-zinc-600 mt-6 leading-relaxed">
            환불은 구매일로부터 <span className="font-semibold text-zinc-500">7일 이내</span> 미사용 크레딧에 한해 가능합니다. 환불 요청 버튼이 보이지 않으면 고객지원을 통해 문의해 주세요.
          </p>
        </div>
      </section>

      {receipt && <ReceiptModal payment={receipt} onClose={() => setReceipt(null)} />}
      {refundTarget && (
        <RefundRequestModal
          payment={refundTarget}
          onClose={() => setRefundTarget(null)}
          onDone={() => setRefundTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Receipt Modal ────────────────────────────────────────────────────────────
function ReceiptModal({ payment, onClose }: { payment: PaymentRow; onClose: () => void }) {
  const meta = STATUS_META[payment.status];
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-900 border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <p className="font-bold text-white">영수증</p>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white cursor-pointer">
            <i className="ri-close-line" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="bg-zinc-800/60 rounded-xl p-4 space-y-2">
            {[
              ['주문번호', payment.order_id],
              ['패키지', payment.package_id],
              ['금액', `₩${payment.amount.toLocaleString()}`],
              ['크레딧', `+${payment.credits.toLocaleString()} CR`],
              ['상태', meta.label],
              ['결제일시', fmtDate(payment.created_at)],
              ['승인일시', payment.approved_at ? fmtDate(payment.approved_at) : '—'],
              ['결제수단', payment.payment_method ?? '—'],
              ['PG 키', payment.payment_key ? payment.payment_key.slice(0, 16) + '…' : '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-3 text-xs">
                <span className="text-zinc-500 flex-shrink-0">{k}</span>
                <span className="text-zinc-200 text-right font-mono break-all">{v}</span>
              </div>
            ))}
          </div>
          <button onClick={onClose} className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm rounded-xl cursor-pointer transition-colors whitespace-nowrap">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Refund Request Modal ─────────────────────────────────────────────────────
function RefundRequestModal({
  payment,
  onClose,
  onDone,
}: {
  payment: PaymentRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const { profile } = useAuth();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!reason.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/support-submit`, {
        method: 'POST',
        headers: {
          'Authorization': getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'refund',
          email: profile?.email ?? '',
          name: profile?.display_name ?? '',
          subject: `환불 요청 — ${payment.order_id}`,
          message: `주문번호: ${payment.order_id}\n금액: ₩${payment.amount.toLocaleString()}\n크레딧: ${payment.credits} CR\n\n사유:\n${reason}`,
          order_id: payment.order_id,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? '환불 요청 중 오류가 발생했습니다.');
      }
      setSubmitted(true);
      setTimeout(onDone, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : '요청 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={!submitting ? onClose : undefined}>
      <div className="bg-zinc-900 border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <p className="font-bold text-white">환불 요청</p>
          {!submitting && (
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white cursor-pointer">
              <i className="ri-close-line" />
            </button>
          )}
        </div>
        <div className="p-5 space-y-4">
          {submitted ? (
            <div className="flex flex-col items-center gap-4 py-3 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <i className="ri-check-line text-emerald-400 text-3xl" />
              </div>
              <div>
                <p className="text-white font-bold">환불 요청이 접수되었습니다</p>
                <p className="text-xs text-zinc-500 mt-1">영업일 기준 3일 이내에 안내드립니다.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2.5">
                <i className="ri-information-line text-amber-400 text-sm mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  사용하지 않은 크레딧에 한해 환불 가능합니다. 이미 사용한 크레딧은 환불 대상에서 제외됩니다.
                </p>
              </div>
              <div className="bg-zinc-800/60 rounded-xl p-3 text-xs text-zinc-400 space-y-1 font-mono">
                <div className="flex justify-between"><span className="text-zinc-500">주문번호</span><span>{payment.order_id}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">금액</span><span>₩{payment.amount.toLocaleString()}</span></div>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-400 mb-2 block">환불 사유 <span className="text-red-400">*</span></label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value.slice(0, 2000))}
                  placeholder="환불을 요청하시는 사유를 적어주세요."
                  rows={5}
                  className="w-full bg-zinc-800 border border-white/8 rounded-xl px-4 py-3 text-sm text-white resize-none focus:outline-none focus:border-indigo-500/40"
                />
              </div>
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2.5 text-xs text-red-300">{error}</div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-semibold hover:bg-white/5 cursor-pointer transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!reason.trim() || submitting}
                  className="flex-[2] py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-bold cursor-pointer transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {submitting ? (
                    <><i className="ri-loader-4-line animate-spin" /> 제출 중...</>
                  ) : (
                    <><i className="ri-mail-send-line" /> 환불 요청 제출</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
