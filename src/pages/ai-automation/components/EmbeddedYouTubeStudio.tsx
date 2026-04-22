import { useState, useEffect } from 'react';
import { AutomationProject } from '@/mocks/automationProjects';
import { useToast, ToastContainer } from '@/components/base/Toast';
import StepIndicator from '@/pages/youtube-studio/components/StepIndicator';
import Step1Settings from '@/pages/youtube-studio/components/Step1Settings';
import Step2Script from '@/pages/youtube-studio/components/Step2Script';
import Step3Voice from '@/pages/youtube-studio/components/Step3Voice';
import Step4Image from '@/pages/youtube-studio/components/Step4Image';
import Step5Video from '@/pages/youtube-studio/components/Step5Video';
import Step6LocalStyle from '@/pages/youtube-studio/components/Step6LocalStyle';
import { VoiceData, ProjectMeta, STYLE_LABEL_MAP } from '@/pages/youtube-studio/page';
import { Step4ImageData } from '@/pages/youtube-studio/components/Step4Image';
import { VideoCut } from '@/pages/youtube-studio/components/Step5Video';

const YT_STEP_TITLES = [
  { label: '영상 설정', desc: '스타일과 비율을 선택하고 시작하세요.' },
  { label: '대본 작성', desc: 'AI가 생성한 대본을 확인하고 편집하세요.' },
  { label: '음성 생성', desc: '나레이션 음성을 선택하고 생성하세요.' },
  { label: '이미지 생성', desc: '각 씬에 맞는 이미지를 생성하세요.' },
  { label: '영상 생성', desc: '이미지와 음성을 합쳐 영상을 완성하세요.' },
  { label: '자막 스타일', desc: '자막 폰트와 스타일을 설정하세요.' },
];

export interface EmbeddedYouTubeStudioProps {
  addProject: (project: AutomationProject) => void;
  initialProject?: AutomationProject | null;
  onBack?: () => void;
  resumeStep?: number;
  /** 사이드바에서 설정한 초기값 */
  sidebarStyle?: number | null;
  sidebarRatio?: string;
  sidebarVoiceId?: string;
}

