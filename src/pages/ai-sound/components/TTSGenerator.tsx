import { useState } from 'react';
import { voices } from '@/mocks/voiceLibrary';

interface TTSGeneratorProps {
  onGenerateStart?: (id: string, title: string, text: string, voice: typeof voices[0]) => void;
  onGenerateComplete?: (id: string) => void;
}

export default function TTSGenerator({ onGenerateStart, onGenerateComplete }: TTSGeneratorProps) {
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(voices[0]);
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [title, setTitle] = useState('');

  const charLimit = 500;

  const handleGenerate = () => {
    if (!text.trim()) return;
    setIsGenerating(true);
    const t = title.trim() || text.slice(0, 20) + '...';
    const newId = `tts-${Date.now()}`;
    onGenerateStart?.(newId, t, text, selectedVoice);
    setTimeout(() => {
      setIsGenerating(false);
      onGenerateComplete?.(newId);
      setText('');
      setTitle('');
    }, 2500);
  };

  return (
    <div className="bg-[#111113] border border-white/5 rounded-2xl p-3 md:p-4 mb-3 md:mb-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2.5 md:mb-3">
        <div className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-lg bg-indigo-500/15">
          <i className="ri-chat-voice-line text-indigo-400 text-xs md:text-sm" />
        </div>
        <span className="text-xs md:text-sm font-bold text-white">텍스트 → 음성 생성</span>
      </div>

      {/* Title */}
      <div className="mb-2.5 md:mb-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목 (선택사항)"
          className="w-full bg-zinc-900/60 border border-white/5 text-zinc-300 text-xs px-3 py-1.5 md:py-2 rounded-lg outline-none focus:border-indigo-500/40 transition-colors placeholder-zinc-600"
        />
      </div>

      {/* Text area */}
      <div className="relative mb-2.5 md:mb-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, charLimit))}
          placeholder="음성으로 변환할 텍스트를 입력하세요..."
          className="w-full bg-zinc-900/60 border border-white/5 text-zinc-300 text-xs px-3 py-2 md:py-2.5 rounded-xl outline-none focus:border-indigo-500/40 transition-colors resize-none h-20 md:h-24 leading-relaxed placeholder-zinc-600"
        />
        <div
          className={`absolute bottom-2 right-3 text-[10px] ${
            text.length > charLimit * 0.9 ? 'text-indigo-400' : 'text-zinc-600'
          }`}
        >
          {text.length}/{charLimit}
        </div>
      </div>

      {/* Voice selector */}
      <div className="relative mb-2.5 md:mb-3">
        <button
          onClick={() => setShowVoicePicker(!showVoicePicker)}
          className="w-full flex items-center gap-2 bg-zinc-900/60 border border-white/5 rounded-xl px-3 py-1.5 md:py-2 hover:border-indigo-500/30 transition-colors cursor-pointer"
        >
          <img
            src={selectedVoice.avatar}
            alt={selectedVoice.name}
            className="w-5 h-5 md:w-6 md:h-6 rounded-full object-cover flex-shrink-0"
          />
          <div className="flex-1 text-left min-w-0">
            <p className="text-xs font-bold text-white truncate">{selectedVoice.name}</p>
            <p className="text-[10px] text-zinc-500 truncate">{selectedVoice.lang} · {selectedVoice.gender}</p>
          </div>
          <i className={`${showVoicePicker ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} text-zinc-500 text-sm flex-shrink-0`} />
        </button>

        {showVoicePicker && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-20 max-h-44 md:max-h-48 overflow-y-auto">
            {voices.slice(0, 12).map((v) => (
              <button
                key={v.id}
                onClick={() => { setSelectedVoice(v); setShowVoicePicker(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 md:py-2.5 hover:bg-white/5 transition-colors cursor-pointer ${
                  selectedVoice.id === v.id ? 'bg-indigo-500/10' : ''
                }`}
              >
                <img src={v.avatar} alt={v.name} className="w-5 h-5 md:w-6 md:h-6 rounded-full object-cover flex-shrink-0" />
                <div className="flex-1 text-left min-w-0">
                  <p className="text-xs text-white font-bold truncate">{v.name}</p>
                  <p className="text-[10px] text-zinc-500">{v.lang}</p>
                </div>
                {selectedVoice.id === v.id && <i className="ri-check-line text-indigo-400 text-xs flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Speed & Pitch */}
      <div className="grid grid-cols-2 gap-2 mb-2.5 md:mb-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-zinc-500">속도</span>
            <span className="text-[10px] text-indigo-400 font-bold">{speed.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="w-full h-1 accent-indigo-500 cursor-pointer"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-zinc-500">피치</span>
            <span className="text-[10px] text-indigo-400 font-bold">{pitch > 0 ? `+${pitch}` : pitch}</span>
          </div>
          <input
            type="range"
            min="-5"
            max="5"
            step="1"
            value={pitch}
            onChange={(e) => setPitch(parseInt(e.target.value))}
            className="w-full h-1 accent-indigo-500 cursor-pointer"
          />
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!text.trim() || isGenerating}
        className="w-full py-2 md:py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs md:text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
      >
        {isGenerating ? (
          <>
            <div className="w-3.5 h-3.5 md:w-4 md:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            생성 중...
          </>
        ) : (
          <>
            <i className="ri-sparkling-2-line" />
            음성 생성
          </>
        )}
      </button>
    </div>
  );
}
