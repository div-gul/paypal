import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ShopPilot UI Crash Caught]:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[240px] p-6 flex flex-col items-center justify-center text-center space-y-4 bg-white rounded-2xl border border-rose-200 shadow-sm m-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 font-heading">
              {this.props.fallbackTitle || 'Something went wrong displaying this view'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md">
              {this.state.error?.message || 'An unexpected rendering error occurred. You can safely reload the page or return to Home.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload App</span>
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.href = '/';
              }}
              className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-2 cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Go to Home</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
