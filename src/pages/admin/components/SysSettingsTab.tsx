import { SectionHeader } from './AdminHelpers';

export interface RetentionValues {
  audit: string;
  content: string;
  billing: string;
}

interface Theme {
  cardBg: string;
  cardBg2: string;
  border: string;
  border2: string;
  text: string;
  textSub: string;
  textMuted: string;
  inputBg: string;
  inputBg2: string;
}

interface SysSettingsTabProps {
  isDark: boolean;
  t: Theme;

  maintenanceMode: boolean;
  setMaintenanceMode: (updater: (v: boolean) => boolean) => void;

  contentAutoFilter: boolean;
  setContentAutoFilter: (updater: (v: boolean) => boolean) => void;

  watermarkDefault: boolean;
  setWatermarkDefault: (updater: (v: boolean) => boolean) => void;

  maxConcurrent: string;
  setMaxConcurrent: (v: string) => void;
  sessionTimeout: string;
  setSessionTimeout: (v: string) => void;
  onSavePerformance: () => void;

  emailNotif: boolean;
  setEmailNotif: (updater: (v: boolean) => boolean) => void;
  slackNotif: boolean;
  setSlackNotif: (updater: (v: boolean) => boolean) => void;
  slackWebhookUrl: string;
  setSlackWebhookUrl: (v: string) => void;

