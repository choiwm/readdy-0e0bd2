import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { Step4ImageData } from './step4-image-data';
import type { Step5CutData } from './step6-local-data';
import type { SubtitleSegment } from './step6-modals-shared';
import { TOTAL_DURATION } from './step6-modals-shared';

interface SlideshowPreviewProps {
  images: Step4ImageData[];
  step5Cuts: Step5CutData[];
  subtitleSegments: SubtitleSegment[];
  subtitleEnabled: boolean;
  subtitlePos: number;
  getSubtitleInlineStyle: () => React.CSSProperties;
  currentTemplate: { name: string } | undefined;
}

export default function SlideshowPreview({
  images,
  step5Cuts,
  subtitleSegments,
  subtitleEnabled,
  subtitlePos,
  getSubtitleInlineStyle,
  currentTemplate,
}: SlideshowPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentCutIdx, setCurrentCutIdx] = useState(0);
  const [showVideoMode, setShowVideoMode] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // useMemo로 안정화 — 매 렌더마다 새 배열 생성 방지 (useEffect 무한루프 방지)
  const validImages = useMemo(() => images.filter((i) => i.image), [images]);
  const videoCuts = useMemo(() => step5Cuts.filter((c) => c.hasVideo && c.videoUrl), [step5Cuts]);
  const hasVideos = videoCuts.length > 0;
  const totalDuration = step5Cuts.length > 0
    ? step5Cuts[step5Cuts.length - 1].end
    : validImages.length > 0
      ? validImages[validImages.length - 1].end
      : images.length > 0
        ? images[images.length - 1].end
        : TOTAL_DURATION;

  // Find active subtitle
  const activeSub = subtitleSegments.find(
    (s) => currentTime >= s.startTime && currentTime < s.endTime
  );
  const subText = activeSub?.text ?? subtitleSegments[0]?.text ?? '자막 미리보기';

  // Find current cut based on time
  useEffect(() => {
    const cuts = step5Cuts.length > 0
      ? step5Cuts
      : validImages.map((img) => ({ id: img.id, start: img.start, end: img.end }));
    if (cuts.length === 0) return;
    const idx = cuts.findIndex((c) => currentTime >= c.start && currentTime < c.end);
    if (idx >= 0) setCurrentCutIdx(idx);
  }, [currentTime, step5Cuts, validImages]);

  // 현재 컷 정보
  const currentCut = step5Cuts.length > 0 ? step5Cuts[Math.min(currentCutIdx, step5Cuts.length - 1)] : null;
  const currentVideoUrl = currentCut?.videoUrl;

  const stopPlayback = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsPlaying(false);
    videoRef.current?.pause();
  }, []);

  const startPlayback = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsPlaying(true);
    timerRef.current = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 0.1;
        if (next >= totalDuration) {
          clearInterval(timerRef.current!);
          setIsPlaying(false);
          return 0;
        }
        return next;
      });
    }, 100);
  }, [totalDuration]);

  const togglePlay = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      if (currentTime >= totalDuration) setCurrentTime(0);
      startPlayback();
    }
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const progressPct = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  const fallbackImg = 'https://readdy.ai/api/search-image?query=busy%20modern%20city%20street%20morning%20people%20checking%20smartphones%20walking%20digital%20billboards%20news%20updates%20cinematic%20wide%20shot%20urban%20life&width=800&height=420&seq=render_prev&orientation=landscape';

  // 썸네일 스트립 데이터 (Step5 영상이 있을 때만)
  const stripItems = step5Cuts.length > 0
    ? step5Cuts.map((c) => ({ id: c.id, start: c.start, end: c.end, thumb: c.thumb, hasVideo: c.hasVideo }))
    : validImages.map((img) => ({ id: img.id, start: img.start, end: img.end, thumb: img.image ?? '', hasVideo: false }));

  return (
    <div className="relative rounded-2xl overflow-hidden bg-black group">
      {/* 영상/이미지 모드 토글 (Step5 영상이 있을 때만) */}
      {hasVideos && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-black/70 backdrop-blur-sm border border-white/10 rounded-full p-1">
          <button
            onClick={() => setShowVideoMode(false)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-all whitespace-nowrap ${!showVideoMode ? 'bg-indigo-500 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            <i className="ri-image-line text-[10px]" /> 이미지
          </button>
          <button
            onClick={() => setShowVideoMode(true)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-all whitespace-nowrap ${showVideoMode ? 'bg-emerald-500 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            <i className="ri-film-line text-[10px]" /> 영상 ({videoCuts.length}컷)
          </button>
        </div>
      )}

      {/* 메인 미리보기 영역 */}
      <div className="relative w-full h-[180px] sm:h-[260px] md:h-[340px] overflow-hidden">
        {showVideoMode && currentVideoUrl ? (
          <video
            ref={videoRef}
            key={currentVideoUrl}
            src={currentVideoUrl}
            className="w-full h-full object-cover"
            autoPlay={isPlaying}
            loop={false}
            muted
            playsInline
            onEnded={() => {
              const nextIdx = currentCutIdx + 1;
              if (nextIdx < step5Cuts.length) {
                setCurrentCutIdx(nextIdx);
                setCurrentTime(step5Cuts[nextIdx].start);
              } else {
                stopPlayback();
              }
            }}
          />
        ) : validImages.length > 0 ? (
          <>
            {validImages.map((img, idx) => (
              <img
                key={img.id}
                src={img.image!}
                alt={`Cut ${img.id}`}
                className="absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-500"
                style={{ opacity: idx === currentCutIdx ? 1 : 0 }}
              />
            ))}
          </>
        ) : (
          <img src={fallbackImg} alt="Preview" className="w-full h-full object-cover object-top" />
        )}

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10 pointer-events-none" />

        {/* Subtitle overlay — 자막 스타일 실시간 반영 */}
        {subtitleEnabled && (
          <div
            className="absolute left-0 right-0 flex justify-center px-4 transition-all pointer-events-none"
            style={{ bottom: `${100 - subtitlePos}%` }}
          >
            <span style={getSubtitleInlineStyle()} className="text-center max-w-[90%]">
              {subText}
            </span>
          </div>
        )}

        {/* Play/Pause button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={togglePlay}
            className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center cursor-pointer hover:bg-white/30 transition-all opacity-80 hover:opacity-100"
          >
            <i className={`${isPlaying ? 'ri-pause-fill' : 'ri-play-fill'} text-white text-lg md:text-2xl ${!isPlaying ? 'ml-1' : ''}`} />
          </button>
        </div>

        {/* Top info bar */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          {stripItems.length > 0 && (
            <div className={`flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2.5 py-1 rounded-full ${showVideoMode && currentCut?.hasVideo ? 'border border-emerald-500/40' : ''}`}>
              <i className={`${showVideoMode && currentCut?.hasVideo ? 'ri-film-line text-emerald-400' : 'ri-image-line text-indigo-400'} text-[10px]`} />
              Cut {(stripItems[currentCutIdx]?.id ?? 1)} / {stripItems.length}
              {showVideoMode && currentCut?.hasVideo && (
                <span className="text-[8px] text-emerald-400 font-bold ml-0.5">영상</span>
              )}
            </div>
          )}
          {currentTemplate && (
            <div className="bg-black/60 backdrop-blur-sm text-white text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1.5 ml-auto">
              <i className="ri-layout-line text-amber-400 text-[10px]" />
              {currentTemplate.name}
            </div>
          )}
        </div>

        {/* Bottom time display */}
        <div className="absolute bottom-3 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded-full font-mono">
          {fmt(currentTime)} / {fmt(totalDuration)}
        </div>

        {validImages.length === 0 && !hasVideos && (
          <div className="absolute top-3 right-3 bg-amber-500/80 text-white text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1">
            <i className="ri-alert-line text-[10px]" /> Step4 이미지 없음
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative h-1 bg-zinc-800 cursor-pointer" onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        const newTime = pct * totalDuration;
        setCurrentTime(Math.max(0, Math.min(totalDuration, newTime)));
        if (isPlaying) stopPlayback();
      }}>
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-100"
          style={{ width: `${progressPct}%` }}
        />
        {stripItems.map((item) => (
          <div
            key={item.id}
            className="absolute top-0 bottom-0 w-px bg-white/20"
            style={{ left: `${(item.start / totalDuration) * 100}%` }}
          />
        ))}
      </div>

      {/* Cut thumbnail strip */}
      {stripItems.length > 0 && (
        <div className="flex bg-zinc-900/80 border-t border-white/5 overflow-x-auto scrollbar-none">
          {stripItems.map((item, idx) => {
            const isActive = idx === currentCutIdx;
            const dur = item.end - item.start;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentTime(item.start);
                  setCurrentCutIdx(idx);
                  if (isPlaying) stopPlayback();
                }}
                className={`relative flex-shrink-0 transition-all cursor-pointer border-r border-white/5 ${isActive ? 'ring-2 ring-inset ring-indigo-500' : 'hover:brightness-110'}`}
                style={{ width: `${Math.max(10, (dur / totalDuration) * 100)}%`, minWidth: '52px' }}
              >
                {item.thumb ? (
                  <img src={item.thumb} alt={`Cut ${item.id}`} className="w-full h-10 object-cover object-top" />
                ) : (
                  <div className="w-full h-10 bg-zinc-800 flex items-center justify-center">
                    <i className="ri-image-line text-zinc-600 text-xs" />
                  </div>
                )}
                {isActive && <div className="absolute inset-0 bg-indigo-500/20" />}
                {item.hasVideo && (
                  <div className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-emerald-500/80 flex items-center justify-center">
                    <i className="ri-play-fill text-white text-[6px]" />
                  </div>
                )}
                <div className="absolute bottom-0.5 left-0.5 text-[7px] font-bold text-white bg-black/60 px-1 rounded">
                  C{item.id}
                </div>
                {isActive && isPlaying && (
                  <div className="absolute top-0.5 left-0.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 영상 생성 현황 배지 */}
      {step5Cuts.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900/80 border-t border-white/5">
          <span className="text-[10px] text-zinc-500">영상 현황:</span>
          <div className="flex items-center gap-1">
            {step5Cuts.map((c) => (
              <div
                key={c.id}
                title={`Cut ${c.id}: ${c.hasVideo ? '생성 완료' : '미생성'}`}
                className={`w-5 h-1.5 rounded-full ${c.hasVideo ? 'bg-emerald-500' : 'bg-zinc-700'}`}
              />
            ))}
          </div>
          <span className="text-[10px] text-emerald-400 font-semibold ml-auto">
            {videoCuts.length}/{step5Cuts.length} 완료
          </span>
          {videoCuts.length < step5Cuts.length && (
            <span className="text-[10px] text-amber-400/70">(미생성 컷은 이미지로 대체)</span>
          )}
        </div>
      )}
    </div>
  );
}
