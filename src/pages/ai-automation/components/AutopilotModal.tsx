/* eslint-disable react-refresh/only-export-components */
import type { RefObject } from 'react';
import PageHeader from '@/components/feature/PageHeader';

export interface AutopilotPipelineStep {
  id: string;
  label: string;
  desc: string;
  icon: string;
  duration: number;
}

export const AUTOPILOT_STEPS: AutopilotPipelineStep[] = [
  { id: 'analyze', label: '주제 분석', desc: 'AI가 주제를 분석하고 키워드를 추출합니다', icon: 'ri-search-eye-line', duration: 1200 },
  { id: 'script', label: '대본 생성', desc: '최적화된 유튜브 대본을 자동 작성합니다', icon: 'ri-file-text-line', duration: 1800 },
  { id: 'voice', label: '음성 합성', desc: 'TTS 엔진으로 나레이션을 생성합니다', icon: 'ri-mic-line', duration: 1500 },
  { id: 'image', label: '이미지 생성', desc: '각 씬에 맞는 AI 이미지를 생성합니다', icon: 'ri-image-ai-line', duration: 2200 },
  { id: 'video', label: '영상 합성', desc: '이미지와 음성을 합쳐 영상을 완성합니다', icon: 'ri-movie-ai-line', duration: 1600 },
  { id: 'subtitle', label: '자막 생성', desc: '자동 자막을 생성하고 스타일을 적용합니다', icon: 'ri-closed-captioning-line', duration: 900 },
  { id: 'export', label: '최종 렌더링', desc: '고품질 영상으로 최종 출력합니다', icon: 'ri-export-line', duration: 1400 },
];

export type AutopilotPhase = 'input' | 'running' | 'done';

interface QuickTopicsProps {
  topics: string[];
  value: string;
  onChange: (topic: string) => void;
}

