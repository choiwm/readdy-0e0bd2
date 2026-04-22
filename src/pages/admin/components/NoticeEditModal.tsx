import { useState } from 'react';
import type { Notice } from '../types';

interface Props {
  notice: Notice | null; // null = 새 공지
  onClose: () => void;
  onSave: (notice: Notice) => void;
  isDark: boolean;
}

export default function NoticeEditModal({ notice, onClose, onSave, isDark }: Props) {
  const isNew = notice === null;
  const [title, setTitle] = useState(notice?.title ?? '');
  const [type, setType] = useState(notice?.type ?? '업데이트');
  const [content, setContent] = useState('');
  const [_status, _setStatus] = useState<'published' | 'draft'>(
    (notice?.status as 'published' | 'draft') ?? 'draft'
  );

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

  const handlePublish = () => {
    if (!title.trim()) return;
    const saved: Notice = {
      id: notice?.id ?? `N-${String(Date.now()).slice(-3)}`,
      title,
      type,
      status: 'published',
      date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
      views: notice?.views ?? 0,
    };
    onSave(saved);
    onClose();
  };

  const handleDraft = () => {
    if (!title.trim()) return;
    const saved: Notice = {
      id: notice?.id ?? `N-${String(Date.now()).slice(-3)}`,
      title,
      type,
      status: 'draft',
      date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
      views: notice?.views ?? 0,
    };
    onSave(saved);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className={`relative ${m.bg} border ${m.border} rounded-2xl w-full max-w-md p-6 z-10`}>
        <div className="flex items-center justify-between mb-5">
          <h3 className={`text-base font-black ${m.text}`}>{isNew ? '공지사항 작성' : '공지사항 편집'}</h3>
          <button onClick={onClose} className={`w-7 h-7 flex items-center justify-center ${m.closeBtn} cursor-pointer transition-colors`}>
            <i className="ri-close-line text-lg" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className={`text-xs font-semibold ${m.textSub} mb-1.5 block`}>제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="공지사항 제목 입력..."
              className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 ${m.inputBg}`}
            />
          </div>
          <div>
            <label className={`text-xs font-semibold ${m.textSub} mb-1.5 block`}>유형</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 cursor-pointer ${m.selectBg}`}
            >
              {['업데이트', '점검', '이벤트', '공지'].map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`text-xs font-semibold ${m.textSub} mb-1.5 block`}>내용</label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="공지 내용을 입력하세요..."
              className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 resize-none ${m.inputBg}`}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={handlePublish}
            disabled={!title.trim()}
            className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
          >
            게시하기
          </button>
          <button
            onClick={handleDraft}
            disabled={!title.trim()}
            className={`flex-1 py-2.5 ${m.cancelBtn} text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap disabled:opacity-40`}
          >
            초안 저장
          </button>
        </div>
      </div>
    </div>
  );
}
