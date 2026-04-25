import { forwardRef, useState, type CSSProperties } from 'react';

// fal.ai 가 반환한 서명 URL 은 몇 시간 후 만료됨. PR #10/#11 이후 새 콘텐츠는
// Supabase Storage 로 영구 저장되지만, 그 이전에 저장된 gallery_items /
// ad_works 행에는 이미 만료된 fal.media URL 이 그대로 박혀있어요. 이 컴포넌트는
// img/video 의 onError 를 잡아 "만료됨" 안내로 자연스럽게 대체합니다.
//
// (어차피 만료된 URL 의 콘텐츠는 fal.ai CDN 에서 사라졌기 때문에 백필이 불가
// 능 — UI fallback 이 유일한 수습 수단)
//
// forwardRef 지원: AdPage 의 광고 카드는 hover 자동재생을 위해 video element
// 에 직접 ref 를 연결해요. 그래서 type='video' 일 때 ref 를 그대로 underlying
// <video> 로 흘려 보내야 합니다. type='image' 면 HTMLImageElement ref.

type Props = {
  type: 'image' | 'video';
  src: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  // <video> 전용 패스스루
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  // 공통 이벤트
  onLoad?: () => void;
  onLoadedData?: () => void;
};

export const ExpirableMedia = forwardRef<HTMLVideoElement | HTMLImageElement, Props>(
  function ExpirableMedia(
    { type, src, alt, className, style, controls, autoPlay, loop, muted, playsInline, preload, onLoad, onLoadedData },
    ref,
  ) {
    const [errored, setErrored] = useState(false);

    if (errored) {
      return (
        <div className={`flex flex-col items-center justify-center text-center p-3 bg-zinc-900/80 border border-amber-500/20 ${className ?? ''}`} style={style}>
          <i className="ri-time-line text-amber-400 text-xl md:text-2xl mb-1" />
          <p className="text-[10px] md:text-[11px] font-bold text-amber-300/90">콘텐츠 만료</p>
          <p className="text-[9px] md:text-[10px] text-zinc-400 mt-0.5 leading-tight">다시 생성해주세요</p>
        </div>
      );
    }

    if (type === 'video') {
      return (
        <video
          ref={ref as React.Ref<HTMLVideoElement>}
          src={src}
          controls={controls}
          autoPlay={autoPlay}
          loop={loop}
          muted={muted}
          playsInline={playsInline}
          preload={preload}
          className={className}
          style={style}
          onError={() => setErrored(true)}
          onLoadedData={onLoadedData}
        />
      );
    }

    return (
      <img
        ref={ref as React.Ref<HTMLImageElement>}
        src={src}
        alt={alt}
        className={className}
        style={style}
        onError={() => setErrored(true)}
        onLoad={onLoad}
      />
    );
  },
);
