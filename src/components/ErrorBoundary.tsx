import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto border border-rose-500/30">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-slate-100">Ocorreu um erro inesperado</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                A aplicação encontrou uma falha de renderização temporária, mas seus dados e credenciais estão seguros.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-950/80 rounded-lg p-3 text-left font-mono text-[11px] text-rose-300 border border-slate-800 max-h-36 overflow-auto">
                <p className="font-semibold">{this.state.error.name}: {this.state.error.message}</p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="mt-1 text-[10px] text-slate-500 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack.slice(0, 300)}
                  </pre>
                )}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Tentar Novamente</span>
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Recarregar Página</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
