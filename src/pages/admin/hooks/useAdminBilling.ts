import { useCallback, useState } from 'react';
import { getAuthorizationHeader } from '@/lib/env';
import type { Coupon, PaymentRecord } from '../types';
import type { PaymentStats } from '../components/BillingTab';

export const PAYMENTS_PAGE_SIZE = 20;

const INITIAL_PAYMENT_STATS: PaymentStats = {
  total_payments: 0,
  completed: 0,
  refunded: 0,
  pending: 0,
  monthly_revenue: 0,
  total_revenue: 0,
};

const BILLING_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-billing`;

interface CouponCreateResult {
  ok: boolean;
  code?: string;
  error?: string;
}

export function useAdminBilling() {
  const [paymentsData, setPaymentsData] = useState<PaymentRecord[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [paymentsTotalPages, setPaymentsTotalPages] = useState(1);
  const [paymentStats, setPaymentStats] = useState<PaymentStats>(INITIAL_PAYMENT_STATS);
  const [couponsData, setCouponsData] = useState<Coupon[]>([]);

  // ── Coupon create form state ──
  const [couponModal, setCouponModal] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState('');
  const [couponDiscountType, setCouponDiscountType] = useState<'percent' | 'credits'>('percent');
  const [couponMaxUses, setCouponMaxUses] = useState('');
  const [couponExpires, setCouponExpires] = useState('');

  const loadPayments = useCallback(async (page = 1) => {
    setPaymentsLoading(true);
    try {
      const fetchUrl = new URL(BILLING_URL);
      fetchUrl.searchParams.set('action', 'list_payments');
      fetchUrl.searchParams.set('limit', String(PAYMENTS_PAGE_SIZE));
      fetchUrl.searchParams.set('page', String(page));
      const res = await fetch(fetchUrl.toString(), {
        headers: { Authorization: getAuthorizationHeader() },
      });
      const data = await res.json();
      if (data.payments && data.payments.length > 0) {
        const mapped = data.payments.map((p: Record<string, unknown>) => {
          const profile = p.user_profiles as Record<string, string> | null;
          return {
            id: (p.id as string).slice(0, 12).toUpperCase(),
            user: profile?.display_name ?? profile?.email ?? '알 수 없음',
            plan: p.plan ? ((p.plan as string).charAt(0).toUpperCase() + (p.plan as string).slice(1)) : '-',
            amount: p.amount_usd ? `₩${Math.round((p.amount_usd as number) * 1350).toLocaleString()}` : '-',
            date: p.created_at
              ? new Date(p.created_at as string).toLocaleDateString('ko-KR').replace(/\. /g, '.').replace(/\.$/, '')
              : '-',
            status: (p.status as string) ?? 'pending',
            method: (p.payment_method as string) ?? '카드',
          };
        });
        setPaymentsData(mapped);
        setPaymentsTotal(data.total ?? 0);
        setPaymentsTotalPages(data.total_pages ?? Math.ceil((data.total ?? 0) / PAYMENTS_PAGE_SIZE));
        setPaymentsPage(page);
      } else if (page === 1) {
        setPaymentsData([]);
        setPaymentsTotal(0);
        setPaymentsTotalPages(1);
      }
    } catch (e) {
      console.warn('Payments load failed:', e);
    } finally {
      setPaymentsLoading(false);
    }
  }, []);

  const loadPaymentStats = useCallback(async () => {
    try {
      const url = new URL(BILLING_URL);
      url.searchParams.set('action', 'payment_stats');
      const res = await fetch(url.toString(), {
        headers: { Authorization: getAuthorizationHeader() },
      });
      const json = await res.json();
      if (json.stats) setPaymentStats(json.stats);
    } catch (e) {
      console.warn('Payment stats load failed:', e);
    }
  }, []);

  const loadCoupons = useCallback(async () => {
    try {
      const url = new URL(BILLING_URL);
      url.searchParams.set('action', 'list_coupons');
      const res = await fetch(url.toString(), {
        headers: { Authorization: getAuthorizationHeader() },
      });
      const json = await res.json();
      if (json.coupons && json.coupons.length > 0) {
        const mapped = json.coupons.map((c: Record<string, unknown>) => ({
          code: c.code as string,
          discount: c.discount_type === 'percent' ? `${c.discount_value}%` : `${c.discount_value} CR`,
          type: c.discount_type === 'percent' ? '구독 할인' : '무료 크레딧',
          used: (c.used_count as number) ?? 0,
          limit: (c.max_uses as number) ?? 999,
          expires: c.expires_at
            ? new Date(c.expires_at as string).toLocaleDateString('ko-KR').replace(/\. /g, '.').replace(/\.$/, '')
            : '무제한',
          active: (c.is_active as boolean) ?? true,
        }));
        setCouponsData(mapped);
      }
    } catch (e) {
      console.warn('Coupons load failed:', e);
    }
  }, []);

  // ── Coupon toggle (Edge Function) ──
  const toggleCoupon = useCallback(async (
    code: string,
    fallbackCoupons: Coupon[],
    setFallbackCoupons: (updater: (prev: Coupon[]) => Coupon[]) => void,
  ): Promise<{ code: string; active: boolean }> => {
    const displayNow = couponsData.length > 0 ? couponsData : fallbackCoupons;
    const coupon = displayNow.find((c) => c.code === code);
    const newActive = !coupon?.active;

    if (couponsData.length > 0) {
      setCouponsData((prev) => prev.map((c) => c.code === code ? { ...c, active: newActive } : c));
    } else {
      setFallbackCoupons((prev) => prev.map((c) => c.code === code ? { ...c, active: newActive } : c));
    }

    try {
      const url = new URL(BILLING_URL);
      url.searchParams.set('action', 'toggle_coupon');
      await fetch(url.toString(), {
        method: 'PATCH',
        headers: {
          Authorization: getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, is_active: newActive }),
      });
    } catch (e) {
      console.warn('Coupon toggle failed:', e);
    }
    return { code, active: newActive };
  }, [couponsData]);

  // ── Coupon create (Edge Function) ──
  const createCoupon = useCallback(async (
    setFallbackCoupons: (updater: (prev: Coupon[]) => Coupon[]) => void,
  ): Promise<CouponCreateResult> => {
    if (!couponCode.trim()) return { ok: false, error: '쿠폰 코드를 입력해주세요' };
    if (!couponDiscount.trim()) return { ok: false, error: '할인값을 입력해주세요' };
    const discountNum = parseFloat(couponDiscount);
    if (isNaN(discountNum)) return { ok: false, error: '올바른 숫자를 입력해주세요' };

    const codeUpper = couponCode.toUpperCase();
    try {
      const url = new URL(BILLING_URL);
      url.searchParams.set('action', 'create_coupon');
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          Authorization: getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: codeUpper,
          discount_type: couponDiscountType === 'percent' ? 'percent' : 'credits',
          discount_value: discountNum,
          max_uses: couponMaxUses ? parseInt(couponMaxUses) : null,
          expires_at: couponExpires ? new Date(couponExpires).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (data.error) return { ok: false, error: data.error };
      await loadCoupons();
    } catch (e) {
      console.warn('Coupon create failed:', e);
      const newCoupon: Coupon = {
        code: codeUpper,
        discount: couponDiscountType === 'percent' ? `${couponDiscount}%` : `${couponDiscount} CR`,
        type: couponDiscountType === 'percent' ? '구독 할인' : '무료 크레딧',
        used: 0,
        limit: couponMaxUses ? parseInt(couponMaxUses) : 999,
        expires: couponExpires || '무제한',
        active: true,
      };
      setFallbackCoupons((prev) => [...prev, newCoupon]);
    }
    setCouponCode('');
    setCouponDiscount('');
    setCouponMaxUses('');
    setCouponExpires('');
    setCouponModal(false);
    return { ok: true, code: codeUpper };
  }, [couponCode, couponDiscount, couponDiscountType, couponMaxUses, couponExpires, loadCoupons]);

  return {
    paymentsData,
    setPaymentsData,
    paymentsLoading,
    paymentsPage,
    paymentsTotal,
    paymentsTotalPages,
    paymentStats,
    couponsData,
    setCouponsData,
    loadPayments,
    loadPaymentStats,
    loadCoupons,
    couponModal, setCouponModal,
    couponCode, setCouponCode,
    couponDiscount, setCouponDiscount,
    couponDiscountType, setCouponDiscountType,
    couponMaxUses, setCouponMaxUses,
    couponExpires, setCouponExpires,
    toggleCoupon,
    createCoupon,
  };
}
