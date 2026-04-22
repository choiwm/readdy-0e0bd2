import { useState, useCallback, useRef, useEffect } from 'react';

interface SnsExportModalProps {
  url: string;
  type: 'image' | 'video';
  title: string;
  originalRatio: string;
  onClose: () => void;
}

interface SnsFormat {
  label: string;
  ratio: string;
  width: number;
  height: number;
  desc: string;
  recommended?: boolean;
}

interface SnsPlatform {
  id: string;
  name: string;
  icon: string;
  color: string;
  bgFrom: string;
  bgTo: string;
  formats: SnsFormat[];
}

const SNS_PLATFORMS: SnsPlatform[] = [
  {
    id: 'instagram',
    name: 'Instagram',
    icon: 'ri-instagram-line',
    color: 'text-pink-400',
    bgFrom: 'from-pink-500',
    bgTo: 'to-orange-400',
    formats: [
      { label: '릴스 / 스토리', ratio: '9:16', width: 1080, height: 1920, desc: '세로형 · 최대 도달', recommended: true },
      { label: '피드 정방형', ratio: '1:1', width: 1080, height: 1080, desc: '정방형 · 피드 최적' },
      { label: '피드 가로형', ratio: '16:9', width: 1080, height: 608, desc: '가로형 · 와이드' },
    ],
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: 'ri-youtube-line',
    color: 'text-red-400',
    bgFrom: 'from-red-500',
    bgTo: 'to-red-600',
    formats: [
      { label: '유튜브 영상', ratio: '16:9', width: 1920, height: 1080, desc: '표준 HD · 메인 영상', recommended: true },
      { label: '유튜브 쇼츠', ratio: '9:16', width: 1080, height: 1920, desc: '세로형 · 쇼츠' },
    ],
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: 'ri-tiktok-line',
    color: 'text-zinc-200',
    bgFrom: 'from-zinc-700',
    bgTo: 'to-zinc-900',
    formats: [
      { label: '틱톡 영상', ratio: '9:16', width: 1080, height: 1920, desc: '세로형 · 틱톡 표준', recommended: true },
      { label: '틱톡 피드', ratio: '1:1', width: 1080, height: 1080, desc: '정방형 · 피드' },
    ],
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    icon: 'ri-twitter-x-line',
    color: 'text-zinc-200',
    bgFrom: 'from-zinc-600',
    bgTo: 'to-zinc-800',
    formats: [
      { label: '트위터 가로형', ratio: '16:9', width: 1280, height: 720, desc: '가로형 · 타임라인', recommended: true },
      { label: '트위터 정방형', ratio: '1:1', width: 1080, height: 1080, desc: '정방형' },
    ],
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: 'ri-facebook-circle-line',
    color: 'text-sky-400',
    bgFrom: 'from-sky-500',
    bgTo: 'to-sky-600',
    formats: [
      { label: '페이스북 피드', ratio: '16:9', width: 1200, height: 628, desc: '가로형 · 피드 표준', recommended: true },
      { label: '페이스북 스토리', ratio: '9:16', width: 1080, height: 1920, desc: '세로형 · 스토리' },
      { label: '페이스북 정방형', ratio: '1:1', width: 1080, height: 1080, desc: '정방형' },
    ],
  },
  {
    id: 'kakao',
    name: '카카오채널',
    icon: 'ri-kakao-talk-line',
    color: 'text-yellow-900',
    bgFrom: 'from-yellow-400',
    bgTo: 'to-yellow-500',
    formats: [
      { label: '카카오 피드', ratio: '1:1', width: 800, height: 800, desc: '정방형 · 채널 피드', recommended: true },
      { label: '카카오 배너', ratio: '16:9', width: 1200, height: 675, desc: '가로형 · 배너' },
    ],
  },
];

type CropMode = 'crop' | 'letterbox';
type DownloadState = 'idle' | 'converting' | 'done' | 'error';

/** 비율 문자열 → 숫자 */
function parseRatio(ratio: string): number {
  const [w, h] = ratio.split(':').map(Number);
  return w / h;
}

