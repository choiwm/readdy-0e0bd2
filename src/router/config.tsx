import { lazy } from "react";
import type { RouteObject } from "react-router-dom";
import Home from "../pages/home/page";
import NotFound from "../pages/NotFound";
import AdminGuard from "../components/feature/AdminGuard";
import ErrorBoundary from "../components/base/ErrorBoundary";

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
const PaymentSuccess = lazy(() => import("../pages/payment-success/page"));
const PaymentFail = lazy(() => import("../pages/payment-fail/page"));

const routes: RouteObject[] = [
  { path: "/", element: <ErrorBoundary><Home /></ErrorBoundary> },
  { path: "/ai-create", element: <ErrorBoundary><AICreate /></ErrorBoundary> },
  { path: "/metawow", element: <ErrorBoundary><AICreate /></ErrorBoundary> },
  { path: "/automation-studio", element: <ErrorBoundary><AIAutomation /></ErrorBoundary> },
  { path: "/ai-sound", element: <ErrorBoundary><AISound /></ErrorBoundary> },
  { path: "/ai-board", element: <ErrorBoundary><AIBoard /></ErrorBoundary> },
  { path: "/ai-ad", element: <ErrorBoundary><AIAd /></ErrorBoundary> },
  { path: "/ai-services", element: <ErrorBoundary><AIShortcuts /></ErrorBoundary> },
  { path: "/youtube-studio", element: <ErrorBoundary><YoutubeStudio /></ErrorBoundary> },
  { path: "/workflow", element: <ErrorBoundary><Workflow /></ErrorBoundary> },
  { path: "/terms", element: <ErrorBoundary><Terms /></ErrorBoundary> },
  { path: "/privacy", element: <ErrorBoundary><Privacy /></ErrorBoundary> },
  { path: "/customer-support", element: <ErrorBoundary><CustomerSupport /></ErrorBoundary> },
  { path: "/admin-login", element: <ErrorBoundary><AdminLogin /></ErrorBoundary> },
  { path: "/admin", element: <ErrorBoundary><AdminGuard><Admin /></AdminGuard></ErrorBoundary> },
  { path: "/credit-purchase", element: <ErrorBoundary><CreditPurchase /></ErrorBoundary> },
  { path: "/payment/success", element: <ErrorBoundary><PaymentSuccess /></ErrorBoundary> },
  { path: "/payment/fail", element: <ErrorBoundary><PaymentFail /></ErrorBoundary> },
  { path: "*", element: <NotFound /> },
];

export default routes;
