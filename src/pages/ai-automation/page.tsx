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
import AutopilotModal, { AUTOPILOT_STEPS } from './components/AutopilotModal';

import { SUPABASE_URL } from '@/lib/env';

// Edge Function URLs — env var 기반으로 조립해야 환경 분기 (staging/prod) 가
// 단일 빌드에서 동작해요. 이전 하드코딩은 organization URL 이 바뀌면 침묵
// 실패함.
const VIDEO_EDGE_FN = `${SUPABASE_URL}/functions/v1/generate-video`;
const IMAGE_EDGE_FN = `${SUPABASE_URL}/functions/v1/generate-image`;

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
        const ttsRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-tts`, {
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
      <AutopilotModal
        open={showAutopilotModal}
        phase={autopilotPhase}
        topic={autopilotTopic}
        setTopic={setAutopilotTopic}
        currentStepIdx={autopilotCurrentStep}
        stepProgress={autopilotStepProgress}
        doneSteps={autopilotDoneSteps}
        logLines={autopilotLog}
        generatedImageUrl={autopilotGeneratedImageUrl}
        generatedVideoUrl={autopilotGeneratedVideoUrl}
        videoLength={videoLength}
        ratio={ratio}
        currentVoiceName={currentVoice.name}
        addedProjectIdRef={autopilotAddedProjectIdRef}
        onCloseAndReset={(finished) => { setShowAutopilotModal(false); resetAutopilot(finished); }}
        onCancel={() => { setShowAutopilotModal(false); resetAutopilot(false); }}
        onStart={startAutopilot}
        onReset={resetAutopilot}
        onOpenInEditor={() => {
          const existingProject = autopilotAddedProjectIdRef.current
            ? projects.find((p) => p.id === autopilotAddedProjectIdRef.current)
            : null;
          const styleLabel = selectedStyle ? styleOptions.find((s) => s.id === selectedStyle)?.label ?? '미래도시' : '미래도시';
          const thumbnailSeq = `ap_edit_${Date.now()}`;
          const topicKeyword = autopilotTopic.replace(/\s+/g, '+').slice(0, 40);
          const thumbnail = autopilotGeneratedImageUrl
            ?? `https://readdy.ai/api/search-image?query=${topicKeyword}+cinematic+high+quality+video+thumbnail+dark+background+vibrant+colors&width=${ratio === '9:16' ? 360 : 640}&height=${ratio === '9:16' ? 640 : 360}&seq=${thumbnailSeq}&orientation=${ratio === '9:16' ? 'portrait' : 'landscape'}`;
          const currentImageModel = imageModelList.find((m) => m.id === imageModel)!;
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
          setShowAutopilotModal(false);
          resetAutopilot();
          setEditingProject(editProject);
          setActiveTab('YT Studio');
        }}
      />
    </div>
  );
}
