import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const FAQ_CATEGORIES = [
  { id: 'all', label: '전체', icon: 'ri-apps-line' },
  { id: 'credits', label: '크레딧', icon: 'ri-coin-line' },
  { id: 'ai-create', label: 'AI 생성', icon: 'ri-image-ai-line' },
  { id: 'ai-sound', label: 'AI 사운드', icon: 'ri-music-ai-line' },
  { id: 'ai-automation', label: 'AI 자동화', icon: 'ri-robot-line' },
  { id: 'account', label: '계정', icon: 'ri-user-line' },
  { id: 'billing', label: '결제', icon: 'ri-bank-card-line' },
];

const FAQ_ITEMS = [
  {
    id: 1,
    category: 'credits',
    question: '크레딧은 어떻게 충전하나요?',
    answer: '상단 메뉴의 "Buy Credits" 버튼을 클릭하거나 /credit-purchase 페이지에서 원하는 크레딧 패키지를 선택해 결제하실 수 있습니다. 결제 완료 후 즉시 크레딧이 지급됩니다.',
  },
  {
    id: 2,
    category: 'credits',
    question: '크레딧은 얼마나 오래 유효한가요?',
    answer: '구매한 크레딧은 구매일로부터 1년간 유효합니다. 유효기간 내에 사용하지 않은 크레딧은 자동으로 소멸되니 기간 내에 사용해 주세요.',
  },
  {
    id: 3,
    category: 'credits',
    question: '크레딧이 갑자기 사라졌어요.',
    answer: '크레딧은 AI 생성 작업 시 소모됩니다. 이미지 생성, 영상 생성, TTS, 음악 생성 등 각 기능마다 소모량이 다릅니다. 크레딧 사용 내역은 계정 페이지에서 확인하실 수 있습니다. 비정상적인 소모가 의심되시면 문의 폼을 통해 연락해 주세요.',
  },
  {
    id: 4,
    category: 'ai-create',
    question: 'AI 이미지 생성이 실패해요.',
    answer: '이미지 생성 실패는 주로 다음 원인으로 발생합니다: (1) 크레딧 부족 — 크레딧을 충전해 주세요. (2) 부적절한 프롬프트 — 정책에 위반되는 내용이 포함된 경우 생성이 거부됩니다. (3) 서버 과부하 — 잠시 후 다시 시도해 주세요.',
  },
  {
    id: 5,
    category: 'ai-create',
    question: '생성된 이미지의 저작권은 누구에게 있나요?',
    answer: 'AiMetaWOW에서 생성된 이미지의 저작권은 생성한 사용자에게 귀속됩니다. 단, 상업적 이용 시 이용약관을 반드시 확인해 주세요. AI 생성 이미지임을 명시하는 것을 권장합니다.',
  },
  {
    id: 6,
    category: 'ai-create',
    question: '어떤 이미지 모델을 사용하나요?',
    answer: 'AiMetaWOW는 Flux Realism, Flux Pro, Flux Pro Ultra, DALL·E 3 등 최신 AI 이미지 생성 모델을 지원합니다. 각 모델마다 특성이 다르므로 원하는 스타일에 맞게 선택해 사용하세요.',
  },
  {
    id: 7,
    category: 'ai-sound',
    question: 'TTS(텍스트 음성 변환)가 작동하지 않아요.',
    answer: 'TTS 기능은 GoAPI 키가 필요합니다. 관리자 설정에서 API 키가 올바르게 입력되어 있는지 확인해 주세요. 키가 정상적으로 설정되어 있음에도 오류가 발생한다면 문의 폼으로 연락해 주세요.',
  },
  {
    id: 8,
    category: 'ai-sound',
    question: '음악 생성에 사용되는 모델은 무엇인가요?',
    answer: 'AI 음악 생성은 GoAPI를 통한 Suno AI 모델을 사용합니다. 장르, 분위기, 악기 등을 프롬프트로 입력하면 최대 2분 분량의 음악을 생성할 수 있습니다.',
  },
  {
    id: 9,
    category: 'ai-automation',
    question: 'AI 자동화로 어떤 영상을 만들 수 있나요?',
    answer: 'AI Automation은 유튜브 쇼츠, 광고 영상, 제품 소개 영상 등 다양한 형식의 영상을 자동으로 제작합니다. 주제와 스타일을 입력하면 스크립트 작성부터 이미지 생성, 영상 편집까지 자동으로 처리됩니다.',
  },
  {
    id: 10,
    category: 'ai-automation',
    question: '영상 생성에 얼마나 걸리나요?',
    answer: '영상 생성 시간은 영상 길이와 복잡도에 따라 다릅니다. 일반적으로 30초~1분 영상은 3~5분, 긴 영상은 10분 이상 소요될 수 있습니다. 생성 중에는 다른 작업을 진행하셔도 됩니다.',
  },
  {
    id: 11,
    category: 'account',
    question: '계정 없이도 서비스를 이용할 수 있나요?',
    answer: '일부 기능은 계정 없이도 체험해 볼 수 있습니다. 단, 크레딧 구매 및 생성 결과물 저장, 히스토리 관리 등의 기능은 로그인이 필요합니다.',
  },
  {
    id: 12,
    category: 'account',
    question: '비밀번호를 잊어버렸어요.',
    answer: '로그인 페이지에서 "비밀번호 찾기"를 클릭하시면 가입 시 사용한 이메일로 재설정 링크가 발송됩니다. 이메일을 받지 못하셨다면 스팸 폴더를 확인하거나 고객 문의를 통해 연락해 주세요.',
  },
  {
    id: 13,
    category: 'billing',
    question: '환불 정책이 어떻게 되나요?',
    answer: '크레딧 구매 후 7일 이내, 사용하지 않은 크레딧에 한해 전액 환불이 가능합니다. 이미 사용된 크레딧은 환불되지 않습니다. 환불 요청은 고객 문의 폼을 통해 접수해 주세요.',
  },
  {
    id: 14,
    category: 'billing',
    question: '어떤 결제 수단을 지원하나요?',
    answer: '신용카드(Visa, Mastercard, 국내 카드), 체크카드, 카카오페이, 네이버페이 등 다양한 결제 수단을 지원합니다. 결제 관련 문의는 고객 문의 폼을 통해 접수해 주세요.',
  },
];

