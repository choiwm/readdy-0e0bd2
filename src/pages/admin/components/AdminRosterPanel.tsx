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
  // 'manual_url' (기본): generateLink 로 1회용 URL 받아서 운영자가 직접 전달.
  //                      Resend / Supabase 메일러 등 인프라 의존 없음.
  // 'auto_email': inviteUserByEmail 로 Supabase 메일러 발송 (시간당 3통 한도).
  // 'none': admin row 만 만들고 끝. 받는 사람이 직접 회원가입 후 매칭.
  const [inviteMode, setInviteMode] = useState<'manual_url' | 'auto_email' | 'none'>('manual_url');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  // URL 발급 결과를 별도 모달로 표시 — 운영자가 복사해서 Slack 등으로 전달.
  const [issuedUrl, setIssuedUrl] = useState<{ email: string; url: string; status: string } | null>(null);
  const [copyOk, setCopyOk] = useState(false);

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
          invite_mode: inviteMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data?.error ?? `HTTP ${res.status}`);
        return;
      }
      // 결과 분기: manual_url / already_registered (URL 받음) → 별도 모달
      // 로 띄워서 운영자가 복사 가능. 그 외엔 토스트만.
      const targetEmail = inviteEmail.trim();
      if ((data.invite_status === 'manual_url_generated' || data.invite_status === 'already_registered') && data.invite_url) {
        setIssuedUrl({ email: targetEmail, url: data.invite_url, status: data.invite_status });
        onToast(`${targetEmail} 추가 완료 — invite URL 생성됨`, 'success');
      } else if (data.invite_status === 'sent') {
        onToast(`${targetEmail} 추가 완료 — Supabase 메일 발송됨`, 'success');
      } else if (data.invite_status === 'already_registered') {
        onToast(`${targetEmail} 추가 완료 — 이미 가입된 사용자, 직접 로그인 가능`, 'info');
      } else if (data.invite_status === 'failed') {
        onToast(`${targetEmail} 추가 완료, 다만 invite 발급 실패: ${data.invite_error ?? '알 수 없음'}`, 'warning');
      } else {
        onToast(`${targetEmail} 추가 완료 (${ADMIN_ROLE_LABELS[inviteRole]})`, 'success');
      }
      setInviteOpen(false);
      setInviteEmail('');
      setInviteName('');
      setInviteRole('cs');
      setInviteMode('manual_url');
      await fetchAdmins();
    } finally {
      setInviting(false);
    }
  };

  // 재발송도 기본은 manual_url — 운영자가 복사해서 직접 전달.
  const handleResendInvite = async (target: AdminRow) => {
    setBusyId(target.id);
    try {
      const res = await fetch(`${SECURITY_FN}?action=resend_invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: getAuthorizationHeader() },
        body: JSON.stringify({ email: target.email, invite_mode: 'manual_url' }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast(data?.error ?? `HTTP ${res.status}`, 'error');
        return;
      }
      if (data.invite_url) {
        setIssuedUrl({ email: target.email, url: data.invite_url, status: data.status ?? 'manual_url_generated' });
        onToast(`${target.email} invite URL 재생성됨`, 'success');
      } else if (data.status === 'already_registered') {
        onToast(data.hint ?? '이미 가입된 사용자에요.', 'info');
      } else {
        onToast(`${target.email} invite 재처리 완료`, 'success');
      }
    } finally {
      setBusyId(null);
    }
  };

  const copyUrlToClipboard = async () => {
    if (!issuedUrl) return;
    try {
      await navigator.clipboard.writeText(issuedUrl.url);
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 2000);
    } catch {
      onToast('클립보드 접근 불가 — URL 을 직접 선택해서 복사해주세요', 'error');
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
                    onClick={() => handleResendInvite(a)}
                    disabled={isBusy}
                    title="Magic-link 메일 재발송"
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 transition-all disabled:opacity-50"
                  >
                    invite 재발송
                  </button>
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
            <div className="space-y-2">
              <label className={`text-[11px] font-bold ${faintText}`}>초대 방식</label>
              <div className="space-y-1.5">
                {([
                  { id: 'manual_url', label: 'URL 직접 전달 (권장)', desc: '1회용 URL 만 받아서 Slack/카톡 등으로 전달. 외부 메일 서비스 불필요.' },
                  { id: 'auto_email', label: 'Supabase 메일 자동 발송', desc: '시간당 3통 제한 (커스텀 SMTP 미설정 시). 받는 사람이 메일 클릭.' },
                  { id: 'none',       label: '계정만 생성 (초대 안 보냄)', desc: '받는 사람이 직접 회원가입하면 자동 매칭. URL 도 메일도 없음.' },
                ] as const).map((opt) => (
                  <label key={opt.id} className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer border ${inviteMode === opt.id ? 'border-indigo-500/40 bg-indigo-500/5' : `border-transparent ${subBg}`}`}>
                    <input
                      type="radio"
                      name="invite_mode"
                      checked={inviteMode === opt.id}
                      onChange={() => setInviteMode(opt.id)}
                      className="mt-0.5 cursor-pointer"
                    />
                    <span className="flex-1 min-w-0">
                      <span className={`text-[12px] font-bold ${text}`}>{opt.label}</span>
                      <span className={`block text-[10px] ${faintText} leading-relaxed mt-0.5`}>{opt.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
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

      {/* Manual-URL 발급 결과 모달 — 운영자가 복사해서 Slack/카톡 등으로 직접 전달.
          닫으면 URL 은 다시 못 봐요 (Supabase 가 1회용으로 만든거라 재요청해야 함).
          그래서 닫기 전에 한 번 더 경고. */}
      {issuedUrl && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setIssuedUrl(null)}>
          <div className={`${cardBg} border ${border} rounded-2xl p-6 max-w-lg w-full space-y-4`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                <i className="ri-link text-indigo-400 text-lg" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`text-base font-bold ${text}`}>Invite URL 생성 완료</h3>
                <p className={`text-[11px] ${subText} mt-1 leading-relaxed`}>
                  <span className="font-mono">{issuedUrl.email}</span> 에게 아래 URL 을 전달해주세요.
                  {issuedUrl.status === 'already_registered' && (
                    <> 이미 가입된 사용자라 invite 대신 magic-link 로 발급됐어요 (1회용 자동 로그인).</>
                  )}
                </p>
              </div>
            </div>
            <div className={`${subBg} border ${border} rounded-xl p-3 break-all font-mono text-[11px] ${text} max-h-40 overflow-y-auto`}>
              {issuedUrl.url}
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyUrlToClipboard}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-all ${
                  copyOk ? 'bg-emerald-500 text-white' : 'bg-indigo-500 hover:bg-indigo-400 text-white'
                }`}
              >
                {copyOk ? '✓ 복사됨' : 'URL 복사'}
              </button>
              <button
                onClick={() => setIssuedUrl(null)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold ${subBg} border ${border} ${subText} hover:opacity-80`}
              >
                닫기
              </button>
            </div>
            <p className={`text-[10px] ${faintText} leading-relaxed`}>
              ⚠️ 이 URL 은 1회용이에요. 닫으면 다시 못 봐요. 필요하면 admin 행의 "invite 재발송" 버튼으로 새 URL 을 받을 수 있어요.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
