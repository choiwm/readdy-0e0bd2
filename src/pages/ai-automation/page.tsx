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
import StepIndicator from '@/pages/youtube-studio/components/StepIndicator';
import { useToast, ToastContainer } from '@/components/base/Toast';
import Step1Settings from '@/pages/youtube-studio/components/Step1Settings';
import Step2Script from '@/pages/youtube-studio/components/Step2Script';
import Step3Voice from '@/pages/youtube-studio/components/Step3Voice';
import Step4Image from '@/pages/youtube-studio/components/Step4Image';
import Step5Video from '@/pages/youtube-studio/components/Step5Video';
import Step6LocalStyle from '@/pages/youtube-studio/components/Step6LocalStyle';
import { VoiceData, ProjectMeta, STYLE_LABEL_MAP } from '@/pages/youtube-studio/page';
import { Step4ImageData } from '@/pages/youtube-studio/components/Step4Image';
import { VideoCut } from '@/pages/youtube-studio/components/Step5Video';

// Edge Function URLs
const VIDEO_EDGE_FN = 'https://kkeijdddandmvsaukpcn.supabase.co/functions/v1/generate-video';
const IMAGE_EDGE_FN = 'https://kkeijdddandmvsaukpcn.supabase.co/functions/v1/generate-image';

// ── Sidebar icon rail items ────────────────────────────────────────────────
const sidebarItems = [
  { icon: 'ri-tv-2-line', label: '유튜브' },
  { icon: 'ri-youtube-line', label: 'YT Studio' },
  { icon: 'ri-advertisement-line', label: '광고' },
];

// ── YouTube config data ───────────────────────────────────────────────────
const styleOptions = [
  { id: 1, label: '미래도시', thumb: 'https://readdy.ai/api/search-image?query=futuristic%20city%20skyline%20at%20night%20with%20neon%20lights%20and%20flying%20vehicles%2C%20cyberpunk%20style%2C%20dark%20background&width=80&height=60&seq=auto1&orientation=landscape' },
  { id: 2, label: '자연풍경', thumb: 'https://readdy.ai/api/search-image?query=serene%20mountain%20landscape%20with%20misty%20valleys%20and%20golden%20sunrise%2C%20cinematic%20photography%20style&width=80&height=60&seq=auto2&orientation=landscape' },
  { id: 3, label: '미니멀', thumb: 'https://readdy.ai/api/search-image?query=minimalist%20white%20studio%20background%20with%20simple%20geometric%20shapes%20and%20soft%20shadows%2C%20clean%20modern%20aesthetic&width=80&height=60&seq=auto3&orientation=landscape' },
  { id: 4, label: '드라마틱', thumb: 'https://readdy.ai/api/search-image?query=dramatic%20cinematic%20scene%20with%20deep%20shadows%20and%20moody%20lighting%2C%20film%20noir%20style%2C%20dark%20atmosphere&width=80&height=60&seq=auto4&orientation=landscape' },
  { id: 5, label: '빈티지', thumb: 'https://readdy.ai/api/search-image?query=vintage%20retro%20aesthetic%20with%20warm%20film%20grain%20texture%2C%20faded%20colors%2C%20nostalgic%20photography%20style&width=80&height=60&seq=auto5&orientation=landscape' },
  { id: 6, label: '애니메이션', thumb: 'https://readdy.ai/api/search-image?query=colorful%20anime%20style%20illustration%20with%20vibrant%20colors%20and%20clean%20line%20art%2C%20Japanese%20animation%20aesthetic&width=80&height=60&seq=auto6&orientation=landscape' },
];

const voiceList = [
  { id: 'v1', name: '명수', provider: 'ELEVENLABS' },
  { id: 'v2', name: '지수', provider: 'ELEVENLABS' },
  { id: 'v3', name: '민준', provider: 'CLOVA' },
  { id: 'v4', name: '서연', provider: 'CLOVA' },
];

const imageModelList = [
  { id: 'flux-realism', label: 'Flux Realism', icon: 'ri-flashlight-line' },
  { id: 'flux-pro', label: 'Flux Pro', icon: 'ri-sparkling-2-line' },
  { id: 'flux-pro-ultra', label: 'Flux Pro Ultra', icon: 'ri-vip-crown-line' },
];

