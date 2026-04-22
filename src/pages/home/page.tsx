import { useEffect } from 'react';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import WhatsNewSection from './components/WhatsNewSection';
import AllFeaturesSection from './components/AllFeaturesSection';
import FeaturedBanner from './components/FeaturedBanner';
import GetCreativeSection from './components/GetCreativeSection';
import Footer from './components/Footer';

const Divider = () => (
  <div className="max-w-5xl mx-auto px-8">
    <div className="h-px bg-gradient-to-r from-transparent via-indigo-500/15 to-transparent" />
  </div>
);

export default function HomePage() {
  useEffect(() => {
    document.title = 'AiMetaWOW — AI 이미지·영상·음성 생성 크리에이티브 플랫폼';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', 'AiMetaWOW는 AI 이미지 생성, AI 영상 제작, AI 음성 합성, 스토리보드, 유튜브 자동화까지 한 곳에서 제공하는 올인원 AI 크리에이티브 플랫폼입니다. Flux, Kling, ElevenLabs 기반의 최고 품질 AI 생성 도구를 경험하세요.');
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0b] font-sans text-white selection:bg-indigo-500/30 selection:text-white overflow-x-hidden">
      <Navbar />
      <main>
        <HeroSection />
        <Divider />
        <WhatsNewSection />
        <Divider />
        <AllFeaturesSection />
        <Divider />
        <FeaturedBanner />
        <Divider />
        <GetCreativeSection />
      </main>
      <Footer />
    </div>
  );
}
