import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useCredits } from '@/hooks/useCredits';
import { useAuth } from '@/hooks/useAuth';
import { getAuthorizationHeader } from '@/lib/env';

const CREDIT_PACKAGES = [
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

const USAGE_GUIDE = [
  { icon: 'ri-image-ai-line', label: 'AI 이미지 생성', color: 'text-indigo-400', bg: 'bg-indigo-500/10', items: [
    { model: 'Flux Realism', cost: '5 CR' },
    { model: 'Flux Pro', cost: '10 CR' },
    { model: 'Flux Pro Ultra', cost: '20 CR' },
    { model: 'DALL·E 3', cost: '15 CR' },
  ]},
  { icon: 'ri-video-ai-line', label: 'AI 영상 생성', color: 'text-violet-400', bg: 'bg-violet-500/10', items: [
    { model: 'Kling 5s', cost: '50 CR' },
    { model: 'Kling 10s', cost: '100 CR' },
    { model: 'Seedance 5s', cost: '60 CR' },
    { model: 'Seedance 10s', cost: '120 CR' },
  ]},
  { icon: 'ri-mic-ai-line', label: 'AI 음성 (TTS)', color: 'text-emerald-400', bg: 'bg-emerald-500/10', items: [
    { model: '100자 기준', cost: '2 CR' },
    { model: '500자 기준', cost: '10 CR' },
    { model: '1,000자 기준', cost: '20 CR' },
    { model: '클론 보이스', cost: '+5 CR' },
  ]},
  { icon: 'ri-music-ai-line', label: 'AI 음악 생성', color: 'text-amber-400', bg: 'bg-amber-500/10', items: [
    { model: 'Suno (30초)', cost: '10 CR' },
    { model: 'Suno (1분)', cost: '15 CR' },
    { model: 'Suno (2분)', cost: '25 CR' },
    { model: '음악 연장', cost: '10 CR' },
  ]},
];

const FAQ_ITEMS = [
  { q: '크레딧은 언제 만료되나요?', a: '구매한 크레딧은 구매일로부터 1년간 유효합니다. 유효기간 내에 사용하지 않은 크레딧은 자동 소멸됩니다.' },
  { q: '크레딧을 환불받을 수 있나요?', a: '구매 후 7일 이내, 사용하지 않은 크레딧에 한해 전액 환불이 가능합니다. 고객지원 페이지를 통해 환불 요청해 주세요.' },
  { q: '크레딧이 부족하면 어떻게 되나요?', a: '크레딧이 부족하면 AI 생성 기능이 제한됩니다. 생성 시도 시 크레딧 부족 안내와 함께 충전 페이지로 안내됩니다.' },
  { q: '여러 패키지를 동시에 구매할 수 있나요?', a: '네, 여러 패키지를 구매하면 크레딧이 합산됩니다. 대량 구매 시 더 높은 할인율이 적용됩니다.' },
];

// 크레딧 알림 설정 훅
function useCreditAlertSettings(userId: string | null) {
  const [settings, setSettings] = useState({
    email_enabled: true,
    alert_on_pct: true,
    alert_on_amount: false,
    threshold_pct: 20,
    threshold_amount: 100,
    alert_cooldown_hours: 24,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/credit-alert-notify?action=get_settings&user_id=${userId}`,
        { headers: { 'Authorization': getAuthorizationHeader() } }
      );
      const data = await res.json();
      if (data.settings) {
        setSettings((prev) => ({ ...prev, ...data.settings }));
      }
    } catch { /* 기본값 유지 */ }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async () => {
    if (!userId) return;
    setSaving(true);
    try {
      await fetch(
        `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/credit-alert-notify?action=save_settings`,
        {
          method: 'POST',
          headers: {
            'Authorization': getAuthorizationHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: userId, ...settings }),
        }
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* 무시 */ }
    setSaving(false);
  }, [userId, settings]);

  return { settings, setSettings, save, saving, saved };
}

export default function CreditPurchasePage() {
  const { credits } = useCredits();
  const { isLoggedIn, profile } = useAuth();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAlertSettings, setShowAlertSettings] = useState(false);

  const { settings: alertSettings, setSettings: setAlertSettings, save: saveAlertSettings, saving: alertSaving, saved: alertSaved } =
    useCreditAlertSettings(isLoggedIn && profile ? profile.id : null);

  useEffect(() => {
    document.title = '크레딧 충전 — AI 생성 크레딧 구매 | AiMetaWOW';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', 'AiMetaWOW 크레딧을 충전하고 AI 이미지, 영상, 음성, 음악 생성을 마음껏 즐기세요. 다양한 패키지로 합리적인 가격에 이용하세요.');
    }
    return () => {
      document.title = 'AiMetaWOW — AI 이미지·영상·음성 생성 크리에이티브 플랫폼';
    };
  }, []);

  const selectedPkg = CREDIT_PACKAGES.find((p) => p.id === selectedPackage);

  const handleBuyClick = (pkgId: string) => {
    setSelectedPackage(pkgId);
    setShowPaymentModal(true);
  };

  const _handlePaymentConfirm = () => {
    // 결제 시스템 준비 중 — 실제 결제 연동 전까지 고객지원으로 안내
    // 절대로 크레딧을 직접 지급하지 않음
    setShowPaymentModal(false);
  };

  return (
    <div className="min-h-screen bg-[#06060a] text-white">
      {/* Top Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/95 border-b border-white/5 backdrop-blur-xl py-3 px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center cursor-pointer group">
            <img
              src="https://static.readdy.ai/image/818485967d328b35909ddcc1d73f5659/99fa675bf72ff13d36de270333b480ff.png"
              alt="AiMetaWOW"
              className="h-8 transition-all duration-300 group-hover:scale-105"
            />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-zinc-900/80 border border-zinc-700/60 px-3 py-1.5 rounded-lg">
              <i className="ri-copper-diamond-line text-amber-400 text-sm" />
              <span className="text-xs font-bold text-zinc-300">{credits.toLocaleString()} CR</span>
            </div>
            <Link to="/ai-create">
              <button className="text-sm font-bold text-zinc-400 hover:text-white transition-colors whitespace-nowrap cursor-pointer px-3 py-1.5 rounded-lg hover:bg-zinc-800/60">
                AI Create
              </button>
            </Link>
            <Link to="/customer-support">
              <button className="text-sm font-bold text-zinc-400 hover:text-white transition-colors whitespace-nowrap cursor-pointer px-3 py-1.5 rounded-lg hover:bg-zinc-800/60">
                Support
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-12 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-indigo-500/6 rounded-full blur-3xl" />
          <div className="absolute top-20 right-1/4 w-[400px] h-[300px] bg-amber-500/4 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold px-4 py-2 rounded-full mb-6">
            <i className="ri-copper-diamond-line" />
            크레딧 충전
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight">
            쓴 만큼만 결제하세요
          </h1>
          <p className="text-gray-500 text-base md:text-lg font-medium mb-6 max-w-xl mx-auto">
            구독 없이, 크레딧을 충전해서 AI 이미지·영상·음성·음악을 자유롭게 생성하세요.
          </p>
          {/* Current balance */}
          <div className="inline-flex items-center gap-3 bg-zinc-900/60 border border-zinc-700/40 px-5 py-3 rounded-2xl">
            <div className="w-8 h-8 flex items-center justify-center bg-amber-500/15 rounded-lg">
              <i className="ri-copper-diamond-line text-amber-400" />
            </div>
            <div className="text-left">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">현재 잔액</p>
              <p className="text-lg font-black text-white">{credits.toLocaleString()} <span className="text-sm text-zinc-400 font-bold">CR</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* Packages */}
      <section className="pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {CREDIT_PACKAGES.map((pkg) => (
              <div
                key={pkg.id}
                className={`relative bg-gradient-to-b ${pkg.color} border ${pkg.border} rounded-2xl p-5 flex flex-col transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${
                  pkg.popular ? 'ring-1 ring-indigo-500/40' : ''
                }`}
              >
                {pkg.badge && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-black whitespace-nowrap ${
                    pkg.popular
                      ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white'
                      : 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
                  }`}>
                    {pkg.badge}
                  </div>
                )}

                <div className="mb-4">
                  <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">{pkg.name}</p>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-2xl font-black text-white">{pkg.credits.toLocaleString()}</span>
                    <span className="text-zinc-400 text-sm mb-0.5">CR</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black text-white">₩{pkg.priceKRW.toLocaleString()}</span>
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-1">크레딧당 {pkg.perCredit}</p>
                </div>

                <div className="flex-1 space-y-1.5 mb-5">
                  {pkg.features.map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <i className="ri-check-line text-indigo-400 text-xs flex-shrink-0" />
                      <span className="text-xs text-zinc-400">{f}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleBuyClick(pkg.id)}
                  className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer whitespace-nowrap ${
                    pkg.popular
                      ? 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white'
                      : 'bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/60 text-zinc-200 hover:text-white'
                  }`}
                >
                  구매하기
                </button>
              </div>
            ))}
          </div>

          {/* Enterprise */}
          <div className="mt-6 bg-gradient-to-r from-zinc-900/60 to-zinc-800/40 border border-zinc-700/30 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 flex items-center justify-center bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex-shrink-0">
                <i className="ri-building-line text-indigo-400 text-xl" />
              </div>
              <div>
                <p className="font-black text-white mb-0.5">Enterprise / 대량 구매</p>
                <p className="text-sm text-zinc-500">100,000 CR 이상 대량 구매 시 최대 50% 할인 및 전담 지원 제공</p>
              </div>
            </div>
            <Link to="/customer-support">
              <button className="flex items-center gap-2 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/25 text-indigo-400 font-bold text-sm px-5 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap">
                <i className="ri-mail-send-line" />
                문의하기
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Usage Guide */}
      <section className="pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-black mb-2">크레딧 사용 가이드</h2>
            <p className="text-zinc-500 text-sm font-medium">기능별 크레딧 소모량을 확인하세요</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {USAGE_GUIDE.map((guide) => (
              <div key={guide.label} className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-9 h-9 flex items-center justify-center ${guide.bg} rounded-xl`}>
                    <i className={`${guide.icon} ${guide.color} text-lg`} />
                  </div>
                  <p className="font-black text-sm text-white">{guide.label}</p>
                </div>
                <div className="space-y-2">
                  {guide.items.map((item) => (
                    <div key={item.model} className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">{item.model}</span>
                      <span className={`text-xs font-black ${guide.color}`}>{item.cost}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Credits */}
      <section className="pb-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gradient-to-br from-indigo-950/30 to-violet-950/20 border border-indigo-800/20 rounded-3xl p-8 md:p-12">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-black mb-2">왜 크레딧 방식인가요?</h2>
              <p className="text-zinc-500 text-sm font-medium">구독보다 합리적인 이유</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { icon: 'ri-scales-3-line', title: '쓴 만큼만 결제', desc: '매달 고정 구독료 없이, 실제로 사용한 만큼만 크레딧이 차감됩니다. 적게 쓰는 달엔 더 절약할 수 있어요.', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                { icon: 'ri-timer-line', title: '1년 유효기간', desc: '구매한 크레딧은 1년간 유효합니다. 급하게 다 쓸 필요 없이 여유롭게 사용하세요.', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                { icon: 'ri-exchange-line', title: '모든 기능 공유', desc: '이미지, 영상, 음성, 음악 등 모든 AI 기능에 동일한 크레딧을 사용합니다. 기능별 별도 구독 불필요.', color: 'text-amber-400', bg: 'bg-amber-500/10' },
              ].map((item) => (
                <div key={item.title} className="text-center">
                  <div className={`w-14 h-14 flex items-center justify-center ${item.bg} rounded-2xl mx-auto mb-4`}>
                    <i className={`${item.icon} ${item.color} text-2xl`} />
                  </div>
                  <h3 className="font-black text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-zinc-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Credit Alert Settings */}
      {isLoggedIn && (
        <section className="pb-12 px-4">
          <div className="max-w-3xl mx-auto">
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl overflow-hidden">
              <button
                onClick={() => setShowAlertSettings((v) => !v)}
                className="w-full flex items-center justify-between px-6 py-4 cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 flex items-center justify-center bg-amber-500/10 rounded-xl">
                    <i className="ri-notification-3-line text-amber-400 text-base" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm text-white">크레딧 부족 알림 설정</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {alertSettings.email_enabled ? '앱 알림 활성화됨' : '앱 알림 꺼짐'} · 잔액 {alertSettings.threshold_pct}% 이하 시 알림
                    </p>
                  </div>
                </div>
                <i className={`ri-arrow-down-s-line text-zinc-500 text-lg transition-transform duration-300 ${showAlertSettings ? 'rotate-180' : ''}`} />
              </button>

              {showAlertSettings && (
                <div className="px-6 pb-6 border-t border-zinc-800/60 pt-5 space-y-5">
                  {/* App notification toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">앱 내 알림</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">크레딧 부족 시 상단 알림 벨로 충전 안내를 받습니다</p>
                    </div>
                    <button
                      onClick={() => setAlertSettings((prev) => ({ ...prev, email_enabled: !prev.email_enabled }))}
                      className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative flex-shrink-0 ${alertSettings.email_enabled ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${alertSettings.email_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>

                  {alertSettings.email_enabled && (
                    <>
                      {/* Alert type */}
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-zinc-400">알림 기준</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setAlertSettings((prev) => ({ ...prev, alert_on_pct: !prev.alert_on_pct }))}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                              alertSettings.alert_on_pct
                                ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                                : 'bg-zinc-800/60 border-zinc-700/40 text-zinc-500'
                            }`}
                          >
                            <i className={`ri-percent-line text-sm ${alertSettings.alert_on_pct ? 'text-indigo-400' : 'text-zinc-600'}`} />
                            <div>
                              <p className="text-xs font-bold">비율 기준</p>
                              <p className="text-[10px] opacity-70">잔액 {alertSettings.threshold_pct}% 이하</p>
                            </div>
                          </button>
                          <button
                            onClick={() => setAlertSettings((prev) => ({ ...prev, alert_on_amount: !prev.alert_on_amount }))}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                              alertSettings.alert_on_amount
                                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                                : 'bg-zinc-800/60 border-zinc-700/40 text-zinc-500'
                            }`}
                          >
                            <i className={`ri-copper-diamond-line text-sm ${alertSettings.alert_on_amount ? 'text-amber-400' : 'text-zinc-600'}`} />
                            <div>
                              <p className="text-xs font-bold">수량 기준</p>
                              <p className="text-[10px] opacity-70">{alertSettings.threshold_amount} CR 이하</p>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Threshold sliders */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {alertSettings.alert_on_pct && (
                          <div className="bg-zinc-800/40 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-xs font-semibold text-zinc-400">비율 임계값</label>
                              <span className="text-sm font-black text-indigo-400">{alertSettings.threshold_pct}%</span>
                            </div>
                            <input
                              type="range"
                              min={5}
                              max={50}
                              step={5}
                              value={alertSettings.threshold_pct}
                              onChange={(e) => setAlertSettings((prev) => ({ ...prev, threshold_pct: Number(e.target.value) }))}
                              className="w-full accent-indigo-500 cursor-pointer"
                            />
                            <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                              <span>5%</span><span>50%</span>
                            </div>
                          </div>
                        )}
                        {alertSettings.alert_on_amount && (
                          <div className="bg-zinc-800/40 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-xs font-semibold text-zinc-400">수량 임계값</label>
                              <span className="text-sm font-black text-amber-400">{alertSettings.threshold_amount} CR</span>
                            </div>
                            <input
                              type="range"
                              min={50}
                              max={500}
                              step={50}
                              value={alertSettings.threshold_amount}
                              onChange={(e) => setAlertSettings((prev) => ({ ...prev, threshold_amount: Number(e.target.value) }))}
                              className="w-full accent-amber-500 cursor-pointer"
                            />
                            <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                              <span>50 CR</span><span>500 CR</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Cooldown */}
                      <div className="flex items-center justify-between bg-zinc-800/40 rounded-xl px-4 py-3">
                        <div>
                          <p className="text-xs font-semibold text-zinc-300">알림 쿨다운</p>
                          <p className="text-[10px] text-zinc-600 mt-0.5">같은 알림을 다시 받기까지의 대기 시간</p>
                        </div>
                        <select
                          value={alertSettings.alert_cooldown_hours}
                          onChange={(e) => setAlertSettings((prev) => ({ ...prev, alert_cooldown_hours: Number(e.target.value) }))}
                          className="bg-zinc-700 border border-zinc-600 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                        >
                          <option value={6}>6시간</option>
                          <option value={12}>12시간</option>
                          <option value={24}>24시간</option>
                          <option value={48}>48시간</option>
                          <option value={72}>72시간</option>
                        </select>
                      </div>
                    </>
                  )}

                  <button
                    onClick={saveAlertSettings}
                    disabled={alertSaving}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 ${
                      alertSaved
                        ? 'bg-emerald-500 text-white'
                        : 'bg-indigo-500 hover:bg-indigo-400 text-white'
                    }`}
                  >
                    {alertSaving ? (
                      <i className="ri-loader-4-line animate-spin text-sm" />
                    ) : alertSaved ? (
                      <><i className="ri-check-line text-sm" />저장됨!</>
                    ) : (
                      <><i className="ri-save-line text-sm" />알림 설정 저장</>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="pb-20 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black mb-2">자주 묻는 질문</h2>
          </div>
          <div className="space-y-3">
            {FAQ_ITEMS.map((faq, i) => (
              <div key={i} className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left cursor-pointer group"
                >
                  <span className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors pr-4">{faq.q}</span>
                  <span className={`w-6 h-6 flex items-center justify-center flex-shrink-0 text-zinc-500 transition-transform duration-300 ${openFaq === i ? 'rotate-180 text-indigo-400' : ''}`}>
                    <i className="ri-arrow-down-s-line text-lg" />
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 border-t border-zinc-800/60">
                    <p className="text-sm text-zinc-400 leading-relaxed pt-4">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] py-8 px-4 bg-[#06060a]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-zinc-700 text-xs font-medium">© 2026 AiMetaWOW — Made with ♥ in Seoul</p>
          <div className="flex gap-6 text-xs text-zinc-700 font-medium">
            <Link to="/privacy" className="hover:text-zinc-400 transition-colors cursor-pointer">개인정보처리방침</Link>
            <Link to="/terms" className="hover:text-zinc-400 transition-colors cursor-pointer">이용약관</Link>
            <Link to="/customer-support" className="hover:text-zinc-400 transition-colors cursor-pointer">고객지원</Link>
            <Link to="/" className="hover:text-zinc-400 transition-colors cursor-pointer">홈으로</Link>
          </div>
        </div>
      </footer>

      {/* Payment Modal */}
      {showPaymentModal && selectedPkg && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowPaymentModal(false)}
        >
          <div
            className="bg-zinc-900 border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md sm:mx-4 overflow-hidden shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile drag indicator */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-zinc-700 rounded-full sm:hidden" />

            <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-white/5">
              <div>
                <h3 className="font-bold text-white text-base">크레딧 구매 안내</h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">선택하신 패키지 정보를 확인하세요</p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer">
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Order summary */}
              <div className="bg-zinc-800/50 border border-white/5 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center bg-amber-500/15 border border-amber-500/20 rounded-xl">
                      <i className="ri-copper-diamond-line text-amber-400 text-lg" />
                    </div>
                    <div>
                      <p className="font-black text-white text-sm">{selectedPkg.name} 패키지</p>
                      <p className="text-xs text-zinc-500">{selectedPkg.credits.toLocaleString()} 크레딧</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-white">₩{selectedPkg.priceKRW.toLocaleString()}</p>
                    <p className="text-[10px] text-zinc-600">크레딧당 {selectedPkg.perCredit}</p>
                  </div>
                </div>
                <div className="border-t border-white/5 pt-3 flex items-center justify-between">
                  <span className="text-xs text-zinc-500">유효기간</span>
                  <span className="text-xs font-bold text-zinc-300">구매일로부터 1년</span>
                </div>
              </div>

              {/* Payment notice */}
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-indigo-500/8 border border-indigo-500/20">
                <i className="ri-information-line text-indigo-400 text-sm mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-indigo-400 mb-0.5">구매 문의 안내</p>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    아래 고객지원 버튼을 눌러 구매를 진행해 주세요. 선택하신 패키지 정보와 함께 문의하시면 빠르게 처리해 드립니다.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <Link to="/customer-support" onClick={() => setShowPaymentModal(false)}>
                  <button className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2">
                    <i className="ri-mail-send-line" />
                    고객지원으로 문의하기
                  </button>
                </Link>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="w-full py-3 bg-zinc-800/60 hover:bg-zinc-700/60 border border-white/5 text-zinc-400 font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