const subtitleTemplates = [
  { id: 'youtube', label: '유튜브' },
  { id: 'preview', label: '자막 미리보기' },
  { id: 'minimal', label: '미니멀' },
  { id: 'bold', label: '볼드' },
];

const subtitleStyles = [
  { id: 'default', color: 'bg-white' },
  { id: 'yellow', color: 'bg-yellow-400' },
  { id: 'green', color: 'bg-emerald-400' },
  { id: 'red', color: 'bg-red-400' },
  { id: 'cyan', color: 'bg-cyan-400' },
];

// STYLE_LABEL_MAP imported from youtube-studio/page.tsx to avoid duplication

const YT_STEP_TITLES = [
  { label: '영상 설정', desc: '스타일과 비율을 선택하고 시작하세요.' },
  { label: '대본 작성', desc: 'AI가 생성한 대본을 확인하고 편집하세요.' },
  { label: '음성 생성', desc: '나레이션 음성을 선택하고 생성하세요.' },
  { label: '이미지 생성', desc: '각 씬에 맞는 이미지를 생성하세요.' },
  { label: '영상 생성', desc: '이미지와 음성을 합쳐 영상을 완성하세요.' },
  { label: '자막 스타일', desc: '자막 폰트와 스타일을 설정하세요.' },
];

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

// ── YouTube Config Sidebar Content ──────────────────────────────────────────
interface YouTubeConfigContentProps {
  videoLength: number; setVideoLength: (v: number) => void;
  customLength: string; setCustomLength: (v: string) => void;
  speed: 'fast' | 'slow'; setSpeed: (v: 'fast' | 'slow') => void;
  voiceSpeed: 'normal' | 'fast'; setVoiceSpeed: (v: 'normal' | 'fast') => void;
  ratio: string; setRatio: (v: string) => void;
  selectedStyle: number | null; setSelectedStyle: (v: number | null) => void;
  selectedVoice: string; setSelectedVoice: (v: string) => void;
  voiceDropOpen: boolean; setVoiceDropOpen: (v: boolean) => void;
  imageModel: string; setImageModel: (v: string) => void;
  imageModelOpen: boolean; setImageModelOpen: (v: boolean) => void;
  videoCharacter: string; setVideoCharacter: (v: string) => void;
  videoCharOpen: boolean; setVideoCharOpen: (v: boolean) => void;
  subtitleEnabled: boolean; setSubtitleEnabled: (v: boolean) => void;
  subtitleStyle: string; setSubtitleStyle: (v: string) => void;
  subtitleTemplate: string; setSubtitleTemplate: (v: string) => void;
  subtitleTemplateOpen: boolean; setSubtitleTemplateOpen: (v: boolean) => void;
  isPlaying: boolean; setIsPlaying: (v: boolean) => void;
  onNavigate: () => void;
  closeDropdowns: () => void;
}

