import { Component } from 'react';

// Without this, any uncaught error during render — anywhere in the app —
// unmounts the entire React tree and leaves a blank white page with no
// way back in except a hard refresh. This catches that and shows a
// recoverable screen instead. It does NOT catch errors inside event
// handlers (those still need their own try/catch, which is a separate,
// deliberate React limitation) — only render-time crashes.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Render crash caught by ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-plum-50 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-card">
            <h1 className="font-display text-xl font-semibold text-plum-900">Something went wrong</h1>
            <p className="mt-2 text-sm text-plum-700/70">
              This screen hit an unexpected error. Reloading usually fixes it — your data is safe either way.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 w-full rounded-xl bg-plum-700 py-3 font-medium text-white hover:bg-plum-800"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
