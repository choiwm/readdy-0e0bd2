import { lazy } from "react";
import type { RouteObject } from "react-router-dom";
import Home from "../pages/home/page";
import NotFound from "../pages/NotFound";
import AdminGuard from "../components/feature/AdminGuard";

const AICreate = lazy(() => import("../pages/ai-create/page"));
const AIAutomation = lazy(() => import("../pages/ai-automation/page"));
const AISound = lazy(() => import("../pages/ai-sound/page"));
const AIBoard = lazy(() => import("../pages/ai-board/page"));
const AIAd = lazy(() => import("../pages/ai-ad/page"));
const AIShortcuts = lazy(() => import("../pages/ai-shortcuts/page"));
const YoutubeStudio = lazy(() => import("../pages/youtube-studio/page"));
const Workflow = lazy(() => import("../pages/workflow/page"));
const Terms = lazy(() => import("../pages/terms/page"));
const Privacy = lazy(() => import("../pages/privacy/page"));
const CustomerSupport = lazy(() => import("../pages/customer-support/page"));
const Admin = lazy(() => import("../pages/admin/page"));
const AdminLogin = lazy(() => import("../pages/admin-login/page"));
const CreditPurchase = lazy(() => import("../pages/credit-purchase/page"));

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
