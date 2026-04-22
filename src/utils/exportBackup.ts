/**
 * exportBackup.ts
 * 결과물 로컬 백업 다운로드 유틸리티
 * - JSON 메타데이터, CSV 리포트, SRT 자막, WAV 오디오 등 다운로드 지원
 */

/** 파일 다운로드 트리거 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 안전한 파일명 변환 */
export function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9가-힣\s\-_]/g, '_').replace(/\s+/g, '_').slice(0, 60);
}

/** 날짜 포맷 (파일명용) */
export function dateStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/** JSON 파일 다운로드 */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
  triggerDownload(blob, filename.endsWith('.json') ? filename : `${filename}.json`);
}

/** CSV 파일 다운로드 */
export function downloadCsv(content: string, filename: string): void {
  const bom = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

/** 텍스트 파일 다운로드 */
export function downloadText(content: string, filename: string, mimeType = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  triggerDownload(blob, filename);
}

/** WAV 오디오 Blob 생성 (Web Audio API 기반 더미 WAV) */
export function generateWavBlob(durationSec: number, type: 'tts' | 'music' | 'effect' | 'clone' = 'tts'): Blob {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * Math.min(durationSec, 30));
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  const freqSets: Record<string, number[]> = {
    tts: [220, 330, 440],
    music: [261, 329, 392],
    effect: [80, 160, 320],
    clone: [196, 294, 392],
  };
  const freqs = freqSets[type] ?? freqSets.tts;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.min(t * 4, 1) * Math.min((durationSec - t) * 4, 1);
    let sample = 0;
    freqs.forEach((f, idx) => {
      sample += Math.sin(2 * Math.PI * f * t) * (0.3 / (idx + 1));
    });
    const val = Math.max(-1, Math.min(1, sample * envelope));
    view.setInt16(44 + i * 2, val * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/** SRT 자막 생성 */
export function buildSrtContent(title: string, topic: string, durationSec: number): string {
  const segCount = Math.max(3, Math.floor(durationSec / 5));
  const segDur = durationSec / segCount;
  const lines: string[] = [];

  const sampleTexts = [title, `주제: ${topic}`, '지금 바로 시작해보세요', 'AI가 만든 영상입니다', '구독과 좋아요 부탁드립니다'];

  const toSrt = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    const ms = Math.floor((s % 1) * 1000).toString().padStart(3, '0');
    return `${h}:${m}:${sec},${ms}`;
  };

  for (let i = 0; i < segCount; i++) {
    lines.push(`${i + 1}`);
    lines.push(`${toSrt(i * segDur)} --> ${toSrt((i + 1) * segDur)}`);
    lines.push(sampleTexts[i % sampleTexts.length]);
    lines.push('');
  }
  return lines.join('\n');
}

/** 파일 크기 포맷 */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

/** 프로젝트 메타데이터 CSV 행 생성 */
export function buildProjectCsvRow(p: {
  id: string; title: string; topic: string; status: string;
  duration: number; ratio: string; style: string; model: string;
  mode: string; cuts: number; views: number; likes: number; createdAt: string;
}): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [
    p.id, esc(p.title), esc(p.topic), p.status,
    p.duration, p.ratio, p.style, p.model, p.mode,
    p.cuts, p.views, p.likes,
    new Date(p.createdAt).toLocaleDateString('ko-KR'),
  ].join(',');
}

export const PROJECT_CSV_HEADER = 'ID,제목,주제,상태,길이(초),비율,스타일,모델,모드,컷수,조회수,좋아요,생성일';
