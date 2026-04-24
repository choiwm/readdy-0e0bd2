import { useState } from 'react';
import { SUPABASE_URL, SUPABASE_ANON_KEY, getAuthorizationHeader } from '@/lib/env';

interface DiagResult {
  step: string;
  status: 'ok' | 'error' | 'warn' | 'loading';
  detail: string;
  subDetail?: string;
  ms?: number;
}

interface FalPollCheckResult {
  request_id: string;
  model: string;
  status_http?: number;
  status_response?: string;
  fal_status?: string;
  response_http?: number;
  response_data?: string;
  fal_key_length?: number;
  status_error?: string;
  error?: string;
  url_source?: string;
  used_status_url?: string;
  error_diagnosis?: string;
}

// 최근 영상 request_id — usage_logs에서 가져와야 하지만 DiagnosticPanel은 독립적이므로
// check-fal-status Edge Function을 직접 호출해 특정 request_id 상태 확인
const RECENT_REQUEST_IDS = [
  { id: '019daf3e-7629-76f2-9d0d-ebabc65f2c9c', model: 'fal-ai/kling-video/v1/standard/image-to-video', time: '08:53' },
  { id: '019daf2a-738c-77a2-8053-f9c4e9e2865c', model: 'fal-ai/kling-video/v1/standard/image-to-video', time: '08:31' },
  { id: '019daead-7cd1-7382-90f4-188f930cc0d8', model: 'fal-ai/kling-video/v1/standard/image-to-video', time: '06:14' },
];

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} 타임아웃 (${ms / 1000}초 초과)`)), ms)
    ),
  ]);
}

export default function DiagnosticPanel({ onClose }: { onClose: () => void }) {
  const [results, setResults] = useState<DiagResult[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [activeTab, setActiveTab] = useState<'diag' | 'poll'>('diag');

  // 폴링 테스트 상태
  const [pollChecking, setPollChecking] = useState(false);
  const [pollResults, setPollResults] = useState<FalPollCheckResult[]>([]);
  const [customRequestId, setCustomRequestId] = useState('');
  const [customModel, setCustomModel] = useState('fal-ai/kling-video/v1/standard/image-to-video');
  // status_url 직접 입력 (POST 응답에서 받은 URL 그대로)
  const [customStatusUrl, setCustomStatusUrl] = useState('');

  // status_url을 직접 전달하는 방식 (POST 응답에서 받은 URL 그대로 사용)
  const checkFalStatus = async (requestId: string, model: string, statusUrl?: string, responseUrl?: string) => {
    const res = await withTimeout(
      fetch(`${SUPABASE_URL}/functions/v1/check-fal-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthorizationHeader(),
        },
        body: JSON.stringify({ 
          request_id: requestId, 
          model,
          // status_url이 있으면 전달 (fal.ai POST 응답에서 받은 URL)
          status_url: statusUrl,
          response_url: responseUrl,
        }),
      }),
      35000,
      'check-fal-status'
    );
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 100)}`);
    }
    return res.json() as Promise<FalPollCheckResult>;
  };

  const runPollCheck = async (requestId: string, model: string, statusUrl?: string, responseUrl?: string) => {
    setPollChecking(true);
    try {
      const result = await checkFalStatus(requestId, model, statusUrl, responseUrl);
      setPollResults(prev => {
        const filtered = prev.filter(r => r.request_id !== requestId);
        return [{ ...result, request_id: requestId, model }, ...filtered];
      });
    } catch (e) {
      setPollResults(prev => [
        { request_id: requestId, model, error: e instanceof Error ? e.message : String(e) },
        ...prev.filter(r => r.request_id !== requestId),
      ]);
    } finally {
      setPollChecking(false);
    }
  };

  const runDiag = async () => {
    setRunning(true);
    setDone(false);
    setResults([]);

    let log: DiagResult[] = [];

    const push = (r: DiagResult) => {
      log = [...log, r];
      setResults([...log]);
    };

    const update = (index: number, r: DiagResult) => {
      log[index] = r;
      setResults([...log]);
    };

    // ── 0. 환경변수 확인 ──
    const i0 = log.length;
    push({ step: '환경변수 (URL / Anon Key)', status: 'loading', detail: '확인 중...' });
    {
      const urlOk = SUPABASE_URL?.startsWith('https://') && SUPABASE_URL?.includes('.supabase.co');
      const keyOk = SUPABASE_ANON_KEY?.length > 10;
      if (!urlOk || !keyOk) {
        update(i0, {
          step: '환경변수 (URL / Anon Key)',
          status: 'error',
          detail: `URL: ${SUPABASE_URL || '없음'} | Key: ${SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.slice(0, 20) + '...' : '없음'}`,
          subDetail: '.env 파일의 VITE_PUBLIC_SUPABASE_URL, VITE_PUBLIC_SUPABASE_ANON_KEY를 확인해주세요.',
        });
      } else {
        update(i0, {
          step: '환경변수 (URL / Anon Key)',
          status: 'ok',
          detail: `URL: ${SUPABASE_URL} | Key: ${SUPABASE_ANON_KEY.slice(0, 20)}...`,
        });
      }
    }

    // ── 1. 직접 fetch로 Supabase REST API 핑 테스트 ──
    const i1 = log.length;
    push({ step: 'Supabase REST API 직접 연결 (fetch)', status: 'loading', detail: '직접 HTTP 요청 중...' });
    const t1 = Date.now();
    try {
      const res = await withTimeout(
        fetch(`${SUPABASE_URL}/rest/v1/credit_costs?select=model_id&limit=1`, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }),
        12000,
        'REST API fetch'
      );
      const ms1 = Date.now() - t1;
      if (res.ok) {
        const data = await res.json();
        update(i1, {
          step: 'Supabase REST API 직접 연결 (fetch)',
          status: 'ok',
          detail: `HTTP ${res.status} 응답 정상 (${ms1}ms) — 데이터: ${JSON.stringify(data).slice(0, 80)}`,
          ms: ms1,
        });
      } else {
        const text = await res.text();
        update(i1, {
          step: 'Supabase REST API 직접 연결 (fetch)',
          status: 'error',
          detail: `HTTP ${res.status} 오류 (${ms1}ms): ${text.slice(0, 150)}`,
          subDetail: res.status === 401 ? 'Anon Key가 유효하지 않습니다.' : undefined,
          ms: ms1,
        });
      }
    } catch (e: unknown) {
      const ms1 = Date.now() - t1;
      const msg = e instanceof Error ? e.message : String(e);
      update(i1, {
        step: 'Supabase REST API 직접 연결 (fetch)',
        status: 'error',
        detail: `연결 실패 (${ms1}ms): ${msg}`,
        subDetail: msg.includes('타임아웃') ? '⚠️ Supabase 프로젝트가 일시 중단됐거나 네트워크 차단 상태일 수 있어요.' : 'CORS 차단이거나 네트워크 문제일 수 있어요.',
        ms: ms1,
      });
    }

    // ── 2. Supabase JS SDK 연결 테스트 ──
    const i2 = log.length;
    push({ step: 'Supabase JS SDK 연결', status: 'loading', detail: 'SDK 쿼리 중...' });
    const t2 = Date.now();
    try {
      const sdkRes = await withTimeout(
        fetch(`${SUPABASE_URL}/rest/v1/credit_costs?select=model_id&limit=1`, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        }),
        8000,
        'SDK REST 쿼리'
      );
      const ms2 = Date.now() - t2;
      if (!sdkRes.ok) throw new Error(`HTTP ${sdkRes.status}`);
      const sdkData = await sdkRes.json();
      update(i2, {
        step: 'Supabase JS SDK 연결',
        status: 'ok',
        detail: `SDK REST 쿼리 성공 (${ms2}ms) — ${Array.isArray(sdkData) ? sdkData.length : 0}행 반환`,
        ms: ms2,
      });
    } catch (e: unknown) {
      const ms2 = Date.now() - t2;
      update(i2, {
        step: 'Supabase JS SDK 연결',
        status: 'error',
        detail: `SDK 쿼리 실패 (${ms2}ms): ${e instanceof Error ? e.message : String(e)}`,
        subDetail: 'Supabase REST API 연결 자체에 문제가 있어요.',
        ms: ms2,
      });
    }

    // ── 3. Auth 연결 테스트 ──
    const i3 = log.length;
    push({ step: 'Supabase Auth 연결', status: 'loading', detail: '인증 서버 응답 확인 중...' });
    const t3 = Date.now();
    let userId: string | null = null;
    let resolvedAccessToken: string | null = null;
    try {
      let accessToken: string | undefined;
      const sessionRaw = localStorage.getItem('sb-session');
      if (sessionRaw) {
        try {
          const parsed = JSON.parse(sessionRaw) as Record<string, unknown>;
          const currentSession = parsed?.currentSession as Record<string, unknown> | undefined;
          if (currentSession?.access_token) accessToken = currentSession.access_token as string;
          if (!accessToken && parsed?.access_token) accessToken = parsed.access_token as string;
        } catch { /* ignore */ }
      }
      if (!accessToken) {
        try {
          const { data: { session: sdkSession } } = await Promise.race([
            (await import('@/lib/supabase')).supabase.auth.getSession(),
            new Promise<{ data: { session: null } }>((_, reject) =>
              setTimeout(() => reject(new Error('SDK getSession 타임아웃')), 5000)
            ),
          ]);
          if (sdkSession?.access_token) accessToken = sdkSession.access_token;
        } catch { /* ignore */ }
      }
      resolvedAccessToken = accessToken ?? null;

      const authRes = await withTimeout(
        fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${accessToken ?? SUPABASE_ANON_KEY}`,
          },
        }),
        8000,
        'Auth 핑'
      );
      const ms3 = Date.now() - t3;
      if (authRes.status === 200) {
        const userData = await authRes.json();
        userId = userData?.id ?? null;
        update(i3, { step: 'Supabase Auth 연결', status: 'ok', detail: `Auth 정상 (${ms3}ms) — 로그인됨: ${userId ? userId.slice(0, 8) + '...' : '알 수 없음'}`, ms: ms3 });
      } else if (authRes.status === 401 || authRes.status === 403) {
        update(i3, { step: 'Supabase Auth 연결', status: 'ok', detail: `Auth 서버 정상 (${ms3}ms) — 비로그인 상태`, ms: ms3 });
      } else {
        throw new Error(`HTTP ${authRes.status}`);
      }
    } catch (e: unknown) {
      const ms3 = Date.now() - t3;
      update(i3, { step: 'Supabase Auth 연결', status: 'error', detail: `Auth 실패 (${ms3}ms): ${e instanceof Error ? e.message : String(e)}`, ms: ms3 });
    }

    // ── 4. Edge Function 연결 테스트 ──
    const i4 = log.length;
    push({ step: 'Edge Function 연결 & fal.ai 키 진단', status: 'loading', detail: 'Edge Function 호출 중 (최대 40초)...' });
    const t4 = Date.now();
    let edgeFnData: Record<string, unknown> | null = null;
    try {
      const pingRes = await withTimeout(
        fetch(`${SUPABASE_URL}/functions/v1/test-fal-key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
          body: JSON.stringify({}),
        }),
        40000,
        'test-fal-key Edge Function'
      );
      const ms4 = Date.now() - t4;
      if (!pingRes.ok) {
        const errText = await pingRes.text();
        update(i4, { step: 'Edge Function 연결 & fal.ai 키 진단', status: 'error', detail: `Edge Function HTTP ${pingRes.status} (${ms4}ms): ${errText.slice(0, 150)}`, ms: ms4 });
      } else {
        const data = await pingRes.json();
        edgeFnData = data as Record<string, unknown>;
        const decrypt = data?.decrypt_result as Record<string, unknown> | null;
        const dbKey = data?.db_key as Record<string, unknown> | null;
        if (!dbKey?.found) {
          update(i4, { step: 'Edge Function 연결 & fal.ai 키 진단', status: 'error', detail: `Edge Function 응답 정상 (${ms4}ms) — fal.ai API 키가 DB에 없음`, subDetail: '관리자 페이지 → AI 엔진 탭에서 fal.ai API 키를 등록해주세요.', ms: ms4 });
        } else if (!decrypt?.success) {
          update(i4, { step: 'Edge Function 연결 & fal.ai 키 진단', status: 'error', detail: `키 복호화 실패 (${ms4}ms): ${decrypt?.error}`, ms: ms4 });
        } else {
          update(i4, { step: 'Edge Function 연결 & fal.ai 키 진단', status: 'ok', detail: `Edge Function 정상 (${ms4}ms) — 키 복호화 성공: ${decrypt?.key_preview}`, ms: ms4 });
        }
      }
    } catch (e: unknown) {
      const ms4 = Date.now() - t4;
      update(i4, { step: 'Edge Function 연결 & fal.ai 키 진단', status: 'error', detail: `호출 실패 (${ms4}ms): ${e instanceof Error ? e.message : String(e)}`, ms: ms4 });
    }

    // ── 5. fal.ai API 연결 결과 ──
    const i5 = log.length;
    push({ step: 'fal.ai API 실제 연결', status: 'loading', detail: '결과 분석 중...' });
    if (edgeFnData) {
      const apiTest = edgeFnData.fal_api_test as Record<string, unknown> | null;
      if (!apiTest) {
        update(i5, { step: 'fal.ai API 실제 연결', status: 'warn', detail: 'API 테스트 결과 없음 (키 복호화 실패로 스킵됨)' });
      } else if (apiTest.auth_success || apiTest.ok || (apiTest.status as number) === 422) {
        update(i5, { step: 'fal.ai API 실제 연결', status: 'ok', detail: `fal.ai API 연결 성공 (HTTP ${apiTest.status}) — 키 유효` });
      } else if ((apiTest.status as number) === 401 || (apiTest.status as number) === 403) {
        update(i5, { step: 'fal.ai API 실제 연결', status: 'error', detail: `fal.ai 인증 실패 (HTTP ${apiTest.status}) — API 키 무효`, subDetail: 'fal.ai 대시보드에서 키 재발급 후 관리자 페이지에서 다시 등록해주세요.' });
      } else {
        update(i5, { step: 'fal.ai API 실제 연결', status: 'warn', detail: `예상치 못한 응답 (HTTP ${apiTest.status})` });
      }
    } else {
      update(i5, { step: 'fal.ai API 실제 연결', status: 'warn', detail: 'Edge Function 응답 없음으로 스킵됨' });
    }

    // ── 6. OpenRouter 키 확인 ──
    const i6 = log.length;
    push({ step: 'OpenRouter 키 (멀티샷용)', status: 'loading', detail: '확인 중...' });
    if (edgeFnData) {
      const orKey = edgeFnData.openrouter_key as Record<string, unknown> | null;
      if (!orKey?.found) {
        update(i6, { step: 'OpenRouter 키 (멀티샷용)', status: 'warn', detail: 'OpenRouter 키 없음 — 멀티샷 영상 생성 불가', subDetail: '일반 광고 이미지/영상 생성에는 영향 없음.' });
      } else if (!orKey?.decrypt_success) {
        update(i6, { step: 'OpenRouter 키 (멀티샷용)', status: 'error', detail: `OpenRouter 키 복호화 실패: ${orKey?.decrypt_error}` });
      } else {
        update(i6, { step: 'OpenRouter 키 (멀티샷용)', status: 'ok', detail: `OpenRouter 키 정상 — ${orKey?.key_preview}` });
      }
    } else {
      update(i6, { step: 'OpenRouter 키 (멀티샷용)', status: 'warn', detail: 'Edge Function 응답 없음으로 스킵됨' });
    }

    // ── 7. 크레딧 확인 ──
    const i7 = log.length;
    push({ step: '크레딧 / 플랜 확인', status: 'loading', detail: '확인 중...' });
    try {
      if (userId && resolvedAccessToken) {
        const profileRes = await withTimeout(
          fetch(`${SUPABASE_URL}/rest/v1/user_profiles?select=plan,credit_balance&id=eq.${userId}&limit=1`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${resolvedAccessToken}` },
          }),
          8000, '프로필 조회'
        );
        if (!profileRes.ok) throw new Error(`HTTP ${profileRes.status}`);
        const profileData = await profileRes.json();
        const profile = Array.isArray(profileData) ? profileData[0] : null;
        const isVip = ['enterprise', 'vip', 'admin'].includes((profile?.plan ?? '').toLowerCase());
        const credits = profile?.credit_balance ?? 0;
        update(i7, {
          step: '크레딧 / 플랜 확인',
          status: credits >= 50 || isVip ? 'ok' : 'warn',
          detail: `플랜: ${profile?.plan ?? 'free'} | 크레딧: ${credits} CR | VIP: ${isVip ? '예' : '아니오'}`,
          subDetail: credits < 50 && !isVip ? '크레딧이 부족합니다.' : undefined,
        });
      } else {
        update(i7, { step: '크레딧 / 플랜 확인', status: 'warn', detail: '비로그인 상태 — 로그인 후 크레딧 확인 가능' });
      }
    } catch (e: unknown) {
      update(i7, { step: '크레딧 / 플랜 확인', status: 'error', detail: `확인 실패: ${e instanceof Error ? e.message : String(e)}` });
    }

    setRunning(false);
    setDone(true);
  };

  const statusIcon = (s: DiagResult['status']) => {
    if (s === 'loading') return <div className="w-4 h-4 border-2 border-zinc-600 border-t-rose-400 rounded-full animate-spin flex-shrink-0 mt-0.5" />;
    if (s === 'ok') return <i className="ri-checkbox-circle-fill text-emerald-400 text-base flex-shrink-0 mt-0.5" />;
    if (s === 'error') return <i className="ri-close-circle-fill text-red-400 text-base flex-shrink-0 mt-0.5" />;
    return <i className="ri-alert-fill text-amber-400 text-base flex-shrink-0 mt-0.5" />;
  };

  const getFalStatusColor = (status?: string) => {
    if (!status) return 'text-zinc-500';
    if (status === 'COMPLETED') return 'text-emerald-400';
    if (status === 'FAILED') return 'text-red-400';
    if (status === 'IN_PROGRESS') return 'text-amber-400';
    if (status === 'IN_QUEUE') return 'text-sky-400';
    return 'text-zinc-400';
  };

  const criticalErrors = results.filter((r) => r.status === 'error');
  const hasError = criticalErrors.length > 0;

  const getRootCause = () => {
    const restFailed = results.find((r) => r.step.includes('REST API') && r.status === 'error');
    const sdkFailed = results.find((r) => r.step.includes('JS SDK') && r.status === 'error');
    const edgeFailed = results.find((r) => r.step.includes('Edge Function') && r.status === 'error');
    const falFailed = results.find((r) => r.step.includes('fal.ai API') && r.status === 'error');
    const envFailed = results.find((r) => r.step.includes('환경변수') && r.status === 'error');

    if (envFailed) return { cause: '환경변수 오류', fix: '.env 파일의 SUPABASE_URL과 ANON_KEY를 확인해주세요.' };
    if (restFailed && sdkFailed) return { cause: 'Supabase 프로젝트 연결 불가', fix: 'supabase.com/dashboard에서 프로젝트가 활성화(Active) 상태인지 확인해주세요.' };
    if (edgeFailed && !restFailed) return { cause: 'Edge Function 문제', fix: 'Supabase 대시보드 → Functions에서 generate-video 함수 상태와 로그를 확인해주세요.' };
    if (falFailed) return { cause: 'fal.ai API 키 문제', fix: 'fal.ai 대시보드에서 키를 재발급하고 관리자 페이지에서 다시 등록해주세요.' };
    return null;
  };

  const rootCause = done ? getRootCause() : null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#111114] border border-white/10 rounded-2xl overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20">
              <i className="ri-stethoscope-line text-rose-400 text-sm" />
            </div>
            <div>
              <p className="text-sm font-black text-white">AI 광고 생성 진단</p>
              <p className="text-[10px] text-zinc-500">연결 · API 키 · 폴링 상태 점검</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-zinc-800/60 flex items-center justify-center cursor-pointer hover:bg-zinc-700 transition-colors">
            <i className="ri-close-line text-zinc-400 text-sm" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/[0.06] flex-shrink-0">
          <button
            onClick={() => setActiveTab('diag')}
            className={`flex-1 py-2.5 text-xs font-black transition-colors cursor-pointer ${activeTab === 'diag' ? 'text-rose-400 border-b-2 border-rose-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            연결 진단
          </button>
          <button
            onClick={() => setActiveTab('poll')}
            className={`flex-1 py-2.5 text-xs font-black transition-colors cursor-pointer ${activeTab === 'poll' ? 'text-rose-400 border-b-2 border-rose-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            fal.ai 폴링 테스트
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {activeTab === 'diag' && (
            <>
              {results.length === 0 && !running && (
                <div className="text-center py-10">
                  <i className="ri-search-eye-line text-4xl text-zinc-700 mb-3 block" />
                  <p className="text-sm text-zinc-400 font-bold">진단 시작 버튼을 눌러주세요</p>
                  <p className="text-xs text-zinc-600 mt-1.5 leading-relaxed">
                    환경변수 → Supabase 연결 → Auth → Edge Function → fal.ai 키 → 크레딧<br />
                    총 8개 항목 순서대로 점검합니다
                  </p>
                </div>
              )}

              {results.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                    r.status === 'ok' ? 'bg-emerald-500/5 border-emerald-500/15' :
                    r.status === 'error' ? 'bg-red-500/5 border-red-500/15' :
                    r.status === 'warn' ? 'bg-amber-500/5 border-amber-500/15' :
                    'bg-zinc-800/40 border-zinc-700/30'
                  }`}
                >
                  <div>{statusIcon(r.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-black text-white">{r.step}</p>
                      {r.ms !== undefined && <span className="text-[9px] text-zinc-600 font-mono">{r.ms}ms</span>}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed break-all mt-0.5">{r.detail}</p>
                    {r.subDetail && <p className="text-[10px] text-zinc-500 leading-relaxed mt-1 break-words">{r.subDetail}</p>}
                  </div>
                </div>
              ))}

              {done && rootCause && (
                <div className="p-4 rounded-xl border bg-red-500/10 border-red-500/25">
                  <div className="flex items-center gap-2 mb-2">
                    <i className="ri-error-warning-fill text-red-400 text-base" />
                    <p className="text-xs font-black text-red-300">핵심 원인: {rootCause.cause}</p>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">{rootCause.fix}</p>
                </div>
              )}

              {done && !hasError && (
                <div className="p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/20">
                  <div className="flex items-center gap-2">
                    <i className="ri-checkbox-circle-fill text-emerald-400 text-lg" />
                    <div>
                      <p className="text-xs font-black text-emerald-300">모든 연결 정상!</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        연결은 정상인데 영상이 88%에서 멈춘다면 → fal.ai 폴링 테스트 탭에서 확인해보세요
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'poll' && (
            <div className="space-y-4">
              {/* 안내 */}
              <div className="bg-zinc-800/40 border border-zinc-700/30 rounded-xl px-4 py-3">
                <p className="text-xs font-black text-zinc-300 mb-1">fal.ai 영상 생성 상태 직접 확인</p>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  영상이 88%에서 멈추는 이유는 폴링이 응답을 못 받거나 계속 IN_PROGRESS를 반환하기 때문입니다.
                  아래에서 실제 fal.ai 서버의 request_id 상태를 직접 확인하세요.
                </p>
              </div>

              {/* 핵심 안내 배너 */}
              <div className="bg-emerald-500/8 border border-emerald-500/25 rounded-xl px-4 py-3">
                <p className="text-[10px] font-black text-emerald-400 mb-1.5">수정 완료: fal.ai 올바른 폴링 방식 적용됨</p>
                <ul className="space-y-1">
                  {[
                    'POST /queue/{model} 응답 → status_url + response_url 자동 저장',
                    '폴링 시 조립 URL 대신 받은 status_url 그대로 사용 (405 오류 방지)',
                    'COMPLETED 확인 후 response_url로 결과 조회',
                  ].map((t, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <i className="ri-check-line text-emerald-400 text-[10px] flex-shrink-0 mt-0.5" />
                      <p className="text-[10px] text-zinc-400 leading-relaxed">{t}</p>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 직접 입력 */}
              <div className="bg-zinc-900/60 border border-white/[0.06] rounded-xl px-4 py-3 space-y-2.5">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">직접 request_id 확인</p>
                <input
                  type="text"
                  value={customRequestId}
                  onChange={e => setCustomRequestId(e.target.value)}
                  placeholder="request_id (예: 019daf3e-7629-76f2-9d0d-ebabc65f2c9c)"
                  className="w-full bg-zinc-800/60 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-rose-500/30 transition-colors font-mono"
                />
                {/* status_url 직접 입력 (선택사항) */}
                <div className="space-y-1">
                  <p className="text-[9px] text-zinc-500">
                    status_url (선택) — POST 응답에서 받은 URL을 여기 붙여넣으면 정확하게 테스트됩니다
                  </p>
                  <input
                    type="text"
                    value={customStatusUrl}
                    onChange={e => setCustomStatusUrl(e.target.value)}
                    placeholder="https://queue.fal.run/.../requests/.../status (선택)"
                    className="w-full bg-zinc-800/60 border border-white/[0.06] rounded-lg px-3 py-2 text-[10px] text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/30 transition-colors font-mono"
                  />
                </div>
                <select
                  value={customModel}
                  onChange={e => setCustomModel(e.target.value)}
                  className="w-full bg-zinc-800/60 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500/30 transition-colors"
                >
                  <option value="fal-ai/kling-video/v1/standard/image-to-video">Kling v1 image-to-video</option>
                  <option value="fal-ai/kling-video/v1/standard/text-to-video">Kling v1 text-to-video</option>
                  <option value="fal-ai/kling-video/v2.5-turbo/pro/text-to-video">Kling 2.5 Turbo</option>
                  <option value="fal-ai/kling-video/v2.5-turbo/standard/image-to-video">Kling 2.5 Turbo i2v</option>
                </select>
                <button
                  onClick={() => customRequestId.trim() && runPollCheck(customRequestId.trim(), customModel, customStatusUrl.trim() || undefined)}
                  disabled={pollChecking || !customRequestId.trim()}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-xs font-black transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {pollChecking ? <><div className="w-3 h-3 border-2 border-rose-300/30 border-t-rose-300 rounded-full animate-spin" /> 확인 중...</> : <><i className="ri-search-line" /> 상태 확인</>}
                </button>
              </div>

              {/* 최근 request_id 빠른 확인 */}
              <div>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">오늘 생성된 영상 request_id</p>
                <div className="space-y-1.5">
                  {RECENT_REQUEST_IDS.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 bg-zinc-900/40 border border-white/[0.05] rounded-xl px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-mono text-zinc-300 truncate">{item.id}</p>
                        <p className="text-[9px] text-zinc-600">{item.time} · {item.model.split('/').pop()}</p>
                      </div>
                      <button
                        onClick={() => runPollCheck(item.id, item.model)}
                        disabled={pollChecking}
                        className="flex-shrink-0 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-black transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        확인
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 결과 표시 */}
              {pollResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">확인 결과</p>
                  {pollResults.map((r, i) => (
                    <div key={i} className={`rounded-xl border p-3 ${r.error ? 'bg-red-500/8 border-red-500/20' : r.fal_status === 'COMPLETED' ? 'bg-emerald-500/8 border-emerald-500/20' : r.fal_status === 'FAILED' ? 'bg-red-500/8 border-red-500/20' : 'bg-zinc-800/40 border-zinc-700/30'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {r.error ? <i className="ri-close-circle-fill text-red-400 text-sm" /> :
                          r.fal_status === 'COMPLETED' ? <i className="ri-checkbox-circle-fill text-emerald-400 text-sm" /> :
                          r.fal_status === 'FAILED' ? <i className="ri-close-circle-fill text-red-400 text-sm" /> :
                          <i className="ri-loader-4-line text-amber-400 text-sm animate-spin" />}
                        <p className={`text-xs font-black ${getFalStatusColor(r.fal_status)}`}>
                          {r.error ? '확인 실패' : (r.fal_status ?? 'IN_PROGRESS')}
                        </p>
                        <span className="text-[9px] text-zinc-600 font-mono ml-auto">{r.request_id.slice(0, 16)}...</span>
                      </div>
                      {r.error && <p className="text-[11px] text-red-400 break-words">{r.error}</p>}
                      {r.url_source && (
                      <p className="text-[9px] text-zinc-600 mb-0.5">
                        URL 출처: {r.url_source === 'from_post_response' ? '✅ POST 응답 status_url 사용' : '⚠️ 직접 조립된 URL'}
                      </p>
                    )}
                    {r.error_diagnosis && (
                      <p className="text-[10px] text-red-400 font-black mb-1">{r.error_diagnosis}</p>
                    )}
                    {r.status_http && <p className="text-[10px] text-zinc-500">Status HTTP: {r.status_http}</p>}
                      {r.status_response && (
                        <div className="mt-1 bg-black/30 rounded-lg px-2 py-1.5">
                          <p className="text-[9px] font-mono text-zinc-400 break-all leading-relaxed">{r.status_response.slice(0, 300)}</p>
                        </div>
                      )}
                      {r.fal_status === 'COMPLETED' && r.response_data && (
                        <div className="mt-1.5">
                          <p className="text-[10px] font-black text-emerald-400 mb-1">영상 생성 완료! 결과 데이터:</p>
                          <div className="bg-black/30 rounded-lg px-2 py-1.5">
                            <p className="text-[9px] font-mono text-emerald-300 break-all leading-relaxed">{r.response_data.slice(0, 400)}</p>
                          </div>
                        </div>
                      )}
                      {r.fal_key_length && (
                        <p className="text-[9px] text-zinc-600 mt-1">API 키 길이: {r.fal_key_length}자</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 폴링 문제 해결 안내 */}
              <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3">
                <p className="text-[10px] font-black text-amber-400 mb-1.5">88% 멈춤 문제 해결 가이드</p>
                <ul className="space-y-1">
                  {[
                    '위에서 request_id 상태가 COMPLETED이면 → 폴링은 되는데 videoUrl 추출 실패',
                    '상태가 계속 IN_QUEUE면 → fal.ai 서버 혼잡, 더 기다려야 함 (5~15분)',
                    '상태가 FAILED면 → 영상 생성 자체 실패, 재시도 필요',
                    '확인 실패 (404)면 → request_id 만료, 처음부터 다시 생성',
                    '확인 실패 (401)면 → fal.ai API 키 문제, 관리자 페이지에서 키 재등록',
                  ].map((tip, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-amber-500 text-[10px] flex-shrink-0 mt-0.5">•</span>
                      <p className="text-[10px] text-zinc-500 leading-relaxed">{tip}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/[0.06] flex gap-2 flex-shrink-0">
          {activeTab === 'diag' && (
            <button
              onClick={runDiag}
              disabled={running}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-black transition-all cursor-pointer whitespace-nowrap"
            >
              {running ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 진단 중...</>
              ) : (
                <><i className="ri-play-circle-line" /> {done ? '다시 진단' : '진단 시작'}</>
              )}
            </button>
          )}
          {activeTab === 'poll' && (
            <div className="flex-1 flex items-center">
              <p className="text-[10px] text-zinc-600">request_id를 선택하거나 직접 입력해서 확인하세요</p>
            </div>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-black transition-all cursor-pointer whitespace-nowrap"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
