import type { AdminTheme } from '../hooks/useAdminTheme';

interface CouponCreateModalProps {
  isDark: boolean;
  t: AdminTheme;
  couponCode: string;
  setCouponCode: (v: string) => void;
  couponDiscount: string;
  setCouponDiscount: (v: string) => void;
  couponDiscountType: 'percent' | 'credits';
  setCouponDiscountType: (v: 'percent' | 'credits') => void;
  couponMaxUses: string;
  setCouponMaxUses: (v: string) => void;
  couponExpires: string;
  setCouponExpires: (v: string) => void;
  onCreate: () => void;
  onClose: () => void;
}

export default function CouponCreateModal({
  isDark, t,
  couponCode, setCouponCode,
  couponDiscount, setCouponDiscount,
  couponDiscountType, setCouponDiscountType,
  couponMaxUses, setCouponMaxUses,
  couponExpires, setCouponExpires,
  onCreate, onClose,
}: CouponCreateModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className={`relative ${t.cardBg} border ${t.border2} rounded-2xl w-full max-w-md p-6 z-10`}>
        <div className="flex items-center justify-between mb-5">
          <h3 className={`text-base font-black ${t.text}`}>쿠폰 생성</h3>
          <button onClick={onClose} className={`w-7 h-7 flex items-center justify-center ${isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-400 hover:text-gray-700'} cursor-pointer transition-colors`}>
            <i className="ri-close-line text-lg" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className={`text-xs font-semibold ${t.textSub} mb-1.5 block`}>쿠폰 코드 <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="예: SUMMER2026"
              className={`w-full ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-gray-400'} focus:outline-none focus:border-indigo-500/50 font-mono uppercase`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`text-xs font-semibold ${t.textSub} mb-1.5 block`}>할인 유형 <span className="text-red-400">*</span></label>
              <select
                value={couponDiscountType}
                onChange={(e) => setCouponDiscountType(e.target.value as 'percent' | 'credits')}
                className={`w-full ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} focus:outline-none focus:border-indigo-500/50 cursor-pointer`}
              >
                <option value="percent">구독 할인 (%)</option>
                <option value="credits">무료 크레딧</option>
              </select>
            </div>
            <div>
              <label className={`text-xs font-semibold ${t.textSub} mb-1.5 block`}>
                {couponDiscountType === 'percent' ? '할인율 (%)' : '크레딧 수'} <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                value={couponDiscount}
                onChange={(e) => setCouponDiscount(e.target.value)}
                placeholder={couponDiscountType === 'percent' ? '예: 30' : '예: 500'}
                className={`w-full ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-gray-400'} focus:outline-none focus:border-indigo-500/50`}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`text-xs font-semibold ${t.textSub} mb-1.5 block`}>사용 한도</label>
              <input
                type="number"
                value={couponMaxUses}
                onChange={(e) => setCouponMaxUses(e.target.value)}
                placeholder="무제한"
                className={`w-full ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-gray-400'} focus:outline-none focus:border-indigo-500/50`}
              />
            </div>
            <div>
              <label className={`text-xs font-semibold ${t.textSub} mb-1.5 block`}>만료일</label>
              <input
                type="date"
                value={couponExpires}
                onChange={(e) => setCouponExpires(e.target.value)}
                className={`w-full ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} focus:outline-none focus:border-indigo-500/50 cursor-pointer`}
              />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={onCreate}
            disabled={!couponCode.trim() || !couponDiscount.trim()}
            className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-coupon-3-line mr-1.5" />
            DB에 쿠폰 생성
          </button>
          <button onClick={onClose} className={`flex-1 py-2.5 ${isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap`}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
