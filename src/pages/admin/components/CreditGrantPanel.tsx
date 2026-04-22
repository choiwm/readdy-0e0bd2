import { useState, useCallback, useRef } from 'react';
import { getAuthorizationHeader } from '@/lib/env';

interface UserSearchResult {
  id: string;
  name: string;
  email: string;
  plan: string;
  credits: number;
  memberGrade: string;
}

interface GrantLog {
  id: string;
  type: 'single' | 'batch';
  targetLabel: string;
  amount: number;
  count: number;
  reason: string;
  time: string;
  success: boolean;
}

interface Props {
  isDark: boolean;
  onToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const GRADE_META: Record<string, { label: string; color: string; bg: string }> = {
  general:   { label: '일반',   color: 'text-slate-400',   bg: 'bg-slate-500/15' },
  staff:     { label: '운영진', color: 'text-violet-400',  bg: 'bg-violet-500/15' },
  b2b:       { label: 'B2B',    color: 'text-amber-400',   bg: 'bg-amber-500/15' },
  group:     { label: '단체',   color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  vip:       { label: 'VIP',    color: 'text-orange-400',  bg: 'bg-orange-500/15' },
  suspended: { label: '정지',   color: 'text-red-400',     bg: 'bg-red-500/15' },
};

const PRESET_AMOUNTS = [100, 300, 500, 1000, 3000, 5000];

export default function CreditGrantPanel({ isDark, onToast }: Props) {
  // ── Mode: single | batch ──
  const [mode, setMode] = useState<'single' | 'batch'>('single');

  // ── Single mode state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [singleAmount, setSingleAmount] = useState('');
  const [singleReason, setSingleReason] = useState('');
  const [singleLoading, setSingleLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // ── Batch mode state ──
  const [batchTarget, setBatchTarget] = useState<'all' | 'plan' | 'grade'>('all');
  const [batchPlan, setBatchPlan] = useState('free');
  const [batchGrade, setBatchGrade] = useState('general');
  const [batchAmount, setBatchAmount] = useState('');
  const [batchReason, setBatchReason] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchPreview, setBatchPreview] = useState<{ count: number; total: number } | null>(null);
  const [batchPreviewLoading, setBatchPreviewLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);

  // ── Grant logs (session) ──
  const [grantLogs, setGrantLogs] = useState<GrantLog[]>([]);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const t = {
    bg:        isDark ? 'bg-[#0f0f13]'    : 'bg-white',
    bg2:       isDark ? 'bg-zinc-900/60'  : 'bg-slate-50',
    bg3:       isDark ? 'bg-zinc-800/60'  : 'bg-slate-100',
    border:    isDark ? 'border-white/5'  : 'border-slate-200',
    border2:   isDark ? 'border-white/10' : 'border-slate-300',
    text:      isDark ? 'text-white'      : 'text-slate-900',
    textSub:   isDark ? 'text-zinc-300'   : 'text-slate-700',
    textMuted: isDark ? 'text-zinc-400'   : 'text-slate-600',
    textFaint: isDark ? 'text-zinc-500'   : 'text-slate-500',
    inputBg:   isDark ? 'bg-zinc-900 border-white/10 text-white placeholder-zinc-600' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400',
    rowHover:  isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50',
    divider:   isDark ? 'divide-white/[0.04]' : 'divide-slate-100',
  };

  // ── 유저 검색 ──
  const searchUsers = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-users`);
      url.searchParams.set('action', 'list_users');
      url.searchParams.set('search', q);
      url.searchParams.set('limit', '8');
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': getAuthorizationHeader() },
      });
      const data = await res.json();
      if (data.users) {
        setSearchResults(data.users.map((u: Record<string, unknown>) => ({
          id: u.id as string,
          name: (u.display_name as string) ?? (u.email as string)?.split('@')[0] ?? '알 수 없음',
          email: u.email as string,
          plan: u.plan ? ((u.plan as string)[0].toUpperCase() + (u.plan as string).slice(1)) : 'Free',
          credits: (u.credit_balance as number) ?? 0,
          memberGrade: (u.member_grade as string) ?? 'general',
        })));
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setShowDropdown(true);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => searchUsers(val), 280);
  };

  const selectUser = (user: UserSearchResult) => {
    setSelectedUser(user);
    setSearchQuery(user.email);
    setShowDropdown(false);
    setSearchResults([]);
  };

  // ── 단일 유저 코인 지급 ──
  const handleSingleGrant = async () => {
    if (!selectedUser) { onToast('유저를 선택해주세요', 'error'); return; }
    const amt = parseInt(singleAmount);
    if (isNaN(amt) || amt === 0) { onToast('올바른 코인 수를 입력해주세요', 'error'); return; }

    setSingleLoading(true);
    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-users`);
      url.searchParams.set('action', 'adjust_credits');
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Authorization': getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: selectedUser.id, amount: amt, reason: singleReason || '관리자 직접 지급' }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const newBalance = data.new_balance ?? (selectedUser.credits + amt);
      setSelectedUser((prev) => prev ? { ...prev, credits: newBalance } : prev);

      const log: GrantLog = {
        id: `log-${Date.now()}`,
        type: 'single',
        targetLabel: `${selectedUser.name} (${selectedUser.email})`,
        amount: amt,
        count: 1,
        reason: singleReason || '관리자 직접 지급',
        time: new Date().toLocaleString('ko-KR'),
        success: true,
      };
      setGrantLogs((prev) => [log, ...prev.slice(0, 19)]);

      onToast(`${selectedUser.name}에게 ${amt > 0 ? '+' : ''}${amt.toLocaleString()} CR 지급 완료`, 'success');
      setSingleAmount('');
      setSingleReason('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '지급 실패';
      onToast(`지급 실패: ${msg}`, 'error');
      const log: GrantLog = {
        id: `log-${Date.now()}`,
        type: 'single',
        targetLabel: `${selectedUser.name} (${selectedUser.email})`,
        amount: amt,
        count: 1,
        reason: singleReason || '관리자 직접 지급',
        time: new Date().toLocaleString('ko-KR'),
        success: false,
      };
      setGrantLogs((prev) => [log, ...prev.slice(0, 19)]);
    } finally {
      setSingleLoading(false);
    }
  };

