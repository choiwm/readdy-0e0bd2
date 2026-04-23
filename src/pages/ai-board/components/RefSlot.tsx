import { useRef } from 'react';
import type { ReferenceSlot } from '../types';

export default function RefSlot({ slot, onUpload }: { slot: ReferenceSlot; onUpload: (id: string, url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div onClick={() => inputRef.current?.click()} className="flex-shrink-0 w-[80px] h-[80px] rounded-xl border border-zinc-700/50 bg-zinc-900/60 hover:border-indigo-500/40 hover:bg-zinc-900 transition-all cursor-pointer overflow-hidden relative group">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(slot.id, URL.createObjectURL(f)); }} />
      {slot.imageUrl ? (
        <><img src={slot.imageUrl} alt={slot.label} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><i className="ri-edit-line text-white text-sm" /></div></>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5"><i className={`${slot.icon} text-zinc-600 text-xl group-hover:text-indigo-400 transition-colors`} /><span className="text-[10px] text-zinc-500 font-medium text-center leading-tight px-1">{slot.label}</span></div>
      )}
    </div>
  );
}
