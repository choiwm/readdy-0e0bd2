import { useState, useEffect, useCallback } from 'react';
import { getAuthorizationHeader } from '@/lib/env';

interface ModelSettings {
  image: {
    active_model: string;
    available_models: string[];
  };
  video: {
    active_model: string;
    available_models: string[];
  };
  music: {
    active_provider: string;
    active_model: string;
    available_fal_models: string[];
    suno_enabled: string;
  };
}

interface Props {
  isDark: boolean;
  onSave: (msg: string) => void;
}

// 모델 표시명 매핑
const MODEL_LABELS: Record<string, { name: string; badge: string; desc: string }> = {
  // Image models
  'fal-ai/flux/schnell':          { name: 'FLUX Schnell',       badge: '빠름',    desc: '가장 빠른 생성, 기본 품질' },
  'fal-ai/flux/dev':              { name: 'FLUX Dev',           badge: '균형',    desc: '속도와 품질의 균형' },
  'fal-ai/flux-pro':              { name: 'FLUX Pro',           badge: '고품질',  desc: '높은 품질, 상업용' },
  'fal-ai/flux-pro/v1.1':         { name: 'FLUX Pro v1.1',      badge: '고품질',  desc: '개선된 Pro 버전' },
  'fal-ai/flux-pro/v1.1-ultra':   { name: 'FLUX Pro Ultra',     badge: '최고품질', desc: '최고 품질, 느린 속도' },
  'fal-ai/stable-diffusion-v3-medium': { name: 'SD v3 Medium', badge: '범용',    desc: 'Stable Diffusion v3' },
  // Video models
  'fal-ai/kling-video/v1/standard/text-to-video':   { name: 'Kling v1 Standard', badge: '기본',    desc: '기본 영상 생성' },
  'fal-ai/kling-video/v1.5/pro/text-to-video':      { name: 'Kling v1.5 Pro',    badge: '고품질',  desc: '향상된 품질' },
  'fal-ai/kling-video/v2.1/standard/text-to-video': { name: 'Kling v2.1 Standard', badge: '최신',  desc: '최신 표준 모델' },
  'fal-ai/kling-video/v2.1/pro/text-to-video':      { name: 'Kling v2.1 Pro',    badge: '최고',    desc: '최신 최고 품질' },
  'fal-ai/minimax-video/image-to-video':            { name: 'MiniMax Video',      badge: '대안',    desc: 'MiniMax 영상 모델' },
  'fal-ai/wan-t2v':                                 { name: 'WAN T2V',            badge: '대안',    desc: 'WAN 텍스트→영상' },
  // Music models
  'fal-ai/stable-audio':  { name: 'Stable Audio',  badge: 'fal.ai', desc: '고품질 음악 생성' },
  'fal-ai/musicgen':      { name: 'MusicGen',       badge: 'fal.ai', desc: 'Meta MusicGen' },
  'suno':                 { name: 'Suno AI',        badge: 'Suno',   desc: '가사 포함 음악 생성' },
};

const BADGE_COLORS: Record<string, string> = {
  '빠름':    'bg-emerald-500/15 text-emerald-400',
  '균형':    'bg-indigo-500/15 text-indigo-400',
  '고품질':  'bg-amber-500/15 text-amber-400',
  '최고품질':'bg-red-500/15 text-red-400',
  '최고':    'bg-red-500/15 text-red-400',
  '최신':    'bg-violet-500/15 text-violet-400',
  '범용':    'bg-zinc-500/15 text-zinc-400',
  '기본':    'bg-zinc-500/15 text-zinc-400',
  '대안':    'bg-cyan-500/15 text-cyan-400',
  'fal.ai':  'bg-indigo-500/15 text-indigo-400',
  'Suno':    'bg-emerald-500/15 text-emerald-400',
};