export default function EmbeddedYouTubeStudio({ addProject, initialProject, onBack, resumeStep, sidebarStyle, sidebarRatio, sidebarVoiceId: _sidebarVoiceId }: EmbeddedYouTubeStudioProps) {
  // initialProject가 있으면 resumeStep 또는 Step2로 바로 시작
  const [currentStep, setCurrentStep] = useState(() => {
    if (!initialProject) return 1;
    if (resumeStep && resumeStep >= 1 && resumeStep <= 6) return resumeStep;
    return 2;
  });

  // initialProject가 변경될 때 currentStep + 모든 step 데이터 초기화 (다른 프로젝트 편집 시작 시)
  useEffect(() => {
    if (!initialProject) {
      setCurrentStep(1);
    } else if (resumeStep && resumeStep >= 1 && resumeStep <= 6) {
      setCurrentStep(resumeStep);
    } else {
      setCurrentStep(2);
    }
    // 이전 프로젝트 데이터가 새 프로젝트에 섞이지 않도록 전체 초기화
    setStep2Script('');
    setVoiceData(null);
    setStep4Images([]);
    setStep4Cuts(undefined);
    setStep5HasVideo(false);
    setStep5Cuts(undefined);
    // step1 데이터도 항상 초기화 (이전 프로젝트 키워드/채널명이 남지 않도록)
    setStep1Keywords([]);
    setStep1ChannelName('');
    if (!initialProject) {
      setSelectedStyle('cartoon');
      setSelectedRatio('9:16');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProject?.id]);
  // 사이드바 설정값을 초기값으로 사용 (스타일 ID → 스타일 키 매핑)
  const sidebarStyleKey = sidebarStyle
    ? (['cartoon_studio', 'photo', 'flat_illust', 'film', 'tonedown', 'anime'][sidebarStyle - 1] ?? 'cartoon')
    : 'cartoon';
  const [selectedStyle, setSelectedStyle] = useState<string | null>(sidebarStyleKey);
  const [selectedRatio, setSelectedRatio] = useState<string>(sidebarRatio ?? '9:16');
  const [step1Keywords, setStep1Keywords] = useState<string[]>([]);
  const [step1ChannelName, setStep1ChannelName] = useState<string>('');
  const [step2Script, setStep2Script] = useState<string>('');
  const [_selectedKeywords, _setSelectedKeywords] = useState<string[]>([]);
  const [channelName, _setChannelName] = useState<string>('');
  const [voiceData, setVoiceData] = useState<VoiceData | null>(null);
  const [step4Images, setStep4Images] = useState<string[]>([]);
  const [step4Cuts, setStep4Cuts] = useState<Step4ImageData[] | undefined>(undefined);
  const [step5HasVideo, setStep5HasVideo] = useState<boolean>(false);
  const [step5Cuts, setStep5Cuts] = useState<VideoCut[] | undefined>(undefined);

  // initialProject가 있으면 설정 자동 적용
  useEffect(() => {
    if (!initialProject) return;
    setSelectedRatio(initialProject.ratio ?? '9:16');
    const styleMap: Record<string, string> = {
      '카툰 스튜디오': 'cartoon_studio', '카툰 해설': 'cartoon', '스케치 스타닥': 'sketch',
      '믹스미디어 콜라주': 'mixed', '톤다운 믹스 콜라주': 'tonedown', '포토 스타일': 'photo',
      '영화 스닥컷': 'film', '뉴스 스타일': 'news', '일본 애니메이션': 'anime',
      '3D 애니메이션': '3d_anime', '웹툰 풀컷 일러스트': 'webtoon', '플랫 일러스트': 'flat_illust',
      '한국 야담': 'korean_wild', '한국 웹툰': 'korean_webtoon', '레트로 픽셀 아트': 'retro_pixel',
      '미국 카툰': 'us_cartoon', '클레이 애니메이션': 'claymation', '펜 스케치': 'pen_sketch',
      '미래도시': 'cartoon_studio', '자연풍경': 'photo', '미니멀': 'flat_illust',
      '드라마틱': 'film', '빈티지': 'tonedown', '애니메이션': 'anime',
    };
    const mappedStyle = styleMap[initialProject.style] ?? 'cartoon';
    setSelectedStyle(mappedStyle);
    if (initialProject.topic) {
      setStep1Keywords(initialProject.topic.split(/[,，\s]+/).filter(Boolean).slice(0, 5));
    }
  }, [initialProject]);

  const { toasts, showToast, removeToast } = useToast();

  const validateStep = (): boolean => {
    switch (currentStep) {
      case 1:
        return true;
      case 2:
        if (!step2Script.trim()) {
          showToast('대본을 먼저 생성하거나 직접 입력해주세요.', 'warning');
          return false;
        }
        return true;
      case 3:
        if (!voiceData) {
          showToast('음성을 먼저 생성하거나 녹음해주세요.', 'warning');
          return false;
        }
        return true;
      case 4:
        if (step4Images.length === 0) {
          showToast('이미지를 최소 1장 이상 생성해주세요.', 'warning');
          return false;
        }
        return true;
      case 5:
        if (!step5HasVideo) {
          showToast('영상을 최소 1개 이상 생성해주세요.', 'warning');
          return false;
        }
        return true;
      case 6:
        return true;
      default:
        return true;
    }
  };

  const goNext = () => {
    if (!validateStep()) return;
    setCurrentStep((prev) => Math.min(prev + 1, 6));
  };
  const goPrev = () => {
    if (currentStep === 1 && onBack) {
      onBack();
    } else {
      setCurrentStep((prev) => Math.max(prev - 1, 1));
    }
  };

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
    return newProject;
  };

  const projectMeta: ProjectMeta = {
    keywords: step1Keywords,
    channelName: step1ChannelName,
    style: selectedStyle,
    ratio: selectedRatio,
  };

  const _stepInfo = YT_STEP_TITLES[currentStep - 1];

  const renderStep = () => {
    switch (currentStep) {
      case 1: return (
        <Step1Settings
          onNext={(keywords?: string[], chName?: string) => {
            const kws = keywords ?? [];
            if (kws.length === 0) {
              showToast('키워드를 1개 이상 입력해주세요.', 'warning');
              return;
            }
            // 키워드가 변경되면 이전 대본 초기화 (새 키워드 기반으로 재생성 유도)
            const keywordsChanged = JSON.stringify(kws) !== JSON.stringify(step1Keywords);
            if (keywordsChanged) {
              setStep2Script('');
            }
            setStep1Keywords(kws);
            if (chName) setStep1ChannelName(chName);
            setCurrentStep((prev) => Math.min(prev + 1, 6));
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
          onNext={(script: string) => { setStep2Script(script); goNext(); }}
          onBack={goPrev}
          selectedStyle={selectedStyle}
          selectedRatio={selectedRatio}
          keywords={
            step1Keywords.length > 0
              ? step1Keywords
              : initialProject?.topic
                ? initialProject.topic.split(/[,，\s]+/).filter(Boolean).slice(0, 5)
                : []
          }
          channelName={step1ChannelName}
          initialScript={step2Script}
        />
      );
      case 3: return (
        <Step3Voice
          onNext={goNext}
          onBack={goPrev}
          onVoiceGenerated={(data) => setVoiceData(data)}
          initialVoiceData={voiceData}
          script={step2Script}
        />
      );
      case 4: return (
        <Step4Image
          onNext={(images, cuts) => {
            setStep4Images(images);
            if (cuts) {
              // Cut → Step4ImageData 변환
              const imageData: Step4ImageData[] = cuts.map((c) => ({
                id: c.id,
                image: c.image,
                prompt: c.prompt,
                start: c.start,
                end: c.end,
                text: c.text,
              }));
              setStep4Cuts(imageData);
            }
            goNext();
          }}
          onBack={goPrev}
          initialCuts={step4Cuts && step4Cuts.length > 0 ? step4Cuts.map((d) => ({
            id: d.id,
            start: d.start,
            end: d.end,
            text: d.text,
            image: d.image,
            prompt: d.prompt,
            optimized: false,
          })) : undefined}
          selectedStyle={selectedStyle}
          selectedRatio={selectedRatio}
          onGoToStep1={() => setCurrentStep(1)}
          onStyleChange={setSelectedStyle}
          selectedKeywords={step1Keywords}
          channelName={step1ChannelName || channelName}
        />
      );
      case 5: return (
        <Step5Video
          onNext={(hasVideo, cuts) => { setStep5HasVideo(hasVideo); if (cuts) setStep5Cuts(cuts); goNext(); }}
          onBack={goPrev}
          voiceData={voiceData}
          initialCuts={step5Cuts}
          step4Images={step4Cuts && step4Cuts.length > 0 ? step4Cuts : []}
        />
      );
      case 6: return (
        <Step6LocalStyle
          onBack={goPrev}
          projectMeta={projectMeta}
          onSaveToGallery={handleSaveToGallery}
          step4Images={step4Cuts ?? []}
          step5Cuts={step5Cuts ?? []}
          voiceData={voiceData}
          step2Script={step2Script}
        />
      );
      default: return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {/* Step Header — compact single bar */}
      <div className="flex-shrink-0 bg-[#0f0f11] border-b border-white/5">
        <div className="relative flex items-center px-3 md:px-5 py-1.5">
          {/* 이전 버튼 */}
          <button
            onClick={goPrev}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all cursor-pointer whitespace-nowrap flex-shrink-0"
          >
            <i className="ri-arrow-left-s-line text-sm" />
            <span className="text-[11px] font-medium hidden sm:inline">이전</span>
          </button>

          {/* StepIndicator — 절대 중앙 */}
          <div className="absolute left-1/2 -translate-x-1/2 w-full max-w-3xl px-2">
            <StepIndicator
              currentStep={currentStep}
              onStepClick={(s) => s < currentStep && setCurrentStep(s)}
            />
          </div>

          {/* 다음 / 완료 버튼 */}
          {currentStep === 6 ? (
            <div className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg border border-zinc-700/40 text-zinc-500 text-[11px] font-medium hidden sm:flex whitespace-nowrap flex-shrink-0">
              <i className="ri-information-line text-sm" />
              <span>아래 버튼으로 저장</span>
            </div>
          ) : (
            <button
              onClick={goNext}
              className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg border border-indigo-500/40 text-indigo-400 hover:text-indigo-300 hover:border-indigo-500/60 hover:bg-indigo-500/10 transition-all cursor-pointer whitespace-nowrap flex-shrink-0"
            >
              <span className="text-[11px] font-medium hidden sm:inline">다음</span>
              <i className="ri-arrow-right-s-line text-sm" />
            </button>
          )}



          {/* Editing project badge */}
          {initialProject && (
            <div className="hidden sm:flex items-center gap-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-2 py-0.5 flex-shrink-0">
              <img src={initialProject.thumbnail} alt="" className="w-3 h-2.5 rounded object-cover" />
              <span className="text-[10px] text-indigo-300 font-semibold truncate max-w-[80px]">{initialProject.title}</span>
            </div>
          )}

          {/* Step counter */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <span className="text-xs font-black text-white">{currentStep}</span>
            <span className="text-[10px] text-zinc-600">/6</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-zinc-800/60 relative">
          <div
            className="h-full bg-gradient-to-r from-red-500 to-rose-500 transition-all duration-500"
            style={{ width: `${((currentStep - 1) / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-hidden">
        {renderStep()}
      </div>
    </div>
  );
}
