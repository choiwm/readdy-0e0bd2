import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireUser, AuthFailure } from '../_shared/auth.ts';
import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';
import { checkRateLimit, rateLimitedResponse, POLICIES } from '../_shared/rateLimit.ts';

const FAL_WHISPER_MODEL = "fal-ai/whisper";
const VIP_PLANS = ['enterprise', 'vip', 'admin'];
const FALLBACK_TRANSCRIBE_COST = 3;

async function getFalKey(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  try {
    const { data } = await supabase.from('api_keys').select('encrypted_key, status').eq('service_slug', 'fal').eq('status', 'active').maybeSingle();
    if (!data?.encrypted_key) return null;
    const enc = data.encrypted_key as string;
    if (enc.startsWith('enc_v1:')) { try { return atob(enc.split(':')[2]); } catch { return null; } }
    return enc;
  } catch { return null; }
}

async function getGoApiKey(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  try {
    const { data } = await supabase.from('api_keys').select('encrypted_key, status').eq('service_slug', 'goapi').eq('status', 'active').maybeSingle();
    if (!data?.encrypted_key) return null;
    const enc = data.encrypted_key as string;
    if (enc.startsWith('enc_v1:')) { try { return atob(enc.split(':')[2]); } catch { return null; } }
    return enc;
  } catch { return null; }
}

async function getCreditCostFromDB(
  supabase: ReturnType<typeof createClient>,
  category: string,
  modelId: string
): Promise<number | null> {
  try {
    const { data } = await supabase
      .from('credit_costs')
      .select('cost')
      .eq('category', category)
      .eq('model_id', modelId)
      .eq('is_active', true)
      .maybeSingle();
    return data?.cost ?? null;
  } catch { return null; }
}

async function getUserInfo(supabase: ReturnType<typeof createClient>, userId?: string, sessionId?: string) {
  try {
    if (userId) {
      const { data: profile } = await supabase.from('user_profiles').select('plan').eq('id', userId).maybeSingle();
      const plan = (profile?.plan ?? 'free').toLowerCase();
      const isVip = VIP_PLANS.includes(plan);
      if (!isVip) {
        const { data: credit } = await supabase.from('credits').select('balance').eq('user_id', userId).maybeSingle();
        return { plan, credits: credit?.balance ?? 0, isVip: false };
      }
      return { plan, credits: 999999, isVip: true };
    }
    if (sessionId) {
      const { data } = await supabase.from('credits').select('balance').eq('session_id', sessionId).maybeSingle();
      return { plan: 'free', credits: data?.balance ?? 0, isVip: false };
    }
  } catch { /* 폴백 */ }
  return { plan: 'free', credits: 0, isVip: false };
}

async function deductCredits(supabase: ReturnType<typeof createClient>, amount: number, userId?: string, sessionId?: string): Promise<boolean> {
  try {
    if (userId) {
      const { data } = await supabase.from('credits').select('id, balance').eq('user_id', userId).maybeSingle();
      if (!data || data.balance < amount) return false;
      await supabase.from('credits').update({ balance: data.balance - amount, updated_at: new Date().toISOString() }).eq('user_id', userId);
      return true;
    }
    if (sessionId) {
      const { data } = await supabase.from('credits').select('id, balance').eq('session_id', sessionId).maybeSingle();
      if (!data || data.balance < amount) return false;
      await supabase.from('credits').update({ balance: data.balance - amount, updated_at: new Date().toISOString() }).eq('session_id', sessionId);
      return true;
    }
  } catch { /* 폴백 */ }
  return false;
}

async function logUsage(supabase: ReturnType<typeof createClient>, opts: {
  userId?: string; sessionId?: string; serviceSlug: string; action: string;
  creditsDeducted: number; userPlan: string; status: 'success' | 'failed' | 'insufficient_credits';
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabase.from('usage_logs').insert({
      user_id: opts.userId ?? null, session_id: opts.sessionId ?? null,
      service_slug: opts.serviceSlug, action: opts.action,
      credits_deducted: opts.creditsDeducted, user_plan: opts.userPlan,
      status: opts.status, metadata: opts.metadata ?? {},
    });
  } catch { /* 무시 */ }
}

