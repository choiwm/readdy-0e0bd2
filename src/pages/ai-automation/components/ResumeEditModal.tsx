import { useState } from 'react';
import { AutomationProject } from '@/mocks/automationProjects';

interface ResumeEditModalProps {
  project: AutomationProject;
  onClose: () => void;
  /** AI Automation 내 YT Studio 탭으로 이동하는 콜백 (없으면 외부 페이지로 이동) */
  onEditInAutomation?: (project: AutomationProject, resumeStep?: number) => void;
}

const STEPS = [
  {
    step: 1,
    icon: 'ri-settings-3-line',
    label: '영상 설정',
    desc: '스타일, 비율, 키워드 재설정',
    color: 'text-zinc-400',
    bg: 'bg-zinc-800/60',
    activeBg: 'bg-zinc-700/80',
    border: 'border-zinc-700',
    activeBorder: 'border-zinc-500',
  },
  {
    step: 2,
    icon: 'ri-file-text-line',
    label: '대본 작성',
    desc: '대본 수정 및 재작성',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    activeBg: 'bg-indigo-500/20',
    border: 'border-indigo-500/20',
    activeBorder: 'border-indigo-500/50',
  },
  {
    step: 3,
    icon: 'ri-mic-line',
    label: '음성 생성',
    desc: '나레이션 음성 재생성',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    activeBg: 'bg-emerald-500/20',
    border: 'border-emerald-500/20',
    activeBorder: 'border-emerald-500/50',
  },
  {
    step: 4,
    icon: 'ri-image-ai-line',
    label: '이미지 생성',
    desc: '씬 이미지 수정 및 재생성',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    activeBg: 'bg-amber-500/20',
    border: 'border-amber-500/20',
    activeBorder: 'border-amber-500/50',
  },
  {
    step: 5,
    icon: 'ri-movie-ai-line',
    label: '영상 생성',
    desc: '영상 합성 및 재편집',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    activeBg: 'bg-violet-500/20',
    border: 'border-violet-500/20',
    activeBorder: 'border-violet-500/50',
  },
  {
    step: 6,
    icon: 'ri-closed-captioning-line',
    label: '자막 스타일',
    desc: '자막 편집 및 최종 렌더링',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    activeBg: 'bg-rose-500/20',
    border: 'border-rose-500/20',
    activeBorder: 'border-rose-500/50',
  },
];

export default function ResumeEditModal({ project, onClose, onEditInAutomation }: ResumeEditModalProps) {
  const [selectedStep, setSelectedStep] = useState(1);

  const handleStart = () => {
    if (onEditInAutomation) {
      // AI Automation 내 YT Studio 탭으로 이동 — selectedStep 전달
      onEditInAutomation(project, selectedStep);
    }
    onClose();
  };

  const isCompleted = project.status === 'completed';

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#111113] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
              <img src={project.thumbnail} alt={project.title} className="w-full h-full object-cover object-top" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm truncate">{project.title}</p>
              <p className="text-zinc-500 text-xs mt-0.5">
                {isCompleted ? '완료된 프로젝트 — 어느 단계부터 수정할까요?' : '이어서 편집할 단계를 선택하세요'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 cursor-pointer transition-colors flex-shrink-0"
          >
            <i className="ri-close-line text-sm" />
          </button>
        </div>

        {/* Project meta */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5 overflow-x-auto scrollbar-none">
          {[
            { icon: 'ri-aspect-ratio-line', val: project.ratio },
            { icon: 'ri-time-line', val: `${project.duration}초` },
            { icon: 'ri-film-line', val: `${project.cuts}컷` },
            { icon: 'ri-palette-line', val: project.style },
          ].map((item) => (
            <div key={item.val} className="flex items-center gap-1.5 bg-zinc-900 border border-white/5 rounded-lg px-2.5 py-1.5 flex-shrink-0">
              <i className={`${item.icon} text-zinc-500 text-xs`} />
              <span className="text-xs text-zinc-300 whitespace-nowrap">{item.val}</span>
            </div>
          ))}
        </div>

        {/* Step selector */}
        <div className="p-5">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">시작 단계 선택</p>
          <div className="space-y-2">
            {STEPS.map((s) => (
              <button
                key={s.step}
                onClick={() => setSelectedStep(s.step)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer text-left ${
                  selectedStep === s.step
                    ? `${s.activeBg} ${s.activeBorder} border`
                    : `${s.bg} ${s.border} border hover:border-white/15`
                }`}
              >
                <div className={`w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 ${selectedStep === s.step ? s.activeBg : s.bg}`}>
                  <i className={`${s.icon} ${s.color} text-sm`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${selectedStep === s.step ? 'text-white' : 'text-zinc-300'}`}>
                      Step {s.step}. {s.label}
                    </span>
                    {s.step === 6 && (
                      <span className="text-[9px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap">최종</span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{s.desc}</p>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                  selectedStep === s.step ? `${s.activeBorder} border-2` : 'border-zinc-700'
                }`}>
                  {selectedStep === s.step && (
                    <div className={`w-2 h-2 rounded-full ${s.color.replace('text-', 'bg-')}`} />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Info note */}
          <div className="mt-4 flex items-start gap-2 bg-indigo-500/8 border border-indigo-500/20 rounded-xl px-3 py-2.5">
            <i className="ri-information-line text-indigo-400 text-sm flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-indigo-300/80 leading-relaxed">
              선택한 단계부터 편집기가 열립니다. 이전 단계 설정(스타일, 비율, 키워드)은 자동으로 복원됩니다.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-semibold hover:bg-white/5 cursor-pointer transition-colors whitespace-nowrap"
          >
            취소
          </button>
          <button
            onClick={handleStart}
            className="flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white text-sm font-bold cursor-pointer transition-all flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <i className="ri-edit-line text-sm" />
            Step {selectedStep}부터 편집 시작
          </button>
        </div>
      </div>
    </div>
  );
}
