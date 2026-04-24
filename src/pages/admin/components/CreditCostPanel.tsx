import { useState, useEffect, useCallback } from 'react';
import { getAuthorizationHeader } from '@/lib/env';

interface CreditCost {
  id?: string;
  category: string;
  model_id: string;
  model_name: string;
  cost: number;
  unit: string;
  description?: string;
  is_active: boolean;
  updated_at?: string;
}

interface Props {
  isDark: boolean;
  onSave: (msg: string) => void;
}

const CATEGORY_CONFIG: Record<string, {
  label: string;
  icon: string;
  color: string;
  bg: string;
  accentBg: string;
  border: string;
}> = {
  image:      { label: '이미지 생성',  icon: 'ri-image-ai-line',          color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  accentBg: 'bg-indigo-500',  border: 'border-indigo-500/20' },
  video:      { label: '영상 생성',    icon: 'ri-video-ai-line',           color: 'text-violet-400',  bg: 'bg-violet-500/10',  accentBg: 'bg-violet-500',  border: 'border-violet-500/20' },
  workflow:   { label: 'AI 워크플로우', icon: 'ri-flow-chart',             color: 'text-pink-400',    bg: 'bg-pink-500/10',    accentBg: 'bg-pink-500',    border: 'border-pink-500/20' },
  music:      { label: '음악 생성',    icon: 'ri-music-2-line',            color: 'text-emerald-400', bg: 'bg-emerald-500/10', accentBg: 'bg-emerald-500', border: 'border-emerald-500/20' },
  tts:        { label: 'TTS 음성',     icon: 'ri-mic-ai-line',             color: 'text-amber-400',   bg: 'bg-amber-500/10',   accentBg: 'bg-amber-500',   border: 'border-amber-500/20' },
  sfx:        { label: 'SFX 효과음',   icon: 'ri-sound-module-line',       color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    accentBg: 'bg-cyan-500',    border: 'border-cyan-500/20' },
  transcribe: { label: '음성 전사',    icon: 'ri-file-text-line',          color: 'text-rose-400',    bg: 'bg-rose-500/10',    accentBg: 'bg-rose-500',    border: 'border-rose-500/20' },
  clean:      { label: '오디오 클린',  icon: 'ri-equalizer-line',          color: 'text-teal-400',    bg: 'bg-teal-500/10',    accentBg: 'bg-teal-500',    border: 'border-teal-500/20' },
};

const UNIT_LABELS: Record<string, string> = {
  per_request: '요청당',
  per_second:  '초당',
  per_char:    '글자당',
};

const CATEGORY_ORDER = ['image', 'video', 'workflow', 'music', 'tts', 'sfx', 'transcribe', 'clean'];

