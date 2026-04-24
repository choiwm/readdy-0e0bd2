import { requireUser, AuthFailure } from '../_shared/auth.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    await requireUser(req);
  } catch (e) {
    if (e instanceof AuthFailure) return e.response;
    throw e;
  }

  try {
    const { text, targetLang, sourceLang } = await req.json();

    if (!text || !targetLang) {
      return new Response(
        JSON.stringify({ error: "text와 targetLang이 필요합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GOAPI_KEY = Deno.env.get("GOAPI_KEY");
    if (!GOAPI_KEY) {
      return new Response(
        JSON.stringify({ error: "GOAPI_KEY가 설정되지 않았습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const langNames: Record<string, string> = {
      ko: "Korean", en: "English", ja: "Japanese", zh: "Chinese",
      es: "Spanish", fr: "French", de: "German", pt: "Portuguese",
      ru: "Russian", ar: "Arabic",
    };

    const targetLangName = langNames[targetLang] ?? targetLang;
    const sourceLangName = sourceLang && sourceLang !== "auto" ? langNames[sourceLang] ?? sourceLang : "the source language";

    const systemPrompt = `You are a professional translator. Translate the given text from ${sourceLangName} to ${targetLangName}. 
Return ONLY the translated text, preserving the original formatting, line breaks, and structure. 
Do not add any explanations, notes, or extra content.`;

    const res = await fetch("https://api.goapi.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GOAPI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("GoAPI 번역 실패:", res.status, errText);
      return new Response(
        JSON.stringify({ error: `번역 요청 실패 (${res.status})` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    const translatedText = data?.choices?.[0]?.message?.content ?? "";

    return new Response(
      JSON.stringify({ success: true, translatedText, targetLang, sourceLang }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("translate-text 오류:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
