import GradePermissionsPanel from './GradePermissionsPanel';

interface Theme {
  text: string;
  textMuted: string;
  textFaint: string;
}

interface GradeSettingsTabProps {
  isDark: boolean;
  t: Theme;
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  onJumpToUsers: () => void;
}

const GRADE_LABELS = [
  { label: '일반 회원', icon: 'ri-user-line', color: 'text-slate-400' },
  { label: '운영진', icon: 'ri-shield-star-line', color: 'text-violet-400' },
  { label: 'B2B 기업', icon: 'ri-building-2-line', color: 'text-amber-400' },
  { label: '단체 고객', icon: 'ri-group-line', color: 'text-emerald-400' },
  { label: 'VIP', icon: 'ri-vip-crown-line', color: 'text-orange-400' },
  { label: '이용 정지', icon: 'ri-forbid-line', color: 'text-red-400' },
];

export default function GradeSettingsTab({ isDark, t, onToast, onJumpToUsers }: GradeSettingsTabProps) {
  return (
    <div className="space-y-5">
      <div className={`flex items-start gap-4 px-5 py-4 rounded-2xl border ${isDark ? 'bg-violet-500/8 border-violet-500/20' : 'bg-violet-50 border-violet-200'}`}>
        <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center flex-shrink-0">
          <i className="ri-vip-crown-line text-violet-400 text-base" />
        </div>
        <div className="flex-1">
          <p className={`text-sm font-black ${t.text} mb-1`}>회원 등급 권한 설정</p>
          <p className={`text-xs ${t.textMuted} leading-relaxed`}>
            등급별로 이용 가능한 AI 기능, 서비스, 혜택을 세밀하게 설정할 수 있습니다.
            변경 사항은 즉시 DB에 저장되며, 해당 등급의 모든 회원에게 적용됩니다.
          </p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {GRADE_LABELS.map((g) => (
              <span key={g.label} className={`flex items-center gap-1 text-[11px] ${t.textFaint}`}>
                <i className={`${g.icon} ${g.color} text-xs`} />
                {g.label}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={onJumpToUsers}
          className={`flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap flex-shrink-0 ${isDark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-800'}`}
        >
          <i className="ri-user-3-line text-xs" />
          사용자 관리로
        </button>
      </div>

      <GradePermissionsPanel isDark={isDark} onToast={onToast} />
    </div>
  );
}
