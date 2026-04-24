import { loadTossPayments, type TossPaymentsInstance } from '@tosspayments/payment-sdk';

// Toss client (publishable) key. Safe to expose in the bundle — Toss's threat
// model has the secret key on the server only. Set in .env:
//   VITE_PUBLIC_TOSS_CLIENT_KEY="test_ck_xxx"   # dev
//   VITE_PUBLIC_TOSS_CLIENT_KEY="live_ck_xxx"   # production
// Toss provides a public test key (test_ck_docs_Ovk5rk1EwkEbP0W43n07xlzm) that
// can be used during local dev when no env var is set.
const FALLBACK_TEST_KEY = 'test_ck_docs_Ovk5rk1EwkEbP0W43n07xlzm';

export function getTossClientKey(): string {
  return import.meta.env.VITE_PUBLIC_TOSS_CLIENT_KEY ?? FALLBACK_TEST_KEY;
}

let cached: Promise<TossPaymentsInstance> | null = null;

export function getTossPayments(): Promise<TossPaymentsInstance> {
  if (!cached) {
    cached = loadTossPayments(getTossClientKey());
  }
  return cached;
}