/** Canvas로 이미지 변환 (크롭 or 레터박스) */
async function convertImage(
  srcUrl: string,
  targetW: number,
  targetH: number,
  cropMode: CropMode
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d')!;

      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;
      const srcRatio = srcW / srcH;
      const tgtRatio = targetW / targetH;

      if (cropMode === 'crop') {
        // 센터 크롭: 타겟 비율로 꽉 채우고 넘치는 부분 잘라냄
        let sx: number, sy: number, sw: number, sh: number;
        if (srcRatio > tgtRatio) {
          // 원본이 더 넓음 → 높이 맞추고 좌우 크롭
          sh = srcH;
          sw = srcH * tgtRatio;
          sx = (srcW - sw) / 2;
          sy = 0;
        } else {
          // 원본이 더 좁음 → 너비 맞추고 상하 크롭
          sw = srcW;
          sh = srcW / tgtRatio;
          sx = 0;
          sy = (srcH - sh) / 2;
        }
        const drawW = targetW;
        const drawH = targetH;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, drawW, drawH);
      } else {
        // 레터박스: 원본 비율 유지 + 검정 여백
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, targetW, targetH);
        let drawW: number, drawH: number, dx: number, dy: number;
        if (srcRatio > tgtRatio) {
          drawW = targetW;
          drawH = targetW / srcRatio;
          dx = 0;
          dy = (targetH - drawH) / 2;
        } else {
          drawH = targetH;
          drawW = targetH * srcRatio;
          dx = (targetW - drawW) / 2;
          dy = 0;
        }
        ctx.drawImage(img, dx, dy, drawW, drawH);
      }

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob 실패'));
        },
        'image/jpeg',
        0.92
      );
    };
    img.onerror = () => reject(new Error('이미지 로드 실패'));
    img.src = srcUrl;
  });
}

/** 미리보기 Canvas 렌더 */
function PreviewCanvas({
  srcUrl,
  targetRatio,
  cropMode,
}: {
  srcUrl: string;
  targetRatio: string;
  cropMode: CropMode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const tgtRatioNum = parseRatio(targetRatio);
      const PREVIEW_W = 280;
      const PREVIEW_H = Math.round(PREVIEW_W / tgtRatioNum);
      canvas.width = PREVIEW_W;
      canvas.height = PREVIEW_H;
      const ctx = canvas.getContext('2d')!;
      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;
      const srcRatio = srcW / srcH;

      if (cropMode === 'crop') {
        let sx: number, sy: number, sw: number, sh: number;
        if (srcRatio > tgtRatioNum) {
          sh = srcH;
          sw = srcH * tgtRatioNum;
          sx = (srcW - sw) / 2;
          sy = 0;
        } else {
          sw = srcW;
          sh = srcW / tgtRatioNum;
          sx = 0;
          sy = (srcH - sh) / 2;
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, PREVIEW_W, PREVIEW_H);
      } else {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
        let drawW: number, drawH: number, dx: number, dy: number;
        if (srcRatio > tgtRatioNum) {
          drawW = PREVIEW_W;
          drawH = PREVIEW_W / srcRatio;
          dx = 0;
          dy = (PREVIEW_H - drawH) / 2;
        } else {
          drawH = PREVIEW_H;
          drawW = PREVIEW_H * srcRatio;
          dx = (PREVIEW_W - drawW) / 2;
          dy = 0;
        }
        ctx.drawImage(img, dx, dy, drawW, drawH);
      }
      setLoaded(true);
    };
    img.src = srcUrl;
  }, [srcUrl, targetRatio, cropMode]);

  return (
    <div className="relative flex items-center justify-center bg-zinc-950 rounded-xl overflow-hidden border border-white/[0.06]" style={{ height: '180px' }}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="max-w-full max-h-full object-contain"
        style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.2s', maxHeight: '100%', maxWidth: '100%' }}
      />
    </div>
  );
}

