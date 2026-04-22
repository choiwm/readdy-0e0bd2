import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const SECTIONS = [
  { id: 'overview', title: '제1조 (개인정보 처리 목적)' },
  { id: 'items', title: '제2조 (수집하는 개인정보 항목)' },
  { id: 'retention', title: '제3조 (개인정보 보유 및 이용기간)' },
  { id: 'third-party', title: '제4조 (개인정보 제3자 제공)' },
  { id: 'consignment', title: '제5조 (개인정보 처리 위탁)' },
  { id: 'rights', title: '제6조 (정보주체의 권리·의무)' },
  { id: 'security', title: '제7조 (개인정보 보호 조치)' },
  { id: 'cookies', title: '제8조 (쿠키 및 자동 수집 정보)' },
  { id: 'children', title: '제9조 (만 14세 미만 아동)' },
  { id: 'officer', title: '제10조 (개인정보 보호책임자)' },
  { id: 'changes', title: '제11조 (방침 변경)' },
];

export default function PrivacyPage() {
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = '개인정보처리방침 | AiMetaWOW';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', 'AiMetaWOW 개인정보처리방침. 수집 항목, 이용 목적, 보유 기간, 제3자 제공, Supabase·GoAPI·ElevenLabs 처리 위탁 현황 및 정보주체 권리를 확인하세요.');
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
            <Link to="/terms" className="text-sm text-gray-400 hover:text-white transition-colors font-medium cursor-pointer">
              이용약관
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
            <i className="ri-shield-check-line" />
            Privacy Policy
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
            개인정보처리방침
          </h1>
          <p className="text-gray-500 text-base font-medium">
            시행일: 2026년 1월 1일 &nbsp;·&nbsp; 최종 수정: 2026년 4월 13일
          </p>
          <div className="mt-6 p-4 bg-emerald-500/[0.06] border border-emerald-500/20 rounded-xl">
            <p className="text-emerald-400/80 text-sm font-medium leading-relaxed">
              <i className="ri-shield-check-line mr-2" />
              아이메타버스(주)는 개인정보보호법 및 관련 법령을 준수하며, 이용자의 개인정보를 소중히 보호합니다.
              본 방침은 회사가 수집하는 개인정보의 종류, 이용 목적, 보호 방법 등을 안내합니다.
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

            {/* Quick Contact */}
            <div className="mt-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">개인정보 문의</p>
              <a
                href="mailto:privacy@aimetawow.com"
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <i className="ri-mail-line" />
                privacy@aimetawow.com
              </a>
            </div>
          </aside>

          {/* Content */}
          <article className="flex-1 min-w-0 space-y-14">
            <Section id="overview" title="제1조 (개인정보 처리 목적)">
              <p>
                아이메타버스 주식회사(이하 "회사")는 다음의 목적을 위하여 개인정보를 처리합니다.
                처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며,
                이용 목적이 변경되는 경우에는 개인정보보호법 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
              </p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: 'ri-user-line', title: '회원 관리', desc: '회원 가입 및 관리, 본인 확인, 서비스 이용 계약 이행' },
                  { icon: 'ri-service-line', title: '서비스 제공', desc: 'AI 생성 서비스 제공, 크레딧 관리, 결제 처리' },
                  { icon: 'ri-customer-service-2-line', title: '고객 지원', desc: '문의 처리, 불만 접수 및 처리, 공지사항 전달' },
                  { icon: 'ri-bar-chart-line', title: '서비스 개선', desc: '이용 통계 분석, 서비스 품질 향상, 신규 기능 개발' },
                  { icon: 'ri-mail-send-line', title: '마케팅', desc: '이벤트 안내, 뉴스레터 발송 (별도 동의 시)' },
                  { icon: 'ri-shield-check-line', title: '법적 의무', desc: '법령 준수, 분쟁 해결, 부정 이용 방지' },
                ].map((item) => (
                  <div key={item.title} className="p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 flex items-center justify-center">
                        <i className={`${item.icon} text-gray-400 text-sm`} />
                      </div>
                      <span className="text-sm font-bold text-gray-300">{item.title}</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="items" title="제2조 (수집하는 개인정보 항목)">
              <p>회사는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.</p>
              <div className="mt-4 space-y-4">
                <TableSection
                  title="회원 가입 시 (필수)"
                  items={['이메일 주소', '비밀번호 (암호화 저장)', '닉네임']}
                  badge="필수"
                  badgeColor="text-red-400 bg-red-500/10 border-red-500/20"
                />
                <TableSection
                  title="서비스 이용 시 (자동 수집)"
                  items={['IP 주소', '브라우저 종류 및 버전', '운영체제', '서비스 이용 기록', '접속 일시', '쿠키']}
                  badge="자동"
                  badgeColor="text-amber-400 bg-amber-500/10 border-amber-500/20"
                />
                <TableSection
                  title="결제 시 (필수)"
                  items={['결제 수단 정보 (카드사에서 직접 처리)', '결제 금액 및 내역', '청구 주소 (선택)']}
                  badge="결제"
                  badgeColor="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                />
                <TableSection
                  title="AI 생성 서비스 이용 시"
                  items={['입력 프롬프트', '생성된 이미지/영상/음성 파일', '업로드한 참조 이미지']}
                  badge="콘텐츠"
                  badgeColor="text-gray-400 bg-white/[0.04] border-white/[0.08]"
                />
              </div>
            </Section>

            <Section id="retention" title="제3조 (개인정보 보유 및 이용기간)">
              <p>
                회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은
                개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
              </p>
              <div className="mt-4 space-y-2">
                {[
                  { category: '회원 정보', period: '회원 탈퇴 시까지 (탈퇴 후 즉시 삭제)', law: '내부 방침' },
                  { category: '결제 기록', period: '5년', law: '전자상거래법' },
                  { category: '서비스 이용 기록', period: '3개월', law: '통신비밀보호법' },
                  { category: '불만 처리 기록', period: '3년', law: '전자상거래법' },
                  { category: 'AI 생성 콘텐츠', period: '생성 후 1년 (삭제 요청 시 즉시)', law: '내부 방침' },
                ].map((row) => (
                  <div key={row.category} className="grid grid-cols-3 gap-3 p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl text-sm">
                    <span className="text-gray-300 font-medium">{row.category}</span>
                    <span className="text-gray-400">{row.period}</span>
                    <span className="text-gray-600 text-xs flex items-center">{row.law}</span>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="third-party" title="제4조 (개인정보 제3자 제공)">
              <p>
                회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다.
                다만, 다음의 경우에는 예외로 합니다.
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-400 mt-3">
                <li>이용자가 사전에 동의한 경우</li>
                <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
                <li>서비스 제공을 위해 불가피하게 필요한 경우로서 이용자의 동의를 받은 경우</li>
              </ul>
            </Section>

            <Section id="consignment" title="제5조 (개인정보 처리 위탁)">
              <p>
                회사는 서비스 제공을 위해 다음과 같이 개인정보 처리 업무를 위탁하고 있습니다.
              </p>
              <div className="mt-4 space-y-2">
                {[
                  { company: 'Supabase Inc.', task: '데이터베이스 및 인증 서비스', country: '미국' },
                  { company: 'GoAPI', task: 'AI 이미지/영상 생성 처리', country: '미국' },
                  { company: 'ElevenLabs', task: 'AI 음성 합성 처리', country: '미국' },
                  { company: '결제 대행사', task: '결제 처리 및 정산', country: '대한민국' },
                ].map((row) => (
                  <div key={row.company} className="grid grid-cols-3 gap-3 p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl text-sm">
                    <span className="text-gray-300 font-medium">{row.company}</span>
                    <span className="text-gray-400">{row.task}</span>
                    <span className="text-gray-600 text-xs flex items-center">{row.country}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-gray-600">
                해외 이전의 경우 개인정보보호법 제28조의8에 따라 적절한 보호 조치를 취하고 있습니다.
              </p>
            </Section>

            <Section id="rights" title="제6조 (정보주체의 권리·의무)">
              <p>이용자는 개인정보주체로서 다음과 같은 권리를 행사할 수 있습니다.</p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: 'ri-eye-line', right: '열람권', desc: '본인의 개인정보 처리 현황 확인 요청' },
                  { icon: 'ri-edit-line', right: '정정권', desc: '부정확한 개인정보의 수정 요청' },
                  { icon: 'ri-delete-bin-line', right: '삭제권', desc: '개인정보 삭제 요청 (법령 보존 의무 제외)' },
                  { icon: 'ri-pause-circle-line', right: '처리정지권', desc: '개인정보 처리 일시 정지 요청' },
                  { icon: 'ri-download-line', right: '이동권', desc: '개인정보를 구조화된 형식으로 수령 요청' },
                  { icon: 'ri-thumb-down-line', right: '반대권', desc: '마케팅 목적 처리에 대한 거부 요청' },
                ].map((item) => (
                  <div key={item.right} className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                    <div className="w-8 h-8 flex items-center justify-center bg-white/[0.04] rounded-lg flex-shrink-0">
                      <i className={`${item.icon} text-gray-400 text-sm`} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-300">{item.right}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4">
                권리 행사는 <a href="mailto:privacy@aimetawow.com" className="text-white/70 hover:text-white underline underline-offset-2">privacy@aimetawow.com</a>으로
                이메일 요청하시거나, 서비스 내 계정 설정에서 직접 처리하실 수 있습니다.
                요청 접수 후 10일 이내에 처리 결과를 안내해 드립니다.
              </p>
            </Section>

            <Section id="security" title="제7조 (개인정보 보호 조치)">
              <p>
                회사는 개인정보보호법 제29조에 따라 다음과 같이 안전성 확보에 필요한 기술적·관리적 조치를 하고 있습니다.
              </p>
              <div className="mt-4 space-y-3">
                {[
                  { icon: 'ri-lock-password-line', title: '암호화', desc: '비밀번호는 단방향 암호화(bcrypt)로 저장되며, 개인정보는 전송 시 TLS/SSL로 암호화됩니다.' },
                  { icon: 'ri-shield-keyhole-line', title: '접근 통제', desc: '개인정보에 대한 접근 권한을 최소화하고, 접근 기록을 주기적으로 검토합니다.' },
                  { icon: 'ri-virus-line', title: '보안 프로그램', desc: '악성코드 방지 프로그램을 설치·운영하며 주기적으로 업데이트합니다.' },
                  { icon: 'ri-file-shield-2-line', title: '정기 점검', desc: '개인정보 처리 시스템에 대한 정기적인 보안 점검을 실시합니다.' },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-4 p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                    <div className="w-9 h-9 flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex-shrink-0">
                      <i className={`${item.icon} text-emerald-400 text-sm`} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-300 mb-1">{item.title}</p>
                      <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="cookies" title="제8조 (쿠키 및 자동 수집 정보)">
              <SubSection title="8.1 쿠키 사용 목적">
                <p>
                  회사는 이용자에게 개인화된 서비스를 제공하기 위해 쿠키(cookie)를 사용합니다.
                  쿠키는 웹사이트를 운영하는 데 이용되는 서버가 이용자의 브라우저에 보내는 소량의 정보이며,
                  이용자의 컴퓨터 하드디스크에 저장됩니다.
                </p>
              </SubSection>
              <SubSection title="8.2 쿠키 거부 방법">
                <p>
                  이용자는 쿠키 설치에 대한 선택권을 가지고 있습니다. 웹 브라우저의 옵션을 설정함으로써
                  모든 쿠키를 허용하거나, 쿠키가 저장될 때마다 확인을 거치거나, 모든 쿠키의 저장을 거부할 수 있습니다.
                  단, 쿠키 저장을 거부할 경우 일부 서비스 이용에 어려움이 있을 수 있습니다.
                </p>
              </SubSection>
            </Section>

            <Section id="children" title="제9조 (만 14세 미만 아동)">
              <div className="p-4 bg-amber-500/[0.06] border border-amber-500/20 rounded-xl">
                <p className="text-amber-400/80 text-sm font-medium leading-relaxed">
                  <i className="ri-parent-line mr-2" />
                  AiMetaWOW 서비스는 만 14세 이상을 대상으로 합니다.
                  만 14세 미만 아동의 개인정보는 원칙적으로 수집하지 않으며,
                  만 14세 미만 아동이 서비스에 가입한 사실이 확인될 경우 즉시 해당 계정을 삭제합니다.
                </p>
              </div>
            </Section>

            <Section id="officer" title="제10조 (개인정보 보호책임자)">
              <p>
                회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만 처리 및
                피해 구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
              </p>
              <div className="mt-4 p-5 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 uppercase tracking-widest font-bold mb-2">개인정보 보호책임자</p>
                    <p className="text-sm text-gray-300 font-bold">홍길동 (CPO)</p>
                    <p className="text-xs text-gray-500 mt-1">아이메타버스 주식회사</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 uppercase tracking-widest font-bold mb-2">연락처</p>
                    <a href="mailto:privacy@aimetawow.com" className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5">
                      <i className="ri-mail-line text-xs" />
                      privacy@aimetawow.com
                    </a>
                    <p className="text-xs text-gray-600 mt-1">평일 09:00 – 18:00 (공휴일 제외)</p>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm text-gray-500">
                개인정보 침해에 대한 신고나 상담이 필요하신 경우 아래 기관에 문의하실 수 있습니다.
              </p>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { name: '개인정보 침해신고센터', url: 'privacy.kisa.or.kr', tel: '(국번없이) 118' },
                  { name: '개인정보 분쟁조정위원회', url: 'www.kopico.go.kr', tel: '1833-6972' },
                ].map((org) => (
                  <div key={org.name} className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                    <p className="text-xs font-bold text-gray-400">{org.name}</p>
                    <p className="text-xs text-gray-600 mt-1">{org.tel}</p>
                    <a href={`https://${org.url}`} target="_blank" rel="nofollow noreferrer" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">{org.url}</a>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="changes" title="제11조 (방침 변경)">
              <p>
                본 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경 내용의 추가, 삭제 및 정정이 있는 경우에는
                변경 사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
              </p>
              <p className="mt-3">
                중요한 변경 사항(개인정보 수집 항목 추가, 이용 목적 변경 등)의 경우 30일 전에 공지하며,
                필요한 경우 이용자의 동의를 다시 받겠습니다.
              </p>
            </Section>

            {/* Footer Note */}
            <div className="border-t border-white/[0.06] pt-10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-gray-400">아이메타버스 주식회사</p>
                  <p className="text-xs text-gray-600 mt-1">서울특별시 강남구 테헤란로 123 &nbsp;·&nbsp; privacy@aimetawow.com</p>
                </div>
                <Link to="/terms" className="text-sm text-gray-500 hover:text-white transition-colors font-medium cursor-pointer whitespace-nowrap">
                  이용약관 보기 →
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

function TableSection({ title, items, badge, badgeColor }: {
  title: string;
  items: string[];
  badge: string;
  badgeColor: string;
}) {
  return (
    <div className="p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>{badge}</span>
        <span className="text-sm font-bold text-gray-300">{title}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="text-xs text-gray-500 bg-white/[0.03] border border-white/[0.06] px-2.5 py-1 rounded-lg">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
