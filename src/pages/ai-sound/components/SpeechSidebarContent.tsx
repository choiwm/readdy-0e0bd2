import SidebarCredits from '@/pages/ai-sound/components/SidebarCredits';
import SidebarUpgrade from '@/pages/ai-sound/components/SidebarUpgrade';

export type SpeechModel = 'flash' | 'v3';

export interface SpeechParams {
  stability: number;
  similarity: number;
  style: number;
  speed: number;
}

interface SpeechSidebarProps {
  model: SpeechModel;
  setModel: (m: SpeechModel) => void;
  params: SpeechParams;
  setParams: (p: SpeechParams) => void;
  credits: number;
  maxCredits: number;
}

export function SpeechSidebarContent({
  model, setModel, params, setParams, credits, maxCredits,
}: SpeechSidebarProps) {
  const sliders: {
    key: keyof SpeechParams;
    label: string;
    min: number;
    max: number;
    step: number;
    fmt: (v: number) => string;
  }[] = [
    { key: 'stability',  label: '안정성', min: 0,   max: 1, step: 0.01, fmt: (v) => v.toFixed(2) },
    { key: 'similarity', label: '유사도', min: 0,   max: 1, step: 0.01, fmt: (v) => v.toFixed(2) },
    { key: 'style',      label: '스타일', min: 0,   max: 1, step: 0.01, fmt: (v) => v.toFixed(2) },
    { key: 'speed',      label: '속도',   min: 0.5, max: 2, step: 0.1,  fmt: (v) => `${v.toFixed(1)}x` },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-5 md:space-y-6">
      <SidebarCredits credits={credits} maxCredits={maxCredits} />

      {/* 모델 선택 */}
      <div className="space-y-2">
        <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1 mb-2 md:mb-3">모델</h4>

        {/* 모바일: 가로 2버튼 / 데스크탑: 세로 카드 */}
        <div className="flex md:hidden gap-2">
          {([
            { key: 'flash' as SpeechModel, name: 'Flash V2.5', badge: '권장' },
            { key: 'v3'    as SpeechModel, name: 'V3 Alpha',   badge: 'Alpha' },
          ] as const).map((m) => (
            <button
              key={m.key}
              onClick={() => setModel(m.key)}
              className={`flex-1 flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border transition-colors duration-150 cursor-pointer ${
                model === m.key
                  ? 'bg-indigo-500/15 border-indigo-500/40 text-white'
                  : 'bg-zinc-900/50 border-transparent text-zinc-400 hover:border-white/10 hover:text-zinc-200'
              }`}
            >
              <span className="text-xs font-bold">{m.name}</span>
              <span
                className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                  model === m.key ? 'bg-indigo-500/30 text-indigo-300' : 'bg-zinc-800 text-zinc-500'
                }`}
              >
                {m.badge}
              </span>
            </button>
          ))}
        </div>

        {/* 데스크탑: 세로 카드 (기존 스타일) */}
        <div className="hidden md:flex flex-col gap-2">
          {([
            { key: 'flash' as SpeechModel, name: 'Flash V2.5', desc: '빠른 속도, 실시간 대화용 (권장)', badge: '권장' },
            { key: 'v3'    as SpeechModel, name: 'V3 (Alpha)',  desc: '표현력+, 음성 분석형 가능성',   badge: 'Alpha' },
          ] as const).map((m) => (
            <button
              key={m.key}
              onClick={() => setModel(m.key)}
              className={`w-full text-left px-4 py-3.5 rounded-xl border transition-colors duration-150 cursor-pointer ${
                model === m.key
                  ? 'bg-indigo-500/15 border-indigo-500/40 text-white'
                  : 'bg-zinc-900/50 border-transparent text-zinc-400 hover:border-white/10 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold">{m.name}</span>
                <span
                  className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                    model === m.key ? 'bg-indigo-500/30 text-indigo-300' : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {m.badge}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 파라미터 슬라이더 */}
      <div className="space-y-4 md:space-y-5">
        <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">파라미터</h4>
        {sliders.map((s) => (
          <div key={s.key}>
            <div className="flex items-center justify-between mb-1.5 md:mb-2">
              <span className="text-xs text-zinc-400">{s.label}</span>
              <span className="text-xs font-bold text-indigo-400 font-mono">{s.fmt(params[s.key])}</span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={params[s.key]}
              onChange={(e) => setParams({ ...params, [s.key]: parseFloat(e.target.value) })}
              className="w-full h-1 cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-zinc-700">{s.min}</span>
              <span className="text-[9px] text-zinc-700">{s.max}</span>
            </div>
          </div>
        ))}
      </div>

      <SidebarUpgrade />
    </div>
  );
}
