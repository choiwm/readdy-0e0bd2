// Display data for credit packages on the purchase page.
// The authoritative `amount` (KRW) and `credits` for charging live in
// supabase/functions/_shared/credit_packages.ts — keep these two in sync.

export interface CreditPackageDisplay {
  id: string;
  name: string;
  credits: number;
  price: number; // USD-ish display, informational
  priceKRW: number;
  popular: boolean;
  color: string;
  border: string;
  badge: string | null;
  perCredit: string;
  features: string[];
}

export const CREDIT_PACKAGES: CreditPackageDisplay[] = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 500,
    price: 4.9,
    priceKRW: 6900,
    popular: false,
    color: 'from-zinc-700/40 to-zinc-800/40',
    border: 'border-zinc-700/40',
    badge: null,
    perCredit: '₩13.8',
    features: ['이미지 생성 약 50회', 'TTS 약 250회', '음악 생성 약 33회'],
  },
  {
    id: 'basic',
    name: 'Basic',
    credits: 1500,
    price: 12.9,
    priceKRW: 17900,
    popular: false,
    color: 'from-indigo-900/30 to-zinc-800/40',
    border: 'border-indigo-700/30',
    badge: null,
    perCredit: '₩11.9',
    features: ['이미지 생성 약 150회', 'TTS 약 750회', '음악 생성 약 100회'],
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 4000,
    price: 29.9,
    priceKRW: 41900,
    popular: true,
    color: 'from-indigo-600/20 to-violet-700/20',
    border: 'border-indigo-500/40',
    badge: '가장 인기',
    perCredit: '₩10.5',
    features: ['이미지 생성 약 400회', 'TTS 약 2,000회', '음악 생성 약 266회', '영상 생성 약 80회'],
  },
  {
    id: 'creator',
    name: 'Creator',
    credits: 10000,
    price: 64.9,
    priceKRW: 89900,
    popular: false,
    color: 'from-violet-900/20 to-indigo-900/20',
    border: 'border-violet-600/30',
    badge: '20% 절약',
    perCredit: '₩9.0',
    features: ['이미지 생성 약 1,000회', 'TTS 약 5,000회', '음악 생성 약 666회', '영상 생성 약 200회', '우선 처리'],
  },
  {
    id: 'studio',
    name: 'Studio',
    credits: 30000,
    price: 169.9,
    priceKRW: 239000,
    popular: false,
    color: 'from-amber-900/15 to-orange-900/15',
    border: 'border-amber-600/25',
    badge: '35% 절약',
    perCredit: '₩8.0',
    features: ['이미지 생성 약 3,000회', 'TTS 약 15,000회', '음악 생성 약 2,000회', '영상 생성 약 600회', '우선 처리', '전담 지원'],
  },
];

export function getPackageById(id: string): CreditPackageDisplay | undefined {
  return CREDIT_PACKAGES.find((p) => p.id === id);
}
