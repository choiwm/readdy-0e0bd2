import type { Notice } from '../types';
import { StatusBadge } from './Badges';
import { SectionHeader } from './AdminHelpers';

interface Theme {
  cardBg: string;
  cardBg2: string;
  border: string;
  text: string;
  textSub: string;
  textMuted: string;
  textFaint: string;
  inputBg2: string;
  rowHover: string;
  divider: string;
}

interface CsNoticeTabProps {
  isDark: boolean;
  t: Theme;
  noticeList: Notice[];
  onRefresh: () => void;
  onComposeNotice: () => void;
  onEditNotice: (n: Notice) => void;
  onToggleStatus: (n: Notice, next: 'published' | 'draft') => void;
  onDeleteNotice: (id: string) => void;
  onOpenPushMail: (mode: 'push' | 'email') => void;
  onFaqPlaceholderAction: (msg: string) => void;
}

const NOTICE_FILTERS = ['전체', '업데이트', '점검', '이벤트', '공지'];

const FAQ_ITEMS: Array<{ q: string; a: string; views: number; category: string }> = [
  { q: '크레딧은 어떻게 충전하나요?', a: '크레딧 구매 페이지에서 원하는 플랜을 선택하거나 크레딧 팩을 구매할 수 있습니다.', views: 4821, category: '결제' },
  { q: 'AI 이미지 생성 시 저작권은 누구에게 있나요?', a: '생성된 이미지의 저작권은 생성한 사용자에게 귀속됩니다. 단, 상업적 이용 시 Pro 이상 플랜이 필요합니다.', views: 3204, category: '저작권' },
  { q: '구독을 해지하면 크레딧은 어떻게 되나요?', a: '구독 해지 후에도 남은 크레딧은 유효기간 내 사용 가능합니다. 단, 구독 혜택은 즉시 종료됩니다.', views: 2891, category: '구독' },
  { q: '생성 실패 시 크레딧이 차감되나요?', a: '서버 오류로 인한 생성 실패 시 크레딧이 자동 환불됩니다. 단, 사용자 설정 오류로 인한 실패는 환불되지 않습니다.', views: 2104, category: '기술' },
  { q: '워터마크를 제거하려면 어떻게 해야 하나요?', a: 'Pro 이상 플랜으로 업그레이드하면 워터마크 없이 콘텐츠를 생성할 수 있습니다.', views: 1876, category: '기능' },
];

const PUSH_MAIL_OPTIONS: Array<{
  icon: string; title: string; desc: string; color: string; bg: string; btn: string; mode: 'email' | 'push';
}> = [
  { icon: 'ri-mail-send-line', title: '이메일 발송', desc: '공지사항을 이메일로 전체 또는 특정 사용자에게 발송', color: 'text-indigo-400', bg: 'bg-indigo-500/10', btn: '메일 작성', mode: 'email' },
  { icon: 'ri-notification-3-line', title: '브라우저 푸시', desc: '공지사항 푸시 알림을 전체 또는 특정 플랜 대상으로 발송', color: 'text-amber-400', bg: 'bg-amber-500/10', btn: '푸시 발송', mode: 'push' },
];