const CONTACT_TYPES = [
  { value: '크레딧/결제 문의', label: '크레딧/결제 문의' },
  { value: 'AI 생성 오류', label: 'AI 생성 오류' },
  { value: 'AI 사운드 문의', label: 'AI 사운드 문의' },
  { value: 'AI 자동화 문의', label: 'AI 자동화 문의' },
  { value: '계정 문의', label: '계정 문의' },
  { value: '환불 요청', label: '환불 요청' },
  { value: '기타 문의', label: '기타 문의' },
];

export default function CustomerSupportPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    type: '',
    message: '',
  });
  const [charCount, setCharCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    document.title = '고객지원 — FAQ & 문의 | AiMetaWOW';
  }, []);

  const filteredFaqs = FAQ_ITEMS.filter((faq) => {
    const matchCategory = activeCategory === 'all' || faq.category === activeCategory;
    const matchSearch =
      searchQuery === '' ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= 500) {
      setFormData((prev) => ({ ...prev, message: val }));
      setCharCount(val.length);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (charCount > 500) return;
    setSubmitting(true);
    setSubmitStatus('idle');
    try {
      const res = await fetch(
        `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/support-submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            kind: 'inquiry',
            name: formData.name,
            email: formData.email,
            subject: formData.type || '일반 문의',
            message: formData.message,
          }),
        },
      );
      if (res.ok) {
        setSubmitStatus('success');
        setFormData({ name: '', email: '', type: '', message: '' });
        setCharCount(0);
      } else {
        setSubmitStatus('error');
      }
    } catch {
      setSubmitStatus('error');
    } finally {
      setSubmitting(false);
    }
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
            <Link to="/ai-create" className="text-sm font-bold text-zinc-400 hover:text-white transition-colors whitespace-nowrap cursor-pointer">
              AI Create
            </Link>
            <Link to="/credit-purchase" className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:opacity-90 text-white px-4 py-2 rounded-full font-bold text-sm transition-all hover:scale-105 whitespace-nowrap cursor-pointer">
              Buy Credits
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/20 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold px-4 py-2 rounded-full mb-6">
            <i className="ri-customer-service-2-line" />
            고객지원 센터
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight">
            무엇을 도와드릴까요?
          </h1>
          <p className="text-gray-500 text-lg font-medium mb-10">
            자주 묻는 질문을 확인하거나, 직접 문의를 남겨주세요.
          </p>
          {/* Search */}
          <div className="relative max-w-xl mx-auto">
            <div className="w-5 h-5 flex items-center justify-center absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
              <i className="ri-search-line text-lg" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="질문을 검색해보세요..."
              className="w-full bg-white/[0.04] border border-white/[0.08] text-white placeholder-gray-600 pl-12 pr-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/30 text-sm font-medium transition-all"
            />
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="pb-12 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: 'ri-coin-line', label: '크레딧 충전', desc: '크레딧 구매 및 관리', to: '/credit-purchase', color: 'from-amber-500/10 to-orange-500/10 border-amber-500/20 hover:border-amber-500/40' },
            { icon: 'ri-image-ai-line', label: 'AI Create', desc: 'AI 이미지·영상 생성', to: '/ai-create', color: 'from-indigo-500/10 to-violet-500/10 border-indigo-500/20 hover:border-indigo-500/40' },
            { icon: 'ri-music-ai-line', label: 'AI Sound', desc: 'TTS·음악·SFX 생성', to: '/ai-sound', color: 'from-emerald-500/10 to-teal-500/10 border-emerald-500/20 hover:border-emerald-500/40' },
            { icon: 'ri-robot-line', label: 'AI Automation', desc: '영상 자동화 제작', to: '/automation-studio', color: 'from-rose-500/10 to-pink-500/10 border-rose-500/20 hover:border-rose-500/40' },
          ].map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className={`bg-gradient-to-br ${item.color} border rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] cursor-pointer group`}
            >
              <div className="w-10 h-10 flex items-center justify-center mb-3 text-2xl text-white/70 group-hover:text-white transition-colors">
                <i className={item.icon} />
              </div>
              <p className="font-black text-sm text-white mb-1">{item.label}</p>
              <p className="text-xs text-gray-500 font-medium">{item.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="pb-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-black mb-2">자주 묻는 질문</h2>
            <p className="text-gray-500 text-sm font-medium">궁금한 내용을 카테고리별로 찾아보세요</p>
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2 mb-8 justify-center">
            {FAQ_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 whitespace-nowrap cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-indigo-500 text-white'
                    : 'bg-white/[0.04] border border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                <span className="w-4 h-4 flex items-center justify-center">
                  <i className={cat.icon} />
                </span>
                {cat.label}
              </button>
            ))}
          </div>

          {/* FAQ List */}
          <div className="space-y-3">
            {filteredFaqs.length === 0 ? (
              <div className="text-center py-16 text-gray-600">
                <div className="w-12 h-12 flex items-center justify-center mx-auto mb-3 text-4xl">
                  <i className="ri-search-line" />
                </div>
                <p className="font-bold text-sm">검색 결과가 없습니다</p>
                <p className="text-xs mt-1">다른 키워드로 검색하거나 아래 문의 폼을 이용해 주세요</p>
              </div>
            ) : (
              filteredFaqs.map((faq) => (
                <div
                  key={faq.id}
                  className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden transition-all duration-200 hover:border-white/[0.1]"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === faq.id ? null : faq.id)}
                    className="w-full flex items-center justify-between px-6 py-5 text-left cursor-pointer group"
                  >
                    <span className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors pr-4">
                      {faq.question}
                    </span>
                    <span className={`w-6 h-6 flex items-center justify-center flex-shrink-0 text-gray-500 transition-transform duration-300 ${openFaq === faq.id ? 'rotate-180 text-indigo-400' : ''}`}>
                      <i className="ri-arrow-down-s-line text-lg" />
                    </span>
                  </button>
                  {openFaq === faq.id && (
                    <div className="px-6 pb-5 border-t border-white/[0.04]">
                      <p className="text-sm text-gray-400 leading-relaxed font-medium pt-4">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="pb-24 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-3xl p-8 md:p-10">
            <div className="text-center mb-8">
              <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-2xl text-indigo-400">
                <i className="ri-mail-send-line" />
              </div>
              <h2 className="text-2xl font-black mb-2">직접 문의하기</h2>
              <p className="text-gray-500 text-sm font-medium">
                FAQ에서 해결되지 않은 문제는 아래 폼으로 문의해 주세요.<br />
                영업일 기준 1~2일 내에 답변드립니다.
              </p>
            </div>

            {submitStatus === 'success' ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-3xl text-emerald-400">
                  <i className="ri-checkbox-circle-line" />
                </div>
                <h3 className="text-xl font-black mb-2 text-emerald-400">문의가 접수되었습니다!</h3>
                <p className="text-gray-500 text-sm font-medium mb-6">
                  영업일 기준 1~2일 내에 입력하신 이메일로 답변드리겠습니다.
                </p>
                <button
                  onClick={() => setSubmitStatus('idle')}
                  className="bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white px-6 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer whitespace-nowrap"
                >
                  새 문의 작성
                </button>
              </div>
            ) : (
              <form data-readdy-form id="customer-support-form" onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">
                      이름 <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="홍길동"
                      className="w-full bg-white/[0.04] border border-white/[0.08] text-white placeholder-gray-700 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/30 text-sm font-medium transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">
                      이메일 <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="your@email.com"
                      className="w-full bg-white/[0.04] border border-white/[0.08] text-white placeholder-gray-700 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/30 text-sm font-medium transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">
                    문의 유형 <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <select
                      name="type"
                      required
                      value={formData.type}
                      onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/[0.08] text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/30 text-sm font-medium transition-all appearance-none cursor-pointer"
                    >
                      <option value="" disabled className="bg-zinc-900">문의 유형을 선택해주세요</option>
                      {CONTACT_TYPES.map((t) => (
                        <option key={t.value} value={t.value} className="bg-zinc-900">{t.label}</option>
                      ))}
                    </select>
                    <div className="w-5 h-5 flex items-center justify-center absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                      <i className="ri-arrow-down-s-line" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">
                    문의 내용 <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    name="message"
                    required
                    value={formData.message}
                    onChange={handleMessageChange}
                    placeholder="문의하실 내용을 자세히 작성해 주세요. 오류가 발생한 경우 어떤 기능을 사용하다가 발생했는지, 오류 메시지는 무엇인지 함께 알려주시면 빠른 해결에 도움이 됩니다."
                    rows={6}
                    className="w-full bg-white/[0.04] border border-white/[0.08] text-white placeholder-gray-700 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/30 text-sm font-medium transition-all resize-none"
                  />
                  <div className={`text-right text-xs mt-1 font-medium ${charCount > 480 ? 'text-rose-400' : 'text-gray-600'}`}>
                    {charCount} / 500
                  </div>
                </div>

                {submitStatus === 'error' && (
                  <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-bold px-4 py-3 rounded-xl">
                    <div className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-error-warning-line" />
                    </div>
                    문의 전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || charCount > 500}
                  className="w-full bg-gradient-to-r from-indigo-500 to-violet-500 hover:opacity-90 disabled:opacity-50 text-white py-4 rounded-xl font-black text-sm transition-all hover:scale-[1.01] whitespace-nowrap cursor-pointer"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <i className="ri-loader-4-line animate-spin" />
                      전송 중...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <i className="ri-send-plane-line" />
                      문의 보내기
                    </span>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Additional Contact Info */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                <i className="ri-time-line" />
              </div>
              <div>
                <p className="font-black text-sm text-white mb-1">운영 시간</p>
                <p className="text-xs text-gray-500 font-medium leading-relaxed">
                  평일 09:00 ~ 18:00<br />
                  (주말·공휴일 휴무)
                </p>
              </div>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                <i className="ri-mail-line" />
              </div>
              <div>
                <p className="font-black text-sm text-white mb-1">이메일 문의</p>
                <p className="text-xs text-gray-500 font-medium leading-relaxed">
                  contact@aimetawow.com<br />
                  1~2 영업일 내 답변
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] py-8 px-4 bg-[#06060a]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-gray-700 text-xs font-medium">© 2026 AiMetaWOW — Made with ♥ in Seoul</p>
          <div className="flex gap-6 text-xs text-gray-700 font-medium">
            <Link to="/privacy" className="hover:text-gray-400 transition-colors cursor-pointer">개인정보처리방침</Link>
            <Link to="/terms" className="hover:text-gray-400 transition-colors cursor-pointer">이용약관</Link>
            <Link to="/" className="hover:text-gray-400 transition-colors cursor-pointer">홈으로</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
