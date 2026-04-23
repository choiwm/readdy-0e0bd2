import { useState } from 'react';

interface RenderModalProps {
  mode: 'local' | 'server';
  onClose: () => void;
  onRenderComplete?: (quality: string, format: string) => void;
}

export default function RenderModal({ mode, onClose, onRenderComplete }: RenderModalProps) {
  const [step, setStep] = useState<'options' | 'rendering' | 'done'>('options');
  const [progress, setProgress] = useState(0);
  const [currentCut, setCurrentCut] = useState(0);
  const [quality, setQuality] = useState('1080p');
  const [format, setFormat] = useState('mp4');
  const [currentStepLabel, setCurrentStepLabel] = useState('');

  const renderSteps = [
    '영상 클립 로딩 중...',
    '자막 합성 중...',
    '오디오 믹싱 중...',
    '컷 편집 처리 중...',
    '최종 인코딩 중...',
    '파일 저장 중...',
  ];

  const handleRender = () => {
    setStep('rendering');
    setProgress(0);
    setCurrentCut(0);
    let p = 0;
    let stepIdx = 0;
    setCurrentStepLabel(renderSteps[0]);
    const interval = setInterval(() => {
      p += mode === 'server' ? 4 : 1.5;
      if (p >= 100) {
        clearInterval(interval);
        setProgress(100);
        setCurrentCut(6);
        setTimeout(() => setStep('done'), 500);
        return;
      }
      setProgress(Math.min(p, 100));
      setCurrentCut(Math.floor((p / 100) * 6));
      const newStepIdx = Math.floor((p / 100) * renderSteps.length);
      if (newStepIdx !== stepIdx && newStepIdx < renderSteps.length) {
        stepIdx = newStepIdx;
        setCurrentStepLabel(renderSteps[stepIdx]);
      }
    }, mode === 'server' ? 80 : 200);
  };

  const handleDownload = () => {
    const blob = new Blob(['FAKE VIDEO FILE'], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai_video_${quality}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-8"
      onClick={step !== 'rendering' ? onClose : undefined}
    >
      <div
        className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${mode === 'local' ? 'bg-indigo-500/20' : 'bg-violet-500/20'}`}>
              <i className={`${mode === 'local' ? 'ri-computer-line text-indigo-400' : 'ri-server-line text-violet-400'} text-sm`} />
            </div>
            <div>
              <p className="text-white font-bold text-sm">
                {mode === 'local' ? '로컬 렌더링' : '서버 초고속 렌더링'}
              </p>
              <p className="text-zinc-500 text-xs mt-0.5">
                {mode === 'local' ? '브라우저에서 직접 처리 · 무료' : '클라우드 GPU 가속 · 크레딧 7 소모'}
              </p>
            </div>
          </div>
          {step !== 'rendering' && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer transition-colors"
            >
              <i className="ri-close-line" />
            </button>
          )}
        </div>
        <div className="p-6 space-y-4">
          {step === 'options' && (
            <>
              <div>
                <p className="text-xs font-bold text-zinc-300 mb-2">출력 품질</p>
                <div className="grid grid-cols-3 gap-2">
                  {['720p', '1080p', '4K'].map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuality(q)}
                      className={`py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap ${quality === q ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                    >
                      {q}
                      {q === '4K' && <span className="block text-[9px] font-normal opacity-70">크레딧 추가</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-300 mb-2">파일 형식</p>
                <div className="flex gap-2">
                  {['mp4', 'webm', 'mov'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap uppercase ${format === f ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-zinc-800/60 rounded-xl p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: '총 컷 수', val: '6컷' },
                    { label: '영상 길이', val: '0:38' },
                    { label: '예상 크기', val: quality === '4K' ? '~280MB' : quality === '1080p' ? '~45MB' : '~22MB' },
                    { label: '예상 시간', val: mode === 'server' ? '~30초' : '~3분' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-600">{item.label}</span>
                      <span className="text-[10px] text-zinc-300 font-semibold">{item.val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={handleRender}
                className={`w-full flex items-center justify-center gap-2 text-white font-bold text-sm py-3 rounded-xl cursor-pointer transition-all whitespace-nowrap ${
                  mode === 'local'
                    ? 'bg-indigo-500 hover:bg-indigo-400'
                    : 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500'
                }`}
              >
                <i className={mode === 'local' ? 'ri-computer-line' : 'ri-server-line'} />
                {mode === 'local' ? '로컬 렌더링 시작' : '서버 렌더링 시작'}
                {mode === 'server' && (
                  <span className="flex items-center gap-0.5 bg-white/20 rounded-full px-1.5 py-0.5 text-[10px]">
                    <i className="ri-sparkling-2-line text-[10px]" />7
                  </span>
                )}
              </button>
            </>
          )}
          {step === 'rendering' && (
            <div className="flex flex-col items-center gap-5 py-2">
              <div className="relative w-full h-[140px] rounded-xl overflow-hidden bg-zinc-800">
                <img
                  src="https://readdy.ai/api/search-image?query=busy%20modern%20city%20street%20morning%20people%20checking%20smartphones%20digital%20billboards%20cinematic&width=400&height=140&seq=render_anim&orientation=landscape"
                  alt=""
                  className="w-full h-full object-cover object-top opacity-60"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-white text-xs font-bold">렌더링 중...</span>
                  </div>
                  <span className="text-zinc-400 text-[10px]">{currentStepLabel}</span>
                </div>
              </div>
              <div className="w-full space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{Math.round(progress)}% 완료</span>
                  <span className="text-xs text-zinc-400">Cut {currentCut}/6</span>
                </div>
                <div className="w-full bg-zinc-700 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${mode === 'server' ? 'bg-gradient-to-r from-violet-500 to-purple-500' : 'bg-gradient-to-r from-indigo-500 to-indigo-400'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <div
                      key={n}
                      className={`flex-1 h-1.5 rounded-full transition-all ${n <= currentCut ? (mode === 'server' ? 'bg-violet-500' : 'bg-indigo-500') : 'bg-zinc-700'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          {step === 'done' && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="relative w-full h-[120px] rounded-xl overflow-hidden">
                <img
                  src="https://readdy.ai/api/search-image?query=busy%20modern%20city%20street%20morning%20people%20checking%20smartphones%20digital%20billboards%20cinematic&width=400&height=120&seq=render_done&orientation=landscape"
                  alt=""
                  className="w-full h-full object-cover object-top"
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/80 flex items-center justify-center">
                    <i className="ri-check-line text-white text-2xl" />
                  </div>
                </div>
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                  0:38 · {quality} · {format.toUpperCase()}
                </div>
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-sm">렌더링 완료!</p>
                <p className="text-zinc-500 text-xs mt-1">
                  ai_video_{quality}.{format} 파일이 준비되었습니다
                </p>
              </div>
              <div className="w-full bg-zinc-800/60 rounded-xl p-3 space-y-1.5">
                {[
                  { label: '파일 크기', val: quality === '4K' ? '~280MB' : quality === '1080p' ? '~45MB' : '~22MB' },
                  { label: '해상도', val: quality === '4K' ? '3840×2160' : quality === '1080p' ? '1920×1080' : '1280×720' },
                  { label: '형식', val: `${format.toUpperCase()} · H.264` },
                  { label: '렌더링 방식', val: mode === 'local' ? '로컬 (무료)' : '서버 GPU' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500">{item.label}</span>
                    <span className="text-[10px] text-zinc-300 font-semibold">{item.val}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-semibold hover:bg-white/5 cursor-pointer transition-colors whitespace-nowrap"
                >
                  닫기
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold cursor-pointer transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <i className="ri-download-line" /> 다운로드
                </button>
              </div>
              <div className="w-full bg-teal-500/8 border border-teal-500/20 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <i className="ri-archive-drawer-line text-teal-400 text-sm flex-shrink-0" />
                <p className="text-[11px] text-teal-300/80 flex-1">
                  렌더링 완료 후 프로젝트 메타데이터를 백업하려면 갤러리 저장 후 백업 버튼을 이용하세요.
                </p>
              </div>
              {onRenderComplete && (
                <button
                  onClick={() => onRenderComplete(quality, format)}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                >
                  <i className="ri-folder-video-line" /> 갤러리에 저장하기
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
