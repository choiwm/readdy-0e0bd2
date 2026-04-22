// ── SidebarUpgrade — 사이드바 하단 업그레이드 CTA 공통 컴포넌트 ──────────

export default function SidebarUpgrade() {
  return (
    <div className="mt-auto pt-2">
      <div className="p-4 md:p-5 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 text-center relative overflow-hidden group">
        <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <p className="text-[10px] text-zinc-500 mb-2.5 md:mb-3 leading-relaxed">
          더 높은 품질과<br />무제한 렌더링이 필요하신가요?
        </p>
        <button className="w-full py-2 md:py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white rounded-xl text-[10px] font-black transition-all uppercase tracking-[0.2em] cursor-pointer whitespace-nowrap">
          유료로 업그레이드
        </button>
      </div>
    </div>
  );
}
