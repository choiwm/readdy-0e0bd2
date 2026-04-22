import { useState, useEffect, useCallback } from 'react';

interface TestHistoryEntry {
  tested_at: string;
  success: boolean;
  message: string;
  latency_ms?: number;
}

interface ApiKeyRecord {
  id: string;
  service_name: string;
  service_slug: string;
  key_hint: string | null;
  status: 'active' | 'inactive' | 'error';
  last_tested_at: string | null;
  test_result: string | null;
  test_history: TestHistoryEntry[] | null;
  monthly_limit: number;
  monthly_used: number;
  monthly_limit_action: 'notify' | 'disable' | 'both';
  limit_notify_threshold: number;
  limit_notified_at: string | null;
  notes: string | null;
  updated_at: string;
  is_legacy?: boolean;
}

interface UsageStats {
  [slug: string]: { total: number; success: number; failed: number; credits: number };
}

interface ScanResult {
  total: number;
  legacy_count: number;
  aes_count: number;
  no_key_count: number;
  legacy_keys: Array<{ id: string; service_name: string; service_slug: string; key_hint: string | null }>;
  aes_keys: Array<{ service_slug: string; service_name: string }>;
  no_key_rows: Array<{ service_slug: string; service_name: string }>;
}

interface MigrationResult {
  service_slug: string;
  service_name: string;
  status: 'migrated' | 'failed' | 'skipped';
  reason?: string;
}

interface MigrationResponse {
  success: boolean;
  migrated: number;
  failed: number;
  total: number;
  results: MigrationResult[];
  message: string;
}

interface Props {
  isDark: boolean;
  onKeyRenew: (slug: string, serviceName: string) => void;
}

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ── 월 사용량 게이지 ──────────────────────────────────────────────────────────
function MonthlyUsageGauge({
  used, limit, action, isDark,
}: {
  used: number;
  limit: number;
  action: string;
  isDark: boolean;
}) {
  if (!limit || limit === 0) return null;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const exceeded = used >= limit;
  const nearLimit = !exceeded && pct >= 80;

  const barColor = exceeded
    ? 'bg-red-500'
    : nearLimit
    ? 'bg-amber-400'
    : 'bg-emerald-400';

  const textColor = exceeded
    ? 'text-red-400'
    : nearLimit
    ? 'text-amber-400'
    : isDark ? 'text-zinc-400' : 'text-gray-500';

  return (
    <div className="flex flex-col gap-1 w-24 flex-shrink-0">
      <div className="flex items-center justify-between">
        <span className={`text-[9px] font-bold ${textColor}`}>{pct}%</span>
        <span className={`text-[9px] ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
          {used.toLocaleString()}/{limit.toLocaleString()}
        </span>
      </div>
      <div className={`w-full h-1.5 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'} rounded-full overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all ${barColor} ${exceeded ? 'animate-pulse' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {exceeded && (
        <span className="text-[9px] font-bold text-red-400 flex items-center gap-0.5">
          <i className="ri-error-warning-line" />
          {action === 'disable' || action === 'both' ? '자동 비활성화' : '한도 초과'}
        </span>
      )}
      {nearLimit && !exceeded && (
        <span className="text-[9px] font-bold text-amber-400 flex items-center gap-0.5">
          <i className="ri-alert-line" />임박
        </span>
      )}
    </div>
  );
}

