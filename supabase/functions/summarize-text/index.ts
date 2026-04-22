import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser, AuthFailure } from '../_shared/auth.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await requireUser(req);
  } catch (e) {
    if (e instanceof AuthFailure) return e.response;
    throw e;
  }

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
