// Server-side source of truth for credit packages.
// Frontend display data (icons, badges, descriptions) lives in the page,
// but `amount` (KRW) and `credits` MUST be validated against this list
// to prevent client-side tampering during payment confirmation.

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  amount: number; // KRW, integer
}

export const CREDIT_PACKAGES: readonly CreditPackage[] = [
  { id: 'starter',  name: 'Starter',  credits: 500,   amount: 6900 },
  { id: 'basic',    name: 'Basic',    credits: 1500,  amount: 17900 },
  { id: 'pro',      name: 'Pro',      credits: 4000,  amount: 41900 },
  { id: 'creator',  name: 'Creator',  credits: 10000, amount: 89900 },
  { id: 'studio',   name: 'Studio',   credits: 30000, amount: 239000 },
] as const;

export function getPackageById(id: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((p) => p.id === id);
}
