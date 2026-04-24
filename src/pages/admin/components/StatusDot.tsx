export default function StatusDot({ status }: { status: string }) {
  const cls = status === 'active' || status === 'normal'
    ? 'bg-emerald-400'
    : status === 'warning'
    ? 'bg-amber-400 animate-pulse'
    : status === 'error' || status === 'inactive'
    ? 'bg-red-400 animate-pulse'
    : 'bg-zinc-500';
  return <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cls}`} />;
}
