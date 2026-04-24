/* eslint-disable react-refresh/only-export-components */

export const styleOptions = [
  { id: 1, label: '미래도시', thumb: 'https://readdy.ai/api/search-image?query=futuristic%20city%20skyline%20at%20night%20with%20neon%20lights%20and%20flying%20vehicles%2C%20cyberpunk%20style%2C%20dark%20background&width=80&height=60&seq=auto1&orientation=landscape' },
  { id: 2, label: '자연풍경', thumb: 'https://readdy.ai/api/search-image?query=serene%20mountain%20landscape%20with%20misty%20valleys%20and%20golden%20sunrise%2C%20cinematic%20photography%20style&width=80&height=60&seq=auto2&orientation=landscape' },
  { id: 3, label: '미니멀', thumb: 'https://readdy.ai/api/search-image?query=minimalist%20white%20studio%20background%20with%20simple%20geometric%20shapes%20and%20soft%20shadows%2C%20clean%20modern%20aesthetic&width=80&height=60&seq=auto3&orientation=landscape' },
  { id: 4, label: '드라마틱', thumb: 'https://readdy.ai/api/search-image?query=dramatic%20cinematic%20scene%20with%20deep%20shadows%20and%20moody%20lighting%2C%20film%20noir%20style%2C%20dark%20atmosphere&width=80&height=60&seq=auto4&orientation=landscape' },
  { id: 5, label: '빈티지', thumb: 'https://readdy.ai/api/search-image?query=vintage%20retro%20aesthetic%20with%20warm%20film%20grain%20texture%2C%20faded%20colors%2C%20nostalgic%20photography%20style&width=80&height=60&seq=auto5&orientation=landscape' },
  { id: 6, label: '애니메이션', thumb: 'https://readdy.ai/api/search-image?query=colorful%20anime%20style%20illustration%20with%20vibrant%20colors%20and%20clean%20line%20art%2C%20Japanese%20animation%20aesthetic&width=80&height=60&seq=auto6&orientation=landscape' },
];

export const voiceList = [
  { id: 'v1', name: '명수', provider: 'ELEVENLABS' },
  { id: 'v2', name: '지수', provider: 'ELEVENLABS' },
  { id: 'v3', name: '민준', provider: 'CLOVA' },
  { id: 'v4', name: '서연', provider: 'CLOVA' },
];

export const imageModelList = [
  { id: 'flux-realism', label: 'Flux Realism', icon: 'ri-flashlight-line' },
  { id: 'flux-pro', label: 'Flux Pro', icon: 'ri-sparkling-2-line' },
  { id: 'flux-pro-ultra', label: 'Flux Pro Ultra', icon: 'ri-vip-crown-line' },
];

export const subtitleTemplates = [
  { id: 'youtube', label: '유튜브' },
  { id: 'preview', label: '자막 미리보기' },
  { id: 'minimal', label: '미니멀' },
  { id: 'bold', label: '볼드' },
];

export const subtitleStyles = [
  { id: 'default', color: 'bg-white' },
  { id: 'yellow', color: 'bg-yellow-400' },
  { id: 'green', color: 'bg-emerald-400' },
  { id: 'red', color: 'bg-red-400' },
  { id: 'cyan', color: 'bg-cyan-400' },
];

export interface YouTubeConfigContentProps {
  videoLength: number; setVideoLength: (v: number) => void;
  customLength: string; setCustomLength: (v: string) => void;
  speed: 'fast' | 'slow'; setSpeed: (v: 'fast' | 'slow') => void;
  voiceSpeed: 'normal' | 'fast'; setVoiceSpeed: (v: 'normal' | 'fast') => void;
  ratio: string; setRatio: (v: string) => void;
  selectedStyle: number | null; setSelectedStyle: (v: number | null) => void;
  selectedVoice: string; setSelectedVoice: (v: string) => void;
  voiceDropOpen: boolean; setVoiceDropOpen: (v: boolean) => void;
  imageModel: string; setImageModel: (v: string) => void;
  imageModelOpen: boolean; setImageModelOpen: (v: boolean) => void;
  videoCharacter: string; setVideoCharacter: (v: string) => void;
  videoCharOpen: boolean; setVideoCharOpen: (v: boolean) => void;
  subtitleEnabled: boolean; setSubtitleEnabled: (v: boolean) => void;
  subtitleStyle: string; setSubtitleStyle: (v: string) => void;
  subtitleTemplate: string; setSubtitleTemplate: (v: string) => void;
  subtitleTemplateOpen: boolean; setSubtitleTemplateOpen: (v: boolean) => void;
  isPlaying: boolean; setIsPlaying: (v: boolean) => void;
  onNavigate: () => void;
  closeDropdowns: () => void;
}

