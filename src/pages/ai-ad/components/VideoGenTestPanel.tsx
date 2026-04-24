import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';

interface LogEntry {
  time: string;
  level: 'info' | 'ok' | 'warn' | 'error';
  tag: string;
  msg: string;
}

function now() {
  return new Date().toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

async function callEdge(
  slug: string,
  body: Record<string, unknown>,
  timeoutMs = 60000
): Promise<{ data: Record<string, unknown> | null; error: string | null; httpStatus?: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await res.text();
    let data: Record<string, unknown> | null = null;
    try { data = JSON.parse(text); } catch { /* ignore */ }
    if (!res.ok) return { data, error: `HTTP ${res.status}: ${text.slice(0, 300)}`, httpStatus: res.status };
    return { data, error: null, httpStatus: res.status };
  } catch (e) {
    clearTimeout(timer);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes('abort') || msg.toLowerCase().includes('signal')) {
      return { data: null, error: `타임아웃 (${timeoutMs / 1000}초 초과)` };
    }
    return { data: null, error: msg };
  }
}

export default function VideoGenTestPanel({ onClose }: { onClose: () => void }) {
  const { profile, loading: authLoading } = useAuth();
  const profileRef = useRef(profile);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'key' | 'credits' | 'image' | 'video' | 'done'>('idle');
  const logRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);

  useEffect(() => { profileRef.current = profile; }, [profile]);

  const addLog = (level: LogEntry['level'], tag: string, msg: string) => {
    setLogs((prev) => {
      const next = [...prev, { time: now(), level, tag, msg }];
      setTimeout(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }), 50);
      return next;
    });
  };

  const SESSION_KEY = 'ai_ad_session_id';
  const getSessionId = () => {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) { id = `ad_sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`; localStorage.setItem(SESSION_KEY, id); }
    return id;
  };

  const stop = (msg?: string) => {
    if (msg) addLog('warn', 'SYS', msg);
    setRunning(false);
    setPhase('done');
  };

  const runTest = async () => {
    setRunning(true);
    setLogs([]);
    abortRef.current = false;
    setPhase('idle');

    if (authLoading) {
      await new Promise<void>((resolve) => {
        const start = Date.now();
        const check = setInterval(() => { if (!authLoading || Date.now() - start > 3000) { clearInterval(check); resolve(); } }, 100);
      });
    }

    const resolvedProfile = profileRef.current;
    const sessionId = getSessionId();
    const userId = resolvedProfile?.id ?? null;

    addLog('info', 'INIT', '=== AI 광고 영상 생성 파이프라인 테스트 시작 ===');
    addLog('info', 'INIT', `사용자: ${userId ? userId.slice(0, 8) + '...' : '비로그인 (세션 기반)'}`);
    addLog('info', 'INIT', `세션 ID: ${sessionId.slice(0, 20)}...`);

    // ══════════════════════════════════════════
    // 점검 1: API 키 상태 확인
    // ══════════════════════════════════════════
    setPhase('key');
    addLog('info', 'KEY', '─── 점검 1: fal.ai API 키 확인 ───');
    try {
      const { data: keyData, error: keyErr } = await callEdge('test-fal-key', {}, 35000);
      if (keyErr) {
        addLog('warn', 'KEY', `키 확인 실패: ${keyErr} → 생성 계속 시도`);
      } else {
        const dbKey = keyData?.db_key as Record<string, unknown> | null;
        const decrypt = keyData?.decrypt_result as Record<string, unknown> | null;
        const falTest = keyData?.fal_api_test as Record<string, unknown> | null;

        if (!dbKey?.found) { stop('fal API 키가 DB에 없음! 관리자 페이지에서 등록 필요'); return; }
        if (!decrypt?.success) { stop(`키 복호화 실패: ${decrypt?.error ?? '알 수 없음'}`); return; }
        if (falTest?.status === 401 || falTest?.status === 403) { stop(`fal.ai 인증 실패 (HTTP ${falTest.status}) — 키 재등록 필요`); return; }

        const falStatus = falTest?.auth_success ? '✓ 인증 성공' : `HTTP ${falTest?.status ?? '?'}`;
        addLog('ok', 'KEY', `키 정상 — 방식: ${decrypt?.method}, 미리보기: ${decrypt?.key_preview}, fal.ai: ${falStatus}`);
      }
    } catch (e) {
      addLog('warn', 'KEY', `키 확인 예외: ${e instanceof Error ? e.message : String(e)} → 계속 진행`);
    }

    if (abortRef.current) { stop('사용자 중단'); return; }

    // ══════════════════════════════════════════
    // 점검 2: 크레딧 상태 확인 (자동 보충 포함)
    // ══════════════════════════════════════════
    setPhase('credits');
    addLog('info', 'CR', '─── 점검 2: 크레딧 상태 확인 ───');
    addLog('info', 'CR', `이미지(schnell): 5 CR + 영상(kling-v1): 50 CR = 총 55 CR 필요`);

    // 크레딧 직접 확인 — _check_credits_only 모드 (자동 보충 트리거)
    try {
      const { data: crData, error: crErr } = await callEdge('generate-image', {
        _check_credits_only: true,
        session_id: sessionId,
        user_id: userId,
      }, 15000);

      if (crErr) {
        addLog('warn', 'CR', `크레딧 확인 실패: ${crErr} → 계속 진행`);
      } else if (crData?.credits !== undefined) {
        const cr = crData.credits as number;
        const isVip = crData.is_vip as boolean;
        if (isVip) {
          addLog('ok', 'CR', `VIP 플랜 — 크레딧 무제한`);
        } else if (cr < 55) {
          // 자동 보충 알림
          addLog('warn', 'CR', `잔액 부족 (${cr} CR) — 서버에서 자동 보충 중...`);
          addLog('info', 'CR', `재확인 중...`);
          // 1초 후 재확인 (보충 완료 대기)
          await new Promise((r) => setTimeout(r, 1500));
          const { data: cr2Data } = await callEdge('generate-image', {
            _check_credits_only: true,
            session_id: sessionId,
            user_id: userId,
          }, 10000);
          const cr2 = (cr2Data?.credits as number) ?? cr;
          if (cr2 >= 55) {
            addLog('ok', 'CR', `자동 보충 완료! 현재 잔액: ${cr2} CR (충분)`);
          } else {
            addLog('warn', 'CR', `보충 후 잔액: ${cr2} CR — 계속 진행`);
          }
        } else {
          addLog('ok', 'CR', `크레딧 충분: ${cr} CR 보유 (필요 55 CR)`);
        }
      } else {
        addLog('info', 'CR', `크레딧 응답: ${JSON.stringify(crData).slice(0, 100)}`);
      }
    } catch (e) {
      addLog('warn', 'CR', `크레딧 확인 예외: ${e instanceof Error ? e.message : String(e)} → 계속 진행`);
    }

    if (abortRef.current) { stop('사용자 중단'); return; }

    // ══════════════════════════════════════════
    // 점검 3: 이미지 생성 (schnell — 5CR, 빠름)
    // ══════════════════════════════════════════
    setPhase('image');
    addLog('info', 'IMG', '─── 점검 3: 이미지 생성 (Nano Banana 2 / schnell, 5CR) ───');
    addLog('info', 'IMG', '프롬프트: "luxury product advertisement, cinematic lighting, dark background"');

    const imgStart = Date.now();
    let imageUrl: string | null = null;

    const { data: imgData, error: imgErr, httpStatus: imgStatus } = await callEdge('generate-image', {
      prompt: 'luxury product advertisement, cinematic lighting, dark background, high quality',
      model: 'Nano Banana 2',
      ratio: '16:9',
      aspectRatio: '16:9',
      user_id: userId,
      session_id: sessionId,
    }, 55000);

    const imgElapsed = ((Date.now() - imgStart) / 1000).toFixed(1);

    if (imgErr) {
      addLog('error', 'IMG', `Edge Function 오류 (${imgElapsed}s, HTTP ${imgStatus ?? '?'}): ${imgErr}`);
      stop('이미지 생성 실패 — 영상 테스트 중단');
      return;
    }

    addLog('info', 'IMG', `응답 수신 (${imgElapsed}s): ${JSON.stringify(imgData).slice(0, 150)}`);

    if (imgData?.error) {
      addLog('error', 'IMG', `서버 오류: ${imgData.error}`);
      if (imgData.insufficient_credits) addLog('warn', 'IMG', `크레딧 부족 — 필요: ${imgData.required} CR, 보유: ${imgData.available} CR`);
      stop('이미지 생성 실패');
      return;
    }

    if (imgData?.imageUrl) {
      imageUrl = imgData.imageUrl as string;
      addLog('ok', 'IMG', `이미지 즉시 완료 (${imgElapsed}s)! URL: ${imageUrl.slice(0, 70)}...`);
      addLog('info', 'IMG', `크레딧 사용: ${imgData.credits_used ?? '?'} CR`);
    } else if (imgData?.pending && imgData?.request_id) {
      addLog('warn', 'IMG', `pending (${imgElapsed}s) — request_id: ${imgData.request_id}`);
      addLog('info', 'IMG', '폴링 시작 (최대 3분)...');

      let pollCount = 0;
      while (pollCount < 36) {
        if (abortRef.current) { stop('사용자 중단'); return; }
        await new Promise((r) => setTimeout(r, 5000));
        pollCount++;

        const { data: pd } = await callEdge('generate-image', {
          _poll: true, request_id: imgData.request_id, model: imgData.model, session_id: sessionId,
        }, 12000);

        addLog('info', 'IMG', `폴링 ${pollCount}/36 (${pollCount * 5}s): status=${pd?.status ?? 'IN_PROGRESS'}`);
        if (pd?.imageUrl) { imageUrl = pd.imageUrl as string; addLog('ok', 'IMG', `이미지 완료! URL: ${imageUrl.slice(0, 70)}...`); break; }
        if (pd?.status === 'FAILED') { stop(`이미지 생성 실패: ${pd.error ?? '알 수 없음'}`); return; }
      }
      if (!imageUrl) { stop('이미지 폴링 타임아웃 (3분 초과)'); return; }
    } else {
      addLog('error', 'IMG', `예상치 못한 응답: ${JSON.stringify(imgData).slice(0, 250)}`);
      stop('이미지 생성 실패');
      return;
    }

    if (abortRef.current) { stop('사용자 중단'); return; }

    // ══════════════════════════════════════════
    // 점검 4: 영상 생성 (kling-v1 — 50CR)
    // ══════════════════════════════════════════
    setPhase('video');
    addLog('info', 'VID', '─── 점검 4: 영상 생성 (Kling v1 image-to-video, 50CR) ───');
    addLog('info', 'VID', `입력 이미지: ${imageUrl.slice(0, 70)}...`);

    const vidStart = Date.now();

    const { data: vidData, error: vidErr, httpStatus: vidStatus } = await callEdge('generate-video', {
      prompt: 'luxury product advertisement, cinematic camera movement, smooth motion, professional video',
      ratio: '16:9',
      duration: 5,
      model: 'kling-v1',
      mode: 'std',
      user_id: userId,
      session_id: sessionId,
      image_url: imageUrl,
    }, 125000);

    const vidElapsed = ((Date.now() - vidStart) / 1000).toFixed(1);

    if (vidErr) {
      addLog('error', 'VID', `Edge Function 오류 (${vidElapsed}s, HTTP ${vidStatus ?? '?'}): ${vidErr}`);
      stop('영상 생성 실패');
      return;
    }

    addLog('info', 'VID', `응답 수신 (${vidElapsed}s): ${JSON.stringify(vidData).slice(0, 150)}`);

    if (vidData?.error) {
      addLog('error', 'VID', `서버 오류: ${vidData.error}`);
      if (vidData.insufficient_credits) {
        addLog('warn', 'VID', `크레딧 부족 — 필요: ${vidData.required} CR, 보유: ${vidData.available} CR`);
        addLog('info', 'VID', '크레딧이 자동으로 보충되었어야 하는데 영상 요청 시점에 부족했어요. 테스트를 다시 실행해주세요.');
      }
      stop('영상 생성 실패');
      return;
    }

    if (vidData?.videoUrl) {
      const totalSec = ((Date.now() - imgStart) / 1000).toFixed(0);
      addLog('ok', 'VID', `영상 즉시 완료 (${vidElapsed}s)! URL: ${(vidData.videoUrl as string).slice(0, 70)}...`);
      addLog('ok', 'DONE', `=== 전체 파이프라인 성공! 총 소요: ${totalSec}초 ===`);
      stop();
      return;
    }

    if (vidData?.pending && vidData?.request_id) {
      const requestId = vidData.request_id as string;
      const vidModel = vidData.model as string;
      // [핵심] status_url / response_url 저장 — 405 우회용
      const vidStatusUrl = (vidData.status_url as string) ?? undefined;
      const vidResponseUrl = (vidData.response_url as string) ?? undefined;
      addLog('ok', 'VID', `queue 제출 성공! request_id: ${requestId.slice(0, 30)}...`);
      if (vidStatusUrl) addLog('info', 'VID', `status_url 받음: ${vidStatusUrl.slice(0, 60)}...`);
      addLog('info', 'VID', `크레딧 차감: ${vidData.credits_used ?? 50} CR`);
      addLog('info', 'VID', '폴링 시작 (최대 15분, 10초 간격)...');
      addLog('warn', 'VID', '영상 생성은 2~10분 소요됩니다. 잠시 기다려주세요.');

      let pollCount = 0;
      const maxPolls = 90; // 15분 (10초 * 90)
      while (pollCount < maxPolls) {
        if (abortRef.current) { stop('사용자 중단'); return; }
        await new Promise((r) => setTimeout(r, 10000));
        pollCount++;

        const elapsedSec = pollCount * 10;
        const elapsedMin = Math.floor(elapsedSec / 60);
        const elapsedRemSec = elapsedSec % 60;
        const elapsedStr = elapsedMin > 0 ? `${elapsedMin}분 ${elapsedRemSec}초` : `${elapsedSec}초`;

        // [핵심] status_url / response_url 함께 전달 — 폴백 폴링 활성화
        const { data: pd, error: pollErr } = await callEdge('generate-video', {
          _poll: true,
          request_id: requestId,
          model: vidModel,
          ...(vidStatusUrl ? { status_url: vidStatusUrl } : {}),
          ...(vidResponseUrl ? { response_url: vidResponseUrl } : {}),
        }, 20000);

        if (pollErr) {
          addLog('warn', 'VID', `폴링 ${pollCount}/${maxPolls} (${elapsedStr}): 네트워크 오류 — 재시도 (${pollErr.slice(0, 80)})`);
          continue;
        }

        const status = (pd?.status as string) ?? 'IN_PROGRESS';
        const queuePos = pd?.queue_position !== undefined ? ` (대기열: ${pd.queue_position}번째)` : '';
        const httpErr = pd?.http_error ? ` [HTTP ${pd.http_error}]` : '';
        addLog('info', 'VID', `폴링 ${pollCount}/${maxPolls} (${elapsedStr}): ${status}${queuePos}${httpErr}`);

        // 디버그 정보 표시
        if (pd?.debug) {
          addLog('warn', 'VID', `디버그: ${pd.debug}`);
        }

        if (pd?.videoUrl) {
          const totalSec = ((Date.now() - imgStart) / 1000).toFixed(0);
          addLog('ok', 'VID', `영상 완료! URL: ${(pd.videoUrl as string).slice(0, 70)}...`);
          if (pd?.raw_response) addLog('info', 'VID', `응답 구조: ${pd.raw_response}`);
          addLog('ok', 'DONE', `=== 전체 파이프라인 성공! 총 소요: ${totalSec}초 ===`);
          stop();
          return;
        }
        if (pd?.status === 'FAILED') {
          stop(`영상 생성 실패: ${(pd.error as string) ?? '알 수 없음'}`);
          return;
        }
        if (pd?.status === 'COMPLETED_NO_URL') {
          // videoUrl 추출 실패 — 전체 응답 로그
          addLog('error', 'VID', `COMPLETED 상태인데 videoUrl 추출 실패!`);
          addLog('warn', 'VID', `fal.ai 응답 구조: ${pd.raw_response ?? '없음'}`);
          stop('영상 URL 추출 실패 — 관리자에게 문의하세요');
          return;
        }
        if (pd?.status === 'COMPLETED' && !pd?.videoUrl) {
          addLog('warn', 'VID', `COMPLETED 상태인데 videoUrl 없음 — 응답: ${JSON.stringify(pd).slice(0, 150)}`);
        }
      }
      stop('영상 폴링 타임아웃 (15분 초과)');
    } else {
      addLog('error', 'VID', `예상치 못한 응답: ${JSON.stringify(vidData).slice(0, 250)}`);
      stop('영상 생성 실패');
    }
  };

  const levelColor = (l: LogEntry['level']) => {
    if (l === 'ok') return 'text-emerald-400';
    if (l === 'error') return 'text-red-400';
    if (l === 'warn') return 'text-amber-400';
    return 'text-zinc-400';
  };

  const tagColor = (tag: string) => {
    if (tag === 'IMG') return 'text-sky-400 bg-sky-500/10';
    if (tag === 'VID') return 'text-rose-400 bg-rose-500/10';
    if (tag === 'KEY') return 'text-amber-400 bg-amber-500/10';
    if (tag === 'CR') return 'text-violet-400 bg-violet-500/10';
    if (tag === 'DONE') return 'text-emerald-400 bg-emerald-500/10';
    if (tag === 'SYS') return 'text-zinc-400 bg-zinc-700/40';
    return 'text-zinc-500 bg-zinc-800/60';
  };

  const phaseLabel = () => {
    if (phase === 'key') return '점검 1: API 키 확인 중';
    if (phase === 'credits') return '점검 2: 크레딧 확인 중';
    if (phase === 'image') return '점검 3: 이미지 생성 중';
    if (phase === 'video') return '점검 4: 영상 생성 중';
    return '초기화 중';
  };

  const hasError = logs.some((l) => l.level === 'error');
  const isSuccess = phase === 'done' && !hasError && logs.some((l) => l.tag === 'DONE');

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-[#0d0d0f] border border-white/10 rounded-2xl overflow-hidden flex flex-col" style={{ maxHeight: '88vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20">
              <i className="ri-terminal-box-line text-rose-400 text-sm" />
            </div>
            <div>
              <p className="text-sm font-black text-white">영상 생성 파이프라인 테스트</p>
              <p className="text-[10px] text-zinc-500">API 키 → 크레딧 → 이미지 → 영상 4단계 점검</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {running && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800/60 border border-white/[0.06]">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                <span className="text-[10px] text-zinc-400 font-black">{phaseLabel()}</span>
              </div>
            )}
            {phase === 'done' && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${isSuccess ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                <i className={`text-xs ${isSuccess ? 'ri-checkbox-circle-fill text-emerald-400' : 'ri-close-circle-fill text-red-400'}`} />
                <span className={`text-[10px] font-black ${isSuccess ? 'text-emerald-400' : 'text-red-400'}`}>{isSuccess ? '성공' : '실패'}</span>
              </div>
            )}
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-zinc-800/60 flex items-center justify-center cursor-pointer hover:bg-zinc-700 transition-colors">
              <i className="ri-close-line text-zinc-400 text-sm" />
            </button>
          </div>
        </div>

        {/* 안내 배너 */}
        <div className="px-5 py-3 bg-amber-500/5 border-b border-amber-500/10 flex-shrink-0">
          <div className="flex items-start gap-2">
            <i className="ri-information-line text-amber-400 text-sm flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              실제 크레딧 소모 (이미지 5 CR + 영상 50 CR = 약 55 CR). 이미지는 schnell(빠른 모델) 사용.
              영상 생성은 <strong className="text-zinc-300">2~10분</strong> 소요될 수 있어요.
            </p>
          </div>
        </div>

        {/* 로그 뷰어 */}
        <div ref={logRef} className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[11px] space-y-0.5 bg-[#080809]" style={{ minHeight: '300px' }}>
          {logs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center">
              <i className="ri-terminal-line text-3xl text-zinc-700 mb-2" />
              <p className="text-zinc-600 text-xs">테스트 시작 버튼을 누르면 4단계 점검이 시작됩니다</p>
              <p className="text-zinc-700 text-[10px] mt-1">API 키 → 크레딧 → 이미지 생성 → 영상 생성</p>
            </div>
          )}
          {logs.map((l, i) => (
            <div key={i} className="flex items-start gap-2 py-0.5">
              <span className="text-zinc-700 flex-shrink-0 select-none">{l.time}</span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black flex-shrink-0 ${tagColor(l.tag)}`}>{l.tag}</span>
              <span className={`flex-1 break-all leading-relaxed ${levelColor(l.level)}`}>
                {l.level === 'ok' && <i className="ri-checkbox-circle-fill mr-1" />}
                {l.level === 'error' && <i className="ri-close-circle-fill mr-1" />}
                {l.level === 'warn' && <i className="ri-alert-fill mr-1" />}
                {l.msg}
              </span>
            </div>
          ))}
          {running && (
            <div className="flex items-center gap-2 py-1 text-zinc-600">
              <div className="w-3 h-3 border border-zinc-700 border-t-rose-400 rounded-full animate-spin flex-shrink-0" />
              <span>대기 중...</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/[0.06] flex gap-2 flex-shrink-0">
          <button
            onClick={runTest}
            disabled={running}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-black transition-all cursor-pointer whitespace-nowrap"
          >
            {running
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 테스트 실행 중...</>
              : <><i className="ri-play-circle-line" /> {phase === 'done' ? '다시 테스트' : '4단계 파이프라인 테스트'}</>
            }
          </button>
          {running && (
            <button
              onClick={() => { abortRef.current = true; }}
              className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-black transition-all cursor-pointer whitespace-nowrap"
            >
              <i className="ri-stop-circle-line mr-1" /> 중단
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-black transition-all cursor-pointer whitespace-nowrap">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
