import type { RouteObject } from "react-router-dom";
import NotFound from "../pages/NotFound";
import Home from "../pages/home/page";
import AICreate from "../pages/ai-create/page";
import AIAutomation from "../pages/ai-automation/page";
import AISound from "../pages/ai-sound/page";
import AIBoard from "../pages/ai-board/page";
import AIAd from "../pages/ai-ad/page";
import AIShortcuts from "../pages/ai-shortcuts/page";
import YoutubeStudio from "../pages/youtube-studio/page";
import Workflow from "../pages/workflow/page";
import Terms from "../pages/terms/page";
import Privacy from "../pages/privacy/page";
import CustomerSupport from "../pages/customer-support/page";
import Admin from "../pages/admin/page";
import AdminLogin from "../pages/admin-login/page";
import CreditPurchase from "../pages/credit-purchase/page";
import AdminGuard from "../components/feature/AdminGuard";

const routes: RouteObject[] = [
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/ai-create",
    element: <AICreate />,
  },
  {
    path: "/metawow",
    element: <AICreate />,
  },
  {
    path: "/automation-studio",
    element: <AIAutomation />,
  },
  {
    path: "/ai-sound",
    element: <AISound />,
  },
  {
    path: "/ai-board",
    element: <AIBoard />,
  },
  {
    path: "/ai-ad",
    element: <AIAd />,
  },
  {
    path: "/ai-services",
    element: <AIShortcuts />,
  },
  {
    path: "/youtube-studio",
    element: <YoutubeStudio />,
  },
  {
    path: "/workflow",
    element: <Workflow />,
  },
  {
    path: "/terms",
    element: <Terms />,
  },
  {
    path: "/privacy",
    element: <Privacy />,
  },
  {
    path: "/customer-support",
    element: <CustomerSupport />,
  },
  {
    path: "/admin-login",
    element: <AdminLogin />,
  },
  {
    path: "/admin",
    element: <AdminGuard><Admin /></AdminGuard>,
  },
  {
    path: "/credit-purchase",
    element: <CreditPurchase />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;
