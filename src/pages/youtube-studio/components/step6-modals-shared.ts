export interface SubtitleSegment {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  trackId: string;
}

export const TOTAL_DURATION = 38;

export const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return `${m}:${sec.padStart(4, '0')}`;
};
