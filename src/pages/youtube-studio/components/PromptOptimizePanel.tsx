import { useState } from 'react';
import {
  stylePromptModifiers,
  keywordVisualMap,
  buildOptimizedPrompt,
} from './step4-image-data';

interface PromptOptimizePanelProps {
  cutId: number;
  styleId: string | null;
  keywords: string[];
  onApply: (prompt: string) => void;
  onClose: () => void;
}

export default function PromptOptimizePanel({
  cutId,
  styleId,
  keywords,
  onApply,
  onClose,
}: PromptOptimizePanelProps) {
  const [selectedKws, setSelectedKws] = useState<Set<string>>(new Set(keywords.slice(0, 2)));
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedPrompt, setOptimizedPrompt] = useState('');
  const [optimizeStep, setOptimizeStep] = useState(0);

  const modifier = styleId ? stylePromptModifiers[styleId] : null;

  const handleOptimize = () => {
    setIsOptimizing(true);
    setOptimizeStep(0);
    setOptimizedPrompt('');

    const steps = [300, 700, 1100, 1500];
    steps.forEach((d, i) => setTimeout(() => setOptimizeStep(i + 1), d));

    setTimeout(() => {
      const result = buildOptimizedPrompt(cutId, styleId, Array.from(selectedKws));
      setOptimizedPrompt(result);
      setIsOptimizing(false);
    }, 1700);
  };

  const optimizeSteps = ['씬 텍스트 분석', '스타일 모디파이어 적용', '키워드 시각화 매핑', '프롬프트 최적화 완료'];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <i className="ri-sparkling-2-line text-indigo-400 text-xs" />
          </div>
          <div>
            <p className="text-xs font-black text-white">AI 프롬프트 최적화</p>
            <p className="text-[9px] text-zinc-600">Cut {cutId} · 채널 분석 데이터 반영</p>
          </div>
        </div>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center text-zinc-600 hover:text-zinc-400 cursor-pointer transition-colors">
          <i className="ri-close-line text-sm" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Style modifier preview */}
        {modifier && (
          <div className="bg-zinc-900/60 border border-indigo-500/20 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <i className="ri-palette-line text-indigo-400 text-xs" />
              <span className="text-[10px] font-bold text-indigo-300">스타일 모디파이어</span>
              <span className="text-[9px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded-full">{modifier.label}</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="text-[9px] text-emerald-400 font-bold w-8 flex-shrink-0 mt-0.5">앞</span>
                <p className="text-[10px] text-zinc-400 leading-relaxed">{modifier.prefix}</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[9px] text-amber-400 font-bold w-8 flex-shrink-0 mt-0.5">뒤</span>
                <p className="text-[10px] text-zinc-400 leading-relaxed">{modifier.suffix}</p>
              </div>
            </div>
          </div>
        )}

        {/* Keyword selection */}
        {keywords.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <i className="ri-price-tag-3-line text-zinc-500 text-xs" />
                <span className="text-[10px] font-bold text-zinc-400">채널 키워드 반영</span>
              </div>
              <span className="text-[9px] text-zinc-600">{selectedKws.size}개 선택</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((kw) => {
                const isSelected = selectedKws.has(kw);
                const hasVisual = !!keywordVisualMap[kw];
                return (
                  <button
                    key={kw}
                    onClick={() => {
                      setSelectedKws((prev) => {
                        const next = new Set(prev);
                        if (next.has(kw)) next.delete(kw);
                        else next.add(kw);
                        return next;
                      });
                    }}
                    className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                        : 'bg-zinc-800/60 border-white/5 text-zinc-500 hover:border-white/15'
                    }`}
                  >
                    {isSelected && <i className="ri-check-line text-[9px]" />}
                    #{kw}
                    {hasVisual && <i className="ri-image-line text-[9px] opacity-60" />}
                  </button>
                );
              })}
            </div>
            {selectedKws.size > 0 && (
              <div className="mt-2 space-y-1">
                {Array.from(selectedKws).map((kw) => keywordVisualMap[kw] && (
                  <div key={kw} className="flex items-start gap-2 bg-zinc-800/40 rounded-lg px-2 py-1.5">
                    <span className="text-[9px] text-indigo-400 font-bold whitespace-nowrap mt-0.5">#{kw}</span>
                    <p className="text-[9px] text-zinc-500 leading-relaxed">{keywordVisualMap[kw]}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* No keywords state */}
        {keywords.length === 0 && (
          <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-3 flex items-start gap-2">
            <i className="ri-information-line text-zinc-600 text-xs mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              Step 1에서 채널 분석 후 키워드를 선택하면 프롬프트에 자동 반영됩니다.
            </p>
          </div>
        )}

        {/* Optimize button */}
        <button
          onClick={handleOptimize}
          disabled={isOptimizing}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-60 text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer transition-all whitespace-nowrap"
        >
          {isOptimizing ? (
            <><i className="ri-loader-4-line animate-spin" /> 최적화 중...</>
          ) : (
            <><i className="ri-sparkling-2-line" /> AI 프롬프트 최적화</>
          )}
        </button>

        {/* Optimization progress */}
        {isOptimizing && (
          <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-3 space-y-2">
            {optimizeSteps.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  i < optimizeStep ? 'bg-emerald-500' : i === optimizeStep ? 'bg-indigo-500 animate-pulse' : 'bg-zinc-800'
                }`}>
                  {i < optimizeStep && <i className="ri-check-line text-white text-[8px]" />}
                  {i === optimizeStep && <div className="w-1 h-1 rounded-full bg-white" />}
                </div>
                <span className={`text-[10px] ${
                  i < optimizeStep ? 'text-zinc-600 line-through' : i === optimizeStep ? 'text-zinc-300' : 'text-zinc-700'
                }`}>{step}</span>
              </div>
            ))}
          </div>
        )}

        {/* Optimized result */}
        {optimizedPrompt && !isOptimizing && (
          <div className="bg-zinc-900/60 border border-emerald-500/20 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <i className="ri-checkbox-circle-fill text-emerald-400 text-xs" />
              <span className="text-[10px] font-bold text-emerald-400">최적화 완료</span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed mb-3">{optimizedPrompt}</p>
            <button
              onClick={() => { onApply(optimizedPrompt); onClose(); }}
              className="w-full flex items-center justify-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 text-xs font-bold py-2 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-check-line" /> 이 프롬프트 적용
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