export default function CreditCostPanel({ isDark, onSave }: Props) {
  const [costs, setCosts] = useState<CreditCost[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('image');
  const [editingCosts, setEditingCosts] = useState<Record<string, number>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const t = {
    cardBg:    isDark ? 'bg-[#0f0f13]'   : 'bg-white',
    cardBg2:   isDark ? 'bg-zinc-900/60'  : 'bg-gray-50',
    border:    isDark ? 'border-white/5'  : 'border-gray-200',
    text:      isDark ? 'text-white'      : 'text-gray-900',
    textSub:   isDark ? 'text-zinc-400'   : 'text-gray-500',
    textFaint: isDark ? 'text-zinc-600'   : 'text-gray-400',
    inputBg:   isDark ? 'bg-zinc-800 border-white/10 text-white' : 'bg-gray-100 border-gray-200 text-gray-900',
    inputBg2:  isDark ? 'bg-zinc-800'     : 'bg-gray-100',
    divider:   isDark ? 'divide-white/[0.03]' : 'divide-gray-100',
  };

  const loadCosts = useCallback(async () => {
    setLoading(true);
    try {
      const base = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-api-keys`;
      const headers = { 'Authorization': getAuthorizationHeader() };
      const res = await fetch(`${base}?action=get_credit_costs`, { headers });
      const data = await res.json();
      if (data.credit_costs) {
        setCosts(data.credit_costs);
        // 편집 상태 초기화
        const initial: Record<string, number> = {};
        data.credit_costs.forEach((c: CreditCost) => {
          initial[`${c.category}::${c.model_id}`] = c.cost;
        });
        setEditingCosts(initial);
        setHasChanges(false);
      }
    } catch (e) {
      console.warn('Credit costs load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCosts();
  }, [loadCosts]);

  const handleCostChange = (category: string, modelId: string, value: string) => {
    const num = parseInt(value);
    if (isNaN(num) || num < 0) return;
    const key = `${category}::${modelId}`;
    setEditingCosts((prev) => ({ ...prev, [key]: num }));
    setHasChanges(true);
  };

  const handleToggleActive = async (category: string, modelId: string, currentActive: boolean) => {
    // 낙관적 업데이트
    setCosts((prev) => prev.map((c) =>
      c.category === category && c.model_id === modelId
        ? { ...c, is_active: !currentActive }
        : c
    ));

    try {
      const base = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-api-keys`;
      const res = await fetch(`${base}?action=update_credit_cost`, {
        method: 'PATCH',
        headers: {
          'Authorization': getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category, model_id: modelId, is_active: !currentActive }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
    } catch (e) {
      console.warn('Toggle active failed:', e);
      // 롤백
      setCosts((prev) => prev.map((c) =>
        c.category === category && c.model_id === modelId
          ? { ...c, is_active: currentActive }
          : c
      ));
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const base = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-api-keys`;
      const headers = {
        'Authorization': getAuthorizationHeader(),
        'Content-Type': 'application/json',
      };

      // 변경된 항목만 추출
      const updates = costs
        .filter((c) => {
          const key = `${c.category}::${c.model_id}`;
          return editingCosts[key] !== undefined && editingCosts[key] !== c.cost;
        })
        .map((c) => ({
          category: c.category,
          model_id: c.model_id,
          cost: editingCosts[`${c.category}::${c.model_id}`] ?? c.cost,
          is_active: c.is_active,
        }));

      if (updates.length === 0) {
        onSave('변경된 항목이 없습니다');
        setSaving(false);
        return;
      }

      const res = await fetch(`${base}?action=save_credit_costs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ costs: updates }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // 로컬 state 업데이트
      setCosts((prev) => prev.map((c) => {
        const key = `${c.category}::${c.model_id}`;
        if (editingCosts[key] !== undefined) {
          return { ...c, cost: editingCosts[key] };
        }
        return c;
      }));

      setHasChanges(false);
      setSaveSuccess(true);
      setLastSaved(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
      onSave(`${updates.length}개 크레딧 비용이 저장됐습니다`);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      console.error('Save credit costs failed:', e);
      onSave(`저장 실패: ${String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCategory = async (category: string) => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const base = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-api-keys`;
      const headers = {
        'Authorization': getAuthorizationHeader(),
        'Content-Type': 'application/json',
      };

      const categoryCosts = costs
        .filter((c) => c.category === category)
        .map((c) => ({
          category: c.category,
          model_id: c.model_id,
          cost: editingCosts[`${c.category}::${c.model_id}`] ?? c.cost,
          is_active: c.is_active,
        }));

      const res = await fetch(`${base}?action=save_credit_costs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ costs: categoryCosts }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // 로컬 state 업데이트
      setCosts((prev) => prev.map((c) => {
        if (c.category !== category) return c;
        const key = `${c.category}::${c.model_id}`;
        return { ...c, cost: editingCosts[key] ?? c.cost };
      }));

      setSaveSuccess(true);
      setLastSaved(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
      const cfg = CATEGORY_CONFIG[category];
      onSave(`${cfg?.label ?? category} 크레딧 비용이 저장됐습니다`);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      console.error('Save category costs failed:', e);
      onSave(`저장 실패: ${String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleResetCategory = (category: string) => {
    const original: Record<string, number> = {};
    costs.filter((c) => c.category === category).forEach((c) => {
      original[`${c.category}::${c.model_id}`] = c.cost;
    });
    setEditingCosts((prev) => ({ ...prev, ...original }));
    setHasChanges(false);
  };

  // 카테고리별 그룹핑 (DB에 있는 모든 카테고리 포함)
  const allCategories = Array.from(new Set([...CATEGORY_ORDER, ...costs.map((c) => c.category)]));
  const grouped = allCategories.reduce<Record<string, CreditCost[]>>((acc, cat) => {
    acc[cat] = costs.filter((c) => c.category === cat);
    return acc;
  }, {});

  const activeCosts = grouped[activeCategory] ?? [];
  const cfg = CATEGORY_CONFIG[activeCategory];

  // 총 크레딧 비용 통계
  const totalModels = costs.length;
  const avgCost = totalModels > 0 ? Math.round(costs.reduce((s, c) => s + c.cost, 0) / totalModels) : 0;
  const maxCost = totalModels > 0 ? Math.max(...costs.map((c) => c.cost)) : 0;

  return (
    <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
      {/* Header */}
      <div className={`px-5 py-4 border-b ${t.border} flex items-center justify-between`}>
        <div>
          <p className={`text-sm font-black ${t.text}`}>크레딧 비용 설정</p>
          <p className={`text-xs ${t.textSub} mt-0.5`}>기능·모델별 소비 크레딧 직접 수정</p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <i className="ri-loader-4-line animate-spin text-zinc-500 text-sm" />}
          {lastSaved && (
            <span className={`text-[10px] ${t.textFaint} hidden sm:block`}>
              마지막 저장: {lastSaved}
            </span>
          )}
          <button
            onClick={loadCosts}
            className={`w-8 h-8 flex items-center justify-center rounded-xl ${t.inputBg2} hover:opacity-80 cursor-pointer transition-colors`}
          >
            <i className={`ri-refresh-line text-sm ${t.textSub}`} />
          </button>
          {hasChanges && (
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-bold rounded-xl cursor-pointer transition-all whitespace-nowrap ${
                saveSuccess ? 'bg-emerald-500' : 'bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50'
              }`}
            >
              {saving ? (
                <><i className="ri-loader-4-line animate-spin" />저장 중...</>
              ) : saveSuccess ? (
                <><i className="ri-checkbox-circle-line" />저장 완료!</>
              ) : (
                <><i className="ri-save-line" />전체 저장</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className={`px-5 py-3 border-b ${t.border} grid grid-cols-3 gap-4`}>
        {[
          { label: '총 모델 수', value: `${totalModels}개`, icon: 'ri-cpu-line', color: 'text-indigo-400' },
          { label: '평균 비용', value: `${avgCost} CR`, icon: 'ri-coins-line', color: 'text-amber-400' },
          { label: '최고 비용', value: `${maxCost} CR`, icon: 'ri-arrow-up-line', color: 'text-red-400' },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <i className={`${s.icon} ${s.color} text-xs`} />
              <span className={`text-sm font-black ${t.text}`}>{s.value}</span>
            </div>
            <p className={`text-[10px] ${t.textFaint}`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Category Tabs */}
      <div className={`px-5 py-3 border-b ${t.border} flex items-center gap-1.5 overflow-x-auto`}>
        {CATEGORY_ORDER.map((cat) => {
          const catCfg = CATEGORY_CONFIG[cat];
          const catCosts = grouped[cat] ?? [];
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap border flex-shrink-0 ${
                isActive
                  ? `${catCfg.bg} ${catCfg.color} ${catCfg.border}`
                  : `${t.inputBg2} ${t.textSub} border-transparent hover:opacity-80`
              }`}
            >
              <i className={`${catCfg.icon} text-sm`} />
              {catCfg.label}
              <span className={`text-[9px] font-bold px-1 py-0.5 rounded-full ${
                isActive ? `${catCfg.accentBg} text-white` : `${isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-gray-200 text-gray-500'}`
              }`}>
                {catCosts.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Cost Editor */}
      <div className="p-5">
        {/* Category Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl ${cfg?.bg} flex items-center justify-center`}>
              <i className={`${cfg?.icon} ${cfg?.color} text-sm`} />
            </div>
            <div>
              <p className={`text-sm font-black ${t.text}`}>{cfg?.label}</p>
              <p className={`text-[10px] ${t.textFaint}`}>{activeCosts.length}개 모델 · 클릭하여 비용 수정</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleResetCategory(activeCategory)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg ${t.inputBg2} ${t.textSub} text-[10px] font-semibold cursor-pointer hover:opacity-80 transition-colors whitespace-nowrap`}
            >
              <i className="ri-arrow-go-back-line text-xs" />
              초기화
            </button>
            <button
              onClick={() => handleSaveCategory(activeCategory)}
              disabled={saving}
              className={`flex items-center gap-1.5 px-3 py-1.5 ${cfg?.accentBg} hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap`}
            >
              {saving ? (
                <><i className="ri-loader-4-line animate-spin text-xs" />저장 중...</>
              ) : (
                <><i className="ri-save-line text-xs" />저장</>
              )}
            </button>
          </div>
        </div>

        {/* Cost Items */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <i className="ri-loader-4-line animate-spin text-2xl text-indigo-400" />
          </div>
        ) : activeCosts.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-12 ${t.textFaint}`}>
            <i className={`${cfg?.icon} text-3xl mb-2`} />
            <p className="text-sm">설정된 모델이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeCosts.map((item) => {
              const key = `${item.category}::${item.model_id}`;
              const currentCost = editingCosts[key] ?? item.cost;
              const isChanged = currentCost !== item.cost;

              return (
                <div
                  key={key}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
                    isChanged
                      ? `${isDark ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-200'}`
                      : `${t.cardBg2} ${t.border}`
                  } ${!item.is_active ? 'opacity-50' : ''}`}
                >
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item.is_active ? cfg?.bg : t.inputBg2}`}>
                    <i className={`${cfg?.icon} text-xs ${item.is_active ? cfg?.color : t.textFaint}`} />
                  </div>

                  {/* Model Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-semibold ${t.text} truncate`}>{item.model_name}</span>
                      {isChanged && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 flex-shrink-0">
                          수정됨
                        </span>
                      )}
                    </div>
                    <p className={`text-[10px] ${t.textFaint} truncate`}>
                      {item.description ?? item.model_id}
                      {' · '}
                      <span className={t.textSub}>{UNIT_LABELS[item.unit] ?? item.unit}</span>
                    </p>
                  </div>

                  {/* Cost Input */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Decrease */}
                    <button
                      onClick={() => handleCostChange(item.category, item.model_id, String(Math.max(0, currentCost - 1)))}
                      className={`w-6 h-6 rounded-lg ${t.inputBg2} flex items-center justify-center cursor-pointer hover:opacity-80 transition-colors`}
                    >
                      <i className={`ri-subtract-line text-xs ${t.textSub}`} />
                    </button>

                    {/* Input */}
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="9999"
                        value={currentCost}
                        onChange={(e) => handleCostChange(item.category, item.model_id, e.target.value)}
                        className={`w-16 text-center text-sm font-black rounded-lg px-2 py-1.5 border focus:outline-none focus:border-indigo-500/50 transition-colors ${
                          isChanged
                            ? `${isDark ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300' : 'bg-indigo-50 border-indigo-300 text-indigo-700'}`
                            : `${t.inputBg}`
                        }`}
                      />
                    </div>

                    {/* Increase */}
                    <button
                      onClick={() => handleCostChange(item.category, item.model_id, String(currentCost + 1))}
                      className={`w-6 h-6 rounded-lg ${t.inputBg2} flex items-center justify-center cursor-pointer hover:opacity-80 transition-colors`}
                    >
                      <i className={`ri-add-line text-xs ${t.textSub}`} />
                    </button>

                    {/* CR Label */}
                    <span className={`text-[10px] font-bold ${t.textFaint} w-5`}>CR</span>

                    {/* Active Toggle */}
                    <button
                      onClick={() => handleToggleActive(item.category, item.model_id, item.is_active)}
                      className={`w-8 h-4 rounded-full transition-colors cursor-pointer relative flex-shrink-0 ${
                        item.is_active ? cfg?.accentBg : isDark ? 'bg-zinc-700' : 'bg-gray-300'
                      }`}
                      title={item.is_active ? '비활성화' : '활성화'}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${item.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quick Preset Buttons */}
        {activeCosts.length > 0 && (
          <div className={`mt-4 pt-4 border-t ${t.border}`}>
            <p className={`text-[10px] font-black ${t.textFaint} mb-2.5 uppercase tracking-widest`}>빠른 설정</p>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { label: '모두 5 CR', value: 5 },
                { label: '모두 10 CR', value: 10 },
                { label: '모두 20 CR', value: 20 },
                { label: '모두 50 CR', value: 50 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => {
                    const updates: Record<string, number> = {};
                    activeCosts.forEach((c) => {
                      updates[`${c.category}::${c.model_id}`] = preset.value;
                    });
                    setEditingCosts((prev) => ({ ...prev, ...updates }));
                    setHasChanges(true);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg ${t.inputBg2} ${t.textSub} text-[10px] font-semibold cursor-pointer hover:opacity-80 transition-colors whitespace-nowrap border ${t.border}`}
                >
                  {preset.label}
                </button>
              ))}
              <button
                onClick={() => {
                  // 비율 적용: 현재 값의 2배
                  const updates: Record<string, number> = {};
                  activeCosts.forEach((c) => {
                    const key = `${c.category}::${c.model_id}`;
                    updates[key] = Math.round((editingCosts[key] ?? c.cost) * 2);
                  });
                  setEditingCosts((prev) => ({ ...prev, ...updates }));
                  setHasChanges(true);
                }}
                className={`px-2.5 py-1.5 rounded-lg ${t.inputBg2} ${t.textSub} text-[10px] font-semibold cursor-pointer hover:opacity-80 transition-colors whitespace-nowrap border ${t.border}`}
              >
                전체 2배
              </button>
              <button
                onClick={() => {
                  const updates: Record<string, number> = {};
                  activeCosts.forEach((c) => {
                    const key = `${c.category}::${c.model_id}`;
                    updates[key] = Math.max(1, Math.round((editingCosts[key] ?? c.cost) / 2));
                  });
                  setEditingCosts((prev) => ({ ...prev, ...updates }));
                  setHasChanges(true);
                }}
                className={`px-2.5 py-1.5 rounded-lg ${t.inputBg2} ${t.textSub} text-[10px] font-semibold cursor-pointer hover:opacity-80 transition-colors whitespace-nowrap border ${t.border}`}
              >
                전체 1/2
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className={`px-5 py-3 border-t ${t.border} flex items-center gap-3`}>
        <i className="ri-information-line text-xs text-indigo-400 flex-shrink-0" />
        <p className={`text-[10px] ${t.textFaint} leading-relaxed`}>
          크레딧 비용은 즉시 적용됩니다. 토글 OFF 시 해당 모델은 사용자에게 노출되지 않습니다.
          변경 사항은 감사 로그에 기록됩니다.
        </p>
      </div>
    </div>
  );
}
