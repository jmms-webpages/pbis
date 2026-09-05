import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { signIn } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSignIn = async () => {
    setError('');
    setBusy(true);
    try {
      await signIn();
    } catch (e) {
      console.error(e);
      setError('Sign-in did not go through. Use your school Google account and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-plum-900 px-6">
      {/* Ambient gold arcs — a single deliberate decorative moment, not a generic gradient wash */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-40"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
      >
        <circle cx="1000" cy="120" r="380" stroke="#c2930f" strokeWidth="1.5" fill="none" opacity="0.5" />
        <circle cx="120" cy="720" r="260" stroke="#8f5cc4" strokeWidth="1.5" fill="none" opacity="0.5" />
      </svg>

      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-paper p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-plum-700 font-display text-2xl font-semibold text-gold-300">
            P
          </div>
          <h1 className="font-display text-2xl font-semibold text-plum-900">PBIS Rewards</h1>
          <p className="mt-1 text-sm text-plum-700/70">Sign in with your school Google account</p>
        </div>

        <button
          onClick={handleSignIn}
          disabled={busy}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-plum-200 bg-white px-4 py-3 font-medium text-plum-900 shadow-card transition hover:border-plum-300 hover:bg-plum-50 disabled:opacity-60"
        >
          <GoogleIcon />
          {busy ? 'Signing in…' : 'Continue with Google'}
        </button>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <p className="mt-8 text-center text-xs text-plum-700/50">
          Your role is assigned by your school — there's nothing to select here.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l2.99-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}
