import { useNavigate, type NavigateFunction } from "react-router-dom";
import { useRoutes } from "react-router-dom";
import { Suspense, useEffect, createElement } from "react";
import routes from "./config";

let navigateResolver: (navigate: ReturnType<typeof useNavigate>) => void;

declare global {
  interface Window {
    REACT_APP_NAVIGATE: ReturnType<typeof useNavigate>;
  }
}

export const navigatePromise = new Promise<NavigateFunction>((resolve) => {
  navigateResolver = resolve;
});

function RouteFallback() {
  return createElement(
    'div',
    { className: 'min-h-screen flex items-center justify-center bg-[#09090c]' },
    createElement(
      'div',
      { className: 'flex items-center gap-2 text-zinc-500 text-sm' },
      createElement('i', { className: 'ri-loader-4-line animate-spin text-lg' }),
      '불러오는 중...',
    ),
  );
}

export function AppRoutes() {
  const element = useRoutes(routes);
  const navigate = useNavigate();
  useEffect(() => {
    window.REACT_APP_NAVIGATE = navigate;
    navigateResolver(window.REACT_APP_NAVIGATE);
  });
  return createElement(Suspense, { fallback: createElement(RouteFallback) }, element);
}
