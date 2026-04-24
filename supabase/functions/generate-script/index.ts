import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireUser, AuthFailure } from '../_shared/auth.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VIP_PLANS = ['enterprise', 'vip', 'admin'];
const SCRIPT_CREDIT_COST = 2;

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
  } catch { /* fallback */ }
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
  } catch { /* fallback */ }
  return false;
}

// 스타일별 대본 톤 가이드
const STYLE_TONE_MAP: Record<string, string> = {
  cartoon_studio: '밝고 유쾌한 카툰 스타일. 친근하고 재미있는 표현 사용. 의성어나 감탄사 활용.',
  cartoon: '해설 카툰 스타일. 쉽고 명확한 설명. 핵심 포인트를 강조하는 문체.',
  sketch: '스케치 아트 스타일. 간결하고 직관적인 문장. 핵심만 담은 짧은 문장들.',
  mixed: '믹스미디어 스타일. 다양한 관점을 혼합. 창의적이고 실험적인 표현.',
  tonedown: '톤다운 무드. 차분하고 감성적인 문체. 여운이 남는 표현.',
  photo: '다큐멘터리 포토 스타일. 사실적이고 생생한 묘사. 현장감 있는 표현.',
  film: '영화적 내레이션. 드라마틱하고 임팩트 있는 문장. 긴장감과 서사.',
  news: '뉴스 앵커 스타일. 객관적이고 명확한 정보 전달. 공식적인 문체.',
  anime: '일본 애니메이션 스타일. 감정이 풍부하고 드라마틱. 캐릭터 중심 서사.',
  '3d_anime': '3D 애니메이션 스타일. 생동감 있고 역동적인 표현. 시각적 묘사 강조.',
  webtoon: '웹툰 스타일. 공감 가는 일상적 표현. 독자와 소통하는 문체.',
  flat_illust: '플랫 일러스트 스타일. 깔끔하고 정돈된 설명. 인포그래픽적 구성.',
  korean_wild: '한국 야담 스타일. 구수하고 이야기체. 전통적인 서사 구조.',
  korean_webtoon: '한국 웹툰 스타일. 현대적이고 공감 가는 표현. 감성적인 문체.',
  retro_pixel: '레트로 픽셀 스타일. 복고풍 표현. 게임적 요소와 향수 자극.',
  us_cartoon: '미국 카툰 스타일. 과장되고 유머러스한 표현. 액션과 코미디 요소.',
  claymation: '클레이 애니메이션 스타일. 따뜻하고 친근한 표현. 수공예적 감성.',
  pen_sketch: '펜 스케치 스타일. 섬세하고 예술적인 묘사. 디테일에 집중.',
};

// 화면 비율별 영상 길이 가이드
const RATIO_GUIDE: Record<string, string> = {
  '9:16': '세로형 숏폼 (30-60초). 빠른 전개, 핵심만 담은 짧은 문장.',
  '16:9': '가로형 유튜브 (60-180초). 충분한 설명과 스토리 전개.',
  '1:1': '정사각형 SNS (30-90초). 간결하고 임팩트 있는 구성.',
  '3:4': '세로형 SNS (45-90초). 모바일 최적화된 간결한 구성.',
};

