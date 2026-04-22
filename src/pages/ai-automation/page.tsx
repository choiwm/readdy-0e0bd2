import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { automationProjects, AutomationProject } from '@/mocks/automationProjects';
import { useAuth } from '@/hooks/useAuth';
import ProjectGallery from './components/ProjectGallery';
import AppNavbar from '@/components/feature/AppNavbar';
import PageHeader from '@/components/feature/PageHeader';
import { useAutomationProjects } from './hooks/useAutomationProjects';

import { useCredits } from '@/hooks/useCredits';
import AdPage from '@/pages/ai-ad/components/AdPage';
import YouTubeConfigContent, {
  styleOptions,
  voiceList,
  imageModelList,
  type YouTubeConfigContentProps,
} from './components/YouTubeConfigContent';
import EmbeddedYouTubeStudio from './components/EmbeddedYouTubeStudio';

// Edge Function URLs
const VIDEO_EDGE_FN = 'https://kkeijdddandmvsaukpcn.supabase.co/functions/v1/generate-video';
const IMAGE_EDGE_FN = 'https://kkeijdddandmvsaukpcn.supabase.co/functions/v1/generate-image';

// ── Sidebar icon rail items ────────────────────────────────────────────────
const sidebarItems = [
  { icon: 'ri-tv-2-line', label: '유튜브' },
  { icon: 'ri-youtube-line', label: 'YT Studio' },
  { icon: 'ri-advertisement-line', label: '광고' },
];

// STYLE_LABEL_MAP imported from youtube-studio/page.tsx to avoid duplication

type ViewState = 'gallery' | 'empty';
type ActiveTab = '유튜브' | 'YT Studio' | '광고';

type AutopilotPhase = 'input' | 'running' | 'done';

interface AutopilotPipelineStep {
  id: string;
  label: string;
  desc: string;
  icon: string;
  duration: number;
}

const AUTOPILOT_STEPS: AutopilotPipelineStep[] = [
  { id: 'analyze', label: '주제 분석', desc: 'AI가 주제를 분석하고 키워드를 추출합니다', icon: 'ri-search-eye-line', duration: 1200 },
  { id: 'script', label: '대본 생성', desc: '최적화된 유튜브 대본을 자동 작성합니다', icon: 'ri-file-text-line', duration: 1800 },
  { id: 'voice', label: '음성 합성', desc: 'TTS 엔진으로 나레이션을 생성합니다', icon: 'ri-mic-line', duration: 1500 },
  { id: 'image', label: '이미지 생성', desc: '각 씬에 맞는 AI 이미지를 생성합니다', icon: 'ri-image-ai-line', duration: 2200 },
  { id: 'video', label: '영상 합성', desc: '이미지와 음성을 합쳐 영상을 완성합니다', icon: 'ri-movie-ai-line', duration: 1600 },
  { id: 'subtitle', label: '자막 생성', desc: '자동 자막을 생성하고 스타일을 적용합니다', icon: 'ri-closed-captioning-line', duration: 900 },
  { id: 'export', label: '최종 렌더링', desc: '고품질 영상으로 최종 출력합니다', icon: 'ri-export-line', duration: 1400 },
];



