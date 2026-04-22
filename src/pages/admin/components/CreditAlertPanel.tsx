import { useState, useEffect, useCallback } from 'react';
import { getAuthorizationHeader } from '@/lib/env';

interface AlertStats {
  total_configured: number;
  notification_enabled: number;
  alerted_today: number;
  alerted_this_week: number;
  total_notifications: number;
  unread_notifications: number;
  by_type?: Record<string, number>;
}

interface Props {
  isDark: boolean;
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const NOTIFY_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/credit-alert-notify`;
const TEST_TYPES = [
  { key: 'credit_alert', label: '크레딧 부족', icon: 'ri-copper-diamond-line', color: 'text-amber-400' },
  { key: 'system_notice', label: '시스템 공지', icon: 'ri-megaphone-line', color: 'text-sky-400' },
  { key: 'generation_complete', label: '생성 완료', icon: 'ri-sparkling-2-line', color: 'text-emerald-400' },
  { key: 'feature_update', label: '기능 업데이트', icon: 'ri-rocket-2-line', color: 'text-violet-400' },
];

const NOTICE_TYPES = [
  { key: 'system_notice', label: '시스템 공지', icon: 'ri-megaphone-line' },
  { key: 'feature_update', label: '기능 업데이트', icon: 'ri-rocket-2-line' },
  { key: 'promotion', label: '프로모션/혜택', icon: 'ri-gift-2-line' },
];

export default function CreditAlertPanel({ isDark, onToast }: Props) {
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [loading, setLoading] = useState(false);

  // 테스트 발송
  const [testUserId, setTestUserId] = useState('');
  const [testType, setTestType] = useState('credit_alert');
  const [testSending, setTestSending] = useState(false);

  // 공지사항 브로드캐스트
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastType, setBroadcastType] = useState('system_notice');
  const [broadcastActionUrl, setBroadcastActionUrl] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ total_sent: number; user_count: number } | null>(null);

  // 기본 설정
  const [defaultThresholdPct, setDefaultThresholdPct] = useState(20);
  const [defaultThresholdAmount, setDefaultThresholdAmount] = useState(100);
  const [defaultCooldownHours, setDefaultCooldownHours] = useState(24);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const t = {
    cardBg:    isDark ? 'bg-[#0f0f13]'   : 'bg-white',
    cardBg2:   isDark ? 'bg-zinc-900/60'  : 'bg-gray-50',
    border:    isDark ? 'border-white/5'  : 'border-gray-200',
    border2:   isDark ? 'border-white/10' : 'border-gray-300',
    text:      isDark ? 'text-white'      : 'text-gray-900',
    textSub:   isDark ? 'text-zinc-400'   : 'text-gray-500',
    textFaint: isDark ? 'text-zinc-600'   : 'text-gray-400',
    inputBg:   isDark ? 'bg-zinc-900'     : 'bg-gray-50',
    inputBg2:  isDark ? 'bg-zinc-800'     : 'bg-gray-100',
  };

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${NOTIFY_URL}?action=admin_stats`, {
        headers: { Authorization: getAuthorizationHeader() },
      });
      const data = await res.json();
      if (data.stats) setStats(data.stats);
    } catch (e) {
      console.warn('Alert stats load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleTestSend = async () => {
    if (!testUserId.trim()) { onToast('사용자 ID를 입력해주세요', 'error'); return; }
    setTestSending(true);
    try {
      const res = await fetch(`${NOTIFY_URL}?action=admin_test_send`, {
        method: 'POST',
        headers: { Authorization: getAuthorizationHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: testUserId, test_type: testType }),
      });
      const data = await res.json();
      if (data.sent) {
        onToast(`테스트 알림 발송 완료: ${data.display_name ?? testUserId} (${testType})`, 'success');
        loadStats();
      } else {
        onToast(`발송 실패: ${data.error ?? '알 수 없는 오류'}`, 'error');
      }
    } catch {
      onToast('테스트 발송 중 오류가 발생했습니다', 'error');
    } finally {
      setTestSending(false);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      onToast('제목과 내용을 입력해주세요', 'error');
      return;
    }
    setBroadcasting(true);
    setBroadcastResult(null);
    try {
      const res = await fetch(`${NOTIFY_URL}?action=broadcast_notice`, {
        method: 'POST',
        headers: { Authorization: getAuthorizationHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: broadcastTitle,
          message: broadcastMessage,
          notice_type: broadcastType,
          action_url: broadcastActionUrl || null,
        }),
      });
      const data = await res.json();
      if (data.sent) {
        setBroadcastResult({ total_sent: data.total_sent, user_count: data.user_count });
        onToast(`공지사항 발송 완료: ${data.total_sent}명에게 전송됨`, 'success');
        setBroadcastTitle('');
        setBroadcastMessage('');
        setBroadcastActionUrl('');
        loadStats();
      } else {
        onToast(`발송 실패: ${data.reason ?? '알 수 없는 오류'}`, 'error');
      }
    } catch {
      onToast('브로드캐스트 중 오류가 발생했습니다', 'error');
    } finally {
      setBroadcasting(false);
    }
  };

  const handleSaveDefaults = () => {
    setSettingsSaved(true);
    onToast('기본 알림 설정이 저장됐습니다', 'success');
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  const typeColors: Record<string, string> = {
    credit_alert: 'text-amber-400',
    generation_complete: 'text-emerald-400',
    system_notice: 'text-sky-400',
    feature_update: 'text-violet-400',
    welcome: 'text-pink-400',
    promotion: 'text-orange-400',
  };

  return (
    <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
      {/* Header */}
      <div className={`px-5 py-4 border-b ${t.border} flex items-center justify-between`}>
        <div>
          <p className={`text-sm font-black ${t.text}`}>인앱 알림 관리</p>
          <p className={`text-xs ${t.textSub} mt-0.5`}>크레딧 알림, 공지사항, 생성 완료 등 다양한 알림 타입 관리</p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <i className="ri-loader-4-line animate-spin text-zinc-500 text-sm" />}
          <button onClick={loadStats} className={`w-8 h-8 flex items-center justify-center rounded-xl ${t.inputBg2} hover:opacity-80 cursor-pointer transition-colors`}>
            <i className={`ri-refresh-line text-sm ${t.textSub}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className={`px-5 py-4 border-b ${t.border} grid grid-cols-2 lg:grid-cols-3 gap-3`}>
        {[
          { label: '알림 설정 사용자', value: stats ? `${stats.total_configured}명` : '-', icon: 'ri-user-settings-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
          { label: '알림 활성화', value: stats ? `${stats.notification_enabled}명` : '-', icon: 'ri-notification-3-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: '오늘 발송', value: stats ? `${stats.alerted_today}건` : '-', icon: 'ri-send-plane-line', color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: '이번 주 발송', value: stats ? `${stats.alerted_this_week}건` : '-', icon: 'ri-calendar-check-line', color: 'text-violet-400', bg: 'bg-violet-500/10' },
          { label: '전체 알림 수', value: stats ? `${stats.total_notifications}건` : '-', icon: 'ri-archive-line', color: 'text-sky-400', bg: 'bg-sky-500/10' },
          { label: '미읽음 알림', value: stats ? `${stats.unread_notifications}건` : '-', icon: 'ri-mail-unread-line', color: 'text-rose-400', bg: 'bg-rose-500/10' },
        ].map((s) => (
          <div key={s.label} className={`${t.cardBg2} rounded-xl p-3.5`}>
            <div className={`w-8 h-8 rounded-xl ${s.bg} flex items-center justify-center mb-2`}>
              <i className={`${s.icon} ${s.color} text-sm`} />
            </div>
            <p className={`text-lg font-black ${t.text}`}>{s.value}</p>
            <p className={`text-[11px] ${t.textFaint}`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* 타입별 통계 */}
      {stats?.by_type && Object.keys(stats.by_type).length > 0 && (
        <div className={`px-5 py-4 border-b ${t.border}`}>
          <p className={`text-xs font-black ${t.textSub} mb-3`}>타입별 알림 현황</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.by_type).map(([type, count]) => (
              <div key={type} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${t.cardBg2} border ${t.border}`}>
                <span className={`text-xs font-bold ${typeColors[type] ?? t.textSub}`}>{type}</span>
                <span className={`text-xs font-black ${t.text}`}>{count}건</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 공지사항 브로드캐스트 ── */}
      <div className={`px-5 py-5 border-b ${t.border}`}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 flex items-center justify-center bg-sky-500/10 rounded-xl">
            <i className="ri-megaphone-line text-sky-400 text-sm" />
          </div>
          <p className={`text-xs font-black ${t.text}`}>전체 공지사항 브로드캐스트</p>
        </div>

        <div className="space-y-3">
          {/* 알림 타입 선택 */}
          <div>
            <label className={`text-[11px] font-semibold ${t.textFaint} mb-1.5 block`}>알림 타입</label>
            <div className="flex flex-wrap gap-2">
              {NOTICE_TYPES.map((nt) => (
                <button
                  key={nt.key}
                  onClick={() => setBroadcastType(nt.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    broadcastType === nt.key
                      ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                      : `${t.cardBg2} ${t.border} ${t.textSub} hover:${t.text}`
                  }`}
                >
                  <i className={`${nt.icon} text-xs`} />
                  {nt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 제목 */}
          <div>
            <label className={`text-[11px] font-semibold ${t.textFaint} mb-1.5 block`}>제목</label>
            <input
              type="text"
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              placeholder="공지사항 제목을 입력하세요"
              className={`w-full ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-gray-400'} focus:outline-none focus:border-sky-500/50`}
            />
          </div>

          {/* 내용 */}
          <div>
            <label className={`text-[11px] font-semibold ${t.textFaint} mb-1.5 block`}>내용</label>
            <textarea
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              placeholder="공지사항 내용을 입력하세요"
              rows={3}
              maxLength={500}
              className={`w-full ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-gray-400'} focus:outline-none focus:border-sky-500/50 resize-none`}
            />
            <p className={`text-[10px] ${t.textFaint} text-right mt-1`}>{broadcastMessage.length}/500</p>
          </div>

          {/* 액션 URL (선택) */}
          <div>
            <label className={`text-[11px] font-semibold ${t.textFaint} mb-1.5 block`}>
              액션 URL <span className="font-normal opacity-60">(선택 — 클릭 시 이동할 페이지)</span>
            </label>
            <input
              type="text"
              value={broadcastActionUrl}
              onChange={(e) => setBroadcastActionUrl(e.target.value)}
              placeholder="/ai-create, /credit-purchase 등"
              className={`w-full ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-gray-400'} focus:outline-none focus:border-sky-500/50 font-mono text-xs`}
            />
          </div>

          {/* 발송 버튼 */}
          <div className="flex items-center justify-between">
            {broadcastResult && (
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                <i className="ri-checkbox-circle-line" />
                {broadcastResult.total_sent}명에게 발송 완료
              </div>
            )}
            <button
              onClick={handleBroadcast}
              disabled={broadcasting || !broadcastTitle.trim() || !broadcastMessage.trim()}
              className="ml-auto flex items-center gap-1.5 px-5 py-2.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
            >
              {broadcasting ? (
                <><i className="ri-loader-4-line animate-spin text-xs" />발송 중...</>
              ) : (
                <><i className="ri-send-plane-fill text-xs" />전체 발송</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── 크레딧 알림 기본 설정 ── */}
      <div className={`px-5 py-5 border-b ${t.border}`}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 flex items-center justify-center bg-amber-500/10 rounded-xl">
            <i className="ri-copper-diamond-line text-amber-400 text-sm" />
          </div>
          <p className={`text-xs font-black ${t.text}`}>크레딧 알림 기본 임계값</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className={`${t.cardBg2} rounded-xl p-4`}>
            <label className={`text-[11px] font-semibold ${t.textFaint} mb-1.5 block`}>잔액 비율 임계값</label>
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={99} value={defaultThresholdPct} onChange={(e) => setDefaultThresholdPct(Number(e.target.value))}
                className={`flex-1 ${t.inputBg} border ${t.border2} rounded-lg px-3 py-2 text-sm ${t.text} focus:outline-none focus:border-indigo-500/50 font-mono`} />
              <span className={`text-xs ${t.textFaint} whitespace-nowrap`}>% 이하</span>
            </div>
          </div>
          <div className={`${t.cardBg2} rounded-xl p-4`}>
            <label className={`text-[11px] font-semibold ${t.textFaint} mb-1.5 block`}>절대 잔액 임계값</label>
            <div className="flex items-center gap-2">
              <input type="number" min={1} value={defaultThresholdAmount} onChange={(e) => setDefaultThresholdAmount(Number(e.target.value))}
                className={`flex-1 ${t.inputBg} border ${t.border2} rounded-lg px-3 py-2 text-sm ${t.text} focus:outline-none focus:border-indigo-500/50 font-mono`} />
              <span className={`text-xs ${t.textFaint} whitespace-nowrap`}>CR 이하</span>
            </div>
          </div>
          <div className={`${t.cardBg2} rounded-xl p-4`}>
            <label className={`text-[11px] font-semibold ${t.textFaint} mb-1.5 block`}>알림 쿨다운</label>
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={168} value={defaultCooldownHours} onChange={(e) => setDefaultCooldownHours(Number(e.target.value))}
                className={`flex-1 ${t.inputBg} border ${t.border2} rounded-lg px-3 py-2 text-sm ${t.text} focus:outline-none focus:border-indigo-500/50 font-mono`} />
              <span className={`text-xs ${t.textFaint} whitespace-nowrap`}>시간</span>
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={handleSaveDefaults}
            className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-all whitespace-nowrap ${settingsSaved ? 'bg-emerald-500 text-white' : 'bg-indigo-500 hover:bg-indigo-400 text-white'}`}>
            <i className={`${settingsSaved ? 'ri-check-line' : 'ri-save-line'} text-xs`} />
            {settingsSaved ? '저장됨!' : '기본값 저장'}
          </button>
        </div>
      </div>

      {/* ── 테스트 알림 발송 ── */}
      <div className="px-5 py-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 flex items-center justify-center bg-violet-500/10 rounded-xl">
            <i className="ri-test-tube-line text-violet-400 text-sm" />
          </div>
          <p className={`text-xs font-black ${t.text}`}>테스트 알림 발송</p>
        </div>

        {/* 테스트 타입 선택 */}
        <div className="flex flex-wrap gap-2 mb-3">
          {TEST_TYPES.map((tt) => (
            <button
              key={tt.key}
              onClick={() => setTestType(tt.key)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                testType === tt.key
                  ? 'bg-violet-500/15 border-violet-500/30 text-violet-300'
                  : `${t.cardBg2} ${t.border} ${t.textSub}`
              }`}
            >
              <i className={`${tt.icon} text-xs ${testType === tt.key ? '' : tt.color}`} />
              {tt.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={testUserId}
            onChange={(e) => setTestUserId(e.target.value)}
            placeholder="사용자 UUID 입력 (user_profiles.id)"
            className={`flex-1 ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-gray-400'} focus:outline-none focus:border-violet-500/50 font-mono text-xs`}
          />
          <button
            onClick={handleTestSend}
            disabled={testSending || !testUserId.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-violet-500 hover:bg-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
          >
            {testSending ? <i className="ri-loader-4-line animate-spin text-xs" /> : <i className="ri-notification-3-line text-xs" />}
            테스트 발송
          </button>
        </div>
        <p className={`text-[10px] ${t.textFaint} mt-2`}>
          선택한 타입의 테스트 알림을 해당 사용자의 앱 알림 벨에 즉시 발송합니다.
        </p>
      </div>
    </div>
  );
}
