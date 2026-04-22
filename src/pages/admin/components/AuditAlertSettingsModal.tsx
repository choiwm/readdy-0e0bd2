import { useState, useCallback } from 'react';

export type AlertChannel = 'browser' | 'email' | 'slack';
export type AlertSeverity = 'all' | 'critical' | 'warning';

export interface AuditAlertRule {
  id: string;
  name: string;
  enabled: boolean;
  category: string;
  actionKeyword: string;
  severity: AlertSeverity;
  channels: AlertChannel[];
  cooldownMin: number;
  createdAt: string;
  triggerCount: number;
}

interface Props {
  isDark: boolean;
  rules: AuditAlertRule[];
  onClose: () => void;
  onSave: (rules: AuditAlertRule[]) => void;
}

const CATEGORY_OPTIONS = [
  { value: 'all', label: '전체 카테고리' },
  { value: 'user', label: '사용자' },
  { value: 'content', label: '콘텐츠' },
  { value: 'billing', label: '결제' },
  { value: 'system', label: '시스템' },
  { value: 'security', label: '보안' },
];

const SEVERITY_OPTIONS: { value: AlertSeverity; label: string; cls: string }[] = [
  { value: 'all', label: '모든 액션', cls: 'bg-zinc-500/15 text-zinc-400' },
  { value: 'warning', label: '경고 이상', cls: 'bg-amber-500/15 text-amber-400' },
  { value: 'critical', label: '위험만', cls: 'bg-red-500/15 text-red-400' },
];

const CHANNEL_OPTIONS: { value: AlertChannel; icon: string; label: string }[] = [
  { value: 'browser', icon: 'ri-notification-3-line', label: '브라우저 알림' },
  { value: 'email', icon: 'ri-mail-line', label: '이메일' },
  { value: 'slack', icon: 'ri-slack-line', label: 'Slack' },
];

const PRESET_RULES: Omit<AuditAlertRule, 'id' | 'createdAt' | 'triggerCount'>[] = [
  {
    name: 'IP 차단 감지',
    enabled: true,
    category: 'security',
    actionKeyword: 'ip_block',
    severity: 'critical',
    channels: ['browser', 'email'],
    cooldownMin: 5,
  },
  {
    name: '관리자 권한 변경',
    enabled: true,
    category: 'security',
    actionKeyword: 'update_admin',
    severity: 'critical',
    channels: ['browser', 'email'],
    cooldownMin: 0,
  },
  {
    name: '대량 결제 환불',
    enabled: false,
    category: 'billing',
    actionKeyword: 'refund',
    severity: 'warning',
    channels: ['browser'],
    cooldownMin: 10,
  },
  {
    name: '콘텐츠 일괄 차단',
    enabled: false,
    category: 'content',
    actionKeyword: 'block',
    severity: 'warning',
    channels: ['browser'],
    cooldownMin: 15,
  },
];

