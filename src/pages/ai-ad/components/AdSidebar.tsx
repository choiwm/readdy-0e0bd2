import { useRef } from 'react';
import { useCredits } from '@/hooks/useCredits';

const modelOptions = [
  { id: 'none', label: '기본 모델 없음', icon: 'ri-user-line' },
  { id: 'daeeun', label: '다은', icon: 'ri-user-fill' },
  { id: 'sohee', label: '소희', icon: 'ri-user-fill' },
  { id: 'junhyuk', label: '준혁', icon: 'ri-user-fill' },
  { id: 'taemin', label: '태민', icon: 'ri-user-fill' },
  { id: 'kangmin', label: '강민', icon: 'ri-user-fill' },
];

interface AdSidebarProps {
  productName: string;
  setProductName: (v: string) => void;
  productDesc: string;
  setProductDesc: (v: string) => void;
  productThumb: string | null;
  onThumbUpload: (url: string) => void;
  // Fix 5: 사이드바 제품 이미지를 부모에서 관리
  sidebarProducts: string[];
  setSidebarProducts: (v: string[] | ((prev: string[]) => string[])) => void;
  selectedModel: string;
  setSelectedModel: (v: string) => void;
  modelOpen: boolean;
  setModelOpen: (v: boolean) => void;
  onSave: () => void;
}

