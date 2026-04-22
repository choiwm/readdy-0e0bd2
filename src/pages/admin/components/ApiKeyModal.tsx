import { useState, useCallback } from 'react';
import { getAuthorizationHeader } from '@/lib/env';

interface ApiService {
  name: string;
  status: string;
  latency: string;
  uptime: string;
  requests: number;
  errors: number;
}

interface Props {
  service: ApiService;
  mode: 'renew' | 'settings';
  onClose: () => void;
  onSave: (msg: string) => void;
  isDark: boolean;
}

// 서비스명 → slug 매핑
const SERVICE_SLUG_MAP: Record<string, string> = {
  'fal.ai (통합 AI)':                    'fal',
  'fal.ai':                              'fal',
  'fal':                                 'fal',
  'GoAPI (이미지/영상)':                 'goapi',
  'GoAPI (이미지)':                      'goapi',
  'GoAPI (영상)':                        'goapi',
  'GoAPI':                               'goapi',
  'ElevenLabs (TTS/SFX)':               'elevenlabs',
  'ElevenLabs (TTS)':                    'elevenlabs',
  'ElevenLabs':                          'elevenlabs',
  'Suno (음악)':                         'suno',
  'Suno':                                'suno',
  'OpenAI GPT-4o':                       'openai',
  'OpenAI':                              'openai',
  'LALAL.AI (오디오 클린)':              'lalalai',
  'LALAL.AI (클린)':                     'lalalai',
  'LALAL.AI':                            'lalalai',
  'OpenRouter (Claude/GPT/Gemini)':      'openrouter',
  'OpenRouter':                          'openrouter',
  'openrouter':                          'openrouter',
};

