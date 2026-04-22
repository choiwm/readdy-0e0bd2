import AppNavbar from '@/components/feature/AppNavbar';
import AdPage from '@/pages/ai-ad/components/AdPage';

export default function AIAdPage() {
  return (
    <div className="h-screen bg-[#0d0d0f] text-white flex flex-col overflow-hidden">
      <AppNavbar />
      <div className="flex-1 overflow-hidden">
        <AdPage />
      </div>
    </div>
  );
}
