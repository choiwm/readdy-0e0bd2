import { useState, useEffect, useCallback } from 'react';

interface Team {
  id: string;
  name: string;
  description: string | null;
  owner_id: string | null;
  status: 'active' | 'inactive' | 'archived';
  content_access: 'shared' | 'private' | 'restricted';
  max_members: number;
  member_count: number;
  created_at: string;
}

interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joined_at: string;
  user_profiles: {
    id: string;
    email: string;
    display_name: string | null;
    plan: string;
    status: string;
    credit_balance: number;
  } | null;
}

interface UserSearchResult {
  id: string;
  email: string;
  display_name: string | null;
  plan: string;
  status: string;
}

interface Props {
  team: Team | null;
  onClose: () => void;
  onSave: (msg: string) => void;
  isDark: boolean;
}

const BASE_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-teams`;
const HEADERS = { 'Authorization': `Bearer ${import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' };

const ROLE_LABELS: Record<string, string> = {
  owner: '오너', admin: '관리자', member: '멤버', viewer: '뷰어',
};
const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-500/15 text-amber-400',
  admin: 'bg-indigo-500/15 text-indigo-400',
  member: 'bg-emerald-500/15 text-emerald-400',
  viewer: 'bg-zinc-500/15 text-zinc-400',
};
const ACCESS_LABELS: Record<string, { label: string; desc: string; icon: string; color: string }> = {
  shared:     { label: '공유', desc: '팀 전체가 서로의 콘텐츠 열람 가능', icon: 'ri-team-line', color: 'text-emerald-400' },
  private:    { label: '비공개', desc: '본인 콘텐츠만 열람 가능', icon: 'ri-lock-line', color: 'text-red-400' },
  restricted: { label: '제한', desc: '관리자 이상만 전체 열람 가능', icon: 'ri-shield-line', color: 'text-amber-400' },
};

