import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/lifecycle errors anywhere below it so a bug (e.g. a
 * localStorage quota error, a bad data shape) shows a recoverable message
 * instead of a blank white screen. Does not catch errors in event handlers
 * or async code - those are handled locally where they happen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] caught an error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle size={28} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Terjadi kesalahan tak terduga</h1>
            <p className="mt-1.5 max-w-sm text-sm text-slate-500">
              Aplikasi mengalami error dan tidak dapat melanjutkan halaman ini. Coba muat ulang
              halaman - data yang sudah tersimpan tidak akan hilang.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
          >
            <RotateCcw size={15} />
            Muat Ulang
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
