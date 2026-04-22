import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const SECTIONS = [
  { id: 'overview', title: '제1조 (목적)' },
  { id: 'definitions', title: '제2조 (정의)' },
  { id: 'service', title: '제3조 (서비스 제공)' },
  { id: 'credits', title: '제4조 (크레딧 및 결제)' },
  { id: 'user-obligations', title: '제5조 (이용자 의무)' },
  { id: 'prohibited', title: '제6조 (금지 행위)' },
  { id: 'ip', title: '제7조 (지식재산권)' },
  { id: 'ai-content', title: '제8조 (AI 생성 콘텐츠)' },
  { id: 'disclaimer', title: '제9조 (면책 조항)' },
  { id: 'termination', title: '제10조 (서비스 중단 및 해지)' },
  { id: 'dispute', title: '제11조 (분쟁 해결)' },
  { id: 'changes', title: '제12조 (약관 변경)' },
];

export default function TermsPage() {
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = '이용약관 | AiMetaWOW';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', 'AiMetaWOW 서비스 이용약관. 크레딧 결제, AI 생성 콘텐츠 저작권, 금지 행위, 분쟁 해결 등 서비스 이용에 관한 모든 조건을 확인하세요.');
    }
    return () => {
      document.title = 'AiMetaWOW — AI 이미지·영상·음성 생성 크리에이티브 플랫폼';
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY + 120;
      for (const section of SECTIONS) {
        const el = document.getElementById(section.id);
        if (el && el.offsetTop <= scrollY) {
          setActiveSection(section.id);
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      window.scrollTo({ top: el.offsetTop - 90, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#06060a] text-white">
      {/* Top Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#06060a]/90 backdrop-blur-xl border-b border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 cursor-pointer">
            <img
              src="https://static.readdy.ai/image/818485967d328b35909ddcc1d73f5659/99fa675bf72ff13d36de270333b480ff.png"
              alt="AiMetaWOW"
              className="h-9"
            />
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="text-sm text-gray-400 hover:text-white transition-colors font-medium cursor-pointer">
              개인정보처리방침
            </Link>
            <Link to="/" className="text-sm bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-gray-300 px-4 py-2 rounded-lg transition-all font-medium cursor-pointer whitespace-nowrap">
              홈으로
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-24">
        {/* Header */}
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-full px-4 py-1.5 text-xs text-gray-400 font-semibold tracking-widest uppercase mb-6">
            <i className="ri-file-text-line" />
            Legal Document
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
            이용약관
          </h1>
          <p className="text-gray-500 text-base font-medium">
            시행일: 2026년 1월 1일 &nbsp;·&nbsp; 최종 수정: 2026년 4월 13일
          </p>
          <div className="mt-6 p-4 bg-amber-500/[0.06] border border-amber-500/20 rounded-xl">
            <p className="text-amber-400/80 text-sm font-medium leading-relaxed">
              <i className="ri-information-line mr-2" />
              본 약관은 아이메타버스(주)가 운영하는 AiMetaWOW 서비스 이용에 관한 조건 및 절차를 규정합니다.
              서비스를 이용하시기 전에 반드시 본 약관을 읽고 동의하시기 바랍니다.
            </p>
          </div>
        </div>

        <div className="flex gap-12 items-start">
          {/* Sidebar TOC */}
          <aside className="hidden lg:block w-64 flex-shrink-0 sticky top-24">
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">목차</p>
              <nav className="space-y-1">
                {SECTIONS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => scrollTo(s.id)}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-all font-medium cursor-pointer ${
                      activeSection === s.id
                        ? 'bg-white/[0.08] text-white'
                        : 'text-gray-600 hover:text-gray-300 hover:bg-white/[0.03]'
                    }`}
                  >
                    {s.title}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <article className="flex-1 min-w-0 space-y-14">
            <Section id="overview" title="제1조 (목적)">
              <p>
                본 약관은 아이메타버스 주식회사(이하 "회사")가 운영하는 AiMetaWOW 플랫폼(이하 "서비스")의 이용과 관련하여
                회사와 이용자 간의 권리, 의무 및 책임 사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
              </p>
            </Section>

            <Section id="definitions" title="제2조 (정의)">
              <p>본 약관에서 사용하는 용어의 정의는 다음과 같습니다.</p>
              <DefinitionList items={[
                { term: '서비스', def: '회사가 제공하는 AiMetaWOW 플랫폼 및 관련 AI 생성 도구 일체를 의미합니다.' },
                { term: '이용자', def: '본 약관에 동의하고 서비스를 이용하는 모든 개인 또는 법인을 의미합니다.' },
                { term: '크레딧', def: '서비스 내에서 AI 생성 기능을 이용하기 위해 사용되는 가상의 화폐 단위입니다.' },
                { term: 'AI 생성 콘텐츠', def: '이용자의 입력(프롬프트)을 기반으로 AI가 생성한 이미지, 영상, 음성, 텍스트 등 모든 결과물을 의미합니다.' },
                { term: '계정', def: '이용자가 서비스를 이용하기 위해 생성한 고유한 식별 정보 및 관련 데이터의 집합입니다.' },
              ]} />
            </Section>

            <Section id="service" title="제3조 (서비스 제공)">
              <p>회사는 다음과 같은 서비스를 제공합니다.</p>
              <ul className="list-disc list-inside space-y-2 text-gray-400 mt-3">
                <li><strong className="text-gray-300">AI Create</strong> — 텍스트 프롬프트 기반 이미지 및 영상 생성</li>
                <li><strong className="text-gray-300">AI Sound</strong> — AI 기반 음성 합성(TTS), 음향 효과(SFX), 음악 생성</li>
                <li><strong className="text-gray-300">AI Board</strong> — AI 기반 스토리보드 및 콘텐츠 기획 도구</li>
                <li><strong className="text-gray-300">AI Automation</strong> — 자동화 영상 제작 파이프라인</li>
                <li><strong className="text-gray-300">YouTube Studio</strong> — YouTube 콘텐츠 제작 자동화 도구</li>
              </ul>
              <p className="mt-4">
                회사는 서비스의 품질 향상, 기술적 필요, 또는 운영상의 이유로 서비스의 내용을 변경하거나 일시 중단할 수 있으며,
                이 경우 사전에 공지합니다. 단, 긴급한 경우에는 사후에 공지할 수 있습니다.
              </p>
            </Section>

            <Section id="credits" title="제4조 (크레딧 및 결제)">
              <SubSection title="4.1 크레딧 구매 및 사용">
                <p>
                  이용자는 서비스 내 결제 수단을 통해 크레딧을 구매할 수 있습니다.
                  크레딧은 AI 생성 기능 이용 시 소모되며, 기능별 소모량은 서비스 내에서 확인할 수 있습니다.
                </p>
              </SubSection>
              <SubSection title="4.2 환불 정책">
                <p>
                  구매한 크레딧은 원칙적으로 환불되지 않습니다. 단, 다음의 경우에는 예외적으로 환불이 가능합니다.
                </p>
                <ul className="list-disc list-inside space-y-1.5 text-gray-400 mt-2">
                  <li>회사의 귀책 사유로 서비스가 정상적으로 제공되지 않은 경우</li>
                  <li>결제 후 7일 이내에 크레딧을 전혀 사용하지 않은 경우</li>
                  <li>관련 법령에 따라 환불이 요구되는 경우</li>
                </ul>
              </SubSection>
              <SubSection title="4.3 크레딧 유효기간">
                <p>
                  구매한 크레딧의 유효기간은 구매일로부터 1년입니다.
                  유효기간이 만료된 크레딧은 자동으로 소멸되며, 이에 대한 환불은 제공되지 않습니다.
                </p>
              </SubSection>
            </Section>

            <Section id="user-obligations" title="제5조 (이용자 의무)">
              <p>이용자는 서비스를 이용함에 있어 다음 사항을 준수해야 합니다.</p>
              <ul className="list-disc list-inside space-y-2 text-gray-400 mt-3">
                <li>관련 법령 및 본 약관의 규정을 준수해야 합니다.</li>
                <li>타인의 개인정보를 무단으로 수집, 저장, 공개하는 행위를 해서는 안 됩니다.</li>
                <li>서비스를 이용하여 생성한 콘텐츠에 대한 법적 책임은 이용자에게 있습니다.</li>
                <li>계정 정보를 타인과 공유하거나 양도해서는 안 됩니다.</li>
                <li>서비스의 정상적인 운영을 방해하는 행위를 해서는 안 됩니다.</li>
              </ul>
            </Section>

            <Section id="prohibited" title="제6조 (금지 행위)">
              <p>이용자는 다음 각 호에 해당하는 행위를 해서는 안 됩니다.</p>
              <div className="mt-4 space-y-3">
                {[
                  { icon: 'ri-prohibited-line', text: '타인의 저작권, 상표권, 특허권 등 지식재산권을 침해하는 콘텐츠 생성' },
                  { icon: 'ri-prohibited-line', text: '실존 인물의 동의 없이 해당 인물을 묘사하는 딥페이크 콘텐츠 생성' },
                  { icon: 'ri-prohibited-line', text: '아동·청소년을 대상으로 한 성적 콘텐츠 생성 (법적 처벌 대상)' },
                  { icon: 'ri-prohibited-line', text: '혐오, 차별, 폭력을 조장하는 콘텐츠 생성' },
                  { icon: 'ri-prohibited-line', text: '허위 정보, 사기, 피싱 등 불법적 목적의 콘텐츠 생성' },
                  { icon: 'ri-prohibited-line', text: '서비스의 소스코드 역공학, 해킹, 무단 접근 시도' },
                  { icon: 'ri-prohibited-line', text: 'API를 통한 무단 대량 요청 또는 크레딧 시스템 우회 시도' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-red-500/[0.04] border border-red-500/10 rounded-xl">
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <i className={`${item.icon} text-red-400/60 text-sm`} />
                    </div>
                    <p className="text-gray-400 text-sm">{item.text}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-gray-500">
                위 금지 행위 위반 시 회사는 사전 통보 없이 해당 이용자의 계정을 정지 또는 영구 삭제할 수 있으며,
                관련 법령에 따라 수사기관에 신고할 수 있습니다.
              </p>
            </Section>

            <Section id="ip" title="제7조 (지식재산권)">
              <SubSection title="7.1 서비스 지식재산권">
                <p>
                  서비스 및 서비스를 구성하는 소프트웨어, 디자인, 텍스트, 그래픽 등 모든 콘텐츠에 대한 지식재산권은
                  회사 또는 해당 권리자에게 귀속됩니다. 이용자는 회사의 명시적 동의 없이 이를 복제, 배포, 수정할 수 없습니다.
                </p>
              </SubSection>
              <SubSection title="7.2 이용자 생성 콘텐츠">
                <p>
                  이용자가 서비스를 통해 생성한 AI 콘텐츠의 저작권은 원칙적으로 이용자에게 귀속됩니다.
                  단, 이용자는 회사가 서비스 개선 및 홍보 목적으로 해당 콘텐츠를 비상업적으로 활용할 수 있도록
                  비독점적 라이선스를 회사에 부여합니다.
                </p>
              </SubSection>
            </Section>

            <Section id="ai-content" title="제8조 (AI 생성 콘텐츠)">
              <p>
                AI 생성 콘텐츠와 관련하여 이용자는 다음 사항을 인지하고 동의합니다.
              </p>
              <div className="mt-4 space-y-3">
                {[
                  'AI가 생성한 콘텐츠는 완전성, 정확성, 적법성을 보장하지 않습니다.',
                  '동일한 프롬프트로도 매번 다른 결과물이 생성될 수 있습니다.',
                  'AI 생성 콘텐츠를 상업적으로 이용하기 전에 저작권 및 관련 법령을 확인할 책임은 이용자에게 있습니다.',
                  '생성된 콘텐츠가 제3자의 권리를 침해하는 경우 이에 대한 법적 책임은 이용자에게 있습니다.',
                  '회사는 AI 생성 콘텐츠로 인해 발생하는 직접적·간접적 손해에 대해 책임을 지지 않습니다.',
                ].map((text, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <i className="ri-checkbox-circle-line text-emerald-400/60 text-sm" />
                    </div>
                    <p className="text-gray-400 text-sm">{text}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="disclaimer" title="제9조 (면책 조항)">
              <p>
                회사는 다음의 경우 서비스 제공에 관한 책임을 지지 않습니다.
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-400 mt-3">
                <li>천재지변, 전쟁, 테러, 해킹 등 불가항력적 사유로 인한 서비스 중단</li>
                <li>이용자의 귀책 사유로 인한 서비스 이용 장애</li>
                <li>제3자 API(GoAPI, ElevenLabs 등) 서비스 장애로 인한 기능 제한</li>
                <li>이용자가 서비스를 통해 생성한 콘텐츠로 인해 발생하는 분쟁</li>
                <li>무료 크레딧 또는 이벤트 크레딧의 변경 및 소멸</li>
              </ul>
            </Section>

            <Section id="termination" title="제10조 (서비스 중단 및 해지)">
              <SubSection title="10.1 이용자의 해지">
                <p>
                  이용자는 언제든지 서비스 이용을 중단하고 계정 삭제를 요청할 수 있습니다.
                  계정 삭제 시 잔여 크레딧은 환불되지 않으며, 생성된 콘텐츠는 삭제됩니다.
                </p>
              </SubSection>
              <SubSection title="10.2 회사의 해지">
                <p>
                  회사는 이용자가 본 약관을 위반하거나 서비스의 정상적인 운영을 방해하는 경우,
                  사전 통보 없이 해당 이용자의 서비스 이용을 제한하거나 계정을 삭제할 수 있습니다.
                </p>
              </SubSection>
            </Section>

            <Section id="dispute" title="제11조 (분쟁 해결)">
              <p>
                본 약관과 관련된 분쟁은 대한민국 법률을 준거법으로 하며,
                분쟁 발생 시 서울중앙지방법원을 제1심 전속 관할 법원으로 합니다.
              </p>
              <p className="mt-3">
                분쟁 발생 전 회사와 이용자는 상호 협의를 통해 원만히 해결하도록 노력합니다.
                문의사항은 <a href="mailto:contact@aimetawow.com" className="text-white/70 hover:text-white underline underline-offset-2">contact@aimetawow.com</a>으로 연락해 주세요.
              </p>
            </Section>

            <Section id="changes" title="제12조 (약관 변경)">
              <p>
                회사는 필요한 경우 본 약관을 변경할 수 있으며, 변경된 약관은 서비스 내 공지사항을 통해
                시행일 7일 전에 공지합니다. 중요한 변경 사항의 경우 30일 전에 공지합니다.
              </p>
              <p className="mt-3">
                이용자가 변경된 약관에 동의하지 않는 경우 서비스 이용을 중단하고 계정 삭제를 요청할 수 있습니다.
                변경된 약관의 시행일 이후에도 서비스를 계속 이용하는 경우 변경된 약관에 동의한 것으로 간주합니다.
              </p>
            </Section>

            {/* Footer Note */}
            <div className="border-t border-white/[0.06] pt-10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-gray-400">아이메타버스 주식회사</p>
                  <p className="text-xs text-gray-600 mt-1">서울특별시 강남구 테헤란로 123 &nbsp;·&nbsp; contact@aimetawow.com</p>
                </div>
                <Link to="/privacy" className="text-sm text-gray-500 hover:text-white transition-colors font-medium cursor-pointer whitespace-nowrap">
                  개인정보처리방침 보기 →
                </Link>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-black text-white mb-5 pb-4 border-b border-white/[0.06]">
        {title}
      </h2>
      <div className="text-gray-400 text-sm leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-bold text-gray-300 mb-2">{title}</h3>
      <div className="text-gray-400 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function DefinitionList({ items }: { items: { term: string; def: string }[] }) {
  return (
    <div className="mt-4 space-y-3">
      {items.map((item) => (
        <div key={item.term} className="flex gap-3 p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl">
          <span className="text-white font-bold text-sm whitespace-nowrap">{item.term}</span>
          <span className="text-gray-500 text-sm">—</span>
          <span className="text-gray-400 text-sm">{item.def}</span>
        </div>
      ))}
    </div>
  );
}