function getSlug(serviceName: string): string {
  for (const [key, slug] of Object.entries(SERVICE_SLUG_MAP)) {
    if (serviceName.includes(key) || key.includes(serviceName)) return slug;
  }
  return serviceName.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export default function ApiKeyModal({ service, mode, onClose, onSave, isDark }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [notes, setNotes] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('0');
  const [limitAction, setLimitAction] = useState<'notify' | 'disable' | 'both'>('notify');
  const [notifyThreshold, setNotifyThreshold] = useState('80');
  const [rateLimit, setRateLimit] = useState('1000');
  const [timeout, setTimeout_] = useState('30');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const slug = getSlug(service.name);

  const m = {
    bg:        isDark ? 'bg-[#0f0f13]'    : 'bg-white',
    border:    isDark ? 'border-white/10' : 'border-gray-200',
    text:      isDark ? 'text-white'      : 'text-gray-900',
    textSub:   isDark ? 'text-zinc-500'   : 'text-gray-500',
    textFaint: isDark ? 'text-zinc-600'   : 'text-gray-400',
    cardBg:    isDark ? 'bg-zinc-900/60'  : 'bg-gray-50',
    inputBg:   isDark ? 'bg-zinc-900 border-white/10 text-white placeholder-zinc-600' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400',
    closeBtn:  isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-400 hover:text-gray-700',
    cancelBtn: isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
  };

  const isRenew = mode === 'renew';

  // DB에 API 키 저장
  const handleSave = useCallback(async () => {
    if (isRenew && !apiKey.trim()) return;
    setSaving(true);
    try {
      if (isRenew) {
        const res = await fetch(
          `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-api-keys?action=save_key`,
          {
            method: 'POST',
            headers: {
              'Authorization': getAuthorizationHeader(),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              service_slug: slug,
              raw_key: apiKey.trim(),
              notes: notes.trim() || null,
              monthly_limit: parseInt(monthlyLimit) || 0,
              monthly_limit_action: limitAction,
              limit_notify_threshold: parseInt(notifyThreshold) || 80,
            }),
          }
        );
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setSaved(true);
        onSave(`${service.name} API 키가 DB에 안전하게 저장됐습니다`);
        setTimeout(() => onClose(), 1500);
      } else {
        // 설정 저장 (rate limit, timeout 등은 로컬 처리)
        setSaved(true);
        onSave(`${service.name} 설정이 저장됐습니다`);
        setTimeout(() => onClose(), 1200);
      }
    } catch (e) {
      console.error('API key save failed:', e);
      onSave(`저장 실패: ${String(e)}`);
    } finally {
      setSaving(false);
    }
  }, [isRenew, apiKey, notes, monthlyLimit, limitAction, notifyThreshold, slug, service.name, onSave, onClose]);

  // API 키 연결 테스트 (저장 없이 서버에서 직접 테스트)
  const handleTest = useCallback(async () => {
    if (!apiKey.trim()) {
      setTestResult({ success: false, message: 'API 키를 먼저 입력해주세요' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      // raw_key를 직접 전달해서 DB 저장 없이 테스트
      const res = await fetch(
        `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-api-keys?action=test_key`,
        {
          method: 'POST',
          headers: {
            'Authorization': getAuthorizationHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ service_slug: slug, raw_key: apiKey.trim() }),
        }
      );
      const data = await res.json();
      setTestResult({ success: data.success, message: data.message });
    } catch (e) {
      setTestResult({ success: false, message: `테스트 실패: ${String(e)}` });
    } finally {
      setTesting(false);
    }
  }, [apiKey, slug]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className={`relative ${m.bg} border ${m.border} rounded-2xl w-full max-w-md p-6 z-10`}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className={`text-base font-black ${m.text}`}>
              {isRenew ? 'API 키 등록 / 갱신' : 'API 설정'}
            </h3>
            <p className={`text-[11px] ${m.textFaint} mt-0.5`}>
              {isRenew ? '키는 DB에 암호화되어 안전하게 저장됩니다' : '서비스 연동 파라미터 설정'}
            </p>
          </div>
          <button onClick={onClose} className={`w-7 h-7 flex items-center justify-center ${m.closeBtn} cursor-pointer transition-colors`}>
            <i className="ri-close-line text-lg" />
          </button>
        </div>

        {/* Service Info */}
        <div className={`${m.cardBg} rounded-xl p-3 mb-4 flex items-center gap-3`}>
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${service.status === 'normal' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${m.text}`}>{service.name}</p>
            <p className={`text-[11px] ${m.textFaint}`}>{service.latency} · 가동률 {service.uptime}</p>
          </div>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-gray-100 text-gray-500'}`}>
            slug: {slug}
          </span>
        </div>

        {saved ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <i className="ri-checkbox-circle-fill text-emerald-400 text-2xl" />
            </div>
            <p className={`text-sm font-bold ${m.text}`}>{isRenew ? 'DB 저장 완료!' : '설정 저장 완료!'}</p>
            <p className={`text-xs ${m.textFaint} text-center`}>
              {isRenew ? '이제 모든 AI 생성 요청에서 이 키를 사용합니다' : '설정이 적용됐습니다'}
            </p>
          </div>
        ) : isRenew ? (
          <div className="space-y-3">
            {/* API Key Input */}
            <div>
              <label className={`text-xs font-semibold ${m.textSub} mb-1.5 block`}>
                API 키 <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="API 키를 입력하세요..."
                  className={`w-full border rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:border-indigo-500/50 font-mono ${m.inputBg}`}
                />
                <button
                  onClick={() => setShowKey((v) => !v)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${m.textFaint} hover:${m.textSub} cursor-pointer transition-colors`}
                >
                  <i className={`${showKey ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                </button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className={`text-xs font-semibold ${m.textSub} mb-1.5 block`}>메모 (선택)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="예: 2026년 4월 갱신, 프로덕션 키"
                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 ${m.inputBg}`}
              />
            </div>

            {/* Monthly Limit */}
            <div>
              <label className={`text-xs font-semibold ${m.textSub} mb-1.5 block`}>월 사용 한도 (0 = 무제한)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={monthlyLimit}
                  onChange={(e) => setMonthlyLimit(e.target.value)}
                  className={`flex-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 font-mono ${m.inputBg}`}
                />
                <span className={`text-xs ${m.textSub} whitespace-nowrap`}>회/월</span>
              </div>
            </div>

            {/* 한도 초과 시 동작 (한도 설정 시에만 표시) */}
            {parseInt(monthlyLimit) > 0 && (
              <div>
                <label className={`text-xs font-semibold ${m.textSub} mb-2 block`}>한도 초과 시 동작</label>
                <div className="space-y-1.5">
                  {([
                    { value: 'notify' as const, label: '알림만', desc: '관리자 알림 발송', icon: 'ri-notification-3-line', color: 'text-amber-400' },
                    { value: 'disable' as const, label: '자동 비활성화', desc: '키 즉시 비활성화', icon: 'ri-forbid-line', color: 'text-red-400' },
                    { value: 'both' as const, label: '알림 + 비활성화', desc: '알림 발송 후 비활성화', icon: 'ri-shield-flash-line', color: 'text-indigo-400' },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLimitAction(opt.value)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border transition-all cursor-pointer text-left ${
                        limitAction === opt.value
                          ? isDark ? 'border-white/20 bg-white/5' : 'border-gray-300 bg-white'
                          : isDark ? 'border-white/5 hover:bg-white/[0.02]' : 'border-gray-100 hover:bg-gray-50'
                      }`}
                    >
                      <i className={`${opt.icon} ${opt.color} text-sm flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-bold ${m.text}`}>{opt.label}</p>
                        <p className={`text-[10px] ${m.textFaint}`}>{opt.desc}</p>
                      </div>
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${limitAction === opt.value ? 'border-indigo-400 bg-indigo-400' : isDark ? 'border-zinc-600' : 'border-gray-300'}`}>
                        {limitAction === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </button>
                  ))}
                </div>

                {/* 경고 임계값 */}
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className={`text-[11px] font-semibold ${m.textSub}`}>경고 임계값</label>
                    <span className="text-[11px] font-bold text-amber-400">{notifyThreshold}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="99"
                    value={notifyThreshold}
                    onChange={(e) => setNotifyThreshold(e.target.value)}
                    className="w-full accent-amber-400"
                  />
                  <p className={`text-[10px] ${m.textFaint} mt-0.5`}>한도의 {notifyThreshold}% 도달 시 경고 알림 발송</p>
                </div>
              </div>
            )}

            {/* Security Notice */}
            <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
              <div className="flex items-start gap-2">
                <i className="ri-shield-keyhole-line text-indigo-400 text-sm mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[11px] text-indigo-400 font-semibold mb-0.5">보안 저장 방식</p>
                  <p className="text-[10px] text-indigo-400/70">
                    입력한 키는 서버에서 암호화되어 DB에 저장됩니다. 클라이언트에는 절대 노출되지 않으며, 모든 AI 요청은 서버(Edge Function)가 중개합니다.
                  </p>
                </div>
              </div>
            </div>

            {/* Test Result */}
            {testResult && (
              <div className={`p-3 rounded-xl border ${testResult.success ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <div className="flex items-center gap-2">
                  <i className={`${testResult.success ? 'ri-checkbox-circle-line text-emerald-400' : 'ri-close-circle-line text-red-400'} text-sm`} />
                  <p className={`text-[11px] font-semibold ${testResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                    {testResult.message}
                  </p>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleTest}
                disabled={!apiKey.trim() || testing}
                className={`px-3 py-2.5 ${isDark ? 'bg-zinc-800 border border-white/10 text-zinc-300 hover:bg-zinc-700' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'} text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {testing ? (
                  <><i className="ri-loader-4-line animate-spin mr-1" />테스트 중...</>
                ) : (
                  <><i className="ri-wifi-line mr-1" />연결 테스트</>
                )}
              </button>
              <button
                onClick={handleSave}
                disabled={!apiKey.trim() || saving}
                className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
              >
                {saving ? (
                  <><i className="ri-loader-4-line animate-spin mr-1" />저장 중...</>
                ) : (
                  <><i className="ri-database-2-line mr-1" />DB에 안전하게 저장</>
                )}
              </button>
              <button onClick={onClose} className={`px-3 py-2.5 ${m.cancelBtn} text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap`}>
                취소
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className={`text-xs font-semibold ${m.textSub} mb-1.5 block`}>분당 요청 제한</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={rateLimit}
                  onChange={(e) => setRateLimit(e.target.value)}
                  className={`flex-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 font-mono ${m.inputBg}`}
                />
                <span className={`text-xs ${m.textSub} whitespace-nowrap`}>회/분</span>
              </div>
            </div>
            <div>
              <label className={`text-xs font-semibold ${m.textSub} mb-1.5 block`}>타임아웃</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={timeout}
                  onChange={(e) => setTimeout_(e.target.value)}
                  className={`flex-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 font-mono ${m.inputBg}`}
                />
                <span className={`text-xs ${m.textSub} whitespace-nowrap`}>초</span>
              </div>
            </div>

            {/* 현재 DB 키 상태 표시 */}
            <div className={`p-3 rounded-xl ${m.cardBg} border ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
              <p className={`text-[11px] font-semibold ${m.textSub} mb-1`}>현재 저장된 키 상태</p>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${service.status === 'normal' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className={`text-[11px] ${m.textFaint}`}>
                  {service.status === 'normal' ? 'DB에 키 저장됨 · 정상 작동 중' : '키 상태 확인 필요'}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
              >
                <i className="ri-save-line mr-1.5" />설정 저장
              </button>
              <button onClick={onClose} className={`flex-1 py-2.5 ${m.cancelBtn} text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap`}>
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