export default function AdSidebar({
  productName, setProductName,
  productDesc, setProductDesc,
  productThumb, onThumbUpload,
  sidebarProducts, setSidebarProducts,
  selectedModel, setSelectedModel,
  modelOpen, setModelOpen,
  onSave,
}: AdSidebarProps) {
  const currentModel = modelOptions.find((m) => m.id === selectedModel)!;
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const { credits } = useCredits();

  // 사용자가 50MB 이미지나 PDF 드래그해도 그대로 blob URL 만들어버려 나중에
  // fal.ai 가 image_too_large / file_download_error 로 422. browser-level
  // accept= 는 hint 일 뿐이니 명시적으로 검증.
  // 8MB 는 utils/uploadProductImage 의 MAX_FILE_SIZE 와 일치.
  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

  function validateImageFile(file: File): string | null {
    if (!file.type.startsWith('image/')) return '이미지 파일만 올릴 수 있어요.';
    if (file.size > MAX_IMAGE_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      return `이미지가 너무 커요 (${mb}MB). 8MB 이하로 줄여주세요.`;
    }
    return null;
  }

  const handleThumbChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) { alert(err); e.target.value = ''; return; }
    const url = URL.createObjectURL(file);
    onThumbUpload(url);
    e.target.value = '';
  };

  const handleProductChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || sidebarProducts.length >= 3) return;
    const err = validateImageFile(file);
    if (err) { alert(err); e.target.value = ''; return; }
    const url = URL.createObjectURL(file);
    setSidebarProducts((prev) => [...prev, url]);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0f0f11]">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-rose-500/20">
            <i className="ri-advertisement-line text-rose-400 text-sm" />
          </div>
          <div>
            <p className="text-sm font-black text-white">광고 설정</p>
            <p className="text-[10px] text-zinc-500">제품 정보를 입력하세요</p>
          </div>
          <span className="ml-auto text-[9px] font-black bg-gradient-to-r from-rose-500/20 to-orange-500/20 border border-rose-500/30 text-rose-400 px-2 py-0.5 rounded-full">PRO</span>
        </div>
        {/* Credits display */}
        <div className="flex items-center justify-between bg-zinc-900/60 border border-white/[0.06] rounded-xl px-3 py-2">
          <div className="flex items-center gap-1.5">
            <i className="ri-copper-diamond-line text-amber-400 text-sm" />
            <span className="text-xs text-zinc-400">보유 크레딧</span>
          </div>
          <span className="text-xs font-black text-amber-400">{credits?.toLocaleString() ?? '—'} CR</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
        {/* 제품 썸네일 */}
        <div>
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2.5">기본 제품 썸네일</p>
          <div
            onClick={() => thumbInputRef.current?.click()}
            className="relative w-full aspect-video rounded-xl overflow-hidden bg-zinc-900/60 border border-white/[0.06] flex items-center justify-center cursor-pointer hover:border-rose-500/30 transition-all group"
          >
            {productThumb ? (
              <>
                <img src={productThumb} alt="제품" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center gap-1">
                    <i className="ri-image-edit-line text-white text-xl" />
                    <span className="text-white text-[10px] font-bold">변경하기</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-zinc-600 group-hover:text-zinc-400 transition-colors">
                <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-800/60 group-hover:bg-rose-500/10 transition-colors">
                  <i className="ri-image-add-line text-xl" />
                </div>
                <p className="text-[10px]">클릭하여 이미지 업로드</p>
              </div>
            )}
          </div>
          {/* Fix 4: 썸네일 전용 input */}
          <input ref={thumbInputRef} type="file" accept="image/*" className="hidden" onChange={handleThumbChange} />
        </div>

        {/* 내 제품 */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">내 제품</p>
            <span className="text-[10px] text-zinc-600">{sidebarProducts.length}/3</span>
          </div>
          {sidebarProducts.length > 0 && (
            <div className="flex gap-2 mb-2 flex-wrap">
              {sidebarProducts.map((url, i) => (
                <div key={i} className="relative w-[56px] h-[56px] rounded-xl overflow-hidden border border-white/[0.06] group flex-shrink-0">
                  <img src={url} alt={`제품 ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => setSidebarProducts((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <i className="ri-close-line text-white text-[9px]" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {sidebarProducts.length < 3 && (
            <div
              onClick={() => productInputRef.current?.click()}
              className="bg-zinc-900/40 rounded-xl p-3.5 flex flex-col items-center gap-2 border border-dashed border-white/[0.08] cursor-pointer hover:border-rose-500/30 hover:bg-rose-500/[0.03] transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-zinc-800/60 group-hover:bg-rose-500/10 flex items-center justify-center transition-all">
                <i className="ri-image-line text-zinc-500 group-hover:text-rose-400 text-base transition-colors" />
              </div>
              <p className="text-[10px] text-zinc-500 text-center leading-relaxed">
                광고할 제품을 업로드하면<br />AI가 씬으로 만들어드립니다
              </p>
            </div>
          )}
          {/* Fix 4: 내 제품 전용 input */}
          <input ref={productInputRef} type="file" accept="image/*" className="hidden" onChange={handleProductChange} />
        </div>

        <div className="w-full h-px bg-white/[0.05]" />

        {/* 제품 설명 */}
        <div>
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">제품 설명 설정</p>
          <div className="mb-3">
            <label className="flex items-center gap-1.5 mb-1.5">
              <i className="ri-box-3-line text-rose-400 text-xs" />
              <span className="text-[11px] text-zinc-400 font-medium">제품 품명</span>
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="예: 조선미녀 선크림, 보조배터리..."
              className="w-full bg-zinc-900/60 border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-rose-500/30 transition-colors"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 mb-1.5">
              <i className="ri-file-text-line text-rose-400 text-xs" />
              <span className="text-[11px] text-zinc-400 font-medium">제품 설명</span>
            </label>
            <textarea
              value={productDesc}
              onChange={(e) => setProductDesc(e.target.value)}
              placeholder="예: 초 조선미녀 선크림바, 20000mAh 대용량, USB-C 고속충전 지원"
              rows={4}
              maxLength={500}
              className="w-full bg-zinc-900/60 border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-rose-500/30 transition-colors resize-none"
            />
            <p className="text-[9px] text-zinc-600 text-right mt-0.5">{productDesc.length}/500</p>
          </div>
        </div>

        <div className="w-full h-px bg-white/[0.05]" />

        {/* 기본 모델 */}
        <div>
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2.5">기본 모델</p>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setModelOpen(!modelOpen)}
              className="w-full flex items-center justify-between gap-2 bg-zinc-900/60 border border-white/[0.06] rounded-xl px-3.5 py-2.5 cursor-pointer hover:border-rose-500/30 transition-all"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-800">
                  <i className={`${currentModel.icon} text-zinc-400 text-xs`} />
                </div>
                <span className={`text-xs ${selectedModel === 'none' ? 'text-zinc-500' : 'text-white font-medium'}`}>
                  {currentModel.label}
                </span>
              </div>
              <i className={`ri-arrow-down-s-line text-zinc-500 transition-transform ${modelOpen ? 'rotate-180' : ''}`} />
            </button>
            {modelOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1e] border border-white/10 rounded-xl z-30 overflow-hidden">
                {modelOptions.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedModel(m.id); setModelOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs transition-colors cursor-pointer ${
                      selectedModel === m.id ? 'bg-rose-500/10 text-rose-300' : 'text-zinc-300 hover:bg-white/5'
                    }`}
                  >
                    <div className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-800">
                      <i className={`${m.icon} text-xs`} />
                    </div>
                    {m.label}
                    {selectedModel === m.id && <i className="ri-check-line text-rose-400 text-[10px] ml-auto" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Fix 5: 입력값 유무에 따라 버튼 상태 변경 */}
        <button
          onClick={onSave}
          disabled={!productName.trim() && !productDesc.trim() && !productThumb}
          className="w-full py-3 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm rounded-xl transition-all cursor-pointer whitespace-nowrap"
        >
          {productName.trim() || productDesc.trim() || productThumb
            ? '설정 적용하기'
            : '제품 정보를 입력하세요'}
        </button>
      </div>
    </div>
  );
}
