import { SUBTITLE_TEMPLATES } from './step6-local-data';

interface SubtitlePreviewBadgeProps {
  tpl: typeof SUBTITLE_TEMPLATES[0];
  small?: boolean;
}

export default function SubtitlePreviewBadge({ tpl, small = false }: SubtitlePreviewBadgeProps) {
  const p = tpl.preview;
  const isGradient = tpl.id === 'gradient';
  const isOutline = tpl.id === 'outline';
  const bgMatch = typeof p.bg === 'string' && p.bg.startsWith('rgba') ? p.bg.match(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/) : null;
  const bgHex = bgMatch ? `rgba(${bgMatch[1]},${bgMatch[2]},${bgMatch[3]},${bgMatch[4]})` : 'transparent';
  const inlineStyle: React.CSSProperties = {
    fontFamily: 'Pretendard, sans-serif',
    fontSize: small ? 11 : 13,
    fontWeight: p.fontWeight as React.CSSProperties['fontWeight'],
    color: p.text,
    background: isGradient ? 'linear-gradient(90deg,rgba(99,102,241,0.85),rgba(168,85,247,0.85))' : bgHex,
    backdropFilter: p.blur ? 'blur(8px)' : undefined,
    borderRadius: typeof p.borderRadius === 'number' ? p.borderRadius : 6,
    border: p.border ? `1.5px solid ${(p as { borderColor?: string }).borderColor ?? '#fff'}` : undefined,
    padding: small ? '2px 7px' : '4px 10px',
    textShadow: p.shadow ? '0 1px 4px #000' : isOutline ? '0 0 2px #000, 0 0 2px #000' : undefined,
    WebkitTextStroke: isOutline ? '1px #000' : undefined,
    whiteSpace: 'nowrap',
  };
  return <span style={inlineStyle}>자막 미리보기</span>;
}
