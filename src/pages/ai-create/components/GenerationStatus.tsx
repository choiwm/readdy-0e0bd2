import { useEffect, useRef, useState } from 'react';
import { logDev } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

interface Props {
  prompt: string;
  model: string;
  type: string;
  ratio?: string;
  userId?: string;
  sessionId?: string;
  creditCost?: number;
  onComplete: (url: string, ratio: string, type?: 'image' | 'video') => void;
  onCancel?: () => void;
  onCreditRefund?: (amount: number) => void;
}

function getRatioLabel(ratio: string): string {
  if (ratio.includes('9:16')) return '9:16';
  if (ratio.includes('1:1')) return '1:1';
  return '16:9';
}

function fmt(s: number) {
  return s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`;
}

export default function GenerationStatus({
  prompt,
  model,
  type,
  ratio = '16:9',
  userId,
  sessionId,
  creditCost = 0,
  onComplete,
  onCancel,
  onCreditRefund,
}: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [step, setStep] = useState(0);
  const [msg, setMsg] = useState('요청 전송 중...');
  const [err, setErr] = useState('');
  const [cancelled, setCancelled] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const onCompleteRef = useRef(onComplete);
  const onCancelRef = useRef(onCancel);
  const onCreditRefundRef = useRef(onCreditRefund);
  onCompleteRef.current = onComplete;
  onCancelRef.current = onCancel;
  onCreditRefundRef.current = onCreditRefund;

  const abortRef = useRef(false);
  const startedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isVideo = type === 'VIDEO';
  const ratioLabel = getRatioLabel(ratio);

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  useEffect(() => {
    if (startedRef.current) return undefined;
    startedRef.current = true;
    abortRef.current = false;

    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);

    async function run() {
      try {
        if (isVideo) {
          await runVideo();
        } else {
          await runImage();
        }
      } catch (e) {
        stopTimer();
        if (abortRef.current) return;
        const m = e instanceof Error ? e.message : String(e);
        console.error('[GenerationStatus] 오류:', m);
        if (creditCost > 0) onCreditRefundRef.current?.(creditCost);
        setErr(m);
      }
    }

    async function runImage() {
      setStep(1);
      setMsg('AI 서버에 요청 중...');

      const reqBody: Record<string, unknown> = {
        prompt,
        model,
        ratio,
        type: 'IMAGE',
      };
      if (userId) reqBody.user_id = userId;
      else if (sessionId) reqBody.session_id = sessionId;

      logDev('[GenerationStatus] generate-image 호출:', JSON.stringify(reqBody).slice(0, 200));

      const { data, error } = await supabase.functions.invoke('generate-image', { body: reqBody });

      if (abortRef.current) return;

      logDev('[GenerationStatus] 응답 error:', error?.message ?? 'none');
      logDev('[GenerationStatus] 응답 data:', JSON.stringify(data ?? {}).slice(0, 300));

      if (error) throw new Error(error.message ?? '이미지 생성 실패');
      if (!data) throw new Error('서버 응답이 없습니다.');
      if (data.error) throw new Error(String(data.error));

      const imageUrl = data.imageUrl as string | undefined;
      if (!imageUrl) {
        throw new Error(`이미지 URL을 받지 못했습니다. 응답: ${JSON.stringify(data).slice(0, 100)}`);
      }

      setStep(2);
      setMsg('완료!');
      stopTimer();

      logDev('[GenerationStatus] 이미지 완료:', imageUrl.slice(0, 80));
      await new Promise((r) => setTimeout(r, 300));
      if (!abortRef.current) {
        onCompleteRef.current(imageUrl, ratioLabel, 'image');
      }
    }

    async function runVideo() {
      setStep(1);
      setMsg('영상 생성 요청 중...');

      const reqBody: Record<string, unknown> = {
        prompt,
        ratio: ratioLabel,
        duration: 5,
        model: 'kling-v1',
      };
      if (userId) reqBody.user_id = userId;
      else if (sessionId) reqBody.session_id = sessionId;

      const { data, error } = await supabase.functions.invoke('generate-video', { body: reqBody });
      if (abortRef.current) return;
      if (error) throw new Error(error.message ?? '영상 생성 실패');
      if (!data || data.error) throw new Error(String(data?.error ?? '영상 생성 실패'));

      setStep(2);

      if (data.videoUrl) {
        setMsg('완료!');
        stopTimer();
        await new Promise((r) => setTimeout(r, 300));
        if (!abortRef.current) onCompleteRef.current(data.videoUrl as string, ratioLabel, 'video');
        return;
      }

      if (data.pending && data.request_id) {
        setMsg('Kling AI 렌더링 중... (최대 5분)');
        const MAX = 200;
        let errCount = 0;
        for (let i = 0; i < MAX; i++) {
          if (abortRef.current) return;
          await new Promise((r) => setTimeout(r, 6000));
          if (abortRef.current) return;
          const sec = (i + 1) * 6;
          setMsg(`영상 렌더링 중 (${Math.floor(sec / 60)}분 ${sec % 60}초)...`);
          try {
            const { data: pd, error: pe } = await supabase.functions.invoke('generate-video', {
              body: {
                _poll: true,
                request_id: data.request_id,
                model: data.model,
                status_url: data.status_url,
                response_url: data.response_url,
              },
            });
            if (pe) { errCount++; if (errCount >= 8) throw new Error(pe.message); continue; }
            errCount = 0;
            if (pd?.videoUrl) {
              setMsg('완료!');
              stopTimer();
              await new Promise((r) => setTimeout(r, 300));
              if (!abortRef.current) onCompleteRef.current(pd.videoUrl as string, ratioLabel, 'video');
              return;
            }
            if (pd?.status === 'FAILED') throw new Error(pd.error ?? '영상 생성 실패');
          } catch (e) {
            errCount++;
            if (errCount >= 8 && e instanceof Error) throw e;
          }
        }
        throw new Error('영상 생성 시간 초과 (20분)');
      }

      throw new Error(data?.error ?? '영상 생성 실패');
    }

    run();

    return () => {
      abortRef.current = true;
      stopTimer();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doCancel = () => {
    abortRef.current = true;
    stopTimer();
    setCancelled(true);
    setConfirmCancel(false);
    if (creditCost > 0) onCreditRefundRef.current?.(creditCost);
    setTimeout(() => onCancelRef.current?.(), 350);
  };

  const doRetry = () => {
    setErr('');
    setStep(0);
    setElapsed(0);
    setMsg('재시도 중...');
    abortRef.current = false;
    startedRef.current = false;

    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);

    const reqBody: Record<string, unknown> = { prompt, model, type: 'IMAGE', ratio };
    if (userId) reqBody.user_id = userId;
    else if (sessionId) reqBody.session_id = sessionId;

    setStep(1);
    setMsg('재시도: AI 서버 요청 중...');

    supabase.functions.invoke('generate-image', { body: reqBody }).then(({ data, error }) => {
      if (abortRef.current) return;
      if (error) { stopTimer(); setErr(error.message); return; }
      if (!data || data.error) { stopTimer(); setErr(String(data?.error ?? '응답 없음')); return; }
      const url = data.imageUrl as string | undefined;
      if (url) {
        setStep(2);
        setMsg('완료!');
        stopTimer();
        setTimeout(() => {
          if (!abortRef.current) onCompleteRef.current(url, getRatioLabel(ratio), 'image');
        }, 300);
      } else {
        stopTimer();
        setErr('이미지 URL을 받지 못했습니다');
      }
    });
  };

  const color = isVideo ? 'text-amber-400' : 'text-indigo-400';
  const bg = isVideo ? 'bg-amber-500' : 'bg-indigo-500';
  const stroke = isVideo ? '#f59e0b' : '#6366f1';
  const ICONS = isVideo
    ? ['ri-send-plane-line', 'ri-cpu-line', 'ri-film-line']
    : ['ri-send-plane-line', 'ri-cpu-line', 'ri-sparkling-2-line'];
  const STEPS = isVideo
    ? ['요청 전송', 'AI 처리 중', '영상 생성 중']
    : ['요청 전송', 'AI 처리 중', '이미지 생성 중'];

  const circ = 2 * Math.PI * 44;
  const progress = step === 0 ? 0.08 : step === 1 ? 0.45 : Math.min(0.6 + elapsed * 0.005, 0.95);

  if (cancelled) return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 px-8">
      <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
        <i className="ri-close-circle-line text-2xl text-zinc-400" />
      </div>
      <p className="text-white font-bold">생성 취소됨</p>
      {creditCost > 0 && <p className="text-zinc-500 text-sm">{creditCost} CR 환불됨</p>}
      <button
        onClick={() => onCancelRef.current?.()}
        className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-bold rounded-xl cursor-pointer whitespace-nowrap"
      >
        돌아가기
      </button>
    </div>
  );

  if (err) return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 px-8 max-w-md mx-auto w-full">
      <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
        <i className="ri-error-warning-line text-2xl text-red-400" />
      </div>
      <div className="text-center">
        <p className="text-white font-bold text-base mb-1">생성 실패</p>
        <p className="text-zinc-400 text-sm leading-relaxed max-w-xs break-words">{err}</p>
      </div>
      <div className="flex gap-2 w-full max-w-xs">
        <button
          onClick={() => onCancelRef.current?.()}
          className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-bold rounded-xl cursor-pointer whitespace-nowrap"
        >
          돌아가기
        </button>
        <button
          onClick={doRetry}
          className="flex-1 py-2.5 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-400 text-sm font-bold rounded-xl cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
        >
          <i className="ri-refresh-line" /> 다시 시도
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 px-6 relative">
      {confirmCancel && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-2xl">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 w-72 text-center">
            <p className="text-white font-bold text-sm mb-2">생성을 취소할까요?</p>
            {creditCost > 0 && (
              <p className="text-emerald-400 text-xs mb-4 font-bold">{creditCost} CR 환불됩니다</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmCancel(false)}
                className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl cursor-pointer whitespace-nowrap"
              >
                계속 생성
              </button>
              <button
                onClick={doCancel}
                className="flex-1 py-2 bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold rounded-xl cursor-pointer whitespace-nowrap"
              >
                취소하기
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#27272a" strokeWidth="6" />
          <circle
            cx="50" cy="50" r="44" fill="none" stroke={stroke} strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${circ}`}
            strokeDashoffset={`${circ * (1 - progress)}`}
            style={{ transition: 'stroke-dashoffset 0.7s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <i className={`${ICONS[Math.min(step, 2)]} ${color} text-xl animate-pulse`} />
        </div>
      </div>

      <div className="text-center space-y-2 max-w-sm w-full">
        <p className="text-white font-semibold text-base">{isVideo ? '영상' : '이미지'} 생성 중...</p>
        <p className="text-zinc-500 text-sm line-clamp-2">&ldquo;{prompt}&rdquo;</p>
        <p className={`text-xs font-medium ${color}`}>{msg}</p>
        <p className="text-zinc-600 text-xs">{model} · 경과 {fmt(elapsed)}</p>
      </div>

      <div className="flex items-center gap-3 w-full max-w-xs">
        {STEPS.map((label, idx) => {
          const done = idx < step;
          const active = idx === step;
          return (
            <div key={label} className="flex-1 flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                done
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : active
                    ? (isVideo ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-500/20 text-indigo-400')
                    : 'bg-zinc-800 text-zinc-600'
              }`}>
                {done
                  ? <i className="ri-check-line text-xs" />
                  : <i className={`${ICONS[idx]} text-xs`} />
                }
              </div>
              <span className={`text-[9px] font-bold text-center ${
                done ? 'text-emerald-400' : active ? 'text-white' : 'text-zinc-600'
              }`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="w-full max-w-xs">
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${bg} rounded-full`}
            style={{ width: `${progress * 100}%`, transition: 'width 0.7s ease' }}
          />
        </div>
      </div>

      <button
        onClick={() => setConfirmCancel(true)}
        className="text-xs text-zinc-600 hover:text-red-400 px-3 py-1.5 rounded-lg cursor-pointer border border-transparent hover:border-red-500/20 hover:bg-red-500/5 whitespace-nowrap"
      >
        <i className="ri-close-line mr-1" />생성 취소
      </button>
    </div>
  );
}
