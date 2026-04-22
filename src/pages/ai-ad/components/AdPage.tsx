import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { tvcTemplates, TvcTemplate } from '@/mocks/tvcSamples';
import AdSidebar from './AdSidebar';
import TemplateCard from './TemplateCard';
import AdDetailModal, { GenerationResult } from './AdDetailModal';
import SnsExportModal from './SnsExportModal';
import DiagnosticPanel from './DiagnosticPanel';
import VideoGenTestPanel from './VideoGenTestPanel';
import VtonModal from './VtonModal';
import MultiShotModal from './MultiShotModal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

type AdTab = '템플릿' | '내 작업';

// Fix 3: 실제 tvcTemplates 데이터에서 태그 동적 추출
const ALL_TAGS = ['전체', ...Array.from(new Set(tvcTemplates.flatMap((t) => t.tags)))];

const SESSION_KEY = 'ai_ad_session_id';
function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `ad_sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

interface MyWorkItem {
  id: string;
  result: GenerationResult;
  title: string;
  createdAt: string;
}

function MyWorksEmpty({ onGoToTemplates }: { onGoToTemplates: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-5">
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-zinc-800/60 flex items-center justify-center">
          <i className="ri-film-line text-3xl text-zinc-700" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center">
          <i className="ri-add-line text-white text-xs" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-black text-zinc-300">아직 작업한 광고가 없습니다</p>
        <p className="text-xs text-zinc-600 mt-1.5 leading-relaxed">
          템플릿을 선택해서 첫 번째 AI 광고를 만들어보세요
        </p>
      </div>
      <button
        onClick={onGoToTemplates}
        className="flex items-center gap-2 bg-gradient-to-r from-rose-500/20 to-orange-500/20 hover:from-rose-500/30 hover:to-orange-500/30 border border-rose-500/30 text-rose-400 text-sm font-black px-5 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap"
      >
        <i className="ri-layout-grid-line" /> 템플릿 선택하기
      </button>
    </div>
  );
}

// Fix 5: 내 작업 상세 미리보기 모달 (삭제 버튼 포함)
function WorkPreviewModal({ work, onClose, onDelete }: { work: MyWorkItem; onClose: () => void; onDelete: (id: string) => void }) {
  const [snsExportOpen, setSnsExportOpen] = useState(false);

  const handleDownload = async () => {
    try {
      const response = await fetch(work.result.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const ext = work.result.type === 'video' ? 'mp4' : work.result.fmt.toLowerCase();
      a.download = `ad_${work.title.replace(/\s+/g, '_')}_${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(work.result.url, '_blank');
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-3xl max-h-[90vh] rounded-2xl overflow-hidden bg-[#111114] border border-white/10 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <span className={`flex-shrink-0 text-[10px] font-black px-2.5 py-1 rounded-full ${
                work.result.type === 'image' ? 'bg-rose-500/20 text-rose-300' : 'bg-orange-500/20 text-orange-300'
              }`}>
                {work.result.type === 'image' ? 'IMAGE' : 'VIDEO'}
              </span>
              <p className="text-sm font-black text-white truncate">{work.title}</p>
              <span className="flex-shrink-0 text-xs text-zinc-500">
                {new Date(work.createdAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-800/60 border border-white/[0.06] hover:bg-zinc-700 flex items-center justify-center cursor-pointer transition-all ml-3"
            >
              <i className="ri-close-line text-zinc-400 text-sm" />
            </button>
          </div>

          {/* Media */}
          <div className="flex-1 overflow-hidden bg-black flex items-center justify-center" style={{ minHeight: '300px', maxHeight: '60vh' }}>
            {work.result.type === 'video' ? (
              <video
                src={work.result.url}
                className="w-full h-full object-contain"
                autoPlay
                muted
                loop
                playsInline
                controls
              />
            ) : (
              <img
                src={work.result.url}
                alt={work.title}
                className="w-full h-full object-contain"
              />
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-5 py-4 border-t border-white/[0.06] flex items-center gap-3 flex-wrap">
            {/* 메타 정보 */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
                <i className="ri-aspect-ratio-line text-xs" />
                {work.result.ratio}
              </div>
              <div className="w-px h-3 bg-zinc-700" />
              <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
                <i className="ri-hd-line text-xs" />
                {work.result.res}
              </div>
              <div className="w-px h-3 bg-zinc-700" />
              <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
                <i className="ri-file-image-line text-xs" />
                {work.result.fmt}
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <button
                onClick={() => { onDelete(work.id); onClose(); }}
                className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-black px-3 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap"
              >
                <i className="ri-delete-bin-line" /> 삭제
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 border border-white/[0.06] text-white text-xs font-black px-3 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap"
              >
                <i className="ri-download-line" /> 다운로드
              </button>
              <button
                onClick={() => setSnsExportOpen(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 text-white text-xs font-black px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap"
              >
                <i className="ri-share-forward-line" /> SNS 내보내기
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SNS 내보내기 모달 */}
      {snsExportOpen && (
        <SnsExportModal
          url={work.result.url}
          type={work.result.type}
          title={work.title}
          originalRatio={work.result.ratio}
          onClose={() => setSnsExportOpen(false)}
        />
      )}
    </>
  );
}

// Fix 3: 비디오 카드 — hover 시 재생, 마우스 떠나면 정지
function WorkCard({ work, onDelete, onPreview }: { work: MyWorkItem; onDelete: (id: string) => void; onPreview: (work: MyWorkItem) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleMouseEnter = () => {
    if (work.result.type === 'video' && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    if (work.result.type === 'video' && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <div
      className="bg-zinc-900/80 border border-zinc-800/60 rounded-2xl overflow-hidden group cursor-pointer hover:border-rose-500/30 transition-all"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onPreview(work)}
    >
      <div className="relative h-[110px] sm:h-[130px] overflow-hidden">
        {work.result.type === 'video' ? (
          <video
            ref={videoRef}
            src={work.result.url}
            className="w-full h-full object-cover object-top"
            muted
            playsInline
            loop
            preload="metadata"
          />
        ) : (
          <img
            src={work.result.url}
            alt={work.title}
            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute top-2 left-2">
          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
            work.result.type === 'image'
              ? 'bg-rose-500/80 text-white'
              : 'bg-orange-500/80 text-white'
          }`}>
            {work.result.type === 'image' ? 'IMAGE' : 'VIDEO'}
          </span>
        </div>
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={async (e) => {
              e.stopPropagation();
              try {
                const response = await fetch(work.result.url);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                const ext = work.result.type === 'video' ? 'mp4' : work.result.fmt.toLowerCase();
                a.download = `ad_${work.title.replace(/\s+/g, '_')}_${Date.now()}.${ext}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
              } catch {
                window.open(work.result.url, '_blank');
              }
            }}
            className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:bg-white/30 transition-colors"
          >
            <i className="ri-download-line text-white text-sm" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(work.id);
            }}
            className="w-9 h-9 rounded-full bg-red-500/20 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:bg-red-500/30 transition-colors"
          >
            <i className="ri-delete-bin-line text-red-400 text-sm" />
          </button>
        </div>
      </div>
      {/* Fix 4: 날짜 표시 추가 */}
      <div className="p-3">
        <p className="text-xs font-black text-white truncate">{work.title}</p>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-[10px] text-zinc-500">{work.result.ratio} · {work.result.res}</p>
          <p className="text-[9px] text-zinc-600">
            {new Date(work.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<AdTab>('템플릿');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTag, setActiveTag] = useState('전체');
  const [productName, setProductName] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [productThumb, setProductThumb] = useState<string | null>(null);
  // Fix 5: 사이드바 내 제품 이미지를 AdDetailModal에 전달하기 위해 AdPage에서 관리
  const [sidebarProducts, setSidebarProducts] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('none');
  const [modelOpen, setModelOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TvcTemplate | null>(null);
  const [savedToast, setSavedToast] = useState(false);
  const [myWorks, setMyWorks] = useState<MyWorkItem[]>([]);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [worksLoading, setWorksLoading] = useState(false);
  // Fix 3: 삭제 확인 모달
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  // Fix 3: 내 작업 미리보기 모달
  const [previewWork, setPreviewWork] = useState<MyWorkItem | null>(null);
  // 진단 패널
  const [diagOpen, setDiagOpen] = useState(false);
  const [videoTestOpen, setVideoTestOpen] = useState(false);
  const [vtonOpen, setVtonOpen] = useState(false);
  const [multiShotOpen, setMultiShotOpen] = useState(false);

  // DB에서 내 작업 로드
  const loadMyWorks = useCallback(async () => {
    setWorksLoading(true);
    try {
      const sessionId = getSessionId();

      let query = supabase
        .from('ad_works')
        .select('id, title, template_title, result_type, result_url, ratio, resolution, format, product_name, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      // 로그인 사용자: user_id OR session_id 둘 다 조회
      // 비로그인: session_id만 조회
      if (profile?.id) {
        query = query.or(`user_id.eq.${profile.id},session_id.eq.${sessionId}`);
      } else {
        query = query.eq('session_id', sessionId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[AdPage] loadMyWorks error:', error.message, error.details);
        return;
      }

      console.log(`[AdPage] loadMyWorks: ${data?.length ?? 0}개 로드됨`);

      const loaded: MyWorkItem[] = (data ?? [])
        .filter((row) => row.result_url && row.result_url !== 'https://example.com/test.jpg') // 테스트 더미 제외
        .map((row) => ({
          id: row.id,
          title: row.template_title ?? row.title ?? '광고 작업',
          createdAt: row.created_at,
          result: {
            type: (row.result_type ?? 'image') as 'image' | 'video',
            url: row.result_url,
            ratio: (row.ratio ?? '16:9') as '16:9' | '9:16' | '1:1',
            res: (row.resolution ?? '1K') as '1K' | '2K' | '4K',
            fmt: (row.format ?? 'PNG') as 'PNG' | 'JPG' | 'WEBP',
          },
        }));

      setMyWorks(loaded);
    } catch (err) {
      console.error('[AdPage] loadMyWorks exception:', err);
    } finally {
      setWorksLoading(false);
    }
  }, [profile?.id]);

  // 초기 로드
  useEffect(() => {
    loadMyWorks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 내 작업 탭 전환 시 DB 재로드 (Edge Function에서 저장된 최신 데이터 반영)
  useEffect(() => {
    if (activeTab === '내 작업') {
      loadMyWorks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Fix 3: useMemo로 필터링 최적화
  const filteredTemplates = useMemo(() =>
    activeTag === '전체'
      ? tvcTemplates
      : tvcTemplates.filter((t) => t.tags.includes(activeTag)),
    [activeTag]
  );

  const handleSave = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
    setMobileSettingsOpen(false);
  };

  const handleAddToMyWorks = (result: GenerationResult) => {
    const itemId = result.dbId ?? `work_${Date.now()}`;
    // result.templateTitle 우선 사용 → selectedTemplate null 타이밍 버그 방지
    const workTitle = result.templateTitle ?? selectedTemplate?.title ?? '광고 작업';
    setMyWorks((prev) => {
      const alreadyExists = result.dbId ? prev.some((w) => w.id === result.dbId) : false;
      if (alreadyExists) return prev;
      const newItem: MyWorkItem = {
        id: itemId,
        result,
        title: workTitle,
        createdAt: new Date().toISOString(),
      };
      return [newItem, ...prev];
    });
    // savedToast만 표시, 탭 전환은 모달 닫힐 때 onClose에서 처리
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  // Fix 3: 삭제 확인 후 실행
  const handleDeleteWork = async (workId: string) => {
    setDeleteConfirmId(workId);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    setMyWorks((prev) => prev.filter((w) => w.id !== id));
    try {
      await supabase.from('ad_works').delete().eq('id', id);
    } catch {
      // 조용히 실패
    }
  };

  return (
    <div
      className="flex h-full overflow-hidden bg-[#0a0a0b]"
      onClick={() => setModelOpen(false)}
    >
      {/* ── Left sidebar — desktop only ── */}
      <div className="hidden md:block w-[272px] flex-shrink-0 border-r border-zinc-800/50">
        <AdSidebar
          productName={productName}
          setProductName={setProductName}
          productDesc={productDesc}
          setProductDesc={setProductDesc}
          productThumb={productThumb}
          onThumbUpload={setProductThumb}
          sidebarProducts={sidebarProducts}
          setSidebarProducts={setSidebarProducts}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          modelOpen={modelOpen}
          setModelOpen={setModelOpen}
          onSave={handleSave}
        />
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex-shrink-0 px-5 md:px-6 border-b border-zinc-800/50 min-h-[56px] flex items-center gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-1">
            {(['템플릿', '내 작업'] as AdTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => { if (!isGenerating) setActiveTab(tab); }}
                disabled={isGenerating}
                className={`flex items-center gap-1.5 px-3 md:px-4 py-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap outline-none focus:outline-none border ${
                  isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                } ${
                  activeTab === tab
                    ? 'bg-gradient-to-r from-rose-500/20 to-orange-500/20 text-rose-300 border-rose-500/20'
                    : 'text-zinc-400 hover:text-white border-transparent'
                }`}
              >
                <i className={activeTab === tab
                  ? (tab === '템플릿' ? 'ri-layout-grid-fill' : 'ri-folder-fill')
                  : (tab === '템플릿' ? 'ri-layout-grid-line' : 'ri-folder-line')}
                />
                {tab}
                {tab === '내 작업' && myWorks.length > 0 && (
                  <span className="bg-rose-500/30 text-rose-300 text-[10px] px-1.5 py-0.5 rounded-full font-black">
                    {myWorks.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Stats / 생성 중 배너 */}
          {isGenerating ? (
            <div className="hidden md:flex items-center gap-2 ml-2 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              <span className="text-[11px] text-rose-300 font-black">AI 광고 생성 중... 잠시 기다려주세요</span>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-3 ml-2">
              <div className="flex items-center gap-1.5 text-zinc-600">
                <i className="ri-layout-grid-line text-xs" />
                <span className="text-[11px]">{tvcTemplates.length}개 템플릿</span>
              </div>
              <div className="w-px h-3 bg-zinc-800" />
              <div className="flex items-center gap-1.5 text-zinc-600">
                <i className="ri-sparkling-2-line text-xs" />
                <span className="text-[11px]">이미지 + 동영상 생성</span>
              </div>
            </div>
          )}

          {/* 진단 버튼 */}
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setDiagOpen(true)}
              className="flex items-center gap-1.5 bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/40 text-zinc-400 hover:text-zinc-200 text-[11px] font-black px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap"
              title="생성 오류 진단"
            >
              <i className="ri-stethoscope-line text-xs" />
              <span className="hidden sm:inline">진단</span>
            </button>
          </div>

          {/* Mobile settings button */}
          <button
            onClick={() => setMobileSettingsOpen(true)}
            className="md:hidden ml-auto flex items-center gap-1.5 bg-zinc-800/60 border border-white/[0.06] text-zinc-300 text-xs font-black px-3 py-2 rounded-xl cursor-pointer whitespace-nowrap"
          >
            <i className="ri-settings-3-line" /> 광고 설정
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 md:px-6 py-5">
          {activeTab === '템플릿' ? (
            <>
              {/* Section header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 flex items-center justify-center">
                      <i className="ri-sparkling-2-fill text-rose-400 text-sm" />
                    </div>
                    <h2 className="text-sm font-black text-white">TVC 광고 템플릿</h2>
                  </div>
                  <p className="text-[11px] text-zinc-500 pl-7">
                    {filteredTemplates.length}개의 광고 스타일 중 선택하세요
                  </p>
                </div>
              </div>

              {/* Tag filters */}
              <div className="flex items-center gap-1.5 flex-wrap mb-5">
                {ALL_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(tag)}
                    className={`px-3 py-1 rounded-full text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
                      activeTag === tag
                        ? 'bg-gradient-to-r from-rose-500/20 to-orange-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-zinc-900/60 border border-zinc-800/60 text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {/* 멀티샷 특별 카드 */}
              <div
                onClick={() => setMultiShotOpen(true)}
                className="mb-3 w-full flex items-center gap-4 bg-gradient-to-r from-sky-500/10 via-emerald-500/10 to-teal-500/10 border border-sky-500/25 rounded-2xl px-5 py-4 cursor-pointer hover:border-sky-500/50 hover:from-sky-500/15 hover:via-emerald-500/15 hover:to-teal-500/15 transition-all group"
              >
                <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/30 to-emerald-500/30 border border-sky-500/30 flex-shrink-0 group-hover:scale-105 transition-transform">
                  <i className="ri-film-line text-sky-400 text-xl" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="text-sm font-black text-white">AI 멀티샷 영상 (Multi-Shot Creator)</p>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30">NEW</span>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">180 CR</span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    프롬프트 하나 → Claude가 3개 샷 설계 → Kling이 각 샷 영상 생성 → 자동 합치기 · 최대 15초 시네마틱 영상
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="flex flex-col gap-1 text-[9px] text-zinc-600 hidden sm:flex">
                    <span className="flex items-center gap-1"><i className="ri-sparkling-2-line text-amber-400" /> Claude Opus</span>
                    <span className="flex items-center gap-1"><i className="ri-image-line text-sky-400" /> FLUX Schnell</span>
                    <span className="flex items-center gap-1"><i className="ri-movie-line text-emerald-400" /> Kling × 3</span>
                  </div>
                  <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-sky-500/20 border border-sky-500/30 group-hover:bg-sky-500/30 transition-colors ml-2">
                    <i className="ri-arrow-right-line text-sky-400 text-sm" />
                  </div>
                </div>
              </div>

              {/* VTON 특별 카드 */}
              <div
                onClick={() => setVtonOpen(true)}
                className="mb-4 w-full flex items-center gap-4 bg-gradient-to-r from-violet-500/10 via-pink-500/10 to-rose-500/10 border border-violet-500/25 rounded-2xl px-5 py-4 cursor-pointer hover:border-violet-500/50 hover:from-violet-500/15 hover:via-pink-500/15 hover:to-rose-500/15 transition-all group"
              >
                <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-pink-500/30 border border-violet-500/30 flex-shrink-0 group-hover:scale-105 transition-transform">
                  <i className="ri-t-shirt-2-line text-violet-400 text-xl" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="text-sm font-black text-white">AI 가상 피팅 (Virtual Try-On)</p>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30">NEW</span>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">133 CR</span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    모델 이미지 + 의상 이미지 → AI가 실제로 입어보는 영상 자동 생성 · fal-vton 워크플로우
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="flex flex-col gap-1 text-[9px] text-zinc-600 hidden sm:flex">
                    <span className="flex items-center gap-1"><i className="ri-t-shirt-2-line text-violet-400" /> fashn/tryon</span>
                    <span className="flex items-center gap-1"><i className="ri-sparkling-2-line text-pink-400" /> Claude 3.7</span>
                    <span className="flex items-center gap-1"><i className="ri-movie-line text-rose-400" /> Seedance v1</span>
                  </div>
                  <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-violet-500/20 border border-violet-500/30 group-hover:bg-violet-500/30 transition-colors ml-2">
                    <i className="ri-arrow-right-line text-violet-400 text-sm" />
                  </div>
                </div>
              </div>

              {/* Template grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredTemplates.map((tpl) => (
                  <TemplateCard key={tpl.id} tpl={tpl} onSelect={setSelectedTemplate} />
                ))}
              </div>
            </>
          ) : (
            // Fix 5: worksLoading 체크를 최상단으로 올려서 조건 순서 문제 해결
            worksLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-zinc-900/60 border border-zinc-800/40 rounded-2xl overflow-hidden animate-pulse">
                    <div className="h-[110px] sm:h-[130px] bg-zinc-800/60" />
                    <div className="p-3 space-y-1.5">
                      <div className="h-3 bg-zinc-800/60 rounded w-3/4" />
                      <div className="h-2.5 bg-zinc-800/40 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : myWorks.length === 0 ? (
              <MyWorksEmpty onGoToTemplates={() => setActiveTab('템플릿')} />
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className="ri-folder-fill text-rose-400 text-sm" />
                  </div>
                  <h2 className="text-sm font-black text-white">내 작업</h2>
                  <span className="text-xs text-zinc-500">{myWorks.length}개</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
                  {myWorks.map((work) => (
                    <WorkCard key={work.id} work={work} onDelete={handleDeleteWork} onPreview={setPreviewWork} />
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* ── Ad Detail Modal ── */}
      {selectedTemplate && (
        <AdDetailModal
          template={selectedTemplate}
          productName={productName}
          productDesc={productDesc}
          sidebarProducts={sidebarProducts}
          onClose={() => {
            setSelectedTemplate(null);
            setIsGenerating(false);
            // 모달 닫힐 때 항상 내 작업 탭으로 이동 + DB 재로드 (생성 완료 여부 무관)
            setActiveTab('내 작업');
            loadMyWorks();
          }}
          onAddToMyWorks={handleAddToMyWorks}
          onGeneratingChange={setIsGenerating}
        />
      )}

      {/* ── Mobile Settings Drawer ── */}
      {mobileSettingsOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileSettingsOpen(false)}
          />
          <div className="relative bg-[#111113] border-t border-white/10 rounded-t-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
              <div className="flex items-center gap-2">
                <i className="ri-advertisement-line text-rose-400" />
                <span className="text-sm font-black text-white">광고 설정</span>
              </div>
              <button
                onClick={() => setMobileSettingsOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-800/60 text-zinc-400 cursor-pointer"
              >
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <AdSidebar
                productName={productName}
                setProductName={setProductName}
                productDesc={productDesc}
                setProductDesc={setProductDesc}
                productThumb={productThumb}
                onThumbUpload={setProductThumb}
                sidebarProducts={sidebarProducts}
                setSidebarProducts={setSidebarProducts}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                modelOpen={modelOpen}
                setModelOpen={setModelOpen}
                onSave={handleSave}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Save toast ── */}
      {savedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2.5 bg-zinc-900 border border-emerald-500/30 text-white text-sm font-black px-5 py-3 rounded-2xl shadow-lg">
          <div className="w-5 h-5 flex items-center justify-center rounded-full bg-emerald-500/20 flex-shrink-0">
            <i className="ri-check-line text-emerald-400 text-xs" />
          </div>
          <span>내 작업에 저장됐어요</span>
          <button
            onClick={() => setSavedToast(false)}
            className="ml-1 text-xs text-rose-400 hover:text-rose-300 cursor-pointer whitespace-nowrap font-black"
          >
            ✕
          </button>
        </div>
      )}

      {/* Fix 5: 내 작업 미리보기 모달 (삭제 버튼 포함) */}
      {previewWork && (
        <WorkPreviewModal
          work={previewWork}
          onClose={() => setPreviewWork(null)}
          onDelete={handleDeleteWork}
        />
      )}

      {/* 진단 패널 */}
      {diagOpen && <DiagnosticPanel onClose={() => setDiagOpen(false)} />}

      {/* 영상 생성 파이프라인 테스트 패널 */}
      {videoTestOpen && <VideoGenTestPanel onClose={() => setVideoTestOpen(false)} />}

      {/* VTON 가상 피팅 모달 */}
      {vtonOpen && <VtonModal onClose={() => setVtonOpen(false)} />}

      {/* 멀티샷 영상 모달 */}
      {multiShotOpen && <MultiShotModal onClose={() => setMultiShotOpen(false)} />}

      {/* Fix 3: 삭제 확인 모달 */}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            className="bg-[#1a1a1e] border border-white/10 rounded-2xl p-6 mx-4 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <i className="ri-delete-bin-line text-red-400 text-lg" />
              </div>
              <div>
                <p className="text-sm font-black text-white">작업 삭제</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">이 작업을 삭제하시겠습니까?</p>
              </div>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              삭제된 광고 작업은 복구할 수 없습니다.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-black transition-all cursor-pointer whitespace-nowrap"
              >
                취소
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-xs font-black transition-all cursor-pointer whitespace-nowrap"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
