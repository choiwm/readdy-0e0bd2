import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdminBilling } from './useAdminBilling';
import type { Coupon } from '../types';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown): Response {
  return { json: async () => body } as Response;
}

describe('useAdminBilling', () => {
  it('exposes initial state', () => {
    const { result } = renderHook(() => useAdminBilling());
    expect(result.current.paymentsData).toEqual([]);
    expect(result.current.paymentsPage).toBe(1);
    expect(result.current.paymentsTotal).toBe(0);
    expect(result.current.paymentStats.total_payments).toBe(0);
    expect(result.current.couponsData).toEqual([]);
    expect(result.current.couponModal).toBe(false);
    expect(result.current.couponDiscountType).toBe('percent');
  });

  it('loadPayments maps API rows and sets pagination', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      payments: [{
        id: 'abcdef123456ghi',
        user_profiles: { display_name: 'Alice', email: 'a@x.com' },
        plan: 'pro',
        amount_usd: 10,
        created_at: '2026-04-22T00:00:00Z',
        status: 'completed',
        payment_method: '카드',
      }],
      total: 42,
      total_pages: 3,
    }));

    const { result } = renderHook(() => useAdminBilling());
    await act(async () => { await result.current.loadPayments(2); });

    expect(result.current.paymentsData).toHaveLength(1);
    expect(result.current.paymentsData[0]).toMatchObject({
      id: 'ABCDEF123456',
      user: 'Alice',
      plan: 'Pro',
      status: 'completed',
    });
    expect(result.current.paymentsData[0].amount).toContain('₩');
    expect(result.current.paymentsPage).toBe(2);
    expect(result.current.paymentsTotal).toBe(42);
    expect(result.current.paymentsTotalPages).toBe(3);
  });

  it('loadPayments clears state on empty page 1', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ payments: [] }));
    const { result } = renderHook(() => useAdminBilling());
    act(() => { result.current.setPaymentsData([{ id: 'X', user: 'y', plan: 'Pro', amount: '₩10', date: '2026', status: 'completed', method: '카드' }]); });
    await act(async () => { await result.current.loadPayments(1); });

    expect(result.current.paymentsData).toEqual([]);
    expect(result.current.paymentsTotal).toBe(0);
  });

  it('loadPaymentStats writes stats', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      stats: { total_payments: 100, completed: 80, refunded: 5, pending: 15, monthly_revenue: 5000, total_revenue: 50000 },
    }));
    const { result } = renderHook(() => useAdminBilling());
    await act(async () => { await result.current.loadPaymentStats(); });

    expect(result.current.paymentStats.total_payments).toBe(100);
    expect(result.current.paymentStats.monthly_revenue).toBe(5000);
  });

  it('loadCoupons maps percent and credits coupon types', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      coupons: [
        { code: 'SPRING', discount_type: 'percent', discount_value: 30, used_count: 10, max_uses: 100, expires_at: '2026-05-31T00:00:00Z', is_active: true },
        { code: 'NEWUSER', discount_type: 'credits', discount_value: 500, used_count: 0, max_uses: null, expires_at: null, is_active: true },
      ],
    }));
    const { result } = renderHook(() => useAdminBilling());
    await act(async () => { await result.current.loadCoupons(); });

    expect(result.current.couponsData).toHaveLength(2);
    expect(result.current.couponsData[0]).toMatchObject({ code: 'SPRING', discount: '30%', type: '구독 할인' });
    expect(result.current.couponsData[1]).toMatchObject({ code: 'NEWUSER', discount: '500 CR', type: '무료 크레딧', limit: 999, expires: '무제한' });
  });

  it('toggleCoupon flips active on the matching fallback coupon', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    const { result } = renderHook(() => useAdminBilling());

    let fallback: Coupon[] = [
      { code: 'ABC', discount: '10%', type: '구독 할인', used: 0, limit: 100, expires: '-', active: true },
    ];
    const setFallback = vi.fn((u: (p: Coupon[]) => Coupon[]) => { fallback = u(fallback); });

    let out: { code: string; active: boolean } | undefined;
    await act(async () => { out = await result.current.toggleCoupon('ABC', fallback, setFallback); });

    expect(out).toEqual({ code: 'ABC', active: false });
    expect(setFallback).toHaveBeenCalled();
    expect(fallback[0].active).toBe(false);

    const call = fetchMock.mock.calls[0];
    expect(call[1].method).toBe('PATCH');
    expect(JSON.parse(call[1].body as string)).toEqual({ code: 'ABC', is_active: false });
  });

  it('createCoupon validates empty code', async () => {
    const { result } = renderHook(() => useAdminBilling());
    let out: Awaited<ReturnType<typeof result.current.createCoupon>> | undefined;
    await act(async () => { out = await result.current.createCoupon(vi.fn()); });

    expect(out?.ok).toBe(false);
    expect(out?.error).toContain('쿠폰 코드');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('createCoupon validates NaN discount', async () => {
    const { result } = renderHook(() => useAdminBilling());
    act(() => {
      result.current.setCouponCode('TEST');
      result.current.setCouponDiscount('abc');
    });
    let out: Awaited<ReturnType<typeof result.current.createCoupon>> | undefined;
    await act(async () => { out = await result.current.createCoupon(vi.fn()); });

    expect(out?.ok).toBe(false);
    expect(out?.error).toContain('숫자');
  });

  it('createCoupon posts new coupon and clears form on success', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ coupons: [] }));

    const { result } = renderHook(() => useAdminBilling());
    act(() => {
      result.current.setCouponCode('spring2026');
      result.current.setCouponDiscount('25');
      result.current.setCouponDiscountType('percent');
      result.current.setCouponMaxUses('500');
      result.current.setCouponModal(true);
    });
    let out: Awaited<ReturnType<typeof result.current.createCoupon>> | undefined;
    await act(async () => { out = await result.current.createCoupon(vi.fn()); });

    expect(out).toEqual({ ok: true, code: 'SPRING2026' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toMatchObject({ code: 'SPRING2026', discount_type: 'percent', discount_value: 25, max_uses: 500 });
    expect(result.current.couponCode).toBe('');
    expect(result.current.couponModal).toBe(false);
  });

  it('createCoupon returns error when API replies with error body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'duplicate_code' }));
    const { result } = renderHook(() => useAdminBilling());
    act(() => {
      result.current.setCouponCode('TEST');
      result.current.setCouponDiscount('10');
    });
    let out: Awaited<ReturnType<typeof result.current.createCoupon>> | undefined;
    await act(async () => { out = await result.current.createCoupon(vi.fn()); });

    expect(out?.ok).toBe(false);
    expect(out?.error).toBe('duplicate_code');
    expect(result.current.couponCode).toBe('TEST'); // form NOT cleared on error
  });
});
