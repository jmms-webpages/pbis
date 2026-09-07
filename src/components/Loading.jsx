import { useState, useEffect } from 'react';

export default function Loading({ label = 'Loading…', onReset }) {
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTroubleshoot(true);
    }, 6000);
    return () => clearTimeout(timer);
  }, []);

  const handleHardRefresh = () => {
    try {
      sessionStorage.clear();
      localStorage.clear();
    } catch {
      // ignore storage errors
    }
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-plum-200 border-t-plum-600" />
        <p className="font-body text-sm font-medium text-plum-700">{label}</p>

        {showTroubleshoot && (
          <div className="mt-4 rounded-xl border border-plum-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-plum-700/80">
              Taking longer than expected? This can happen if a cached session is reconnecting or if cookies are restricted in the iframe preview.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleHardRefresh}
                className="rounded-lg bg-plum-700 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-plum-800 transition"
              >
                Clear Cache & Reload
              </button>
              {onReset && (
                <button
                  type="button"
                  onClick={onReset}
                  className="text-xs font-medium text-plum-600 underline hover:text-plum-900"
                >
                  Return to Sign-In Screen
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

