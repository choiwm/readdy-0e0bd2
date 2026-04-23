import { useState } from 'react';

export default function AIScenarioModal({ onClose, onGenerate }: { onClose: () => void; onGenerate: (s: string, c: number) => void }) {
  const [scenario, setScenario] = useState(''); const [count, setCount] = useState(4); const [autoGen, setAutoGen] = useState(true);
  const examples = ['새벽 카페에서 바리스타가 첫 손님을 맞이하며 하루를 시작하는 이야기. 따뜻한 조명과 커피 향이 가득한 공간.', '우주 탐험가가 미지의 행성에 착륙해 외계 생명체와 조우하는 장면.', '도시의 옥상에서 두 연인이 마지막 작별을 고하는 감성적인 씬.'];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#111113] border border-white/10 rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2"><i className="ri-sparkling-2-line text-indigo-400" /><span className="text-sm font-bold text-white">AI 시나리오 추가</span></div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer"><i className="ri-close-line" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div><label className="text-[11px] font-black text-zinc-500 uppercase tracking-wider mb-2 block">시나리오</label><textarea value={scenario} onChange={(e) => setScenario(e.target.value)} placeholder="영상의 스토리, 장면 흐름을 자연스럽게 입력하세요..." className="w-full bg-zinc-900/60 border border-white/5 rounded-xl px-4 py-3 text-sm text-zinc-300 placeholder-zinc-600 resize-none outline-none focus:border-indigo-500/30 transition-colors min-h-[90px] leading-relaxed" /></div>
          <div><label className="text-[11px] font-black text-zinc-500 uppercase tracking-wider mb-2 block">예시 시나리오</label><div className="space-y-1.5">{examples.map((ex, i) => <button key={i} onClick={() => setScenario(ex)} className="w-full text-left text-[11px] text-zinc-400 hover:text-white bg-zinc-900/40 hover:bg-zinc-900 border border-white/5 hover:border-indigo-500/20 rounded-xl px-3 py-2.5 transition-all cursor-pointer leading-relaxed">{ex}</button>)}</div></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11px] font-black text-zinc-500 uppercase tracking-wider mb-2 block">생성할 컷 수</label><div className="flex gap-1.5">{[2, 4, 6, 8].map((n) => <button key={n} onClick={() => setCount(n)} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${count === n ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-400' : 'bg-zinc-800/60 border border-white/5 text-zinc-400 hover:text-white'}`}>{n}</button>)}</div></div>
            <div><label className="text-[11px] font-black text-zinc-500 uppercase tracking-wider mb-2 block">자동 이미지 생성</label><button onClick={() => setAutoGen(!autoGen)} className={`w-full py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${autoGen ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400' : 'bg-zinc-800/60 border-white/5 text-zinc-400'}`}>{autoGen ? '켜짐 — 바로 생성' : '꺼짐 — 나중에 생성'}</button></div>
          </div>
        </div>
        <div className="px-5 pb-5"><button onClick={() => { if (scenario.trim()) { onGenerate(scenario, count); onClose(); } }} disabled={!scenario.trim()} className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"><i className="ri-sparkling-2-line" />{autoGen ? `${count}컷 생성 + 이미지 자동 생성` : `${count}컷 추가`}</button></div>
      </div>
    </div>
  );
}
