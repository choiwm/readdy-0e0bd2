import { useState, useEffect, useCallback } from 'react';

interface TeamStat {
  id: string;
  name: string;
  description: string | null;
  content_access: 'shared' | 'private' | 'restricted';
  status: 'active' | 'inactive' | 'archived';
  member_count: number;
  max_members: number;
  created_at: string;
  // 통계
  total_content: number;
  gallery_count: number;
  audio_count: number;
  automation_count: number;
  board_count: number;
  active_members_7d: number;
  content_7d: number;
  content_30d: number;
  growth_pct: number;
}

interface TeamStatsDashboardProps {
  isDark: boolean;
  onNavigateToTeams: () => void;
}

// Mock 팀 통계 데이터 (DB 연동 전 fallback)
const mockTeamStats: TeamStat[] = [
  {
    id: 'team-001',
    name: '마케팅 크리에이티브팀',
    description: '광고 영상 및 SNS 콘텐츠 제작',
    content_access: 'shared',
    status: 'active',
    member_count: 8,
    max_members: 20,
    created_at: '2026.03.01',
    total_content: 342,
    gallery_count: 180,
    audio_count: 42,
    automation_count: 98,
    board_count: 22,
    active_members_7d: 7,
    content_7d: 48,
    content_30d: 180,
    growth_pct: 24,
  },
  {
    id: 'team-002',
    name: '유튜브 자동화팀',
    description: '쇼츠 및 롱폼 영상 자동 생성',
    content_access: 'shared',
    status: 'active',
    member_count: 5,
    max_members: 10,
    created_at: '2026.03.15',
    total_content: 218,
    gallery_count: 44,
    audio_count: 28,
    automation_count: 134,
    board_count: 12,
    active_members_7d: 5,
    content_7d: 31,
    content_30d: 112,
    growth_pct: 18,
  },
  {
    id: 'team-003',
    name: '브랜드 디자인팀',
    description: 'AI 이미지 및 보드 디자인 협업',
    content_access: 'restricted',
    status: 'active',
    member_count: 12,
    max_members: 15,
    created_at: '2026.02.20',
    total_content: 521,
    gallery_count: 380,
    audio_count: 18,
    automation_count: 55,
    board_count: 68,
    active_members_7d: 9,
    content_7d: 72,
    content_30d: 240,
    growth_pct: 35,
  },
  {
    id: 'team-004',
    name: '음악 프로덕션팀',
    description: 'AI 음악 및 사운드 제작',
    content_access: 'private',
    status: 'active',
    member_count: 4,
    max_members: 8,
    created_at: '2026.04.01',
    total_content: 89,
    gallery_count: 12,
    audio_count: 71,
    automation_count: 4,
    board_count: 2,
    active_members_7d: 4,
    content_7d: 22,
    content_30d: 65,
    growth_pct: 8,
  },
  {
    id: 'team-005',
    name: '스타트업 피칭팀',
    description: '투자자 피칭 자료 및 광고 제작',
    content_access: 'shared',
    status: 'inactive',
    member_count: 3,
    max_members: 10,
    created_at: '2026.01.10',
    total_content: 47,
    gallery_count: 28,
    audio_count: 8,
    automation_count: 9,
    board_count: 2,
    active_members_7d: 0,
    content_7d: 0,
    content_30d: 4,
    growth_pct: -12,
  },
];

const contentTypeConfig = [
  { key: 'gallery_count', label: 'AI 이미지', icon: 'ri-image-ai-line', color: 'bg-indigo-500', textColor: 'text-indigo-400' },
  { key: 'automation_count', label: '유튜브 자동화', icon: 'ri-youtube-line', color: 'bg-red-500', textColor: 'text-red-400' },
  { key: 'audio_count', label: 'AI 사운드', icon: 'ri-music-2-line', color: 'bg-emerald-500', textColor: 'text-emerald-400' },
  { key: 'board_count', label: 'AI 보드', icon: 'ri-layout-masonry-line', color: 'bg-violet-500', textColor: 'text-violet-400' },
];

