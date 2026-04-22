import { useState, useCallback } from 'react';
import PageHeader from '@/components/feature/PageHeader';
import type { AppliedCharacter } from '../page';
import { supabase } from '@/lib/supabase';
import { useCredits } from '@/hooks/useCredits';
import { useAuth } from '@/hooks/useAuth';

interface CustomCharacterModalProps {
  onClose: () => void;
  onGenerate: (character: AppliedCharacter) => void;
}

// ── 옵션 데이터 ────────────────────────────────────────────────────────────
const GENDER_OPTIONS = [
  { id: 'female', label: '여자', icon: 'ri-women-line', color: 'rose' },
  { id: 'male',   label: '남자', icon: 'ri-men-line',   color: 'sky' },
];

const AGE_OPTIONS = [
  { id: 'teens',   label: '10대', desc: '10~19세' },
  { id: 'early20', label: '20대 초반', desc: '20~24세' },
  { id: 'late20',  label: '20대 후반', desc: '25~29세' },
  { id: 'early30', label: '30대 초반', desc: '30~34세' },
  { id: 'late30',  label: '30대 후반', desc: '35~39세' },
  { id: '40s',     label: '40대', desc: '40~49세' },
];

const FACE_STYLE_OPTIONS = [
  { id: 'natural',    label: '내추럴', icon: 'ri-leaf-line',       desc: '자연스럽고 편안한 인상' },
  { id: 'cute',       label: '귀여움', icon: 'ri-heart-line',      desc: '사랑스럽고 밝은 인상' },
  { id: 'elegant',    label: '우아함', icon: 'ri-vip-crown-line',  desc: '세련되고 고급스러운 인상' },
  { id: 'charisma',   label: '카리스마', icon: 'ri-fire-line',     desc: '강렬하고 인상적인 분위기' },
  { id: 'intellectual', label: '지적', icon: 'ri-book-open-line', desc: '똑똑하고 신뢰감 있는 인상' },
  { id: 'sporty',     label: '스포티', icon: 'ri-run-line',        desc: '활동적이고 건강한 이미지' },
];

const STYLE_OPTIONS = [
  { id: 'casual',    label: '캐주얼', icon: 'ri-t-shirt-line',       color: 'from-zinc-700 to-zinc-800' },
  { id: 'business',  label: '비즈니스', icon: 'ri-briefcase-line',   color: 'from-zinc-800 to-zinc-900' },
  { id: 'formal',    label: '포멀', icon: 'ri-user-star-line',          color: 'from-zinc-700 to-zinc-900' },
  { id: 'street',    label: '스트리트', icon: 'ri-store-line',        color: 'from-zinc-700 to-zinc-800' },
  { id: 'luxury',    label: '럭셔리', icon: 'ri-vip-diamond-line',    color: 'from-amber-900/60 to-zinc-900' },
  { id: 'artistic',  label: '아티스틱', icon: 'ri-palette-line',     color: 'from-violet-900/60 to-zinc-900' },
];

const MOOD_OPTIONS = [
  { id: 'bright',    label: '밝고 활기찬', emoji: '☀️' },
  { id: 'calm',      label: '차분하고 안정적', emoji: '🌿' },
  { id: 'confident', label: '자신감 넘치는', emoji: '⚡' },
  { id: 'warm',      label: '따뜻하고 친근한', emoji: '🌸' },
  { id: 'mysterious',label: '신비롭고 독특한', emoji: '🌙' },
  { id: 'professional', label: '전문적이고 신뢰감', emoji: '💼' },
];

const HAIR_OPTIONS = [
  { id: 'short',     label: '숏컷' },
  { id: 'medium',    label: '미디엄' },
  { id: 'long',      label: '롱헤어' },
  { id: 'curly',     label: '웨이브' },
  { id: 'tied',      label: '묶음' },
  { id: 'bob',       label: '단발' },
];

const HAIR_COLOR_OPTIONS = [
  { id: 'black',  label: '블랙', color: '#1a1a1a' },
  { id: 'brown',  label: '브라운', color: '#6b3a2a' },
  { id: 'blonde', label: '블론드', color: '#c8a96e' },
  { id: 'gray',   label: '그레이', color: '#9ca3af' },
  { id: 'red',    label: '레드', color: '#b91c1c' },
  { id: 'ash',    label: '애쉬', color: '#8b8fa8' },
];

