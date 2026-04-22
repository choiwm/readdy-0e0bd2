import { useState } from 'react';
import { Link } from 'react-router-dom';
import AppNavbar from '@/components/feature/AppNavbar';

// ── 워크플로우 단계 정의 ──────────────────────────────────────────────────
interface WorkflowStep {
  id: string;
  phase: 'create' | 'edit' | 'deploy';
  stepNum: number;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
  textColor: string;
  route?: string;
  tools: { name: string; icon: string; desc: string }[];
  outputs: string[];
  tips: string[];
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 'concept',
    phase: 'create',
    stepNum: 1,
    title: '기획 & 아이디어',
    subtitle: 'Concept & Ideation',
    icon: 'ri-lightbulb-flash-line',
    color: '#f59e0b',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
    textColor: 'text-amber-400',
    tools: [
      { name: 'AI Shortcuts', icon: 'ri-flashlight-line', desc: 'ChatGPT, Perplexity로 주제 리서치' },
      { name: 'AI Automation', icon: 'ri-magic-line', desc: '트렌드 분석 & 콘텐츠 방향 설정' },
    ],
    outputs: ['콘텐츠 주제', '타겟 키워드', '영상 방향성', '참고 레퍼런스'],
    tips: ['트렌딩 키워드를 먼저 조사하세요', '경쟁 채널 분석으로 차별점을 찾으세요'],
  },
  {
    id: 'storyboard',
    phase: 'create',
    stepNum: 2,
    title: '스토리보드 제작',
    subtitle: 'Storyboard & Visual Planning',
    icon: 'ri-layout-grid-line',
    color: '#6366f1',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/25',
    textColor: 'text-indigo-400',
    route: '/ai-board',
    tools: [
      { name: 'AI Board', icon: 'ri-layout-grid-line', desc: 'AI 씬 자동 생성 & 컷 구성' },
      { name: 'AI Create', icon: 'ri-sparkling-2-line', desc: '캐릭터 & 배경 이미지 생성' },
    ],
    outputs: ['씬별 이미지 컷', '샷 타입 구성', '캐릭터 레퍼런스', '배경 레퍼런스'],
    tips: ['캐릭터 레퍼런스를 먼저 설정하면 일관성이 높아집니다', 'AI 씬 추가로 시나리오를 자동 분할하세요'],
  },
  {
    id: 'image-video',
    phase: 'create',
    stepNum: 3,
    title: 'AI 이미지 & 영상 생성',
    subtitle: 'AI Image & Video Generation',
    icon: 'ri-sparkling-2-line',
    color: '#8b5cf6',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/25',
    textColor: 'text-violet-400',
    route: '/ai-create',
    tools: [
      { name: 'AI Create', icon: 'ri-sparkling-2-line', desc: 'Flux / Kling으로 고품질 이미지·영상' },
      { name: 'ANGLE', icon: 'ri-camera-3-line', desc: '카메라 앵글 & 구도 설정' },
      { name: 'LOOK', icon: 'ri-palette-line', desc: '색감 & 무드 스타일 적용' },
    ],
    outputs: ['AI 생성 이미지', 'AI 생성 영상 클립', '스타일 일관성 확보', '갤러리 저장'],
    tips: ['Character 탭으로 캐릭터 일관성을 유지하세요', 'LOOK 프리셋으로 전체 색감을 통일하세요'],
  },
  {
    id: 'script',
    phase: 'create',
    stepNum: 4,
    title: '대본 & 자막 작성',
    subtitle: 'Script & Subtitle Writing',
    icon: 'ri-file-text-line',
    color: '#10b981',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
    textColor: 'text-emerald-400',
    route: '/youtube-studio',
    tools: [
      { name: 'YouTube Studio', icon: 'ri-youtube-line', desc: 'Step 2 — AI 대본 자동 생성' },
      { name: 'AI Shortcuts', icon: 'ri-flashlight-line', desc: 'ChatGPT로 대본 다듬기' },
    ],
    outputs: ['완성된 대본', '씬별 자막', 'SEO 최적화 제목', '해시태그 목록'],
    tips: ['키워드를 자연스럽게 대본에 녹여내세요', '시청자 훅(Hook)을 첫 5초에 배치하세요'],
  },
  {
    id: 'voice',
    phase: 'edit',
    stepNum: 5,
    title: 'AI 음성 & 사운드',
    subtitle: 'Voice & Sound Design',
    icon: 'ri-equalizer-line',
    color: '#f59e0b',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
    textColor: 'text-amber-400',
    route: '/ai-sound',
    tools: [
      { name: 'AI Sound — TTS', icon: 'ri-mic-line', desc: '대본을 자연스러운 AI 음성으로 변환' },
      { name: 'AI Sound — Music', icon: 'ri-music-2-line', desc: 'BGM & 효과음 생성' },
      { name: 'AI Sound — Clean', icon: 'ri-equalizer-line', desc: '노이즈 제거 & 음질 향상' },
    ],
    outputs: ['AI 나레이션 음성', 'BGM 트랙', '효과음 파일', '정제된 오디오'],
    tips: ['목소리 톤을 콘텐츠 분위기에 맞게 선택하세요', 'BGM 볼륨은 나레이션의 20~30% 수준이 적당합니다'],
  },
  {
    id: 'video-edit',
    phase: 'edit',
    stepNum: 6,
    title: '영상 편집 & 합성',
    subtitle: 'Video Editing & Compositing',
    icon: 'ri-video-line',
    color: '#ec4899',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/25',
    textColor: 'text-pink-400',
    route: '/youtube-studio',
    tools: [
      { name: 'YouTube Studio', icon: 'ri-youtube-line', desc: 'Step 3~6 — 영상 자동 편집 & 합성' },
      { name: 'AI Shortcuts', icon: 'ri-flashlight-line', desc: 'Runway, CapCut으로 고급 편집' },
    ],
    outputs: ['완성된 영상 파일', '자막 합성본', '썸네일 이미지', '인트로/아웃트로'],
    tips: ['자막 폰트와 색상을 채널 브랜딩에 맞추세요', '썸네일은 CTR에 직결되므로 신중하게 제작하세요'],
  },
  {
    id: 'export',
    phase: 'deploy',
    stepNum: 7,
    title: '내보내기 & 최적화',
    subtitle: 'Export & Optimization',
    icon: 'ri-archive-drawer-line',
    color: '#06b6d4',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/25',
    textColor: 'text-cyan-400',
    route: '/automation-studio',
    tools: [
      { name: 'AI Automation', icon: 'ri-magic-line', desc: '프로젝트 일괄 내보내기 (ZIP)' },
      { name: 'AI Board', icon: 'ri-layout-grid-line', desc: '스토리보드 PDF/이미지 내보내기' },
    ],
    outputs: ['MP4 영상 파일', '썸네일 JPG', '자막 SRT 파일', '메타데이터 JSON'],
    tips: ['유튜브 권장 해상도: 1920×1080 (16:9)', '파일명에 키워드를 포함하면 SEO에 유리합니다'],
  },
  {
    id: 'publish',
    phase: 'deploy',
    stepNum: 8,
    title: '업로드 & 배포',
    subtitle: 'Upload & Publishing',
    icon: 'ri-upload-cloud-line',
    color: '#10b981',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
    textColor: 'text-emerald-400',
    tools: [
      { name: 'YouTube Studio', icon: 'ri-youtube-line', desc: '유튜브 업로드 & 메타데이터 설정' },
      { name: 'AI Shortcuts', icon: 'ri-flashlight-line', desc: 'SNS 자동 배포 도구 연동' },
    ],
    outputs: ['유튜브 업로드 완료', 'SNS 공유', '예약 발행 설정', '커뮤니티 포스트'],
    tips: ['업로드 후 48시간이 알고리즘 노출의 골든타임입니다', '댓글 초기 응답이 참여율을 높입니다'],
  },
  {
    id: 'analyze',
    phase: 'deploy',
    stepNum: 9,
    title: '성과 분석 & 반복',
    subtitle: 'Analytics & Iteration',
    icon: 'ri-bar-chart-line',
    color: '#6366f1',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/25',
    textColor: 'text-indigo-400',
    route: '/automation-studio',
    tools: [
      { name: 'AI Automation', icon: 'ri-magic-line', desc: '프로젝트 성과 리포트 (조회수/좋아요)' },
      { name: 'AI Shortcuts', icon: 'ri-flashlight-line', desc: 'YouTube Analytics 연동 분석' },
    ],
    outputs: ['조회수 & CTR 분석', '시청 유지율 데이터', '개선 포인트 도출', '다음 콘텐츠 기획'],
    tips: ['CTR 5% 이상이면 썸네일이 효과적입니다', '시청 유지율 50% 이상을 목표로 하세요'],
  },
];

