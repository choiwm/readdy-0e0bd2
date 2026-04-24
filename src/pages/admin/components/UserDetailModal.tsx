import { useState } from 'react';
import { StatusBadge, PlanBadge } from './Badges';
import type { UserRecord, UserStatus } from '../types';

interface UserDetailModalProps {
  user: UserRecord;
  onClose: () => void;
  isDark: boolean;
  onCreditAdjust?: (userId: string, amount: string) => void;
  onStatusChange?: (userId: string, status: UserStatus) => void;
}

export default function UserDetailModal({
  user, onClose, isDark, onCreditAdjust, onStatusChange,
}: UserDetailModalProps) {
  const [creditAdjust, setCreditAdjust] = useState('');
  const m = {
    bg:       isDark ? 'bg-[#0f0f13]'    : 'bg-white',
    border:   isDark ? 'border-white/10' : 'border-gray-200',
    borderSub:isDark ? 'border-white/5'  : 'border-gray-100',
    text:     isDark ? 'text-white'      : 'text-slate-900',
    textSub:  isDark ? 'text-zinc-300'   : 'text-slate-600',
    textFaint:isDark ? 'text-zinc-500'   : 'text-slate-500',
    cardBg:   isDark ? 'bg-zinc-900/60'  : 'bg-slate-50',
    inputBg:  isDark ? 'bg-zinc-900 border-white/10 text-white placeholder-zinc-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400',
    closeBtn: isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-500 hover:text-slate-800',
    cancelBtn:isDark ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    labelText:isDark ? 'text-zinc-400'   : 'text-slate-600',
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className={`relative ${m.bg} border ${m.border} rounded-2xl w-full max-w-lg p-6 z-10`}>
        <div className="flex items-center justify-between mb-5">
          <h3 className={`text-base font-black ${m.text}`}>사용자 상세</h3>
          <button onClick={onClose} className={`w-7 h-7 flex items-center justify-center ${m.closeBtn} cursor-pointer transition-colors`}>
            <i className="ri-close-line text-lg" />
          </button>
        </div>
        <div className={`flex items-center gap-4 mb-5 pb-5 border-b ${m.borderSub}`}>
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-black text-indigo-300">{user.name[0]}</span>
          </div>
          <div>
            <p className={`text-base font-semibold ${m.text}`}>{user.name}</p>
            <p className={`text-sm ${m.textSub}`}>{user.email}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <PlanBadge plan={user.plan} isDark={isDark} />
              <StatusBadge status={user.status} isDark={isDark} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: '사용자 ID', value: user.id },
            { label: '가입일', value: user.joined },
            { label: '마지막 로그인', value: user.lastLogin },
            { label: '접속 IP', value: user.loginIp },
            { label: '총 프로젝트', value: `${user.projects}개` },
            { label: '보유 크레딧', value: `${user.credits.toLocaleString()} CR` },
          ].map((item) => (
            <div key={item.label} className={`${m.cardBg} rounded-xl p-3`}>
              <p className={`text-[10px] ${m.textFaint} mb-1`}>{item.label}</p>
              <p className={`text-xs font-semibold ${m.text}`}>{item.value}</p>
            </div>
          ))}
        </div>
        <div className="mb-5">
          <p className={`text-xs font-black ${m.labelText} mb-2`}>크레딧 수동 조정</p>
          <div className="flex gap-2">
            <input
              type="number"
              value={creditAdjust}
              onChange={(e) => setCreditAdjust(e.target.value)}
              placeholder="예: +500 또는 -200"
              className={`flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 ${m.inputBg}`}
            />
            <button
              onClick={() => {
                if (!creditAdjust.trim()) return;
                onCreditAdjust?.(user.id, creditAdjust);
                setCreditAdjust('');
                onClose();
              }}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
            >
              적용
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          {user.status === 'active' ? (
            <button
              onClick={() => { onStatusChange?.(user.id, 'suspended'); onClose(); }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap border ${isDark ? 'bg-red-500/15 border-red-500/25 text-red-400 hover:bg-red-500/25' : 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'}`}
            >
              <i className="ri-forbid-line mr-1.5" />계정 정지
            </button>
          ) : (
            <button
              onClick={() => { onStatusChange?.(user.id, 'active'); onClose(); }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap border ${isDark ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25' : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'}`}
            >
              <i className="ri-check-line mr-1.5" />계정 복구
            </button>
          )}
          <button onClick={onClose} className={`flex-1 py-2.5 ${m.cancelBtn} text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap`}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