  retentionEdit: boolean;
  setRetentionEdit: (updater: (v: boolean) => boolean) => void;
  retentionValues: RetentionValues;
  setRetentionValues: (updater: (prev: RetentionValues) => RetentionValues) => void;

  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function SysSettingsTab({
  isDark, t,
  maintenanceMode, setMaintenanceMode,
  contentAutoFilter, setContentAutoFilter,
  watermarkDefault, setWatermarkDefault,
  maxConcurrent, setMaxConcurrent, sessionTimeout, setSessionTimeout, onSavePerformance,
  emailNotif, setEmailNotif, slackNotif, setSlackNotif, slackWebhookUrl, setSlackWebhookUrl,
  retentionEdit, setRetentionEdit, retentionValues, setRetentionValues,
  onToast,
}: SysSettingsTabProps) {
  const performanceFields = [
    { label: '최대 동시 요청 수', value: maxConcurrent, setter: setMaxConcurrent, unit: '건', desc: '초과 시 대기열 처리' },
    { label: '세션 타임아웃', value: sessionTimeout, setter: setSessionTimeout, unit: '분', desc: '비활성 세션 자동 만료' },
    { label: 'API 요청 제한 (분당)', value: '1000', setter: () => {}, unit: '회', desc: '사용자당 분당 최대 요청' },
  ];

  const retentionItems: Array<{ label: string; key: keyof RetentionValues; icon: string; color: string; bg: string }> = [
    { label: '감사 로그 보존', key: 'audit', icon: 'ri-file-chart-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { label: '생성 콘텐츠 보존', key: 'content', icon: 'ri-image-ai-line', color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: '결제 내역 보존', key: 'billing', icon: 'ri-bank-card-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ];

  return (
    <div className="space-y-5 md:space-y-6">
      <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
        <SectionHeader title="서비스 운영 상태" subtitle="전체 서비스 가동 여부 제어" isDark={isDark} />
        <div className="space-y-3">
          <div className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${maintenanceMode ? 'bg-amber-500/5 border-amber-500/20' : `${t.cardBg2} ${t.border}`}`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${maintenanceMode ? 'bg-amber-500/15' : t.inputBg2}`}>
                <i className={`ri-tools-line text-sm ${maintenanceMode ? 'text-amber-400' : t.textMuted}`} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${t.text}`}>유지보수 모드</p>
                <p className={`text-xs ${t.textMuted}`}>활성화 시 일반 사용자 접근 차단, 관리자만 접근 가능</p>
              </div>
            </div>
            <button
              onClick={() => setMaintenanceMode((v) => !v)}
              aria-label="유지보수 모드 토글"
              aria-pressed={maintenanceMode}
              className={`w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 relative ${maintenanceMode ? 'bg-amber-500' : 'bg-zinc-700'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${maintenanceMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <div className={`flex items-center justify-between p-4 rounded-xl ${t.cardBg2} border ${t.border}`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${t.inputBg2} flex items-center justify-center`}>
                <i className={`ri-shield-check-line ${t.textMuted} text-sm`} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${t.text}`}>AI 콘텐츠 자동 필터</p>
                <p className={`text-xs ${t.textMuted}`}>부적절 콘텐츠 자동 감지 및 차단</p>
              </div>
            </div>
            <button
              onClick={() => setContentAutoFilter((v) => !v)}
              aria-label="콘텐츠 자동 필터 토글"
              aria-pressed={contentAutoFilter}
              className={`w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 relative ${contentAutoFilter ? 'bg-indigo-500' : 'bg-zinc-700'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${contentAutoFilter ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <div className={`flex items-center justify-between p-4 rounded-xl ${t.cardBg2} border ${t.border}`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${t.inputBg2} flex items-center justify-center`}>
                <i className={`ri-copyright-line ${t.textMuted} text-sm`} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${t.text}`}>Free 플랜 워터마크 기본값</p>
                <p className={`text-xs ${t.textMuted}`}>Free 플랜 생성물에 워터마크 자동 삽입</p>
              </div>
            </div>
            <button
              onClick={() => setWatermarkDefault((v) => !v)}
              aria-label="Free 플랜 워터마크 토글"
              aria-pressed={watermarkDefault}
              className={`w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 relative ${watermarkDefault ? 'bg-indigo-500' : 'bg-zinc-700'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${watermarkDefault ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
      </div>

      <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
        <SectionHeader title="성능 & 리소스 설정" subtitle="서버 처리 한도 및 타임아웃 설정" isDark={isDark} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {performanceFields.map((item) => (
            <div key={item.label} className={`${t.cardBg2} rounded-xl p-4`}>
              <p className="text-xs font-semibold text-zinc-300 mb-1">{item.label}</p>
              <p className="text-[10px] text-zinc-600 mb-3">{item.desc}</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={item.value}
                  onChange={(e) => item.setter(e.target.value)}
                  className="flex-1 bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 font-mono"
                  aria-label={item.label}
                />
                <span className="text-xs text-zinc-500 whitespace-nowrap">{item.unit}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={onSavePerformance} className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap">
            <i className="ri-save-line text-xs" />
            설정 저장
          </button>
        </div>
      </div>

      <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
        <SectionHeader title="알림 설정" subtitle="시스템 이벤트 알림 채널 관리" isDark={isDark} />
        <div className="space-y-3">
          <div className={`flex items-center justify-between p-4 rounded-xl ${t.cardBg2} border ${t.border}`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${t.inputBg2} flex items-center justify-center`}>
                <i className={`ri-mail-line ${t.textMuted} text-sm`} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${t.text}`}>이메일 알림</p>
                <p className={`text-xs ${t.textMuted}`}>긴급 이벤트 발생 시 관리자 이메일 발송</p>
              </div>
            </div>
            <button
              onClick={() => setEmailNotif((v) => !v)}
              aria-label="이메일 알림 토글"
              aria-pressed={emailNotif}
              className={`w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 relative ${emailNotif ? 'bg-indigo-500' : 'bg-zinc-700'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${emailNotif ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <div className={`flex items-center justify-between p-4 rounded-xl ${t.cardBg2} border ${t.border}`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${t.inputBg2} flex items-center justify-center`}>
                <i className={`ri-slack-line ${t.textMuted} text-sm`} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${t.text}`}>Slack 알림</p>
                <p className={`text-xs ${t.textMuted}`}>Slack 웹훅 연동 알림 발송</p>
              </div>
            </div>
            <button
              onClick={() => setSlackNotif((v) => !v)}
              aria-label="Slack 알림 토글"
              aria-pressed={slackNotif}
              className={`w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 relative ${slackNotif ? 'bg-indigo-500' : 'bg-zinc-700'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${slackNotif ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {slackNotif && (
            <div className={`p-4 rounded-xl ${t.cardBg2} border ${t.border}`}>
              <label className={`text-xs font-semibold ${t.textSub} mb-1.5 block`}>Slack Webhook URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={slackWebhookUrl}
                  onChange={(e) => setSlackWebhookUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  className={`flex-1 ${t.inputBg2} border ${t.border2} rounded-xl px-3 py-2 text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-gray-400'} focus:outline-none focus:border-indigo-500/50`}
                />
                <button
                  onClick={() => {
                    if (!slackWebhookUrl.trim()) { onToast('Webhook URL을 입력해주세요', 'error'); return; }
                    onToast('Slack Webhook URL이 저장됐습니다', 'success');
                  }}
                  className="px-3 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                >
                  저장
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className={`text-sm font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>데이터 보존 정책</h2>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>로그 및 생성물 보존 기간 설정</p>
          </div>
          <button
            onClick={() => setRetentionEdit((v) => !v)}
            className={`flex items-center gap-1.5 text-xs cursor-pointer transition-colors whitespace-nowrap ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800'}`}
          >
            <i className={`${retentionEdit ? 'ri-close-line' : 'ri-edit-line'} text-xs`} />
            {retentionEdit ? '취소' : '편집'}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {retentionItems.map((item) => (
            <div key={item.label} className={`${t.cardBg2} rounded-xl p-4 flex items-center gap-3`}>
              <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center flex-shrink-0`}>
                <i className={`${item.icon} ${item.color} text-sm`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs ${t.textMuted}`}>{item.label}</p>
                {retentionEdit ? (
                  <input
                    type="text"
                    value={retentionValues[item.key]}
                    onChange={(e) => setRetentionValues((prev) => ({ ...prev, [item.key]: e.target.value }))}
                    className={`w-full mt-1 ${t.inputBg} border ${t.border2} rounded-lg px-2 py-1 text-xs ${t.text} focus:outline-none focus:border-indigo-500/50`}
                    aria-label={item.label}
                  />
                ) : (
                  <p className={`text-sm font-black ${t.text}`}>{retentionValues[item.key]}</p>
                )}
              </div>
            </div>
          ))}
        </div>
        {retentionEdit && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => { setRetentionEdit(() => false); onToast('데이터 보존 정책이 저장됐습니다', 'success'); }}
              className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-save-line text-xs" />
              저장
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
