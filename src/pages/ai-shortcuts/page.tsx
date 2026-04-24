import { useState, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { shortcutCategories, ShortcutTool } from '@/mocks/aiShortcuts';
import AppNavbar from '@/components/feature/AppNavbar';
import EmptyState from '@/components/base/EmptyState';
import { useCustomServices } from './hooks/useCustomServices';
import { useShortcutOrder } from './hooks/useShortcutOrder';
import SortableCategorySection from './components/SortableCategorySection';

// ── Plan features ──────────────────────────────────────────────────────────
const planFeatures = [
  { icon: 'ri-sparkling-2-line',        label: 'AI Create',        desc: '이미지·영상 무제한 생성',       included: true  },
  { icon: 'ri-magic-line',              label: 'AI Automation',    desc: '유튜브 자동화 프로젝트 20개',   included: true  },
  { icon: 'ri-equalizer-line',          label: 'AI Sound',         desc: 'TTS 월 500회 생성',             included: true  },
  { icon: 'ri-layout-grid-line',        label: 'AI Board',         desc: '스토리보드 무제한',             included: true  },
  { icon: 'ri-flashlight-line',         label: 'AI Shortcuts',     desc: '외부 AI 서비스 연동',           included: true  },
  { icon: 'ri-cloud-line',              label: 'Cloud Storage',    desc: '100GB 클라우드 저장',           included: false },
  { icon: 'ri-team-line',               label: 'Team Workspace',   desc: '팀원 최대 5명',                 included: false },
  { icon: 'ri-customer-service-2-line', label: 'Priority Support', desc: '24시간 전담 지원',              included: false },
];

// ── Popular services for quick-add ────────────────────────────────────────
const POPULAR_SERVICES = [
  { name: 'ChatGPT',      url: 'https://chat.openai.com',          icon: 'ri-robot-2-line',      color: '#10a37f', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', textColor: 'text-emerald-400', categoryId: 'ai-agent',      desc: 'OpenAI 대화형 AI' },
  { name: 'Midjourney',   url: 'https://midjourney.com',           icon: 'ri-image-ai-line',     color: '#6366f1', bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20',  textColor: 'text-indigo-400',  categoryId: 'image',         desc: 'AI 이미지 생성' },
  { name: 'ElevenLabs',   url: 'https://elevenlabs.io',            icon: 'ri-mic-ai-line',       color: '#f59e0b', bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   textColor: 'text-amber-400',   categoryId: 'voice-lipsync', desc: 'AI 음성 합성' },
  { name: 'Runway',       url: 'https://runwayml.com',             icon: 'ri-video-ai-line',     color: '#10b981', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', textColor: 'text-emerald-400', categoryId: 'video',         desc: 'AI 영상 편집 & 생성' },
  { name: 'Suno AI',      url: 'https://suno.com',                 icon: 'ri-music-ai-line',     color: '#f59e0b', bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   textColor: 'text-amber-400',   categoryId: 'music',         desc: 'AI 음악 생성' },
  { name: 'Cursor',       url: 'https://cursor.sh',                icon: 'ri-code-ai-line',      color: '#06b6d4', bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20',    textColor: 'text-cyan-400',    categoryId: 'vibe-coding',   desc: 'AI 코드 에디터' },
  { name: 'HeyGen',       url: 'https://www.heygen.com',           icon: 'ri-user-voice-line',   color: '#8b5cf6', bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  textColor: 'text-violet-400',  categoryId: 'voice-lipsync', desc: 'AI 아바타 영상' },
  { name: 'Gamma',        url: 'https://gamma.app',                icon: 'ri-presentation-line', color: '#6366f1', bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20',  textColor: 'text-indigo-400',  categoryId: 'business',      desc: 'AI 프레젠테이션' },
  { name: 'Perplexity',   url: 'https://www.perplexity.ai',        icon: 'ri-search-eye-line',   color: '#20b2aa', bg: 'bg-teal-500/10',    border: 'border-teal-500/20',    textColor: 'text-teal-400',    categoryId: 'ai-agent',      desc: 'AI 검색 엔진' },
  { name: 'Kling',        url: 'https://klingai.com',              icon: 'ri-film-ai-line',      color: '#f59e0b', bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   textColor: 'text-amber-400',   categoryId: 'video',         desc: 'AI 영상 생성' },
  { name: 'Lovable',      url: 'https://lovable.dev',              icon: 'ri-heart-3-line',      color: '#ec4899', bg: 'bg-pink-500/10',    border: 'border-pink-500/20',    textColor: 'text-pink-400',    categoryId: 'vibe-coding',   desc: 'AI 앱 빌더' },
  { name: 'Udio',         url: 'https://www.udio.com',             icon: 'ri-music-2-line',      color: '#ec4899', bg: 'bg-pink-500/10',    border: 'border-pink-500/20',    textColor: 'text-pink-400',    categoryId: 'music',         desc: 'AI 음악 작곡' },
];

// ── Add Service Modal ──────────────────────────────────────────────────────
function AddServiceModal({
  onClose,
  onAdd,
  alreadyAdded,
}: {
  onClose: () => void;
  onAdd: (services: typeof POPULAR_SERVICES) => void;
  alreadyAdded: (name: string) => boolean;
}) {
  const [step, setStep] = useState<'select' | 'custom' | 'done'>('select');
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [isConnecting, setIsConnecting] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Custom URL form
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customCategory, setCustomCategory] = useState('ai-agent');
  const [customError, setCustomError] = useState('');

  const filteredServices = POPULAR_SERVICES.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleService = (name: string) => {
    if (alreadyAdded(name)) return;
    setSelectedServices((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleConnect = () => {
    if (selectedServices.size === 0) return;
    setIsConnecting(true);

    const toAdd = POPULAR_SERVICES.filter((s) => selectedServices.has(s.name));

    // Open each service URL in a new tab
    toAdd.forEach((svc, i) => {
      setTimeout(() => {
        window.open(svc.url, '_blank', 'noopener,noreferrer');
      }, i * 300);
    });

    setTimeout(() => {
      onAdd(toAdd);
      setAddedCount(toAdd.length);
      setIsConnecting(false);
      setStep('done');
    }, 800);
  };

  const handleCustomAdd = () => {
    setCustomError('');
    if (!customName.trim()) { setCustomError('서비스 이름을 입력하세요.'); return; }
    if (!customUrl.trim()) { setCustomError('URL을 입력하세요.'); return; }

    let url = customUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    try {
      new URL(url);
    } catch {
      setCustomError('올바른 URL 형식이 아닙니다. (예: https://example.com)');
      return;
    }

    setIsConnecting(true);
    window.open(url, '_blank', 'noopener,noreferrer');

    const customSvc = [{
      name: customName.trim(),
      url,
      icon: 'ri-global-line',
      color: '#6366f1',
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/20',
      textColor: 'text-indigo-400',
      categoryId: customCategory,
      desc: customDesc.trim() || `${customName.trim()} 서비스`,
    }];

    setTimeout(() => {
      onAdd(customSvc);
      setAddedCount(1);
      setIsConnecting(false);
      setStep('done');
    }, 600);
  };

  const categoryOptions = [
    { id: 'ai-agent', label: 'AI Agent' },
    { id: 'image', label: 'Image' },
    { id: 'video', label: 'Video' },
    { id: 'voice-lipsync', label: 'Voice / Lip-Sync' },
    { id: 'vibe-coding', label: 'Vibe Coding' },
    { id: 'music', label: 'Music' },
    { id: 'edit', label: 'Edit' },
    { id: 'business', label: 'Business' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-900 border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md sm:mx-4 overflow-hidden shadow-2xl relative" onClick={(e) => e.stopPropagation()}>

        {/* Mobile drag indicator */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-zinc-700 rounded-full sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
              <i className="ri-add-circle-line text-indigo-400 text-lg" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">서비스 추가</h3>
              <p className="text-[10px] text-zinc-500">외부 AI 서비스를 바로가기에 추가하세요</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer">
            <i className="ri-close-line text-lg" />
          </button>
        </div>

        {/* Step: Select */}
        {step === 'select' && (
          <div className="p-4 md:p-5 space-y-3 md:space-y-4">
            {/* Tab: Popular / Custom */}
            <div className="flex items-center gap-1 bg-zinc-800/60 rounded-xl p-1">
              <button
                onClick={() => {}}
                className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-zinc-700 text-white cursor-pointer whitespace-nowrap"
              >
                인기 서비스
              </button>
              <button
                onClick={() => setStep('custom')}
                className="flex-1 py-1.5 rounded-lg text-xs font-bold text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors whitespace-nowrap"
              >
                직접 추가
              </button>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 bg-zinc-800/60 border border-white/5 rounded-xl px-3 py-2">
              <i className="ri-search-line text-zinc-500 text-sm" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="서비스 검색..."
                className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
              />
            </div>

            {/* Info banner */}
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-indigo-500/8 border border-indigo-500/15">
              <i className="ri-information-line text-indigo-400 text-xs mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                추가하면 AI Shortcuts 목록에 바로가기가 생성됩니다. 서비스 사이트가 새 탭으로 열립니다.
              </p>
            </div>

            {/* Service grid */}
            <div className="grid grid-cols-2 gap-1.5 md:gap-2 max-h-[240px] md:max-h-[280px] overflow-y-auto pr-1">
              {filteredServices.map((svc) => {
                const active = selectedServices.has(svc.name);
                const added = alreadyAdded(svc.name);
                return (
                  <button
                    key={svc.name}
                    onClick={() => toggleService(svc.name)}
                    disabled={added}
                    className={`flex items-center gap-2 px-2.5 md:px-3 py-2 md:py-2.5 rounded-xl border text-left transition-all cursor-pointer disabled:cursor-default ${
                      added
                        ? 'bg-zinc-800/30 border-white/5 opacity-50'
                        : active
                        ? `${svc.bg} ${svc.border} ${svc.textColor}`
                        : 'bg-zinc-800/50 border-white/5 text-zinc-400 hover:border-white/10 hover:bg-zinc-800'
                    }`}
                  >
                    <div className={`w-6 h-6 md:w-7 md:h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? svc.bg : 'bg-zinc-700/50'}`}>
                      <i className={`${svc.icon} text-xs md:text-sm ${active ? svc.textColor : 'text-zinc-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{svc.name}</p>
                      <p className="text-[9px] text-zinc-600 truncate hidden sm:block">{svc.desc}</p>
                    </div>
                    {added ? (
                      <i className="ri-check-line text-zinc-600 text-[10px] flex-shrink-0" />
                    ) : active ? (
                      <i className="ri-check-line text-[10px] ml-auto flex-shrink-0" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleConnect}
              disabled={selectedServices.size === 0 || isConnecting}
              className="w-full py-2.5 md:py-3 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isConnecting ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 추가 중...</>
              ) : (
                <><i className="ri-add-line" /> {selectedServices.size > 0 ? `${selectedServices.size}개 서비스 추가` : '서비스를 선택하세요'}</>
              )}
            </button>
          </div>
        )}

        {/* Step: Custom URL */}
        {step === 'custom' && (
          <div className="p-4 md:p-5 space-y-3 md:space-y-4">
            <div className="flex items-center gap-1 bg-zinc-800/60 rounded-xl p-1">
              <button
                onClick={() => setStep('select')}
                className="flex-1 py-1.5 rounded-lg text-xs font-bold text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors whitespace-nowrap"
              >
                인기 서비스
              </button>
              <button
                onClick={() => {}}
                className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-zinc-700 text-white cursor-pointer whitespace-nowrap"
              >
                직접 추가
              </button>
            </div>

            <div className="space-y-2.5 md:space-y-3">
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1.5">서비스 이름 *</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="예: My AI Tool"
                  className="w-full bg-zinc-800/60 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1.5">URL *</label>
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full bg-zinc-800/60 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/40 transition-colors font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1.5">설명 (선택)</label>
                <input
                  type="text"
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  placeholder="서비스 간단 설명"
                  className="w-full bg-zinc-800/60 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1.5">카테고리</label>
                <select
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="w-full bg-zinc-800/60 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-colors cursor-pointer"
                >
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id} className="bg-zinc-900">{c.label}</option>
                  ))}
                </select>
              </div>
              {customError && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                  <i className="ri-error-warning-line text-red-400 text-xs" />
                  <p className="text-xs text-red-400">{customError}</p>
                </div>
              )}
            </div>

            <button
              onClick={handleCustomAdd}
              disabled={isConnecting}
              className="w-full py-2.5 md:py-3 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isConnecting ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 추가 중...</>
              ) : (
                <><i className="ri-add-line" /> 바로가기 추가</>
              )}
            </button>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="p-6 md:p-8 flex flex-col items-center gap-4 md:gap-5 text-center">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
              <i className="ri-check-double-line text-emerald-400 text-2xl md:text-3xl" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white mb-1">추가 완료!</h4>
              <p className="text-sm text-zinc-400">
                <span className="text-emerald-400 font-bold">{addedCount}개</span> 서비스가 AI Shortcuts에 추가됐어요.
              </p>
              <p className="text-xs text-zinc-600 mt-1">서비스 사이트가 새 탭으로 열렸습니다.</p>
            </div>
            <div className="w-full px-4 py-3 rounded-xl bg-zinc-800/60 border border-white/5 text-left">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">추가된 서비스</p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(selectedServices).concat(customName ? [customName] : []).map((name) => {
                  const svc = POPULAR_SERVICES.find((s) => s.name === name);
                  return (
                    <span key={name} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${svc?.bg ?? 'bg-indigo-500/10'} ${svc?.border ?? 'border-indigo-500/20'} ${svc?.textColor ?? 'text-indigo-400'}`}>
                      <i className={`${svc?.icon ?? 'ri-global-line'} text-[10px]`} />
                      {name}
                    </span>
                  );
                })}
              </div>
            </div>
            <button onClick={onClose} className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-white/5 text-white font-bold text-sm rounded-xl transition-all cursor-pointer">
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pro Upgrade Modal ──────────────────────────────────────────────────────
type BillingCycle = 'monthly' | 'yearly';

function ProUpgradeModal({ onClose }: { onClose: () => void }) {
  const [billing, setBilling] = useState<BillingCycle>('yearly');
  const [step, setStep] = useState<'plan' | 'contact'>('plan');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const price = billing === 'yearly' ? 23 : 29;
  const originalPrice = 29;
  const saving = Math.round((1 - price / originalPrice) * 100);

  const handleSubmitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!email.trim() || !email.includes('@')) {
      setSubmitError('올바른 이메일 주소를 입력하세요.');
      return;
    }
    if (!name.trim()) {
      setSubmitError('이름을 입력하세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      await fetch(
        `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/support-submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            kind: 'plan_upgrade',
            name: name.trim(),
            email: email.trim(),
            subject: `Pro ${billing === 'yearly' ? '연간' : '월간'} ($${price}/월) 업그레이드 문의`,
            message: `Pro 플랜 업그레이드를 원합니다.\n\n이름: ${name.trim()}\n이메일: ${email.trim()}\n요금제: Pro ${billing === 'yearly' ? '연간' : '월간'} ($${price}/월)`,
          }),
        },
      );
      setIsSubmitting(false);
      setSubmitted(true);
    } catch {
      setIsSubmitting(false);
      setSubmitError('제출 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-900 border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-lg sm:mx-4 overflow-hidden shadow-2xl relative" onClick={(e) => e.stopPropagation()}>

        {/* Mobile drag indicator */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-zinc-700 rounded-full sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
              <i className="ri-vip-crown-line text-white text-lg" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Pro 업그레이드</h3>
              <p className="text-[10px] text-zinc-500">무제한 AI 생성 · 팀 워크스페이스</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer">
            <i className="ri-close-line text-lg" />
          </button>
        </div>

        {/* Step: Plan */}
        {step === 'plan' && (
          <div className="p-4 md:p-6 space-y-4 md:space-y-5">
            {/* Billing toggle */}
            <div className="flex items-center gap-1 p-1 bg-zinc-800/60 border border-white/5 rounded-xl w-fit mx-auto">
              {(['monthly', 'yearly'] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setBilling(b)}
                  className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    billing === b ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {b === 'monthly' ? '월간 결제' : '연간 결제'}
                  {b === 'yearly' && <span className="px-1.5 py-px rounded-md bg-emerald-500/20 text-emerald-400 text-[9px] font-black">{saving}% 할인</span>}
                </button>
              ))}
            </div>

            {/* Price */}
            <div className="text-center py-1 md:py-2">
              <div className="flex items-end justify-center gap-2">
                <span className="text-3xl md:text-4xl font-black text-white">${price}</span>
                <span className="text-zinc-400 text-sm mb-1.5">/월</span>
                {billing === 'yearly' && (
                  <span className="text-zinc-600 text-sm mb-1.5 line-through">${originalPrice}</span>
                )}
              </div>
              {billing === 'yearly' && (
                <p className="text-xs text-zinc-500 mt-1">연간 ${price * 12} 청구 · 월 ${saving} 절약</p>
              )}
            </div>

            {/* Features */}
            <div className="grid grid-cols-2 gap-1.5 md:gap-2">
              {[
                { icon: 'ri-infinity-line',           label: '무제한 AI 생성'     },
                { icon: 'ri-hard-drive-3-line',       label: '100GB 스토리지'     },
                { icon: 'ri-team-line',               label: '팀 워크스페이스'    },
                { icon: 'ri-customer-service-2-line', label: '24시간 전담 지원'   },
                { icon: 'ri-sparkling-2-line',        label: '고급 AI 모델'       },
                { icon: 'ri-palette-line',            label: '커스텀 브랜딩'      },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2 px-2.5 md:px-3 py-2 rounded-xl bg-zinc-800/40 border border-white/5">
                  <div className="w-6 h-6 rounded-lg bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
                    <i className={`${f.icon} text-indigo-400 text-xs`} />
                  </div>
                  <span className="text-xs text-zinc-300 font-medium truncate">{f.label}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={() => setStep('contact')}
              className="w-full py-3 md:py-3.5 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <i className="ri-vip-crown-line" /> Pro 시작하기
            </button>
            <p className="text-[10px] text-zinc-600 text-center">7일 무료 체험 · 언제든 취소 가능 · 자동 갱신</p>
          </div>
        )}

        {/* Step: Contact / Inquiry */}
        {step === 'contact' && !submitted && (
          <div className="p-4 md:p-6 space-y-3 md:space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <button onClick={() => setStep('plan')} className="text-zinc-500 hover:text-white cursor-pointer transition-colors">
                <i className="ri-arrow-left-line text-sm" />
              </button>
              <span className="text-sm font-bold text-white">업그레이드 신청</span>
            </div>

            {/* Order summary */}
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-zinc-800/50 border border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                  <i className="ri-vip-crown-line text-white text-xs" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Pro Plan · {billing === 'yearly' ? '연간' : '월간'}</p>
                  <p className="text-[10px] text-zinc-500">{billing === 'yearly' ? '7일 무료 후 연간 청구' : '7일 무료 후 월간 청구'}</p>
                </div>
              </div>
              <span className="text-sm font-black text-white">${price}<span className="text-zinc-500 text-xs font-normal">/월</span></span>
            </div>

            {/* Notice */}
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
              <i className="ri-information-line text-amber-400 text-sm mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-400 mb-0.5">결제 안내</p>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  현재 인앱 결제 시스템 준비 중입니다. 아래 정보를 입력하시면 담당자가 결제 링크를 이메일로 보내드립니다.
                </p>
              </div>
            </div>

            {/* Form */}
            <form data-readdy-form onSubmit={handleSubmitInquiry} className="space-y-2.5 md:space-y-3">
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1.5">이름 *</label>
                <input
                  type="text"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full bg-zinc-800/60 border border-white/8 rounded-xl px-4 py-2.5 md:py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1.5">이메일 *</label>
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-zinc-800/60 border border-white/8 rounded-xl px-4 py-2.5 md:py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/40 transition-colors"
                />
              </div>
              {submitError && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                  <i className="ri-error-warning-line text-red-400 text-xs" />
                  <p className="text-xs text-red-400">{submitError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 md:py-3.5 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 전송 중...</>
                ) : (
                  <><i className="ri-mail-send-line" /> 업그레이드 신청하기</>
                )}
              </button>
              <p className="text-[10px] text-zinc-600 text-center">영업일 기준 1일 이내 이메일로 결제 링크를 보내드립니다</p>
            </form>
          </div>
        )}

        {/* Submitted */}
        {step === 'contact' && submitted && (
          <div className="p-6 md:p-8 flex flex-col items-center gap-4 md:gap-5 text-center">
            <div className="relative">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 flex items-center justify-center">
                <i className="ri-mail-check-line text-3xl md:text-4xl text-indigo-400" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-zinc-900">
                <i className="ri-check-line text-white text-xs" />
              </div>
            </div>
            <div>
              <h4 className="text-xl font-black text-white mb-1">신청 완료!</h4>
              <p className="text-sm text-zinc-400 leading-relaxed">
                <span className="text-indigo-400 font-bold">{email}</span>으로<br />
                결제 링크를 보내드릴게요.
              </p>
            </div>
            <div className="w-full px-4 py-3 rounded-xl bg-indigo-500/8 border border-indigo-500/20 text-left space-y-1.5">
              <div className="flex items-center gap-2">
                <i className="ri-time-line text-indigo-400 text-xs" />
                <p className="text-xs text-zinc-400">영업일 기준 <span className="text-white font-bold">1일 이내</span> 이메일 발송</p>
              </div>
              <div className="flex items-center gap-2">
                <i className="ri-gift-line text-indigo-400 text-xs" />
                <p className="text-xs text-zinc-400"><span className="text-white font-bold">7일 무료 체험</span> 자동 적용</p>
              </div>
              <div className="flex items-center gap-2">
                <i className="ri-shield-check-line text-indigo-400 text-xs" />
                <p className="text-xs text-zinc-400">언제든 <span className="text-white font-bold">취소 가능</span></p>
              </div>
            </div>
            <button onClick={onClose} className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-bold text-sm rounded-xl transition-all cursor-pointer">
              확인
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function AIShortcutsPage() {
  const [activeTab, setActiveTab]         = useState<'shortcuts' | 'subscriptions'>('shortcuts');
  const [searchQuery, setSearchQuery]     = useState('');
  const [showAddModal, setShowAddModal]   = useState(false);
  const [showProModal, setShowProModal]   = useState(false);
  const [activeCatId, setActiveCatId]     = useState<string | null>(null);

  // ── SEO: 페이지 타이틀 & 메타 설정 ──────────────────────────────────
  useEffect(() => {
    document.title = 'AI Shortcuts — AI 서비스 바로가기 허브 | AiMetaWOW';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', 'ChatGPT, Midjourney, ElevenLabs, Runway 등 인기 AI 서비스를 한 곳에서 바로 접근하세요. 나만의 AI 서비스 바로가기를 커스터마이징하고 구독 플랜을 관리하세요.');
    }
    return () => {
      document.title = 'AiMetaWOW — AI 이미지·영상·음성 생성 크리에이티브 플랫폼';
    };
  }, []);

  const { customServices, addServices, removeService, isAdded } = useCustomServices();
  const { saveOrder, saveCategorySequence, getSortedTools, getSortedCategories } = useShortcutOrder();

  // ── Merged categories (mock + custom) ──
  const baseMergedCategories = shortcutCategories.map((cat) => {
    const customs = customServices
      .filter((cs) => cs.categoryId === cat.id)
      .map((cs) => ({ ...cs, isCustom: true as const }));
    return {
      ...cat,
      tools: [
        ...cat.tools.map((t) => ({ ...t, isCustom: false as const })),
        ...customs,
      ],
    };
  });

  // ── Category order state ──
  const [orderedCategories, setOrderedCategories] = useState(() =>
    getSortedCategories(baseMergedCategories)
  );

  // ── Per-category tool order state ──
  const [categoryToolsMap, setCategoryToolsMap] = useState<
    Record<string, (ShortcutTool & { isCustom?: boolean })[]>
  >(() => {
    const init: Record<string, (ShortcutTool & { isCustom?: boolean })[]> = {};
    baseMergedCategories.forEach((cat) => {
      init[cat.id] = getSortedTools(cat.id, cat.tools);
    });
    return init;
  });

  // Sync when customServices change (new service added / removed)
  useEffect(() => {
    const updated = shortcutCategories.map((cat) => {
      const customs = customServices
        .filter((cs) => cs.categoryId === cat.id)
        .map((cs) => ({ ...cs, isCustom: true as const }));
      return {
        ...cat,
        tools: [
          ...cat.tools.map((t) => ({ ...t, isCustom: false as const })),
          ...customs,
        ],
      };
    });

    setOrderedCategories((prev) => {
      const prevIds = new Set(prev.map((c) => c.id));
      const newCats = updated.filter((c) => !prevIds.has(c.id));
      const merged = prev.map((c) => updated.find((u) => u.id === c.id) ?? c);
      return [...merged, ...newCats];
    });

    setCategoryToolsMap((prev) => {
      const next = { ...prev };
      updated.forEach((cat) => {
        if (next[cat.id]) {
          const existingNames = new Set(next[cat.id].map((t) => t.name));
          const newTools = cat.tools.filter((t) => !existingNames.has(t.name));
          // Remove deleted custom tools
          const filtered = next[cat.id].filter((t) =>
            cat.tools.some((ct) => ct.name === t.name)
          );
          next[cat.id] = [...filtered, ...newTools];
        } else {
          next[cat.id] = getSortedTools(cat.id, cat.tools);
        }
      });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customServices]);

  // ── Category-level DnD sensors — TouchSensor 추가 ──
  const catSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 10 } })
  );

  const handleCatDragStart = (event: DragStartEvent) => {
    setActiveCatId(event.active.id as string);
  };

  const handleCatDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCatId(null);
    if (!over || active.id === over.id) return;

    setOrderedCategories((prev) => {
      const oldIdx = prev.findIndex((c) => c.id === active.id);
      const newIdx = prev.findIndex((c) => c.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      const reordered = arrayMove(prev, oldIdx, newIdx);
      saveCategorySequence(reordered.map((c) => c.id));
      return reordered;
    });
  };

  // ── Tool reorder callback (from child) ──
  const handleToolsReorder = (
    categoryId: string,
    reordered: (ShortcutTool & { isCustom?: boolean })[]
  ) => {
    setCategoryToolsMap((prev) => ({ ...prev, [categoryId]: reordered }));
    saveOrder(categoryId, reordered.map((t) => t.name));
  };

  // Active category for overlay
  const activeCat = activeCatId
    ? orderedCategories.find((c) => c.id === activeCatId)
    : null;

  // Filtered category ids for search
  const visibleCategoryIds = orderedCategories
    .filter((cat) => {
      if (!searchQuery) return true;
      const tools = categoryToolsMap[cat.id] ?? cat.tools;
      return tools.some(
        (t) =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.desc.toLowerCase().includes(searchQuery.toLowerCase())
      );
    })
    .map((c) => c.id);

  const handleAddServices = (services: typeof POPULAR_SERVICES) => {
    addServices(services.map((s) => ({
      name: s.name,
      url: s.url,
      icon: s.icon,
      color: s.color,
      bg: s.bg,
      border: s.border,
      categoryId: s.categoryId,
      desc: s.desc,
    })));
  };

  return (
    <div className="h-screen bg-[#0a0a0b] text-white flex flex-col overflow-hidden">
      <AppNavbar />

      <main className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-5xl mx-auto px-3 md:px-6 py-4 md:py-8 pb-20 md:pb-8">

          {/* Tab header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 md:mb-8">
            <div className="flex items-center gap-1 bg-zinc-900/80 border border-zinc-800 p-1 rounded-2xl self-start">
              <button
                onClick={() => setActiveTab('shortcuts')}
                className={`flex items-center gap-2 px-3 md:px-4 py-2 text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap outline-none focus:outline-none border ${
                  activeTab === 'shortcuts'
                    ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/20'
                    : 'text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 border-transparent'
                }`}
              >
                <i className="ri-flashlight-line" /> AI Shortcuts
                {customServices.length > 0 && (
                  <span className="text-[9px] bg-indigo-500/30 text-indigo-300 px-1.5 py-0.5 rounded-full font-black">
                    +{customServices.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('subscriptions')}
                className={`flex items-center gap-2 px-3 md:px-4 py-2 text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap outline-none focus:outline-none border ${
                  activeTab === 'subscriptions'
                    ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/20'
                    : 'text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 border-transparent'
                }`}
              >
                <i className="ri-file-list-3-line" /> <span className="hidden sm:inline">AI </span>Subscriptions
              </button>
            </div>

            {activeTab === 'shortcuts' && (
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:flex-none">
                  <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="서비스 검색..."
                    className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm pl-8 pr-4 py-2 rounded-xl outline-none focus:border-indigo-500/40 transition-colors placeholder-zinc-600 w-full sm:w-40 md:w-48"
                  />
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/25 text-indigo-400 text-sm font-bold px-3 md:px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap flex-shrink-0"
                >
                  <i className="ri-add-line" /> <span className="hidden sm:inline">서비스 </span>추가
                </button>
              </div>
            )}
          </div>

          {/* ── Shortcuts Tab ── */}
          {activeTab === 'shortcuts' && (
            <DndContext
              sensors={catSensors}
              collisionDetection={closestCenter}
              onDragStart={handleCatDragStart}
              onDragEnd={handleCatDragEnd}
            >
              <SortableContext
                items={orderedCategories.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-6 md:gap-10">
                  {orderedCategories
                    .filter((cat) => visibleCategoryIds.includes(cat.id))
                    .map((category) => (
                      <SortableCategorySection
                        key={category.id}
                        categoryId={category.id}
                        label={category.label}
                        tools={categoryToolsMap[category.id] ?? category.tools}
                        searchQuery={searchQuery}
                        onToolsReorder={handleToolsReorder}
                        onRemoveTool={removeService}
                        onAddClick={() => setShowAddModal(true)}
                      />
                    ))}

                  {visibleCategoryIds.length === 0 && (
                    <EmptyState
                      icon="ri-search-line"
                      title="검색 결과가 없습니다"
                      description={`"${searchQuery}"에 해당하는 서비스를 찾을 수 없어요`}
                      size="lg"
                      actions={[
                        { label: '검색 초기화', onClick: () => setSearchQuery(''), icon: 'ri-close-line', variant: 'ghost' },
                        { label: '서비스 추가', onClick: () => setShowAddModal(true), icon: 'ri-add-line' },
                      ]}
                    />
                  )}
                </div>
              </SortableContext>

              {/* Category drag overlay */}
              <DragOverlay>
                {activeCat ? (
                  <SortableCategorySection
                    categoryId={activeCat.id}
                    label={activeCat.label}
                    tools={categoryToolsMap[activeCat.id] ?? activeCat.tools}
                    searchQuery=""
                    isDragOverlay
                    onToolsReorder={() => {}}
                    onRemoveTool={() => {}}
                    onAddClick={() => {}}
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          )}

          {/* ── Subscriptions Tab ── */}
          {activeTab === 'subscriptions' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
              {/* Current plan */}
              <div className="lg:col-span-2 bg-zinc-900/50 border border-white/5 rounded-2xl p-4 md:p-6">
                <div className="flex items-start sm:items-center justify-between mb-4 md:mb-5 gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-full font-bold">현재 플랜</span>
                    </div>
                    <h2 className="text-lg md:text-xl font-bold text-white">Free Plan</h2>
                    <p className="text-zinc-500 text-sm mt-0.5">기본 기능을 무료로 사용 중</p>
                  </div>
                  <button
                    onClick={() => setShowProModal(true)}
                    className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold text-sm px-4 md:px-5 py-2 md:py-2.5 rounded-xl hover:from-indigo-400 hover:to-violet-400 transition-all cursor-pointer whitespace-nowrap flex-shrink-0"
                  >
                    업그레이드
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {planFeatures.map((f) => (
                    <div key={f.label} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      f.included ? 'bg-indigo-500/5 border-indigo-500/15' : 'bg-zinc-800/30 border-white/5 opacity-50'
                    }`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${f.included ? 'bg-indigo-500/20' : 'bg-zinc-800'}`}>
                        <i className={`${f.icon} text-sm ${f.included ? 'text-indigo-400' : 'text-zinc-600'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold truncate ${f.included ? 'text-white' : 'text-zinc-500'}`}>{f.label}</p>
                        <p className="text-[10px] text-zinc-600 truncate">{f.desc}</p>
                      </div>
                      <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                        {f.included
                          ? <i className="ri-check-line text-indigo-400 text-xs" />
                          : <i className="ri-lock-line text-zinc-700 text-xs" />
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pro CTA */}
              <div className="bg-gradient-to-b from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 rounded-2xl p-4 md:p-6 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-lg flex items-center justify-center">
                    <i className="ri-vip-crown-line text-white text-sm" />
                  </div>
                  <span className="text-sm font-bold text-white">Pro Plan</span>
                </div>
                <div className="mb-4">
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-3xl font-black text-white">$23</span>
                    <span className="text-zinc-400 text-sm mb-1">/월</span>
                    <span className="text-zinc-600 text-sm mb-1 line-through ml-1">$29</span>
                  </div>
                  <p className="text-xs text-zinc-400">연간 결제 시 20% 할인</p>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 mb-5 md:mb-6 flex-1">
                  {['무제한 AI 생성', '100GB 스토리지', '팀 워크스페이스', '우선 고객 지원', '고급 AI 모델 접근', '커스텀 브랜딩'].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <i className="ri-check-line text-indigo-400 text-xs" />
                      <span className="text-xs text-zinc-300">{item}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setShowProModal(true)}
                  className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-bold text-sm rounded-xl transition-all cursor-pointer"
                >
                  Pro 시작하기
                </button>
                <p className="text-[10px] text-zinc-600 text-center mt-2">7일 무료 체험 · 언제든 취소 가능</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {showAddModal && (
        <AddServiceModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddServices}
          alreadyAdded={isAdded}
        />
      )}
      {showProModal && <ProUpgradeModal onClose={() => setShowProModal(false)} />}
    </div>
  );
}