  // ── 일괄 지급 미리보기 ──
  const fetchBatchPreview = useCallback(async () => {
    setBatchPreviewLoading(true);
    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-users`);
      url.searchParams.set('action', 'list_users');
      url.searchParams.set('limit', '9999');
      if (batchTarget === 'plan') url.searchParams.set('plan', batchPlan);
      if (batchTarget === 'grade') url.searchParams.set('grade', batchGrade);
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': getAuthorizationHeader() },
      });
      const data = await res.json();
      const count = data.total ?? data.users?.length ?? 0;
      const amt = parseInt(batchAmount) || 0;
      setBatchPreview({ count, total: count * amt });
    } catch {
      setBatchPreview(null);
    } finally {
      setBatchPreviewLoading(false);
    }
  }, [batchTarget, batchPlan, batchGrade, batchAmount]);

  // ── 일괄 지급 실행 ──
  const handleBatchGrant = async () => {
    const amt = parseInt(batchAmount);
    if (isNaN(amt) || amt <= 0) { onToast('지급 코인 수를 입력해주세요 (양수만)', 'error'); return; }

    setBatchLoading(true);
    setConfirmModal(false);
    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-users`);
      url.searchParams.set('action', 'grant_credits');
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Authorization': getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amt,
          reason: batchReason || '관리자 일괄 지급',
          target_type: batchTarget,
          target_value: batchTarget === 'plan' ? batchPlan : batchTarget === 'grade' ? batchGrade : undefined,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const log: GrantLog = {
        id: `log-${Date.now()}`,
        type: 'batch',
        targetLabel: data.target_label ?? '일괄 대상',
        amount: amt,
        count: data.granted_count ?? 0,
        reason: batchReason || '관리자 일괄 지급',
        time: new Date().toLocaleString('ko-KR'),
        success: true,
      };
      setGrantLogs((prev) => [log, ...prev.slice(0, 19)]);

      onToast(`${data.granted_count}명에게 +${amt.toLocaleString()} CR 일괄 지급 완료`, 'success');
      setBatchAmount('');
      setBatchReason('');
      setBatchPreview(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '지급 실패';
      onToast(`일괄 지급 실패: ${msg}`, 'error');
    } finally {
      setBatchLoading(false);
    }
  };

  const batchTargetLabel =
    batchTarget === 'all' ? '전체 유저'
    : batchTarget === 'plan' ? `${batchPlan.charAt(0).toUpperCase() + batchPlan.slice(1)} 플랜 유저`
    : `${GRADE_META[batchGrade]?.label ?? batchGrade} 등급 유저`;