const PHASES = [
  { id: 'create', label: '생성', icon: 'ri-sparkling-2-line', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/25', desc: 'Content Creation' },
  { id: 'edit', label: '편집', icon: 'ri-scissors-line', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25', desc: 'Editing & Production' },
  { id: 'deploy', label: '배포', icon: 'ri-rocket-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', desc: 'Deploy & Grow' },
];

// ── 빠른 시작 시나리오 ────────────────────────────────────────────────────
const QUICK_STARTS = [
  {
    title: '유튜브 쇼츠 제작',
    desc: '9:16 세로형 숏폼 콘텐츠를 30분 안에 완성',
    icon: 'ri-smartphone-line',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    steps: [2, 3, 5, 6, 7, 8],
    time: '30~60분',
    difficulty: '쉬움',
  },
  {
    title: '정보성 유튜브 영상',
    desc: '5~15분 분량의 교육/정보 콘텐츠 풀 파이프라인',
    icon: 'ri-youtube-line',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    steps: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    time: '2~4시간',
    difficulty: '보통',
  },
  {
    title: 'AI 자동화 채널',
    desc: 'AutoPilot으로 영상 기획부터 배포까지 자동화',
    icon: 'ri-robot-line',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
    steps: [1, 4, 5, 7, 8, 9],
    time: '15~30분',
    difficulty: '자동화',
  },
  {
    title: '광고 & 프로모션',
    desc: '브랜드 광고 영상 제작 — 스토리보드 중심',
    icon: 'ri-advertisement-line',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    steps: [1, 2, 3, 5, 6, 7],
    time: '1~2시간',
    difficulty: '보통',
  },
];

export default function WorkflowPage() {
  const [activePhase, setActivePhase] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [activeScenario, setActiveScenario] = useState<number | null>(null);

  const filteredSteps = activePhase
    ? WORKFLOW_STEPS.filter(s => s.phase === activePhase)
    : WORKFLOW_STEPS;

  const highlightedStepNums = activeScenario !== null
    ? new Set(QUICK_STARTS[activeScenario].steps)
    : null;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col">
      <AppNavbar />

      <main className="flex-1 overflow-y-auto">

        {/* ── Hero ── */}
        <div className="relative overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-violet-500/5 pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-indigo-500/8 rounded-full blur-3xl pointer-events-none" />
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-10 md:py-16 relative">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-500/15 border border-indigo-500/25">
                <i className="ri-route-line text-indigo-400 text-sm" />
              </div>
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Content Workflow</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white mb-4 leading-tight">
              콘텐츠 전주기<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">워크플로우 가이드</span>
            </h1>
            <p className="text-zinc-400 text-base md:text-lg max-w-2xl leading-relaxed mb-8">
              기획부터 배포까지 — AiMetaWOW의 모든 도구를 연결해 콘텐츠 제작 파이프라인을 완성하세요.
              각 단계별 최적 도구와 팁을 확인하고 나만의 워크플로우를 구성하세요.
            </p>

            {/* Phase 필터 */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setActivePhase(null)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all cursor-pointer whitespace-nowrap ${
                  activePhase === null
                    ? 'bg-white/10 border-white/20 text-white'
                    : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:text-white hover:border-white/15'
                }`}
              >
                <i className="ri-apps-line" /> 전체 보기
                <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full">{WORKFLOW_STEPS.length}단계</span>
              </button>
              {PHASES.map(phase => (
                <button
                  key={phase.id}
                  onClick={() => setActivePhase(activePhase === phase.id ? null : phase.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all cursor-pointer whitespace-nowrap ${
                    activePhase === phase.id
                      ? `${phase.bg} ${phase.border} ${phase.color}`
                      : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:text-white hover:border-white/15'
                  }`}
                >
                  <i className={phase.icon} />
                  {phase.label}
                  <span className="text-[10px] opacity-70 px-1.5 py-0.5 rounded-full bg-white/10">
                    {WORKFLOW_STEPS.filter(s => s.phase === phase.id).length}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-12 md:space-y-16 pb-24 md:pb-12">

          {/* ── 빠른 시작 시나리오 ── */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/25">
                <i className="ri-rocket-line text-emerald-400 text-sm" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">빠른 시작 시나리오</h2>
                <p className="text-xs text-zinc-500">목적에 맞는 워크플로우를 선택하면 해당 단계가 강조됩니다</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {QUICK_STARTS.map((scenario, idx) => (
                <button
                  key={scenario.title}
                  onClick={() => setActiveScenario(activeScenario === idx ? null : idx)}
                  className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                    activeScenario === idx
                      ? `${scenario.bg} ${scenario.border}`
                      : 'bg-zinc-900/60 border-white/5 hover:border-white/15'
                  }`}
                >
                  <div className={`w-9 h-9 flex items-center justify-center rounded-xl mb-3 ${scenario.bg} border ${scenario.border}`}>
                    <i className={`${scenario.icon} ${scenario.color} text-base`} />
                  </div>
                  <p className={`text-sm font-black mb-1 ${activeScenario === idx ? scenario.color : 'text-white'}`}>
                    {scenario.title}
                  </p>
                  <p className="text-[11px] text-zinc-500 leading-relaxed mb-3">{scenario.desc}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] bg-zinc-800/60 text-zinc-400 px-2 py-0.5 rounded-full font-bold">
                      <i className="ri-time-line mr-1" />{scenario.time}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${scenario.bg} ${scenario.color}`}>
                      {scenario.difficulty}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                    {scenario.steps.map(n => (
                      <span key={n} className={`text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center ${
                        activeScenario === idx ? `${scenario.bg} ${scenario.color}` : 'bg-zinc-800 text-zinc-500'
                      }`}>{n}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* ── 전체 파이프라인 흐름도 ── */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-500/15 border border-indigo-500/25">
                <i className="ri-git-branch-line text-indigo-400 text-sm" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">전체 파이프라인</h2>
                <p className="text-xs text-zinc-500">각 단계를 클릭하면 상세 정보를 확인할 수 있습니다</p>
              </div>
            </div>

            {/* Phase 구분 헤더 */}
            {!activePhase && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                {PHASES.map(phase => (
                  <div key={phase.id} className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${phase.bg} ${phase.border}`}>
                    <i className={`${phase.icon} ${phase.color} text-base`} />
                    <div>
                      <p className={`text-sm font-black ${phase.color}`}>{phase.label}</p>
                      <p className="text-[10px] text-zinc-500">{phase.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 단계 목록 */}
            <div className="space-y-3">
              {filteredSteps.map((step, idx) => {
                const isExpanded = expandedStep === step.id;
                const isHighlighted = highlightedStepNums ? highlightedStepNums.has(step.stepNum) : true;
                const isDimmed = highlightedStepNums ? !highlightedStepNums.has(step.stepNum) : false;

                return (
                  <div key={step.id} className="relative">
                    {/* 연결선 */}
                    {idx < filteredSteps.length - 1 && (
                      <div className="absolute left-[27px] top-full w-0.5 h-3 bg-gradient-to-b from-white/10 to-transparent z-10" />
                    )}

                    <div
                      className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                        isDimmed
                          ? 'opacity-30 border-white/5 bg-zinc-900/30'
                          : isExpanded
                            ? `${step.bg} ${step.border}`
                            : isHighlighted && highlightedStepNums
                              ? `${step.bg} ${step.border}`
                              : 'bg-zinc-900/60 border-white/5 hover:border-white/15'
                      }`}
                    >
                      {/* 헤더 */}
                      <button
                        onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                        className="w-full flex items-center gap-4 p-4 cursor-pointer text-left"
                      >
                        {/* Step number + icon */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className={`w-9 h-9 flex items-center justify-center rounded-xl border ${step.bg} ${step.border} flex-shrink-0`}>
                            <i className={`${step.icon} ${step.textColor} text-base`} />
                          </div>
                          <div className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black ${step.bg} ${step.textColor} flex-shrink-0`}>
                            {step.stepNum}
                          </div>
                        </div>

                        {/* Title */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black text-white">{step.title}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${step.bg} ${step.textColor}`}>
                              {PHASES.find(p => p.id === step.phase)?.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-0.5">{step.subtitle}</p>
                        </div>

                        {/* Tools preview */}
                        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                          {step.tools.slice(0, 2).map(tool => (
                            <div key={tool.name} className="flex items-center gap-1 bg-zinc-800/60 border border-white/5 px-2 py-1 rounded-lg">
                              <i className={`${tool.icon} text-zinc-400 text-[10px]`} />
                              <span className="text-[10px] text-zinc-400 font-bold whitespace-nowrap">{tool.name}</span>
                            </div>
                          ))}
                        </div>

                        {/* Route button */}
                        {step.route && (
                          <Link
                            to={step.route}
                            onClick={e => e.stopPropagation()}
                            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${step.bg} ${step.border} ${step.textColor} hover:opacity-80`}
                          >
                            <i className="ri-arrow-right-up-line text-xs" /> 바로가기
                          </Link>
                        )}

                        <i className={`ri-arrow-down-s-line text-zinc-500 text-lg transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>

                      {/* 확장 패널 */}
                      {isExpanded && (
                        <div className="px-4 pb-5 border-t border-white/5 pt-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                            {/* 사용 도구 */}
                            <div>
                              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">사용 도구</p>
                              <div className="space-y-2">
                                {step.tools.map(tool => (
                                  <div key={tool.name} className="flex items-start gap-2.5 bg-zinc-900/60 border border-white/5 rounded-xl p-3">
                                    <div className={`w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 ${step.bg}`}>
                                      <i className={`${tool.icon} ${step.textColor} text-sm`} />
                                    </div>
                                    <div>
                                      <p className="text-xs font-bold text-white">{tool.name}</p>
                                      <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{tool.desc}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* 산출물 */}
                            <div>
                              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">산출물 (Output)</p>
                              <div className="space-y-1.5">
                                {step.outputs.map(output => (
                                  <div key={output} className="flex items-center gap-2 px-3 py-2 bg-zinc-900/60 border border-white/5 rounded-xl">
                                    <i className={`ri-check-line ${step.textColor} text-xs flex-shrink-0`} />
                                    <span className="text-xs text-zinc-300">{output}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* 팁 */}
                            <div>
                              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">프로 팁</p>
                              <div className="space-y-2">
                                {step.tips.map((tip, i) => (
                                  <div key={i} className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border ${step.bg} ${step.border}`}>
                                    <i className={`ri-lightbulb-line ${step.textColor} text-sm flex-shrink-0 mt-0.5`} />
                                    <p className="text-[11px] text-zinc-300 leading-relaxed">{tip}</p>
                                  </div>
                                ))}
                              </div>
                              {step.route && (
                                <Link
                                  to={step.route}
                                  className={`mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${step.bg} ${step.border} ${step.textColor} hover:opacity-80`}
                                >
                                  <i className="ri-arrow-right-up-line" /> 이 단계 시작하기
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── 도구 연결 맵 ── */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-violet-500/15 border border-violet-500/25">
                <i className="ri-node-tree text-violet-400 text-sm" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">도구별 역할 정리</h2>
                <p className="text-xs text-zinc-500">각 도구가 워크플로우에서 담당하는 역할</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                {
                  name: 'AI Create',
                  route: '/ai-create',
                  icon: 'ri-sparkling-2-line',
                  color: 'text-indigo-400',
                  bg: 'bg-indigo-500/10',
                  border: 'border-indigo-500/20',
                  phases: ['생성'],
                  roles: ['AI 이미지 생성 (Flux Realism / Pro)', 'AI 영상 클립 생성 (Kling)', '캐릭터 일관성 관리', '카메라 앵글 & 색감 설정', '갤러리 저장 & 관리'],
                },
                {
                  name: 'AI Automation',
                  route: '/automation-studio',
                  icon: 'ri-magic-line',
                  color: 'text-violet-400',
                  bg: 'bg-violet-500/10',
                  border: 'border-violet-500/20',
                  phases: ['생성', '배포'],
                  roles: ['AutoPilot 자동 영상 제작', '프로젝트 갤러리 관리', '일괄 내보내기 (ZIP)', '성과 데이터 추적', '이어서 편집 기능'],
                },
                {
                  name: 'AI Sound',
                  route: '/ai-sound',
                  icon: 'ri-equalizer-line',
                  color: 'text-amber-400',
                  bg: 'bg-amber-500/10',
                  border: 'border-amber-500/20',
                  phases: ['편집'],
                  roles: ['TTS 나레이션 생성', 'AI 음악 & BGM 생성', '음성 노이즈 제거', '음성 동기화 (Sync)', '음성 텍스트 변환 (STT)'],
                },
                {
                  name: 'AI Board',
                  route: '/ai-board',
                  icon: 'ri-layout-grid-line',
                  color: 'text-emerald-400',
                  bg: 'bg-emerald-500/10',
                  border: 'border-emerald-500/20',
                  phases: ['생성'],
                  roles: ['씬별 스토리보드 제작', 'AI 씬 자동 생성', '드래그&드롭 컷 편집', '캐릭터/배경 레퍼런스', '스토리보드 내보내기'],
                },
                {
                  name: 'YouTube Studio',
                  route: '/youtube-studio',
                  icon: 'ri-youtube-line',
                  color: 'text-rose-400',
                  bg: 'bg-rose-500/10',
                  border: 'border-rose-500/20',
                  phases: ['생성', '편집', '배포'],
                  roles: ['6단계 영상 제작 파이프라인', 'AI 대본 자동 생성', 'AI 음성 합성 & 적용', '이미지/영상 자동 편집', '최종 영상 렌더링'],
                },
                {
                  name: 'AI Shortcuts',
                  route: '/ai-shortcuts',
                  icon: 'ri-flashlight-line',
                  color: 'text-cyan-400',
                  bg: 'bg-cyan-500/10',
                  border: 'border-cyan-500/20',
                  phases: ['생성', '편집', '배포'],
                  roles: ['외부 AI 서비스 허브', 'ChatGPT / Perplexity 연동', 'Runway / CapCut 연동', 'HeyGen / ElevenLabs 연동', '커스텀 서비스 추가'],
                },
              ].map(tool => (
                <div key={tool.name} className={`rounded-2xl border p-4 ${tool.bg} ${tool.border}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 flex items-center justify-center rounded-xl ${tool.bg} border ${tool.border}`}>
                        <i className={`${tool.icon} ${tool.color} text-base`} />
                      </div>
                      <div>
                        <p className={`text-sm font-black ${tool.color}`}>{tool.name}</p>
                        <div className="flex gap-1 mt-0.5">
                          {tool.phases.map(p => (
                            <span key={p} className="text-[9px] bg-white/10 text-zinc-400 px-1.5 py-0.5 rounded-full font-bold">{p}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    {tool.route && (
                      <Link
                        to={tool.route}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg ${tool.bg} border ${tool.border} ${tool.color} cursor-pointer hover:opacity-80 transition-opacity`}
                      >
                        <i className="ri-arrow-right-up-line text-xs" />
                      </Link>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {tool.roles.map(role => (
                      <div key={role} className="flex items-center gap-2">
                        <i className={`ri-checkbox-blank-circle-fill ${tool.color} text-[5px] flex-shrink-0`} />
                        <span className="text-[11px] text-zinc-300">{role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── 워크플로우 타임라인 요약 ── */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/25">
                <i className="ri-time-line text-amber-400 text-sm" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">예상 소요 시간</h2>
                <p className="text-xs text-zinc-500">콘텐츠 유형별 전체 제작 시간 가이드</p>
              </div>
            </div>

            <div className="bg-zinc-900/60 border border-white/5 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-4 gap-0 border-b border-white/5">
                {['콘텐츠 유형', '총 소요 시간', '핵심 단계', '난이도'].map(h => (
                  <div key={h} className="px-4 py-3 text-[10px] font-black text-zinc-500 uppercase tracking-wider">{h}</div>
                ))}
              </div>
              {[
                { type: '유튜브 쇼츠 (60초)', time: '30~60분', steps: '스토리보드 → 이미지 → 음성 → 편집', level: '쉬움', levelColor: 'text-emerald-400', levelBg: 'bg-emerald-500/10' },
                { type: '유튜브 영상 (5~10분)', time: '2~4시간', steps: '기획 → 대본 → 이미지 → 음성 → 편집 → 배포', level: '보통', levelColor: 'text-amber-400', levelBg: 'bg-amber-500/10' },
                { type: 'AI 자동화 채널', time: '15~30분/편', steps: 'AutoPilot → 검토 → 배포', level: '자동화', levelColor: 'text-indigo-400', levelBg: 'bg-indigo-500/10' },
                { type: '광고 영상 (30초)', time: '1~2시간', steps: '기획 → 스토리보드 → 이미지 → 음성 → 편집', level: '보통', levelColor: 'text-amber-400', levelBg: 'bg-amber-500/10' },
                { type: '교육 콘텐츠 (15분+)', time: '4~8시간', steps: '전체 9단계 풀 파이프라인', level: '심화', levelColor: 'text-rose-400', levelBg: 'bg-rose-500/10' },
              ].map((row, i) => (
                <div key={i} className={`grid grid-cols-4 gap-0 ${i < 4 ? 'border-b border-white/5' : ''} hover:bg-white/2 transition-colors`}>
                  <div className="px-4 py-3.5 text-sm font-bold text-white">{row.type}</div>
                  <div className="px-4 py-3.5 text-sm font-bold text-zinc-300">{row.time}</div>
                  <div className="px-4 py-3.5 text-xs text-zinc-500 leading-relaxed">{row.steps}</div>
                  <div className="px-4 py-3.5">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${row.levelBg} ${row.levelColor}`}>{row.level}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── CTA ── */}
          <section className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-violet-500/10 p-8 md:p-10 text-center">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-violet-500/5 pointer-events-none" />
            <div className="relative">
              <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-indigo-500/20 border border-indigo-500/30 mx-auto mb-4">
                <i className="ri-rocket-line text-indigo-400 text-2xl" />
              </div>
              <h3 className="text-2xl font-black text-white mb-2">지금 바로 시작하세요</h3>
              <p className="text-zinc-400 text-sm mb-6 max-w-md mx-auto leading-relaxed">
                AI Board로 스토리보드를 만들거나, YouTube Studio로 영상 제작을 시작하거나,
                AI Create로 이미지를 생성해보세요.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link
                  to="/ai-board"
                  className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-layout-grid-line" /> AI Board 시작
                </Link>
                <Link
                  to="/youtube-studio"
                  className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-youtube-line" /> YouTube Studio
                </Link>
                <Link
                  to="/automation-studio"
                  className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-magic-line" /> AI Automation
                </Link>
              </div>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