function genId() {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function genNow() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_RULE: Omit<AuditAlertRule, 'id' | 'createdAt' | 'triggerCount'> = {
  name: '',
  enabled: true,
  category: 'all',
  actionKeyword: '',
  severity: 'all',
  channels: ['browser'],
  cooldownMin: 0,
};

export default function AuditAlertSettingsModal({ isDark, rules, onClose, onSave }: Props) {
  const t = {
    bg: isDark ? 'bg-[#18181b]' : 'bg-white',
    cardBg: isDark ? 'bg-[#1f1f23]' : 'bg-gray-50',
    cardBg2: isDark ? 'bg-[#27272a]' : 'bg-gray-100',
    border: isDark ? 'border-white/8' : 'border-gray-200',
    text: isDark ? 'text-white' : 'text-gray-900',
    textSub: isDark ? 'text-zinc-300' : 'text-gray-700',
    textMuted: isDark ? 'text-zinc-500' : 'text-gray-500',
    textFaint: isDark ? 'text-zinc-600' : 'text-gray-400',
    inputBg: isDark ? 'bg-[#27272a]' : 'bg-white',
    overlay: isDark ? 'bg-black/60' : 'bg-black/30',
  };

  const [localRules, setLocalRules] = useState<AuditAlertRule[]>(rules);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Omit<AuditAlertRule, 'id' | 'createdAt' | 'triggerCount'>>(EMPTY_RULE);
  const [isAdding, setIsAdding] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean } | null>(null);

  const startAdd = useCallback(() => {
    setIsAdding(true);
    setEditingId(null);
    setEditForm({ ...EMPTY_RULE });
  }, []);

  const startEdit = useCallback((rule: AuditAlertRule) => {
    setEditingId(rule.id);
    setIsAdding(false);
    setEditForm({
      name: rule.name,
      enabled: rule.enabled,
      category: rule.category,
      actionKeyword: rule.actionKeyword,
      severity: rule.severity,
      channels: [...rule.channels],
      cooldownMin: rule.cooldownMin,
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setIsAdding(false);
    setEditForm({ ...EMPTY_RULE });
  }, []);

  const saveEdit = useCallback(() => {
    if (!editForm.name.trim()) return;
    if (isAdding) {
      const newRule: AuditAlertRule = {
        ...editForm,
        id: genId(),
        createdAt: genNow(),
        triggerCount: 0,
      };
      setLocalRules((prev) => [newRule, ...prev]);
    } else if (editingId) {
      setLocalRules((prev) =>
        prev.map((r) => (r.id === editingId ? { ...r, ...editForm } : r))
      );
    }
    cancelEdit();
  }, [editForm, isAdding, editingId, cancelEdit]);

  const toggleEnabled = useCallback((id: string) => {
    setLocalRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  }, []);

  const deleteRule = useCallback((id: string) => {
    setLocalRules((prev) => prev.filter((r) => r.id !== id));
    setDeleteConfirmId(null);
  }, []);

  const addPresets = useCallback(() => {
    const newRules: AuditAlertRule[] = PRESET_RULES.map((p) => ({
      ...p,
      id: genId(),
      createdAt: genNow(),
      triggerCount: 0,
    }));
    setLocalRules((prev) => {
      const existingNames = new Set(prev.map((r) => r.name));
      const toAdd = newRules.filter((r) => !existingNames.has(r.name));
      return [...toAdd, ...prev];
    });
  }, []);

  const handleTestAlert = useCallback(async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    await new Promise((res) => setTimeout(res, 1200));
    // Browser notification test
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('🔔 감사 로그 알림 테스트', {
          body: '알림 규칙이 정상적으로 작동합니다.',
          icon: '/favicon.ico',
        });
      } else if (Notification.permission !== 'denied') {
        await Notification.requestPermission();
      }
    }
    setTestingId(null);
    setTestResult({ id, ok: true });
    setTimeout(() => setTestResult(null), 3000);
  }, []);

  const toggleChannel = useCallback((ch: AlertChannel) => {
    setEditForm((prev) => ({
      ...prev,
      channels: prev.channels.includes(ch)
        ? prev.channels.filter((c) => c !== ch)
        : [...prev.channels, ch],
    }));
  }, []);

  const severityBadge = (s: AlertSeverity) => {
    if (s === 'critical') return 'bg-red-500/15 text-red-400';
    if (s === 'warning') return 'bg-amber-500/15 text-amber-400';
    return 'bg-zinc-500/15 text-zinc-400';
  };
  const severityLabel = (s: AlertSeverity) => {
    if (s === 'critical') return '위험만';
    if (s === 'warning') return '경고 이상';
    return '모든 액션';
  };
  const catLabel = (c: string) => CATEGORY_OPTIONS.find((o) => o.value === c)?.label ?? c;

  const isFormValid = editForm.name.trim().length > 0 && editForm.channels.length > 0;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${t.overlay} backdrop-blur-sm`}>
      <div className={`${t.bg} border ${t.border} rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${t.border} flex-shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-500/15">
              <i className="ri-notification-badge-line text-indigo-400 text-sm" />
            </div>
            <div>
              <h2 className={`text-sm font-black ${t.text}`}>액션 알림 설정</h2>
              <p className={`text-[11px] ${t.textFaint}`}>특정 관리자 액션 발생 시 알림을 받습니다</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`w-7 h-7 flex items-center justify-center rounded-lg ${t.textMuted} hover:${t.text} cursor-pointer transition-colors`}
          >
            <i className="ri-close-line text-base" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-black ${t.textSub}`}>
                알림 규칙
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400`}>
                {localRules.length}개
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400`}>
                활성 {localRules.filter((r) => r.enabled).length}개
              </span>
            </div>
            <div className="flex items-center gap-2">
              {localRules.length === 0 && (
                <button
                  onClick={addPresets}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border ${t.border} ${t.textMuted} hover:${t.text} cursor-pointer transition-colors whitespace-nowrap`}
                >
                  <i className="ri-magic-line text-xs" />
                  기본 규칙 추가
                </button>
              )}
              <button
                onClick={startAdd}
                disabled={isAdding || editingId !== null}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white cursor-pointer transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <i className="ri-add-line text-xs" />
                규칙 추가
              </button>
            </div>
          </div>

          {/* Add / Edit Form */}
          {(isAdding || editingId !== null) && (
            <div className={`${t.cardBg} border border-indigo-500/30 rounded-xl p-4 space-y-3`}>
              <p className={`text-xs font-black ${t.textSub}`}>
                {isAdding ? '새 알림 규칙' : '규칙 수정'}
              </p>

              {/* Name */}
              <div>
                <label className={`text-[11px] font-semibold ${t.textMuted} block mb-1`}>규칙 이름 *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="예: IP 차단 감지"
                  className={`w-full ${t.inputBg} border ${t.border} rounded-lg px-3 py-2 text-xs ${t.text} focus:outline-none focus:border-indigo-500/50`}
                />
              </div>

              {/* Category + Keyword */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-[11px] font-semibold ${t.textMuted} block mb-1`}>카테고리</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}
                    className={`w-full ${t.inputBg} border ${t.border} rounded-lg px-3 py-2 text-xs ${t.text} focus:outline-none focus:border-indigo-500/50 cursor-pointer`}
                  >
                    {CATEGORY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`text-[11px] font-semibold ${t.textMuted} block mb-1`}>액션 키워드</label>
                  <input
                    type="text"
                    value={editForm.actionKeyword}
                    onChange={(e) => setEditForm((p) => ({ ...p, actionKeyword: e.target.value }))}
                    placeholder="예: ip_block, refund (빈칸=전체)"
                    className={`w-full ${t.inputBg} border ${t.border} rounded-lg px-3 py-2 text-xs ${t.text} focus:outline-none focus:border-indigo-500/50`}
                  />
                </div>
              </div>

              {/* Severity */}
              <div>
                <label className={`text-[11px] font-semibold ${t.textMuted} block mb-1.5`}>심각도 필터</label>
                <div className="flex gap-2 flex-wrap">
                  {SEVERITY_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setEditForm((p) => ({ ...p, severity: s.value }))}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors border whitespace-nowrap ${
                        editForm.severity === s.value
                          ? `${s.cls} border-current`
                          : `${t.cardBg2} ${t.border} ${t.textMuted}`
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Channels */}
              <div>
                <label className={`text-[11px] font-semibold ${t.textMuted} block mb-1.5`}>알림 채널 *</label>
                <div className="flex gap-2 flex-wrap">
                  {CHANNEL_OPTIONS.map((ch) => {
                    const active = editForm.channels.includes(ch.value);
                    return (
                      <button
                        key={ch.value}
                        onClick={() => toggleChannel(ch.value)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors border whitespace-nowrap ${
                          active
                            ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                            : `${t.cardBg2} ${t.border} ${t.textMuted}`
                        }`}
                      >
                        <i className={`${ch.icon} text-xs`} />
                        {ch.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cooldown */}
              <div>
                <label className={`text-[11px] font-semibold ${t.textMuted} block mb-1`}>
                  쿨다운 (분) — 같은 규칙 중복 알림 방지
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={60}
                    step={5}
                    value={editForm.cooldownMin}
                    onChange={(e) => setEditForm((p) => ({ ...p, cooldownMin: Number(e.target.value) }))}
                    className="flex-1 accent-indigo-500 cursor-pointer"
                  />
                  <span className={`text-xs font-black ${t.text} w-14 text-right whitespace-nowrap`}>
                    {editForm.cooldownMin === 0 ? '제한 없음' : `${editForm.cooldownMin}분`}
                  </span>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={cancelEdit}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold ${t.textMuted} hover:${t.text} cursor-pointer transition-colors`}
                >
                  취소
                </button>
                <button
                  onClick={saveEdit}
                  disabled={!isFormValid}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-500 hover:bg-indigo-400 text-white cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isAdding ? '추가' : '저장'}
                </button>
              </div>
            </div>
          )}

          {/* Rules List */}
          {localRules.length === 0 && !isAdding ? (
            <div className={`text-center py-10 ${t.textFaint}`}>
              <i className="ri-notification-off-line text-3xl mb-2 block" />
              <p className="text-xs">등록된 알림 규칙이 없습니다</p>
              <button
                onClick={addPresets}
                className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors underline underline-offset-2"
              >
                기본 규칙 4개 자동 추가
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {localRules.map((rule) => {
                const isEditing = editingId === rule.id;
                return (
                  <div
                    key={rule.id}
                    className={`${t.cardBg} border ${isEditing ? 'border-indigo-500/40' : t.border} rounded-xl p-4 transition-all`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Toggle */}
                      <button
                        onClick={() => toggleEnabled(rule.id)}
                        className={`mt-0.5 w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 relative ${rule.enabled ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${rule.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-black ${t.text}`}>{rule.name}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${severityBadge(rule.severity)}`}>
                            {severityLabel(rule.severity)}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-500/15 text-zinc-400`}>
                            {catLabel(rule.category)}
                          </span>
                          {!rule.enabled && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-700/50 text-zinc-500">
                              비활성
                            </span>
                          )}
                        </div>
                        <div className={`flex items-center gap-3 mt-1.5 flex-wrap`}>
                          {rule.actionKeyword && (
                            <span className={`text-[11px] font-mono ${t.textFaint}`}>
                              키워드: <span className={t.textMuted}>{rule.actionKeyword}</span>
                            </span>
                          )}
                          <span className={`text-[11px] ${t.textFaint}`}>
                            채널: {rule.channels.map((c) => CHANNEL_OPTIONS.find((o) => o.value === c)?.label).join(', ')}
                          </span>
                          {rule.cooldownMin > 0 && (
                            <span className={`text-[11px] ${t.textFaint}`}>
                              쿨다운 {rule.cooldownMin}분
                            </span>
                          )}
                          <span className={`text-[11px] ${t.textFaint}`}>
                            발동 <span className={`font-bold ${t.textMuted}`}>{rule.triggerCount}회</span>
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Test */}
                        {testResult?.id === rule.id ? (
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${testResult.ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                            {testResult.ok ? '전송됨' : '실패'}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleTestAlert(rule.id)}
                            disabled={testingId === rule.id}
                            className={`w-7 h-7 flex items-center justify-center rounded-lg ${t.textMuted} hover:text-amber-400 cursor-pointer transition-colors`}
                            title="테스트 알림 전송"
                          >
                            {testingId === rule.id ? (
                              <i className="ri-loader-4-line animate-spin text-xs" />
                            ) : (
                              <i className="ri-send-plane-line text-xs" />
                            )}
                          </button>
                        )}
                        {/* Edit */}
                        <button
                          onClick={() => startEdit(rule)}
                          disabled={isAdding || (editingId !== null && editingId !== rule.id)}
                          className={`w-7 h-7 flex items-center justify-center rounded-lg ${t.textMuted} hover:${t.text} cursor-pointer transition-colors disabled:opacity-30`}
                          title="수정"
                        >
                          <i className="ri-edit-line text-xs" />
                        </button>
                        {/* Delete */}
                        {deleteConfirmId === rule.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => deleteRule(rule.id)}
                              className="text-[10px] font-bold px-2 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 cursor-pointer transition-colors whitespace-nowrap"
                            >
                              삭제
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className={`text-[10px] font-semibold px-2 py-1 rounded-lg ${t.cardBg2} ${t.textMuted} cursor-pointer transition-colors`}
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(rule.id)}
                            className={`w-7 h-7 flex items-center justify-center rounded-lg ${t.textMuted} hover:text-red-400 cursor-pointer transition-colors`}
                            title="삭제"
                          >
                            <i className="ri-delete-bin-line text-xs" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Info Banner */}
          <div className={`flex items-start gap-2.5 p-3 rounded-xl bg-indigo-500/8 border border-indigo-500/15`}>
            <i className="ri-information-line text-indigo-400 text-sm flex-shrink-0 mt-0.5" />
            <p className={`text-[11px] ${t.textMuted} leading-relaxed`}>
              알림은 감사 로그에 새 항목이 기록될 때 규칙 조건과 매칭되면 발동됩니다.
              브라우저 알림은 이 탭이 열려 있을 때만 작동하며, 이메일/Slack은 별도 연동 설정이 필요합니다.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-6 py-4 border-t ${t.border} flex-shrink-0`}>
          <span className={`text-[11px] ${t.textFaint}`}>
            변경사항은 저장 후 즉시 적용됩니다
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-xs font-semibold ${t.textMuted} hover:${t.text} cursor-pointer transition-colors`}
            >
              취소
            </button>
            <button
              onClick={() => onSave(localRules)}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-500 hover:bg-indigo-400 text-white cursor-pointer transition-colors whitespace-nowrap"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
