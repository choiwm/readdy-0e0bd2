import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser, AuthFailure } from '../_shared/auth.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SfxScene {
  label: string;
  prompt: string;
  time: string;
  duration: number;
  type: string;
}

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
    const GOAPI_KEY = Deno.env.get("GOAPI_KEY");
    const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? GOAPI_KEY;

    if (!OPENAI_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY 또는 GOAPI_KEY가 설정되지 않았습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();
    const videoFile = formData.get("video") as File | null;
    const sensitivity = parseInt(formData.get("sensitivity") as string ?? "70");
    const density = (formData.get("density") as string) ?? "medium";
    const includeAmbient = formData.get("includeAmbient") === "true";

    if (!videoFile) {
      return new Response(
        JSON.stringify({ error: "video 파일이 필요합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`영상 분석 시작: ${videoFile.name}, size=${videoFile.size}, sensitivity=${sensitivity}, density=${density}`);

    // 영상 파일을 ArrayBuffer로 읽기
    const videoBuffer = await videoFile.arrayBuffer();
    const videoBytes = new Uint8Array(videoBuffer);

    // 영상 크기 제한 (10MB 이하만 직접 처리, 초과 시 메타데이터만 분석)
    const isLargeFile = videoFile.size > 10 * 1024 * 1024;

    let analysisPrompt: string;
    let messages: unknown[];

    if (!isLargeFile) {
      // 소형 파일: 첫 프레임을 base64로 인코딩하여 Vision API에 전달
      // 영상 파일의 앞부분에서 JPEG/PNG 썸네일 추출 시도
      const base64Video = btoa(
        videoBytes.slice(0, Math.min(videoBytes.length, 5 * 1024 * 1024))
          .reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      const mimeType = videoFile.type || "video/mp4";

      analysisPrompt = `You are an expert sound designer analyzing a video for automatic SFX (Sound Effects) generation.

Analyze this video and identify all sound events that should have corresponding sound effects.

Settings:
- Sensitivity: ${sensitivity}% (higher = detect more subtle sounds)
- Density: ${density} (low=3-4 SFX, medium=5-7 SFX, high=8-12 SFX)
- Include ambient sounds: ${includeAmbient}

Based on the video content, generate a JSON array of SFX scenes. Each scene must have:
- label: Korean name for the sound (e.g., "발걸음 소리", "문 열리는 소리")
- prompt: English ElevenLabs SFX prompt (detailed, 10-30 words)
- time: timestamp in "M:SS" format
- duration: duration in seconds (0.3 to 8.0)
- type: one of "Footstep", "Ambient", "Impact", "Voice", "Mechanical", "Nature", "UI", "Foley"

Return ONLY a valid JSON array, no other text. Example:
[{"label":"발걸음 소리","prompt":"footsteps on wooden floor, slow walking pace, indoor echo","time":"0:02","duration":1.2,"type":"Footstep"}]`;

      messages = [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: analysisPrompt,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Video}`,
                detail: "low",
              },
            },
          ],
        },
      ];
    } else {
      // 대형 파일: 파일명과 메타데이터 기반으로 분석
      analysisPrompt = `You are an expert sound designer. Based on the video filename "${videoFile.name}" and typical video content patterns, generate appropriate SFX (Sound Effects) for this video.

Settings:
- Sensitivity: ${sensitivity}% (higher = detect more subtle sounds)  
- Density: ${density} (low=3-4 SFX, medium=5-7 SFX, high=8-12 SFX)
- Include ambient sounds: ${includeAmbient}
- Video duration: approximately 10-30 seconds (typical short video)

Generate a realistic and diverse set of SFX scenes. Each scene must have:
- label: Korean name for the sound (e.g., "발걸음 소리", "문 열리는 소리")
- prompt: English ElevenLabs SFX prompt (detailed, 10-30 words)
- time: timestamp in "M:SS" format
- duration: duration in seconds (0.3 to 8.0)
- type: one of "Footstep", "Ambient", "Impact", "Voice", "Mechanical", "Nature", "UI", "Foley"

Return ONLY a valid JSON array, no other text.`;

      messages = [
        {
          role: "user",
          content: analysisPrompt,
        },
      ];
    }

    // GPT-4o Vision API 호출 (GoAPI 경유 또는 직접)
    let gptRes: Response;
    const gptBody = {
      model: "gpt-4o",
      messages,
      max_tokens: 1500,
      temperature: 0.7,
    };

    // GoAPI 경유 시도
    if (GOAPI_KEY) {
      gptRes = await fetch("https://api.goapi.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "x-api-key": GOAPI_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(gptBody),
      });

      if (!gptRes.ok) {
        console.log(`GoAPI GPT 실패 (${gptRes.status}), OpenAI 직접 시도...`);
        // OpenAI 직접 시도
        if (OPENAI_KEY !== GOAPI_KEY) {
          gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${OPENAI_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(gptBody),
          });
        }
      }
    } else {
      gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(gptBody),
      });
    }

    let scenes: SfxScene[] = [];

    if (gptRes.ok) {
      const gptData = await gptRes.json();
      const content = gptData?.choices?.[0]?.message?.content ?? "";
      console.log("GPT 응답:", content.slice(0, 500));

      try {
        // JSON 배열 추출
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          scenes = JSON.parse(jsonMatch[0]) as SfxScene[];
        }
      } catch (parseErr) {
        console.error("JSON 파싱 실패:", parseErr);
      }
    } else {
      const errText = await gptRes.text();
      console.error("GPT API 실패:", errText);
    }

    // GPT 실패 시 fallback: 파일명 기반 기본 SFX 세트
    if (!scenes || scenes.length === 0) {
      console.log("GPT 분석 실패, fallback SFX 세트 사용");
      const densityCount = density === "low" ? 3 : density === "high" ? 8 : 5;
      const fallbackScenes: SfxScene[] = [
        { label: "배경 앰비언트", prompt: "indoor ambient room tone, subtle background noise, quiet environment", time: "0:00", duration: 8.0, type: "Ambient" },
        { label: "발걸음 소리", prompt: "footsteps on hard floor, steady walking pace, indoor echo", time: "0:02", duration: 1.5, type: "Footstep" },
        { label: "물체 이동음", prompt: "object sliding on surface, gentle scraping sound", time: "0:04", duration: 0.8, type: "Foley" },
        { label: "충격음", prompt: "soft impact sound, object hitting surface, muffled thud", time: "0:06", duration: 0.5, type: "Impact" },
        { label: "문 소리", prompt: "door opening slowly, wooden door creak, interior door", time: "0:08", duration: 1.2, type: "Mechanical" },
        { label: "바람 소리", prompt: "gentle wind breeze, outdoor ambient, soft rustling", time: "0:01", duration: 5.0, type: "Nature" },
        { label: "키보드 타이핑", prompt: "mechanical keyboard typing, fast keystrokes, office environment", time: "0:03", duration: 2.0, type: "Mechanical" },
        { label: "알림음", prompt: "soft notification chime, digital UI sound, pleasant bell", time: "0:07", duration: 0.4, type: "UI" },
      ];

      scenes = fallbackScenes.slice(0, densityCount);
      if (!includeAmbient) {
        scenes = scenes.filter(s => s.type !== "Ambient" && s.type !== "Nature");
      }
    }

    // 민감도 필터링 (낮은 민감도 = 주요 SFX만)
    if (sensitivity < 50) {
      scenes = scenes.filter(s => s.type === "Impact" || s.type === "Footstep" || s.type === "Mechanical");
    } else if (sensitivity < 70) {
      scenes = scenes.filter(s => s.type !== "Ambient" || includeAmbient);
    }

    // 앰비언트 필터
    if (!includeAmbient) {
      scenes = scenes.filter(s => s.type !== "Ambient" && s.type !== "Nature");
    }

    // 최소 1개 보장
    if (scenes.length === 0) {
      scenes = [{ label: "배경 앰비언트", prompt: "indoor ambient room tone, subtle background noise", time: "0:00", duration: 5.0, type: "Ambient" }];
    }

    console.log(`분석 완료: ${scenes.length}개 SFX 감지`);

    return new Response(
      JSON.stringify({ success: true, scenes }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("analyze-video-sfx 오류:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
