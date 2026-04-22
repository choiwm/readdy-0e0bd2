import type { IpBlock, AdminAccount } from '../types';
import { SectionHeader } from './AdminHelpers';

interface Theme {
  cardBg: string;
  cardBg2: string;
  border: string;
  border2: string;
  text: string;
  textSub: string;
  textMuted: string;
  textFaint: string;
  inputBg: string;
  inputBg2: string;
  rowHover: string;
  divider: string;
}

interface SecurityTabProps {
  isDark: boolean;
  t: Theme;

  displayIpBlocks: IpBlock[];
  displayAdminAccounts: AdminAccount[];
  auditTodayCount: number;

  onOpenAddAdmin: () => void;
  onOpenEditPerm: (admin: AdminAccount) => void;
  onForce2FA: (adminId: string, adminName: string) => void;

  autoBlock: boolean;
  setAutoBlock: (updater: (v: boolean) => boolean) => void;

  ipBlockInput: string;
  setIpBlockInput: (v: string) => void;
  ipBlockReason: string;
  setIpBlockReason: (v: string) => void;
  onIpBlock: () => void;
  onIpUnblock: (ip: string) => void;
}

export default function SecurityTab({
  isDark, t,
  displayIpBlocks, displayAdminAccounts, auditTodayCount,
  onOpenAddAdmin, onOpenEditPerm, onForce2FA,
  autoBlock, setAutoBlock,
  ipBlockInput, setIpBlockInput, ipBlockReason, setIpBlockReason,
  onIpBlock, onIpUnblock,
}: SecurityTabProps) {
  const summary = [
    { label: '차단된 IP', value: `${displayIpBlocks.filter((b) => b.status === 'active').length}개`, icon: 'ri-forbid-2-line', color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: '2FA 활성 관리자', value: `${displayAdminAccounts.filter((a) => a.twofa).length}/${displayAdminAccounts.length}명`, icon: 'ri-shield-check-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: '전체 관리자', value: `${displayAdminAccounts.length}명`, icon: 'ri-login-box-line', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: '감사 로그 (오늘)', value: auditTodayCount > 0 ? `${auditTodayCount}건` : '-', icon: 'ri-alarm-warning-line', color: 'text-red-400', bg: 'bg-red-500/10' },
  ];

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summary.map((c) => (
          <div key={c.label} className={`${t.cardBg} border ${t.border} rounded-2xl p-4`}>
            <div className={`w-8 h-8 rounded-xl ${c.bg} flex items-center justify-center mb-2`}>
              <i className={`${c.icon} ${c.color} text-sm`} />
            </div>
            <p className={`text-lg font-black ${t.text}`}>{c.value}</p>
            <p className={`text-[11px] ${t.textMuted}`}>{c.label}</p>
          </div>
        ))}
      </div>

      <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
        <div className={`px-5 py-4 border-b ${t.border} flex items-center justify-between`}>
          <div>
            <p className={`text-sm font-black ${t.text}`}>관리자 계정 & 2FA 설정</p>
            <p className={`text-xs ${t.textMuted} mt-0.5`}>역할 기반 접근 제어 (RBAC)</p>
          </div>
          <button
            onClick={onOpenAddAdmin}
            className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-user-add-line text-xs" />
            관리자 추가
          </button>
        </div>
        <div className="divide-y divide-white/[0.03]">
          {displayAdminAccounts.length === 0 && (
            <div className={`flex flex-col items-center justify-center py-14 ${t.textFaint}`}>
              <i className="ri-user-star-line text-3xl mb-3" />
              <p className={`text-sm font-semibold ${t.textMuted}`}>등록된 관리자 계정이 없습니다</p>
              <p className="text-xs mt-1">위 버튼으로 관리자를 추가하세요</p>
            </div>
          )}
          {displayAdminAccounts.map((admin) => (
            <div key={admin.id} className={`px-5 py-4 flex items-center gap-4 ${t.rowHover} transition-colors group`}>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-black text-indigo-300">{admin.name.slice(-1)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className={`text-sm font-semibold ${t.text}`}>{admin.name}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    admin.role === 'Super Admin' ? 'bg-amber-500/15 text-amber-400' :
                    admin.role === 'CS Manager' ? 'bg-indigo-500/15 text-indigo-400' :
                    'bg-emerald-500/15 text-emerald-400'
                  }`}>{admin.role}</span>
                  <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${admin.twofa ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    <i className={`${admin.twofa ? 'ri-shield-check-line' : 'ri-shield-cross-line'} text-[10px]`} />
                    2FA {admin.twofa ? '활성' : '미설정'}
                  </div>
                </div>
                <p className={`text-[11px] ${t.textFaint}`}>{admin.email} · 마지막 로그인 {admin.lastLogin} ({admin.loginIp})</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {admin.permissions.map((p) => (
                    <span key={p} className={`text-[9px] ${t.inputBg2} ${t.textMuted} px-1.5 py-0.5 rounded-full`}>{p}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                  onClick={() => onOpenEditPerm(admin)}
                  className={`px-2.5 py-1.5 rounded-lg ${t.inputBg2} hover:opacity-80 ${t.textSub} text-[10px] font-semibold cursor-pointer transition-colors whitespace-nowrap`}
                >
                  권한 수정
                </button>
                {!admin.twofa && (
                  <button
                    onClick={() => onForce2FA(admin.id, admin.name)}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[10px] font-semibold cursor-pointer transition-colors whitespace-nowrap"
                  >
                    2FA 강제 설정
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
        <SectionHeader title="자동 차단 설정" subtitle="비정상 접근 자동 감지 및 차단" isDark={isDark} />
        <div className={`flex items-center justify-between p-4 rounded-xl ${t.cardBg2} border ${t.border} mb-4`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${t.inputBg2} flex items-center justify-center`}>
              <i className={`ri-robot-line ${t.textMuted} text-sm`} />
            </div>
            <div>
              <p className={`text-sm font-semibold ${t.text}`}>자동 IP 차단</p>
              <p className={`text-xs ${t.textMuted}`}>로그인 5회 실패 시 IP 자동 차단 (30분)</p>
            </div>
          </div>
          <button
            onClick={() => setAutoBlock((v) => !v)}
            aria-label="자동 IP 차단 토글"
            aria-pressed={autoBlock}
            className={`w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 relative ${autoBlock ? 'bg-indigo-500' : 'bg-zinc-700'}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${autoBlock ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
        <div className={`px-5 py-4 border-b ${t.border}`}>
          <p className={`text-sm font-black ${t.text}`}>IP 차단 목록</p>
          <p className={`text-xs ${t.textMuted} mt-0.5`}>수동 등록 및 자동 차단 IP 관리</p>
        </div>
        <div className={`px-5 py-4 border-b ${t.border} ${t.cardBg2}`}>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={ipBlockInput}
              onChange={(e) => setIpBlockInput(e.target.value)}
              placeholder="차단할 IP 주소 (예: 192.168.1.100)"
              aria-label="차단할 IP 주소"
              className={`flex-1 ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-gray-400'} focus:outline-none focus:border-indigo-500/50 font-mono`}
            />
            <input
              type="text"
              value={ipBlockReason}
              onChange={(e) => setIpBlockReason(e.target.value)}
              placeholder="차단 사유"
              aria-label="차단 사유"
              className={`flex-1 ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-gray-400'} focus:outline-none focus:border-indigo-500/50`}
            />
            <button
              onClick={onIpBlock}
              className="px-4 py-2.5 bg-red-500/80 hover:bg-red-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-forbid-2-line mr-1.5" />
              IP 차단
            </button>
          </div>
        </div>
        <div className={`divide-y ${t.divider}`}>
          {displayIpBlocks.length === 0 && (
            <div className={`flex flex-col items-center justify-center py-12 ${t.textFaint}`}>
              <i className="ri-shield-check-line text-3xl mb-3 text-emerald-500/50" />
              <p className={`text-sm font-semibold ${t.textMuted}`}>차단된 IP가 없습니다</p>
              <p className="text-xs mt-1">위 입력창으로 IP를 차단할 수 있습니다</p>
            </div>
          )}
          {displayIpBlocks.map((item) => (
            <div key={item.ip} className={`px-5 py-4 flex items-center gap-4 ${t.rowHover} transition-colors group`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${item.status === 'active' ? 'bg-red-500/10' : t.inputBg2}`}>
                <i className={`ri-forbid-2-line text-sm ${item.status === 'active' ? 'text-red-400' : t.textFaint}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-sm font-mono font-semibold ${t.text}`}>{item.ip}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.status === 'active' ? 'bg-red-500/15 text-red-400' : `${t.cardBg2} ${t.textMuted}`}`}>
                    {item.status === 'active' ? '차단 중' : '해제됨'}
                  </span>
                </div>
                <p className={`text-[11px] ${t.textFaint}`}>{item.reason} · {item.blockedAt} · {item.blockedBy}</p>
              </div>
              {item.status === 'active' && (
                <button
                  onClick={() => onIpUnblock(item.ip)}
                  className={`px-2.5 py-1.5 rounded-lg ${t.inputBg2} hover:opacity-80 ${t.textSub} text-[10px] font-semibold cursor-pointer transition-colors opacity-0 group-hover:opacity-100 whitespace-nowrap`}
                >
                  차단 해제
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
