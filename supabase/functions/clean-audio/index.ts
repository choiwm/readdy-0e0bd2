import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser, AuthFailure } from '../_shared/auth.ts';
import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';
import { checkRateLimit, rateLimitedResponse, POLICIES } from '../_shared/rateLimit.ts';

const VIP_PLANS = ['enterprise', 'vip', 'admin'];
const FALLBACK_CLEAN_COST = 10;

// LALAL.AI preset mapping
const PRESET_MAP: Record<string, string> = {
  noise: "voice",
  isolate: "vocals",
  separate: "vocals",
};

const STEM_PRESETS = ["vocals", "drums", "bass", "other"];

// DB에서 크레딧 비용 동적 조회
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

serve(async (req) => {
  if (req.method === "OPTIONS") return handlePreflight(req);

  const corsHeaders = buildCorsHeaders(req);

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
    bucket: `clean-audio:${authedUserId}`,
    ...POLICIES.cleanAudio,
  });
  if (!_rl.ok) return rateLimitedResponse(_rl.resetAt, buildCorsHeaders(req));
  try {
    const LALAL_KEY = Deno.env.get("LALAL_KEY");
    if (!LALAL_KEY) {
      return new Response(
        JSON.stringify({
          error: "LALAL_KEY가 설정되지 않았습니다. Supabase Edge Function Secrets에 LALAL_KEY를 추가해주세요.",
          needsKey: true,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const mode = (formData.get("mode") as string) || "noise";
    const intensity = parseInt((formData.get("intensity") as string) || "75");
    // JWT로 검증된 사용자 ID를 사용 — 본문의 user_id는 신뢰하지 않음
    const userId = authedUserId;
    const sessionId = formData.get("session_id") as string | null;

    if (!audioFile) {
      return new Response(
        JSON.stringify({ error: "audio 파일이 필요합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (audioFile.size > 200 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "파일 크기가 200MB를 초과합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DB에서 크레딧 비용 동적 조회
    const dbCost = await getCreditCostFromDB(supabase, 'clean', 'lalal-ai');
    const CLEAN_CREDIT_COST = dbCost ?? FALLBACK_CLEAN_COST;

    console.log(`[clean-audio] mode=${mode}, creditCost=${CLEAN_CREDIT_COST} (DB 동적)`);

    const { plan, credits, isVip } = await getUserInfo(supabase, userId ?? undefined, sessionId ?? undefined);

    if (!isVip) {
      if (credits < CLEAN_CREDIT_COST) {
        await logUsage(supabase, { userId: userId ?? undefined, sessionId: sessionId ?? undefined, serviceSlug: 'lalal', action: '오디오 클린', creditsDeducted: 0, userPlan: plan, status: 'insufficient_credits', metadata: { required: CLEAN_CREDIT_COST, available: credits } });
        return new Response(
          JSON.stringify({ error: `크레딧이 부족합니다. 필요: ${CLEAN_CREDIT_COST} CR, 보유: ${credits} CR`, insufficient_credits: true, required: CLEAN_CREDIT_COST, available: credits }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      await deductCredits(supabase, CLEAN_CREDIT_COST, userId ?? undefined, sessionId ?? undefined);
    }

    console.log(`LALAL.AI 처리 시작: mode=${mode}, file=${audioFile.name}, size=${audioFile.size}`);

    // Step 1: Upload file to LALAL.AI
    const uploadForm = new FormData();
    uploadForm.append("file", audioFile, audioFile.name);

    const uploadRes = await fetch("https://www.lalal.ai/api/upload/", {
      method: "POST",
      headers: {
        "Authorization": `license ${LALAL_KEY}`,
      },
      body: uploadForm,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error("LALAL.AI 업로드 실패:", errText);
      if (!isVip) await deductCredits(supabase, -CLEAN_CREDIT_COST, userId ?? undefined, sessionId ?? undefined);
      return new Response(
        JSON.stringify({ error: `파일 업로드 실패 (${uploadRes.status})`, detail: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const uploadData = await uploadRes.json();
    console.log("업로드 응답:", JSON.stringify(uploadData).slice(0, 300));

    if (uploadData.status !== "success") {
      if (!isVip) await deductCredits(supabase, -CLEAN_CREDIT_COST, userId ?? undefined, sessionId ?? undefined);
      return new Response(
        JSON.stringify({ error: "업로드 실패", detail: uploadData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sourceId = uploadData.id;
    console.log("source_id:", sourceId);

    const noiseCancelLevel = intensity >= 80 ? "aggressive" : intensity >= 50 ? "normal" : "mild";

    if (mode === "separate") {
      const stemResults: Record<string, string> = {};

      for (const preset of STEM_PRESETS) {
        try {
          const splitRes = await fetch("https://www.lalal.ai/api/split/", {
            method: "POST",
            headers: {
              "Authorization": `license ${LALAL_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: sourceId,
              preset,
              mdx_steps: 1,
              splitter: "phoenix",
            }),
          });

          if (!splitRes.ok) {
            console.error(`${preset} split 실패:`, splitRes.status);
            continue;
          }

          const splitData = await splitRes.json();
          if (splitData.status !== "success") continue;

          const stemUrl = await pollForResult(sourceId, LALAL_KEY, preset, 120);
          if (stemUrl) {
            stemResults[preset] = stemUrl;
          }
        } catch (e) {
          console.error(`${preset} 처리 오류:`, e);
        }
      }

      await logUsage(supabase, { userId: userId ?? undefined, sessionId: sessionId ?? undefined, serviceSlug: 'lalal', action: '오디오 분리', creditsDeducted: isVip ? 0 : CLEAN_CREDIT_COST, userPlan: plan, status: 'success', metadata: { mode, credit_cost_source: 'db' } });
      return new Response(
        JSON.stringify({
          success: true,
          mode: "separate",
          stems: stemResults,
          sourceId,
          credits_used: isVip ? 0 : CLEAN_CREDIT_COST,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else {
      const preset = PRESET_MAP[mode] || "voice";

      const splitBody: Record<string, unknown> = {
        id: sourceId,
        preset,
        mdx_steps: 1,
        splitter: "phoenix",
      };

      if (mode === "noise") {
        splitBody.noise_cancel_level = noiseCancelLevel;
      }

      const splitRes = await fetch("https://www.lalal.ai/api/split/", {
        method: "POST",
        headers: {
          "Authorization": `license ${LALAL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(splitBody),
      });

      if (!splitRes.ok) {
        const errText = await splitRes.text();
        console.error("LALAL.AI split 실패:", errText);
        if (!isVip) await deductCredits(supabase, -CLEAN_CREDIT_COST, userId ?? undefined, sessionId ?? undefined);
        return new Response(
          JSON.stringify({ error: `처리 요청 실패 (${splitRes.status})`, detail: errText }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const splitData = await splitRes.json();
      console.log("split 응답:", JSON.stringify(splitData).slice(0, 300));

      if (splitData.status !== "success") {
        if (!isVip) await deductCredits(supabase, -CLEAN_CREDIT_COST, userId ?? undefined, sessionId ?? undefined);
        return new Response(
          JSON.stringify({ error: "처리 요청 실패", detail: splitData }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const resultUrl = await pollForResult(sourceId, LALAL_KEY, preset, 180);

      if (!resultUrl) {
        if (!isVip) await deductCredits(supabase, -CLEAN_CREDIT_COST, userId ?? undefined, sessionId ?? undefined);
        return new Response(
          JSON.stringify({ error: "처리 시간 초과 (3분). 파일이 너무 크거나 서버가 바쁩니다." }),
          { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await logUsage(supabase, { userId: userId ?? undefined, sessionId: sessionId ?? undefined, serviceSlug: 'lalal', action: '오디오 클린', creditsDeducted: isVip ? 0 : CLEAN_CREDIT_COST, userPlan: plan, status: 'success', metadata: { mode, credit_cost_source: 'db' } });
      return new Response(
        JSON.stringify({
          success: true,
          mode,
          audioUrl: resultUrl,
          sourceId,
          credits_used: isVip ? 0 : CLEAN_CREDIT_COST,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (err) {
    console.error("Clean Audio Edge Function 오류:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function pollForResult(
  sourceId: string,
  apiKey: string,
  preset: string,
  maxSeconds: number
): Promise<string | null> {
  const maxAttempts = Math.floor(maxSeconds / 3);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, 3000));

    try {
      const checkRes = await fetch(`https://www.lalal.ai/api/check/?id=${sourceId}`, {
        headers: {
          "Authorization": `license ${apiKey}`,
        },
      });

      if (!checkRes.ok) {
        console.error(`폴링 ${attempt + 1}회 실패:`, checkRes.status);
        continue;
      }

      const checkData = await checkRes.json();
      console.log(`폴링 ${attempt + 1}회:`, JSON.stringify(checkData).slice(0, 400));

      if (checkData.status !== "success") continue;

      const splits = checkData.split ?? {};
      const presetData = splits[preset] ?? splits[Object.keys(splits)[0]];

      if (!presetData) continue;

      const taskStatus = presetData.status ?? presetData.task_status;

      if (taskStatus === "success" || taskStatus === "completed") {
        const stemUrl =
          presetData.stem?.url ??
          presetData.stem_url ??
          presetData.back?.url ??
          presetData.back_url ??
          presetData.url;

        if (stemUrl) {
          console.log(`처리 완료! URL: ${stemUrl}`);
          return stemUrl;
        }
      }

      if (taskStatus === "error" || taskStatus === "failed") {
        console.error("처리 실패:", presetData);
        return null;
      }

      console.log(`처리 중... status=${taskStatus}, attempt=${attempt + 1}`);
    } catch (e) {
      console.error(`폴링 오류 (${attempt + 1}):`, e);
    }
  }

  return null;
}
