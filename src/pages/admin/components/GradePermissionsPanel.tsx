import { useState, useEffect, useCallback } from 'react';

export interface GradePermission {
  id: string;
  grade: string;
  grade_label: string;
  grade_description: string;
  can_generate_image: boolean;
  can_generate_video: boolean;
  can_generate_music: boolean;
  can_generate_tts: boolean;
  can_generate_sfx: boolean;
  can_use_automation: boolean;
  can_use_ai_board: boolean;
  can_use_ai_ad: boolean;
  can_use_youtube_studio: boolean;
  can_download_hd: boolean;
  can_remove_watermark: boolean;
  can_api_access: boolean;
  can_team_create: boolean;
  monthly_credit_bonus: number;
  max_projects: number;
  max_team_members: number;
  priority_queue: boolean;
  color: string;
  icon: string;
  sort_order: number;
}

interface GradePermissionsPanelProps {
  isDark: boolean;
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const FEATURE_KEYS: { key: keyof GradePermission; label: string; icon: string; category: string; desc: string }[] = [
  { key: 'can_generate_image',    label: 'AI 이미지 생성',    icon: 'ri-image-ai-line',        category: '생성 기능', desc: 'AI로 이미지 생성 가능' },
  { key: 'can_generate_video',    label: 'AI 영상 생성',      icon: 'ri-video-ai-line',         category: '생성 기능', desc: 'AI로 영상 생성 가능' },
  { key: 'can_generate_music',    label: 'AI 음악 생성',      icon: 'ri-music-ai-line',         category: '생성 기능', desc: 'AI로 음악 생성 가능' },
  { key: 'can_generate_tts',      label: 'AI 음성(TTS)',      icon: 'ri-mic-ai-line',           category: '생성 기능', desc: 'AI 텍스트-음성 변환' },
  { key: 'can_generate_sfx',      label: 'AI 효과음(SFX)',    icon: 'ri-sound-module-line',     category: '생성 기능', desc: 'AI 효과음 생성 가능' },
  { key: 'can_use_automation',    label: 'AI 자동화',         icon: 'ri-robot-line',            category: '서비스', desc: 'AI 자동화 워크플로우' },
  { key: 'can_use_ai_board',      label: 'AI 보드',           icon: 'ri-layout-masonry-line',   category: '서비스', desc: 'AI 보드 서비스 이용' },
  { key: 'can_use_ai_ad',         label: 'AI 광고',           icon: 'ri-advertisement-line',    category: '서비스', desc: 'AI 광고 제작 서비스' },
  { key: 'can_use_youtube_studio','label': 'YouTube 스튜디오', icon: 'ri-youtube-line',          category: '서비스', desc: 'YouTube 스튜디오 이용' },
  { key: 'can_download_hd',       label: 'HD 다운로드',       icon: 'ri-hd-line',               category: '혜택', desc: 'HD 화질 다운로드' },
  { key: 'can_remove_watermark',  label: '워터마크 제거',     icon: 'ri-eraser-line',           category: '혜택', desc: '워터마크 없이 다운로드' },
  { key: 'can_api_access',        label: 'API 직접 연동',     icon: 'ri-code-s-slash-line',     category: '혜택', desc: 'API 직접 연동 허용' },
  { key: 'can_team_create',       label: '팀 생성',           icon: 'ri-team-line',             category: '혜택', desc: '팀 생성 및 관리' },
  { key: 'priority_queue',        label: '우선 처리 큐',      icon: 'ri-flashlight-line',       category: '혜택', desc: '생성 요청 우선 처리' },
];

const GRADE_META: Record<string, { label: string; color: string; icon: string; bg: string; border: string; ring: string; textColor: string }> = {
  general:   { label: '일반 회원',  color: 'text-slate-400',   icon: 'ri-user-line',          bg: 'bg-slate-500/10',   border: 'border-slate-500/20', ring: 'ring-slate-500/30',   textColor: '#94a3b8' },
  staff:     { label: '운영진',     color: 'text-violet-400',  icon: 'ri-shield-star-line',   bg: 'bg-violet-500/10',  border: 'border-violet-500/20', ring: 'ring-violet-500/30',  textColor: '#a78bfa' },
  b2b:       { label: 'B2B 기업',   color: 'text-amber-400',   icon: 'ri-building-2-line',    bg: 'bg-amber-500/10',   border: 'border-amber-500/20', ring: 'ring-amber-500/30',   textColor: '#fbbf24' },
  group:     { label: '단체 고객',  color: 'text-emerald-400', icon: 'ri-group-line',         bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', ring: 'ring-emerald-500/30', textColor: '#34d399' },
  vip:       { label: 'VIP 회원',   color: 'text-orange-400',  icon: 'ri-vip-crown-line',     bg: 'bg-orange-500/10',  border: 'border-orange-500/20', ring: 'ring-orange-500/30',  textColor: '#fb923c' },
  suspended: { label: '이용 정지',  color: 'text-red-400',     icon: 'ri-forbid-line',        bg: 'bg-red-500/10',     border: 'border-red-500/20', ring: 'ring-red-500/30',     textColor: '#f87171' },
};

type ViewMode = 'edit' | 'compare';

export default function GradePermissionsPanel({ isDark, onToast }: GradePermissionsPanelProps) {
  const [grades, setGrades] = useState<GradePermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string>('general');
  const [editingPerms, setEditingPerms] = useState<Partial<GradePermission>>({});
  const [gradeStats, setGradeStats] = useState<Record<string, number>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [editingLabel, setEditingLabel] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [labelValue, setLabelValue] = useState('');
  const [descValue, setDescValue] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [changeLog, setChangeLog] = useState<{ time: string; grade: string; desc: string }[]>([]);

  const t = {
    cardBg:    isDark ? 'bg-[#0f0f13]'    : 'bg-white',
    cardBg2:   isDark ? 'bg-zinc-900/60'   : 'bg-slate-50',
    cardBg3:   isDark ? 'bg-zinc-800/50'   : 'bg-slate-100',
    border:    isDark ? 'border-white/5'   : 'border-slate-200',
    border2:   isDark ? 'border-white/10'  : 'border-slate-300',
    text:      isDark ? 'text-white'       : 'text-slate-900',
    textSub:   isDark ? 'text-zinc-300'    : 'text-slate-700',
    textMuted: isDark ? 'text-zinc-400'    : 'text-slate-600',
    textFaint: isDark ? 'text-zinc-500'    : 'text-slate-500',
    inputBg:   isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900',
    inputBg2:  isDark ? 'bg-zinc-800'      : 'bg-slate-100',
    rowHover:  isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50',
    divider:   isDark ? 'divide-white/[0.03]' : 'divide-slate-100',
  };

  const loadGrades = useCallback(async () => {
    setLoading(true);
    try {
      const base = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-users`;
      const headers = { 'Authorization': `Bearer ${import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY}` };
      const [gradesRes, statsRes] = await Promise.allSettled([
        fetch(`${base}?action=list_grade_permissions`, { headers }),
        fetch(`${base}?action=grade_stats`, { headers }),
      ]);
      if (gradesRes.status === 'fulfilled') {
        const data = await gradesRes.value.json();
        if (data.grade_permissions && data.grade_permissions.length > 0) {
          setGrades(data.grade_permissions);
          const first = data.grade_permissions[0];
          setSelectedGrade(first.grade);
          setEditingPerms({ ...first });
          setLabelValue(first.grade_label);
          setDescValue(first.grade_description);
        }
      }
      if (statsRes.status === 'fulfilled') {
        const data = await statsRes.value.json();
        if (data.grade_stats) setGradeStats(data.grade_stats);
      }
    } catch (e) {
      console.warn('Grade permissions load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGrades(); }, [loadGrades]);

  const handleSelectGrade = (grade: string) => {
    if (hasChanges) {
      if (!window.confirm('저장하지 않은 변경사항이 있습니다. 이동하시겠습니까?')) return;
    }
    setSelectedGrade(grade);
    const found = grades.find((g) => g.grade === grade);
    if (found) {
      setEditingPerms({ ...found });
      setLabelValue(found.grade_label);
      setDescValue(found.grade_description);
    }
    setHasChanges(false);
    setEditingLabel(false);
    setEditingDesc(false);
  };

  const handleToggle = (key: keyof GradePermission) => {
    setEditingPerms((prev) => ({ ...prev, [key]: !prev[key] }));
    setHasChanges(true);
  };

  const handleNumberChange = (key: keyof GradePermission, val: string) => {
    const num = parseInt(val);
    if (!isNaN(num) && num >= 0) {
      setEditingPerms((prev) => ({ ...prev, [key]: num }));
      setHasChanges(true);
    }
  };

  const handleSave = async () => {
    if (!selectedGrade) return;
    setSaving(selectedGrade);
    try {
      const payload = {
        ...editingPerms,
        grade_label: labelValue || editingPerms.grade_label,
        grade_description: descValue || editingPerms.grade_description,
      };
      const res = await fetch(
        `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-users?action=update_grade_permissions`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ grade: selectedGrade, permissions: payload }),
        },
      );
      const data = await res.json();
      if (data.error) { onToast(`저장 실패: ${data.error}`, 'error'); return; }
      setGrades((prev) => prev.map((g) => g.grade === selectedGrade ? { ...g, ...payload } : g));
      setHasChanges(false);
      const meta = GRADE_META[selectedGrade];
      const logEntry = {
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        grade: meta?.label ?? selectedGrade,
        desc: `권한 설정 저장 완료`,
      };
      setChangeLog((prev) => [logEntry, ...prev.slice(0, 9)]);
      onToast(`${meta?.label ?? selectedGrade} 등급 권한이 저장됐습니다`, 'success');
    } catch (e) {
      console.warn('Save grade permissions failed:', e);
      onToast('저장 중 오류가 발생했습니다', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleReset = () => {
    const found = grades.find((g) => g.grade === selectedGrade);
    if (found) {
      setEditingPerms({ ...found });
      setLabelValue(found.grade_label);
      setDescValue(found.grade_description);
    }
    setHasChanges(false);
    onToast('변경사항이 초기화됐습니다', 'info');
  };

  const currentGrade = grades.find((g) => g.grade === selectedGrade);
  const meta = GRADE_META[selectedGrade] ?? GRADE_META.general;
  const featureCategories = ['생성 기능', '서비스', '혜택'];
  const enabledCount = FEATURE_KEYS.filter((f) => editingPerms[f.key] as boolean).length;

  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center py-24 ${t.textFaint}`}>
        <i className="ri-loader-4-line animate-spin text-4xl text-indigo-400 mb-3" />
        <p className="text-sm">등급 권한 데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── 뷰 모드 전환 ── */}
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-1 p-1 rounded-xl border ${t.border} ${t.cardBg} w-fit`}>
          {([
            { id: 'edit' as ViewMode, label: '등급별 편집', icon: 'ri-edit-line' },
            { id: 'compare' as ViewMode, label: '전체 비교', icon: 'ri-table-line' },
          ]).map((m) => (
            <button
              key={m.id}
              onClick={() => setViewMode(m.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all whitespace-nowrap ${
                viewMode === m.id ? 'bg-indigo-500 text-white' : `${t.textMuted} hover:${t.text}`
              }`}
            >
              <i className={`${m.icon} text-xs`} />
              {m.label}
            </button>
          ))}
        </div>
        {changeLog.length > 0 && (
          <div className={`flex items-center gap-2 text-xs ${t.textFaint}`}>
            <i className="ri-history-line text-xs" />
            마지막 저장: {changeLog[0].time} ({changeLog[0].grade})
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          편집 모드
      ══════════════════════════════════════════════════════════════ */}
      {viewMode === 'edit' && (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">

          {/* ── 왼쪽: 등급 선택 패널 ── */}
          <div className="space-y-3">
            <p className={`text-[10px] font-black uppercase tracking-widest ${t.textFaint} px-1`}>등급 선택</p>
            {grades.map((g) => {
              const m = GRADE_META[g.grade] ?? GRADE_META.general;
              const isSelected = selectedGrade === g.grade;
              const count = gradeStats[g.grade] ?? 0;
              const enabledFeatures = FEATURE_KEYS.filter((f) => g[f.key] as boolean).length;
              return (
                <button
                  key={g.grade}
                  onClick={() => handleSelectGrade(g.grade)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all text-left ${
                    isSelected
                      ? `${m.bg} ${m.border} ring-1 ${m.ring}`
                      : `${t.cardBg} ${t.border} ${t.rowHover}`
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl ${m.bg} flex items-center justify-center flex-shrink-0`}>
                    <i className={`${m.icon} ${m.color} text-base`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-sm font-bold ${isSelected ? m.color : t.textSub} truncate`}>{g.grade_label}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${isSelected ? `${m.bg} ${m.color}` : `${t.inputBg2} ${t.textFaint}`}`}>
                        {count}명
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`flex-1 h-1 ${isDark ? 'bg-zinc-800' : 'bg-slate-200'} rounded-full overflow-hidden`}>
                        <div
                          className={`h-full rounded-full transition-all ${isSelected ? 'bg-indigo-500' : isDark ? 'bg-zinc-600' : 'bg-slate-400'}`}
                          style={{ width: `${(enabledFeatures / FEATURE_KEYS.length) * 100}%` }}
                        />
                      </div>
                      <span className={`text-[10px] ${t.textFaint} flex-shrink-0`}>{enabledFeatures}/{FEATURE_KEYS.length}</span>
                    </div>
                  </div>
                  {isSelected && (
                    <i className={`ri-arrow-right-s-line ${m.color} text-sm flex-shrink-0`} />
                  )}
                </button>
              );
            })}

            {/* 변경 이력 */}
            {changeLog.length > 0 && (
              <div className={`${t.cardBg} border ${t.border} rounded-2xl p-4`}>
                <p className={`text-[10px] font-black uppercase tracking-widest ${t.textFaint} mb-3`}>최근 변경 이력</p>
                <div className="space-y-2">
                  {changeLog.slice(0, 5).map((log, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                      <div>
                        <p className={`text-[11px] font-semibold ${t.textSub}`}>{log.grade}</p>
                        <p className={`text-[10px] ${t.textFaint}`}>{log.desc} · {log.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── 오른쪽: 권한 편집 패널 ── */}
          {currentGrade && (
            <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>

              {/* 헤더 */}
              <div className={`px-6 py-5 border-b ${t.border}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-12 h-12 rounded-2xl ${meta.bg} border ${meta.border} flex items-center justify-center flex-shrink-0`}>
                      <i className={`${meta.icon} ${meta.color} text-xl`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* 등급 라벨 편집 */}
                      {editingLabel ? (
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="text"
                            value={labelValue}
                            onChange={(e) => { setLabelValue(e.target.value); setHasChanges(true); }}
                            className={`text-sm font-black ${t.inputBg} border rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500/50 w-40`}
                            autoFocus
                            onBlur={() => setEditingLabel(false)}
                            onKeyDown={(e) => e.key === 'Enter' && setEditingLabel(false)}
                          />
                          <button onClick={() => setEditingLabel(false)} className="text-indigo-400 text-xs cursor-pointer">
                            <i className="ri-check-line" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mb-1">
                          <p className={`text-base font-black ${t.text}`}>{labelValue || currentGrade.grade_label}</p>
                          <button
                            onClick={() => setEditingLabel(true)}
                            className={`w-5 h-5 flex items-center justify-center rounded ${t.inputBg2} ${t.textFaint} hover:${t.textSub} cursor-pointer transition-colors`}
                            title="라벨 편집"
                          >
                            <i className="ri-pencil-line text-[10px]" />
                          </button>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                            {gradeStats[selectedGrade] ?? 0}명
                          </span>
                          {hasChanges && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 animate-pulse">
                              미저장
                            </span>
                          )}
                        </div>
                      )}
                      {/* 등급 설명 편집 */}
                      {editingDesc ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={descValue}
                            onChange={(e) => { setDescValue(e.target.value); setHasChanges(true); }}
                            className={`text-xs ${t.inputBg} border rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500/50 flex-1`}
                            autoFocus
                            onBlur={() => setEditingDesc(false)}
                            onKeyDown={(e) => e.key === 'Enter' && setEditingDesc(false)}
                          />
                          <button onClick={() => setEditingDesc(false)} className="text-indigo-400 text-xs cursor-pointer flex-shrink-0">
                            <i className="ri-check-line" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <p className={`text-xs ${t.textMuted} truncate`}>{descValue || currentGrade.grade_description}</p>
                          <button
                            onClick={() => setEditingDesc(true)}
                            className={`w-4 h-4 flex items-center justify-center rounded ${t.textFaint} hover:${t.textSub} cursor-pointer transition-colors flex-shrink-0`}
                            title="설명 편집"
                          >
                            <i className="ri-pencil-line text-[9px]" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {hasChanges && (
                      <button
                        onClick={handleReset}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl cursor-pointer transition-colors whitespace-nowrap ${t.cardBg2} border ${t.border} ${t.textMuted} hover:${t.text}`}
                      >
                        <i className="ri-refresh-line text-xs" />
                        초기화
                      </button>
                    )}
                    <button
                      onClick={handleSave}
                      disabled={saving === selectedGrade}
                      className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-colors whitespace-nowrap disabled:opacity-50 ${
                        hasChanges
                          ? 'bg-indigo-500 hover:bg-indigo-400 text-white'
                          : `${t.cardBg2} border ${t.border} ${t.textMuted}`
                      }`}
                    >
                      {saving === selectedGrade ? (
                        <i className="ri-loader-4-line animate-spin text-xs" />
                      ) : (
                        <i className="ri-save-line text-xs" />
                      )}
                      {hasChanges ? '저장하기' : '저장됨'}
                    </button>
                  </div>
                </div>

                {/* 요약 바 */}
                <div className={`mt-4 flex items-center gap-4 pt-4 border-t ${t.border} flex-wrap`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-lg ${meta.bg} flex items-center justify-center`}>
                      <i className={`ri-toggle-line ${meta.color} text-xs`} />
                    </div>
                    <span className={`text-xs ${t.textMuted}`}>
                      활성 기능: <span className={`font-black ${meta.color}`}>{enabledCount}</span>/{FEATURE_KEYS.length}개
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center`}>
                      <i className="ri-coin-line text-amber-400 text-xs" />
                    </div>
                    <span className={`text-xs ${t.textMuted}`}>
                      월 보너스: <span className={`font-black ${t.text}`}>{((editingPerms.monthly_credit_bonus as number) ?? 0).toLocaleString()} CR</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center`}>
                      <i className="ri-folder-line text-indigo-400 text-xs" />
                    </div>
                    <span className={`text-xs ${t.textMuted}`}>
                      최대 프로젝트: <span className={`font-black ${t.text}`}>
                        {(editingPerms.max_projects as number) >= 999 ? '무제한' : `${editingPerms.max_projects}개`}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center`}>
                      <i className="ri-team-line text-emerald-400 text-xs" />
                    </div>
                    <span className={`text-xs ${t.textMuted}`}>
                      팀 멤버: <span className={`font-black ${t.text}`}>{editingPerms.max_team_members}명</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-7">

                {/* 기능 권한 토글 */}
                {featureCategories.map((cat) => {
                  const features = FEATURE_KEYS.filter((f) => f.category === cat);
                  const catEnabled = features.filter((f) => editingPerms[f.key] as boolean).length;
                  const isDisabled = selectedGrade === 'suspended';
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <p className={`text-[11px] font-black ${t.textMuted} uppercase tracking-widest`}>{cat}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            catEnabled === features.length
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : catEnabled === 0
                              ? `${t.inputBg2} ${t.textFaint}`
                              : 'bg-amber-500/15 text-amber-400'
                          }`}>
                            {catEnabled}/{features.length}
                          </span>
                        </div>
                        {!isDisabled && (
                          <button
                            onClick={() => {
                              const allOn = features.every((f) => editingPerms[f.key] as boolean);
                              const newVal = !allOn;
                              const updates: Partial<GradePermission> = {};
                              features.forEach((f) => { (updates as Record<string, boolean>)[f.key as string] = newVal; });
                              setEditingPerms((prev) => ({ ...prev, ...updates }));
                              setHasChanges(true);
                            }}
                            className={`text-[10px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            {features.every((f) => editingPerms[f.key] as boolean) ? '전체 해제' : '전체 허용'}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {features.map((feat) => {
                          const isOn = !!(editingPerms[feat.key] as boolean);
                          return (
                            <div
                              key={feat.key}
                              className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                                isOn && !isDisabled
                                  ? `${meta.bg} ${meta.border}`
                                  : `${t.cardBg2} ${t.border}`
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0 ${isOn && !isDisabled ? meta.bg : t.inputBg2}`}>
                                  <i className={`${feat.icon} text-sm ${isOn && !isDisabled ? meta.color : t.textFaint}`} />
                                </div>
                                <div className="min-w-0">
                                  <p className={`text-xs font-semibold ${isOn && !isDisabled ? t.text : t.textMuted} truncate`}>
                                    {feat.label}
                                  </p>
                                  <p className={`text-[10px] ${t.textFaint} truncate`}>{feat.desc}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => !isDisabled && handleToggle(feat.key)}
                                disabled={isDisabled}
                                className={`flex-shrink-0 ml-3 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed relative`}
                                style={{ width: '40px', height: '22px' }}
                              >
                                <div className={`w-full h-full rounded-full transition-colors ${isOn && !isDisabled ? 'bg-indigo-500' : isDark ? 'bg-zinc-700' : 'bg-slate-300'}`} />
                                <div
                                  className="absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white transition-transform shadow-sm"
                                  style={{ transform: isOn && !isDisabled ? 'translateX(20px)' : 'translateX(2px)' }}
                                />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* 수치 설정 */}
                <div>
                  <p className={`text-[11px] font-black ${t.textMuted} uppercase tracking-widest mb-3`}>한도 및 혜택</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      {
                        key: 'monthly_credit_bonus' as keyof GradePermission,
                        label: '월 보너스 크레딧',
                        unit: 'CR',
                        icon: 'ri-coin-line',
                        color: 'text-amber-400',
                        bg: 'bg-amber-500/10',
                        max: 100000,
                        hint: '매월 자동 지급되는 보너스 크레딧',
                      },
                      {
                        key: 'max_projects' as keyof GradePermission,
                        label: '최대 프로젝트 수',
                        unit: '개',
                        icon: 'ri-folder-line',
                        color: 'text-indigo-400',
                        bg: 'bg-indigo-500/10',
                        max: 9999,
                        hint: '999 이상 입력 시 무제한으로 표시',
                      },
                      {
                        key: 'max_team_members' as keyof GradePermission,
                        label: '최대 팀 멤버 수',
                        unit: '명',
                        icon: 'ri-team-line',
                        color: 'text-emerald-400',
                        bg: 'bg-emerald-500/10',
                        max: 9999,
                        hint: '팀 내 최대 멤버 수 제한',
                      },
                    ].map((item) => {
                      const val = (editingPerms[item.key] as number) ?? 0;
                      const isUnlimited = item.key === 'max_projects' && val >= 999;
                      return (
                        <div key={item.key} className={`${t.cardBg2} rounded-xl p-4 border ${t.border}`}>
                          <div className="flex items-center gap-2 mb-3">
                            <div className={`w-8 h-8 rounded-xl ${item.bg} flex items-center justify-center`}>
                              <i className={`${item.icon} ${item.color} text-sm`} />
                            </div>
                            <div>
                              <p className={`text-xs font-bold ${t.textSub}`}>{item.label}</p>
                              <p className={`text-[10px] ${t.textFaint}`}>{item.hint}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={val}
                              onChange={(e) => handleNumberChange(item.key, e.target.value)}
                              disabled={selectedGrade === 'suspended'}
                              className={`flex-1 ${isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'} border rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-500/50 disabled:opacity-40`}
                              min={0}
                              max={item.max}
                            />
                            <span className={`text-xs ${t.textFaint} whitespace-nowrap`}>{item.unit}</span>
                          </div>
                          {isUnlimited && (
                            <p className="text-[10px] text-emerald-400 mt-1.5 flex items-center gap-1">
                              <i className="ri-infinity-line text-xs" />
                              무제한으로 표시됩니다
                            </p>
                          )}
                          {/* 시각적 게이지 */}
                          <div className={`mt-2 h-1 ${isDark ? 'bg-zinc-800' : 'bg-slate-200'} rounded-full overflow-hidden`}>
                            <div
                              className={`h-full ${item.color.replace('text-', 'bg-')} rounded-full transition-all`}
                              style={{ width: `${Math.min(100, (val / item.max) * 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 이용 정지 안내 */}
                {selectedGrade === 'suspended' && (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/8 border border-red-500/20">
                    <i className="ri-error-warning-line text-red-400 text-base mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-red-400 mb-1">이용 정지 등급</p>
                      <p className={`text-xs ${t.textMuted} leading-relaxed`}>
                        이용 정지 등급은 모든 기능이 차단됩니다. 개별 기능 토글은 비활성화되며, 이 등급의 회원은 서비스를 이용할 수 없습니다.
                      </p>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          비교 모드
      ══════════════════════════════════════════════════════════════ */}
      {viewMode === 'compare' && (
        <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
          <div className={`px-6 py-4 border-b ${t.border}`}>
            <p className={`text-sm font-black ${t.text}`}>등급별 권한 전체 비교</p>
            <p className={`text-xs ${t.textMuted} mt-0.5`}>모든 등급의 권한을 한눈에 비교합니다</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${t.border}`}>
                  <th className={`text-left px-5 py-4 text-xs font-black ${t.textMuted} uppercase tracking-wider sticky left-0 ${t.cardBg} z-10 min-w-[160px]`}>
                    기능 / 등급
                  </th>
                  {grades.map((g) => {
                    const m = GRADE_META[g.grade] ?? GRADE_META.general;
                    return (
                      <th key={g.grade} className="px-4 py-4 text-center min-w-[100px]">
                        <div className="flex flex-col items-center gap-1.5">
                          <div className={`w-8 h-8 rounded-xl ${m.bg} flex items-center justify-center`}>
                            <i className={`${m.icon} ${m.color} text-sm`} />
                          </div>
                          <span className={`text-[11px] font-bold ${m.color} whitespace-nowrap`}>{g.grade_label}</span>
                          <span className={`text-[10px] ${t.textFaint}`}>{gradeStats[g.grade] ?? 0}명</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className={`divide-y ${t.divider}`}>
                {/* 기능 권한 행 */}
                {featureCategories.map((cat) => {
                  const features = FEATURE_KEYS.filter((f) => f.category === cat);
                  return [
                    // 카테고리 헤더 행
                    <tr key={`cat-${cat}`} className={`${isDark ? 'bg-zinc-900/40' : 'bg-slate-50'}`}>
                      <td colSpan={grades.length + 1} className={`px-5 py-2`}>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${t.textFaint}`}>{cat}</span>
                      </td>
                    </tr>,
                    // 기능 행들
                    ...features.map((feat) => (
                      <tr key={feat.key} className={`${t.rowHover} transition-colors`}>
                        <td className={`px-5 py-3 sticky left-0 ${t.cardBg} z-10`}>
                          <div className="flex items-center gap-2.5">
                            <div className={`w-6 h-6 flex items-center justify-center rounded-lg ${t.inputBg2}`}>
                              <i className={`${feat.icon} ${t.textFaint} text-xs`} />
                            </div>
                            <span className={`text-xs font-semibold ${t.textSub} whitespace-nowrap`}>{feat.label}</span>
                          </div>
                        </td>
                        {grades.map((g) => {
                          const isOn = !!(g[feat.key] as boolean);
                          const m = GRADE_META[g.grade] ?? GRADE_META.general;
                          return (
                            <td key={g.grade} className="px-4 py-3 text-center">
                              {isOn ? (
                                <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${m.bg}`}>
                                  <i className={`ri-check-line ${m.color} text-xs`} />
                                </div>
                              ) : (
                                <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${t.inputBg2}`}>
                                  <i className={`ri-close-line ${t.textFaint} text-xs`} />
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    )),
                  ];
                })}

                {/* 구분선 */}
                <tr className={`${isDark ? 'bg-zinc-900/40' : 'bg-slate-50'}`}>
                  <td colSpan={grades.length + 1} className="px-5 py-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${t.textFaint}`}>한도 및 혜택</span>
                  </td>
                </tr>

                {/* 수치 행 */}
                {[
                  { key: 'monthly_credit_bonus' as keyof GradePermission, label: '월 보너스 크레딧', icon: 'ri-coin-line', format: (v: number) => v > 0 ? `${v.toLocaleString()} CR` : '-' },
                  { key: 'max_projects' as keyof GradePermission, label: '최대 프로젝트', icon: 'ri-folder-line', format: (v: number) => v >= 999 ? '무제한' : `${v}개` },
                  { key: 'max_team_members' as keyof GradePermission, label: '최대 팀 멤버', icon: 'ri-team-line', format: (v: number) => v > 0 ? `${v}명` : '-' },
                ].map((item) => (
                  <tr key={item.key} className={`${t.rowHover} transition-colors`}>
                    <td className={`px-5 py-3 sticky left-0 ${t.cardBg} z-10`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-6 h-6 flex items-center justify-center rounded-lg ${t.inputBg2}`}>
                          <i className={`${item.icon} ${t.textFaint} text-xs`} />
                        </div>
                        <span className={`text-xs font-semibold ${t.textSub} whitespace-nowrap`}>{item.label}</span>
                      </div>
                    </td>
                    {grades.map((g) => {
                      const val = (g[item.key] as number) ?? 0;
                      const m = GRADE_META[g.grade] ?? GRADE_META.general;
                      const isMax = grades.every((og) => (og[item.key] as number) <= val) && val > 0;
                      return (
                        <td key={g.grade} className="px-4 py-3 text-center">
                          <span className={`text-xs font-bold ${isMax ? m.color : t.textMuted} whitespace-nowrap`}>
                            {item.format(val)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* 활성 기능 수 합계 행 */}
                <tr className={`${isDark ? 'bg-indigo-500/5 border-t border-indigo-500/10' : 'bg-indigo-50 border-t border-indigo-100'}`}>
                  <td className={`px-5 py-3.5 sticky left-0 ${isDark ? 'bg-indigo-500/5' : 'bg-indigo-50'} z-10`}>
                    <span className={`text-xs font-black ${t.text}`}>활성 기능 합계</span>
                  </td>
                  {grades.map((g) => {
                    const count = FEATURE_KEYS.filter((f) => g[f.key] as boolean).length;
                    const m = GRADE_META[g.grade] ?? GRADE_META.general;
                    const pct = Math.round((count / FEATURE_KEYS.length) * 100);
                    return (
                      <td key={g.grade} className="px-4 py-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-sm font-black ${m.color}`}>{count}</span>
                          <span className={`text-[10px] ${t.textFaint}`}>{pct}%</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {/* 범례 */}
          <div className={`px-6 py-4 border-t ${t.border} flex items-center gap-6 flex-wrap`}>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-indigo-500/15 flex items-center justify-center">
                <i className="ri-check-line text-indigo-400 text-xs" />
              </div>
              <span className={`text-xs ${t.textMuted}`}>허용됨</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded-full ${t.inputBg2} flex items-center justify-center`}>
                <i className={`ri-close-line ${t.textFaint} text-xs`} />
              </div>
              <span className={`text-xs ${t.textMuted}`}>차단됨</span>
            </div>
            <span className={`text-xs ${t.textFaint} ml-auto`}>
              색상 강조 = 해당 항목 최고값
            </span>
          </div>
        </div>
      )}

    </div>
  );
}