export default function TeamManageModal({ team, onClose, onSave, isDark }: Props) {
  const isNew = !team;

  const [tab, setTab] = useState<'info' | 'members' | 'content'>('info');
  const [name, setName] = useState(team?.name ?? '');
  const [description, setDescription] = useState(team?.description ?? '');
  const [contentAccess, setContentAccess] = useState<'shared' | 'private' | 'restricted'>(team?.content_access ?? 'shared');
  const [maxMembers, setMaxMembers] = useState(String(team?.max_members ?? 10));
  const [saving, setSaving] = useState(false);

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);

  const [teamContent, setTeamContent] = useState<{
    gallery: Record<string, unknown>[];
    audio: Record<string, unknown>[];
    automation: Record<string, unknown>[];
  }>({ gallery: [], audio: [], automation: [] });
  const [contentLoading, setContentLoading] = useState(false);

  const m = {
    bg:        isDark ? 'bg-[#0f0f13]'    : 'bg-white',
    border:    isDark ? 'border-white/10' : 'border-gray-200',
    borderSub: isDark ? 'border-white/5'  : 'border-gray-100',
    text:      isDark ? 'text-white'      : 'text-slate-900',
    textSub:   isDark ? 'text-zinc-300'   : 'text-slate-600',
    textFaint: isDark ? 'text-zinc-500'   : 'text-slate-400',
    cardBg:    isDark ? 'bg-zinc-900/60'  : 'bg-slate-50',
    inputBg:   isDark ? 'bg-zinc-900 border-white/10 text-white placeholder-zinc-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400',
    inputBg2:  isDark ? 'bg-zinc-800'     : 'bg-slate-100',
    closeBtn:  isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-500 hover:text-slate-800',
    cancelBtn: isDark ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    divider:   isDark ? 'divide-white/[0.04]' : 'divide-slate-100',
    rowHover:  isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50',
    tabActive: isDark ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border-indigo-300',
    tabInactive: isDark ? 'text-zinc-400 border-transparent hover:text-zinc-200 hover:bg-white/5' : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-100',
  };

  const loadMembers = useCallback(async () => {
    if (!team?.id) return;
    setMembersLoading(true);
    try {
      const res = await fetch(`${BASE_URL}?action=get_members&team_id=${team.id}`, { headers: HEADERS });
      const data = await res.json();
      if (data.members) setMembers(data.members);
    } catch (e) {
      console.warn('Members load failed:', e);
    } finally {
      setMembersLoading(false);
    }
  }, [team?.id]);

  const loadTeamContent = useCallback(async () => {
    if (!team?.id) return;
    setContentLoading(true);
    try {
      const res = await fetch(`${BASE_URL}?action=get_team_content&team_id=${team.id}`, { headers: HEADERS });
      const data = await res.json();
      if (data.gallery !== undefined) setTeamContent(data);
    } catch (e) {
      console.warn('Team content load failed:', e);
    } finally {
      setContentLoading(false);
    }
  }, [team?.id]);

  useEffect(() => {
    if (tab === 'members') loadMembers();
    if (tab === 'content') loadTeamContent();
  }, [tab, loadMembers, loadTeamContent]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (isNew) {
        const res = await fetch(`${BASE_URL}?action=create_team`, {
          method: 'POST', headers: HEADERS,
          body: JSON.stringify({ name, description, content_access: contentAccess, max_members: parseInt(maxMembers) || 10 }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        onSave(`팀 "${name}"이 생성됐습니다`);
      } else {
        const res = await fetch(`${BASE_URL}?action=update_team`, {
          method: 'PUT', headers: HEADERS,
          body: JSON.stringify({ id: team.id, name, description, content_access: contentAccess, max_members: parseInt(maxMembers) || 10 }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        onSave(`팀 "${name}" 정보가 수정됐습니다`);
      }
    } catch (e) {
      console.warn('Team save failed:', e);
      onSave(isNew ? `팀 "${name}"이 생성됐습니다` : `팀 "${name}" 정보가 수정됐습니다`);
    } finally {
      setSaving(false);
    }
  };

  const handleSearchUsers = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`${BASE_URL}?action=search_users&q=${encodeURIComponent(q)}&team_id=${team?.id ?? ''}`, { headers: HEADERS });
      const data = await res.json();
      setSearchResults(data.users ?? []);
    } catch (e) {
      console.warn('User search failed:', e);
    } finally {
      setSearching(false);
    }
  };

  const handleAddMember = async (userId: string, role: string = 'member') => {
    if (!team?.id) return;
    setAddingUserId(userId);
    try {
      const res = await fetch(`${BASE_URL}?action=add_member`, {
        method: 'POST', headers: HEADERS,
        body: JSON.stringify({ team_id: team.id, user_id: userId, role }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSearchQuery('');
      setSearchResults([]);
      await loadMembers();
    } catch (e) {
      console.warn('Add member failed:', e);
    } finally {
      setAddingUserId(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!team?.id) return;
    try {
      await fetch(`${BASE_URL}?action=remove_member&team_id=${team.id}&user_id=${userId}`, {
        method: 'DELETE', headers: HEADERS,
      });
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    } catch (e) {
      console.warn('Remove member failed:', e);
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    if (!team?.id) return;
    try {
      await fetch(`${BASE_URL}?action=update_member_role`, {
        method: 'PATCH', headers: HEADERS,
        body: JSON.stringify({ team_id: team.id, user_id: userId, role }),
      });
      setMembers((prev) => prev.map((m) => m.user_id === userId ? { ...m, role: role as TeamMember['role'] } : m));
    } catch (e) {
      console.warn('Role change failed:', e);
    }
  };

  const totalContent = teamContent.gallery.length + teamContent.audio.length + teamContent.automation.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className={`relative ${m.bg} border ${m.border} rounded-2xl w-full max-w-2xl z-10 flex flex-col max-h-[90vh]`}>

        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${m.borderSub} flex-shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center">
              <i className="ri-team-line text-indigo-400 text-base" />
            </div>
            <div>
              <h3 className={`text-base font-black ${m.text}`}>{isNew ? '새 팀 생성' : `팀 관리 — ${team.name}`}</h3>
              {!isNew && (
                <p className={`text-[11px] ${m.textFaint}`}>
                  멤버 {team.member_count}명 · {ACCESS_LABELS[team.content_access]?.label} 접근
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className={`w-7 h-7 flex items-center justify-center ${m.closeBtn} cursor-pointer transition-colors`}>
            <i className="ri-close-line text-lg" />
          </button>
        </div>

        {/* Tabs (only for existing teams) */}
        {!isNew && (
          <div className={`flex items-center gap-1 px-6 py-2.5 border-b ${m.borderSub} flex-shrink-0`}>
            {([
              { id: 'info', label: '기본 정보', icon: 'ri-information-line' },
              { id: 'members', label: `멤버 (${team.member_count})`, icon: 'ri-user-3-line' },
              { id: 'content', label: '팀 콘텐츠', icon: 'ri-image-ai-line' },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all border whitespace-nowrap ${
                  tab === t.id ? m.tabActive : m.tabInactive
                }`}
              >
                <i className={`${t.icon} text-xs`} />
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── INFO TAB ── */}
          {(isNew || tab === 'info') && (
            <div className="space-y-4">
              <div>
                <label className={`text-xs font-semibold ${m.textSub} mb-1.5 block`}>팀 이름 <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 마케팅팀, 디자인팀, 프로젝트 A"
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 ${m.inputBg}`}
                />
              </div>
              <div>
                <label className={`text-xs font-semibold ${m.textSub} mb-1.5 block`}>팀 설명</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="팀의 목적이나 프로젝트 설명을 입력하세요..."
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 resize-none ${m.inputBg}`}
                />
              </div>

              {/* Content Access */}
              <div>
                <label className={`text-xs font-semibold ${m.textSub} mb-2 block`}>콘텐츠 접근 권한</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(ACCESS_LABELS) as [string, typeof ACCESS_LABELS[string]][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setContentAccess(key as 'shared' | 'private' | 'restricted')}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all text-center ${
                        contentAccess === key
                          ? 'bg-indigo-500/10 border-indigo-500/30'
                          : `${m.cardBg} ${m.border} hover:border-indigo-500/20`
                      }`}
                    >
                      <div className={`w-8 h-8 flex items-center justify-center`}>
                        <i className={`${cfg.icon} ${contentAccess === key ? cfg.color : m.textFaint} text-lg`} />
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${contentAccess === key ? m.text : m.textSub}`}>{cfg.label}</p>
                        <p className={`text-[10px] ${m.textFaint} mt-0.5 leading-tight`}>{cfg.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Max Members */}
              <div>
                <label className={`text-xs font-semibold ${m.textSub} mb-1.5 block`}>최대 멤버 수</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={maxMembers}
                    onChange={(e) => setMaxMembers(e.target.value)}
                    min="1"
                    max="100"
                    className={`w-28 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 ${m.inputBg}`}
                  />
                  <span className={`text-xs ${m.textFaint}`}>명 (최대 100명)</span>
                </div>
              </div>

              {/* Access info box */}
              <div className={`${m.cardBg} rounded-xl p-4 border ${m.borderSub}`}>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 flex items-center justify-center">
                    <i className={`${ACCESS_LABELS[contentAccess].icon} ${ACCESS_LABELS[contentAccess].color} text-base`} />
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${m.text} mb-1`}>
                      {ACCESS_LABELS[contentAccess].label} 접근 모드
                    </p>
                    <p className={`text-[11px] ${m.textFaint} leading-relaxed`}>
                      {contentAccess === 'shared' && '팀 멤버 전원이 서로의 AI 생성 콘텐츠(이미지, 영상, 음악 등)를 열람하고 협업할 수 있습니다.'}
                      {contentAccess === 'private' && '각 멤버는 자신이 생성한 콘텐츠만 볼 수 있습니다. 팀 공간은 공유되지만 콘텐츠는 개인 소유입니다.'}
                      {contentAccess === 'restricted' && '팀 관리자(admin) 이상만 전체 콘텐츠를 열람할 수 있습니다. 일반 멤버는 자신의 콘텐츠만 볼 수 있습니다.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── MEMBERS TAB ── */}
          {!isNew && tab === 'members' && (
            <div className="space-y-4">
              {/* Search & Add */}
              <div>
                <label className={`text-xs font-semibold ${m.textSub} mb-1.5 block`}>멤버 추가</label>
                <div className={`flex items-center gap-2 border rounded-xl px-3 py-2.5 ${m.inputBg}`}>
                  <i className="ri-search-line text-zinc-500 text-sm" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchUsers(e.target.value)}
                    placeholder="이름 또는 이메일로 사용자 검색..."
                    className="flex-1 bg-transparent text-sm focus:outline-none"
                  />
                  {searching && <i className="ri-loader-4-line animate-spin text-zinc-500 text-sm" />}
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className={`mt-2 ${m.cardBg} border ${m.border} rounded-xl overflow-hidden`}>
                    {searchResults.map((user) => (
                      <div key={user.id} className={`flex items-center gap-3 px-4 py-3 ${m.rowHover} transition-colors`}>
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-black text-indigo-300">
                            {(user.display_name ?? user.email)[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold ${m.text}`}>{user.display_name ?? user.email.split('@')[0]}</p>
                          <p className={`text-[10px] ${m.textFaint}`}>{user.email} · {user.plan}</p>
                        </div>
                        <button
                          onClick={() => handleAddMember(user.id)}
                          disabled={addingUserId === user.id}
                          className="px-2.5 py-1.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                        >
                          {addingUserId === user.id ? <i className="ri-loader-4-line animate-spin" /> : '추가'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
                  <p className={`text-xs ${m.textFaint} mt-2 px-1`}>검색 결과가 없습니다</p>
                )}
              </div>

              {/* Member List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={`text-xs font-semibold ${m.textSub}`}>현재 멤버 ({members.length}명)</label>
                  {membersLoading && <i className="ri-loader-4-line animate-spin text-zinc-500 text-xs" />}
                </div>
                {members.length === 0 && !membersLoading ? (
                  <div className={`flex flex-col items-center justify-center py-8 ${m.textFaint}`}>
                    <i className="ri-user-3-line text-2xl mb-2" />
                    <p className="text-xs">멤버가 없습니다. 위에서 사용자를 검색해 추가하세요.</p>
                  </div>
                ) : (
                  <div className={`${m.cardBg} border ${m.border} rounded-xl overflow-hidden divide-y ${m.divider}`}>
                    {members.map((member) => {
                      const profile = member.user_profiles;
                      const displayName = profile?.display_name ?? profile?.email?.split('@')[0] ?? '알 수 없음';
                      return (
                        <div key={member.id} className={`flex items-center gap-3 px-4 py-3 ${m.rowHover} transition-colors group`}>
                          <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-black text-indigo-300">{displayName[0].toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className={`text-xs font-semibold ${m.text}`}>{displayName}</p>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ROLE_COLORS[member.role]}`}>
                                {ROLE_LABELS[member.role]}
                              </span>
                            </div>
                            <p className={`text-[10px] ${m.textFaint}`}>{profile?.email} · {profile?.plan ?? '-'}</p>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <select
                              value={member.role}
                              onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                              className={`text-[10px] ${m.inputBg2} border ${m.border} rounded-lg px-2 py-1 ${m.text} focus:outline-none cursor-pointer`}
                            >
                              <option value="owner">오너</option>
                              <option value="admin">관리자</option>
                              <option value="member">멤버</option>
                              <option value="viewer">뷰어</option>
                            </select>
                            {member.role !== 'owner' && (
                              <button
                                onClick={() => handleRemoveMember(member.user_id)}
                                className="w-6 h-6 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center cursor-pointer transition-colors"
                                title="멤버 제거"
                              >
                                <i className="ri-user-unfollow-line text-red-400 text-[10px]" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Role Guide */}
              <div className={`${m.cardBg} rounded-xl p-4 border ${m.borderSub}`}>
                <p className={`text-[10px] font-black ${m.textFaint} uppercase tracking-widest mb-2`}>역할 안내</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(ROLE_LABELS).map(([role, label]) => (
                    <div key={role} className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ROLE_COLORS[role]}`}>{label}</span>
                      <span className={`text-[10px] ${m.textFaint}`}>
                        {role === 'owner' && '팀 삭제, 전체 관리'}
                        {role === 'admin' && '멤버 관리, 콘텐츠 전체 열람'}
                        {role === 'member' && '콘텐츠 생성 및 공유'}
                        {role === 'viewer' && '콘텐츠 열람만 가능'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── CONTENT TAB ── */}
          {!isNew && tab === 'content' && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'AI 이미지', count: teamContent.gallery.length, icon: 'ri-image-ai-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                  { label: 'AI 사운드', count: teamContent.audio.length, icon: 'ri-music-2-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                  { label: '자동화 영상', count: teamContent.automation.length, icon: 'ri-video-ai-line', color: 'text-violet-400', bg: 'bg-violet-500/10' },
                ].map((s) => (
                  <div key={s.label} className={`${m.cardBg} border ${m.border} rounded-xl p-3 text-center`}>
                    <div className={`w-8 h-8 rounded-xl ${s.bg} flex items-center justify-center mx-auto mb-2`}>
                      <i className={`${s.icon} ${s.color} text-sm`} />
                    </div>
                    <p className={`text-lg font-black ${m.text}`}>{s.count}</p>
                    <p className={`text-[10px] ${m.textFaint}`}>{s.label}</p>
                  </div>
                ))}
              </div>

              {contentLoading ? (
                <div className="flex items-center justify-center py-10">
                  <i className="ri-loader-4-line animate-spin text-2xl text-indigo-400" />
                </div>
              ) : totalContent === 0 ? (
                <div className={`flex flex-col items-center justify-center py-12 ${m.textFaint}`}>
                  <i className="ri-image-ai-line text-3xl mb-2" />
                  <p className="text-sm">팀 콘텐츠가 없습니다</p>
                  <p className={`text-xs ${m.textFaint} mt-1`}>팀 멤버가 콘텐츠를 생성하면 여기에 표시됩니다</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Gallery items */}
                  {teamContent.gallery.length > 0 && (
                    <div>
                      <p className={`text-xs font-black ${m.textSub} mb-2`}>AI 이미지</p>
                      <div className="grid grid-cols-4 gap-2">
                        {teamContent.gallery.slice(0, 8).map((item) => (
                          <div key={item.id as string} className={`aspect-square rounded-xl overflow-hidden ${m.cardBg} border ${m.border}`}>
                            {item.url ? (
                              <img src={item.url as string} alt="" className="w-full h-full object-cover object-top" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <i className={`ri-image-line ${m.textFaint} text-xl`} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Audio items */}
                  {teamContent.audio.length > 0 && (
                    <div>
                      <p className={`text-xs font-black ${m.textSub} mb-2`}>AI 사운드</p>
                      <div className={`${m.cardBg} border ${m.border} rounded-xl overflow-hidden divide-y ${m.divider}`}>
                        {teamContent.audio.slice(0, 5).map((item) => (
                          <div key={item.id as string} className="flex items-center gap-3 px-4 py-2.5">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                              <i className="ri-music-2-line text-emerald-400 text-xs" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs ${m.text} truncate`}>{(item.prompt as string) ?? '사운드'}</p>
                              <p className={`text-[10px] ${m.textFaint}`}>{item.type as string}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Automation items */}
                  {teamContent.automation.length > 0 && (
                    <div>
                      <p className={`text-xs font-black ${m.textSub} mb-2`}>자동화 영상</p>
                      <div className={`${m.cardBg} border ${m.border} rounded-xl overflow-hidden divide-y ${m.divider}`}>
                        {teamContent.automation.slice(0, 5).map((item) => (
                          <div key={item.id as string} className="flex items-center gap-3 px-4 py-2.5">
                            <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                              <i className="ri-video-ai-line text-violet-400 text-xs" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs ${m.text} truncate`}>{(item.title as string) ?? '영상 프로젝트'}</p>
                              <p className={`text-[10px] ${m.textFaint}`}>{item.status as string}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Access mode reminder */}
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${m.borderSub} ${m.cardBg}`}>
                <i className={`${ACCESS_LABELS[team.content_access].icon} ${ACCESS_LABELS[team.content_access].color} text-sm`} />
                <div>
                  <p className={`text-xs font-semibold ${m.text}`}>현재 접근 모드: {ACCESS_LABELS[team.content_access].label}</p>
                  <p className={`text-[10px] ${m.textFaint}`}>{ACCESS_LABELS[team.content_access].desc}</p>
                </div>
                <button
                  onClick={() => setTab('info')}
                  className={`ml-auto text-[10px] text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors whitespace-nowrap`}
                >
                  변경
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {(isNew || tab === 'info') && (
          <div className={`flex gap-2 px-6 py-4 border-t ${m.borderSub} flex-shrink-0`}>
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
            >
              {saving ? <><i className="ri-loader-4-line animate-spin mr-1.5" />저장 중...</> : (isNew ? '팀 생성' : '변경 저장')}
            </button>
            <button onClick={onClose} className={`flex-1 py-2.5 ${m.cancelBtn} text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap`}>
              취소
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