// ── 한도 설정 인라인 패널 ─────────────────────────────────────────────────────
function LimitSettingsPanel({
  keyRecord, isDark, base, headers, onUpdate, onClose,
}: {
  keyRecord: ApiKeyRecord;
  isDark: boolean;
  base: string;
  headers: Record<string, string>;
  onUpdate: (slug: string, updates: Partial<ApiKeyRecord>) => void;
  onClose: () => void;
}) {
  const [limit, setLimit] = useState(String(keyRecord.monthly_limit ?? 0));
  const [action, setAction] = useState<'notify' | 'disable' | 'both'>(keyRecord.monthly_limit_action ?? 'notify');
  const [threshold, setThreshold] = useState(String(keyRecord.limit_notify_threshold ?? 80));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const t = {
    bg: isDark ? 'bg-zinc-900/80 border-white/10' : 'bg-gray-50 border-gray-200',
    text: isDark ? 'text-white' : 'text-gray-900',
    textSub: isDark ? 'text-zinc-400' : 'text-gray-500',
    textFaint: isDark ? 'text-zinc-600' : 'text-gray-400',
    inputBg: isDark ? 'bg-zinc-800 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900',
    btnBase: isDark ? 'border-white/10' : 'border-gray-200',
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${base}?action=update_limit_settings`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_slug: keyRecord.service_slug,
          monthly_limit: parseInt(limit) || 0,
          monthly_limit_action: action,
          limit_notify_threshold: parseInt(threshold) || 80,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onUpdate(keyRecord.service_slug, {
          monthly_limit: parseInt(limit) || 0,
          monthly_limit_action: action,
          limit_notify_threshold: parseInt(threshold) || 80,
        });
        setSaved(true);
        setTimeout(() => { setSaved(false); onClose(); }, 1000);
      }
    } catch (e) {
      console.warn('Limit settings save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('이 서비스의 월 사용량을 0으로 리셋하고 활성화 상태로 복구할까요?')) return;
    try {
      await fetch(`${base}?action=reset_monthly_usage`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_slug: keyRecord.service_slug }),
      });
      onUpdate(keyRecord.service_slug, { monthly_used: 0, limit_notified_at: null, status: 'active' });
      onClose();
    } catch (e) {
      console.warn('Reset failed:', e);
    }
  };

  const actionOptions: Array<{ value: 'notify' | 'disable' | 'both'; label: string; desc: string; icon: string; color: string }> = [
    { value: 'notify', label: '알림만', desc: '한도 초과 시 관리자 알림 발송', icon: 'ri-notification-3-line', color: 'text-amber-400' },
    { value: 'disable', label: '자동 비활성화', desc: '한도 초과 시 키 즉시 비활성화', icon: 'ri-forbid-line', color: 'text-red-400' },
    { value: 'both', label: '알림 + 비활성화', desc: '알림 발송 후 키 자동 비활성화', icon: 'ri-shield-flash-line', color: 'text-indigo-400' },
  ];

  return (
    <div className={`mt-2 ml-5 rounded-xl border p-4 ${t.bg}`}>
      <div className="flex items-center justify-between mb-3">
        <p className={`text-xs font-black ${t.text}`}>월별 한도 설정</p>
        <button onClick={onClose} className={`w-5 h-5 flex items-center justify-center ${t.textFaint} cursor-pointer`}>
          <i className="ri-close-line text-sm" />
        </button>
      </div>

      <div className="space-y-3">
        {/* 월 한도 */}
        <div>
          <label className={`text-[11px] font-semibold ${t.textSub} mb-1.5 block`}>
            월 최대 사용 횟수 <span className={`font-normal ${t.textFaint}`}>(0 = 무제한)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              min="0"
              className={`flex-1 border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none ${t.inputBg}`}
            />
            <span className={`text-xs ${t.textSub} whitespace-nowrap`}>회/월</span>
          </div>
          {parseInt(limit) > 0 && (
            <p className={`text-[10px] ${t.textFaint} mt-1`}>
              현재 사용: {keyRecord.monthly_used.toLocaleString()}회 ({Math.round((keyRecord.monthly_used / parseInt(limit)) * 100)}%)
            </p>
          )}
        </div>

        {/* 경고 임계값 */}
        {parseInt(limit) > 0 && (
          <div>
            <label className={`text-[11px] font-semibold ${t.textSub} mb-1.5 block`}>
              경고 임계값 <span className={`font-normal ${t.textFaint}`}>(한도의 몇 % 도달 시 경고)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="50"
                max="99"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="flex-1 accent-amber-400"
              />
              <span className={`text-sm font-bold text-amber-400 w-10 text-right`}>{threshold}%</span>
            </div>
          </div>
        )}

        {/* 한도 초과 시 동작 */}
        {parseInt(limit) > 0 && (
          <div>
            <label className={`text-[11px] font-semibold ${t.textSub} mb-2 block`}>한도 초과 시 동작</label>
            <div className="space-y-1.5">
              {actionOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAction(opt.value)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-pointer text-left ${
                    action === opt.value
                      ? isDark
                        ? 'border-white/20 bg-white/5'
                        : 'border-gray-300 bg-white'
                      : `${t.btnBase} ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-white'}`
                  }`}
                >
                  <div className={`w-4 h-4 flex items-center justify-center flex-shrink-0`}>
                    <i className={`${opt.icon} ${opt.color} text-sm`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-bold ${t.text}`}>{opt.label}</p>
                    <p className={`text-[10px] ${t.textFaint}`}>{opt.desc}</p>
                  </div>
                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                    action === opt.value
                      ? 'border-indigo-400 bg-indigo-400'
                      : isDark ? 'border-zinc-600' : 'border-gray-300'
                  }`}>
                    {action === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-[11px] font-bold cursor-pointer transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {saved ? (
              <><i className="ri-checkbox-circle-line mr-1" />저장됨</>
            ) : saving ? (
              <><i className="ri-loader-4-line animate-spin mr-1" />저장 중...</>
            ) : (
              <><i className="ri-save-line mr-1" />저장</>
            )}
          </button>
          {keyRecord.monthly_used > 0 && (
            <button
              onClick={handleReset}
              className={`px-3 py-2 rounded-lg text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap ${isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <i className="ri-refresh-line mr-1" />사용량 리셋
            </button>
          )}
          <button
            onClick={onClose}
            className={`px-3 py-2 rounded-lg text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap ${isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 미니 히스토리 바 ──────────────────────────────────────────────────────────
function TestHistoryBar({ history, isDark }: { history: TestHistoryEntry[]; isDark: boolean }) {
  const recent = [...history].slice(0, 10).reverse();
  if (recent.length === 0) return <span className={`text-[10px] ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>이력 없음</span>;

  return (
    <div className="flex items-end gap-0.5 h-4">
      {recent.map((entry, i) => (
        <div
          key={i}
          className={`w-1.5 rounded-sm transition-all ${entry.success ? 'bg-emerald-400' : 'bg-red-400'}`}
          style={{ height: entry.success ? '100%' : '60%' }}
          title={`${formatTime(entry.tested_at)} — ${entry.message}${entry.latency_ms ? ` (${entry.latency_ms}ms)` : ''}`}
        />
      ))}
      {Array.from({ length: Math.max(0, 10 - recent.length) }).map((_, i) => (
        <div key={`empty-${i}`} className={`w-1.5 h-2 rounded-sm ${isDark ? 'bg-zinc-800' : 'bg-gray-200'}`} />
      ))}
    </div>
  );
}

