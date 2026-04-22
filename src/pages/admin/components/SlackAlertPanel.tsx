import { useState, useEffect, useCallback } from 'react';
import { getAuthorizationHeader } from '@/lib/env';

// ── Types ──────────────────────────────────────────────────────────────────
interface SlackSettings {
  enabled: boolean;
  webhook_url: string;
  webhook_url_set: boolean;
  channel: string;
  failure_threshold: number;
  cooldown_minutes: number;
  last_sent_at: string | null;
  notify_on_recovery: boolean;
  mention_channel: boolean;
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

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

// ── Main Component ─────────────────────────────────────────────────────────
const SLACK_BASE = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/healthcheck-scheduler`;

export default function SlackAlertPanel({ isDark, onToast }: Props) {
  const [settings, setSettings] = useState<SlackSettings>({
    enabled: false,
    webhook_url: '',
    webhook_url_set: false,
    channel: '#alerts',
    failure_threshold: 3,
    cooldown_minutes: 60,
    last_sent_at: null,
    notify_on_recovery: true,
    mention_channel: false,
  });
  const [webhookInput, setWebhookInput] = useState('');
  const [showWebhookInput, setShowWebhookInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [savedSettings, setSavedSettings] = useState<SlackSettings | null>(null);


  const t = {
    cardBg:    isDark ? 'bg-[#0f0f13]'         : 'bg-white',
    cardBg2:   isDark ? 'bg-zinc-900/60'        : 'bg-gray-50',
    border:    isDark ? 'border-white/5'        : 'border-gray-200',
    text:      isDark ? 'text-white'            : 'text-gray-900',
    textSub:   isDark ? 'text-zinc-400'         : 'text-gray-500',
    textFaint: isDark ? 'text-zinc-600'         : 'text-gray-400',
    inputBg:   isDark ? 'bg-zinc-800 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900',
    inputBg2:  isDark ? 'bg-zinc-800'           : 'bg-gray-100',
  };

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SLACK_BASE}?action=get_slack_settings`, { headers: { Authorization: getAuthorizationHeader() } });
      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
        setSavedSettings(data.settings);
      }
    } catch (e) {
      console.warn('Slack settings load failed:', e);
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
      settings.channel !== savedSettings.channel ||
      settings.failure_threshold !== savedSettings.failure_threshold ||
      settings.cooldown_minutes !== savedSettings.cooldown_minutes ||
      settings.notify_on_recovery !== savedSettings.notify_on_recovery ||
      settings.mention_channel !== savedSettings.mention_channel ||
      webhookInput !== '';
    setHasChanges(changed);
  }, [settings, savedSettings, webhookInput]);

  const handleSave = async () => {
    if (settings.enabled && !settings.webhook_url_set && !webhookInput) {
      onToast('Slack Webhook URL을 입력해주세요', 'warning');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        enabled: settings.enabled,
        channel: settings.channel,
        failure_threshold: settings.failure_threshold,
        cooldown_minutes: settings.cooldown_minutes,
        notify_on_recovery: settings.notify_on_recovery,
        mention_channel: settings.mention_channel,
      };
      // 새 webhook URL이 입력된 경우에만 포함
      if (webhookInput) {
        body.webhook_url = webhookInput;
      }

      const res = await fetch(`${SLACK_BASE}?action=update_slack_settings`, {
        method: 'PATCH',
        headers: { Authorization: getAuthorizationHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setWebhookInput('');
      setShowWebhookInput(false);
      await loadSettings();
      setHasChanges(false);
      onToast('슬랙 알림 설정이 저장됐습니다', 'success');
    } catch (e) {
      onToast(`저장 실패: ${String(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSlack = async () => {
    if (!settings.webhook_url_set && !webhookInput) {
      onToast('Slack Webhook URL을 먼저 입력해주세요', 'warning');
      return;
    }
    // 새 URL이 입력된 경우 먼저 저장
    if (webhookInput) {
      await handleSave();
    }
    setTestSending(true);
    try {
      const res = await fetch(`${SLACK_BASE}?action=send_test_slack`, {
        method: 'POST',
        headers: { Authorization: getAuthorizationHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        onToast(data.message ?? '테스트 메시지 발송 완료', 'success');
      } else {
        onToast(data.message ?? '발송 실패', 'error');
      }
    } catch (e) {
      onToast(`발송 실패: ${String(e)}`, 'error');
    } finally {
      setTestSending(false);
    }
  };

  const updateSettings = (patch: Partial<SlackSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
      {/* Header */}
      <div className={`px-5 py-4 border-b ${t.border} flex items-center justify-between`}>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-black ${t.text}`}>슬랙 알림 설정</p>
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
            연속 실패 시 슬랙 채널로 자동 알림 · Incoming Webhook 연동
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

      {/* Slack Webhook 안내 배너 */}
      <div className={`px-5 py-3 border-b ${t.border} ${isDark ? 'bg-[#4A154B]/10' : 'bg-purple-50/40'}`}>
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-[#4A154B]/20 flex items-center justify-center flex-shrink-0">
            <i className="ri-slack-line text-[#E01E5A] text-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-[#E01E5A] mb-1">Slack Incoming Webhook URL이 필요합니다</p>
            <p className={`text-[10px] ${t.textFaint} leading-relaxed`}>
              Slack 앱 설정에서 Incoming Webhook을 활성화하고 URL을 복사해서 아래에 붙여넣으세요.
              별도 API 키 없이 무료로 무제한 사용 가능합니다.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <a
                href="https://api.slack.com/messaging/webhooks"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] font-bold text-[#E01E5A] hover:opacity-80 transition-opacity"
              >
                <i className="ri-external-link-line text-xs" />
                Webhook 설정 가이드
              </a>
              <span className={`text-[10px] ${t.textFaint}`}>·</span>
              <span className={`text-[10px] ${t.textFaint}`}>무료 · 무제한</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* 활성화 토글 */}
        <div className={`flex items-center justify-between px-4 py-3.5 rounded-xl border ${t.border} ${t.cardBg2}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${settings.enabled ? 'bg-[#4A154B]/20' : t.inputBg2}`}>
              <i className={`ri-slack-line text-sm ${settings.enabled ? 'text-[#E01E5A]' : t.textFaint}`} />
            </div>
            <div>
              <p className={`text-xs font-bold ${t.text}`}>슬랙 알림 활성화</p>
              <p className={`text-[10px] ${t.textFaint}`}>
                {settings.enabled ? '헬스체크 실패 시 슬랙 자동 발송' : '현재 비활성화 상태'}
              </p>
            </div>
          </div>
          <button
            onClick={() => updateSettings({ enabled: !settings.enabled })}
            className={`w-10 h-5 rounded-full transition-colors cursor-pointer relative flex-shrink-0 ${settings.enabled ? 'bg-[#E01E5A]' : isDark ? 'bg-zinc-700' : 'bg-gray-300'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {/* Webhook URL */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <i className="ri-links-line text-[#E01E5A] text-xs" />
            <p className={`text-xs font-black ${t.textSub}`}>Webhook URL</p>
            {settings.webhook_url_set && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 ml-auto">
                <i className="ri-check-line mr-0.5" />등록됨
              </span>
            )}
          </div>

          {settings.webhook_url_set && !showWebhookInput ? (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${t.border} ${t.cardBg2}`}>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${t.text}`}>
                  {settings.webhook_url || 'https://hooks.slack.com/services/****'}
                </p>
                <p className={`text-[10px] ${t.textFaint} mt-0.5`}>보안을 위해 URL 끝부분이 마스킹됩니다</p>
              </div>
              <button
                onClick={() => setShowWebhookInput(true)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors whitespace-nowrap ${t.inputBg2} ${t.textSub} hover:opacity-80`}
              >
                <i className="ri-edit-line mr-1" />변경
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="url"
                  value={webhookInput}
                  onChange={(e) => setWebhookInput(e.target.value)}
                  placeholder="https://hooks.slack.com/services/T.../B.../..."
                  className={`w-full text-xs px-4 py-3 rounded-xl border ${t.inputBg} outline-none pr-10`}
                />
                {webhookInput && (
                  <button
                    onClick={() => setWebhookInput('')}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center ${t.textFaint} cursor-pointer`}
                  >
                    <i className="ri-close-line text-xs" />
                  </button>
                )}
              </div>
              {settings.webhook_url_set && (
                <button
                  onClick={() => { setShowWebhookInput(false); setWebhookInput(''); }}
                  className={`text-[10px] ${t.textFaint} hover:${t.textSub} cursor-pointer transition-colors`}
                >
                  취소
                </button>
              )}
              <p className={`text-[10px] ${t.textFaint}`}>
                Slack 앱 → Incoming Webhooks → Webhook URL 복사
              </p>
            </div>
          )}
        </div>

        {/* 채널 설정 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <i className="ri-hashtag text-[#E01E5A] text-xs" />
            <p className={`text-xs font-black ${t.textSub}`}>알림 채널</p>
          </div>
          <div className="relative">
            <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold ${t.textFaint}`}>#</span>
            <input
              type="text"
              value={settings.channel.replace(/^#/, '')}
              onChange={(e) => updateSettings({ channel: `#${e.target.value.replace(/^#/, '')}` })}
              placeholder="alerts"
              className={`w-full text-xs pl-7 pr-4 py-3 rounded-xl border ${t.inputBg} outline-none`}
            />
          </div>
          <p className={`text-[10px] ${t.textFaint} mt-1.5`}>
            Webhook URL에 이미 채널이 지정된 경우 이 설정은 무시될 수 있습니다
          </p>
        </div>

        {/* 실패 임계값 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <i className="ri-alarm-warning-line text-red-400 text-xs" />
            <p className={`text-xs font-black ${t.textSub}`}>알림 발송 임계값</p>
            <span className="text-[10px] text-red-400 font-bold ml-auto">
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
        </div>

        {/* 추가 옵션 */}
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

          {/* @channel 멘션 */}
          <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${t.border} ${t.cardBg2}`}>
            <div>
              <p className={`text-xs font-bold ${t.text}`}>@channel 멘션</p>
              <p className={`text-[10px] ${t.textFaint}`}>실패 시 채널 전체 알림</p>
            </div>
            <button
              onClick={() => updateSettings({ mention_channel: !settings.mention_channel })}
              className={`w-9 h-5 rounded-full transition-colors cursor-pointer relative flex-shrink-0 ${settings.mention_channel ? 'bg-[#E01E5A]' : isDark ? 'bg-zinc-700' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.mention_channel ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        {/* 마지막 발송 정보 */}
        {settings.last_sent_at && (
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl ${t.cardBg2} border ${t.border}`}>
            <i className="ri-send-plane-line text-xs text-[#E01E5A]" />
            <span className={`text-[10px] ${t.textFaint}`}>
              마지막 발송:{' '}
              <span className={`font-semibold ${t.textSub}`}>{relativeTime(settings.last_sent_at)}</span>
              <span className="ml-1">({new Date(settings.last_sent_at).toLocaleString('ko-KR')})</span>
            </span>
          </div>
        )}

        {/* 슬랙 메시지 미리보기 */}
        <div className={`${isDark ? 'bg-zinc-900/40 border-white/5' : 'bg-gray-50 border-gray-200'} border rounded-xl p-4`}>
          <p className={`text-[10px] font-black ${t.textSub} mb-3 flex items-center gap-1.5`}>
            <i className="ri-eye-line text-xs" />발송될 슬랙 메시지 미리보기
          </p>
          {/* 슬랙 스타일 미리보기 */}
          <div className={`${isDark ? 'bg-[#1a1a2e] border-white/5' : 'bg-white border-gray-200'} border rounded-xl overflow-hidden`}>
            {/* 슬랙 헤더 바 */}
            <div className="h-1 bg-gradient-to-r from-[#E01E5A] to-[#ECB22E]" />
            <div className="p-3 space-y-2">
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#4A154B] flex items-center justify-center flex-shrink-0 text-sm">
                  🚨
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[11px] font-black ${t.text}`}>Readdy AI 헬스체크</span>
                    <span className={`text-[9px] px-1 py-0.5 rounded ${isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-gray-100 text-gray-500'}`}>APP</span>
                    <span className={`text-[9px] ${t.textFaint}`}>지금</span>
                  </div>
                  <p className={`text-[11px] font-black ${t.text} mb-1`}>🚨 fal.ai API 연결 실패</p>
                  <p className={`text-[10px] ${t.textSub}`}>
                    {settings.mention_channel && <span className="text-[#E01E5A] font-bold">@channel </span>}
                    API 키가 <strong>{settings.failure_threshold}회 이상 연속으로 연결 테스트에 실패</strong>했습니다.
                  </p>
                  <div className={`mt-2 p-2 rounded-lg border-l-4 border-[#E01E5A] ${isDark ? 'bg-zinc-800/60' : 'bg-red-50'}`}>
                    <p className={`text-[10px] font-bold ${t.text}`}>fal.ai</p>
                    <p className={`text-[10px] ${t.textFaint}`}>연속 {settings.failure_threshold}회 실패</p>
                    <p className={`text-[9px] font-mono text-red-400 mt-0.5`}>인증 실패 (HTTP 401)</p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button className={`px-2.5 py-1 rounded text-[10px] font-bold bg-[#E01E5A] text-white cursor-default`}>
                      관리자 패널 확인
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-3">
          {/* 테스트 발송 */}
          <button
            onClick={handleTestSlack}
            disabled={testSending || (!settings.webhook_url_set && !webhookInput)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed border ${
              isDark
                ? 'bg-zinc-800 text-zinc-300 border-white/10 hover:bg-zinc-700'
                : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
            }`}
          >
            {testSending ? (
              <><i className="ri-loader-4-line animate-spin" />발송 중...</>
            ) : (
              <><i className="ri-slack-line" />테스트 메시지 발송</>
            )}
          </button>

          <div className="flex-1" />

          {/* 저장 */}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
              hasChanges
                ? 'bg-[#E01E5A] hover:opacity-90 text-white'
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

      {/* 설정 가이드 */}
      <div className={`px-5 py-4 border-t ${t.border} ${isDark ? 'bg-zinc-900/30' : 'bg-gray-50'}`}>
        <p className={`text-[10px] font-black ${t.textSub} mb-3 flex items-center gap-1.5`}>
          <i className="ri-guide-line text-[#E01E5A]" />Slack Incoming Webhook 설정 방법
        </p>
        <div className="space-y-2">
          {[
            { step: '1', text: 'Slack 워크스페이스 → 앱 관리 → Incoming Webhooks 검색 후 추가' },
            { step: '2', text: '알림을 받을 채널 선택 후 "Incoming Webhook 통합 앱 추가"' },
            { step: '3', text: '생성된 Webhook URL 복사 (https://hooks.slack.com/services/...)' },
            { step: '4', text: '위 Webhook URL 입력란에 붙여넣고 저장' },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-2.5">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0 mt-0.5 ${isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-gray-200 text-gray-500'}`}>
                {item.step}
              </span>
              <span className={`text-[10px] ${t.textFaint} leading-relaxed`}>{item.text}</span>
            </div>
          ))}
        </div>

        <div className={`mt-3 pt-3 border-t ${t.border} space-y-1.5`}>
          <p className={`text-[10px] font-black ${t.textSub} mb-1.5 flex items-center gap-1.5`}>
            <i className="ri-information-line text-[#E01E5A]" />알림 동작 방식
          </p>
          {[
            { icon: 'ri-close-circle-line', color: 'text-red-400', text: `연속 ${settings.failure_threshold}회 실패 → 즉시 슬랙 메시지 발송` },
            { icon: 'ri-time-line', color: 'text-violet-400', text: `${COOLDOWN_OPTIONS.find((o) => o.value === settings.cooldown_minutes)?.label ?? settings.cooldown_minutes + '분'} 쿨다운 — 중복 발송 방지` },
            { icon: 'ri-checkbox-circle-line', color: 'text-emerald-400', text: settings.notify_on_recovery ? '복구 감지 시 복구 알림 메시지 발송' : '복구 알림 비활성화됨' },
            { icon: 'ri-at-line', color: 'text-[#E01E5A]', text: settings.mention_channel ? '실패 시 @channel 멘션으로 채널 전체 알림' : '@channel 멘션 비활성화됨' },
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