// 키워드 기반 대본 생성 (GoAPI GPT 사용)
async function generateScriptWithGPT(
  keywords: string[],
  style: string | null,
  ratio: string,
  channelName: string,
  videoLength: number,
  goApiKey: string
): Promise<string> {
  const styleTone = style ? (STYLE_TONE_MAP[style] ?? '일반적인 유튜브 스타일') : '일반적인 유튜브 스타일';
  const ratioGuide = RATIO_GUIDE[ratio] ?? RATIO_GUIDE['16:9'];
  const keywordStr = keywords.length > 0 ? keywords.join(', ') : '일반 콘텐츠';
  const channelStr = channelName ? `채널명: ${channelName}` : '';

  const systemPrompt = `당신은 전문 유튜브 대본 작가입니다. 주어진 키워드와 스타일에 맞는 유튜브 영상 대본을 작성합니다.
대본 작성 규칙:
1. 자연스럽고 구어체로 작성 (시청자에게 직접 말하는 형식)
2. 단락 구분을 명확히 하여 씬 전환이 쉽도록 작성
3. 시청자의 관심을 끄는 훅(Hook)으로 시작
4. 핵심 내용을 중간에 배치
5. 행동 유도(CTA)로 마무리
6. 한국어로 작성`;

  const userPrompt = `다음 조건에 맞는 유튜브 영상 대본을 작성해주세요:

주제/키워드: ${keywordStr}
${channelStr}
영상 스타일: ${styleTone}
화면 비율/형식: ${ratioGuide}
목표 영상 길이: ${videoLength}초

대본만 작성해주세요. 제목이나 설명 없이 바로 대본 내용만 작성합니다.
각 씬은 빈 줄로 구분해주세요.`;

  const response = await fetch('https://api.goapi.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${goApiKey}`,
      'x-api-key': goApiKey,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1500,
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`GPT API 오류: ${response.status} - ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('대본 생성 결과가 없습니다');
  return content.trim();
}

// 폴백: 키워드 기반 템플릿 대본 생성
function generateFallbackScript(keywords: string[], style: string | null, ratio: string, channelName: string, videoLength: number): string {
  const mainKeyword = keywords[0] ?? '이 주제';
  const subKeywords = keywords.slice(1, 3);
  const isShortForm = ratio === '9:16' || videoLength <= 60;
  const channelIntro = channelName ? `${channelName} 채널에 오신 것을 환영합니다.` : '';

  if (isShortForm) {
    return `${mainKeyword}에 대해 알고 계셨나요?

${channelIntro}

오늘은 ${mainKeyword}의 핵심을 빠르게 정리해드릴게요.${subKeywords.length > 0 ? `\n\n특히 ${subKeywords.join('과 ')}에 대해 집중적으로 다뤄볼 예정입니다.` : ''}

${mainKeyword}은 현재 많은 분들이 관심을 가지고 있는 분야입니다. 그 이유는 바로 우리 일상과 밀접하게 연결되어 있기 때문이죠.

핵심 포인트를 정리하면:
첫째, ${mainKeyword}의 기본 개념을 이해하는 것이 중요합니다.
둘째, 실제 활용 방법을 익혀야 합니다.
셋째, 꾸준한 실천이 성공의 열쇠입니다.

오늘 내용이 도움이 되셨다면 좋아요와 구독 부탁드립니다!`;
  }

  return `아직도 ${mainKeyword}을 모르고 계신가요? 이미 많은 분들이 이것을 활용해 놀라운 결과를 만들어내고 있습니다.

${channelIntro}

오늘은 ${mainKeyword}에 대해 깊이 있게 알아보겠습니다.${subKeywords.length > 0 ? ` 특히 ${subKeywords.join(', ')}와의 연관성도 함께 살펴볼 예정입니다.` : ''}

${mainKeyword}이란 무엇인가요? 간단히 말하면, 우리 삶을 더 효율적이고 풍요롭게 만들어주는 핵심 요소입니다. 전문가들은 이미 수년 전부터 이 분야의 중요성을 강조해왔습니다.

실제로 ${mainKeyword}을 제대로 이해하고 활용하는 사람들은 그렇지 않은 사람들에 비해 훨씬 더 나은 결과를 얻고 있습니다. 그 차이는 생각보다 훨씬 크죠.

그렇다면 어떻게 시작해야 할까요? 먼저 기본 개념부터 탄탄히 다져야 합니다. 기초가 없으면 아무리 좋은 방법도 효과가 없습니다.

다음으로 실제 사례를 통해 배우는 것이 중요합니다. 이론만으로는 부족합니다. 실제로 적용해보고 경험을 쌓아야 합니다.

마지막으로 꾸준한 실천이 필요합니다. 하루아침에 전문가가 될 수는 없지만, 매일 조금씩 발전해나간다면 반드시 원하는 결과를 얻을 수 있습니다.

오늘 영상이 도움이 되셨다면 좋아요와 구독 버튼을 눌러주세요. 더 많은 유익한 콘텐츠로 찾아오겠습니다!`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let authedUserId: string;
  try {
    const authed = await requireUser(req);
    authedUserId = authed.id;
  } catch (e) {
    if (e instanceof AuthFailure) return e.response;
    throw e;
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const body = await req.json();
    const {
      keywords = [],
      style = null,
      ratio = '16:9',
      channelName = '',
      videoLength = 60,
      user_id,
      session_id,
    } = body;

    const { plan, credits, isVip } = await getUserInfo(supabase, user_id, session_id);

    if (!isVip) {
      if (credits < SCRIPT_CREDIT_COST) {
        // 200으로 반환 — supabase.functions.invoke가 error 대신 data로 받도록
        return new Response(
          JSON.stringify({
            success: false,
            error: `크레딧이 부족합니다. 필요: ${SCRIPT_CREDIT_COST} CR, 보유: ${credits} CR`,
            insufficient_credits: true,
            required: SCRIPT_CREDIT_COST,
            available: credits,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      await deductCredits(supabase, SCRIPT_CREDIT_COST, user_id, session_id);
    }

    // GoAPI 키 조회
    let GOAPI_KEY: string | null = null;
    try {
      const { data } = await supabase.from('api_keys').select('encrypted_key, status').eq('service_slug', 'goapi').eq('status', 'active').maybeSingle();
      if (data?.encrypted_key) {
        const enc = data.encrypted_key as string;
        if (enc.startsWith('enc_v1:')) {
          try { GOAPI_KEY = atob(enc.split(':')[2]); } catch { GOAPI_KEY = null; }
        } else {
          GOAPI_KEY = enc;
        }
      }
    } catch { /* ignore */ }

    if (!GOAPI_KEY) GOAPI_KEY = Deno.env.get('GOAPI_KEY') ?? null;

    let script: string;
    let usedAI = false;

    if (GOAPI_KEY) {
      try {
        script = await generateScriptWithGPT(keywords, style, ratio, channelName, videoLength, GOAPI_KEY);
        usedAI = true;
        console.log(`[generate-script] GPT 대본 생성 성공, length=${script.length}`);
      } catch (err) {
        console.warn('[generate-script] GPT 실패, 폴백 사용:', err);
        script = generateFallbackScript(keywords, style, ratio, channelName, videoLength);
      }
    } else {
      console.log('[generate-script] GOAPI_KEY 없음, 폴백 사용');
      script = generateFallbackScript(keywords, style, ratio, channelName, videoLength);
    }

    return new Response(
      JSON.stringify({
        success: true,
        script,
        used_ai: usedAI,
        credits_used: isVip ? 0 : SCRIPT_CREDIT_COST,
        keywords,
        style,
        ratio,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error('[generate-script] 오류:', err);
    // 500도 200으로 반환 — 프론트에서 항상 data로 받도록
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
