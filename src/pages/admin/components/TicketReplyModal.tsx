import { useState } from 'react';
import type { CsTicket } from '../types';
import { PriorityBadge, StatusBadge } from './Badges';

interface Props {
  ticket: CsTicket;
  onClose: () => void;
  onStatusChange: (ticketId: string, status: string) => void;
  isDark: boolean;
}

export default function TicketReplyModal({ ticket, onClose, onStatusChange, isDark }: Props) {
  const [reply, setReply] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const m = {
    bg:        isDark ? 'bg-[#0f0f13]'    : 'bg-white',
    border:    isDark ? 'border-white/10' : 'border-gray-200',
    borderSub: isDark ? 'border-white/5'  : 'border-gray-100',
    text:      isDark ? 'text-white'      : 'text-gray-900',
    textSub:   isDark ? 'text-zinc-500'   : 'text-gray-500',
    textFaint: isDark ? 'text-zinc-600'   : 'text-gray-400',
    cardBg:    isDark ? 'bg-zinc-900/60'  : 'bg-gray-50',
    inputBg:   isDark ? 'bg-zinc-900 border-white/10 text-white placeholder-zinc-600' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400',
    closeBtn:  isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-400 hover:text-gray-700',
    cancelBtn: isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
  };

  const handleSubmit = () => {
    if (!reply.trim()) return;
    onStatusChange(ticket.id, 'closed');
    setSubmitted(true);
    setTimeout(onClose, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className={`relative ${m.bg} border ${m.border} rounded-2xl w-full max-w-lg p-6 z-10`}>
        <div className="flex items-center justify-between mb-5">
          <h3 className={`text-base font-black ${m.text}`}>티켓 답변</h3>
          <button onClick={onClose} className={`w-7 h-7 flex items-center justify-center ${m.closeBtn} cursor-pointer transition-colors`}>
            <i className="ri-close-line text-lg" />
          </button>
        </div>

        {/* Ticket Info */}
        <div className={`${m.cardBg} rounded-xl p-4 mb-4`}>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`text-xs font-mono ${m.textFaint}`}>{ticket.id}</span>
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
          </div>
          <p className={`text-sm font-semibold ${m.text} mb-1`}>{ticket.subject}</p>
          <p className={`text-[11px] ${m.textFaint}`}>{ticket.user} · {ticket.date}</p>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <i className="ri-checkbox-circle-fill text-emerald-400 text-2xl" />
            </div>
            <p className={`text-sm font-bold ${m.text}`}>답변이 전송됐습니다</p>
            <p className={`text-xs ${m.textFaint}`}>티켓이 완료 처리됐습니다</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className={`text-xs font-semibold ${m.textSub} mb-1.5 block`}>답변 내용</label>
              <textarea
                rows={5}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="사용자에게 전달할 답변을 입력하세요..."
                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 resize-none ${m.inputBg}`}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={!reply.trim()}
                className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
              >
                <i className="ri-send-plane-line mr-1.5" />답변 전송 & 완료 처리
              </button>
              <button onClick={onClose} className={`flex-1 py-2.5 ${m.cancelBtn} text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap`}>
                취소
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
