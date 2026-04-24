import type { Coupon, PaymentRecord } from '../types';
import { PlanBadge, StatusBadge } from './Badges';
import { subscriptionPlans } from './AdminHelpers';

export interface PaymentStats {
  total_payments: number;
  completed: number;
  refunded: number;
  pending: number;
  monthly_revenue: number;
  total_revenue: number;
}

export interface OverviewRevenue {
  monthly: number;
}

interface Theme {
  cardBg: string;
  cardBg2: string;
  border: string;
  text: string;
  textSub: string;
  textMuted: string;
  textFaint: string;
  tableHead: string;
  inputBg2: string;
  rowHover: string;
  divider: string;
}

interface BillingTabProps {
  isDark: boolean;
  t: Theme;
  paymentsLoading: boolean;
  paymentStats: PaymentStats;
  overviewRevenue?: OverviewRevenue;
  planUserCounts: { free: number; pro: number; enterprise: number } | null;
  displayCoupons: Coupon[];
  displayPayments: PaymentRecord[];
  paymentsTotal: number;
  paymentsPage: number;
  paymentsTotalPages: number;
  paymentsPageSize: number;
  onOpenCouponModal: () => void;
  onCouponToggle: (code: string) => void;
  onExcelDownload: () => void;
  onPaymentRefund: (payId: string) => void;
  onGoToPage: (page: number) => void;
}