// ── 테스트 이력 드롭다운 ──────────────────────────────────────────────────────
function TestHistoryDropdown({
  history, isDark, onClose,
}: {
  history: TestHistoryEntry[];
  isDark: boolean;
  onClose: () => void;
}) {
  const t = {
    bg: isDark ? 'bg-[#0f0f13] border-white/10' : 'bg-white border-gray-200',
    text: isDark ? 'text-white' : 'text-gray-900',
    textFaint: isDark ? 'text-zinc-600' : 'text-gray-400',
    rowBg: isDark ? 'bg-zinc-900/60' : 'bg-gray-50',
    divider: isDark ? 'divide-white/5' : 'divide-gray-100',
  };

  const successCount = history.filter((h) => h.success).length;
  const avgLatency = history.filter((h) => h.latency_ms).reduce((s, h) => s + (h.latency_ms ?? 0), 0) / (history.filter((h) => h.latency_ms).length || 1);

  return (
    <div className={`absolute right-0 top-full mt-1 z-50 w-80 border rounded-xl shadow-xl overflow-hidden ${t.bg}`}>
      <div className={`px-4 py-3 border-b ${isDark ? 'border-white/5' : 'border-gray-100'} flex items-center justify-between`}>
        <div>
          <p className={`text-xs font-black ${t.text}`}>테스트 이력</p>
          <p className={`text-[10px] ${t.textFaint} mt-0.5`}>최근 {history.length}건 · 성공률 {history.length > 0 ? Math.round((successCount / history.length) * 100) : 0}%</p>
        </div>
        <div className="flex items-center gap-3">
          {history.length > 0 && (
            <div className="text-right">
              <p className={`text-[10px] font-bold ${t.text}`}>{Math.round(avgLatency)}ms</p>
              <p className={`text-[9px] ${t.textFaint}`}>평균 응답</p>
            </div>
          )}
          <button onClick={onClose} className={`w-5 h-5 flex items-center justify-center ${t.textFaint} cursor-pointer`}>
            <i className="ri-close-line text-sm" />
          </button>
        </div>
      </div>

      {history.length > 0 && (
        <div className={`px-4 py-2 border-b ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] ${t.textFaint}`}>성공</span>
            <div className={`flex-1 h-1.5 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'} rounded-full overflow-hidden`}>
              <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${(successCount / history.length) * 100}%` }} />
            </div>
            <span className="text-[10px] text-emerald-400 font-bold">{successCount}/{history.length}</span>
          </div>
          <div className="flex items-end gap-0.5 h-5 mt-1">
            {[...history].reverse().map((entry, i) => (
              <div
                key={i}
                className={`flex-1 rounded-sm ${entry.success ? 'bg-emerald-400' : 'bg-red-400'}`}
                style={{ height: entry.success ? '100%' : '55%', minWidth: '4px' }}
                title={`${formatTime(entry.tested_at)} — ${entry.message}`}
              />
            ))}
          </div>
        </div>
      )}

      <div className={`divide-y ${t.divider} max-h-56 overflow-y-auto`}>
        {history.length === 0 ? (
          <div className={`flex flex-col items-center py-6 ${t.textFaint}`}>
            <i className="ri-history-line text-xl mb-2" />
            <p className="text-[11px]">테스트 이력이 없습니다</p>
          </div>
        ) : (
          history.map((entry, i) => (
            <div key={i} className={`px-4 py-2.5 flex items-start gap-2.5 ${t.rowBg}`}>
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 ${entry.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-[11px] font-semibold ${entry.success ? 'text-emerald-400' : 'text-red-400'} truncate`}>{entry.message}</p>
                  {entry.latency_ms !== undefined && (
                    <span className={`text-[10px] font-mono flex-shrink-0 ${entry.latency_ms < 1000 ? 'text-emerald-400' : entry.latency_ms < 3000 ? 'text-amber-400' : 'text-red-400'}`}>
                      {entry.latency_ms}ms
                    </span>
                  )}
                </div>
                <p className={`text-[10px] ${t.textFaint} mt-0.5`}>{formatTime(entry.tested_at)} · {timeAgo(entry.tested_at)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── 마이그레이션 배너 ─────────────────────────────────────────────────────────
type MigrationPhase = 'idle' | 'scanning' | 'scanned' | 'migrating' | 'done' | 'error';

function MigrationBanner({
  isDark, base, headers, onComplete,
}: {
  isDark: boolean;
  base: string;
  headers: Record<string, string>;
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState<MigrationPhase>('idle');
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [result, setResult] = useState<MigrationResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [expanded, setExpanded] = useState(false);

  const t = {
    text: isDark ? 'text-white' : 'text-gray-900',
    textFaint: isDark ? 'text-zinc-500' : 'text-gray-400',
    divider: isDark ? 'border-white/5' : 'border-gray-100',
    rowBg: isDark ? 'bg-zinc-900/40' : 'bg-gray-50',
  };

  const handleScan = async () => {
    setPhase('scanning');
    setErrorMsg('');
    try {
      const res = await fetch(`${base}?action=scan_legacy`, { headers });
      const data: ScanResult = await res.json();
      setScan(data);
      setPhase('scanned');
    } catch (e) {
      setErrorMsg(String(e));
      setPhase('error');
    }
  };

  const handleMigrate = async () => {
    if (!scan || scan.legacy_count === 0) return;
    setPhase('migrating');
    setErrorMsg('');
    try {
      const res = await fetch(`${base}?action=migrate_legacy_keys`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data: MigrationResponse = await res.json();
      setResult(data);
      setPhase('done');
      setTimeout(onComplete, 800);
    } catch (e) {
      setErrorMsg(String(e));
      setPhase('error');
    }
  };

  const handleReset = () => {
    setPhase('idle');
    setScan(null);
    setResult(null);
    setErrorMsg('');
    setExpanded(false);
  };

  if (phase === 'idle') {
    return (
      <div className={`mx-5 my-3 rounded-xl border ${isDark ? 'border-amber-500/25 bg-amber-500/5' : 'border-amber-200 bg-amber-50'} overflow-hidden`}>
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-500/15 flex-shrink-0">
            <i className="ri-shield-keyhole-line text-amber-400 text-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-400">레거시 키 마이그레이션 도구</p>
            <p className={`text-[10px] ${t.textFaint} mt-0.5`}>enc_v1 (Base64) 형식 키를 AES-GCM 256bit 암호화로 일괄 업그레이드합니다.</p>
          </div>
          <button
            onClick={handleScan}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-[11px] font-bold hover:bg-amber-500/30 cursor-pointer transition-colors whitespace-nowrap flex-shrink-0"
          >
            <i className="ri-search-line mr-1" />스캔 시작
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'scanning') {
    return (
      <div className={`mx-5 my-3 rounded-xl border ${isDark ? 'border-amber-500/25 bg-amber-500/5' : 'border-amber-200 bg-amber-50'} px-4 py-3 flex items-center gap-3`}>
        <i className="ri-loader-4-line animate-spin text-amber-400 text-sm" />
        <p className="text-xs text-amber-400 font-semibold">DB 스캔 중...</p>
      </div>
    );
  }

  if (phase === 'scanned' && scan) {
    const hasLegacy = scan.legacy_count > 0;
    return (
      <div className={`mx-5 my-3 rounded-xl border overflow-hidden ${hasLegacy ? isDark ? 'border-amber-500/25 bg-amber-500/5' : 'border-amber-200 bg-amber-50' : isDark ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50'}`}>
        <div className="px-4 py-3 flex items-center gap-3">
          <div className={`w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 ${hasLegacy ? 'bg-amber-500/15' : 'bg-emerald-500/15'}`}>
            <i className={`text-sm ${hasLegacy ? 'ri-alert-line text-amber-400' : 'ri-shield-check-line text-emerald-400'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold ${hasLegacy ? 'text-amber-400' : 'text-emerald-400'}`}>
              {hasLegacy ? `레거시 키 ${scan.legacy_count}개 발견` : '모든 키가 AES-GCM으로 암호화됨'}
            </p>
            <p className={`text-[10px] ${t.textFaint} mt-0.5`}>전체 {scan.total}개 · AES-GCM {scan.aes_count}개 · enc_v1 {scan.legacy_count}개 · 미등록 {scan.no_key_count}개</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {hasLegacy && (
              <button onClick={() => setExpanded((v) => !v)} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
                {expanded ? '접기' : '상세 보기'}
              </button>
            )}
            {hasLegacy ? (
              <button onClick={handleMigrate} className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[11px] font-bold hover:bg-amber-600 cursor-pointer transition-colors whitespace-nowrap">
                <i className="ri-refresh-line mr-1" />일괄 재암호화
              </button>
            ) : (
              <button onClick={handleReset} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-white text-gray-500'}`}>닫기</button>
            )}
          </div>
        </div>
        {expanded && hasLegacy && (
          <div className={`border-t ${t.divider} px-4 py-2`}>
            <div className="space-y-1">
              {scan.legacy_keys.map((k) => (
                <div key={k.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${t.rowBg}`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  <span className={`text-[11px] font-semibold ${t.text} flex-1`}>{k.service_name}</span>
                  <span className={`text-[10px] font-mono ${t.textFaint}`}>{k.key_hint ?? '—'}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold">enc_v1</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'migrating') {
    return (
      <div className={`mx-5 my-3 rounded-xl border ${isDark ? 'border-indigo-500/25 bg-indigo-500/5' : 'border-indigo-200 bg-indigo-50'} px-4 py-4`}>
        <div className="flex items-center gap-3 mb-3">
          <i className="ri-loader-4-line animate-spin text-indigo-400 text-base" />
          <div>
            <p className="text-xs font-bold text-indigo-400">재암호화 진행 중...</p>
            <p className={`text-[10px] ${t.textFaint} mt-0.5`}>각 키를 복호화 후 AES-GCM으로 재암호화하고 있습니다.</p>
          </div>
        </div>
        <div className={`h-1.5 ${isDark ? 'bg-zinc-800' : 'bg-indigo-100'} rounded-full overflow-hidden`}>
          <div className="h-full bg-indigo-400 rounded-full animate-pulse" style={{ width: '60%' }} />
        </div>
      </div>
    );
  }

  if (phase === 'done' && result) {
    const allSuccess = result.failed === 0;
    return (
      <div className={`mx-5 my-3 rounded-xl border overflow-hidden ${allSuccess ? isDark ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50' : isDark ? 'border-amber-500/25 bg-amber-500/5' : 'border-amber-200 bg-amber-50'}`}>
        <div className="px-4 py-3 flex items-center gap-3">
          <div className={`w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 ${allSuccess ? 'bg-emerald-500/15' : 'bg-amber-500/15'}`}>
            <i className={`text-sm ${allSuccess ? 'ri-checkbox-circle-line text-emerald-400' : 'ri-alert-line text-amber-400'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold ${allSuccess ? 'text-emerald-400' : 'text-amber-400'}`}>{allSuccess ? '마이그레이션 완료!' : '일부 실패'}</p>
            <p className={`text-[10px] ${t.textFaint} mt-0.5`}>{result.message}</p>
          </div>
          <button onClick={handleReset} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-white text-gray-500'}`}>닫기</button>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className={`mx-5 my-3 rounded-xl border ${isDark ? 'border-red-500/25 bg-red-500/5' : 'border-red-200 bg-red-50'} px-4 py-3 flex items-center gap-3`}>
        <i className="ri-close-circle-line text-red-400 text-sm flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-red-400">오류 발생</p>
          <p className={`text-[10px] ${t.textFaint} mt-0.5 truncate`}>{errorMsg}</p>
        </div>
        <button onClick={handleReset} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-white text-gray-500'}`}>재시도</button>
      </div>
    );
  }

  return null;
}

// ── 한도 초과 경고 배너 ───────────────────────────────────────────────────────
function LimitExceededBanner({ keys, isDark }: { keys: ApiKeyRecord[]; isDark: boolean }) {
  const exceededKeys = keys.filter((k) => k.monthly_limit > 0 && k.monthly_used >= k.monthly_limit);
  const nearLimitKeys = keys.filter((k) => {
    if (!k.monthly_limit || k.monthly_limit === 0) return false;
    const pct = (k.monthly_used / k.monthly_limit) * 100;
    const threshold = k.limit_notify_threshold ?? 80;
    return pct >= threshold && k.monthly_used < k.monthly_limit;
  });

  if (exceededKeys.length === 0 && nearLimitKeys.length === 0) return null;

  return (
    <div className="mx-5 my-3 space-y-2">
      {exceededKeys.map((k) => (
        <div
          key={k.service_slug}
          className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${isDark ? 'border-red-500/30 bg-red-500/8' : 'border-red-200 bg-red-50'}`}
        >
          <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/15 flex-shrink-0">
            <i className="ri-error-warning-line text-red-400 text-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-red-400">
              {k.service_name} — 월 한도 초과
            </p>
            <p className={`text-[10px] mt-0.5 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
              {k.monthly_used.toLocaleString()}회 사용 / 한도 {k.monthly_limit.toLocaleString()}회
              {(k.monthly_limit_action === 'disable' || k.monthly_limit_action === 'both') && (
                <span className="ml-1.5 font-bold text-red-400">· 자동 비활성화됨</span>
              )}
            </p>
          </div>
          <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/25 whitespace-nowrap">
            {Math.round((k.monthly_used / k.monthly_limit) * 100)}% 사용
          </span>
        </div>
      ))}

      {nearLimitKeys.map((k) => (
        <div
          key={k.service_slug}
          className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${isDark ? 'border-amber-500/30 bg-amber-500/8' : 'border-amber-200 bg-amber-50'}`}
        >
          <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-500/15 flex-shrink-0">
            <i className="ri-alert-line text-amber-400 text-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-400">
              {k.service_name} — 한도 임박
            </p>
            <p className={`text-[10px] mt-0.5 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
              {k.monthly_used.toLocaleString()}회 사용 / 한도 {k.monthly_limit.toLocaleString()}회
              ({Math.round((k.monthly_used / k.monthly_limit) * 100)}%)
            </p>
          </div>
          <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 whitespace-nowrap">
            {k.limit_notify_threshold ?? 80}% 경고
          </span>
        </div>
      ))}
    </div>
  );
}

// ── 메인 패널 ─────────────────────────────────────────────────────────────────
export default function ApiKeyStatusPanel({ isDark, onKeyRenew }: Props) {
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats>({});
  const [loading, setLoading] = useState(false);
  const [totalCreditsUsed, setTotalCreditsUsed] = useState(0);
  const [totalRequests, setTotalRequests] = useState(0);
  // 테스트 상태: slug → 'testing' | 'success' | 'failed' | null
  const [testStates, setTestStates] = useState<Record<string, 'testing' | 'success' | 'failed'>>({});
  const [openHistorySlug, setOpenHistorySlug] = useState<string | null>(null);
  const [openLimitSlug, setOpenLimitSlug] = useState<string | null>(null);

  const t = {
    cardBg:    isDark ? 'bg-[#0f0f13]'         : 'bg-white',
    border:    isDark ? 'border-white/5'        : 'border-gray-200',
    text:      isDark ? 'text-white'            : 'text-gray-900',
    textSub:   isDark ? 'text-zinc-400'         : 'text-gray-500',
    textFaint: isDark ? 'text-zinc-600'         : 'text-gray-400',
    inputBg2:  isDark ? 'bg-zinc-800'           : 'bg-gray-100',
    rowHover:  isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50/80',
    divider:   isDark ? 'divide-white/[0.03]'   : 'divide-gray-100',
  };

  const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
  const ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;
  const headers = { 'Authorization': `Bearer ${ANON_KEY}` };
  const base = `${SUPABASE_URL}/functions/v1/admin-api-keys`;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [keysRes, statsRes] = await Promise.allSettled([
        fetch(`${base}?action=list`, { headers }),
        fetch(`${base}?action=usage_stats&days=7`, { headers }),
      ]);
      if (keysRes.status === 'fulfilled') {
        const data = await keysRes.value.json();
        if (data.api_keys) setApiKeys(data.api_keys);
      }
      if (statsRes.status === 'fulfilled') {
        const data = await statsRes.value.json();
        if (data.usage_stats) setUsageStats(data.usage_stats);
        if (data.total_credits_used !== undefined) setTotalCreditsUsed(data.total_credits_used);
        if (data.total_requests !== undefined) setTotalRequests(data.total_requests);
      }
    } catch (e) {
      console.warn('API key status load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const legacyCount = apiKeys.filter((k) => k.is_legacy).length;
  const exceededCount = apiKeys.filter((k) => k.monthly_limit > 0 && k.monthly_used >= k.monthly_limit).length;

  const handleTestSaved = useCallback(async (slug: string) => {
    // 테스트 시작: 즉시 'testing' 상태로
    setTestStates((prev) => ({ ...prev, [slug]: 'testing' }));

    try {
      const res = await fetch(`${base}?action=test_saved_key`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_slug: slug }),
      });
      const data = await res.json();

      const resultState: 'success' | 'failed' = data.success ? 'success' : 'failed';

      // 테스트 결과 즉시 반영: 상태 + 이력 + 결과 메시지
      setApiKeys((prev) => prev.map((k) => {
        if (k.service_slug !== slug) return k;
        const newEntry: TestHistoryEntry = {
          tested_at: new Date().toISOString(),
          success: data.success,
          message: data.message,
          latency_ms: data.latency_ms,
        };
        const prevHistory = Array.isArray(k.test_history) ? k.test_history : [];
        return {
          ...k,
          status: data.success ? 'active' : 'error',
          last_tested_at: new Date().toISOString(),
          test_result: data.message,
          test_history: [newEntry, ...prevHistory].slice(0, 30),
        };
      }));

      // 결과 상태 표시 (success/failed 플래시)
      setTestStates((prev) => ({ ...prev, [slug]: resultState }));

      // 2.5초 후 플래시 상태 제거
      setTimeout(() => {
        setTestStates((prev) => {
          const next = { ...prev };
          delete next[slug];
          return next;
        });
      }, 2500);

    } catch (e) {
      console.warn('Test failed:', e);
      setTestStates((prev) => ({ ...prev, [slug]: 'failed' }));
      setTimeout(() => {
        setTestStates((prev) => {
          const next = { ...prev };
          delete next[slug];
          return next;
        });
      }, 2500);
    }
  }, []);

  const handleToggleStatus = async (slug: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await fetch(`${base}?action=toggle_status`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_slug: slug, status: newStatus }),
      });
      setApiKeys((prev) => prev.map((k) => k.service_slug === slug ? { ...k, status: newStatus as 'active' | 'inactive' | 'error' } : k));
    } catch (e) {
      console.warn('Toggle status failed:', e);
    }
  };

  const handleKeyUpdate = useCallback((slug: string, updates: Partial<ApiKeyRecord>) => {
    setApiKeys((prev) => prev.map((k) => k.service_slug === slug ? { ...k, ...updates } : k));
  }, []);

  const statusConfig = {
    active:   { label: '활성', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-400' },
    inactive: { label: '비활성', cls: isDark ? 'bg-zinc-700/60 text-zinc-400 border-zinc-600/30' : 'bg-gray-100 text-gray-500 border-gray-200', dot: isDark ? 'bg-zinc-500' : 'bg-gray-400' },
    error:    { label: '오류', cls: 'bg-red-500/15 text-red-400 border-red-500/25', dot: 'bg-red-400 animate-pulse' },
  };

  return (
    <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
      {/* Header */}
      <div className={`px-5 py-4 border-b ${t.border} flex items-center justify-between`}>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-black ${t.text}`}>API 키 DB 현황</p>
            {legacyCount > 0 && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                레거시 {legacyCount}개
              </span>
            )}
            {exceededCount > 0 && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                <i className="ri-error-warning-line mr-0.5" />한도 초과 {exceededCount}개
              </span>
            )}
          </div>
          <p className={`text-xs ${t.textSub} mt-0.5`}>관리자가 등록한 API 키 — AES-GCM 암호화 저장, 클라이언트 미노출</p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <i className="ri-loader-4-line animate-spin text-zinc-500 text-sm" />}
          <button
            onClick={loadData}
            className={`w-8 h-8 flex items-center justify-center rounded-xl ${t.inputBg2} hover:opacity-80 cursor-pointer transition-colors`}
          >
            <i className={`ri-refresh-line text-sm ${t.textSub}`} />
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className={`px-5 py-3 border-b ${t.border} grid grid-cols-3 gap-4`}>
        {[
          { label: '등록된 서비스', value: `${apiKeys.filter((k) => k.key_hint).length}/${apiKeys.length}개`, icon: 'ri-key-2-line', color: 'text-indigo-400' },
          { label: '7일 총 요청', value: `${totalRequests.toLocaleString()}건`, icon: 'ri-bar-chart-2-line', color: 'text-emerald-400' },
          { label: '7일 크레딧 사용', value: `${totalCreditsUsed.toLocaleString()} CR`, icon: 'ri-coin-line', color: 'text-amber-400' },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <i className={`${s.icon} ${s.color} text-xs`} />
              <p className={`text-sm font-black ${t.text}`}>{s.value}</p>
            </div>
            <p className={`text-[10px] ${t.textFaint}`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* 한도 초과/임박 경고 배너 */}
      <LimitExceededBanner keys={apiKeys} isDark={isDark} />

      {/* 마이그레이션 배너 */}
      <MigrationBanner isDark={isDark} base={base} headers={headers} onComplete={loadData} />

      {/* API Key List */}
      <div className={`divide-y ${t.divider}`}>
        {apiKeys.length === 0 && !loading && (
          <div className={`flex flex-col items-center justify-center py-10 ${t.textFaint}`}>
            <i className="ri-key-2-line text-2xl mb-2" />
            <p className="text-xs">등록된 API 키가 없습니다</p>
          </div>
        )}

        {apiKeys.map((key) => {
          const cfg = statusConfig[key.status] ?? statusConfig.inactive;
          const stats = usageStats[key.service_slug];
          const hasKey = !!key.key_hint;
          const history = Array.isArray(key.test_history) ? key.test_history : [];
          const testState = testStates[key.service_slug] ?? null;
          const isTesting = testState === 'testing';
          const isHistoryOpen = openHistorySlug === key.service_slug;
          const isLimitOpen = openLimitSlug === key.service_slug;

          const successCount = history.filter((h) => h.success).length;
          const successRate = history.length > 0 ? Math.round((successCount / history.length) * 100) : null;
          const latencies = history.filter((h) => h.latency_ms !== undefined).map((h) => h.latency_ms!);
          const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;

          const isExceeded = key.monthly_limit > 0 && key.monthly_used >= key.monthly_limit;
          const usagePct = key.monthly_limit > 0 ? (key.monthly_used / key.monthly_limit) * 100 : 0;
          const isNearLimit = !isExceeded && key.monthly_limit > 0 && usagePct >= (key.limit_notify_threshold ?? 80);

          // 테스트 결과에 따른 실시간 상태 오버라이드
          const liveStatus = testState === 'testing'
            ? key.status
            : testState === 'success'
            ? 'active'
            : testState === 'failed'
            ? 'error'
            : key.status;

          const liveCfg = statusConfig[liveStatus] ?? statusConfig.inactive;

          return (
            <div
              key={key.id}
              className={`px-5 py-4 transition-all ${t.rowHover} ${isExceeded ? isDark ? 'bg-red-500/[0.03]' : 'bg-red-50/50' : ''} ${
                testState === 'success' ? isDark ? 'bg-emerald-500/[0.04]' : 'bg-emerald-50/60' :
                testState === 'failed' ? isDark ? 'bg-red-500/[0.04]' : 'bg-red-50/60' : ''
              }`}
            >
              {/* 상단 행 */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* 상태 dot — 테스트 중이면 스피너, 결과 있으면 즉시 반영 */}
                {isTesting ? (
                  <div className="w-2 h-2 flex items-center justify-center flex-shrink-0">
                    <i className="ri-loader-4-line animate-spin text-amber-400 text-[10px]" />
                  </div>
                ) : (
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${liveCfg.dot} ${testState ? 'scale-125 transition-transform' : ''}`} />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-semibold ${t.text}`}>{key.service_name}</p>

                    {/* 상태 배지 — 테스트 결과 즉시 반영 */}
                    {isTesting ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-500/15 text-amber-400 border-amber-500/25 flex items-center gap-1">
                        <i className="ri-loader-4-line animate-spin text-[9px]" />테스트 중...
                      </span>
                    ) : testState === 'success' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/25 flex items-center gap-1">
                        <i className="ri-checkbox-circle-fill text-[9px]" />연결 성공
                      </span>
                    ) : testState === 'failed' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-500/15 text-red-400 border-red-500/25 flex items-center gap-1">
                        <i className="ri-close-circle-fill text-[9px]" />연결 실패
                      </span>
                    ) : (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${liveCfg.cls}`}>{liveCfg.label}</span>
                    )}

                    {!hasKey && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">키 미등록</span>
                    )}
                    {key.is_legacy && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                        <i className="ri-alert-line mr-0.5" />enc_v1
                      </span>
                    )}
                    {isExceeded && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25 animate-pulse">
                        <i className="ri-error-warning-line mr-0.5" />한도 초과
                      </span>
                    )}
                    {isNearLimit && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                        <i className="ri-alert-line mr-0.5" />한도 임박
                      </span>
                    )}
                  </div>
                  {hasKey && (
                    <p className={`text-[11px] font-mono ${t.textFaint} mt-0.5`}>{key.key_hint}</p>
                  )}
                </div>

                {/* 월 사용량 게이지 */}
                <MonthlyUsageGauge
                  used={key.monthly_used}
                  limit={key.monthly_limit}
                  action={key.monthly_limit_action ?? 'notify'}
                  isDark={isDark}
                />

                {/* Toggle */}
                <button
                  onClick={() => handleToggleStatus(key.service_slug, key.status)}
                  className={`w-8 h-4 rounded-full transition-colors cursor-pointer relative flex-shrink-0 ${liveStatus === 'active' ? 'bg-indigo-500' : isDark ? 'bg-zinc-700' : 'bg-gray-300'}`}
                  title={liveStatus === 'active' ? '비활성화' : '활성화'}
                >
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${liveStatus === 'active' ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>

                {/* 한도 설정 버튼 */}
                <button
                  onClick={() => setOpenLimitSlug(isLimitOpen ? null : key.service_slug)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors whitespace-nowrap flex-shrink-0 ${
                    isLimitOpen
                      ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25'
                      : isExceeded
                      ? 'bg-red-500/15 text-red-400 border border-red-500/25'
                      : isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title="월별 한도 설정"
                >
                  <i className="ri-speed-line mr-1" />한도
                  {key.monthly_limit > 0 && (
                    <span className={`ml-1 ${isExceeded ? 'text-red-400' : isNearLimit ? 'text-amber-400' : t.textFaint}`}>
                      {key.monthly_limit.toLocaleString()}
                    </span>
                  )}
                </button>

                {/* 테스트 버튼 */}
                {hasKey && (
                  <button
                    onClick={() => handleTestSaved(key.service_slug)}
                    disabled={isTesting}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all whitespace-nowrap flex-shrink-0 disabled:cursor-not-allowed ${
                      testState === 'success'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                        : testState === 'failed'
                        ? 'bg-red-500/15 text-red-400 border border-red-500/25'
                        : isTesting
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25 opacity-70'
                        : isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {isTesting ? (
                      <><i className="ri-loader-4-line animate-spin mr-1" />테스트 중</>
                    ) : testState === 'success' ? (
                      <><i className="ri-checkbox-circle-fill mr-1" />성공</>
                    ) : testState === 'failed' ? (
                      <><i className="ri-close-circle-fill mr-1" />실패</>
                    ) : (
                      <><i className="ri-wifi-line mr-1" />테스트</>
                    )}
                  </button>
                )}

                {/* 키 등록/갱신 버튼 */}
                <button
                  onClick={() => onKeyRenew(key.service_slug, key.service_name)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors whitespace-nowrap flex-shrink-0 ${
                    hasKey
                      ? `${t.inputBg2} ${t.textSub} hover:opacity-80`
                      : 'bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 border border-indigo-500/25'
                  }`}
                >
                  {hasKey ? '키 갱신' : '키 등록'}
                </button>
              </div>

              {/* 한도 설정 인라인 패널 */}
              {isLimitOpen && (
                <LimitSettingsPanel
                  keyRecord={key}
                  isDark={isDark}
                  base={base}
                  headers={headers}
                  onUpdate={handleKeyUpdate}
                  onClose={() => setOpenLimitSlug(null)}
                />
              )}

              {/* 하단 행: 테스트 이력 + 통계 */}
              <div className="mt-2.5 ml-5 flex items-center gap-4 flex-wrap">
                {/* 테스트 중이면 실시간 메시지 표시 */}
                {isTesting ? (
                  <div className="flex items-center gap-1.5">
                    <i className="ri-loader-4-line animate-spin text-amber-400 text-[10px]" />
                    <span className="text-[10px] text-amber-400 font-semibold">API 서버에 연결 테스트 중...</span>
                  </div>
                ) : testState === 'success' && key.test_result ? (
                  <div className="flex items-center gap-1.5">
                    <i className="ri-checkbox-circle-fill text-emerald-400 text-[10px]" />
                    <span className="text-[10px] text-emerald-400 font-semibold">{key.test_result}</span>
                    {history[0]?.latency_ms !== undefined && (
                      <span className="text-[10px] font-mono text-emerald-400/70">{history[0].latency_ms}ms</span>
                    )}
                  </div>
                ) : testState === 'failed' && key.test_result ? (
                  <div className="flex items-center gap-1.5">
                    <i className="ri-close-circle-fill text-red-400 text-[10px]" />
                    <span className="text-[10px] text-red-400 font-semibold">{key.test_result}</span>
                  </div>
                ) : key.last_tested_at ? (
                  <div className="flex items-center gap-1.5">
                    <i className={`ri-time-line text-[10px] ${t.textFaint}`} />
                    <span className={`text-[10px] ${t.textFaint}`}>
                      마지막 테스트: <span className={`font-semibold ${key.status === 'active' ? 'text-emerald-400' : key.status === 'error' ? 'text-red-400' : t.textSub}`}>{timeAgo(key.last_tested_at)}</span>
                    </span>
                  </div>
                ) : (
                  <span className={`text-[10px] ${t.textFaint}`}>테스트 기록 없음</span>
                )}

                {!isTesting && successRate !== null && (
                  <div className="flex items-center gap-1.5">
                    <i className={`ri-percent-line text-[10px] ${t.textFaint}`} />
                    <span className={`text-[10px] font-bold ${successRate >= 80 ? 'text-emerald-400' : successRate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                      성공률 {successRate}%
                    </span>
                  </div>
                )}

                {!isTesting && avgLatency !== null && (
                  <div className="flex items-center gap-1.5">
                    <i className={`ri-speed-line text-[10px] ${t.textFaint}`} />
                    <span className={`text-[10px] font-mono ${avgLatency < 1000 ? 'text-emerald-400' : avgLatency < 3000 ? 'text-amber-400' : 'text-red-400'}`}>
                      avg {avgLatency}ms
                    </span>
                  </div>
                )}

                {!isTesting && stats && (
                  <>
                    <div className={`w-px h-3 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
                    <span className={`text-[10px] font-semibold ${t.textFaint}`}>7일 생성 요청</span>
                    <span className={`text-[10px] font-mono ${t.textSub}`}>{stats.total}건</span>
                    <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-400">
                      <i className="ri-checkbox-circle-fill text-[9px]" />성공 {stats.success}
                    </span>
                    {stats.failed > 0 && (
                      <span
                        className="flex items-center gap-0.5 text-[10px] font-bold text-red-400 cursor-help"
                        title="지난 7일간 사용자 AI 생성 요청 중 실패한 건수입니다. 키 연결 오류가 아닌 생성 중 타임아웃·모델 오류 등으로 실패한 요청입니다."
                      >
                        <i className="ri-close-circle-fill text-[9px]" />
                        생성 실패 {stats.failed}
                        <i className="ri-question-line text-[8px] opacity-60 ml-0.5" />
                      </span>
                    )}
                    {stats.total > 0 && (
                      <span className={`text-[10px] font-bold ${
                        stats.failed === 0 ? 'text-emerald-400' :
                        (stats.success / stats.total) >= 0.9 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {Math.round((stats.success / stats.total) * 100)}%
                      </span>
                    )}
                    {stats.credits > 0 && (
                      <span className={`text-[10px] ${t.textFaint}`}>
                        <i className="ri-coin-line mr-0.5" />{stats.credits.toLocaleString()} CR
                      </span>
                    )}
                  </>
                )}

                {!isTesting && history.length > 0 && (
                  <>
                    <div className={`w-px h-3 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
                    <div className="flex items-center gap-2">
                      <TestHistoryBar history={history} isDark={isDark} />
                      <div className="relative">
                        <button
                          onClick={() => setOpenHistorySlug(isHistoryOpen ? null : key.service_slug)}
                          className={`text-[10px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                          이력 {history.length}건 <i className={isHistoryOpen ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} />
                        </button>
                        {isHistoryOpen && (
                          <TestHistoryDropdown
                            history={history}
                            isDark={isDark}
                            onClose={() => setOpenHistorySlug(null)}
                          />
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 최근 테스트 결과 메시지 (테스트 상태 없을 때만) */}
              {!testState && key.test_result && (
                <div className="mt-1.5 ml-5">
                  <span className={`text-[10px] ${key.status === 'active' ? 'text-emerald-400' : key.status === 'error' ? 'text-red-400' : t.textFaint}`}>
                    {key.status === 'active' ? <i className="ri-checkbox-circle-line mr-1" /> : <i className="ri-close-circle-line mr-1" />}
                    {key.test_result}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* fal.ai 우선 사용 안내 */}
      <div className={`px-5 py-3 border-t ${t.border} flex items-start gap-2 bg-amber-500/5`}>
        <i className="ri-flashlight-line text-amber-400 text-xs flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[11px] font-bold text-amber-400 mb-0.5">fal.ai 통합 API 우선 사용</p>
          <p className={`text-[10px] ${t.textFaint}`}>
            fal.ai 키가 등록되면 이미지·영상·TTS·음악·SFX·전사 모두 fal.ai를 우선 사용합니다. fal.ai 키가 없으면 GoAPI/ElevenLabs로 자동 폴백됩니다.
            <a href="https://fal.ai/dashboard" target="_blank" rel="noopener noreferrer" className="ml-1 text-amber-400 underline">fal.ai 대시보드 →</a>
          </p>
        </div>
      </div>

      {/* Security Notice */}
      <div className={`px-5 py-3 border-t ${t.border} flex items-center gap-2`}>
        <i className="ri-shield-keyhole-line text-indigo-400 text-xs flex-shrink-0" />
        <p className={`text-[10px] ${t.textFaint}`}>
          모든 API 키는 AES-GCM 256bit 암호화로 DB에 저장됩니다. 클라이언트 코드에는 절대 노출되지 않으며, Edge Function이 중개 역할을 합니다.
        </p>
      </div>
    </div>
  );
}