function QuickTopics({ topics, value, onChange }: QuickTopicsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {topics.map((topic) => (
        <button
          key={topic}
          onClick={() => onChange(topic)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
            value === topic
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-zinc-900 border-white/10 hover:border-emerald-500/30 text-zinc-400 hover:text-emerald-400'
          }`}
        >
          {topic}
        </button>
      ))}
    </div>
  );
}

const QUICK_TOPICS = ['AI 트렌드 2026', '건강한 식습관', '재테크 입문', '파이썬 기초', '맛집 리뷰', '운동 루틴'];

export interface AutopilotModalProps {
  open: boolean;
  phase: AutopilotPhase;
  topic: string;
  setTopic: (v: string) => void;

  currentStepIdx: number;
  stepProgress: number;
  doneSteps: Set<string>;
  logLines: string[];
  generatedImageUrl: string | null;
  generatedVideoUrl: string | null;

  videoLength: number;
  ratio: string;
  currentVoiceName: string;
  addedProjectIdRef: RefObject<string | null>;

  onCloseAndReset: (finishedDone: boolean) => void;
  onCancel: () => void;
  onStart: () => void;
  onReset: (clearState?: boolean) => void;
  onOpenInEditor: () => void;
}

export default function AutopilotModal({
  open, phase, topic, setTopic,
  currentStepIdx, stepProgress, doneSteps, logLines,
  generatedImageUrl, generatedVideoUrl,
  videoLength, ratio, currentVoiceName,
  onCloseAndReset, onCancel, onStart, onReset, onOpenInEditor,
}: AutopilotModalProps) {
  if (!open) return null;

  const totalProgress = Math.min(
    100,
    ((doneSteps.size * 100) + stepProgress) / AUTOPILOT_STEPS.length,
  );
  const subtitle =
    phase === 'input' ? '주제만 입력하면 AI가 영상을 완성합니다' :
    phase === 'running' ? `${AUTOPILOT_STEPS[currentStepIdx]?.label ?? '처리 중'}...` :
    '영상 생성이 완료되었습니다!';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="AutoPilot">
      <div className="bg-[#111113] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <PageHeader
          title="AutoPilot"
          subtitle={subtitle}
          badgeColor="emerald"
          actions={phase !== 'running' ? (
            <button
              onClick={() => onCloseAndReset(phase === 'done')}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
              aria-label="AutoPilot 닫기"
            >
              <i className="ri-close-line text-sm" />
            </button>
          ) : undefined}
        />

        <div className="flex-1 overflow-y-auto">
          {phase === 'input' && (
            <div className="p-4 md:p-6">
              <div className="mb-5">
                <label className="text-xs font-bold text-zinc-400 mb-2 block uppercase tracking-wider">영상 주제</label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="예: 2026년 AI 트렌드 TOP 5, 초보자를 위한 주식 투자 가이드..."
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl p-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/40 resize-none h-24 transition-colors"
                />
              </div>
              <div className="mb-5">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">빠른 주제 선택</p>
                <QuickTopics topics={QUICK_TOPICS} value={topic} onChange={setTopic} />
              </div>
              <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-4 mb-5">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-3">자동 생성 파이프라인</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {AUTOPILOT_STEPS.map((step, i) => (
                    <div key={step.id} className="flex items-center gap-1">
                      <div className="flex items-center gap-1.5 bg-zinc-800 rounded-lg px-2 py-1">
                        <i className={`${step.icon} text-zinc-500 text-xs`} />
                        <span className="text-[10px] text-zinc-400 whitespace-nowrap">{step.label}</span>
                      </div>
                      {i < AUTOPILOT_STEPS.length - 1 && <i className="ri-arrow-right-s-line text-zinc-700 text-xs" />}
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-5">
                {[
                  { label: '영상 길이', value: `${videoLength}초`, icon: 'ri-time-line' },
                  { label: '화면 비율', value: ratio, icon: 'ri-aspect-ratio-line' },
                  { label: '음성', value: currentVoiceName, icon: 'ri-mic-line' },
                ].map((s) => (
                  <div key={s.label} className="bg-zinc-900/60 border border-white/5 rounded-xl p-2.5 flex items-center gap-2">
                    <i className={`${s.icon} text-zinc-500 text-sm`} />
                    <div>
                      <p className="text-[9px] text-zinc-600">{s.label}</p>
                      <p className="text-xs font-bold text-zinc-300">{s.value}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  취소
                </button>
                <button
                  onClick={onStart}
                  disabled={!topic.trim()}
                  className="flex-[2] py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <i className="ri-sparkling-2-line" /> AutoPilot 시작
                </button>
              </div>
            </div>
          )}

          {phase === 'running' && (
            <div className="p-4 md:p-6">
              <div className="flex items-center gap-2 mb-5 bg-zinc-900/60 border border-white/5 rounded-xl px-4 py-2.5">
                <i className="ri-video-line text-emerald-400 text-sm" />
                <span className="text-sm text-white font-semibold">{topic}</span>
                <span className="ml-auto text-[10px] text-zinc-500">{videoLength}초 · {ratio}</span>
              </div>
              <div className="space-y-2 mb-5">
                {AUTOPILOT_STEPS.map((step, i) => {
                  const isDone = doneSteps.has(step.id);
                  const isActive = i === currentStepIdx && !isDone;
                  return (
                    <div key={step.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isActive ? 'border-emerald-500/30 bg-emerald-500/5' : isDone ? 'border-white/5 bg-zinc-900/30' : 'border-white/3 bg-transparent'}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${isDone ? 'bg-emerald-500/20' : isActive ? 'bg-emerald-500/15 animate-pulse' : 'bg-zinc-800/60'}`}>
                        {isDone ? <i className="ri-check-line text-emerald-400 text-sm" /> : isActive ? <i className={`${step.icon} text-emerald-400 text-sm`} /> : <i className={`${step.icon} text-zinc-600 text-sm`} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${isDone ? 'text-zinc-400' : isActive ? 'text-white' : 'text-zinc-600'}`}>{step.label}</span>
                          {isDone && <span className="text-[9px] text-emerald-400 font-semibold">완료</span>}
                          {isActive && <span className="text-[9px] text-emerald-400 font-semibold animate-pulse">처리 중...</span>}
                        </div>
                        {isActive && (
                          <div className="mt-1.5 h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-200" style={{ width: `${stepProgress}%` }} />
                          </div>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold flex-shrink-0 ${isDone ? 'text-emerald-400' : i > currentStepIdx ? 'text-zinc-700' : 'text-zinc-500'}`}>{i + 1}/{AUTOPILOT_STEPS.length}</span>
                    </div>
                  );
                })}
              </div>
              <div className="bg-zinc-950 border border-white/5 rounded-xl p-3 h-[80px] overflow-y-auto font-mono mb-4">
                {logLines.length === 0 ? <p className="text-zinc-700 text-[10px]">파이프라인 시작 중...</p> : logLines.map((log, i) => (
                  <p key={i} className={`text-[10px] leading-relaxed ${i === logLines.length - 1 ? 'text-emerald-400' : 'text-zinc-600'}`}>
                    <span className="text-zinc-700 mr-2">&gt;</span>{log}
                  </p>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                    style={{ width: `${totalProgress}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-400 font-bold whitespace-nowrap">{doneSteps.size}/{AUTOPILOT_STEPS.length}</span>
              </div>
            </div>
          )}

          {phase === 'done' && (
            <div className="p-4 md:p-6">
              <div className="flex flex-col items-center gap-4 py-4 mb-5">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                    <i className="ri-checkbox-circle-fill text-emerald-400 text-3xl" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                    <i className="ri-sparkling-2-line text-white text-[10px]" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-white font-black text-lg">영상 생성 완료!</p>
                  <p className="text-zinc-500 text-sm mt-1">"{topic}" 영상이 성공적으로 생성되었습니다</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-5">
                {[
                  { label: '영상 길이', value: `${videoLength}초`, icon: 'ri-time-line', color: 'text-indigo-400' },
                  { label: '씬 수', value: `${Math.floor(videoLength / 8)}컷`, icon: 'ri-film-line', color: 'text-violet-400' },
                  { label: '비율', value: ratio, icon: 'ri-aspect-ratio-line', color: 'text-emerald-400' },
                  { label: '음성', value: currentVoiceName, icon: 'ri-mic-line', color: 'text-amber-400' },
                ].map((s) => (
                  <div key={s.label} className="bg-zinc-900/60 border border-white/5 rounded-xl p-2.5 text-center">
                    <i className={`${s.icon} ${s.color} text-base mb-1`} />
                    <p className={`text-sm font-black ${s.color}`}>{s.value}</p>
                    <p className="text-[9px] text-zinc-600">{s.label}</p>
                  </div>
                ))}
              </div>
              {(generatedImageUrl || generatedVideoUrl) && (
                <div className="mb-4 p-3 rounded-xl bg-indigo-500/8 border border-indigo-500/20">
                  <p className="text-[10px] font-bold text-indigo-400 mb-2 flex items-center gap-1.5"><i className="ri-sparkling-2-fill" />GoAPI 실제 생성 결과</p>
                  <div className="flex gap-2">
                    {generatedImageUrl && (
                      <div className="flex-1 rounded-lg overflow-hidden border border-white/10">
                        <img src={generatedImageUrl} alt="생성된 이미지" className="w-full h-20 object-cover" />
                        <p className="text-[9px] text-indigo-300 text-center py-1 bg-indigo-500/10">Flux 이미지</p>
                      </div>
                    )}
                    {generatedVideoUrl && (
                      <div className="flex-1 rounded-lg overflow-hidden border border-white/10">
                        <video src={generatedVideoUrl} className="w-full h-20 object-cover" muted autoPlay loop />
                        <p className="text-[9px] text-indigo-300 text-center py-1 bg-indigo-500/10">Kling 영상</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 mb-4">
                <i className="ri-checkbox-circle-fill text-emerald-400 text-base flex-shrink-0" />
                <p className="text-xs text-emerald-300 font-semibold">프로젝트 갤러리에 자동으로 추가되었습니다</p>
                <span className="ml-auto text-[10px] text-emerald-500 whitespace-nowrap">AutoPilot · 방금 전</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => onReset(true)}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-refresh-line mr-1" /> 새로 만들기
                </button>
                <button
                  onClick={onOpenInEditor}
                  className="flex-[2] py-3 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <i className="ri-edit-line" /> 편집기에서 열기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
