import type { TeamRecord } from '../types';
import { StatusBadge } from './Badges';
import { SectionHeader } from './AdminHelpers';

export interface ContentDbStats {
  total: number;
  pending: number;
  blocked: number;
  gallery: number;
  audio: number;
  automation: number;
  board: number;
}

export interface ContentDbItem {
  id: string;
  title: string;
  user: string;
  type: string;
  status: string;
  date: string;
  thumbnail: string;
}

export interface ContentMockItem {
  id: string;
  title: string;
  user: string;
  type: string;
  status: 'approved' | 'pending' | 'blocked';
  date: string;
  rating: number;
  thumbnail: string;
}

export interface TeamStats {
  total: number;
  active: number;
  inactive: number;
  total_members: number;
}

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

interface ContentTabProps {
  isDark: boolean;
  t: Theme;

  contentSubTab: 'items' | 'teams';
  setContentSubTab: (v: 'items' | 'teams') => void;

  // items
  contentDbStats: ContentDbStats | null;
  contentDbLoading: boolean;
  contentDbItems: ContentDbItem[];
  contentItems: ContentMockItem[];
  contentFilter: string;
  setContentFilter: (v: string) => void;
  loadContentItems: (filter: string) => void;
  onContentStatusChange: (id: string, status: 'approved' | 'pending' | 'blocked') => void;

  // teams
  teamStats: TeamStats;
  teamsData: TeamRecord[];
  teamsLoading: boolean;
  onOpenNewTeam: () => void;
  onOpenTeam: (team: TeamRecord) => void;
}

const ITEM_SUMMARY = (stats: ContentDbStats | null, loading: boolean) => [
  {
    label: '전체 콘텐츠',
    value: stats ? stats.total.toLocaleString() : (loading ? '...' : '-'),
    icon: 'ri-image-ai-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10',
  },
  {
    label: '처리 중',
    value: stats ? String(stats.pending) : (loading ? '...' : '-'),
    icon: 'ri-time-line', color: 'text-amber-400', bg: 'bg-amber-500/10',
  },
  {
    label: '실패/차단',
    value: stats ? String(stats.blocked) : (loading ? '...' : '-'),
    icon: 'ri-spam-2-line', color: 'text-red-400', bg: 'bg-red-500/10',
  },
  {
    label: 'AI 이미지',
    value: stats ? stats.gallery.toLocaleString() : (loading ? '...' : '-'),
    icon: 'ri-star-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10',
  },
];

const HOW_IT_WORKS = [
  {
    step: '1',
    title: '팀 생성',
    desc: '팀 이름, 설명, 콘텐츠 접근 모드(공유/비공개/제한)를 설정하고 팀을 만듭니다.',
    icon: 'ri-add-circle-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10',
  },
  {
    step: '2',
    title: '멤버 초대',
    desc: '사용자를 검색해 팀에 추가합니다. 역할(오너/관리자/멤버/뷰어)을 지정할 수 있습니다.',
    icon: 'ri-user-add-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10',
  },
  {
    step: '3',
    title: '콘텐츠 공유',
    desc: '팀 멤버가 생성한 AI 콘텐츠를 접근 모드에 따라 팀 내에서 공유하고 협업합니다.',
    icon: 'ri-share-line', color: 'text-amber-400', bg: 'bg-amber-500/10',
  },
];