export default function SnsExportModal({ url, type, title, originalRatio, onClose }: SnsExportModalProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('instagram');
  const [selectedFormat, setSelectedFormat] = useState<SnsFormat | null>(null);
  const [cropMode, setCropMode] = useState<CropMode>('crop');
  const [downloadStates, setDownloadStates] = useState<Record<string, DownloadState>>({});
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkDone, setBulkDone] = useState(false);

  const platform = SNS_PLATFORMS.find((p) => p.id === selectedPlatform)!;

  // 플랫폼 변경 시 첫 번째 포맷 자동 선택
  const handleSelectPlatform = (id: string) => {
    setSelectedPlatform(id);
    const p = SNS_PLATFORMS.find((pl) => pl.id === id)!;
    setSelectedFormat(p.formats[0]);
    setDownloadStates({});
    setBulkDone(false);
  };

  // 초기 선택
  useEffect(() => {
    setSelectedFormat(platform.formats[0]);
  }, []);

  const getFormatKey = (fmt: SnsFormat) => `${selectedPlatform}_${fmt.ratio}_${fmt.label}`;

  const isRatioMatch = (fmt: SnsFormat) => fmt.ratio === originalRatio;

  /** 단일 포맷 다운로드 */
  const handleDownload = useCallback(async (fmt: SnsFormat) => {
    const key = getFormatKey(fmt);
    setDownloadStates((prev) => ({ ...prev, [key]: 'converting' }));

    try {
      const safeName = title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_가-힣]/g, '');

      if (type === 'image') {
        // 이미지: Canvas로 실제 변환
        const blob = await convertImage(url, fmt.width, fmt.height, cropMode);
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${safeName}_${selectedPlatform}_${fmt.ratio.replace(':', 'x')}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } else {
        // 영상: 원본 파일 다운로드 (브라우저 환경에서 영상 리인코딩 불가)
        const resp = await fetch(url);
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${safeName}_${selectedPlatform}_${fmt.ratio.replace(':', 'x')}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }

      setDownloadStates((prev) => ({ ...prev, [key]: 'done' }));
      setTimeout(() => setDownloadStates((prev) => ({ ...prev, [key]: 'idle' })), 3000);
    } catch {
      setDownloadStates((prev) => ({ ...prev, [key]: 'error' }));
      setTimeout(() => setDownloadStates((prev) => ({ ...prev, [key]: 'idle' })), 2500);
    }
  }, [url, type, title, selectedPlatform, cropMode]);

  /** 현재 플랫폼 전체 포맷 일괄 다운로드 */
  const handleBulkDownload = useCallback(async () => {
    setBulkLoading(true);
    for (const fmt of platform.formats) {
      await handleDownload(fmt);
      await new Promise((r) => setTimeout(r, 600));
    }
    setBulkLoading(false);
    setBulkDone(true);
    setTimeout(() => setBulkDone(false), 3000);
  }, [platform.formats, handleDownload]);

  const getRatioVisual = (ratio: string) => {
    if (ratio === '9:16') return { w: 22, h: 38 };
    if (ratio === '1:1') return { w: 32, h: 32 };
    return { w: 44, h: 26 };
  };

  const previewFormat = selectedFormat ?? platform.formats[0];

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[860px] max-h-[90vh] rounded-2xl overflow-hidden bg-[#111114] border border-white/[0.08] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-rose-500/20">
              <i className="ri-share-forward-line text-rose-400 text-sm" />
            </div>
            <div>
              <p className="text-sm font-black text-white">SNS 최적화 내보내기</p>
              <p className="text-[10px] text-zinc-500">플랫폼별 최적 비율로 자동 변환 후 다운로드</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-zinc-800/60 border border-white/[0.06] hover:bg-zinc-700 flex items-center justify-center cursor-pointer transition-all"
          >
            <i className="ri-close-line text-zinc-400 text-sm" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* ── Left: Platform selector ── */}
          <div className="w-[148px] flex-shrink-0 border-r border-white/[0.06] overflow-y-auto py-3 px-2.5 flex flex-col gap-0.5">
            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest px-2 mb-2">플랫폼 선택</p>
            {SNS_PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelectPlatform(p.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl transition-all cursor-pointer text-left ${
                  selectedPlatform === p.id
                    ? 'bg-white/[0.07] border border-white/10'
                    : 'hover:bg-white/[0.03] border border-transparent'
                }`}
              >
                <div className={`w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-br ${p.bgFrom} ${p.bgTo} flex-shrink-0`}>
                  <i className={`${p.icon} text-white text-sm`} />
                </div>
                <div className="min-w-0">
                  <p className={`text-[11px] font-black truncate ${selectedPlatform === p.id ? 'text-white' : 'text-zinc-400'}`}>
                    {p.name}
                  </p>
                  <p className="text-[9px] text-zinc-600">{p.formats.length}개 포맷</p>
                </div>
              </button>
            ))}
          </div>

          {/* ── Center: Format list ── */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-w-0">
            {/* Platform header + 일괄 다운로드 */}
            <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 flex items-center justify-center rounded-xl bg-gradient-to-br ${platform.bgFrom} ${platform.bgTo}`}>
                  <i className={`${platform.icon} text-white text-base`} />
                </div>
                <div>
                  <p className="text-sm font-black text-white">{platform.name}</p>
                  <p className="text-[10px] text-zinc-500">
                    원본 <span className="text-zinc-300 font-black">{originalRatio}</span> ·  {platform.formats.length}가지 포맷
                  </p>
                </div>
              </div>
              <button
                onClick={handleBulkDownload}
                disabled={bulkLoading}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                  bulkDone
                    ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                    : bulkLoading
                    ? 'bg-zinc-700/60 border border-zinc-600/40 text-zinc-400 cursor-not-allowed'
                    : 'bg-zinc-800 hover:bg-zinc-700 border border-white/[0.08] text-zinc-200'
                }`}
              >
                {bulkLoading ? (
                  <><i className="ri-loader-4-line animate-spin" /> 변환 중...</>
                ) : bulkDone ? (
                  <><i className="ri-check-line" /> 전체 완료!</>
                ) : (
                  <><i className="ri-download-cloud-line" /> 전체 다운로드</>
                )}
              </button>
            </div>

            {/* 크롭 방식 선택 — 이미지만 표시 */}
            {type === 'image' && (
              <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800/50 rounded-xl px-3.5 py-2.5">
                <i className="ri-crop-line text-zinc-500 text-sm flex-shrink-0" />
                <p className="text-[10px] text-zinc-500 flex-shrink-0 mr-1">변환 방식</p>
                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    onClick={() => setCropMode('crop')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black transition-all cursor-pointer whitespace-nowrap ${
                      cropMode === 'crop'
                        ? 'bg-rose-500/20 border border-rose-500/30 text-rose-400'
                        : 'bg-zinc-800/60 border border-white/[0.05] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <i className="ri-scissors-cut-line text-[9px]" />
                    센터 크롭
                  </button>
                  <button
                    onClick={() => setCropMode('letterbox')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black transition-all cursor-pointer whitespace-nowrap ${
                      cropMode === 'letterbox'
                        ? 'bg-rose-500/20 border border-rose-500/30 text-rose-400'
                        : 'bg-zinc-800/60 border border-white/[0.05] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <i className="ri-layout-column-line text-[9px]" />
                    레터박스
                  </button>
                </div>
              </div>
            )}

            {/* Format cards */}
            {platform.formats.map((fmt) => {
              const key = getFormatKey(fmt);
              const dlState = downloadStates[key] ?? 'idle';
              const isMatch = isRatioMatch(fmt);
              const visual = getRatioVisual(fmt.ratio);
              const isSelected = selectedFormat?.label === fmt.label && selectedFormat?.ratio === fmt.ratio;

              return (
                <button
                  key={key}
                  onClick={() => setSelectedFormat(fmt)}
                  className={`w-full text-left rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-rose-500/[0.07] border-rose-500/30'
                      : isMatch
                      ? 'bg-emerald-500/[0.04] border-emerald-500/20 hover:border-emerald-500/35'
                      : 'bg-zinc-900/40 border-zinc-800/50 hover:border-zinc-700/60'
                  }`}
                >
                  <div className="flex items-center gap-4 px-4 py-3.5">
                    {/* 비율 시각화 */}
                    <div className="flex-shrink-0 w-12 h-10 flex items-center justify-center">
                      <div
                        className={`rounded border-2 transition-colors ${
                          isSelected ? 'border-rose-500/70 bg-rose-500/15' :
                          isMatch ? 'border-emerald-500/50 bg-emerald-500/10' :
                          'border-zinc-600/50 bg-zinc-800/40'
                        }`}
                        style={{ width: `${visual.w}px`, height: `${visual.h}px` }}
                      />
                    </div>

                    {/* 포맷 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="text-xs font-black text-white">{fmt.label}</p>
                        {fmt.recommended && (
                          <span className="text-[9px] font-black bg-rose-500/20 border border-rose-500/30 text-rose-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            추천
                          </span>
                        )}
                        {isMatch && (
                          <span className="text-[9px] font-black bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            원본 일치
                          </span>
                        )}
                        {!isMatch && type === 'image' && (
                          <span className="text-[9px] font-black bg-amber-500/15 border border-amber-500/25 text-amber-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            {cropMode === 'crop' ? '크롭 변환' : '레터박스'}
                          </span>
                        )}
                        {!isMatch && type === 'video' && (
                          <span className="text-[9px] font-black bg-sky-500/15 border border-sky-500/25 text-sky-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            원본 다운로드
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                        <span className="font-black text-zinc-400">{fmt.ratio}</span>
                        <span>·</span>
                        <span>{fmt.width}×{fmt.height}</span>
                        <span>·</span>
                        <span>{fmt.desc}</span>
                      </div>
                    </div>

                    {/* 다운로드 버튼 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownload(fmt); }}
                      disabled={dlState === 'converting'}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                        dlState === 'done'
                          ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                          : dlState === 'error'
                          ? 'bg-red-500/20 border border-red-500/30 text-red-400'
                          : dlState === 'converting'
                          ? 'bg-zinc-700/60 border border-zinc-600/40 text-zinc-400 cursor-not-allowed'
                          : isSelected
                          ? 'bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 text-white'
                          : 'bg-zinc-800 hover:bg-zinc-700 border border-white/[0.06] text-zinc-200'
                      }`}
                    >
                      {dlState === 'converting' ? (
                        <><i className="ri-loader-4-line animate-spin" /> 변환 중</>
                      ) : dlState === 'done' ? (
                        <><i className="ri-check-line" /> 완료</>
                      ) : dlState === 'error' ? (
                        <><i className="ri-error-warning-line" /> 실패</>
                      ) : (
                        <><i className="ri-download-line" /> 다운로드</>
                      )}
                    </button>
                  </div>
                </button>
              );
            })}

            {/* 영상 변환 안내 */}
            {type === 'video' && (
              <div className="bg-sky-500/[0.06] border border-sky-500/20 rounded-xl px-4 py-3 flex items-start gap-2.5">
                <i className="ri-video-line text-sky-400 text-sm flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-black text-sky-300 mb-0.5">영상 변환 안내</p>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    영상 리인코딩은 브라우저에서 직접 처리할 수 없어 원본 파일을 다운로드합니다.
                    각 SNS 플랫폼에 업로드하면 자동으로 최적화됩니다.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Preview panel ── */}
          <div className="w-[260px] flex-shrink-0 border-l border-white/[0.06] flex flex-col overflow-hidden">
            <div className="p-4 flex-1 flex flex-col gap-3 overflow-y-auto">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">변환 미리보기</p>

              {/* 미리보기 */}
              {type === 'image' ? (
                <PreviewCanvas
                  srcUrl={url}
                  targetRatio={previewFormat.ratio}
                  cropMode={cropMode}
                />
              ) : (
                <div className="relative bg-zinc-950 rounded-xl overflow-hidden border border-white/[0.06]" style={{ height: '180px' }}>
                  <video
                    src={url}
                    className="w-full h-full object-contain"
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                </div>
              )}

              {/* 선택된 포맷 상세 */}
              <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl px-3.5 py-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500">선택 포맷</span>
                  <span className="text-[10px] font-black text-white">{previewFormat.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500">비율</span>
                  <span className="text-[10px] font-black text-zinc-300">{previewFormat.ratio}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500">해상도</span>
                  <span className="text-[10px] font-black text-zinc-300">{previewFormat.width}×{previewFormat.height}</span>
                </div>
                {type === 'image' && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500">변환 방식</span>
                    <span className="text-[10px] font-black text-zinc-300">
                      {isRatioMatch(previewFormat) ? '변환 없음' : cropMode === 'crop' ? '센터 크롭' : '레터박스'}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500">파일 형식</span>
                  <span className="text-[10px] font-black text-zinc-300">
                    {type === 'image' ? 'JPG' : 'MP4'}
                  </span>
                </div>
              </div>

              {/* 원본 비율 매칭 뱃지 */}
              {isRatioMatch(previewFormat) ? (
                <div className="flex items-center gap-2 bg-emerald-500/[0.07] border border-emerald-500/20 rounded-xl px-3 py-2.5">
                  <i className="ri-checkbox-circle-fill text-emerald-400 text-sm flex-shrink-0" />
                  <p className="text-[10px] text-emerald-300 leading-relaxed">
                    원본 비율과 일치해요. 변환 없이 최상 품질로 내보내집니다.
                  </p>
                </div>
              ) : type === 'image' ? (
                <div className="flex items-center gap-2 bg-amber-500/[0.07] border border-amber-500/20 rounded-xl px-3 py-2.5">
                  <i className="ri-crop-line text-amber-400 text-sm flex-shrink-0" />
                  <p className="text-[10px] text-amber-300/80 leading-relaxed">
                    {cropMode === 'crop'
                      ? '중앙 기준으로 크롭해 타겟 비율에 맞춥니다.'
                      : '원본 비율 유지 후 검정 여백을 추가합니다.'}
                  </p>
                </div>
              ) : null}

              {/* 바로 다운로드 버튼 */}
              <button
                onClick={() => handleDownload(previewFormat)}
                disabled={downloadStates[getFormatKey(previewFormat)] === 'converting'}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 disabled:opacity-60 text-white text-sm font-black transition-all cursor-pointer whitespace-nowrap"
              >
                {downloadStates[getFormatKey(previewFormat)] === 'converting' ? (
                  <><i className="ri-loader-4-line animate-spin" /> 변환 중...</>
                ) : downloadStates[getFormatKey(previewFormat)] === 'done' ? (
                  <><i className="ri-check-line" /> 다운로드 완료</>
                ) : (
                  <><i className="ri-download-line" /> 지금 다운로드</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
