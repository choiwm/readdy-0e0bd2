import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
    console.error('[ErrorBoundary] caught render error:', error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#0f0f11] text-white">
        <div className="max-w-md w-full bg-zinc-900 border border-red-500/30 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center flex-shrink-0">
              <i className="ri-error-warning-line text-red-400 text-lg" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold">문제가 발생했습니다</p>
              <p className="text-xs text-zinc-500 mt-0.5">페이지를 새로고침하거나 다시 시도하세요</p>
            </div>
          </div>
          <pre className="text-[11px] text-zinc-400 bg-black/40 border border-white/5 rounded-lg px-3 py-2 mb-4 overflow-auto max-h-40 leading-relaxed whitespace-pre-wrap break-words">
            {error.message || String(error)}
          </pre>
          <div className="flex gap-2">
            <button
              onClick={this.reset}
              className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
            >
              다시 시도
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-300 text-sm font-semibold hover:bg-white/5 cursor-pointer transition-colors whitespace-nowrap"
            >
              새로고침
            </button>
          </div>
        </div>
      </div>
    );
  }
}
