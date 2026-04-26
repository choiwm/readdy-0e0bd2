import { useState, useEffect, useCallback } from 'react';
import { getAuthorizationHeader, SUPABASE_URL } from '@/lib/env';
import { ADMIN_ROLE_LABELS, type AdminRole } from '@/components/feature/AdminGuard';

interface AdminRow {
  id: string;
  email: string;
  display_name: string | null;
  role: AdminRole;
  is_active: boolean;
  two_factor_enabled?: boolean;
  created_at: string;
  updated_at?: string | null;
}

interface Props {
  isDark: boolean;
  currentAdminId?: string;
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const ROLE_OPTIONS: AdminRole[] = ['super_admin', 'ops', 'cs', 'billing'];

const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  super_admin: '모든 admin 엔드포인트 + 다른 admin 초대/제거 + AI 키 관리',
  ops:         '인프라·AI 엔진·진단·콘텐츠·통계·감사 (사용자 삭제·환불 불가)',
  cs:          'CS 티켓·공지·사용자 조회·크레딧 수동 지급 (API 키·환불 불가)',
  billing:     '결제 조회·환불·통계 (사용자 삭제·AI 엔진 불가)',
};

const SECURITY_FN = `${SUPABASE_URL}/functions/v1/admin-security`;

export default function AdminRosterPanel({ isDark, currentAdminId, onToast }: Props) {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<AdminRole>('cs');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const cardBg = isDark ? 'bg-zinc-900/60' : 'bg-white';
  const subBg = isDark ? 'bg-zinc-800/60' : 'bg-slate-50';
  const border = isDark ? 'border-white/5' : 'border-slate-200';
  const text = isDark ? 'text-white' : 'text-slate-900';
  const subText = isDark ? 'text-zinc-400' : 'text-slate-600';
  const faintText = isDark ? 'text-zinc-500' : 'text-slate-500';

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SECURITY_FN}?action=list_admins`, {
        headers: { Authorization: getAuthorizationHeader() },
      });
      if (!res.ok) {
        onToast(`목록 조회 실패: HTTP ${res.status}`, 'error');
        return;
      }
      const data = await res.json();
      setAdmins((data.admins ?? []) as AdminRow[]);
    } catch (e) {
      onToast(`목록 조회 오류: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  const handleInvite = async () => {
    setInviteError(null);
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      setInviteError('이메일 형식이 올바르지 않아요.');
      return;
    }
    setInviting(true);
    try {
      const res = await fetch(`${SECURITY_FN}?action=create_admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: getAuthorizationHeader(),
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          display_name: inviteName.trim() || undefined,
          role: inviteRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data?.error ?? `HTTP ${res.status}`);
        return;
      }
      onToast(`${inviteEmail} 추가 완료 (${ADMIN_ROLE_LABELS[inviteRole]})`, 'success');
      setInviteOpen(false);
      setInviteEmail('');
      setInviteName('');
      setInviteRole('cs');
      await fetchAdmins();
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (target: AdminRow, newRole: AdminRole) => {
    if (target.role === newRole) return;
    setBusyId(target.id);
    try {
      const res = await fetch(`${SECURITY_FN}?action=update_admin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: getAuthorizationHeader() },
        body: JSON.stringify({ id: target.id, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast(data?.error ?? `HTTP ${res.status}`, 'error');
        return;
      }
      onToast(`${target.email} → ${ADMIN_ROLE_LABELS[newRole]}`, 'success');
      await fetchAdmins();
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleActive = async (target: AdminRow) => {
    setBusyId(target.id);
    try {
      const res = await fetch(`${SECURITY_FN}?action=update_admin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: getAuthorizationHeader() },
        body: JSON.stringify({ id: target.id, is_active: !target.is_active }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast(data?.error ?? `HTTP ${res.status}`, 'error');
        return;
      }
      onToast(`${target.email} ${target.is_active ? '비활성화' : '활성화'}`, 'success');
      await fetchAdmins();
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (target: AdminRow) => {
    const ok = window.confirm(`${target.email} 관리자를 영구 삭제할까요? 되돌릴 수 없어요.`);
    if (!ok) return;
    setBusyId(target.id);
    try {
      const res = await fetch(`${SECURITY_FN}?action=delete_admin&id=${encodeURIComponent(target.id)}`, {
        method: 'DELETE',
        headers: { Authorization: getAuthorizationHeader() },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onToast(data?.error ?? `HTTP ${res.status}`, 'error');
        return;
      }
      onToast(`${target.email} 삭제 완료`, 'success');
      await fetchAdmins();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className={`${cardBg} border ${border} rounded-2xl p-5 flex items-center justify-between`}>
        <div>
          <h3 className={`text-base font-bold ${text}`}>Admin 관리 ({admins.length})</h3>
          <p className={`text-xs ${subText} mt-1 leading-relaxed`}>
            super_admin 만 접근 가능. role 변경 / 비활성화 / 삭제는 즉시 반영돼요.
            마지막 super_admin 또는 본인 계정은 삭제·다운그레이드 불가.
          </p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="px-4 py-2 rounded-xl text-sm font-bold bg-indigo-500 hover:bg-indigo-400 text-white transition-all"
        >
          + Admin 추가
        </button>
      </div>

      {/* 권한 안내 */}
      <div className={`${cardBg} border ${border} rounded-2xl p-5 space-y-2`}>
        <p className={`text-xs font-black uppercase tracking-widest ${faintText}`}>권한 매트릭스</p>
        {ROLE_OPTIONS.map((r) => (
          <div key={r} className={`${subBg} border ${border} rounded-xl p-3 flex items-start gap-3`}>
            <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
              r === 'super_admin' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              : r === 'ops' ? 'bg-violet-500/15 text-violet-400 border border-violet-500/30'
              : r === 'cs' ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            }`}>
              <i className={
                r === 'super_admin' ? 'ri-shield-star-fill'
                : r === 'ops' ? 'ri-tools-line'
                : r === 'cs' ? 'ri-customer-service-2-line'
                : 'ri-bank-card-line'
              } />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-bold ${text}`}>{ADMIN_ROLE_LABELS[r]} <span className={`ml-1 font-mono text-[10px] ${faintText}`}>{r}</span></p>
              <p className={`text-[11px] ${subText} mt-0.5 leading-relaxed`}>{ROLE_DESCRIPTIONS[r]}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 목록 */}
      <div className={`${cardBg} border ${border} rounded-2xl overflow-hidden`}>
        {loading && admins.length === 0 ? (
          <div className={`p-8 text-center text-xs ${subText}`}>불러오는 중...</div>
        ) : admins.length === 0 ? (
          <div className={`p-8 text-center text-xs ${subText}`}>등록된 admin 이 없어요. 위 버튼으로 추가하세요.</div>
        ) : (
          <div className={`divide-y ${border}`}>
            {admins.map((a) => {
              const isSelf = a.id === currentAdminId;
              const isBusy = busyId === a.id;
              return (
                <div key={a.id} className={`px-5 py-4 flex items-center gap-4 ${isBusy ? 'opacity-50' : ''}`}>
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border ${border} flex items-center justify-center flex-shrink-0`}>
                    <span className={`text-sm font-black ${text}`}>{(a.display_name ?? a.email).slice(0, 1).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className={`text-sm font-bold ${text}`}>{a.display_name ?? a.email.split('@')[0]}</p>
                      {isSelf && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300 border border-zinc-600/40">YOU</span>
                      )}
                      {!a.is_active && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">비활성</span>
                      )}
                    </div>
                    <p className={`text-[11px] ${faintText} font-mono break-all`}>{a.email}</p>
                  </div>
                  <select
                    value={a.role}
                    onChange={(e) => handleRoleChange(a, e.target.value as AdminRole)}
                    disabled={isBusy}
                    className={`px-2 py-1 rounded-lg text-xs font-bold border ${border} ${subBg} ${text} cursor-pointer disabled:cursor-not-allowed`}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{ADMIN_ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleToggleActive(a)}
                    disabled={isBusy}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                      a.is_active
                        ? 'border-zinc-600/40 text-zinc-400 hover:bg-zinc-700/20'
                        : 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10'
                    } disabled:opacity-50`}
                  >
                    {a.is_active ? '비활성화' : '활성화'}
                  </button>
                  <button
                    onClick={() => handleDelete(a)}
                    disabled={isBusy}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 초대 모달 */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setInviteOpen(false)}>
          <div className={`${cardBg} border ${border} rounded-2xl p-6 max-w-md w-full space-y-4`} onClick={(e) => e.stopPropagation()}>
            <h3 className={`text-base font-bold ${text}`}>새 Admin 추가</h3>
            <p className={`text-xs ${subText}`}>
              이메일로 회원가입 한 사용자에게 admin 권한을 부여해요. 이미 가입한 사용자만 추가 가능.
            </p>
            <div className="space-y-2">
              <label className={`text-[11px] font-bold ${faintText}`}>이메일</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="admin@example.com"
                className={`w-full px-3 py-2 rounded-lg ${subBg} border ${border} text-sm ${text} focus:outline-none focus:border-indigo-500/40`}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className={`text-[11px] font-bold ${faintText}`}>표시 이름 (선택)</label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="기본값: 이메일의 @ 앞부분"
                className={`w-full px-3 py-2 rounded-lg ${subBg} border ${border} text-sm ${text} focus:outline-none focus:border-indigo-500/40`}
              />
            </div>
            <div className="space-y-2">
              <label className={`text-[11px] font-bold ${faintText}`}>역할</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as AdminRole)}
                className={`w-full px-3 py-2 rounded-lg ${subBg} border ${border} text-sm ${text} cursor-pointer focus:outline-none focus:border-indigo-500/40`}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{ADMIN_ROLE_LABELS[r]} ({r})</option>
                ))}
              </select>
              <p className={`text-[10px] ${faintText} leading-relaxed`}>{ROLE_DESCRIPTIONS[inviteRole]}</p>
            </div>
            {inviteError && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-300">{inviteError}</div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setInviteOpen(false)}
                disabled={inviting}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold ${subBg} border ${border} ${subText} hover:opacity-80`}
              >
                취소
              </button>
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-bold bg-indigo-500 hover:bg-indigo-400 text-white disabled:opacity-50"
              >
                {inviting ? '추가 중...' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
