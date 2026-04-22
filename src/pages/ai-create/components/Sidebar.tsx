import { useState, useEffect, useRef, useCallback } from 'react';
import type { AppliedAngle, AppliedLook } from '@/utils/characterPrompt';
import { LOOK_OPTIONS, ANGLE_PRESETS } from '@/pages/ai-create/data/presets';
import RangeSlider from './RangeSlider';
import PageHeader from '@/components/feature/PageHeader';
import CustomCharacterModal from './CustomCharacterModal';
import type { AppliedCharacter } from '../page';

// ── Types ──────────────────────────────────────────────────────────────────
export type SidebarTab = '생성' | 'ANGLE' | 'Character' | 'LOOK';

interface StorageFile {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'model';
  url: string;
  size: number;
  addedAt: string;
}

interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onStorageImageSelect?: (url: string, name: string) => void;
  appliedAngle?: AppliedAngle | null;
  onClearAngle?: () => void;
  onApplyAngle?: (angle: AppliedAngle) => void;
  angleDraft?: { pan: number; tilt: number; zoom: number } | null;
  onAngleDraftChange?: (draft: { pan: number; tilt: number; zoom: number }) => void;
  appliedLook?: AppliedLook | null;
  onClearLook?: () => void;
  onApplyLook?: (look: AppliedLook) => void;
  // Character
  appliedCharacter?: AppliedCharacter | null;
  onApplyCharacter?: (char: AppliedCharacter) => void;
  onApplyCharacterAndGenerate?: (char: AppliedCharacter) => void;
  onClearCharacter?: () => void;
  onAddCustomChar?: (char: AppliedCharacter) => void;
  activeCharCategory?: string;
  onCharCategoryChange?: (cat: string) => void;
}

