import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppNavbar from '@/components/feature/AppNavbar';
import StepIndicator from './components/StepIndicator';
import Step1Settings from './components/Step1Settings';
import Step2Script from './components/Step2Script';
import Step3Voice from './components/Step3Voice';
import Step4Image from './components/Step4Image';
import Step5Video from './components/Step5Video';
import Step6LocalStyle from './components/Step6LocalStyle';
import { useProjectHandoff, ProjectHandoffData } from '@/hooks/useProjectHandoff';
import { GeneratedAudio } from './hooks/useVoiceRecorder';
import { useAutomationProjects } from '@/pages/ai-automation/hooks/useAutomationProjects';
import { AutomationProject } from '@/mocks/automationProjects';
import { automationProjects } from '@/mocks/automationProjects';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

// ── Voice data passed from Step3 → Step5 ──────────────────────────────────
export interface VoiceData {
  voiceName: string;
  voiceColor: string;
  cutAudios: Record<string, GeneratedAudio>; // cutId → audio
  fullBlobUrl?: string;
  fullDuration?: number;
  speed: number;
  scriptCuts?: Array<{ id: string; label: string; text: string }>;
}

// ── Project metadata for gallery save ─────────────────────────────────────
export interface ProjectMeta {
  keywords: string[];
  channelName: string;
  style: string | null;
  ratio: string;
}

const STEP_TITLES = [
  { label: '영상 설정', desc: '스타일과 비율을 선택하고 시작하세요.' },
  { label: '대본 작성', desc: 'AI가 생성한 대본을 확인하고 편집하세요.' },
  { label: '음성 생성', desc: '나레이션 음성을 선택하고 생성하세요.' },
  { label: '이미지 생성', desc: '각 씬에 맞는 이미지를 생성하세요.' },
  { label: '영상 생성', desc: '이미지와 음성을 합쳐 영상을 완성하세요.' },
  { label: '자막 스타일', desc: '자막 폰트와 스타일을 설정하세요.' },
];

// Style ID → label mapping
export const STYLE_LABEL_MAP: Record<string, string> = {
  cartoon_studio: '카툰 스튜디오',
  cartoon: '카툰 해설',
  sketch: '스케치 스타닥',
  mixed: '믹스미디어 콜라주',
  tonedown: '톤다운 믹스 콜라주',
  photo: '포토 스타일',
  film: '영화 스닥컷',
  news: '뉴스 스타일',
  anime: '일본 애니메이션',
  '3d_anime': '3D 애니메이션',
  webtoon: '웹툰 풀컷 일러스트',
  flat_illust: '플랫 일러스트',
  korean_wild: '한국 야담',
  korean_webtoon: '한국 웹툰',
  retro_pixel: '레트로 픽셀 아트',
  us_cartoon: '미국 카툰',
  claymation: '클레이 애니메이션',
  pen_sketch: '펜 스케치',
};

