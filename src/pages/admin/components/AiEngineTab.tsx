import { useState, useEffect, useCallback, useRef } from 'react';
import ApiKeyModal from './ApiKeyModal';
import CreditCostPanel from './CreditCostPanel';
import CreditAlertPanel from './CreditAlertPanel';
import HealthCheckScheduler from './HealthCheckScheduler';
import FailureLogsDrawer from './FailureLogsDrawer';
import FalModelCatalog from './FalModelCatalog';
import FalKeyManagerPanel from './FalKeyManagerPanel';
import StatusDot from './StatusDot';
import {
  MODEL_LABELS,
  BADGE_COLORS,
  DEFAULT_SETTINGS,
  ALL_IMAGE_MODELS,
  ALL_VIDEO_MODELS,
  ALL_FAL_MUSIC_MODELS,
  SLUG_TO_DISPLAY,
  DEFAULT_SERVICES,
  GPU_INSTANCES,
  safeJsonParse,
  type ApiKeyRecord,
  type UsageStats,
  type ModelSettings,
  type ApiService,
} from './aiEngineData';
import type { PromptTemplate } from '../types';
import { getAuthorizationHeader } from '@/lib/env';

interface Props {
  isDark: boolean;
  onToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  apiStatus: ApiService[];
  promptTemplates: PromptTemplate[];
  onPromptToggle: (id: string) => void;
  onPromptEdit: (template: PromptTemplate | null) => void;
  apiHealthData: {
    image?: { requests_24h: number; requests_today: number; requests_1h: number; error_rate: number; status: string };
    audio?: { requests_24h: number; requests_today: number; requests_1h: number; error_rate: number; status: string };
    video?: { requests_24h: number; requests_today: number; requests_1h: number; error_rate: number; status: string };
    total_requests_today?: number;
    total_requests_1h?: number;
  } | null;
  apiHealthLoading: boolean;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function AiEngineTab({
  isDark, onToast, apiStatus, promptTemplates, onPromptToggle, onPromptEdit,
  apiHealthData, apiHealthLoading,
}: Props) {
  const [section, setSection] = useState<'model' | 'apikeys' | 'credits' | 'prompts' | 'gpu' | 'healthcheck' | 'catalog' | 'falkeys'>('model');
  const [modelCategory, setModelCategory] = useState<'image' | 'video' | 'music'>('image');

  // Model settings
  const [settings, setSettings] = useState<ModelSettings>(DEFAULT_SETTINGS);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelSaving, setModelSaving] = useState<string | null>(null);
  const [modelSaveSuccess, setModelSaveSuccess] = useState<string | null>(null);

  // API keys
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats>({});
  const [keysLoading, setKeysLoading] = useState(false);
  const [totalCreditsUsed, setTotalCreditsUsed] = useState(0);
  const [totalRequests, setTotalRequests] = useState(0);
  const [sunoKeyStatus, setSunoKeyStatus] = useState<'unknown' | 'registered' | 'missing'>('unknown');
  const [apiKeyModal, setApiKeyModal] = useState<{ service: ApiService; mode: 'renew' | 'settings'; slug?: string } | null>(null);
  const [togglingSlug, setTogglingSlug] = useState<string | null>(null);
  // 테스트 상태: slug → 'testing' | 'success' | 'failed'
  const [testStates, setTestStates] = useState<Record<string, 'testing' | 'success' | 'failed'>>({});

  // Failure logs drawer
  const [failureDrawer, setFailureDrawer] = useState<{ open: boolean; slug: string | null; days: number }>({
    open: false, slug: null, days: 7,
  });

  // GPU 실시간 시뮬레이션
  const [gpuLoads, setGpuLoads] = useState(GPU_INSTANCES.map((g) => ({ load: g.baseLoad, mem: g.baseMem, tasks: Math.floor(Math.random() * 100) + 20 })));
  const gpuIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const t = {
    cardBg:    isDark ? 'bg-[#0f0f13]'   : 'bg-white',
    cardBg2:   isDark ? 'bg-zinc-900/60'  : 'bg-gray-50',
    border:    isDark ? 'border-white/5'  : 'border-gray-200',
    text:      isDark ? 'text-white'      : 'text-gray-900',
    textSub:   isDark ? 'text-zinc-400'   : 'text-gray-500',
    textFaint: isDark ? 'text-zinc-600'   : 'text-gray-400',
    inputBg2:  isDark ? 'bg-zinc-800'     : 'bg-gray-100',
    divider:   isDark ? 'divide-white/[0.03]' : 'divide-gray-100',
    rowHover:  isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50',
    tableHead: isDark ? 'text-zinc-500'   : 'text-gray-400',
  };

  // ── GPU 실시간 시뮬레이션 (section === 'gpu' 일 때만) ──
  useEffect(() => {
    if (section !== 'gpu') {
      if (gpuIntervalRef.current) clearInterval(gpuIntervalRef.current);
      return;
    }
    gpuIntervalRef.current = setInterval(() => {
      setGpuLoads((prev) => prev.map((g, i) => {
        const _base = GPU_INSTANCES[i];
        const delta = (Math.random() - 0.5) * 6;
        const load = Math.max(5, Math.min(98, g.load + delta));
        const mem = Math.max(10, Math.min(95, g.mem + (Math.random() - 0.5) * 4));
        const tasks = Math.max(0, g.tasks + Math.floor((Math.random() - 0.5) * 10));
        return { load: Math.round(load), mem: Math.round(mem), tasks };
      }));
    }, 2000);
    return () => { if (gpuIntervalRef.current) clearInterval(gpuIntervalRef.current); };
  }, [section]);

