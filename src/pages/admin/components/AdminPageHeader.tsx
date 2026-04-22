import type { AdminTabType } from './AdminSidebar';

interface Theme {
  text: string;
  textMuted: string;
  btnSecondary: string;
}

interface AdminPageHeaderProps {
  t: Theme;
  activeTab: AdminTabType;
  lastRefreshedAt: Date | null;
  onCsvExport: (tabName: string) => void;
  onRefresh: () => void;
}

const TAB_TITLES: Record<AdminTabType, string> = {
  overview:         '글로벌 대시보드',
  users:            '사용자 관리',
  'coin-grant':     '코인 직접 지급',
  'grade-settings': '회원 등급 권한 설정',
  content:          'AI 콘텐츠 관리',
  'ai-engine':      'AI 엔진 & API 설정',
  billing:          '결제 & 구독 관리',
  cs:               'CS 티켓 관리',
  'cs-notice':      '공지 / FAQ 관리',
  audit:            '감사 로그',
  'sys-settings':   '시스템 설정',
  security:         '보안 / 2FA 관리',
};

const CSV_TAB_LABELS: Partial<Record<AdminTabType, string>> = {
  overview: '대시보드',
  users: '사용자',
  billing: '결제',
  audit: '감사 로그',
};

function formatRefreshedAt(date: Date | null): string {
  const d = date ?? new Date();
  return d
    .toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(/\. /g, '.')
    .replace(/\.$/, '');
}

export default function AdminPageHeader({
  t, activeTab, lastRefreshedAt, onCsvExport, onRefresh,
}: AdminPageHeaderProps) {
  const csvLabel = CSV_TAB_LABELS[activeTab] ?? '데이터';

  return (
    <div className="flex items-center justify-between mb-6 md:mb-8">
      <div>
        <h1 className={`text-xl md:text-2xl font-black ${t.text}`}>{TAB_TITLES[activeTab]}</h1>
        <p className={`${t.textMuted} text-sm mt-1`}>
          마지막 업데이트: {formatRefreshedAt(lastRefreshedAt)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onCsvExport(csvLabel)}
          className={`flex items-center gap-1.5 ${t.btnSecondary} text-xs font-semibold px-3 py-2 rounded-xl cursor-pointer transition-colors whitespace-nowrap`}
          aria-label={`${csvLabel} CSV 내보내기`}
        >
          <i className="ri-download-line text-xs" />
          <span className="hidden sm:inline">CSV 내보내기</span>
        </button>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
          aria-label="새로고침"
        >
          <i className="ri-refresh-line text-xs" />
          <span className="hidden sm:inline">새로고침</span>
        </button>
      </div>
    </div>
  );
}