// ── Data ───────────────────────────────────────────────────────────────────
const INITIAL_IMAGES: StorageFile[] = [
  { id: 's1', name: 'neon_city.png', type: 'image', url: 'https://readdy.ai/api/search-image?query=futuristic%20neon%20cityscape%20at%20night%20with%20glowing%20lights%20and%20reflections%20on%20wet%20streets%2C%20cyberpunk%20aesthetic%2C%20dark%20moody%20atmosphere%2C%20ultra%20detailed%20digital%20art&width=120&height=120&seq=ai1&orientation=squarish', size: 2400000, addedAt: '2026-04-09' },
  { id: 's2', name: 'liquid_metal.png', type: 'image', url: 'https://readdy.ai/api/search-image?query=abstract%20flowing%20liquid%20metal%20sculpture%20with%20golden%20and%20silver%20tones%2C%20minimalist%20background%2C%20studio%20lighting%2C%20high%20resolution%20render&width=120&height=120&seq=ai2&orientation=squarish', size: 1800000, addedAt: '2026-04-09' },
  { id: 's3', name: 'forest_glow.png', type: 'image', url: 'https://readdy.ai/api/search-image?query=ethereal%20forest%20with%20bioluminescent%20plants%20glowing%20in%20darkness%2C%20magical%20atmosphere%2C%20deep%20blue%20and%20green%20tones%2C%20fantasy%20digital%20art&width=120&height=120&seq=ai3&orientation=squarish', size: 3100000, addedAt: '2026-04-08' },
];

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Storage Panel (생성 탭) ─────────────────────────────────────────────────
function StoragePanel({ onImageSelect }: { onImageSelect?: (url: string, name: string) => void }) {
  const [activeTab, setActiveTab] = useState<'MODELS' | 'IMAGES' | 'VIDEOS' | 'AUDIO'>('IMAGES');
  const [files, setFiles] = useState<StorageFile[]>(INITIAL_IMAGES);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const handleFiles = useCallback((fileList: FileList) => {
    const newFiles: StorageFile[] = [];
    Array.from(fileList).forEach((file) => {
      let type: StorageFile['type'] = 'image';
      if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';
      else if (!file.type.startsWith('image/')) type = 'model';
      const url = URL.createObjectURL(file);
      newFiles.push({
        id: `upload_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: file.name,
        type,
        url,
        size: file.size,
        addedAt: new Date().toISOString().slice(0, 10),
      });
    });
    setFiles((prev) => [...newFiles, ...prev]);
    showToast(`${newFiles.length}개 파일이 업로드되었습니다`);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleImageClick = (file: StorageFile) => {
    if (file.type !== 'image') return;
    setSelectedId(file.id);
    onImageSelect?.(file.url, file.name);
    showToast(`"${file.name}" 을 프롬프트에 참조했습니다`);
  };

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFiles((prev) => prev.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const filteredFiles = files.filter((f) => {
    if (activeTab === 'IMAGES') return f.type === 'image';
    if (activeTab === 'VIDEOS') return f.type === 'video';
    if (activeTab === 'AUDIO') return f.type === 'audio';
    if (activeTab === 'MODELS') return f.type === 'model';
    return true;
  });

  const counts = {
    MODELS: files.filter((f) => f.type === 'model').length,
    IMAGES: files.filter((f) => f.type === 'image').length,
    VIDEOS: files.filter((f) => f.type === 'video').length,
    AUDIO: files.filter((f) => f.type === 'audio').length,
  };

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
  const storagePercent = Math.min((totalBytes / (200 * 1024 * 1024)) * 100, 100);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,audio/*" className="hidden" onChange={handleFileInput} />

      {/* Header — 통일된 PageHeader 사용 */}
      <PageHeader
        icon="ri-hard-drive-2-line"
        title="스토리지"
        subtitle="Assets & Uploads"
        badgeColor="indigo"
        actions={
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="파일 업로드"
          >
            <i className="ri-upload-2-line text-sm" />
          </button>
        }
      />

      {/* Storage bar */}
      <div className="px-4 py-2.5 border-b border-white/5 flex-shrink-0 bg-zinc-900/30">
        <div className="flex items-center justify-between text-[10px] mb-1.5">
          <span className="text-zinc-500 font-black uppercase tracking-widest">Storage</span>
          <span className="text-zinc-500 font-medium tabular-nums">{formatBytes(totalBytes)} / 200 MB</span>
        </div>
        <div className="h-1.5 bg-zinc-800/60 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500" style={{ width: `${storagePercent}%` }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-3 py-2.5 border-b border-white/5 flex-shrink-0 bg-zinc-900/30">
        <div className="flex items-center gap-0.5 bg-zinc-900/60 border border-white/5 p-1 rounded-xl">
          {(['MODELS', 'IMAGES', 'VIDEOS', 'AUDIO'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer outline-none focus:outline-none border ${
                activeTab === tab ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/25' : 'text-zinc-500 hover:text-white border-transparent'
              }`}
            >
              <span className="block text-base font-black leading-tight">{counts[tab]}</span>
              {tab}
            </button>
          ))}
        </div>
        {activeTab === 'IMAGES' && (
          <p className="text-[10px] text-zinc-500 text-center mt-2">
            <i className="ri-cursor-line mr-1" />클릭하면 프롬프트에 참조됩니다
          </p>
        )}
      </div>

      {/* Drag & Drop */}
      <div className="p-3 flex-shrink-0">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`p-3.5 rounded-2xl cursor-pointer transition-all border flex items-center gap-3 ${
            isDragOver
              ? 'border-indigo-500/60 bg-indigo-500/10'
              : 'border-white/5 bg-zinc-900/40 hover:bg-zinc-900/60 hover:border-white/10'
          }`}
        >
          <div className={`p-2 rounded-xl w-9 h-9 flex items-center justify-center flex-shrink-0 transition-colors ${isDragOver ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800/60 text-zinc-500'}`}>
            <i className="ri-upload-2-line text-base" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-zinc-400">{isDragOver ? '여기에 놓으세요!' : 'Drag & Drop'}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">Image · Video · Audio</p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-zinc-800/60 border border-white/5 text-zinc-600">+</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0">
        {filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-zinc-600 text-center">
            <i className="ri-inbox-line text-2xl mb-1" />
            <span className="text-xs">No {activeTab.toLowerCase()} yet</span>
            <p className="text-[10px] text-zinc-700 mt-0.5">Upload files to see them here</p>
          </div>
        ) : activeTab === 'IMAGES' ? (
          <div className="grid grid-cols-2 gap-1.5">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                onClick={() => handleImageClick(file)}
                className={`relative group aspect-square rounded-xl overflow-hidden cursor-pointer transition-all ${
                  selectedId === file.id
                    ? 'ring-2 ring-indigo-500 ring-offset-1 ring-offset-zinc-900'
                    : 'hover:ring-2 hover:ring-indigo-500/50'
                }`}
              >
                <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                {selectedId === file.id && (
                  <div className="absolute top-1 right-1 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                    <i className="ri-check-line text-white text-[10px]" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                  <i className="ri-cursor-line text-white text-sm" />
                  <span className="text-[9px] text-white font-bold">참조 추가</span>
                </div>
                <button
                  onClick={(e) => handleRemove(file.id, e)}
                  className="absolute top-1 left-1 w-5 h-5 bg-red-500/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <i className="ri-close-line text-white text-[10px]" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-[8px] text-zinc-300 truncate">{file.name}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {filteredFiles.map((file) => (
              <div key={file.id} className="flex items-center gap-2 p-2 rounded-xl bg-zinc-900/60 border border-white/5 group">
                <div className="w-8 h-8 rounded-lg bg-zinc-800/60 flex items-center justify-center flex-shrink-0">
                  <i className={`text-sm ${
                    file.type === 'video' ? 'ri-video-line text-indigo-400' :
                    file.type === 'audio' ? 'ri-music-line text-emerald-400' :
                    'ri-box-3-line text-amber-400'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-zinc-300 font-medium truncate">{file.name}</p>
                  <p className="text-[9px] text-zinc-600">{formatBytes(file.size)}</p>
                </div>
                <button
                  onClick={(e) => handleRemove(file.id, e)}
                  className="w-5 h-5 flex items-center justify-center rounded text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                >
                  <i className="ri-close-line text-xs" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div className="absolute bottom-3 left-3 right-3 z-50 px-3 py-2 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-300 text-[10px] font-bold text-center">
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Angle Sidebar Panel (Full Interactive) ────────────────────────────────

function AngleSidebarPanel({
  appliedAngle,
  onClearAngle,
  onApplyAngle,
  angleDraft,
  onAngleDraftChange,
}: {
  appliedAngle?: AppliedAngle | null;
  onClearAngle?: () => void;
  onApplyAngle?: (angle: AppliedAngle) => void;
  angleDraft?: { pan: number; tilt: number; zoom: number } | null;
  onAngleDraftChange?: (draft: { pan: number; tilt: number; zoom: number }) => void;
}) {
  const [pan,  setPan]  = useState(angleDraft?.pan  ?? appliedAngle?.pan  ?? 0);
  const [tilt, setTilt] = useState(angleDraft?.tilt ?? appliedAngle?.tilt ?? 0);
  const [zoom, setZoom] = useState(angleDraft?.zoom ?? appliedAngle?.zoom ?? 0);
  const [activePreset, setActivePreset] = useState<string | null>(appliedAngle?.presetId ?? null);
  const [applyToast, setApplyToast] = useState(false);

  // angleDraft(AngleView에서 드래그)가 바뀌면 슬라이더 동기화
  useEffect(() => {
    if (angleDraft) {
      setPan(angleDraft.pan);
      setTilt(angleDraft.tilt);
      setZoom(angleDraft.zoom);
    }
  }, [angleDraft]);

  // appliedAngle이 외부에서 변경될 때 슬라이더 값 동기화
  useEffect(() => {
    if (appliedAngle) {
      setPan(appliedAngle.pan);
      setTilt(appliedAngle.tilt);
      setZoom(appliedAngle.zoom);
      setActivePreset(appliedAngle.presetId ?? null);
    } else {
      setPan(0); setTilt(0); setZoom(0); setActivePreset(null);
    }
  }, [appliedAngle]);

  const isApplied = appliedAngle !== null && appliedAngle !== undefined;

  const applyPreset = (preset: typeof ANGLE_PRESETS[0]) => {
    setPan(preset.pan);
    setTilt(preset.tilt);
    setZoom(0);
    setActivePreset(preset.id);
    onAngleDraftChange?.({ pan: preset.pan, tilt: preset.tilt, zoom: 0 });
  };

  const handleApply = () => {
    if (!onApplyAngle) return;
    const presetLabel = activePreset
      ? ANGLE_PRESETS.find((p) => p.id === activePreset)?.label ?? null
      : null;
    onApplyAngle({
      presetId: activePreset,
      label: presetLabel ?? `PAN ${Math.round(pan)}° TILT ${Math.round(tilt)}°`,
      pan: Math.round(pan),
      tilt: Math.round(tilt),
      zoom: Math.round(zoom),
    });
    setApplyToast(true);
    setTimeout(() => setApplyToast(false), 2000);
  };

  const handleReset = () => {
    setPan(0); setTilt(0); setZoom(0); setActivePreset(null);
    onAngleDraftChange?.({ pan: 0, tilt: 0, zoom: 0 });
  };

  const sliders = [
    {
      label: 'PAN',
      value: pan,
      min: -180, max: 180,
      unit: '°',
      onChange: (v: number) => { setPan(v); setActivePreset(null); onAngleDraftChange?.({ pan: v, tilt, zoom }); },
    },
    {
      label: 'TILT',
      value: tilt,
      min: -90, max: 90,
      unit: '°',
      onChange: (v: number) => { setTilt(v); setActivePreset(null); onAngleDraftChange?.({ pan, tilt: v, zoom }); },
    },
    {
      label: 'ZOOM',
      value: zoom,
      min: -50, max: 50,
      unit: '',
      onChange: (v: number) => { setZoom(v); onAngleDraftChange?.({ pan, tilt, zoom: v }); },
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#111113] relative">
      {/* Toast */}
      {applyToast && (
        <div className="absolute top-3 left-3 right-3 z-50 px-3 py-2 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-300 text-[10px] font-bold text-center flex items-center justify-center gap-1.5">
          <i className="ri-check-double-line" />앵글이 생성 탭에 적용되었습니다
        </div>
      )}

      {/* Header */}
      <PageHeader
        icon="ri-focus-3-line"
        title="카메라 앵글"
        subtitle="Camera Angle & Composition"
        badge="생성용"
        badgeColor="indigo"
        appliedLabel={isApplied ? `${appliedAngle!.label} · P${appliedAngle!.pan}° T${appliedAngle!.tilt}°` : undefined}
        appliedColor="indigo"
        actions={
          <>
            <button
              onClick={handleReset}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-300 cursor-pointer transition-colors"
              title="초기화"
            >
              <i className="ri-refresh-line text-sm" />
            </button>
            {isApplied && (
              <button
                onClick={onClearAngle}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 cursor-pointer transition-colors"
                title="적용 해제"
              >
                <i className="ri-close-line text-sm" />
              </button>
            )}
          </>
        }
      />

      {/* 역할 안내 배너 */}
      <div className="px-4 py-2 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-500/8 border border-indigo-500/20">
          <i className="ri-sparkling-2-fill text-indigo-400 text-[10px] flex-shrink-0" />
          <p className="text-[9px] text-indigo-300/80 leading-tight">
            앵글 설정 후 <strong className="text-indigo-300">적용 버튼</strong>을 누르면 이미지 생성 시 AI 프롬프트에 자동 반영됩니다
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 py-3 flex flex-col gap-4">

        {/* Live readout */}
        <div className="flex gap-1.5">
          {[
            { label: 'PAN',  value: Math.round(pan),  unit: '°' },
            { label: 'TILT', value: Math.round(tilt), unit: '°' },
            { label: 'ZOOM', value: Math.round(zoom), unit: '' },
          ].map((item) => (
            <div key={item.label} className="flex-1 flex flex-col items-center py-2 rounded-xl bg-zinc-900/60 border border-white/5">
              <span className="text-[8px] text-zinc-600 uppercase tracking-widest font-bold">{item.label}</span>
              <span className="text-sm font-black text-indigo-400 mt-0.5 tabular-nums">{item.value}{item.unit}</span>
            </div>
          ))}
        </div>

        {/* Sliders */}
        <div className="flex flex-col gap-4">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black -mb-2">앵글 조정</p>
          {sliders.map((s) => (
            <div key={s.label}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-zinc-400 font-bold">{s.label}</span>
                <span className="text-[10px] text-indigo-400 font-black tabular-nums">
                  {Math.round(s.value)}{s.unit}
                </span>
              </div>
              <RangeSlider
                value={s.value}
                min={s.min}
                max={s.max}
                onChange={s.onChange}
                gradient="from-indigo-500 to-violet-500"
                thumbColor="border-indigo-400"
                height="h-4"
                thumbSize="w-3.5 h-3.5"
              />
            </div>
          ))}
        </div>

        {/* Presets */}
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-2">앵글 프리셋</p>
          <div className="grid grid-cols-2 gap-1.5">
            {ANGLE_PRESETS.map((preset) => {
              const isSelected = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className={`flex items-center gap-1.5 px-2 py-2 rounded-xl border transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'border-indigo-500/40 bg-indigo-500/10'
                      : 'border-white/5 bg-zinc-900/40 hover:border-white/10 hover:bg-zinc-800/40'
                  }`}
                >
                  <div className={`w-5 h-5 flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'text-indigo-400' : 'text-zinc-600'
                  }`}>
                    <i className={`${preset.icon} text-xs`} />
                  </div>
                  <span className={`text-[10px] font-bold truncate ${isSelected ? 'text-indigo-300' : 'text-zinc-400'}`}>
                    {preset.label}
                  </span>
                  {isSelected && <i className="ri-check-line text-indigo-400 text-[9px] ml-auto flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Apply button */}
      <div className="p-3 border-t border-white/5 flex-shrink-0 flex flex-col gap-2">
        {/* 적용 흐름 안내 */}
        <div className="flex items-center gap-1.5 text-[9px] text-zinc-600 px-1">
          <i className="ri-focus-3-line text-zinc-700 text-[10px]" />
          <span>앵글 설정</span>
          <i className="ri-arrow-right-s-line text-zinc-700" />
          <i className="ri-send-plane-line text-indigo-500/60 text-[10px]" />
          <span className="text-indigo-400/60">프롬프트 반영</span>
          <i className="ri-arrow-right-s-line text-zinc-700" />
          <i className="ri-sparkling-2-line text-indigo-500/60 text-[10px]" />
          <span className="text-indigo-400/60">이미지 생성</span>
        </div>

        <button
          onClick={handleApply}
          className="w-full py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white cursor-pointer"
        >
          <i className="ri-sparkling-2-fill text-sm" />
          생성 탭에 적용
          <span className="text-[9px] opacity-70 font-normal">
            {activePreset
              ? ANGLE_PRESETS.find((p) => p.id === activePreset)?.label
              : `PAN ${Math.round(pan)}° TILT ${Math.round(tilt)}°`}
          </span>
        </button>

        {isApplied && (
          <button
            onClick={onClearAngle}
            className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[10px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <i className="ri-close-circle-line text-xs" />앵글 적용 해제
          </button>
        )}
      </div>
    </div>
  );
}

// ── Look Panel (Full Interactive) ─────────────────────────────────────────

const COLOR_GRADES = [
  { id: 'teal-orange', label: 'Teal & Orange', colors: ['#1a9e8f', '#e8622a'], desc: '영화 표준 보색 대비' },
  { id: 'warm',        label: 'Warm Tone',     colors: ['#e8a44a', '#c45c2a'], desc: '따뜻한 황금빛 톤' },
  { id: 'cool',        label: 'Cool Tone',     colors: ['#4a7fc1', '#2a4a8a'], desc: '차갑고 세련된 블루' },
  { id: 'bw',          label: 'B&W',           colors: ['#888', '#222'],       desc: '흑백 클래식' },
  { id: 'fade',        label: 'Faded',         colors: ['#b0a090', '#8a7a6a'], desc: '빈티지 페이드 효과' },
  { id: 'vivid',       label: 'Vivid',         colors: ['#e83a6a', '#4a2ae8'], desc: '선명하고 강렬한 색감' },
];

const FILM_STYLES = [
  { id: 'kodak-gold',  label: 'Kodak Gold 200',  icon: 'ri-camera-3-line',  desc: '따뜻한 황금빛 필름 입자' },
  { id: 'fuji-400h',   label: 'Fuji 400H',       icon: 'ri-camera-3-line',  desc: '쿨한 파스텔 스킨 톤' },
  { id: 'ilford-hp5',  label: 'Ilford HP5',      icon: 'ri-camera-3-line',  desc: '클래식 흑백 고감도' },
  { id: 'cinestill',   label: 'CineStill 800T',  icon: 'ri-film-line',      desc: '텅스텐 빛 헤일로 효과' },
  { id: 'portra-400',  label: 'Kodak Portra 400',icon: 'ri-camera-3-line',  desc: '자연스러운 스킨 톤' },
  { id: 'ektachrome',  label: 'Ektachrome E100', icon: 'ri-film-line',      desc: '선명한 슬라이드 필름' },
];

function LookSidebarPanel({
  appliedLook,
  onClearLook,
  onApplyLook,
}: {
  appliedLook?: AppliedLook | null;
  onClearLook?: () => void;
  onApplyLook?: (look: AppliedLook) => void;
}) {
  const [activeSection, setActiveSection] = useState<'look' | 'color' | 'film'>('look');
  const [selectedLookId, setSelectedLookId] = useState<string | null>(appliedLook?.id ?? null);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [selectedFilmId, setSelectedFilmId] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(appliedLook?.intensity ?? 80);
  const [applyToast, setApplyToast] = useState(false);

  const selectedLook = LOOK_OPTIONS.find((l) => l.id === selectedLookId) ?? null;
  const selectedColor = COLOR_GRADES.find((c) => c.id === selectedColorId) ?? null;
  const selectedFilm = FILM_STYLES.find((f) => f.id === selectedFilmId) ?? null;

  const handleApply = () => {
    if (!onApplyLook) return;
    const target = selectedLook ?? (selectedColor ? { id: selectedColor.id, label: selectedColor.label, category: '컬러 그레이딩' } : null) ?? (selectedFilm ? { id: selectedFilm.id, label: selectedFilm.label, category: '필름 스타일' } : null);
    if (!target) return;
    onApplyLook({ id: target.id, label: target.label, category: target.category, intensity });
    setApplyToast(true);
    setTimeout(() => setApplyToast(false), 2000);
  };

  const hasSelection = selectedLookId !== null || selectedColorId !== null || selectedFilmId !== null;
  const isApplied = appliedLook !== null && appliedLook !== undefined;

  const sections = [
    { id: 'look' as const,  label: 'LOOK',  icon: 'ri-eye-line' },
    { id: 'color' as const, label: 'COLOR', icon: 'ri-palette-line' },
    { id: 'film' as const,  label: 'FILM',  icon: 'ri-film-line' },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#111113] relative">
      {/* Toast */}
      {applyToast && (
        <div className="absolute top-3 left-3 right-3 z-50 px-3 py-2 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-300 text-[10px] font-bold text-center flex items-center justify-center gap-1.5">
          <i className="ri-check-double-line" />룩이 생성 탭에 적용되었습니다
        </div>
      )}

      {/* Header */}
      <PageHeader
        icon="ri-eye-line"
        title="룩 스타일"
        subtitle="Color · Mood · Visual Style"
        badgeColor="indigo"
        appliedLabel={isApplied ? `${appliedLook!.label} · ${appliedLook!.intensity}%` : undefined}
        appliedColor="indigo"
        actions={
          isApplied ? (
            <button
              onClick={onClearLook}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 cursor-pointer transition-colors"
              title="적용 해제"
            >
              <i className="ri-close-line text-sm" />
            </button>
          ) : undefined
        }
      />

      {/* Section tabs */}
      <div className="px-3 pt-3 pb-2 border-b border-white/5 flex-shrink-0">
        <div className="flex gap-1 bg-zinc-900/60 border border-white/5 p-1 rounded-xl">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer outline-none focus:outline-none border ${
                activeSection === s.id
                  ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/25'
                  : 'text-zinc-500 hover:text-zinc-300 border-transparent'
              }`}
            >
              <i className={`${s.icon} text-xs`} />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 py-3 pb-3">

        {/* ── LOOK section ── */}
        {activeSection === 'look' && (
          <div className="flex flex-col gap-1.5">
            {LOOK_OPTIONS.map((look) => {
              const isSelected = selectedLookId === look.id;
              return (
                <button
                  key={look.id}
                  onClick={() => {
                    setSelectedLookId(isSelected ? null : look.id);
                    setSelectedColorId(null);
                    setSelectedFilmId(null);
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl border transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'border-indigo-500/40 bg-indigo-500/10'
                      : 'border-white/5 bg-zinc-900/40 hover:border-white/10 hover:bg-zinc-800/40'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-indigo-500/20' : 'bg-zinc-800/60'
                  }`}>
                    <i className={`${look.icon} text-sm ${isSelected ? 'text-indigo-400' : 'text-zinc-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-bold ${isSelected ? 'text-indigo-300' : 'text-zinc-300'}`}>{look.label}</p>
                    <p className="text-[9px] text-zinc-600 truncate">{look.desc}</p>
                  </div>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${
                    isSelected ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/25' : 'bg-zinc-800/60 text-zinc-600 border border-white/5'
                  }`}>{look.category}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── COLOR GRADING section ── */}
        {activeSection === 'color' && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[9px] text-zinc-600 mb-1">컬러 그레이딩 프리셋을 선택하세요</p>
            {COLOR_GRADES.map((cg) => {
              const isSelected = selectedColorId === cg.id;
              return (
                <button
                  key={cg.id}
                  onClick={() => {
                    setSelectedColorId(isSelected ? null : cg.id);
                    setSelectedLookId(null);
                    setSelectedFilmId(null);
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl border transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'border-indigo-500/40 bg-indigo-500/10'
                      : 'border-white/5 bg-zinc-900/40 hover:border-white/10 hover:bg-zinc-800/40'
                  }`}
                >
                  {/* Color swatch */}
                  <div className="flex gap-0.5 flex-shrink-0">
                    {cg.colors.map((c, i) => (
                      <div
                        key={i}
                        className="w-3.5 h-7 rounded-md first:rounded-l-lg last:rounded-r-lg"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-bold ${isSelected ? 'text-indigo-300' : 'text-zinc-300'}`}>{cg.label}</p>
                    <p className="text-[9px] text-zinc-600 truncate">{cg.desc}</p>
                  </div>
                  {isSelected && <i className="ri-check-line text-indigo-400 text-xs flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        {/* ── FILM STYLE section ── */}
        {activeSection === 'film' && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[9px] text-zinc-600 mb-1">아날로그 필름 시뮬레이션을 선택하세요</p>
            {FILM_STYLES.map((film) => {
              const isSelected = selectedFilmId === film.id;
              return (
                <button
                  key={film.id}
                  onClick={() => {
                    setSelectedFilmId(isSelected ? null : film.id);
                    setSelectedLookId(null);
                    setSelectedColorId(null);
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl border transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'border-indigo-500/40 bg-indigo-500/10'
                      : 'border-white/5 bg-zinc-900/40 hover:border-white/10 hover:bg-zinc-800/40'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-indigo-500/20' : 'bg-zinc-800/60'
                  }`}>
                    <i className={`${film.icon} text-sm ${isSelected ? 'text-indigo-400' : 'text-zinc-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[10px] font-bold leading-tight ${isSelected ? 'text-indigo-300' : 'text-zinc-300'}`}>{film.label}</p>
                    <p className="text-[9px] text-zinc-600 truncate mt-0.5">{film.desc}</p>
                  </div>
                  {isSelected && <i className="ri-check-line text-indigo-400 text-xs flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Intensity + Apply */}
      <div className="p-3 border-t border-white/5 flex-shrink-0 flex flex-col gap-2.5">
        {/* Intensity slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">강도</span>
            <span className="text-[10px] text-indigo-400 font-black">{intensity}%</span>
          </div>
          <RangeSlider
            value={intensity}
            min={0}
            max={100}
            onChange={setIntensity}
            gradient="from-indigo-500 to-violet-500"
            thumbColor="border-indigo-400"
            height="h-4"
            thumbSize="w-3.5 h-3.5"
          />
        </div>

        {/* Apply button */}
        <button
          onClick={handleApply}
          disabled={!hasSelection}
          className={`w-full py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
            hasSelection
              ? 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white cursor-pointer'
              : 'bg-zinc-800/60 border border-white/5 text-zinc-600 cursor-not-allowed'
          }`}
        >
          <i className="ri-send-plane-fill text-sm" />
          {hasSelection
            ? `${selectedLook?.label ?? selectedColor?.label ?? selectedFilm?.label} 적용`
            : '룩을 선택하세요'}
        </button>

        {/* Clear button */}
        {isApplied && (
          <button
            onClick={onClearLook}
            className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[10px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <i className="ri-close-circle-line text-xs" />룩 적용 해제
          </button>
        )}
      </div>
    </div>
  );
}

// ── Character Sidebar Panel ────────────────────────────────────────────────
const CHAR_CATEGORIES = ['전체', '비즈니스', '크리에이터', '패션', '스포츠', '라이프스타일', '아티스틱'] as const;
type CharCategory = typeof CHAR_CATEGORIES[number];

const CHAR_CATEGORY_ICONS: Record<string, string> = {
  '전체': 'ri-apps-2-line',
  '비즈니스': 'ri-briefcase-line',
  '크리에이터': 'ri-video-line',
  '패션': 'ri-t-shirt-line',
  '스포츠': 'ri-run-line',
  '라이프스타일': 'ri-sun-line',
  '아티스틱': 'ri-palette-line',
};

const CHAR_CATEGORY_COLORS: Record<string, string> = {
  '비즈니스': 'text-sky-400',
  '크리에이터': 'text-emerald-400',
  '패션': 'text-rose-400',
  '스포츠': 'text-orange-400',
  '라이프스타일': 'text-teal-400',
  '아티스틱': 'text-violet-400',
};

const SIDEBAR_CHAR_TEMPLATES = [
  { id: 'f4',  name: '수진',  gender: '여자' as const, category: '비즈니스',     tags: ['프로','비즈니스','신뢰'],       img: 'https://readdy.ai/api/search-image?query=professional%20Korean%20businesswoman%20formal%20attire%2C%20confident%20expression%2C%20clean%20office%20background%2C%20corporate%20portrait%2C%20polished%20appearance%2C%20studio%20lighting&width=400&height=533&seq=char_f4&orientation=portrait' },
  { id: 'f6',  name: '민지',  gender: '여자' as const, category: '비즈니스',     tags: ['세련','비즈니스','IT'],          img: 'https://readdy.ai/api/search-image?query=smart%20Korean%20woman%20business%20casual%20style%2C%20tech-savvy%20look%2C%20modern%20office%20background%2C%20approachable%20professional%20portrait%2C%20contemporary%20fashion&width=400&height=533&seq=char_f6&orientation=portrait' },
  { id: 'm1',  name: '준혁',  gender: '남자' as const, category: '비즈니스',     tags: ['지적','신뢰','전문가'],          img: 'https://readdy.ai/api/search-image?query=intelligent%20Korean%20man%20business%20casual%20attire%2C%20trustworthy%20expression%2C%20clean%20office%20background%2C%20professional%20portrait%2C%20smart%20appearance%2C%20confident%20pose&width=400&height=533&seq=char_m1&orientation=portrait' },
  { id: 'm3',  name: '민준',  gender: '남자' as const, category: '비즈니스',     tags: ['모던','비즈니스','세련'],        img: 'https://readdy.ai/api/search-image?query=modern%20Korean%20businessman%20sleek%20style%2C%20confident%20expression%2C%20minimal%20dark%20background%2C%20contemporary%20professional%20portrait%2C%20sharp%20fashion%20sense&width=400&height=533&seq=char_m3&orientation=portrait' },
  { id: 'f2',  name: '지아',  gender: '여자' as const, category: '크리에이터',   tags: ['밝음','캐주얼','웜톤'],          img: 'https://readdy.ai/api/search-image?query=cheerful%20young%20Korean%20woman%20bright%20smile%2C%20casual%20warm-toned%20outfit%2C%20friendly%20expression%2C%20clean%20white%20background%2C%20lifestyle%20portrait%20photography%2C%20natural%20light&width=400&height=533&seq=char_f2&orientation=portrait' },
  { id: 'f8',  name: '나연',  gender: '여자' as const, category: '크리에이터',   tags: ['트렌디','활발','젊음'],          img: 'https://readdy.ai/api/search-image?query=young%20trendy%20Korean%20woman%20vibrant%20energy%2C%20colorful%20casual%20outfit%2C%20dynamic%20pose%2C%20bright%20background%2C%20youthful%20portrait%20photography%2C%20fun%20personality&width=400&height=533&seq=char_f8&orientation=portrait' },
  { id: 'm2',  name: '태양',  gender: '남자' as const, category: '크리에이터',   tags: ['친근','따뜻','캐주얼'],          img: 'https://readdy.ai/api/search-image?query=friendly%20warm%20Korean%20man%20casual%20style%2C%20approachable%20smile%2C%20bright%20natural%20background%2C%20lifestyle%20portrait%2C%20relatable%20personality%2C%20natural%20light%20photography&width=400&height=533&seq=char_m2&orientation=portrait' },
  { id: 'f1',  name: '소연',  gender: '여자' as const, category: '패션',         tags: ['청순','내추럴','20대'],          img: 'https://readdy.ai/api/search-image?query=beautiful%20young%20Korean%20woman%20with%20natural%20makeup%2C%20soft%20smile%2C%20clean%20minimal%20background%2C%20studio%20portrait%2C%20elegant%20casual%20style%2C%20warm%20lighting%2C%20high%20quality%20photography&width=400&height=533&seq=char_f1&orientation=portrait' },
  { id: 'f5',  name: '유나',  gender: '여자' as const, category: '패션',         tags: ['엘레강스','고급','모던'],        img: 'https://readdy.ai/api/search-image?query=elegant%20Korean%20woman%20luxury%20fashion%2C%20sophisticated%20style%2C%20dark%20minimal%20background%2C%20high-end%20portrait%20photography%2C%20graceful%20pose%2C%20premium%20look&width=400&height=533&seq=char_f5&orientation=portrait' },
  { id: 'm4',  name: '재원',  gender: '남자' as const, category: '패션',         tags: ['트렌디','스트리트','젊음'],      img: 'https://readdy.ai/api/search-image?query=trendy%20young%20Korean%20man%20streetwear%20fashion%2C%20cool%20urban%20style%2C%20city%20background%2C%20dynamic%20portrait%2C%20youthful%20energy%2C%20contemporary%20look&width=400&height=533&seq=char_m4&orientation=portrait' },
  { id: 'm7',  name: '현우',  gender: '남자' as const, category: '스포츠',       tags: ['스포티','활동적','에너지'],      img: 'https://readdy.ai/api/search-image?query=sporty%20athletic%20Korean%20man%20activewear%2C%20energetic%20pose%2C%20gym%20or%20outdoor%20background%2C%20fitness%20portrait%2C%20healthy%20strong%20appearance%2C%20dynamic%20photography&width=400&height=533&seq=char_m7&orientation=portrait' },
  { id: 'm9',  name: '강민',  gender: '남자' as const, category: '스포츠',       tags: ['카리스마','강인','다크'],        img: 'https://readdy.ai/api/search-image?query=charismatic%20strong%20Korean%20man%20dark%20intense%20look%2C%20powerful%20presence%2C%20dark%20moody%20background%2C%20dramatic%20portrait%20photography%2C%20masculine%20energy%2C%20bold%20style&width=400&height=533&seq=char_m9&orientation=portrait' },
  { id: 'f10', name: '채원',  gender: '여자' as const, category: '라이프스타일', tags: ['귀여움','밝음','사랑스러움'],    img: 'https://readdy.ai/api/search-image?query=cute%20adorable%20Korean%20woman%20sweet%20smile%2C%20girly%20pastel%20outfit%2C%20soft%20pink%20background%2C%20lovely%20portrait%20photography%2C%20charming%20expression%2C%20kawaii%20style&width=400&height=533&seq=char_f10&orientation=portrait' },
  { id: 'm8',  name: '시우',  gender: '남자' as const, category: '라이프스타일', tags: ['내추럴','따뜻','라이프스타일'],  img: 'https://readdy.ai/api/search-image?query=natural%20warm%20Korean%20man%20lifestyle%20casual%2C%20relaxed%20smile%2C%20outdoor%20nature%20background%2C%20authentic%20portrait%2C%20genuine%20personality%2C%20soft%20natural%20lighting&width=400&height=533&seq=char_m8&orientation=portrait' },
  { id: 'f9',  name: '아이린',gender: '여자' as const, category: '아티스틱',     tags: ['아티스틱','독특','강렬'],        img: 'https://readdy.ai/api/search-image?query=artistic%20Korean%20woman%20avant-garde%20fashion%2C%20unique%20strong%20impression%2C%20dark%20artistic%20background%2C%20editorial%20portrait%2C%20bold%20style%2C%20creative%20photography&width=400&height=533&seq=char_f9&orientation=portrait' },
  { id: 'm6',  name: '도현',  gender: '남자' as const, category: '아티스틱',     tags: ['아티스틱','크리에이티브','감성'],img: 'https://readdy.ai/api/search-image?query=artistic%20creative%20Korean%20man%20unique%20style%2C%20expressive%20face%2C%20artistic%20studio%20background%2C%20creative%20portrait%20photography%2C%20musician%20or%20artist%20vibe&width=400&height=533&seq=char_m6&orientation=portrait' },
];

function CharacterSidebarPanel({
  appliedCharacter,
  onClearCharacter,
  onAddCustomChar,
  activeCharCategory,
  onCharCategoryChange,
}: {
  appliedCharacter?: AppliedCharacter | null;
  onClearCharacter?: () => void;
  onAddCustomChar?: (char: AppliedCharacter) => void;
  activeCharCategory?: string;
  onCharCategoryChange?: (cat: string) => void;
}) {
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [applyToast, setApplyToast] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setApplyToast(msg);
    setTimeout(() => setApplyToast(null), 2000);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      const char: AppliedCharacter = {
        id: `photo_${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, '') || '내 사진',
        gender: '여자',
        tags: ['사진 등록', '커스텀'],
        img: url,
      };
      onAddCustomChar?.(char);
      showToast(`${char.name} 등록됨`);
    }
    e.target.value = '';
  };

  const catCounts: Partial<Record<string, number>> = {
    '전체': SIDEBAR_CHAR_TEMPLATES.length,
    '비즈니스': SIDEBAR_CHAR_TEMPLATES.filter((c) => c.category === '비즈니스').length,
    '크리에이터': SIDEBAR_CHAR_TEMPLATES.filter((c) => c.category === '크리에이터').length,
    '패션': SIDEBAR_CHAR_TEMPLATES.filter((c) => c.category === '패션').length,
    '스포츠': SIDEBAR_CHAR_TEMPLATES.filter((c) => c.category === '스포츠').length,
    '라이프스타일': SIDEBAR_CHAR_TEMPLATES.filter((c) => c.category === '라이프스타일').length,
    '아티스틱': SIDEBAR_CHAR_TEMPLATES.filter((c) => c.category === '아티스틱').length,
    '내 캐릭터': 0,
  };

  const ALL_CATS = [...CHAR_CATEGORIES, '내 캐릭터'] as const;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#111113] relative">
      <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />

      {/* Toast */}
      {applyToast && (
        <div className="absolute top-3 left-3 right-3 z-50 px-3 py-2 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-300 text-[10px] font-bold text-center flex items-center justify-center gap-1.5">
          <i className="ri-check-double-line" />{applyToast}
        </div>
      )}

      {/* Header */}
      <PageHeader
        icon="ri-user-star-line"
        title="캐릭터"
        subtitle="AI Character Library"
        badgeColor="indigo"
        appliedLabel={appliedCharacter ? `${appliedCharacter.name} 적용 중` : undefined}
        appliedColor="indigo"
        actions={
          appliedCharacter ? (
            <button
              onClick={onClearCharacter}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 cursor-pointer transition-colors"
              title="적용 해제"
            >
              <i className="ri-close-line text-sm" />
            </button>
          ) : undefined
        }
      />

      {/* ── Applied Character ── */}
      <div className="px-3 pt-2 pb-2 flex-shrink-0">
        {appliedCharacter ? (
          <div
            className="flex items-center gap-2.5 p-2 rounded-xl bg-emerald-500/8 border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/12 transition-all group"
            onClick={onClearCharacter}
            title="클릭하여 해제"
          >
            <div className="w-9 h-[46px] rounded-lg overflow-hidden flex-shrink-0 border border-emerald-500/25">
              <img src={appliedCharacter.img} alt={appliedCharacter.name} className="w-full h-full object-cover object-top" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-emerald-300 truncate">{appliedCharacter.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[8px] text-emerald-500/80">생성 탭 적용 중</span>
              </div>
            </div>
            <i className="ri-close-line text-zinc-700 group-hover:text-red-400 text-sm transition-colors flex-shrink-0" />
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-white/8 bg-zinc-900/20">
            <i className="ri-user-line text-zinc-700 text-sm flex-shrink-0" />
            <p className="text-[10px] text-zinc-700">캐릭터 미선택</p>
          </div>
        )}
      </div>

      <div className="mx-3 h-px bg-white/5 flex-shrink-0" />

      {/* ── Library header ── */}
      <div className="px-4 pt-3 pb-1 flex-shrink-0">
        <div className="flex items-center gap-2 mb-0.5">
          <i className="ri-user-star-line text-indigo-400 text-sm" />
          <span className="text-xs font-black text-white">캐릭터 라이브러리</span>
        </div>
        <p className="text-[10px] text-zinc-600">{SIDEBAR_CHAR_TEMPLATES.length}개의 AI 캐릭터</p>
      </div>

      {/* ── Category list ── */}
      <div className="flex-1 overflow-y-auto py-1">
        {ALL_CATS.map((cat) => {
          const isActive = (activeCharCategory ?? '전체') === cat;
          const icon = cat === '내 캐릭터' ? 'ri-user-star-line' : (CHAR_CATEGORY_ICONS[cat] ?? 'ri-apps-2-line');
          const count = catCounts[cat] ?? 0;
          return (
            <button
              key={cat}
              onClick={() => onCharCategoryChange?.(cat)}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-all cursor-pointer group ${
                isActive
                  ? 'bg-indigo-500/10 text-indigo-300'
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/3'
              }`}
            >
              <div className={`w-5 h-5 flex items-center justify-center flex-shrink-0 ${isActive ? 'text-indigo-400' : `${CHAR_CATEGORY_COLORS[cat] ?? 'text-zinc-600'} group-hover:text-zinc-400`}`}>
                <i className={`${icon} text-sm`} />
              </div>
              <span className="text-xs font-bold flex-1 truncate">{cat}</span>
              {count > 0 && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${isActive ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-600'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom actions */}
      <div className="p-3 border-t border-white/5 flex-shrink-0 space-y-2">
        <button
          onClick={() => setShowCustomModal(true)}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600/80 to-violet-600/80 hover:from-indigo-500 hover:to-violet-500 text-white text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap"
        >
          <i className="ri-sparkling-2-fill text-xs" />AI 캐릭터 생성
        </button>
        <button
          onClick={() => photoRef.current?.click()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white bg-zinc-900/60 hover:bg-zinc-800 text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap"
        >
          <i className="ri-upload-2-line text-xs" />사진 등록
        </button>
      </div>

      {showCustomModal && (
        <CustomCharacterModal
          onClose={() => setShowCustomModal(false)}
          onGenerate={(char) => {
            onAddCustomChar?.(char);
            setShowCustomModal(false);
            showToast(`${char.name} 생성됨`);
          }}
        />
      )}
    </div>
  );
}

// ── Icon Rail items ────────────────────────────────────────────────────────
const iconItems: { icon: string; label: SidebarTab; activeColor: string; badge?: string }[] = [
  { icon: 'ri-sparkling-2-line', label: '생성',      activeColor: 'bg-indigo-500/20 text-indigo-400' },
  { icon: 'ri-focus-3-line',     label: 'ANGLE',     activeColor: 'bg-indigo-500/20 text-indigo-400', badge: '생성용' },
  { icon: 'ri-user-line',        label: 'Character', activeColor: 'bg-indigo-500/20 text-indigo-400' },
  { icon: 'ri-eye-line',         label: 'LOOK',      activeColor: 'bg-indigo-500/20 text-indigo-400' },
];

// ── Main Sidebar ───────────────────────────────────────────────────────────
export default function AICreateSidebar({
  activeTab,
  onTabChange,
  onStorageImageSelect,
  appliedAngle,
  onClearAngle,
  onApplyAngle,
  angleDraft,
  onAngleDraftChange,
  appliedLook,
  onClearLook,
  onApplyLook,
  appliedCharacter,
  onClearCharacter,
  onAddCustomChar,
  activeCharCategory,
  onCharCategoryChange,
}: SidebarProps) {
  return (
    <aside className="flex-shrink-0 bg-[#111113] border-r border-white/5 flex h-full overflow-hidden">
      {/* Icon rail */}
      <div className="w-20 flex-shrink-0 bg-[#0d0d0f] border-r border-white/5 flex flex-col items-center py-6 gap-4 h-full">
        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 mb-2 w-10 h-10 flex items-center justify-center">
          <i className="ri-sparkling-2-line text-lg" />
        </div>
        <div className="flex flex-col gap-4 w-full px-2">
          {iconItems.map((item) => (
            <button
              key={item.label}
              onClick={() => onTabChange(item.label)}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all cursor-pointer w-full relative ${
                activeTab === item.label ? item.activeColor : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              }`}
            >
              <i className={`${item.icon} text-lg`} />
              <span className="text-[10px] font-medium text-center leading-tight">
                {item.label === 'Character' ? 'Char' : item.label}
              </span>
              {/* 생성용 뱃지 */}
              {item.badge && (
                <span className={`text-[7px] font-black px-1 py-0.5 rounded-full leading-none whitespace-nowrap ${
                  activeTab === item.label
                    ? 'bg-indigo-500/30 text-indigo-300'
                    : 'bg-zinc-800/60 text-zinc-600 border border-white/5'
                }`}>
                  {item.badge}
                </span>
              )}
              {item.label === 'ANGLE' && appliedAngle && (
                <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-400" />
              )}
              {item.label === 'LOOK' && appliedLook && (
                <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-400" />
              )}
            </button>
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-4 mb-2">
          <button
            onClick={() => onTabChange(activeTab === '생성' ? 'ANGLE' : '생성')}
            className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            title="설정 / 패널 전환"
          >
            <i className="ri-settings-3-line text-lg" />
          </button>
        </div>
      </div>

      {/* Panel — always rendered to prevent layout jump */}
      <div className="flex flex-col overflow-hidden relative" style={{ width: '280px', flexShrink: 0 }}>
        {activeTab === '생성' && <StoragePanel onImageSelect={onStorageImageSelect} />}
        {activeTab === 'ANGLE' && (
          <AngleSidebarPanel
            appliedAngle={appliedAngle}
            onClearAngle={onClearAngle}
            onApplyAngle={onApplyAngle}
            angleDraft={angleDraft}
            onAngleDraftChange={onAngleDraftChange}
          />
        )}
        {activeTab === 'LOOK' && (
          <LookSidebarPanel appliedLook={appliedLook} onClearLook={onClearLook} onApplyLook={onApplyLook} />
        )}
        {activeTab === 'Character' && (
          <CharacterSidebarPanel
            appliedCharacter={appliedCharacter}
            onClearCharacter={onClearCharacter}
            onAddCustomChar={onAddCustomChar}
            activeCharCategory={activeCharCategory}
            onCharCategoryChange={onCharCategoryChange}
          />
        )}
      </div>
    </aside>
  );
}