export default function YouTubeConfigContent({
  videoLength, setVideoLength, customLength, setCustomLength,
  speed, setSpeed, voiceSpeed, setVoiceSpeed, ratio, setRatio,
  selectedStyle, setSelectedStyle, selectedVoice, setSelectedVoice,
  voiceDropOpen, setVoiceDropOpen, imageModel, setImageModel,
  imageModelOpen, setImageModelOpen, videoCharacter, setVideoCharacter,
  videoCharOpen, setVideoCharOpen, subtitleEnabled, setSubtitleEnabled,
  subtitleStyle, setSubtitleStyle, subtitleTemplate, setSubtitleTemplate,
  subtitleTemplateOpen, setSubtitleTemplateOpen, isPlaying, setIsPlaying,
  onNavigate, closeDropdowns,
}: YouTubeConfigContentProps) {
  const currentVoice = voiceList.find((v) => v.id === selectedVoice)!;
  const currentImageModel = imageModelList.find((m) => m.id === imageModel)!;
  const currentSubtitleTemplate = subtitleTemplates.find((t) => t.id === subtitleTemplate)!;

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5" onClick={closeDropdowns}>
      {/* Style grid */}
      <div>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2.5">스타일 선택</p>
        <div className="grid grid-cols-3 gap-1.5">
          {styleOptions.map((s) => (
            <button
              key={s.id}
              onClick={(e) => { e.stopPropagation(); setSelectedStyle(selectedStyle === s.id ? null : s.id); }}
              className={`relative rounded-xl overflow-hidden cursor-pointer transition-all ${selectedStyle === s.id ? 'ring-2 ring-indigo-500' : 'hover:ring-1 hover:ring-zinc-600'}`}
            >
              <img src={s.thumb} alt={s.label} className="w-full h-[46px] object-cover" />
              <div className={`absolute inset-0 transition-all ${selectedStyle === s.id ? 'bg-indigo-500/30' : 'bg-black/20'}`} />
              {selectedStyle === s.id && (
                <div className="absolute top-1 right-1 w-3.5 h-3.5 bg-indigo-500 rounded-full flex items-center justify-center">
                  <i className="ri-check-line text-white text-[8px]" />
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                <p className="text-[9px] text-white font-bold truncate">{s.label}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="w-full h-px bg-white/5" />

      {/* 영상 길이 */}
      <div>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2.5">영상 길이</p>
        <div className="grid grid-cols-3 gap-1.5 mb-2.5">
          {[30, 60, 90].map((l) => (
            <button key={l} onClick={() => { setVideoLength(l); setCustomLength(String(l)); }}
              className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${videoLength === l ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-400' : 'bg-zinc-800/60 border border-white/5 text-zinc-400 hover:border-white/10 hover:text-zinc-200'}`}>
              {l}초
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-zinc-900/60 border border-white/5 rounded-xl px-3 py-2">
          <span className="text-[10px] text-zinc-600 whitespace-nowrap">직접 입력</span>
          <input type="number" min={10} max={600} value={customLength}
            onChange={(e) => { setCustomLength(e.target.value); const n = Number(e.target.value); if (!isNaN(n) && n > 0) setVideoLength(n); }}
            className="flex-1 bg-transparent text-xs text-white text-right focus:outline-none tabular-nums" />
          <span className="text-[10px] text-zinc-600">sec</span>
        </div>
      </div>

      <div className="w-full h-px bg-white/5" />

      {/* 기본 음성 */}
      <div>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2.5">기본 음성</p>
        <div className="relative mb-2" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setVoiceDropOpen(!voiceDropOpen)}
            className="w-full flex items-center justify-between gap-2 bg-zinc-900/60 border border-white/5 rounded-xl px-3 py-2.5 cursor-pointer hover:border-indigo-500/30 transition-all">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
              <span className="text-xs text-white font-medium">{currentVoice.name}</span>
              <span className="text-[10px] text-zinc-600">({currentVoice.provider})</span>
            </div>
            <i className={`ri-arrow-down-s-line text-zinc-500 text-sm transition-transform ${voiceDropOpen ? 'rotate-180' : ''}`} />
          </button>
          {voiceDropOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-xl shadow-xl z-30 overflow-hidden">
              {voiceList.map((v) => (
                <button key={v.id} onClick={() => { setSelectedVoice(v.id); setVoiceDropOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors cursor-pointer ${selectedVoice === v.id ? 'bg-indigo-500/15 text-indigo-300' : 'text-zinc-300 hover:bg-white/5'}`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                  <span className="font-medium">{v.name}</span>
                  <span className="text-[10px] text-zinc-600 ml-auto">({v.provider})</span>
                  {selectedVoice === v.id && <i className="ri-check-line text-indigo-400 text-[10px] ml-auto" />}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 bg-zinc-900/60 border border-white/5 rounded-xl px-3 py-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
          <span className="text-xs text-zinc-300 flex-1">{currentVoice.name} ({currentVoice.provider})</span>
          <button onClick={() => setIsPlaying(!isPlaying)}
            className="w-6 h-6 rounded-full bg-indigo-500 hover:bg-indigo-400 flex items-center justify-center transition-all cursor-pointer flex-shrink-0"
            aria-label={isPlaying ? '재생 중지' : '음성 재생'}>
            <i className={`${isPlaying ? 'ri-pause-fill' : 'ri-play-fill'} text-white text-xs ${isPlaying ? '' : 'ml-px'}`} />
          </button>
        </div>
      </div>

      <div className="w-full h-px bg-white/5" />

      {/* 음성 빠르기 */}
      <div>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2.5">음성 빠르기</p>
        <div className="grid grid-cols-2 gap-1.5">
          {(['normal', 'fast'] as const).map((s) => (
            <button key={s} onClick={() => setVoiceSpeed(s)}
              className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${voiceSpeed === s ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-400' : 'bg-zinc-800/60 border border-white/5 text-zinc-400 hover:border-white/10 hover:text-zinc-200'}`}>
              {s === 'normal' ? '보통' : '빠르게'}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full h-px bg-white/5" />

      {/* 컷전환 속도 */}
      <div>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2.5">컷전환 속도</p>
        <div className="grid grid-cols-2 gap-1.5">
          {(['fast', 'slow'] as const).map((s) => (
            <button key={s} onClick={() => setSpeed(s)}
              className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${speed === s ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-400' : 'bg-zinc-800/60 border border-white/5 text-zinc-400 hover:border-white/10 hover:text-zinc-200'}`}>
              {s === 'fast' ? '빠르게' : '느리게'}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-zinc-600 mt-1.5">{speed === 'fast' ? '~5초마다 컷 전환' : '~3-4문장마다 컷 전환'}</p>
      </div>

      <div className="w-full h-px bg-white/5" />

      {/* 이미지 생성 모델 */}
      <div>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2.5">이미지 생성 모델</p>
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setImageModelOpen(!imageModelOpen)}
            className="w-full flex items-center justify-between gap-2 bg-zinc-900/60 border border-white/5 rounded-xl px-3 py-2.5 cursor-pointer hover:border-indigo-500/30 transition-all">
            <div className="flex items-center gap-2">
              <i className={`${currentImageModel.icon} text-indigo-400 text-sm`} />
              <span className="text-xs text-white">{currentImageModel.label}</span>
            </div>
            <i className={`ri-arrow-down-s-line text-zinc-500 text-sm transition-transform ${imageModelOpen ? 'rotate-180' : ''}`} />
          </button>
          {imageModelOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-xl shadow-xl z-30 overflow-hidden">
              {imageModelList.map((m) => (
                <button key={m.id} onClick={() => { setImageModel(m.id); setImageModelOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors cursor-pointer ${imageModel === m.id ? 'bg-indigo-500/15 text-indigo-300' : 'text-zinc-300 hover:bg-white/5'}`}>
                  <i className={`${m.icon} text-xs`} /> {m.label}
                  {imageModel === m.id && <i className="ri-check-line text-indigo-400 text-[10px] ml-auto" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 영상 생성 캐릭터 */}
      <div>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2.5">영상 생성 캐릭터</p>
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setVideoCharOpen(!videoCharOpen)}
            className="w-full flex items-center justify-between gap-2 bg-zinc-900/60 border border-white/5 rounded-xl px-3 py-2.5 cursor-pointer hover:border-indigo-500/30 transition-all">
            <div className="flex items-center gap-2">
              <i className="ri-user-star-line text-zinc-500 text-sm" />
              <span className={`text-xs ${videoCharacter ? 'text-white' : 'text-zinc-500'}`}>{videoCharacter || '캐릭터 선택'}</span>
            </div>
            <i className={`ri-arrow-down-s-line text-zinc-500 text-sm transition-transform ${videoCharOpen ? 'rotate-180' : ''}`} />
          </button>
          {videoCharOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-xl shadow-xl z-30 overflow-hidden">
              <button onClick={() => { setVideoCharacter(''); setVideoCharOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-zinc-500 hover:bg-white/5 cursor-pointer">
                <i className="ri-close-line text-xs" /> 선택 안함
              </button>
              {['다은', '소희', '준혁', '태민', '강민'].map((name) => (
                <button key={name} onClick={() => { setVideoCharacter(name); setVideoCharOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors cursor-pointer ${videoCharacter === name ? 'bg-indigo-500/15 text-indigo-300' : 'text-zinc-300 hover:bg-white/5'}`}>
                  <i className="ri-user-line text-xs" /> {name}
                  {videoCharacter === name && <i className="ri-check-line text-indigo-400 text-[10px] ml-auto" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="w-full h-px bg-white/5" />

      {/* 자막 설정 */}
      <div>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">자막 설정</p>
        <div className="flex items-center justify-between gap-3 mb-3 px-3 py-2.5 bg-zinc-900/60 border border-white/5 rounded-xl">
          <div>
            <p className="text-xs text-white font-bold">자막 포함</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">자동 자막 생성</p>
          </div>
          <button onClick={() => setSubtitleEnabled(!subtitleEnabled)}
            aria-pressed={subtitleEnabled} aria-label="자막 포함 토글"
            className={`relative w-9 h-5 rounded-full transition-all cursor-pointer flex-shrink-0 ${subtitleEnabled ? 'bg-indigo-500' : 'bg-zinc-700'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${subtitleEnabled ? 'left-4' : 'left-0.5'}`} />
          </button>
        </div>
        {subtitleEnabled && (
          <>
            <div className="flex items-center gap-2 mb-3 px-1">
              {subtitleStyles.map((st) => (
                <button key={st.id} onClick={() => setSubtitleStyle(st.id)} title={st.id}
                  aria-label={`${st.id} 자막 색상`}
                  className={`w-5 h-5 rounded-full ${st.color} transition-all cursor-pointer flex-shrink-0 ${subtitleStyle === st.id ? 'ring-2 ring-offset-1 ring-offset-[#111113] ring-indigo-400 scale-110' : 'opacity-50 hover:opacity-100'}`} />
              ))}
            </div>
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setSubtitleTemplateOpen(!subtitleTemplateOpen)}
                className="w-full flex items-center justify-between gap-2 bg-zinc-900/60 border border-white/5 rounded-xl px-3 py-2.5 cursor-pointer hover:border-indigo-500/30 transition-all">
                <span className="text-xs text-zinc-300">{currentSubtitleTemplate.label}</span>
                <i className={`ri-arrow-down-s-line text-zinc-500 text-sm transition-transform ${subtitleTemplateOpen ? 'rotate-180' : ''}`} />
              </button>
              {subtitleTemplateOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-xl shadow-xl z-30 overflow-hidden">
                  {subtitleTemplates.map((tpl) => (
                    <button key={tpl.id} onClick={() => { setSubtitleTemplate(tpl.id); setSubtitleTemplateOpen(false); }}
                      className={`w-full flex items-center px-3 py-2.5 text-xs transition-colors cursor-pointer ${subtitleTemplate === tpl.id ? 'bg-indigo-500/15 text-indigo-300' : 'text-zinc-300 hover:bg-white/5'}`}>
                      {tpl.label}
                      {subtitleTemplate === tpl.id && <i className="ri-check-line text-indigo-400 text-[10px] ml-auto" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="w-full h-px bg-white/5" />

      {/* 화면 비율 */}
      <div>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2.5">화면 비율</p>
        <div className="grid grid-cols-4 gap-1.5">
          {['16:9', '9:16', '1:1', '3:4'].map((r) => (
            <button key={r} onClick={() => setRatio(r)}
              className={`flex flex-col items-center py-2.5 rounded-xl border transition-all cursor-pointer ${ratio === r ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400' : 'border-white/5 text-zinc-500 hover:border-white/10 hover:text-zinc-300'}`}>
              <div className={`border-2 mb-1 ${ratio === r ? 'border-indigo-400' : 'border-zinc-600'} ${r === '9:16' ? 'w-6 h-4' : r === '16:9' ? 'w-4 h-5' : r === '1:1' ? 'w-4 h-4' : 'w-3 h-4'} rounded-sm`} />
              <span className="text-[9px] font-bold">{r}</span>
            </button>
          ))}
        </div>
      </div>

      {/* New project button */}
      <button
        onClick={onNavigate}
        className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-bold text-sm rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
      >
        <i className="ri-add-line" />
        새 영상 제작 시작
      </button>
    </div>
  );
}