// 생성 완료 인앱 알림 저장 (로그인 사용자만)
async function sendGenerationNotification(opts: {
  userId: string;
  generationType: string;
  modelName: string;
  creditsUsed: number;
  actionUrl: string;
  supabaseUrl: string;
  anonKey: string;
}) {
  try {
    await fetch(
      `${opts.supabaseUrl}/functions/v1/credit-alert-notify?action=generation_complete`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${opts.anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: opts.userId,
          generation_type: opts.generationType,
          model_name: opts.modelName,
          credits_used: opts.creditsUsed,
          action_url: opts.actionUrl,
        }),
      }
    );
  } catch {
    // 알림 실패는 무시 (생성 결과에 영향 없음)
  }
}

function buildTranscriptResponse(data: Record<string, unknown>, withTimestamp: boolean, withSpeaker: boolean) {
  const segments = (data?.segments as Array<{ start?: number; end?: number; text?: string; speaker?: string }>) ?? [];
  const fullText = (data?.text as string) ?? "";
  const detectedLanguage = (data?.language as string) ?? "unknown";
  const duration = (data?.duration as number) ?? 0;

  const lines = segments.length > 0
    ? segments.map((seg, idx) => {
        const startSec = seg.start ?? 0;
        const h = Math.floor(startSec / 3600).toString().padStart(2, "0");
        const m = Math.floor((startSec % 3600) / 60).toString().padStart(2, "0");
        const s = Math.floor(startSec % 60).toString().padStart(2, "0");
        const speakers = ["A", "B", "C", "D"];
        const speaker = seg.speaker ?? speakers[idx % speakers.length];
        return { time: `${h}:${m}:${s}`, startSec: seg.start ?? 0, endSec: seg.end ?? 0, speaker, text: (seg.text ?? "").trim() };
      })
    : fullText.split(/[.!?。！？\n]+/).filter((t) => t.trim().length > 0).map((t, idx) => ({
        time: `00:${String(Math.floor(idx * 5 / 60)).padStart(2, "0")}:${String((idx * 5) % 60).padStart(2, "0")}`,
        startSec: idx * 5, endSec: (idx + 1) * 5,
        speaker: ["A", "B", "C"][idx % 3], text: t.trim(),
      }));

  return {
    success: true, fullText, lines, detectedLanguage,
    duration: Math.round(duration),
    wordCount: fullText.split(/\s+/).filter(Boolean).length,
    segmentCount: lines.length,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handlePreflight(req);

  const corsHeaders = buildCorsHeaders(req);
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  const err = (msg: string, status = 400) => json({ error: msg }, status);
  let authedUserId: string;
  try {
    const authed = await requireUser(req);
    authedUserId = authed.id;
  } catch (e) {
    if (e instanceof AuthFailure) return e.response;
    throw e;
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const _rl = await checkRateLimit(supabase, {
    bucket: `generate-transcribe:${authedUserId}`,
    ...POLICIES.generateTranscribe,
  });
  if (!_rl.ok) return rateLimitedResponse(_rl.resetAt, buildCorsHeaders(req));
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const language = (formData.get("language") as string) || "auto";
    const withTimestamp = formData.get("with_timestamp") === "true";
    const withSpeaker = formData.get("with_speaker") === "true";
    const userId = formData.get("user_id") as string | null;
    const sessionId = formData.get("session_id") as string | null;

    if (!audioFile) {
      return new Response(JSON.stringify({ error: "audio 파일이 필요합니다." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (audioFile.size > 25 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "파일 크기가 25MB를 초과합니다." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const dbCost = await getCreditCostFromDB(supabase, 'transcribe', FAL_WHISPER_MODEL);
    const TRANSCRIBE_CREDIT_COST = dbCost ?? FALLBACK_TRANSCRIBE_COST;

    console.log(`[generate-transcribe] creditCost=${TRANSCRIBE_CREDIT_COST} (DB 동적)`);

    const { plan, credits, isVip } = await getUserInfo(supabase, userId ?? undefined, sessionId ?? undefined);

    if (!isVip) {
      if (credits < TRANSCRIBE_CREDIT_COST) {
        await logUsage(supabase, { userId: userId ?? undefined, sessionId: sessionId ?? undefined, serviceSlug: 'fal', action: '음성 전사', creditsDeducted: 0, userPlan: plan, status: 'insufficient_credits', metadata: { required: TRANSCRIBE_CREDIT_COST, available: credits } });
        return new Response(JSON.stringify({ error: `크레딧이 부족합니다. 필요: ${TRANSCRIBE_CREDIT_COST} CR, 보유: ${credits} CR`, insufficient_credits: true, required: TRANSCRIBE_CREDIT_COST, available: credits }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await deductCredits(supabase, TRANSCRIBE_CREDIT_COST, userId ?? undefined, sessionId ?? undefined);
    }

    let FAL_KEY = await getFalKey(supabase);
    if (!FAL_KEY) FAL_KEY = Deno.env.get("FAL_KEY") ?? null;

    if (FAL_KEY) {
      console.log(`[generate-transcribe] fal.ai Whisper, file=${audioFile.name}, size=${audioFile.size}`);

      try {
        const uploadForm = new FormData();
        uploadForm.append("file", audioFile, audioFile.name);

        const uploadRes = await fetch("https://fal.run/fal-ai/storage/upload", {
          method: "POST",
          headers: { "Authorization": `Key ${FAL_KEY}` },
          body: uploadForm,
        });

        let audioUrl: string | null = null;

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          audioUrl = uploadData?.url ?? uploadData?.file_url ?? null;
        }

        if (audioUrl) {
          const falRes = await fetch(`https://fal.run/${FAL_WHISPER_MODEL}`, {
            method: "POST",
            headers: {
              "Authorization": `Key ${FAL_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              audio_url: audioUrl,
              task: "transcribe",
              language: language === "auto" ? null : language,
              chunk_level: "segment",
              version: "3",
            }),
          });

          if (falRes.ok) {
            const falData = await falRes.json();
            console.log("fal.ai Whisper 응답:", JSON.stringify(falData).slice(0, 300));

            const text = falData?.text ?? falData?.transcription ?? "";
            const chunks = falData?.chunks ?? falData?.segments ?? [];
            const segments = chunks.map((c: Record<string, unknown>) => ({
              start: (c?.timestamp as number[])?.[0] ?? c?.start ?? 0,
              end: (c?.timestamp as number[])?.[1] ?? c?.end ?? 0,
              text: String(c?.text ?? ""),
            }));

            await logUsage(supabase, { userId: userId ?? undefined, sessionId: sessionId ?? undefined, serviceSlug: 'fal', action: '음성 전사', creditsDeducted: isVip ? 0 : TRANSCRIBE_CREDIT_COST, userPlan: plan, status: 'success', metadata: { credit_cost_source: 'db' } });
            // 로그인 사용자에게 생성 완료 알림 저장
            if (userId) {
              await sendGenerationNotification({
                userId,
                generationType: 'transcribe',
                modelName: 'Whisper',
                creditsUsed: isVip ? 0 : TRANSCRIBE_CREDIT_COST,
                actionUrl: '/ai-sound',
                supabaseUrl: SUPABASE_URL,
                anonKey: ANON_KEY,
              });
            }
            return new Response(
              JSON.stringify(buildTranscriptResponse({ text, segments, language: falData?.language ?? language, duration: falData?.duration ?? 0 }, withTimestamp, withSpeaker)),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          } else {
            console.warn("fal.ai Whisper 실패:", falRes.status);
          }
        }
      } catch (e) {
        console.warn("fal.ai Whisper 오류, GoAPI 폴백:", e);
      }
    }

    // GoAPI Whisper 폴백
    const GOAPI_KEY = await getGoApiKey(supabase) ?? Deno.env.get("GOAPI_KEY") ?? null;
    if (!GOAPI_KEY) {
      if (!isVip) await deductCredits(supabase, -TRANSCRIBE_CREDIT_COST, userId ?? undefined, sessionId ?? undefined);
      return new Response(JSON.stringify({ error: "API 키가 설정되지 않았습니다. 관리자 페이지에서 fal.ai API 키를 등록해주세요." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("GoAPI Whisper 폴백 시도:", audioFile.name);

    const whisperForm = new FormData();
    whisperForm.append("file", audioFile, audioFile.name);
    whisperForm.append("model", "whisper-1");
    whisperForm.append("response_format", "verbose_json");
    whisperForm.append("timestamp_granularities[]", "segment");
    if (language !== "auto") whisperForm.append("language", language);

    let whisperRes = await fetch("https://api.goapi.ai/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${GOAPI_KEY}`, "x-api-key": GOAPI_KEY },
      body: whisperForm,
    });

    if (!whisperRes.ok) {
      const whisperForm2 = new FormData();
      whisperForm2.append("file", audioFile, audioFile.name);
      whisperForm2.append("model", "whisper-1");
      whisperForm2.append("response_format", "verbose_json");
      if (language !== "auto") whisperForm2.append("language", language);
      whisperRes = await fetch("https://api.goapi.ai/api/v1/whisper/transcriptions", {
        method: "POST",
        headers: { "x-api-key": GOAPI_KEY },
        body: whisperForm2,
      });
    }

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      if (!isVip) await deductCredits(supabase, -TRANSCRIBE_CREDIT_COST, userId ?? undefined, sessionId ?? undefined);
      return new Response(JSON.stringify({ error: `전사 요청 실패 (${whisperRes.status})`, detail: errText }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await whisperRes.json();
    const taskId = data?.task_id ?? data?.data?.task_id;

    if (taskId) {
      for (let attempt = 0; attempt < 60; attempt++) {
        await new Promise((r) => setTimeout(r, 3000));
        const pollRes = await fetch(`https://api.goapi.ai/api/v1/task/${taskId}`, { headers: { "x-api-key": GOAPI_KEY } });
        if (!pollRes.ok) continue;
        const pollData = await pollRes.json();
        const status = pollData?.status ?? pollData?.data?.status;
        if (status === "completed" || status === "succeeded") {
          const result = pollData?.data?.output ?? pollData?.output ?? pollData?.data;
          await logUsage(supabase, { userId: userId ?? undefined, sessionId: sessionId ?? undefined, serviceSlug: 'fal', action: '음성 전사 (GoAPI 폴백)', creditsDeducted: isVip ? 0 : TRANSCRIBE_CREDIT_COST, userPlan: plan, status: 'success', metadata: { credit_cost_source: 'db' } });
          // 로그인 사용자에게 생성 완료 알림 저장
          if (userId) {
            await sendGenerationNotification({
              userId,
              generationType: 'transcribe',
              modelName: 'Whisper',
              creditsUsed: isVip ? 0 : TRANSCRIBE_CREDIT_COST,
              actionUrl: '/ai-sound',
              supabaseUrl: SUPABASE_URL,
              anonKey: ANON_KEY,
            });
          }
          return new Response(JSON.stringify(buildTranscriptResponse(result, withTimestamp, withSpeaker)), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (status === "failed" || status === "error") {
          if (!isVip) await deductCredits(supabase, -TRANSCRIBE_CREDIT_COST, userId ?? undefined, sessionId ?? undefined);
          return new Response(JSON.stringify({ error: "변환 실패", detail: pollData }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
      if (!isVip) await deductCredits(supabase, -TRANSCRIBE_CREDIT_COST, userId ?? undefined, sessionId ?? undefined);
      return new Response(JSON.stringify({ error: "변환 시간 초과 (3분)" }), { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await logUsage(supabase, { userId: userId ?? undefined, sessionId: sessionId ?? undefined, serviceSlug: 'fal', action: '음성 전사 (GoAPI 폴백)', creditsDeducted: isVip ? 0 : TRANSCRIBE_CREDIT_COST, userPlan: plan, status: 'success', metadata: { credit_cost_source: 'db' } });
    // 로그인 사용자에게 생성 완료 알림 저장
    if (userId) {
      await sendGenerationNotification({
        userId,
        generationType: 'transcribe',
        modelName: 'Whisper',
        creditsUsed: isVip ? 0 : TRANSCRIBE_CREDIT_COST,
        actionUrl: '/ai-sound',
        supabaseUrl: SUPABASE_URL,
        anonKey: ANON_KEY,
      });
    }
    return new Response(JSON.stringify(buildTranscriptResponse(data, withTimestamp, withSpeaker)), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("Transcribe Edge Function 오류:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
