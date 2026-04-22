import { useState } from 'react';

interface Props {
  type: 'email' | 'push';
  onClose: () => void;
  onSend: (msg: string) => void;
  isDark: boolean;
}

export default function PushMailModal({ type, onClose, onSend, isDark }: Props) {
  const [target, setTarget] = useState('전체');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sent, setSent] = useState(false);

  const m = {
    bg:        isDark ? 'bg-[#0f0f13]'    : 'bg-white',
    border:    isDark ? 'border-white/10' : 'border-gray-200',
    text:      isDark ? 'text-white'      : 'text-gray-900',
    textSub:   isDark ? 'text-zinc-500'   : 'text-gray-500',
    inputBg:   isDark ? 'bg-zinc-900 border-white/10 text-white placeholder-zinc-600' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400',
    closeBtn:  isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-400 hover:text-gray-700',
    cancelBtn: isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
    selectBg:  isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900',
  };

  const isEmail = type === 'email';

  const handleSend = () => {
    if (!body.trim()) return;
    setSent(true);
    onSend(`${isEmail ? '이메일' : '푸시 알림'}이 ${target} 대상으로 발송됐습니다`);
    setTimeout(onClose, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className={`relative ${m.bg} border ${m.border} rounded-2xl w-full max-w-md p-6 z-10`}>
        <div className="flex items-center justify-between mb-5">
          <h3 className={`text-base font-black ${m.text}`}>{isEmail ? '이메일 발송' : '브라우저 푸시 발송'}</h3>
          <button onClick={onClose} className={`w-7 h-7 flex items-center justify-center ${m.closeBtn} cursor-pointer transition-colors`}>
            <i className="ri-close-line text-lg" />
          </button>
        </div>

        {sent ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <i className="ri-checkbox-circle-fill text-emerald-400 text-2xl" />
            </div>
            <p className={`text-sm font-bold ${m.text}`}>발송 완료!</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className={`text-xs font-semibold ${m.textSub} mb-1.5 block`}>발송 대상</label>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 cursor-pointer ${m.selectBg}`}
              >
                <option>전체</option>
                <option>Free 플랜</option>
                <option>Pro 플랜</option>
                <option>Enterprise 플랜</option>
                <option>비활성 사용자</option>
                <option>구독 만료 예정자</option>
              </select>
            </div>
            {isEmail && (
              <div>
                <label className={`text-xs font-semibold ${m.textSub} mb-1.5 block`}>제목</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="이메일 제목 입력..."
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 ${m.inputBg}`}
                />
              </div>
            )}
            <div>
              <label className={`text-xs font-semibold ${m.textSub} mb-1.5 block`}>내용</label>
              <textarea
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={isEmail ? '이메일 본문을 입력하세요...' : '푸시 알림 내용을 입력하세요...'}
                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 resize-none ${m.inputBg}`}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSend}
                disabled={!body.trim()}
                className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
              >
                <i className={`${isEmail ? 'ri-mail-send-line' : 'ri-notification-3-line'} mr-1.5`} />
                {isEmail ? '이메일 발송' : '푸시 발송'}
              </button>
              <button onClick={onClose} className={`flex-1 py-2.5 ${m.cancelBtn} text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap`}>
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
