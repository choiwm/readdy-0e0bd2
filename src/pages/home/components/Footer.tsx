import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/support-submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ kind: 'newsletter', email }),
        },
      );
      if (res.ok) {
        setSubscribed(true);
        setEmail('');
      } else {
        setError('구독 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="relative border-t border-white/[0.04] pt-14 md:pt-20 pb-8 md:pb-10 bg-[#06060a]">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 mb-12 md:mb-16">
          {/* Brand */}
          <div className="md:col-span-4">
            <div className="mb-6">
              <img
                src="https://static.readdy.ai/image/818485967d328b35909ddcc1d73f5659/99fa675bf72ff13d36de270333b480ff.png"
                alt="AiMetaWOW"
                className="h-12"
              />
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6 font-medium max-w-xs">
              전 세계의 모든 AI를 하나의 플랫폼으로.
              <br />
              구독 없이, 쓴 만큼만 결제하세요.
            </p>
            <div className="flex gap-2">
              {[
                { icon: 'ri-twitter-x-line', hover: 'hover:bg-sky-500/10 hover:border-sky-500/30 hover:text-sky-400' },
                { icon: 'ri-instagram-line', hover: 'hover:bg-indigo-500/10 hover:border-indigo-500/30 hover:text-indigo-400' },
                { icon: 'ri-youtube-line', hover: 'hover:bg-white/10 hover:border-white/20 hover:text-white' },
              ].map((s) => (
                <a key={s.icon} href="#" rel="nofollow" className={`w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-gray-400 transition-all duration-300 ${s.hover}`}>
                  <i className={s.icon} />
                </a>
              ))}
            </div>
          </div>

          {/* Services */}
          <div className="md:col-span-2">
            <h4 className="font-black text-xs mb-6 text-gray-300 uppercase tracking-[0.2em]">서비스</h4>
            <ul className="space-y-3">
              {[
                { label: 'AI 생성하기', href: '/ai-create' },
                { label: '크레딧 충전', href: '/credit-purchase' },
                { label: 'AI 자동화', href: '/automation-studio' },
                { label: 'AI 사운드', href: '/ai-sound' },
                { label: 'AI 광고', href: '/ai-ad' },
              ].map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="text-sm text-gray-400 hover:text-indigo-400 transition-colors font-medium">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div className="md:col-span-2">
            <h4 className="font-black text-xs mb-6 text-gray-300 uppercase tracking-[0.2em]">지원</h4>
            <ul className="space-y-3">
              {[
                { label: 'FAQ', href: '/customer-support' },
                { label: '릴리즈 노트', href: '#' },
                { label: '고객센터', href: '/customer-support' },
                { label: '이용약관', href: '/terms' },
                { label: '개인정보처리방침', href: '/privacy' },
              ].map((item) => (
                <li key={item.label}>
                  {item.href.startsWith('/') ? (
                    <Link to={item.href} className="text-sm text-gray-400 hover:text-indigo-400 transition-colors font-medium cursor-pointer">
                      {item.label}
                    </Link>
                  ) : (
                    <a href={item.href} rel="nofollow" className="text-sm text-gray-400 hover:text-indigo-400 transition-colors font-medium">
                      {item.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div className="md:col-span-4">
            <h4 className="font-black text-xs mb-4 md:mb-6 text-gray-300 uppercase tracking-[0.2em]">뉴스레터</h4>
            <p className="text-sm text-gray-400 mb-4 font-medium">새로운 AI 모델 소식을 가장 먼저 받아보세요 💌</p>
            {subscribed ? (
              <div className="flex items-center gap-2 text-indigo-400 text-sm font-bold py-3">
                <i className="ri-checkbox-circle-fill text-emerald-400" />
                구독해 주셔서 감사합니다!
              </div>
            ) : (
              <form
                data-readdy-form
                onSubmit={handleSubscribe}
                className="relative"
              >
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full bg-white/[0.03] border border-white/[0.08] text-white placeholder-gray-500 pl-4 pr-16 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/30 text-sm font-medium transition-all"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="absolute right-1.5 top-1.5 bottom-1.5 bg-gradient-to-r from-indigo-500 to-violet-500 hover:opacity-90 disabled:opacity-60 text-white px-3 md:px-5 rounded-lg font-bold text-sm transition-all hover:scale-[1.02] whitespace-nowrap cursor-pointer"
                >
                  {submitting ? (
                    <i className="ri-loader-4-line animate-spin" />
                  ) : '구독'}
                </button>
                {error && (
                  <p className="text-red-400 text-xs mt-2">{error}</p>
                )}
              </form>
            )}
          </div>
        </div>

        {/* Company Info — 전자상거래법 제10조 필수 표시 */}
        <div className="border-t border-white/[0.04] pt-6 md:pt-8 pb-4 md:pb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="text-[11px] text-gray-400 leading-relaxed space-y-0.5">
            <p className="font-bold text-gray-300">아이메타버스(주)</p>
            <p>대표: 홍길동 · 사업자등록번호: 000-00-00000</p>
            <p>통신판매업신고: 제0000-서울강남-00000호</p>
            <p>주소: 서울특별시 강남구 테헤란로 123</p>
            <p>고객지원: 1588-0000 (평일 09:00–18:00)</p>
            <p>이메일: contact@aimetawow.com</p>
            <p className="text-gray-500 mt-1">
              호스팅 서비스: Supabase Inc. · Vercel Inc.
            </p>
          </div>
          <div className="flex items-center gap-5">
            <Link
              to="/customer-support"
              className="text-[11px] text-gray-400 hover:text-indigo-400 transition-colors font-semibold whitespace-nowrap cursor-pointer"
            >
              서포터
            </Link>
            <Link
              to="/workflow"
              className="text-[11px] text-gray-400 hover:text-indigo-400 transition-colors font-semibold whitespace-nowrap cursor-pointer"
            >
              워크플로우
            </Link>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/[0.08] pt-5 md:pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-gray-400 text-xs font-medium">© 2026 AiMetaWOW — Made with ♥ in Seoul</p>
          <div className="flex flex-wrap justify-center sm:justify-end gap-4 md:gap-6 text-xs text-gray-400 font-medium">
            <a href="/admin" className="hover:text-white transition-colors cursor-pointer">관리자</a>
            <Link to="/privacy" className="hover:text-white transition-colors cursor-pointer">개인정보처리방침</Link>
            <Link to="/terms" className="hover:text-white transition-colors cursor-pointer">이용약관</Link>
            <a href="#" rel="nofollow" className="hover:text-white transition-colors">회사소개</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
