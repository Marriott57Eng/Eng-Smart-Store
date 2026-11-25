import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in application:', error, errorInfo);

    // Auto-recover once if a stale cached module chunk caused a React hook/dispatcher mismatch
    const msg = error?.message || '';
    const isStaleChunkOrHookMismatch =
      msg.includes("reading 'useState'") ||
      msg.includes("reading 'useEffect'") ||
      msg.includes("reading 'useContext'") ||
      msg.includes('Invalid hook call') ||
      msg.includes('Failed to fetch dynamically imported module');

    if (isStaleChunkOrHookMismatch && typeof window !== 'undefined') {
      try {
        const lastReload = Number(sessionStorage.getItem('eng_auto_reload_ts') || '0');
        if (Date.now() - lastReload > 10000) {
          sessionStorage.setItem('eng_auto_reload_ts', String(Date.now()));
          window.location.reload();
        }
      } catch (_) {}
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mb-4 border border-red-500/30">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">เกิดข้อผิดพลาดในการโหลดระบบ</h2>
          <p className="text-sm text-slate-400 max-w-md mb-6">
            {this.state.error?.message || 'ระบบเกิดข้อผิดพลาดชั่วคราว'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl shadow-lg transition-all cursor-pointer"
            >
              โหลดหน้าใหม่
            </button>
            <button
              onClick={() => {
                try { localStorage.clear(); } catch (_) {}
                window.location.reload();
              }}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl border border-slate-700 transition-all cursor-pointer"
            >
              รีเซ็ตแคชและเข้าใหม่
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
