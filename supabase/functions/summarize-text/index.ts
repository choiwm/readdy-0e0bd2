import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser, AuthFailure } from '../_shared/auth.ts';
import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';
import { checkRateLimit, rateLimitedResponse, POLICIES } from '../_shared/rateLimit.ts';

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

  // Supabase client solely for rate-limit bookkeeping.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const _rl = await checkRateLimit(supabase, {
    bucket: `summarize-text:${authedUserId}`,
    ...POLICIES.summarizeText,
  });
  if (!_rl.ok) return rateLimitedResponse(_rl.resetAt, corsHeaders);

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY가 설정되지 않았습니다. Supabase Edge Function Secrets에 OPENAI_API_KEY를 추가해주세요." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { text, targetLang = "ko" } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(
        JSON.stringify({ error: "text 파라미터가 필요합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const langNames: Record<string, string> = {
      ko: "한국어", en: "English", ja: "日本語", zh: "中文",
      es: "Español", fr: "Français", de: "Deutsch",
    };
    const langName = langNames[targetLang] ?? "한국어";

    const systemPrompt = `You are a professional summarizer. Summarize the given transcript text concisely in ${langName}.
Rules:
- Output ONLY the summary text, no labels or prefixes
- 3-5 sentences maximum
- Capture the main topics and key points
- Use natural, fluent language in ${langName}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Summarize this transcript:\n\n${text.slice(0, 8000)}` },
        ],
        max_tokens: 400,
        temperature: 0.5,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message ?? `OpenAI API 오류 (${res.status})`);
    }

    const data = await res.json();
    const summaryText = data.choices?.[0]?.message?.content?.trim() ?? "";

    return new Response(
      JSON.stringify({ success: true, summaryText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("summarize-text 오류:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
