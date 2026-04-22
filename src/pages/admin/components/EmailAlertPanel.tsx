import { useState, useEffect, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────
interface EmailSettings {
  enabled: boolean;
  admin_emails: string[];
  failure_threshold: number;
  cooldown_minutes: number;
  last_sent_at: string | null;
  email_subject_prefix: string;
  notify_on_recovery: boolean;
}

interface Props {
  isDark: boolean;
  onToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

// ── Constants ──────────────────────────────────────────────────────────────
const THRESHOLD_OPTIONS = [1, 2, 3, 5, 10];
const COOLDOWN_OPTIONS = [
  { value: 15,   label: '15분' },
  { value: 30,   label: '30분' },
  { value: 60,   label: '1시간' },
  { value: 120,  label: '2시간' },
  { value: 360,  label: '6시간' },
  { value: 1440, label: '24시간' },
];

// ── Helper ─────────────────────────────────────────────────────────────────
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

// ── Email Tag Input ────────────────────────────────────────────────────────
function EmailTagInput({
  emails,
  onChange,
  isDark,
}: {
  emails: string[];
  onChange: (emails: string[]) => void;
  isDark: boolean;
}) {
  const [inputVal, setInputVal] = useState('');
  const [error, setError] = useState('');

  const t = {
    inputBg: isDark ? 'bg-zinc-800 border-white/10' : 'bg-white border-gray-200',
    text: isDark ? 'text-white' : 'text-gray-900',
    textFaint: isDark ? 'text-zinc-500' : 'text-gray-400',
    tagBg: isDark ? 'bg-indigo-500/15 border-indigo-500/25' : 'bg-indigo-50 border-indigo-200',
  };

  const addEmail = (val: string) => {
    const trimmed = val.trim().replace(/,/g, '');
    if (!trimmed) return;
    if (!isValidEmail(trimmed)) { setError('올바른 이메일 형식이 아닙니다'); return; }
    if (emails.includes(trimmed)) { setError('이미 추가된 이메일입니다'); return; }
    if (emails.length >= 10) { setError('최대 10개까지 추가할 수 있습니다'); return; }
    onChange([...emails, trimmed]);
    setInputVal('');
    setError('');
  };

  const removeEmail = (email: string) => {
    onChange(emails.filter((e) => e !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      addEmail(inputVal);
    } else if (e.key === 'Backspace' && !inputVal && emails.length > 0) {
      onChange(emails.slice(0, -1));
    }
  };

  return (
    <div>
      <div className={`flex flex-wrap gap-1.5 p-2 rounded-xl border ${t.inputBg} min-h-[44px] cursor-text`}
        onClick={() => document.getElementById('email-tag-input')?.focus()}
      >
        {emails.map((email) => (
          <span
            key={email}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-semibold text-indigo-400 ${t.tagBg}`}
          >
            <i className="ri-mail-line text-[10px]" />
            {email}
            <button
              onClick={(e) => { e.stopPropagation(); removeEmail(email); }}
              className="w-3 h-3 flex items-center justify-center rounded-full hover:bg-red-500/20 cursor-pointer transition-colors ml-0.5"
            >
              <i className="ri-close-line text-[9px] text-red-400" />
            </button>
          </span>
        ))}
        <input
          id="email-tag-input"
          type="email"
          value={inputVal}
          onChange={(e) => { setInputVal(e.target.value); setError(''); }}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (inputVal) addEmail(inputVal); }}
          placeholder={emails.length === 0 ? '이메일 입력 후 Enter' : '추가...'}
          className={`flex-1 min-w-[160px] bg-transparent text-xs ${t.text} outline-none placeholder:${t.textFaint}`}
        />
      </div>
      {error && <p className="text-[10px] text-red-400 mt-1">{error}</p>}
      <p className={`text-[10px] ${t.textFaint} mt-1`}>
        Enter 또는 쉼표로 구분 · 최대 10개
      </p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function EmailAlertPanel({ isDark, onToast }: Props) {
  const [settings, setSettings] = useState<EmailSettings>({
    enabled: false,
    admin_emails: [],
    failure_threshold: 3,
    cooldown_minutes: 60,
    last_sent_at: null,
    email_subject_prefix: '[Readdy AI 알림]',
    notify_on_recovery: true,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [savedSettings, setSavedSettings] = useState<EmailSettings | null>(null);
  const [resendKeySet, setResendKeySet] = useState<boolean | null>(null);

  const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
  const ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;
  const base = `${SUPABASE_URL}/functions/v1/healthcheck-scheduler`;
  const headers = { 'Authorization': `Bearer ${ANON_KEY}` };

  const t = {
    cardBg:    isDark ? 'bg-[#0f0f13]'         : 'bg-white',
    cardBg2:   isDark ? 'bg-zinc-900/60'        : 'bg-gray-50',
    border:    isDark ? 'border-white/5'        : 'border-gray-200',
    text:      isDark ? 'text-white'            : 'text-gray-900',
    textSub:   isDark ? 'text-zinc-400'         : 'text-gray-500',
    textFaint: isDark ? 'text-zinc-600'         : 'text-gray-400',
    inputBg:   isDark ? 'bg-zinc-800 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900',
    inputBg2:  isDark ? 'bg-zinc-800'           : 'bg-gray-100',
    divider:   isDark ? 'divide-white/[0.03]'   : 'divide-gray-100',
  };

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${base}?action=get_email_settings`, { headers });
      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
        setSavedSettings(data.settings);
      }
      // RESEND_API_KEY 설정 여부 확인 (간접적으로)
      setResendKeySet(null); // 알 수 없음 상태
    } catch (e) {
      console.warn('Email settings load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // 변경 감지
  useEffect(() => {
    if (!savedSettings) return;
    const changed =
      settings.enabled !== savedSettings.enabled ||
      settings.failure_threshold !== savedSettings.failure_threshold ||
      settings.cooldown_minutes !== savedSettings.cooldown_minutes ||
      settings.notify_on_recovery !== savedSettings.notify_on_recovery ||
      settings.email_subject_prefix !== savedSettings.email_subject_prefix ||
      JSON.stringify(settings.admin_emails) !== JSON.stringify(savedSettings.admin_emails);
    setHasChanges(changed);
  }, [settings, savedSettings]);

  const handleSave = async () => {
    if (settings.enabled && settings.admin_emails.length === 0) {
      onToast('수신 이메일을 최소 1개 이상 입력해주세요', 'warning');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${base}?action=update_email_settings`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSavedSettings({ ...settings });
      setHasChanges(false);
      onToast('이메일 알림 설정이 저장됐습니다', 'success');
    } catch (e) {
      onToast(`저장 실패: ${String(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (settings.admin_emails.length === 0) {
      onToast('수신 이메일을 먼저 입력해주세요', 'warning');
      return;
    }
    setTestSending(true);
    try {
      const res = await fetch(`${base}?action=send_test_email`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        onToast(`테스트 이메일 발송 완료 (${data.sent}명)`, 'success');
      } else {
        onToast(data.message ?? '발송 실패', 'error');
      }
    } catch (e) {
      onToast(`발송 실패: ${String(e)}`, 'error');
    } finally {
      setTestSending(false);
    }
  };

  const updateSettings = (patch: Partial<EmailSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
      {/* Header */}
      <div className={`px-5 py-4 border-b ${t.border} flex items-center justify-between`}>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-black ${t.text}`}>이메일 알림 설정</p>
            {settings.enabled ? (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse inline-block" />
                활성화됨
              </span>
            ) : (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-zinc-700/60 text-zinc-500' : 'bg-gray-100 text-gray-400'}`}>
                비활성화
              </span>
            )}
            {hasChanges && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                <i className="ri-edit-line mr-0.5" />미저장 변경사항
              </span>
            )}
          </div>
          <p className={`text-xs ${t.textSub} mt-0.5`}>
            연속 실패 시 관리자 이메일로 자동 알림 · Resend API 연동
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <i className="ri-loader-4-line animate-spin text-zinc-500 text-sm" />}
          <button
            onClick={loadSettings}
            className={`w-8 h-8 flex items-center justify-center rounded-xl ${t.inputBg2} hover:opacity-80 cursor-pointer transition-colors`}
          >
            <i className={`ri-refresh-line text-sm ${t.textSub}`} />
          </button>
        </div>
      </div>

      {/* Resend API 안내 배너 */}
      <div className={`px-5 py-3 border-b ${t.border} ${isDark ? 'bg-amber-500/5' : 'bg-amber-50/60'}`}>
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
            <i className="ri-mail-send-line text-amber-400 text-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-400 mb-1">이메일 발송을 위해 Resend API 키가 필요합니다</p>
            <p className={`text-[10px] ${t.textFaint} leading-relaxed`}>
              Supabase 대시보드 → Edge Functions → Secrets에서{' '}
              <code className={`px-1 py-0.5 rounded text-[9px] ${t.inputBg2}`}>RESEND_API_KEY</code>를 추가하세요.
              키가 없으면 알림이 DB 큐에만 저장됩니다.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <a
                href="https://resend.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors"
              >
                <i className="ri-external-link-line text-xs" />
                Resend API 키 발급
              </a>
              <span className={`text-[10px] ${t.textFaint}`}>·</span>
              <span className={`text-[10px] ${t.textFaint}`}>무료 플랜: 월 3,000건</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* 활성화 토글 */}
        <div className={`flex items-center justify-between px-4 py-3.5 rounded-xl border ${t.border} ${t.cardBg2}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${settings.enabled ? 'bg-emerald-500/15' : t.inputBg2}`}>
              <i className={`ri-notification-3-line text-sm ${settings.enabled ? 'text-emerald-400' : t.textFaint}`} />
            </div>
            <div>
              <p className={`text-xs font-bold ${t.text}`}>이메일 알림 활성화</p>
              <p className={`text-[10px] ${t.textFaint}`}>
                {settings.enabled ? '헬스체크 실패 시 이메일 자동 발송' : '현재 비활성화 상태'}
              </p>
            </div>
          </div>
          <button
            onClick={() => updateSettings({ enabled: !settings.enabled })}
            className={`w-10 h-5 rounded-full transition-colors cursor-pointer relative flex-shrink-0 ${settings.enabled ? 'bg-emerald-500' : isDark ? 'bg-zinc-700' : 'bg-gray-300'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {/* 수신 이메일 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <i className="ri-mail-line text-indigo-400 text-xs" />
            <p className={`text-xs font-black ${t.textSub}`}>수신 이메일 주소</p>
            <span className={`text-[10px] ${t.textFaint} ml-auto`}>{settings.admin_emails.length}/10</span>
          </div>
          <EmailTagInput
            emails={settings.admin_emails}
            onChange={(emails) => updateSettings({ admin_emails: emails })}
            isDark={isDark}
          />
        </div>

        {/* 실패 임계값 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <i className="ri-alarm-warning-line text-red-400 text-xs" />
            <p className={`text-xs font-black ${t.textSub}`}>알림 발송 임계값</p>
            <span className={`text-[10px] text-red-400 font-bold ml-auto`}>
              현재: {settings.failure_threshold}회 연속 실패 시
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {THRESHOLD_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => updateSettings({ failure_threshold: n })}
                className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap border ${
                  settings.failure_threshold === n
                    ? 'bg-red-500/15 text-red-400 border-red-500/30'
                    : `${t.inputBg2} ${t.textSub} border-transparent hover:opacity-80`
                }`}
              >
                {n}회
                {n === 3 && <span className={`block text-[9px] mt-0.5 ${settings.failure_threshold === n ? 'text-red-300' : t.textFaint}`}>권장</span>}
              </button>
            ))}
          </div>
          <p className={`text-[10px] ${t.textFaint} mt-1.5`}>
            연속으로 이 횟수만큼 실패해야 이메일이 발송됩니다
          </p>
        </div>

        {/* 쿨다운 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <i className="ri-time-line text-violet-400 text-xs" />
            <p className={`text-xs font-black ${t.textSub}`}>알림 쿨다운 (중복 발송 방지)</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {COOLDOWN_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateSettings({ cooldown_minutes: opt.value })}
                className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap border ${
                  settings.cooldown_minutes === opt.value
                    ? 'bg-violet-500/15 text-violet-400 border-violet-500/30'
                    : `${t.inputBg2} ${t.textSub} border-transparent hover:opacity-80`
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className={`text-[10px] ${t.textFaint} mt-1.5`}>
            같은 문제로 이 시간 내에는 중복 이메일을 보내지 않습니다
          </p>
        </div>

        {/* 복구 알림 + 제목 접두사 */}
        <div className="grid grid-cols-2 gap-3">
          {/* 복구 알림 */}
          <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${t.border} ${t.cardBg2}`}>
            <div>
              <p className={`text-xs font-bold ${t.text}`}>복구 알림</p>
              <p className={`text-[10px] ${t.textFaint}`}>실패 후 복구 시 알림</p>
            </div>
            <button
              onClick={() => updateSettings({ notify_on_recovery: !settings.notify_on_recovery })}
              className={`w-9 h-5 rounded-full transition-colors cursor-pointer relative flex-shrink-0 ${settings.notify_on_recovery ? 'bg-emerald-500' : isDark ? 'bg-zinc-700' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.notify_on_recovery ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* 제목 접두사 */}
          <div className={`px-4 py-3 rounded-xl border ${t.border} ${t.cardBg2}`}>
            <p className={`text-xs font-bold ${t.text} mb-1.5`}>이메일 제목 접두사</p>
            <input
              type="text"
              value={settings.email_subject_prefix}
              onChange={(e) => updateSettings({ email_subject_prefix: e.target.value })}
              className={`w-full text-xs px-2 py-1 rounded-lg border ${t.inputBg} outline-none`}
              placeholder="[Readdy AI 알림]"
              maxLength={30}
            />
          </div>
        </div>

        {/* 마지막 발송 정보 */}
        {settings.last_sent_at && (
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl ${t.cardBg2} border ${t.border}`}>
            <i className="ri-send-plane-line text-xs text-indigo-400" />
            <span className={`text-[10px] ${t.textFaint}`}>
              마지막 발송:{' '}
              <span className={`font-semibold ${t.textSub}`}>{relativeTime(settings.last_sent_at)}</span>
              <span className="ml-1">({new Date(settings.last_sent_at).toLocaleString('ko-KR')})</span>
            </span>
          </div>
        )}

        {/* 이메일 미리보기 */}
        <div className={`${isDark ? 'bg-zinc-900/40 border-white/5' : 'bg-gray-50 border-gray-200'} border rounded-xl p-4`}>
          <p className={`text-[10px] font-black ${t.textSub} mb-2 flex items-center gap-1.5`}>
            <i className="ri-eye-line text-xs" />발송될 이메일 미리보기
          </p>
          <div className={`${isDark ? 'bg-zinc-950 border-white/5' : 'bg-white border-gray-200'} border rounded-lg p-3 space-y-1.5`}>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-bold ${t.textFaint} w-10`}>제목</span>
              <span className={`text-[10px] font-mono ${t.text}`}>
                {settings.email_subject_prefix} fal.ai API 연결 실패 ({settings.failure_threshold}회 연속)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-bold ${t.textFaint} w-10`}>수신</span>
              <span className={`text-[10px] ${t.textSub}`}>
                {settings.admin_emails.length > 0
                  ? settings.admin_emails.join(', ')
                  : <span className="text-amber-400">이메일 미설정</span>
                }
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-bold ${t.textFaint} w-10`}>내용</span>
              <span className={`text-[10px] ${t.textFaint}`}>
                HTML 이메일 · 실패 서비스 목록, 오류 메시지, 발생 시각 포함
              </span>
            </div>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-3">
          {/* 테스트 발송 */}
          <button
            onClick={handleTestEmail}
            disabled={testSending || settings.admin_emails.length === 0}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed border ${
              isDark
                ? 'bg-zinc-800 text-zinc-300 border-white/10 hover:bg-zinc-700'
                : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
            }`}
          >
            {testSending ? (
              <><i className="ri-loader-4-line animate-spin" />발송 중...</>
            ) : (
              <><i className="ri-send-plane-line" />테스트 이메일 발송</>
            )}
          </button>

          <div className="flex-1" />

          {/* 저장 */}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
              hasChanges
                ? 'bg-indigo-500 hover:bg-indigo-400 text-white'
                : isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-gray-100 text-gray-400'
            }`}
          >
            {saving ? (
              <><i className="ri-loader-4-line animate-spin" />저장 중...</>
            ) : (
              <><i className="ri-save-line" />설정 저장</>
            )}
          </button>
        </div>
      </div>

      {/* 동작 방식 안내 */}
      <div className={`px-5 py-4 border-t ${t.border} ${isDark ? 'bg-zinc-900/30' : 'bg-gray-50'}`}>
        <p className={`text-[10px] font-black ${t.textSub} mb-2 flex items-center gap-1.5`}>
          <i className="ri-information-line text-indigo-400" />알림 동작 방식
        </p>
        <div className="space-y-1.5">
          {[
            { icon: 'ri-close-circle-line', color: 'text-red-400', text: `연속 ${settings.failure_threshold}회 실패 → 즉시 이메일 발송` },
            { icon: 'ri-time-line', color: 'text-violet-400', text: `${COOLDOWN_OPTIONS.find((o) => o.value === settings.cooldown_minutes)?.label ?? settings.cooldown_minutes + '분'} 쿨다운 — 같은 문제로 중복 발송 방지` },
            { icon: 'ri-checkbox-circle-line', color: 'text-emerald-400', text: settings.notify_on_recovery ? '복구 감지 시 복구 알림 이메일 발송' : '복구 알림 비활성화됨' },
            { icon: 'ri-database-2-line', color: 'text-indigo-400', text: 'Resend 키 없으면 DB 큐에 저장 (email_queue 테이블)' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <i className={`${item.icon} ${item.color} text-xs flex-shrink-0`} />
              <span className={`text-[10px] ${t.textFaint}`}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