export default function YoutubeStudioPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedStyle, setSelectedStyle] = useState<string | null>('cartoon');
  const [selectedRatio, setSelectedRatio] = useState<string>('9:16');
  const [step1Keywords, setStep1Keywords] = useState<string[]>([]);
  const [step1ChannelName, setStep1ChannelName] = useState<string>('');

  // ── Step2 대본 데이터 ─────────────────────────────────────────────────────
  const [step2Script, setStep2Script] = useState<string>('');

  // ── Step3 → Step5 오디오 데이터 브릿지 ──────────────────────────────────
  const [voiceData, setVoiceData] = useState<VoiceData | null>(null);

  // ── Step3 scriptCuts → Step4 initialCuts 브릿지 ──────────────────────────
  const [step3Cuts, setStep3Cuts] = useState<Array<{ id: string; label: string; text: string }>>([]);

  // ── Step4 → Step5 이미지 데이터 브릿지 ──────────────────────────────────
  const [step4Images, setStep4Images] = useState<Array<{ id: number; image: string | null; prompt: string; start: number; end: number; text: string }>>([]);

  // ── Step5 → Step6 영상 컷 데이터 브릿지 ─────────────────────────────────
  const [step5Cuts, setStep5Cuts] = useState<Array<{ id: number; start: number; end: number; text: string; thumb: string; videoUrl?: string; hasVideo: boolean }>>([]);

  // 핸드오프 데이터 (갤러리에서 전달된 프로젝트)
  const [handoffData, setHandoffData] = useState<ProjectHandoffData | null>(null);
  const [showHandoffBanner, setShowHandoffBanner] = useState(false);

  const navigate = useNavigate();
  const { consumeHandoffData } = useProjectHandoff();
  const { profile } = useAuth();

  // ── Automation gallery hook (for saving) ──────────────────────────────────
  const { addProject } = useAutomationProjects(automationProjects, profile?.id ?? null);

  // ── SEO: 페이지 타이틀 & 메타 설정 ──────────────────────────────────
  useEffect(() => {
    document.title = 'YouTube Studio — AI 유튜브 영상 제작 | AiMetaWOW';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', '6단계 AI 워크플로우로 유튜브 영상을 완성하세요. 영상 설정 → 대본 작성 → 음성 생성 → 이미지 생성 → 영상 합성 → 자막 스타일까지 원스톱 제작.');
    }
    return () => {
      document.title = 'AiMetaWOW — AI 이미지·영상·음성 생성 크리에이티브 플랫폼';
    };
  }, []);

  // 마운트 시 핸드오프 데이터 읽기
  useEffect(() => {
    const data = consumeHandoffData();
    if (data) {
      setHandoffData(data);
      // Step1 초기값 세팅
      setSelectedRatio(data.ratio);
      // style 매핑 (갤러리 스타일명 → Step1 styleId)
      const styleMap: Record<string, string> = {
        '카툰 스튜디오': 'cartoon_studio',
        '카툰 해설': 'cartoon',
        '스케치 스타닥': 'sketch',
        '믹스미디어 콜라주': 'mixed',
        '톤다운 믹스 콜라주': 'tonedown',
        '포토 스타일': 'photo',
        '영화 스닥컷': 'film',
        '뉴스 스타일': 'news',
        '일본 애니메이션': 'anime',
        '3D 애니메이션': '3d_anime',
        '웹툰 풀컷 일러스트': 'webtoon',
        '플랫 일러스트': 'flat_illust',
        '한국 야담': 'korean_wild',
        '한국 웹툰': 'korean_webtoon',
        '레트로 픽셀 아트': 'retro_pixel',
        '미국 카툰': 'us_cartoon',
        '클레이 애니메이션': 'claymation',
        '펜 스케치': 'pen_sketch',
        // 갤러리 자동화 스타일명 매핑
        '미래도시': 'cartoon_studio',
        '자연풍경': 'photo',
        '미니멀': 'flat_illust',
        '드라마틱': 'film',
        '빈티지': 'tonedown',
        '애니메이션': 'anime',
      };
      const mappedStyle = styleMap[data.style] ?? 'cartoon';
      setSelectedStyle(mappedStyle);
      // 키워드 세팅
      setStep1Keywords(data.keywords);
      setStep1ChannelName(data.channelName ?? '');
      // resumeStep 적용 — 지정된 단계부터 시작
      if (data.resumeStep && data.resumeStep > 1) {
        setCurrentStep(data.resumeStep);
      }
      setShowHandoffBanner(true);
    }
  }, [consumeHandoffData]);

  const goNext = () => setCurrentStep((prev) => Math.min(prev + 1, 6));
  const goPrev = () => {
    if (currentStep === 1) {
      navigate('/automation-studio');
    } else {
      setCurrentStep((prev) => Math.max(prev - 1, 1));
    }
  };

  // ── Gallery save callback ─────────────────────────────────────────────────
  const handleSaveToGallery = (thumbnailUrl: string, title: string, duration: number): AutomationProject => {
    const styleLabel = selectedStyle ? (STYLE_LABEL_MAP[selectedStyle] ?? selectedStyle) : '카툰 해설';
    const newProject: AutomationProject = {
      id: `yt_studio_${Date.now()}`,
      title: title || (step1Keywords.length > 0 ? step1Keywords.join(' ') : 'YouTube Studio 영상'),
      topic: step1Keywords.join(', ') || title,
      status: 'completed',
      duration,
      ratio: selectedRatio,
      style: styleLabel,
      createdAt: new Date().toISOString(),
      thumbnail: thumbnailUrl,
      views: 0,
      likes: 0,
      model: 'YouTube Studio',
      mode: 'Manual',
      cuts: Math.floor(duration / 6) + 2,
    };
    addProject(newProject);

    // AI Create 갤러리에도 자동 저장 (source: youtube-studio)
    supabase.from('gallery_items').insert({
      type: 'video',
      url: thumbnailUrl,
      prompt: `YouTube Studio: ${title || step1Keywords.join(', ')} — ${styleLabel} 스타일`,
      model: 'YouTube Studio',
      ratio: selectedRatio,
      liked: false,
      duration: `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`,
      user_id: profile?.id ?? 'anonymous',
      source: 'youtube-studio',
    }).then(() => {/* 조용히 처리 */});

    return newProject;
  };

  const projectMeta: ProjectMeta = {
    keywords: step1Keywords,
    channelName: step1ChannelName,
    style: selectedStyle,
    ratio: selectedRatio,
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1: return (
        <Step1Settings
          onNext={(keywords?: string[], chName?: string) => {
            if (keywords) setStep1Keywords(keywords);
            if (chName) setStep1ChannelName(chName);
            goNext();
          }}
          onBack={goPrev}
          selectedStyle={selectedStyle}
          selectedRatio={selectedRatio}
          onStyleChange={setSelectedStyle}
          onRatioChange={setSelectedRatio}
          initialKeywords={step1Keywords}
        />
      );
      case 2: return (
        <Step2Script
          onNext={(script: string) => {
            setStep2Script(script);
            goNext();
          }}
          onBack={goPrev}
          selectedStyle={selectedStyle}
          selectedRatio={selectedRatio}
          keywords={step1Keywords}
          channelName={step1ChannelName}
          initialTitle={handoffData?.title}
          initialScript={handoffData?.scriptDraft}
        />
      );
      case 3: return (
        <Step3Voice
          onNext={goNext}
          onBack={goPrev}
          onVoiceGenerated={(data) => {
            setVoiceData(data);
            if (data.scriptCuts) setStep3Cuts(data.scriptCuts);
          }}
          initialVoiceData={voiceData}
          script={step2Script}
        />
      );
      case 4: {
        // Step3 scriptCuts → Step4 Cut 형식 변환
        // 각 컷에 균등 시간 배분 (전체 예상 시간 기준)
        const step4InitialCuts = step3Cuts.length > 0
          ? step3Cuts.map((c, i) => {
              const totalDur = voiceData?.fullDuration ?? step3Cuts.length * 6;
              const durPerCut = totalDur / step3Cuts.length;
              const start = parseFloat((i * durPerCut).toFixed(1));
              const end = parseFloat(((i + 1) * durPerCut).toFixed(1));
              return {
                id: i + 1,
                start,
                end,
                text: c.text,
                image: null as string | null,
                prompt: '',
                optimized: false,
              };
            })
          : undefined;

        return (
          <Step4Image
            onNext={(_images, cuts) => {
              if (cuts) {
                setStep4Images(cuts.map((c) => ({
                  id: c.id,
                  image: c.image,
                  prompt: c.prompt,
                  start: c.start,
                  end: c.end,
                  text: c.text,
                })));
              }
              goNext();
            }}
            onBack={goPrev}
            selectedStyle={selectedStyle}
            selectedRatio={selectedRatio}
            onGoToStep1={() => setCurrentStep(1)}
            onStyleChange={setSelectedStyle}
            selectedKeywords={step1Keywords}
            channelName={step1ChannelName}
            initialCuts={step4InitialCuts}
          />
        );
      }
      case 5: {
        // Step3 scriptCuts → Step5 VideoCut 형식 변환 (voiceData 타임스탬프 기반)
        const step5InitialCuts = step3Cuts.length > 0
          ? step3Cuts.map((c, i) => {
              const totalDur = voiceData?.fullDuration ?? step3Cuts.length * 6;
              const durPerCut = totalDur / step3Cuts.length;
              const start = parseFloat((i * durPerCut).toFixed(1));
              const end = parseFloat(((i + 1) * durPerCut).toFixed(1));
              // Step4 이미지가 있으면 thumb으로 사용
              const s4 = step4Images.find((img) => img.id === i + 1);
              return {
                id: i + 1,
                start,
                end,
                text: c.text,
                thumb: s4?.image ?? `https://readdy.ai/api/search-image?query=cinematic%20scene%20$%7BencodeURIComponent%28c.text.slice%280%2C%2050%29%29%7D&width=640&height=360&seq=s5cut${i + 1}&orientation=landscape`,
                thumbPrompt: c.text.slice(0, 40) + '...',
                videoPrompt: `Cinematic video: ${c.text.replace(/\n/g, ' ')}`,
                hasVideo: false,
              };
            })
          : undefined;

        return (
          <Step5Video
            onNext={(_hasVideo?: boolean, cuts?: unknown[]) => {
              if (cuts && cuts.length > 0) {
                // VideoCut 타입으로 캐스팅하여 저장
                setStep5Cuts(cuts as Array<{ id: number; start: number; end: number; text: string; thumb: string; videoUrl?: string; hasVideo: boolean }>);
              }
              goNext();
            }}
            onBack={goPrev}
            voiceData={voiceData}
            step4Images={step4Images}
            initialCuts={step5InitialCuts}
          />
        );
      }
      case 6: return (
        <Step6LocalStyle
          onBack={goPrev}
          projectMeta={projectMeta}
          onSaveToGallery={handleSaveToGallery}
          step4Images={step4Images}
          step5Cuts={step5Cuts}
          voiceData={voiceData}
          step2Script={step2Script}
        />
      );
      default: return null;
    }
  };

  const stepInfo = STEP_TITLES[currentStep - 1];

  return (
    <div className="h-screen bg-[#0d0d0f] text-white flex flex-col overflow-hidden">
      <AppNavbar />

      {/* ── 핸드오프 배너 (갤러리에서 프로젝트 불러왔을 때) ── */}
      {showHandoffBanner && handoffData && (
        <div className="flex-shrink-0 bg-indigo-500/10 border-b border-indigo-500/20 px-3 md:px-6 py-2 flex items-center gap-2 md:gap-3">
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg overflow-hidden flex-shrink-0 border border-indigo-500/30">
            <img src={handoffData.thumbnail} alt={handoffData.title} className="w-full h-full object-cover object-top" />
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 flex-1 min-w-0">
            <i className="ri-folder-video-line text-indigo-400 text-xs md:text-sm flex-shrink-0" />
            <span className="text-[10px] md:text-xs text-indigo-300 font-semibold whitespace-nowrap flex-shrink-0">불러옴:</span>
            <span className="text-[10px] md:text-xs text-white font-bold truncate">{handoffData.title}</span>
            {handoffData.resumeStep && handoffData.resumeStep > 1 && (
              <span className="text-[10px] text-indigo-400 bg-indigo-500/15 border border-indigo-500/20 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                Step {handoffData.resumeStep}부터 시작
              </span>
            )}
            <span className="hidden sm:flex text-[10px] text-indigo-400 bg-indigo-500/15 border border-indigo-500/20 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
              {handoffData.ratio} · {handoffData.duration}초 · {handoffData.style}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="hidden md:block text-[10px] text-zinc-500">설정이 자동으로 적용되었습니다</span>
            <button
              onClick={() => setShowHandoffBanner(false)}
              className="w-5 h-5 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors"
            >
              <i className="ri-close-line text-xs" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step Header ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-[#0f0f11] border-b border-white/5">
        <div className="flex items-center gap-2 px-3 md:px-6 pt-2 pb-1.5 md:pt-2.5 md:pb-2">
          <button
            onClick={() => navigate('/automation-studio')}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-200 text-xs font-medium cursor-pointer transition-colors whitespace-nowrap bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 px-2 md:px-3 py-1.5 rounded-lg flex-shrink-0"
          >
            <i className="ri-arrow-left-line text-xs" />
            <span className="hidden sm:inline">대시보드</span>
          </button>

          <div className="w-px h-4 bg-zinc-800 hidden sm:block flex-shrink-0" />

          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-6 h-6 bg-zinc-800 border border-white/8 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="ri-video-line text-zinc-400 text-xs" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm font-bold text-white leading-none truncate">{stepInfo.label}</p>
              <p className="hidden sm:block text-xs text-zinc-500 mt-0.5 truncate">{stepInfo.desc}</p>
            </div>
          </div>

          {currentStep > 1 && (
            <div className="hidden md:flex items-center gap-2 flex-shrink-0">
              {selectedStyle && (
                <div className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                  <i className="ri-palette-line text-indigo-400 text-[10px]" />
                  <span className="text-[10px] text-indigo-300 font-semibold whitespace-nowrap">
                    {STYLE_LABEL_MAP[selectedStyle] ?? selectedStyle}
                  </span>
                </div>
              )}
              {step1Keywords.length > 0 && (
                <div className="flex items-center gap-1">
                  <i className="ri-hashtag text-zinc-500 text-xs" />
                  <div className="flex gap-1 flex-wrap max-w-[200px]">
                    {step1Keywords.slice(0, 2).map((kw) => (
                      <span key={kw} className="text-xs text-zinc-300 bg-zinc-800 border border-white/8 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                        #{kw}
                      </span>
                    ))}
                    {step1Keywords.length > 2 && (
                      <span className="text-xs text-zinc-500">+{step1Keywords.length - 2}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 스텝 카운터 */}
          <div className="flex items-center gap-1 bg-zinc-800/60 border border-white/5 rounded-full px-2 md:px-3 py-1 flex-shrink-0">
            <span className="text-xs font-bold text-white">{currentStep}</span>
            <span className="text-xs text-zinc-600">/</span>
            <span className="text-xs text-zinc-500">6</span>
          </div>
        </div>

        {/* StepIndicator */}
        <div className="px-3 md:px-6 pb-1.5 md:pb-2">
          <StepIndicator
            currentStep={currentStep}
            onStepClick={(s) => s < currentStep && setCurrentStep(s)}
          />
        </div>

        {/* 진행 바 */}
        <div className="h-px bg-zinc-800 relative">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
            style={{ width: `${((currentStep - 1) / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* ── Step Content ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden pb-16 md:pb-0">
        {renderStep()}
      </div>
    </div>
  );
}