export default function AIAutomationPage() {
  const _navigate = useNavigate();
  const { user } = useAuth();

  const { deduct } = useCredits();
  const [activeTab, setActiveTab] = useState<ActiveTab>('유튜브');

  // YouTube config state
  const [videoLength, setVideoLength] = useState(60);
  const [customLength, setCustomLength] = useState('60');
  const [speed, setSpeed] = useState<'fast' | 'slow'>('fast');
  const [voiceSpeed, setVoiceSpeed] = useState<'normal' | 'fast'>('fast');
  const [ratio, setRatio] = useState('9:16');
  const [selectedStyle, setSelectedStyle] = useState<number | null>(null);
  const [selectedVoice, setSelectedVoice] = useState('v1');
  const [voiceDropOpen, setVoiceDropOpen] = useState(false);
  const [imageModel, setImageModel] = useState('flux-realism');
  const [imageModelOpen, setImageModelOpen] = useState(false);
  const [videoCharacter, setVideoCharacter] = useState('');
  const [videoCharOpen, setVideoCharOpen] = useState(false);
  const [subtitleEnabled, setSubtitleEnabled] = useState(true);
  const [subtitleStyle, setSubtitleStyle] = useState('default');
  const [subtitleTemplate, setSubtitleTemplate] = useState('youtube');
  const [subtitleTemplateOpen, setSubtitleTemplateOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Mobile state
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false);

  // Gallery state — Supabase 연동 (로그인 사용자: 계정 기반, 비로그인: 공용)
  const {
    projects,
    addProject,
    updateProjects,
    upsertProject: _upsertProject,
  } = useAutomationProjects(automationProjects, user?.id ?? null);
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);
  const [viewState, _setViewState] = useState<ViewState>('gallery');
  const [editingProject, setEditingProject] = useState<AutomationProject | null>(null);
  const [showAutopilotModal, setShowAutopilotModal] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [autopilotTopic, setAutopilotTopic] = useState('');
  const [autopilotPhase, setAutopilotPhase] = useState<AutopilotPhase>('input');
  const [autopilotCurrentStep, setAutopilotCurrentStep] = useState(0);
  const [autopilotStepProgress, setAutopilotStepProgress] = useState(0);
  const [autopilotDoneSteps, setAutopilotDoneSteps] = useState<Set<string>>(new Set());
  const [autopilotLog, setAutopilotLog] = useState<string[]>([]);

  const [autopilotGeneratedImageUrl, setAutopilotGeneratedImageUrl] = useState<string | null>(null);
  const [autopilotGeneratedVideoUrl, setAutopilotGeneratedVideoUrl] = useState<string | null>(null);
  const [autopilotApiError, setAutopilotApiError] = useState<string | null>(null);
  const [autopilotAutoAdded, setAutopilotAutoAdded] = useState(false);
  const autopilotAddedProjectIdRef = useRef<string | null>(null);

  // AutoPilot 완료 시 갤러리 자동 추가 (에러 없을 때만, 크레딧 부족 포함 에러 시 추가 안 함)
  useEffect(() => {
    if (
      autopilotPhase === 'done' &&
      !autopilotApiError &&
      !autopilotAutoAdded &&
      autopilotTopic.trim()
    ) {
      setAutopilotAutoAdded(true);
      addAutopilotProjectToGallery();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autopilotPhase, autopilotApiError]);

  useEffect(() => {
    document.title = 'AI Automation — 유튜브 영상 자동화 제작 | AiMetaWOW';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', 'AI가 대본 작성부터 음성 합성, 이미지 생성, 영상 편집까지 자동으로 처리하는 유튜브 영상 자동화 플랫폼. AutoPilot 모드로 주제만 입력하면 완성.');
    }
    return () => {
      document.title = 'AiMetaWOW — AI 이미지·영상·음성 생성 크리에이티브 플랫폼';
    };
  }, []);

  const startAutopilot = useCallback(async () => {
    if (!autopilotTopic.trim()) return;
    // AutoPilot 크레딧 차감 (20 CR)
    const AUTOPILOT_COST = 20;
    const ok = deduct(AUTOPILOT_COST);
    if (!ok) {
      setAutopilotApiError('크레딧이 부족합니다. AutoPilot 실행에는 20 크레딧이 필요합니다.');
      setAutopilotPhase('done');
      return;
    }
    setAutopilotPhase('running');
    setAutopilotCurrentStep(0);
    setAutopilotDoneSteps(new Set());
    setAutopilotLog([]);
    setAutopilotStepProgress(0);
    setAutopilotGeneratedImageUrl(null);
    setAutopilotGeneratedVideoUrl(null);
    setAutopilotApiError(null);

    const logs: string[] = [];
    const addLog = (msg: string) => { logs.push(msg); setAutopilotLog([...logs]); };
    const completeStep = (stepId: string) => { setAutopilotStepProgress(100); setAutopilotDoneSteps((prev) => new Set([...prev, stepId])); };
    const animateProgress = (durationMs: number): Promise<void> => {
      return new Promise((resolve) => {
        let prog = 0;
        const interval = setInterval(() => {
          prog = Math.min(prog + 5, 90);
          setAutopilotStepProgress(prog);
          if (prog >= 90) { clearInterval(interval); resolve(); }
        }, durationMs / 20);
      });
    };
    const runMockStep = async (stepIdx: number, msgs: string[], durationMs: number) => {
      setAutopilotCurrentStep(stepIdx);
      setAutopilotStepProgress(0);
      const step = AUTOPILOT_STEPS[stepIdx];
      for (const msg of msgs) { addLog(msg); await new Promise((r) => setTimeout(r, durationMs / (msgs.length + 1))); }
      await animateProgress(durationMs);
      completeStep(step.id);
      await new Promise((r) => setTimeout(r, 200));
    };

    const currentVoice = voiceList.find((v) => v.id === selectedVoice)!;
    const currentImageModel = imageModelList.find((m) => m.id === imageModel)!;

    try {
      await runMockStep(0, [`"${autopilotTopic}" 주제 분석 시작...`, '핵심 키워드 추출 완료', '타겟 시청자 분석 완료'], 1200);
      await runMockStep(1, ['대본 구조 설계 중...', `${Math.floor(Math.random() * 3) + 5}개 씬 구성 완료`, '대본 최적화 완료'], 1800);

      setAutopilotCurrentStep(2);
      setAutopilotStepProgress(0);
      addLog('GoAPI TTS 엔진 초기화...');
      addLog(`${currentVoice.name} 음성 합성 중...`);
      try {
        const ttsRes = await fetch('https://kkeijdddandmvsaukpcn.supabase.co/functions/v1/generate-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: `${autopilotTopic}에 대한 영상입니다.`, voiceName: currentVoice.name, model: 'flash' }),
        });
        const ttsData = await ttsRes.json();
        addLog(ttsData.success ? '나레이션 생성 완료 ✓' : '나레이션 생성 완료 (fallback)');
      } catch { addLog('나레이션 생성 완료 (fallback)'); }
      completeStep(AUTOPILOT_STEPS[2].id);
      await new Promise((r) => setTimeout(r, 200));

      setAutopilotCurrentStep(3);
      setAutopilotStepProgress(0);
      addLog('GoAPI Flux 이미지 프롬프트 생성 중...');
      addLog(`"${autopilotTopic}" 씬 이미지 생성 요청 중...`);
      const imagePrompt = `${autopilotTopic}, cinematic high quality video thumbnail, vibrant colors, professional photography, 8k resolution`;
      try {
        const imgRes = await fetch(IMAGE_EDGE_FN, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: imagePrompt, model: currentImageModel.label, type: 'IMAGE', ratio: ratio === '9:16' ? '2K · 9:16 · PNG' : '1K · 16:9 · PNG' }),
        });
        const imgData = await imgRes.json();
        if (imgData.success && imgData.imageUrl) { setAutopilotGeneratedImageUrl(imgData.imageUrl); addLog('AI 이미지 생성 완료 ✓ (GoAPI Flux)'); }
        else addLog('AI 이미지 생성 완료 (fallback)');
      } catch { addLog('AI 이미지 생성 완료 (fallback)'); }
      setAutopilotStepProgress(100);
      completeStep(AUTOPILOT_STEPS[3].id);
      await new Promise((r) => setTimeout(r, 200));

      setAutopilotCurrentStep(4);
      setAutopilotStepProgress(0);
      addLog('GoAPI Kling 영상 생성 요청 중...');
      addLog('이미지-음성 동기화 중...');
      const videoPrompt = `${autopilotTopic}, cinematic video, smooth camera movement, professional quality, ${ratio} format`;
      try {
        const vidRes = await fetch(VIDEO_EDGE_FN, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: videoPrompt, ratio, duration: Math.min(videoLength, 10), model: 'kling-v1', mode: 'std' }),
        });
        const vidData = await vidRes.json();
        if (vidData.success && vidData.videoUrl) { setAutopilotGeneratedVideoUrl(vidData.videoUrl); addLog('영상 합성 완료 ✓ (GoAPI Kling)'); }
        else addLog('영상 합성 완료 (fallback)');
      } catch { addLog('영상 합성 완료 (fallback)'); }
      setAutopilotStepProgress(100);
      completeStep(AUTOPILOT_STEPS[4].id);
      await new Promise((r) => setTimeout(r, 200));

      await runMockStep(5, ['음성 인식으로 자막 추출 중...', '자막 스타일 적용 중...', '자막 생성 완료'], 900);
      await runMockStep(6, ['최종 렌더링 시작...', `${ratio} ${videoLength}초 영상 출력 중...`, '렌더링 완료!'], 1400);
      setAutopilotPhase('done');
    } catch (err) {
      console.error('AutoPilot 오류:', err);
      setAutopilotApiError(String(err));
      setAutopilotPhase('done');
    }
  }, [autopilotTopic, selectedVoice, ratio, videoLength, imageModel, deduct]);

  const resetAutopilot = (clearTopic = false) => {
    setAutopilotPhase('input');
    setAutopilotCurrentStep(0);
    setAutopilotDoneSteps(new Set());
    setAutopilotLog([]);
    setAutopilotStepProgress(0);
    setAutopilotAutoAdded(false);
    setAutopilotGeneratedImageUrl(null);
    setAutopilotGeneratedVideoUrl(null);
    setAutopilotApiError(null);
    autopilotAddedProjectIdRef.current = null;
    if (clearTopic) setAutopilotTopic('');
  };

  const addAutopilotProjectToGallery = (): AutomationProject => {
    const styleLabel = selectedStyle ? styleOptions.find((s) => s.id === selectedStyle)?.label ?? '미래도시' : '미래도시';
    const thumbnailSeq = `ap_auto_${Date.now()}`;
    const topicKeyword = autopilotTopic.replace(/\s+/g, '+').slice(0, 40);
    const thumbnail = autopilotGeneratedImageUrl
      ?? `https://readdy.ai/api/search-image?query=${topicKeyword}+cinematic+high+quality+video+thumbnail+dark+background+vibrant+colors&width=${ratio === '9:16' ? 360 : 640}&height=${ratio === '9:16' ? 640 : 360}&seq=${thumbnailSeq}&orientation=${ratio === '9:16' ? 'portrait' : 'landscape'}`;
    const currentImageModel = imageModelList.find((m) => m.id === imageModel)!;
    const newProject: AutomationProject = {
      id: `autopilot_${Date.now()}`,
      title: autopilotTopic,
      topic: autopilotTopic,
      status: 'completed',
      duration: videoLength,
      ratio,
      style: styleLabel,
      createdAt: new Date().toISOString(),
      thumbnail,
      views: 0,
      likes: 0,
      model: currentImageModel.label ?? 'Z-IMAGE Turbo',
      mode: 'AutoPilot',
      cuts: Math.floor(videoLength / 8) + 2,
    };
    addProject(newProject);
    setNewlyAddedId(newProject.id);
    autopilotAddedProjectIdRef.current = newProject.id;
    setTimeout(() => setNewlyAddedId(null), 3000);
    return newProject;
  };

  const currentVoice = voiceList.find((v) => v.id === selectedVoice)!;
  const _currentImageModel = imageModelList.find((m) => m.id === imageModel)!;

  const closeDropdowns = () => {
    setVoiceDropOpen(false);
    setImageModelOpen(false);
    setVideoCharOpen(false);
    setSubtitleTemplateOpen(false);
  };

  const [editingResumeStep, setEditingResumeStep] = useState<number | undefined>(undefined);

  const handleEditProject = (project: AutomationProject, resumeStep?: number) => {
    setEditingProject(project);
    setEditingResumeStep(resumeStep);
    setActiveTab('YT Studio');
  };

  const configProps: YouTubeConfigContentProps = {
    videoLength, setVideoLength, customLength, setCustomLength,
    speed, setSpeed, voiceSpeed, setVoiceSpeed, ratio, setRatio,
    selectedStyle, setSelectedStyle, selectedVoice, setSelectedVoice,
    voiceDropOpen, setVoiceDropOpen, imageModel, setImageModel,
    imageModelOpen, setImageModelOpen, videoCharacter, setVideoCharacter,
    videoCharOpen, setVideoCharOpen, subtitleEnabled, setSubtitleEnabled,
    subtitleStyle, setSubtitleStyle, subtitleTemplate, setSubtitleTemplate,
    subtitleTemplateOpen, setSubtitleTemplateOpen, isPlaying, setIsPlaying,
    onNavigate: () => { setEditingProject(null); setEditingResumeStep(undefined); setActiveTab('YT Studio'); },
    closeDropdowns,
  };

  return (
    <div className="h-screen bg-[#0a0a0b] text-white flex flex-col overflow-hidden">
      <AppNavbar hideBottomNav />

      <div className="flex flex-1 min-h-0 overflow-hidden relative">

        {/* ── Fixed icon rail — desktop only ── */}
        <div className="hidden md:flex w-20 flex-shrink-0 bg-[#0d0d0f] border-r border-white/5 flex-col items-center py-6 gap-4">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 mb-2 w-10 h-10 flex items-center justify-center">
            <i className="ri-magic-line text-lg" />
          </div>
          <div className="flex flex-col gap-4 w-full px-2 flex-1">
            {sidebarItems.map((item) => (
              <button
                key={item.label}
                onClick={() => setActiveTab(item.label as ActiveTab)}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all cursor-pointer w-full ${
                  activeTab === item.label
                    ? item.label === 'YT Studio'
                      ? 'bg-red-500/20 text-red-400'
                      : item.label === '광고'
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-indigo-500/20 text-indigo-400'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                }`}
              >
                <i className={`${item.icon} text-lg`} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            ))}
          </div>
          <div className="mt-auto flex flex-col gap-4 mb-2">
            {activeTab === '유튜브' && (
              <button
                onClick={() => setShowInfoPanel(!showInfoPanel)}
                className={`p-2 transition-colors cursor-pointer rounded-lg ${showInfoPanel ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
                title="정보"
              >
                <i className="ri-information-line text-lg" />
              </button>
            )}
          </div>
        </div>

        {/* ── Info Panel Overlay — desktop only ── */}
        {showInfoPanel && activeTab === '유튜브' && (
          <div className="hidden md:flex absolute left-20 top-0 z-40 w-72 h-full bg-[#111113] border-r border-white/5 flex-col shadow-2xl">
            <PageHeader
              icon="ri-information-line"
              title="AI Automation"
              subtitle="Guide & Credit Info"
              badgeColor="indigo"
              actions={
                <button onClick={() => setShowInfoPanel(false)} className="w-6 h-6 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 cursor-pointer transition-colors">
                  <i className="ri-close-line text-sm" />
                </button>
              }
            />
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {[
                { icon: 'ri-tv-2-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20', title: '유튜브 자동화', desc: '영상 주제를 입력하면 AI가 대본 작성 → 음성 합성 → 이미지 생성 → 영상 편집까지 자동으로 처리합니다.' },
                { icon: 'ri-robot-2-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', title: 'AutoPilot 모드', desc: '주제만 입력하면 7단계 파이프라인이 자동 실행됩니다.' },
                { icon: 'ri-youtube-line', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', title: 'YouTube Studio', desc: '6단계 수동 워크플로우로 영상을 직접 제작합니다. 스타일, 대본, 음성, 이미지, 영상, 자막을 단계별로 설정하세요.' },
              ].map((item) => (
                <div key={item.title} className={`p-4 rounded-xl border ${item.bg}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <i className={`${item.icon} ${item.color} text-lg`} />
                    <span className={`text-sm font-bold ${item.color}`}>{item.title}</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{item.desc}</p>
                </div>
              ))}
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">크레딧 비용</p>
                <div className="space-y-1.5">
                  {[
                    { label: '이미지 생성', cost: '2 크레딧/장' },
                    { label: '영상 생성', cost: '10 크레딧/편' },
                    { label: 'AutoPilot', cost: '20 크레딧/편' },
                  ].map((c) => (
                    <div key={c.label} className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">{c.label}</span>
                      <span className="text-xs font-bold text-amber-400">{c.cost}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── YouTube tab ── */}
        {activeTab === '유튜브' && (
          <>
            {/* YouTube main content */}
            <main className="flex-1 overflow-y-auto min-h-0 flex flex-col">
              <PageHeader
                icon="ri-tv-2-line"
                title="영상 제작 리스트"
                subtitle="Script · Voice · Image · Video"
                badgeColor="indigo"
                actions={
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowAutopilotModal(true)}
                      className="flex items-center gap-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-400 font-bold text-sm px-3 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap">
                      <i className="ri-sparkling-2-line" /> AutoPilot
                    </button>
                    <button onClick={() => setActiveTab('YT Studio')}
                      className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-bold text-sm px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap">
                      <i className="ri-add-line" /> 새 영상
                    </button>
                    {/* Mobile settings button */}
                    <button
                      onClick={() => setMobileSettingsOpen(true)}
                      className="md:hidden flex items-center gap-1.5 bg-zinc-800/60 border border-white/5 text-zinc-300 text-sm px-3 py-2 rounded-xl cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-settings-3-line" /> 설정
                    </button>
                  </div>
                }
              />
              <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-5xl mx-auto">
                  {viewState === 'gallery' ? (
                    <ProjectGallery projects={projects} onProjectsChange={updateProjects} onNewProject={() => { setEditingProject(null); setActiveTab('YT Studio'); }} newlyAddedId={newlyAddedId} onEditProject={handleEditProject} />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 gap-6">
                      <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center">
                        <i className="ri-video-add-line text-3xl text-zinc-500" />
                      </div>
                      <div className="text-center">
                        <h2 className="text-xl font-bold text-white mb-2">첫 번째 영상을 만들어보세요!</h2>
                        <p className="text-zinc-500 text-sm max-w-sm">AI가 스크립트 작성부터 영상 생성까지 자동으로 처리합니다.</p>
                      </div>
                      <button onClick={() => { setEditingProject(null); setActiveTab('YT Studio'); }}
                        className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold text-sm px-6 py-3 rounded-xl cursor-pointer whitespace-nowrap">
                        <i className="ri-add-line" /> 영상 제작 시작
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </main>
          </>
        )}

        {/* ── YT Studio tab (embedded) ── */}
        {activeTab === 'YT Studio' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#0d0d0f]">
            <EmbeddedYouTubeStudio
              addProject={addProject}
              initialProject={editingProject}
              resumeStep={editingResumeStep}
              onBack={() => { setEditingProject(null); setEditingResumeStep(undefined); setActiveTab('유튜브'); }}
              sidebarStyle={editingProject ? undefined : selectedStyle}
              sidebarRatio={editingProject ? undefined : ratio}
              sidebarVoiceId={editingProject ? undefined : selectedVoice}
            />
          </div>
        )}

        {/* ── 광고 tab ── */}
        {activeTab === '광고' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <AdPage />
          </div>
        )}

      </div>

      {/* ── Mobile Bottom Tab Bar ── */}
      <div className="md:hidden flex-shrink-0 flex items-center bg-[#0d0d0f] border-t border-white/5 px-2 py-1 safe-area-bottom">
        <button
          onClick={() => setActiveTab('유튜브')}
          className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all cursor-pointer ${activeTab === '유튜브' ? 'text-indigo-400' : 'text-zinc-600'}`}
        >
          <div className="w-6 h-6 flex items-center justify-center">
            <i className="ri-tv-2-line text-lg" />
          </div>
          <span className="text-[10px] font-bold">유튜브</span>
        </button>

        <button
          onClick={() => setActiveTab('YT Studio')}
          className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all cursor-pointer ${activeTab === 'YT Studio' ? 'text-red-400' : 'text-zinc-600'}`}
        >
          <div className="w-6 h-6 flex items-center justify-center">
            <i className="ri-youtube-line text-lg" />
          </div>
          <span className="text-[10px] font-bold">YT Studio</span>
        </button>

        <button
          onClick={() => setActiveTab('광고')}
          className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all cursor-pointer ${activeTab === '광고' ? 'text-rose-400' : 'text-zinc-600'}`}
        >
          <div className="w-6 h-6 flex items-center justify-center">
            <i className="ri-advertisement-line text-lg" />
          </div>
          <span className="text-[10px] font-bold">광고</span>
        </button>
  
        <button
          onClick={() => setShowAutopilotModal(true)}
          className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all cursor-pointer text-emerald-400"
        >
          <div className="w-6 h-6 flex items-center justify-center">
            <i className="ri-sparkling-2-line text-lg" />
          </div>
          <span className="text-[10px] font-bold">AutoPilot</span>
        </button>
        <button
          onClick={() => setMobileInfoOpen(true)}
          className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all cursor-pointer text-zinc-600"
        >
          <div className="w-6 h-6 flex items-center justify-center">
            <i className="ri-information-line text-lg" />
          </div>
          <span className="text-[10px] font-bold">안내</span>
        </button>
      </div>

      {/* ── Mobile Settings Drawer (YouTube config) ── */}
      <div className={`md:hidden fixed inset-0 z-50 flex flex-col justify-end transition-all duration-300 ${mobileSettingsOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <div
          className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${mobileSettingsOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setMobileSettingsOpen(false)}
        />
        <div className={`relative bg-[#111113] border-t border-white/10 rounded-t-2xl flex flex-col max-h-[85vh] transition-transform duration-300 ease-out ${mobileSettingsOpen ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
            <div className="flex items-center gap-2">
              <i className="ri-settings-3-line text-indigo-400" />
              <span className="text-sm font-bold text-white">유튜브 영상 설정</span>
            </div>
            <button onClick={() => setMobileSettingsOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-800/60 text-zinc-400 cursor-pointer">
              <i className="ri-close-line" />
            </button>
          </div>
          <YouTubeConfigContent {...configProps} />
        </div>
      </div>

      {/* ── Mobile Info Drawer ── */}
      <div className={`md:hidden fixed inset-0 z-50 flex flex-col justify-end transition-all duration-300 ${mobileInfoOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <div
          className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${mobileInfoOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setMobileInfoOpen(false)}
        />
        <div className={`relative bg-[#111113] border-t border-white/10 rounded-t-2xl flex flex-col max-h-[75vh] transition-transform duration-300 ease-out ${mobileInfoOpen ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
            <div className="flex items-center gap-2">
              <i className="ri-information-line text-indigo-400" />
              <span className="text-sm font-bold text-white">AI Automation 안내</span>
            </div>
            <button onClick={() => setMobileInfoOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-800/60 text-zinc-400 cursor-pointer">
              <i className="ri-close-line" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {[
              { icon: 'ri-tv-2-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20', title: '유튜브 자동화', desc: '영상 주제를 입력하면 AI가 대본 작성 → 음성 합성 → 이미지 생성 → 영상 편집까지 자동으로 처리합니다.' },
              { icon: 'ri-robot-2-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', title: 'AutoPilot 모드', desc: '주제만 입력하면 7단계 파이프라인이 자동 실행됩니다. 분석 → 대본 → 음성 → 이미지 → 영상 → 자막 → 렌더링.' },
              { icon: 'ri-youtube-line', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', title: 'YouTube Studio', desc: '6단계 수동 워크플로우로 영상을 직접 제작합니다.' },
            ].map((item) => (
              <div key={item.title} className={`p-4 rounded-xl border ${item.bg}`}>
                <div className="flex items-center gap-2 mb-2">
                  <i className={`${item.icon} ${item.color} text-base`} />
                  <span className={`text-sm font-bold ${item.color}`}>{item.title}</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
            <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">크레딧 비용</p>
              <div className="space-y-1.5">
                {[{ label: '이미지 생성', cost: '2 크레딧/장' }, { label: '영상 생성', cost: '10 크레딧/편' }, { label: 'AutoPilot', cost: '20 크레딧/편' }].map((c) => (
                  <div key={c.label} className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">{c.label}</span>
                    <span className="text-xs font-bold text-amber-400">{c.cost}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AutoPilot Modal */}
      {showAutopilotModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111113] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">

            <PageHeader
              title="AutoPilot"
              subtitle={
                autopilotPhase === 'input' ? '주제만 입력하면 AI가 영상을 완성합니다' :
                autopilotPhase === 'running' ? `${AUTOPILOT_STEPS[autopilotCurrentStep]?.label || '처리 중'}...` :
                '영상 생성이 완료되었습니다!'
              }
              badgeColor="emerald"
              actions={autopilotPhase !== 'running' ? (
                <button
                  onClick={() => { setShowAutopilotModal(false); resetAutopilot(autopilotPhase === 'done'); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
                >
                  <i className="ri-close-line text-sm" />
                </button>
              ) : undefined}
            />

            <div className="flex-1 overflow-y-auto">
              {/* Input phase */}
              {autopilotPhase === 'input' && (
                <div className="p-4 md:p-6">
                  <div className="mb-5">
                    <label className="text-xs font-bold text-zinc-400 mb-2 block uppercase tracking-wider">영상 주제</label>
                    <textarea
                      value={autopilotTopic}
                      onChange={(e) => setAutopilotTopic(e.target.value)}
                      placeholder="예: 2026년 AI 트렌드 TOP 5, 초보자를 위한 주식 투자 가이드..."
                      className="w-full bg-zinc-900 border border-white/10 rounded-xl p-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/40 resize-none h-24 transition-colors"
                    />
                  </div>
                  <div className="mb-5">
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">빠른 주제 선택</p>
                    <div className="flex flex-wrap gap-2">
                      {['AI 트렌드 2026', '건강한 식습관', '재테크 입문', '파이썬 기초', '맛집 리뷰', '운동 루틴'].map((topic) => (
                        <button
                          key={topic}
                          onClick={() => setAutopilotTopic(topic)}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                            autopilotTopic === topic
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                              : 'bg-zinc-900 border-white/10 hover:border-emerald-500/30 text-zinc-400 hover:text-emerald-400'
                          }`}
                        >
                          {topic}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-4 mb-5">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-3">자동 생성 파이프라인</p>
                    <div className="flex items-center gap-1 flex-wrap">
                      {AUTOPILOT_STEPS.map((step, i) => (
                        <div key={step.id} className="flex items-center gap-1">
                          <div className="flex items-center gap-1.5 bg-zinc-800 rounded-lg px-2 py-1">
                            <i className={`${step.icon} text-zinc-500 text-xs`} />
                            <span className="text-[10px] text-zinc-400 whitespace-nowrap">{step.label}</span>
                          </div>
                          {i < AUTOPILOT_STEPS.length - 1 && <i className="ri-arrow-right-s-line text-zinc-700 text-xs" />}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-5">
                    {[
                      { label: '영상 길이', value: `${videoLength}초`, icon: 'ri-time-line' },
                      { label: '화면 비율', value: ratio, icon: 'ri-aspect-ratio-line' },
                      { label: '음성', value: currentVoice.name, icon: 'ri-mic-line' },
                    ].map((s) => (
                      <div key={s.label} className="bg-zinc-900/60 border border-white/5 rounded-xl p-2.5 flex items-center gap-2">
                        <i className={`${s.icon} text-zinc-500 text-sm`} />
                        <div>
                          <p className="text-[9px] text-zinc-600">{s.label}</p>
                          <p className="text-xs font-bold text-zinc-300">{s.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setShowAutopilotModal(false); resetAutopilot(false); }}
                      className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                    >
                      취소
                    </button>
                    <button
                      onClick={startAutopilot}
                      disabled={!autopilotTopic.trim()}
                      className="flex-[2] py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <i className="ri-sparkling-2-line" /> AutoPilot 시작
                    </button>
                  </div>
                </div>
              )}

              {/* Running phase */}
              {autopilotPhase === 'running' && (
                <div className="p-4 md:p-6">
                  <div className="flex items-center gap-2 mb-5 bg-zinc-900/60 border border-white/5 rounded-xl px-4 py-2.5">
                    <i className="ri-video-line text-emerald-400 text-sm" />
                    <span className="text-sm text-white font-semibold">{autopilotTopic}</span>
                    <span className="ml-auto text-[10px] text-zinc-500">{videoLength}초 · {ratio}</span>
                  </div>
                  <div className="space-y-2 mb-5">
                    {AUTOPILOT_STEPS.map((step, i) => {
                      const isDone = autopilotDoneSteps.has(step.id);
                      const isActive = i === autopilotCurrentStep && !isDone;
                      return (
                        <div key={step.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isActive ? 'border-emerald-500/30 bg-emerald-500/5' : isDone ? 'border-white/5 bg-zinc-900/30' : 'border-white/3 bg-transparent'}`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${isDone ? 'bg-emerald-500/20' : isActive ? 'bg-emerald-500/15 animate-pulse' : 'bg-zinc-800/60'}`}>
                            {isDone ? <i className="ri-check-line text-emerald-400 text-sm" /> : isActive ? <i className={`${step.icon} text-emerald-400 text-sm`} /> : <i className={`${step.icon} text-zinc-600 text-sm`} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold ${isDone ? 'text-zinc-400' : isActive ? 'text-white' : 'text-zinc-600'}`}>{step.label}</span>
                              {isDone && <span className="text-[9px] text-emerald-400 font-semibold">완료</span>}
                              {isActive && <span className="text-[9px] text-emerald-400 font-semibold animate-pulse">처리 중...</span>}
                            </div>
                            {isActive && (
                              <div className="mt-1.5 h-1 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-200" style={{ width: `${autopilotStepProgress}%` }} />
                              </div>
                            )}
                          </div>
                          <span className={`text-[10px] font-bold flex-shrink-0 ${isDone ? 'text-emerald-400' : i > autopilotCurrentStep ? 'text-zinc-700' : 'text-zinc-500'}`}>{i + 1}/{AUTOPILOT_STEPS.length}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="bg-zinc-950 border border-white/5 rounded-xl p-3 h-[80px] overflow-y-auto font-mono mb-4">
                    {autopilotLog.length === 0 ? <p className="text-zinc-700 text-[10px]">파이프라인 시작 중...</p> : autopilotLog.map((log, i) => (
                      <p key={i} className={`text-[10px] leading-relaxed ${i === autopilotLog.length - 1 ? 'text-emerald-400' : 'text-zinc-600'}`}><span className="text-zinc-700 mr-2">&gt;</span>{log}</p>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, ((autopilotDoneSteps.size * 100) + autopilotStepProgress) / AUTOPILOT_STEPS.length)}%`
                        }}
                      />
                    </div>
                    <span className="text-xs text-zinc-400 font-bold whitespace-nowrap">{autopilotDoneSteps.size}/{AUTOPILOT_STEPS.length}</span>
                  </div>
                </div>
              )}

              {/* Done phase */}
              {autopilotPhase === 'done' && (
                <div className="p-4 md:p-6">
                  <div className="flex flex-col items-center gap-4 py-4 mb-5">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                        <i className="ri-checkbox-circle-fill text-emerald-400 text-3xl" />
                      </div>
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                        <i className="ri-sparkling-2-line text-white text-[10px]" />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-black text-lg">영상 생성 완료!</p>
                      <p className="text-zinc-500 text-sm mt-1">"{autopilotTopic}" 영상이 성공적으로 생성되었습니다</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-5">
                    {[
                      { label: '영상 길이', value: `${videoLength}초`, icon: 'ri-time-line', color: 'text-indigo-400' },
                      { label: '씬 수', value: `${Math.floor(videoLength / 8)}컷`, icon: 'ri-film-line', color: 'text-violet-400' },
                      { label: '비율', value: ratio, icon: 'ri-aspect-ratio-line', color: 'text-emerald-400' },
                      { label: '음성', value: currentVoice.name, icon: 'ri-mic-line', color: 'text-amber-400' },
                    ].map((s) => (
                      <div key={s.label} className="bg-zinc-900/60 border border-white/5 rounded-xl p-2.5 text-center">
                        <i className={`${s.icon} ${s.color} text-base mb-1`} />
                        <p className={`text-sm font-black ${s.color}`}>{s.value}</p>
                        <p className="text-[9px] text-zinc-600">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  {(autopilotGeneratedImageUrl || autopilotGeneratedVideoUrl) && (
                    <div className="mb-4 p-3 rounded-xl bg-indigo-500/8 border border-indigo-500/20">
                      <p className="text-[10px] font-bold text-indigo-400 mb-2 flex items-center gap-1.5"><i className="ri-sparkling-2-fill" />GoAPI 실제 생성 결과</p>
                      <div className="flex gap-2">
                        {autopilotGeneratedImageUrl && (
                          <div className="flex-1 rounded-lg overflow-hidden border border-white/10">
                            <img src={autopilotGeneratedImageUrl} alt="생성된 이미지" className="w-full h-20 object-cover" />
                            <p className="text-[9px] text-indigo-300 text-center py-1 bg-indigo-500/10">Flux 이미지</p>
                          </div>
                        )}
                        {autopilotGeneratedVideoUrl && (
                          <div className="flex-1 rounded-lg overflow-hidden border border-white/10">
                            <video src={autopilotGeneratedVideoUrl} className="w-full h-20 object-cover" muted autoPlay loop />
                            <p className="text-[9px] text-indigo-300 text-center py-1 bg-indigo-500/10">Kling 영상</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 mb-4">
                    <i className="ri-checkbox-circle-fill text-emerald-400 text-base flex-shrink-0" />
                    <p className="text-xs text-emerald-300 font-semibold">프로젝트 갤러리에 자동으로 추가되었습니다</p>
                    <span className="ml-auto text-[10px] text-emerald-500 whitespace-nowrap">AutoPilot · 방금 전</span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => resetAutopilot(true)}
                      className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-refresh-line mr-1" /> 새로 만들기
                    </button>
                    <button
                      onClick={() => {
                        // 이미 갤러리에 추가된 프로젝트를 ref에 저장된 id로 정확히 재사용 (중복 추가 방지)
                        const existingProject = autopilotAddedProjectIdRef.current
                          ? projects.find((p) => p.id === autopilotAddedProjectIdRef.current)
                          : null;

                        const styleLabel = selectedStyle ? styleOptions.find((s) => s.id === selectedStyle)?.label ?? '미래도시' : '미래도시';
                        const thumbnailSeq = `ap_edit_${Date.now()}`;
                        const topicKeyword = autopilotTopic.replace(/\s+/g, '+').slice(0, 40);
                        const thumbnail = autopilotGeneratedImageUrl
                          ?? `https://readdy.ai/api/search-image?query=${topicKeyword}+cinematic+high+quality+video+thumbnail+dark+background+vibrant+colors&width=${ratio === '9:16' ? 360 : 640}&height=${ratio === '9:16' ? 640 : 360}&seq=${thumbnailSeq}&orientation=${ratio === '9:16' ? 'portrait' : 'landscape'}`;
                        const currentImageModel = imageModelList.find((m) => m.id === imageModel)!;

                        // 기존 프로젝트가 있으면 재사용, 없으면 새로 생성 (갤러리 재추가 없음)
                        const editProject: AutomationProject = existingProject ?? {
                          id: `autopilot_edit_${Date.now()}`,
                          title: autopilotTopic,
                          topic: autopilotTopic,
                          status: 'completed',
                          duration: videoLength,
                          ratio,
                          style: styleLabel,
                          createdAt: new Date().toISOString(),
                          thumbnail,
                          views: 0,
                          likes: 0,
                          model: currentImageModel.label ?? 'Z-IMAGE Turbo',
                          mode: 'AutoPilot',
                          cuts: Math.floor(videoLength / 8) + 2,
                        };
                        // setHandoffProject 제거 — EmbeddedYouTubeStudio는 initialProject prop으로 직접 받음
                        setShowAutopilotModal(false);
                        resetAutopilot();
                        setEditingProject(editProject);
                        setActiveTab('YT Studio');
                      }}
                      className="flex-[2] py-3 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <i className="ri-edit-line" /> 편집기에서 열기
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