const BACKGROUND_OPTIONS = [
  { id: 'studio',  label: '스튜디오', icon: 'ri-camera-line' },
  { id: 'outdoor', label: '야외', icon: 'ri-sun-line' },
  { id: 'office',  label: '오피스', icon: 'ri-building-line' },
  { id: 'minimal', label: '미니멀', icon: 'ri-layout-line' },
  { id: 'dark',    label: '다크', icon: 'ri-moon-line' },
  { id: 'nature',  label: '자연', icon: 'ri-plant-line' },
];

const CUSTOM_CHAR_CREDIT_COST = 3;

// ── Step indicator ─────────────────────────────────────────────────────────
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all duration-300 ${
            i < current
              ? 'bg-indigo-500 w-6'
              : i === current
              ? 'bg-indigo-400 w-8'
              : 'bg-zinc-700 w-4'
          }`}
        />
      ))}
    </div>
  );
}

// ── Option chip ────────────────────────────────────────────────────────────
function OptionChip({
  selected,
  onClick,
  children,
  color = 'indigo',
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
        selected
          ? color === 'rose'
            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
            : color === 'sky'
            ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
            : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
          : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
      }`}
    >
      {children}
    </button>
  );
}

export default function CustomCharacterModal({ onClose, onGenerate }: CustomCharacterModalProps) {
  const { deduct, refund, credits, canAfford } = useCredits();
  const { profile } = useAuth();

  const [step, setStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPreview, setGeneratedPreview] = useState<string | null>(null);
  const [charName, setCharName] = useState('');
  const [genError, setGenError] = useState<string | null>(null);

  // 선택 상태
  const [gender, setGender] = useState<string>('female');
  const [age, setAge] = useState<string>('early20');
  const [faceStyle, setFaceStyle] = useState<string>('natural');
  const [style, setStyle] = useState<string>('casual');
  const [mood, setMood] = useState<string>('bright');
  const [hair, setHair] = useState<string>('medium');
  const [hairColor, setHairColor] = useState<string>('black');
  const [background, setBackground] = useState<string>('studio');

  const TOTAL_STEPS = 3;

  const selectedGenderLabel = GENDER_OPTIONS.find((g) => g.id === gender)?.label ?? '여자';
  const selectedAgeLabel = AGE_OPTIONS.find((a) => a.id === age)?.label ?? '20대 초반';
  const selectedFaceLabel = FACE_STYLE_OPTIONS.find((f) => f.id === faceStyle)?.label ?? '내추럴';
  const selectedStyleLabel = STYLE_OPTIONS.find((s) => s.id === style)?.label ?? '캐주얼';
  const selectedMoodLabel = MOOD_OPTIONS.find((m) => m.id === mood)?.label ?? '밝고 활기찬';

  // ── 프롬프트 빌드 ──────────────────────────────────────────────────────
  const buildCharacterPrompt = useCallback((): string => {
    const gLabel = selectedGenderLabel === '여자' ? 'Korean woman' : 'Korean man';

    const ageMap: Record<string, string> = {
      teens: 'teenage', early20: 'young adult in early 20s', late20: 'young adult in late 20s',
      early30: 'adult in early 30s', late30: 'mature adult in late 30s', '40s': 'middle-aged adult in 40s',
    };
    const faceMap: Record<string, string> = {
      natural: 'natural soft features, gentle expression', cute: 'cute adorable features, sweet smile',
      elegant: 'elegant sophisticated features, refined look', charisma: 'charismatic strong features, intense gaze',
      intellectual: 'intelligent smart features, thoughtful expression', sporty: 'sporty athletic features, energetic look',
    };
    const styleMap: Record<string, string> = {
      casual: 'casual everyday outfit', business: 'business professional attire, blazer',
      formal: 'formal elegant suit', street: 'trendy streetwear fashion',
      luxury: 'luxury high-end fashion', artistic: 'artistic creative style clothing',
    };
    const bgMap: Record<string, string> = {
      studio: 'clean professional studio background', outdoor: 'beautiful outdoor natural background',
      office: 'modern office background', minimal: 'minimal clean white background',
      dark: 'dark moody dramatic background', nature: 'lush green nature background',
    };
    const hairColorMap: Record<string, string> = {
      black: 'black hair', brown: 'brown hair', blonde: 'blonde hair',
      gray: 'gray silver hair', red: 'red hair', ash: 'ash colored hair',
    };
    const hairStyleMap: Record<string, string> = {
      short: 'short hair', medium: 'medium length hair', long: 'long flowing hair',
      curly: 'wavy curly hair', tied: 'tied up hair', bob: 'bob cut hair',
    };
    const moodMap: Record<string, string> = {
      bright: 'bright cheerful expression, warm smile', calm: 'calm serene expression, peaceful look',
      confident: 'confident powerful expression, strong presence', warm: 'warm friendly expression, approachable smile',
      mysterious: 'mysterious intriguing expression, enigmatic look', professional: 'professional trustworthy expression, competent demeanor',
    };

    return [
      `${ageMap[age] ?? 'young'} ${gLabel}`,
      faceMap[faceStyle] ?? 'natural features',
      hairStyleMap[hair] ?? 'medium hair',
      hairColorMap[hairColor] ?? 'black hair',
      styleMap[style] ?? 'casual outfit',
      moodMap[mood] ?? 'natural expression',
      bgMap[background] ?? 'studio background',
      'portrait photography, photorealistic, high quality, 8k resolution, sharp details, professional lighting',
    ].join(', ');
  }, [selectedGenderLabel, age, faceStyle, hair, hairColor, style, mood, background]);

  // ── 실제 fal.ai 생성 ──────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    setGenError(null);

    // 크레딧 확인
    if (!canAfford(CUSTOM_CHAR_CREDIT_COST)) {
      setGenError(`크레딧이 부족합니다. 필요: ${CUSTOM_CHAR_CREDIT_COST} CR, 보유: ${credits} CR`);
      return;
    }

    // 크레딧 선차감
    const deducted = deduct(CUSTOM_CHAR_CREDIT_COST);
    if (!deducted) {
      setGenError('크레딧 차감에 실패했습니다.');
      return;
    }

    setStep(3);
    setIsGenerating(true);
    setGeneratedPreview(null);

    const prompt = buildCharacterPrompt();

    try {
      const sessionId = localStorage.getItem('ai_platform_session_id') ?? undefined;

      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt,
          model: 'Flux Realism',
          ratio: '3:4',
          aspectRatio: '3:4',
          user_id: profile?.id ?? undefined,
          session_id: profile?.id ? undefined : sessionId,
        },
      });

      if (error || !data?.imageUrl) {
        throw new Error(data?.error ?? error?.message ?? '이미지 생성에 실패했습니다.');
      }

      setGeneratedPreview(data.imageUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setGenError(msg);
      setStep(2); // 이전 스텝으로 복귀
      // 실패 시 크레딧 환불
      refund(CUSTOM_CHAR_CREDIT_COST);
    } finally {
      setIsGenerating(false);
    }
  }, [canAfford, deduct, credits, buildCharacterPrompt, profile]);

  // ── 다시 생성 ─────────────────────────────────────────────────────────
  const handleRegenerate = useCallback(async () => {
    setGenError(null);

    if (!canAfford(CUSTOM_CHAR_CREDIT_COST)) {
      setGenError(`크레딧이 부족합니다. 필요: ${CUSTOM_CHAR_CREDIT_COST} CR, 보유: ${credits} CR`);
      return;
    }

    const deducted = deduct(CUSTOM_CHAR_CREDIT_COST);
    if (!deducted) {
      setGenError('크레딧 차감에 실패했습니다.');
      return;
    }

    setIsGenerating(true);
    setGeneratedPreview(null);

    const prompt = buildCharacterPrompt();

    try {
      const sessionId = localStorage.getItem('ai_platform_session_id') ?? undefined;

      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt,
          model: 'Flux Realism',
          ratio: '3:4',
          aspectRatio: '3:4',
          user_id: profile?.id ?? undefined,
          session_id: profile?.id ? undefined : sessionId,
        },
      });

      if (error || !data?.imageUrl) {
        throw new Error(data?.error ?? error?.message ?? '이미지 생성에 실패했습니다.');
      }

      setGeneratedPreview(data.imageUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setGenError(msg);
      refund(CUSTOM_CHAR_CREDIT_COST);
    } finally {
      setIsGenerating(false);
    }
  }, [canAfford, deduct, credits, buildCharacterPrompt, profile]);

  const handleApply = () => {
    if (!generatedPreview) return;
    const finalName = charName.trim() || `커스텀 ${selectedGenderLabel}`;
    const tags = [selectedFaceLabel, selectedStyleLabel, selectedMoodLabel];
    onGenerate({
      id: `custom_${Date.now()}`,
      name: finalName,
      gender: selectedGenderLabel as '여자' | '남자',
      tags,
      img: generatedPreview,
    });
    onClose();
  };

  const canProceed = () => {
    if (step === 0) return gender && age;
    if (step === 1) return faceStyle && hair && hairColor;
    if (step === 2) return style && mood && background;
    return true;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        className="relative z-10 w-[640px] max-h-[90vh] bg-[#111114] border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <PageHeader
          icon="ri-user-add-line"
          title="나만의 캐릭터 만들기"
          statusLabel={
            step === 0 ? 'Step 1 / 3 — 기본 정보 설정' :
            step === 1 ? 'Step 2 / 3 — 외모 스타일 설정' :
            step === 2 ? 'Step 3 / 3 — 분위기 & 배경 설정' :
            '생성 완료!'
          }
          badgeColor="indigo"
          className="px-6 py-4"
          actions={
            <>
              {step < 3 && <StepIndicator current={step} total={TOTAL_STEPS} />}
              <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 cursor-pointer transition-all">
                <i className="ri-close-line text-sm" />
              </button>
            </>
          }
        />

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Step 0: 기본 정보 ── */}
          {step === 0 && (
            <div className="p-6 space-y-6">
              {/* 성별 */}
              <div>
                <p className="text-xs font-bold text-zinc-300 mb-3 flex items-center gap-1.5">
                  <i className="ri-user-line text-indigo-400" />성별
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {GENDER_OPTIONS.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setGender(g.id)}
                      className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${
                        gender === g.id
                          ? g.color === 'rose'
                            ? 'border-rose-500/50 bg-rose-500/10'
                            : 'border-sky-500/50 bg-sky-500/10'
                          : 'border-white/5 bg-zinc-900/40 hover:border-white/15'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        gender === g.id
                          ? g.color === 'rose' ? 'bg-rose-500/20' : 'bg-sky-500/20'
                          : 'bg-zinc-800'
                      }`}>
                        <i className={`${g.icon} text-xl ${
                          gender === g.id
                            ? g.color === 'rose' ? 'text-rose-400' : 'text-sky-400'
                            : 'text-zinc-500'
                        }`} />
                      </div>
                      <span className={`text-sm font-bold ${
                        gender === g.id
                          ? g.color === 'rose' ? 'text-rose-300' : 'text-sky-300'
                          : 'text-zinc-400'
                      }`}>{g.label}</span>
                      {gender === g.id && (
                        <i className={`ri-checkbox-circle-line ml-auto ${g.color === 'rose' ? 'text-rose-400' : 'text-sky-400'}`} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 나이대 */}
              <div>
                <p className="text-xs font-bold text-zinc-300 mb-3 flex items-center gap-1.5">
                  <i className="ri-calendar-line text-indigo-400" />나이대
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {AGE_OPTIONS.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setAge(a.id)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all cursor-pointer ${
                        age === a.id
                          ? 'border-indigo-500/50 bg-indigo-500/10'
                          : 'border-white/5 bg-zinc-900/40 hover:border-white/15'
                      }`}
                    >
                      <span className={`text-xs font-bold ${age === a.id ? 'text-indigo-300' : 'text-zinc-300'}`}>{a.label}</span>
                      <span className="text-[9px] text-zinc-600">{a.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 이름 (선택) */}
              <div>
                <p className="text-xs font-bold text-zinc-300 mb-3 flex items-center gap-1.5">
                  <i className="ri-price-tag-3-line text-indigo-400" />캐릭터 이름 <span className="text-zinc-600 font-normal">(선택)</span>
                </p>
                <input
                  type="text"
                  value={charName}
                  onChange={(e) => setCharName(e.target.value)}
                  placeholder={`예: ${selectedGenderLabel === '여자' ? '지아, 소연, 하은' : '준혁, 민준, 태양'}`}
                  maxLength={20}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-900/60 border border-white/5 text-sm text-zinc-300 placeholder-zinc-600 outline-none focus:border-indigo-500/50 transition-colors"
                />
              </div>
            </div>
          )}

          {/* ── Step 1: 외모 ── */}
          {step === 1 && (
            <div className="p-6 space-y-6">
              <div>
                <p className="text-xs font-bold text-zinc-300 mb-3 flex items-center gap-1.5">
                  <i className="ri-emotion-line text-indigo-400" />얼굴 인상
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {FACE_STYLE_OPTIONS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFaceStyle(f.id)}
                      className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border transition-all cursor-pointer ${
                        faceStyle === f.id
                          ? 'border-indigo-500/50 bg-indigo-500/10'
                          : 'border-white/5 bg-zinc-900/40 hover:border-white/15'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${faceStyle === f.id ? 'bg-indigo-500/20' : 'bg-zinc-800'}`}>
                        <i className={`${f.icon} text-sm ${faceStyle === f.id ? 'text-indigo-400' : 'text-zinc-500'}`} />
                      </div>
                      <span className={`text-xs font-bold ${faceStyle === f.id ? 'text-indigo-300' : 'text-zinc-300'}`}>{f.label}</span>
                      <span className="text-[9px] text-zinc-600 leading-tight">{f.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-zinc-300 mb-3 flex items-center gap-1.5">
                  <i className="ri-scissors-line text-indigo-400" />헤어 스타일
                </p>
                <div className="flex flex-wrap gap-2">
                  {HAIR_OPTIONS.map((h) => (
                    <OptionChip key={h.id} selected={hair === h.id} onClick={() => setHair(h.id)}>
                      {h.label}
                    </OptionChip>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-zinc-300 mb-3 flex items-center gap-1.5">
                  <i className="ri-palette-line text-indigo-400" />헤어 컬러
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  {HAIR_COLOR_OPTIONS.map((hc) => (
                    <button
                      key={hc.id}
                      onClick={() => setHairColor(hc.id)}
                      className="flex flex-col items-center gap-1.5 cursor-pointer group"
                    >
                      <div
                        className={`w-9 h-9 rounded-full border-2 transition-all ${
                          hairColor === hc.id ? 'border-indigo-400 scale-110' : 'border-white/10 hover:border-white/30'
                        }`}
                        style={{ backgroundColor: hc.color }}
                      />
                      <span className={`text-[9px] font-bold ${hairColor === hc.id ? 'text-indigo-400' : 'text-zinc-600'}`}>{hc.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: 분위기 & 배경 ── */}
          {step === 2 && (
            <div className="p-6 space-y-6">
              <div>
                <p className="text-xs font-bold text-zinc-300 mb-3 flex items-center gap-1.5">
                  <i className="ri-t-shirt-line text-indigo-400" />의상 스타일
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {STYLE_OPTIONS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setStyle(s.id)}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all cursor-pointer ${
                        style === s.id
                          ? 'border-indigo-500/50 bg-indigo-500/10'
                          : 'border-white/5 bg-zinc-900/40 hover:border-white/15'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center flex-shrink-0`}>
                        <i className={`${s.icon} text-xs text-white/70`} />
                      </div>
                      <span className={`text-xs font-bold ${style === s.id ? 'text-indigo-300' : 'text-zinc-300'}`}>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-zinc-300 mb-3 flex items-center gap-1.5">
                  <i className="ri-sparkling-2-line text-indigo-400" />캐릭터 분위기
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {MOOD_OPTIONS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMood(m.id)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${
                        mood === m.id
                          ? 'border-indigo-500/50 bg-indigo-500/10'
                          : 'border-white/5 bg-zinc-900/40 hover:border-white/15'
                      }`}
                    >
                      <span className="text-base">{m.emoji}</span>
                      <span className={`text-xs font-bold ${mood === m.id ? 'text-indigo-300' : 'text-zinc-300'}`}>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-zinc-300 mb-3 flex items-center gap-1.5">
                  <i className="ri-image-line text-indigo-400" />배경
                </p>
                <div className="flex flex-wrap gap-2">
                  {BACKGROUND_OPTIONS.map((b) => (
                    <OptionChip key={b.id} selected={background === b.id} onClick={() => setBackground(b.id)}>
                      <i className={`${b.icon} mr-1.5`} />{b.label}
                    </OptionChip>
                  ))}
                </div>
              </div>

              {/* 크레딧 안내 */}
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-500/8 border border-indigo-500/20">
                <i className="ri-copper-diamond-line text-indigo-400 text-sm flex-shrink-0" />
                <p className="text-[10px] text-indigo-400/80">
                  캐릭터 생성 시 <strong className="text-indigo-400">{CUSTOM_CHAR_CREDIT_COST} CR</strong>이 차감됩니다.
                  현재 보유: <strong className="text-indigo-400">{credits} CR</strong>
                </p>
              </div>
            </div>
          )}

          {/* ── Step 3: 생성 결과 ── */}
          {step === 3 && (
            <div className="p-6">
              {/* 에러 표시 */}
              {genError && (
                <div className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25">
                  <i className="ri-error-warning-line text-red-400 text-sm flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400">{genError}</p>
                </div>
              )}

              {isGenerating ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20" />
                    <div className="absolute inset-0 rounded-full border-2 border-t-indigo-500 animate-spin" />
                    <div className="absolute inset-2 rounded-full bg-indigo-500/10 flex items-center justify-center">
                      <i className="ri-sparkling-2-fill text-indigo-400 text-lg" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-white">fal.ai로 캐릭터 생성 중...</p>
                    <p className="text-xs text-zinc-500 mt-1">AI가 설정을 바탕으로 캐릭터를 만들고 있어요</p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {['외모 분석', '스타일 적용', '이미지 렌더링'].map((label, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900/60 border border-white/5">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                        <span className="text-[10px] text-zinc-500">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : generatedPreview ? (
                <div className="flex gap-5">
                  {/* 생성된 이미지 */}
                  <div className="w-[200px] flex-shrink-0">
                    <div className="w-full aspect-[3/4] rounded-2xl overflow-hidden border border-white/10 relative">
                      <img src={generatedPreview} alt="생성된 캐릭터" className="w-full h-full object-cover object-top" />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-500/90 text-white text-[9px] font-bold flex items-center gap-1">
                        <i className="ri-check-line" />생성 완료
                      </div>
                    </div>
                  </div>

                  {/* 설정 요약 + 이름 입력 */}
                  <div className="flex-1 flex flex-col gap-4">
                    <div>
                      <p className="text-xs font-bold text-zinc-300 mb-2">캐릭터 이름</p>
                      <input
                        type="text"
                        value={charName}
                        onChange={(e) => setCharName(e.target.value)}
                        placeholder={`예: ${selectedGenderLabel === '여자' ? '지아' : '준혁'}`}
                        maxLength={20}
                        className="w-full px-3 py-2.5 rounded-xl bg-zinc-900/60 border border-white/5 text-sm text-zinc-300 placeholder-zinc-600 outline-none focus:border-indigo-500/50 transition-colors"
                      />
                    </div>

                    <div>
                      <p className="text-xs font-bold text-zinc-300 mb-2">설정 요약</p>
                      <div className="space-y-1.5">
                        {[
                          { label: '성별/나이', value: `${selectedGenderLabel} · ${selectedAgeLabel}` },
                          { label: '얼굴 인상', value: selectedFaceLabel },
                          { label: '의상 스타일', value: selectedStyleLabel },
                          { label: '분위기', value: selectedMoodLabel },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center gap-2 text-xs">
                            <span className="text-zinc-600 w-20 flex-shrink-0">{item.label}</span>
                            <span className="text-zinc-300 font-medium">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handleRegenerate}
                      disabled={isGenerating || !canAfford(CUSTOM_CHAR_CREDIT_COST)}
                      className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${
                        canAfford(CUSTOM_CHAR_CREDIT_COST)
                          ? 'text-zinc-500 hover:text-indigo-400'
                          : 'text-zinc-700 cursor-not-allowed'
                      }`}
                    >
                      <i className="ri-refresh-line" />
                      다시 생성하기
                      <span className="text-[10px] text-zinc-600">({CUSTOM_CHAR_CREDIT_COST} CR)</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between flex-shrink-0 bg-zinc-950/30">
          <div className="flex items-center gap-2">
            {step > 0 && step < 3 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
              >
                <i className="ri-arrow-left-line" />이전
              </button>
            )}
            {step === 3 && !isGenerating && (
              <button
                onClick={() => { setStep(0); setGeneratedPreview(null); setGenError(null); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
              >
                <i className="ri-restart-line" />처음부터
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-2 rounded-xl text-zinc-500 hover:text-zinc-300 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap">
              취소
            </button>

            {step < 2 && (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed()}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  canProceed()
                    ? 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white'
                    : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                }`}
              >
                다음 <i className="ri-arrow-right-line" />
              </button>
            )}

            {step === 2 && (
              <button
                onClick={handleGenerate}
                disabled={!canProceed() || !canAfford(CUSTOM_CHAR_CREDIT_COST)}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  canProceed() && canAfford(CUSTOM_CHAR_CREDIT_COST)
                    ? 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white'
                    : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                }`}
              >
                <i className="ri-sparkling-2-fill" />캐릭터 생성하기
                <span className="text-[10px] opacity-70">({CUSTOM_CHAR_CREDIT_COST} CR)</span>
              </button>
            )}

            {step === 3 && !isGenerating && generatedPreview && (
              <button
                onClick={handleApply}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-sm font-bold transition-all cursor-pointer whitespace-nowrap"
              >
                <i className="ri-check-line" />이 캐릭터로 생성 시작
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