export default function BillingTab({
  isDark, t,
  paymentsLoading,
  paymentStats,
  overviewRevenue,
  planUserCounts,
  displayCoupons,
  displayPayments,
  paymentsTotal,
  paymentsPage,
  paymentsTotalPages,
  paymentsPageSize,
  onOpenCouponModal,
  onCouponToggle,
  onExcelDownload,
  onPaymentRefund,
  onGoToPage,
}: BillingTabProps) {
  const summary = [
    {
      label: '이번 달 매출',
      value: paymentStats.monthly_revenue > 0
        ? `₩${Math.round(paymentStats.monthly_revenue * 1350).toLocaleString()}`
        : (overviewRevenue?.monthly
            ? `₩${Math.round(overviewRevenue.monthly * 1350).toLocaleString()}`
            : (paymentsLoading ? '...' : '-')),
      icon: 'ri-money-dollar-circle-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10',
    },
    {
      label: '환불 처리',
      value: paymentStats.refunded > 0 ? `${paymentStats.refunded}건` : (paymentsLoading ? '...' : '-'),
      icon: 'ri-refund-2-line', color: 'text-red-400', bg: 'bg-red-500/10',
    },
    {
      label: '완료 결제',
      value: paymentStats.completed > 0 ? `${paymentStats.completed.toLocaleString()}건` : (paymentsLoading ? '...' : '-'),
      icon: 'ri-vip-crown-line', color: 'text-amber-400', bg: 'bg-amber-500/10',
    },
    {
      label: '쿠폰 수',
      value: displayCoupons.length > 0 ? `${displayCoupons.length}개` : (paymentsLoading ? '...' : '-'),
      icon: 'ri-coupon-3-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10',
    },
  ];

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summary.map((c) => (
          <div key={c.label} className={`${t.cardBg} border ${t.border} rounded-2xl p-4`}>
            <div className={`w-8 h-8 rounded-xl ${c.bg} flex items-center justify-center mb-2`}>
              <i className={`${c.icon} ${c.color} text-sm`} />
            </div>
            <p className={`text-lg font-black ${t.text}`}>{c.value}</p>
            <p className={`text-[11px] ${t.textMuted}`}>{c.label}</p>
          </div>
        ))}
      </div>

      <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className={`text-sm font-black ${t.text}`}>구독 플랜 현황</p>
            <p className={`text-xs ${t.textMuted} mt-0.5`}>플랜별 실제 구독자 수 (DB 실시간)</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {subscriptionPlans.map((plan) => {
            const planKey = plan.name.toLowerCase() as 'free' | 'pro' | 'enterprise';
            const realCount = planUserCounts?.[planKey];
            return (
              <div key={plan.name} className={`${t.cardBg2} rounded-2xl p-5 border ${plan.color}`}>
                <div className="flex items-center justify-between mb-3">
                  <PlanBadge plan={plan.name} isDark={isDark} />
                  <button
                    className={`w-6 h-6 flex items-center justify-center ${t.textFaint} hover:${t.textSub} cursor-pointer transition-colors`}
                    aria-label={`${plan.name} 플랜 편집`}
                  >
                    <i className="ri-edit-line text-xs" />
                  </button>
                </div>
                <p className={`text-2xl font-black ${t.text} mb-1`}>{plan.price}</p>
                <p className={`text-xs ${t.textMuted} mb-3`}>월 {plan.credits.toLocaleString()} 크레딧</p>
                <div className="space-y-1.5 mb-4">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <i className="ri-check-line text-emerald-400 text-xs" />
                      <span className={`text-xs ${t.textSub}`}>{f}</span>
                    </div>
                  ))}
                </div>
                <div className={`pt-3 border-t ${t.border}`}>
                  <p className={`text-[11px] ${t.textFaint}`}>
                    현재 구독자:{' '}
                    {realCount !== undefined ? (
                      <>
                        <span className={`${t.textSub} font-bold`}>{realCount.toLocaleString()}명</span>
                        <span className="ml-1 text-[9px] text-emerald-400 font-semibold">실시간</span>
                      </>
                    ) : paymentsLoading ? (
                      <i className="ri-loader-4-line animate-spin text-indigo-400 text-xs ml-1" />
                    ) : (
                      <span className={`${t.textFaint} font-medium`}>-</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className={`text-sm font-black ${t.text}`}>프로모션 & 쿠폰 관리</p>
            <p className={`text-xs ${t.textMuted} mt-0.5`}>할인 쿠폰 생성 및 무료 크레딧 이벤트</p>
          </div>
          <button
            onClick={onOpenCouponModal}
            className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-coupon-3-line text-xs" />
            쿠폰 생성
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {displayCoupons.length === 0 && (
            <div className={`col-span-3 flex flex-col items-center justify-center py-12 ${t.textFaint}`}>
              <i className="ri-coupon-3-line text-3xl mb-3" />
              <p className={`text-sm font-semibold ${t.textMuted}`}>등록된 쿠폰이 없습니다</p>
              <p className="text-xs mt-1">위 버튼으로 쿠폰을 생성하세요</p>
            </div>
          )}
          {displayCoupons.map((coupon) => (
            <div key={coupon.code} className={`${t.cardBg2} rounded-xl p-4 border ${coupon.active ? 'border-indigo-500/20' : t.border}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-black ${t.text} font-mono`}>{coupon.code}</span>
                <button
                  onClick={() => onCouponToggle(coupon.code)}
                  aria-label={`쿠폰 ${coupon.code} ${coupon.active ? '비활성화' : '활성화'}`}
                  aria-pressed={coupon.active}
                  className={`w-6 h-3.5 rounded-full transition-colors cursor-pointer relative ${coupon.active ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                >
                  <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform ${coupon.active ? 'translate-x-3' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <p className={`text-xs ${t.textMuted} mb-2`}>{coupon.type} · {coupon.discount}</p>
              <div className={`h-1 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'} rounded-full overflow-hidden mb-1.5`}>
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(coupon.used / coupon.limit) * 100}%` }} />
              </div>
              <div className="flex justify-between">
                <span className={`text-[10px] ${t.textFaint}`}>{coupon.used}/{coupon.limit} 사용</span>
                <span className={`text-[10px] ${t.textFaint}`}>~{coupon.expires}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
        <div className={`px-5 py-4 border-b ${t.border} flex items-center justify-between`}>
          <div>
            <p className={`text-sm font-black ${t.text}`}>결제 내역</p>
            <p className={`text-xs ${t.textMuted} mt-0.5`}>PG사 연동 결제 이력</p>
          </div>
          <button
            onClick={onExcelDownload}
            className="flex items-center gap-1.5 bg-zinc-800 border border-white/10 text-zinc-300 text-xs font-semibold px-3 py-2 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-file-excel-2-line text-xs" />
            Excel 다운로드
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`border-b ${t.border}`}>
                <th className={`text-left px-5 py-3 text-[11px] font-black ${t.tableHead} uppercase tracking-wider`}>결제 ID</th>
                <th className={`text-left px-4 py-3 text-[11px] font-black ${t.tableHead} uppercase tracking-wider`}>사용자</th>
                <th className={`text-left px-4 py-3 text-[11px] font-black ${t.tableHead} uppercase tracking-wider hidden sm:table-cell`}>플랜</th>
                <th className={`text-right px-4 py-3 text-[11px] font-black ${t.tableHead} uppercase tracking-wider`}>금액</th>
                <th className={`text-left px-4 py-3 text-[11px] font-black ${t.tableHead} uppercase tracking-wider hidden md:table-cell`}>수단</th>
                <th className={`text-left px-4 py-3 text-[11px] font-black ${t.tableHead} uppercase tracking-wider hidden lg:table-cell`}>날짜</th>
                <th className={`text-left px-4 py-3 text-[11px] font-black ${t.tableHead} uppercase tracking-wider`}>상태</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className={`divide-y ${t.divider}`}>
              {paymentsLoading ? (
                <tr><td colSpan={8} className="text-center py-8"><i className="ri-loader-4-line animate-spin text-2xl text-indigo-400" /></td></tr>
              ) : null}
              {!paymentsLoading && displayPayments.map((p) => (
                <tr key={p.id} className={`${t.rowHover} transition-colors group`}>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-mono ${t.textMuted}`}>{p.id}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-sm font-semibold ${t.text}`}>{p.user}</span>
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    <PlanBadge plan={p.plan} isDark={isDark} />
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={`text-sm font-bold ${t.text}`}>{p.amount}</span>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span className={`text-xs ${t.textMuted}`}>{p.method}</span>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <span className={`text-xs ${t.textMuted}`}>{p.date}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={p.status} isDark={isDark} />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {p.status === 'completed' && (
                        <button
                          onClick={() => onPaymentRefund(p.id)}
                          className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-semibold cursor-pointer transition-colors whitespace-nowrap"
                        >
                          환불
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!paymentsLoading && displayPayments.length === 0 && (
                <tr>
                  <td colSpan={8} className={`text-center py-12 ${t.textFaint}`}>
                    <i className="ri-bank-card-line text-2xl mb-2 block" />
                    결제 내역이 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className={`px-5 py-3.5 border-t ${t.border} flex flex-col sm:flex-row items-center gap-3 justify-between`}>
          <span className={`text-xs ${t.textFaint}`}>
            전체 <span className={`${t.textSub} font-bold`}>{paymentsTotal.toLocaleString()}건</span> 중{' '}
            <span className={`${t.textSub} font-bold`}>
              {paymentsTotal === 0 ? 0 : (paymentsPage - 1) * paymentsPageSize + 1}–{Math.min(paymentsPage * paymentsPageSize, paymentsTotal)}
            </span>건 표시
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onGoToPage(1)}
              disabled={paymentsPage === 1}
              aria-label="첫 페이지"
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.textMuted} hover:${t.inputBg2} disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors`}
            >
              <i className="ri-skip-left-line text-sm" />
            </button>
            <button
              onClick={() => onGoToPage(paymentsPage - 1)}
              disabled={paymentsPage === 1}
              aria-label="이전 페이지"
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.textMuted} hover:${t.inputBg2} disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors`}
            >
              <i className="ri-arrow-left-s-line text-sm" />
            </button>
            <span className={`text-xs ${t.textMuted} px-3`}>{paymentsPage} / {paymentsTotalPages}</span>
            <button
              onClick={() => onGoToPage(paymentsPage + 1)}
              disabled={paymentsPage >= paymentsTotalPages}
              aria-label="다음 페이지"
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.textMuted} hover:${t.inputBg2} disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors`}
            >
              <i className="ri-arrow-right-s-line text-sm" />
            </button>
            <button
              onClick={() => onGoToPage(paymentsTotalPages)}
              disabled={paymentsPage >= paymentsTotalPages}
              aria-label="마지막 페이지"
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.textMuted} hover:${t.inputBg2} disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors`}
            >
              <i className="ri-skip-right-line text-sm" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