  // ── Load model settings ──
  const loadModelSettings = useCallback(async () => {
    setModelLoading(true);
    try {
      const base = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-api-keys`;
      const headers = { 'Authorization': getAuthorizationHeader() };
      const [settingsRes, keysRes] = await Promise.allSettled([
        fetch(`${base}?action=get_model_settings`, { headers }),
        fetch(`${base}?action=list`, { headers }),
      ]);

      if (settingsRes.status === 'fulfilled') {
        const data = await settingsRes.value.json();
        if (data.settings && Object.keys(data.settings).length > 0) {
          const s = data.settings;
          setSettings({
            image: {
              active_model: s.image?.active_model ?? DEFAULT_SETTINGS.image.active_model,
              available_models: safeJsonParse<string[]>(s.image?.available_models, DEFAULT_SETTINGS.image.available_models),
            },
            video: {
              active_model: s.video?.active_model ?? DEFAULT_SETTINGS.video.active_model,
              available_models: safeJsonParse<string[]>(s.video?.available_models, DEFAULT_SETTINGS.video.available_models),
            },
            music: {
              active_provider: s.music?.active_provider ?? 'fal',
              active_model: s.music?.active_model ?? 'fal-ai/stable-audio',
              available_fal_models: safeJsonParse<string[]>(s.music?.available_fal_models, DEFAULT_SETTINGS.music.available_fal_models),
              suno_enabled: s.music?.suno_enabled ?? 'true',
            },
          });
        }
      }

      if (keysRes.status === 'fulfilled') {
        const data = await keysRes.value.json();
        const sunoKey = (data.api_keys ?? []).find((k: ApiKeyRecord) => k.service_slug === 'suno');
        setSunoKeyStatus(sunoKey?.key_hint ? 'registered' : 'missing');
      }
    } catch (e) {
      console.warn('Model settings load failed:', e);
    } finally {
      setModelLoading(false);
    }
  }, []);

  // ── Load API keys ──
  const loadApiKeys = useCallback(async () => {
    setKeysLoading(true);
    try {
      const base = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-api-keys`;
      const headers = { 'Authorization': getAuthorizationHeader() };
      const [keysRes, statsRes] = await Promise.allSettled([
        fetch(`${base}?action=list`, { headers }),
        fetch(`${base}?action=usage_stats&days=7`, { headers }),
      ]);

      if (keysRes.status === 'fulfilled') {
        const data = await keysRes.value.json();
        if (data.api_keys) {
          // service_name이 slug로 저장된 경우 표시명으로 보정
          const fromDb: ApiKeyRecord[] = data.api_keys.map((k: ApiKeyRecord) => ({
            ...k,
            service_name: SLUG_TO_DISPLAY[k.service_slug] ?? k.service_name,
          }));

          // DB에 없는 기본 서비스는 DEFAULT_SERVICES에서 채워서 항상 전체 목록 표시
          const dbSlugs = new Set(fromDb.map((k) => k.service_slug));
          const missing = DEFAULT_SERVICES.filter((d) => !dbSlugs.has(d.service_slug));
          const merged = [...fromDb, ...missing];

          setApiKeys(merged);
          const sunoKey = merged.find((k: ApiKeyRecord) => k.service_slug === 'suno');
          setSunoKeyStatus(sunoKey?.key_hint ? 'registered' : 'missing');
        } else {
          // API 응답 자체가 없으면 기본 목록 표시
          setApiKeys(DEFAULT_SERVICES);
        }
      } else {
        // 요청 실패 시에도 기본 목록 표시
        setApiKeys(DEFAULT_SERVICES);
      }

      if (statsRes.status === 'fulfilled') {
        const data = await statsRes.value.json();
        if (data.usage_stats) setUsageStats(data.usage_stats);
        if (data.total_credits_used !== undefined) setTotalCreditsUsed(data.total_credits_used);
        if (data.total_requests !== undefined) setTotalRequests(data.total_requests);
      }
    } catch (e) {
      console.warn('API keys load failed:', e);
      // 에러 시에도 기본 목록 표시
      setApiKeys(DEFAULT_SERVICES);
    } finally {
      setKeysLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModelSettings();
    loadApiKeys();
  }, [loadModelSettings, loadApiKeys]);

  // ── Save model section ──
  const handleSaveModel = async (category: 'image' | 'video' | 'music') => {
    setModelSaving(category);
    setModelSaveSuccess(null);
    try {
      const base = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-api-keys`;
      const headers = { 'Authorization': getAuthorizationHeader(), 'Content-Type': 'application/json' };
      let settingsToSave: Record<string, string> = {};

      if (category === 'image') {
        settingsToSave = {
          active_model: settings.image.active_model,
          available_models: JSON.stringify(settings.image.available_models),
        };
      } else if (category === 'video') {
        settingsToSave = {
          active_model: settings.video.active_model,
          available_models: JSON.stringify(settings.video.available_models),
        };
      } else {
        settingsToSave = {
          active_provider: settings.music.active_provider,
          active_model: settings.music.active_model,
          available_fal_models: JSON.stringify(settings.music.available_fal_models),
          suno_enabled: settings.music.suno_enabled,
        };
      }

      const res = await fetch(`${base}?action=save_model_settings`, {
        method: 'POST', headers,
        body: JSON.stringify({ category, settings: settingsToSave }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const labels = { image: '이미지', video: '영상', music: '음악' };
      setModelSaveSuccess(category);
      onToast(`${labels[category]} 모델 설정이 저장됐습니다`, 'success');
      setTimeout(() => setModelSaveSuccess(null), 2000);
    } catch (e) {
      onToast(`저장 실패: ${String(e)}`, 'error');
    } finally {
      setModelSaving(null);
    }
  };

  // ── Toggle API key status (낙관적 업데이트 + 롤백) ──
  const handleToggleKeyStatus = async (slug: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    setTogglingSlug(slug);

    // 낙관적 업데이트
    setApiKeys((prev) => prev.map((k) =>
      k.service_slug === slug ? { ...k, status: newStatus as 'active' | 'inactive' | 'error' } : k
    ));

    try {
      const res = await fetch(
        `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-api-keys?action=toggle_status`,
        {
          method: 'PATCH',
          headers: { 'Authorization': getAuthorizationHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ service_slug: slug, status: newStatus }),
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onToast(`${SLUG_TO_DISPLAY[slug] ?? slug} ${newStatus === 'active' ? '활성화' : '비활성화'}됐습니다`, 'info');
    } catch (e) {
      // 롤백
      setApiKeys((prev) => prev.map((k) =>
        k.service_slug === slug ? { ...k, status: currentStatus as 'active' | 'inactive' | 'error' } : k
      ));
      onToast(`상태 변경 실패: ${String(e)}`, 'error');
    } finally {
      setTogglingSlug(null);
    }
  };

  // ── 저장된 API 키 연결 테스트 (실시간 상태 반영) ──
  const handleTestKey = useCallback(async (slug: string) => {
    setTestStates((prev) => ({ ...prev, [slug]: 'testing' }));
    try {
      const res = await fetch(
        `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-api-keys?action=test_saved_key`,
        {
          method: 'POST',
          headers: { 'Authorization': getAuthorizationHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ service_slug: slug }),
        }
      );
      const data = await res.json();
      const resultState: 'success' | 'failed' = data.success ? 'success' : 'failed';

      // 결과를 apiKeys 상태에 즉시 반영
      setApiKeys((prev) => prev.map((k) =>
        k.service_slug === slug
          ? { ...k, status: data.success ? 'active' : 'error', last_tested_at: new Date().toISOString(), test_result: data.message }
          : k
      ));

      setTestStates((prev) => ({ ...prev, [slug]: resultState }));
      onToast(
        data.success ? `${SLUG_TO_DISPLAY[slug] ?? slug} 연결 성공` : `${SLUG_TO_DISPLAY[slug] ?? slug} 연결 실패: ${data.message}`,
        data.success ? 'success' : 'error'
      );

      setTimeout(() => {
        setTestStates((prev) => { const next = { ...prev }; delete next[slug]; return next; });
      }, 2500);
    } catch (e) {
      setTestStates((prev) => ({ ...prev, [slug]: 'failed' }));
      onToast(`테스트 실패: ${String(e)}`, 'error');
      setTimeout(() => {
        setTestStates((prev) => { const next = { ...prev }; delete next[slug]; return next; });
      }, 2500);
    }
  }, [onToast]);

  // ── API 키 등록 후 즉시 목록 갱신 ──
  const handleApiKeySaved = (msg: string) => {
    onToast(msg, 'success');
    setApiKeyModal(null);
    // 즉시 목록 갱신 (딜레이 없이)
    loadApiKeys();
  };

  // ── Section nav ──
  const sectionItems = [
    { id: 'model' as const,   label: 'AI 모델 설정',    icon: 'ri-cpu-line',           color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  activeBorder: 'border-indigo-500/30' },
    { id: 'apikeys' as const, label: 'API 키 관리',     icon: 'ri-key-2-line',         color: 'text-amber-400',   bg: 'bg-amber-500/10',   activeBorder: 'border-amber-500/30' },
    { id: 'credits' as const, label: '크레딧 비용',     icon: 'ri-coin-line',          color: 'text-emerald-400', bg: 'bg-emerald-500/10', activeBorder: 'border-emerald-500/30' },
    { id: 'prompts' as const, label: '프롬프트 템플릿', icon: 'ri-code-s-slash-line',  color: 'text-violet-400',  bg: 'bg-violet-500/10',  activeBorder: 'border-violet-500/30' },

    { id: 'healthcheck' as const, label: '헬스체크 스케줄러', icon: 'ri-heart-pulse-line', color: 'text-rose-400',    bg: 'bg-rose-500/10',    activeBorder: 'border-rose-500/30' },
    { id: 'catalog' as const,     label: 'fal.ai 모델 카탈로그', icon: 'ri-apps-2-line',        color: 'text-teal-400',    bg: 'bg-teal-500/10',    activeBorder: 'border-teal-500/30' },
    { id: 'falkeys' as const,     label: 'fal.ai 키 관리',      icon: 'ri-shield-keyhole-line', color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    activeBorder: 'border-cyan-500/30' },
  ];

  const modelTabs = [
    { id: 'image' as const, label: '이미지', icon: 'ri-image-ai-line', color: 'text-indigo-400', accentBg: 'bg-indigo-500', accentLight: 'bg-indigo-500/10', accentBorder: 'border-indigo-500/30' },
    { id: 'video' as const, label: '영상',   icon: 'ri-video-ai-line', color: 'text-violet-400', accentBg: 'bg-violet-500', accentLight: 'bg-violet-500/10', accentBorder: 'border-violet-500/30' },
    { id: 'music' as const, label: '음악',   icon: 'ri-music-2-line',  color: 'text-emerald-400', accentBg: 'bg-emerald-500', accentLight: 'bg-emerald-500/10', accentBorder: 'border-emerald-500/30' },
  ];

  const statusConfig = {
    active:   { label: '활성', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-400' },
    inactive: { label: '비활성', cls: 'bg-zinc-700/60 text-zinc-400 border-zinc-600/30', dot: 'bg-zinc-500' },
    error:    { label: '오류', cls: 'bg-red-500/15 text-red-400 border-red-500/25', dot: 'bg-red-400 animate-pulse' },
  };

  // ── Model Card Row ──
  const ModelRow = ({
    model, isActive, isEnabled, accentColor, onSelect, onToggle,
  }: {
    model: string; isActive: boolean; isEnabled: boolean;
    accentColor: string; onSelect: () => void; onToggle: () => void;
  }) => {
    const info = MODEL_LABELS[model];
    return (
      <div className={`flex items-center gap-3 px-4 py-3 ${t.rowHover} transition-colors`}>
        <button
          onClick={onSelect}
          className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center cursor-pointer transition-all ${
            isActive ? `border-${accentColor}-500 bg-${accentColor}-500` : `${isDark ? 'border-zinc-600' : 'border-gray-300'}`
          }`}
          style={{ borderColor: isActive ? undefined : undefined }}
        >
          {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold ${t.text}`}>{info?.name ?? model}</span>
            {info?.badge && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${BADGE_COLORS[info.badge] ?? 'bg-zinc-700 text-zinc-400'}`}>
                {info.badge}
              </span>
            )}
            {isActive && <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded-full">기본값</span>}
          </div>
          <p className={`text-[10px] ${t.textFaint} mt-0.5`}>{info?.desc ?? model}</p>
        </div>
        <button
          onClick={onToggle}
          className={`w-9 h-5 rounded-full transition-colors cursor-pointer relative flex-shrink-0 ${isEnabled ? 'bg-indigo-500' : isDark ? 'bg-zinc-700' : 'bg-gray-300'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* ── Section Navigation ── */}
      <div className={`${t.cardBg} border ${t.border} rounded-2xl p-3`}>
        <div className="flex items-center gap-2 overflow-x-auto">
          {sectionItems.map((item) => {
            const isActive = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap border flex-shrink-0 ${
                  isActive
                    ? `${item.bg} ${item.color} ${item.activeBorder}`
                    : `${t.inputBg2} ${t.textSub} border-transparent hover:opacity-80`
                }`}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className={`${item.icon} text-sm`} />
                </div>
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION: AI 모델 설정
      ══════════════════════════════════════════════════════════════ */}
      {section === 'model' && (
        <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
          <div className={`px-5 py-4 border-b ${t.border} flex items-center justify-between`}>
            <div>
              <p className={`text-sm font-black ${t.text}`}>AI 모델 설정</p>
              <p className={`text-xs ${t.textSub} mt-0.5`}>이미지·영상·음악 생성에 사용할 모델 선택 · 저장 후 즉시 적용</p>
            </div>
            <div className="flex items-center gap-2">
              {modelLoading && <i className="ri-loader-4-line animate-spin text-zinc-500 text-sm" />}
              <button onClick={loadModelSettings} className={`w-8 h-8 flex items-center justify-center rounded-xl ${t.inputBg2} hover:opacity-80 cursor-pointer transition-colors`}>
                <i className={`ri-refresh-line text-sm ${t.textSub}`} />
              </button>
            </div>
          </div>

          {/* Model Category Tabs */}
          <div className={`px-5 py-3 border-b ${t.border} flex items-center gap-2`}>
            {modelTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setModelCategory(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap border ${
                  modelCategory === tab.id
                    ? `${tab.accentLight} ${tab.color} ${tab.accentBorder}`
                    : `${t.inputBg2} ${t.textSub} border-transparent hover:opacity-80`
                }`}
              >
                <i className={`${tab.icon} text-sm`} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Image Models */}
          {modelCategory === 'image' && (
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <i className="ri-star-line text-amber-400 text-xs" />
                <p className={`text-xs font-black ${t.textSub}`}>기본 생성 모델 선택</p>
                <span className={`text-[10px] ${t.textFaint} ml-auto`}>라디오 = 기본값 · 토글 = 사용자 노출</span>
              </div>
              <div className={`${t.cardBg2} rounded-xl border ${t.border} overflow-hidden divide-y ${t.divider}`}>
                {ALL_IMAGE_MODELS.map((model) => (
                  <ModelRow
                    key={model}
                    model={model}
                    isActive={settings.image.active_model === model}
                    isEnabled={settings.image.available_models.includes(model)}
                    accentColor="indigo"
                    onSelect={() => setSettings((prev) => ({ ...prev, image: { ...prev.image, active_model: model } }))}
                    onToggle={() => setSettings((prev) => {
                      const current = prev.image.available_models;
                      const updated = current.includes(model) ? current.filter((m) => m !== model) : [...current, model];
                      return { ...prev, image: { ...prev.image, available_models: updated } };
                    })}
                  />
                ))}
              </div>
              <button
                onClick={() => handleSaveModel('image')}
                disabled={modelSaving === 'image'}
                className={`mt-4 w-full py-2.5 text-white text-xs font-bold rounded-xl cursor-pointer transition-all whitespace-nowrap ${
                  modelSaveSuccess === 'image'
                    ? 'bg-emerald-500'
                    : 'bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50'
                }`}
              >
                {modelSaving === 'image' ? (
                  <><i className="ri-loader-4-line animate-spin mr-1.5" />저장 중...</>
                ) : modelSaveSuccess === 'image' ? (
                  <><i className="ri-checkbox-circle-line mr-1.5" />저장 완료!</>
                ) : (
                  <><i className="ri-save-line mr-1.5" />이미지 모델 설정 저장</>
                )}
              </button>
            </div>
          )}

          {/* Video Models */}
          {modelCategory === 'video' && (
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <i className="ri-star-line text-amber-400 text-xs" />
                <p className={`text-xs font-black ${t.textSub}`}>기본 생성 모델 선택</p>
                <span className={`text-[10px] ${t.textFaint} ml-auto`}>라디오 = 기본값 · 토글 = 사용자 노출</span>
              </div>
              <div className={`${t.cardBg2} rounded-xl border ${t.border} overflow-hidden divide-y ${t.divider}`}>
                {ALL_VIDEO_MODELS.map((model) => {
                  const info = MODEL_LABELS[model];
                  const isActive = settings.video.active_model === model;
                  const isEnabled = settings.video.available_models.includes(model);
                  return (
                    <div key={model} className={`flex items-center gap-3 px-4 py-3 ${t.rowHover} transition-colors`}>
                      <button
                        onClick={() => setSettings((prev) => ({ ...prev, video: { ...prev.video, active_model: model } }))}
                        className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center cursor-pointer transition-all ${
                          isActive ? 'border-violet-500 bg-violet-500' : `${isDark ? 'border-zinc-600' : 'border-gray-300'}`
                        }`}
                      >
                        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${isActive ? 'text-violet-300' : t.text}`}>{info?.name ?? model}</span>
                          {info?.badge && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${BADGE_COLORS[info.badge] ?? 'bg-zinc-700 text-zinc-400'}`}>
                              {info.badge}
                            </span>
                          )}
                          {isActive && <span className="text-[9px] font-bold text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded-full">기본값</span>}
                        </div>
                        <p className={`text-[10px] ${t.textFaint} mt-0.5`}>{info?.desc ?? model}</p>
                      </div>
                      <button
                        onClick={() => setSettings((prev) => {
                          const current = prev.video.available_models;
                          const updated = current.includes(model) ? current.filter((m) => m !== model) : [...current, model];
                          return { ...prev, video: { ...prev.video, available_models: updated } };
                        })}
                        className={`w-9 h-5 rounded-full transition-colors cursor-pointer relative flex-shrink-0 ${isEnabled ? 'bg-violet-500' : isDark ? 'bg-zinc-700' : 'bg-gray-300'}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => handleSaveModel('video')}
                disabled={modelSaving === 'video'}
                className={`mt-4 w-full py-2.5 text-white text-xs font-bold rounded-xl cursor-pointer transition-all whitespace-nowrap ${
                  modelSaveSuccess === 'video' ? 'bg-emerald-500' : 'bg-violet-500 hover:bg-violet-400 disabled:opacity-50'
                }`}
              >
                {modelSaving === 'video' ? (
                  <><i className="ri-loader-4-line animate-spin mr-1.5" />저장 중...</>
                ) : modelSaveSuccess === 'video' ? (
                  <><i className="ri-checkbox-circle-line mr-1.5" />저장 완료!</>
                ) : (
                  <><i className="ri-save-line mr-1.5" />영상 모델 설정 저장</>
                )}
              </button>
            </div>
          )}

          {/* Music Models */}
          {modelCategory === 'music' && (
            <div className="p-5 space-y-4">
              {/* Provider */}
              <div>
                <p className={`text-xs font-black ${t.textSub} mb-3 flex items-center gap-2`}>
                  <i className="ri-server-line text-emerald-400" />음악 생성 API 우선순위
                </p>
                <div className={`${t.cardBg2} rounded-xl border ${t.border} overflow-hidden divide-y ${t.divider}`}>
                  {[
                    { id: 'fal', label: 'fal.ai', desc: 'Stable Audio 모델 사용. 고품질 배경음악 생성', badge: 'Stable Audio', badgeCls: 'bg-indigo-500/15 text-indigo-400', disabled: false },
                    { id: 'suno', label: 'Suno AI', desc: sunoKeyStatus === 'missing' ? 'Suno API 키를 먼저 등록해주세요' : '가사 포함 음악 생성. 보컬 트랙 지원', badge: sunoKeyStatus === 'registered' ? '키 등록됨' : '키 필요', badgeCls: sunoKeyStatus === 'registered' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400', disabled: sunoKeyStatus === 'missing' },
                  ].map((provider) => (
                    <div
                      key={provider.id}
                      className={`flex items-center gap-3 px-4 py-3 ${provider.disabled ? 'opacity-50' : `${t.rowHover} cursor-pointer`} transition-colors`}
                      onClick={() => { if (!provider.disabled) setSettings((prev) => ({ ...prev, music: { ...prev.music, active_provider: provider.id } })); }}
                    >
                      <button
                        className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                          settings.music.active_provider === provider.id ? 'border-emerald-500 bg-emerald-500' : `${isDark ? 'border-zinc-600' : 'border-gray-300'}`
                        }`}
                      >
                        {settings.music.active_provider === provider.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${settings.music.active_provider === provider.id ? 'text-emerald-300' : t.text}`}>{provider.label}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${provider.badgeCls}`}>{provider.badge}</span>
                        </div>
                        <p className={`text-[10px] ${t.textFaint} mt-0.5`}>{provider.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* fal.ai music models */}
              <div>
                <p className={`text-xs font-black ${t.textSub} mb-3 flex items-center gap-2`}>
                  <i className="ri-music-2-line text-emerald-400" />fal.ai 음악 모델
                </p>
                <div className={`${t.cardBg2} rounded-xl border ${t.border} overflow-hidden divide-y ${t.divider}`}>
                  {ALL_FAL_MUSIC_MODELS.map((model) => {
                    const info = MODEL_LABELS[model];
                    const isActive = settings.music.active_model === model;
                    const isEnabled = settings.music.available_fal_models.includes(model);
                    return (
                      <div key={model} className={`flex items-center gap-3 px-4 py-3 ${t.rowHover} transition-colors`}>
                        <button
                          onClick={() => setSettings((prev) => ({ ...prev, music: { ...prev.music, active_model: model } }))}
                          className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center cursor-pointer ${
                            isActive ? 'border-emerald-500 bg-emerald-500' : `${isDark ? 'border-zinc-600' : 'border-gray-300'}`
                          }`}
                        >
                          {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold ${t.text}`}>{info?.name ?? model}</span>
                            {info?.badge && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${BADGE_COLORS[info.badge] ?? 'bg-zinc-700 text-zinc-400'}`}>{info.badge}</span>}
                            {isActive && <span className="text-[9px] font-bold text-emerald-400">기본</span>}
                          </div>
                          <p className={`text-[10px] ${t.textFaint} mt-0.5`}>{info?.desc}</p>
                        </div>
                        <button
                          onClick={() => setSettings((prev) => {
                            const current = prev.music.available_fal_models;
                            const updated = current.includes(model) ? current.filter((m) => m !== model) : [...current, model];
                            return { ...prev, music: { ...prev.music, available_fal_models: updated } };
                          })}
                          className={`w-9 h-5 rounded-full transition-colors cursor-pointer relative flex-shrink-0 ${isEnabled ? 'bg-emerald-500' : isDark ? 'bg-zinc-700' : 'bg-gray-300'}`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Suno fallback */}
              <div className={`flex items-center justify-between px-4 py-3 rounded-xl ${t.cardBg2} border ${t.border}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg ${settings.music.suno_enabled === 'true' ? 'bg-emerald-500/15' : t.inputBg2} flex items-center justify-center`}>
                    <i className={`ri-music-ai-line text-xs ${settings.music.suno_enabled === 'true' ? 'text-emerald-400' : t.textFaint}`} />
                  </div>
                  <div>
                    <p className={`text-xs font-semibold ${t.text}`}>Suno 폴백 활성화</p>
                    <p className={`text-[10px] ${t.textFaint}`}>fal.ai 실패 시 Suno로 자동 전환</p>
                  </div>
                </div>
                <button
                  onClick={() => setSettings((prev) => ({ ...prev, music: { ...prev.music, suno_enabled: prev.music.suno_enabled === 'true' ? 'false' : 'true' } }))}
                  className={`w-9 h-5 rounded-full transition-colors cursor-pointer relative flex-shrink-0 ${settings.music.suno_enabled === 'true' ? 'bg-emerald-500' : isDark ? 'bg-zinc-700' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.music.suno_enabled === 'true' ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <button
                onClick={() => handleSaveModel('music')}
                disabled={modelSaving === 'music'}
                className={`w-full py-2.5 text-white text-xs font-bold rounded-xl cursor-pointer transition-all whitespace-nowrap ${
                  modelSaveSuccess === 'music' ? 'bg-emerald-400' : 'bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50'
                }`}
              >
                {modelSaving === 'music' ? (
                  <><i className="ri-loader-4-line animate-spin mr-1.5" />저장 중...</>
                ) : modelSaveSuccess === 'music' ? (
                  <><i className="ri-checkbox-circle-line mr-1.5" />저장 완료!</>
                ) : (
                  <><i className="ri-save-line mr-1.5" />음악 API 설정 저장</>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SECTION: API 키 관리
      ══════════════════════════════════════════════════════════════ */}
      {section === 'apikeys' && (
        <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
          <div className={`px-5 py-4 border-b ${t.border} flex items-center justify-between`}>
            <div>
              <p className={`text-sm font-black ${t.text}`}>API 키 관리</p>
              <p className={`text-xs ${t.textSub} mt-0.5`}>외부 AI 서비스 API 키 — 암호화 저장, 클라이언트 미노출</p>
            </div>
            <div className="flex items-center gap-3">
              {keysLoading && <i className="ri-loader-4-line animate-spin text-zinc-500 text-sm" />}
              <button onClick={loadApiKeys} className={`w-8 h-8 flex items-center justify-center rounded-xl ${t.inputBg2} hover:opacity-80 cursor-pointer transition-colors`}>
                <i className={`ri-refresh-line text-sm ${t.textSub}`} />
              </button>
            </div>
          </div>

          {/* Summary stats */}
          <div className={`px-5 py-3 border-b ${t.border} grid grid-cols-3 gap-4`}>
            {[
              { label: '등록된 서비스', value: `${apiKeys.filter((k) => k.key_hint).length}/${apiKeys.length}개`, icon: 'ri-key-2-line', color: 'text-amber-400' },
              { label: '7일 총 요청', value: `${totalRequests.toLocaleString()}건`, icon: 'ri-bar-chart-2-line', color: 'text-emerald-400' },
              { label: '7일 크레딧 사용', value: `${totalCreditsUsed.toLocaleString()} CR`, icon: 'ri-coin-line', color: 'text-indigo-400' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  <i className={`${s.icon} ${s.color} text-xs`} />
                  <p className={`text-sm font-black ${t.text}`}>{s.value}</p>
                </div>
                <p className={`text-[10px] ${t.textFaint}`}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* API Key card list */}
          <div className={`divide-y ${t.divider}`}>
            {apiKeys.length === 0 && !keysLoading && (
              <div className={`flex flex-col items-center justify-center py-10 ${t.textFaint}`}>
                <i className="ri-key-2-line text-2xl mb-2" />
                <p className="text-xs">등록된 API 키가 없습니다</p>
              </div>
            )}
            {apiKeys.map((key) => {
              const stats = usageStats[key.service_slug];
              const hasKey = !!key.key_hint;
              const isToggling = togglingSlug === key.service_slug;
              const testState = testStates[key.service_slug] ?? null;
              const isTesting = testState === 'testing';

              // 테스트 결과에 따른 실시간 상태 오버라이드
              const liveStatus = testState === 'success' ? 'active' : testState === 'failed' ? 'error' : key.status;
              const liveCfg = statusConfig[liveStatus] ?? statusConfig.inactive;

              const matchedService: ApiService = apiStatus.find((s) =>
                s.name.toLowerCase().includes(key.service_slug) ||
                key.service_slug.includes(s.name.toLowerCase().split(' ')[0].split('(')[0].trim())
              ) ?? { name: key.service_name, status: key.status, latency: '-', uptime: '-', requests: 0, errors: 0 };

              return (
                <div
                  key={key.id}
                  className={`px-5 py-4 flex items-center gap-4 transition-all ${t.rowHover} group ${
                    testState === 'success' ? isDark ? 'bg-emerald-500/[0.04]' : 'bg-emerald-50/60' :
                    testState === 'failed' ? isDark ? 'bg-red-500/[0.04]' : 'bg-red-50/60' : ''
                  }`}
                >
                  {/* 상태 dot */}
                  {isTesting ? (
                    <div className="w-2 h-2 flex items-center justify-center flex-shrink-0">
                      <i className="ri-loader-4-line animate-spin text-amber-400 text-[10px]" />
                    </div>
                  ) : (
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${liveCfg.dot} ${testState ? 'scale-125 transition-transform' : ''}`} />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className={`text-sm font-semibold ${t.text}`}>{key.service_name}</p>

                      {/* 상태 배지 — 실시간 반영 */}
                      {isTesting ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-500/15 text-amber-400 border-amber-500/25 flex items-center gap-1">
                          <i className="ri-loader-4-line animate-spin text-[9px]" />테스트 중...
                        </span>
                      ) : testState === 'success' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/25 flex items-center gap-1">
                          <i className="ri-checkbox-circle-fill text-[9px]" />연결 성공
                        </span>
                      ) : testState === 'failed' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-500/15 text-red-400 border-red-500/25 flex items-center gap-1">
                          <i className="ri-close-circle-fill text-[9px]" />연결 실패
                        </span>
                      ) : (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${liveCfg.cls}`}>{liveCfg.label}</span>
                      )}

                      {!hasKey && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">키 미등록</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      {hasKey ? (
                        <span className={`text-[11px] font-mono ${t.textFaint}`}>{key.key_hint}</span>
                      ) : (
                        <span className={`text-[11px] ${t.textFaint}`}>API 키를 등록해주세요</span>
                      )}

                      {/* 테스트 결과 실시간 메시지 */}
                      {isTesting ? (
                        <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
                          <i className="ri-loader-4-line animate-spin text-[9px]" />API 서버 연결 확인 중...
                        </span>
                      ) : testState === 'success' && key.test_result ? (
                        <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                          <i className="ri-checkbox-circle-fill text-[9px]" />{key.test_result}
                        </span>
                      ) : testState === 'failed' && key.test_result ? (
                        <span className="text-[10px] text-red-400 font-semibold flex items-center gap-1">
                          <i className="ri-close-circle-fill text-[9px]" />{key.test_result}
                        </span>
                      ) : key.last_tested_at ? (
                        <span className={`text-[10px] ${t.textFaint}`}>
                          마지막 테스트: {new Date(key.last_tested_at).toLocaleString('ko-KR').replace(/\. /g, '.').replace(/\.$/, '')}
                        </span>
                      ) : null}

                      {!testState && key.test_result && (
                        <span className={`text-[10px] ${key.test_result.includes('성공') ? 'text-emerald-400' : 'text-red-400'}`}>
                          {key.test_result}
                        </span>
                      )}
                    </div>

                    {stats && (
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {/* 구분선 */}
                        <span className={`text-[10px] font-semibold ${t.textFaint}`}>7일 생성 요청</span>
                        <span className={`w-px h-3 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
                        {/* 총 건수 */}
                        <span className={`text-[10px] font-mono ${t.textSub}`}>{stats.total}건</span>
                        {/* 성공 */}
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-400">
                          <i className="ri-checkbox-circle-fill text-[9px]" />성공 {stats.success}
                        </span>
                        {/* 실패 — 클릭 시 드릴다운 드로어 오픈 */}
                        {stats.failed > 0 && (
                          <button
                            onClick={() => setFailureDrawer({ open: true, slug: key.service_slug, days: 7 })}
                            className="flex items-center gap-0.5 text-[10px] font-bold text-red-400 cursor-pointer hover:text-red-300 transition-colors group/fail"
                            title="클릭하면 실패 로그 상세 조회"
                          >
                            <i className="ri-close-circle-fill text-[9px]" />
                            생성 실패 {stats.failed}
                            <i className="ri-external-link-line text-[8px] opacity-0 group-hover/fail:opacity-60 ml-0.5 transition-opacity" />
                          </button>
                        )}
                        {/* 성공률 */}
                        {stats.total > 0 && (
                          <>
                            <span className={`w-px h-3 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
                            <span className={`text-[10px] font-bold ${
                              stats.failed === 0 ? 'text-emerald-400' :
                              (stats.success / stats.total) >= 0.9 ? 'text-amber-400' : 'text-red-400'
                            }`}>
                              성공률 {Math.round((stats.success / stats.total) * 100)}%
                            </span>
                          </>
                        )}
                        {/* 크레딧 */}
                        {stats.credits > 0 && (
                          <>
                            <span className={`w-px h-3 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
                            <span className={`text-[10px] ${t.textFaint}`}>
                              <i className="ri-coin-line mr-0.5" />{stats.credits.toLocaleString()} CR 소모
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Monthly usage bar */}
                  {key.monthly_limit > 0 && (
                    <div className="hidden lg:flex flex-col items-end gap-1 w-24 flex-shrink-0">
                      <span className={`text-[10px] ${t.textFaint}`}>{key.monthly_used}/{key.monthly_limit}</span>
                      <div className={`w-full h-1 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'} rounded-full overflow-hidden`}>
                        <div
                          className={`h-full rounded-full ${(key.monthly_used / key.monthly_limit) > 0.8 ? 'bg-red-500' : 'bg-amber-500'}`}
                          style={{ width: `${Math.min(100, (key.monthly_used / key.monthly_limit) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleToggleKeyStatus(key.service_slug, key.status)}
                      disabled={isToggling}
                      className={`w-8 h-4 rounded-full transition-colors cursor-pointer relative flex-shrink-0 disabled:opacity-50 ${liveStatus === 'active' ? 'bg-amber-500' : isDark ? 'bg-zinc-700' : 'bg-gray-300'}`}
                      title={liveStatus === 'active' ? '비활성화' : '활성화'}
                    >
                      {isToggling ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <i className="ri-loader-4-line animate-spin text-white text-[8px]" />
                        </div>
                      ) : (
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${liveStatus === 'active' ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      )}
                    </button>

                    {/* 테스트 버튼 */}
                    {hasKey && (
                      <button
                        onClick={() => handleTestKey(key.service_slug)}
                        disabled={isTesting}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all whitespace-nowrap flex-shrink-0 disabled:cursor-not-allowed ${
                          testState === 'success'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                            : testState === 'failed'
                            ? 'bg-red-500/15 text-red-400 border border-red-500/25'
                            : isTesting
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25 opacity-70'
                            : isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {isTesting ? (
                          <><i className="ri-loader-4-line animate-spin mr-1" />테스트 중</>
                        ) : testState === 'success' ? (
                          <><i className="ri-checkbox-circle-fill mr-1" />성공</>
                        ) : testState === 'failed' ? (
                          <><i className="ri-close-circle-fill mr-1" />실패</>
                        ) : (
                          <><i className="ri-wifi-line mr-1" />테스트</>
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => setApiKeyModal({ service: matchedService, mode: 'renew', slug: key.service_slug })}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                        hasKey
                          ? `${t.inputBg2} ${t.textSub} hover:opacity-80`
                          : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/25'
                      }`}
                    >
                      {hasKey ? '키 갱신' : '키 등록'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* API Status table */}
          <div className={`border-t ${t.border}`}>
            <div className={`px-5 py-3 border-b ${t.border} flex items-center justify-between`}>
              <p className={`text-xs font-black ${t.textSub}`}>실시간 API 서버 상태</p>
              {apiHealthLoading && <i className="ri-loader-4-line animate-spin text-zinc-500 text-sm" />}
            </div>
            <div className={`divide-y ${t.divider}`}>
              {apiStatus.map((api) => {
                let dbData: { requests_24h: number; requests_today: number; requests_1h: number; error_rate: number; status: string } | undefined;
                if (api.name.includes('이미지')) dbData = apiHealthData?.image;
                else if (api.name.includes('영상')) dbData = apiHealthData?.video;
                else if (api.name.includes('TTS') || api.name.includes('ElevenLabs') || api.name.includes('Suno') || api.name.includes('LALAL')) dbData = apiHealthData?.audio;
                const realStatus = dbData?.status ?? api.status;

                return (
                  <div key={api.name} className={`px-5 py-3 flex items-center gap-3 ${t.rowHover} transition-colors group`}>
                    <StatusDot status={realStatus} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${t.text}`}>{api.name}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                          realStatus === 'normal' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' :
                          realStatus === 'warning' ? 'bg-amber-500/15 text-amber-400 border-amber-500/25' :
                          'bg-red-500/15 text-red-400 border-red-500/25'
                        }`}>
                          {realStatus === 'normal' ? '정상' : realStatus === 'warning' ? '경고' : '오류'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className={`text-[10px] font-mono ${t.textFaint}`}>{api.latency}</span>
                        <span className={`text-[10px] font-bold ${parseFloat(api.uptime) >= 99.9 ? 'text-emerald-400' : 'text-amber-400'}`}>{api.uptime}</span>
                        {dbData?.requests_today !== undefined && (
                          <span className={`text-[10px] ${t.textFaint}`}>오늘 {dbData.requests_today.toLocaleString()}건 <span className="text-emerald-400">실시간</span></span>
                        )}
                        {dbData?.error_rate !== undefined && dbData.error_rate > 0 && (
                          <span className={`text-[10px] ${dbData.error_rate > 5 ? 'text-red-400' : 'text-amber-400'}`}>에러율 {dbData.error_rate}%</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setApiKeyModal({ service: api, mode: 'renew' })}
                        className={`px-2.5 py-1 rounded-lg ${t.inputBg2} hover:opacity-80 ${t.textSub} text-[10px] font-semibold cursor-pointer transition-colors whitespace-nowrap`}
                      >
                        키 갱신
                      </button>
                      <button
                        onClick={() => setApiKeyModal({ service: api, mode: 'settings' })}
                        className={`px-2.5 py-1 rounded-lg ${t.inputBg2} hover:opacity-80 ${t.textSub} text-[10px] font-semibold cursor-pointer transition-colors whitespace-nowrap`}
                      >
                        설정
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Security notice */}
          <div className={`px-5 py-3 border-t ${t.border} flex items-center gap-2 bg-amber-500/5`}>
            <i className="ri-flashlight-line text-amber-400 text-xs flex-shrink-0" />
            <p className={`text-[10px] ${t.textFaint}`}>
              fal.ai 키가 등록되면 이미지·영상·TTS·음악·SFX·전사 모두 fal.ai를 우선 사용합니다.
              <a href="https://fal.ai/dashboard" target="_blank" rel="noopener noreferrer" className="ml-1 text-amber-400 underline">fal.ai 대시보드 →</a>
            </p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SECTION: 크레딧 비용 & 알림
      ══════════════════════════════════════════════════════════════ */}
      {section === 'credits' && (
        <div className="space-y-4">
          <CreditCostPanel isDark={isDark} onSave={(msg) => onToast(msg, 'success')} />
          <CreditAlertPanel isDark={isDark} onToast={(msg, type) => onToast(msg, type ?? 'success')} />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SECTION: 프롬프트 템플릿
      ══════════════════════════════════════════════════════════════ */}
      {section === 'prompts' && (
        <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
          <div className={`px-5 py-4 border-b ${t.border} flex items-center justify-between`}>
            <div>
              <p className={`text-sm font-black ${t.text}`}>프롬프트 템플릿 관리</p>
              <p className={`text-xs ${t.textSub} mt-0.5`}>마스터 프롬프트 파라미터 최적화</p>
            </div>
            <button
              onClick={() => onPromptEdit(null)}
              className="flex items-center gap-1.5 bg-violet-500 hover:bg-violet-400 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-add-line text-xs" />새 템플릿
            </button>
          </div>

          {/* Stats row */}
          <div className={`px-5 py-3 border-b ${t.border} grid grid-cols-3 gap-4`}>
            {[
              { label: '전체 템플릿', value: `${promptTemplates.length}개`, icon: 'ri-code-s-slash-line', color: 'text-violet-400' },
              { label: '활성 템플릿', value: `${promptTemplates.filter((p) => p.active).length}개`, icon: 'ri-checkbox-circle-line', color: 'text-emerald-400' },
              { label: '총 사용 횟수', value: `${promptTemplates.reduce((a, p) => a + p.usageCount, 0).toLocaleString()}회`, icon: 'ri-bar-chart-2-line', color: 'text-amber-400' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  <i className={`${s.icon} ${s.color} text-xs`} />
                  <p className={`text-sm font-black ${t.text}`}>{s.value}</p>
                </div>
                <p className={`text-[10px] ${t.textFaint}`}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Template card list */}
          <div className={`divide-y ${t.divider}`}>
            {promptTemplates.length === 0 && (
              <div className={`flex flex-col items-center justify-center py-12 ${t.textFaint}`}>
                <i className="ri-code-s-slash-line text-2xl mb-2" />
                <p className="text-xs">등록된 템플릿이 없습니다</p>
                <button
                  onClick={() => onPromptEdit(null)}
                  className="mt-3 px-3 py-1.5 bg-violet-500 hover:bg-violet-400 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                >
                  첫 템플릿 만들기
                </button>
              </div>
            )}
            {promptTemplates.map((pt) => {
              const catColors: Record<string, string> = {
                '영상': 'bg-red-500/15 text-red-400',
                '음악': 'bg-emerald-500/15 text-emerald-400',
                '이미지': 'bg-indigo-500/15 text-indigo-400',
                '음성': 'bg-amber-500/15 text-amber-400',
                '텍스트': 'bg-violet-500/15 text-violet-400',
              };
              return (
                <div key={pt.id} className={`px-5 py-4 flex items-center gap-4 ${t.rowHover} transition-colors group`}>
                  <div className={`w-9 h-9 rounded-xl ${pt.active ? 'bg-violet-500/10' : t.inputBg2} flex items-center justify-center flex-shrink-0`}>
                    <i className={`ri-code-s-slash-line text-sm ${pt.active ? 'text-violet-400' : t.textFaint}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className={`text-sm font-semibold ${t.text}`}>{pt.name}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${catColors[pt.category] ?? 'bg-zinc-700 text-zinc-400'}`}>{pt.category}</span>
                      <span className={`text-[9px] ${t.inputBg2} ${t.textFaint} px-1.5 py-0.5 rounded-full`}>{pt.model}</span>
                      {!pt.active && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-700/60 text-zinc-500">비활성</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] ${t.textFaint}`}>사용 {pt.usageCount.toLocaleString()}회</span>
                      <span className={`text-[10px] ${t.textFaint}`}>수정 {pt.lastUpdated}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => onPromptToggle(pt.id)}
                      className={`w-8 h-4 rounded-full transition-colors cursor-pointer relative ${pt.active ? 'bg-violet-500' : isDark ? 'bg-zinc-700' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${pt.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    <button
                      onClick={() => onPromptEdit(pt)}
                      className={`w-7 h-7 rounded-lg ${t.inputBg2} hover:opacity-80 flex items-center justify-center cursor-pointer transition-colors opacity-0 group-hover:opacity-100`}
                    >
                      <i className={`ri-edit-line ${t.textSub} text-xs`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SECTION: GPU & 서버 (실시간 시뮬레이션)
      ══════════════════════════════════════════════════════════════ */}
      {section === 'gpu' && (
        <div className="space-y-4">
          {/* Live indicator */}
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${t.border} ${isDark ? 'bg-zinc-800/40' : 'bg-gray-50'}`}>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className={`text-xs font-semibold ${t.textSub}`}>실시간 모니터링 중 — 2초마다 갱신</span>
            <span className={`text-[10px] ${t.textFaint} ml-auto`}>마지막 갱신: 방금 전</span>
          </div>

          {/* GPU Cards */}
          <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
            <div className={`px-5 py-4 border-b ${t.border}`}>
              <p className={`text-sm font-black ${t.text}`}>GPU 자원 할당 & 부하 분산</p>
              <p className={`text-xs ${t.textSub} mt-0.5`}>인스턴스별 실시간 현황</p>
            </div>
            <div className={`divide-y ${t.divider}`}>
              {GPU_INSTANCES.map((gpu, i) => {
                const live = gpuLoads[i];
                const isWarning = live.load > 80 || live.mem > 85;
                return (
                  <div key={gpu.name} className={`px-5 py-4 flex items-center gap-4 ${t.rowHover} transition-colors`}>
                    <div className={`w-9 h-9 rounded-xl ${isWarning ? 'bg-amber-500/10' : gpu.bg} flex items-center justify-center flex-shrink-0`}>
                      <i className={`${gpu.icon} text-sm ${isWarning ? 'text-amber-400' : gpu.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-semibold ${t.text}`}>{gpu.name}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          isWarning ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'
                        }`}>
                          {isWarning ? '경고' : '정상'}
                        </span>
                        <span className={`text-[10px] ${t.textFaint} ml-auto`}>{live.tasks}개 작업 처리 중</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className={`text-[10px] ${t.textFaint}`}>GPU 부하</span>
                            <span className={`text-[10px] font-bold ${live.load > 80 ? 'text-amber-400' : t.textSub}`}>{live.load}%</span>
                          </div>
                          <div className={`h-1.5 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'} rounded-full overflow-hidden`}>
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${live.load > 80 ? 'bg-amber-500' : gpu.color}`}
                              style={{ width: `${live.load}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className={`text-[10px] ${t.textFaint}`}>VRAM</span>
                            <span className={`text-[10px] font-bold ${live.mem > 85 ? 'text-red-400' : t.textSub}`}>{live.mem}%</span>
                          </div>
                          <div className={`h-1.5 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'} rounded-full overflow-hidden`}>
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${live.mem > 85 ? 'bg-red-500' : 'bg-violet-500'}`}
                              style={{ width: `${live.mem}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* API Health Summary */}
          <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
            <div className={`px-5 py-4 border-b ${t.border} flex items-center justify-between`}>
              <div>
                <p className={`text-sm font-black ${t.text}`}>API 요청 통계 (오늘)</p>
                <p className={`text-xs ${t.textSub} mt-0.5`}>카테고리별 실시간 처리 현황</p>
              </div>
              {apiHealthLoading && <i className="ri-loader-4-line animate-spin text-zinc-500 text-sm" />}
            </div>
            <div className={`divide-y ${t.divider}`}>
              {[
                { label: '이미지 생성', data: apiHealthData?.image, icon: 'ri-image-ai-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                { label: '영상 생성', data: apiHealthData?.video, icon: 'ri-video-ai-line', color: 'text-violet-400', bg: 'bg-violet-500/10' },
                { label: '오디오 (TTS/SFX/음악)', data: apiHealthData?.audio, icon: 'ri-music-2-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              ].map((item) => (
                <div key={item.label} className={`px-5 py-4 flex items-center gap-4 ${t.rowHover} transition-colors`}>
                  <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center flex-shrink-0`}>
                    <i className={`${item.icon} ${item.color} text-sm`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${t.text} mb-1`}>{item.label}</p>
                    {item.data ? (
                      <div className="flex items-center gap-4 flex-wrap">
                        <span className={`text-[10px] ${t.textFaint}`}>오늘 <span className={`font-bold ${t.textSub}`}>{item.data.requests_today.toLocaleString()}건</span></span>
                        <span className={`text-[10px] ${t.textFaint}`}>1시간 <span className={`font-bold ${t.textSub}`}>{item.data.requests_1h.toLocaleString()}건</span></span>
                        <span className={`text-[10px] ${item.data.error_rate > 5 ? 'text-red-400' : item.data.error_rate > 2 ? 'text-amber-400' : t.textFaint}`}>
                          에러율 {item.data.error_rate}%
                        </span>
                      </div>
                    ) : (
                      <span className={`text-[10px] ${t.textFaint}`}>{apiHealthLoading ? '로딩 중...' : '데이터 없음 (usage_logs 기록 없음)'}</span>
                    )}
                  </div>
                  {item.data && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      item.data.status === 'normal' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                    }`}>
                      {item.data.status === 'normal' ? '정상' : '주의'}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {apiHealthData?.total_requests_today !== undefined && (
              <div className={`px-5 py-3 border-t ${t.border} flex items-center gap-2`}>
                <i className="ri-bar-chart-2-line text-indigo-400 text-xs" />
                <span className={`text-[11px] ${t.textFaint}`}>
                  오늘 총 요청: <span className={`font-black ${t.text}`}>{apiHealthData.total_requests_today.toLocaleString()}건</span>
                  {apiHealthData.total_requests_1h !== undefined && (
                    <span className="ml-2">최근 1시간: <span className={`font-bold ${t.textSub}`}>{apiHealthData.total_requests_1h.toLocaleString()}건</span></span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SECTION: 헬스체크 스케줄러
      ══════════════════════════════════════════════════════════════ */}
      {section === 'healthcheck' && (
        <HealthCheckScheduler isDark={isDark} onToast={onToast} />
      )}

      {/* ══════════════════════════════════════════════════════════════
          SECTION: fal.ai 모델 카탈로그
      ══════════════════════════════════════════════════════════════ */}
      {section === 'falkeys' && (
        <FalKeyManagerPanel
          isDark={isDark}
          onToast={onToast}
        />
      )}

      {section === 'catalog' && (
        <FalModelCatalog
          isDark={isDark}
          onToast={onToast}
          onSelectModel={(endpointId, category) => {
            // 선택한 모델을 AI 모델 설정에 적용 후 해당 섹션으로 이동
            setSettings((prev) => {
              if (category === 'image') {
                const alreadyIn = prev.image.available_models.includes(endpointId);
                return {
                  ...prev,
                  image: {
                    active_model: endpointId,
                    available_models: alreadyIn ? prev.image.available_models : [...prev.image.available_models, endpointId],
                  },
                };
              }
              if (category === 'video') {
                const alreadyIn = prev.video.available_models.includes(endpointId);
                return {
                  ...prev,
                  video: {
                    active_model: endpointId,
                    available_models: alreadyIn ? prev.video.available_models : [...prev.video.available_models, endpointId],
                  },
                };
              }
              if (category === 'music') {
                return {
                  ...prev,
                  music: { ...prev.music, active_model: endpointId },
                };
              }
              return prev;
            });
            setSection('model');
            setModelCategory(category);
            onToast(`${endpointId} → AI 모델 설정에 적용됐어요. 저장 버튼을 눌러주세요!`, 'success');
          }}
        />
      )}

      {/* ── API Key Modal ── */}
      {apiKeyModal && (
        <ApiKeyModal
          service={apiKeyModal.service}
          mode={apiKeyModal.mode}
          onClose={() => setApiKeyModal(null)}
          onSave={handleApiKeySaved}
          isDark={isDark}
        />
      )}

      {/* ── Failure Logs Drawer ── */}
      <FailureLogsDrawer
        isDark={isDark}
        isOpen={failureDrawer.open}
        onClose={() => setFailureDrawer((prev) => ({ ...prev, open: false }))}
        initialSlug={failureDrawer.slug}
        initialDays={failureDrawer.days}
      />
    </div>
  );
}