function YouTubeConfigContent({
  videoLength, setVideoLength, customLength, setCustomLength,
  speed, setSpeed, voiceSpeed, setVoiceSpeed, ratio, setRatio,
  selectedStyle, setSelectedStyle, selectedVoice, setSelectedVoice,
  voiceDropOpen, setVoiceDropOpen, imageModel, setImageModel,
  imageModelOpen, setImageModelOpen, videoCharacter, setVideoCharacter,
  videoCharOpen, setVideoCharOpen, subtitleEnabled, setSubtitleEnabled,
  subtitleStyle, setSubtitleStyle, subtitleTemplate, setSubtitleTemplate,
  subtitleTemplateOpen, setSubtitleTemplateOpen, isPlaying, setIsPlaying,
  onNavigate, closeDropdowns,
}: YouTubeConfigContentProps) {
  const currentVoice = voiceList.find((v) => v.id === selectedVoice)!;
  const currentImageModel = imageModelList.find((m) => m.id === imageModel)!;
  const currentSubtitleTemplate = subtitleTemplates.find((t) => t.id === subtitleTemplate)!;

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5" onClick={closeDropdowns}>
      {/* Style grid */}
      <div>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2.5">스타일 선택</p>
        <div className="grid grid-cols-3 gap-1.5">
          {styleOptions.map((s) => (
            <button
              key={s.id}
              onClick={(e) => { e.stopPropagation(); setSelectedStyle(selectedStyle === s.id ? null : s.id); }}
              className={`relative rounded-xl overflow-hidden cursor-pointer transition-all ${selectedStyle === s.id ? 'ring-2 ring-indigo-500' : 'hover:ring-1 hover:ring-zinc-600'}`}
            >
              <img src={s.thumb} alt={s.label} className="w-full h-[46px] object-cover" />
              <div className={`absolute inset-0 transition-all ${selectedStyle === s.id ? 'bg-indigo-500/30' : 'bg-black/20'}`} />
              {selectedStyle === s.id && (
                <div className="absolute top-1 right-1 w-3.5 h-3.5 bg-indigo-500 rounded-full flex items-center justify-center">
                  <i className="ri-check-line text-white text-[8px]" />
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                <p className="text-[9px] text-white font-bold truncate">{s.label}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="w-full h-px bg-white/5" />

      {/* 영상 길이 */}
      <div>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2.5">영상 길이</p>
        <div className="grid grid-cols-3 gap-1.5 mb-2.5">
          {[30, 60, 90].map((l) => (
            <button key={l} onClick={() => { setVideoLength(l); setCustomLength(String(l)); }}
              className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${videoLength === l ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-400' : 'bg-zinc-800/60 border border-white/5 text-zinc-400 hover:border-white/10 hover:text-zinc-200'}`}>
              {l}초
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-zinc-900/60 border border-white/5 rounded-xl px-3 py-2">
          <span className="text-[10px] text-zinc-600 whitespace-nowrap">직접 입력</span>
          <input type="number" min={10} max={600} value={customLength}
            onChange={(e) => { setCustomLength(e.target.value); const n = Number(e.target.value); if (!isNaN(n) && n > 0) setVideoLength(n); }}
            className="flex-1 bg-transparent text-xs text-white text-right focus:outline-none tabular-nums" />
          <span className="text-[10px] text-zinc-600">sec</span>
        </div>
      </div>

      <div className="w-full h-px bg-white/5" />

      {/* 기본 음성 */}
      <div>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2.5">기본 음성</p>
        <div className="relative mb-2" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setVoiceDropOpen(!voiceDropOpen)}
            className="w-full flex items-center justify-between gap-2 bg-zinc-900/60 border border-white/5 rounded-xl px-3 py-2.5 cursor-pointer hover:border-indigo-500/30 transition-all">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
              <span className="text-xs text-white font-medium">{currentVoice.name}</span>
              <span className="text-[10px] text-zinc-600">({currentVoice.provider})</span>
            </div>
            <i className={`ri-arrow-down-s-line text-zinc-500 text-sm transition-transform ${voiceDropOpen ? 'rotate-180' : ''}`} />
          </button>
          {voiceDropOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-xl shadow-xl z-30 overflow-hidden">
              {voiceList.map((v) => (
                <button key={v.id} onClick={() => { setSelectedVoice(v.id); setVoiceDropOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors cursor-pointer ${selectedVoice === v.id ? 'bg-indigo-500/15 text-indigo-300' : 'text-zinc-300 hover:bg-white/5'}`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                  <span className="font-medium">{v.name}</span>
                  <span className="text-[10px] text-zinc-600 ml-auto">({v.provider})</span>
                  {selectedVoice === v.id && <i className="ri-check-line text-indigo-400 text-[10px] ml-auto" />}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 bg-zinc-900/60 border border-white/5 rounded-xl px-3 py-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
          <span className="text-xs text-zinc-300 flex-1">{currentVoice.name} ({currentVoice.provider})</span>
          <button onClick={() => setIsPlaying(!isPlaying)}
            className="w-6 h-6 rounded-full bg-indigo-500 hover:bg-indigo-400 flex items-center justify-center transition-all cursor-pointer flex-shrink-0">
            <i className={`${isPlaying ? 'ri-pause-fill' : 'ri-play-fill'} text-white text-xs ${isPlaying ? '' : 'ml-px'}`} />
          </button>
        </div>
      </div>

      <div className="w-full h-px bg-white/5" />

      {/* 음성 빠르기 */}
      <div>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2.5">음성 빠르기</p>
        <div className="grid grid-cols-2 gap-1.5">
          {(['normal', 'fast'] as const).map((s) => (
            <button key={s} onClick={() => setVoiceSpeed(s)}
              className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${voiceSpeed === s ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-400' : 'bg-zinc-800/60 border border-white/5 text-zinc-400 hover:border-white/10 hover:text-zinc-200'}`}>
              {s === 'normal' ? '보통' : '빠르게'}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full h-px bg-white/5" />

      {/* 컷전환 속도 */}
      <div>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2.5">컷전환 속도</p>
        <div className="grid grid-cols-2 gap-1.5">
          {(['fast', 'slow'] as const).map((s) => (
            <button key={s} onClick={() => setSpeed(s)}
              className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${speed === s ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-400' : 'bg-zinc-800/60 border border-white/5 text-zinc-400 hover:border-white/10 hover:text-zinc-200'}`}>
              {s === 'fast' ? '빠르게' : '느리게'}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-zinc-600 mt-1.5">{speed === 'fast' ? '~5초마다 컷 전환' : '~3-4문장마다 컷 전환'}</p>
      </div>

      <div className="w-full h-px bg-white/5" />

      {/* 이미지 생성 모델 */}
      <div>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2.5">이미지 생성 모델</p>
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setImageModelOpen(!imageModelOpen)}
            className="w-full flex items-center justify-between gap-2 bg-zinc-900/60 border border-white/5 rounded-xl px-3 py-2.5 cursor-pointer hover:border-indigo-500/30 transition-all">
            <div className="flex items-center gap-2">
              <i className={`${currentImageModel.icon} text-indigo-400 text-sm`} />
              <span className="text-xs text-white">{currentImageModel.label}</span>
            </div>
            <i className={`ri-arrow-down-s-line text-zinc-500 text-sm transition-transform ${imageModelOpen ? 'rotate-180' : ''}`} />
          </button>
          {imageModelOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-xl shadow-xl z-30 overflow-hidden">
              {imageModelList.map((m) => (
                <button key={m.id} onClick={() => { setImageModel(m.id); setImageModelOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors cursor-pointer ${imageModel === m.id ? 'bg-indigo-500/15 text-indigo-300' : 'text-zinc-300 hover:bg-white/5'}`}>
                  <i className={`${m.icon} text-xs`} /> {m.label}
                  {imageModel === m.id && <i className="ri-check-line text-indigo-400 text-[10px] ml-auto" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 영상 생성 캐릭터 */}
      <div>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2.5">영상 생성 캐릭터</p>
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setVideoCharOpen(!videoCharOpen)}
            className="w-full flex items-center justify-between gap-2 bg-zinc-900/60 border border-white/5 rounded-xl px-3 py-2.5 cursor-pointer hover:border-indigo-500/30 transition-all">
            <div className="flex items-center gap-2">
              <i className="ri-user-star-line text-zinc-500 text-sm" />
              <span className={`text-xs ${videoCharacter ? 'text-white' : 'text-zinc-500'}`}>{videoCharacter || '캐릭터 선택'}</span>
            </div>
            <i className={`ri-arrow-down-s-line text-zinc-500 text-sm transition-transform ${videoCharOpen ? 'rotate-180' : ''}`} />
          </button>
          {videoCharOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-xl shadow-xl z-30 overflow-hidden">
              <button onClick={() => { setVideoCharacter(''); setVideoCharOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-zinc-500 hover:bg-white/5 cursor-pointer">
                <i className="ri-close-line text-xs" /> 선택 안함
              </button>
              {['다은', '소희', '준혁', '태민', '강민'].map((name) => (
                <button key={name} onClick={() => { setVideoCharacter(name); setVideoCharOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors cursor-pointer ${videoCharacter === name ? 'bg-indigo-500/15 text-indigo-300' : 'text-zinc-300 hover:bg-white/5'}`}>
                  <i className="ri-user-line text-xs" /> {name}
                  {videoCharacter === name && <i className="ri-check-line text-indigo-400 text-[10px] ml-auto" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="w-full h-px bg-white/5" />

      {/* 자막 설정 */}
      <div>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">자막 설정</p>
        <div className="flex items-center justify-between gap-3 mb-3 px-3 py-2.5 bg-zinc-900/60 border border-white/5 rounded-xl">
          <div>
            <p className="text-xs text-white font-bold">자막 포함</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">자동 자막 생성</p>
          </div>
          <button onClick={() => setSubtitleEnabled(!subtitleEnabled)}
            className={`relative w-9 h-5 rounded-full transition-all cursor-pointer flex-shrink-0 ${subtitleEnabled ? 'bg-indigo-500' : 'bg-zinc-700'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${subtitleEnabled ? 'left-4' : 'left-0.5'}`} />
          </button>
        </div>
        {subtitleEnabled && (
          <>
            <div className="flex items-center gap-2 mb-3 px-1">
              {subtitleStyles.map((st) => (
                <button key={st.id} onClick={() => setSubtitleStyle(st.id)} title={st.id}
                  className={`w-5 h-5 rounded-full ${st.color} transition-all cursor-pointer flex-shrink-0 ${subtitleStyle === st.id ? 'ring-2 ring-offset-1 ring-offset-[#111113] ring-indigo-400 scale-110' : 'opacity-50 hover:opacity-100'}`} />
              ))}
            </div>
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setSubtitleTemplateOpen(!subtitleTemplateOpen)}
                className="w-full flex items-center justify-between gap-2 bg-zinc-900/60 border border-white/5 rounded-xl px-3 py-2.5 cursor-pointer hover:border-indigo-500/30 transition-all">
                <span className="text-xs text-zinc-300">{currentSubtitleTemplate.label}</span>
                <i className={`ri-arrow-down-s-line text-zinc-500 text-sm transition-transform ${subtitleTemplateOpen ? 'rotate-180' : ''}`} />
              </button>
              {subtitleTemplateOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-xl shadow-xl z-30 overflow-hidden">
                  {subtitleTemplates.map((t) => (
                    <button key={t.id} onClick={() => { setSubtitleTemplate(t.id); setSubtitleTemplateOpen(false); }}
                      className={`w-full flex items-center px-3 py-2.5 text-xs transition-colors cursor-pointer ${subtitleTemplate === t.id ? 'bg-indigo-500/15 text-indigo-300' : 'text-zinc-300 hover:bg-white/5'}`}>
                      {t.label}
                      {subtitleTemplate === t.id && <i className="ri-check-line text-indigo-400 text-[10px] ml-auto" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="w-full h-px bg-white/5" />

      {/* 화면 비율 */}
      <div>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2.5">화면 비율</p>
        <div className="grid grid-cols-4 gap-1.5">
          {['16:9', '9:16', '1:1', '3:4'].map((r) => (
            <button key={r} onClick={() => setRatio(r)}
              className={`flex flex-col items-center py-2.5 rounded-xl border transition-all cursor-pointer ${ratio === r ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400' : 'border-white/5 text-zinc-500 hover:border-white/10 hover:text-zinc-300'}`}>
              <div className={`border-2 mb-1 ${ratio === r ? 'border-indigo-400' : 'border-zinc-600'} ${r === '9:16' ? 'w-6 h-4' : r === '16:9' ? 'w-4 h-5' : r === '1:1' ? 'w-4 h-4' : 'w-3 h-4'} rounded-sm`} />
              <span className="text-[9px] font-bold">{r}</span>
            </button>
          ))}
        </div>
      </div>

      {/* New project button */}
      <button
        onClick={onNavigate}
        className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-bold text-sm rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
      >
        <i className="ri-add-line" />
        새 영상 제작 시작
      </button>
    </div>
  );
}

// ── YouTube Studio Embedded Component ────────────────────────────────────────
interface EmbeddedYouTubeStudioProps {
  addProject: (project: AutomationProject) => void;
  initialProject?: AutomationProject | null;
  onBack?: () => void;
  resumeStep?: number;
  /** 사이드바에서 설정한 초기값 */
  sidebarStyle?: number | null;
  sidebarRatio?: string;
  sidebarVoiceId?: string;
}

function EmbeddedYouTubeStudio({ addProject, initialProject, onBack, resumeStep, sidebarStyle, sidebarRatio, sidebarVoiceId: _sidebarVoiceId }: EmbeddedYouTubeStudioProps) {
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
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [channelName, setChannelName] = useState<string>('');
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

  const stepInfo = YT_STEP_TITLES[currentStep - 1];

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

export default function AIAutomationPage() {
  const navigate = useNavigate();
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
    upsertProject,
  } = useAutomationProjects(automationProjects, user?.id ?? null);
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);
  const [viewState, setViewState] = useState<ViewState>('gallery');
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
  const currentImageModel = imageModelList.find((m) => m.id === imageModel)!;

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