const accessConfig = {
  shared:     { icon: 'ri-team-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: '공유' },
  private:    { icon: 'ri-lock-line', color: 'text-red-400', bg: 'bg-red-500/10', label: '비공개' },
  restricted: { icon: 'ri-shield-line', color: 'text-amber-400', bg: 'bg-amber-500/10', label: '제한' },
};

export default function TeamStatsDashboard({ isDark, onNavigateToTeams }: TeamStatsDashboardProps) {
  const [teamStats, setTeamStats] = useState<TeamStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'total_content' | 'content_7d' | 'member_count' | 'growth_pct'>('total_content');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedTeam, setSelectedTeam] = useState<TeamStat | null>(null);

  const t = {
    cardBg:    isDark ? 'bg-[#0f0f13]'    : 'bg-white',
    cardBg2:   isDark ? 'bg-zinc-900/60'   : 'bg-slate-50',
    border:    isDark ? 'border-white/5'   : 'border-slate-200',
    text:      isDark ? 'text-white'       : 'text-slate-900',
    textSub:   isDark ? 'text-zinc-300'    : 'text-slate-700',
    textMuted: isDark ? 'text-zinc-400'    : 'text-slate-600',
    textFaint: isDark ? 'text-zinc-500'    : 'text-slate-500',
    inputBg2:  isDark ? 'bg-zinc-800'      : 'bg-slate-100',
    rowHover:  isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50',
    divider:   isDark ? 'divide-white/[0.03]'   : 'divide-slate-100',
    barBg:     isDark ? 'bg-zinc-800'      : 'bg-slate-200',
  };

  const loadTeamStats = useCallback(async () => {
    setLoading(true);
    try {
      const base = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-teams`;
      const headers = { 'Authorization': `Bearer ${import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY}` };
      const res = await fetch(`${base}?action=team_content_stats`, { headers });
      const data = await res.json();
      if (data.teams && data.teams.length > 0) {
        setTeamStats(data.teams);
      } else {
        setTeamStats(mockTeamStats);
      }
    } catch {
      setTeamStats(mockTeamStats);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeamStats();
  }, [loadTeamStats]);

  const filtered = teamStats
    .filter((t) => filterStatus === 'all' || t.status === filterStatus)
    .sort((a, b) => b[sortBy] - a[sortBy]);

  const totalContent = teamStats.reduce((s, t) => s + t.total_content, 0);
  const totalMembers = teamStats.reduce((s, t) => s + t.member_count, 0);
  const activeTeams = teamStats.filter((t) => t.status === 'active').length;
  const totalContent7d = teamStats.reduce((s, t) => s + t.content_7d, 0);

  // 가장 활발한 팀
  const topTeam = [...teamStats].sort((a, b) => b.content_7d - a.content_7d)[0];
  const maxContent = Math.max(...filtered.map((t) => t.total_content), 1);

  return (
    <div className="space-y-5">

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-sm font-black ${t.text}`}>팀별 콘텐츠 통계</h2>
          <p className={`text-xs mt-0.5 ${t.textMuted}`}>팀마다 생성량, 활동 현황을 한눈에 확인</p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <i className="ri-loader-4-line animate-spin text-zinc-500 text-sm" />}
          <button
            onClick={loadTeamStats}
            className={`w-8 h-8 flex items-center justify-center rounded-xl ${t.inputBg2} hover:opacity-80 cursor-pointer transition-colors`}
            title="새로고침"
          >
            <i className={`ri-refresh-line text-sm ${t.textSub}`} />
          </button>
          <button
            onClick={onNavigateToTeams}
            className={`flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800'}`}
          >
            <i className="ri-team-line text-xs" />
            팀 관리
          </button>
        </div>
      </div>

      {/* 요약 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: '전체 팀 생성량',
            value: totalContent.toLocaleString(),
            sub: '누적 콘텐츠',
            icon: 'ri-image-ai-line',
            color: 'text-indigo-400',
            bg: 'bg-indigo-500/10',
            border: 'border-indigo-500/20',
          },
          {
            label: '이번 주 생성',
            value: totalContent7d.toLocaleString(),
            sub: '최근 7일',
            icon: 'ri-bar-chart-2-line',
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/20',
          },
          {
            label: '활성 팀',
            value: `${activeTeams}개`,
            sub: `전체 ${teamStats.length}개 팀`,
            icon: 'ri-team-line',
            color: 'text-amber-400',
            bg: 'bg-amber-500/10',
            border: 'border-amber-500/20',
          },
          {
            label: '전체 팀 멤버',
            value: `${totalMembers}명`,
            sub: '협업 중',
            icon: 'ri-user-3-line',
            color: 'text-violet-400',
            bg: 'bg-violet-500/10',
            border: 'border-violet-500/20',
          },
        ].map((card) => (
          <div key={card.label} className={`${t.cardBg} border ${card.border} rounded-2xl p-4`}>
            <div className={`w-8 h-8 rounded-xl ${card.bg} flex items-center justify-center mb-2.5`}>
              <i className={`${card.icon} ${card.color} text-sm`} />
            </div>
            <p className={`text-xl font-black ${t.text}`}>{card.value}</p>
            <p className={`text-[11px] ${t.textMuted} mt-0.5`}>{card.label}</p>
            <p className={`text-[10px] ${t.textFaint} mt-0.5`}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* 가장 활발한 팀 하이라이트 */}
      {topTeam && (
        <div className={`${t.cardBg} border border-indigo-500/20 rounded-2xl p-5 bg-indigo-500/5`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 flex items-center justify-center">
              <i className="ri-trophy-line text-indigo-400 text-sm" />
            </div>
            <div>
              <p className={`text-xs font-black ${t.text}`}>이번 주 가장 활발한 팀</p>
              <p className={`text-[10px] ${t.textFaint}`}>최근 7일 생성량 기준</p>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${accessConfig[topTeam.content_access].bg} flex items-center justify-center`}>
                <i className={`${accessConfig[topTeam.content_access].icon} ${accessConfig[topTeam.content_access].color} text-base`} />
              </div>
              <div>
                <p className={`text-sm font-bold ${t.text}`}>{topTeam.name}</p>
                <p className={`text-[11px] ${t.textFaint}`}>{topTeam.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 ml-auto flex-wrap">
              {[
                { label: '7일 생성', value: `${topTeam.content_7d}건`, color: 'text-indigo-400' },
                { label: '활성 멤버', value: `${topTeam.active_members_7d}명`, color: 'text-emerald-400' },
                { label: '성장률', value: `+${topTeam.growth_pct}%`, color: 'text-amber-400' },
                { label: '누적 콘텐츠', value: `${topTeam.total_content}건`, color: t.textSub },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <p className={`text-sm font-black ${s.color}`}>{s.value}</p>
                  <p className={`text-[10px] ${t.textFaint}`}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 필터 + 정렬 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold ${t.textFaint}`}>상태</span>
          {([
            { key: 'all', label: '전체' },
            { key: 'active', label: '활성' },
            { key: 'inactive', label: '비활성' },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                filterStatus === f.key
                  ? 'bg-indigo-500 text-white'
                  : `${t.inputBg2} ${t.textMuted} hover:opacity-80`
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold ${t.textFaint}`}>정렬</span>
          {([
            { key: 'total_content', label: '누적 생성량' },
            { key: 'content_7d', label: '7일 생성량' },
            { key: 'member_count', label: '멤버 수' },
            { key: 'growth_pct', label: '성장률' },
          ] as const).map((s) => (
            <button
              key={s.key}
              onClick={() => setSortBy(s.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                sortBy === s.key
                  ? 'bg-indigo-500 text-white'
                  : `${t.inputBg2} ${t.textMuted} hover:opacity-80`
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 팀별 통계 카드 리스트 */}
      <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <i className="ri-loader-4-line animate-spin text-3xl text-indigo-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-16 ${t.textFaint}`}>
            <i className="ri-team-line text-3xl mb-2" />
            <p className="text-sm">팀이 없습니다</p>
          </div>
        ) : (
          <div className={`divide-y ${t.divider}`}>
            {filtered.map((team, idx) => {
              const access = accessConfig[team.content_access];
              const barWidth = Math.max(4, Math.round((team.total_content / maxContent) * 100));
              const isSelected = selectedTeam?.id === team.id;

              return (
                <div key={team.id}>
                  {/* 팀 행 */}
                  <div
                    className={`px-5 py-4 cursor-pointer transition-colors ${t.rowHover} ${isSelected ? (isDark ? 'bg-white/[0.03]' : 'bg-slate-50') : ''}`}
                    onClick={() => setSelectedTeam(isSelected ? null : team)}
                  >
                    <div className="flex items-center gap-4">
                      {/* 순위 */}
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-black ${
                        idx === 0 ? 'bg-amber-500/20 text-amber-400' :
                        idx === 1 ? 'bg-zinc-500/20 text-zinc-400' :
                        idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                        `${t.inputBg2} ${t.textFaint}`
                      }`}>
                        {idx + 1}
                      </div>

                      {/* 팀 아이콘 */}
                      <div className={`w-9 h-9 rounded-xl ${access.bg} flex items-center justify-center flex-shrink-0`}>
                        <i className={`${access.icon} ${access.color} text-sm`} />
                      </div>

                      {/* 팀 정보 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <p className={`text-sm font-semibold ${t.text}`}>{team.name}</p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${access.bg} ${access.color}`}>
                            {access.label}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            team.status === 'active'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-zinc-500/15 text-zinc-400'
                          }`}>
                            {team.status === 'active' ? '활성' : '비활성'}
                          </span>
                        </div>
                        <p className={`text-[11px] ${t.textFaint} mb-2`}>
                          {team.description ?? '설명 없음'} · 멤버 {team.member_count}/{team.max_members}명
                        </p>
                        {/* 생성량 바 */}
                        <div className="flex items-center gap-2">
                          <div className={`flex-1 h-1.5 ${t.barBg} rounded-full overflow-hidden`}>
                            <div
                              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-bold ${t.textSub} w-12 text-right whitespace-nowrap`}>
                            {team.total_content.toLocaleString()}건
                          </span>
                        </div>
                      </div>

                      {/* 핵심 지표 */}
                      <div className="hidden md:flex items-center gap-5 flex-shrink-0">
                        <div className="text-center">
                          <p className={`text-sm font-black ${t.text}`}>{team.content_7d}</p>
                          <p className={`text-[9px] ${t.textFaint}`}>7일 생성</p>
                        </div>
                        <div className="text-center">
                          <p className={`text-sm font-black ${team.active_members_7d > 0 ? 'text-emerald-400' : t.textFaint}`}>
                            {team.active_members_7d}명
                          </p>
                          <p className={`text-[9px] ${t.textFaint}`}>활성 멤버</p>
                        </div>
                        <div className="text-center">
                          <p className={`text-sm font-black ${team.growth_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {team.growth_pct >= 0 ? '+' : ''}{team.growth_pct}%
                          </p>
                          <p className={`text-[9px] ${t.textFaint}`}>성장률</p>
                        </div>
                      </div>

                      {/* 펼치기 아이콘 */}
                      <div className={`w-6 h-6 flex items-center justify-center flex-shrink-0 ${t.textFaint} transition-transform ${isSelected ? 'rotate-180' : ''}`}>
                        <i className="ri-arrow-down-s-line text-sm" />
                      </div>
                    </div>
                  </div>

                  {/* 펼쳐진 상세 통계 */}
                  {isSelected && (
                    <div className={`px-5 pb-5 ${isDark ? 'bg-white/[0.015]' : 'bg-slate-50/80'} border-t ${t.border}`}>
                      <div className="pt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">

                        {/* 콘텐츠 유형별 분포 */}
                        <div className={`${isDark ? 'bg-zinc-900/60' : 'bg-white'} rounded-xl p-4 border ${t.border}`}>
                          <p className={`text-xs font-black ${t.text} mb-3`}>콘텐츠 유형별 분포</p>
                          <div className="space-y-2.5">
                            {contentTypeConfig.map((cfg) => {
                              const count = team[cfg.key as keyof TeamStat] as number;
                              const pct = team.total_content > 0 ? Math.round((count / team.total_content) * 100) : 0;
                              return (
                                <div key={cfg.key}>
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1.5">
                                      <i className={`${cfg.icon} ${cfg.textColor} text-xs`} />
                                      <span className={`text-[11px] ${t.textSub}`}>{cfg.label}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[11px] font-bold ${t.text}`}>{count.toLocaleString()}</span>
                                      <span className={`text-[10px] ${t.textFaint}`}>{pct}%</span>
                                    </div>
                                  </div>
                                  <div className={`h-1.5 ${t.barBg} rounded-full overflow-hidden`}>
                                    <div className={`h-full ${cfg.color} rounded-full`} style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* 활동 현황 */}
                        <div className={`${isDark ? 'bg-zinc-900/60' : 'bg-white'} rounded-xl p-4 border ${t.border}`}>
                          <p className={`text-xs font-black ${t.text} mb-3`}>활동 현황</p>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              {
                                label: '7일 생성량',
                                value: `${team.content_7d}건`,
                                icon: 'ri-calendar-check-line',
                                color: 'text-indigo-400',
                                bg: 'bg-indigo-500/10',
                              },
                              {
                                label: '30일 생성량',
                                value: `${team.content_30d}건`,
                                icon: 'ri-calendar-2-line',
                                color: 'text-violet-400',
                                bg: 'bg-violet-500/10',
                              },
                              {
                                label: '활성 멤버 (7일)',
                                value: `${team.active_members_7d}/${team.member_count}명`,
                                icon: 'ri-user-follow-line',
                                color: 'text-emerald-400',
                                bg: 'bg-emerald-500/10',
                              },
                              {
                                label: '성장률 (전월 대비)',
                                value: `${team.growth_pct >= 0 ? '+' : ''}${team.growth_pct}%`,
                                icon: 'ri-line-chart-line',
                                color: team.growth_pct >= 0 ? 'text-emerald-400' : 'text-red-400',
                                bg: team.growth_pct >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
                              },
                            ].map((item) => (
                              <div key={item.label} className={`${isDark ? 'bg-zinc-800/60' : 'bg-slate-100'} rounded-xl p-3`}>
                                <div className={`w-7 h-7 rounded-lg ${item.bg} flex items-center justify-center mb-2`}>
                                  <i className={`${item.icon} ${item.color} text-xs`} />
                                </div>
                                <p className={`text-sm font-black ${t.text}`}>{item.value}</p>
                                <p className={`text-[10px] ${t.textFaint} mt-0.5`}>{item.label}</p>
                              </div>
                            ))}
                          </div>

                          {/* 멤버 활성도 바 */}
                          <div className="mt-3 pt-3 border-t border-white/5">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className={`text-[11px] ${t.textFaint}`}>멤버 활성도</span>
                              <span className={`text-[11px] font-bold ${t.textSub}`}>
                                {team.member_count > 0 ? Math.round((team.active_members_7d / team.member_count) * 100) : 0}%
                              </span>
                            </div>
                            <div className={`h-2 ${t.barBg} rounded-full overflow-hidden`}>
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                style={{ width: `${team.member_count > 0 ? Math.round((team.active_members_7d / team.member_count) * 100) : 0}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 콘텐츠 유형별 팀 비교 차트 */}
      <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className={`text-sm font-black ${t.text}`}>콘텐츠 유형별 팀 비교</p>
            <p className={`text-xs ${t.textMuted} mt-0.5`}>활성 팀의 콘텐츠 유형 분포 비교</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className={`border-b ${t.border}`}>
                <th className={`text-left py-2.5 pr-4 text-[11px] font-black ${t.textFaint} uppercase tracking-wider`}>팀명</th>
                {contentTypeConfig.map((cfg) => (
                  <th key={cfg.key} className={`text-center py-2.5 px-2 text-[11px] font-black ${t.textFaint} uppercase tracking-wider`}>
                    <div className="flex items-center justify-center gap-1">
                      <i className={`${cfg.icon} ${cfg.textColor} text-xs`} />
                      <span className="hidden sm:inline">{cfg.label}</span>
                    </div>
                  </th>
                ))}
                <th className={`text-right py-2.5 pl-4 text-[11px] font-black ${t.textFaint} uppercase tracking-wider`}>합계</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${t.divider}`}>
              {filtered.filter((t) => t.status === 'active').map((team) => (
                <tr key={team.id} className={`${t.rowHover} transition-colors`}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${accessConfig[team.content_access].color.replace('text-', 'bg-')}`} />
                      <span className={`text-xs font-semibold ${t.text} whitespace-nowrap`}>{team.name}</span>
                    </div>
                  </td>
                  {contentTypeConfig.map((cfg) => {
                    const count = team[cfg.key as keyof TeamStat] as number;
                    const pct = team.total_content > 0 ? Math.round((count / team.total_content) * 100) : 0;
                    return (
                      <td key={cfg.key} className="py-3 px-2 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-xs font-bold ${t.text}`}>{count}</span>
                          <div className={`w-12 h-1 ${t.barBg} rounded-full overflow-hidden`}>
                            <div className={`h-full ${cfg.color} rounded-full`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`text-[9px] ${t.textFaint}`}>{pct}%</span>
                        </div>
                      </td>
                    );
                  })}
                  <td className="py-3 pl-4 text-right">
                    <span className={`text-sm font-black ${t.text}`}>{team.total_content.toLocaleString()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