export default function CsNoticeTab({
  isDark,
  t,
  noticeList,
  onRefresh,
  onComposeNotice,
  onEditNotice,
  onToggleStatus,
  onDeleteNotice,
  onOpenPushMail,
  onFaqPlaceholderAction,
}: CsNoticeTabProps) {
  const stats = [
    { label: '전체 공지', value: String(noticeList.length), icon: 'ri-megaphone-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { label: '게시 중', value: String(noticeList.filter((n) => n.status === 'published').length), icon: 'ri-checkbox-circle-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: '초안', value: String(noticeList.filter((n) => n.status === 'draft').length), icon: 'ri-draft-line', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: '총 조회수', value: noticeList.reduce((acc, n) => acc + n.views, 0).toLocaleString(), icon: 'ri-eye-line', color: 'text-violet-400', bg: 'bg-violet-500/10' },
  ];

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((c) => (
          <div key={c.label} className={`${t.cardBg} border ${t.border} rounded-2xl p-4`}>
            <div className={`w-8 h-8 rounded-xl ${c.bg} flex items-center justify-center mb-2`}>
              <i className={`${c.icon} ${c.color} text-sm`} />
            </div>
            <p className={`text-lg font-black ${t.text}`}>{c.value}</p>
            <p className={`text-[11px] ${t.textMuted}`}>{c.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
        <div className="flex gap-2 flex-wrap">
          {NOTICE_FILTERS.map((f) => (
            <button
              key={f}
              className={`px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                f === '전체'
                  ? 'bg-indigo-500 text-white'
                  : `${t.cardBg2} border ${t.border} ${t.textMuted} hover:${t.text}`
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={onComposeNotice}
          className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
        >
          <i className="ri-add-line text-xs" />
          공지 작성
        </button>
      </div>

      <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
        <div className={`px-5 py-4 border-b ${t.border} flex items-center justify-between`}>
          <div>
            <p className={`text-sm font-black ${t.text}`}>공지사항 목록</p>
            <p className={`text-xs ${t.textMuted} mt-0.5`}>서비스 업데이트, 점검, 이벤트 공지 관리</p>
          </div>
          <button
            onClick={onRefresh}
            className={`w-8 h-8 flex items-center justify-center rounded-xl ${t.inputBg2} hover:opacity-80 cursor-pointer transition-colors`}
            title="새로고침"
            aria-label="공지 새로고침"
          >
            <i className={`ri-refresh-line text-sm ${t.textSub}`} />
          </button>
        </div>
        <div className={`divide-y ${t.divider}`}>
          {noticeList.length === 0 ? (
            <div className={`flex flex-col items-center justify-center py-16 ${t.textFaint}`}>
              <i className="ri-megaphone-line text-3xl mb-2" />
              <p className="text-sm">공지사항이 없습니다</p>
              <button
                onClick={onComposeNotice}
                className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors"
              >
                첫 공지 작성하기
              </button>
            </div>
          ) : noticeList.map((n) => (
            <div key={n.id} className={`px-5 py-4 flex items-center gap-4 ${t.rowHover} transition-colors group`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                n.type === '업데이트' ? 'bg-indigo-500/10' :
                n.type === '점검' ? 'bg-amber-500/10' :
                n.type === '이벤트' ? 'bg-emerald-500/10' :
                'bg-zinc-700/40'
              }`}>
                <i className={`text-sm ${
                  n.type === '업데이트' ? 'ri-refresh-line text-indigo-400' :
                  n.type === '점검' ? 'ri-tools-line text-amber-400' :
                  n.type === '이벤트' ? 'ri-gift-line text-emerald-400' :
                  `ri-megaphone-line ${t.textMuted}`
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    n.type === '업데이트' ? 'bg-indigo-500/15 text-indigo-400' :
                    n.type === '점검' ? 'bg-amber-500/15 text-amber-400' :
                    n.type === '이벤트' ? 'bg-emerald-500/15 text-emerald-400' :
                    `${t.cardBg2} ${t.textMuted}`
                  }`}>{n.type}</span>
                  <StatusBadge status={n.status} isDark={isDark} />
                </div>
                <p className={`text-sm font-semibold ${t.text} truncate`}>{n.title}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <p className={`text-[11px] ${t.textFaint}`}>{n.date}</p>
                  <div className="flex items-center gap-1">
                    <i className={`ri-eye-line text-[10px] ${t.textFaint}`} />
                    <span className={`text-[11px] ${t.textFaint}`}>{n.views.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                {n.status === 'draft' && (
                  <button
                    onClick={() => onToggleStatus(n, 'published')}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold cursor-pointer transition-colors whitespace-nowrap"
                  >
                    게시
                  </button>
                )}
                {n.status === 'published' && (
                  <button
                    onClick={() => onToggleStatus(n, 'draft')}
                    className={`px-2.5 py-1.5 rounded-lg ${t.inputBg2} hover:opacity-80 ${t.textSub} text-[10px] font-semibold cursor-pointer transition-colors whitespace-nowrap`}
                  >
                    내리기
                  </button>
                )}
                <button
                  onClick={() => onEditNotice(n)}
                  className={`w-7 h-7 rounded-lg ${t.inputBg2} hover:opacity-80 flex items-center justify-center cursor-pointer transition-colors`}
                  title="편집"
                  aria-label={`공지 ${n.title} 편집`}
                >
                  <i className={`ri-edit-line ${t.textSub} text-xs`} />
                </button>
                <button
                  onClick={() => onDeleteNotice(n.id)}
                  className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center cursor-pointer transition-colors"
                  title="삭제"
                  aria-label={`공지 ${n.title} 삭제`}
                >
                  <i className="ri-delete-bin-line text-red-400 text-xs" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className={`text-sm font-black ${t.text}`}>자주 묻는 질문 (FAQ)</p>
            <p className={`text-xs ${t.textMuted} mt-0.5`}>사용자 FAQ 항목 관리</p>
          </div>
          <button
            onClick={() => onFaqPlaceholderAction('FAQ 편집 기능은 준비 중입니다')}
            className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-add-line text-xs" />
            FAQ 추가
          </button>
        </div>
        <div className="space-y-2">
          {FAQ_ITEMS.map((faq, i) => (
            <div key={i} className={`${t.cardBg2} rounded-xl p-4 group`}>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-indigo-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-black text-indigo-400">Q</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className={`text-sm font-semibold ${t.text}`}>{faq.q}</p>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400">{faq.category}</span>
                  </div>
                  <p className={`text-xs ${t.textMuted} leading-relaxed`}>{faq.a}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1">
                      <i className={`ri-eye-line text-[10px] ${t.textFaint}`} />
                      <span className={`text-[10px] ${t.textFaint}`}>{faq.views.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => onFaqPlaceholderAction('FAQ 편집 기능은 준비 중입니다')}
                    className={`w-7 h-7 rounded-lg ${t.inputBg2} hover:opacity-80 flex items-center justify-center cursor-pointer transition-colors`}
                    aria-label="FAQ 편집"
                  >
                    <i className={`ri-edit-line ${t.textSub} text-xs`} />
                  </button>
                  <button
                    onClick={() => onFaqPlaceholderAction('FAQ가 삭제됐습니다')}
                    className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center cursor-pointer transition-colors"
                    aria-label="FAQ 삭제"
                  >
                    <i className="ri-delete-bin-line text-red-400 text-xs" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
        <SectionHeader title="공지 발송" subtitle="공지사항 관련 이메일 및 푸시 알림 발송" isDark={isDark} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PUSH_MAIL_OPTIONS.map((item) => (
            <div key={item.title} className={`${t.cardBg2} rounded-xl p-4`}>
              <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center mb-3`}>
                <i className={`${item.icon} ${item.color} text-base`} />
              </div>
              <p className={`text-sm font-semibold ${t.text} mb-1`}>{item.title}</p>
              <p className={`text-xs ${t.textFaint} mb-3`}>{item.desc}</p>
              <button
                onClick={() => onOpenPushMail(item.mode)}
                className={`w-full py-2 ${t.inputBg2} hover:opacity-80 ${t.textSub} text-xs font-semibold rounded-xl cursor-pointer transition-colors whitespace-nowrap`}
              >
                {item.btn}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
