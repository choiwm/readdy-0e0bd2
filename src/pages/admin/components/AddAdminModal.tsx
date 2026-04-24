import type { AdminTheme } from '../hooks/useAdminTheme';

interface AddAdminModalProps {
  isDark: boolean;
  t: AdminTheme;
  newAdminName: string;
  setNewAdminName: (v: string) => void;
  newAdminEmail: string;
  setNewAdminEmail: (v: string) => void;
  newAdminRole: string;
  setNewAdminRole: (v: string) => void;
  newAdminPerms: string[];
  setNewAdminPerms: React.Dispatch<React.SetStateAction<string[]>>;
  onCreate: () => void;
  onClose: () => void;
}

const PERMISSION_OPTIONS = ['사용자 관리', 'AI 콘텐츠', 'AI 엔진', '결제 관리', 'CS / 공지', '감사 로그'] as const;

export default function AddAdminModal({
  isDark, t,
  newAdminName, setNewAdminName,
  newAdminEmail, setNewAdminEmail,
  newAdminRole, setNewAdminRole,
  newAdminPerms, setNewAdminPerms,
  onCreate, onClose,
}: AddAdminModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className={`relative ${t.cardBg} border ${t.border2} rounded-2xl w-full max-w-md p-6 z-10`}>
        <div className="flex items-center justify-between mb-5">
          <h3 className={`text-base font-black ${t.text}`}>관리자 계정 추가</h3>
          <button onClick={onClose} className={`w-7 h-7 flex items-center justify-center ${isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-400 hover:text-gray-700'} cursor-pointer transition-colors`}>
            <i className="ri-close-line text-lg" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className={`text-xs font-semibold ${t.textSub} mb-1.5 block`}>이름</label>
            <input
              type="text"
              value={newAdminName}
              onChange={(e) => setNewAdminName(e.target.value)}
              placeholder="관리자 이름"
              className={`w-full ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-gray-400'} focus:outline-none focus:border-indigo-500/50`}
            />
          </div>
          <div>
            <label className={`text-xs font-semibold ${t.textSub} mb-1.5 block`}>이메일</label>
            <input
              type="email"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="admin@aimetawow.com"
              className={`w-full ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-gray-400'} focus:outline-none focus:border-indigo-500/50`}
            />
          </div>
          <div>
            <label className={`text-xs font-semibold ${t.textSub} mb-1.5 block`}>역할</label>
            <select
              value={newAdminRole}
              onChange={(e) => setNewAdminRole(e.target.value)}
              className={`w-full ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} focus:outline-none focus:border-indigo-500/50 cursor-pointer`}
            >
              <option>CS Manager</option>
              <option>System Admin</option>
              <option>Content Moderator</option>
            </select>
          </div>
          <div>
            <label className={`text-xs font-semibold ${t.textSub} mb-1.5 block`}>접근 권한</label>
            <div className="grid grid-cols-2 gap-2">
              {PERMISSION_OPTIONS.map((perm) => (
                <label key={perm} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAdminPerms.includes(perm)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewAdminPerms((prev) => [...prev, perm]);
                      } else {
                        setNewAdminPerms((prev) => prev.filter((p) => p !== perm));
                      }
                    }}
                    className="w-3.5 h-3.5 rounded accent-indigo-500 cursor-pointer"
                  />
                  <span className={`text-xs ${t.textSub}`}>{perm}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={onCreate}
            disabled={!newAdminName.trim() || !newAdminEmail.trim()}
            className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
          >
            계정 생성 & 초대 발송
          </button>
          <button onClick={onClose} className={`flex-1 py-2.5 ${isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap`}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
