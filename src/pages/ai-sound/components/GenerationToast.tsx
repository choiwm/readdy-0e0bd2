export interface ToastItem {
  id: string;
  title: string;
  voiceName: string;
  voiceAvatar: string;
  duration: number;
  type: 'tts' | 'clone' | 'effect' | 'music';
}

const TOAST_TYPE_CONFIG = {
  tts:    { label: 'TTS',   icon: 'ri-chat-voice-line',   color: 'text-indigo-400',  bg: 'bg-indigo-500/15',  border: 'border-indigo-500/30' },
  clone:  { label: 'Clone', icon: 'ri-user-voice-line',   color: 'text-violet-400',  bg: 'bg-violet-500/15',  border: 'border-violet-500/30' },
  effect: { label: 'SFX',   icon: 'ri-sound-module-line', color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  music:  { label: 'Music', icon: 'ri-music-2-line',      color: 'text-pink-400',    bg: 'bg-pink-500/15',    border: 'border-pink-500/30' },
};

interface GenerationToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export default function GenerationToast({ toasts, onDismiss }: GenerationToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const cfg = TOAST_TYPE_CONFIG[toast.type];
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-900/95 border border-white/10 backdrop-blur-xl shadow-2xl min-w-[300px] max-w-[360px]"
          >
            <div className="relative flex-shrink-0">
              <img src={toast.voiceAvatar} alt={toast.voiceName} className="w-9 h-9 rounded-full object-cover" />
              <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ${cfg.bg} border ${cfg.border} flex items-center justify-center`}>
                <i className={`${cfg.icon} text-[8px] ${cfg.color}`} />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">생성 완료</span>
                <span className={`text-[9px] font-black px-1.5 py-px rounded-md ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                  {cfg.label}
                </span>
              </div>
              <p className="text-xs font-bold text-white truncate">{toast.title}</p>
              <p className="text-[10px] text-zinc-500">{toast.voiceName} · {toast.duration}s</p>
            </div>

            <div className="flex items-center gap-[2px] h-6 flex-shrink-0">
              {[3, 6, 4, 8, 5, 7, 3, 6].map((h, i) => (
                <div
                  key={i}
                  className={`w-[2px] rounded-full ${cfg.color.replace('text-', 'bg-')} animate-pulse`}
                  style={{ height: `${h * 2}px`, animationDelay: `${i * 80}ms`, opacity: 0.7 }}
                />
              ))}
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-zinc-600 hover:text-white hover:bg-white/10 transition-all cursor-pointer flex-shrink-0"
            >
              <i className="ri-close-line text-xs" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
