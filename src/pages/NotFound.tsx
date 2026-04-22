import { Link, useLocation } from 'react-router-dom';

const quickLinks = [
  { label: 'AI Create', to: '/ai-create', icon: 'ri-sparkling-2-line', desc: '이미지 · 영상 생성' },
  { label: 'AI Sound', to: '/ai-sound', icon: 'ri-equalizer-line', desc: 'TTS · 음악 · SFX' },
  { label: 'AI Board', to: '/ai-board', icon: 'ri-layout-grid-line', desc: '스토리보드 제작' },
  { label: 'YouTube Studio', to: '/youtube-studio', icon: 'ri-youtube-line', desc: '영상 자동화' },
];

export default function NotFound() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-indigo-600/8 blur-[140px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-violet-600/8 blur-[120px]" />
      </div>

      {/* Logo */}
      <Link to="/" className="mb-12 flex-shrink-0">
        <img
          src="https://static.readdy.ai/image/818485967d328b35909ddcc1d73f5659/99fa675bf72ff13d36de270333b480ff.png"
          alt="AiMetaWOW"
          className="h-8 opacity-60 hover:opacity-100 transition-opacity"
        />
      </Link>

      {/* 404 number */}
      <div className="relative mb-6 select-none">
        <span className="text-[10rem] md:text-[14rem] font-black leading-none text-transparent bg-clip-text bg-gradient-to-b from-zinc-700/60 to-zinc-900/20">
          404
        </span>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/8 flex items-center justify-center">
            <i className="ri-compass-discover-line text-2xl text-zinc-500" />
          </div>
        </div>
      </div>

      {/* Message */}
      <div className="text-center mb-3 relative z-10">
        <h1 className="text-2xl md:text-3xl font-black text-white mb-2">페이지를 찾을 수 없어요</h1>
        <p className="text-zinc-500 text-sm md:text-base max-w-sm mx-auto leading-relaxed">
          요청하신 페이지가 존재하지 않거나 이동되었어요.
        </p>
        <div className="mt-2 flex items-center justify-center gap-1.5">
          <i className="ri-map-pin-line text-zinc-700 text-xs" />
          <code className="text-xs text-zinc-700 font-mono">{location.pathname}</code>
        </div>
      </div>

      {/* CTA buttons */}
      <div className="flex items-center gap-3 mb-12 relative z-10">
        <Link to="/">
          <button className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap">
            <i className="ri-home-line" />
            홈으로 돌아가기
          </button>
        </Link>
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-white/8 hover:border-white/15 text-zinc-300 font-bold text-sm px-5 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap"
        >
          <i className="ri-arrow-left-line" />
          이전 페이지
        </button>
      </div>

      {/* Quick links */}
      <div className="relative z-10 w-full max-w-xl">
        <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-black text-center mb-4">
          이런 페이지는 어떠세요?
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {quickLinks.map((link) => (
            <Link key={link.to} to={link.to}>
              <div className="flex flex-col items-center gap-2 p-3.5 rounded-xl bg-zinc-900/60 border border-white/5 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all cursor-pointer group">
                <div className="w-9 h-9 rounded-xl bg-zinc-800 group-hover:bg-indigo-500/15 flex items-center justify-center transition-colors">
                  <i className={`${link.icon} text-zinc-500 group-hover:text-indigo-400 text-base transition-colors`} />
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-zinc-300 group-hover:text-white transition-colors whitespace-nowrap">{link.label}</p>
                  <p className="text-[9px] text-zinc-600 mt-0.5 whitespace-nowrap">{link.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer note */}
      <p className="mt-12 text-[11px] text-zinc-700 relative z-10">
        © 2026 AiMetaWOW — 문제가 지속되면{' '}
        <a href="mailto:support@aimeta.wow" className="text-zinc-600 hover:text-zinc-400 transition-colors underline underline-offset-2">
          고객지원
        </a>
        에 문의해주세요
      </p>
    </div>
  );
}