export default function ContentTab({
  isDark, t,
  contentSubTab, setContentSubTab,
  contentDbStats, contentDbLoading, contentDbItems, contentItems,
  contentFilter, setContentFilter, loadContentItems, onContentStatusChange,
  teamStats, teamsData, teamsLoading,
  onOpenNewTeam, onOpenTeam,
}: ContentTabProps) {
  // items에서 사용할 표시 리스트 계산
  const displayItems: ContentMockItem[] = contentDbItems.length > 0
    ? contentDbItems.map((c) => ({
        id: c.id,
        title: c.title,
        user: c.user,
        type: c.type,
        status: c.status as 'approved' | 'pending' | 'blocked',
        date: c.date ? new Date(c.date).toLocaleString('ko-KR').replace(/\. /g, '.').replace(/\.$/, '') : '-',
        rating: c.status === 'approved' ? 4 : c.status === 'blocked' ? 1 : 3,
        thumbnail: c.thumbnail,
      }))
    : contentItems;

  const filteredItems = displayItems.filter((c) => {
    if (contentFilter === '전체') return true;
    if (contentFilter === '승인') return c.status === 'approved';
    if (contentFilter === '검토중') return c.status === 'pending';
    if (contentFilter === '차단') return c.status === 'blocked';
    return true;
  });

  const labelingStats = (() => {
    const total = contentDbStats ? contentDbStats.total : 0;
    const approved = contentDbStats
      ? contentDbStats.gallery + contentDbStats.audio + contentDbStats.automation + contentDbStats.board - (contentDbStats.pending + contentDbStats.blocked)
      : 0;
    const pending = contentDbStats ? contentDbStats.pending : 0;
    const blocked = contentDbStats ? contentDbStats.blocked : 0;
    const safeTotal = Math.max(total, 1);
    return {
      approvedCount: Math.max(0, approved),
      pendingCount: pending,
      blockedCount: blocked,
      approvedPct: Math.round((Math.max(0, approved) / safeTotal) * 100),
      pendingPct: Math.round((pending / safeTotal) * 100),
      blockedPct: Math.round((blocked / safeTotal) * 100),
    };
  })();

  return (
    <div className="space-y-5">
      <div className={`flex items-center gap-1 p-1 rounded-xl border ${t.border} ${t.cardBg} w-fit`}>
        {([
          { id: 'items' as const, label: '콘텐츠 검수', icon: 'ri-image-ai-line' },
          { id: 'teams' as const, label: '팀 / 그룹 관리', icon: 'ri-team-line' },
        ]).map((sub) => (
          <button
            key={sub.id}
            onClick={() => setContentSubTab(sub.id)}
            aria-pressed={contentSubTab === sub.id}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all whitespace-nowrap ${
              contentSubTab === sub.id
                ? 'bg-indigo-500 text-white'
                : `${t.textMuted} hover:${t.text}`
            }`}
          >
            <i className={`${sub.icon} text-xs`} />
            {sub.label}
          </button>
        ))}
      </div>

      {contentSubTab === 'items' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {ITEM_SUMMARY(contentDbStats, contentDbLoading).map((c) => (
              <div key={c.label} className={`${t.cardBg} border ${t.border} rounded-2xl p-4`}>
                <div className={`w-8 h-8 rounded-xl ${c.bg} flex items-center justify-center mb-2`}>
                  <i className={`${c.icon} ${c.color} text-sm`} />
                </div>
                <p className={`text-lg font-black ${t.text}`}>{c.value}</p>
                <p className={`text-[11px] ${t.textMuted}`}>{c.label}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            {['전체', '승인', '검토중', '차단'].map((f) => (
              <button
                key={f}
                onClick={() => {
                  setContentFilter(f);
                  loadContentItems(f);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                  contentFilter === f
                    ? 'bg-indigo-500 text-white'
                    : `${t.cardBg2} border ${t.border} ${t.textMuted} hover:${t.text}`
                }`}
              >
                {f}
              </button>
            ))}
            {contentDbLoading && (
              <div className="flex items-center gap-1.5 px-2">
                <i className="ri-loader-4-line animate-spin text-zinc-500 text-sm" />
                <span className={`text-xs ${t.textFaint}`}>로딩 중...</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {contentDbLoading && contentDbItems.length === 0 ? (
              <div className={`col-span-2 flex items-center justify-center py-16 ${t.textFaint}`}>
                <i className="ri-loader-4-line animate-spin text-3xl text-indigo-400" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className={`col-span-2 flex flex-col items-center justify-center py-16 ${t.textFaint}`}>
                <i className="ri-image-ai-line text-3xl mb-2" />
                <p className="text-sm">콘텐츠가 없습니다</p>
              </div>
            ) : filteredItems.map((c) => (
              <div key={c.id} className={`${t.cardBg} border ${t.border} rounded-2xl p-4 flex gap-4 group ${isDark ? 'hover:border-white/10' : 'hover:border-gray-300'} transition-colors`}>
                <div className={`w-24 h-14 rounded-xl overflow-hidden flex-shrink-0 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'} flex items-center justify-center`}>
                  {c.thumbnail ? (
                    <img src={c.thumbnail} alt={c.title} className="w-full h-full object-cover object-top" />
                  ) : (
                    <i className={`ri-image-line text-xl ${t.textFaint}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className={`text-sm font-semibold ${t.text} truncate`}>{c.title}</p>
                    <StatusBadge status={c.status} isDark={isDark} />
                  </div>
                  <p className={`text-[11px] ${t.textFaint} mb-2`}>{c.user} · {c.type} · {c.date}</p>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <i key={s} className={`${s <= c.rating ? 'ri-star-fill text-amber-400' : 'ri-star-line text-zinc-700'} text-[10px]`} />
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onContentStatusChange(c.id, 'approved')}
                    className={`w-7 h-7 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center justify-center cursor-pointer transition-colors ${c.status === 'approved' ? 'ring-1 ring-emerald-500/40' : ''}`}
                    title="승인" aria-label={`${c.title} 승인`}
                  >
                    <i className="ri-check-line text-emerald-400 text-xs" />
                  </button>
                  <button
                    onClick={() => onContentStatusChange(c.id, 'pending')}
                    className={`w-7 h-7 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 flex items-center justify-center cursor-pointer transition-colors ${c.status === 'pending' ? 'ring-1 ring-amber-500/40' : ''}`}
                    title="검토중" aria-label={`${c.title} 검토중`}
                  >
                    <i className="ri-star-line text-amber-400 text-xs" />
                  </button>
                  <button
                    onClick={() => onContentStatusChange(c.id, 'blocked')}
                    className={`w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center cursor-pointer transition-colors ${c.status === 'blocked' ? 'ring-1 ring-red-500/40' : ''}`}
                    title="차단" aria-label={`${c.title} 차단`}
                  >
                    <i className="ri-spam-2-line text-red-400 text-xs" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
            <SectionHeader title="데이터 라벨링" subtitle="AI 품질 개선을 위한 운영자 태깅" isDark={isDark} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: '태깅 완료', value: contentDbStats ? labelingStats.approvedCount.toLocaleString() : '-', pct: labelingStats.approvedPct, color: 'bg-emerald-500' },
                { label: '태깅 대기', value: contentDbStats ? labelingStats.pendingCount.toLocaleString() : '-', pct: labelingStats.pendingPct, color: 'bg-amber-500' },
                { label: '재검토 필요', value: contentDbStats ? labelingStats.blockedCount.toLocaleString() : '-', pct: labelingStats.blockedPct, color: 'bg-red-500' },
              ].map((item) => (
                <div key={item.label} className={`${t.cardBg2} rounded-xl p-4`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-semibold ${t.textSub}`}>{item.label}</span>
                    <span className={`text-sm font-black ${t.text}`}>
                      {contentDbLoading ? <i className="ri-loader-4-line animate-spin text-indigo-400" /> : item.value}
                    </span>
                  </div>
                  <div className={`h-1.5 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'} rounded-full overflow-hidden`}>
                    <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${item.pct}%` }} />
                  </div>
                  <p className={`text-[10px] ${t.textFaint} mt-1.5`}>{item.pct}%</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {contentSubTab === 'teams' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: '전체 팀', value: teamStats.total > 0 ? `${teamStats.total}개` : (teamsData.length > 0 ? `${teamsData.length}개` : '-'), icon: 'ri-team-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
              { label: '활성 팀', value: teamStats.active > 0 ? `${teamStats.active}개` : `${teamsData.filter((team) => team.status === 'active').length}개`, icon: 'ri-checkbox-circle-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              { label: '전체 팀 멤버', value: teamStats.total_members > 0 ? `${teamStats.total_members}명` : '-', icon: 'ri-user-3-line', color: 'text-amber-400', bg: 'bg-amber-500/10' },
              { label: '비활성 팀', value: teamStats.inactive > 0 ? `${teamStats.inactive}개` : `${teamsData.filter((team) => team.status !== 'active').length}개`, icon: 'ri-pause-circle-line', color: 'text-zinc-400', bg: 'bg-zinc-500/10' },
            ].map((c) => (
              <div key={c.label} className={`${t.cardBg} border ${t.border} rounded-2xl p-4`}>
                <div className={`w-8 h-8 rounded-xl ${c.bg} flex items-center justify-center mb-2`}>
                  <i className={`${c.icon} ${c.color} text-sm`} />
                </div>
                <p className={`text-lg font-black ${t.text}`}>{c.value}</p>
                <p className={`text-[11px] ${t.textMuted}`}>{c.label}</p>
              </div>
            ))}
          </div>

          <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
            <div className={`px-5 py-4 border-b ${t.border} flex items-center justify-between`}>
              <div>
                <p className={`text-sm font-black ${t.text}`}>팀 / 그룹 목록</p>
                <p className={`text-xs ${t.textMuted} mt-0.5`}>특정 회원층만 AI 콘텐츠를 공유·협업할 수 있는 팀 단위 접근 제어</p>
              </div>
              <div className="flex items-center gap-2">
                {teamsLoading && <i className="ri-loader-4-line animate-spin text-zinc-500 text-sm" />}
                <button
                  onClick={onOpenNewTeam}
                  className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                >
                  <i className="ri-add-line text-xs" />
                  팀 생성
                </button>
              </div>
            </div>

            <div className={`px-5 py-2.5 border-b ${t.border} flex items-center gap-4 flex-wrap`}>
              {[
                { key: 'shared', label: '공유', icon: 'ri-team-line', color: 'text-emerald-400' },
                { key: 'private', label: '비공개', icon: 'ri-lock-line', color: 'text-red-400' },
                { key: 'restricted', label: '제한', icon: 'ri-shield-line', color: 'text-amber-400' },
              ].map((a) => (
                <div key={a.key} className="flex items-center gap-1.5">
                  <i className={`${a.icon} ${a.color} text-xs`} />
                  <span className={`text-[10px] ${t.textFaint}`}>{a.label}</span>
                </div>
              ))}
              <span className={`text-[10px] ${t.textFaint} ml-auto`}>콘텐츠 접근 모드</span>
            </div>

            {teamsData.length === 0 && !teamsLoading ? (
              <div className={`flex flex-col items-center justify-center py-16 ${t.textFaint}`}>
                <i className="ri-team-line text-3xl mb-3" />
                <p className="text-sm font-semibold mb-1">아직 팀이 없습니다</p>
                <p className={`text-xs ${t.textFaint} mb-4 text-center max-w-xs`}>
                  팀을 생성하면 특정 회원들끼리 AI 콘텐츠를 공유하고 협업할 수 있습니다
                </p>
                <button
                  onClick={onOpenNewTeam}
                  className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                >
                  <i className="ri-add-line text-xs" />
                  첫 팀 만들기
                </button>
              </div>
            ) : (
              <div className={`divide-y ${t.divider}`}>
                {teamsData.map((team) => {
                  const accessConfig = {
                    shared:     { icon: 'ri-team-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: '공유' },
                    private:    { icon: 'ri-lock-line', color: 'text-red-400', bg: 'bg-red-500/10', label: '비공개' },
                    restricted: { icon: 'ri-shield-line', color: 'text-amber-400', bg: 'bg-amber-500/10', label: '제한' },
                  }[team.content_access];
                  return (
                    <div key={team.id} className={`px-5 py-4 flex items-center gap-4 ${t.rowHover} transition-colors group`}>
                      <div className={`w-10 h-10 rounded-xl ${accessConfig.bg} flex items-center justify-center flex-shrink-0`}>
                        <i className={`${accessConfig.icon} ${accessConfig.color} text-base`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <p className={`text-sm font-semibold ${t.text}`}>{team.name}</p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${accessConfig.bg} ${accessConfig.color}`}>
                            {accessConfig.label}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            team.status === 'active'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-zinc-500/15 text-zinc-400'
                          }`}>
                            {team.status === 'active' ? '활성' : team.status === 'inactive' ? '비활성' : '보관됨'}
                          </span>
                        </div>
                        <p className={`text-[11px] ${t.textFaint}`}>
                          {team.description ?? '설명 없음'} · 멤버 {team.member_count}/{team.max_members}명
                        </p>
                        <p className={`text-[10px] ${t.textFaint} mt-0.5`}>
                          생성일: {new Date(team.created_at).toLocaleDateString('ko-KR').replace(/\. /g, '.').replace(/\.$/, '')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={() => onOpenTeam(team)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${t.inputBg2} hover:opacity-80 ${t.textSub} text-[10px] font-semibold cursor-pointer transition-colors whitespace-nowrap`}
                        >
                          <i className="ri-settings-3-line text-xs" />
                          관리
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5`}>
            <p className={`text-sm font-black ${t.text} mb-4`}>팀 기반 콘텐츠 접근 제어 안내</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {HOW_IT_WORKS.map((item) => (
                <div key={item.step} className={`${t.cardBg2} rounded-xl p-4`}>
                  <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center mb-3`}>
                    <i className={`${item.icon} ${item.color} text-base`} />
                  </div>
                  <div className="flex-items-center gap-2 mb-1.5 flex">
                    <span className={`text-[10px] font-black ${t.textFaint} bg-zinc-800 px-1.5 py-0.5 rounded-full`}>STEP {item.step}</span>
                    <p className={`text-xs font-bold ${t.text}`}>{item.title}</p>
                  </div>
                  <p className={`text-[11px] ${t.textFaint} leading-relaxed`}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