  return (
    <div className="space-y-5">

      {/* ── 헤더 ── */}
      <div className={`flex items-center gap-4 px-5 py-4 rounded-2xl border ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
          <i className="ri-coin-line text-amber-400 text-lg" />
        </div>
        <div>
          <p className={`text-sm font-black ${t.text}`}>코인 직접 지급</p>
          <p className={`text-xs ${t.textMuted}`}>
            특정 유저 또는 플랜/등급별로 크레딧을 즉시 지급합니다. 감사 로그에 자동 기록됩니다.
          </p>
        </div>
        {/* Mode toggle */}
        <div className={`ml-auto flex items-center gap-1 p-1 rounded-xl border ${t.border} ${t.bg2} flex-shrink-0`}>
          {([
            { id: 'single', label: '개별 지급', icon: 'ri-user-line' },
            { id: 'batch',  label: '일괄 지급', icon: 'ri-group-line' },
          ] as const).map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all whitespace-nowrap ${
                mode === m.id ? 'bg-amber-500 text-white' : `${t.textMuted} hover:${t.text}`
              }`}
            >
              <i className={`${m.icon} text-xs`} />
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* ── 좌측: 지급 폼 ── */}
        <div className="lg:col-span-3 space-y-4">

          {/* ══ 개별 지급 모드 ══ */}
          {mode === 'single' && (
            <div className={`${t.bg} border ${t.border} rounded-2xl p-5`}>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/15 flex items-center justify-center">
                  <i className="ri-user-search-line text-indigo-400 text-sm" />
                </div>
                <div>
                  <p className={`text-sm font-black ${t.text}`}>유저 검색 & 코인 지급</p>
                  <p className={`text-xs ${t.textMuted}`}>이메일 또는 이름으로 유저를 검색하세요</p>
                </div>
              </div>

              {/* 유저 검색 */}
              <div className="mb-4 relative">
                <label className={`text-xs font-semibold ${t.textMuted} mb-1.5 block`}>유저 검색 <span className="text-red-400">*</span></label>
                <div className={`flex items-center gap-2 border rounded-xl px-3 py-2.5 ${isDark ? 'bg-zinc-900 border-white/10' : 'bg-white border-slate-300'}`}>
                  <i className="ri-search-line text-zinc-500 text-sm flex-shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                    placeholder="이메일 또는 이름으로 검색..."
                    className={`flex-1 bg-transparent text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-slate-400'} focus:outline-none`}
                  />
                  {searchLoading && <i className="ri-loader-4-line animate-spin text-zinc-500 text-sm flex-shrink-0" />}
                  {selectedUser && !searchLoading && (
                    <button
                      onClick={() => { setSelectedUser(null); setSearchQuery(''); setSearchResults([]); }}
                      className="w-4 h-4 flex items-center justify-center text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors flex-shrink-0"
                    >
                      <i className="ri-close-line text-xs" />
                    </button>
                  )}
                </div>

                {/* 검색 드롭다운 */}
                {showDropdown && searchResults.length > 0 && (
                  <div className={`absolute top-full left-0 right-0 mt-1.5 z-20 ${t.bg} border ${t.border2} rounded-xl overflow-hidden`}
                    style={{ boxShadow: isDark ? '0 16px 40px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.12)' }}
                  >
                    {searchResults.map((user) => {
                      const grade = GRADE_META[user.memberGrade] ?? GRADE_META.general;
                      return (
                        <button
                          key={user.id}
                          onClick={() => selectUser(user)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer transition-colors ${t.rowHover} border-b ${t.border} last:border-0`}
                        >
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/30 to-violet-500/30 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-black text-indigo-300">{user.name[0]}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold ${t.text}`}>{user.name}</p>
                            <p className={`text-[10px] ${t.textFaint} truncate`}>{user.email}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${grade.bg} ${grade.color}`}>{grade.label}</span>
                            <span className={`text-[10px] font-semibold ${t.textMuted}`}>{user.credits.toLocaleString()} CR</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 선택된 유저 카드 */}
              {selectedUser && (
                <div className={`mb-4 p-4 rounded-xl border ${isDark ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-200'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-black text-indigo-300">{selectedUser.name[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${t.text}`}>{selectedUser.name}</p>
                      <p className={`text-[11px] ${t.textFaint}`}>{selectedUser.email}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-xs ${t.textMuted}`}>현재 잔액</p>
                      <p className={`text-base font-black ${t.text}`}>{selectedUser.credits.toLocaleString()} CR</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 금액 입력 */}
              <div className="mb-4">
                <label className={`text-xs font-semibold ${t.textMuted} mb-1.5 block`}>지급 코인 수 <span className="text-red-400">*</span></label>
                <div className="flex gap-2 mb-2">
                  {PRESET_AMOUNTS.map((a) => (
                    <button
                      key={a}
                      onClick={() => setSingleAmount(String(a))}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap border ${
                        singleAmount === String(a)
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : `${t.bg3} ${t.border} ${t.textMuted} hover:${t.textSub}`
                      }`}
                    >
                      {a >= 1000 ? `${a/1000}k` : a}
                    </button>
                  ))}
                </div>
                <div className={`flex items-center gap-2 border rounded-xl px-3 py-2.5 ${isDark ? 'bg-zinc-900 border-white/10' : 'bg-white border-slate-300'}`}>
                  <i className="ri-coin-line text-amber-400 text-sm flex-shrink-0" />
                  <input
                    type="number"
                    value={singleAmount}
                    onChange={(e) => setSingleAmount(e.target.value)}
                    placeholder="코인 수 직접 입력 (음수 = 차감)"
                    className={`flex-1 bg-transparent text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-slate-400'} focus:outline-none`}
                  />
                  <span className={`text-xs ${t.textFaint} flex-shrink-0`}>CR</span>
                </div>
                {singleAmount && selectedUser && !isNaN(parseInt(singleAmount)) && (
                  <p className={`text-[11px] mt-1.5 ${parseInt(singleAmount) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    지급 후 잔액:{' '}
                    <strong>{Math.max(0, selectedUser.credits + parseInt(singleAmount)).toLocaleString()} CR</strong>
                    {' '}({parseInt(singleAmount) > 0 ? '+' : ''}{parseInt(singleAmount).toLocaleString()} CR)
                  </p>
                )}
              </div>

              {/* 사유 */}
              <div className="mb-5">
                <label className={`text-xs font-semibold ${t.textMuted} mb-1.5 block`}>지급 사유</label>
                <input
                  type="text"
                  value={singleReason}
                  onChange={(e) => setSingleReason(e.target.value)}
                  placeholder="예: 이벤트 당첨, CS 보상, VIP 혜택..."
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 ${t.inputBg}`}
                />
              </div>

              <button
                onClick={handleSingleGrant}
                disabled={!selectedUser || !singleAmount || singleLoading}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-black rounded-xl cursor-pointer transition-colors whitespace-nowrap flex items-center justify-center gap-2"
              >
                {singleLoading ? (
                  <><i className="ri-loader-4-line animate-spin text-sm" />처리 중...</>
                ) : (
                  <><i className="ri-coin-line text-sm" />코인 지급하기</>
                )}
              </button>
            </div>
          )}

          {/* ══ 일괄 지급 모드 ══ */}
          {mode === 'batch' && (
            <div className={`${t.bg} border ${t.border} rounded-2xl p-5`}>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                  <i className="ri-group-line text-emerald-400 text-sm" />
                </div>
                <div>
                  <p className={`text-sm font-black ${t.text}`}>일괄 코인 지급</p>
                  <p className={`text-xs ${t.textMuted}`}>플랜 또는 등급 기준으로 전체에 지급</p>
                </div>
              </div>

              {/* 대상 선택 */}
              <div className="mb-4">
                <label className={`text-xs font-semibold ${t.textMuted} mb-2 block`}>지급 대상 <span className="text-red-400">*</span></label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {([
                    { id: 'all',   label: '전체 유저',  icon: 'ri-earth-line',     color: 'text-indigo-400',  bg: 'bg-indigo-500/10' },
                    { id: 'plan',  label: '플랜별',      icon: 'ri-vip-diamond-line', color: 'text-violet-400',  bg: 'bg-violet-500/10' },
                    { id: 'grade', label: '등급별',      icon: 'ri-vip-crown-line', color: 'text-amber-400',   bg: 'bg-amber-500/10' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setBatchTarget(opt.id)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border cursor-pointer transition-all ${
                        batchTarget === opt.id
                          ? `${opt.bg} border-current ${opt.color}`
                          : `${t.bg2} ${t.border} ${t.textMuted} hover:${t.textSub}`
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg ${opt.bg} flex items-center justify-center`}>
                        <i className={`${opt.icon} ${opt.color} text-sm`} />
                      </div>
                      <span className={`text-[11px] font-bold whitespace-nowrap ${batchTarget === opt.id ? opt.color : t.textMuted}`}>{opt.label}</span>
                    </button>
                  ))}
                </div>

                {/* 플랜 선택 */}
                {batchTarget === 'plan' && (
                  <div className="grid grid-cols-3 gap-2">
                    {['free', 'pro', 'enterprise'].map((p) => (
                      <button
                        key={p}
                        onClick={() => setBatchPlan(p)}
                        className={`py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors whitespace-nowrap border ${
                          batchPlan === p
                            ? 'bg-violet-500 border-violet-500 text-white'
                            : `${t.bg3} ${t.border} ${t.textMuted} hover:${t.textSub}`
                        }`}
                      >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                )}

                {/* 등급 선택 */}
                {batchTarget === 'grade' && (
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(GRADE_META).filter(([k]) => k !== 'suspended').map(([key, meta]) => (
                      <button
                        key={key}
                        onClick={() => setBatchGrade(key)}
                        className={`py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors whitespace-nowrap border ${
                          batchGrade === key
                            ? `bg-amber-500 border-amber-500 text-white`
                            : `${t.bg3} ${t.border} ${t.textMuted} hover:${t.textSub}`
                        }`}
                      >
                        {meta.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 금액 입력 */}
              <div className="mb-4">
                <label className={`text-xs font-semibold ${t.textMuted} mb-1.5 block`}>1인당 지급 코인 수 <span className="text-red-400">*</span></label>
                <div className="flex gap-2 mb-2">
                  {PRESET_AMOUNTS.map((a) => (
                    <button
                      key={a}
                      onClick={() => setBatchAmount(String(a))}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap border ${
                        batchAmount === String(a)
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : `${t.bg3} ${t.border} ${t.textMuted} hover:${t.textSub}`
                      }`}
                    >
                      {a >= 1000 ? `${a/1000}k` : a}
                    </button>
                  ))}
                </div>
                <div className={`flex items-center gap-2 border rounded-xl px-3 py-2.5 ${isDark ? 'bg-zinc-900 border-white/10' : 'bg-white border-slate-300'}`}>
                  <i className="ri-coin-line text-emerald-400 text-sm flex-shrink-0" />
                  <input
                    type="number"
                    min="1"
                    value={batchAmount}
                    onChange={(e) => setBatchAmount(e.target.value)}
                    placeholder="1인당 지급할 코인 수"
                    className={`flex-1 bg-transparent text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-slate-400'} focus:outline-none`}
                  />
                  <span className={`text-xs ${t.textFaint} flex-shrink-0`}>CR / 인</span>
                </div>
              </div>

              {/* 사유 */}
              <div className="mb-4">
                <label className={`text-xs font-semibold ${t.textMuted} mb-1.5 block`}>지급 사유</label>
                <input
                  type="text"
                  value={batchReason}
                  onChange={(e) => setBatchReason(e.target.value)}
                  placeholder="예: 서비스 점검 보상, 출시 기념 이벤트..."
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/40 ${t.inputBg}`}
                />
              </div>

              {/* 미리보기 버튼 */}
              <button
                onClick={fetchBatchPreview}
                disabled={batchPreviewLoading || !batchAmount}
                className={`w-full py-2.5 mb-3 border text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap flex items-center justify-center gap-2 ${
                  batchPreview
                    ? `${isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`
                    : `${t.bg3} ${t.border} ${t.textSub} hover:${t.textMuted}`
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {batchPreviewLoading ? (
                  <><i className="ri-loader-4-line animate-spin text-xs" />대상 조회 중...</>
                ) : (
                  <><i className="ri-eye-line text-xs" />대상 미리보기</>
                )}
              </button>

              {/* 미리보기 결과 */}
              {batchPreview && (
                <div className={`mb-4 p-4 rounded-xl border ${isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className={`text-[10px] ${t.textFaint} mb-0.5`}>대상</p>
                      <p className={`text-xs font-black ${t.text}`}>{batchTargetLabel}</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-[10px] ${t.textFaint} mb-0.5`}>대상 인원</p>
                      <p className="text-base font-black text-emerald-400">{batchPreview.count.toLocaleString()}명</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-[10px] ${t.textFaint} mb-0.5`}>총 지급량</p>
                      <p className="text-base font-black text-amber-400">{batchPreview.total.toLocaleString()} CR</p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  const amt = parseInt(batchAmount);
                  if (isNaN(amt) || amt <= 0) { onToast('올바른 코인 수를 입력해주세요', 'error'); return; }
                  setConfirmModal(true);
                }}
                disabled={!batchAmount || batchLoading}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-black rounded-xl cursor-pointer transition-colors whitespace-nowrap flex items-center justify-center gap-2"
              >
                {batchLoading ? (
                  <><i className="ri-loader-4-line animate-spin text-sm" />처리 중...</>
                ) : (
                  <><i className="ri-send-plane-line text-sm" />일괄 지급 실행</>
                )}
              </button>
            </div>
          )}
        </div>

        {/* ── 우측: 지급 이력 ── */}
        <div className="lg:col-span-2">
          <div className={`${t.bg} border ${t.border} rounded-2xl overflow-hidden h-full`}>
            <div className={`px-4 py-3.5 border-b ${t.border} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 flex items-center justify-center">
                  <i className={`ri-history-line ${t.textMuted} text-sm`} />
                </div>
                <p className={`text-sm font-black ${t.text}`}>지급 이력</p>
                {grantLogs.length > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-100 text-slate-500'}`}>
                    {grantLogs.length}
                  </span>
                )}
              </div>
              {grantLogs.length > 0 && (
                <button
                  onClick={() => setGrantLogs([])}
                  className={`text-[11px] ${t.textFaint} hover:${t.textMuted} cursor-pointer transition-colors`}
                >
                  초기화
                </button>
              )}
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: '480px' }}>
              {grantLogs.length === 0 ? (
                <div className={`flex flex-col items-center justify-center py-16 ${t.textFaint}`}>
                  <i className="ri-coin-line text-2xl mb-2 opacity-30" />
                  <p className="text-xs">이번 세션 지급 이력이 없습니다</p>
                </div>
              ) : (
                <div className={`divide-y ${t.divider}`}>
                  {grantLogs.map((log) => (
                    <div key={log.id} className={`px-4 py-3 ${t.rowHover} transition-colors`}>
                      <div className="flex items-start gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          log.success
                            ? log.type === 'batch' ? 'bg-emerald-500/15' : 'bg-indigo-500/15'
                            : 'bg-red-500/15'
                        }`}>
                          <i className={`text-xs ${
                            log.success
                              ? log.type === 'batch' ? 'ri-group-line text-emerald-400' : 'ri-user-line text-indigo-400'
                              : 'ri-close-circle-line text-red-400'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              log.type === 'batch'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-indigo-500/15 text-indigo-400'
                            }`}>
                              {log.type === 'batch' ? '일괄' : '개별'}
                            </span>
                            {log.success ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">완료</span>
                            ) : (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">실패</span>
                            )}
                          </div>
                          <p className={`text-[11px] font-semibold ${t.text} truncate`}>{log.targetLabel}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[11px] font-black ${log.amount > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                              {log.amount > 0 ? '+' : ''}{log.amount.toLocaleString()} CR
                            </span>
                            {log.count > 1 && (
                              <span className={`text-[10px] ${t.textFaint}`}>× {log.count}명</span>
                            )}
                          </div>
                          {log.reason && (
                            <p className={`text-[10px] ${t.textFaint} truncate mt-0.5`}>{log.reason}</p>
                          )}
                          <p className={`text-[9px] ${t.textFaint} mt-0.5`}>{log.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 일괄 지급 확인 모달 ── */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setConfirmModal(false)} />
          <div className={`relative ${t.bg} border ${t.border2} rounded-2xl w-full max-w-sm p-6 z-10`}
            style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/15 mx-auto mb-4">
              <i className="ri-alarm-warning-line text-amber-400 text-xl" />
            </div>
            <h3 className={`text-base font-black ${t.text} text-center mb-2`}>일괄 지급 확인</h3>
            <p className={`text-xs ${t.textMuted} text-center mb-4 leading-relaxed`}>
              <strong className={t.text}>{batchTargetLabel}</strong>에게<br/>
              1인당 <strong className="text-amber-400">{parseInt(batchAmount).toLocaleString()} CR</strong>를 지급합니다.
              {batchPreview && (
                <><br/>총 <strong className="text-emerald-400">{batchPreview.total.toLocaleString()} CR</strong>가 차감됩니다.</>
              )}
            </p>
            <div className={`p-3 rounded-xl mb-5 ${isDark ? 'bg-zinc-900/80' : 'bg-slate-100'}`}>
              <p className={`text-[11px] ${t.textMuted} text-center`}>
                이 작업은 되돌릴 수 없습니다. 신중하게 확인 후 진행하세요.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleBatchGrant}
                className="py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-black rounded-xl cursor-pointer transition-colors whitespace-nowrap"
              >
                <i className="ri-check-line mr-1" />
                확인, 지급하기
              </button>
              <button
                onClick={() => setConfirmModal(false)}
                className={`py-2.5 ${isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'} text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap`}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
