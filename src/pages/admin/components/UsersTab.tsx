import type { MutableRefObject } from 'react';
import { PlanBadge, StatusBadge } from './Badges';
import { GradeBadge } from './AdminHelpers';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  plan: string;
  credits: number;
  joined: string;
  status: 'active' | 'inactive' | 'suspended';
  lastLogin: string;
  loginIp: string;
  projects: number;
  memberGrade: string;
}

export interface UserStats {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  free: number;
  pro: number;
  enterprise: number;
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
  tableHead: string;
  rowHover: string;
  divider: string;
}

interface UsersTabProps {
  isDark: boolean;
  t: Theme;

  usersLoading: boolean;
  userStats: UserStats;
  displayUsers: UserRecord[];
  filteredUsers: UserRecord[];
  overviewNewToday: number | undefined;

  userSearch: string;
  setUserSearch: (v: string) => void;
  userSearchDebounceRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;

  userPlanFilter: string;
  setUserPlanFilter: (v: string) => void;

  userGradeFilter: string;
  setUserGradeFilter: (v: string) => void;

  loadUsers: (search?: string, plan?: string, grade?: string) => void;

  onViewUser: (u: UserRecord) => void;
  onOpenGradeChange: (u: UserRecord) => void;
  onToggleUserStatus: (u: UserRecord) => void;
  onJumpToGradeSettings: () => void;
}

const PLAN_FILTERS = ['전체', 'Pro', 'Free', 'Enterprise'];

const GRADE_FILTERS: Array<{ key: string; label: string; icon: string; color: string }> = [
  { key: '전체', label: '전체', icon: '', color: '' },
  { key: 'general', label: '일반', icon: 'ri-user-line', color: 'text-slate-400' },
  { key: 'staff', label: '운영진', icon: 'ri-shield-star-line', color: 'text-violet-400' },
  { key: 'b2b', label: 'B2B', icon: 'ri-building-2-line', color: 'text-amber-400' },
  { key: 'group', label: '단체', icon: 'ri-group-line', color: 'text-emerald-400' },
  { key: 'vip', label: 'VIP', icon: 'ri-vip-crown-line', color: 'text-orange-400' },
];

