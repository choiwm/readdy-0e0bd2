import { useState } from 'react';
import type { PromptTemplate } from '../types';

interface Props {
  template: PromptTemplate | null;
  onClose: () => void;
  onSave: (template: PromptTemplate) => void;
  isDark: boolean;
}

export default function PromptEditModal({ template, onClose, onSave, isDark }: Props) {
  const isNew = template === null;
  const [name, setName] = useState(template?.name ?? '');
  const [category, setCategory] = useState(template?.category ?? '영상');
  const [model, setModel] = useState(template?.model ?? 'GPT-4o');
  const [promptText, setPromptText] = useState('');

  const m = {
    bg:        isDark ? 'bg-[#0f0f13]'    : 'bg-white',
    border:    isDark ? 'border-white/10' : 'border-gray-200',
    text:      isDark ? 'text-white'      : 'text-gray-900',
    textSub:   isDark ? 'text-zinc-500'   : 'text-gray-500',
    inputBg:   isDark ? 'bg-zinc-900 border-white/10 text-white placeholder-zinc-600' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400',
    closeBtn:  isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-400 hover:text-gray-700',
    cancelBtn: isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
    selectBg:  isDark ? 'bg-zinc-900 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900',
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const saved: PromptTemplate = {
      id: template?.id ?? `PT-${Date.now()}`,
      name,
      category,
      model,
      lastUpdated: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
      usageCount: template?.usageCount ?? 0,
      active: template?.active ?? true,
    };
    onSave(saved);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className={`relative ${m.bg} border ${m.border} rounded-2xl w-full max-w-md p-6 z-10`}>
        <div className="flex items-center justify-between mb-5">
          <h3 className={`text-base font-black ${m.text}`}>{isNew ? '새 템플릿 추가' : '템플릿 편집'}</h3>
          <button onClick={onClose} className={`w-7 h-7 flex items-center justify-center ${m.closeBtn} cursor-pointer transition-colors`}>
            <i className="ri-close-line text-lg" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className={`text-xs font-semibold ${m.textSub} mb-1.5 block`}>템플릿 이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 유튜브 광고용 스크립트"
              className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 ${m.inputBg}`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`text-xs font-semibold ${m.textSub} mb-1.5 block`}>카테고리</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 cursor-pointer ${m.selectBg}`}
              >
                {['영상', '음악', '이미지', '음성', '텍스트'].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={`text-xs font-semibold ${m.textSub} mb-1.5 block`}>모델</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 cursor-pointer ${m.selectBg}`}
              >
                {['GPT-4o', 'Suno', 'Stable Diffusion', 'ElevenLabs', 'LALAL.AI'].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={`text-xs font-semibold ${m.textSub} mb-1.5 block`}>프롬프트 내용</label>
            <textarea
              rows={5}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="마스터 프롬프트 내용을 입력하세요..."
              className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 resize-none ${m.inputBg}`}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
          >
            {isNew ? '템플릿 추가' : '변경사항 저장'}
          </button>
          <button onClick={onClose} className={`flex-1 py-2.5 ${m.cancelBtn} text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap`}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
