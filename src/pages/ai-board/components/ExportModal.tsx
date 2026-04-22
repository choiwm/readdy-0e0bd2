import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import PageHeader from '@/components/feature/PageHeader';

interface ShotCard {
  id: string;
  index: number;
  imageUrl: string | null;
  prompt: string;
  shotType: string;
  isGenerating: boolean;
  progress: number;
  error: string | null;
}

async function downloadImage(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  } catch {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

async function loadImageAsDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('no ctx')); return; }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => reject(new Error('load failed'));
    img.src = url;
  });
}

type PdfLayout = 'grid' | 'strip' | 'detail';
type ExportTab = 'images' | 'pdf';

interface ExportModalProps {
  shots: ShotCard[];
  projectTitle: string;
  onClose: () => void;
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function ExportModal({ shots, projectTitle, onClose, onToast }: ExportModalProps) {
  const completedShots = shots.filter((s) => s.imageUrl);
  const [activeTab, setActiveTab] = useState<ExportTab>('pdf');

  // Image export state
  const [exportMode, setExportMode] = useState<'all' | 'selected'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(completedShots.map((s) => s.id)));
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [namingMode, setNamingMode] = useState<'index' | 'prompt'>('index');

  // PDF export state
  const [pdfLayout, setPdfLayout] = useState<PdfLayout>('grid');
  const [pdfTitle, setPdfTitle] = useState(projectTitle);
  const [showPrompts, setShowPrompts] = useState(true);
  const [showShotTypes, setShowShotTypes] = useState(true);
  const [showPageNumbers, setShowPageNumbers] = useState(true);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfSelectedIds, setPdfSelectedIds] = useState<Set<string>>(new Set(completedShots.map((s) => s.id)));
  const [pdfExportMode, setPdfExportMode] = useState<'all' | 'selected'>('all');

  const targetShots = exportMode === 'all' ? completedShots : completedShots.filter((s) => selectedIds.has(s.id));
  const pdfTargetShots = pdfExportMode === 'all' ? completedShots : completedShots.filter((s) => pdfSelectedIds.has(s.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const togglePdfSelect = (id: string) => {
    setPdfSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === completedShots.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(completedShots.map((s) => s.id)));
  };

  const handlePdfSelectAll = () => {
    if (pdfSelectedIds.size === completedShots.length) setPdfSelectedIds(new Set());
    else setPdfSelectedIds(new Set(completedShots.map((s) => s.id)));
  };

  const getFilename = (shot: ShotCard) => {
    const base = namingMode === 'prompt' && shot.prompt.trim()
      ? shot.prompt.trim().slice(0, 30).replace(/[^a-zA-Z0-9가-힣\s]/g, '').trim().replace(/\s+/g, '_')
      : `${projectTitle}_cut${String(shot.index).padStart(2, '0')}`;
    return `${base}.jpg`;
  };

  const handleExportImages = async () => {
    if (targetShots.length === 0) return;
    setIsExporting(true);
    setExportProgress(0);
    for (let i = 0; i < targetShots.length; i++) {
      const shot = targetShots[i];
      if (shot.imageUrl) {
        await downloadImage(shot.imageUrl, getFilename(shot));
        setExportProgress(Math.round(((i + 1) / targetShots.length) * 100));
        if (i < targetShots.length - 1) await new Promise((r) => setTimeout(r, 300));
      }
    }
    setIsExporting(false);
    onToast(`${targetShots.length}개 이미지 다운로드 완료`, 'success');
    onClose();
  };

  // ─── PDF Generation ───────────────────────────────────────────────────────
  const generatePdf = async () => {
    if (pdfTargetShots.length === 0) return;
    setIsPdfGenerating(true);
    setPdfProgress(0);

    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();   // 297
      const pageH = doc.internal.pageSize.getHeight();  // 210

      // ── Cover Page ──────────────────────────────────────────────────────
      // Dark background
      doc.setFillColor(13, 13, 15);
      doc.rect(0, 0, pageW, pageH, 'F');

      // Accent bar
      doc.setFillColor(99, 102, 241);
      doc.rect(0, 0, 6, pageH, 'F');

      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.text(pdfTitle || 'Storyboard', 20, 70);

      // Subtitle
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(160, 160, 180);
      doc.text(`${pdfTargetShots.length} Shots  ·  AI Storyboard`, 20, 82);

      // Date
      const now = new Date();
      const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 120);
      doc.text(dateStr, 20, 92);

      // Decorative grid dots
      doc.setFillColor(40, 40, 50);
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 12; c++) {
          doc.circle(160 + c * 12, 30 + r * 22, 1.2, 'F');
        }
      }

      // Shot count badge
      doc.setFillColor(30, 30, 40);
      doc.roundedRect(20, 105, 60, 22, 4, 4, 'F');
      doc.setTextColor(99, 102, 241);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(String(pdfTargetShots.length), 32, 119);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(160, 160, 180);
      doc.text('Total Shots', 46, 119);

      // Layout badge
      doc.setFillColor(30, 30, 40);
      doc.roundedRect(88, 105, 60, 22, 4, 4, 'F');
      doc.setTextColor(99, 102, 241);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      const layoutLabel = pdfLayout === 'grid' ? 'Grid Layout' : pdfLayout === 'strip' ? 'Strip Layout' : 'Detail Layout';
      doc.text(layoutLabel, 118, 119, { align: 'center' });

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(60, 60, 80);
      doc.text('Generated by AI Board', 20, pageH - 8);

      setPdfProgress(5);

      // ── Load all images ──────────────────────────────────────────────────
      const imageDataUrls: (string | null)[] = [];
      for (let i = 0; i < pdfTargetShots.length; i++) {
        const shot = pdfTargetShots[i];
        try {
          if (shot.imageUrl) {
            const dataUrl = await loadImageAsDataUrl(shot.imageUrl);
            imageDataUrls.push(dataUrl);
          } else {
            imageDataUrls.push(null);
          }
        } catch {
          imageDataUrls.push(null);
        }
        setPdfProgress(5 + Math.round(((i + 1) / pdfTargetShots.length) * 40));
      }

      // ── Layout: Grid (3×2 per page) ──────────────────────────────────────
      if (pdfLayout === 'grid') {
        const cols = 3;
        const rows = 2;
        const perPage = cols * rows;
        const marginX = 12;
        const marginTop = 14;
        const marginBottom = showPageNumbers ? 12 : 8;
        const gapX = 6;
        const gapY = 6;
        const cellW = (pageW - marginX * 2 - gapX * (cols - 1)) / cols;
        const imgH = cellW * (9 / 16);
        const labelH = showPrompts ? 14 : (showShotTypes ? 8 : 0);
        const cellH = imgH + labelH;
        const totalH = rows * cellH + (rows - 1) * gapY;
        const startY = marginTop + (pageH - marginTop - marginBottom - totalH) / 2;

        const totalPages = Math.ceil(pdfTargetShots.length / perPage);

        for (let page = 0; page < totalPages; page++) {
          doc.addPage();
          // Dark bg
          doc.setFillColor(13, 13, 15);
          doc.rect(0, 0, pageW, pageH, 'F');
          // Accent bar
          doc.setFillColor(99, 102, 241);
          doc.rect(0, 0, 3, pageH, 'F');

          const pageShots = pdfTargetShots.slice(page * perPage, (page + 1) * perPage);

          pageShots.forEach((shot, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const x = marginX + col * (cellW + gapX);
            const y = startY + row * (cellH + gapY);

            // Image bg
            doc.setFillColor(26, 26, 30);
            doc.roundedRect(x, y, cellW, imgH, 2, 2, 'F');

            // Image
            const dataUrl = imageDataUrls[page * perPage + idx];
            if (dataUrl) {
              doc.addImage(dataUrl, 'JPEG', x, y, cellW, imgH, undefined, 'FAST');
            }

            // Shot number badge
            doc.setFillColor(99, 102, 241);
            doc.roundedRect(x + 2, y + 2, 14, 6, 1, 1, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(5.5);
            doc.setFont('helvetica', 'bold');
            doc.text(`#${shot.index}`, x + 9, y + 6.2, { align: 'center' });

            // Shot type badge
            if (showShotTypes) {
              const typeW = doc.getTextWidth(shot.shotType) + 4;
              doc.setFillColor(0, 0, 0, 0.6);
              doc.setFillColor(20, 20, 28);
              doc.roundedRect(x + cellW - typeW - 2, y + 2, typeW, 6, 1, 1, 'F');
              doc.setTextColor(160, 160, 200);
              doc.setFontSize(5);
              doc.setFont('helvetica', 'normal');
              doc.text(shot.shotType, x + cellW - typeW / 2 - 2, y + 6.2, { align: 'center' });
            }

            // Prompt text
            if (showPrompts && shot.prompt.trim()) {
              const promptY = y + imgH + 3;
              doc.setTextColor(180, 180, 200);
              doc.setFontSize(6);
              doc.setFont('helvetica', 'normal');
              const maxW = cellW - 4;
              const lines = doc.splitTextToSize(shot.prompt.trim(), maxW);
              doc.text(lines.slice(0, 2), x + 2, promptY);
            }
          });

          // Page number
          if (showPageNumbers) {
            doc.setFontSize(7);
            doc.setTextColor(80, 80, 100);
            doc.setFont('helvetica', 'normal');
            doc.text(`${page + 1} / ${totalPages}`, pageW / 2, pageH - 5, { align: 'center' });
            doc.text(pdfTitle, marginX, pageH - 5);
          }

          setPdfProgress(45 + Math.round(((page + 1) / totalPages) * 45));
        }
      }

      // ── Layout: Strip (horizontal filmstrip, 1 per page) ─────────────────
      else if (pdfLayout === 'strip') {
        const stripH = 90;
        const stripY = (pageH - stripH) / 2 - 10;
        const infoY = stripY + stripH + 8;

        for (let i = 0; i < pdfTargetShots.length; i++) {
          const shot = pdfTargetShots[i];
          doc.addPage();
          doc.setFillColor(13, 13, 15);
          doc.rect(0, 0, pageW, pageH, 'F');

          // Side accent
          doc.setFillColor(99, 102, 241);
          doc.rect(0, 0, 4, pageH, 'F');

          // Image area
          const imgW = stripH * (16 / 9);
          const imgX = (pageW - imgW) / 2;
          doc.setFillColor(26, 26, 30);
          doc.roundedRect(imgX, stripY, imgW, stripH, 3, 3, 'F');

          const dataUrl = imageDataUrls[i];
          if (dataUrl) {
            doc.addImage(dataUrl, 'JPEG', imgX, stripY, imgW, stripH, undefined, 'FAST');
          }

          // Shot number
          doc.setFillColor(99, 102, 241);
          doc.roundedRect(imgX + 4, stripY + 4, 20, 9, 2, 2, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.text(`#${shot.index}`, imgX + 14, stripY + 10, { align: 'center' });

          // Shot type
          if (showShotTypes) {
            doc.setFillColor(20, 20, 28);
            const tw = doc.getTextWidth(shot.shotType) + 8;
            doc.roundedRect(imgX + imgW - tw - 4, stripY + 4, tw, 9, 2, 2, 'F');
            doc.setTextColor(160, 160, 200);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.text(shot.shotType, imgX + imgW - tw / 2 - 4, stripY + 10, { align: 'center' });
          }

          // Info below image
          if (showPrompts && shot.prompt.trim()) {
            doc.setTextColor(200, 200, 220);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            const lines = doc.splitTextToSize(shot.prompt.trim(), imgW);
            doc.text(lines.slice(0, 3), imgX, infoY);
          }

          // Page number
          if (showPageNumbers) {
            doc.setFontSize(7);
            doc.setTextColor(80, 80, 100);
            doc.text(`${i + 1} / ${pdfTargetShots.length}`, pageW / 2, pageH - 5, { align: 'center' });
            doc.text(pdfTitle, 10, pageH - 5);
          }

          setPdfProgress(45 + Math.round(((i + 1) / pdfTargetShots.length) * 45));
        }
      }

      // ── Layout: Detail (2-column: image left, info right) ────────────────
      else if (pdfLayout === 'detail') {
        for (let i = 0; i < pdfTargetShots.length; i++) {
          const shot = pdfTargetShots[i];
          doc.addPage();
          doc.setFillColor(13, 13, 15);
          doc.rect(0, 0, pageW, pageH, 'F');

          // Accent bar
          doc.setFillColor(99, 102, 241);
          doc.rect(0, 0, 4, pageH, 'F');

          // Left: image
          const imgX = 14;
          const imgY = 16;
          const imgW = 160;
          const imgH = imgW * (9 / 16);

          doc.setFillColor(26, 26, 30);
          doc.roundedRect(imgX, imgY, imgW, imgH, 3, 3, 'F');

          const dataUrl = imageDataUrls[i];
          if (dataUrl) {
            doc.addImage(dataUrl, 'JPEG', imgX, imgY, imgW, imgH, undefined, 'FAST');
          }

          // Shot number badge on image
          doc.setFillColor(99, 102, 241);
          doc.roundedRect(imgX + 4, imgY + 4, 22, 10, 2, 2, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.text(`#${shot.index}`, imgX + 15, imgY + 10.5, { align: 'center' });

          // Right: info panel
          const infoX = imgX + imgW + 12;
          const infoW = pageW - infoX - 10;
          let curY = imgY;

          // Shot number large
          doc.setTextColor(99, 102, 241);
          doc.setFontSize(32);
          doc.setFont('helvetica', 'bold');
          doc.text(`#${shot.index}`, infoX, curY + 22);
          curY += 28;

          // Divider
          doc.setDrawColor(40, 40, 60);
          doc.setLineWidth(0.5);
          doc.line(infoX, curY, infoX + infoW, curY);
          curY += 8;

          // Shot type
          if (showShotTypes) {
            doc.setTextColor(120, 120, 150);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text('SHOT TYPE', infoX, curY);
            curY += 5;
            doc.setFillColor(30, 30, 45);
            const tw = doc.getTextWidth(shot.shotType) + 8;
            doc.roundedRect(infoX, curY, tw, 9, 2, 2, 'F');
            doc.setTextColor(160, 160, 220);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(shot.shotType, infoX + tw / 2, curY + 6, { align: 'center' });
            curY += 16;
          }

          // Prompt
          if (showPrompts) {
            doc.setTextColor(120, 120, 150);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text('PROMPT', infoX, curY);
            curY += 5;
            doc.setTextColor(200, 200, 220);
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'normal');
            const promptText = shot.prompt.trim() || '(No prompt)';
            const lines = doc.splitTextToSize(promptText, infoW);
            doc.text(lines.slice(0, 8), infoX, curY);
            curY += lines.slice(0, 8).length * 5 + 8;
          }

          // Scene notes area
          doc.setDrawColor(40, 40, 60);
          doc.setLineWidth(0.3);
          doc.setTextColor(60, 60, 80);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          const noteY = Math.max(curY, imgY + imgH + 4);
          if (noteY < pageH - 20) {
            doc.text('NOTES', infoX, noteY);
            for (let ln = 0; ln < 4; ln++) {
              doc.line(infoX, noteY + 5 + ln * 8, infoX + infoW, noteY + 5 + ln * 8);
            }
          }

          // Page number
          if (showPageNumbers) {
            doc.setFontSize(7);
            doc.setTextColor(80, 80, 100);
            doc.setFont('helvetica', 'normal');
            doc.text(`${i + 1} / ${pdfTargetShots.length}`, pageW / 2, pageH - 5, { align: 'center' });
            doc.text(pdfTitle, 10, pageH - 5);
          }

          setPdfProgress(45 + Math.round(((i + 1) / pdfTargetShots.length) * 45));
        }
      }

      setPdfProgress(95);
      const safeTitle = (pdfTitle || 'storyboard').replace(/[^a-zA-Z0-9가-힣\s_-]/g, '').trim().replace(/\s+/g, '_');
      doc.save(`${safeTitle}_storyboard.pdf`);
      setPdfProgress(100);
      onToast('PDF 스토리보드 저장 완료!', 'success');
      onClose();
    } catch (err) {
      console.error('PDF generation error:', err);
      onToast('PDF 생성 중 오류가 발생했습니다', 'error');
    } finally {
      setIsPdfGenerating(false);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const layoutOptions: { value: PdfLayout; label: string; desc: string; icon: string }[] = [
    { value: 'grid', label: '그리드', desc: '3×2 컷 배치, 한 페이지에 6컷', icon: 'ri-grid-line' },
    { value: 'strip', label: '스트립', desc: '컷 1개씩 전체 화면', icon: 'ri-film-line' },
    { value: 'detail', label: '디테일', desc: '이미지 + 프롬프트 상세 정보', icon: 'ri-layout-left-line' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-2xl bg-[#111113] border border-white/10 sm:rounded-2xl rounded-t-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <PageHeader
          icon="ri-export-line"
          title="내보내기"
          subtitle="PDF · Image"
          badgeColor="indigo"
          actions={
            <div className="flex items-center gap-2">
              <span className="hidden sm:block text-[10px] text-zinc-500 font-bold">{completedShots.length}개 완료된 컷</span>
              <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer">
                <i className="ri-close-line" />
              </button>
            </div>
          }
        />

        {completedShots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <i className="ri-image-line text-zinc-700 text-4xl" />
            <p className="text-sm text-zinc-500 font-bold">내보낼 이미지가 없습니다</p>
            <p className="text-xs text-zinc-600">먼저 컷 이미지를 생성해주세요</p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex border-b border-white/5 flex-shrink-0 px-3 sm:px-5">
              {([
                { key: 'pdf', label: 'PDF', icon: 'ri-file-pdf-line' },
                { key: 'images', label: '이미지', icon: 'ri-image-line' },
              ] as { key: ExportTab; label: string; icon: string }[]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap outline-none focus:outline-none ${
                    activeTab === tab.key
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <i className={tab.icon} />
                  <span className="hidden xs:inline">{tab.label}</span>
                  <span className="xs:hidden">{tab.label}</span>
                  {tab.key === 'pdf' && (
                    <span className="text-[9px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/25 px-1.5 py-0.5 rounded-full font-black">NEW</span>
                  )}
                </button>
              ))}
            </div>

            {/* ── PDF Tab ── */}
            {activeTab === 'pdf' && (
              <div className="flex-1 overflow-y-auto">
                <div className="px-4 sm:px-5 py-4 space-y-4 sm:space-y-5">
                  {/* Title */}
                  <div>
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">PDF 제목</label>
                    <input
                      value={pdfTitle}
                      onChange={(e) => setPdfTitle(e.target.value)}
                      className="w-full bg-zinc-900/60 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-zinc-300 placeholder-zinc-600 outline-none focus:border-indigo-500/30 transition-colors"
                      placeholder="스토리보드 제목"
                    />
                  </div>

                  {/* Layout */}
                  <div>
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">레이아웃</label>
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                      {layoutOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setPdfLayout(opt.value)}
                          className={`flex flex-col items-center gap-1.5 sm:gap-2 p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer text-center ${
                            pdfLayout === opt.value
                              ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                              : 'bg-zinc-900/40 border-white/5 text-zinc-400 hover:border-white/10 hover:text-zinc-300'
                          }`}
                        >
                          <i className={`${opt.icon} text-lg sm:text-xl`} />
                          <div>
                            <p className="text-xs font-bold">{opt.label}</p>
                            <p className="text-[9px] sm:text-[10px] text-zinc-600 leading-tight mt-0.5 hidden sm:block">{opt.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Options */}
                  <div>
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">포함 항목</label>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {[
                        { key: 'prompts', label: '프롬프트', val: showPrompts, set: setShowPrompts },
                        { key: 'types', label: '샷 타입', val: showShotTypes, set: setShowShotTypes },
                        { key: 'pages', label: '페이지 번호', val: showPageNumbers, set: setShowPageNumbers },
                      ].map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() => opt.set(!opt.val)}
                          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
                            opt.val
                              ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                              : 'bg-zinc-900/40 border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-white/10'
                          }`}
                        >
                          <i className={opt.val ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'} />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Shot selection */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">포함할 컷</label>
                      <div className="flex gap-1.5 sm:gap-2">
                        {(['all', 'selected'] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => setPdfExportMode(m)}
                            className={`text-[11px] font-bold px-2 sm:px-2.5 py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                              pdfExportMode === m
                                ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                                : 'bg-zinc-900/40 border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-white/10'
                            }`}
                          >
                            {m === 'all' ? `전체 (${completedShots.length})` : `선택 (${pdfSelectedIds.size})`}
                          </button>
                        ))}
                      </div>
                    </div>
                    {pdfExportMode === 'selected' && (
                      <>
                        <div className="flex justify-end mb-2">
                          <button onClick={handlePdfSelectAll} className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer">
                            {pdfSelectedIds.size === completedShots.length ? '전체 해제' : '전체 선택'}
                          </button>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 sm:gap-2">
                          {completedShots.map((shot) => {
                            const isSel = pdfSelectedIds.has(shot.id);
                            return (
                              <div
                                key={shot.id}
                                onClick={() => togglePdfSelect(shot.id)}
                                className={`relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                                  isSel ? 'border-indigo-500/60 ring-1 ring-indigo-500/30' : 'border-white/5 hover:border-white/15'
                                }`}
                              >
                                <div className="aspect-video">
                                  <img src={shot.imageUrl!} alt="" className="w-full h-full object-cover" />
                                </div>
                                <div className={`absolute top-1 right-1 w-4 h-4 rounded-full border flex items-center justify-center transition-all ${isSel ? 'bg-indigo-500 border-indigo-500' : 'bg-black/40 border-white/30'}`}>
                                  {isSel && <i className="ri-check-line text-white text-[8px]" />}
                                </div>
                                <div className="absolute bottom-1 left-1">
                                  <span className="text-[8px] font-black text-white/70 bg-black/50 px-1 py-0.5 rounded">#{shot.index}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Preview info */}
                  <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-3 sm:p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <i className="ri-file-pdf-line text-indigo-400 text-sm" />
                      <span className="text-xs font-bold text-zinc-300">PDF 미리보기 정보</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
                      <div>
                        <p className="text-base sm:text-lg font-black text-white">{pdfTargetShots.length + 1}</p>
                        <p className="text-[10px] text-zinc-500">총 페이지</p>
                      </div>
                      <div>
                        <p className="text-base sm:text-lg font-black text-white">{pdfTargetShots.length}</p>
                        <p className="text-[10px] text-zinc-500">컷 수</p>
                      </div>
                      <div>
                        <p className="text-base sm:text-lg font-black text-white">A4</p>
                        <p className="text-[10px] text-zinc-500">가로 방향</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PDF Generate button */}
                <div className="px-4 sm:px-5 pb-5 flex-shrink-0">
                  {isPdfGenerating ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400 font-bold">PDF 생성 중...</span>
                        <span className="text-indigo-400 font-bold">{pdfProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-zinc-800/60 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300"
                          style={{ width: `${pdfProgress}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-zinc-600 text-center">이미지 로딩 및 PDF 렌더링 중...</p>
                    </div>
                  ) : (
                    <button
                      onClick={generatePdf}
                      disabled={pdfTargetShots.length === 0}
                      className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <i className="ri-file-pdf-line" />
                      PDF 스토리보드 생성 ({pdfTargetShots.length}컷)
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Images Tab ── */}
            {activeTab === 'images' && (
              <>
                <div className="px-4 sm:px-5 py-4 border-b border-white/5 flex-shrink-0 space-y-3 sm:space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">내보내기 범위</label>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {[
                        { value: 'all', label: `전체 (${completedShots.length}개)`, icon: 'ri-grid-line' },
                        { value: 'selected', label: `선택 (${selectedIds.size}개)`, icon: 'ri-checkbox-multiple-line' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setExportMode(opt.value as 'all' | 'selected')}
                          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
                            exportMode === opt.value
                              ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                              : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:text-white hover:border-white/10'
                          }`}
                        >
                          <i className={opt.icon} />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">파일명 형식</label>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {[
                        { value: 'index', label: '컷 번호', icon: 'ri-hashtag' },
                        { value: 'prompt', label: '프롬프트 기반', icon: 'ri-text' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setNamingMode(opt.value as 'index' | 'prompt')}
                          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
                            namingMode === opt.value
                              ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                              : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:text-white hover:border-white/10'
                          }`}
                        >
                          <i className={opt.icon} />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {exportMode === 'selected' && (
                  <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">컷 선택</span>
                      <button onClick={handleSelectAll} className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer">
                        {selectedIds.size === completedShots.length ? '전체 해제' : '전체 선택'}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2">
                      {completedShots.map((shot) => {
                        const isSelected = selectedIds.has(shot.id);
                        return (
                          <div
                            key={shot.id}
                            onClick={() => toggleSelect(shot.id)}
                            className={`relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                              isSelected ? 'border-indigo-500/60 ring-1 ring-indigo-500/30' : 'border-white/5 hover:border-white/15'
                            }`}
                          >
                            <div className="aspect-video">
                              <img src={shot.imageUrl!} alt={`Cut ${shot.index}`} className="w-full h-full object-cover" />
                            </div>
                            <div className={`absolute inset-0 transition-all ${isSelected ? 'bg-indigo-500/10' : 'bg-transparent hover:bg-white/5'}`} />
                            <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'bg-black/40 border-white/30'}`}>
                              {isSelected && <i className="ri-check-line text-white text-[10px]" />}
                            </div>
                            <div className="absolute bottom-1 left-1.5">
                              <span className="text-[9px] font-black text-white/70 bg-black/50 px-1 py-0.5 rounded-md">#{shot.index}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {exportMode === 'all' && (
                  <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">파일 미리보기</label>
                    <div className="space-y-1.5">
                      {completedShots.map((shot) => (
                        <div key={shot.id} className="flex items-center gap-3 py-1.5 px-3 bg-zinc-900/40 border border-white/5 rounded-lg">
                          <div className="w-10 h-6 rounded-md overflow-hidden flex-shrink-0">
                            <img src={shot.imageUrl!} alt="" className="w-full h-full object-cover" />
                          </div>
                          <span className="text-[11px] text-zinc-400 font-mono truncate">{getFilename(shot)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="px-4 sm:px-5 py-4 border-t border-white/5 flex-shrink-0">
                  {isExporting ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400 font-bold">다운로드 중...</span>
                        <span className="text-indigo-400 font-bold">{exportProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-zinc-800/60 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300"
                          style={{ width: `${exportProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleExportImages}
                      disabled={targetShots.length === 0}
                      className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <i className="ri-download-2-line" />
                      {targetShots.length}개 이미지 다운로드
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