export default function UsersTab({
  isDark, t,
  usersLoading, userStats, displayUsers, filteredUsers, overviewNewToday,
  userSearch, setUserSearch, userSearchDebounceRef,
  userPlanFilter, setUserPlanFilter,
  userGradeFilter, setUserGradeFilter,
  loadUsers,
  onViewUser, onOpenGradeChange, onToggleUserStatus, onJumpToGradeSettings,
}: UsersTabProps) {
  const summary = [
    { label: '전체 회원', value: usersLoading ? '...' : userStats.total > 0 ? userStats.total.toLocaleString() : displayUsers.length.toLocaleString(), icon: 'ri-user-3-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { label: '활성 회원', value: usersLoading ? '...' : userStats.total > 0 ? userStats.active.toLocaleString() : displayUsers.filter((u) => u.status === 'active').length.toLocaleString(), icon: 'ri-user-follow-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: '정지 계정', value: usersLoading ? '...' : userStats.total > 0 ? userStats.suspended.toLocaleString() : displayUsers.filter((u) => u.status === 'suspended').length.toLocaleString(), icon: 'ri-user-forbid-line', color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: '오늘 신규', value: usersLoading ? '...' : overviewNewToday !== undefined ? String(overviewNewToday) : '-', icon: 'ri-user-add-line', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summary.map((c) => (
          <div key={c.label} className={`${t.cardBg} border ${t.border} rounded-2xl p-4`}>
            <div className={`w-8 h-8 rounded-xl ${c.bg} flex items-center justify-center mb-2`}>
              <i className={`${c.icon} ${c.color} text-sm`} />
            </div>
            <p className={`text-lg font-black ${t.text}`}>{c.value}</p>
            <p className={`text-[11px] ${t.textMuted}`}>{c.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className={`flex items-center gap-2 flex-1 ${t.cardBg} border ${t.border} rounded-xl px-3 py-2.5`}>
            <i className="ri-search-line text-zinc-500 text-sm" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => {
                const val = e.target.value;
                setUserSearch(val);
                if (userSearchDebounceRef.current) clearTimeout(userSearchDebounceRef.current);
                userSearchDebounceRef.current = setTimeout(() => {
                  loadUsers(val, userPlanFilter, userGradeFilter);
                }, 300);
              }}
              placeholder="이름, 이메일, ID 검색..."
              aria-label="사용자 검색"
              className={`flex-1 bg-transparent text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-gray-400'} focus:outline-none`}
            />
            {usersLoading ? (
              <i className="ri-loader-4-line animate-spin text-indigo-400 text-sm" />
            ) : userSearch ? (
              <button
                onClick={() => {
                  setUserSearch('');
                  if (userSearchDebounceRef.current) clearTimeout(userSearchDebounceRef.current);
                  loadUsers('', userPlanFilter, userGradeFilter);
                }}
                aria-label="검색어 지우기"
                className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-sm" />
              </button>
            ) : null}
          </div>
          <div className="flex gap-2 flex-wrap">
            {PLAN_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => {
                  setUserPlanFilter(f);
                  loadUsers(userSearch, f, userGradeFilter);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                  userPlanFilter === f
                    ? 'bg-indigo-500 text-white'
                    : `${t.cardBg2} border ${t.border} ${t.textMuted} hover:${t.text}`
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold ${t.textFaint} whitespace-nowrap`}>등급 필터:</span>
          {GRADE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setUserGradeFilter(f.key);
                loadUsers(userSearch, userPlanFilter, f.key);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                userGradeFilter === f.key
                  ? 'bg-indigo-500 text-white'
                  : `${t.cardBg2} border ${t.border} ${t.textMuted} hover:${t.text}`
              }`}
            >
              {f.icon && <i className={`${f.icon} text-xs ${userGradeFilter === f.key ? 'text-white' : f.color}`} />}
              {f.label}
            </button>
          ))}
          <button
            onClick={onJumpToGradeSettings}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ml-auto ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800'}`}
          >
            <i className="ri-settings-3-line text-xs" />
            등급 권한 설정
          </button>
        </div>
      </div>

      <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`border-b ${t.border}`}>
                <th className={`text-left px-5 py-3.5 text-[11px] font-black ${t.tableHead} uppercase tracking-wider`}>사용자</th>
                <th className={`text-left px-4 py-3.5 text-[11px] font-black ${t.tableHead} uppercase tracking-wider hidden sm:table-cell`}>ID</th>
                <th className={`text-left px-4 py-3.5 text-[11px] font-black ${t.tableHead} uppercase tracking-wider`}>플랜</th>
                <th className={`text-right px-4 py-3.5 text-[11px] font-black ${t.tableHead} uppercase tracking-wider hidden md:table-cell`}>크레딧</th>
                <th className={`text-right px-4 py-3.5 text-[11px] font-black ${t.tableHead} uppercase tracking-wider hidden lg:table-cell`}>프로젝트</th>
                <th className={`text-left px-4 py-3.5 text-[11px] font-black ${t.tableHead} uppercase tracking-wider hidden lg:table-cell`}>가입일</th>
                <th className={`text-left px-4 py-3.5 text-[11px] font-black ${t.tableHead} uppercase tracking-wider hidden md:table-cell`}>등급</th>
                <th className={`text-left px-4 py-3.5 text-[11px] font-black ${t.tableHead} uppercase tracking-wider`}>상태</th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody className={`divide-y ${t.divider}`}>
              {filteredUsers.map((u) => (
                <tr key={u.id} className={`${t.rowHover} transition-colors group`}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-black text-indigo-300">{u.name[0]}</span>
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold ${t.text}`}>{u.name}</p>
                        <p className={`text-[11px] ${t.textFaint} truncate`}>{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    <span className={`text-xs font-mono ${t.textMuted}`}>{u.id}</span>
                  </td>
                  <td className="px-4 py-3.5"><PlanBadge plan={u.plan} isDark={isDark} /></td>
                  <td className="px-4 py-3.5 text-right hidden md:table-cell">
                    <span className={`text-sm font-bold ${t.text}`}>{u.credits.toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right hidden lg:table-cell">
                    <span className={`text-sm ${t.textSub}`}>{u.projects}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right hidden lg:table-cell">
                    <span className={`text-xs ${t.textMuted}`}>{u.joined}</span>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <GradeBadge grade={u.memberGrade ?? 'general'} />
                  </td>
                  <td className="px-4 py-3.5"><StatusBadge status={u.status} isDark={isDark} /></td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onViewUser(u)}
                        className={`w-7 h-7 rounded-lg ${t.inputBg2} hover:opacity-80 flex items-center justify-center cursor-pointer transition-colors`}
                        title="상세보기"
                        aria-label={`${u.name} 상세보기`}
                      >
                        <i className={`ri-eye-line ${t.textSub} text-xs`} />
                      </button>
                      <button
                        onClick={() => onOpenGradeChange(u)}
                        className="w-7 h-7 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 flex items-center justify-center cursor-pointer transition-colors"
                        title="등급 변경"
                        aria-label={`${u.name} 등급 변경`}
                      >
                        <i className="ri-vip-crown-line text-violet-400 text-xs" />
                      </button>
                      <button
                        onClick={() => onToggleUserStatus(u)}
                        className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center cursor-pointer transition-colors"
                        title={u.status === 'suspended' ? '계정 복구' : '계정 정지'}
                        aria-label={`${u.name} ${u.status === 'suspended' ? '계정 복구' : '계정 정지'}`}
                      >
                        <i className={`${u.status === 'suspended' ? 'ri-user-follow-line text-emerald-400' : 'ri-forbid-line text-red-400'} text-xs`} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {usersLoading && filteredUsers.length === 0 && (
          <div className={`text-center py-16 ${t.textFaint}`}>
            <i className="ri-loader-4-line animate-spin text-3xl text-indigo-400 mb-3 block" />
            <p className="text-sm">사용자 데이터를 불러오는 중...</p>
          </div>
        )}
        {!usersLoading && filteredUsers.length === 0 && (
          <div className={`text-center py-16 ${t.textFaint}`}>
            <i className="ri-user-search-line text-3xl mb-3 block" />
            <p className="text-sm font-semibold mb-1">
              {userSearch || userPlanFilter !== '전체' ? '검색 결과가 없습니다' : '등록된 사용자가 없습니다'}
            </p>
            {(userSearch || userPlanFilter !== '전체') && (
              <p className={`text-xs ${t.textFaint}`}>다른 검색어나 필터를 시도해보세요</p>
            )}
          </div>
        )}
        <div className={`px-5 py-3 border-t ${t.border} flex items-center justify-between`}>
          <span className={`text-xs ${t.textFaint}`}>
            {usersLoading ? (
              <span className="flex items-center gap-1.5">
                <i className="ri-loader-4-line animate-spin text-indigo-400 text-xs" />
                데이터 로딩 중...
              </span>
            ) : `${filteredUsers.length}명 표시 중`}
          </span>
          <div className="flex items-center gap-1">
            <button className={`w-7 h-7 rounded-lg ${t.inputBg2} flex items-center justify-center ${t.textMuted} cursor-pointer hover:${t.text} transition-colors`} aria-label="이전 페이지">
              <i className="ri-arrow-left-s-line text-sm" />
            </button>
            <span className={`text-xs ${t.textMuted} px-2`}>1 / 1</span>
            <button className={`w-7 h-7 rounded-lg ${t.inputBg2} flex items-center justify-center ${t.textMuted} cursor-pointer hover:${t.text} transition-colors`} aria-label="다음 페이지">
              <i className="ri-arrow-right-s-line text-sm" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
