import { useState } from 'react';
import { getAuthorizationHeader, SUPABASE_URL } from '@/lib/env';

interface ProbeError {
  error: string;
  message: string;
  action: string;
  kind: string;
  fal_error_type: string | null;
  http_status: number;
  is_retryable: boolean;
}

interface ProbeResult {
  task: string;
  model: string;
  ok: boolean;
  http_status: number | null;
  duration_ms: number;
  error?: ProbeError;
  fal_request_id?: string | null;
  note?: string;
}

interface DiagnosticReport {
  timestamp: string;
  fal_key_found: boolean;
  fal_key_source: 'db' | 'env' | null;
  app_jwt_secret_set: boolean;
  allowed_origins: string | null;
  probes: ProbeResult[];
  summary: { total: number; ok: number; failed: number; skipped: number };
  error?: string;
  action?: string;
}

const KIND_LABEL: Record<string, { label: string; tone: string }> = {
  auth:             { label: '인증 실패',     tone: 'text-red-400 bg-red-500/10 border-red-500/20' },
  forbidden:        { label: '권한 부족',     tone: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  payment_required: { label: '결제수단 필요', tone: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  not_found:        { label: '모델 없음',     tone: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  validation:       { label: '입력 오류',     tone: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  rate_limited:     { label: '한도 초과',     tone: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
  timeout:          { label: '타임아웃',       tone: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20' },
  content_policy:   { label: '정책 차단',     tone: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20' },
  server_error:     { label: '서버 오류',     tone: 'text-red-400 bg-red-500/10 border-red-500/20' },
  unknown:          { label: '알 수 없음',     tone: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20' },
};

interface Props {
  isDark: boolean;
  onToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function DiagnosticHealthcheckPanel({ isDark, onToast }: Props) {
  const [running, setRunning] = useState(false);
  const [includeVideo, setIncludeVideo] = useState(false);
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cardBg   = isDark ? 'bg-zinc-900/60'  : 'bg-white';
  const subBg    = isDark ? 'bg-zinc-800/60'  : 'bg-slate-50';
  const border   = isDark ? 'border-white/5'  : 'border-slate-200';
  const text     = isDark ? 'text-white'      : 'text-slate-900';
  const subText  = isDark ? 'text-zinc-400'   : 'text-slate-600';
  const faintText = isDark ? 'text-zinc-500'  : 'text-slate-500';

  const runDiagnostic = async () => {
    setRunning(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/diagnostic-healthcheck`,
        {
          method: 'POST',
          headers: {
            'Authorization': getAuthorizationHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ include_video: includeVideo }),
        },
      );
      const data: DiagnosticReport = await res.json();
      if (!res.ok && !data.probes) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setReport(data);
      const failed = data.summary?.failed ?? 0;
      onToast?.(
        failed === 0 ? `진단 완료 — 모든 항목 정상 (${data.summary?.ok}/${data.summary?.total})` : `진단 완료 — ${failed}건 실패`,
        failed === 0 ? 'success' : 'warning',
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      onToast?.(`진단 실패: ${msg}`, 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className={`${cardBg} border ${border} rounded-2xl p-5`}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className={`font-bold text-base ${text}`}>fal.ai 통합 진단</h3>
            <p className={`text-xs ${subText} mt-1 max-w-2xl leading-relaxed`}>
              관리자 키 테스트는 인증만 검증합니다. 이 도구는 generate-image / generate-video가 실제로 호출하는
              경로(sync, queue, 폴링)를 작은 페이로드로 직접 호출해 어디서 막히는지 짚어드립니다.
            </p>
          </div>
          <button
            onClick={runDiagnostic}
            disabled={running}
            className="flex-shrink-0 flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
          >
            {running ? (
              <><i className="ri-loader-4-line animate-spin" /> 진단 중...</>
            ) : (
              <><i className="ri-stethoscope-line" /> 전체 점검 실행</>
            )}
          </button>
        </div>

        <label className={`flex items-center gap-2 text-xs ${subText} cursor-pointer select-none`}>
          <input
            type="checkbox"
            checked={includeVideo}
            onChange={(e) => setIncludeVideo(e.target.checked)}
            disabled={running}
            className="rounded accent-indigo-500"
          />
          영상 모델도 포함 (Kling v1 큐 제출까지만 검증, 추가 비용 약 0크레딧)
        </label>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3">
          <i className="ri-error-warning-line text-red-400 text-lg mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-red-300 text-sm">진단 실행 실패</p>
            <p className="text-xs text-red-200/80 mt-1 break-words">{error}</p>
          </div>
        </div>
      )}

      {report && (
        <>
          {/* Top-line environment summary */}
          <div className={`${cardBg} border ${border} rounded-2xl p-5`}>
            <h4 className={`text-xs font-bold uppercase tracking-wider ${faintText} mb-3`}>환경 점검</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <EnvCheck
                ok={report.fal_key_found}
                label="fal.ai API 키 등록"
                detail={report.fal_key_found ? `소스: ${report.fal_key_source === 'db' ? 'api_keys 테이블' : 'FAL_KEY env'}` : '관리자 패널 → AI 엔진 → API 키 관리에서 등록 필요'}
                isDark={isDark}
              />
              <EnvCheck
                ok={report.app_jwt_secret_set}
                label="APP_JWT_SECRET 설정"
                detail={report.app_jwt_secret_set ? '키 복호화 가능' : '미설정 — 기본값 사용 (보안 권장 사항: 명시적 설정)'}
                isDark={isDark}
              />
              <EnvCheck
                ok={Boolean(report.allowed_origins) || true}
                label="ALLOWED_ORIGINS"
                detail={report.allowed_origins ?? '미설정 — 모든 도메인 허용 (개발용 fallback)'}
                isDark={isDark}
                warn={!report.allowed_origins}
              />
              <EnvCheck
                ok={report.probes.length > 0}
                label="실제 호출 검증"
                detail={`${report.summary.ok}/${report.summary.total} 성공 · ${report.summary.failed} 실패 · ${report.summary.skipped} 건너뜀`}
                isDark={isDark}
                warn={report.summary.failed > 0}
              />
            </div>
          </div>

          {/* Per-probe matrix */}
          {report.probes.length > 0 && (
            <div className={`${cardBg} border ${border} rounded-2xl p-5`}>
              <h4 className={`text-xs font-bold uppercase tracking-wider ${faintText} mb-3`}>fal.ai 호출 검증</h4>
              <div className="space-y-2">
                {report.probes.map((p, i) => (
                  <div
                    key={i}
                    className={`${subBg} border ${border} rounded-xl p-3 flex items-start gap-3`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      p.ok ? 'bg-emerald-500/15 text-emerald-400'
                      : p.note ? 'bg-zinc-700 text-zinc-500'
                      : 'bg-red-500/15 text-red-400'
                    }`}>
                      <i className={p.ok ? 'ri-check-line' : p.note ? 'ri-skip-forward-line' : 'ri-close-line'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-bold text-sm ${text}`}>{p.task}</p>
                        {p.http_status != null && (
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            p.ok ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-red-500/10 text-red-400'
                          }`}>HTTP {p.http_status}</span>
                        )}
                        <span className={`text-[10px] font-mono ${faintText}`}>{p.duration_ms}ms</span>
                        {p.error?.kind && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${KIND_LABEL[p.error.kind]?.tone ?? KIND_LABEL.unknown.tone}`}>
                            {KIND_LABEL[p.error.kind]?.label ?? p.error.kind}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs ${faintText} mt-0.5 font-mono break-all`}>{p.model}</p>
                      {p.note && (
                        <p className={`text-xs ${subText} mt-1.5 italic`}>{p.note}</p>
                      )}
                      {p.error && (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-red-300 leading-relaxed">{p.error.message}</p>
                          <p className="text-[11px] text-amber-300/90 leading-relaxed flex items-start gap-1.5">
                            <i className="ri-arrow-right-line mt-0.5 flex-shrink-0" />
                            <span>{p.error.action}</span>
                          </p>
                          {p.fal_request_id && (
                            <p className="text-[10px] font-mono text-zinc-600">fal_request_id: {p.fal_request_id}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className={`text-[10px] ${faintText} mt-3`}>
                실행 시각: {new Date(report.timestamp).toLocaleString('ko-KR')}
              </p>
            </div>
          )}

          {/* Top-level error path (no key, etc.) */}
          {report.error && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="font-bold text-amber-300 text-sm">{report.error}</p>
              {report.action && (
                <p className="text-xs text-amber-200/80 mt-1.5 leading-relaxed">{report.action}</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EnvCheck({
  ok, label, detail, isDark, warn,
}: {
  ok: boolean;
  label: string;
  detail: string;
  isDark: boolean;
  warn?: boolean;
}) {
  const cls = warn
    ? 'bg-amber-500/10 border-amber-500/20'
    : ok ? 'bg-emerald-500/8 border-emerald-500/20'
         : 'bg-red-500/10 border-red-500/20';
  const iconCls = warn ? 'text-amber-400' : ok ? 'text-emerald-400' : 'text-red-400';
  const labelText = isDark ? 'text-zinc-200' : 'text-slate-800';
  const detailText = isDark ? 'text-zinc-500' : 'text-slate-500';

  return (
    <div className={`rounded-xl border p-3 flex items-start gap-2.5 ${cls}`}>
      <i className={`${warn ? 'ri-alert-line' : ok ? 'ri-check-line' : 'ri-close-line'} ${iconCls} text-sm mt-0.5`} />
      <div className="min-w-0">
        <p className={`text-xs font-bold ${labelText}`}>{label}</p>
        <p className={`text-[11px] ${detailText} mt-0.5 leading-relaxed break-words`}>{detail}</p>
      </div>
    </div>
  );
}