const DEFAULT_SETTINGS: ModelSettings = {
  image: {
    active_model: 'fal-ai/flux/dev',
    available_models: [
      'fal-ai/flux/schnell',
      'fal-ai/flux/dev',
      'fal-ai/flux-pro',
      'fal-ai/flux-pro/v1.1',
      'fal-ai/flux-pro/v1.1-ultra',
      'fal-ai/stable-diffusion-v3-medium',
    ],
  },
  video: {
    active_model: 'fal-ai/kling-video/v1/standard/text-to-video',
    available_models: [
      'fal-ai/kling-video/v1/standard/text-to-video',
      'fal-ai/kling-video/v1.5/pro/text-to-video',
      'fal-ai/kling-video/v2.1/standard/text-to-video',
      'fal-ai/kling-video/v2.1/pro/text-to-video',
      'fal-ai/minimax-video/image-to-video',
      'fal-ai/wan-t2v',
    ],
  },
  music: {
    active_provider: 'fal',
    active_model: 'fal-ai/stable-audio',
    available_fal_models: ['fal-ai/stable-audio', 'fal-ai/musicgen'],
    suno_enabled: 'true',
  },
};

export default function ModelSettingsPanel({ isDark, onSave }: Props) {
  const [settings, setSettings] = useState<ModelSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'image' | 'video' | 'music'>('image');
  const [sunoKeyStatus, setSunoKeyStatus] = useState<'unknown' | 'registered' | 'missing'>('unknown');

  const t = {
    cardBg:    isDark ? 'bg-[#0f0f13]'   : 'bg-white',
    cardBg2:   isDark ? 'bg-zinc-900/60'  : 'bg-gray-50',
    border:    isDark ? 'border-white/5'  : 'border-gray-200',
    text:      isDark ? 'text-white'      : 'text-gray-900',
    textSub:   isDark ? 'text-zinc-400'   : 'text-gray-500',
    textFaint: isDark ? 'text-zinc-600'   : 'text-gray-400',
    inputBg2:  isDark ? 'bg-zinc-800'     : 'bg-gray-100',
    divider:   isDark ? 'divide-white/[0.03]' : 'divide-gray-100',
  };

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const base = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-api-keys`;
      const headers = { 'Authorization': getAuthorizationHeader() };

      const [settingsRes, keysRes] = await Promise.allSettled([
        fetch(`${base}?action=get_model_settings`, { headers }),
        fetch(`${base}?action=list`, { headers }),
      ]);

      if (settingsRes.status === 'fulfilled') {
        const data = await settingsRes.value.json();
        if (data.settings) {
          const s = data.settings;
          setSettings({
            image: {
              active_model: s.image?.active_model ?? DEFAULT_SETTINGS.image.active_model,
              available_models: s.image?.available_models
                ? JSON.parse(s.image.available_models)
                : DEFAULT_SETTINGS.image.available_models,
            },
            video: {
              active_model: s.video?.active_model ?? DEFAULT_SETTINGS.video.active_model,
              available_models: s.video?.available_models
                ? JSON.parse(s.video.available_models)
                : DEFAULT_SETTINGS.video.available_models,
            },
            music: {
              active_provider: s.music?.active_provider ?? 'fal',
              active_model: s.music?.active_model ?? 'fal-ai/stable-audio',
              available_fal_models: s.music?.available_fal_models
                ? JSON.parse(s.music.available_fal_models)
                : DEFAULT_SETTINGS.music.available_fal_models,
              suno_enabled: s.music?.suno_enabled ?? 'true',
            },
          });
        }
      }

      if (keysRes.status === 'fulfilled') {
        const data = await keysRes.value.json();
        const sunoKey = (data.api_keys ?? []).find((k: { service_slug: string; key_hint: string | null }) => k.service_slug === 'suno');
        setSunoKeyStatus(sunoKey?.key_hint ? 'registered' : 'missing');
      }
    } catch (e) {
      console.warn('Model settings load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveSection = async (category: 'image' | 'video' | 'music') => {
    setSaving(category);
    try {
      const base = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-api-keys`;
      const headers = {
        'Authorization': getAuthorizationHeader(),
        'Content-Type': 'application/json',
      };

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
      } else if (category === 'music') {
        settingsToSave = {
          active_provider: settings.music.active_provider,
          active_model: settings.music.active_model,
          available_fal_models: JSON.stringify(settings.music.available_fal_models),
          suno_enabled: settings.music.suno_enabled,
        };
      }

      const res = await fetch(`${base}?action=save_model_settings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ category, settings: settingsToSave }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const labels = { image: '이미지', video: '영상', music: '음악' };
      onSave(`${labels[category]} 모델 설정이 저장됐습니다`);
    } catch (e) {
      console.error('Save model settings failed:', e);
      onSave(`저장 실패: ${String(e)}`);
    } finally {
      setSaving(null);
    }
  };

  const toggleAvailableModel = (category: 'image' | 'video', model: string) => {
    setSettings((prev) => {
      const current = prev[category].available_models;
      const updated = current.includes(model)
        ? current.filter((m) => m !== model)
        : [...current, model];
      return { ...prev, [category]: { ...prev[category], available_models: updated } };
    });
  };

  const toggleFalMusicModel = (model: string) => {
    setSettings((prev) => {
      const current = prev.music.available_fal_models;
      const updated = current.includes(model)
        ? current.filter((m) => m !== model)
        : [...current, model];
      return { ...prev, music: { ...prev.music, available_fal_models: updated } };
    });
  };

  const ALL_IMAGE_MODELS = [
    'fal-ai/flux/schnell',
    'fal-ai/flux/dev',
    'fal-ai/flux-pro',
    'fal-ai/flux-pro/v1.1',
    'fal-ai/flux-pro/v1.1-ultra',
    'fal-ai/stable-diffusion-v3-medium',
  ];

  const ALL_VIDEO_MODELS = [
    'fal-ai/kling-video/v1/standard/text-to-video',
    'fal-ai/kling-video/v1.5/pro/text-to-video',
    'fal-ai/kling-video/v2.1/standard/text-to-video',
    'fal-ai/kling-video/v2.1/pro/text-to-video',
    'fal-ai/minimax-video/image-to-video',
    'fal-ai/wan-t2v',
  ];

  const ALL_FAL_MUSIC_MODELS = ['fal-ai/stable-audio', 'fal-ai/musicgen'];

  const sections = [
    { id: 'image' as const, label: '이미지 모델', icon: 'ri-image-ai-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { id: 'video' as const, label: '영상 모델', icon: 'ri-video-ai-line', color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { id: 'music' as const, label: '음악 API', icon: 'ri-music-2-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ];

  return (
    <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
      {/* Header */}
      <div className={`px-5 py-4 border-b ${t.border} flex items-center justify-between`}>
        <div>
          <p className={`text-sm font-black ${t.text}`}>AI 모델 설정</p>
          <p className={`text-xs ${t.textSub} mt-0.5`}>이미지·영상·음악 생성에 사용할 모델 및 API 선택</p>
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

      {/* Section Tabs */}
      <div className={`px-5 py-3 border-b ${t.border} flex items-center gap-2`}>
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap border ${
              activeSection === s.id
                ? `${s.bg} ${s.color} border-current/20`
                : `${t.inputBg2} ${t.textSub} border-transparent hover:opacity-80`
            }`}
          >
            <i className={`${s.icon} text-sm`} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Image Section */}
      {activeSection === 'image' && (
        <div className="p-5 space-y-5">
          {/* Active Model */}
          <div>
            <p className={`text-xs font-black ${t.textSub} mb-3 flex items-center gap-2`}>
              <i className="ri-star-line text-amber-400" />
              기본 생성 모델 (사용자가 모델 미선택 시 사용)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_IMAGE_MODELS.map((model) => {
                const info = MODEL_LABELS[model];
                const isActive = settings.image.active_model === model;
                return (
                  <button
                    key={model}
                    onClick={() => setSettings((prev) => ({ ...prev, image: { ...prev.image, active_model: model } }))}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all text-left ${
                      isActive
                        ? 'bg-indigo-500/10 border-indigo-500/30'
                        : `${t.cardBg2} ${t.border} hover:border-indigo-500/20`
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                      isActive ? 'border-indigo-500 bg-indigo-500' : `${isDark ? 'border-zinc-600' : 'border-gray-300'}`
                    }`}>
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs font-semibold ${isActive ? 'text-indigo-300' : t.text}`}>{info?.name ?? model}</span>
                        {info?.badge && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${BADGE_COLORS[info.badge] ?? 'bg-zinc-700 text-zinc-400'}`}>
                            {info.badge}
                          </span>
                        )}
                      </div>
                      <p className={`text-[10px] ${t.textFaint} truncate`}>{info?.desc ?? model}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Available Models Toggle */}
          <div>
            <p className={`text-xs font-black ${t.textSub} mb-3 flex items-center gap-2`}>
              <i className="ri-list-check-3 text-indigo-400" />
              사용자에게 노출할 모델 선택
            </p>
            <div className="space-y-2">
              {ALL_IMAGE_MODELS.map((model) => {
                const info = MODEL_LABELS[model];
                const isEnabled = settings.image.available_models.includes(model);
                return (
                  <div key={model} className={`flex items-center justify-between p-3 rounded-xl ${t.cardBg2} border ${t.border}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isEnabled ? 'bg-indigo-500/15' : t.inputBg2}`}>
                        <i className={`ri-image-ai-line text-xs ${isEnabled ? 'text-indigo-400' : t.textFaint}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${t.text}`}>{info?.name ?? model}</span>
                          {info?.badge && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${BADGE_COLORS[info.badge] ?? 'bg-zinc-700 text-zinc-400'}`}>
                              {info.badge}
                            </span>
                          )}
                        </div>
                        <p className={`text-[10px] ${t.textFaint}`}>{info?.desc}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleAvailableModel('image', model)}
                      className={`w-9 h-5 rounded-full transition-colors cursor-pointer relative flex-shrink-0 ${isEnabled ? 'bg-indigo-500' : isDark ? 'bg-zinc-700' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => handleSaveSection('image')}
            disabled={saving === 'image'}
            className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
          >
            {saving === 'image' ? (
              <><i className="ri-loader-4-line animate-spin mr-1.5" />저장 중...</>
            ) : (
              <><i className="ri-save-line mr-1.5" />이미지 모델 설정 저장</>
            )}
          </button>
        </div>
      )}

      {/* Video Section */}
      {activeSection === 'video' && (
        <div className="p-5 space-y-5">
          {/* Active Model */}
          <div>
            <p className={`text-xs font-black ${t.textSub} mb-3 flex items-center gap-2`}>
              <i className="ri-star-line text-amber-400" />
              기본 생성 모델
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_VIDEO_MODELS.map((model) => {
                const info = MODEL_LABELS[model];
                const isActive = settings.video.active_model === model;
                return (
                  <button
                    key={model}
                    onClick={() => setSettings((prev) => ({ ...prev, video: { ...prev.video, active_model: model } }))}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all text-left ${
                      isActive
                        ? 'bg-violet-500/10 border-violet-500/30'
                        : `${t.cardBg2} ${t.border} hover:border-violet-500/20`
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                      isActive ? 'border-violet-500 bg-violet-500' : `${isDark ? 'border-zinc-600' : 'border-gray-300'}`
                    }`}>
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs font-semibold ${isActive ? 'text-violet-300' : t.text}`}>{info?.name ?? model}</span>
                        {info?.badge && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${BADGE_COLORS[info.badge] ?? 'bg-zinc-700 text-zinc-400'}`}>
                            {info.badge}
                          </span>
                        )}
                      </div>
                      <p className={`text-[10px] ${t.textFaint} truncate`}>{info?.desc ?? model}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Available Models Toggle */}
          <div>
            <p className={`text-xs font-black ${t.textSub} mb-3 flex items-center gap-2`}>
              <i className="ri-list-check-3 text-violet-400" />
              사용자에게 노출할 모델 선택
            </p>
            <div className="space-y-2">
              {ALL_VIDEO_MODELS.map((model) => {
                const info = MODEL_LABELS[model];
                const isEnabled = settings.video.available_models.includes(model);
                return (
                  <div key={model} className={`flex items-center justify-between p-3 rounded-xl ${t.cardBg2} border ${t.border}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isEnabled ? 'bg-violet-500/15' : t.inputBg2}`}>
                        <i className={`ri-video-ai-line text-xs ${isEnabled ? 'text-violet-400' : t.textFaint}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${t.text}`}>{info?.name ?? model}</span>
                          {info?.badge && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${BADGE_COLORS[info.badge] ?? 'bg-zinc-700 text-zinc-400'}`}>
                              {info.badge}
                            </span>
                          )}
                        </div>
                        <p className={`text-[10px] ${t.textFaint}`}>{info?.desc}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleAvailableModel('video', model)}
                      className={`w-9 h-5 rounded-full transition-colors cursor-pointer relative flex-shrink-0 ${isEnabled ? 'bg-violet-500' : isDark ? 'bg-zinc-700' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => handleSaveSection('video')}
            disabled={saving === 'video'}
            className="w-full py-2.5 bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
          >
            {saving === 'video' ? (
              <><i className="ri-loader-4-line animate-spin mr-1.5" />저장 중...</>
            ) : (
              <><i className="ri-save-line mr-1.5" />영상 모델 설정 저장</>
            )}
          </button>
        </div>
      )}

      {/* Music Section */}
      {activeSection === 'music' && (
        <div className="p-5 space-y-5">
          {/* Provider Selection */}
          <div>
            <p className={`text-xs font-black ${t.textSub} mb-3 flex items-center gap-2`}>
              <i className="ri-server-line text-emerald-400" />
              음악 생성 API 우선순위
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* fal.ai */}
              <button
                onClick={() => setSettings((prev) => ({ ...prev, music: { ...prev.music, active_provider: 'fal' } }))}
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all text-left ${
                  settings.music.active_provider === 'fal'
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : `${t.cardBg2} ${t.border} hover:border-emerald-500/20`
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
                  settings.music.active_provider === 'fal' ? 'border-emerald-500 bg-emerald-500' : `${isDark ? 'border-zinc-600' : 'border-gray-300'}`
                }`}>
                  {settings.music.active_provider === 'fal' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold ${settings.music.active_provider === 'fal' ? 'text-emerald-300' : t.text}`}>fal.ai</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400">Stable Audio</span>
                  </div>
                  <p className={`text-[10px] ${t.textFaint}`}>fal.ai Stable Audio 모델 사용. 고품질 배경음악 생성에 적합</p>
                </div>
              </button>

              {/* Suno */}
              <button
                onClick={() => {
                  if (sunoKeyStatus === 'missing') return;
                  setSettings((prev) => ({ ...prev, music: { ...prev.music, active_provider: 'suno' } }));
                }}
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all text-left ${
                  settings.music.active_provider === 'suno'
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : sunoKeyStatus === 'missing'
                    ? `${t.cardBg2} border-dashed ${t.border} opacity-60`
                    : `${t.cardBg2} ${t.border} hover:border-emerald-500/20`
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
                  settings.music.active_provider === 'suno' ? 'border-emerald-500 bg-emerald-500' : `${isDark ? 'border-zinc-600' : 'border-gray-300'}`
                }`}>
                  {settings.music.active_provider === 'suno' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold ${settings.music.active_provider === 'suno' ? 'text-emerald-300' : t.text}`}>Suno AI</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      sunoKeyStatus === 'registered' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                    }`}>
                      {sunoKeyStatus === 'registered' ? '키 등록됨' : '키 필요'}
                    </span>
                  </div>
                  <p className={`text-[10px] ${t.textFaint}`}>
                    {sunoKeyStatus === 'missing'
                      ? 'Suno API 키를 먼저 등록해주세요'
                      : '가사 포함 음악 생성. 보컬 트랙 지원'}
                  </p>
                </div>
              </button>
            </div>

            {/* Suno key missing notice */}
            {sunoKeyStatus === 'missing' && (
              <div className="mt-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-start gap-2">
                <i className="ri-key-2-line text-amber-400 text-sm flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-amber-400 mb-0.5">Suno API 키 미등록</p>
                  <p className={`text-[10px] ${t.textFaint}`}>
                    위 API 키 관리 패널에서 &apos;Suno (음악)&apos; 키를 등록하면 Suno를 기본 음악 API로 사용할 수 있습니다.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* fal.ai Music Model Selection */}
          <div>
            <p className={`text-xs font-black ${t.textSub} mb-3 flex items-center gap-2`}>
              <i className="ri-music-2-line text-emerald-400" />
              fal.ai 음악 모델 선택
            </p>
            <div className="space-y-2">
              {ALL_FAL_MUSIC_MODELS.map((model) => {
                const info = MODEL_LABELS[model];
                const isActive = settings.music.active_model === model;
                const isEnabled = settings.music.available_fal_models.includes(model);
                return (
                  <div key={model} className={`flex items-center gap-3 p-3 rounded-xl border ${t.cardBg2} ${t.border}`}>
                    {/* Active radio */}
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
                        {info?.badge && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${BADGE_COLORS[info.badge] ?? 'bg-zinc-700 text-zinc-400'}`}>
                            {info.badge}
                          </span>
                        )}
                        {isActive && <span className="text-[9px] font-bold text-emerald-400">기본</span>}
                      </div>
                      <p className={`text-[10px] ${t.textFaint}`}>{info?.desc}</p>
                    </div>
                    {/* Enable toggle */}
                    <button
                      onClick={() => toggleFalMusicModel(model)}
                      className={`w-9 h-5 rounded-full transition-colors cursor-pointer relative flex-shrink-0 ${isEnabled ? 'bg-emerald-500' : isDark ? 'bg-zinc-700' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Suno Fallback Toggle */}
          <div className={`flex items-center justify-between p-4 rounded-xl ${t.cardBg2} border ${t.border}`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl ${settings.music.suno_enabled === 'true' ? 'bg-emerald-500/15' : t.inputBg2} flex items-center justify-center`}>
                <i className={`ri-music-ai-line text-sm ${settings.music.suno_enabled === 'true' ? 'text-emerald-400' : t.textFaint}`} />
              </div>
              <div>
                <p className={`text-xs font-semibold ${t.text}`}>Suno 폴백 활성화</p>
                <p className={`text-[10px] ${t.textFaint}`}>fal.ai 실패 시 Suno로 자동 전환 (Suno 키 필요)</p>
              </div>
            </div>
            <button
              onClick={() => setSettings((prev) => ({
                ...prev,
                music: { ...prev.music, suno_enabled: prev.music.suno_enabled === 'true' ? 'false' : 'true' }
              }))}
              className={`w-9 h-5 rounded-full transition-colors cursor-pointer relative flex-shrink-0 ${
                settings.music.suno_enabled === 'true' ? 'bg-emerald-500' : isDark ? 'bg-zinc-700' : 'bg-gray-300'
              }`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.music.suno_enabled === 'true' ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <button
            onClick={() => handleSaveSection('music')}
            disabled={saving === 'music'}
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
          >
            {saving === 'music' ? (
              <><i className="ri-loader-4-line animate-spin mr-1.5" />저장 중...</>
            ) : (
              <><i className="ri-save-line mr-1.5" />음악 API 설정 저장</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
